import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Switch, Typography, message, Popconfirm, Row, Col, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import {
  salaryStructureService,
  payrollComponentService,
  PayrollComponentType,
  PayrollCalculationType,
  type SalaryStructureDto,
  type PayrollComponentDto,
} from '../../services/payrollService';

const { Title, Text } = Typography;

export const SalaryStructureList: React.FC = () => {
  const [structures, setStructures] = useState<SalaryStructureDto[]>([]);
  const [components, setComponents] = useState<PayrollComponentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryStructureDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sList, cList] = await Promise.all([
        salaryStructureService.getAll(),
        payrollComponentService.getAll(true),
      ]);
      setStructures(sList || []);
      setComponents((cList || []).filter(c => !['BASIC', 'OVERTIME', 'BONUS', 'LEAVE_DED', 'LOAN_REC'].includes(c.code)));
    } catch {
      message.error('Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      salaryType: 'Monthly',
      isDefault: false,
      isActive: true,
      lines: [],
    });
    setModalOpen(true);
  };

  const openEdit = (record: SalaryStructureDto) => {
    setEditing(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      salaryType: record.salaryType,
      description: record.description,
      isDefault: record.isDefault,
      isActive: record.isActive,
      lines: record.lines.map(l => ({
        payrollComponentId: l.payrollComponentId,
        calculationTypeOverride: l.calculationTypeOverride ?? undefined,
        value: l.value,
        formulaOverride: l.formulaOverride ?? undefined,
        displayOrder: l.displayOrder,
      })),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        code: values.code,
        name: values.name,
        description: values.description || null,
        salaryType: values.salaryType || 'Monthly',
        isDefault: !!values.isDefault,
        isActive: !!values.isActive,
        lines: (values.lines || []).map((l: any, idx: number) => ({
          payrollComponentId: l.payrollComponentId,
          calculationTypeOverride: l.calculationTypeOverride || null,
          value: Number(l.value || 0),
          formulaOverride: l.formulaOverride || null,
          displayOrder: idx + 1,
        })),
      };
      if (editing) {
        await salaryStructureService.update(editing.id, payload);
        message.success('Salary structure updated');
      } else {
        await salaryStructureService.create(payload);
        message.success('Salary structure created');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to save salary structure');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await salaryStructureService.delete(id);
      message.success('Salary structure deleted');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to delete salary structure');
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 120, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Structure Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r: SalaryStructureDto) => (
        <Space>
          <span>{name}</span>
          {r.isDefault && <Tag color="gold">Default</Tag>}
        </Space>
      ),
    },
    { title: 'Pay Frequency', dataIndex: 'salaryType', key: 'salaryType', width: 120 },
    {
      title: 'Components',
      key: 'lines',
      render: (_: any, r: SalaryStructureDto) => (
        <Space wrap size={[4, 4]}>
          {r.lines.length === 0 ? <Text type="secondary">Base salary only</Text> : r.lines.map(l => (
            <Tag key={l.id} color={l.componentType === PayrollComponentType.Earning ? 'green' : 'red'}>
              {l.componentCode}: {l.effectiveCalculationType === PayrollCalculationType.PercentageOfBasic ? `${l.value}%` : `Rs.${l.value}`}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: 'Employees', dataIndex: 'assignedEmployeeCount', key: 'assignedEmployeeCount', width: 100, align: 'center' as const },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (a: boolean) => <Tag color={a ? 'blue' : 'default'}>{a ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: any, r: SalaryStructureDto) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete this salary structure?" onConfirm={() => handleDelete(r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Salary Structures</Title>
          <Text type="secondary">Define reusable compensation templates (e.g. Retail Staff, Management) and assign them to employees.</Text>
        </div>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Structure</Button>
        </Space>
      }
    >
      <Table rowKey="id" loading={loading} dataSource={structures} columns={columns} pagination={{ pageSize: 15 }} size="middle" />

      <Modal
        title={editing ? `Edit Salary Structure: ${editing.name}` : 'New Salary Structure'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={760}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. STAFF_STD" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="name" label="Structure Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Standard Retail Staff" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="salaryType" label="Frequency" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="Monthly">Monthly</Select.Option>
                  <Select.Option value="Weekly">Weekly</Select.Option>
                  <Select.Option value="Daily">Daily</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Optional notes" />
              </Form.Item>
            </Col>
            <Col span={5}><Form.Item name="isDefault" label="Default" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={5}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>

          <Divider>Recurring Allowances & Deductions</Divider>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={10} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={9}>
                      <Form.Item {...restField} name={[name, 'payrollComponentId']} rules={[{ required: true, message: 'Select component' }]} style={{ marginBottom: 0 }}>
                        <Select placeholder="Select component" showSearch optionFilterProp="label"
                          options={components.map(c => ({
                            value: c.id,
                            label: `${c.code} - ${c.name} (${c.componentType === PayrollComponentType.Earning ? 'Earning' : 'Deduction'})`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'calculationTypeOverride']} style={{ marginBottom: 0 }}>
                        <Select allowClear placeholder="Default Calc">
                          <Select.Option value={PayrollCalculationType.Fixed}>Fixed Amount</Select.Option>
                          <Select.Option value={PayrollCalculationType.PercentageOfBasic}>% of Basic</Select.Option>
                          <Select.Option value={PayrollCalculationType.Formula}>Formula</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true, message: 'Value' }]} style={{ marginBottom: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="Amount or %" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add({ value: 0 })} block icon={<PlusOutlined />}>
                  Add Component Line
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
};
