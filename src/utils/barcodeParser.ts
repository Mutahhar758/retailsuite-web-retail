import type { Item } from '../services/inventoryService';

export interface ParsedBarcodeResult {
  matchedItem: Item;
  qty: number;
  rate?: number;
  amount?: number;
  isVariableWeight: boolean;
  unit?: string;
  rawCode: string;
}

export interface ScaleBarcodeConfig {
  scalePrefixes?: string[]; // e.g. ['20', '21', '22', '23', '24', '25', '28']
  itemCodeLength?: number;  // 4 or 5 digits, default 5
  weightDecimals?: number;  // default 3 (grams to kg: / 1000)
  priceDecimals?: number;   // default 2 or 0
}

const DEFAULT_SCALE_PREFIXES = ['20', '21', '22', '23', '24', '25', '28'];

/**
 * Parses an incoming barcode or scanner input and resolves it against the inventory items list.
 * Supports:
 * 1. RetailSuite Smart Code-128: "VW-{ItemCode}-Q{qty}-R{rate}" (or with -P{amount})
 * 2. Delimited format: "{code}*{qty}*{rate}"
 * 3. Mart Weighing Machine Barcodes (EAN-13):
 *    - Prefix 21 / 28 (Weight-embedded): 21 IIIII WWWWW C -> e.g. 2100123011005 (Item 123, 1.100 kg)
 *    - Prefix 20 / 22 (Price-embedded):  20 IIIII PPPPP C -> e.g. 2000123005002 (Item 123, Rs. 500)
 * 4. Multiplier syntax: "5*890123" or "890123*5"
 * 5. Standard item lookup: Exact barcode, item ID, itemKey, exact title, single partial match.
 */
