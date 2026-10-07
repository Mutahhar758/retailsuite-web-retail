import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Form, Input, InputNumber, Button, Select, 
  DatePicker, Space, Typography, Table, message, Divider, Alert
} from 'antd';
import { 
  ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, 
  ToolOutlined, DollarOutlined, UserOutlined, MobileOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  repairJobService, 
  type RepairJobResponse, 
  type RepairJobCreateRequest, 
  type RepairJobUpdateRequest 
} from '../../services/repairJobService';
import { brandService, type BrandLookupDto } from '../../services/brandService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item } from '../../services/inventoryService';

const { Title, Text } = Typography;

interface PartRow {
  key: number;
  itemId: string;
  qty: number;
  rate: number;
}

interface ServiceRow {
  key: number;
  description: string;
  amount: number;
  technicianShare: number;
}

export const RepairJobForm: React.FC = () => {
  const { jobNo } = useParams<{ jobNo: string }>();
  const isEdit = !!jobNo && jobNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [existingJob, setExistingJob] = useState<RepairJobResponse | null>(null);

  // Lookups
  const [brands, setBrands] = useState<BrandLookupDto[]>([]);
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [technicians, setTechnicians] = useState<ChartOfAccountHeadDto[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);

  // Grids
  const [parts, setParts] = useState<PartRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([
    { key: 1, description: 'Diagnostic & Service Labor', amount: 0, technicianShare: 0 }
  ]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [brandsRes, customersRes, itemsRes] = await Promise.all([
          brandService.getActiveBrands(),
          chartOfAccountService.getCustomerAccounts(),
          inventoryService.getItemsLookup()
        ]);
        setBrands(brandsRes);
        setCustomers(customersRes);
        setTechnicians(customersRes); // Or general accounts
        setInventoryItems(itemsRes);
      } catch {
        message.error('Failed to load lookup data');
      }
    };
    loadLookups();

    if (isEdit) {
      loadJobDetails();
    } else {
      form.setFieldsValue({
        jobDate: dayjs(),
        status: 'Received',
        advancePaid: 0,
        estimatedCost: 0
      });
    }
  }, [isEdit, jobNo]);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const job = await repairJobService.getById(jobNo!);
      if (job) {
        setExistingJob(job);
        form.setFieldsValue({
          jobDate: dayjs(job.jobDate),
          customerAcc: job.customerAcc,
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          brandId: job.brandId,
          deviceModel: job.deviceModel,
          imei: job.imei,
          passcodeOrPattern: job.passcodeOrPattern,
          faultDescription: job.faultDescription,
          physicalCondition: job.physicalCondition,
          estimatedCost: job.estimatedCost,
          advancePaid: job.advancePaid,
          status: job.status,
          assignedTechnicianId: job.assignedTechnicianId,
          expectedDelivery: job.expectedDelivery ? dayjs(job.expectedDelivery) : undefined,
          remarks: job.remarks
        });

        if (job.parts && job.parts.length > 0) {
          setParts(job.parts.map((p, idx) => ({
            key: p.id || idx + 1,
            itemId: p.itemId,
            qty: p.qty,
            rate: p.rate
          })));
        }

        if (job.services && job.services.length > 0) {
          setServices(job.services.map((s, idx) => ({
            key: s.id || idx + 1,
            description: s.description,
            amount: s.amount,
            technicianShare: s.technicianShare || 0
          })));
        }
      }
    } catch {
      message.error('Failed to load repair job');
    } finally {
      setLoading(false);
    }
  };

  // Parts Grid Handlers
  const handleAddPart = () => {
    setParts(prev => [
      ...prev,
      { key: Date.now(), itemId: '', qty: 1, rate: 0 }
    ]);
  };

  const handleUpdatePart = (key: number, field: keyof PartRow, value: any) => {
    setParts(prev => prev.map(p => {
      if (p.key === key) {
        const updated = { ...p, [field]: value };
        if (field === 'itemId') {
          const matchedItem = inventoryItems.find(i => i.id === value);
          if (matchedItem) {
            updated.rate = matchedItem.priRate || 0;
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const handleRemovePart = (key: number) => {
    setParts(prev => prev.filter(p => p.key !== key));
  };

  // Services Grid Handlers
  const handleAddService = () => {
    setServices(prev => [
      ...prev,
      { key: Date.now(), description: '', amount: 0, technicianShare: 0 }
    ]);
  };

  const handleUpdateService = (key: number, field: keyof ServiceRow, value: any) => {
    setServices(prev => prev.map(s => {
      if (s.key === key) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleRemoveService = (key: number) => {
    setServices(prev => prev.filter(s => s.key !== key));
  };

  // Totals
  const totalParts = parts.reduce((sum, p) => sum + ((p.qty || 0) * (p.rate || 0)), 0);
  const totalServices = services.reduce((sum, s) => sum + (s.amount || 0), 0);
  const grandTotal = totalParts + totalServices;
  const advancePaid = Form.useWatch('advancePaid', form) || 0;
  const balanceDue = grandTotal - advancePaid;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: RepairJobCreateRequest = {
        jobDate: values.jobDate.format('YYYY-MM-DD'),
        customerAcc: values.customerAcc,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        brandId: values.brandId,
        deviceModel: values.deviceModel,
        imei: values.imei,
        passcodeOrPattern: values.passcodeOrPattern,
        faultDescription: values.faultDescription,
        physicalCondition: values.physicalCondition,
        estimatedCost: values.estimatedCost || 0,
        advancePaid: values.advancePaid || 0,
        assignedTechnicianId: values.assignedTechnicianId,
        expectedDelivery: values.expectedDelivery ? values.expectedDelivery.format('YYYY-MM-DD') : undefined,
        remarks: values.remarks,
        parts: parts.filter(p => p.itemId).map(p => ({
          itemId: p.itemId,
          qty: p.qty,
          rate: p.rate
        })),
        services: services.filter(s => s.description || s.amount > 0).map(s => ({
          description: s.description || 'Labor',
          amount: s.amount,
          technicianShare: s.technicianShare || 0
        }))
      };

      if (isEdit) {
        const updatePayload: RepairJobUpdateRequest = {
          ...payload,
          status: values.status || existingJob?.status || 'Received'
        };
        await repairJobService.update(jobNo!, updatePayload);
        message.success('Repair job updated successfully');
      } else {
        const newJobNo = await repairJobService.create(payload);
        message.success(`Job card created successfully: #${newJobNo}`);
        navigate(`/devices-repairs/repair-jobs`);
      }
    } catch {
      message.error('Please verify the form fields');
    } finally {
      setLoading(false);
    }
  };

  const partColumns = [
    {
      title: 'Spare Part / Item',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (val: string, record: PartRow) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select inventory spare part"
          value={val || undefined}
          onChange={(newVal) => handleUpdatePart(record.key, 'itemId', newVal)}
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          options={inventoryItems.map(i => ({
            value: i.id,
            label: `${i.title} (${i.id})`
          }))}
        />
      )
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      render: (val: number, record: PartRow) => (
        <InputNumber
          min={1}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => handleUpdatePart(record.key, 'qty', v || 1)}
        />
      )
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      width: 120,
      render: (val: number, record: PartRow) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => handleUpdatePart(record.key, 'rate', v || 0)}
        />
      )
    },
    {
      title: 'Total',
      key: 'total',
      width: 120,
      render: (_: any, record: PartRow) => (
        <Text strong>Rs. {((record.qty || 0) * (record.rate || 0)).toLocaleString()}</Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: PartRow) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleRemovePart(record.key)} 
        />
      )
    }
  ];

  const serviceColumns = [
    {
      title: 'Service / Labor Description',
      dataIndex: 'description',
      key: 'description',
      render: (val: string, record: ServiceRow) => (
        <Input
          placeholder="e.g. Screen Replacement Labor, IC Reballing"
          value={val}
          onChange={(e) => handleUpdateService(record.key, 'description', e.target.value)}
        />
      )
    },
    {
      title: 'Labor Charge',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (val: number, record: ServiceRow) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={val}
          placeholder="Amount"
          onChange={(v) => handleUpdateService(record.key, 'amount', v || 0)}
        />
      )
    },
    {
      title: 'Tech Share',
      dataIndex: 'technicianShare',
      key: 'technicianShare',
      width: 140,
      render: (val: number, record: ServiceRow) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={val}
          placeholder="Share"
          onChange={(v) => handleUpdateService(record.key, 'technicianShare', v || 0)}
        />
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: ServiceRow) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleRemoveService(record.key)} 
        />
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/devices-repairs/repair-jobs')}
          >
            Back to Jobs
          </Button>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ToolOutlined style={{ color: '#1677ff' }} />
            {isEdit ? `Edit Job Card #${jobNo}` : 'New Repair Job Card'}
          </Title>
        </Space>

        <Space>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            loading={loading}
            onClick={handleSubmit}
            style={{ background: '#1677ff', borderRadius: '6px' }}
          >
            {isEdit ? 'Save Changes' : 'Create Job Card'}
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={[20, 20]}>
          {/* Main Column */}
          <Col xs={24} lg={16}>
            {/* Customer & Device Information */}
            <Card 
              title={<span><UserOutlined style={{ color: '#1677ff', marginRight: 8 }} />Customer & Device Details</span>} 
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="customerAcc"
                    label="Customer Account"
                    rules={[{ required: true, message: 'Please select customer account' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Customer Account"
                      filterOption={(input, option) =>
                        (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                      }
                      options={customers.map(c => ({
                        value: c.account,
                        label: `${c.title} (${c.account})`
                      }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="customerName" label="Customer Name">
                    <Input placeholder="Walk-in Customer Name" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="customerPhone" label="Contact Phone">
                    <Input placeholder="Phone / WhatsApp Number" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="brandId" label="Device Brand">
                    <Select
                      showSearch
                      allowClear
                      placeholder="Select Brand (e.g. Apple, Samsung)"
                      options={brands.map(b => ({ value: b.id, label: b.title }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="deviceModel"
                    label="Device Model"
                    rules={[{ required: true, message: 'Please enter device model' }]}
                  >
                    <Input placeholder="e.g. iPhone 14 Pro, Galaxy S23" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="imei" label="IMEI / Serial Number">
                    <Input placeholder="15-digit IMEI or Serial #" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="passcodeOrPattern" label="Screen Passcode / Pattern">
                    <Input placeholder="Passcode (for testing)" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item name="physicalCondition" label="Physical Condition On Received">
                    <Input placeholder="e.g. Minor scratches, cracked back, dent on frame" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="faultDescription"
                    label="Customer Stated Fault / Diagnostics"
                    rules={[{ required: true, message: 'Please enter fault description' }]}
                  >
                    <Input.TextArea rows={2} placeholder="e.g. Blank screen, no touch response, water damaged" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Spare Parts Grid */}
            <Card 
              title={<span><MobileOutlined style={{ color: '#1677ff', marginRight: 8 }} />Parts Consumed / Sold</span>} 
              extra={
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAddPart}>
                  Add Part
                </Button>
              }
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <Table
                dataSource={parts}
                columns={partColumns}
                pagination={false}
                size="small"
                locale={{ emptyText: 'No spare parts added to this job yet.' }}
              />
            </Card>

            {/* Labor / Services Grid */}
            <Card 
              title={<span><ToolOutlined style={{ color: '#1677ff', marginRight: 8 }} />Labor & Repair Services</span>} 
              extra={
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAddService}>
                  Add Service
                </Button>
              }
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <Table
                dataSource={services}
                columns={serviceColumns}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>

          {/* Side Column: Workflow & Financials */}
          <Col xs={24} lg={8}>
            <Card 
              title={<span><CheckCircleOutlined style={{ color: '#1677ff', marginRight: 8 }} />Job Details & Status</span>} 
              style={{ borderRadius: 12, marginBottom: 20 }}
            >
              <Form.Item
                name="jobDate"
                label="Received Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              {isEdit && (
                <Form.Item name="status" label="Current Status">
                  <Select
                    options={[
                      { label: 'Received', value: 'Received' },
                      { label: 'In Progress', value: 'InProgress' },
                      { label: 'Waiting For Parts', value: 'WaitingForParts' },
                      { label: 'Completed', value: 'Completed' },
                      { label: 'Delivered', value: 'Delivered' },
                      { label: 'Cancelled', value: 'Cancelled' }
                    ]}
                  />
                </Form.Item>
              )}

              <Form.Item name="assignedTechnicianId" label="Assigned Technician">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select Technician"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={technicians.map(t => ({ value: t.account, label: t.title }))}
                />
              </Form.Item>

              <Form.Item name="expectedDelivery" label="Expected Delivery Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="estimatedCost" label="Estimated Cost (Quote)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>

              <Form.Item name="advancePaid" label="Advance Received">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>

              <Form.Item name="remarks" label="Internal Notes / Remarks">
                <Input.TextArea rows={3} placeholder="Internal workshop notes" />
              </Form.Item>
            </Card>

            {/* Financial Summary */}
            <Card 
              title={<span><DollarOutlined style={{ color: '#52c41a', marginRight: 8 }} />Financial Summary</span>} 
              style={{ borderRadius: 12, background: '#fafafa' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text type="secondary">Parts Total:</Text>
                <Text strong>Rs. {totalParts.toLocaleString()}</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text type="secondary">Services & Labor:</Text>
                <Text strong>Rs. {totalServices.toLocaleString()}</Text>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 16 }}>Grand Total:</Text>
                <Text strong style={{ fontSize: 18, color: '#1677ff' }}>Rs. {grandTotal.toLocaleString()}</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text type="secondary">Advance Paid:</Text>
                <Text type="success" strong>Rs. {advancePaid.toLocaleString()}</Text>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 16 }}>Balance Due:</Text>
                <Text 
                  strong 
                  style={{ 
                    fontSize: 18, 
                    color: balanceDue > 0 ? '#ff4d4f' : '#52c41a' 
                  }}
                >
                  Rs. {balanceDue.toLocaleString()}
                </Text>
              </div>

              {existingJob?.saleVNo && (
                <Alert
                  type="success"
                  message={`Billed to Sale: SL-${existingJob.saleVNo}`}
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
