import dayjs from 'dayjs';
import { message } from 'antd';
import { reportService } from '../services/reportService';
import {
  printDirect,
  divider,
  padLine,
  ESC_ALIGN_CENTER,
  ESC_ALIGN_LEFT,
  ESC_DOUBLE_ON,
  ESC_DOUBLE_OFF,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  type ConnectionMethod
} from '../hooks/useThermalPrinter';

export interface SaleReceiptLineItem {
  seq?: number;
  itemTitle: string;
  unit?: string | null;
  qty: number;
  rate: number;
  discount?: number;
  amount: number;
  imei?: string | null;
}

export interface SaleReceiptData {
  voucherNo: string;
  date: string | dayjs.Dayjs | Date;
  customerName?: string;
  customerPhone?: string;
  narration?: string;
  description?: string;
  lines: SaleReceiptLineItem[];
  grossTotal: number;
  totalDiscount: number;
  netAmount: number;
  cashReceived: number;
  cashBack: number;
  balance?: number;
  orgName?: string;
  orgAddress?: string;
  orgPhone?: string;
  thankYouMessage?: string;
  isDuplicate?: boolean;
}

export interface SalePrintOptions {
  printerName?: string;
  cutPaper?: boolean;
  openDrawer?: boolean;
  connectionMethod?: ConnectionMethod;
  format?: 'thermal' | 'a5' | 'a4';
  isDuplicate?: boolean;
  fallbackToBrowser?: boolean;
}

/**
 * Generates raw ESC/POS lines formatted for standard 80mm / 48-column thermal printers.
 */
export const generateSaleReceiptEscPosLines = (data: SaleReceiptData): string[] => {
  const width = 48;
  const lines: string[] = [];

  const format4Columns = (col1: string, col2: string, col3: string, col4: string): string => {
    const w1 = 20;
    const w2 = 6;
    const w3 = 9;
    const w4 = 13;

    let c1 = col1.trim();
    if (c1.length > w1 - 1) {
      c1 = c1.substring(0, w1 - 1);
    }
    c1 = c1.padEnd(w1, ' ');

    let c2 = col2.trim();
    if (c2.length > w2) c2 = c2.substring(0, w2);
    c2 = c2.padStart(w2, ' ');

    let c3 = col3.trim();
    if (c3.length > w3) c3 = c3.substring(0, w3);
    c3 = c3.padStart(w3, ' ');

    let c4 = col4.trim();
    if (c4.length > w4) c4 = c4.substring(0, w4);
    c4 = c4.padStart(w4, ' ');

    return c1 + c2 + c3 + c4;
  };

  const storeName = data.orgName || 'RETAIL SUITE';
  lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + storeName.toUpperCase());
  if (data.orgAddress) {
    lines.push(ESC_DOUBLE_OFF + data.orgAddress);
  }
  if (data.orgPhone) {
    lines.push(`Tel: ${data.orgPhone}`);
  }
  lines.push(ESC_DOUBLE_OFF + (data.isDuplicate ? '*** DUPLICATE SALE RECEIPT ***' : 'SALE RECEIPT'));
  lines.push(divider('=', width));

  const dateStr = dayjs(data.date).format('DD-MMM-YYYY hh:mm A');
  lines.push(ESC_ALIGN_LEFT + padLine(`Voucher: ${data.voucherNo}`, dateStr, width));
  lines.push(`Customer: ${data.customerName || 'Walk-in Customer'}`);
  if (data.customerPhone) {
    lines.push(`Contact:  ${data.customerPhone}`);
  }
  if (data.narration) {
    lines.push(`Narration: ${data.narration}`);
  }
  lines.push(divider('-', width));

  lines.push(format4Columns('Item', 'Qty', 'Price', 'Amount'));
  lines.push(divider('-', width));

  data.lines.forEach(line => {
    const qtyText = line.unit ? `${line.qty} ${line.unit}` : `${line.qty}`;
    lines.push(format4Columns(
      line.itemTitle,
      qtyText,
      Math.round(line.rate).toString(),
      Math.round(line.amount).toString()
    ));
    if (line.imei) {
      lines.push(`  IMEI/SN: ${line.imei}`);
    }
    if (line.discount && line.discount > 0) {
      lines.push(`  (Disc: Rs. ${Math.round(line.discount).toString()})`);
    }
  });

  lines.push(divider('-', width));
  lines.push(padLine('Gross Total:', `Rs. ${Math.round(data.grossTotal).toLocaleString()}`, width));
  if (data.totalDiscount > 0) {
    lines.push(padLine('Discount:', `-Rs. ${Math.round(data.totalDiscount).toLocaleString()}`, width));
  }
  lines.push(divider('=', width));

  lines.push(ESC_BOLD_ON + padLine('Net Amount:', `Rs. ${Math.round(data.netAmount).toLocaleString()}`, width));
  lines.push(ESC_BOLD_OFF + padLine('Cash Received:', `Rs. ${Math.round(data.cashReceived).toLocaleString()}`, width));
  if (data.cashBack > 0) {
    lines.push(padLine('Change Return:', `Rs. ${Math.round(data.cashBack).toLocaleString()}`, width));
  }
  if (data.balance !== undefined && data.balance > 0) {
    lines.push(ESC_BOLD_ON + padLine('Remaining Due:', `Rs. ${Math.round(data.balance).toLocaleString()}`, width) + ESC_BOLD_OFF);
  }
  lines.push(divider('-', width));

  const thankYou = data.thankYouMessage || 'Thank you for your business!';
  lines.push(ESC_ALIGN_CENTER + thankYou);
  lines.push('Powered by RetailSuite\n\n\n');

  return lines;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export type BillPrintFormat = 'thermal' | 'a5' | 'a4';
