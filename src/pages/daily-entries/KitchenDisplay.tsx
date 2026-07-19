import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Card, Col, Row, Space, Button, Select, Typography, Badge, 
  Spin, message, Empty, Divider, Popconfirm, Tooltip, Tag 
} from 'antd';
import { 
  ReloadOutlined, SoundOutlined, ClockCircleOutlined, 
  CheckCircleOutlined, PlayCircleOutlined, FireOutlined, TableOutlined, ShopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { kotService, type KotOrderResponse, type PrepStationDto } from '../../services/kotService';

const { Title, Text } = Typography;
const { Option } = Select;

export const KitchenDisplay: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<KotOrderResponse[]>([]);
  const [stations, setStations] = useState<PrepStationDto[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>(() => {
    return localStorage.getItem('kds_selected_station') || 'ALL';
  });
  const [currentTime, setCurrentTime] = useState(dayjs());
  const prevOrdersCountRef = useRef<number>(0);

  // Sound generator
  const playNewOrderSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.35); // 350ms beep
    } catch (err) {
      console.warn('AudioContext failed:', err);
    }
  };

  const fetchStations = useCallback(async () => {
    try {
      const result = await kotService.getPrepStations();
      setStations(result.filter(s => s.active));
    } catch (err) {
      console.error('Failed to fetch prep stations', err);
    }
  }, []);

  const fetchOrders = useCallback(async (stationId?: string) => {
    try {
      setLoading(true);
      const activeStation = stationId === 'ALL' ? undefined : stationId;
      const result = await kotService.getActive(activeStation);
      setOrders(result);

      // Play alert sound if new orders are added
      if (result.length > prevOrdersCountRef.current) {
        // Don't play sound on initial load
        if (prevOrdersCountRef.current > 0) {
          playNewOrderSound();
        }
      }
      prevOrdersCountRef.current = result.length;
    } catch (error) {
      message.error('Failed to fetch active kitchen tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    fetchOrders(selectedStation);
    
    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      fetchOrders(selectedStation);
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedStation, fetchOrders]);

  // Clock timer to keep time counters ticking
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const handleStationChange = (value: string) => {
    setSelectedStation(value);
    localStorage.setItem('kds_selected_station', value);
  };

  const handleItemStatusChange = async (orderId: number, itemId: number, currentStatus: string) => {
    let nextStatus = 'Preparing';
    if (currentStatus === 'Preparing') nextStatus = 'Ready';
    else if (currentStatus === 'Ready') nextStatus = 'Served';

    try {
      await kotService.updateItemStatus(orderId, itemId, nextStatus);
      message.success(`Item status updated to ${nextStatus}`);
      fetchOrders(selectedStation);
    } catch (err) {
      message.error('Failed to update item status');
    }
  };

  const handleOrderStatusChange = async (orderId: number, status: string) => {
    try {
      await kotService.updateOrderStatus(orderId, status);
      message.success(`KOT order marked as ${status}`);
      fetchOrders(selectedStation);
    } catch (err) {
      message.error('Failed to update order status');
    }
  };

  // Get elapsed minutes
  const getElapsedTime = (createdOnStr: string) => {
    const createdTime = dayjs(createdOnStr);
    const diffMins = currentTime.diff(createdTime, 'minute');
    
    let color = '#52c41a'; // green
    if (diffMins >= 15) color = '#f5222d'; // red
    else if (diffMins >= 7) color = '#fa8c16'; // orange

    return {
      text: `${diffMins} min ago`,
      color
    };
  };

  const getOrderTypeTag = (type: string, tableName?: string) => {
    if (type === 'DineIn') {
      return (
        <Tag color="geekblue" icon={<TableOutlined />}>
          Dine-In {tableName ? `(${tableName})` : ''}
        </Tag>
      );
    }
    return (
      <Tag color="orange" icon={<ShopOutlined />}>
        Takeaway
      </Tag>
    );
  };

  const isOrderFullyReady = (order: KotOrderResponse) => {
    return order.lines.every(l => l.status === 'Ready' || l.status === 'Served');
  };

  return (
    <div style={{ padding: '0 8px 24px 8px' }}>
      <Card className="shadow-sm border-gray-100 rounded-xl mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space align="center" size="middle">
            <FireOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>Kitchen Display System (KDS)</Title>
              <Text type="secondary">Real-time split preparation display and tracking</Text>
            </div>
          </Space>
          
          <Space size="middle" style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: '500' }}>Prep Station:</span>
            <Select 
              value={selectedStation} 
              onChange={handleStationChange} 
              style={{ width: 180 }}
              size="large"
            >
              <Option value="ALL">All Stations</Option>
              <Option value="KITCHEN">Main Kitchen</Option>
              {stations.map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>

            <Tooltip title="Test Sound notification">
              <Button 
                shape="circle" 
                icon={<SoundOutlined />} 
                onClick={playNewOrderSound}
              />
            </Tooltip>

            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => fetchOrders(selectedStation)}
              loading={loading}
              size="large"
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      <Spin spinning={loading && orders.length === 0}>
        {orders.length === 0 ? (
          <Empty 
            description={<Title level={4} type="secondary">No active kitchen orders</Title>}
            style={{ marginTop: 80 }}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {orders.map(order => {
              const elapsed = getElapsedTime(order.createdOn);
              const allReady = isOrderFullyReady(order);
              
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={order.id}>
                  <Card 
                    hoverable
                    style={{ 
                      borderRadius: 12, 
                      overflow: 'hidden', 
                      borderTop: `6px solid ${allReady ? '#52c41a' : elapsed.color}`
                    }}
                    bodyStyle={{ padding: '16px' }}
                    className="shadow-sm"
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Badge 
                            count={`Token #${order.tokenNo}`} 
                            style={{ 
                              backgroundColor: allReady ? '#52c41a' : '#1677ff', 
                              fontSize: 16, 
                              height: 28, 
                              lineHeight: '28px',
                              padding: '0 10px',
                              borderRadius: 14
                            }} 
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>ID: {order.id}</Text>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          {getOrderTypeTag(order.orderType, order.tableName)}
                        </div>
                      </div>
                      <Space direction="vertical" align="end" size={2}>
                        <Text style={{ color: elapsed.color, fontWeight: 'bold', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ClockCircleOutlined />
                          {elapsed.text}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(`${order.orderDate}T${order.orderTime}`).format('hh:mm A')}
                        </Text>
                      </Space>
                    </div>

                    <Divider style={{ margin: '8px 0' }} />

                    {/* Remarks/Notes */}
                    {order.remarks && (
                      <div style={{ 
                        backgroundColor: '#fffbe6', 
                        border: '1px solid #ffe58f', 
                        borderRadius: 6, 
                        padding: '6px 10px', 
                        marginBottom: 12 
                      }}>
                        <Text type="warning" strong style={{ fontSize: 12 }}>Remarks: </Text>
                        <Text style={{ fontSize: 12, color: '#d46b08' }}>{order.remarks}</Text>
                      </div>
                    )}

                    {/* Item List */}
                    <div style={{ minHeight: 120, marginBottom: 12 }}>
                      {order.lines.map(line => {
                        return (
                          <div 
                            key={line.id} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '6px 0',
                              borderBottom: '1px dashed #f0f0f0'
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: 8 }}>
                              <Text delete={line.status === 'Served'} style={{ fontSize: 14, fontWeight: line.status === 'Preparing' ? '600' : 'normal' }}>
                                {line.qty} x {line.itemTitle}
                              </Text>
                              {line.notes && (
                                <div style={{ fontSize: 11, color: '#ff4d4f', fontStyle: 'italic' }}>
                                  ({line.notes})
                                </div>
                              )}
                            </div>
                            <Space>
                              <Button 
                                size="small"
                                type={line.status === 'Pending' ? 'default' : line.status === 'Preparing' ? 'primary' : 'dashed'}
                                icon={line.status === 'Pending' ? <PlayCircleOutlined /> : line.status === 'Preparing' ? <CheckCircleOutlined /> : <CheckCircleOutlined />}
                                onClick={() => handleItemStatusChange(order.id, line.id, line.status)}
                                disabled={line.status === 'Served'}
                                style={{
                                  fontSize: 11,
                                  borderColor: line.status === 'Ready' ? '#52c41a' : undefined,
                                  color: line.status === 'Ready' ? '#52c41a' : undefined
                                }}
                              >
                                {line.status === 'Pending' ? 'Prepare' : line.status === 'Preparing' ? 'Ready' : 'Done'}
                              </Button>
                            </Space>
                          </div>
                        );
                      })}
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {allReady ? (
                        <Button 
                          type="primary" 
                          icon={<CheckCircleOutlined />} 
                          block
                          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                          onClick={() => handleOrderStatusChange(order.id, 'Served')}
                        >
                          Mark Served / Complete
                        </Button>
                      ) : (
                        <Popconfirm
                          title="Ready?"
                          description="Mark all items in this ticket as Ready?"
                          onConfirm={async () => {
                            try {
                              await Promise.all(
                                order.lines
                                  .filter(l => l.status !== 'Ready' && l.status !== 'Served')
                                  .map(l => kotService.updateItemStatus(order.id, l.id, 'Ready'))
                              );
                              message.success('All items marked as Ready');
                              fetchOrders(selectedStation);
                            } catch (err) {
                              message.error('Failed to update all items');
                            }
                          }}
                          okText="Yes"
                          cancelText="No"
                        >
                          <Button block>
                            Mark All Ready
                          </Button>
                        </Popconfirm>
                      )}
                      
                      <Popconfirm
                        title="Cancel Order?"
                        description="Are you sure you want to cancel this order?"
                        onConfirm={() => handleOrderStatusChange(order.id, 'Cancelled')}
                        okText="Yes"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                      >
                        <Button danger type="text">
                          Cancel
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>
    </div>
  );
};
