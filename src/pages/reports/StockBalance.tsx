import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DatabaseOutlined,
  CalendarOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type StockBalanceLine } from '../../services/reportService';
import api from '../../services/api';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const StockBalance: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ code: string; title: string }[]>([]);
  const [data, setData] = useState<StockBalanceLine[]>([]);

  useEffect(() => {
    api.get('/api/itemcategories').then(res => {
      setCategories(res.data.body);
    });
  }, []);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        catagory: values.category
      };
      const res = await reportService.getStockBalance(filter);
      setData(res);
    } catch (error) {
      message.error('Failed to load stock balance report');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Item Description',
      dataIndex: 'item',
      key: 'item',
      sorter: (a: StockBalanceLine, b: StockBalanceLine) => a.item.localeCompare(b.item),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: 'Opening',
      dataIndex: 'priQty',
      key: 'priQty',
      align: 'right' as const,
      width: 120,
      render: (val: number) => val.toLocaleString()
    },
    {
      title: 'Qty In',
      dataIndex: 'qtyIn',
      key: 'qtyIn',
      align: 'right' as const,
      width: 100,
      render: (val: number) => val !== 0 ? <Text type="success">{val.toLocaleString()}</Text> : '-'
    },
    {
      title: 'Qty Out',
      dataIndex: 'qtyOut',
      key: 'qtyOut',
      align: 'right' as const,
      width: 100,
      render: (val: number) => val !== 0 ? <Text type="danger">{val.toLocaleString()}</Text> : '-'
    },
    {
      title: 'Balance',
      dataIndex: 'qtyBal',
      key: 'qtyBal',
      align: 'right' as const,
      width: 120,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      align: 'right' as const,
      width: 120,
      render: (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      title: 'Value',
      key: 'value',
      align: 'right' as const,
      width: 150,
      render: (_: any, record: StockBalanceLine) => (record.qtyBal * record.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <DatabaseOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Stock Balance Report</Title>
            <Text type="secondary">Current inventory levels and valuation</Text>
          </div>
        </Space>
        <Button icon={<PrinterOutlined />} disabled={data.length === 0} onClick={() => window.print()} className="no-print">Print Report</Button>
      </div>

      <Form
        form={form}
        layout="inline"
        className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-print"
        onFinish={handleSearch}
        initialValues={{
          dateRange: [dayjs().startOf('month'), dayjs()]
        }}
      >
        <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
          <DatePicker.RangePicker format="DD-MMM-YYYY" presets={rangePresets} />
        </Form.Item>
        <Form.Item name="category" label="Category" style={{ minWidth: 200 }}>
          <Select placeholder="All Categories" allowClear prefix={<FilterOutlined />}>
            {categories.map(cat => (
              <Select.Option key={cat.code} value={cat.code}>{cat.title}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
            Show Report
          </Button>
        </Form.Item>
      </Form>

      {data.length > 0 && (
        <div id="printable-report">
          <div className="text-center mb-6">
            <Title level={3}>Stock Balance Report</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey="item"
            bordered
            size="small"
            summary={pageData => {
                let totalValue = 0;
                pageData.forEach(row => {
                  totalValue += (row.qtyBal * row.rate);
                });
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="bg-gray-50 font-bold">
                      <Table.Summary.Cell index={0} colSpan={7} align="right">Total Inventory Value</Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
          />
        </div>
      )}
    </Card>
  );
};
