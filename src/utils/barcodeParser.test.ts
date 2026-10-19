import { parseBarcodePayload } from './barcodeParser.ts';

const mockItems: any[] = [
  {
    id: '101',
    itemKey: 'MEAT-01',
    title: 'Fresh Beef Meat',
    barcode: 'MEAT001',
    priRate: 1000,
    primaryUnit: 'kg',
    defaultUnit: 'kg'
  },
  {
    id: '102',
    itemKey: 'CHICKEN',
    title: 'Fresh Chicken',
    barcode: '8964001100013',
    priRate: 600,
    primaryUnit: 'kg',
    defaultUnit: 'kg'
  },
  {
    id: '123',
    title: 'Minced Meat',
    barcode: '00123',
    priRate: 800,
    primaryUnit: 'kg',
    defaultUnit: 'kg'
  },
  {
    id: '000105',
    title: 'Dal Chana 5kg',
    barcode: '000105',
    priRate: 1248,
    primaryUnit: '004',
    primaryUnitTitle: 'kg',
    defaultUnit: '004',
    defaultUnitTitle: 'kg'
  }
];

let failed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('PASS:', msg);
  }
}

// Test 1: Smart Code 128 with Rate Override
const res1 = parseBarcodePayload('VW-MEAT001-Q1.1-R1000', mockItems);
assert(res1 !== null && res1.matchedItem.id === '101', 'Smart Code 128 resolves Meat');
assert(res1?.qty === 1.1, `Qty is 1.1 (got ${res1?.qty})`);
assert(res1?.rate === 1000, `Rate is 1000 (got ${res1?.rate})`);
assert(res1?.amount === 1100, `Amount is 1100 (got ${res1?.amount})`);
assert(res1?.isVariableWeight === true, 'isVariableWeight is true');

// Test 2: Smart Code 128 with Rate Override (discounted)
const res2 = parseBarcodePayload('VW-MEAT001-Q0.5-R900', mockItems);
assert(res2 !== null && res2.qty === 0.5 && res2.rate === 900 && res2.amount === 450, 'Smart Code with Rate 900');

// Test 3: Smart Code 128 with Total Amount (-P500)
const res3 = parseBarcodePayload('VW-MEAT001-Q0.5-P500', mockItems);
assert(res3 !== null && res3.amount === 500 && res3.rate === 1000, 'Smart Code with -P500');

// Test 4: EAN-13 Weighing Scale (Weight embedded: 21 IIIII WWWWW C)
// Prefix 21, item 00123, 1100 grams (1.1 kg), check digit 5
const res4 = parseBarcodePayload('2100123011005', mockItems);
assert(res4 !== null && res4.matchedItem.id === '123', 'EAN-13 Scale resolves Item 123');
assert(res4?.qty === 1.1, `Weight is 1.1 kg (got ${res4?.qty})`);
assert(res4?.rate === 800, `Rate is 800 (got ${res4?.rate})`);
assert(res4?.amount === 880, `Amount is 880 (got ${res4?.amount})`);

// Test 5: EAN-13 Weighing Scale (Price embedded: 20 IIIII PPPPP C)
// Prefix 20, item 00123, Rs 400 total, check digit 2
const res5 = parseBarcodePayload('2000123004002', mockItems);
assert(res5 !== null && res5.matchedItem.id === '123', 'EAN-13 Price Scale resolves Item 123');
assert(res5?.amount === 400, `Amount is 400 (got ${res5?.amount})`);
assert(res5?.qty === 0.5, `Qty is 0.5 kg (got ${res5?.qty})`);

// Test 6: Multiplier syntax: 3*8964001100013
const res6 = parseBarcodePayload('3*8964001100013', mockItems);
assert(res6 !== null && res6.matchedItem.id === '102' && res6.qty === 3 && res6.isVariableWeight === false, 'Multiplier syntax');

// Test 7: Standard code scan
const res7 = parseBarcodePayload('8964001100013', mockItems);
assert(res7 !== null && res7.matchedItem.id === '102' && res7.qty === 1, 'Standard barcode scan');

// Test 8: Compact 18-digit Variable Barcode (2 + 6-digit Item + 5-digit Qty + 6-digit Amount)
// Prefix 2, Item 000101 (Item 101), 325 grams (0.325 kg), Rs. 325 total
const res8 = parseBarcodePayload('200010100325000325', mockItems);
assert(res8 !== null && res8.matchedItem.id === '101', '18-digit compact resolves Item 101');
assert(res8?.qty === 0.325, `Qty is 0.325 kg (got ${res8?.qty})`);
assert(res8?.amount === 325, `Amount is 325 (got ${res8?.amount})`);
assert(res8?.rate === 1000, `Rate is 1000 (got ${res8?.rate})`);
// Test 9: Item with unit code '004' and unit title 'kg'
// Exact match from user scenario: 200010500250000312 -> Item 000105, 0.25 kg, Rs. 312
const res9 = parseBarcodePayload('200010500250000312', mockItems);
assert(res9 !== null && res9.matchedItem.title === 'Dal Chana 5kg', 'Resolves Dal Chana');
assert(res9?.qty === 0.25, `Qty is 0.25 kg (got ${res9?.qty})`);
assert(res9?.amount === 312, `Amount is 312 (got ${res9?.amount})`);
assert(res9?.unit === 'kg', `Unit resolves to 'kg' instead of code '004' (got ${res9?.unit})`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll barcodeParser tests passed successfully!');
}
