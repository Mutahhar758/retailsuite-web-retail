import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Space, Button, Form, DatePicker, message, Tag, Popconfirm
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ReconciliationOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  dailyStockClosingService,
  type DailyStockClosingListItem
} from '../../services/dailyStockClosingService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const DailyStockClosingList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/daily-stock-closing/new'),
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyStockClosingListItem[]>([]);
  const [form] = Form.useForm();

  const fetchList = async (fromDate?: string, toDate?: string) => {
    try {
      setLoading(true);
      const list = await dailyStockClosingService.getList({ fromDate, toDate });
      setData(list);
    } catch {
      message.error('Failed to load daily stock closings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const start = dayjs().startOf('month');
    const end = dayjs().endOf('month');
    form.setFieldsValue({ dateRange: [start, end] });
    fetchList(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  }, [form]);

  const handleSearch = (values: any) => {
    const range = values?.dateRange;
    const fromDate = range?.[0] ? range[0].format('YYYY-MM-DD') : undefined;
    const toDate = range?.[1] ? range[1].format('YYYY-MM-DD') : undefined;
    fetchList(fromDate, toDate);
  };

  const handleReset = () => {
    const start = dayjs().startOf('month');
    const end = dayjs().endOf('month');
    form.setFieldsValue({ dateRange: [start, end] });
    fetchList(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  };

  const handleDelete = async (dateStr: string) => {
    try {
      setLoading(true);
      await dailyStockClosingService.delete(dateStr);
      message.success('Daily stock closing deleted');
      const range = form.getFieldValue('dateRange');
      fetchList(
        range?.[0]?.format('YYYY-MM-DD'),
        range?.[1]?.format('YYYY-MM-DD')
      );
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete daily stock closing');
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => <strong>{dayjs(date).format('DD-MMM-YYYY')}</strong>,
    },
    {
      title: 'Purchase Voucher',
      dataIndex: 'purchaseVoucherNo',
      key: 'purchaseVoucherNo',
      render: (vno: string | null) =>
        vno ? (
          <Tag
            color="blue"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/daily-entries/purchase/${vno}`)}
          >
            PU-{vno}
          </Tag>
        ) : (
          <Tag>None</Tag>
        ),
    },
    {
      title: 'Total Buying',
      dataIndex: 'purchaseAmount',
      key: 'purchaseAmount',
      align: 'right' as const,
      render: (amt: number) =>
        (amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: 'Sale Voucher',
      dataIndex: 'saleVoucherNo',
      key: 'saleVoucherNo',
      render: (vno: string | null) =>
        vno ? (
          <Tag
            color="green"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/daily-entries/sale/${vno}`)}
          >
            SL-{vno}
          </Tag>
        ) : (
          <Tag>None</Tag>
        ),
    },
    {
      title: 'Total Sales',
      dataIndex: 'saleAmount',
      key: 'saleAmount',
      align: 'right' as const,
      render: (amt: number) =>
        (amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (remarks: string | null) => remarks || <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_: any, record: DailyStockClosingListItem) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
            onClick={() => navigate(`/daily-entries/daily-stock-closing/${record.closingKey}`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Daily Stock Closing?"
            description="This will remove the linked Purchase and Sale vouchers for this date."
            onConfirm={() => handleDelete(record.closingKey)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <ReconciliationOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Daily Stock &amp; Cash Closing
            </Title>
            <Text type="secondary">Manage day-end physical stock counts and summary closings</Text>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/daily-entries/daily-stock-closing/new')}
          style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
        >
          New Daily Closing (Alt+N)
        </Button>
      </div>

      <Form
        form={form}
        layout="inline"
        className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
        onFinish={handleSearch}
      >
        <Form.Item name="dateRange" label="Date Range">
          <RangePicker format="DD-MMM-YYYY" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
            >
              Search
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              Reset
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        rowKey="closingKey"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/daily-entries/daily-stock-closing/${record.closingKey}`),
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
