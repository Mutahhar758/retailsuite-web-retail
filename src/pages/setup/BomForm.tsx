import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Space, Typography, 
  Select, Switch, Table, Row, Col, Divider, message, Popconfirm, Statistic 
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined, 
  ExperimentOutlined, CalculatorOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { bomService, type BomCreateOrUpdateRequest } from '../../services/bomService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { unitService, type UnitDto } from '../../services/unitService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface IngredientRow {
  key: string;
  seq: number;
  rawItemId: string;
  qty: number;
  unitId?: string;
  scrapPercentage: number;
  isOptional: boolean;
  rate: number;
  totalCost: number;
}

export const BomForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);

  // Overhead values from form state
  const [laborCost, setLaborCost] = useState<number>(0);
  const [overheadCost, setOverheadCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [outputQty, setOutputQty] = useState<number>(1);

  // Load items and units
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [itemList, unitList] = await Promise.all([
          inventoryService.getItemsLookup(),
          unitService.getActiveUnits()
        ]);
        setItems(itemList || []);
        setUnits(unitList || []);
      } catch (err) {
        message.error('Failed to load item lookup');
      }
    };
    loadLookups();
  }, []);

  // Load existing BOM if in edit mode
  const fetchBom = useCallback(async () => {
    if (!isEdit) {
      form.setFieldsValue({
        outputQty: 1,
        isActive: true,
        isDefault: true,
        laborCost: 0,
        overheadCost: 0,
        packagingCost: 0
      });
      return;
    }

    try {
      setLoading(true);
      const bom = await bomService.getById(Number(id));
      form.setFieldsValue({
        code: bom.code,
        title: bom.title,
        finishedItemId: bom.finishedItemId,
        outputQty: bom.outputQty,
        unitId: bom.unitId,
        isActive: bom.isActive,
        isDefault: bom.isDefault,
        laborCost: bom.laborCost,
        overheadCost: bom.overheadCost,
        packagingCost: bom.packagingCost,
        notes: bom.notes
      });

      setOutputQty(bom.outputQty || 1);
      setLaborCost(bom.laborCost || 0);
      setOverheadCost(bom.overheadCost || 0);
      setPackagingCost(bom.packagingCost || 0);

      const rows: IngredientRow[] = bom.lines.map((l, index) => ({
        key: `row-${index}`,
        seq: l.seq,
        rawItemId: l.rawItemId,
        qty: l.qty,
        unitId: l.unitId,
        scrapPercentage: l.scrapPercentage,
        isOptional: l.isOptional,
        rate: l.currentRate || 0,
        totalCost: l.totalEstimatedCost || (l.qty * (1 + l.scrapPercentage / 100) * (l.currentRate || 0))
      }));
      setIngredients(rows);
    } catch (err) {
      message.error('Failed to load recipe details');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, form]);

  useEffect(() => {
    fetchBom();
  }, [fetchBom]);

  // Recalculate row total
  const updateRowCost = (row: IngredientRow): IngredientRow => {
    const effectiveQty = (row.qty || 0) * (1 + (row.scrapPercentage || 0) / 100);
    const cost = effectiveQty * (row.rate || 0);
    return { ...row, totalCost: Math.round(cost * 100) / 100 };
  };

  const handleItemSelect = (rawItemId: string, key: string) => {
    const found = items.find(i => i.id === rawItemId);
    const rate = found ? (found.priRate || found.opnRate || 0) : 0;
    const unitId = found ? (found.defaultUnit || found.primaryUnit) : undefined;

    setIngredients(prev => prev.map(row => {
      if (row.key === key) {
        const updated = {
          ...row,
          rawItemId,
          rate,
          unitId: unitId || row.unitId
        };
        return updateRowCost(updated);
      }
      return row;
    }));
  };

  const handleRowChange = (key: string, field: keyof IngredientRow, val: any) => {
    setIngredients(prev => prev.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: val };
        return updateRowCost(updated);
      }
      return row;
    }));
  };

  const handleAddRow = () => {
    const newSeq = ingredients.length > 0 ? Math.max(...ingredients.map(r => r.seq)) + 1 : 1;
    const newRow: IngredientRow = {
      key: `row-${Date.now()}`,
      seq: newSeq,
      rawItemId: '',
      qty: 1,
      scrapPercentage: 0,
      isOptional: false,
      rate: 0,
      totalCost: 0
    };
    setIngredients([...ingredients, newRow]);
  };

  const handleRemoveRow = (key: string) => {
    setIngredients(ingredients.filter(r => r.key !== key));
  };

  // Calculations
  const totalMaterialCost = ingredients.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalOverheadCost = (laborCost || 0) + (overheadCost || 0) + (packagingCost || 0);
  const grandTotalCost = totalMaterialCost + totalOverheadCost;
  const unitProductionCost = outputQty > 0 ? grandTotalCost / outputQty : 0;

  const onFinish = async (values: any) => {
    if (ingredients.length === 0) {
      message.error('Please add at least one raw material / ingredient.');
      return;
    }

    const invalidRow = ingredients.find(r => !r.rawItemId || r.qty <= 0);
    if (invalidRow) {
      message.error('Please select an item and enter a valid quantity for all ingredients.');
      return;
    }

    const payload: BomCreateOrUpdateRequest = {
      code: values.code,
      title: values.title,
      finishedItemId: values.finishedItemId,
      outputQty: values.outputQty || 1,
      unitId: values.unitId,
      isActive: values.isActive ?? true,
      isDefault: values.isDefault ?? true,
      laborCost: values.laborCost || 0,
      overheadCost: values.overheadCost || 0,
      packagingCost: values.packagingCost || 0,
      notes: values.notes,
      lines: ingredients.map((r, i) => ({
        seq: i + 1,
        rawItemId: r.rawItemId,
        qty: r.qty,
        unitId: r.unitId,
        scrapPercentage: r.scrapPercentage || 0,
        isOptional: r.isOptional || false
      }))
    };

    try {
      setSaving(true);
      if (isEdit) {
        await bomService.update(Number(id), payload);
        message.success('Recipe updated successfully');
      } else {
        await bomService.create(payload);
        message.success('Recipe created successfully');
      }
      navigate('/setup/bom');
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to save recipe');
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
      width: 280,
      render: (_: any, record: IngredientRow) => (
        <Select
          showSearch
          placeholder="Select Ingredient"
          value={record.rawItemId || undefined}
          onChange={(val) => handleItemSelect(val, record.key)}
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
      title: 'Quantity',
      key: 'qty',
      width: 130,
      render: (_: any, record: IngredientRow) => (
        <InputNumber
          min={0.0001}
          step={0.1}
          value={record.qty}
          onChange={(val) => handleRowChange(record.key, 'qty', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Unit',
      key: 'unitId',
      width: 140,
      render: (_: any, record: IngredientRow) => (
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
      title: 'Scrap / Wastage %',
      key: 'scrapPercentage',
      width: 130,
      render: (_: any, record: IngredientRow) => (
        <InputNumber
          min={0}
          max={100}
          value={record.scrapPercentage}
          formatter={v => `${v}%`}
          parser={v => Number(v?.replace('%', '') || 0)}
          onChange={(val) => handleRowChange(record.key, 'scrapPercentage', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Est. Rate',
      key: 'rate',
      width: 110,
      align: 'right' as const,
      render: (_: any, record: IngredientRow) => (
        <InputNumber
          min={0}
          value={record.rate}
          onChange={(val) => handleRowChange(record.key, 'rate', val || 0)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Total Cost',
      key: 'totalCost',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: IngredientRow) => (
        <Text strong>{record.totalCost.toFixed(2)}</Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: IngredientRow) => (
        <Popconfirm
          title="Remove ingredient?"
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
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space align="center">
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/bom')} />
              <ExperimentOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {isEdit ? 'Edit Formula / Bill of Materials' : 'New Formula / Bill of Materials'}
                </Title>
                <Text type="secondary">Define recipe ingredients, yields, and overhead components</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button onClick={() => navigate('/setup/bom')}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                Save Recipe
              </Button>
            </Space>
          </Col>
        </Row>

        <Row orientation="horizontal" gutter={16}>
          {/* Main Info */}
          <Col span={16}>
            <Card title="Product & Formula Specification" loading={loading} style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Formula Code"
                    name="code"
                    rules={[{ required: true, message: 'Please enter formula code' }]}
                  >
                    <Input placeholder="e.g. BOM-001" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    label="Recipe / Formula Title"
                    name="title"
                    rules={[{ required: true, message: 'Please enter title' }]}
                  >
                    <Input placeholder="e.g. Standard 1kg Bread Formula" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Target Finished Product"
                    name="finishedItemId"
                    rules={[{ required: true, message: 'Please select finished item' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Finished Product"
                      filterOption={(input, option) =>
                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                      onChange={(val) => {
                        const item = items.find(i => i.id === val);
                        if (item) {
                          form.setFieldValue('unitId', item.defaultUnit || item.primaryUnit);
                        }
                      }}
                    >
                      {items.map(i => (
                        <Option key={i.id} value={i.id}>
                          {i.title} {i.barcode ? `(${i.barcode})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Output Batch Yield"
                    name="outputQty"
                    rules={[{ required: true, message: 'Enter yield' }]}
                  >
                    <InputNumber
                      min={0.0001}
                      step={1}
                      style={{ width: '100%' }}
                      onChange={(v) => setOutputQty(v || 1)}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Yield Unit" name="unitId">
                    <Select placeholder="Unit" allowClear>
                      {units.map(u => (
                        <Option key={u.code} value={u.code}>{u.title}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Default Recipe" name="isDefault" valuePropName="checked">
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Notes / Method Instructions" name="notes">
                    <TextArea rows={2} placeholder="Optional mixing instructions or notes" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Ingredients Table */}
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  <span>Components & Raw Materials</span>
                </Space>
              }
              extra={
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRow}>
                  Add Ingredient
                </Button>
              }
              loading={loading}
            >
              <Table
                dataSource={ingredients}
                columns={columns}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                locale={{ emptyText: 'No ingredients added yet. Click "Add Ingredient" above.' }}
              />
            </Card>
          </Col>

          {/* Costing & Overheads Side Card */}
          <Col span={8}>
            <Card
              title={
                <Space>
                  <CalculatorOutlined />
                  <span>Cost Breakdown & Absorption</span>
                </Space>
              }
              loading={loading}
              style={{ position: 'sticky', top: 20 }}
            >
              <Form.Item label="Labor Cost per Batch" name="laborCost">
                <InputNumber
                  min={0}
                  step={10}
                  style={{ width: '100%' }}
                  onChange={(v) => setLaborCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Utilities & Overhead per Batch" name="overheadCost">
                <InputNumber
                  min={0}
                  step={10}
                  style={{ width: '100%' }}
                  onChange={(v) => setOverheadCost(v || 0)}
                  prefix="Rs."
                />
              </Form.Item>

              <Form.Item label="Packaging Cost per Batch" name="packagingCost">
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
                    title="Raw Materials"
                    value={totalMaterialCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Total Overheads"
                    value={totalOverheadCost}
                    precision={2}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={24}>
                  <Card style={{ backgroundColor: '#fafafa', borderColor: '#d9d9d9' }} size="small">
                    <Statistic
                      title="Estimated Batch Cost"
                      value={grandTotalCost}
                      precision={2}
                      valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 'bold' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Yield: </Text>
                      <Text strong>{outputQty} units</Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Statistic
                      title="Est. Cost per Unit"
                      value={unitProductionCost}
                      precision={2}
                      valueStyle={{ color: '#52c41a', fontSize: 22, fontWeight: 'bold' }}
                    />
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
