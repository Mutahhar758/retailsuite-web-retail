import React, { useState, useEffect } from 'react';
import { 
  Card, Input, Button, Typography, Tag, Space, Timeline, 
  Row, Col, Empty, Spin, message
} from 'antd';
import { 
  SearchOutlined, HistoryOutlined, ShoppingCartOutlined, 
  DollarOutlined, ToolOutlined, CheckCircleOutlined, 
  MobileOutlined, ArrowLeftOutlined, UndoOutlined
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { imeiService, type ImeiHistoryResponse } from '../../services/imeiService';

const { Title, Text } = Typography;

export const ImeiHistoryView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialImei = searchParams.get('imei') || '';
  
  const [searchInput, setSearchInput] = useState(initialImei);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ImeiHistoryResponse | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialImei) {
      handleSearch(initialImei);
    }
  }, [initialImei]);

  const handleSearch = async (imeiToSearch: string) => {
    const clean = imeiToSearch.trim();
    if (!clean) {
      message.warning('Please enter an IMEI or Serial number');
      return;
    }

    try {
      setLoading(true);
      setSearched(true);
      setSearchParams({ imei: clean });
      const data = await imeiService.getImeiHistory(clean);
      setHistory(data);
    } catch {
      message.error('Failed to retrieve IMEI history');
      setHistory(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Top Header Card */}
      <Card 
        bordered={false} 
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          marginBottom: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/devices-repairs/imei-stock')}
            >
              Stock Ledger
            </Button>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HistoryOutlined style={{ color: '#1677ff' }} />
              360° Device Lifecycle Timeline
            </Title>
          </Space>
        </div>

        <Row gutter={16} align="middle">
          <Col xs={24} md={14} lg={12}>
            <Input.Search
              size="large"
              placeholder="Scan or enter 15-digit IMEI / Serial number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={() => handleSearch(searchInput)}
              enterButton={<Button type="primary" icon={<SearchOutlined />}>Track Device</Button>}
            />
          </Col>
        </Row>
      </Card>

      {/* Results View */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}><Text type="secondary">Tracing device provenance and lifecycle...</Text></div>
        </div>
      ) : history ? (
        <div>
          {/* Device Profile Card */}
          <Card 
            style={{ borderRadius: 12, marginBottom: 20, borderLeft: '4px solid #1677ff' }}
          >
            <Row gutter={[20, 20]} align="middle">
              <Col xs={24} md={14}>
                <Title level={4} style={{ margin: 0 }}>
                  {history.brandTitle ? `${history.brandTitle} ` : ''}{history.itemTitle}
                </Title>
                <div style={{ marginTop: 6 }}>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 15 }}>IMEI: {history.imei}</Text>
                  {history.imei2 && (
                    <Text type="secondary" style={{ fontFamily: 'monospace', marginLeft: 16 }}>IMEI 2: {history.imei2}</Text>
                  )}
                </div>
              </Col>

              <Col xs={24} md={10} style={{ textAlign: 'right' }}>
                <Space wrap>
                  {history.isInStock ? (
                    <Tag color="green" style={{ fontSize: 13, padding: '4px 10px' }}>CURRENTLY IN STOCK</Tag>
                  ) : (
                    <Tag color="default" style={{ fontSize: 13, padding: '4px 10px' }}>SOLD TO CUSTOMER</Tag>
                  )}
                  {history.currentPtaStatus && (
                    <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>{history.currentPtaStatus}</Tag>
                  )}
                </Space>
                {history.currentCondition && (
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary">Condition: {history.currentCondition}</Text>
                  </div>
                )}
              </Col>
            </Row>
          </Card>

          {/* Lifecycle Timeline */}
          <Card 
            title={<span><MobileOutlined style={{ color: '#1677ff', marginRight: 8 }} />Device Provenance & Audit Trail</span>} 
            style={{ borderRadius: 12 }}
          >
            <Timeline mode="left" style={{ marginTop: 24, paddingLeft: 20 }}>
              {/* 1. Purchase Step */}
              {history.purchasedIn && (
                <Timeline.Item 
                  color="blue" 
                  dot={<ShoppingCartOutlined style={{ fontSize: 18 }} />}
                >
                  <Card size="small" style={{ borderRadius: 8, background: '#f0f5ff', maxWidth: 650 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#1677ff' }}>PURCHASE / INTAKE</Text>
                      <Text type="secondary">{dayjs(history.purchasedIn.date).format('DD-MMM-YYYY')}</Text>
                    </div>
                    <div>
                      <Text>Voucher: <Tag color="blue">{history.purchasedIn.voucherNo}</Tag></Text>
                      <Text style={{ marginLeft: 12 }}>Vendor: <Text strong>{history.purchasedIn.accountTitle || history.purchasedIn.accountId}</Text></Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Text>Cost Price: <Text strong style={{ color: '#1677ff' }}>Rs. {history.purchasedIn.rate.toLocaleString()}</Text></Text>
                      {history.purchasedIn.ptaStatus && (
                        <Text style={{ marginLeft: 16 }}>Intake Status: <Tag>{history.purchasedIn.ptaStatus}</Tag></Text>
                      )}
                    </div>
                  </Card>
                </Timeline.Item>
              )}

              {/* 2. Capitalized Expenses / Cost Additions */}
              {history.costAdditions && history.costAdditions.map((cost) => (
                <Timeline.Item 
                  key={cost.id}
                  color="gold" 
                  dot={<DollarOutlined style={{ fontSize: 18 }} />}
                >
                  <Card size="small" style={{ borderRadius: 8, background: '#fffbe6', maxWidth: 650 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#d48806' }}>CAPITALIZED EXPENSE ({cost.expenseType})</Text>
                      <Text type="secondary">{dayjs(cost.date).format('DD-MMM-YYYY')}</Text>
                    </div>
                    <div>
                      <Text>{cost.description}</Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Text>Added Amount: <Text strong style={{ color: '#d48806' }}>+Rs. {cost.amount.toLocaleString()}</Text></Text>
                      {cost.paidFromTitle && (
                        <Text style={{ marginLeft: 16 }} type="secondary">Paid from: {cost.paidFromTitle}</Text>
                      )}
                      {cost.consumedItemTitle && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">Part Consumed: {cost.consumedItemTitle} (Qty: {cost.consumedQty || 1})</Text>
                        </div>
                      )}
                    </div>
                  </Card>
                </Timeline.Item>
              ))}

              {/* 3. Repair Jobs */}
              {history.repairJobs && history.repairJobs.map((job) => (
                <Timeline.Item 
                  key={job.jobNo}
                  color="orange" 
                  dot={<ToolOutlined style={{ fontSize: 18 }} />}
                >
                  <Card size="small" style={{ borderRadius: 8, background: '#fff7e6', maxWidth: 650 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#d46b08' }}>WORKSHOP REPAIR (Job #{job.jobNo})</Text>
                      <Text type="secondary">{dayjs(job.jobDate).format('DD-MMM-YYYY')}</Text>
                    </div>
                    <div>
                      <Text>Fault: {job.faultDescription}</Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag color="orange">{job.status}</Tag>
                      <Text style={{ marginLeft: 12 }}>Repair Total: <Text strong>Rs. {job.totalAmount.toLocaleString()}</Text></Text>
                    </div>
                  </Card>
                </Timeline.Item>
              ))}

              {/* 4. Sale Step */}
              {history.soldIn && (
                <Timeline.Item 
                  color="green" 
                  dot={<CheckCircleOutlined style={{ fontSize: 18 }} />}
                >
                  <Card size="small" style={{ borderRadius: 8, background: '#f6ffed', maxWidth: 650 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#389e0d' }}>SALE / DISPATCH</Text>
                      <Text type="secondary">{dayjs(history.soldIn.date).format('DD-MMM-YYYY')}</Text>
                    </div>
                    <div>
                      <Text>Invoice: <Tag color="green">{history.soldIn.voucherNo}</Tag></Text>
                      <Text style={{ marginLeft: 12 }}>Customer: <Text strong>{history.soldIn.accountTitle || history.soldIn.accountId}</Text></Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Text>Sold Price: <Text strong style={{ color: '#389e0d' }}>Rs. {history.soldIn.rate.toLocaleString()}</Text></Text>
                      {history.soldIn.warrantyMonths && (
                        <Text style={{ marginLeft: 16 }}>Warranty: <Tag color="purple">{history.soldIn.warrantyMonths} Months</Tag></Text>
                      )}
                    </div>
                  </Card>
                </Timeline.Item>
              )}

              {/* 5. Return Step */}
              {history.returnedIn && (
                <Timeline.Item 
                  color="red" 
                  dot={<UndoOutlined style={{ fontSize: 18 }} />}
                >
                  <Card size="small" style={{ borderRadius: 8, background: '#fff1f0', maxWidth: 650 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text strong style={{ color: '#cf1322' }}>RETURN / REVERSAL</Text>
                      <Text type="secondary">{dayjs(history.returnedIn.date).format('DD-MMM-YYYY')}</Text>
                    </div>
                    <div>
                      <Text>Voucher: <Tag color="red">{history.returnedIn.voucherNo}</Tag></Text>
                      <Text style={{ marginLeft: 12 }}>Account: <Text strong>{history.returnedIn.accountTitle || history.returnedIn.accountId}</Text></Text>
                    </div>
                  </Card>
                </Timeline.Item>
              )}
            </Timeline>
          </Card>
        </div>
      ) : searched ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty description="No transaction or lifecycle records found for this IMEI / Serial number." />
        </Card>
      ) : (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
          <MobileOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <div><Title level={4}>Track Handset Provenance</Title></div>
          <Text type="secondary">Enter any handset IMEI or Serial number above to view its complete lifecycle timeline.</Text>
        </Card>
      )}
    </div>
  );
};
