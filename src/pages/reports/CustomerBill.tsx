import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Tooltip, Segmented, Switch
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ReloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  FileExcelOutlined, FileTextOutlined, ExportOutlined,
  ThunderboltOutlined, QrcodeOutlined, FilePdfOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type CustomerBillResponse } from '../../services/reportService';
import api from '../../services/api';
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
import {
  useSettingsStore,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT,
  BILL_QR_ENABLED_KEY,
  BILL_QR_ACCOUNT_TITLE,
  BILL_QR_ACCOUNT_NUMBER,
  BILL_QR_BANK_NAME,
  BILL_QR_INCLUDE_AMOUNT
} from '../../stores/useSettingsStore';
import { useLocation } from 'react-router-dom';
import { buildEmvCoPayload } from '../../utils/emvcoQr';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Thermal printing ESC/POS generator function for Standard Customer Bill
const generateStandardThermalLines = (
  orgName: string,
  customerTitle: string,
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

  // QR Payment
  const store = useSettingsStore.getState();
  const qrEnabled = store.getSetting(BILL_QR_ENABLED_KEY, 'false') === 'true';
  const qrAccountTitle = store.getSetting(BILL_QR_ACCOUNT_TITLE, '');
  const qrAccountNum   = store.getSetting(BILL_QR_ACCOUNT_NUMBER, '');
  const qrBankName     = store.getSetting(BILL_QR_BANK_NAME, '');
  const qrIncludeAmount = store.getSetting(BILL_QR_INCLUDE_AMOUNT, 'false') === 'true';
  if (qrEnabled && qrAccountNum.trim() && data.summary.balance > 0) {
    const netBal = data.summary.balance;
    const amt = (qrIncludeAmount && netBal > 0) ? netBal : 0;
    const payload = buildEmvCoPayload(qrAccountTitle, qrAccountNum, amt, qrBankName);
    lines.push(ESC_ALIGN_CENTER);
    lines.push(divider('-', width));
    lines.push('SCAN TO PAY (RAAST / IBFT)');
    if (qrBankName) lines.push(qrBankName);
    const enc = new TextEncoder();
    const payloadBytes = enc.encode(payload);
    const pL = payloadBytes.length & 0xff;
    const pH = (payloadBytes.length >> 8) & 0xff;
    const qrCmd = [
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04,
      0x1d, 0x28, 0x6b, pL + 3, pH, 0x31, 0x50, 0x30, ...Array.from(payloadBytes),
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30
    ];
    lines.push(String.fromCharCode(...qrCmd));
    lines.push(ESC_ALIGN_LEFT);
  }

  lines.push(ESC_ALIGN_LEFT);
  lines.push('');
  lines.push('\n\n\n\x1d\x56\x00'); // Cut

  return lines;
};

