import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Modal, Form, Input, Select, Switch, Row, Col, Statistic, Popconfirm, Tooltip
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, PlayCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined, PauseCircleOutlined,
  CalendarOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  recurringChainService,
  type RecurringChainDto,
  type RecurringChainCreateRequest,
  type RecurringChainUpdateRequest
} from '../../services/recurringChainService';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const RecurringVoucherList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecurringChainDto[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringChainDto | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchChains = useCallback(async () => {
    try {
      setLoading(true);
      const list = await recurringChainService.getList();
      setData(list);
    } catch {
      message.error('Failed to load recurring voucher chains.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  const handleCreateOrUpdate = async (values: any) => {
    try {
      if (editingItem) {
        const updateReq: RecurringChainUpdateRequest = {
          name: values.name,
          frequency: values.frequency,
          dayOfWeek: values.frequency === 'Weekly' ? values.dayOfWeek : undefined,
          dayOfMonth: values.frequency === 'Monthly' ? values.dayOfMonth : undefined,
          isActive: values.isActive ?? true,
          notes: values.notes,
        };
        await recurringChainService.update(editingItem.id, updateReq);
        message.success('Recurring chain updated.');
      } else {
        const createReq: RecurringChainCreateRequest = {
          name: values.name,
          voucherType: values.voucherType,
          sourceVoucherNo: values.sourceVoucherNo,
          frequency: values.frequency,
          dayOfWeek: values.frequency === 'Weekly' ? values.dayOfWeek : undefined,
          dayOfMonth: values.frequency === 'Monthly' ? values.dayOfMonth : undefined,
          notes: values.notes,
        };
        await recurringChainService.createFromVoucher(createReq);
        message.success('Recurring chain created.');
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      fetchChains();
    } catch {
      message.error('Operation failed.');
    }
  };

  const handleToggle = async (record: RecurringChainDto, checked: boolean) => {
    try {
      await recurringChainService.toggleActive(record.id, checked);
      message.success(`Chain ${checked ? 'activated' : 'paused'}.`);
      fetchChains();
    } catch {
      message.error('Failed to change status.');
    }
  };

  const handleRunToday = async (record: RecurringChainDto) => {
    try {
      setRunningId(record.id);
      const voucherNo = await recurringChainService.runToday(record.id);
      if (voucherNo) {
        message.success(`Generated voucher ${voucherNo} for today!`);
      } else {
        message.info('Chain ran successfully or voucher already exists.');
      }
      fetchChains();
    } catch {
      message.error('Failed to run chain for today.');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await recurringChainService.delete(id);
      message.success('Chain deleted.');
      fetchChains();
    } catch {
      message.error('Failed to delete chain.');
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      frequency: 'Daily',
      voucherType: 'SP',
      isActive: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (record: RecurringChainDto) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      voucherType: record.voucherType,
      frequency: record.frequency,
      dayOfWeek: record.dayOfWeek,
      dayOfMonth: record.dayOfMonth,
      isActive: record.isActive,
      notes: record.notes,
    });
    setModalVisible(true);
  };

  const activeCount = data.filter(d => d.isActive).length;
  const todayRuns = data.filter(d => d.lastRunDate === dayjs().format('YYYY-MM-DD')).length;

  const columns = [
    {
      title: 'Schedule Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RecurringChainDto) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{text}</Text>
          {record.notes && <Text type="secondary" style={{ fontSize: 12 }}>{record.notes}</Text>}
        </Space>
      ),
    },
    {
      title: 'Voucher Type',
      dataIndex: 'voucherType',
      key: 'voucherType',
      render: (type: string) => {
        if (type === 'SP' || type === 'SaleSupply') {
          return <Tag color="blue">Supply Voucher</Tag>;
        }
        if (type === 'JV' || type === 'JournalVoucher') {
          return <Tag color="purple">Journal Voucher</Tag>;
        }
        return <Tag>{type}</Tag>;
      },
    },
    {
      title: 'Recurrence',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (_: string, record: RecurringChainDto) => {
        if (record.frequency === 'Daily') {
          return <Tag color="cyan">Every Day</Tag>;
        }
        if (record.frequency === 'Weekly') {
          const dayName = record.dayOfWeek !== undefined && record.dayOfWeek !== null
            ? dayOfWeekNames[record.dayOfWeek] : 'Monday';
          return <Tag color="geekblue">Weekly ({dayName})</Tag>;
        }
        if (record.frequency === 'Monthly') {
          return <Tag color="orange">Monthly (Day {record.dayOfMonth ?? 1})</Tag>;
        }
        return <Tag>{record.frequency}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean, record: RecurringChainDto) => (
        <Space>
          <Switch
            checked={active}
            onChange={(checked) => handleToggle(record, checked)}
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<PauseCircleOutlined />}
          />
          <Text type={active ? 'success' : 'secondary'}>
            {active ? 'Active' : 'Paused'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Last Generated',
      key: 'lastRun',
      render: (_: any, record: RecurringChainDto) => {
        if (!record.lastRunDate) {
          return <Text type="secondary">Not yet executed</Text>;
        }
        const isToday = record.lastRunDate === dayjs().format('YYYY-MM-DD');
        return (
          <Space orientation="vertical" size={2}>
            <Text>
              {dayjs(record.lastRunDate).format('DD-MMM-YYYY')}
              {isToday && <Tag color="success" style={{ marginLeft: 6 }}>Today</Tag>}
            </Text>
            {record.lastVoucherNo && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Voucher #{record.lastVoucherNo}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: RecurringChainDto) => (
        <Space>
          <Tooltip title="Immediately generate today's voucher for this chain">
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={runningId === record.id}
              onClick={() => handleRunToday(record)}
            >
              Run Today
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this recurring chain?"
            description="Existing generated vouchers will remain safe."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Recurring Vouchers & Daily Automation</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Automate recurring daily, weekly, or monthly vouchers directly from the latest voucher in each chain.
          </Paragraph>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchChains} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              New Recurring Chain
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f0f9ff' }}>
            <Statistic
              title="Active Chains"
              value={activeCount}
              suffix={`/ ${data.length}`}
              valueStyle={{ color: '#0284c7' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f0fdf4' }}>
            <Statistic
              title="Generated Today"
              value={todayRuns}
              valueStyle={{ color: '#16a34a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#faf5ff' }}>
            <Statistic
              title="Daily Hangfire Job"
              value="Once Daily"
              suffix="at 00:05 AM"
              valueStyle={{ color: '#9333ea', fontSize: 20 }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingItem ? 'Edit Recurring Chain' : 'New Recurring Chain from Voucher'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText={editingItem ? 'Save Changes' : 'Start Recurring Chain'}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateOrUpdate}
        >
          <Form.Item
            name="name"
            label="Schedule / Chain Name"
            rules={[{ required: true, message: 'Please enter a name for this chain' }]}
          >
            <Input placeholder="e.g. Daily Bread Supply Route 1" />
          </Form.Item>

          {!editingItem && (
            <>
              <Form.Item
                name="voucherType"
                label="Voucher Type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="SP">Supply Voucher (Sale Supply)</Option>
                  <Option value="JV">Journal Voucher (JV)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="sourceVoucherNo"
                label="Initial Voucher Number to Start Chain From"
                rules={[{ required: true, message: 'Please provide the voucher number to clone from' }]}
                extra="The system links this voucher into the chain and copies its items & amounts."
              >
                <Input placeholder="e.g. 00042 or 00010" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="frequency"
            label="Recurrence Frequency"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Daily">Daily (Every Day)</Option>
              <Option value="Weekly">Weekly (Specific Day)</Option>
              <Option value="Monthly">Monthly (Specific Day of Month)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.frequency !== currentValues.frequency}
          >
            {({ getFieldValue }) => {
              const freq = getFieldValue('frequency');
              if (freq === 'Weekly') {
                return (
                  <Form.Item
                    name="dayOfWeek"
                    label="Day of Week"
                    rules={[{ required: true, message: 'Select day of week' }]}
                  >
                    <Select placeholder="Select day">
                      {dayOfWeekNames.map((name, index) => (
                        <Option key={index} value={index}>{name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              if (freq === 'Monthly') {
                return (
                  <Form.Item
                    name="dayOfMonth"
                    label="Day of Month (1 - 31)"
                    rules={[{ required: true, message: 'Enter day of month' }]}
                  >
                    <Select placeholder="Select day of month">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <Option key={day} value={day}>Day {day}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          {editingItem && (
            <Form.Item
              name="isActive"
              label="Active Status"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Paused" />
            </Form.Item>
          )}

          <Form.Item
            name="notes"
            label="Notes / Instructions"
          >
            <Input.TextArea rows={2} placeholder="Optional instructions or memo" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
