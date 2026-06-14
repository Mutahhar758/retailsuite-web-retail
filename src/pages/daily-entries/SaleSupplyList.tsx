import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, TruckOutlined, 
  SearchOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleSupplyService, type SaleSupply } from '../../services/saleSupplyService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const SaleSupplyList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleSupply[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [form] = Form.useForm();

  const fetchLookups = async () => {
    try {
      const itms = await inventoryService.getItems();
      setItems(itms);
    } catch (error) {
      console.error('Failed to load lookups', error);
    }
  };

  const fetchData = useCallback(async (values: any = {}) => {
    try {
      setLoading(true);
      const params = {
        fromDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        toDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
        itemId: values.itemId,
        voucherNo: values.voucherNo
      };
      const result = await saleSupplyService.getList(params);
      setData(result);
    } catch (error) {
      message.error('Failed to fetch sale supply vouchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLookups();
    fetchData({
      dateRange: [dayjs().startOf('month'), dayjs()]
    });
  }, [fetchData]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => dayjs(text).format('DD-MMM-YYYY'),
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      render: (text: string) => <Tag color="orange">SP-{text}</Tag>,
    },
    {
      title: 'Item Supplied',
      dataIndex: 'item',
      key: 'item',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '13px' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px', fontWeight: 500 }}>
            {dayjs(record.createdOn).format('DD-MMM-YYYY hh:mm A')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_: any, record: SaleSupply) => (
        <Button 
          type="primary" 
          icon={<EditOutlined />} 
          size="small"
          style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
          onClick={() => navigate(`/daily-entries/sale-supply/${record.voucherNo}`)}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <TruckOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Sale Supply Vouchers</Title>
            <Text type="secondary">Manage multi-customer bulk item distributions</Text>
          </div>
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/daily-entries/sale-supply/new')}
          style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
        >
          New Sale Supply
        </Button>
      </div>

      <Form
        form={form}
        layout="inline"
        className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
        onFinish={fetchData}
        initialValues={{
          dateRange: [dayjs().startOf('month'), dayjs()]
        }}
      >
        <Form.Item name="dateRange" label="Date Range">
          <RangePicker format="DD-MMM-YYYY" />
        </Form.Item>
        <Form.Item name="itemId" label="Item">
          <Select 
            placeholder="All Items" 
            style={{ width: 200 }} 
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {items.map(i => (
              <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="voucherNo" label="Voucher #">
          <Input placeholder="Search #" prefix={<SearchOutlined />} allowClear />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}>Search</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); fetchData(); }}>Reset</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading}
        rowKey="voucherNo"
        pagination={{ pageSize: 10 }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/daily-entries/sale-supply/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
