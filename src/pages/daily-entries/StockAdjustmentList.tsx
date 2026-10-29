import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Typography, Space, Button, Form, DatePicker, Input, message, Tag } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stockAdjustmentService, type StockAdjustmentMaster } from '../../services/stockAdjustmentService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/stock-adjustment?from=2026-10-01&to=2026-10-22&voucher=15&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const StockAdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/stock-adjustment/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StockAdjustmentMaster[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [form] = Form.useForm();

  // First visit without query string: seed default range
  useEffect(() => {
    if (searchParams.toString() === '') {
      const next = new URLSearchParams();
      next.set('from', dayjs().startOf('month').format(DATE_FORMAT));
      next.set('to', dayjs().endOf('month').format(DATE_FORMAT));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useMemo(() => {
    const from = searchParams.get('from') || searchParams.get('fromDate');
    const to = searchParams.get('to') || searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    const voucher = searchParams.get('voucher') || searchParams.get('voucherNo') || undefined;
    return {
      from: from && dayjs(from, DATE_FORMAT, true).isValid() ? from : undefined,
      to: to && dayjs(to, DATE_FORMAT, true).isValid() ? to : undefined,
      voucher,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      size: Number.isFinite(size) && size > 0 ? Math.min(size, 200) : DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  useEffect(() => {
    form.setFieldsValue({
      dateRange: query.from && query.to ? [dayjs(query.from), dayjs(query.to)] : undefined,
      voucherNo: query.voucher,
    });
  }, [query.from, query.to, query.voucher, form]);

  useEffect(() => {
    if (searchParams.toString() === '') return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await stockAdjustmentService.getList({
          fromDate: query.from,
          toDate: query.to,
          voucherNo: query.voucher,
          pageNumber: query.page,
          pageSize: query.size,
        });
        if (cancelled) return;
        setData(result.data);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (!cancelled) message.error('Failed to load stock adjustments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, searchParams]);

  const buildParams = (values: any, page: number, size: number) => {
    const next = new URLSearchParams();
    const range = values?.dateRange;
    if (range?.[0]) next.set('from', range[0].format(DATE_FORMAT));
    if (range?.[1]) next.set('to', range[1].format(DATE_FORMAT));
    if (values?.voucherNo) next.set('voucher', String(values.voucherNo).trim());
    if (page > 1) next.set('page', String(page));
    if (size !== DEFAULT_PAGE_SIZE) next.set('size', String(size));
    return next;
  };

  const handleSearch = (values: any) => {
    const next = buildParams(values, 1, query.size);
    if (next.toString() === '') next.set('range', 'all');
    setSearchParams(next);
  };

  const handleReset = () => {
    form.resetFields();
    const next = new URLSearchParams();
    next.set('from', dayjs().startOf('month').format(DATE_FORMAT));
    next.set('to', dayjs().endOf('month').format(DATE_FORMAT));
    setSearchParams(next);
  };

  const handleTableChange = (page: number, size: number) => {
    const next = new URLSearchParams(searchParams);
    next.delete('range');
    if (size !== query.size) page = 1;
    if (page > 1) next.set('page', String(page)); else next.delete('page');
    if (size !== DEFAULT_PAGE_SIZE) next.set('size', String(size)); else next.delete('size');
    setSearchParams(next);
  };

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
          New Adjustment (F1)
        </Button>
      </div>

      <Card className="shadow-sm border-gray-100 rounded-xl" bodyStyle={{ padding: '20px' }}>
        <Form 
          form={form} 
          layout="inline" 
          onFinish={handleSearch}
        >
          <Form.Item name="dateRange" label="Date Range">
            <RangePicker format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="voucherNo" label="Voucher #">
            <Input placeholder="Search VNo" allowClear />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>
                Search
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card className="shadow-sm border-gray-100 rounded-xl overflow-hidden" bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={data} 
          loading={loading}
          rowKey="voucherNo"
          pagination={{
            current: query.page,
            pageSize: query.size,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} adjustments`,
            onChange: handleTableChange,
          }}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>
    </Space>
  );
};
