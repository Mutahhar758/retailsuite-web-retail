import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Radio, Divider } from 'antd';
import { PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  type SaleReceiptData,
  printSaleReceiptDirect,
  printSaleReceiptViaBrowser
} from '../utils/saleReceiptPrint';

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
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a5' | 'a4'>('thermal');
  const [printing, setPrinting] = useState(false);

  if (!receiptData) return null;

  const handlePrintThermal = async () => {
    setPrinting(true);
    try {
      if (onPrintThermal) {
        await onPrintThermal(receiptData);
      } else {
        await printSaleReceiptDirect(receiptData, { format: 'thermal' });
      }
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintBrowser = () => {
    printSaleReceiptViaBrowser(receiptData, printFormat);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <PrinterOutlined style={{ color: '#0ea5e9' }} />
            <span>Sale Receipt Preview: {receiptData.voucherNo}</span>
          </Space>
          <Radio.Group
            size="small"
            value={printFormat}
            onChange={(e) => setPrintFormat(e.target.value)}
          >
            <Radio.Button value="thermal">80mm Thermal</Radio.Button>
            <Radio.Button value="a5">A5 Slip</Radio.Button>
            <Radio.Button value="a4">A4 Full</Radio.Button>
          </Radio.Group>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
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
      width={printFormat === 'thermal' ? 440 : 680}
      centered
      destroyOnClose
    >
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
            <tr style={{ borderBottom: '1px dashed #cbd5e1' }}>
              <th style={{ textAlign: 'left', paddingBottom: 4 }}>Item</th>
              <th style={{ textAlign: 'right', paddingBottom: 4, width: '18%' }}>Qty</th>
              <th style={{ textAlign: 'right', paddingBottom: 4, width: '22%' }}>Price</th>
              <th style={{ textAlign: 'right', paddingBottom: 4, width: '25%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {receiptData.lines.map((l, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '4px 0' }}>
                  <div style={{ fontWeight: 600 }}>{l.itemTitle}</div>
                  {l.imei && <div style={{ fontSize: 10, color: '#64748b' }}>SN: {l.imei}</div>}
                  {l.discount && l.discount > 0 ? (
                    <div style={{ fontSize: 10, color: '#10b981' }}>Disc: Rs. {l.discount.toFixed(2)}</div>
                  ) : null}
                </td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>
                  {l.qty} {l.unit || ''}
                </td>
                <td style={{ textAlign: 'right', padding: '4px 0' }}>{l.rate.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>
                  {l.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Divider style={{ margin: '8px 0', borderStyle: 'dashed' }} />

        {/* Totals */}
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Gross Total:</span>
            <span>Rs. {receiptData.grossTotal.toFixed(2)}</span>
          </div>
          {receiptData.totalDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
              <span>Total Discount:</span>
              <span>-Rs. {receiptData.totalDiscount.toFixed(2)}</span>
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
            <span>Rs. {receiptData.netAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cash Received:</span>
            <span>Rs. {receiptData.cashReceived.toFixed(2)}</span>
          </div>
          {receiptData.cashBack > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Change Return:</span>
              <span>Rs. {receiptData.cashBack.toFixed(2)}</span>
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
              <span>Rs. {receiptData.balance.toFixed(2)}</span>
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
    </Modal>
  );
};
