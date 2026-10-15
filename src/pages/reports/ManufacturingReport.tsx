import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Table, Row, Col, Space, Typography, DatePicker, 
  Select, Button, Tabs, Tag, Statistic, message 
} from 'antd';
import { 
  PrinterOutlined, ReloadOutlined, 
  BarChartOutlined, AppstoreOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { 
  manufacturingService, 
  type ProductionResponse, 
  ProductionStatusLabels 
} from '../../services/manufacturingService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export const ManufacturingReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductionResponse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);

  useEffect(() => {
    inventoryService.getItemsLookup().then(setItems).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const filter = {
        fromDate: dates ? dates[0].format('YYYY-MM-DD') : undefined,
        toDate: dates ? dates[1].format('YYYY-MM-DD') : undefined,
        finishedItemId: selectedProduct
      };
      const result = await manufacturingService.getList(filter);
      setData(result);
    } catch (err) {
      message.error('Failed to load manufacturing report data');
    } finally {
      setLoading(false);
    }
  }, [dates, selectedProduct]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate stats
  const totalBatches = data.length;
  const totalProducedUnits = data.reduce((sum, d) => sum + (d.producedQty || 0), 0);
  const totalMaterialSpend = data.reduce((sum, d) => sum + (d.totalMaterialCost || 0), 0);
  const totalProductionSpend = data.reduce((sum, d) => sum + (d.totalProductionCost || 0), 0);

  // Batch Summary Columns
  const batchColumns = [
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 100,
      render: (vNo: string) => <Text strong style={{ color: '#1677ff' }}>{vNo}</Text>
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY')
    },
    {
      title: 'Manufactured Product',
      dataIndex: 'finishedItemTitle',
      key: 'finishedItemTitle',
      render: (title: string, record: ProductionResponse) => (
        <div>
          <Text strong>{title}</Text>
          {record.bomTitle && <div><Text type="secondary" style={{ fontSize: 11 }}>Formula: {record.bomTitle}</Text></div>}
        </div>
      )
    },
    {
      title: 'Target / Output',
      key: 'output',
      width: 140,
      render: (_: any, record: ProductionResponse) => (
        <Text>{record.producedQty} / {record.targetQty} {record.unitTitle || ''}</Text>
      )
    },
    {
      title: 'Material Cost',
      dataIndex: 'totalMaterialCost',
      key: 'totalMaterialCost',
      align: 'right' as const,
      width: 120,
      render: (v: number) => (v || 0).toFixed(2)
    },
    {
      title: 'Overheads',
      dataIndex: 'totalOverheadCost',
      key: 'totalOverheadCost',
      align: 'right' as const,
      width: 110,
      render: (v: number) => (v || 0).toFixed(2)
    },
    {
      title: 'Total Batch Cost',
      dataIndex: 'totalProductionCost',
      key: 'totalProductionCost',
      align: 'right' as const,
      width: 130,
      render: (v: number) => <Text strong>{(v || 0).toFixed(2)}</Text>
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitProductionCost',
      key: 'unitProductionCost',
      align: 'right' as const,
      width: 110,
      render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{(v || 0).toFixed(2)}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: ProductionResponse) => {
        const config = ProductionStatusLabels[record.status] || { label: 'Unknown', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space align="center">
              <BarChartOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Manufacturing & Production Analysis Report</Title>
                <Text type="secondary">Review batch output yields, material costs, and manufacturing absorption</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <RangePicker
                value={dates}
                onChange={(vals) => setDates(vals as any)}
                format="DD/MM/YYYY"
              />
              <Select
                showSearch
                placeholder="All Manufactured Products"
                value={selectedProduct}
                onChange={setSelectedProduct}
                allowClear
                style={{ width: 220 }}
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {items.map(i => (
                  <Option key={i.id} value={i.id}>{i.title}</Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
            </Space>
          </Col>
        </Row>

        {/* Aggregate KPI Cards */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}>
              <Statistic title="Total Production Batches" value={totalBatches} valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Statistic title="Total Output Units Produced" value={totalProducedUnits} precision={2} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
              <Statistic title="Total Raw Materials Consumed" value={totalMaterialSpend} precision={2} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ backgroundColor: '#f9f0ff', borderColor: '#d3adf7' }}>
              <Statistic title="Total Production Value" value={totalProductionSpend} precision={2} valueStyle={{ color: '#722ed1' }} />
            </Card>
          </Col>
        </Row>

        <Tabs
          items={[
            {
              key: 'batches',
              label: (
                <Space>
                  <AppstoreOutlined />
                  <span>Production Batches</span>
                </Space>
              ),
              children: (
                <Table
                  dataSource={data}
                  columns={batchColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  bordered
                  size="middle"
                />
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};
