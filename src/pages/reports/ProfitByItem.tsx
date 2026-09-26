import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Table, Tag, Statistic, Row, Col, Tabs
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  FileExcelOutlined,
  DollarOutlined, AppstoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type ProfitByItemResponse,
  type ProfitByItemLine
} from '../../services/reportService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ProfitByItem: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reportData, setReportData] = useState<ProfitByItemResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'pdf'>('grid');

  useEffect(() => {
    itemCategoryService.getActiveItemCategoriesLookup()
      .then(res => setCategories(res || []))
      .catch(console.error);

    loadItems();
  }, []);

  const loadItems = (catCode?: string) => {
    inventoryService.getItemsLookup(catCode)
      .then(res => setItems(res || []))
      .catch(console.error);
  };

  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      categoryId: undefined,
      itemId: undefined
    });
    fetchReport({
      dateRange: [startOfMonth, today],
      categoryId: undefined,
      itemId: undefined
    });
  }, [form]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handleCategoryChange = (val: string | undefined) => {
    form.setFieldsValue({ itemId: undefined });
    loadItems(val);
  };

  const fetchReport = async (values: any) => {
    setLoading(true);
    try {
      const fromDate = values.dateRange[0].format('YYYY-MM-DD');
      const toDate = values.dateRange[1].format('YYYY-MM-DD');
      const categoryId = values.categoryId || undefined;
      const itemId = values.itemId || undefined;

      const data = await reportService.getProfitByItem({
        fromDate,
        toDate,
        categoryId,
        itemId
      });
      setReportData(data);

      // Also trigger PDF generation in background
      setPdfLoading(true);
      reportService.getProfitByItemPdf({ fromDate, toDate, categoryId, itemId })
        .then(blob => {
          if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
          setPdfBlobUrl(URL.createObjectURL(blob));
        })
        .catch(console.error)
        .finally(() => setPdfLoading(false));

      message.success('Profit by Item report updated');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to load Profit by Item report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = `ProfitByItem_${dayjs().format('YYYYMMDD_HHmm')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintPdf = () => {
    if (!pdfBlobUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = pdfBlobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error(e);
        }
      }, 300);
    };
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.lines.length) {
      message.warning('No data to export');
      return;
    }

    const headers = ['Item Code', 'Description', 'Category', 'Unit', 'Qty Sold', 'Avg Sale Rate', 'Sales (Rs.)', 'Avg Cost Rate', 'Cost Amount (Rs.)', 'Gross Profit (Rs.)', 'Margin %'];
    const rows = reportData.lines.map(l => [
      `"${l.itemId}"`,
      `"${l.itemTitle.replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${l.unit || ''}"`,
      l.totalQty,
      l.avgSaleRate.toFixed(2),
      l.totalSales.toFixed(2),
      l.avgCostRate.toFixed(2),
      l.totalCost.toFixed(2),
      l.grossProfit.toFixed(2),
      `${l.grossMarginPct.toFixed(1)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ProfitByItem_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      title: 'Item Code',
      dataIndex: 'itemId',
      key: 'itemId',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: 'Product Title',
      dataIndex: 'itemTitle',
      key: 'itemTitle',
      render: (text: string, row: ProfitByItemLine) => (
        <div>
          <Text strong>{text}</Text>
          {row.category && <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{row.category}</div>}
        </div>
      )
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      render: (val: string) => val || '-'
    },
    {
      title: 'Qty Sold',
      dataIndex: 'totalQty',
      key: 'totalQty',
      align: 'right' as const,
      width: 100,
      render: (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 2 })
    },
    {
      title: 'Avg Sale Rate',
      dataIndex: 'avgSaleRate',
      key: 'avgSaleRate',
      align: 'right' as const,
      width: 110,
      render: (val: number) => val.toFixed(2)
    },
    {
      title: 'Sales (Rs.)',
      dataIndex: 'totalSales',
      key: 'totalSales',
      align: 'right' as const,
      width: 130,
      render: (val: number) => (
        <Text strong style={{ color: '#0958d9' }}>
          {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: 'Avg Cost Rate',
      dataIndex: 'avgCostRate',
      key: 'avgCostRate',
      align: 'right' as const,
      width: 110,
      render: (val: number) => val.toFixed(2)
    },
    {
      title: 'Cost Amount (Rs.)',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right' as const,
      width: 130,
      render: (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      title: 'Gross Profit (Rs.)',
      dataIndex: 'grossProfit',
      key: 'grossProfit',
      align: 'right' as const,
      width: 140,
      render: (val: number) => {
        const isPos = val >= 0;
        return (
          <Text strong style={{ color: isPos ? '#389e0d' : '#cf1322' }}>
            {isPos ? '' : '('}
            {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {isPos ? '' : ')'}
          </Text>
        );
      }
    },
    {
      title: 'Margin %',
      dataIndex: 'grossMarginPct',
      key: 'grossMarginPct',
      align: 'right' as const,
      width: 100,
      render: (val: number) => (
        <Tag color={val >= 25 ? 'green' : val >= 12 ? 'blue' : val > 0 ? 'orange' : 'red'}>
          {val.toFixed(1)}%
        </Tag>
      )
    }
  ];

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Profit by Item</Title>
          <Text type="secondary">Unit sales margins and item cost breakdown</Text>
        </div>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExportCsv}>Export CSV</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrintPdf} disabled={!pdfBlobUrl}>Print</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPdf} disabled={!pdfBlobUrl}>Download PDF</Button>
        </Space>
      </div>

      {/* Filter Card */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={fetchReport} style={{ gap: '12px', alignItems: 'center' }}>
          <Form.Item name="categoryId" label="Category" style={{ minWidth: 180 }}>
            <Select
              allowClear
              placeholder="All Categories"
              onChange={handleCategoryChange}
              options={categories.map(c => ({
                value: c.code,
                label: c.title
              }))}
            />
          </Form.Item>

          <Form.Item name="itemId" label="Item / Product" style={{ minWidth: 240 }}>
            <Select
              allowClear
              showSearch
              placeholder="All Items"
              optionFilterProp="children"
              filterOption={(input, option) =>
                ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
              }
              options={items.map(i => ({
                value: i.id,
                label: `${i.title} (${i.id})`
              }))}
            />
          </Form.Item>

          <Form.Item name="dateRange" label="Date Range" rules={[{ required: true, message: 'Please select dates' }]}>
            <RangePicker presets={rangePresets} format="DD-MMM-YYYY" allowClear={false} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              Generate
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* KPI Cards */}
      {reportData && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
              <Statistic
                title="Gross Profit"
                value={reportData.grossProfit}
                precision={2}
                prefix={<DollarOutlined />}
                suffix={<span style={{ fontSize: '14px', marginLeft: 8 }}>({reportData.grossMarginPct.toFixed(1)}%)</span>}
                valueStyle={{ color: reportData.grossProfit >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #1677ff' }}>
              <Statistic
                title="Total Revenue (Sales)"
                value={reportData.totalSales}
                precision={2}
                prefix="Rs."
                valueStyle={{ color: '#0958d9' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #faad14' }}>
              <Statistic
                title="Total Cost of Sales"
                value={reportData.totalCost}
                precision={2}
                prefix="Rs."
                valueStyle={{ color: '#d46b08' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
              <Statistic
                title="Products / Qty Sold"
                value={reportData.itemCount}
                prefix={<AppstoreOutlined />}
                suffix={<span style={{ fontSize: '14px' }}>| {reportData.totalQtySold.toLocaleString()} units</span>}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Tabs (Table Grid vs PDF Preview) */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        items={[
          {
            key: 'grid',
            label: 'Interactive Grid',
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table
                  dataSource={reportData?.lines || []}
                  columns={columns}
                  rowKey="itemId"
                  loading={loading}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} items` }}
                  locale={{ emptyText: <Empty description="No profit data for the selected period" /> }}
                />
              </Card>
            )
          },
          {
            key: 'pdf',
            label: 'PDF Document Preview',
            children: (
              <Card bodyStyle={{ padding: 0, height: '750px' }}>
                {pdfLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Spin size="large" tip="Generating PDF report..." />
                  </div>
                ) : pdfBlobUrl ? (
                  <iframe src={pdfBlobUrl} style={{ width: '100%', height: '750px', border: 'none' }} title="Profit By Item PDF" />
                ) : (
                  <Empty description="No PDF generated" />
                )}
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};
