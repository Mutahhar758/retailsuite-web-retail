import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ReloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  FileExcelOutlined, FileTextOutlined, ExportOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type CustomerBalanceRecoveryResponse
} from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { useAppStore } from '../../stores/useAppStore';
import {
  printDirect,
  padLine,
  divider,
  type ConnectionMethod,
  ESC_ALIGN_LEFT,
  ESC_ALIGN_CENTER,
  ESC_BOLD_ON,
  ESC_DOUBLE_ON,
  ESC_DOUBLE_OFF
} from '../../hooks/useThermalPrinter';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const CustomerBalanceRecoveryReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [reportData, setReportData] = useState<CustomerBalanceRecoveryResponse | null>(null);
  const [thermalPrinting, setThermalPrinting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Suite';

  // Load customer lookup
  useEffect(() => {
    chartOfAccountService.getCustomerAccounts().then(res => {
      setCustomers(res || []);
    }).catch(console.error);
  }, []);

  // Set default values
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      dateBasis: 'ClearingDate',
      balanceFilter: 'All'
    });
    // Auto-generate on initial load
    fetchReportDataAndPdf({
      dateRange: [startOfMonth, today],
      dateBasis: 'ClearingDate',
      balanceFilter: 'All'
    });
  }, [form]);

  // Clean up blob url on unmount
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
    fetchReportDataAndPdf({
      dateRange: [from, to],
      customerAccountId: form.getFieldValue('customerAccountId'),
      dateBasis: form.getFieldValue('dateBasis'),
      balanceFilter: form.getFieldValue('balanceFilter')
    });
  };

  const fetchReportDataAndPdf = async (values?: any) => {
    const fValues = values || form.getFieldsValue();
    if (!fValues.dateRange || fValues.dateRange.length < 2) {
      message.warning('Please select a valid date range');
      return;
    }

    const fromDate = fValues.dateRange[0].format('YYYY-MM-DD');
    const toDate = fValues.dateRange[1].format('YYYY-MM-DD');
    const customerAccountId = fValues.customerAccountId || undefined;
    const dateBasis = fValues.dateBasis || 'ClearingDate';
    const balanceFilter = fValues.balanceFilter || 'All';

    setLoading(true);
    setPdfLoading(true);

    try {
      // Parallel fetch for table data (used for CSV/Excel/Thermal) and vector PDF
      const [dataRes, blob] = await Promise.all([
        reportService.getCustomerBalanceRecovery({
          fromDate,
          toDate,
          customerAccountId,
          dateBasis,
          balanceFilter
        }),
        reportService.getCustomerBalanceRecoveryPdf({
          fromDate,
          toDate,
          customerAccountId,
          dateBasis,
          balanceFilter
        })
      ]);

      setReportData(dataRes);

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(newBlobUrl);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to generate Customer Balance & Recovery report');
    } finally {
      setLoading(false);
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the report first');
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
      message.warning('Please generate the report first');
      return;
    }
    const dates = form.getFieldValue('dateRange');
    const fromStr = dates?.[0]?.format('YYYYMMDD') || 'From';
    const toStr = dates?.[1]?.format('YYYYMMDD') || 'To';
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `CustomerBalanceRecovery_${fromStr}_${toStr}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    if (!pdfBlobUrl) {
      message.warning('Please generate the report first');
      return;
    }
    window.open(pdfBlobUrl, '_blank');
  };

  // Export to Excel (.xls HTML format with styles)
  const handleExportExcel = () => {
    if (!reportData || !reportData.lines || reportData.lines.length === 0) {
      message.warning('No report data available to export');
      return;
    }

    const dates = form.getFieldValue('dateRange');
    const fromStr = dates?.[0]?.format('DD-MMM-YYYY') || '';
    const toStr = dates?.[1]?.format('DD-MMM-YYYY') || '';

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Customer Balance Recovery</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          th { background-color: #f3f4f6; color: #111827; font-weight: bold; font-size: 11pt; border: 0.5pt solid #d1d5db; padding: 6px; }
          td { border: 0.5pt solid #e5e7eb; padding: 5px; font-size: 10pt; }
          .num { mso-number-format:"\\#\\,\\#\\#0"; text-align: right; }
          .bold { font-weight: bold; background-color: #f9fafb; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <div style="font-size: 16pt; font-weight: bold; margin-bottom: 4px;">${currentOrgName}</div>
        <div style="font-size: 12pt; font-weight: bold; margin-bottom: 8px;">CUSTOMER BALANCE & RECOVERY REPORT (${fromStr} to ${toStr})</div>
        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Previous Balance</th>
              <th>Current Billing</th>
              <th>Total Due</th>
              <th>Recovered</th>
              <th>Discount</th>
              <th>Closing Balance</th>
              <th>Recovery %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    reportData.lines.forEach(l => {
      tableHtml += `
        <tr>
          <td>${l.customerTitle}</td>
          <td>${l.phone || ''}</td>
          <td>${l.address || ''}</td>
          <td class="num">${l.previousBalance}</td>
          <td class="num">${l.currentBilling}</td>
          <td class="num">${l.totalDue}</td>
          <td class="num">${l.recoveryAmount}</td>
          <td class="num">${l.discount}</td>
          <td class="num">${l.closingBalance}</td>
          <td class="center">${l.recoveryPercentage.toFixed(0)}%</td>
          <td class="center">${l.status}</td>
        </tr>
      `;
    });

    const sum = reportData.summary;
    tableHtml += `
        <tr class="bold">
          <td colspan="3"><strong>Total (${sum.totalCustomers} Customers)</strong></td>
          <td class="num"><strong>${sum.totalPreviousBalance}</strong></td>
          <td class="num"><strong>${sum.totalCurrentBilling}</strong></td>
          <td class="num"><strong>${sum.totalDue}</strong></td>
          <td class="num"><strong>${sum.totalRecovery}</strong></td>
          <td class="num"><strong>${sum.totalDiscount}</strong></td>
          <td class="num"><strong>${sum.totalClosingBalance}</strong></td>
          <td class="center"><strong>${sum.overallRecoveryRate.toFixed(1)}%</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>
    </body>
    </html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CustomerBalanceRecovery_${dates?.[0]?.format('YYYYMMDD') || ''}_${dates?.[1]?.format('YYYYMMDD') || ''}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Excel file exported successfully');
  };

  // Export to standard CSV (RFC4180)
  const handleExportCsv = () => {
    if (!reportData || !reportData.lines || reportData.lines.length === 0) {
      message.warning('No report data available to export');
      return;
    }

    const headers = [
      'Customer Name',
      'Phone',
      'Address',
      'Previous Balance',
      'Current Billing',
      'Total Due',
      'Recovered',
      'Discount',
      'Closing Balance',
      'Recovery %',
      'Status'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const rows = reportData.lines.map(l => [
      escapeCsv(l.customerTitle),
      escapeCsv(l.phone || ''),
      escapeCsv(l.address || ''),
      l.previousBalance,
      l.currentBilling,
      l.totalDue,
      l.recoveryAmount,
      l.discount,
      l.closingBalance,
      `${l.recoveryPercentage.toFixed(0)}%`,
      escapeCsv(l.status)
    ].join(','));

    const sum = reportData.summary;
    const summaryRow = [
      escapeCsv(`Total (${sum.totalCustomers} Customers)`),
      '""',
      '""',
      sum.totalPreviousBalance,
      sum.totalCurrentBilling,
      sum.totalDue,
      sum.totalRecovery,
      sum.totalDiscount,
      sum.totalClosingBalance,
      `${sum.overallRecoveryRate.toFixed(1)}%`,
      '""'
    ].join(',');

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows, summaryRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dates = form.getFieldValue('dateRange');
    link.download = `CustomerBalanceRecovery_${dates?.[0]?.format('YYYYMMDD') || ''}_${dates?.[1]?.format('YYYYMMDD') || ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('CSV file exported successfully');
  };

  // Thermal ESC/POS Print (80mm)
  const handlePrintThermal = async () => {
    if (!reportData || reportData.lines.length === 0) {
      message.warning('No report data to print');
      return;
    }

    setThermalPrinting(true);
    try {
      const dates = form.getFieldValue('dateRange');
      const fromStr = dates ? dates[0].format('DD-MMM-YYYY') : '';
      const toStr = dates ? dates[1].format('DD-MMM-YYYY') : '';
      const width = 42;

      const lines: string[] = [];
      lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + currentOrgName.toUpperCase());
      lines.push(ESC_DOUBLE_OFF + 'CUSTOMER BALANCE & RECOVERY REPORT');
      lines.push(`Period: ${fromStr} to ${toStr}`);
      lines.push(`Printed: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
      lines.push(ESC_ALIGN_LEFT + divider('-', width));

      lines.push('Customer          Due(Rs)  Recv(Rs)  Bal(Rs)');
      lines.push(divider('-', width));

      reportData.lines.forEach(l => {
        const name = l.customerTitle.length > 15 ? l.customerTitle.substring(0, 15) : l.customerTitle.padEnd(15, ' ');
        const dueStr = Math.round(l.totalDue).toLocaleString().padStart(8, ' ');
        const recvStr = Math.round(l.recoveryAmount).toLocaleString().padStart(8, ' ');
        const balStr = Math.round(l.closingBalance).toLocaleString().padStart(8, ' ');
        lines.push(`${name} ${dueStr} ${recvStr} ${balStr}`);
      });

      lines.push(divider('=', width));
      lines.push(ESC_BOLD_ON);
      lines.push(padLine('Total Previous Bal:', `Rs. ${Math.round(reportData.summary.totalPreviousBalance).toLocaleString()}`, width));
      lines.push(padLine('Total Current Billing:', `Rs. ${Math.round(reportData.summary.totalCurrentBilling).toLocaleString()}`, width));
      lines.push(padLine('Total Due Amount:', `Rs. ${Math.round(reportData.summary.totalDue).toLocaleString()}`, width));
      lines.push(padLine('Total Recovered:', `Rs. ${Math.round(reportData.summary.totalRecovery).toLocaleString()}`, width));
      lines.push(padLine('Total Closing Bal:', `Rs. ${Math.round(reportData.summary.totalClosingBalance).toLocaleString()}`, width));
      lines.push(padLine('Recovery Rate:', `${reportData.summary.overallRecoveryRate.toFixed(1)}%`, width));
      lines.push(divider('=', width));
      lines.push('\n\n\n\x1d\x56\x00'); // Full cut

      const savedMethod = (localStorage.getItem('pos_printer_method') || 'LOCAL_RELAY') as ConnectionMethod;
      const savedPrinter = localStorage.getItem('pos_printer_name') || 'XP-80';

      await printDirect(lines, savedMethod, { printerName: savedPrinter });
      message.success('Receipt sent to printer');
    } catch (err) {
      console.error(err);
      message.error('Thermal printing encountered an unexpected error');
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
            <Tooltip title="Regenerate Report" placement="right">
              <Button
                type="primary"
                shape="circle"
                icon={<ReloadOutlined />}
                loading={loading || pdfLoading}
                onClick={() => fetchReportDataAndPdf()}
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
              onFinish={() => fetchReportDataAndPdf()}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Range</span>}
                name="dateRange"
                rules={[{ required: true, message: 'Please select dates' }]}
                style={{ marginBottom: 12 }}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Basis</span>}
                name="dateBasis"
                style={{ marginBottom: 12 }}
              >
                <Select
                  options={[
                    { label: 'Clearing Date (Recommended)', value: 'ClearingDate' },
                    { label: 'Voucher Date', value: 'VoucherDate' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Balance Status</span>}
                name="balanceFilter"
                style={{ marginBottom: 12 }}
              >
                <Select
                  options={[
                    { label: 'All Customers', value: 'All' },
                    { label: 'Outstanding Only (> 0)', value: 'OutstandingOnly' },
                    { label: 'Cleared Only (<= 0)', value: 'ClearedOnly' },
                    { label: 'Zero Recovery Only', value: 'UnpaidOnly' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: 12, fontWeight: 500 }}>Customer (Optional)</span>}
                name="customerAccountId"
                style={{ marginBottom: 20 }}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="All Customers"
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

              <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                  loading={loading || pdfLoading}
                  block
                  style={{ height: 38, fontWeight: 500 }}
                >
                  Generate Report
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
          <div>
            <Title level={5} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Customer Balance & Recovery
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Reconciled balances, billing, collections and recovery rate
            </Text>
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
                disabled={!reportData || reportData.lines.length === 0}
                onClick={handleExportExcel}
              >
                Excel
              </Button>
            </Tooltip>

            <Tooltip title="Export to CSV">
              <Button
                icon={<FileTextOutlined />}
                disabled={!reportData || reportData.lines.length === 0}
                onClick={handleExportCsv}
              >
                CSV
              </Button>
            </Tooltip>

            <Tooltip title="Print to 80mm Thermal Receipt Printer">
              <Button
                icon={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
                loading={thermalPrinting}
                disabled={!reportData || reportData.lines.length === 0}
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
              <Text style={{ color: '#ffffff', fontSize: 14 }}>Generating Vector PDF...</Text>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              ref={iframeRef}
              src={`${pdfBlobUrl}#view=FitH`}
              title="Customer Balance & Recovery Report Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
            />
          ) : (
            <div style={{ backgroundColor: '#ffffff', padding: 40, borderRadius: 8 }}>
              <Empty description="No report generated yet. Click 'Generate Report' on the left." />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CustomerBalanceRecoveryReport;
