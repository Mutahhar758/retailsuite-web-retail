import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker,
  Typography, message, Row, Col, Statistic, Switch
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, FolderOpenOutlined, FilePdfOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  payrollRunService,
  PayrollRunStatus,
  type PayrollRunSummaryDto,
  type PayrollDashboardKpiDto,
} from '../../services/payrollService';

const { Title, Text } = Typography;

export const RUN_STATUS_META: Record<number, { color: string; label: string }> = {
  [PayrollRunStatus.Draft]: { color: 'default', label: 'Draft' },
  [PayrollRunStatus.Calculated]: { color: 'processing', label: 'Calculated' },
  [PayrollRunStatus.PendingApproval]: { color: 'orange', label: 'Pending Approval' },
  [PayrollRunStatus.Approved]: { color: 'cyan', label: 'Approved' },
  [PayrollRunStatus.Posted]: { color: 'blue', label: 'Posted to GL' },
  [PayrollRunStatus.PartiallyPaid]: { color: 'geekblue', label: 'Partially Paid' },
  [PayrollRunStatus.Paid]: { color: 'green', label: 'Paid' },
  [PayrollRunStatus.Reversed]: { color: 'volcano', label: 'Reversed' },
  [PayrollRunStatus.Cancelled]: { color: 'red', label: 'Cancelled' },
};

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PayrollRunList: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRunSummaryDto[]>([]);
  const [kpis, setKpis] = useState<PayrollDashboardKpiDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [runList, kpiData] = await Promise.all([
        payrollRunService.getList(),
        payrollRunService.getKpis(),
      ]);
      setRuns(runList || []);
      setKpis(kpiData);
    } catch {
      message.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      const v = await form.validateFields();
      setCreating(true);
      const period = v.payMonth as dayjs.Dayjs;
      const runId = await payrollRunService.create({
        payYear: period.year(),
        payMonth: period.month() + 1,
        payDate: (v.payDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        salaryType: v.salaryType || 'Monthly',
        description: v.description || undefined,
        autoCalculate: !!v.autoCalculate,
      });
      message.success('Payroll run created');
      setCreateOpen(false);
      navigate(`/payroll/runs/${runId}`);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to create payroll run');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      title: 'Run No',
      dataIndex: 'runNo',
      key: 'runNo',
      render: (no: string, r: PayrollRunSummaryDto) => (
        <a onClick={() => navigate(`/payroll/runs/${r.id}`)} style={{ fontWeight: 600 }}>{no}</a>
      ),
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: any, r: PayrollRunSummaryDto) => `${MONTH_NAMES[r.payMonth]} ${r.payYear} (${r.salaryType})`,
    },
    { title: 'Pay Date', dataIndex: 'payDate', width: 110 },
    { title: 'Staff', dataIndex: 'employeeCount', align: 'center' as const, width: 70 },
    { title: 'Gross', dataIndex: 'totalGrossEarnings', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
    { title: 'Loan Rec.', dataIndex: 'totalLoanRecovery', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
    { title: 'Net Pay', dataIndex: 'totalNetSalary', align: 'right' as const, render: (v: number) => <Text strong>Rs. {v.toLocaleString()}</Text> },
    { title: 'Paid', dataIndex: 'totalPaidAmount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 135,
      render: (s: number) => <Tag color={RUN_STATUS_META[s]?.color}>{RUN_STATUS_META[s]?.label || s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: any, r: PayrollRunSummaryDto) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<FolderOpenOutlined />} onClick={() => navigate(`/payroll/runs/${r.id}`)}>
            Open
          </Button>
          {r.employeeCount > 0 && (
            <Button size="small" icon={<FilePdfOutlined />} onClick={() => payrollRunService.downloadRegisterPdf(r.id, r.runNo)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Current Month Net Payroll" value={kpis?.currentMonthNetPayroll || 0} prefix="Rs." precision={2} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Unpaid Salaries Payable" value={kpis?.unpaidPayableBalance || 0} prefix="Rs." precision={2} valueStyle={{ color: (kpis?.unpaidPayableBalance || 0) > 0 ? '#cf1322' : '#3f8600' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Active Loan Receivable" value={kpis?.activeLoanPortfolio || 0} prefix="Rs." precision={2} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Pending Approvals / Staff" value={`${kpis?.pendingApprovalCount || 0} / ${kpis?.activeEmployeeCount || 0}`} /></Card>
        </Col>
      </Row>

      <Card
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>Enterprise Payroll Runs</Title>
            <Text type="secondary">Manage pay periods, calculate salaries, run maker-checker approvals, post GL accruals, and disburse payments.</Text>
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              form.resetFields();
              form.setFieldsValue({
                payMonth: dayjs(),
                payDate: dayjs().endOf('month'),
                salaryType: 'Monthly',
                autoCalculate: true,
              });
              setCreateOpen(true);
            }}>
              New Payroll Run
            </Button>
          </Space>
        }
      >
        <Table rowKey="id" loading={loading} dataSource={runs} columns={columns} pagination={{ pageSize: 15 }} size="middle" />
      </Card>

      <Modal title="Create Payroll Run" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleCreate} confirmLoading={creating}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payMonth" label="Pay Period (Month)" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payDate" label="Pay / Posting Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="salaryType" label="Pay Frequency" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="Monthly">Monthly</Select.Option>
              <Select.Option value="Weekly">Weekly</Select.Option>
              <Select.Option value="Daily">Daily</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Optional run description" />
          </Form.Item>
          <Form.Item name="autoCalculate" label="Auto-Calculate Active Employees Immediately" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
