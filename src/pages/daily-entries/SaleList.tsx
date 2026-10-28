import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Form, DatePicker, Select, Input, Alert, Badge, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, RocketOutlined,
  SearchOutlined, ReloadOutlined, CloudSyncOutlined,
  CloudServerOutlined, WarningOutlined, CopyOutlined, PrinterOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleService, type Sale, type OfflineSaleEntry } from '../../services/saleService';
import { offlineCacheService } from '../../services/offlineCacheService';
import { offlineSyncService } from '../../services/offlineSyncService';
import { useOfflineStore } from '../../stores/useOfflineStore';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT } from '../../stores/useSettingsStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { SaleReceiptModal } from '../../components/SaleReceiptModal';
import { type SaleReceiptData, type SaleReceiptLineItem } from '../../utils/saleReceiptPrint';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

// Unified row type merges server rows + offline queue rows
interface DisplayRow {
  isOffline: boolean;
  // Server row fields
  date?: string;
  voucherNo?: string;
  account?: string;
  createdBy?: string;
  createdOn?: string;
  // Offline row fields
  offlineEntry?: OfflineSaleEntry;
}

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/sales?from=2026-10-01&to=2026-10-28&account=CUST-01&voucher=12&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const SaleList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/sale/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<Sale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSaleEntry[]>([]);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<SaleReceiptData | null>(null);
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { getSetting } = useSettingsStore();
  const [form] = Form.useForm();
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing } = useOfflineStore();

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

  const loadOfflineQueue = useCallback(async () => {
    const { currentTenantIdentifier } = useAppStore.getState();
    const queue = await saleService.getOfflineQueue(currentTenantIdentifier);
    setOfflineQueue(queue);
  }, []);

  const fetchLookups = async () => {
    try {
      const custs = await offlineCacheService.getCustomers();
      setCustomers(custs);
    } catch {
      // Non-critical — list still works without customer filter
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  // Fetch whenever the URL-derived query changes or online status changes.
  useEffect(() => {
    if (!isOnline) {
      loadOfflineQueue();
      return;
    }
    if (searchParams.toString() === '') return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await saleService.getList({
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
        await loadOfflineQueue();
      } catch {
        if (!cancelled) message.error('Failed to fetch sale vouchers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, isOnline, searchParams, loadOfflineQueue]);

  // Reload queue when pendingCount changes (after sync)
  useEffect(() => {
    loadOfflineQueue();
  }, [pendingCount, loadOfflineQueue]);

  const handlePrintReceipt = async (voucherNo: string) => {
    try {
      setLoading(true);
      const [details, itemsList, unitsList] = await Promise.all([
        saleService.getDetail(voucherNo),
        offlineCacheService.getItems().catch(() => []),
        offlineCacheService.getUnits().catch(() => [])
      ]);

      if (!details || details.length === 0) {
        message.error('No lines found for this sale voucher');
        return;
      }

      const first = details[0];
      const customer = customers.find(c => c.account === first.accountId);

      const lines: SaleReceiptLineItem[] = details.map((d, idx) => {
        const itm = itemsList.find(i => String(i.id) === String(d.itemId));
        const matchedUnit = unitsList.find(u =>
          u.code?.toLowerCase() === String(d.unit || '').toLowerCase() ||
          u.title?.toLowerCase() === String(d.unit || '').toLowerCase()
        );
        const resolvedUnit = matchedUnit
          ? (((matchedUnit as any).shortTitle && (matchedUnit as any).shortTitle.trim()) || matchedUnit.title)
          : (itm?.primaryUnitTitle || (itm as any)?.defaultUnitTitle || d.unit || '');

        return {
          seq: d.seq || idx + 1,
          itemTitle: itm?.title || `Item #${d.itemId}`,
          unit: resolvedUnit,
          qty: d.qty,
          rate: d.rate,
          discount: d.discount || 0,
          amount: d.amount || (d.qty * d.rate - (d.discount || 0)),
          imei: d.imei
        };
      });

      const grossTotal = lines.reduce((acc, l) => acc + (l.qty * l.rate), 0);
      const totalDiscount = lines.reduce((acc, l) => acc + (l.discount || 0), 0);
      const netAmount = details.reduce((acc, l) => acc + (l.amount || 0), 0);
      const cashReceipt = first.cashReceipt || 0;
      const cashBack = first.cashBack || 0;

      const receipt: SaleReceiptData = {
        voucherNo: `SL-${voucherNo}`,
        date: first.date || dayjs(),
        customerName: customer?.title || first.accountId || 'Walk-in Customer',
        customerPhone: (customer as any)?.phone,
        narration: first.narration,
        description: first.description,
        lines,
        grossTotal,
        totalDiscount,
        netAmount,
        cashReceived: cashReceipt,
        cashBack,
        balance: Math.max(0, netAmount - cashReceipt),
        orgName: currentOrg?.name,
        orgAddress: (currentOrg as any)?.address,
        orgPhone: (currentOrg as any)?.phone,
        thankYouMessage: getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT),
        isDuplicate: true
      };

      setActiveReceiptData(receipt);
      setReceiptModalVisible(true);
    } catch (err) {
      console.error(err);
      message.error('Failed to load receipt details');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await offlineSyncService.syncAll();
      if (result.synced > 0) {
        message.success(`${result.synced} voucher(s) synced successfully`);
        // Refresh current page view
        const next = new URLSearchParams(searchParams);
        setSearchParams(next);
      }
      if (result.failed > 0) {
        message.error(`${result.failed} voucher(s) failed to sync`);
      }
    } finally {
      setSyncing(false);
    }
  };

  // Build unified display rows: offline first, then server rows
  const displayRows: DisplayRow[] = [
    ...offlineQueue.map(entry => ({ isOffline: true, offlineEntry: entry })),
    ...data.map(s => ({
      isOffline: false,
      date: s.date,
      voucherNo: s.voucherNo,
      account: s.account,
      createdBy: s.createdBy,
      createdOn: s.createdOn,
    })),
  ];

  const columns = [
    {
      title: 'Date',
      key: 'date',
      render: (_: any, record: DisplayRow) => {
        if (record.isOffline) {
          return dayjs(record.offlineEntry!.createdAt).format('DD-MMM-YYYY');
        }
        return dayjs(record.date).format('DD-MMM-YYYY');
      },
    },
    {
      title: 'Voucher #',
      key: 'voucherNo',
      render: (_: any, record: DisplayRow) => {
        if (record.isOffline) {
          const entry = record.offlineEntry!;
          return (
            <Space size={4}>
              <Tooltip title={entry.status === 'failed' ? 'Sync failed — click Sync Now to retry' : 'Not synced yet — will sync when online'}>
                <Tag
                  icon={entry.status === 'failed' ? <WarningOutlined /> : <CloudServerOutlined />}
                  color={entry.status === 'failed' ? 'red' : 'orange'}
                >
                  {entry.tempVoucherNo}
                </Tag>
              </Tooltip>
              <Tag color={entry.status === 'failed' ? 'error' : 'warning'} style={{ fontSize: 10 }}>
                {entry.status === 'failed' ? 'Sync Failed' : 'Not Synced'}
              </Tag>
            </Space>
          );
        }
        return <Tag color="blue">SL-{record.voucherNo}</Tag>;
      },
    },
    {
      title: 'Customer',
      key: 'account',
      render: (_: any, record: DisplayRow) => {
        if (record.isOffline) {
          const acct = record.offlineEntry!.request.account;
          const cust = customers.find(c => c.account === acct);
          return <Text strong style={{ opacity: 0.7 }}>{cust?.title || acct}</Text>;
        }
        return <Text strong>{record.account}</Text>;
      },
    },
    {
      title: 'Created By',
      key: 'createdBy',
      render: (_: any, record: DisplayRow) => {
        if (record.isOffline) {
          return (
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: '13px', opacity: 0.7 }}>Offline (Device: {record.offlineEntry!.deviceId})</Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {dayjs(record.offlineEntry!.createdAt).format('DD-MMM-YYYY hh:mm A')}
              </Text>
            </Space>
          );
        }
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: '13px' }}>{record.createdBy}</Text>
            <Text type="secondary" style={{ fontSize: '11px', fontWeight: 500 }}>
              {dayjs(record.createdOn).format('DD-MMM-YYYY hh:mm A')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_: any, record: DisplayRow) => {
        if (record.isOffline) {
          return (
            <Tooltip title="Cannot edit offline vouchers">
              <Button type="primary" icon={<EditOutlined />} size="small" disabled
                style={{ backgroundColor: '#d9d9d9', borderColor: '#d9d9d9' }}>
                Edit
              </Button>
            </Tooltip>
          );
        }
        return (
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
              onClick={() => navigate(`/daily-entries/sale/${record.voucherNo}`)}
            >
              Edit
            </Button>
            <Button
              icon={<PrinterOutlined />}
              size="small"
              onClick={() => handlePrintReceipt(record.voucherNo!)}
            >
              Receipt
            </Button>
            <Button
              icon={<CopyOutlined />}
              size="small"
              onClick={async () => {
                try {
                  setLoading(true);
                  const details = await saleService.getDetail(record.voucherNo!);
                  if (details && details.length > 0) {
                    const first = details[0];
                    navigate('/daily-entries/sale/new', {
                      state: {
                        copyFrom: {
                          account: first.accountId,
                          narration: first.narrationId,
                          description: first.description,
                          cashReceipt: first.cashReceipt,
                          cashBack: first.cashBack,
                          lines: details.map(d => ({
                            seq: d.seq,
                            itemId: d.itemId,
                            unit: d.unit,
                            qty: d.qty,
                            rate: d.rate,
                            discount: d.discount,
                            amount: d.amount,
                            secUnit: d.secUnit,
                            secQty: d.secQty,
                            secRate: d.secRate,
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
        );
      },
    },
  ];

  const pendingTotal = offlineQueue.length;

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      {/* ── Offline queue banner ── */}
      {pendingTotal > 0 && (
        <Alert
          className="mb-4"
          type={offlineQueue.some(e => e.status === 'failed') ? 'error' : 'warning'}
          showIcon
          icon={<CloudServerOutlined />}
          message={
            <Space>
              <span>
                <Badge count={pendingTotal} color={offlineQueue.some(e => e.status === 'failed') ? '#ff4d4f' : '#fa8c16'} />
                &nbsp;
                {pendingTotal} sale voucher{pendingTotal > 1 ? 's' : ''} saved offline (Device: {offlineQueue[0]?.deviceId})
                {isOnline ? ' — ready to sync' : ' — connect to internet to sync'}
              </span>
              {isOnline && (
                <Button
                  size="small"
                  type="primary"
                  icon={<CloudSyncOutlined />}
                  loading={syncing || isSyncing}
                  onClick={handleSyncNow}
                  style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
                >
                  Sync Now
                </Button>
              )}
            </Space>
          }
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <RocketOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Sale Vouchers</Title>
            <Text type="secondary">Manage your customer sales and invoices</Text>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/daily-entries/sale/new')}
          style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
        >
          New Sale (F1)
        </Button>
      </div>

      {isOnline && (
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
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}>Search</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>
      )}

      <Table
        columns={columns}
        dataSource={displayRows}
        loading={loading}
        rowKey={(row) => row.isOffline ? `offline-${row.offlineEntry!.localId}` : `server-${row.voucherNo}`}
        rowClassName={(row) => row.isOffline ? 'bg-amber-50 dark:bg-amber-900/10' : ''}
        pagination={{
          current: query.page,
          pageSize: query.size,
          total: totalCount + (isOnline ? 0 : offlineQueue.length),
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vouchers`,
          onChange: (page, size) => {
            const next = buildParams(form.getFieldsValue(), page, size);
            setSearchParams(next);
          },
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            if (!record.isOffline) {
              navigate(`/daily-entries/sale/${record.voucherNo}`);
            }
          }
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />

      <SaleReceiptModal
        visible={receiptModalVisible}
        receiptData={activeReceiptData}
        onClose={() => setReceiptModalVisible(false)}
      />
    </Card>
  );
};