export function parseBarcodePayload(
  rawInput: string,
  items: Item[],
  scaleConfig?: ScaleBarcodeConfig
): ParsedBarcodeResult | null {
  const raw = (rawInput || '').trim();
  if (!raw || items.length === 0) return null;

  // -------------------------------------------------------------
  // 1. RetailSuite Variable Code-128: VW-{ItemCode}-Q{qty}-R{rate}
  // -------------------------------------------------------------
  if (raw.toUpperCase().startsWith('VW-') || raw.toUpperCase().startsWith('VW:')) {
    const withoutPrefix = raw.slice(3).trim();
    // Regex matching: {code}-Q{qty}-R{rate} or {code}-Q{qty}-P{amount} or {code}-Q{qty}
    // Also supports colon delimiter: {code}:Q{qty}:R{rate}
    const regex = /^(.+?)[-:]Q([\d.]+)(?:[-:]([RP])([\d.]+))?$/i;
    const match = withoutPrefix.match(regex);

    if (match) {
      const codePart = match[1].trim();
      const parsedQty = parseFloat(match[2]);
      const priceType = (match[3] || '').toUpperCase(); // 'R' = Rate, 'P' = Total Price
      const priceVal = match[4] ? parseFloat(match[4]) : undefined;

      const item = findItemByCode(codePart, items);
      if (item && !isNaN(parsedQty) && parsedQty > 0) {
        let effectiveRate = item.priRate || 0;
        let effectiveAmount: number | undefined;

        if (priceType === 'P' && priceVal !== undefined && !isNaN(priceVal)) {
          // Total amount given
          effectiveAmount = round2(priceVal);
          effectiveRate = round2(effectiveAmount / parsedQty);
        } else if (priceType === 'R' && priceVal !== undefined && !isNaN(priceVal)) {
          // Explicit rate override
          effectiveRate = round2(priceVal);
          effectiveAmount = round2(parsedQty * effectiveRate);
        } else {
          // Use master item rate
          effectiveAmount = round2(parsedQty * effectiveRate);
        }

        return {
          matchedItem: item,
          qty: parsedQty,
          rate: effectiveRate,
          amount: effectiveAmount,
          isVariableWeight: true,
          unit: item.defaultUnit || item.primaryUnit,
          rawCode: raw
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Delimited 3-Part Syntax: {ItemCode}*{qty}*{rate}
  // -------------------------------------------------------------
  if (raw.includes('*')) {
    const starParts = raw.split('*');
    if (starParts.length === 3) {
      const codePart = starParts[0].trim();
      const qVal = parseFloat(starParts[1].trim());
      const rVal = parseFloat(starParts[2].trim());
      const item = findItemByCode(codePart, items);

      if (item && !isNaN(qVal) && qVal > 0) {
        const rate = !isNaN(rVal) && rVal >= 0 ? round2(rVal) : (item.priRate || 0);
        return {
          matchedItem: item,
          qty: qVal,
          rate,
          amount: round2(qVal * rate),
          isVariableWeight: true,
          unit: item.defaultUnit || item.primaryUnit,
          rawCode: raw
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Mart Weighing Machine Barcodes (EAN-13 Scale Barcodes)
  // Format: 2X IIIII VVVVV C (13 numeric digits)
  // -------------------------------------------------------------
  const cleanDigits = raw.replace(/\D/g, '');
  if (cleanDigits.length === 13) {
    const prefixes = scaleConfig?.scalePrefixes || DEFAULT_SCALE_PREFIXES;
    const prefix = cleanDigits.substring(0, 2);

    if (prefixes.includes(prefix)) {
      const codeLen = scaleConfig?.itemCodeLength ?? 5; // default 5 digits for PLU
      const pluString = cleanDigits.substring(2, 2 + codeLen);
      const valueString = cleanDigits.substring(2 + codeLen, 12); // next 5 digits

      // Find item by PLU (matches item ID, barcode, or numeric code)
      const item = findItemByPlu(pluString, items);

      if (item) {
        const rawValue = parseInt(valueString, 10);

        // Prefixes 21, 28: Embedded Weight (grams -> kg)
        // Prefixes 20, 22, 24: Embedded Total Price (Rs.)
        const isWeightScale = prefix === '21' || prefix === '28' || prefix === '23';

        if (isWeightScale) {
          const weightKg = round3(rawValue / 1000); // 1100 -> 1.100 kg
          const rate = item.priRate || 0;
          const amount = round2(weightKg * rate);

          return {
            matchedItem: item,
            qty: weightKg,
            rate,
            amount,
            isVariableWeight: true,
            unit: item.defaultUnit || item.primaryUnit || 'kg',
            rawCode: raw
          };
        } else {
          // Price scale: rawValue is total price
          const totalPrice = round2(rawValue);
          const baseRate = item.priRate || 0;
          const calculatedQty = baseRate > 0 ? round3(totalPrice / baseRate) : 1;

          return {
            matchedItem: item,
            qty: calculatedQty,
            rate: baseRate > 0 ? baseRate : totalPrice,
            amount: totalPrice,
            isVariableWeight: true,
            unit: item.defaultUnit || item.primaryUnit,
            rawCode: raw
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Multiplier syntax: "5*890123" or "890123*5"
  // -------------------------------------------------------------
  let scanQty = 1;
  let cleanCode = raw;

  if (raw.includes('*')) {
    const parts = raw.split('*');
    if (parts.length === 2) {
      const part0 = parts[0].trim();
      const part1 = parts[1].trim();
      const num0 = parseFloat(part0);
      const num1 = parseFloat(part1);

      // Check if part1 matches an item and part0 is a valid quantity
      if (findItemByCode(part1, items) && !isNaN(num0) && num0 > 0) {
        scanQty = num0;
        cleanCode = part1;
      }
      // Check if part0 matches an item and part1 is a valid quantity
      else if (findItemByCode(part0, items) && !isNaN(num1) && num1 > 0) {
        scanQty = num1;
        cleanCode = part0;
      }
      // Fallback heuristics: if one is small multiplier (< 10000) and other is barcode
      else if (!isNaN(num0) && num0 > 0 && num0 < 1000 && isNaN(num1)) {
        scanQty = num0;
        cleanCode = part1;
      } else if (!isNaN(num1) && num1 > 0 && num1 < 1000 && isNaN(num0)) {
        scanQty = num1;
        cleanCode = part0;
      }
    }
  }

  // -------------------------------------------------------------
  // 5. Standard item lookup (exact barcode, ID, SKU, title)
  // -------------------------------------------------------------
  const matchedItem = findItemByCode(cleanCode, items);
  if (matchedItem) {
    const rate = matchedItem.priRate || 0;
    return {
      matchedItem,
      qty: scanQty,
      rate,
      amount: round2(scanQty * rate),
      isVariableWeight: false,
      unit: matchedItem.defaultUnit || matchedItem.primaryUnit,
      rawCode: raw
    };
  }

  return null;
}

/**
 * Searches items array matching barcode, ID, itemKey, or title.
 */
export function findItemByCode(codeToMatch: string, items: Item[]): Item | undefined {
  if (!codeToMatch) return undefined;
  const target = codeToMatch.trim().toLowerCase();

  // 1. Exact barcode match
  let found = items.find(
    (i) => i.barcode && i.barcode.trim().toLowerCase() === target
  );

  // 2. Exact Item ID / Code / ItemKey match
  if (!found) {
    found = items.find(
      (i) =>
        String(i.id).trim().toLowerCase() === target ||
        (i.itemKey && i.itemKey.trim().toLowerCase() === target)
    );
  }

  // 3. Exact item title match
  if (!found) {
    found = items.find(
      (i) => i.title && i.title.trim().toLowerCase() === target
    );
  }

  // 4. Fallback: single partial match on barcode or title if length >= 3
  if (!found && target.length >= 3) {
    const partialMatches = items.filter(
      (i) =>
        (i.barcode && i.barcode.toLowerCase().includes(target)) ||
        (i.title && i.title.toLowerCase().includes(target))
    );
    if (partialMatches.length === 1) {
      found = partialMatches[0];
    }
  }

  return found;
}

/**
 * Look up item by PLU (handles leading zeroes, e.g. "00123" matches "123" or barcode "00123")
 */
function findItemByPlu(plu: string, items: Item[]): Item | undefined {
  const cleanPlu = plu.trim();
  const numericPlu = String(parseInt(cleanPlu, 10));

  return items.find((i) => {
    // Exact barcode match
    if (i.barcode && i.barcode.trim().toLowerCase() === cleanPlu.toLowerCase()) return true;
    // Exact ID match
    if (String(i.id).trim() === cleanPlu || String(i.id).trim() === numericPlu) return true;
    // Exact itemKey match
    if (i.itemKey && (i.itemKey.trim() === cleanPlu || i.itemKey.trim() === numericPlu)) return true;
    return false;
  });
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round3(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}
