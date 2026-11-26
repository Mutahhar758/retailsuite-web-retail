import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  DatePicker, Typography, message, Drawer, Descriptions, Row, Col, Statistic, Popconfirm
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EyeOutlined, CheckOutlined,
  DollarOutlined, FastForwardOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  employeeLoanService,
  EmployeeLoanType,
  EmployeeLoanStatus,
  LoanInstallmentStatus,
  type EmployeeLoanDto,
  type EmployeeLoanScheduleDto,
} from '../../services/payrollService';
import { hrInfoService, type HRInfoResponse } from '../../services/hrInfoService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;

const LOAN_STATUS_TAG: Record<number, { color: string; label: string }> = {
  [EmployeeLoanStatus.Pending]: { color: 'default', label: 'Pending' },
  [EmployeeLoanStatus.Approved]: { color: 'processing', label: 'Approved' },
  [EmployeeLoanStatus.Active]: { color: 'blue', label: 'Active' },
  [EmployeeLoanStatus.Completed]: { color: 'green', label: 'Completed' },
  [EmployeeLoanStatus.Cancelled]: { color: 'red', label: 'Cancelled' },
};

const INST_STATUS_TAG: Record<number, { color: string; label: string }> = {
  [LoanInstallmentStatus.Scheduled]: { color: 'blue', label: 'Scheduled' },
  [LoanInstallmentStatus.Deducted]: { color: 'green', label: 'Deducted in Payroll' },
  [LoanInstallmentStatus.Skipped]: { color: 'orange', label: 'Skipped / Deferred' },
  [LoanInstallmentStatus.SettledManually]: { color: 'cyan', label: 'Settled Manually' },
};

