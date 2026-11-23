import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Button, Space, Tag, Typography, Popconfirm, message } from 'antd';
import { CloudSyncOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useOfflineStore } from '../stores/useOfflineStore';
import { useAppStore } from '../stores/useAppStore';
import { saleService, type OfflineSaleEntry } from '../services/saleService';
import { offlineSyncService } from '../services/offlineSyncService';
import { offlineCacheService } from '../services/offlineCacheService';

const { Text } = Typography;

export const OfflineSyncReviewModal: React.FC = () => {
  const { syncReviewOpen, setSyncReviewOpen, isSyncing } = useOfflineStore();
  const { currentTenantIdentifier } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<OfflineSaleEntry[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [itemNames, setItemNames] = useState<Record<string, string>>({});

  const loadQueueAndLookups = async () => {
    setLoading(true);
    try {
      const [entries, customers, items] = await Promise.all([
        saleService.getOfflineQueue(currentTenantIdentifier),
        offlineCacheService.getCustomers().catch(() => []),
        offlineCacheService.getItems().catch(() => []),
      ]);

      const custMap: Record<string, string> = {};
      for (const c of customers) custMap[c.account] = c.title;
      setCustomerNames(custMap);

      const itemMap: Record<string, string> = {};
      for (const i of items) itemMap[i.id] = i.title;
      setItemNames(itemMap);

      setQueue(entries);
      setSelectedRowKeys(entries.filter((e) => e.localId != null).map((e) => e.localId!));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (syncReviewOpen) {
      loadQueueAndLookups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncReviewOpen, currentTenantIdentifier]);

  const selectedIds = useMemo(
    () => selectedRowKeys.map((k) => Number(k)).filter((n) => !Number.isNaN(n)),
    [selectedRowKeys]
  );

  const selectedTotal = useMemo(() => {
    const idSet = new Set(selectedIds);
    return queue
      .filter((e) => e.localId != null && idSet.has(e.localId))
      .reduce((sum, e) => {
        const net = e.request.lines.reduce(
          (s, l) => s + (l.qty * l.rate + (l.secQty ?? 0) * (l.secRate ?? 0) - l.discount + (l.carriage ?? 0)),
          0
        );
        return sum + net;
      }, 0);
  }, [queue, selectedIds]);

  const handleSyncSelected = async () => {
    if (selectedIds.length === 0) return;
    const result = await offlineSyncService.syncSelected(selectedIds);
    if (result.synced > 0) {
      message.success(`${result.synced} offline voucher(s) synced successfully.`);
    }
    if (result.failed > 0) {
      message.warning(`${result.failed} voucher(s) failed — inspect error details below.`);
    }
    await loadQueueAndLookups();
    if (result.remaining === 0 && result.failed === 0) {
      setSyncReviewOpen(false);
    }
  };

  const handleIgnoreSelected = async () => {
    if (selectedIds.length === 0) return;
    const removed = await offlineSyncService.ignoreSelected(selectedIds);
    message.info(`${removed} offline voucher(s) discarded.`);
    await loadQueueAndLookups();
    if (queue.length - removed <= 0) {
      setSyncReviewOpen(false);
    }
  };

  const columns = [
    {
      title: 'Voucher #',
      dataIndex: 'tempVoucherNo',
      key: 'tempVoucherNo',
      render: (val: string) => <Tag color="orange" style={{ fontWeight: 700 }}>{val}</Tag>,
    },
    {
      title: 'Date / Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => dayjs(val).format('DD-MMM-YYYY hh:mm A'),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, row: OfflineSaleEntry) =>
        customerNames[row.request.account] || row.request.account,
    },
    {
      title: 'Lines',
      key: 'lines',
      align: 'center' as const,
      render: (_: unknown, row: OfflineSaleEntry) => row.request.lines.length,
    },
    {
      title: 'Net Amount',
      key: 'netAmount',
      align: 'right' as const,
      render: (_: unknown, row: OfflineSaleEntry) => {
        const net = row.request.lines.reduce(
          (s, l) => s + (l.qty * l.rate + (l.secQty ?? 0) * (l.secRate ?? 0) - l.discount + (l.carriage ?? 0)),
          0
        );
        return <Text strong>Rs. {Math.round(net).toLocaleString()}</Text>;
      },
    },
    {
      title: 'Paid',
      key: 'cashReceipt',
      align: 'right' as const,
      render: (_: unknown, row: OfflineSaleEntry) =>
        `Rs. ${Math.round(row.request.cashReceipt || 0).toLocaleString()}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, row: OfflineSaleEntry) => (
        <div>
          <Tag color={status === 'failed' ? 'red' : 'gold'}>
            {status === 'failed' ? 'Failed' : 'Pending Review'}
          </Tag>
          {row.lastError && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{row.lastError}</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={syncReviewOpen}
      onCancel={() => setSyncReviewOpen(false)}
      width={940}
      title={
        <Space>
          <CloudSyncOutlined style={{ color: '#0284c7' }} />
          <span>Offline Sales — Sync Review &amp; Confirmation</span>
        </Space>
      }
      footer={
        <div className="flex flex-wrap justify-between items-center gap-2">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Selected: <b>{selectedIds.length}</b> bill(s) &bull; Total: <b>Rs. {Math.round(selectedTotal).toLocaleString()}</b>
          </Text>
          <Space>
            <Button onClick={() => setSyncReviewOpen(false)} disabled={isSyncing}>
              Decide Later
            </Button>
            <Popconfirm
              title={`Ignore / discard ${selectedIds.length} selected bill(s)?`}
              description="Discarded offline bills will NOT be posted to the server."
              onConfirm={handleIgnoreSelected}
              okText="Yes, Discard"
              okButtonProps={{ danger: true }}
              disabled={selectedIds.length === 0 || isSyncing}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedIds.length === 0 || isSyncing}
              >
                Ignore Selected
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<CloudSyncOutlined />}
              loading={isSyncing}
              disabled={selectedIds.length === 0}
              onClick={handleSyncSelected}
            >
              Sync Selected ({selectedIds.length})
            </Button>
          </Space>
        </div>
      }
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Review your offline bills below (expand any row to inspect line items), then confirm which bills to Sync to the server or Ignore.
      </Text>
      <Table<OfflineSaleEntry>
        rowKey={(r) => r.localId!}
        loading={loading}
        dataSource={queue}
        columns={columns}
        size="small"
        pagination={false}
        scroll={{ y: 360 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        expandable={{
          expandedRowRender: (record) => (
            <Table
              size="small"
              pagination={false}
              rowKey={(l) => `${l.seq}-${l.itemId}`}
              dataSource={record.request.lines}
              columns={[
                { title: '#', dataIndex: 'seq', width: 45 },
                {
                  title: 'Item',
                  dataIndex: 'itemId',
                  render: (id: string) => itemNames[id] || id,
                },
                { title: 'Qty', dataIndex: 'qty', align: 'right', width: 80 },
                {
                  title: 'Rate',
                  dataIndex: 'rate',
                  align: 'right',
                  width: 100,
                  render: (v: number) => `Rs. ${Number(v || 0).toLocaleString()}`,
                },
                {
                  title: 'Discount',
                  dataIndex: 'discount',
                  align: 'right',
                  width: 90,
                  render: (v: number) => `Rs. ${Number(v || 0).toLocaleString()}`,
                },
                {
                  title: 'Amount',
                  align: 'right',
                  width: 110,
                  render: (_: unknown, l) => {
                    const amt = l.qty * l.rate + (l.secQty ?? 0) * (l.secRate ?? 0) - l.discount + (l.carriage ?? 0);
                    return <Text strong>Rs. {Math.round(amt).toLocaleString()}</Text>;
                  },
                },
              ]}
            />
          ),
        }}
      />
    </Modal>
  );
};
