import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Modal, Form, Input, InputNumber, Popconfirm, Tooltip, Row, Col, Select, DatePicker, Segmented
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, SearchOutlined, ToolOutlined, CheckCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  repairJobService, 
  type RepairJobResponse,
  type RepairJobBillRequest
} from '../../services/repairJobService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  Received: 'blue',
  InProgress: 'orange',
  WaitingForParts: 'gold',
  Completed: 'green',
  Delivered: 'purple',
  Cancelled: 'red'
};

export const RepairJobList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RepairJobResponse[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Quick Status Modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RepairJobResponse | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusRemarks, setStatusRemarks] = useState<string>('');

  // Bill Modal
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [billingJob, setBillingJob] = useState<RepairJobResponse | null>(null);
  const [billForm] = Form.useForm();
  const [billingLoading, setBillingLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const filter: any = {};
      if (selectedStatus !== 'All') {
        filter.status = selectedStatus;
      }
      if (dateRange) {
        filter.fromDate = dateRange[0].format('YYYY-MM-DD');
        filter.toDate = dateRange[1].format('YYYY-MM-DD');
      }
      const result = await repairJobService.getList(filter);
      setData(result);
    } catch {
      message.error('Failed to fetch repair jobs');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (jobNo: string) => {
    try {
      await repairJobService.delete(jobNo);
      message.success('Repair job deleted successfully');
      fetchData();
    } catch {
      message.error('Failed to delete repair job');
    }
  };

  const handleOpenStatusModal = (record: RepairJobResponse) => {
    setSelectedJob(record);
    setNewStatus(record.status);
    setStatusRemarks('');
    setStatusModalVisible(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedJob) return;
    try {
      await repairJobService.updateStatus(selectedJob.jobNo, {
        status: newStatus,
        remarks: statusRemarks
      });
      message.success('Status updated successfully');
      setStatusModalVisible(false);
      fetchData();
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleOpenBillModal = (record: RepairJobResponse) => {
    setBillingJob(record);
    billForm.resetFields();
    billForm.setFieldsValue({
      cashReceipt: record.balanceDue > 0 ? record.balanceDue : record.totalAmount,
      discount: 0,
      description: `Repair Bill for Job #${record.jobNo} (${record.deviceModel})`
    });
    setBillModalVisible(true);
  };

  const handleBillSubmit = async () => {
    if (!billingJob) return;
    try {
      const values = await billForm.validateFields();
      setBillingLoading(true);
      const request: RepairJobBillRequest = {
        cashReceipt: values.cashReceipt || 0,
        discount: values.discount || 0,
        description: values.description
      };
      const saleVNo = await repairJobService.billJob(billingJob.jobNo, request);
      message.success(`Job billed successfully! Created Sale SL-${saleVNo}`);
      setBillModalVisible(false);
      fetchData();
    } catch {
      message.error('Failed to generate sale bill');
    } finally {
      setBillingLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      item.jobNo?.toLowerCase().includes(lower) ||
      item.customerName?.toLowerCase().includes(lower) ||
      item.customerPhone?.toLowerCase().includes(lower) ||
      item.deviceModel?.toLowerCase().includes(lower) ||
      item.imei?.toLowerCase().includes(lower) ||
      item.faultDescription?.toLowerCase().includes(lower)
    );
  });

  const columns = [
    {
      title: 'Job #',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: '110px',
      render: (text: string) => <Tag color="blue" style={{ fontWeight: 600 }}>{text}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'jobDate',
      key: 'jobDate',
      width: '110px',
      render: (val: string) => dayjs(val).format('DD-MMM-YYYY'),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: '180px',
      render: (_: any, record: RepairJobResponse) => (
        <div>
          <Text strong>{record.customerName || record.customerAccountTitle || record.customerAcc}</Text>
          {record.customerPhone && (
            <div><Text type="secondary" style={{ fontSize: '12px' }}>{record.customerPhone}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Device & Model',
      key: 'device',
      width: '180px',
      render: (_: any, record: RepairJobResponse) => (
        <div>
          <Text strong>{record.brandTitle ? `${record.brandTitle} ` : ''}{record.deviceModel}</Text>
          {record.imei && (
            <div><Text type="secondary" style={{ fontSize: '11px' }}>IMEI: {record.imei}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Fault Description',
      dataIndex: 'faultDescription',
      key: 'faultDescription',
      ellipsis: true,
      render: (text: string) => <Tooltip title={text}><span>{text}</span></Tooltip>,
    },
    {
      title: 'Technician',
      dataIndex: 'assignedTechnicianName',
      key: 'assignedTechnicianName',
      width: '130px',
      render: (val?: string) => val ? <Tag color="cyan">{val}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '130px',
      render: (val: string, record: RepairJobResponse) => (
        <Tag 
          color={STATUS_COLORS[val] || 'default'} 
          style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}
          onClick={() => handleOpenStatusModal(record)}
        >
          {val}
        </Tag>
      ),
    },
    {
      title: 'Total / Balance',
      key: 'financials',
      width: '140px',
      align: 'right' as const,
      render: (_: any, record: RepairJobResponse) => (
        <div style={{ textAlign: 'right' }}>
          <div><Text strong>Rs. {(record.totalAmount || 0).toLocaleString()}</Text></div>
          {record.balanceDue > 0 ? (
            <Text type="danger" style={{ fontSize: '12px' }}>Due: Rs. {record.balanceDue.toLocaleString()}</Text>
          ) : (
            <Text type="success" style={{ fontSize: '12px' }}>Paid</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Billed',
      dataIndex: 'saleVNo',
      key: 'saleVNo',
      width: '110px',
      render: (val?: string) => val ? (
        <Tag color="success">SL-{val}</Tag>
      ) : (
        <Tag color="default">Unbilled</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '150px',
      render: (_: any, record: RepairJobResponse) => (
        <Space size="small">
          <Tooltip title="View / Edit">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => navigate(`/devices-repairs/repair-jobs/${record.jobNo}`)} 
            />
          </Tooltip>
          
          {!record.saleVNo && (record.status === 'Completed' || record.status === 'Delivered') && (
            <Tooltip title="Bill to Sale">
              <Button 
                type="text" 
                icon={<DollarOutlined style={{ color: '#52c41a' }} />} 
                onClick={() => handleOpenBillModal(record)} 
              />
            </Tooltip>
          )}

          <Tooltip title="Update Status">
            <Button 
              type="text" 
              icon={<CheckCircleOutlined style={{ color: '#fa8c16' }} />} 
              onClick={() => handleOpenStatusModal(record)} 
            />
          </Tooltip>

          <Tooltip title="Delete">
            <Popconfirm
              title="Delete Job Card"
              description="Are you sure you want to delete this job card?"
              onConfirm={() => handleDelete(record.jobNo)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                disabled={!!record.saleVNo}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        bordered={false} 
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ToolOutlined style={{ color: '#1677ff' }} />
              Repair Job Cards
            </Title>
            <Text type="secondary">Manage mobile repairs, diagnostics, parts & labor, and customer billing</Text>
          </div>
          
          <Space wrap>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => navigate('/devices-repairs/repair-jobs/new')}
              style={{ background: '#1677ff', borderRadius: '6px' }}
            >
              New Job Card
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12} lg={10}>
            <Segmented
              options={['All', 'Received', 'InProgress', 'WaitingForParts', 'Completed', 'Delivered']}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val as string)}
              block
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={8}>
            <Input
              placeholder="Search by Job #, customer, phone, IMEI..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <RangePicker 
              style={{ width: '100%' }} 
              value={dateRange} 
              onChange={(dates) => setDateRange(dates as any)} 
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="jobNo"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} jobs`,
          }}
          size="middle"
        />
      </Card>

      {/* Quick Status Modal */}
      <Modal
        title={`Update Status: Job #${selectedJob?.jobNo}`}
        open={statusModalVisible}
        onOk={handleSaveStatus}
        onCancel={() => setStatusModalVisible(false)}
        okText="Update Status"
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Device: </Text>
            <Text>{selectedJob?.deviceModel} (IMEI: {selectedJob?.imei || 'N/A'})</Text>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>New Status:</label>
            <Select 
              value={newStatus} 
              onChange={setNewStatus} 
              style={{ width: '100%' }}
              options={[
                { label: 'Received', value: 'Received' },
                { label: 'In Progress', value: 'InProgress' },
                { label: 'Waiting For Parts', value: 'WaitingForParts' },
                { label: 'Completed', value: 'Completed' },
                { label: 'Delivered', value: 'Delivered' },
                { label: 'Cancelled', value: 'Cancelled' }
              ]}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Remarks (Optional):</label>
            <Input.TextArea 
              rows={3} 
              value={statusRemarks} 
              onChange={(e) => setStatusRemarks(e.target.value)} 
              placeholder="e.g. Screen replaced, tested okay. Ready for pickup."
            />
          </div>
        </div>
      </Modal>

      {/* Bill to Sale Modal */}
      <Modal
        title={`Bill Job Card #${billingJob?.jobNo} to Sale`}
        open={billModalVisible}
        onOk={handleBillSubmit}
        confirmLoading={billingLoading}
        onCancel={() => setBillModalVisible(false)}
        okText="Generate Sale Invoice"
      >
        <Form form={billForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Row justify="space-between" style={{ marginBottom: 6 }}>
              <Text type="secondary">Total Job Amount:</Text>
              <Text strong>Rs. {(billingJob?.totalAmount || 0).toLocaleString()}</Text>
            </Row>
            <Row justify="space-between" style={{ marginBottom: 6 }}>
              <Text type="secondary">Advance Paid:</Text>
              <Text type="success">Rs. {(billingJob?.advancePaid || 0).toLocaleString()}</Text>
            </Row>
            <Row justify="space-between">
              <Text strong>Net Balance Due:</Text>
              <Text strong type="danger" style={{ fontSize: 16 }}>Rs. {(billingJob?.balanceDue || 0).toLocaleString()}</Text>
            </Row>
          </div>

          <Form.Item
            name="cashReceipt"
            label="Cash Received"
            rules={[{ required: true, message: 'Please enter cash amount received' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
            />
          </Form.Item>

          <Form.Item
            name="discount"
            label="Discount"
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description / Invoice Note"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
