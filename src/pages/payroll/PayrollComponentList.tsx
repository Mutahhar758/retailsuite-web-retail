import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  Switch, Typography, message, Popconfirm, Row, Col, Tooltip
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  LockOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import {
  payrollComponentService,
  PayrollComponentType,
  PayrollCalculationType,
  type PayrollComponentDto,
  type PayrollComponentUpsertRequest,
} from '../../services/payrollService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

const CALC_TYPE_LABELS: Record<number, string> = {
  [PayrollCalculationType.Fixed]: 'Fixed Amount',
  [PayrollCalculationType.PercentageOfBasic]: '% of Basic',
  [PayrollCalculationType.PerUnit]: 'Per Unit (Rate × Qty)',
  [PayrollCalculationType.Formula]: 'Formula',
};

export const PayrollComponentList: React.FC = () => {
  const [data, setData] = useState<PayrollComponentDto[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollComponentDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const calcType = Form.useWatch('calculationType', form);
  const compType = Form.useWatch('componentType', form);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [list, accs] = await Promise.all([
        payrollComponentService.getAll(),
        chartOfAccountService.getDetailAccounts(),
      ]);
      setData(list || []);
      setAccounts(accs || []);
    } catch {
      message.error('Failed to load payroll components');
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
      componentType: PayrollComponentType.Earning,
      calculationType: PayrollCalculationType.Fixed,
      defaultValue: 0,
      isRecurring: true,
      showOnPayslip: true,
      displayOrder: (data.length + 1) * 5,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (record: PayrollComponentDto) => {
    setEditing(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      componentType: record.componentType,
      calculationType: record.calculationType,
      defaultValue: record.defaultValue,
      formulaExpression: record.formulaExpression,
      isRecurring: record.isRecurring,
      showOnPayslip: record.showOnPayslip,
      displayOrder: record.displayOrder,
      isActive: record.isActive,
      description: record.description,
      expenseAccountId: record.expenseAccountId || undefined,
      liabilityAccountId: record.liabilityAccountId || undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: PayrollComponentUpsertRequest = {
        code: values.code,
        name: values.name,
        componentType: values.componentType,
        calculationType: values.calculationType,
        defaultValue: values.defaultValue || 0,
        formulaExpression: values.formulaExpression || null,
        isRecurring: !!values.isRecurring,
        showOnPayslip: !!values.showOnPayslip,
        displayOrder: values.displayOrder || 0,
        isActive: !!values.isActive,
        description: values.description || null,
        expenseAccountId: values.expenseAccountId || null,
        liabilityAccountId: values.liabilityAccountId || null,
      };
      if (editing) {
        await payrollComponentService.update(editing.id, payload);
        message.success('Payroll component updated');
      } else {
        await payrollComponentService.create(payload);
        message.success('Payroll component created');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || err?.message || 'Failed to save component');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await payrollComponentService.delete(id);
      message.success('Payroll component deleted');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to delete component');
    }
  };

  const expenseAccounts = accounts.filter(a => a.account?.startsWith('004'));
  const liabilityAccounts = accounts.filter(a => a.account?.startsWith('002') || a.account?.startsWith('001'));

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      render: (code: string, r: PayrollComponentDto) => (
        <Space>
          <Text strong>{code}</Text>
          {r.isSystem && (
            <Tooltip title="System Component">
              <LockOutlined style={{ color: '#8c8c8c' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: 'Component Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'componentType',
      key: 'componentType',
      width: 120,
      render: (t: number) =>
        t === PayrollComponentType.Earning
          ? <Tag color="green">Earning</Tag>
          : <Tag color="red">Deduction</Tag>,
    },
    {
      title: 'Calculation',
      dataIndex: 'calculationType',
      key: 'calculationType',
      width: 170,
      render: (ct: number, r: PayrollComponentDto) => (
        <div>
          <div>{CALC_TYPE_LABELS[ct] || ct}</div>
          {ct === PayrollCalculationType.Formula && r.formulaExpression && (
            <Text type="secondary" style={{ fontSize: 12 }}>{r.formulaExpression}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Default Value',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      align: 'right' as const,
      width: 130,
      render: (v: number, r: PayrollComponentDto) =>
        r.calculationType === PayrollCalculationType.PercentageOfBasic
          ? `${v}%`
          : `Rs. ${Number(v || 0).toLocaleString()}`,
    },
    {
      title: 'GL Mapping',
      key: 'gl',
      render: (_: any, r: PayrollComponentDto) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.expenseAccountTitle || r.liabilityAccountTitle || 'Employee Default'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean) => <Tag color={active ? 'blue' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: any, record: PayrollComponentDto) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          {!record.isSystem && (
            <Popconfirm title="Delete this component?" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Payroll Components</Title>
          <Text type="secondary">Configure earnings, allowances, bonuses, and deductions used across salary structures and payroll runs.</Text>
        </div>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Component</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{ pageSize: 20 }}
        size="middle"
      />

      <Modal
        title={editing ? `Edit Component: ${editing.code}` : 'New Payroll Component'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="code" label="Component Code" rules={[{ required: true, message: 'Code is required' }]}>
                <Input placeholder="e.g. FUEL_ALW" disabled={editing?.isSystem} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="name" label="Component Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g. Fuel Allowance" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="componentType" label="Component Type" rules={[{ required: true }]}>
                <Select disabled={editing?.isSystem}>
                  <Select.Option value={PayrollComponentType.Earning}>Earning</Select.Option>
                  <Select.Option value={PayrollComponentType.Deduction}>Deduction</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="calculationType" label="Calculation Method" rules={[{ required: true }]}>
                <Select disabled={editing?.isSystem}>
                  <Select.Option value={PayrollCalculationType.Fixed}>Fixed Amount</Select.Option>
                  <Select.Option value={PayrollCalculationType.PercentageOfBasic}>% of Basic Salary</Select.Option>
                  <Select.Option value={PayrollCalculationType.PerUnit}>Per Unit (Qty × Rate)</Select.Option>
                  <Select.Option value={PayrollCalculationType.Formula}>Formula</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="defaultValue"
                label={calcType === PayrollCalculationType.PercentageOfBasic ? 'Default Percentage (%)' : 'Default Value (Rs.)'}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayOrder" label="Payslip Display Order">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          {calcType === PayrollCalculationType.Formula && (
            <Form.Item
              name="formulaExpression"
              label={
                <Space>
                  <span>Formula Expression</span>
                  <Tooltip title="Supported variables: BASIC, GROSS, DAYS, OT_HOURS. Operators: + - * / ( )">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              rules={[{ required: true, message: 'Formula expression is required' }]}
            >
              <Input placeholder="e.g. BASIC * 0.10 + 1500" />
            </Form.Item>
          )}

          <Row gutter={16}>
            {compType === PayrollComponentType.Earning ? (
              <Col span={24}>
                <Form.Item name="expenseAccountId" label="Override Expense GL Account (Optional)">
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Use employee's default expense account"
                    options={expenseAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
                  />
                </Form.Item>
              </Col>
            ) : (
              <Col span={24}>
                <Form.Item name="liabilityAccountId" label="Override Liability / Receivable GL Account (Optional)">
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Use default account"
                    options={liabilityAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}><Form.Item name="isRecurring" label="Recurring" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="showOnPayslip" label="Show on Payslip" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};
