/**
 * State Bank of Pakistan (SBP) Raast P2P / P2M QR payload builder.
 *
 * Implements the official Raast QR specification used by all Pakistani banking
 * apps (Meezan Bank, HBL, UBL, Bank Alfalah, MCB, Easypaisa, JazzCash, etc.).
 *
 * Specification layout:
 *   00 02 "02"             Format Version (always "02" for Raast)
 *   01 02 "11" | "12"      Point of Initiation ("11" = static, "12" = dynamic with amount)
 *   02 02 "00"             Payload Type ("00")
 *   04 24 <IBAN>           24-character Pakistani IBAN
 *   05 nn <amount>         Transaction amount in PKR (e.g. "12500" or "12500.50")
 *   10 04 <CRC-16>         CRC-16/CCITT-FALSE over full payload ending with literal "1004"
 */

/** Known 4-letter SBP bank codes */
export const BANK_CODES: Record<string, string> = {
  meezan: 'MEZN',
  hbl: 'HABB',
  habib: 'HABB',
  ubl: 'UNIL',
  united: 'UNIL',
  mcb: 'MUCB',
  alfalah: 'ALFH',
  allied: 'ABPA',
  abl: 'ABPA',
  askari: 'ASCM',
  faysal: 'FAYS',
  bop: 'BPUN',
  punjab: 'BPUN',
  bankislami: 'BKIP',
  islami: 'BKIP',
  soneri: 'SONE',
  scb: 'SCBL',
  standard: 'SCBL',
  easypaisa: 'TMFB',
  telenor: 'TMFB',
  jazzcash: 'MMBL',
  mobilink: 'MMBL',
  sadapay: 'SADA',
  nayapay: 'NPAY',
  js: 'JSBL',
  albaraka: 'BARK',
  habibmetro: 'HMBP',
  dubai: 'DIBP',
};

/** Build one TLV segment: tag (2 chars) + length (2 chars, zero-padded) + value */
export function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no final XOR) */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Validates a Pakistani IBAN using the ISO 7064 mod-97 check digits algorithm.
 */
export function isValidIban(iban: string): boolean {
  const clean = (iban || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length !== 24 || !clean.startsWith('PK')) {
    return false;
  }

  // Rearrange: letters 4..23 + letters 0..3 (e.g. MEZN...PK36)
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let numStr = '';
  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged[i];
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numStr += (code - 55).toString(); // A=10 ... Z=35
    } else {
      numStr += ch;
    }
  }

  try {
    return BigInt(numStr) % 97n === 1n;
  } catch {
    return false;
  }
}

/**
 * Formats an IBAN with spaces every 4 characters for readability (e.g. "PK36 MEZN 0001 ...").
 */
export function formatIban(iban: string): string {
  const clean = (iban || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Normalizes input to a valid 24-character Pakistani IBAN.
 * If the user provides a full 24-char IBAN, spaces are stripped and it is validated.
 * If the user enters only an account number and a known bank name (e.g. Meezan),
 * it calculates the ISO 7064 mod-97 check digits and synthesizes the correct IBAN.
 */
export function normalizeToIban(input: string, bankName?: string): string {
  const clean = (input || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!clean) return '';

  // Already a full 24-character Pakistani IBAN
  if (clean.startsWith('PK') && clean.length === 24) {
    return clean;
  }

  // Starts with PK but maybe partial
  if (clean.startsWith('PK')) {
    return clean;
  }

  // Try to find the 4-letter bank code from the provided bank name
  let bankCode = '';
  if (bankName) {
    const lower = bankName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, code] of Object.entries(BANK_CODES)) {
      if (lower.includes(key)) {
        bankCode = code;
        break;
      }
    }
  }

  // If no bank detected, return cleaned input
  if (!bankCode) {
    return clean;
  }

  // Account part: up to 16 characters, zero-padded
  const account16 = clean.slice(-16).padStart(16, '0');

  // Compute ISO 7064 mod 97 check digits:
  // Rearranged numeric: BankCode (A-Z -> 10..35) + Account16 + "252000" (P=25, K=20, 00)
  let numStr = '';
  for (let i = 0; i < bankCode.length; i++) {
    numStr += (bankCode.charCodeAt(i) - 55).toString();
  }
  numStr += account16 + '252000';

  try {
    const rem = BigInt(numStr) % 97n;
    const check = String(98n - rem).padStart(2, '0');
    return `PK${check}${bankCode}${account16}`;
  } catch {
    return clean;
  }
}

/**
 * Format a Date into Raast Tag 07 expiry string: DDMMYYYYHHMM (12 characters).
 */
export function formatRaastExpiry(daysFromNow: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}${month}${year}2359`;
}

/**
 * Builds the official State Bank of Pakistan (SBP) Raast QR code payload.
 *
 * Scanned natively by Meezan Bank, HBL, UBL, Bank Alfalah, MCB, Easypaisa,
 * JazzCash, and all 1Link Raast-connected banking apps.
 *
 * @param accountOrIban - Destination 24-char Pakistani IBAN or account number
 * @param amount        - Due amount in PKR (pre-filled in banking app). 0 for static QR.
 * @param bankName      - Optional bank name for auto-detecting bank code if not already an IBAN
 */
export function buildRaastPayload(
  accountOrIban: string,
  amount: number,
  bankName?: string
): string {
  const iban = normalizeToIban(accountOrIban, bankName);
  const num = Number(amount);
  const hasAmount = !isNaN(num) && num > 0;
  const poi = hasAmount ? '12' : '11'; // '12' = Dynamic (amount pre-filled), '11' = Static

  let payload =
    tlv('00', '02') +          // Format Version (02)
    tlv('01', poi) +           // Point of Initiation (11=Static, 12=Dynamic)
    tlv('02', '00') +          // Payload Type (00)
    tlv('04', iban);           // Destination Account (24-char IBAN)

  if (hasAmount) {
    // SBP Raast QR — amount as plain whole-Rupee integer string, e.g. "23261".
    const rounded = Math.round(num);
    const amtStr = rounded.toString();
    payload += tlv('05', amtStr);                  // Tag 05: Transaction Amount
    payload += tlv('07', formatRaastExpiry(30));   // Tag 07: Expiry (mandatory for dynamic SBP Raast QR)
  }

  payload += '1004';           // Checksum tag (10) + length (04)
  return payload + crc16(payload);
}

/**
 * Backward-compatible alias for existing report views.
 */
export function buildEmvCoPayload(
  _accountTitle: string,
  accountNumber: string,
  amount: number,
  bankName?: string
): string {
  return buildRaastPayload(accountNumber, amount, bankName);
}
