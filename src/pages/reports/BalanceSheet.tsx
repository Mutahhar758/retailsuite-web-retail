import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type BalanceSheetLine } from '../../services/reportService';

const { Title, Text } = Typography;

export const BalanceSheet: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState<BalanceSheetLine[] | null>(null);
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
        toDate: values.toDate.format('YYYY-MM-DD')
      };

      // Fetch vector PDF
      const pdfBlob = await reportService.getBalanceSheetPdf(filter);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);

      // Also prefetch data lines for Excel/CSV exports
      try {
        const rawLines = await reportService.getBalanceSheet(filter);
        setSheetData(rawLines);
      } catch (err) {
        console.warn('Could not prefetch raw balance sheet lines for export', err);
      }

      message.success('Balance sheet generated');
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Failed to generate balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const asOnStr = values.toDate ? values.toDate.format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    return `BalanceSheet_${asOnStr}.${extension}`;
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
    if (!sheetData || sheetData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const headers = ['Classification', 'Category', 'Subcategory', 'Account Title', 'Balance Amount'];
    const rows = sheetData.map(line => [
      `"${(line.lvl1 || '').replace(/"/g, '""')}"`,
      `"${(line.lvl2 || '').replace(/"/g, '""')}"`,
      `"${(line.lvl3 || '').replace(/"/g, '""')}"`,
      `"${(line.title || '').replace(/"/g, '""')}"`,
      Math.abs(line.curBal).toFixed(2)
    ]);

    const totalAssets = sheetData.filter(x => (x.lvl1 || '').toLowerCase().includes('asset')).reduce((s, x) => s + Math.abs(x.curBal), 0);
    const totalLiab = sheetData.filter(x => (x.lvl1 || '').toLowerCase().includes('liabilit')).reduce((s, x) => s + Math.abs(x.curBal), 0);
    const totalEq = sheetData.filter(x => !(x.lvl1 || '').toLowerCase().includes('asset') && !(x.lvl1 || '').toLowerCase().includes('liabilit')).reduce((s, x) => s + Math.abs(x.curBal), 0);

    rows.push(['"TOTAL ASSETS"', '', '', '', totalAssets.toFixed(2)]);
    rows.push(['"TOTAL LIABILITIES"', '', '', '', totalLiab.toFixed(2)]);
    rows.push(['"TOTAL EQUITY"', '', '', '', totalEq.toFixed(2)]);
    rows.push(['"TOTAL LIABILITIES & EQUITY"', '', '', '', (totalLiab + totalEq).toFixed(2)]);

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
    if (!sheetData || sheetData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const values = form.getFieldsValue();
    const asOnStr = values.toDate ? values.toDate.format('DD-MMM-YYYY') : dayjs().format('DD-MMM-YYYY');

    const assets = sheetData.filter(x => (x.lvl1 || '').toLowerCase().includes('asset'));
    const liabilities = sheetData.filter(x => (x.lvl1 || '').toLowerCase().includes('liabilit'));
    const equity = sheetData.filter(x => !(x.lvl1 || '').toLowerCase().includes('asset') && !(x.lvl1 || '').toLowerCase().includes('liabilit'));

    const renderRows = (items: BalanceSheetLine[]) => {
      let html = '';
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        html += `
          <tr style="background-color: ${bg};">
            <td style="border: 1px solid #e5e7eb; padding: 6px;">${item.lvl2 || item.lvl1 || '-'}</td>
            <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: 500;">${item.title}</td>
            <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${Math.abs(item.curBal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
      return html;
    };

    const totalAssets = assets.reduce((s, x) => s + Math.abs(x.curBal), 0);
    const totalLiab = liabilities.reduce((s, x) => s + Math.abs(x.curBal), 0);
    const totalEq = equity.reduce((s, x) => s + Math.abs(x.curBal), 0);
    const totalLiabAndEq = totalLiab + totalEq;
    const isBalanced = Math.abs(totalAssets - totalLiabAndEq) < 0.01;

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
        <div class="header-title">BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)</div>
        <div class="sub-title">As of Date: <b>${asOnStr}</b> &nbsp;|&nbsp; Status: <b>${isBalanced ? '✓ BALANCED' : '⚠ OUT OF BALANCE'}</b></div>
        
        <div class="section-header">1. ASSETS</div>
        <table>
          <thead>
            <tr>
              <th style="width: 200px;">Classification</th>
              <th>Account Title</th>
              <th style="width: 130px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(assets)}
            <tr class="total-row">
              <td colspan="2" style="text-align: left; padding: 8px;">TOTAL ASSETS</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-header">2. LIABILITIES</div>
        <table>
          <thead>
            <tr>
              <th style="width: 200px;">Classification</th>
              <th>Account Title</th>
              <th style="width: 130px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(liabilities)}
            <tr class="total-row">
              <td colspan="2" style="text-align: left; padding: 8px;">TOTAL LIABILITIES</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalLiab.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-header">3. EQUITY & CAPITAL</div>
        <table>
          <thead>
            <tr>
              <th style="width: 200px;">Classification</th>
              <th>Account Title</th>
              <th style="width: 130px;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(equity)}
            <tr class="total-row">
              <td colspan="2" style="text-align: left; padding: 8px;">TOTAL EQUITY</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalEq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <tr style="background-color: #e2e8f0; font-weight: bold;">
            <td colspan="2" style="padding: 10px; font-size: 13px;">TOTAL LIABILITIES & EQUITY</td>
            <td style="text-align: right; padding: 10px; font-size: 13px;">Rs. ${totalLiabAndEq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
          <BankOutlined style={{ fontSize: 20, color: '#4338ca' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>Balance Sheet</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Statement of Financial Position (Assets = Liabilities + Equity)
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
                  toDate: dayjs()
                }}
              >
                <Form.Item
                  name="toDate"
                  label={<span style={{ fontSize: 12, fontWeight: 500 }}>As Of Date</span>}
                  rules={[{ required: true, message: 'Please select as-of date' }]}
                >
                  <DatePicker format="DD-MMM-YYYY" style={{ width: '100%' }} />
                </Form.Item>

                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SearchOutlined />}
                    loading={loading}
                    block
                    style={{
                      backgroundColor: '#4338ca',
                      borderColor: '#4338ca',
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
                title="Balance Sheet Preview"
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
                        Select the As Of Date on the left and click "Generate Statement"
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
