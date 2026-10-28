import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Form, DatePicker, Select, Input 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, TruckOutlined, 
  SearchOutlined, ReloadOutlined, CopyOutlined, UserOutlined 
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleSupplyService, type SaleSupply } from '../../services/saleSupplyService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/sale-supplies?from=2026-10-01&to=2026-10-28&item=ITM-01&voucher=12&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const SaleSupplyList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/sale-supply/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleSupply[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
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
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    return {
      from: from && dayjs(from, DATE_FORMAT, true).isValid() ? from : undefined,
      to: to && dayjs(to, DATE_FORMAT, true).isValid() ? to : undefined,
      item: searchParams.get('item') || undefined,
      voucher: searchParams.get('voucher') || undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      size: Number.isFinite(size) && size > 0 ? Math.min(size, 200) : DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  // Keep the filter form in sync with the URL (refresh / back / forward).
  useEffect(() => {
    form.setFieldsValue({
      dateRange: query.from && query.to ? [dayjs(query.from), dayjs(query.to)] : undefined,
      itemId: query.item,
      voucherNo: query.voucher,
    });
  }, [query.from, query.to, query.item, query.voucher, form]);

  useEffect(() => {
    (async () => {
      try {
        setItems(await inventoryService.getItems());
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
        const result = await saleSupplyService.getList({
          fromDate: query.from,
          toDate: query.to,
          itemId: query.item,
          voucherNo: query.voucher,
          pageNumber: query.page,
          pageSize: query.size,
        });
        if (cancelled) return;
        setData(result.data);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (!cancelled) message.error('Failed to fetch sale supply vouchers');
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
    if (values?.itemId) next.set('item', values.itemId);
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
      render: (text: string) => <Tag color="orange">SP-{text}</Tag>,
    },
    {
      title: 'Item Supplied',
      dataIndex: 'item',
      key: 'item',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Profile',
      dataIndex: 'supplyOrderTitle',
      key: 'supplyOrderTitle',
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">-</Text>,
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
        <Space>
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            onClick={() => navigate(`/daily-entries/sale-supply/${record.voucherNo}`)}
          >
            Edit
          </Button>
          <Button 
            icon={<CopyOutlined />} 
            size="small"
            onClick={async () => {
              try {
                setLoading(true);
                const details = await saleSupplyService.getDetail(record.voucherNo);
                if (details && details.length > 0) {
                  const first = details[0];
                  navigate('/daily-entries/sale-supply/new', {
                    state: {
                      copyFrom: {
                        itemId: first.itemId,
                        narration: first.narrationId,
                        description: first.description,
                        supplyOrderMasterId: first.supplyOrderMasterId,
                        lines: details.map(d => ({
                          seq: d.seq,
                          customerId: d.customerId,
                          unit: d.unit,
                          qty: d.qty,
                          rate: d.rate,
                          discount: d.discount,
                          addLess: d.addLess,
                          amount: d.amount
                        }))
                      }
                    }
                  });
                } else {
                  message.error('No details found to copy');
                }
              } catch (error) {
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
          <TruckOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Sale Supply Vouchers</Title>
            <Text type="secondary">Manage multi-customer bulk item distributions</Text>
          </div>
        </Space>
        <Space>
          <Button 
            type="default" 
            icon={<UserOutlined />} 
            onClick={() => navigate('/daily-entries/customer-supply')}
            style={{ fontWeight: 600 }}
          >
            Customer Supply Register
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/daily-entries/sale-supply/new')}
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
          >
            New Sale Supply (F1)
          </Button>
        </Space>
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
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          onChange: handleTableChange,
        }}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/daily-entries/sale-supply/${record.voucherNo}`)
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
