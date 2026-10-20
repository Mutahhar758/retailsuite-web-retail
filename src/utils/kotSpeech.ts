/**
 * KOT Text-To-Speech (TTS) Voice Callout Utility
 * Uses the browser's native Web Speech API (window.speechSynthesis)
 * Free, offline-capable, zero external latency.
 */

export interface KotSpeechItem {
  itemTitle?: string;
  qty: number;
}

export interface KotSpeechOrder {
  tokenNo?: number | null;
  orderType?: string;
  tableName?: string;
  lines: KotSpeechItem[];
  isRunning?: boolean;
}

export type VoiceAccentType = 
  | 'pakistani_male' 
  | 'urdu_male' 
  | 'uk_male' 
  | 'us_male' 
  | 'pakistani_female';

export const ACCENT_OPTIONS: { value: VoiceAccentType; label: string }[] = [
  { value: 'pakistani_male', label: '🇵🇰 Pakistani English (Male)' },
  { value: 'urdu_male', label: '🇵🇰 Urdu / اردو (Male)' },
  { value: 'uk_male', label: '🇬🇧 British English (Male)' },
  { value: 'us_male', label: '🇺🇸 American English (Male)' },
  { value: 'pakistani_female', label: '🇵🇰 Pakistani English (Female)' },
];

export interface KotSpeechOptions {
  rate?: number; // 0.8 to 1.5 (default 1.0)
  pitch?: number; // 0.6 to 1.4 (default based on gender)
  accent?: VoiceAccentType | string; // 'pakistani_male' (default), etc.
  voiceURI?: string; // Optional specific voice override
}

// Global cached voices to handle async voice loading in Chrome / Edge
let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Get all voices installed in the current browser/OS
 */
export const getInstalledVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const loaded = window.speechSynthesis.getVoices();
  if (loaded && loaded.length > 0) {
    cachedVoices = loaded;
  }
  return cachedVoices;
};

// Listen for browser voices initialization
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  // Initial immediate fetch
  getInstalledVoices();
}

const FEMALE_NAMES = [
  'zira', 'heera', 'neerja', 'uzma', 'swara', 'hazel', 'susan', 'sonia',
  'jenny', 'aria', 'samantha', 'victoria', 'karen', 'tessa', 'veena',
  'kalpana', 'fiona', 'female', 'woman', 'girl'
];

const MALE_NAMES = [
  'david', 'ravi', 'asad', 'prabhat', 'madhur', 'george', 'ryan', 'oliver',
  'guy', 'mark', 'christopher', 'eric', 'james', 'daniel', 'tom', 'brian',
  'alex', 'fred', 'junior', 'ralph', 'male', 'man', 'boy'
];

/**
 * Determine if a voice is known female
 */
export const isVoiceFemale = (v: SpeechSynthesisVoice): boolean => {
  const name = (v.name || '').toLowerCase();
  return FEMALE_NAMES.some(fn => name.includes(fn));
};

/**
 * Determine if a voice is known male
 */
export const isVoiceMale = (v: SpeechSynthesisVoice): boolean => {
  const name = (v.name || '').toLowerCase();
  if (MALE_NAMES.some(mn => name.includes(mn))) return true;
  if (isVoiceFemale(v)) return false;
  // If not explicitly female, check if name contains typical male clues
  return !isVoiceFemale(v);
};

/**
 * Get any available male voice from the system
 */
export const findAnyMaleVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  // First priority: explicit male names
  const explicitMale = voices.find(v => {
    const name = (v.name || '').toLowerCase();
    return MALE_NAMES.some(mn => name.includes(mn));
  });
  if (explicitMale) return explicitMale;

  // Second priority: not female
  const notFemale = voices.find(v => !isVoiceFemale(v));
  if (notFemale) return notFemale;

  return null;
};

interface VoiceResolution {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  lang: string;
}

/**
 * Smart voice & pitch resolver guaranteeing male voice for male accents
 */
