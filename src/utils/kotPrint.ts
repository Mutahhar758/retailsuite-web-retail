import dayjs from 'dayjs';
import { message } from 'antd';
import type { KotOrderResponse } from '../services/kotService';
import { 
  printDirect, 
  divider, 
  ESC_ALIGN_CENTER, 
  ESC_ALIGN_LEFT, 
  ESC_DOUBLE_ON, 
  ESC_DOUBLE_OFF, 
  ESC_BOLD_ON, 
  ESC_BOLD_OFF,
  type ConnectionMethod 
} from '../hooks/useThermalPrinter';

export interface KotPrintOptions {
  printerName?: string;
  cutPaper?: boolean;
  isRunningKot?: boolean;
  isDuplicate?: boolean;
  itemsToPrint?: { itemTitle: string; qty: number; notes?: string }[];
}

// Track KOT orders already printed in this session so repeat prints auto-flag as DUPLICATE
const printedKotOrderIds = new Set<number>();

/**
 * Open a styled 80mm receipt dialog in browser if thermal printer bridge is offline or unavailable.
 */
export const printKotViaBrowser = (kotOrder: KotOrderResponse, options?: KotPrintOptions) => {
  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) {
    message.warning('Pop-up blocked. Please allow pop-ups for KOT printing.');
    return;
  }
  const dateStr = dayjs(`${kotOrder.orderDate}T${kotOrder.orderTime}`).format('DD-MMM-YYYY hh:mm A');
  const typeStr = kotOrder.orderType === 'DineIn' ? `Dine-In (${kotOrder.tableName || 'N/A'})` : 'Takeaway';
  const isDuplicate = (options?.isDuplicate ?? printedKotOrderIds.has(kotOrder.id)) && !options?.isRunningKot;
  printedKotOrderIds.add(kotOrder.id);
  const linesToRender = options?.itemsToPrint || kotOrder.lines;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>KOT Token #${kotOrder.tokenNo}${isDuplicate ? ' (DUPLICATE)' : ''}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 72mm;
          margin: 0 auto;
          color: #000;
          font-size: 13px;
          line-height: 1.3;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .title { font-size: 28px; font-weight: 900; margin-bottom: 2px; letter-spacing: 3px; }
        .duplicate-banner { font-size: 18px; font-weight: 900; letter-spacing: 2px; margin: 3px 0; }
        .token { font-size: 22px; font-weight: 900; margin: 4px 0; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .double-divider { border-top: 2px solid #000; margin: 6px 0; }
        .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
        .item-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .item-table th { border-bottom: 1px dashed #000; text-align: left; padding: 3px 0; font-size: 13px; }
        .item-table td { padding: 4px 0; vertical-align: top; }
        .item-name { font-weight: bold; font-size: 14px; }
        .item-notes { font-size: 11px; font-style: italic; color: #333; margin-top: 2px; }
        .remarks-box { border: 1px dashed #000; padding: 4px; margin-top: 6px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="text-center title">KOT</div>
      ${isDuplicate ? '<div class="text-center duplicate-banner">*** DUPLICATE ***</div>' : ''}
      <div class="text-center token">TOKEN #${kotOrder.tokenNo}</div>
      <div class="double-divider"></div>
      <div class="meta-row"><span>Order ID: ${kotOrder.id}</span><span>${dateStr}</span></div>
      <div class="meta-row"><span class="bold">Type: ${typeStr}</span>${kotOrder.saleVoucherNo ? `<span>Bill #${kotOrder.saleVoucherNo}</span>` : ''}</div>
      ${kotOrder.customerName ? `<div class="meta-row"><span>Customer: ${kotOrder.customerName}</span></div>` : ''}
      <div class="divider"></div>
      <table class="item-table">
        <thead>
          <tr>
            <th style="width: 75%">Item Description</th>
            <th class="text-right" style="width: 25%">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${linesToRender.map(line => `
            <tr>
              <td>
                <div class="item-name">${line.itemTitle}</div>
                ${line.notes ? `<div class="item-notes">* ${line.notes}</div>` : ''}
              </td>
              <td class="text-right bold" style="font-size: 15px;">${line.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${kotOrder.remarks ? `<div class="remarks-box"><span class="bold">Remarks:</span> ${kotOrder.remarks}</div>` : ''}
      <div class="double-divider"></div>
      <script>
        window.onload = function() {
          window.focus();
          window.print();
          setTimeout(function() { window.close(); }, 600);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Universal KOT slip printer:
 * First attempts native ESC/POS thermal printing via local relay / WebUSB;
 * If that fails or is unavailable, falls back smoothly to browser printing so the user is never blocked.
 */
export const printKotSlip = async (
  kotOrder: KotOrderResponse,
  connectionMethod?: ConnectionMethod,
  options?: KotPrintOptions
) => {
  const method = connectionMethod || (localStorage.getItem('pos_printer_method') as ConnectionMethod) || 'LOCAL_RELAY';
  const pName = options?.printerName || localStorage.getItem('pos_printer_name') || 'XP-80';
  const shouldCut = options?.cutPaper ?? true;
  const isDuplicate = (options?.isDuplicate ?? printedKotOrderIds.has(kotOrder.id)) && !options?.isRunningKot;
  printedKotOrderIds.add(kotOrder.id);
  const linesToRender = options?.itemsToPrint || kotOrder.lines;

  const width = 48;
  const lines: string[] = [];

  lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + ESC_BOLD_ON + 'KOT' + ESC_BOLD_OFF + ESC_DOUBLE_OFF);
  if (isDuplicate) {
    lines.push(ESC_ALIGN_CENTER + ESC_BOLD_ON + '*** DUPLICATE ***' + ESC_BOLD_OFF);
  }
  lines.push(ESC_ALIGN_CENTER + ESC_BOLD_ON + `Token No: #${kotOrder.tokenNo}` + ESC_BOLD_OFF);
  lines.push(ESC_ALIGN_LEFT + divider('-', width));
  lines.push(`Order ID: ${kotOrder.id}`);
  lines.push(`Date: ${dayjs(`${kotOrder.orderDate}T${kotOrder.orderTime}`).format('DD-MMM-YYYY HH:mm')}`);
  lines.push(`Type: ${kotOrder.orderType === 'DineIn' ? `Dine-In (${kotOrder.tableName || 'N/A'})` : 'Takeaway'}`);
  if (kotOrder.saleVoucherNo) {
    lines.push(`Bill No: ${kotOrder.saleVoucherNo}`);
  }
  if (kotOrder.customerName) {
    lines.push(`Customer: ${kotOrder.customerName}`);
  }
  if (kotOrder.remarks) {
    lines.push(`Remarks: ${kotOrder.remarks}`);
  }
  lines.push(divider('-', width));

  const formatKotLine = (item: string, qty: string) => {
    const itemWidth = 38;
    const qtyWidth = 10;
    let left = item.trim();
    if (left.length > itemWidth - 1) left = left.substring(0, itemWidth - 1);
    left = left.padEnd(itemWidth, ' ');

    const right = qty.trim().padStart(qtyWidth, ' ');
    return left + right;
  };

  lines.push(formatKotLine('Item Description', 'Qty'));
  lines.push(divider('-', width));

  linesToRender.forEach(line => {
    lines.push(ESC_BOLD_ON + formatKotLine(line.itemTitle, line.qty.toString()));
    if (line.notes) {
      lines.push(ESC_BOLD_OFF + `  * Note: ${line.notes}`);
    }
  });

  lines.push(ESC_BOLD_OFF + divider('=', width));
  lines.push('');
  lines.push('');
  lines.push('');

  try {
    await printDirect(lines, method, { printerName: pName, cutPaper: shouldCut });
    message.success(isDuplicate ? `KOT Token #${kotOrder.tokenNo} (Duplicate) printed` : `KOT Token #${kotOrder.tokenNo} printed`);
  } catch (err) {
    console.warn('Could not print thermal KOT directly, falling back to browser print', err);
    printKotViaBrowser(kotOrder, { ...options, isDuplicate });
  }
};
