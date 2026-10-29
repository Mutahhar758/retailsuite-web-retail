import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, UndoOutlined, 
  SearchOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleReturnService, type SaleReturn } from '../../services/saleReturnService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/sale-returns?from=2026-10-01&to=2026-10-22&account=1-01&voucher=15&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const SaleReturnList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/sale-return/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleReturn[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [form] = Form.useForm();

  // First visit without any query string: seed the URL with the default (current month) range.
  useEffect(() => {
    if (searchParams.toString() === '') {
      const next = new URLSearchParams();
      next.set('from', dayjs().startOf('month').format(DATE_FORMAT));
      next.set('to', dayjs().format(DATE_FORMAT));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parsed, validated filter state derived purely from the URL.
  const query = useMemo(() => {
    const from = searchParams.get('from') || searchParams.get('fromDate');
    const to = searchParams.get('to') || searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    return {
      from: from && dayjs(from, DATE_FORMAT, true).isValid() ? from : undefined,
      to: to && dayjs(to, DATE_FORMAT, true).isValid() ? to : undefined,
      account: searchParams.get('account') || undefined,
      voucher: searchParams.get('voucher') || searchParams.get('voucherNo') || undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      size: Number.isFinite(size) && size > 0 ? Math.min(size, 200) : DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  // Keep the filter form in sync with the URL (refresh / back / forward).
  useEffect(() => {
    form.setFieldsValue({
      dateRange: query.from && query.to ? [dayjs(query.from), dayjs(query.to)] : undefined,
      account: query.account,
      voucherNo: query.voucher,
    });
  }, [query.from, query.to, query.account, query.voucher, form]);

  useEffect(() => {
    (async () => {
      try {
        const custs = await chartOfAccountService.getCustomerAccounts();
        setCustomers(custs);
      } catch (error) {
        console.error('Failed to load lookups', error);
      }
    })();
  }, []);

  // Fetch whenever the URL-derived query changes.
  useEffect(() => {
    if (searchParams.toString() === '') return; // wait for default seeding
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await saleReturnService.getList({
          fromDate: query.from,
          toDate: query.to,
          account: query.account,
          voucherNo: query.voucher,
          pageNumber: query.page,
          pageSize: query.size,
        });
        if (cancelled) return;
        setData(result.data);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (!cancelled) message.error('Failed to fetch sale return vouchers');
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
    if (values?.account) next.set('account', values.account);
    if (values?.voucherNo) next.set('voucher', String(values.voucherNo).trim());
    if (page > 1) next.set('page', String(page));
    if (size !== DEFAULT_PAGE_SIZE) next.set('size', String(size));
    return next;
  };

  // Search: new filters, back to page 1. Pushed to history so Back restores the previous filters.
  const handleSearch = (values: any) => {
    const next = buildParams(values, 1, query.size);
    if (next.toString() === '') next.set('range', 'all');
    setSearchParams(next);
  };

  const handleReset = () => {
    form.resetFields();
    const next = new URLSearchParams();
    next.set('from', dayjs().startOf('month').format(DATE_FORMAT));
    next.set('to', dayjs().format(DATE_FORMAT));
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
          New Sale Return (F1)
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
            <Button icon={<ReloadOutlined />} onClick={handleReset}>Reset</Button>
          </Space>
        </Form.Item>
      </Form>

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
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vouchers`,
          onChange: handleTableChange,
        }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/daily-entries/sale-return/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
