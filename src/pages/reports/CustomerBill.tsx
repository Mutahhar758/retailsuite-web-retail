import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Tooltip, Segmented, Switch,
  Checkbox, Input
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ReloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  FileExcelOutlined, FileTextOutlined, ExportOutlined,
  ThunderboltOutlined, QrcodeOutlined, FilePdfOutlined,
  UserOutlined, TeamOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type CustomerBillResponse } from '../../services/reportService';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';
import api from '../../services/api';
import { useAppStore } from '../../stores/useAppStore';
import {
  useSettingsStore,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT,
  BILL_QR_ENABLED_KEY,
  BILL_QR_ACCOUNT_TITLE,
  BILL_QR_ACCOUNT_NUMBER,
  BILL_QR_BANK_NAME
} from '../../stores/useSettingsStore';
import { useLocation } from 'react-router-dom';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const CustomerBill: React.FC = () => {
  const location = useLocation();
  const [form] = Form.useForm();
  
  // UI & Mode State
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Single Mode Data
  const [customers, setCustomers] = useState<{ account: string; title: string }[]>([]);
  const [billData, setBillData] = useState<CustomerBillResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ account: string; title: string } | null>(null);

  // Bulk Mode Data
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [selectedSupplyOrderId, setSelectedSupplyOrderId] = useState<number | 'all' | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedBulkAccounts, setSelectedBulkAccounts] = useState<string[]>([]);
  const [onlyWithActivity, setOnlyWithActivity] = useState<boolean>(true);
  const [batchCompiledCount, setBatchCompiledCount] = useState<number | null>(null);

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

  // Load Customers & Supply Orders
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
          dateBasis: 'ClearingDate',
          layout: 'A4'
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

    supplyOrderService.getList().then(async orders => {
      if (!orders || orders.length === 0) {
        setSupplyOrders([]);
        return;
      }
      setSupplyOrders(orders);

      // If the backend list endpoint didn't include details, fetch them in parallel
      const hasDetails = orders.some(o => o.details && o.details.length > 0);
      if (!hasDetails) {
        const detailed = await Promise.all(
          orders.map(async (so) => {
            try {
              const full = await supplyOrderService.getById(so.id);
              return full || so;
            } catch {
              return so;
            }
          })
        );
        setSupplyOrders(detailed);
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

  // Cleanup blob URL and any injected print styles
  useEffect(() => {
    const cleanupStyles = () => {
      const el1 = document.getElementById('thermal-page-print-rules');
      if (el1) el1.remove();
      const el2 = document.getElementById('report-page-print-rules');
      if (el2) el2.remove();
    };
    cleanupStyles();

    return () => {
      cleanupStyles();
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [layout, pdfBlobUrl]);

  // Quick Presets Handler
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

    if (mode === 'single' && form.getFieldValue('account')) {
      fetchBillDataAndPdf({
        dateRange: [from, to],
        account: form.getFieldValue('account'),
        dateBasis: form.getFieldValue('dateBasis')
      });
    } else if (mode === 'bulk' && selectedBulkAccounts.length > 0) {
      fetchBulkBatchPdf({
        dateRange: [from, to],
        dateBasis: form.getFieldValue('dateBasis')
      });
    }
  };

  // Layout switcher
  const handleLayoutChange = (newLayout: 'A4' | 'Thermal') => {
    setLayout(newLayout);
    form.setFieldsValue({ layout: newLayout });
    if (mode === 'single') {
      if (form.getFieldValue('account')) {
        fetchBillDataAndPdf({ layout: newLayout });
      }
    } else {
      if (selectedBulkAccounts.length > 0) {
        fetchBulkBatchPdf({ layout: newLayout });
      }
    }
  };

  const handleQrToggle = (checked: boolean) => {
    setQrEnabled(checked);
    if (mode === 'single' && form.getFieldValue('account')) {
      fetchBillDataAndPdf({ qrEnabled: checked });
    } else if (mode === 'bulk' && selectedBulkAccounts.length > 0) {
      fetchBulkBatchPdf({ qrEnabled: checked });
    }
  };

  // Switch between Single Mode and Bulk Mode
  const handleModeChange = (newMode: 'single' | 'bulk') => {
    setMode(newMode);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setBillData(null);
    setBatchCompiledCount(null);
  };

  // ==========================================
  // Single Customer Bill Generation
  // ==========================================
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

  // ==========================================
  // Bulk Batch Customer Bills Generation
  // ==========================================
  const fetchBulkBatchPdf = async (values?: any) => {
    const fValues = { ...form.getFieldsValue(), ...values };
    if (selectedBulkAccounts.length === 0) {
      message.warning('Please select at least one customer for bulk batch generation');
      return;
    }
    if (!fValues.dateRange || fValues.dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = fValues.dateRange[0].format('YYYY-MM-DD');
    const toDate = fValues.dateRange[1].format('YYYY-MM-DD');
    const dateBasis = fValues.dateBasis || 'ClearingDate';
    const targetLayout = fValues.layout || layout || 'A4';
    const isQrOn = fValues.qrEnabled !== undefined ? fValues.qrEnabled : qrEnabled;

    setLoading(true);
    setPdfLoading(true);

    try {
      const store = useSettingsStore.getState();
      const qrAccountTitle = store.getSetting(BILL_QR_ACCOUNT_TITLE, '');
      const qrAccountNumber = store.getSetting(BILL_QR_ACCOUNT_NUMBER, '');
      const qrBankName = store.getSetting(BILL_QR_BANK_NAME, '');
      const thankyouLine = store.getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);

      const blob = await reportService.getCustomerBillBatchPdf({
        fromDate,
        toDate,
        accounts: selectedBulkAccounts,
        dateBasis,
        layout: targetLayout,
        qrEnabled: isQrOn,
        qrAccountTitle,
        qrAccountNumber,
        qrBankName,
        thankyouLine,
        onlyWithActivity
      });

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(newBlobUrl);
      setBatchCompiledCount(selectedBulkAccounts.length);
      message.success(`Batch bills compiled for ${selectedBulkAccounts.length} selected customers!`);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to compile bulk customer bills');
    } finally {
      setLoading(false);
      setPdfLoading(false);
    }
  };

  // Bulk Supply Order Profile Filter Handler
  const handleSupplyOrderFilter = async (val: number | 'all') => {
    setSelectedSupplyOrderId(val);
    if (val === 'all') {
      setSelectedBulkAccounts(customers.map(c => c.account));
    } else {
      let order = supplyOrders.find(o => o.id === val);
      if (!order?.details || order.details.length === 0) {
        try {
          const fetched = await supplyOrderService.getById(val);
          if (fetched) {
            order = fetched;
            setSupplyOrders(prev => prev.map(o => o.id === val ? fetched : o));
          }
        } catch (err) {
          console.error('Failed to fetch supply order profile details', err);
        }
      }

      if (order && order.details && order.details.length > 0) {
        const orderAccountIds = order.details
          .map(d => d.customerId?.trim())
          .filter((id): id is string => Boolean(id));
        setSelectedBulkAccounts(orderAccountIds);
      } else {
        setSelectedBulkAccounts([]);
      }
    }
  };

  // Filtered customer list based on search
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.account.toLowerCase().includes(q);
  });

  const handleSelectAllFiltered = () => {
    const combined = Array.from(new Set([...selectedBulkAccounts, ...filteredCustomers.map(c => c.account)]));
    setSelectedBulkAccounts(combined);
  };

  const handleClearAllSelected = () => {
    setSelectedBulkAccounts([]);
  };

  // ==========================================
  // Printing & Exports
  // ==========================================
  const handlePrint = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the bill first');
      return;
    }

    const old1 = document.getElementById('thermal-page-print-rules');
    if (old1) old1.remove();
    const old2 = document.getElementById('report-page-print-rules');
    if (old2) old2.remove();

    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        console.warn('Iframe print error, falling back to new window:', e);
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

    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    if (mode === 'single') {
      const acc = form.getFieldValue('account') || 'Bill';
      link.download = `CustomerBill_${acc}_${fromStr}_${toStr}.pdf`;
    } else {
      link.download = `CustomerBillBatch_${selectedBulkAccounts.length}Cust_${fromStr}_${toStr}.pdf`;
    }
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

  // Export to Excel (.xls) for Single Mode
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

  // Export to CSV for Single Mode
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

  const leftPanelWidth = isPanelCollapsed ? 48 : (mode === 'bulk' ? 360 : 320);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', height: 'calc(100vh - 180px)', width: '100%' }}>
      {/* Left Parameters Panel */}
      <Card
        style={{
          width: leftPanelWidth,
          minWidth: leftPanelWidth,
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
            <Tooltip title={mode === 'single' ? 'Regenerate Bill' : 'Regenerate Batch'} placement="right">
              <Button
                type="primary"
                shape="circle"
                icon={<ReloadOutlined />}
                loading={loading || pdfLoading}
                onClick={() => (mode === 'single' ? fetchBillDataAndPdf() : fetchBulkBatchPdf())}
              />
            </Tooltip>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header & Mode Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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

            {/* Mode Switcher matching Desktop Form */}
            <Segmented
              block
              value={mode}
              onChange={(val) => handleModeChange(val as 'single' | 'bulk')}
              options={[
                { label: 'Single Customer', value: 'single', icon: <UserOutlined /> },
                { label: 'Bulk Batch', value: 'bulk', icon: <TeamOutlined /> }
              ]}
              style={{ marginBottom: 14, backgroundColor: '#f1f5f9', fontWeight: 500 }}
            />

            {/* Quick Date Presets */}
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
              onFinish={() => (mode === 'single' ? fetchBillDataAndPdf() : fetchBulkBatchPdf())}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {/* Single Mode: Customer Picker */}
              {mode === 'single' && (
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
              )}

              {/* Bulk Mode: Supply Order Profile Filter & Customer Multi-select Checklist */}
              {mode === 'bulk' && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <ShoppingCartOutlined style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Filter by Supply Order Profile</span>
                  </div>
                  <Select
                    style={{ width: '100%', marginBottom: 8 }}
                    size="small"
                    placeholder="--- Select Supply Profile ---"
                    allowClear
                    value={selectedSupplyOrderId}
                    onChange={(val) => handleSupplyOrderFilter(val || 'all')}
                    options={[
                      { label: '--- All Customers ---', value: 'all' },
                      ...supplyOrders.map(so => ({
                        label: `SO-${so.id}: ${so.title} (${so.details?.length || 0} cust)`,
                        value: so.id
                      }))
                    ]}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                      Select Customers ({selectedBulkAccounts.length}/{customers.length}):
                    </span>
                    <Space size={4}>
                      <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }} onClick={handleSelectAllFiltered}>
                        Select All
                      </Button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }} onClick={handleClearAllSelected}>
                        Clear
                      </Button>
                    </Space>
                  </div>

                  <Input
                    size="small"
                    placeholder="Search customers..."
                    prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    style={{ marginBottom: 6 }}
                  />

                  {/* Scrollable Customer Checklist */}
                  <div style={{
                    maxHeight: 140,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    background: '#ffffff',
                    padding: '4px 8px'
                  }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#94a3b8', padding: '6px 0', textAlign: 'center' }}>
                        No customers found
                      </div>
                    ) : (
                      filteredCustomers.map(c => {
                        const isChecked = selectedBulkAccounts.includes(c.account);
                        return (
                          <div key={c.account} style={{ padding: '2px 0' }}>
                            <Checkbox
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedBulkAccounts(prev => [...prev, c.account]);
                                } else {
                                  setSelectedBulkAccounts(prev => prev.filter(a => a !== c.account));
                                }
                              }}
                            >
                              <span style={{ fontSize: 11.5, color: isChecked ? '#0f172a' : '#475569', fontWeight: isChecked ? 600 : 400 }}>
                                {c.title}
                              </span>
                            </Checkbox>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Date Range Picker */}
              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Range</span>}
                name="dateRange"
                rules={[{ required: true, message: 'Please select dates' }]}
                style={{ marginBottom: 14 }}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  format="DD-MMM-YYYY"
                  presets={rangePresets}
                />
              </Form.Item>

              {/* Date Basis */}
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

              {/* Bill Format / Layout */}
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

              {/* Bulk Mode Option: Skip Inactive Accounts */}
              {mode === 'bulk' && (
                <div style={{ marginBottom: 14 }}>
                  <Checkbox
                    checked={onlyWithActivity}
                    onChange={e => setOnlyWithActivity(e.target.checked)}
                  >
                    <span style={{ fontSize: 12, color: '#475569' }}>
                      Skip zero balance & no activity accounts
                    </span>
                  </Checkbox>
                </div>
              )}

              {/* Raast QR Code Embed Option */}
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
                  icon={mode === 'single' ? <SearchOutlined /> : <TeamOutlined />}
                  loading={loading || pdfLoading}
                  block
                  style={{ height: 38, fontWeight: 500 }}
                >
                  {mode === 'single' ? 'Generate Bill' : `Generate Batch Bills (${selectedBulkAccounts.length})`}
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
                {mode === 'single' ? 'Customer Bill & Statement' : 'Bulk Batch Customer Bills'}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {mode === 'single'
                  ? (selectedCustomer ? selectedCustomer.title : 'Select a customer to generate bill')
                  : (batchCompiledCount !== null
                      ? `Batch Compiled: ${batchCompiledCount} Customer(s) selected • ${onlyWithActivity ? 'Active accounts with transactions or balances included' : 'All accounts included'}`
                      : 'Select customers on the left and click Generate Batch Bills')
                }
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

            {mode === 'single' && (
              <>
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
              </>
            )}
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
          position: 'relative',
          padding: layout === 'Thermal' ? '16px 0' : 0
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
              <Text style={{ color: '#ffffff', fontSize: 14 }}>
                {mode === 'single' ? 'Generating Vector PDF Bill...' : 'Compiling Multi-Customer Batch PDF Bills...'}
              </Text>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              key={`${mode}-${layout}`}
              ref={iframeRef}
              src={layout === 'Thermal' ? `${pdfBlobUrl}#view=Fit` : `${pdfBlobUrl}#view=FitH`}
              title="Customer Bill Preview"
              style={{
                width: layout === 'Thermal' ? '380px' : '100%',
                maxWidth: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                boxShadow: layout === 'Thermal' ? '0 4px 20px rgba(0,0,0,0.35)' : 'none',
                borderRadius: layout === 'Thermal' ? 4 : 0
              }}
            />
          ) : (
            <div style={{ backgroundColor: '#ffffff', padding: 40, borderRadius: 8, textAlign: 'center' }}>
              <Empty
                description={
                  mode === 'single'
                    ? "Please select a customer on the left and click 'Generate Bill'."
                    : "Please select customer accounts on the left and click 'Generate Batch Bills'."
                }
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CustomerBill;
