import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ShoppingCartOutlined, 
  SearchOutlined, ReloadOutlined, CopyOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { purchaseService, type Purchase } from '../../services/purchaseService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/purchases?from=2026-10-01&to=2026-10-28&account=VEND-01&voucher=12&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const PurchaseList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/purchase/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Purchase[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [form] = Form.useForm();

  // First visit without any query string: seed the URL with default (current month) range.
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
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    return {
      from: from && dayjs(from, DATE_FORMAT, true).isValid() ? from : undefined,
      to: to && dayjs(to, DATE_FORMAT, true).isValid() ? to : undefined,
      account: searchParams.get('account') || undefined,
      voucher: searchParams.get('voucher') || undefined,
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
        const vends = await chartOfAccountService.getDetailAccounts();
        setVendors(vends);
      } catch (error) {
        console.error('Failed to load lookups', error);
      }
    })();
  }, []);

  // Fetch whenever the URL-derived query changes.
  useEffect(() => {
    if (searchParams.toString() === '') return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await purchaseService.getList({
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
        if (!cancelled) message.error('Failed to fetch purchase vouchers');
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
        <Space>
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            onClick={() => navigate(`/daily-entries/purchase/${record.voucherNo}`)}
          >
            Edit
          </Button>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={async () => {
              try {
                setLoading(true);
                const details = await purchaseService.getDetail(record.voucherNo);
                if (details && details.length > 0) {
                  const first = details[0];
                  navigate('/daily-entries/purchase/new', {
                    state: {
                      copyFrom: {
                        account: first.accountId,
                        narration: first.narrationId,
                        description: first.description,
                        cashPaid: first.cashPaid ?? 0,
                        cashBack: first.cashBack ?? 0,
                        lines: details.map(d => ({
                          seq: d.seq,
                          itemId: d.itemId,
                          unit: d.unit,
                          qty: d.qty,
                          rate: d.rate,
                          addLess: d.addLess,
                          amount: d.amount,
                          secQty: d.secQty,
                          secRate: d.secRate,
                          secUnit: d.secUnit,
                          qtyInPack: (d as any).qtyInPack,
                          packing: (d as any).packing
                        }))
                      }
                    }
                  });
                } else {
                  message.error('No details found to copy');
                }
              } catch {
                message.error('Failed to load details for copy');
              } finally {
                setLoading(false);
              }
            }}
          >
            Copy
          </Button>
        </Space>
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
          New Purchase (F1)
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
          onChange: (page, size) => {
            const next = buildParams(form.getFieldsValue(), page, size);
            setSearchParams(next);
          },
        }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/daily-entries/purchase/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