export type SaleBillPdfLayout = 'Thermal80mm' | 'A5Sheet' | 'A4Sheet';

export const BILL_FORMAT_TO_PDF_LAYOUT: Record<BillPrintFormat, SaleBillPdfLayout> = {
  thermal: 'Thermal80mm',
  a5: 'A5Sheet',
  a4: 'A4Sheet',
};

/**
 * Resolve the configured Bill.DefaultFormat setting into a normalized format key.
 */
export const resolveBillPrintFormat = (settingValue?: string): BillPrintFormat => {
  const lower = (settingValue || '').toLowerCase();
  if (lower.includes('thermal')) return 'thermal';
  if (lower.includes('a5')) return 'a5';
  return 'a4';
};

/**
 * Resolve the configured Bill.DefaultFormat setting into a QuestPDF layout name.
 */
export const resolveSaleBillPdfLayout = (settingValue?: string): SaleBillPdfLayout => {
  return BILL_FORMAT_TO_PDF_LAYOUT[resolveBillPrintFormat(settingValue)];
};

/**
 * Print a QuestPDF generated sale receipt directly to thermal/laser printer via printer-bridge
 * or open browser PDF print dialog if explicitly requested.
 */
export const printSaleReceiptPdf = async (
  voucherNo: string,
  layout: 'Thermal80mm' | 'A5Sheet' | 'A4Sheet' = 'Thermal80mm',
  options: SalePrintOptions = {}
): Promise<boolean> => {
  const method: ConnectionMethod = options.connectionMethod || 
    ((localStorage.getItem('pos_printer_method') as ConnectionMethod) || 'LOCAL_RELAY');
  const printerName = options.printerName || localStorage.getItem('pos_printer_name') || 'XP-80';
  const cutPaper = options.cutPaper ?? (localStorage.getItem('pos_printer_cut_paper') !== 'false');
  const openDrawer = options.openDrawer ?? (localStorage.getItem('pos_printer_open_drawer') === 'true');

  try {
    const blob = await reportService.getSaleBillPdf({
      voucherNo,
      layout,
      isDuplicate: options.isDuplicate
    });

    if (method === 'LOCAL_RELAY') {
      try {
        const base64 = await blobToBase64(blob);
        const bridgeUrl = (localStorage.getItem('pos_printer_bridge_url') || 'http://localhost:5000') + '/print-pdf';
        const res = await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printerName,
            pdfBase64: base64,
            isThermal: layout === 'Thermal80mm',
            cutPaper,
            openDrawer
          })
        });

        if (res.ok) {
          message.success(`Receipt printed to ${printerName}`);
          return true;
        }
      } catch (bridgeErr) {
        console.warn('Printer bridge PDF spool failed:', bridgeErr);
      }

      // When configured for printer bridge, do not open a new tab on print failure.
      // Return false so caller falls back to ESC/POS direct printing.
      return false;
    }

    // Only open vector PDF in browser window if explicitly requested as fallback
    if (options.fallbackToBrowser) {
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.focus();
      }
      return true;
    }

    return false;
  } catch (err: any) {
    console.warn('QuestPDF receipt print failed:', err);
    return false;
  }
};

