import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, Tag, message, Divider
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, DatabaseOutlined,
  CalendarOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportService, type StockLedgerLine } from '../../services/reportService';
import api from '../../services/api';
import { rangePresets } from '../../utils/datePresets';

const { Title, Text } = Typography;

export const ItemLedger: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [data, setData] = useState<(StockLedgerLine & { balance: number })[]>([]);
  const [itemTitle, setItemTitle] = useState('');

  useEffect(() => {
    api.get('/api/inventory/items').then(res => {
      const allItems: any[] = res.data.body || [];
      const productItems = allItems.filter(i => i.itemType !== 'Service');
      setItems(productItems);
    });
  }, []);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const filter = {
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        fkItem: values.item
      };
      const res = await reportService.getStockLedger(filter);
      
      let currentQty = 0;
      const dataWithBalance = res.map(row => {
        currentQty += (row.qtyIn - row.qtyOut);
        return { ...row, balance: currentQty };
      });
      
      setData(dataWithBalance);
      const selectedItem = items.find(i => i.id === values.item);
      setItemTitle(selectedItem?.title || '');
    } catch (error) {
      message.error('Failed to load item ledger');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'vdate',
      key: 'vdate',
      width: 120,
      render: (date: string) => dayjs(date).format('DD-MMM-YYYY')
    },
    {
      title: 'Voucher #',
      dataIndex: 'vno',
      key: 'vno',
      width: 120,
      render: (vno: string) => vno ? <Tag color="orange">{vno}</Tag> : '-'
    },
    {
      title: 'Account/Particulars',
      dataIndex: 'particular',
      key: 'particular',
    },
    {
      title: 'Qty In',
      dataIndex: 'qtyIn',
      key: 'qtyIn',
      align: 'right' as const,
      width: 100,
      render: (val: number) => val > 0 ? <Text type="success">{val.toLocaleString()}</Text> : '-'
    },
    {
      title: 'Qty Out',
      dataIndex: 'qtyOut',
      key: 'qtyOut',
      align: 'right' as const,
      width: 100,
      render: (val: number) => val > 0 ? <Text type="danger">{val.toLocaleString()}</Text> : '-'
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: 120,
      render: (val: number) => <Text strong>{val.toLocaleString()}</Text>
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      align: 'right' as const,
      width: 100,
      render: (val: number | null) => val ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6 no-print">
        <Space align="center">
          <DatabaseOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Item Ledger</Title>
            <Text type="secondary">Detailed transaction history for specific items</Text>
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
        <Form.Item name="item" label="Select Item" rules={[{ required: true }]} style={{ minWidth: 300 }}>
          <Select 
            showSearch 
            placeholder="Search item..." 
            optionFilterProp="children"
            prefix={<ShoppingCartOutlined />}
          >
            {items.map(i => (
              <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
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
            <Title level={3}>{itemTitle}</Title>
            <Space split={<Divider type="vertical" />}>
              <span><CalendarOutlined /> {form.getFieldValue('dateRange')[0].format('DD-MMM-YYYY')} to {form.getFieldValue('dateRange')[1].format('DD-MMM-YYYY')}</span>
            </Space>
          </div>

          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            loading={loading}
            rowKey={(record, index) => `${record.vno}-${index}`}
            bordered
            size="small"
          />
        </div>
      )}
    </Card>
  );
};
