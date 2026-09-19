import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, RiseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type IncomeSummaryLine } from '../../services/reportService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const IncomeSummary: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<IncomeSummaryLine[] | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD')
      };

      // Fetch vector PDF
      const pdfBlob = await reportService.getIncomeSummaryPdf(filter);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);

      // Also prefetch data lines for Excel/CSV exports
      try {
        const rawLines = await reportService.getIncomeSummary(filter);
        setIncomeData(rawLines);
      } catch (err) {
        console.warn('Could not prefetch raw income summary lines for export', err);
      }

      message.success('Income summary generated');
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Failed to generate income summary');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const fromStr = values.dateRange ? values.dateRange[0].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const toStr = values.dateRange ? values.dateRange[1].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    return `IncomeSummary_${fromStr}_${toStr}.${extension}`;
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = getExportFileName('pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDirectPrint = () => {
    if (!pdfUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Failed to print PDF', e);
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 60000);
        }
      }, 300);
    };
  };

  const handleOpenInNewTab = () => {
    if (!pdfUrl) return;
    window.open(`${pdfUrl}#view=FitH`, '_blank');
  };

  const handleExportCsv = () => {
    if (!incomeData || incomeData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const headers = ['Category', 'Account Title', 'Debit', 'Credit', 'Amount'];
    const rows = incomeData.map(line => [
      `"${(line.vType || '').replace(/"/g, '""')}"`,
      `"${(line.title || '').replace(/"/g, '""')}"`,
      line.dr.toFixed(2),
      line.cr.toFixed(2),
      line.bal.toFixed(2)
    ]);

    const sales = incomeData.filter(x => x.vType.toLowerCase().includes('sale')).reduce((s, x) => s + Math.abs(x.bal), 0);
    const cogs = incomeData.filter(x => x.vType.toLowerCase().includes('cost')).reduce((s, x) => s + x.bal, 0);
    const gross = sales - cogs;
    const expenses = incomeData.filter(x => x.vType.toLowerCase().includes('expense')).reduce((s, x) => s + Math.abs(x.bal), 0);
    const net = gross - expenses;

    rows.push(['"TOTAL REVENUE / SALES"', '', '', '', sales.toFixed(2)]);
    rows.push(['"COST OF GOODS SOLD"', '', '', '', cogs.toFixed(2)]);
    rows.push(['"GROSS PROFIT"', '', '', '', gross.toFixed(2)]);
    rows.push(['"TOTAL OPERATING EXPENSES"', '', '', '', expenses.toFixed(2)]);
    rows.push(['"NET PROFIT / (LOSS)"', '', '', '', net.toFixed(2)]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName('csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Exported to CSV');
  };

  const handleExportExcel = () => {
    if (!incomeData || incomeData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const values = form.getFieldsValue();
    const periodStr = values.dateRange
      ? `${values.dateRange[0].format('DD-MMM-YYYY')} to ${values.dateRange[1].format('DD-MMM-YYYY')}`
      : dayjs().format('DD-MMM-YYYY');

    const salesRows = incomeData.filter(x => x.vType.toLowerCase().includes('sale'));
    const cogsRows = incomeData.filter(x => x.vType.toLowerCase().includes('cost'));
    const expenseRows = incomeData.filter(x => x.vType.toLowerCase().includes('expense'));

    const renderRows = (items: IncomeSummaryLine[]) => {
      let html = '';
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        html += `
          <tr style="background-color: ${bg};">
            <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: 500;">${item.title}</td>
            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${item.dr !== 0 ? item.dr.toFixed(2) : '-'}</td>
            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${item.cr !== 0 ? item.cr.toFixed(2) : '-'}</td>
            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${item.bal.toFixed(2)}</td>
          </tr>
        `;
      });
      return html;
    };

    const totalSales = salesRows.reduce((s, x) => s + Math.abs(x.bal), 0);
    const totalCogs = cogsRows.reduce((s, x) => s + x.bal, 0);
    const grossProfit = totalSales - totalCogs;
    const totalExpenses = expenseRows.reduce((s, x) => s + Math.abs(x.bal), 0);
    const netIncome = grossProfit - totalExpenses;

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
          td { font-size: 11px; color: #1e293b; }
          .header-title { font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
          .sub-title { font-size: 12px; color: #64748b; margin-bottom: 12px; }
          .section-header { background-color: #f1f5f9; font-weight: bold; font-size: 12px; padding: 6px; border: 1px solid #cbd5e1; }
          .total-row { background-color: #f8fafc; font-weight: bold; }
          .total-row td { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 8px; }
        </style>
      </head>
      <body>
        <div class="header-title">INCOME STATEMENT (PROFIT & LOSS)</div>
        <div class="sub-title">Period: <b>${periodStr}</b> &nbsp;|&nbsp; Net Position: <b>Rs. ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
        
        <div class="section-header">1. REVENUE / SALES</div>
        <table>
          <thead>
            <tr>
              <th>Account Title</th>
              <th style="width: 100px;">Debit</th>
              <th style="width: 100px;">Credit</th>
              <th style="width: 120px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(salesRows)}
            <tr class="total-row">
              <td colspan="3" style="text-align: left; padding: 8px;">TOTAL SALES</td>
              <td style="text-align: right; padding: 8px; color: #15803d;">Rs. ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-header">2. COST OF GOODS SOLD (COGS)</div>
        <table>
          <thead>
            <tr>
              <th>Account Title</th>
              <th style="width: 100px;">Debit</th>
              <th style="width: 100px;">Credit</th>
              <th style="width: 120px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(cogsRows)}
            <tr class="total-row">
              <td colspan="3" style="text-align: left; padding: 8px;">TOTAL COGS</td>
              <td style="text-align: right; padding: 8px; color: #ea580c;">Rs. ${totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td colspan="3" style="padding: 8px; font-size: 12px;">GROSS PROFIT (REVENUE - COGS)</td>
            <td style="text-align: right; padding: 8px; font-size: 12px; color: #15803d;">Rs. ${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <div class="section-header">3. OPERATING EXPENSES</div>
        <table>
          <thead>
            <tr>
              <th>Account Title</th>
              <th style="width: 100px;">Debit</th>
              <th style="width: 100px;">Credit</th>
              <th style="width: 120px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(expenseRows)}
            <tr class="total-row">
              <td colspan="3" style="text-align: left; padding: 8px;">TOTAL OPERATING EXPENSES</td>
              <td style="text-align: right; padding: 8px; color: #b91c1c;">Rs. ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tr style="background-color: #e2e8f0; font-weight: bold;">
            <td colspan="3" style="padding: 10px; font-size: 13px;">NET PROFIT / (LOSS) FOR THE PERIOD</td>
            <td style="text-align: right; padding: 10px; font-size: 13px; color: ${netIncome >= 0 ? '#15803d' : '#b91c1c'};">Rs. ${netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName('xls');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Exported to Excel');
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar */}
      <div style={{
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <Space align="center" size="middle">
          <Button
            type="text"
            icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ fontSize: 16 }}
            title={isCollapsed ? 'Show Parameters' : 'Hide Parameters'}
          />
          <RiseOutlined style={{ fontSize: 20, color: '#16a34a' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>Income Statement (Profit & Loss)</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Multi-step revenue, cost of goods sold, and operating expense statement
            </Text>
          </div>
        </Space>

        <Space>
          {pdfUrl && (
            <>
              <Button icon={<PrinterOutlined />} onClick={handleDirectPrint} type="default">
                Print
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload} type="default">
                Download PDF
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ color: '#15803d' }}>
                Export Excel
              </Button>
              <Button icon={<FileTextOutlined />} onClick={handleExportCsv} style={{ color: '#0284c7' }}>
                Export CSV
              </Button>
              <Tooltip title="Open in New Tab">
                <Button icon={<ExportOutlined />} onClick={handleOpenInNewTab} />
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      {/* Main Side-by-Side Workspace */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '16px',
        height: 'calc(100vh - 180px)',
        width: '100%',
        padding: '14px 16px 0 16px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* Left: Fixed Collapsible Parameters Panel */}
        {!isCollapsed && (
          <div style={{
            width: '320px',
            minWidth: '320px',
            maxWidth: '320px',
            height: '100%',
            overflowY: 'auto'
          }}>
            <Card
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>Report Parameters</span>}
              size="small"
              className="shadow-sm"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSearch}
                initialValues={{
                  dateRange: [dayjs().startOf('month'), dayjs()]
                }}
              >
                <Form.Item
                  name="dateRange"
                  label={<span style={{ fontSize: 12, fontWeight: 500 }}>Accounting Period</span>}
                  rules={[{ required: true, message: 'Please select period range' }]}
                >
                  <RangePicker
                    presets={rangePresets}
                    format="DD-MMM-YYYY"
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SearchOutlined />}
                    loading={loading}
                    block
                    style={{
                      backgroundColor: '#16a34a',
                      borderColor: '#16a34a',
                      height: 38,
                      fontWeight: 500
                    }}
                  >
                    Generate Statement
                  </Button>
                </div>
              </Form>
            </Card>
          </div>
        )}

        {/* Right: Full-Height PDF Preview Workspace */}
        <div style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <Card
            size="small"
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 8,
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}
            bodyStyle={{
              flex: 1,
              padding: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: '#525659'
            }}
          >
            {loading ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff'
              }}>
                <Spin size="large" />
                <Text type="secondary" style={{ marginTop: 16 }}>
                  Generating vector PDF report...
                </Text>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#view=FitH`}
                title="Income Statement Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block'
                }}
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff'
              }}>
                <Empty
                  description={
                    <div>
                      <Text strong style={{ fontSize: 15, color: '#374151' }}>No Report Generated</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Select the Accounting Period on the left and click "Generate Statement"
                      </Text>
                    </div>
                  }
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