export const resolveVoiceConfig = (accent: VoiceAccentType | string = 'pakistani_male', specificVoiceURI?: string): VoiceResolution => {
  const voices = getInstalledVoices();
  const normalize = (s: string) => (s || '').toLowerCase();

  // If a specific voice was explicitly selected by the user, honor it
  if (specificVoiceURI && voices.length > 0) {
    const matched = voices.find(v => v.voiceURI === specificVoiceURI || v.name === specificVoiceURI);
    if (matched) {
      const isFemale = isVoiceFemale(matched);
      return { 
        voice: matched, 
        pitch: isFemale ? 1.05 : 0.80, 
        lang: matched.lang 
      };
    }
  }

  // Normalize legacy setting values
  let resolvedAccent = accent;
  if (accent === 'pakistani') resolvedAccent = 'pakistani_male';
  if (accent === 'urdu') resolvedAccent = 'urdu_male';
  if (accent === 'english') resolvedAccent = 'us_male';

  const isMaleRequested = resolvedAccent.includes('male') && !resolvedAccent.includes('female');

  switch (resolvedAccent) {
    case 'pakistani_male': {
      // 1. Look for male South Asian / Pakistani voices (Ravi, Asad, Prabhat, Madhur)
      const desiMaleVoice = voices.find(v => {
        const name = normalize(v.name);
        const lang = normalize(v.lang);
        const isDesi = lang === 'en-in' || lang === 'en-pk' || lang === 'ur-pk' || name.includes('india') || name.includes('pakistan');
        return isDesi && isVoiceMale(v);
      });

      if (desiMaleVoice) {
        return {
          voice: desiMaleVoice,
          pitch: 0.80,
          lang: desiMaleVoice.lang || 'en-IN'
        };
      }

      // 2. If no desi male voice is installed on this PC, find ANY ENGLISH MALE voice!
      // (e.g. Microsoft David, Google UK Male, etc.)
      const anyMaleVoice = findAnyMaleVoice(voices);
      if (anyMaleVoice) {
        return {
          voice: anyMaleVoice,
          pitch: 0.80, // Lower pitch to give deep baritone male callout
          lang: anyMaleVoice.lang || 'en-US'
        };
      }

      // 3. Fallback if PC has literally only 1 voice and it's female:
      // Drop pitch drastically to force a deep low male register!
      return {
        voice: voices[0] || null,
        pitch: 0.58, // Low baritone frequency transformation
        lang: 'en-IN'
      };
    }

    case 'urdu_male': {
      // Look for Urdu / Pakistani male voice
      const urduMaleVoice = voices.find(v => {
        const name = normalize(v.name);
        const lang = normalize(v.lang);
        return (lang.startsWith('ur') || name.includes('urdu') || name.includes('asad')) && isVoiceMale(v);
      }) || voices.find(v => {
        const lang = normalize(v.lang);
        return (lang === 'en-in' || lang === 'en-pk') && isVoiceMale(v);
      }) || findAnyMaleVoice(voices);

      return {
        voice: urduMaleVoice || voices[0] || null,
        pitch: urduMaleVoice && isVoiceMale(urduMaleVoice) ? 0.80 : 0.58,
        lang: 'ur-PK'
      };
    }

    case 'pakistani_female': {
      const femaleVoice = voices.find(v => {
        const lang = normalize(v.lang);
        return (lang === 'en-in' || lang === 'en-pk') && isVoiceFemale(v);
      }) || voices.find(v => isVoiceFemale(v)) || voices[0] || null;

      return {
        voice: femaleVoice,
        pitch: 1.05,
        lang: femaleVoice?.lang || 'en-IN'
      };
    }

    case 'urdu_female': {
      const femaleVoice = voices.find(v => {
        const name = normalize(v.name);
        const lang = normalize(v.lang);
        return (lang.startsWith('ur') || name.includes('uzma')) && isVoiceFemale(v);
      }) || voices.find(v => isVoiceFemale(v)) || voices[0] || null;

      return {
        voice: femaleVoice,
        pitch: 1.05,
        lang: 'ur-PK'
      };
    }

    case 'uk_male': {
      const ukMaleVoice = voices.find(v => {
        const lang = normalize(v.lang);
        return lang.startsWith('en-gb') && isVoiceMale(v);
      }) || findAnyMaleVoice(voices);

      return {
        voice: ukMaleVoice || voices[0] || null,
        pitch: 0.82,
        lang: 'en-GB'
      };
    }

    case 'us_male': {
      const usMaleVoice = voices.find(v => {
        const lang = normalize(v.lang);
        return lang.startsWith('en-us') && isVoiceMale(v);
      }) || findAnyMaleVoice(voices);

      return {
        voice: usMaleVoice || voices[0] || null,
        pitch: 0.82,
        lang: 'en-US'
      };
    }

    case 'uk_female': {
      const ukFemale = voices.find(v => normalize(v.lang).startsWith('en-gb') && isVoiceFemale(v));
      return {
        voice: ukFemale || voices.find(v => isVoiceFemale(v)) || voices[0] || null,
        pitch: 1.05,
        lang: 'en-GB'
      };
    }

    case 'us_female': {
      const usFemale = voices.find(v => normalize(v.lang).startsWith('en-us') && isVoiceFemale(v));
      return {
        voice: usFemale || voices.find(v => isVoiceFemale(v)) || voices[0] || null,
        pitch: 1.05,
        lang: 'en-US'
      };
    }

    default: {
      const voice = isMaleRequested ? (findAnyMaleVoice(voices) || voices[0] || null) : (voices[0] || null);
      return {
        voice,
        pitch: isMaleRequested ? 0.80 : 1.0,
        lang: 'en-US'
      };
    }
  }
};

