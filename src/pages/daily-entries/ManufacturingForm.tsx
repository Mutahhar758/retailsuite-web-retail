import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Space, Typography, 
  Select, DatePicker, Table, Row, Col, Divider, message, Popconfirm, 
  Statistic, Tag, Alert 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, 
  SettingOutlined, CheckCircleOutlined, ClockCircleOutlined, 
  ThunderboltOutlined, SyncOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  manufacturingService, 
  type ProductionCreateOrUpdateRequest, 
  ProductionStatusEnum, 
  type ProductionStatus 
} from '../../services/manufacturingService';
import { bomService, type BomResponse } from '../../services/bomService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { unitService, type UnitDto } from '../../services/unitService';
import { narrationService, type NarrationDto } from '../../services/narrationService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface ProductionLineRow {
  key: string;
  seq: number;
  rawItemId: string;
  rawItemTitle?: string;
  plannedQty: number;
  actualQty: number;
  unitId?: string;
  unitCost: number;
  totalCost: number;
  availableStock: number;
  isIssued: boolean;
}

export const ManufacturingForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [availableBoms, setAvailableBoms] = useState<BomResponse[]>([]);
  const [lines, setLines] = useState<ProductionLineRow[]>([]);

  // Overhead & Production values
  const [targetQty, setTargetQty] = useState<number>(1);
  const [producedQty, setProducedQty] = useState<number>(1);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [overheadCost, setOverheadCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<ProductionStatus>(ProductionStatusEnum.Completed);

  // Lookups
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [itemList, unitList, narrationList] = await Promise.all([
          inventoryService.getItemsLookup(),
          unitService.getActiveUnits(),
          narrationService.getAll()
        ]);
        setItems(itemList || []);
        setUnits(unitList || []);
        setNarrations(narrationList || []);
      } catch (err) {
        message.error('Failed to load item and unit lookups');
      }
    };
    loadLookups();
  }, []);

  // Load existing voucher if edit mode
  const fetchVoucher = useCallback(async () => {
    if (!isEdit || !voucherNo) {
      form.setFieldsValue({
        date: dayjs(),
        targetQty: 1,
        producedQty: 1,
        laborCost: 0,
        overheadCost: 0,
        packagingCost: 0,
        status: ProductionStatusEnum.Completed
      });
      return;
    }

    try {
      setLoading(true);
      const data = await manufacturingService.getDetail(voucherNo);
      form.setFieldsValue({
        date: dayjs(data.date),
        bomMasterId: data.bomMasterId,
        finishedItemId: data.finishedItemId,
        targetQty: data.targetQty,
        producedQty: data.producedQty,
        unitId: data.unitId,
        batchNo: data.batchNo,
        expiryDate: data.expiryDate ? dayjs(data.expiryDate) : undefined,
        laborCost: data.totalOverheadCost ? (data.totalOverheadCost / 3) : 0, // split placeholder
        overheadCost: 0,
        packagingCost: 0,
        narration: data.narrationId,
        remarks: data.remarks,
        status: data.status,
        currentStage: data.currentStage
      });

      setTargetQty(data.targetQty);
      setProducedQty(data.producedQty);
      setCurrentStatus(data.status);

      // Load BOMs for this item
      if (data.finishedItemId) {
        const boms = await bomService.getList({ finishedItemId: data.finishedItemId });
        setAvailableBoms(boms);
      }

      const rows: ProductionLineRow[] = data.lines.map((l, index) => ({
        key: `row-${index}`,
        seq: l.seq,
        rawItemId: l.rawItemId,
        rawItemTitle: l.rawItemTitle,
        plannedQty: l.plannedQty,
        actualQty: l.actualQty,
        unitId: l.unitId,
        unitCost: l.unitCost,
        totalCost: l.totalCost,
        availableStock: l.availableStock,
        isIssued: l.isIssued
      }));
      setLines(rows);
    } catch (err) {
      message.error('Failed to load manufacturing voucher');
    } finally {
      setLoading(false);
    }
  }, [isEdit, voucherNo, form]);

  useEffect(() => {
    fetchVoucher();
  }, [fetchVoucher]);

  // When Finished Item is selected, fetch associated BOMs and auto-apply default
  const handleFinishedItemChange = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      form.setFieldValue('unitId', item.defaultUnit || item.primaryUnit);
    }

    try {
      const boms = await bomService.getList({ finishedItemId: itemId, isActive: true });
      setAvailableBoms(boms);

      const defaultBom = boms.find(b => b.isDefault) || boms[0];
      if (defaultBom) {
        form.setFieldValue('bomMasterId', defaultBom.id);
        applyBomEstimate(defaultBom.id, itemId, form.getFieldValue('targetQty') || 1);
      } else {
        form.setFieldValue('bomMasterId', undefined);
      }
    } catch (err) {
      message.error('Failed to load recipes for selected product');
    }
  };

  // Apply recipe estimate
  const applyBomEstimate = async (bomId: number | undefined, itemId: string, qty: number) => {
    if (!itemId || qty <= 0) return;
    try {
      const estimate = await manufacturingService.calculateEstimate({
        bomMasterId: bomId,
        finishedItemId: itemId,
        targetQty: qty
      });

      setLaborCost(estimate.estimatedLaborCost || 0);
      setOverheadCost(estimate.estimatedOverheadCost || 0);
      setPackagingCost(estimate.estimatedPackagingCost || 0);
      form.setFieldsValue({
        laborCost: estimate.estimatedLaborCost || 0,
        overheadCost: estimate.estimatedOverheadCost || 0,
        packagingCost: estimate.estimatedPackagingCost || 0
      });

      const newRows: ProductionLineRow[] = estimate.lines.map((l, index) => ({
        key: `est-${index}`,
        seq: l.seq,
        rawItemId: l.rawItemId,
        rawItemTitle: l.rawItemTitle,
        plannedQty: l.requiredQty,
        actualQty: l.requiredQty,
        unitId: l.unitId,
        unitCost: l.estimatedUnitCost,
        totalCost: l.estimatedTotalCost,
        availableStock: l.availableStock,
        isIssued: true
      }));
      setLines(newRows);
    } catch (err: any) {
      message.warning('Could not calculate estimate from recipe');
    }
  };

  const handleTargetQtyChange = (val: number | null) => {
    const newQty = val || 1;
    setTargetQty(newQty);
    setProducedQty(newQty);
    form.setFieldValue('producedQty', newQty);

    const bomId = form.getFieldValue('bomMasterId');
    const itemId = form.getFieldValue('finishedItemId');
    if (bomId && itemId) {
      applyBomEstimate(bomId, itemId, newQty);
    }
  };

  const handleRowChange = (key: string, field: keyof ProductionLineRow, val: any) => {
    setLines(prev => prev.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: val };
        if (field === 'actualQty' || field === 'unitCost') {
          updated.totalCost = Math.round((updated.actualQty || 0) * (updated.unitCost || 0) * 100) / 100;
        }
        return updated;
      }
      return row;
    }));
  };

  const handleAddRow = () => {
    const newSeq = lines.length > 0 ? Math.max(...lines.map(r => r.seq)) + 1 : 1;
    const newRow: ProductionLineRow = {
      key: `custom-${Date.now()}`,
      seq: newSeq,
      rawItemId: '',
      plannedQty: 1,
      actualQty: 1,
      unitCost: 0,
      totalCost: 0,
      availableStock: 0,
      isIssued: true
    };
    setLines([...lines, newRow]);
  };

  const handleRemoveRow = (key: string) => {
    setLines(lines.filter(r => r.key !== key));
  };

  // Total Calculations
  const totalMaterialCost = lines.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalOverheadCost = (laborCost || 0) + (overheadCost || 0) + (packagingCost || 0);
  const grandTotalCost = totalMaterialCost + totalOverheadCost;
  const unitProductionCost = producedQty > 0 ? grandTotalCost / producedQty : 0;
  const hasShortage = lines.some(r => r.availableStock < r.actualQty);

  const submitWithStatus = async (status: ProductionStatus) => {
    try {
      const values = await form.validateFields();
      if (lines.length === 0) {
        message.error('Please add at least one consumed material.');
        return;
      }

      const invalidLine = lines.find(r => !r.rawItemId || r.actualQty <= 0);
      if (invalidLine) {
        message.error('Please ensure all consumed materials have valid item selection and quantity > 0.');
        return;
      }

      const payload: ProductionCreateOrUpdateRequest = {
        date: values.date.format('YYYY-MM-DD'),
        bomMasterId: values.bomMasterId,
        finishedItemId: values.finishedItemId,
        targetQty: values.targetQty || 1,
        producedQty: values.producedQty || 1,
        unitId: values.unitId,
        batchNo: values.batchNo,
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : undefined,
        laborCost: values.laborCost || 0,
        overheadCost: values.overheadCost || 0,
        packagingCost: values.packagingCost || 0,
        narration: values.narration,
        remarks: values.remarks,
        status: status,
        currentStage: status === ProductionStatusEnum.InProgress ? 'Material Issued' : status === ProductionStatusEnum.Completed ? 'Completed' : 'Planned',
        lines: lines.map((r, i) => ({
          seq: i + 1,
          rawItemId: r.rawItemId,
          plannedQty: r.plannedQty || r.actualQty,
          actualQty: r.actualQty,
          unitId: r.unitId,
          unitCost: r.unitCost,
          totalCost: r.totalCost,
          isIssued: status === ProductionStatusEnum.InProgress || status === ProductionStatusEnum.Completed
        }))
      };

      setSaving(true);
      if (isEdit && voucherNo) {
        await manufacturingService.update(voucherNo, payload);
        message.success(`Manufacturing voucher ${voucherNo} updated successfully`);
      } else {
        const newVoucherNo = await manufacturingService.create(payload);
        message.success(`Manufacturing voucher ${newVoucherNo} created successfully`);
      }
      navigate('/daily-entries/manufacturing');
    } catch (err: any) {
      if (err?.errorFields) return; // Form validation failed
      message.error(err?.response?.data?.metadata?.message || 'Failed to save manufacturing voucher');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'seq',
      key: 'seq',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: 'Raw Material / Ingredient',
      key: 'rawItemId',
      width: 260,
      render: (_: any, record: ProductionLineRow) => (
        <Select
          showSearch
          placeholder="Select Raw Material"
          value={record.rawItemId || undefined}
          onChange={(val) => {
            const item = items.find(i => i.id === val);
            const rate = item ? (item.priRate || item.opnRate || 0) : 0;
            const unit = item ? (item.defaultUnit || item.primaryUnit) : undefined;
            handleRowChange(record.key, 'rawItemId', val);
            handleRowChange(record.key, 'unitCost', rate);
            if (unit) handleRowChange(record.key, 'unitId', unit);
          }}
          filterOption={(input, option) =>
            (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
        >
          {items.map(i => (
            <Option key={i.id} value={i.id}>
              {i.title} {i.barcode ? `(${i.barcode})` : ''}
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Planned Qty',
      key: 'plannedQty',
      width: 110,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => (
        <Text type="secondary">{record.plannedQty?.toFixed(2) || '0.00'}</Text>
      )
    },
    {
      title: 'Actual Consumed',
      key: 'actualQty',
      width: 140,
      render: (_: any, record: ProductionLineRow) => (
        <InputNumber
          min={0.0001}
          value={record.actualQty}
          onChange={(val) => handleRowChange(record.key, 'actualQty', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Unit',
      key: 'unitId',
      width: 120,
      render: (_: any, record: ProductionLineRow) => (
        <Select
          placeholder="Unit"
          value={record.unitId || undefined}
          onChange={(val) => handleRowChange(record.key, 'unitId', val)}
          allowClear
          style={{ width: '100%' }}
        >
          {units.map(u => (
            <Option key={u.code} value={u.code}>{u.title}</Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Stock Available',
      key: 'availableStock',
      width: 130,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => {
        const isShort = record.availableStock < record.actualQty;
        return (
          <Tag color={isShort ? 'error' : 'default'}>
            {record.availableStock?.toFixed(2)}
          </Tag>
        );
      }
    },
    {
      title: 'Unit Cost',
      key: 'unitCost',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => (
        <InputNumber
          min={0}
          value={record.unitCost}
          onChange={(val) => handleRowChange(record.key, 'unitCost', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Total Cost',
      key: 'totalCost',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: ProductionLineRow) => (
        <Text strong>{(record.totalCost || 0).toFixed(2)}</Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: ProductionLineRow) => (
        <Popconfirm
          title="Remove component?"
          onConfirm={() => handleRemoveRow(record.key)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Form form={form} layout="vertical">
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/manufacturing')} />
              <SettingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {isEdit ? `Edit Manufacturing Voucher (${voucherNo})` : 'New Manufacturing / Assembly Run'}
                </Title>
                <Text type="secondary">Issue materials to WIP or complete finished goods batch</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button onClick={() => navigate('/daily-entries/manufacturing')}>Cancel</Button>
              
              <Button 
                onClick={() => submitWithStatus(ProductionStatusEnum.Planned)}
                loading={saving}
              >
                Save as Planned
              </Button>

              <Button 
                type="primary" 
                ghost
                icon={<ClockCircleOutlined />} 
                onClick={() => submitWithStatus(ProductionStatusEnum.InProgress)}
                loading={saving}
              >
                Issue to WIP
              </Button>

              <Button 
                type="primary" 
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckCircleOutlined />} 
                onClick={() => submitWithStatus(ProductionStatusEnum.Completed)}
                loading={saving}
              >
                Complete Production
              </Button>
            </Space>
          </Col>
        </Row>

        {hasShortage && (
          <Alert
            message="Raw Material Shortage Warning"
            description="One or more ingredients have current stock balances lower than the required consumption amount. You can still proceed if your configuration allows negative stock."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row orientation="horizontal" gutter={16}>
          {/* Main Form Fields */}
          <Col span={16}>
            <Card title="Production Specification" loading={loading} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Voucher Date"
                    name="date"
                    rules={[{ required: true, message: 'Please select date' }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    label="Finished Good Product"
                    name="finishedItemId"
                    rules={[{ required: true, message: 'Select product to manufacture' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Finished Product"
                      onChange={handleFinishedItemChange}
                      filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {items.map(i => (
                        <Option key={i.id} value={i.id}>
                          {i.title} {i.barcode ? `(${i.barcode})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Formula / Recipe (BOM)" name="bomMasterId">
                    <Select
                      placeholder="Select Recipe"
                      allowClear
                      onChange={(bomId) => {
                        const itemId = form.getFieldValue('finishedItemId');
                        applyBomEstimate(bomId, itemId, targetQty);
                      }}
                    >
                      {availableBoms.map(b => (
                        <Option key={b.id} value={b.id}>
                          {b.title} {b.isDefault ? '(Default)' : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Target Batch Qty"
                    name="targetQty"
                    rules={[{ required: true, message: 'Enter target qty' }]}
                  >
                    <InputNumber
                      min={0.0001}
                      style={{ width: '100%' }}
                      onChange={handleTargetQtyChange}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Actual Produced Qty"
                    name="producedQty"
                    rules={[{ required: true, message: 'Enter produced qty' }]}
                  >
                    <InputNumber
                      min={0.0001}
                      style={{ width: '100%' }}
                      onChange={(v) => setProducedQty(v || 1)}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Output Unit" name="unitId">
                    <Select placeholder="Unit" allowClear>
                      {units.map(u => (
                        <Option key={u.code} value={u.code}>{u.title}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Batch / Lot #" name="batchNo">
                    <Input placeholder="e.g. BATCH-2026-10" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Expiry Date" name="expiryDate">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Narration / Department" name="narration">
                    <Select placeholder="Select Narration" allowClear>
                      {narrations.map(n => (
                        <Option key={n.id} value={n.id}>{n.title}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label="Remarks / Production Notes" name="remarks">
                    <Input placeholder="Additional batch notes" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Consumed Raw Materials Table */}
            <Card
              title={
                <Space>
                  <ThunderboltOutlined />
                  <span>Consumed Raw Materials & Components</span>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    type="link"
                    icon={<SyncOutlined />}
                    onClick={() => {
                      const bomId = form.getFieldValue('bomMasterId');
                      const itemId = form.getFieldValue('finishedItemId');
                      applyBomEstimate(bomId, itemId, targetQty);
                    }}
                  >
                    Reset from Recipe
                  </Button>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRow}>
                    Add Material
                  </Button>
                </Space>
              }
              loading={loading}
            >
              <Table
                dataSource={lines}
                columns={columns}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                locale={{ emptyText: 'No materials added. Select a finished product and recipe above.' }}
              />
            </Card>
          </Col>

          {/* Overheads & Unit Cost Side Panel */}
          <Col span={8}>
            <Card
              title="Batch Costs & Valuation"
              loading={loading}
              style={{ position: 'sticky', top: 20 }}
            >
              <Form.Item label="Direct Labor Allocated" name="laborCost">
                <InputNumber
                  min={0}
                  step={10}
                  style={{ width: '100%' }}
                  onChange={(v) => setLaborCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Machine & Utility Overheads" name="overheadCost">
                <InputNumber
                  min={0}
                  step={10}
                  style={{ width: '100%' }}
                  onChange={(v) => setOverheadCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Packaging & Consumables" name="packagingCost">
                <InputNumber
                  min={0}
                  step={10}
                  style={{ width: '100%' }}
                  onChange={(v) => setPackagingCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Materials Consumed"
                    value={totalMaterialCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Overheads Total"
                    value={totalOverheadCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={24}>
                  <Card style={{ backgroundColor: '#fafafa', borderColor: '#d9d9d9' }} size="small">
                    <Statistic
                      title="Total Production Batch Cost"
                      value={grandTotalCost}
                      precision={2}
                      valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 'bold' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Output: </Text>
                      <Text strong>{producedQty} units</Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Statistic
                      title="Finished Good Unit Valuation"
                      value={unitProductionCost}
                      precision={2}
                      valueStyle={{ color: '#52c41a', fontSize: 22, fontWeight: 'bold' }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      *Finished goods will be added to stock and FIFO layers at this exact unit cost.
                    </Text>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
