import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Form, DatePicker, Select, Input, Alert, Badge, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, RocketOutlined,
  SearchOutlined, ReloadOutlined, CloudSyncOutlined,
  CloudServerOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { saleService, type Sale, type OfflineSaleEntry } from '../../services/saleService';
import { offlineCacheService } from '../../services/offlineCacheService';
import { offlineSyncService } from '../../services/offlineSyncService';
import { useOfflineStore } from '../../stores/useOfflineStore';
import { useAppStore } from '../../stores/useAppStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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

export const SaleList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<Sale[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSaleEntry[]>([]);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [form] = Form.useForm();
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing } = useOfflineStore();

  const loadOfflineQueue = async () => {
    const { currentTenantIdentifier } = useAppStore.getState();
    const queue = await saleService.getOfflineQueue(currentTenantIdentifier);
    setOfflineQueue(queue);
  };

  const fetchLookups = async () => {
    try {
      const custs = await offlineCacheService.getCustomers();
      setCustomers(custs);
    } catch {
      // Non-critical — list still works without customer filter
    }
  };

  const fetchData = useCallback(async (values: any = {}) => {
    if (!isOnline) {
      // Offline: only show offline queue
      await loadOfflineQueue();
      return;
    }
    try {
      setLoading(true);
      const params = {
        fromDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        toDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
        account: values.account,
        voucherNo: values.voucherNo
      };
      const result = await saleService.getList(params);
      setData(result);
      await loadOfflineQueue();
    } catch {
      message.error('Failed to fetch sale vouchers');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    fetchLookups();
    fetchData({ dateRange: [dayjs().startOf('month'), dayjs()] });
  }, [fetchData]);

  // Reload queue when pendingCount changes (after sync)
  useEffect(() => {
    loadOfflineQueue();
  }, [pendingCount]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await offlineSyncService.syncAll();
      if (result.synced > 0) {
        message.success(`${result.synced} voucher(s) synced successfully`);
        fetchData({ dateRange: [dayjs().startOf('month'), dayjs()] });
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
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
            onClick={() => navigate(`/daily-entries/sale/${record.voucherNo}`)}
          >
            Edit
          </Button>
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
          New Sale
        </Button>
      </div>

      {isOnline && (
        <Form
          form={form}
          layout="inline"
          className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
          onFinish={fetchData}
          initialValues={{ dateRange: [dayjs().startOf('month'), dayjs()] }}
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
              <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); fetchData(); }}>Reset</Button>
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
        pagination={{ pageSize: 10 }}
        onRow={(record) => ({
          onDoubleClick: () => {
            if (!record.isOffline) {
              navigate(`/daily-entries/sale/${record.voucherNo}`);
            }
          }
        })}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