/**
 * Built-in Food, Fast-Food, and Dairy/Milk Shop Pronunciation Dictionary
 * Maps common menu shorthand, Urdu items, and unit abbreviations into natural spoken words.
 */
export const BUILTIN_FOOD_AND_DAIRY_DICTIONARY: Record<string, string> = {
  // --- Dairy & Milk Shop Items & Units (دودھ، دہی، مکھن، گھی، پنیر، کھویا) ---
  '1/2 kg': 'Half Kilo',
  '1/2kg': 'Half Kilo',
  '1/4 kg': 'Quarter Kilo',
  '1/4kg': 'Quarter Kilo',
  '1/2 ltr': 'Half Liter',
  '1/2ltr': 'Half Liter',
  'kg': 'Kilo',
  'k.g': 'Kilo',
  'gm': 'Grams',
  'gms': 'Grams',
  'ltr': 'Liter',
  'ltrs': 'Liters',
  'pao': 'Pao',
  'doodh': 'Doodh',
  'dudh': 'Doodh',
  'kcha': 'Kacha',
  'pka': 'Paka',
  'bhains': 'Bhains',
  'gaye': 'Gaye',
  'dahi': 'Dahi',
  'dh': 'Dahi',
  'mkhan': 'Makhan',
  'makhan': 'Makhan',
  'desi ghee': 'Desi Ghee',
  'khoya': 'Khoya',
  'khoa': 'Khoya',
  'paneer': 'Paneer',
  'panir': 'Paneer',
  'malai': 'Malai',
  'balai': 'Balai',
  'rabri': 'Rabri',
  'rabdi': 'Rabri',
  'kheer': 'Kheer',
  'khr': 'Kheer',
  'lasi': 'Lassi',
  'lassi': 'Lassi',
  'm.lassi': 'Meethi Lassi',
  'n.lassi': 'Namkeen Lassi',
  'pera': 'Pera',
  'perah': 'Pera',
  'kulfi': 'Kulfi',
  'falooda': 'Falooda',
  'faluda': 'Falooda',
  'rasgulla': 'Rasgulla',
  'rsgla': 'Rasgulla',
  'gulab jamun': 'Gulab Jamun',
  'g.jamun': 'Gulab Jamun',
  'gjamun': 'Gulab Jamun',
  'barfi': 'Barfi',
  'brfi': 'Barfi',
  'cham cham': 'Cham Cham',
  'jalebi': 'Jalebi',
  'jlbi': 'Jalebi',
  'halwa': 'Halwa',
  'hlwa': 'Halwa',
  'gajrela': 'Gajrela',

  // --- Restaurant, Fast Food & Desi Kitchen Abbreviations ---
  'chkn': 'Chicken',
  'chk': 'Chicken',
  'ch.': 'Chicken',
  'bgr': 'Burger',
  'brgr': 'Burger',
  'zing': 'Zinger',
  's/w': 'Sandwich',
  'sndwch': 'Sandwich',
  'pltr': 'Platter',
  'shwrma': 'Shawarma',
  'shw': 'Shawarma',
  'brst': 'Broast',
  'chwmin': 'Chowmein',
  'chwmn': 'Chowmein',
  'nug': 'Nuggets',
  'ngts': 'Nuggets',
  'frs': 'Fries',
  'pza': 'Pizza',
  'pz': 'Pizza',
  'kbb': 'Kabab',
  'krhi': 'Karahi',
  'krahi': 'Karahi',
  'hndi': 'Handi',
  'qrma': 'Qorma',
  'biry': 'Biryani',
  'plao': 'Pulao',
  'prtha': 'Paratha',
  'prt': 'Paratha',
  'rot': 'Roti',
  'rt': 'Roti',
  'nn': 'Naan',
  'dpatti': 'Doodh Patti',
  'd/patti': 'Doodh Patti',
  'kahwa': 'Kehwa',
  'qahwa': 'Kehwa',
  'cld drk': 'Cold Drink',
  'clddrk': 'Cold Drink',
  'cld drnk': 'Cold Drink',
  'pep': 'Pepsi',
  'mrnd': 'Mirinda',
  'mrnda': 'Mirinda',
  'spcl': 'Special',
  'spl': 'Special',
  'reg': 'Regular',
  'sml': 'Small',
  'med': 'Medium',
  'lrg': 'Large',
  'qtr': 'Quarter',
  'hf': 'Half',
  '1/2': 'Half',
  '1/4': 'Quarter',
  'w/': 'with',
  'wo/': 'without',
  'ext': 'Extra',
  'ex': 'Extra',
  'btl': 'Bottle',
  'pcs': 'Pieces',
  'pc': 'Piece',
};

