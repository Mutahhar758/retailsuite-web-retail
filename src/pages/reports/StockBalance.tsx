import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Tooltip
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  ExportOutlined, FileExcelOutlined, FileTextOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, DatabaseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type StockBalanceLine } from '../../services/reportService';
import api from '../../services/api';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const StockBalance: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ code: string; title: string }[]>([]);
  const [stockData, setStockData] = useState<StockBalanceLine[] | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState('');

  useEffect(() => {
    api.get('/api/itemcategories').then(res => {
      setCategories(res.data.body || []);
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
        catagory: values.category
      };

      const selectedCat = categories.find(c => c.code === values.category);
      setSelectedCategoryTitle(selectedCat?.title || (values.category ? values.category : 'All Categories'));

      // Fetch vector PDF
      const pdfBlob = await reportService.getStockBalancePdf(filter);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const newUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(newUrl);

      // Also prefetch data lines for Excel/CSV exports
      try {
        const rawLines = await reportService.getStockBalance(filter);
        setStockData(rawLines);
      } catch (err) {
        console.warn('Could not prefetch raw stock lines for export', err);
      }

      message.success('Stock balance report generated');
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Failed to generate stock balance report');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (extension: string) => {
    const values = form.getFieldsValue();
    const fromStr = values.dateRange ? values.dateRange[0].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const toStr = values.dateRange ? values.dateRange[1].format('YYYYMMDD') : dayjs().format('YYYYMMDD');
    const catSafe = (selectedCategoryTitle || 'AllCategories').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `StockBalance_${catSafe}_${fromStr}_${toStr}.${extension}`;
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
    if (!stockData || stockData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const headers = ['#', 'Item / Product Name', 'Unit', 'Opening Qty', 'Inward (+)', 'Outward (-)', 'Closing Qty', 'Rate', 'Total Value'];
    let sumOpening = 0;
    let sumIn = 0;
    let sumOut = 0;
    let sumBal = 0;
    let sumVal = 0;

    const rows = stockData.map((line, idx) => {
      const val = line.qtyBal * line.rate;
      sumOpening += line.priQty;
      sumIn += line.qtyIn;
      sumOut += line.qtyOut;
      sumBal += line.qtyBal;
      sumVal += val;

      return [
        (idx + 1).toString(),
        `"${(line.item || '').replace(/"/g, '""')}"`,
        `"${(line.unit || 'Pcs').replace(/"/g, '""')}"`,
        line.priQty.toFixed(2),
        line.qtyIn.toFixed(2),
        line.qtyOut.toFixed(2),
        line.qtyBal.toFixed(2),
        line.rate.toFixed(2),
        val.toFixed(2)
      ];
    });

    rows.push([
      '',
      '"TOTAL SUMMARY"',
      '',
      sumOpening.toFixed(2),
      sumIn.toFixed(2),
      sumOut.toFixed(2),
      sumBal.toFixed(2),
      '-',
      sumVal.toFixed(2)
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
    if (!stockData || stockData.length === 0) {
      message.warning('No data available to export. Generate a report first.');
      return;
    }

    const values = form.getFieldsValue();
    const periodStr = values.dateRange
      ? `${values.dateRange[0].format('DD-MMM-YYYY')} to ${values.dateRange[1].format('DD-MMM-YYYY')}`
      : dayjs().format('DD-MMM-YYYY');

    let sumOpening = 0;
    let sumIn = 0;
    let sumOut = 0;
    let sumBal = 0;
    let sumVal = 0;

    let rowsHtml = '';
    stockData.forEach((line, idx) => {
      const val = line.qtyBal * line.rate;
      sumOpening += line.priQty;
      sumIn += line.qtyIn;
      sumOut += line.qtyOut;
      sumBal += line.qtyBal;
      sumVal += val;

      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      rowsHtml += `
        <tr style="background-color: ${bg};">
          <td style="text-align: center; border: 1px solid #e5e7eb; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 6px; font-weight: 500;">${line.item}</td>
          <td style="text-align: center; border: 1px solid #e5e7eb; padding: 6px;">${line.unit || 'Pcs'}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${line.priQty.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; color: ${line.qtyIn > 0 ? '#15803d' : '#374151'};">${line.qtyIn.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; color: ${line.qtyOut > 0 ? '#b91c1c' : '#374151'};">${line.qtyOut.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${line.qtyBal.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px;">${line.rate.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #e5e7eb; padding: 6px; font-weight: bold;">${val.toFixed(2)}</td>
        </tr>
      `;
    });

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
        <div class="header-title">STOCK BALANCE & INVENTORY VALUATION</div>
        <div class="sub-title">Category: <b>${selectedCategoryTitle || 'All Categories'}</b> &nbsp;|&nbsp; Period: <b>${periodStr}</b></div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Item / Product Name</th>
              <th style="width: 60px;">Unit</th>
              <th style="width: 90px;">Opening Qty</th>
              <th style="width: 90px;">Inward (+)</th>
              <th style="width: 90px;">Outward (-)</th>
              <th style="width: 100px;">Closing Qty</th>
              <th style="width: 80px;">Rate</th>
              <th style="width: 110px;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align: left; padding: 8px;">TOTAL SUMMARY</td>
              <td style="text-align: right; padding: 8px;">${sumOpening.toFixed(2)}</td>
              <td style="text-align: right; padding: 8px; color: #15803d;">${sumIn.toFixed(2)}</td>
              <td style="text-align: right; padding: 8px; color: #b91c1c;">${sumOut.toFixed(2)}</td>
              <td style="text-align: right; padding: 8px;">${sumBal.toFixed(2)}</td>
              <td style="text-align: right; padding: 8px;">-</td>
              <td style="text-align: right; padding: 8px;">Rs. ${sumVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
          <DatabaseOutlined style={{ fontSize: 20, color: '#16a34a' }} />
          <div>
            <Title level={5} style={{ margin: 0 }}>Stock Balance & Valuation</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedCategoryTitle ? `Category: ${selectedCategoryTitle}` : 'Comprehensive inventory audit and closing stock values'}
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

                <Form.Item
                  name="category"
                  label={<span style={{ fontSize: 12, fontWeight: 500 }}>Category (Optional)</span>}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="All Categories"
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                  >
                    {categories.map(cat => (
                      <Select.Option key={cat.code} value={cat.code}>
                        {cat.title}
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
                    Generate Balance
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
                title="Stock Balance Preview"
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
                        Select the Accounting Period and Category on the left and click "Generate Balance"
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