export const CustomerBill: React.FC = () => {
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [customers, setCustomers] = useState<{ account: string; title: string }[]>([]);
  const [billData, setBillData] = useState<CustomerBillResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ account: string; title: string } | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Suite';

  const [layout, setLayout] = useState<'A4' | 'Thermal'>('A4');
  const [qrEnabled, setQrEnabled] = useState<boolean>(true);
  const { getSetting, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const storeSetting = getSetting(BILL_QR_ENABLED_KEY, 'false') === 'true';
    const hasAcc = !!getSetting(BILL_QR_ACCOUNT_NUMBER, '');
    setQrEnabled(storeSetting || hasAcc);
  }, [getSetting]);

  // Load customers
  useEffect(() => {
    api.get('/api/customers').then(res => {
      const cusList = res.data.body || [];
      setCustomers(cusList);

      const state = location.state as { customerId?: string; fromDate?: string; toDate?: string } | null;
      if (state && state.customerId) {
        const fromD = state.fromDate ? dayjs(state.fromDate) : dayjs().startOf('month');
        const toD = state.toDate ? dayjs(state.toDate) : dayjs();
        form.setFieldsValue({
          account: state.customerId,
          dateRange: [fromD, toD],
          dateBasis: 'ClearingDate'
        });
        const matchedCus = cusList.find((c: any) => c.account === state.customerId);
        if (matchedCus) setSelectedCustomer(matchedCus);

        fetchBillDataAndPdf({
          account: state.customerId,
          dateRange: [fromD, toD],
          dateBasis: 'ClearingDate'
        });
      }
    }).catch(console.error);
  }, [location.state]);

  // Default dates and layout
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      dateBasis: 'ClearingDate',
      layout: 'A4'
    });
  }, [form]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleQuickPreset = (preset: '1-10' | '1-15' | '1-20' | 'month' | 'last-month') => {
    let from = dayjs().startOf('month');
    let to = dayjs();

    if (preset === '1-10') {
      from = dayjs().startOf('month');
      to = dayjs().date(10);
    } else if (preset === '1-15') {
      from = dayjs().startOf('month');
      to = dayjs().date(15);
    } else if (preset === '1-20') {
      from = dayjs().startOf('month');
      to = dayjs().date(20);
    } else if (preset === 'month') {
      from = dayjs().startOf('month');
      to = dayjs().endOf('month');
    } else if (preset === 'last-month') {
      from = dayjs().subtract(1, 'month').startOf('month');
      to = dayjs().subtract(1, 'month').endOf('month');
    }

    form.setFieldsValue({ dateRange: [from, to] });
    if (form.getFieldValue('account')) {
      fetchBillDataAndPdf({
        dateRange: [from, to],
        account: form.getFieldValue('account'),
        dateBasis: form.getFieldValue('dateBasis')
      });
    }
  };

  const handleLayoutChange = (newLayout: 'A4' | 'Thermal') => {
    setLayout(newLayout);
    form.setFieldsValue({ layout: newLayout });
    if (form.getFieldValue('account')) {
      fetchBillDataAndPdf({ layout: newLayout });
    }
  };

  const handleQrToggle = (checked: boolean) => {
    setQrEnabled(checked);
    if (form.getFieldValue('account')) {
      fetchBillDataAndPdf({ qrEnabled: checked });
    }
  };

  const fetchBillDataAndPdf = async (values?: any) => {
    const fValues = { ...form.getFieldsValue(), ...values };
    if (!fValues.account) {
      message.warning('Please select a customer account');
      return;
    }
    if (!fValues.dateRange || fValues.dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = fValues.dateRange[0].format('YYYY-MM-DD');
    const toDate = fValues.dateRange[1].format('YYYY-MM-DD');
    const account = fValues.account;
    const dateBasis = fValues.dateBasis || 'ClearingDate';
    const targetLayout = fValues.layout || layout || 'A4';
    const isQrOn = fValues.qrEnabled !== undefined ? fValues.qrEnabled : qrEnabled;

    const matched = customers.find(c => c.account === account);
    if (matched) setSelectedCustomer(matched);

    setLoading(true);
    setPdfLoading(true);

    try {
      const store = useSettingsStore.getState();
      const qrAccountTitle = store.getSetting(BILL_QR_ACCOUNT_TITLE, '');
      const qrAccountNumber = store.getSetting(BILL_QR_ACCOUNT_NUMBER, '');
      const qrBankName = store.getSetting(BILL_QR_BANK_NAME, '');
      const thankyouLine = store.getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);

      const [dataRes, blob] = await Promise.all([
        reportService.getCustomerBill({ fromDate, toDate, account, dateBasis }),
        reportService.getCustomerBillPdf({
          fromDate,
          toDate,
          account,
          dateBasis,
          layout: targetLayout,
          qrEnabled: isQrOn,
          qrAccountTitle,
          qrAccountNumber,
          qrBankName,
          thankyouLine
        })
      ]);

      setBillData(dataRes);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(newBlobUrl);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to generate Customer Bill');
    } finally {
      setLoading(false);
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the bill first');
      return;
    }
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // Fallback below
      }
    }
    window.open(pdfBlobUrl, '_blank');
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the bill first');
      return;
    }
    const dates = form.getFieldValue('dateRange');
    const fromStr = dates?.[0]?.format('YYYYMMDD') || 'From';
    const toStr = dates?.[1]?.format('YYYYMMDD') || 'To';
    const acc = form.getFieldValue('account') || 'Bill';
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `CustomerBill_${acc}_${fromStr}_${toStr}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the bill first');
      return;
    }
    window.open(pdfBlobUrl, '_blank');
  };

  // Export to Excel (.xls)
  const handleExportExcel = () => {
    if (!billData || !billData.lines) {
      message.warning('No bill data available to export');
      return;
    }

    const dates = form.getFieldValue('dateRange');
    const fromStr = dates?.[0]?.format('DD-MMM-YYYY') || '';
    const toStr = dates?.[1]?.format('DD-MMM-YYYY') || '';
    const custTitle = selectedCustomer?.title || form.getFieldValue('account');

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          th { background-color: #f3f4f6; color: #111827; font-weight: bold; font-size: 11pt; border: 0.5pt solid #d1d5db; padding: 6px; }
          td { border: 0.5pt solid #e5e7eb; padding: 5px; font-size: 10pt; }
          .num { mso-number-format:"\\#\\,\\#\\#0\\.00"; text-align: right; }
          .bold { font-weight: bold; background-color: #f9fafb; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <div style="font-size: 16pt; font-weight: bold; margin-bottom: 4px;">${currentOrgName}</div>
        <div style="font-size: 12pt; font-weight: bold; margin-bottom: 4px;">CUSTOMER STATEMENT / BILL</div>
        <div style="font-size: 11pt; margin-bottom: 8px;">Customer: ${custTitle} | Period: ${fromStr} to ${toStr}</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher</th>
              <th>Item Description</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
    `;

    let totalQty = 0;
    let totalAmt = 0;

    billData.lines.forEach(l => {
      totalQty += l.qty;
      totalAmt += l.amount;
      tableHtml += `
        <tr>
          <td>${dayjs(l.date).format('DD-MMM-YYYY')}</td>
          <td>${l.vNo}</td>
          <td>${l.item}</td>
          <td class="center">${l.unitTitle || ''}</td>
          <td class="num">${l.qty}</td>
          <td class="num">${l.rate}</td>
          <td class="num">${l.amount}</td>
        </tr>
      `;
    });

    tableHtml += `
        <tr class="bold">
          <td colspan="4"><strong>Total (${billData.lines.length} Items)</strong></td>
          <td class="num"><strong>${totalQty}</strong></td>
          <td></td>
          <td class="num"><strong>${totalAmt}</strong></td>
        </tr>
        <tr><td colspan="7"></td></tr>
        <tr class="bold"><td colspan="6">Previous Balance:</td><td class="num"><strong>${billData.summary.previousBalance}</strong></td></tr>
        <tr class="bold"><td colspan="6">(+) Current Billing:</td><td class="num"><strong>${totalAmt}</strong></td></tr>
        <tr class="bold"><td colspan="6">(-) Payments Received:</td><td class="num"><strong>${billData.summary.payment}</strong></td></tr>
        <tr class="bold"><td colspan="6">Net Balance Due:</td><td class="num"><strong>${billData.summary.balance}</strong></td></tr>
      </tbody>
    </table>
    </body>
    </html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CustomerBill_${form.getFieldValue('account')}_${dates?.[0]?.format('YYYYMMDD') || ''}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Excel file exported successfully');
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!billData || !billData.lines) {
      message.warning('No bill data available to export');
      return;
    }

    const headers = ['Date', 'Voucher', 'Item Description', 'Unit', 'Quantity', 'Rate', 'Amount'];
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const rows = billData.lines.map(l => [
      escapeCsv(dayjs(l.date).format('DD-MMM-YYYY')),
      escapeCsv(l.vNo),
      escapeCsv(l.item),
      escapeCsv(l.unitTitle || ''),
      l.qty,
      l.rate,
      l.amount
    ].join(','));

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dates = form.getFieldValue('dateRange');
    link.download = `CustomerBill_${form.getFieldValue('account')}_${dates?.[0]?.format('YYYYMMDD') || ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('CSV file exported successfully');
  };

  // Thermal Print (80mm)
  const handlePrintThermal = async () => {
    if (!billData) {
      message.warning('No bill data to print');
      return;
    }

    setThermalPrinting(true);
    try {
      const dates = form.getFieldValue('dateRange');
      const fromStr = dates ? dates[0].format('DD-MMM-YYYY') : '';
      const toStr = dates ? dates[1].format('DD-MMM-YYYY') : '';
      const custTitle = selectedCustomer?.title || 'Customer';
      const lines = generateStandardThermalLines(
        currentOrgName,
        custTitle,
        fromStr,
        toStr,
        billData
      );

      const savedMethod = (localStorage.getItem('pos_printer_method') || 'LOCAL_RELAY') as ConnectionMethod;
      const savedPrinter = localStorage.getItem('pos_printer_name') || 'XP-80';

      await printDirect(lines, savedMethod, { printerName: savedPrinter });
      message.success('Bill receipt sent to printer');
    } catch (err) {
      console.error(err);
      message.error('Thermal printing failed');
    } finally {
      setThermalPrinting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', height: 'calc(100vh - 180px)', width: '100%' }}>
      {/* Left Parameters Panel */}
      <Card
        style={{
          width: isPanelCollapsed ? 48 : 320,
          minWidth: isPanelCollapsed ? 48 : 320,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          padding: 0
        }}
        bodyStyle={{
          padding: isPanelCollapsed ? '12px 8px' : '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowY: isPanelCollapsed ? 'hidden' : 'auto'
        }}
      >
        {isPanelCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Tooltip title="Expand Parameters" placement="right">
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setIsPanelCollapsed(false)}
              />
            </Tooltip>
            <Tooltip title="Regenerate Bill" placement="right">
              <Button
                type="primary"
                shape="circle"
                icon={<ReloadOutlined />}
                loading={loading || pdfLoading}
                onClick={() => fetchBillDataAndPdf()}
              />
            </Tooltip>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Parameters
              </Title>
              <Tooltip title="Collapse Panel">
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setIsPanelCollapsed(true)}
                />
              </Tooltip>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: 14 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                Quick Presets:
              </Text>
              <Space wrap size={[4, 6]}>
                <Button size="small" onClick={() => handleQuickPreset('1-10')}>1-10</Button>
                <Button size="small" onClick={() => handleQuickPreset('1-15')}>1-15</Button>
                <Button size="small" onClick={() => handleQuickPreset('1-20')}>1-20</Button>
                <Button size="small" onClick={() => handleQuickPreset('month')}>Month</Button>
                <Button size="small" onClick={() => handleQuickPreset('last-month')}>Prev Month</Button>
              </Space>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={() => fetchBillDataAndPdf()}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Customer Account</span>}
                name="account"
                rules={[{ required: true, message: 'Please select a customer' }]}
                style={{ marginBottom: 14 }}
              >
                <Select
                  showSearch
                  placeholder="Select Customer..."
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map(c => ({
                    label: c.title,
                    value: c.account
                  }))}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Range</span>}
                name="dateRange"
                rules={[{ required: true, message: 'Please select dates' }]}
                style={{ marginBottom: 14 }}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Basis</span>}
                name="dateBasis"
                style={{ marginBottom: 14 }}
              >
                <Select
                  options={[
                    { label: 'Clearing Date (Recommended)', value: 'ClearingDate' },
                    { label: 'Voucher Date', value: 'VoucherDate' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Bill Format / Layout</span>}
                name="layout"
                initialValue="A4"
                style={{ marginBottom: 14 }}
              >
                <Select
                  value={layout}
                  onChange={handleLayoutChange}
                  options={[
                    { label: 'A4 Sheet (Laser / Standard)', value: 'A4' },
                    { label: '80mm Thermal Receipt (POS Roll)', value: 'Thermal' }
                  ]}
                />
              </Form.Item>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={6}>
                    <QrcodeOutlined style={{ color: qrEnabled ? '#1677ff' : '#8c8c8c', fontSize: 15 }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Raast QR Code Payment</span>
                  </Space>
                  <Switch
                    size="small"
                    checked={qrEnabled}
                    onChange={handleQrToggle}
                  />
                </div>
                {qrEnabled && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                    {getSetting(BILL_QR_BANK_NAME) ? (
                      <div>{getSetting(BILL_QR_BANK_NAME)} - {getSetting(BILL_QR_ACCOUNT_TITLE)}</div>
                    ) : (
                      <div>EMVCo / SBP Raast QR Code will be embedded</div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading || pdfLoading}
                  block
                  style={{ height: 38, fontWeight: 500 }}
                >
                  Generate Bill
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Card>

      {/* Right Vector PDF Canvas & Action Toolbar */}
      <Card
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
        bodyStyle={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Top Control Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 12,
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Customer Bill & Statement
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedCustomer ? selectedCustomer.title : 'Select a customer to generate bill'}
              </Text>
            </div>

            {/* Live Layout Switcher matching Desktop */}
            <Segmented
              value={layout}
              onChange={(val) => handleLayoutChange(val as 'A4' | 'Thermal')}
              options={[
                { label: 'A4 Sheet', value: 'A4', icon: <FilePdfOutlined /> },
                { label: '80mm Thermal', value: 'Thermal', icon: <ThunderboltOutlined /> }
              ]}
              style={{ backgroundColor: '#f1f5f9', fontWeight: 500 }}
            />
          </div>

          <Space wrap size={8}>
            <Tooltip title="Print Document">
              <Button
                icon={<PrinterOutlined />}
                disabled={!pdfBlobUrl || pdfLoading}
                onClick={handlePrint}
              >
                Print
              </Button>
            </Tooltip>

            <Tooltip title="Download PDF File">
              <Button
                icon={<DownloadOutlined />}
                disabled={!pdfBlobUrl || pdfLoading}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            </Tooltip>

            <Tooltip title="Open in New Tab">
              <Button
                icon={<ExportOutlined />}
                disabled={!pdfBlobUrl || pdfLoading}
                onClick={handleOpenInNewTab}
              />
            </Tooltip>

            <Tooltip title="Export to Excel (.xls)">
              <Button
                icon={<FileExcelOutlined style={{ color: '#107c41' }} />}
                disabled={!billData || billData.lines.length === 0}
                onClick={handleExportExcel}
              >
                Excel
              </Button>
            </Tooltip>

            <Tooltip title="Export to CSV">
              <Button
                icon={<FileTextOutlined />}
                disabled={!billData || billData.lines.length === 0}
                onClick={handleExportCsv}
              >
                CSV
              </Button>
            </Tooltip>

            <Tooltip title="Print to 80mm Thermal Receipt Printer">
              <Button
                icon={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
                loading={thermalPrinting}
                disabled={!billData || billData.lines.length === 0}
                onClick={handlePrintThermal}
              >
                Thermal
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* Vector PDF Display */}
        <div style={{
          flex: 1,
          width: '100%',
          backgroundColor: '#525659',
          borderRadius: 6,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {pdfLoading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: '#ffffff'
            }}>
              <Spin size="large" />
              <Text style={{ color: '#ffffff', fontSize: 14 }}>Generating Vector PDF Bill...</Text>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              ref={iframeRef}
              src={`${pdfBlobUrl}#view=FitH`}
              title="Customer Bill Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
            />
          ) : (
            <div style={{ backgroundColor: '#ffffff', padding: 40, borderRadius: 8 }}>
              <Empty description="Please select a customer on the left and click 'Generate Bill'." />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CustomerBill;