/**
 * Print via silent Direct Thermal Printer (Bridge / WebUSB).
 * Prefers server-side QuestPDF when voucher is saved, with fallback to ESC/POS on printer bridge.
 */
export const printSaleReceiptDirect = async (
  data: SaleReceiptData,
  options: SalePrintOptions = {}
): Promise<boolean> => {
  const method: ConnectionMethod = options.connectionMethod || 
    ((localStorage.getItem('pos_printer_method') as ConnectionMethod) || 'LOCAL_RELAY');
  const printerName = options.printerName || localStorage.getItem('pos_printer_name') || 'XP-80';
  const cutPaper = options.cutPaper ?? (localStorage.getItem('pos_printer_cut_paper') !== 'false');
  const openDrawer = options.openDrawer ?? (localStorage.getItem('pos_printer_open_drawer') === 'true');

  // If we have a saved voucher on the server, attempt QuestPDF high-fidelity printing first
  if (data.voucherNo && !data.voucherNo.startsWith('TEMP-') && navigator.onLine) {
    const layout = options.format === 'a4' ? 'A4Sheet' : (options.format === 'a5' ? 'A5Sheet' : 'Thermal80mm');
    try {
      const pdfPrinted = await printSaleReceiptPdf(data.voucherNo, layout, {
        ...options,
        connectionMethod: method,
        printerName,
        cutPaper,
        openDrawer,
        isDuplicate: data.isDuplicate,
        fallbackToBrowser: false
      });
      if (pdfPrinted) return true;
    } catch {
      // Fall through to ESC/POS direct print
    }
  }

  try {
    const lines = generateSaleReceiptEscPosLines(data);
    await printDirect(lines, method, { printerName, cutPaper, openDrawer });
    message.success(`Receipt printed to ${printerName}`);
    return true;
  } catch (err: any) {
    console.error('Direct thermal print to printer bridge failed:', err);
    message.error(err?.message || 'Failed to print receipt to printer bridge. Please check that printer bridge is running.');
    return false;
  }
};

/**
 * Open browser print preview dialog with high-fidelity thermal 80mm or A5/A4 invoice styles.
 */
