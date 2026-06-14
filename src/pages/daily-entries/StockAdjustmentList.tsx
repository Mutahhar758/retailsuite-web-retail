import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Button, Form, DatePicker, Input, message, Tag } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { stockAdjustmentService, type StockAdjustmentMaster } from '../../services/stockAdjustmentService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const StockAdjustmentList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StockAdjustmentMaster[]>([]);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const fetchData = async (values?: any) => {
    setLoading(true);
    try {
      let startDate, endDate;
      if (values?.dateRange) {
        startDate = values.dateRange[0].format('YYYY-MM-DD');
        endDate = values.dateRange[1].format('YYYY-MM-DD');
      }
      const results = await stockAdjustmentService.getList(startDate, endDate, values?.voucherNo);
      setData(results);
    } catch (error) {
      message.error('Failed to load stock adjustments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 120,
      render: (text: string) => <Tag color="purple">ADJ-{text}</Tag>
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => dayjs(date).format('DD-MMM-YYYY')
    },
    {
      title: 'Narration',
      dataIndex: 'narration',
      key: 'narration',
      ellipsis: true,
    },
    {
      title: 'Total Qty',
      dataIndex: 'totalQty',
      key: 'totalQty',
      width: 100,
      align: 'right' as const,
      render: (val: number) => <b>{val || 0}</b>
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong style={{ color: '#7c3aed' }}>{(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: StockAdjustmentMaster) => (
        <Button 
          type="text" 
          icon={<EditOutlined />} 
          onClick={() => navigate(`/daily-entries/stock-adjustment/${record.voucherNo}`)}
        />
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <div className="flex justify-between items-center">
        <div>
          <Title level={3} style={{ margin: 0 }}>Stock Adjustments</Title>
          <Text type="secondary">Manage and track manual stock corrections</Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={() => navigate('/daily-entries/stock-adjustment/new')}
          style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
        >
          New Adjustment
        </Button>
      </div>

      <Card className="shadow-sm border-gray-100 rounded-xl" bodyStyle={{ padding: '20px' }}>
        <Form 
          form={form} 
          layout="inline" 
          onFinish={fetchData}
          initialValues={{ dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] }}
        >
          <Form.Item name="dateRange" label="Date Range">
            <RangePicker format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="voucherNo" label="Voucher #">
            <Input placeholder="Search VNo" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>
              Search
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card className="shadow-sm border-gray-100 rounded-xl overflow-hidden" bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={data} 
          loading={loading}
          rowKey="voucherNo"
          pagination={{ pageSize: 10 }}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>
    </Space>
  );
};
