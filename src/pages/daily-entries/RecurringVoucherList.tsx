import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Modal, Form, Input, Select, Switch, Row, Col, Statistic, Popconfirm, Tooltip,
  Checkbox, DatePicker, InputNumber
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, PlayCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined, PauseCircleOutlined,
  CalendarOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  recurringChainService,
  type RecurringChainDto,
  type RecurringChainCreateRequest,
  type RecurringChainUpdateRequest,
  type RecurrenceFrequency
} from '../../services/recurringChainService';
import { getUpcomingDates } from '../../utils/recurringSchedule';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const SUN_THU = [0, 1, 2, 3, 4];

const DAY_OPTIONS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getFrequencyTagColor = (frequency: string) => {
  switch (frequency) {
    case 'Daily':
      return 'cyan';
    case 'Weekly':
      return 'geekblue';
    case 'BiWeekly':
      return 'purple';
    case 'Monthly':
      return 'orange';
    default:
      return 'default';
  }
};

export const RecurringVoucherList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecurringChainDto[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringChainDto | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const watchedFrequency = Form.useWatch('frequency', form) as RecurrenceFrequency | undefined;
  const watchedDaysOfWeek = Form.useWatch('daysOfWeek', form) as number[] | undefined;
  const watchedDayOfMonth = Form.useWatch('dayOfMonth', form) as number | undefined;
  const watchedInterval = Form.useWatch('interval', form) as number | undefined;
  const watchedStartDate = Form.useWatch('startDate', form) as Dayjs | null | undefined;

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

  const handleFrequencyChange = (freq: RecurrenceFrequency) => {
    if (freq === 'Daily') {
      form.setFieldsValue({
        daysOfWeek: ALL_DAYS,
        interval: 1,
      });
    } else if (freq === 'Weekly') {
      const currentDays = form.getFieldValue('daysOfWeek') as number[] | undefined;
      form.setFieldsValue({
        daysOfWeek: currentDays && currentDays.length > 0 && currentDays.length < 7 ? currentDays : [1],
        interval: 1,
      });
    } else if (freq === 'BiWeekly') {
      const currentDays = form.getFieldValue('daysOfWeek') as number[] | undefined;
      form.setFieldsValue({
        daysOfWeek: currentDays && currentDays.length > 0 && currentDays.length < 7 ? currentDays : [1],
        interval: 2,
        startDate: form.getFieldValue('startDate') || dayjs(),
      });
    } else if (freq === 'Monthly') {
      form.setFieldsValue({
        dayOfMonth: form.getFieldValue('dayOfMonth') || 1,
        interval: 1,
      });
    }
  };

  const handleCreateOrUpdate = async (values: any) => {
    try {
      const freq: RecurrenceFrequency = values.frequency || 'Daily';
      const selectedDays: number[] | undefined =
        freq === 'Daily' || freq === 'Weekly' || freq === 'BiWeekly'
          ? (values.daysOfWeek as number[] | undefined)
          : undefined;

      const schedulePayload = {
        frequency: freq,
        daysOfWeek: selectedDays && selectedDays.length > 0 ? [...selectedDays].sort((a, b) => a - b) : undefined,
        dayOfWeek: selectedDays && selectedDays.length > 0 ? selectedDays[0] : undefined,
        dayOfMonth: freq === 'Monthly' ? values.dayOfMonth : undefined,
        interval: freq === 'BiWeekly' ? 2 : (values.interval ?? 1),
        startDate: values.startDate ? dayjs(values.startDate).format('YYYY-MM-DD') : undefined,
      };

      if (editingItem) {
        const updateReq: RecurringChainUpdateRequest = {
          name: values.name,
          ...schedulePayload,
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
          ...schedulePayload,
          notes: values.notes,
        };
        await recurringChainService.createFromVoucher(createReq);
        message.success('Recurring chain created.');
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      fetchChains();
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.response?.data?.messages?.[0];
      message.error(serverMsg || 'Operation failed.');
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
      daysOfWeek: ALL_DAYS,
      interval: 1,
      voucherType: 'SP',
      isActive: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (record: RecurringChainDto) => {
    setEditingItem(record);
    const freq = (record.frequency || 'Daily') as RecurrenceFrequency;
    let initialDays = record.daysOfWeek && record.daysOfWeek.length > 0
      ? record.daysOfWeek
      : (record.dayOfWeek !== undefined && record.dayOfWeek !== null ? [record.dayOfWeek] : []);

    if (freq === 'Daily' && initialDays.length === 0) {
      initialDays = ALL_DAYS;
    } else if ((freq === 'Weekly' || freq === 'BiWeekly') && initialDays.length === 0) {
      initialDays = [1];
    }

    form.setFieldsValue({
      name: record.name,
      voucherType: record.voucherType,
      frequency: freq,
      daysOfWeek: initialDays,
      dayOfMonth: record.dayOfMonth ?? 1,
      interval: record.interval ?? (freq === 'BiWeekly' ? 2 : 1),
      startDate: record.startDate ? dayjs(record.startDate) : null,
      isActive: record.isActive,
      notes: record.notes,
    });
    setModalVisible(true);
  };

  const activeCount = data.filter(d => d.isActive).length;
  const todayRuns = data.filter(d => d.lastRunDate === dayjs().format('YYYY-MM-DD')).length;

  const upcomingPreviewDates = modalVisible
    ? getUpcomingDates({
        frequency: watchedFrequency,
        daysOfWeek: watchedDaysOfWeek,
        dayOfMonth: watchedDayOfMonth,
        interval: watchedInterval,
        startDate: watchedStartDate,
      }, 5)
    : [];

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
        const color = getFrequencyTagColor(record.frequency);
        let summary = record.scheduleSummary;
        if (!summary) {
          if (record.frequency === 'Daily') {
            summary = 'Every Day';
          } else if (record.frequency === 'Weekly') {
            const dayName = record.dayOfWeek !== undefined && record.dayOfWeek !== null
              ? dayOfWeekNames[record.dayOfWeek] : 'Monday';
            summary = `Weekly (${dayName})`;
          } else if (record.frequency === 'Monthly') {
            summary = `Monthly (Day ${record.dayOfMonth ?? 1})`;
          } else {
            summary = record.frequency;
          }
        }

        return (
          <Space orientation="vertical" size={2}>
            <Tag color={color}>{summary}</Tag>
            {record.startDate && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                From {dayjs(record.startDate).format('DD-MMM-YYYY')}
              </Text>
            )}
          </Space>
        );
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
      title: 'Next Scheduled',
      key: 'nextRun',
      render: (_: any, record: RecurringChainDto) => {
        if (!record.isActive) {
          return <Text type="secondary">Paused</Text>;
        }
        if (!record.nextRunDate) {
          return <Text type="secondary">—</Text>;
        }
        const isToday = record.nextRunDate === dayjs().format('YYYY-MM-DD');
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: '#0284c7' }} />
            <Text>{dayjs(record.nextRunDate).format('ddd, DD-MMM-YYYY')}</Text>
            {isToday && <Tag color="processing">Today</Tag>}
          </Space>
        );
      },
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
            Automate daily, weekday-only, weekly, bi-weekly, or monthly vouchers directly from the latest voucher in each chain.
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
              suffix="at 08:00 PM"
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
        width={700}
        centered
        destroyOnClose
        styles={{ body: { paddingTop: 8, paddingBottom: 4 } }}
      >
        <Form
          form={form}
          layout="vertical"
          size="middle"
          onFinish={handleCreateOrUpdate}
        >
          {!editingItem ? (
            <Row gutter={12}>
              <Col span={10}>
                <Form.Item
                  name="name"
                  label="Schedule / Chain Name"
                  rules={[{ required: true, message: 'Enter a name' }]}
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder="e.g. Weekday Bread Supply" />
                </Form.Item>
              </Col>
              <Col span={7}>
                <Form.Item
                  name="voucherType"
                  label="Voucher Type"
                  rules={[{ required: true }]}
                  style={{ marginBottom: 10 }}
                >
                  <Select>
                    <Option value="SP">Supply (SP)</Option>
                    <Option value="JV">Journal (JV)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={7}>
                <Form.Item
                  name="sourceVoucherNo"
                  label="Source Voucher #"
                  rules={[{ required: true, message: 'Enter voucher #' }]}
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder="e.g. 00042" />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={12} align="middle">
              <Col span={18}>
                <Form.Item
                  name="name"
                  label="Schedule / Chain Name"
                  rules={[{ required: true, message: 'Enter a name' }]}
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder="e.g. Weekday Bread Supply" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="isActive"
                  label="Status"
                  valuePropName="checked"
                  style={{ marginBottom: 10 }}
                >
                  <Switch checkedChildren="Active" unCheckedChildren="Paused" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={12}>
            <Col span={watchedFrequency === 'Monthly' ? 10 : 12}>
              <Form.Item
                name="frequency"
                label="Recurrence Pattern"
                rules={[{ required: true }]}
                style={{ marginBottom: 10 }}
              >
                <Select onChange={handleFrequencyChange}>
                  <Option value="Daily">Daily (Choose Days / Skip Weekends)</Option>
                  <Option value="Weekly">Weekly (Specific Day(s))</Option>
                  <Option value="BiWeekly">Bi-Weekly (Every 2 Weeks)</Option>
                  <Option value="Monthly">Monthly (Day of Month)</Option>
                </Select>
              </Form.Item>
            </Col>

            {watchedFrequency === 'Daily' && watchedDaysOfWeek && watchedDaysOfWeek.length === 7 && (
              <>
                <Col span={5}>
                  <Form.Item
                    name="interval"
                    label="Every (Days)"
                    style={{ marginBottom: 10 }}
                  >
                    <InputNumber min={1} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item name="startDate" label="Start Date" style={{ marginBottom: 10 }}>
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
              </>
            )}

            {watchedFrequency === 'Daily' && (!watchedDaysOfWeek || watchedDaysOfWeek.length < 7) && (
              <Col span={12}>
                <Form.Item name="startDate" label="Start Date (Optional)" style={{ marginBottom: 10 }}>
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
            )}

            {watchedFrequency === 'Weekly' && (
              <>
                <Col span={5}>
                  <Form.Item
                    name="interval"
                    label="Every (Weeks)"
                    style={{ marginBottom: 10 }}
                  >
                    <InputNumber min={1} max={52} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item name="startDate" label="Start Date" style={{ marginBottom: 10 }}>
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                  </Form.Item>
                </Col>
              </>
            )}

            {watchedFrequency === 'BiWeekly' && (
              <Col span={12}>
                <Form.Item
                  name="startDate"
                  label="Anchor Start Date"
                  tooltip="Determines which alternating weeks the voucher is generated."
                  style={{ marginBottom: 10 }}
                >
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
            )}

            {watchedFrequency === 'Monthly' && (
              <>
                <Col span={7}>
                  <Form.Item
                    name="dayOfMonth"
                    label="Day of Month"
                    rules={[{ required: true, message: 'Select day' }]}
                    style={{ marginBottom: 10 }}
                  >
                    <Select placeholder="Day">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <Option key={day} value={day}>
                          {day === 31 ? 'Day 31 (Last Day)' : `Day ${day}`}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item
                    name="interval"
                    label="Repeat Every"
                    style={{ marginBottom: 10 }}
                  >
                    <Select>
                      <Option value={1}>Every Month</Option>
                      <Option value={2}>Every 2 Months</Option>
                      <Option value={3}>Quarterly (3M)</Option>
                      <Option value={6}>Every 6 Months</Option>
                      <Option value={12}>Yearly (12M)</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {(watchedFrequency === 'Daily' || watchedFrequency === 'Weekly' || watchedFrequency === 'BiWeekly') && (
            <Form.Item
              name="daysOfWeek"
              style={{ marginBottom: 10 }}
              label={
                <Space size={8} wrap>
                  <span>
                    {watchedFrequency === 'BiWeekly' ? 'Active Days (Every 2 Weeks)' : 'Active Days of Week'}
                  </span>
                  {watchedFrequency === 'Daily' && (
                    <Space size={4}>
                      <Button size="small" type="link" style={{ padding: '0 4px', height: 'auto', fontSize: 12 }} onClick={() => form.setFieldsValue({ daysOfWeek: ALL_DAYS, interval: 1 })}>
                        All
                      </Button>
                      <Button size="small" type="link" style={{ padding: '0 4px', height: 'auto', fontSize: 12 }} onClick={() => form.setFieldsValue({ daysOfWeek: WEEKDAYS_MON_FRI, interval: 1 })}>
                        Mon–Fri
                      </Button>
                      <Button size="small" type="link" style={{ padding: '0 4px', height: 'auto', fontSize: 12 }} onClick={() => form.setFieldsValue({ daysOfWeek: MON_SAT, interval: 1 })}>
                        Mon–Sat
                      </Button>
                      <Button size="small" type="link" style={{ padding: '0 4px', height: 'auto', fontSize: 12 }} onClick={() => form.setFieldsValue({ daysOfWeek: SUN_THU, interval: 1 })}>
                        Sun–Thu
                      </Button>
                    </Space>
                  )}
                </Space>
              }
              rules={[
                {
                  validator: (_, val: number[] | undefined) =>
                    val && val.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('Select at least one day of the week')),
                },
              ]}
            >
              <Checkbox.Group options={DAY_OPTIONS} />
            </Form.Item>
          )}

          {/* Compact Live Next 5 Scheduled Dates Preview */}
          <div
            style={{
              background: upcomingPreviewDates.length > 0 ? '#f0f9ff' : '#fffbe6',
              border: `1px solid ${upcomingPreviewDates.length > 0 ? '#bae6fd' : '#ffe58f'}`,
              borderRadius: 6,
              padding: '6px 10px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <Text strong style={{ fontSize: 12, color: '#0369a1', marginRight: 2 }}>
              Next runs:
            </Text>
            {upcomingPreviewDates.length > 0 ? (
              upcomingPreviewDates.map((d) => (
                <Tag key={d.format('YYYY-MM-DD')} color="blue" style={{ margin: 0, fontSize: 11 }}>
                  {d.format('ddd, DD MMM')}
                </Tag>
              ))
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                No upcoming dates match the current schedule.
              </Text>
            )}
          </div>

          <Row gutter={12}>
            {watchedFrequency === 'Monthly' && (watchedInterval ?? 1) > 1 && (
              <Col span={8}>
                <Form.Item
                  name="startDate"
                  label="Anchor Start Date"
                  style={{ marginBottom: 4 }}
                >
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
            )}
            <Col span={watchedFrequency === 'Monthly' && (watchedInterval ?? 1) > 1 ? 16 : 24}>
              <Form.Item
                name="notes"
                label="Notes / Instructions"
                style={{ marginBottom: 4 }}
              >
                <Input placeholder="Optional instructions or memo" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
