import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, FileTextOutlined, 
  SearchOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { journalVoucherService, type JournalVoucherDto } from '../../services/journalVoucherService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const JournalVoucherList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<JournalVoucherDto[]>([]);
  const [form] = Form.useForm();

  const fetchData = useCallback(async (values: any = {}) => {
    try {
      setLoading(true);
      const params = {
        fromDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        toDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
        narration: values.narration,
        voucherNo: values.voucherNo
      };
      const result = await journalVoucherService.getList(params);
      setData(result);
    } catch (error) {
      message.error('Failed to fetch journal vouchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
      render: (text: string) => <Tag color="green">JV-{text}</Tag>,
    },
    {
      title: 'Narration',
      dataIndex: 'narration',
      key: 'narration',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#16a34a' }}>
          {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
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
      render: (_: any, record: JournalVoucherDto) => (
        <Button 
          type="primary" 
          icon={<EditOutlined />} 
          size="small"
          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          onClick={() => navigate(`/daily-entries/journal-voucher/${record.voucherNo}`)}
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
          <FileTextOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Journal Vouchers</Title>
            <Text type="secondary">Manage general journal entries</Text>
          </div>
        </Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          onClick={() => navigate('/daily-entries/journal-voucher/new')}
        >
          New Journal
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
          onDoubleClick: () => navigate(`/daily-entries/journal-voucher/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