export const printSaleReceiptViaBrowser = (
  data: SaleReceiptData,
  format: 'thermal' | 'a5' | 'a4' = 'thermal'
) => {
  const isThermal = format === 'thermal';
  const printWindow = window.open('', '_blank', isThermal ? 'width=380,height=600' : 'width=800,height=900');
  if (!printWindow) {
    message.warning('Pop-up blocked. Please allow pop-ups for receipt printing.');
    return;
  }

  const dateStr = dayjs(data.date).format('DD-MMM-YYYY hh:mm A');
  const storeName = data.orgName || 'Retail Store';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt ${data.voucherNo}${data.isDuplicate ? ' (Duplicate)' : ''}</title>
      <style>
        @page {
          size: ${isThermal ? '80mm auto' : (format === 'a5' ? 'A5' : 'A4')};
          margin: ${isThermal ? '3mm' : '15mm'};
        }
        * { box-sizing: border-box; }
        body {
          font-family: ${isThermal ? "'Courier New', Courier, monospace" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
          width: ${isThermal ? '72mm' : '100%'};
          margin: 0 auto;
          color: #000;
          font-size: ${isThermal ? '12px' : '13px'};
          line-height: 1.35;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .title { font-size: ${isThermal ? '18px' : '22px'}; font-weight: 800; margin-bottom: 2px; }
        .subtitle { font-size: 11px; color: #444; }
        .duplicate-banner { font-size: 13px; font-weight: 900; letter-spacing: 2px; margin: 4px 0; border: 1px dashed #000; padding: 2px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .double-divider { border-top: 2px solid #000; margin: 6px 0; }
        .meta-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th { border-bottom: 1px dashed #000; text-align: left; padding: 4px 0; font-size: 11px; font-weight: bold; }
        td { padding: 3px 0; vertical-align: top; font-size: 12px; }
        .item-imei { font-size: 10px; color: #555; }
        .totals-table { width: 100%; margin-top: 4px; }
        .totals-table td { padding: 2px 0; }
        .grand-total { font-size: 14px; font-weight: 900; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        .footer { margin-top: 14px; font-size: 11px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">${storeName.toUpperCase()}</div>
        ${data.orgAddress ? `<div class="subtitle">${data.orgAddress}</div>` : ''}
        ${data.orgPhone ? `<div class="subtitle">Tel: ${data.orgPhone}</div>` : ''}
        <div class="subtitle bold" style="margin-top: 4px;">SALE RECEIPT</div>
        ${data.isDuplicate ? '<div class="duplicate-banner">*** DUPLICATE / REPRINT ***</div>' : ''}
      </div>

      <div class="double-divider"></div>

      <div class="meta-row"><span>Voucher: <b>${data.voucherNo}</b></span><span>${dateStr}</span></div>
      <div class="meta-row"><span>Customer: <b>${data.customerName || 'Walk-in Customer'}</b></span></div>
      ${data.customerPhone ? `<div class="meta-row"><span>Phone: ${data.customerPhone}</span></div>` : ''}
      ${data.narration ? `<div class="meta-row"><span>Narration: ${data.narration}</span></div>` : ''}

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th style="width: 45%;">Item</th>
            <th class="text-right" style="width: 15%;">Qty</th>
            <th class="text-right" style="width: 18%;">Price</th>
            <th class="text-right" style="width: 22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.lines.map(line => `
            <tr>
              <td>
                <div class="bold">${line.itemTitle}</div>
                ${line.imei ? `<div class="item-imei">SN: ${line.imei}</div>` : ''}
                ${line.discount && line.discount > 0 ? `<div class="item-imei">Disc: Rs. ${Math.round(line.discount).toLocaleString()}</div>` : ''}
              </td>
              <td class="text-right">${line.qty} ${line.unit || ''}</td>
              <td class="text-right">${Math.round(line.rate).toLocaleString()}</td>
              <td class="text-right bold">${Math.round(line.amount).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="divider"></div>

      <table class="totals-table">
        <tr>
          <td>Gross Total:</td>
          <td class="text-right">Rs. ${Math.round(data.grossTotal).toLocaleString()}</td>
        </tr>
        ${data.totalDiscount > 0 ? `
          <tr>
            <td>Discount:</td>
            <td class="text-right">-Rs. ${Math.round(data.totalDiscount).toLocaleString()}</td>
          </tr>
        ` : ''}
        <tr class="grand-total">
          <td style="padding: 4px 0;">Net Amount:</td>
          <td class="text-right" style="padding: 4px 0;">Rs. ${Math.round(data.netAmount).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Cash Received:</td>
          <td class="text-right">Rs. ${Math.round(data.cashReceived).toLocaleString()}</td>
        </tr>
        ${data.cashBack > 0 ? `
          <tr>
            <td>Change Return:</td>
            <td class="text-right">Rs. ${Math.round(data.cashBack).toLocaleString()}</td>
          </tr>
        ` : ''}
        ${data.balance !== undefined && data.balance > 0 ? `
          <tr style="font-weight: bold; color: #b91c1c;">
            <td>Remaining Due:</td>
            <td class="text-right">Rs. ${Math.round(data.balance).toLocaleString()}</td>
          </tr>
        ` : ''}
      </table>

      <div class="divider"></div>

      <div class="footer">
        <div>${data.thankYouMessage || 'Thank you for shopping with us!'}</div>
        <div style="font-size: 9px; color: #666; margin-top: 4px;">Powered by RetailSuite</div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
