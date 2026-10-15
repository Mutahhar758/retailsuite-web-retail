import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, DatePicker, Select, Popconfirm, Tooltip, Row, Col 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, SearchOutlined, CheckCircleOutlined, 
  ClockCircleOutlined, SettingOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  manufacturingService, 
  type ProductionResponse, 
  ProductionStatusLabels, 
  ProductionStatusEnum, 
  type ProductionStatus,
  getProductionStatusConfig 
} from '../../services/manufacturingService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export const ManufacturingList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductionResponse[]>([]);
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ]);
  const [statusFilter, setStatusFilter] = useState<ProductionStatus | undefined>(undefined);
  const [voucherNoFilter, setVoucherNoFilter] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const filter = {
        fromDate: dates ? dates[0].format('YYYY-MM-DD') : undefined,
        toDate: dates ? dates[1].format('YYYY-MM-DD') : undefined,
        status: statusFilter,
        voucherNo: voucherNoFilter.trim() || undefined
      };
      const result = await manufacturingService.getList(filter);
      setData(result);
    } catch (error) {
      message.error('Failed to fetch manufacturing vouchers');
    } finally {
      setLoading(false);
    }
  }, [dates, statusFilter, voucherNoFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (voucherNo: string, newStatus: ProductionStatus) => {
    try {
      await manufacturingService.updateStatus(voucherNo, newStatus);
      message.success(`Voucher status updated successfully`);
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (voucherNo: string) => {
    try {
      await manufacturingService.delete(voucherNo);
      message.success('Manufacturing voucher deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete manufacturing voucher');
    }
  };

  const columns = [
    {
      title: 'Voucher No',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 110,
      render: (vNo: string) => <Text strong style={{ color: '#1677ff' }}>{vNo}</Text>
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Finished Product',
      dataIndex: 'finishedItemTitle',
      key: 'finishedItemTitle',
      render: (title: string, record: ProductionResponse) => (
        <div>
          <Text strong>{title}</Text>
          {record.bomTitle && (
            <div><Text type="secondary" style={{ fontSize: 11 }}>Formula: {record.bomTitle}</Text></div>
          )}
          {record.batchNo && (
            <div><Tag color="geekblue" style={{ fontSize: 10, marginTop: 2 }}>Batch: {record.batchNo}</Tag></div>
          )}
        </div>
      )
    },
    {
      title: 'Target / Produced',
      key: 'quantities',
      width: 150,
      render: (_: any, record: ProductionResponse) => (
        <div>
          <div><Text type="secondary" style={{ fontSize: 11 }}>Target: </Text><Text>{record.targetQty} {record.unitTitle || ''}</Text></div>
          <div><Text type="secondary" style={{ fontSize: 11 }}>Produced: </Text><Text strong>{record.producedQty} {record.unitTitle || ''}</Text></div>
        </div>
      )
    },
    {
      title: 'Material Cost',
      dataIndex: 'totalMaterialCost',
      key: 'totalMaterialCost',
      align: 'right' as const,
      width: 120,
      render: (val: number) => <Text>{(val || 0).toFixed(2)}</Text>
    },
    {
      title: 'Total Cost',
      dataIndex: 'totalProductionCost',
      key: 'totalProductionCost',
      align: 'right' as const,
      width: 130,
      render: (val: number) => <Text strong>{(val || 0).toFixed(2)}</Text>
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitProductionCost',
      key: 'unitProductionCost',
      align: 'right' as const,
      width: 120,
      render: (val: number) => <Text strong style={{ color: '#52c41a' }}>{(val || 0).toFixed(2)}</Text>
    },
    {
      title: 'Status & Stage',
      key: 'status',
      width: 160,
      render: (_: any, record: ProductionResponse) => {
        const config = getProductionStatusConfig(record.status);
        const statusStr = String(record.status).toLowerCase();
        const isInProgress = statusStr === 'inprogress' || record.status === 1;
        return (
          <div>
            <Tag color={config.color}>{config.label}</Tag>
            {record.currentStage && isInProgress && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Stage: {record.currentStage}</Text>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: ProductionResponse) => {
        const statusStr = String(record.status).toLowerCase();
        const isPlanned = statusStr === 'planned' || record.status === 0;
        const isInProgress = statusStr === 'inprogress' || record.status === 1;

        return (
          <Space size="small">
            {isPlanned && (
              <Tooltip title="Issue Materials into WIP">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<ClockCircleOutlined />}
                  onClick={() => handleStatusChange(record.voucherNo, ProductionStatusEnum.InProgress)}
                >
                  Start WIP
                </Button>
              </Tooltip>
            )}

            {isInProgress && (
              <Tooltip title="Complete Batch & Admit Goods">
                <Button
                  size="small"
                  type="primary"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleStatusChange(record.voucherNo, ProductionStatusEnum.Completed)}
                >
                  Complete
                </Button>
              </Tooltip>
            )}

          <Tooltip title="View / Edit Voucher">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1677ff' }} />}
              onClick={() => navigate(`/daily-entries/manufacturing/${record.voucherNo}`)}
            />
          </Tooltip>

          <Tooltip title="Delete Voucher">
            <Popconfirm
              title="Delete Manufacturing Voucher"
              description="Are you sure you want to delete this voucher? Inventory and accounting transactions will be reverted."
              onConfirm={() => handleDelete(record.voucherNo)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <SettingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Manufacturing & Production Runs</Title>
                <Text type="secondary">Batch tracking, raw material issuance, and finished goods inventory admission</Text>
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
                placeholder="All Statuses"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 150 }}
              >
                <Option value={ProductionStatusEnum.Planned}>Planned</Option>
                <Option value={ProductionStatusEnum.InProgress}>In Progress (WIP)</Option>
                <Option value={ProductionStatusEnum.Completed}>Completed</Option>
                <Option value={ProductionStatusEnum.Cancelled}>Cancelled</Option>
              </Select>
              <Input
                placeholder="Voucher #"
                prefix={<SearchOutlined />}
                value={voucherNoFilter}
                onChange={(e) => setVoucherNoFilter(e.target.value)}
                onPressEnter={fetchData}
                style={{ width: 130 }}
                allowClear
              />
              <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/daily-entries/manufacturing/new')}>
                New Production Run
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (total) => `Total ${total} production runs` }}
          bordered
          size="middle"
        />
      </Card>
    </div>
  );
};