export const EmployeeLoanList: React.FC = () => {
  const [loans, setLoans] = useState<EmployeeLoanDto[]>([]);
  const [employees, setEmployees] = useState<HRInfoResponse[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState<EmployeeLoanDto | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<EmployeeLoanDto | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm] = Form.useForm();
  const [disburseForm] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [loanList, empList, accList] = await Promise.all([
        employeeLoanService.getList(),
        hrInfoService.getHRInfos(),
        chartOfAccountService.getDetailAccounts(),
      ]);
      setLoans(loanList || []);
      setEmployees(empList || []);
      setAccounts(accList || []);
    } catch {
      message.error('Failed to load employee loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cashBankAccounts = accounts.filter(a => a.account?.startsWith('001002002'));
  const assetAccounts = accounts.filter(a => a.account?.startsWith('001'));

  const handleCreate = async () => {
    try {
      const v = await createForm.validateFields();
      setSaving(true);
      await employeeLoanService.create({
        hrInfoId: v.hrInfoId,
        loanType: v.loanType,
        principalAmount: v.principalAmount,
        installmentCount: v.installmentCount,
        startYear: v.startMonth.year(),
        startMonth: v.startMonth.month() + 1,
        receivableAccountId: v.receivableAccountId || null,
        remarks: v.remarks || null,
      });
      message.success('Employee loan / advance created');
      setCreateOpen(false);
      loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to create loan');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await employeeLoanService.approve(id);
      message.success('Loan approved');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to approve loan');
    }
  };

  const openDisburse = (loan: EmployeeLoanDto) => {
    setDisburseTarget(loan);
    disburseForm.setFieldsValue({
      disbursementDate: dayjs(),
      disbursementAccountId: cashBankAccounts[0]?.account,
      receivableAccountId: loan.receivableAccountId || '001002006001001',
      remarks: '',
    });
  };

  const handleDisburse = async () => {
    if (!disburseTarget) return;
    try {
      const v = await disburseForm.validateFields();
      setSaving(true);
      await employeeLoanService.disburse(disburseTarget.id, {
        disbursementDate: v.disbursementDate.format('YYYY-MM-DD'),
        disbursementAccountId: v.disbursementAccountId,
        receivableAccountId: v.receivableAccountId || null,
        remarks: v.remarks || null,
      });
      message.success('Loan disbursed & Payment Voucher posted to GL');
      setDisburseTarget(null);
      loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to disburse loan');
    } finally {
      setSaving(false);
    }
  };

  const refreshDrawer = async (loanId: number) => {
    const updated = await employeeLoanService.getById(loanId);
    setSelectedLoan(updated);
    loadData();
  };

  const handleSkipInstallment = async (sched: EmployeeLoanScheduleDto) => {
    if (!selectedLoan) return;
    try {
      await employeeLoanService.skipInstallment(selectedLoan.id, sched.id, 'Deferred by payroll manager');
      message.success('Installment skipped & deferred to end of schedule');
      await refreshDrawer(selectedLoan.id);
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to skip installment');
    }
  };

  const handleSettleInstallment = async (sched: EmployeeLoanScheduleDto) => {
    if (!selectedLoan) return;
    try {
      await employeeLoanService.settleInstallment(selectedLoan.id, sched.id, {
        remarks: 'Settled manually',
        settlementDate: dayjs().format('YYYY-MM-DD'),
      });
      message.success('Installment marked as manually settled');
      await refreshDrawer(selectedLoan.id);
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || 'Failed to settle installment');
    }
  };

  const activePortfolio = loans.filter(l => l.status === EmployeeLoanStatus.Active).reduce((sum, l) => sum + l.remainingBalance, 0);
  const pendingCount = loans.filter(l => l.status === EmployeeLoanStatus.Pending || l.status === EmployeeLoanStatus.Approved).length;

  const columns = [
    { title: 'Loan No', dataIndex: 'loanNo', key: 'loanNo', width: 110, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Employee',
      key: 'employee',
      render: (_: any, r: EmployeeLoanDto) => (
        <div>
          <Text strong>{r.employeeName}</Text>
          {r.designation && <div><Text type="secondary" style={{ fontSize: 12 }}>{r.designation}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'loanType',
      key: 'loanType',
      width: 130,
      render: (t: number) => t === EmployeeLoanType.Loan ? <Tag color="purple">Loan</Tag> : <Tag color="cyan">Salary Advance</Tag>,
    },
    { title: 'Principal', dataIndex: 'principalAmount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
    { title: 'Installments', key: 'inst', align: 'center' as const, render: (_: any, r: EmployeeLoanDto) => `${r.installmentCount} × Rs.${r.installmentAmount.toLocaleString()}` },
    { title: 'Remaining', dataIndex: 'remainingBalance', align: 'right' as const, render: (v: number) => <Text strong type={v > 0 ? 'danger' : 'success'}>Rs. {v.toLocaleString()}</Text> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: number) => <Tag color={LOAN_STATUS_TAG[s]?.color}>{LOAN_STATUS_TAG[s]?.label || s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_: any, r: EmployeeLoanDto) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedLoan(r)}>Schedule</Button>
          {r.status === EmployeeLoanStatus.Pending && (
            <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => handleApprove(r.id)}>Approve</Button>
          )}
          {(r.status === EmployeeLoanStatus.Approved || r.status === EmployeeLoanStatus.Pending) && (
            <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => openDisburse(r)}>Disburse</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Active Loan Receivable" value={activePortfolio} prefix="Rs." precision={2} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Active Loans / Advances" value={loans.filter(l => l.status === EmployeeLoanStatus.Active).length} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Pending Approval / Disbursement" value={pendingCount} /></Card>
        </Col>
      </Row>

      <Card
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>Employee Loans & Salary Advances</Title>
            <Text type="secondary">Issue staff loans or advances with automated monthly payroll deductions and GL tracking.</Text>
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              createForm.resetFields();
              createForm.setFieldsValue({ loanType: EmployeeLoanType.SalaryAdvance, installmentCount: 1, startMonth: dayjs() });
              setCreateOpen(true);
            }}>
              New Loan / Advance
            </Button>
          </Space>
        }
      >
        <Table rowKey="id" loading={loading} dataSource={loans} columns={columns} pagination={{ pageSize: 15 }} size="middle" />
      </Card>

      <Modal title="New Employee Loan / Salary Advance" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleCreate} confirmLoading={saving} width={560}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="hrInfoId" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select employee"
              options={employees.map(e => ({ value: e.id, label: `${e.id} - ${e.name} (${e.designation || 'Staff'})` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="loanType" label="Type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value={EmployeeLoanType.SalaryAdvance}>Salary Advance</Select.Option>
                  <Select.Option value={EmployeeLoanType.Loan}>Employee Loan</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="principalAmount" label="Principal Amount (Rs.)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="installmentCount" label="No. of Monthly Installments" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={120} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startMonth" label="First Deduction Month" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="receivableAccountId" label="Loan Receivable GL Account (Optional)">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Defaults to Staff Loans & Advances Receivable"
              options={assetAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Disburse Loan ${disburseTarget?.loanNo || ''} (Rs. ${disburseTarget?.principalAmount?.toLocaleString() || 0})`}
        open={!!disburseTarget}
        onCancel={() => setDisburseTarget(null)}
        onOk={handleDisburse}
        confirmLoading={saving}
      >
        <Form form={disburseForm} layout="vertical">
          <Form.Item name="disbursementDate" label="Disbursement Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="disbursementAccountId" label="Pay From (Cash / Bank Account)" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={cashBankAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
            />
          </Form.Item>
          <Form.Item name="receivableAccountId" label="Debit Account (Loan Receivable)" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={assetAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Voucher Remarks">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={selectedLoan ? `${selectedLoan.loanNo} — ${selectedLoan.employeeName}` : 'Loan Schedule'}
        open={!!selectedLoan}
        onClose={() => setSelectedLoan(null)}
        width={680}
      >
        {selectedLoan && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Principal">Rs. {selectedLoan.principalAmount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Remaining">Rs. {selectedLoan.remainingBalance.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={LOAN_STATUS_TAG[selectedLoan.status]?.color}>{LOAN_STATUS_TAG[selectedLoan.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="GL Voucher">{selectedLoan.glVoucherNo ? `PV-${selectedLoan.glVoucherNo}` : 'Not Disbursed'}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={selectedLoan.schedules}
              columns={[
                { title: '#', dataIndex: 'installmentNo', width: 50 },
                { title: 'Due Period', render: (_: any, s: EmployeeLoanScheduleDto) => `${s.dueYear}-${String(s.dueMonth).padStart(2, '0')}` },
                { title: 'Scheduled', dataIndex: 'scheduledAmount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
                { title: 'Deducted', dataIndex: 'deductedAmount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
                { title: 'Status', dataIndex: 'status', render: (st: number) => <Tag color={INST_STATUS_TAG[st]?.color}>{INST_STATUS_TAG[st]?.label}</Tag> },
                {
                  title: 'Actions',
                  render: (_: any, s: EmployeeLoanScheduleDto) => s.status === LoanInstallmentStatus.Scheduled && selectedLoan.status === EmployeeLoanStatus.Active ? (
                    <Space size="small">
                      <Popconfirm title="Skip and defer this installment to the end?" onConfirm={() => handleSkipInstallment(s)}>
                        <Button size="small" icon={<FastForwardOutlined />}>Skip</Button>
                      </Popconfirm>
                      <Popconfirm title="Mark this installment as manually settled?" onConfirm={() => handleSettleInstallment(s)}>
                        <Button size="small" icon={<CheckCircleOutlined />}>Settle</Button>
                      </Popconfirm>
                    </Space>
                  ) : null,
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
    </Space>
  );
};
