import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BarChartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type TrialBalanceLine } from '../../services/reportService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const TrialBalanceReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [trialData, setTrialData] = useState<TrialBalanceLine[] | null>(null);
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
      const pdfBlob = await reportService.getTrialBalancePdf(filter);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);

      // Also prefetch data lines for Excel/CSV exports
      try {
        const rawLines = await reportService.getTrialBalance(filter);
        setTrialData(rawLines);
      } catch (err) {
        console.warn('Could not prefetch raw data lines for export', err);
      }

      message.success('Trial balance report generated');
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Failed to generate trial balance report');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const fromStr = values.dateRange ? values.dateRange[0].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const toStr = values.dateRange ? values.dateRange[1].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    return `TrialBalance_${fromStr}_${toStr}.${extension}`;
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
    if (!trialData || trialData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const headers = ['Account Title / Head', 'Opening Balance', 'Period Debit', 'Period Credit', 'Closing Balance'];
    let totalOpening = 0;
    let totalDr = 0;
    let totalCr = 0;
    let totalClosing = 0;

    const rows = trialData.map(line => {
      totalOpening += line.priBal;
      totalDr += line.dr;
      totalCr += line.cr;
      totalClosing += line.curBal;

      return [
        `"${(line.title || '').replace(/"/g, '""')}"`,
        line.priBal.toFixed(2),
        line.dr.toFixed(2),
        line.cr.toFixed(2),
        line.curBal.toFixed(2)
      ];
    });

    rows.push([
      '"TOTAL SUMMARY & RECONCILIATION"',
      totalOpening.toFixed(2),
      totalDr.toFixed(2),
      totalCr.toFixed(2),
      totalClosing.toFixed(2)
    ]);

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
    if (!trialData || trialData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const values = form.getFieldsValue();
    const periodStr = values.dateRange
      ? `${values.dateRange[0].format('DD-MMM-YYYY')} to ${values.dateRange[1].format('DD-MMM-YYYY')}`
      : dayjs().format('DD-MMM-YYYY');

    let totalOpening = 0;
    let totalDr = 0;
    let totalCr = 0;
    let totalClosing = 0;

    let rowsHtml = '';
    trialData.forEach((line, idx) => {
      totalOpening += line.priBal;
      totalDr += line.dr;
      totalCr += line.cr;
      totalClosing += line.curBal;

      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      rowsHtml += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: 500;">${line.title}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${line.priBal !== 0 ? line.priBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${line.dr > 0 ? line.dr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${line.cr > 0 ? line.cr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${line.curBal !== 0 ? line.curBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
        </tr>
      `;
    });

    const isBalanced = Math.abs(totalDr - totalCr) < 0.01;
    const balanceStatus = isBalanced ? '✓ BALANCED' : `⚠ OUT OF BALANCE: ${Math.abs(totalDr - totalCr).toFixed(2)}`;

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
          td { font-size: 11px; color: #1e293b; }
          .header-title { font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
          .sub-title { font-size: 12px; color: #64748b; margin-bottom: 12px; }
          .total-row { background-color: #f1f5f9; font-weight: bold; }
          .total-row td { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 8px; }
        </style>
      </head>
      <body>
        <div class="header-title">TRIAL BALANCE (GENERAL LEDGER)</div>
        <div class="sub-title">Period: <b>${periodStr}</b> &nbsp;|&nbsp; Status: <b>${balanceStatus}</b></div>
        <table>
          <thead>
            <tr>
              <th>Account Title / Head</th>
              <th style="width: 110px;">Opening Balance</th>
              <th style="width: 110px;">Period Debit</th>
              <th style="width: 110px;">Period Credit</th>
              <th style="width: 120px;">Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td style="text-align: left; padding: 8px;">TOTAL SUMMARY & RECONCILIATION</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalOpening.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalClosing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
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
          <BarChartOutlined style={{ fontSize: 20, color: '#2563eb' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>Trial Balance Report</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              General Ledger opening, movement and closing balances
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
                      backgroundColor: '#2563eb',
                      borderColor: '#2563eb',
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
                title="Trial Balance Report Preview"
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
                        Select the Accounting Period on the left and click "Generate Report"
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
