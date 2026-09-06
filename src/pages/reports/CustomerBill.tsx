import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Divider, Checkbox, Radio, Input, Row, Col
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, FileTextOutlined, TruckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type CustomerBillResponse } from '../../services/reportService';
import api from '../../services/api';
import { rangePresets } from '../../utils/datePresets';
import {
  printDirect,
  padLine,
  divider,
  type ConnectionMethod,
  ESC_ALIGN_LEFT,
  ESC_ALIGN_CENTER,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_DOUBLE_ON,
  ESC_DOUBLE_OFF
} from '../../hooks/useThermalPrinter';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT } from '../../stores/useSettingsStore';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';
import { useLocation, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface BillReportViewProps {
  currentOrgName: string;
  selectedCustomer: { account: string; title: string } | null;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  billData: CustomerBillResponse;
}

// Separate component for Standard Customer Bill preview & A4 print
const StandardBillReportView: React.FC<BillReportViewProps> = ({
  currentOrgName,
  selectedCustomer,
  dateRange,
  billData
}) => {
  const thankYouMsg = useSettingsStore(s => s.getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT));
  const fromStr = dateRange ? dateRange[0].format('DD-MMM-YYYY') : '';
  const toStr = dateRange ? dateRange[1].format('DD-MMM-YYYY') : '';

  return (
    <div 
      id="printable-report" 
      style={{ 
        border: '1px solid #e8e8e8', 
        borderRadius: 8, 
        padding: 24, 
        textAlign: 'left', 
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.4,
        color: '#000000',
        maxWidth: 420,
        margin: '24px auto'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16, color: '#000000' }}>{currentOrgName.toUpperCase()}</h2>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>CUSTOMER STATEMENT / BILL</p>
        <p style={{ margin: '4px 0 0', fontSize: 9 }}>
          Period: {fromStr} to {toStr}
        </p>
        <p style={{ margin: 0, fontSize: 9 }}>
          Print Date: {dayjs().format('DD-MMM-YYYY HH:mm')}
        </p>
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '12px 0' }}>
        <div><strong>Customer:</strong> {selectedCustomer?.title}</div>
        <div><strong>Account Code:</strong> {selectedCustomer?.account}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>Date</th>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>Voucher</th>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '4px 0' }}>Rate</th>
            <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {billData.lines.map((line, idx) => (
            <tr key={`${line.vNo}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ textAlign: 'left', padding: '4px 0' }}>{dayjs(line.date).format('DD-MMM')}</td>
              <td style={{ textAlign: 'left', padding: '4px 0' }}>{line.vNo}</td>
              <td style={{ textAlign: 'left', padding: '4px 0' }}>{line.item}</td>
              <td style={{ textAlign: 'center', padding: '4px 0' }}>{line.qty}</td>
              <td style={{ textAlign: 'right', padding: '4px 0' }}>{Math.round(line.rate)}</td>
              <td style={{ textAlign: 'right', padding: '4px 0' }}>{line.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Current Bill Total:</span>
          <strong>
            Rs. {billData.lines.reduce((sum, row) => sum + row.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Previous Balance:</span>
          <strong>
            Rs. {Math.abs(billData.summary.previousBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {billData.summary.previousBalance >= 0 ? 'Dr' : 'Cr'}
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span>Payments Received:</span>
          <strong>
            Rs. {billData.summary.payment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px double #000', paddingTop: 6, marginTop: 4, fontSize: 12 }}>
          <strong>Net Balance Due:</strong>
          <strong>
            Rs. {Math.abs(billData.summary.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })} {billData.summary.balance >= 0 ? 'Dr' : 'Cr'}
          </strong>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 16 }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontSize: 9 }}>Customer Sig</div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontSize: 9 }}>Authorized Sig</div>
        </div>
      </div>
      
      {thankYouMsg && (
        <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 16, textAlign: 'center', fontSize: 10, fontWeight: 600 }}>
          {thankYouMsg}
        </div>
      )}
    </div>
  );
};

// Separate component for Wanda / Feed Mill Customer Bill preview & A4 print (English)
const WandaBillReportView: React.FC<BillReportViewProps> = ({
  currentOrgName,
  selectedCustomer,
  dateRange,
  billData
}) => {
  const thankYouMsg = useSettingsStore(s => s.getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT));
  const fromStr = dateRange ? dateRange[0].format('DD-MMM-YYYY') : '';
  const toStr = dateRange ? dateRange[1].format('DD-MMM-YYYY') : '';

  const totalSaleKg = billData.lines.reduce((sum, row) => sum + row.qty, 0);
  const totalSaleBags = billData.lines.reduce((sum, row) => sum + (row.secQty || 0), 0);
  const totalSaleAmount = billData.lines.reduce((sum, row) => sum + row.amount, 0);

  const totalPurchaseKg = billData.lines.filter(row => (row as any).isPurchase).reduce((sum, row) => sum + row.qty, 0);
  const totalPurchaseBags = billData.lines.filter(row => (row as any).isPurchase).reduce((sum, row) => sum + (row.secQty || 0), 0);
  const totalPurchaseAmount = billData.lines.filter(row => (row as any).isPurchase).reduce((sum, row) => sum + row.amount, 0);

  const totalBill = totalSaleAmount;
  const previousBal = billData.summary.previousBalance;
  const totalAmount = previousBal + totalBill;
  const payment = billData.summary.payment;
  const netBalance = totalAmount - payment;

  return (
    <div 
      id="printable-report" 
      style={{ 
        border: 'none', 
        padding: '16px 8px', 
        backgroundColor: '#ffffff',
        color: '#000000',
        maxWidth: 920,
        margin: '16px auto',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Business Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, textTransform: 'uppercase', color: '#000000', letterSpacing: '0.5px' }}>
          {currentOrgName}
        </h1>
        <h2 style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#000000', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Customer Bill
        </h2>
      </div>

      {/* Meta Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #000000', paddingBottom: 10, fontSize: 13 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div><span style={{ color: '#000000', fontWeight: 500 }}>Account:</span> <span style={{ fontWeight: 600, color: '#000000' }}>{selectedCustomer?.title}</span></div>
          <div><span style={{ color: '#000000', fontWeight: 500 }}>Date:</span> <span style={{ fontWeight: 600, color: '#000000' }}>{fromStr} to {toStr}</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={{ color: '#000000', fontWeight: 500 }}>Previous Balance:</span> <span style={{ fontWeight: 600, color: '#000000' }}>Rs. {previousBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      {/* Detail Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11, boxSizing: 'border-box', marginBottom: 20 }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <th style={{ width: '7%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Date</th>
            <th style={{ width: '8.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9, lineHeight: 1.15, boxSizing: 'border-box' }}>Voucher No</th>
            <th style={{ width: '17%', border: '1px solid #000000', padding: '6px 4px', textAlign: 'left', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Description</th>
            <th style={{ width: '9.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Weight (Kg)</th>
            <th style={{ width: '6.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Bags</th>
            <th style={{ width: '8.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Kg Rate</th>
            <th style={{ width: '8.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Bag Rate</th>
            <th style={{ width: '7%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Carriage</th>
            <th style={{ width: '10.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9.5, lineHeight: 1.15, boxSizing: 'border-box' }}>Amount</th>
            <th style={{ width: '8.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'center', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9, lineHeight: 1.15, boxSizing: 'border-box' }}>Receipt Date</th>
            <th style={{ width: '8.5%', border: '1px solid #000000', padding: '6px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', textTransform: 'uppercase', fontSize: 9, lineHeight: 1.15, boxSizing: 'border-box' }}>Receipt Amount</th>
          </tr>
        </thead>
        <tbody>
          {billData.lines.map((line, idx) => {
            const bagQty = line.secQty ?? (line.qtyInPack && line.qtyInPack > 0 ? Math.round(line.qty / line.qtyInPack) : 0);
            const kgRate = line.rate ?? 0;
            const bagRate = line.secRate ?? (line.qtyInPack && line.qtyInPack > 0 ? line.rate * line.qtyInPack : 0);

            return (
              <tr key={`${line.vNo}-${idx}`} style={{ backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {dayjs(line.date).format('DD/MM/YY')}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontFamily: "'Consolas', monospace", fontSize: 9.5, fontWeight: 500, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.vNo}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#000000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.item}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.qty.toLocaleString()}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {bagQty > 0 ? bagQty.toLocaleString() : '-'}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {kgRate > 0 ? kgRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {bagRate > 0 ? bagRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.addLess !== 0 ? line.addLess.toLocaleString() : '0'}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 600, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'center', fontWeight: 400, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.receiptDate ? dayjs(line.receiptDate).format('DD/MM/YY') : ''}
                </td>
                <td style={{ border: '1px solid #000000', padding: '5px 2px', textAlign: 'right', fontWeight: 500, color: '#000000', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {line.receiptAmount ? line.receiptAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Box Frame (3 Columns) */}
      <div 
        style={{ 
          border: '1px solid #000000', 
          borderRadius: 8, 
          padding: '14px 18px', 
          display: 'grid', 
          gridTemplateColumns: '1.25fr 1fr 1fr', 
          gap: 20, 
          backgroundColor: '#ffffff',
          fontSize: 12.5
        }}
      >
        {/* Column 1: Purchases & Sales Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRight: '1px solid #000000', paddingRight: 16 }}>
          {totalPurchaseKg > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#000000', fontWeight: 500 }}>Purchase Weight (Kg):</span>
                <span style={{ fontWeight: 600, color: '#000000' }}>{totalPurchaseKg.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#000000', fontWeight: 500 }}>Purchase Bags:</span>
                <span style={{ fontWeight: 600, color: '#000000' }}>{totalPurchaseBags.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#000000', fontWeight: 500 }}>Purchase Amount:</span>
                <span style={{ fontWeight: 600, color: '#000000' }}>{totalPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ borderTop: '1px dashed #000000', margin: '3px 0' }} />
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Sale Weight (Kg):</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{totalSaleKg.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Sale Bags:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{totalSaleBags.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Sale Amount:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{totalSaleAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Column 2: Bill Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderRight: '1px solid #000000', paddingRight: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Previous Balance:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{previousBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Total Bill:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ borderTop: '1px solid #000000', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#000000' }}>Grand Total:</span>
            <span style={{ fontWeight: 700, color: '#000000' }}>{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Column 3: Receipts & Net Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Receipts:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>{payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#000000', fontWeight: 500 }}>Payments:</span>
            <span style={{ fontWeight: 600, color: '#000000' }}>0.00</span>
          </div>
          <div style={{ borderTop: '1.5px solid #000000', margin: '5px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
            <span style={{ fontWeight: 700, color: '#000000' }}>Net Balance:</span>
            <span style={{ fontWeight: 700, color: '#000000', fontSize: 15 }}>{netBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {thankYouMsg && (
        <div style={{ borderTop: '1px dashed #000000', paddingTop: 8, marginTop: 16, textAlign: 'center', fontSize: 11, color: '#000000', fontWeight: 700 }}>
          {thankYouMsg}
        </div>
      )}
    </div>
  );
};

// Separate thermal printing ESC/POS generator function for Standard Customer Bill
const generateStandardThermalLines = (
  orgName: string,
  customerTitle: string,
  customerAccount: string,
  fromStr: string,
  toStr: string,
  data: CustomerBillResponse
): string[] => {
  const width = 48;
  const lines: string[] = [];

  const format6Columns = (c1: string, c2: string, c3: string, c4: string, c5: string, c6: string): string => {
    const w1 = 5, w2 = 10, w3 = 9, w4 = 3, w5 = 7, w6 = 9;
    let val1 = c1.trim().substring(0, w1).padEnd(w1, ' ');
    let val2 = c2.trim().substring(0, w2).padEnd(w2, ' ');
    let val3 = c3.trim().substring(0, w3).padEnd(w3, ' ');
    let val4 = c4.trim().substring(0, w4).padStart(w4, ' ');
    let val5 = c5.trim().substring(0, w5).padStart(w5, ' ');
    let val6 = c6.trim().substring(0, w6).padStart(w6, ' ');
    return `${val1} ${val2} ${val3} ${val4} ${val5} ${val6}`;
  };

  lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + orgName.toUpperCase());
  lines.push(ESC_DOUBLE_OFF + 'CUSTOMER STATEMENT / BILL');
  lines.push(`Period: ${fromStr} to ${toStr}`);
  lines.push(`Print Date: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
  lines.push(ESC_ALIGN_LEFT + divider('-', width));

  lines.push(`Customer: ${customerTitle}`);
  lines.push(`Account Code: ${customerAccount}`);
  lines.push(divider('-', width));

  lines.push(format6Columns('Date', 'Voucher', 'Item', 'Qty', 'Rate', 'Amount'));
  lines.push(divider('-', width));

  let currentBillTotal = 0;
  data.lines.forEach(line => {
    currentBillTotal += line.amount;
    const dateStr = dayjs(line.date).format('DD/MM');
    const qtyStr = line.qty.toString();
    const rateStr = Math.round(line.rate).toString();
    const amountStr = line.amount.toFixed(2);
    lines.push(format6Columns(dateStr, line.vNo, line.item, qtyStr, rateStr, amountStr));
  });
  lines.push(divider('-', width));

  lines.push(padLine('Current Bill Total:', `Rs. ${currentBillTotal.toFixed(2)}`, width));
  lines.push(padLine('Previous Balance:', `Rs. ${Math.abs(data.summary.previousBalance).toFixed(2)} ${data.summary.previousBalance >= 0 ? 'Dr' : 'Cr'}`, width));
  lines.push(padLine('Payments Received:', `Rs. ${data.summary.payment.toFixed(2)}`, width));
  lines.push(divider('=', width));
  
  lines.push(ESC_BOLD_ON + padLine('Net Balance Due:', `Rs. ${Math.abs(data.summary.balance).toFixed(2)} ${data.summary.balance >= 0 ? 'Dr' : 'Cr'}`, width));
  lines.push(ESC_BOLD_OFF + divider('-', width));

  lines.push('');
  lines.push(padLine('Customer Signature', 'Authorized Signature', width));
  lines.push('');
  const thankYouMsg = useSettingsStore.getState().getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
  if (thankYouMsg) {
    lines.push(ESC_ALIGN_CENTER + thankYouMsg);
  }
  lines.push(ESC_ALIGN_LEFT);
  lines.push('');
  lines.push('');
  lines.push('');

  return lines;
};

// Separate thermal printing ESC/POS generator function for Wanda / Feed Mill Customer Bill
const generateWandaThermalLines = (
  orgName: string,
  customerTitle: string,
  customerAccount: string,
  fromStr: string,
  toStr: string,
  data: CustomerBillResponse
): string[] => {
  const width = 48;
  const lines: string[] = [];

  const format7Columns = (c1: string, c2: string, c3: string, c4: string, c5: string, c6: string, c7: string): string => {
    const w1 = 5, w2 = 8, w3 = 9, w4 = 6, w5 = 4, w6 = 6, w7 = 7;
    let val1 = c1.trim().substring(0, w1).padEnd(w1, ' ');
    let val2 = c2.trim().substring(0, w2).padEnd(w2, ' ');
    let val3 = c3.trim().substring(0, w3).padEnd(w3, ' ');
    let val4 = c4.trim().substring(0, w4).padStart(w4, ' ');
    let val5 = c5.trim().substring(0, w5).padStart(w5, ' ');
    let val6 = c6.trim().substring(0, w6).padStart(w6, ' ');
    let val7 = c7.trim().substring(0, w7).padStart(w7, ' ');
    return `${val1} ${val2} ${val3} ${val4} ${val5} ${val6} ${val7}`;
  };

  lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + orgName.toUpperCase());
  lines.push(ESC_DOUBLE_OFF + 'WANDA / FEED CUSTOMER BILL');
  lines.push(`Period: ${fromStr} to ${toStr}`);
  lines.push(`Print Date: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
  lines.push(ESC_ALIGN_LEFT + divider('-', width));

  lines.push(`Customer: ${customerTitle}`);
  lines.push(`Account Code: ${customerAccount}`);
  lines.push(divider('-', width));

  lines.push(format7Columns('Date', 'Voucher', 'Item', 'Kg', 'Bags', 'Rate', 'Amount'));
  lines.push(divider('-', width));

  let currentBillTotal = 0;
  let totalKg = 0;
  let totalBags = 0;

  data.lines.forEach(line => {
    currentBillTotal += line.amount;
    totalKg += line.qty;
    const bags = line.secQty || (line.qtyInPack && line.qtyInPack > 0 ? Math.round(line.qty / line.qtyInPack) : 0);
    totalBags += bags;

    const dateStr = dayjs(line.date).format('DD/MM');
    const kgStr = line.qty.toString();
    const bagStr = bags > 0 ? bags.toString() : '-';
    const rateStr = Math.round(line.secRate || line.rate).toString();
    const amountStr = line.amount.toFixed(0);
    lines.push(format7Columns(dateStr, line.vNo, line.item, kgStr, bagStr, rateStr, amountStr));
  });
  lines.push(divider('-', width));

  lines.push(padLine('Total Sale Kg:', totalKg.toLocaleString(), width));
  lines.push(padLine('Total Sale Bags:', totalBags.toLocaleString(), width));
  lines.push(padLine('Current Bill Total:', `Rs. ${currentBillTotal.toFixed(2)}`, width));
  lines.push(padLine('Previous Balance:', `Rs. ${Math.abs(data.summary.previousBalance).toFixed(2)} ${data.summary.previousBalance >= 0 ? 'Dr' : 'Cr'}`, width));
  lines.push(padLine('Payments Received:', `Rs. ${data.summary.payment.toFixed(2)}`, width));
  lines.push(divider('=', width));
  
  lines.push(ESC_BOLD_ON + padLine('Net Balance Due:', `Rs. ${Math.abs(data.summary.balance).toFixed(2)} ${data.summary.balance >= 0 ? 'Dr' : 'Cr'}`, width));
  lines.push(ESC_BOLD_OFF + divider('-', width));

  lines.push('');
  lines.push(padLine('Customer Signature', 'Authorized Signature', width));
  lines.push('');
  const thankYouMsg = useSettingsStore.getState().getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
  if (thankYouMsg) {
    lines.push(ESC_ALIGN_CENTER + thankYouMsg);
  }
  lines.push(ESC_ALIGN_LEFT);
  lines.push('');
  lines.push('');
  lines.push('');

  return lines;
};

export const CustomerBill: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<{ account: string; title: string }[]>([]);
  const [billData, setBillData] = useState<CustomerBillResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ account: string; title: string } | null>(null);

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Store';
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  // Printer Configuration States
  const [connectionMethod] = useState<ConnectionMethod>(() => {
    const saved = localStorage.getItem('pos_printer_method');
    if (saved) return saved as ConnectionMethod;
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('CrOS')) {
      return 'WEB_USB';
    }
    return 'LOCAL_RELAY';
  });
  const [printerName] = useState<string>(() => {
    return localStorage.getItem('pos_printer_name') || 'XP-80';
  });
  const [openDrawer] = useState<boolean>(false);
  const [cutPaper] = useState<boolean>(() => {
    const saved = localStorage.getItem('pos_printer_cut_paper');
    return saved !== null ? saved === 'true' : true;
  });

  const [singlePrinting, setSinglePrinting] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [printMode, setPrintMode] = useState<'single' | 'multi'>('single');
  const [selectedCustomerAccounts, setSelectedCustomerAccounts] = useState<string[]>([]);
  const [searchCustomerListQuery, setSearchCustomerListQuery] = useState('');
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [selectedSupplyOrderId, setSelectedSupplyOrderId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/api/customers').then(res => {
      const cusList = res.data.body || [];
      setCustomers(cusList);

      // Auto-load state if redirected from Customer Supply Register
      const state = location.state as { customerId?: string; fromDate?: string; toDate?: string } | null;
      if (state && state.customerId) {
        const fromD = state.fromDate ? dayjs(state.fromDate) : dayjs().startOf('month');
        const toD = state.toDate ? dayjs(state.toDate) : dayjs();
        form.setFieldsValue({
          account: state.customerId,
          dateRange: [fromD, toD]
        });
        const matchedCus = cusList.find((c: any) => c.account === state.customerId);
        if (matchedCus) setSelectedCustomer(matchedCus);

        // Auto trigger search
        handleSearch({
          account: state.customerId,
          dateRange: [fromD, toD]
        });
      }
    });
    supplyOrderService.getList().then(setSupplyOrders).catch(console.error);
  }, []);

  const handleSupplyOrderSelect = async (orderId: number) => {
    setSelectedSupplyOrderId(orderId);
    setLoading(true);
    try {
      const order = await supplyOrderService.getById(orderId);
      if (order && order.details) {
        const customerIds = order.details.map(d => d.customerId);
        const validCustomerIds = customerIds.filter(id => customers.some(c => c.account === id));
        setSelectedCustomerAccounts(validCustomerIds);
      }
    } catch (err) {
      message.error('Failed to load supply order profile');
    } finally {
      setLoading(false);
    }
  };

  const generateBillReceiptLines = (customerTitle: string, customerAccount: string, data: CustomerBillResponse): string[] => {
    const dateRange = form.getFieldValue('dateRange');
    const fromStr = dateRange ? dateRange[0].format('DD-MMM-YYYY') : '';
    const toStr = dateRange ? dateRange[1].format('DD-MMM-YYYY') : '';

    if (hasVariablePackFeature) {
      return generateWandaThermalLines(currentOrgName, customerTitle, customerAccount, fromStr, toStr, data);
    }
    return generateStandardThermalLines(currentOrgName, customerTitle, customerAccount, fromStr, toStr, data);
  };

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        account: values.account,
        dateBasis: values.dateBasis || 'VoucherDate'
      };
      const res = await reportService.getCustomerBill(filter);
      setBillData(res);
      
      const customer = customers.find(c => c.account === values.account);
      setSelectedCustomer(customer || null);
    } catch (error) {
      message.error('Failed to load customer bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSingleThermal = async () => {
    if (!billData || !selectedCustomer) {
      message.error('No bill data loaded to print');
      return;
    }
    setSinglePrinting(true);
    try {
      const lines = generateBillReceiptLines(selectedCustomer.title, selectedCustomer.account, billData);
      await printDirect(lines, connectionMethod, {
        printerName,
        openDrawer,
        cutPaper
      });
      message.success('Print job submitted successfully');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Printing failed');
    } finally {
      setSinglePrinting(false);
    }
  };

  const handlePrintBulkThermal = async () => {
    const values = form.getFieldsValue();
    if (!values.dateRange) {
      message.error('Please select a date range first');
      return;
    }
    if (selectedCustomerAccounts.length === 0) {
      message.error('Please select at least one customer from the checklist');
      return;
    }

    setBulkPrinting(true);
    let printedCount = 0;
    try {
      const fromDate = values.dateRange[0].format('YYYY-MM-DD');
      const toDate = values.dateRange[1].format('YYYY-MM-DD');

      for (const account of selectedCustomerAccounts) {
        const customer = customers.find(c => c.account === account);
        if (!customer) continue;

        const res = await reportService.getCustomerBill({
          fromDate,
          toDate,
          account,
          dateBasis: values.dateBasis || 'VoucherDate'
        });

        if (res.lines.length === 0 && res.summary.balance === 0 && res.summary.previousBalance === 0) {
          continue;
        }

        const lines = generateBillReceiptLines(customer.title, customer.account, res);

        await printDirect(lines, connectionMethod, {
          printerName,
          openDrawer,
          cutPaper
        });

        printedCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (printedCount === 0) {
        message.info('No statements with activity or balance found for the selected customers.');
      } else {
        message.success(`Multi-printing completed! Printed ${printedCount} statement(s).`);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Multi-printing failed midway');
    } finally {
      setBulkPrinting(false);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
          #printable-report {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-sizing: border-box !important;
          }
          #printable-report table {
            width: 100% !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
          }
          #printable-report th,
          #printable-report td {
            border: 1px solid #000000 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <FileTextOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Customer Bill Report</Title>
            <Text type="secondary">Generate consolidated billing for a customer</Text>
          </div>
        </Space>
        <Space className="no-print" size="middle">
          <Button
            icon={<TruckOutlined />}
            onClick={() => {
              const acc = form.getFieldValue('account');
              const dates = form.getFieldValue('dateRange');
              navigate('/daily-entries/customer-supply', {
                state: {
                  customerId: acc,
                  fromDate: dates?.[0]?.format('YYYY-MM-DD'),
                  toDate: dates?.[1]?.format('YYYY-MM-DD')
                }
              });
            }}
          >
            Customer Supply Register
          </Button>
          {printMode === 'single' && (
            <>
              <Button icon={<PrinterOutlined />} disabled={!billData} onClick={() => window.print()}>Print Bill (A4)</Button>
              <Button 
                type="primary"
                icon={<PrinterOutlined />} 
                disabled={!billData} 
                loading={singlePrinting}
                onClick={handlePrintSingleThermal}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                Print Slip
              </Button>
            </>
          )}
        </Space>
      </div>

      <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-print">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{
            dateRange: [dayjs().startOf('month'), dayjs()],
            dateBasis: 'VoucherDate'
          }}
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12}>
              <Form.Item label="Print Mode">
                <Radio.Group value={printMode} onChange={e => setPrintMode(e.target.value)}>
                  <Radio.Button value="single">Single Customer Print</Radio.Button>
                  <Radio.Button value="multi">Multiple Customers Print</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dateBasis" label="Date Basis">
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="VoucherDate">Voucher Date</Radio.Button>
                  <Radio.Button value="ClearingDate">Clearing Date</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} align="bottom">
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker format="DD-MMM-YYYY" presets={rangePresets} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {printMode === 'single' && (
              <>
                <Col xs={24} sm={12} md={10}>
                  <Form.Item name="account" label="Customer" rules={[{ required: printMode === 'single' }]} style={{ marginBottom: 0 }}>
                    <Select 
                      showSearch 
                      placeholder="Select customer..." 
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                    >
                      {customers.map(c => (
                        <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={6}>
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', width: '100%' }}>
                      Generate Bill
                    </Button>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {printMode === 'multi' && (
            <div style={{ marginTop: 16 }}>
              <Form.Item label="Select Customers for Multi Print" required>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, backgroundColor: '#ffffff', width: '100%', maxWidth: 500 }}>
                  
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Select by Supply Order Profile:</Text>
                    <Select
                      allowClear
                      style={{ width: '100%' }}
                      placeholder="Select a supply order profile"
                      value={selectedSupplyOrderId}
                      onChange={val => {
                        if (!val) {
                          setSelectedSupplyOrderId(null);
                          setSelectedCustomerAccounts([]);
                        } else {
                          handleSupplyOrderSelect(val);
                        }
                      }}
                      loading={loading}
                    >
                      {supplyOrders.map(so => (
                        <Select.Option key={so.id} value={so.id}>{so.title}</Select.Option>
                      ))}
                    </Select>
                  </div>
                  <Divider style={{ margin: '12px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Input
                      size="small"
                      placeholder="Filter customers..."
                      value={searchCustomerListQuery}
                      onChange={e => setSearchCustomerListQuery(e.target.value)}
                      style={{ width: '60%' }}
                    />
                    <Checkbox
                      checked={selectedCustomerAccounts.length === customers.length && customers.length > 0}
                      indeterminate={selectedCustomerAccounts.length > 0 && selectedCustomerAccounts.length < customers.length}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedCustomerAccounts(customers.map(c => c.account));
                        } else {
                          setSelectedCustomerAccounts([]);
                        }
                      }}
                    >
                      Select All
                    </Checkbox>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                    {customers
                      .filter(c => 
                        c.title.toLowerCase().includes(searchCustomerListQuery.toLowerCase()) ||
                        c.account.includes(searchCustomerListQuery)
                      )
                      .map(c => (
                        <div key={c.account} style={{ padding: '4px 0' }}>
                          <Checkbox
                            checked={selectedCustomerAccounts.includes(c.account)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCustomerAccounts(prev => [...prev, c.account]);
                              } else {
                                setSelectedCustomerAccounts(prev => prev.filter(acc => acc !== c.account));
                              }
                            }}
                          >
                            {c.title} <span style={{ fontSize: 10, color: '#8c8c8c' }}>({c.account})</span>
                          </Checkbox>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button 
                  type="primary" 
                  icon={<PrinterOutlined />} 
                  loading={bulkPrinting} 
                  onClick={handlePrintBulkThermal} 
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  Print Selected Slips
                </Button>
              </Form.Item>
            </div>
          )}

          <Divider style={{ margin: '20px 0' }} />
        </Form>
      </div>

      {billData && printMode === 'single' && (
        hasVariablePackFeature ? (
          <WandaBillReportView 
            currentOrgName={currentOrgName}
            selectedCustomer={selectedCustomer}
            dateRange={form.getFieldValue('dateRange')}
            billData={billData}
          />
        ) : (
          <StandardBillReportView 
            currentOrgName={currentOrgName}
            selectedCustomer={selectedCustomer}
            dateRange={form.getFieldValue('dateRange')}
            billData={billData}
          />
        )
      )}
    </Card>
  );
};
