import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, DatePicker, Select, Popconfirm, Tooltip, Row, Col 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, SearchOutlined, CheckCircleOutlined, 
  ClockCircleOutlined, SettingOutlined 
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  manufacturingService, 
  type ProductionResponse, 
  ProductionStatusEnum, 
  type ProductionStatus,
  getProductionStatusConfig 
} from '../../services/manufacturingService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const DEFAULT_PAGE_SIZE = 20;
const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Filters + paging live in the URL query string (Jira-style), e.g.
 *   /daily-entries/manufacturing?from=2026-10-01&to=2026-10-22&status=InProgress&voucher=15&page=2&size=20
 * so hard refresh, back/forward and shared links restore the exact same view.
 */
export const ManufacturingList: React.FC = () => {
  const navigate = useNavigate();
  useFormShortcuts({
    onNew: () => navigate('/daily-entries/manufacturing/new'),
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductionResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Local draft for voucher input before enter/blur
  const [voucherDraft, setVoucherDraft] = useState('');

  // First visit without query string: seed default range
  useEffect(() => {
    if (searchParams.toString() === '') {
      const next = new URLSearchParams();
      next.set('from', dayjs().subtract(30, 'day').format(DATE_FORMAT));
      next.set('to', dayjs().format(DATE_FORMAT));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useMemo(() => {
    const from = searchParams.get('from') || searchParams.get('fromDate');
    const to = searchParams.get('to') || searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    const status = searchParams.get('status') || undefined;
    const voucher = searchParams.get('voucher') || searchParams.get('voucherNo') || undefined;
    return {
      from: from && dayjs(from, DATE_FORMAT, true).isValid() ? from : undefined,
      to: to && dayjs(to, DATE_FORMAT, true).isValid() ? to : undefined,
      status: status as ProductionStatus | undefined,
      voucher,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      size: Number.isFinite(size) && size > 0 ? Math.min(size, 200) : DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  useEffect(() => {
    setVoucherDraft(query.voucher || '');
  }, [query.voucher]);

  const fetchData = async () => {
    if (searchParams.toString() === '') return;
    try {
      setLoading(true);
      const filter = {
        fromDate: query.from,
        toDate: query.to,
        status: query.status,
        voucherNo: query.voucher,
        pageNumber: query.page,
        pageSize: query.size
      };
      const result = await manufacturingService.getList(filter);
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      message.error('Failed to fetch manufacturing vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchParams]);

  const updateParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page'); // return to page 1 on filter changes
    setSearchParams(next);
  };

  const handleDateChange = (vals: any) => {
    const next = new URLSearchParams(searchParams);
    if (vals?.[0] && vals?.[1]) {
      next.set('from', vals[0].format(DATE_FORMAT));
      next.set('to', vals[1].format(DATE_FORMAT));
    } else {
      next.delete('from');
      next.delete('to');
    }
    next.delete('page');
    setSearchParams(next);
  };

  const handleReset = () => {
    const next = new URLSearchParams();
    next.set('from', dayjs().subtract(30, 'day').format(DATE_FORMAT));
    next.set('to', dayjs().format(DATE_FORMAT));
    setSearchParams(next);
  };

  const handleTableChange = (page: number, size: number) => {
    const next = new URLSearchParams(searchParams);
    if (size !== query.size) page = 1;
    if (page > 1) next.set('page', String(page)); else next.delete('page');
    if (size !== DEFAULT_PAGE_SIZE) next.set('size', String(size)); else next.delete('size');
    setSearchParams(next);
  };

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
        );
      }
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
                value={query.from && query.to ? [dayjs(query.from), dayjs(query.to)] : null}
                onChange={handleDateChange}
                format="DD/MM/YYYY"
              />
              <Select
                placeholder="All Statuses"
                value={query.status}
                onChange={(val) => updateParam('status', val != null ? String(val) : undefined)}
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
                value={voucherDraft}
                onChange={(e) => setVoucherDraft(e.target.value)}
                onPressEnter={() => updateParam('voucher', voucherDraft.trim() || undefined)}
                onBlur={() => updateParam('voucher', voucherDraft.trim() || undefined)}
                style={{ width: 130 }}
                allowClear
              />
              <Button icon={<ReloadOutlined />} onClick={handleReset}>Reset</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/daily-entries/manufacturing/new')}>
                New Production Run (F1)
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: query.page,
            pageSize: query.size,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} production runs`,
            onChange: handleTableChange,
          }}
          bordered
          size="middle"
        />
      </Card>
    </div>
  );
};
