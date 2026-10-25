import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export interface UseVoiceAssistantProps {
  onFinalTranscript?: (transcript: string) => void;
  lang?: string;
}

function cleanSpeechText(text: string): string {
  return text
    // Remove markdown bold/italic asterisks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove bullets and dashes at start of line
    .replace(/^[•\-\*]\s+/gm, '')
    // Expand currency abbreviations for spoken audio
    .replace(/\bRs\.?\s*/gi, 'Rupees ')
    // Strip markdown headers
    .replace(/^#+\s+/gm, '')
    // Clean parentheses so speech pauses naturally
    .replace(/\(([^)]+)\)/g, ', $1, ')
    .replace(/`([^`]+)`/g, '$1')
    // Collapse excess whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSpeechLanguage(text: string): 'ur-PK' | 'hi-IN' | 'en-US' {
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ur-PK';
  }
  const romanUrduPattern = /\b(hai|hain|ka|ki|ke|ko|se|kr|kar|khol|karde|kardo|dikhao|banao|dekhna|batao|iska|iski|iske|kitna|kitne|paise|khata|parchi|chahiye|sahi|diya|diye|lene|dena|mene|mujhe|aapka|matlooba)\b/i;
  if (romanUrduPattern.test(text)) {
    return 'hi-IN';
  }
  return 'en-US';
}

function selectBestVoice(targetLang: string): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  if (targetLang === 'ur-PK' || targetLang === 'hi-IN') {
    // 1. Urdu native voice
    const urdu = voices.find(v => v.lang.startsWith('ur') || /asif|uzma|urdu/i.test(v.name));
    if (urdu) return urdu;

    // 2. Hindi native voice (authentic cadence for Roman Urdu)
    const hindi = voices.find(v => v.lang.startsWith('hi') || /swara|madhur|hindi|हिन्दी/i.test(v.name));
    if (hindi) return hindi;

    // 3. Indian English voice (subcontinent phonetics)
    const inEng = voices.find(v => v.lang === 'en-IN' || /ravi|heera/i.test(v.name));
    if (inEng) return inEng;
  }

  // Pure English voice
  return voices.find(v => v.lang.startsWith(targetLang.slice(0, 2))) || null;
}

export function useVoiceAssistant({ onFinalTranscript, lang = 'en-US' }: UseVoiceAssistantProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const isListeningRef = useRef(false);
  const latestTranscriptRef = useRef('');
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Keep latest onFinalTranscript without triggering re-init of speech recognition
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setErrorMessage(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }

        const currentText = fullTranscript.trim();
        if (currentText) {
          latestTranscriptRef.current = currentText;
          setTranscript(currentText);

          // Auto-submit after 1.5s of silence
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            const captured = latestTranscriptRef.current.trim();
            if (captured) {
              latestTranscriptRef.current = '';
              setTranscript('');
              stopListening();
              onFinalTranscriptRef.current?.(captured);
            }
          }, 1500);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please grant microphone permission (and verify HTTPS or localhost is used).');
        } else if (event.error === 'network') {
          setErrorMessage('Speech recognition network error. Please check your internet connection.');
        }
        setIsListening(false);
        isListeningRef.current = false;
        stopAudioVisualizer();
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        stopAudioVisualizer();
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn('Failed to construct SpeechRecognition:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      stopAudioVisualizer();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [lang]);

  const startAudioVisualizer = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Microphone visualizer optional stream error:', err);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setVolumeLevel(0);
  };

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      setIsSpeaking(false);
      activeUtteranceRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    // Cut off any read-aloud speech immediately when microphone opens
    stopSpeaking();

    if (!recognitionRef.current) return;
    setTranscript('');
    latestTranscriptRef.current = '';
    setErrorMessage(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
      startAudioVisualizer();
    } catch (err: any) {
      // If already started, do nothing
      if (err?.name !== 'InvalidStateError') {
        console.warn('Failed to start speech recognition', err);
        setErrorMessage('Could not start microphone: ' + (err?.message || 'Unknown error'));
      }
    }
  }, [stopSpeaking]);

  const stopListening = useCallback((submitImmediately: boolean = false) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
    isListeningRef.current = false;
    stopAudioVisualizer();

    const captured = latestTranscriptRef.current.trim();
    latestTranscriptRef.current = '';
    setTranscript('');

    if (submitImmediately && captured) {
      onFinalTranscriptRef.current?.(captured);
    }
  }, []);

  const speak = useCallback((text: string, voiceLang?: string) => {
    if (!('speechSynthesis' in window) || !text) return;

    try {
      window.speechSynthesis.cancel();
      // Workaround for Chrome bug where synthesis pauses/hangs
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const cleanText = cleanSpeechText(text);
      if (!cleanText) return;

      const detectedLang = voiceLang || detectSpeechLanguage(cleanText);
      const matchedVoice = selectBestVoice(detectedLang);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = detectedLang;
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      // Natural speech cadence: slightly relaxed rate for Roman Urdu / Hindi
      utterance.rate = detectedLang === 'en-US' ? 1.05 : 0.95;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      };

      // Retain utterance in ref to prevent Chrome garbage collection bug
      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis failed:', e);
    }
  }, []);

  return {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    volumeLevel,
    errorMessage,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
