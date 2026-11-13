import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography, Divider, Spin } from 'antd';
import { PrinterOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  type SaleReceiptData,
  BILL_FORMAT_TO_PDF_LAYOUT,
  printSaleReceiptDirect,
  printSaleReceiptPdf,
  printSaleReceiptViaBrowser,
  resolveBillPrintFormat
} from '../utils/saleReceiptPrint';
import { reportService } from '../services/reportService';
import { useSettingsStore, BILL_DEFAULT_FORMAT_KEY } from '../stores/useSettingsStore';

const { Title } = Typography;

interface SaleReceiptModalProps {
  visible: boolean;
  receiptData: SaleReceiptData | null;
  onClose: () => void;
  onPrintThermal?: (data: SaleReceiptData) => Promise<boolean>;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  visible,
  receiptData,
  onClose,
  onPrintThermal
}) => {
  const { initialized, fetchSettings, getSetting } = useSettingsStore();
  const printFormat = resolveBillPrintFormat(getSetting(BILL_DEFAULT_FORMAT_KEY, 'A4'));
  const [printing, setPrinting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (visible && !initialized) {
      fetchSettings();
    }
  }, [visible, initialized, fetchSettings]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (visible && receiptData?.voucherNo && !receiptData.voucherNo.startsWith('TEMP-') && navigator.onLine) {
      setPdfLoading(true);
      reportService.getSaleBillPdf({
        voucherNo: receiptData.voucherNo,
        layout: BILL_FORMAT_TO_PDF_LAYOUT[printFormat] || 'A4Sheet',
        isDuplicate: receiptData.isDuplicate
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch(err => {
        console.warn('Failed to load receipt preview, falling back to HTML view:', err);
        if (active) setPdfUrl(null);
      })
      .finally(() => {
        if (active) setPdfLoading(false);
      });
    } else {
      setPdfUrl(null);
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, receiptData?.voucherNo, printFormat, receiptData?.isDuplicate]);

  if (!receiptData) return null;

  const handlePrintThermal = async () => {
    setPrinting(true);
    try {
      if (onPrintThermal) {
        await onPrintThermal(receiptData);
      } else {
        const printed = await printSaleReceiptPdf(receiptData.voucherNo, BILL_FORMAT_TO_PDF_LAYOUT[printFormat], {
          isDuplicate: receiptData.isDuplicate
        });
        if (!printed) {
          await printSaleReceiptDirect(receiptData, { format: printFormat });
        }
      }
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintBrowser = () => {
    if (pdfUrl) {
      const win = window.open(pdfUrl, '_blank');
      if (win) {
        win.focus();
        return;
      }
    }
    printSaleReceiptViaBrowser(receiptData, printFormat);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <Space>
          <PrinterOutlined style={{ color: '#0ea5e9' }} />
          <span>Sale Receipt: {receiptData.voucherNo}</span>
        </Space>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        pdfUrl ? (
          <Button
            key="download-pdf"
            icon={<DownloadOutlined />}
            href={pdfUrl}
            download={`SaleReceipt_${receiptData.voucherNo}.pdf`}
          >
            Download PDF
          </Button>
        ) : null,
        <Button
          key="browser-print"
          icon={<FilePdfOutlined />}
          onClick={handlePrintBrowser}
        >
          Print / PDF
        </Button>,
        <Button
          key="thermal-print"
          type="primary"
          icon={<PrinterOutlined />}
          loading={printing}
          onClick={handlePrintThermal}
          style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
        >
          Print Receipt
        </Button>
      ]}
      width={printFormat === 'thermal' ? 460 : 780}
      centered
      destroyOnClose
    >
      {pdfLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin tip="Rendering Receipt..." />
        </div>
      ) : pdfUrl ? (
        <div style={{ width: '100%', height: printFormat === 'thermal' ? 520 : 620, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <iframe
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Receipt Preview"
          />
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#fafafa',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: printFormat === 'thermal' ? '18px 24px' : '28px 36px',
            fontFamily: printFormat === 'thermal' ? 'monospace' : 'inherit',
            color: '#1e293b',
            maxHeight: '65vh',
            overflowY: 'auto'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <Title level={4} style={{ margin: 0, textTransform: 'uppercase' }}>
              {receiptData.orgName || 'Retail Store'}
            </Title>
            {receiptData.orgAddress && (
              <div style={{ fontSize: 12, color: '#64748b' }}>{receiptData.orgAddress}</div>
            )}
            {receiptData.orgPhone && (
              <div style={{ fontSize: 12, color: '#64748b' }}>Tel: {receiptData.orgPhone}</div>
            )}
            <div style={{ fontWeight: 700, marginTop: 4, letterSpacing: 1, fontSize: 13 }}>
              SALE RECEIPT
            </div>
            {receiptData.isDuplicate && (
              <div
                style={{
                  display: 'inline-block',
                  border: '1px dashed #ef4444',
                  color: '#ef4444',
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '2px 8px',
                  marginTop: 4,
                  borderRadius: 4
                }}
              >
                *** DUPLICATE / REPRINT ***
              </div>
            )}
          </div>

          <Divider style={{ margin: '8px 0', borderStyle: 'dashed' }} />

          {/* Voucher Meta */}
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>Voucher: <strong>{receiptData.voucherNo}</strong></span>
            <span>{dayjs(receiptData.date).format('DD-MMM-YYYY hh:mm A')}</span>
          </div>
          <div style={{ fontSize: 12, marginTop: 2 }}>
            <span>Customer: <strong>{receiptData.customerName || 'Walk-in Customer'}</strong></span>
          </div>
          {receiptData.customerPhone && (
            <div style={{ fontSize: 12 }}>Phone: {receiptData.customerPhone}</div>
          )}
          {receiptData.narration && (
            <div style={{ fontSize: 12 }}>Narration: {receiptData.narration}</div>
          )}

          <Divider style={{ margin: '8px 0', borderStyle: 'dashed' }} />

          {/* Table of items */}
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Price</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.lines.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                  <td style={{ padding: '6px 0' }}>
                    <div style={{ fontWeight: 600 }}>{item.itemTitle}</div>
                    {item.imei && (
                      <div style={{ fontSize: 10, color: '#64748b' }}>SN: {item.imei}</div>
                    )}
                    {item.discount && item.discount > 0 ? (
                      <div style={{ fontSize: 10, color: '#16a34a' }}>
                        Disc: Rs. {Math.round(item.discount).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 0' }}>
                    {item.qty} {item.unit || ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 0' }}>{Math.round(item.rate).toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600 }}>
                    {Math.round(item.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Divider style={{ margin: '8px 0', borderStyle: 'dashed' }} />

          {/* Totals */}
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gross Total:</span>
              <span>Rs. {Math.round(receiptData.grossTotal).toLocaleString()}</span>
            </div>
            {receiptData.totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                <span>Total Discount:</span>
                <span>-Rs. {Math.round(receiptData.totalDiscount).toLocaleString()}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: 14,
                borderTop: '1px solid #cbd5e1',
                borderBottom: '1px solid #cbd5e1',
                padding: '4px 0',
                margin: '4px 0'
              }}
            >
              <span>Net Total:</span>
              <span>Rs. {Math.round(receiptData.netAmount).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cash Received:</span>
              <span>Rs. {Math.round(receiptData.cashReceived).toLocaleString()}</span>
            </div>
            {receiptData.cashBack > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Change Return:</span>
                <span>Rs. {Math.round(receiptData.cashBack).toLocaleString()}</span>
              </div>
            )}
            {receiptData.balance !== undefined && receiptData.balance > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  color: '#dc2626'
                }}
              >
                <span>Balance Due:</span>
                <span>Rs. {Math.round(receiptData.balance).toLocaleString()}</span>
              </div>
            )}
          </div>

          <Divider style={{ margin: '12px 0 6px', borderStyle: 'dashed' }} />

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b' }}>
            <div>{receiptData.thankYouMessage || 'Thank you for shopping with us!'}</div>
            <div style={{ fontSize: 9, marginTop: 2, color: '#94a3b8' }}>Powered by RetailSuite</div>
          </div>
        </div>
      )}
    </Modal>
  );
};
