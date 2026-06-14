import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, UndoOutlined, 
  SearchOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleReturnService, type SaleReturn } from '../../services/saleReturnService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const SaleReturnList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleReturn[]>([]);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [form] = Form.useForm();

  const fetchLookups = async () => {
    try {
      const custs = await chartOfAccountService.getCustomerAccounts();
      setCustomers(custs);
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
      const result = await saleReturnService.getList(params);
      setData(result);
    } catch (error) {
      message.error('Failed to fetch sale return vouchers');
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
      render: (text: string) => <Tag color="error">SR-{text}</Tag>,
    },
    {
      title: 'Customer',
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
      render: (_: any, record: SaleReturn) => (
        <Button 
          type="primary" 
          icon={<EditOutlined />} 
          size="small"
          danger
          onClick={() => navigate(`/daily-entries/sale-return/${record.voucherNo}`)}
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
          <UndoOutlined style={{ fontSize: 24, color: '#e11d48' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Sale Returns</Title>
            <Text type="secondary">Process and manage customer product returns</Text>
          </div>
        </Space>
        <Button 
          type="primary" 
          danger
          icon={<PlusOutlined />} 
          onClick={() => navigate('/daily-entries/sale-return/new')}
        >
          New Sale Return
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
        <Form.Item name="account" label="Customer">
          <Select 
            placeholder="All Customers" 
            style={{ width: 200 }} 
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {customers.map(c => (
              <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="voucherNo" label="Voucher #">
          <Input placeholder="Search #" prefix={<SearchOutlined />} allowClear />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" danger htmlType="submit" icon={<SearchOutlined />}>Search</Button>
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
          onDoubleClick: () => navigate(`/daily-entries/sale-return/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