const CUSTOM_DICT_STORAGE_KEY = 'retailsuite_custom_voice_dict';

/**
 * Get custom dictionary defined by tenant in browser storage
 */
export const getCustomVoiceDictionary = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_DICT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Save custom dictionary defined by tenant
 */
export const saveCustomVoiceDictionary = (dict: Record<string, string>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_DICT_STORAGE_KEY, JSON.stringify(dict));
  } catch {}
};

const URDU_NUMBERS: Record<number, string> = {
  1: 'Ek',
  2: 'Do',
  3: 'Teen',
  4: 'Chaar',
  5: 'Paanch',
  6: 'Chhay',
  7: 'Saat',
  8: 'Aath',
  9: 'Nau',
  10: 'Das',
  11: 'Gyaarah',
  12: 'Baarah',
  15: 'Pandra',
  20: 'Bees',
  25: 'Pachees',
  50: 'Pachaas',
};

/**
 * Normalize and expand food / dairy abbreviations using built-in & custom dictionaries
 */
export const normalizeFoodAndDairyText = (text: string, isUrdu: boolean = false): string => {
  if (!text) return '';
  let result = ` ${text} `;

  const customDict = getCustomVoiceDictionary();
  const combinedDict: Record<string, string> = {
    ...BUILTIN_FOOD_AND_DAIRY_DICTIONARY,
    ...customDict,
  };

  // 1. Replace multi-word and compound symbols first (sorted by descending length)
  const sortedKeys = Object.keys(combinedDict).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const replacement = combinedDict[key];
    // Escape special regex characters like /, ., etc.
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<=[\\s,;]|^)${escapedKey}(?=[\\s,;]|$)`, 'gi');
    result = result.replace(regex, ` ${replacement} `);
  }

  // 2. In Urdu mode, adapt common fractions
  if (isUrdu) {
    result = result.replace(/\bHalf\b/gi, 'Aadha');
    result = result.replace(/\bQuarter\b/gi, 'Pao');
  }

  return result.replace(/\s+/g, ' ').trim();
};

/**
 * Format quantity and item title into human natural speech
 * e.g. "2 Chicken Burger, 1 Fries, Half Kilo Khoya"
 */
const formatLinesSpeech = (lines: KotSpeechItem[], isUrdu: boolean = false): string => {
  if (!lines || lines.length === 0) return '';
  return lines
    .map(line => {
      const qtyNum = Number(line.qty) || 1;
      const title = line.itemTitle?.trim() || 'Item';
      const cleanTitle = normalizeFoodAndDairyText(title, isUrdu);
      const qtyStr = isUrdu && URDU_NUMBERS[qtyNum] ? URDU_NUMBERS[qtyNum] : qtyNum.toString();
      return `${qtyStr} ${cleanTitle}`;
    })
    .join(', ');
};

/**
 * Speak text using Web Speech API with selected accent and pitch
 */
export const speakText = (text: string, options?: KotSpeechOptions) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Web Speech API (speechSynthesis) is not supported in this browser.');
    return;
  }

  try {
    // Cancel any previous hung speech
    window.speechSynthesis.cancel();

    // Ensure voices are fetched
    const config = resolveVoiceConfig(options?.accent, options?.voiceURI);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 1.0;
    // Allow explicit pitch override from options, otherwise use tuned pitch from config
    utterance.pitch = options?.pitch ?? config.pitch;
    utterance.lang = config.lang;

    if (config.voice) {
      utterance.voice = config.voice;
      utterance.lang = config.voice.lang;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis callout failed:', err);
  }
};

/**
 * Announce a KOT order for the kitchen staff in the chosen accent
 */
export const speakKotOrder = (order: KotSpeechOrder, options?: KotSpeechOptions) => {
  const accent = (options?.accent || 'pakistani_male').toString();
  const isUrdu = accent.startsWith('urdu');
  const parts: string[] = [];

  if (isUrdu) {
    // Urdu announcement
    if (order.isRunning) {
      parts.push('Running KOT.');
    } else {
      parts.push('Naya order.');
    }

    if (order.orderType === 'DineIn' && order.tableName) {
      parts.push(`Table ${order.tableName}.`);
    } else if (order.tokenNo) {
      parts.push(`Token number ${order.tokenNo}.`);
    }
  } else {
    // English announcement (Pakistani, UK, US)
    if (order.isRunning) {
      parts.push('Running KOT.');
    } else {
      parts.push('New order.');
    }

    if (order.orderType === 'DineIn' && order.tableName) {
      parts.push(`Table ${order.tableName}.`);
    } else if (order.tokenNo) {
      parts.push(`Token number ${order.tokenNo}.`);
    }
  }

  const itemsSpeech = formatLinesSpeech(order.lines, isUrdu);
  if (itemsSpeech) {
    parts.push(itemsSpeech);
  }

  const fullMessage = parts.join(' ');
  speakText(fullMessage, options);
};

/**
 * Announce customer token pickup
 */
export const speakTokenReady = (tokenNo: number | string, options?: KotSpeechOptions) => {
  const accent = (options?.accent || 'pakistani_male').toString();
  const isUrdu = accent.startsWith('urdu');
  const message = isUrdu
    ? `Token number ${tokenNo} tayyar hai.`
    : `Token number ${tokenNo} is ready for pickup.`;
  speakText(message, options);
};

/**
 * Sample test announcement for Settings page demonstrating restaurant and dairy items
 */
export const testKotSpeech = (options?: KotSpeechOptions) => {
  const accent = (options?.accent || 'pakistani_male').toString();
  const isUrdu = accent.startsWith('urdu');
  const testLines = [
    { itemTitle: 'Chkn Bgr', qty: 2 },
    { itemTitle: 'Fries', qty: 1 },
    { itemTitle: '1/2 kg Khoya', qty: 1 },
    { itemTitle: '1 Ltr Doodh', qty: 1 }
  ];
  const itemsText = formatLinesSpeech(testLines, isUrdu);
  const text = isUrdu
    ? `Speaker check. Naya order. Token number 1. ${itemsText}.`
    : `Speaker check. New order. Token number 1. ${itemsText}.`;
  speakText(text, options);
};
