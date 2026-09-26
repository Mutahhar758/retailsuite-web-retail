import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type ProfitByCustomerResponse
} from '../../services/reportService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ProfitByCustomer: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ProfitByCustomerResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Initial load
  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today]
    });
    handleSearch({ dateRange: [startOfMonth, today] });
  }, [form]);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const fromDate = values.dateRange[0].format('YYYY-MM-DD');
      const toDate = values.dateRange[1].format('YYYY-MM-DD');

      // Fetch vector PDF and structured summary data
      const [pdfBlob, rawData] = await Promise.all([
        reportService.getProfitByCustomerPdf({ fromDate, toDate }),
        reportService.getProfitByCustomer({ fromDate, toDate })
      ]);

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);
      setReportData(rawData);

      message.success('Profit by Customer report generated');
    } catch (error: any) {
      console.error('Failed to generate Profit by Customer report', error);
      message.error(error?.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const fromStr = values.dateRange ? values.dateRange[0].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const toStr = values.dateRange ? values.dateRange[1].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    return `ProfitByCustomer_${fromStr}_${toStr}.${extension}`;
  };

  const handleDownloadPdf = () => {
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
          console.error('Direct print failed', e);
          window.open(pdfUrl, '_blank');
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 200);
    };
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.lines || reportData.lines.length === 0) {
      message.warning('No data available to export.');
      return;
    }

    // Customer code deliberately omitted
    const headers = [
      '#',
      'Customer Title',
      'City',
      'Invoices',
      'Qty Sold',
      'Sales Amount',
      'Cost Amount',
      'Gross Profit',
      'Margin %'
    ];

    const rows = reportData.lines.map((l, index) => [
      index + 1,
      `"${(l.accountTitle || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      l.invoiceCount,
      l.totalQty.toFixed(2),
      l.totalSales.toFixed(2),
      l.totalCost.toFixed(2),
      l.grossProfit.toFixed(2),
      `${l.grossMarginPct.toFixed(1)}%`
    ]);

    // Summary total row
    rows.push([
      'TOTAL',
      `"${reportData.customerCount} Customers"`,
      '',
      reportData.lines.reduce((s, x) => s + x.invoiceCount, 0),
      reportData.totalQtySold.toFixed(2),
      reportData.totalSales.toFixed(2),
      reportData.totalCost.toFixed(2),
      reportData.grossProfit.toFixed(2),
      `${reportData.grossMarginPct.toFixed(1)}%`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
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
    if (!reportData || !reportData.lines || reportData.lines.length === 0) {
      message.warning('No data available to export.');
      return;
    }

    const values = form.getFieldsValue();
    const periodStr = values.dateRange
      ? `${values.dateRange[0].format('DD-MMM-YYYY')} to ${values.dateRange[1].format('DD-MMM-YYYY')}`
      : dayjs().format('DD-MMM-YYYY');

    let rowsHtml = '';
    reportData.lines.forEach((l, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      const profitColor = l.grossProfit >= 0 ? '#15803d' : '#b91c1c';
      rowsHtml += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #e5e7eb; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: 500;">${l.accountTitle}</td>
          <td style="border: 1px solid #e5e7eb; padding: 6px;">${l.city || '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${l.invoiceCount}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${l.totalQty.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${l.totalSales.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${l.totalCost.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold; color: ${profitColor};">${l.grossProfit.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${l.grossMarginPct.toFixed(1)}%</td>
        </tr>
      `;
    });

    const profitColor = reportData.grossProfit >= 0 ? '#15803d' : '#b91c1c';
    const totalInvoices = reportData.lines.reduce((s, x) => s + x.invoiceCount, 0);

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
          .total-row { background-color: #f1f5f9; font-weight: bold; }
          .total-row td { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 8px; }
        </style>
      </head>
      <body>
        <div class="header-title">PROFIT BY CUSTOMER REPORT</div>
        <div class="sub-title">Period: <b>${periodStr}</b> &nbsp;|&nbsp; Total Customers: <b>${reportData.customerCount}</b></div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Customer Title</th>
              <th style="width: 120px;">City</th>
              <th style="width: 70px;">Invoices</th>
              <th style="width: 80px;">Qty Sold</th>
              <th style="width: 120px;">Sales (Rs.)</th>
              <th style="width: 120px;">Cost (Rs.)</th>
              <th style="width: 120px;">Profit (Rs.)</th>
              <th style="width: 70px;">Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align: left; padding: 8px;">GRAND TOTALS</td>
              <td style="text-align: right; padding: 8px;">${totalInvoices}</td>
              <td style="text-align: right; padding: 8px;">${reportData.totalQtySold.toFixed(2)}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${reportData.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${reportData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px; color: ${profitColor};">Rs. ${reportData.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">${reportData.grossMarginPct.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TeamOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Profit by Customer
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Customer-wise profitability analysis and gross margin breakdown
            </Text>
          </div>
        </div>

        <Space wrap>
          <Tooltip title={isCollapsed ? 'Show Parameters' : 'Hide Parameters'}>
            <Button
              icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </Tooltip>

          {pdfUrl && (
            <>
              <Tooltip title="Direct 1-click print">
                <Button icon={<PrinterOutlined />} onClick={handleDirectPrint}>
                  Print PDF
                </Button>
              </Tooltip>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPdf}>
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
                    Generate Report
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
            styles={{
              body: {
                flex: 1,
                padding: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#525659'
              }
            }}
          >
            {loading ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <Spin size="large" />
                <Text style={{ marginTop: 16, color: '#64748b' }}>Generating Profit by Customer report...</Text>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Profit by Customer Preview"
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block' }}
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      Select period and click <b>Generate Report</b> to view document.
                    </span>
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

export default ProfitByCustomer;
