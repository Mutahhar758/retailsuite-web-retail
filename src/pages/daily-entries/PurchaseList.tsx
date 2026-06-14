import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ShoppingCartOutlined, 
  SearchOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseService, type Purchase } from '../../services/purchaseService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const PurchaseList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [form] = Form.useForm();

  const fetchLookups = async () => {
    try {
      const vends = await chartOfAccountService.getDetailAccounts();
      setVendors(vends);
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
        account: values.account,
        voucherNo: values.voucherNo
      };
      const result = await purchaseService.getList(params);
      setData(result);
    } catch (error) {
      message.error('Failed to fetch purchase vouchers');
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
      render: (text: string) => <Tag color="blue">PU-{text}</Tag>,
    },
    {
      title: 'Vendor',
      dataIndex: 'account',
      key: 'account',
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
      render: (_: any, record: Purchase) => (
        <Button 
          type="primary" 
          icon={<EditOutlined />} 
          size="small"
          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          onClick={() => navigate(`/daily-entries/purchase/${record.voucherNo}`)}
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
          <ShoppingCartOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Purchase Vouchers</Title>
            <Text type="secondary">Manage your stock purchases and vendor invoices</Text>
          </div>
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/daily-entries/purchase/new')}
          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
        >
          New Purchase
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
        <Form.Item name="account" label="Vendor">
          <Select 
            placeholder="All Vendors" 
            style={{ width: 200 }} 
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {vendors.map(v => (
              <Select.Option key={v.account} value={v.account}>{v.title}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="voucherNo" label="Voucher #">
          <Input placeholder="Search #" prefix={<SearchOutlined />} allowClear />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>Search</Button>
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
          onDoubleClick: () => navigate(`/daily-entries/purchase/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
