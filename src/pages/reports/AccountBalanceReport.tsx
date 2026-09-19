import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
  AccountBookOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type BalanceDetailLine } from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

export const AccountBalanceReport: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [balanceData, setBalanceData] = useState<BalanceDetailLine[] | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [parentTitle, setParentTitle] = useState('');

  useEffect(() => {
    chartOfAccountService.getActiveAccounts().then(res => {
      // Show only Level 4 accounts (Control accounts)
      const controlAccounts = res.filter(a => a.accLevel === 4);
      setAccounts(controlAccounts.map(a => ({ account: a.account, title: a.title })));
    });

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
        toDate: values.toDate.format('YYYY-MM-DD'),
        account: values.account
      };

      const selectedAcc = accounts.find(a => a.account === values.account);
      setParentTitle(selectedAcc?.title || values.account);

      // Fetch vector PDF
      const pdfBlob = await reportService.getBalanceDetailPdf(filter);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);

      // Also fetch data lines for Excel/CSV exports
      try {
        const rawLines = await reportService.getBalanceDetail(filter);
        setBalanceData(rawLines);
      } catch (err) {
        console.warn('Could not prefetch raw data lines for export', err);
      }

      message.success('Account balance report generated');
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Failed to generate account balance report');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const toDateStr = values.toDate ? values.toDate.format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const accTitle = (parentTitle || values.account || 'AccountBalance').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `AccountBalance_${accTitle}_${toDateStr}.${extension}`;
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
    if (!balanceData || balanceData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const headers = ['#', 'Account Title / Subsidiary', 'Debit (Dr)', 'Credit (Cr)', 'Balance', 'Type'];
    let totalDr = 0;
    let totalCr = 0;

    const rows = balanceData.map((line, idx) => {
      const debit = line.balance > 0 ? line.balance : 0;
      const credit = line.balance < 0 ? Math.abs(line.balance) : 0;
      totalDr += debit;
      totalCr += credit;
      const type = line.balance >= 0 ? 'Dr' : 'Cr';

      return [
        (idx + 1).toString(),
        `"${(line.account || '').replace(/"/g, '""')}"`,
        debit.toFixed(2),
        credit.toFixed(2),
        line.balance.toFixed(2),
        type
      ];
    });

    const netBal = totalDr - totalCr;
    const netType = netBal >= 0 ? 'Dr' : 'Cr';
    rows.push(['', '"GRAND TOTALS"', totalDr.toFixed(2), totalCr.toFixed(2), netBal.toFixed(2), netType]);

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
    if (!balanceData || balanceData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const values = form.getFieldsValue();
    const asOnStr = values.toDate ? values.toDate.format('DD-MMM-YYYY') : dayjs().format('DD-MMM-YYYY');

    let totalDr = 0;
    let totalCr = 0;

    let rowsHtml = '';
    balanceData.forEach((line, idx) => {
      const debit = line.balance > 0 ? line.balance : 0;
      const credit = line.balance < 0 ? Math.abs(line.balance) : 0;
      totalDr += debit;
      totalCr += credit;
      const type = line.balance >= 0 ? 'Dr' : 'Cr';
      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

      rowsHtml += `
        <tr style="background-color: ${bg};">
          <td style="text-align: center; border: 1px solid #e5e7eb; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 6px;">${line.account}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${Math.abs(line.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center; border: 1px solid #e5e7eb; padding: 6px; color: ${line.balance >= 0 ? '#15803d' : '#b91c1c'}; font-weight: bold;">${type}</td>
        </tr>
      `;
    });

    const netBal = totalDr - totalCr;
    const netType = netBal >= 0 ? 'Dr' : 'Cr';

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
        <div class="header-title">ACCOUNT BALANCE (DETAIL SCHEDULE)</div>
        <div class="sub-title">Account Head: <b>${parentTitle || values.account}</b> &nbsp;|&nbsp; As On: <b>${asOnStr}</b></div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px;">#</th>
              <th>Account Title / Subsidiary</th>
              <th style="width: 120px;">Debit (Dr)</th>
              <th style="width: 120px;">Credit (Cr)</th>
              <th style="width: 130px;">Net Balance</th>
              <th style="width: 60px;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="2" style="text-align: left; padding: 8px;">GRAND TOTALS</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${totalCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right; padding: 8px;">Rs. ${Math.abs(netBal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: center; padding: 8px;">${netType}</td>
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
          <AccountBookOutlined style={{ fontSize: 20, color: '#16a34a' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>Account Balance Report</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {parentTitle ? `Schedule for: ${parentTitle}` : 'View current balances for specific account groups'}
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

                <Form.Item
                  name="account"
                  label={<span style={{ fontSize: 12, fontWeight: 500 }}>Account Group</span>}
                  rules={[{ required: true, message: 'Please select an account group' }]}
                >
                  <Select
                    showSearch
                    placeholder="Select group (e.g. Assets, Cash)"
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                  >
                    {accounts.map(acc => (
                      <Select.Option key={acc.account} value={acc.account}>
                        {acc.title}
                      </Select.Option>
                    ))}
                  </Select>
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
                title="Account Balance Report Preview"
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
                        Select the As Of Date and Account Group on the left and click "Generate Report"
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
