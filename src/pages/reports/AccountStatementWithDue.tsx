import React, { useState, useEffect } from 'react';
import {
  Typography, Form, DatePicker, Select, Button,
  Space, message, Radio, Empty, Spin, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, FileTextOutlined,
  DownloadOutlined, ExportOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, FilterOutlined, FileExcelOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type AccountStatementWithDueLine } from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const AccountStatementWithDue: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('AccountStatementWithDue.pdf');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAccountTitle, setSelectedAccountTitle] = useState<string>('');
  const [statementData, setStatementData] = useState<(AccountStatementWithDueLine & { balance: number })[]>([]);

  useEffect(() => {
    chartOfAccountService.getActiveAccounts().then(res => {
      const detailAccounts = res.filter(a => a.accType === 'Detail');
      setAccounts(detailAccounts.map(a => ({ account: a.account, title: a.title })));
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
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        account: values.account,
        dateBasis: values.dateBasis || 'VoucherDate'
      };

      const matched = accounts.find(a => a.account === values.account);
      setSelectedAccountTitle(matched?.title || values.account);

      // Fetch PDF stream and structured line data concurrently
      const [blob, rawLines] = await Promise.all([
        reportService.getAccountStatementWithDuePdf(filter),
        reportService.getAccountStatementWithDue(filter)
      ]);

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      // Calculate running balance for Excel / CSV export
      let runningBalance = 0;
      const linesWithBalance = rawLines.map(line => {
        runningBalance += (line.dr - line.cr);
        return { ...line, balance: runningBalance };
      });
      setStatementData(linesWithBalance);

      const fileName = `AccountStatementWithDue_${values.account}_${values.dateRange[0].format('YYYYMMDD')}_${values.dateRange[1].format('YYYYMMDD')}.pdf`;
      setCurrentFileName(fileName);
    } catch (error) {
      console.error('Failed to load account statement with due', error);
      message.error('Failed to generate Account Statement with Due');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = currentFileName;
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
    if (!statementData || statementData.length === 0) {
      message.warning('No data available to export');
      return;
    }
    const values = form.getFieldsValue();
    const fileName = `AccountStatementWithDue_${values.account || 'Account'}_${values.dateRange[0].format('YYYYMMDD')}_${values.dateRange[1].format('YYYYMMDD')}.csv`;

    const headers = ['Date', 'Voucher #', 'Particulars / Narration', 'Due Days', 'Due Date', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
    const rows = statementData.map(line => {
      const dueDateStr = line.dueDays !== null && line.dueDays !== undefined
        ? dayjs(line.vDate).add(line.dueDays, 'day').format('DD-MMM-YYYY')
        : '';
      return [
        line.vDate,
        `"${(line.vNo || '').replace(/"/g, '""')}"`,
        `"${(line.particular || '').replace(/"/g, '""')}"`,
        line.dueDays !== null && line.dueDays !== undefined ? `${line.dueDays}d` : '',
        dueDateStr,
        line.dr.toFixed(2),
        line.cr.toFixed(2),
        line.balance.toFixed(2)
      ];
    });

    const totalDr = statementData.reduce((sum, x) => sum + x.dr, 0);
    const totalCr = statementData.reduce((sum, x) => sum + x.cr, 0);
    const finalBal = statementData.length > 0 ? statementData[statementData.length - 1].balance : 0;
    rows.push(['', '', '"TOTALS & NET MOVEMENT"', '', '', totalDr.toFixed(2), totalCr.toFixed(2), finalBal.toFixed(2)]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Account statement with due exported to CSV');
  };

  const handleExportExcel = () => {
    if (!statementData || statementData.length === 0) {
      message.warning('No data available to export');
      return;
    }
    const values = form.getFieldsValue();
    const fileName = `AccountStatementWithDue_${values.account || 'Account'}_${values.dateRange[0].format('YYYYMMDD')}_${values.dateRange[1].format('YYYYMMDD')}.xls`;

    let totalDr = 0;
    let totalCr = 0;

    let rowsHtml = '';
    statementData.forEach((line, idx) => {
      totalDr += line.dr;
      totalCr += line.cr;
      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      const dueDateStr = line.dueDays !== null && line.dueDays !== undefined
        ? dayjs(line.vDate).add(line.dueDays, 'day').format('DD-MMM-YYYY')
        : '-';
      const dueDaysStr = line.dueDays !== null && line.dueDays !== undefined ? `${line.dueDays} d` : '-';

      rowsHtml += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #e5e7eb; padding: 5px;">${line.vDate}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px;">${line.vNo || ''}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px;">${line.particular || ''}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px; text-align: center;">${dueDaysStr}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px; text-align: center;">${dueDateStr}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px; text-align: right;">${line.dr > 0 ? line.dr.toFixed(2) : '-'}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px; text-align: right;">${line.cr > 0 ? line.cr.toFixed(2) : '-'}</td>
          <td style="border: 1px solid #e5e7eb; padding: 5px; text-align: right; font-weight: bold;">${line.balance.toFixed(2)}</td>
        </tr>
      `;
    });

    const finalBal = statementData.length > 0 ? statementData[statementData.length - 1].balance : 0;

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Account Statement with Due</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family: Segoe UI, Arial, sans-serif;">
        <table>
          <tr>
            <td colspan="8" style="font-size: 16px; font-weight: bold; color: #1e3a8a; padding: 8px 0;">
              ACCOUNT STATEMENT (WITH DUE DAYS)
            </td>
          </tr>
          <tr>
            <td colspan="8" style="font-size: 12px; font-weight: bold; color: #374151;">
              Account: ${selectedAccountTitle || values.account}
            </td>
          </tr>
          <tr>
            <td colspan="8" style="font-size: 11px; color: #6b7280; padding-bottom: 10px;">
              Period: ${values.dateRange[0].format('DD-MMM-YYYY')} to ${values.dateRange[1].format('DD-MMM-YYYY')} | Basis: ${values.dateBasis || 'Voucher Date'}
            </td>
          </tr>
          <thead>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">Date</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">Voucher #</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">Particulars / Narration</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">Due Days</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">Due Date</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">Debit (Dr)</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">Credit (Cr)</th>
              <th style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="5" style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">TOTALS & NET MOVEMENT</td>
              <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${totalDr.toFixed(2)}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${totalCr.toFixed(2)}</td>
              <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${finalBal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Account statement with due exported to Excel');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '16px',
        height: 'calc(100vh - 180px)',
        minHeight: '650px',
        width: '100%',
        alignItems: 'stretch'
      }}
    >
      {/* Left Column: Parameters Panel */}
      {!sidebarCollapsed ? (
        <div
          style={{
            width: '320px',
            minWidth: '320px',
            maxWidth: '320px',
            flexShrink: 0,
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="bg-gray-50/90 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              <Space align="center">
                <FilterOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                <Text strong style={{ fontSize: 14 }}>Parameters</Text>
              </Space>
              <Tooltip title="Collapse sidebar for wider preview">
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setSidebarCollapsed(true)}
                />
              </Tooltip>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSearch}
              initialValues={{
                dateRange: [dayjs().startOf('month'), dayjs()],
                dateBasis: 'VoucherDate'
              }}
            >
              <Form.Item
                name="dateRange"
                label={<Text strong style={{ fontSize: 12 }}>Date Range</Text>}
                rules={[{ required: true, message: 'Select date range' }]}
                style={{ marginBottom: 12 }}
              >
                <DatePicker.RangePicker
                  format="DD-MMM-YYYY"
                  presets={rangePresets}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="dateBasis"
                label={<Text strong style={{ fontSize: 12 }}>Accounting Basis</Text>}
                style={{ marginBottom: 12 }}
              >
                <Radio.Group buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
                  <Radio.Button value="VoucherDate" style={{ flex: 1, textAlign: 'center' }}>
                    Voucher Date
                  </Radio.Button>
                  <Radio.Button value="ClearingDate" style={{ flex: 1, textAlign: 'center' }}>
                    Clearing Date
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="account"
                label={<Text strong style={{ fontSize: 12 }}>Account Head</Text>}
                rules={[{ required: true, message: 'Select an account' }]}
                style={{ marginBottom: 16 }}
              >
                <Select
                  showSearch
                  placeholder="Search account..."
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                >
                  {accounts.map(acc => (
                    <Select.Option key={acc.account} value={acc.account}>
                      {acc.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Button
                type="primary"
                icon={<SearchOutlined />}
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{ height: 40, fontWeight: 600 }}
              >
                Show Report
              </Button>
            </Form>
          </div>

          {pdfUrl && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700/60">
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Active Account</Text>
              <Text strong style={{ fontSize: 13 }} className="truncate block">
                {selectedAccountTitle}
              </Text>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: '44px',
            minWidth: '44px',
            maxWidth: '44px',
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '16px'
          }}
          className="bg-gray-50/90 dark:bg-gray-800/40 rounded-xl border border-gray-200/80 dark:border-gray-700/60"
        >
          <Tooltip title="Expand Parameters Panel" placement="right">
            <Button
              type="primary"
              size="middle"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setSidebarCollapsed(false)}
            />
          </Tooltip>
        </div>
      )}

      {/* Right Column: PDF Preview Canvas */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="bg-gray-100/80 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200/80 dark:border-gray-700/60 shadow-inner"
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-3 px-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <Space align="center">
            <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={5} style={{ margin: 0 }}>Account Statement with Due</Title>
          </Space>

          {pdfUrl && (
            <Space wrap>
              <Tooltip title="Direct 1-click print">
                <Button icon={<PrinterOutlined />} onClick={handleDirectPrint}>
                  Print PDF
                </Button>
              </Tooltip>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                Download PDF
              </Button>
              <Button
                icon={<FileExcelOutlined style={{ color: '#16a34a' }} />}
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
              <Button icon={<FileTextOutlined />} onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Tooltip title="Open in dedicated tab">
                <Button icon={<ExportOutlined />} onClick={handleOpenInNewTab} />
              </Tooltip>
            </Space>
          )}
        </div>

        {/* PDF Document Canvas */}
        <div style={{ flex: 1, minHeight: 0, paddingTop: '12px' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <Spin size="large" />
              <Text type="secondary" className="mt-4" style={{ fontSize: 13 }}>
                Generating statement...
              </Text>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#view=FitH`}
              title="Account Statement with Due Preview"
              className="w-full h-full rounded-lg border-0 bg-white shadow-sm"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <Empty
                description={
                  <div>
                    <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                      No Statement Loaded
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Select an account and date range on the left panel, then click <b>Show Report</b> to view the full statement with due days.
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
