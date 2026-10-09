import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Divider,
  Segmented,
  Tooltip,
  Radio,
  Checkbox,
  Input,
  message,
  Modal,
  Progress,
} from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  ExportOutlined,
  SearchOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  QrcodeOutlined,
  TeamOutlined,
  UserOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { reportService, type CustomerBillResponse } from '../../services/reportService';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, BILL_QR_ENABLED_KEY, BILL_QR_ACCOUNT_NUMBER, TRANSACTION_ENABLE_CARRIAGE_KEY, BILL_DEFAULT_FORMAT_KEY } from '../../stores/useSettingsStore';
import { rangePresets } from '../../utils/datePresets';
import { printPdfViaBridge, blobToBase64 } from '../../hooks/useThermalPrinter';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface CustomerOption {
  account: string;
  title: string;
  phone?: string;
  address?: string;
}

export const WandaCustomerBill: React.FC = () => {
  const location = useLocation();
  const [form] = Form.useForm();
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  const [loading, setLoading] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [billData, setBillData] = useState<CustomerBillResponse | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedBulkAccounts, setSelectedBulkAccounts] = useState<string[]>([]);
  const [onlyWithActivity, setOnlyWithActivity] = useState<boolean>(true);
  const [batchCompiledCount, setBatchCompiledCount] = useState<number | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Suite';

  const [layout, setLayout] = useState<'A4' | 'Thermal'>('A4');
  const [layoutUserSelected, setLayoutUserSelected] = useState<boolean>(false);
  const [qrEnabled, setQrEnabled] = useState<boolean>(true);
  const { settings, initialized, getSetting, fetchSettings } = useSettingsStore();

  const [bridgePrinting, setBridgePrinting] = useState<boolean>(false);
  const [bulkBridgePrinting, setBulkBridgePrinting] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; customerName: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!layoutUserSelected) {
      const defaultFmt = getSetting(BILL_DEFAULT_FORMAT_KEY, '');
      if (defaultFmt) {
        const isThermal = defaultFmt.toLowerCase().includes('thermal');
        const resolved = isThermal ? 'Thermal' : 'A4';
        setLayout(resolved);
        form.setFieldsValue({ layout: resolved });
      }
    }
  }, [initialized, settings, getSetting, layoutUserSelected, form]);

  useEffect(() => {
    if (!initialized) return;
    const storeSetting = getSetting(BILL_QR_ENABLED_KEY, 'false') === 'true';
    const hasAcc = !!getSetting(BILL_QR_ACCOUNT_NUMBER, '');
    setQrEnabled(storeSetting || hasAcc);
  }, [initialized, settings, getSetting]);

  // Load Customers
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

  // Default dates
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      dateBasis: 'ClearingDate'
    });
  }, [form]);

  // Fetch Wanda bill data and PDF for single customer
  const fetchBillDataAndPdf = async (valuesOverride?: any) => {
    const fValues = valuesOverride || form.getFieldsValue();
    const { account, dateRange, dateBasis = 'ClearingDate' } = fValues;

    if (!account) {
      message.warning('Please select a customer account first');
      return;
    }

    if (!dateRange || dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = dateRange[0].format('YYYY-MM-DD');
    const toDate = dateRange[1].format('YYYY-MM-DD');
    const targetLayout = layout || fValues.layout || 'A4';
    const isQrOn = fValues.qrEnabled !== undefined ? fValues.qrEnabled : qrEnabled;

    const matched = customers.find(c => c.account === account);
    if (matched) setSelectedCustomer(matched);

    setLoading(true);
    setPdfLoading(true);

    try {
      const [dataRes, blob] = await Promise.all([
        reportService.getCustomerBill({ fromDate, toDate, account, dateBasis }),
        reportService.getCustomerBillPdf({
          fromDate,
          toDate,
          account,
          dateBasis,
          layout: targetLayout,
          qrEnabled: isQrOn,
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
      message.error(err.message || 'Failed to generate Customer Bill');
      setBillData(null);
    } finally {
      setLoading(false);
      setPdfLoading(false);
    }
  };

  // Generate batch bills
  const handleGenerateBatchBills = async () => {
    if (selectedBulkAccounts.length === 0) {
      message.warning('Please select at least one customer account');
      return;
    }

    const fValues = form.getFieldsValue();
    const { dateRange, dateBasis = 'ClearingDate' } = fValues;

    if (!dateRange || dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = dateRange[0].format('YYYY-MM-DD');
    const toDate = dateRange[1].format('YYYY-MM-DD');
    const targetLayout = layout || fValues.layout || 'A4';
    const isQrOn = fValues.qrEnabled !== undefined ? fValues.qrEnabled : qrEnabled;

    setPdfLoading(true);

    try {
      const blob = await reportService.getCustomerBillBatchPdf({
        fromDate,
        toDate,
        accounts: selectedBulkAccounts,
        dateBasis,
        layout: targetLayout,
        qrEnabled: isQrOn,
        onlyWithActivity,
      });

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(newBlobUrl);
      setBatchCompiledCount(selectedBulkAccounts.length);
      message.success(`Generated batch bills for ${selectedBulkAccounts.length} customer(s)`);
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to generate batch customer bills');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleLayoutChange = (newLayout: 'A4' | 'Thermal') => {
    setLayoutUserSelected(true);
    setLayout(newLayout);
    form.setFieldsValue({ layout: newLayout });
    if (mode === 'single' && form.getFieldValue('account')) {
      fetchBillDataAndPdf({ ...form.getFieldsValue(), layout: newLayout });
    } else if (mode === 'batch' && selectedBulkAccounts.length > 0) {
      handleGenerateBatchBills();
    }
  };

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

  // Printing & Exports
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
      } catch (e) {
        console.warn('Iframe print error, falling back to new window:', e);
      }
    }
    window.open(pdfBlobUrl, '_blank');
  };

  const handlePrintBridgeDirect = async () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the bill first');
      return;
    }

    setBridgePrinting(true);
    try {
      const res = await fetch(pdfBlobUrl);
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);

      const result = await printPdfViaBridge(base64, {
        isThermal: layout === 'Thermal',
        scaleFactor: 0.9,
      });

      if (result.success) {
        message.success(result.message || '80mm Thermal Receipt sent directly to printer!');
      } else {
        message.error(result.message || 'PrinterBridge reported an error');
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to print via PrinterBridge');
    } finally {
      setBridgePrinting(false);
    }
  };

  const handleBulkPrintBridgeDirect = async () => {
    if (selectedBulkAccounts.length === 0) {
      message.warning('Please select at least one customer account');
      return;
    }

    const fValues = form.getFieldsValue();
    const { dateRange, dateBasis = 'ClearingDate' } = fValues;

    if (!dateRange || dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = dateRange[0].format('YYYY-MM-DD');
    const toDate = dateRange[1].format('YYYY-MM-DD');
    const isQrOn = fValues.qrEnabled !== undefined ? fValues.qrEnabled : qrEnabled;

    Modal.confirm({
      title: 'Bulk Print to Thermal Printer',
      content: `Are you sure you want to silently print ${selectedBulkAccounts.length} customer bill(s) directly to your thermal printer via PrinterBridge?`,
      okText: 'Start Bulk Print',
      cancelText: 'Cancel',
      onOk: async () => {
        setBulkBridgePrinting(true);
        let printedCount = 0;

        try {
          for (let i = 0; i < selectedBulkAccounts.length; i++) {
            const acc = selectedBulkAccounts[i];
            const cust = customers.find(c => c.account === acc);
            const custTitle = cust?.title || acc;

            setBulkProgress({
              current: i + 1,
              total: selectedBulkAccounts.length,
              customerName: custTitle,
            });

            try {
              const blob = await reportService.getCustomerBillPdf({
                account: acc,
                fromDate,
                toDate,
                dateBasis,
                layout: 'Thermal',
                qrEnabled: isQrOn,
                isWandaLayout: true,
              });

              const base64 = await blobToBase64(blob);
              await printPdfViaBridge(base64, {
                isThermal: true,
                scaleFactor: 0.9,
              });

              printedCount++;
            } catch (err) {
              console.warn(`Failed to print bill for ${acc}:`, err);
            }

            // Pacing delay: 600ms between bills allows thermal cutter to cycle and prevents buffer overflow
            await new Promise(r => setTimeout(r, 600));
          }

          message.success(`Bulk printing complete! ${printedCount} bill(s) printed cleanly.`);
        } catch (err: any) {
          message.error(err.message || 'Bulk printing encountered an error');
        } finally {
          setBulkBridgePrinting(false);
          setBulkProgress(null);
        }
      },
    });
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

  // Export to Excel for Single Mode (11 Wanda Columns)
  const handleExportExcel = () => {
    if (!billData || !billData.lines) {
      message.warning('No bill data available to export');
      return;
    }

    const dates = form.getFieldValue('dateRange');
    const fromStr = dates?.[0]?.format('DD-MMM-YYYY') || '';
    const toStr = dates?.[1]?.format('DD-MMM-YYYY') || '';
    const custTitle = selectedCustomer?.title || form.getFieldValue('account');

    const enableCarriage = billData?.header?.enableCarriage ?? (getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true');
    const colSpan = enableCarriage ? 9 : 8;

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
              <th>Voucher No</th>
              <th>Description</th>
              <th>Weight (Kg)</th>
              <th>Bags</th>
              <th>Kg Rate</th>
              <th>Bag Rate</th>
              ${enableCarriage ? '<th>Carriage</th>' : ''}
              <th>Add/Less</th>
              <th>Amount</th>
              <th>Receipt Date</th>
              <th>Receipt Amount</th>
            </tr>
          </thead>
          <tbody>
    `;

    billData.lines.forEach((l) => {
      tableHtml += `
        <tr>
          <td class="center">${dayjs(l.date).format('DD/MM/YYYY')}</td>
          <td class="center">${l.vNo || ''}</td>
          <td>${l.item || ''}</td>
          <td class="num">${l.qty || ''}</td>
          <td class="num">${l.secQty || ''}</td>
          <td class="num">${l.rate || ''}</td>
          <td class="num">${l.secRate || ''}</td>
          ${enableCarriage ? `<td class="num">${l.carriage || 0}</td>` : ''}
          <td class="num">${l.addLess || ''}</td>
          <td class="num bold">${l.amount || ''}</td>
          <td class="center">${l.receiptDate ? dayjs(l.receiptDate).format('DD/MM/YYYY') : ''}</td>
          <td class="num bold" style="color: #047857;">${l.receiptAmount || ''}</td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
          <tfoot>
            <tr class="bold">
              <td colspan="${colSpan}" style="text-align: right;">Total Current Billed:</td>
              <td class="num">${billData.lines.reduce((acc, l) => acc + (l.amount || 0), 0)}</td>
              <td></td>
              <td class="num">${billData.lines.reduce((acc, l) => acc + (l.receiptAmount || 0), 0)}</td>
            </tr>
            <tr class="bold">
              <td colspan="${colSpan}" style="text-align: right;">Previous Balance (B/F):</td>
              <td class="num">${billData.summary?.previousBalance || 0}</td>
              <td colspan="2"></td>
            </tr>
            <tr class="bold">
              <td colspan="${colSpan}" style="text-align: right;">Total Payments Received:</td>
              <td class="num">(${billData.summary?.payment || 0})</td>
              <td colspan="2"></td>
            </tr>
            <tr class="bold" style="font-size: 11pt;">
              <td colspan="${colSpan}" style="text-align: right;">NET DUE BALANCE:</td>
              <td class="num" style="color: #b91c1c;">${billData.summary?.balance || 0}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CustomerBill_${form.getFieldValue('account')}_${dayjs().format('YYYYMMDD')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to CSV for Single Mode
  const handleExportCsv = () => {
    if (!billData || !billData.lines) {
      message.warning('No bill data available to export');
      return;
    }

    const enableCarriage = billData?.header?.enableCarriage ?? (getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true');
    const headers = enableCarriage
      ? ['Date', 'VoucherNo', 'Description', 'Weight(Kg)', 'Bags', 'KgRate', 'BagRate', 'Carriage', 'AddLess', 'Amount', 'ReceiptDate', 'ReceiptAmount']
      : ['Date', 'VoucherNo', 'Description', 'Weight(Kg)', 'Bags', 'KgRate', 'BagRate', 'AddLess', 'Amount', 'ReceiptDate', 'ReceiptAmount'];

    const rows = billData.lines.map(l => {
      const baseRow: (string | number)[] = [
        `"${dayjs(l.date).format('YYYY-MM-DD')}"`,
        `"${l.vNo || ''}"`,
        `"${(l.item || '').replace(/"/g, '""')}"`,
        l.qty || '',
        l.secQty || '',
        l.rate || '',
        l.secRate || ''
      ];
      if (enableCarriage) {
        baseRow.push(l.carriage || 0);
      }
      baseRow.push(
        l.addLess || '',
        l.amount || '',
        l.receiptDate ? `"${dayjs(l.receiptDate).format('YYYY-MM-DD')}"` : '',
        l.receiptAmount || ''
      );
      return baseRow;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CustomerBill_${form.getFieldValue('account')}_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const wandaKpis = {
    totalWeight: billData?.lines?.reduce((acc, l) => acc + (l.qty || 0), 0) || 0,
    totalBags: billData?.lines?.reduce((acc, l) => acc + (l.secQty || 0), 0) || 0,
    totalBilled: billData?.lines?.reduce((acc, l) => acc + (l.amount || 0), 0) || 0,
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 84px)', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      {/* Left Control Sidebar */}
      <div style={{
        width: 360,
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '16px 20px',
        boxShadow: '1px 0 3px rgba(0,0,0,0.02)'
      }}>
        {/* Mode Selector */}
        <div style={{ marginBottom: 16 }}>
          <Segmented
            block
            value={mode}
            onChange={(val) => setMode(val as 'single' | 'batch')}
            options={[
              { label: 'Single Account', value: 'single', icon: <UserOutlined /> },
              { label: 'Batch / Bulk Bills', value: 'batch', icon: <TeamOutlined /> }
            ]}
            style={{ fontWeight: 500 }}
          />
        </div>

        <Form form={form} layout="vertical">
          {mode === 'single' ? (
            <Form.Item
              label={<span style={{ fontSize: 13, fontWeight: 600 }}>Select Customer</span>}
              name="account"
              rules={[{ required: true, message: 'Please select a customer' }]}
              style={{ marginBottom: 14 }}
            >
              <Select
                showSearch
                placeholder="Search by name or code..."
                optionFilterProp="children"
                filterOption={(input, option) =>
                  String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  const found = customers.find(c => c.account === val);
                  if (found) setSelectedCustomer(found);
                }}
                style={{ width: '100%' }}
              >
                {customers.map(c => (
                  <Select.Option key={c.account} value={c.account}>
                    {c.title} ({c.account})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Select Customers ({selectedBulkAccounts.length})</span>
                <Space size={4}>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={handleSelectAllFiltered}>
                    All Filtered
                  </Button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={handleClearAllSelected} icon={<ClearOutlined />}>
                    Clear
                  </Button>
                </Space>
              </div>

              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Search customers to select..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                allowClear
                size="small"
                style={{ marginBottom: 6 }}
              />

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
            label={<span style={{ fontSize: 12, fontWeight: 500 }}>Billing Period</span>}
            name="dateRange"
            rules={[{ required: true, message: 'Please select dates' }]}
            style={{ marginBottom: 14 }}
          >
            <RangePicker
              presets={rangePresets}
              format="DD-MMM-YYYY"
              style={{ width: '100%' }}
            />
          </Form.Item>

          {/* Date Basis Radio */}
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Basis</span>}
            name="dateBasis"
            initialValue="ClearingDate"
            style={{ marginBottom: 14 }}
          >
            <Radio.Group size="small" buttonStyle="solid">
              <Radio.Button value="ClearingDate">Clearing Date</Radio.Button>
              <Radio.Button value="VoucherDate">Voucher Date</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* Layout Segmented */}
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 500 }}>Print Layout Format</span>}
            name="layout"
            style={{ marginBottom: 14 }}
          >
            <Segmented
              block
              value={layout}
              onChange={(val) => handleLayoutChange(val as 'A4' | 'Thermal')}
              options={[
                { label: 'A4 Sheet', value: 'A4', icon: <FilePdfOutlined /> },
                { label: '80mm Thermal', value: 'Thermal', icon: <ThunderboltOutlined /> }
              ]}
              style={{ fontWeight: 500 }}
            />
          </Form.Item>

          {/* QR Payment Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            marginBottom: 16
          }}>
            <Space size={8}>
              <QrcodeOutlined style={{ color: qrEnabled ? '#10b981' : '#94a3b8', fontSize: 16 }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>Raast QR Code Payment</span>
            </Space>
            <Checkbox
              checked={qrEnabled}
              onChange={e => setQrEnabled(e.target.checked)}
            />
          </div>

          {/* Batch Options */}
          {mode === 'batch' && (
            <div style={{ marginBottom: 16 }}>
              <Checkbox
                checked={onlyWithActivity}
                onChange={e => setOnlyWithActivity(e.target.checked)}
              >
                <span style={{ fontSize: 12, color: '#475569' }}>Only accounts with activity or balances</span>
              </Checkbox>
            </div>
          )}

          {/* Action Button */}
          {mode === 'single' ? (
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => fetchBillDataAndPdf()}
              loading={loading || pdfLoading}
              block
              size="large"
              style={{ fontWeight: 600, background: '#d97706', borderColor: '#d97706' }}
            >
              Generate Bill
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={handleGenerateBatchBills}
              loading={pdfLoading}
              disabled={selectedBulkAccounts.length === 0}
              block
              size="large"
              style={{ fontWeight: 600, background: '#d97706', borderColor: '#d97706' }}
            >
              Compile Batch Bills ({selectedBulkAccounts.length})
            </Button>
          )}

          {mode === 'batch' && layout === 'Thermal' && (
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              style={{
                width: '100%',
                marginTop: 8,
                backgroundColor: '#059669',
                borderColor: '#059669',
                fontWeight: 600
              }}
              loading={bulkBridgePrinting}
              disabled={selectedBulkAccounts.length === 0}
              onClick={handleBulkPrintBridgeDirect}
            >
              🖨 Bulk Print via Bridge ({selectedBulkAccounts.length})
            </Button>
          )}
        </Form>

        {/* Wanda Balance & Bag KPIs (Single Mode) */}
        {mode === 'single' && billData && billData.summary && (
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#92400e' }}>Total Bags Delivered:</span>
                <span style={{ fontWeight: 700, color: '#b45309' }}>{wandaKpis.totalBags.toLocaleString()} Bags</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#92400e' }}>Total Net Weight:</span>
                <span style={{ fontWeight: 700, color: '#b45309' }}>{wandaKpis.totalWeight.toLocaleString()} Kg</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Previous Balance:</span>
                <span style={{ fontWeight: 600 }}>Rs. {(billData.summary.previousBalance || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Current Invoiced:</span>
                <span style={{ fontWeight: 600, color: '#0284c7' }}>
                  Rs. {wandaKpis.totalBilled.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Payments Received:</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>
                  Rs. ({Math.abs(billData.summary.payment || 0).toLocaleString()})
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                fontWeight: 700,
                borderTop: '1px dashed #cbd5e1',
                paddingTop: 6,
                color: (billData.summary.balance || 0) > 0 ? '#dc2626' : '#16a34a'
              }}>
                <span>Net Due Balance:</span>
                <span>Rs. {(billData.summary.balance || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Document Preview Workspace */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        padding: 16
      }}>
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
                <Title level={5} style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#92400e' }}>
                  {mode === 'single' ? 'Customer Statement' : 'Batch Customer Bills'}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {mode === 'single'
                    ? (selectedCustomer ? selectedCustomer.title : 'Select a customer to generate statement')
                    : (batchCompiledCount !== null
                        ? `Batch Compiled: ${batchCompiledCount} Customer(s) selected • ${onlyWithActivity ? 'Active accounts with transactions or balances included' : 'All accounts included'}`
                        : 'Select customers on the left and click Compile Batch Bills')
                  }
                </Text>
              </div>

              {/* Layout Switcher */}
              <Segmented
                value={layout}
                onChange={(val) => handleLayoutChange(val as 'A4' | 'Thermal')}
                options={[
                  { label: 'A4 Sheet', value: 'A4', icon: <FilePdfOutlined /> },
                  { label: '80mm Thermal', value: 'Thermal', icon: <ThunderboltOutlined /> }
                ]}
                style={{ backgroundColor: '#fef3c7', fontWeight: 500 }}
              />
            </div>

            <Space wrap size={8}>
              {layout === 'Thermal' ? (
                <Tooltip title="Print directly to configured POS thermal printer via PrinterBridge (1-Click, Silent)">
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 600 }}
                    loading={bridgePrinting}
                    disabled={!pdfBlobUrl || pdfLoading}
                    onClick={handlePrintBridgeDirect}
                  >
                    🖨 Direct Thermal
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="Print Document">
                  <Button
                    icon={<PrinterOutlined />}
                    disabled={!pdfBlobUrl || pdfLoading}
                    onClick={handlePrint}
                  >
                    Print
                  </Button>
                </Tooltip>
              )}

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

          {/* In-browser PDF Previewer */}
          <div style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#525659',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch'
          }}>
            {pdfLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10
              }}>
                <ThunderboltOutlined spin style={{ fontSize: 32, color: '#d97706', marginBottom: 12 }} />
                <Text strong style={{ fontSize: 15, color: '#1e293b' }}>
                  {mode === 'single' ? 'Rendering High-Resolution Statement...' : 'Compiling Batch Bills...'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  Formatting bag metrics, weight reconciliation, and inline ledger receipts
                </Text>
              </div>
            )}

            {pdfBlobUrl ? (
              <iframe
                ref={iframeRef}
                src={
                  layout === 'Thermal'
                    ? `${pdfBlobUrl}#toolbar=0&navpanes=0&zoom=100`
                    : `${pdfBlobUrl}#toolbar=0&navpanes=0&view=FitH`
                }
                style={{
                  width: layout === 'Thermal' ? 'min(420px, 100%)' : '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#ffffff',
                  boxShadow: layout === 'Thermal' ? '0 4px 20px rgba(0, 0, 0, 0.4)' : 'none',
                  transition: 'width 0.2s ease'
                }}
                title="Customer Bill Document Preview"
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                backgroundColor: '#ffffff',
                color: '#94a3b8'
              }}>
                <FilePdfOutlined style={{ fontSize: 48, marginBottom: 16, color: '#fde68a' }} />
                <Text style={{ fontSize: 16, fontWeight: 600, color: '#92400e' }}>
                  No Customer Bill Generated Yet
                </Text>
                <Text type="secondary" style={{ fontSize: 13, marginTop: 4, maxWidth: 380, textAlign: 'center' }}>
                  Select customer account, period, and click "Generate Bill" to preview the document
                </Text>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Bulk Print Progress Modal */}
      <Modal
        title="🖨 Printing Bulk Bills via PrinterBridge"
        open={bulkProgress !== null}
        footer={null}
        closable={false}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Progress
            percent={bulkProgress ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}
            status="active"
          />
          <Text strong style={{ fontSize: 14, display: 'block', marginTop: 12 }}>
            Printing {bulkProgress?.current} of {bulkProgress?.total}: {bulkProgress?.customerName}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            Spooling directly to thermal printer with cutter pacing...
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default WandaCustomerBill;
