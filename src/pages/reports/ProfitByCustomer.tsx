import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Space, message, Spin, Empty, Table, Tag, Statistic, Row, Col, Tabs
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DownloadOutlined,
  FileExcelOutlined,
  DollarOutlined, TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  reportService,
  type ProfitByCustomerResponse,
  type ProfitByCustomerLine,
  type ProfitByCustomerDetailLine
} from '../../services/reportService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ProfitByCustomer: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [reportData, setReportData] = useState<ProfitByCustomerResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'pdf'>('grid');

  useEffect(() => {
    chartOfAccountService.getCustomerAccounts()
      .then(res => setCustomers(res || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const startOfMonth = dayjs().startOf('month');
    const today = dayjs();
    form.setFieldsValue({
      dateRange: [startOfMonth, today],
      customerAccount: undefined
    });
    fetchReport({
      dateRange: [startOfMonth, today],
      customerAccount: undefined
    });
  }, [form]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const fetchReport = async (values: any) => {
    setLoading(true);
    try {
      const fromDate = values.dateRange[0].format('YYYY-MM-DD');
      const toDate = values.dateRange[1].format('YYYY-MM-DD');
      const customerAccount = values.customerAccount || undefined;

      const data = await reportService.getProfitByCustomer({
        fromDate,
        toDate,
        customerAccount
      });
      setReportData(data);

      // Also trigger PDF generation in background
      setPdfLoading(true);
      reportService.getProfitByCustomerPdf({ fromDate, toDate, customerAccount })
        .then(blob => {
          if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
          setPdfBlobUrl(URL.createObjectURL(blob));
        })
        .catch(console.error)
        .finally(() => setPdfLoading(false));

      message.success('Profit by Customer report updated');
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Failed to load Profit by Customer report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = `ProfitByCustomer_${dayjs().format('YYYYMMDD_HHmm')}.pdf`;
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

    const headers = ['Account #', 'Customer Name', 'City', 'Phone', 'Invoices', 'Qty Sold', 'Sales (Rs.)', 'Cost Amount (Rs.)', 'Gross Profit (Rs.)', 'Margin %'];
    const rows = reportData.lines.map(l => [
      `"${l.accountId}"`,
      `"${l.accountTitle.replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      l.invoiceCount,
      l.totalQty,
      l.totalSales.toFixed(2),
      l.totalCost.toFixed(2),
      l.grossProfit.toFixed(2),
      `${l.grossMarginPct.toFixed(1)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ProfitByCustomer_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      title: 'Account #',
      dataIndex: 'accountId',
      key: 'accountId',
      width: 100,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: 'Customer Name',
      dataIndex: 'accountTitle',
      key: 'accountTitle',
      render: (text: string, row: ProfitByCustomerLine) => (
        <div>
          <Text strong>{text}</Text>
          {row.city && <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{row.city}</div>}
        </div>
      )
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (val: string) => val || '-'
    },
    {
      title: 'Invoices',
      dataIndex: 'invoiceCount',
      key: 'invoiceCount',
      align: 'right' as const,
      width: 90
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
        <Tag color={val >= 20 ? 'green' : val >= 10 ? 'blue' : val > 0 ? 'orange' : 'red'}>
          {val.toFixed(1)}%
        </Tag>
      )
    }
  ];

  const expandedRowRender = (record: ProfitByCustomerLine) => {
    if (!record.details || record.details.length === 0) {
      return <Empty description="No transaction details available" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const detailColumns = [
      {
        title: 'Date',
        dataIndex: 'vDate',
        key: 'vDate',
        render: (d: string) => dayjs(d).format('DD-MMM-YYYY')
      },
      {
        title: 'Voucher #',
        dataIndex: 'vNo',
        key: 'vNo',
        render: (v: string, row: ProfitByCustomerDetailLine) => (
          <span>
            <Tag color={row.vType === 'SR' ? 'orange' : 'blue'}>{row.vType}</Tag>
            {v}
          </span>
        )
      },
      {
        title: 'Item Title',
        dataIndex: 'itemTitle',
        key: 'itemTitle'
      },
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
        width: 70
      },
      {
        title: 'Qty',
        dataIndex: 'qty',
        key: 'qty',
        align: 'right' as const,
        render: (val: number) => val.toLocaleString(undefined, { maximumFractionDigits: 2 })
      },
      {
        title: 'Sale Rate',
        dataIndex: 'saleRate',
        key: 'saleRate',
        align: 'right' as const,
        render: (val: number) => val.toFixed(2)
      },
      {
        title: 'Sale Amt',
        dataIndex: 'saleAmount',
        key: 'saleAmount',
        align: 'right' as const,
        render: (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      },
      {
        title: 'Cost Price',
        dataIndex: 'costPrice',
        key: 'costPrice',
        align: 'right' as const,
        render: (val: number) => val.toFixed(2)
      },
      {
        title: 'Cost Amount',
        dataIndex: 'costAmount',
        key: 'costAmount',
        align: 'right' as const,
        render: (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      },
      {
        title: 'Profit',
        dataIndex: 'profit',
        key: 'profit',
        align: 'right' as const,
        render: (val: number) => (
          <Text strong style={{ color: val >= 0 ? '#389e0d' : '#cf1322' }}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )
      },
      {
        title: 'Margin %',
        dataIndex: 'marginPct',
        key: 'marginPct',
        align: 'right' as const,
        render: (val: number) => `${val.toFixed(1)}%`
      }
    ];

    return (
      <Table
        columns={detailColumns}
        dataSource={record.details}
        rowKey={(d) => `${d.vNo}-${d.itemId}-${d.vDate}`}
        pagination={false}
        size="small"
        bordered
      />
    );
  };

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Profit by Customer</Title>
          <Text type="secondary">Real-time customer sales, cost, and profitability analysis</Text>
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
          <Form.Item name="customerAccount" label="Customer" style={{ minWidth: 260 }}>
            <Select
              allowClear
              showSearch
              placeholder="All Customers"
              optionFilterProp="children"
              filterOption={(input, option) =>
                ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.account,
                label: `${c.account} - ${c.title}`
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
                title="Customers / Qty Sold"
                value={reportData.customerCount}
                prefix={<TeamOutlined />}
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
                  rowKey="accountId"
                  loading={loading}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} customers` }}
                  expandable={{
                    expandedRowRender,
                    rowExpandable: (record) => Boolean(record.details && record.details.length > 0)
                  }}
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
                  <iframe src={pdfBlobUrl} style={{ width: '100%', height: '750px', border: 'none' }} title="Profit By Customer PDF" />
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
