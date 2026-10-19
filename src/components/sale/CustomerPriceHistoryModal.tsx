import React, { useEffect, useState } from 'react';
import {
  Modal,
  Spin,
  Empty,
  Typography,
  Row,
  Col,
  Card,
  Table,
  Button,
  Tag,
  Alert,
  Space
} from 'antd';
import {
  HistoryOutlined,
  CheckOutlined,
  CalendarOutlined,
  DollarOutlined,
  ShoppingOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  saleService,
  type CustomerItemPriceHistoryResponse,
  type CustomerItemSaleRecord
} from '../../services/saleService';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface CustomerPriceHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  accountId?: string | null;
  customerName?: string | null;
  itemId?: string | null;
  itemTitle?: string | null;
  hasSecondaryQty?: boolean;
  onApplyRate?: (rate: number, secRate?: number) => void;
}

export const CustomerPriceHistoryModal: React.FC<CustomerPriceHistoryModalProps> = ({
  visible,
  onClose,
  accountId,
  customerName,
  itemId,
  itemTitle,
  hasSecondaryQty = false,
  onApplyRate
}) => {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<CustomerItemPriceHistoryResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible && accountId && itemId) {
      setLoading(true);
      setErrorMsg(null);
      setHistoryData(null);

      saleService
        .getCustomerItemHistory(accountId, itemId)
        .then((res) => {
          setHistoryData(res);
        })
        .catch((err) => {
          console.error('Failed to load customer item history:', err);
          setErrorMsg('Failed to fetch sale history. Please try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (visible && (!accountId || !itemId)) {
      setHistoryData(null);
      setErrorMsg(null);
    }
  }, [visible, accountId, itemId]);

  const handleApply = (rate: number, secRate?: number) => {
    if (onApplyRate) {
      onApplyRate(rate, secRate);
    }
    onClose();
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (val: string) => (
        <span>
          {dayjs(val).format('DD-MMM-YYYY')}
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {dayjs(val).fromNow()}
          </Text>
        </span>
      )
    },
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      render: (val: string, record: CustomerItemSaleRecord) => {
        const fullNo = record.vType ? `${record.vType}-${val}` : val;
        const color = record.vType === 'SS' ? 'orange' : 'blue';
        return <Tag color={color}>{fullNo}</Tag>;
      }
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (val: number, record: CustomerItemSaleRecord) => (
        <span>
          {val}
          {hasSecondaryQty && record.secQty ? (
            <span style={{ fontSize: '11px', color: '#8c8c8c', display: 'block' }}>
              Pack: {record.secQty}
            </span>
          ) : null}
        </span>
      )
    },
    {
      title: hasSecondaryQty ? 'Rate (Single / Pack)' : 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      align: 'right' as const,
      render: (val: number, record: CustomerItemSaleRecord) => (
        <span>
          <Text strong style={{ color: '#1677ff' }}>
            {(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </Text>
          {hasSecondaryQty && record.secRate ? (
            <span style={{ fontSize: '11px', color: '#8c8c8c', display: 'block' }}>
              Pack: {(record.secRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          ) : null}
        </span>
      )
    },
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      align: 'right' as const,
      render: (val: number) => (val > 0 ? (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-')
    },
    {
      title: 'Total',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (val: number) => (
        <Text strong>
          {(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      )
    },
    ...(onApplyRate
      ? [
          {
            title: 'Action',
            key: 'action',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: CustomerItemSaleRecord) => (
              <Button
                size="small"
                type="primary"
                ghost
                icon={<CheckOutlined />}
                onClick={() => handleApply(record.rate, record.secRate)}
              >
                Apply
              </Button>
            )
          }
        ]
      : [])
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      width={720}
      title={
        <Space align="center">
          <HistoryOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <span>Customer Sale Price History</span>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Customer</Text>
              <div>
                <Text strong style={{ fontSize: 14 }}>
                  {customerName || accountId || <span style={{ color: '#ef4444' }}>Not Selected</span>}
                </Text>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Item</Text>
              <div>
                <Text strong style={{ fontSize: 14 }}>
                  {itemTitle || itemId || <span style={{ color: '#ef4444' }}>Not Selected</span>}
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {!accountId || !itemId ? (
        <Alert
          type="warning"
          showIcon
          message="Selection Required"
          description="Please select both a customer and an item in the sale line before opening price history."
          style={{ marginTop: 12 }}
        />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Fetching last sale price and history..." />
        </div>
      ) : errorMsg ? (
        <Alert type="error" showIcon message={errorMsg} style={{ marginTop: 12 }} />
      ) : historyData && !historyData.hasHistory ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text strong>No Previous Sale History Found</Text>
              <br />
              <Text type="secondary">
                This item has never been sold to this customer before.
              </Text>
            </div>
          }
          style={{ padding: '30px 0' }}
        />
      ) : historyData && historyData.hasHistory ? (
        <div>
          {/* Quick Highlight of Last Sale */}
          <Card
            style={{
              marginBottom: 16,
              background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
              border: '1px solid #bae0ff'
            }}
            bodyStyle={{ padding: '14px 18px' }}
          >
            <Row align="middle" justify="space-between">
              <Col xs={24} sm={16}>
                <Space direction="vertical" size={2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="processing" icon={<DollarOutlined />}>
                      LAST SALE PRICE
                    </Tag>
                    <Text strong style={{ fontSize: 20, color: '#0958d9' }}>
                      ₨ {(historyData.lastRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </Text>
                    {hasSecondaryQty && historyData.lastSecRate ? (
                      <Tag color="cyan">
                        Pack Rate: ₨ {(historyData.lastSecRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Tag>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#4b5563' }}>
                    <span>
                      <CalendarOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                      <strong>Date:</strong> {dayjs(historyData.lastSaleDate).format('DD-MMM-YYYY')}{' '}
                      <span style={{ color: '#6b7280' }}>({dayjs(historyData.lastSaleDate).fromNow()})</span>
                    </span>
                    <span>
                      <ShoppingOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                      <strong>Qty:</strong> {historyData.lastQty}
                      {historyData.lastDiscount && historyData.lastDiscount > 0 ? (
                        <span style={{ color: '#ef4444', marginLeft: 4 }}>
                          (Disc: ₨ {historyData.lastDiscount})
                        </span>
                      ) : null}
                    </span>
                    <span>
                      <FileTextOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                      <strong>Voucher:</strong> {historyData.lastVType ? `${historyData.lastVType}-${historyData.lastVoucherNo}` : historyData.lastVoucherNo}
                    </span>
                  </div>
                </Space>
              </Col>
              {onApplyRate && (
                <Col xs={24} sm={8} style={{ textAlign: 'right', marginTop: 8 }}>
                  <Button
                    type="primary"
                    size="middle"
                    icon={<CheckOutlined />}
                    onClick={() => handleApply(historyData.lastRate || 0, historyData.lastSecRate)}
                    style={{ background: '#0958d9' }}
                  >
                    Apply This Rate
                  </Button>
                </Col>
              )}
            </Row>
          </Card>

          {/* Past Transactions Table */}
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 13, color: '#374151' }}>
                Recent Invoices ({historyData.recentSales.length})
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Showing up to 5 most recent sales
              </Text>
            </div>
            <Table
              size="small"
              dataSource={historyData.recentSales}
              columns={columns}
              rowKey="voucherNo"
              pagination={false}
              bordered
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
