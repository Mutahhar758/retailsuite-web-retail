import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Steps, Typography, message, Row, Col,
  Statistic, Drawer, Form, InputNumber, Input, Switch, Modal, Select, DatePicker,
  Alert, Tabs, Popconfirm, Descriptions, Divider
} from 'antd';
import {
  ArrowLeftOutlined, CalculatorOutlined, SendOutlined, CheckCircleOutlined,
  CloseCircleOutlined, BankOutlined, FilePdfOutlined, EditOutlined,
  RollbackOutlined, DownloadOutlined, DeleteOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  payrollRunService,
  payrollDisbursementService,
  PayrollRunStatus,
  PayrollComponentType,
  type PayrollRunDetailDto,
  type PayrollRunItemDto,
  type PayrollGlPreviewDto,
  type PayrollDisbursementDto,
} from '../../services/payrollService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { RUN_STATUS_META } from './PayrollRunList';

const { Title, Text } = Typography;

export const PayrollRunWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const runId = Number(id);
  const navigate = useNavigate();

  const [run, setRun] = useState<PayrollRunDetailDto | null>(null);
  const [glPreview, setGlPreview] = useState<PayrollGlPreviewDto | null>(null);
  const [disbursements, setDisbursements] = useState<PayrollDisbursementDto[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [editItem, setEditItem] = useState<PayrollRunItemDto | null>(null);
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ mode: 'reject' | 'reverse'; open: boolean }>({ mode: 'reject', open: false });
  const [reasonText, setReasonText] = useState('');

  const [itemForm] = Form.useForm();
  const [disburseForm] = Form.useForm();

  const loadRun = useCallback(async () => {
    if (!runId) return;
    try {
      setLoading(true);
      const [detail, accs, disb] = await Promise.all([
        payrollRunService.getById(runId),
        chartOfAccountService.getDetailAccounts(),
        payrollDisbursementService.getByRun(runId),
      ]);
      setRun(detail);
      setAccounts(accs || []);
      setDisbursements(disb || []);
      if (detail && detail.items.length > 0) {
        const preview = await payrollRunService.getGlPreview(runId);
        setGlPreview(preview);
      }
    } catch {
      message.error('Failed to load payroll run');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  const isEditable = run?.status === PayrollRunStatus.Draft || run?.status === PayrollRunStatus.Calculated;
  const canDisburse = run?.status === PayrollRunStatus.Posted || run?.status === PayrollRunStatus.PartiallyPaid;
  const cashBankAccounts = accounts.filter(a => a.account?.startsWith('001002002'));

  const currentStep = (() => {
    if (!run) return 0;
    if (run.status === PayrollRunStatus.Draft || run.status === PayrollRunStatus.Calculated) return 0;
    if (run.status === PayrollRunStatus.PendingApproval) return 1;
    if (run.status === PayrollRunStatus.Approved) return 2;
    return 3;
  })();

  const runAction = async (fn: () => Promise<any>, successMsg: string) => {
    try {
      setActionLoading(true);
      await fn();
      message.success(successMsg);
      await loadRun();
    } catch (err: any) {
      message.error(err?.response?.data?.metadata?.message || err?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openItemDrawer = (item: PayrollRunItemDto) => {
    setEditItem(item);
    itemForm.setFieldsValue({
      workingDays: item.workingDays,
      presentDays: item.presentDays,
      unpaidLeaveDays: item.unpaidLeaveDays,
      leaveChargeRate: item.leaveChargeRate,
      overtimeHours: item.overtimeHours,
      overtimeRate: item.overtimeRate,
      bonusAmount: item.bonusAmount,
      isOnHold: item.isOnHold,
      remarks: item.remarks,
    });
  };

  const handleSaveItem = async () => {
    if (!editItem || !run) return;
    try {
      const v = await itemForm.validateFields();
      setActionLoading(true);
      await payrollRunService.updateItem(run.id, editItem.id, {
        workingDays: v.workingDays,
        presentDays: v.presentDays,
        unpaidLeaveDays: v.unpaidLeaveDays || 0,
        leaveChargeRate: v.leaveChargeRate || 0,
        overtimeHours: v.overtimeHours || 0,
        overtimeRate: v.overtimeRate || 0,
        bonusAmount: v.bonusAmount || 0,
        isOnHold: !!v.isOnHold,
        remarks: v.remarks || undefined,
      });
      message.success(`Updated payroll line for ${editItem.employeeName}`);
      setEditItem(null);
      await loadRun();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to update item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!run) return;
    try {
      const v = await disburseForm.validateFields();
      setActionLoading(true);
      const res = await payrollDisbursementService.create({
        payrollRunId: run.id,
        paymentDate: v.paymentDate.format('YYYY-MM-DD'),
        paymentMethod: v.paymentMethod,
        sourceAccountId: v.sourceAccountId,
        referenceNo: v.referenceNo || undefined,
        remarks: v.remarks || undefined,
      });
      message.success(`Disbursement ${res.disbursementNo} posted (GL PV-${res.glVoucherNo})`);
      setDisburseModalOpen(false);
      await loadRun();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.metadata?.message || 'Failed to disburse payroll');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReasonSubmit = async () => {
    if (!run) return;
    if (reasonModal.mode === 'reject') {
      await runAction(() => payrollRunService.reject(run.id, reasonText), 'Payroll run rejected back to Calculated');
    } else {
      await runAction(() => payrollRunService.reverse(run.id, reasonText), 'Payroll run reversed & loan schedules restored');
    }
    setReasonModal({ ...reasonModal, open: false });
    setReasonText('');
  };

  const itemColumns = [
    {
      title: 'Employee',
      key: 'emp',
      fixed: 'left' as const,
      width: 210,
      render: (_: any, r: PayrollRunItemDto) => (
        <div>
          <Space size={4}>
            <Text strong>{r.employeeName}</Text>
            {r.isOnHold && <Tag color="orange">HOLD</Tag>}
          </Space>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.hrInfoId} • {r.designation || 'Staff'} • {r.paymentMethod}</Text></div>
        </div>
      ),
    },
    { title: 'Basic', dataIndex: 'basicSalary', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    {
      title: 'Leaves / OT / Bonus',
      key: 'adj',
      render: (_: any, r: PayrollRunItemDto) => (
        <Space size={4} wrap>
          {r.unpaidLeaveDays > 0 && <Tag color="red">L: {r.unpaidLeaveDays}d</Tag>}
          {r.overtimeHours > 0 && <Tag color="blue">OT: {r.overtimeHours}h</Tag>}
          {r.bonusAmount > 0 && <Tag color="green">+Rs.{r.bonusAmount.toLocaleString()}</Tag>}
          {r.unpaidLeaveDays === 0 && r.overtimeHours === 0 && r.bonusAmount === 0 && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    { title: 'Gross', dataIndex: 'grossEarnings', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
    { title: 'Deductions', dataIndex: 'totalDeductions', align: 'right' as const, render: (v: number) => v > 0 ? <Text type="danger">-{v.toLocaleString()}</Text> : '0' },
    { title: 'Loan Rec.', dataIndex: 'loanRecoveryAmount', align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="purple">-{v.toLocaleString()}</Tag> : '0' },
    { title: 'Net Pay', dataIndex: 'netSalary', align: 'right' as const, render: (v: number) => <Text strong>Rs. {v.toLocaleString()}</Text> },
    {
      title: 'Paid / Bal',
      key: 'paid',
      align: 'right' as const,
      render: (_: any, r: PayrollRunItemDto) => (
        <div>
          <Text type={r.paidAmount >= r.netSalary && r.netSalary > 0 ? 'success' : 'secondary'}>
            {r.paidAmount.toLocaleString()}
          </Text>
          {r.balanceAmount > 0 && <div><Text type="danger" style={{ fontSize: 11 }}>Bal: {r.balanceAmount.toLocaleString()}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: any, r: PayrollRunItemDto) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openItemDrawer(r)}>
            {isEditable ? 'Edit' : 'View'}
          </Button>
          <Button size="small" icon={<FilePdfOutlined />} onClick={() => payrollRunService.downloadPayslipPdf(runId, r.id, `Payslip_${r.hrInfoId}_${run?.runNo}.pdf`)} />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card loading={loading && !run}>
        {run && (
          <>
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col>
                <Space>
                  <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/payroll/runs')}>Back</Button>
                  <div>
                    <Space>
                      <Title level={4} style={{ margin: 0 }}>{run.runNo}</Title>
                      <Tag color={RUN_STATUS_META[run.status]?.color}>{RUN_STATUS_META[run.status]?.label}</Tag>
                      {run.glVoucherNo && <Tag color="blue">GL: PR-{run.glVoucherNo}</Tag>}
                    </Space>
                    <div>
                      <Text type="secondary">{run.description} • Pay Date: {run.payDate} • Period: {run.periodStart} to {run.periodEnd}</Text>
                    </div>
                  </div>
                </Space>
              </Col>

              <Col>
                <Space wrap>
                  {isEditable && (
                    <Button icon={<CalculatorOutlined />} loading={actionLoading} onClick={() => runAction(() => payrollRunService.calculate(run.id), 'Payroll recalculated')}>
                      Recalculate
                    </Button>
                  )}
                  {run.status === PayrollRunStatus.Calculated && (
                    <Button type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => runAction(() => payrollRunService.submit(run.id), 'Submitted for approval')}>
                      Submit for Approval
                    </Button>
                  )}
                  {run.status === PayrollRunStatus.PendingApproval && (
                    <>
                      <Button danger icon={<CloseCircleOutlined />} onClick={() => setReasonModal({ mode: 'reject', open: true })}>Reject</Button>
                      <Button type="primary" icon={<CheckCircleOutlined />} loading={actionLoading} onClick={() => runAction(() => payrollRunService.approve(run.id), 'Payroll run approved')}>
                        Approve Run
                      </Button>
                    </>
                  )}
                  {run.status === PayrollRunStatus.Approved && (
                    <Popconfirm title="Post payroll accruals to General Ledger and deduct scheduled loan installments?" onConfirm={() => runAction(() => payrollRunService.post(run.id), 'Payroll posted to General Ledger')}>
                      <Button type="primary" icon={<SafetyCertificateOutlined />} loading={actionLoading}>Post to GL</Button>
                    </Popconfirm>
                  )}
                  {canDisburse && (
                    <Button type="primary" icon={<BankOutlined />} onClick={() => {
                      disburseForm.setFieldsValue({
                        paymentDate: dayjs(),
                        paymentMethod: 'All',
                        sourceAccountId: cashBankAccounts[0]?.account,
                      });
                      setDisburseModalOpen(true);
                    }}>
                      Disburse Salaries
                    </Button>
                  )}
                  {run.status === PayrollRunStatus.Posted && disbursements.length === 0 && (
                    <Button danger icon={<RollbackOutlined />} onClick={() => setReasonModal({ mode: 'reverse', open: true })}>Reverse</Button>
                  )}
                  {run.items.length > 0 && (
                    <>
                      <Button icon={<FilePdfOutlined />} onClick={() => payrollRunService.downloadBulkPayslipsPdf(run.id, run.runNo)}>Bulk Payslips</Button>
                      <Button icon={<DownloadOutlined />} onClick={() => payrollRunService.downloadRegisterPdf(run.id, run.runNo)}>Register PDF</Button>
                    </>
                  )}
                </Space>
              </Col>
            </Row>

            {run.rejectionReason && (
              <Alert style={{ marginTop: 12 }} type="warning" showIcon message={`Note / Reason: ${run.rejectionReason}`} />
            )}

            <Divider style={{ margin: '16px 0' }} />

            <Steps
              current={currentStep}
              size="small"
              items={[
                { title: 'Prepare & Calculate', description: `${run.employeeCount} staff` },
                { title: 'Approval', description: run.approvedBy ? `By ${run.approvedBy}` : 'Maker-Checker' },
                { title: 'Post Accrual to GL', description: run.glVoucherNo ? `PR-${run.glVoucherNo}` : 'Double-entry' },
                { title: 'Disburse & Payslips', description: `Rs. ${run.totalPaidAmount.toLocaleString()} paid` },
              ]}
            />

            <Row gutter={16} style={{ marginTop: 20 }}>
              <Col xs={12} sm={6}><Statistic title="Gross Earnings" value={run.totalGrossEarnings} prefix="Rs." precision={2} /></Col>
              <Col xs={12} sm={6}><Statistic title="Deductions + Loans" value={run.totalDeductions + run.totalLoanRecovery} prefix="Rs." precision={2} valueStyle={{ color: '#cf1322' }} /></Col>
              <Col xs={12} sm={6}><Statistic title="Total Net Payable" value={run.totalNetSalary} prefix="Rs." precision={2} valueStyle={{ color: '#1677ff' }} /></Col>
              <Col xs={12} sm={6}><Statistic title="Paid / Remaining" value={run.totalPaidAmount} suffix={`/ Rs.${Math.max(0, run.totalNetSalary - run.totalPaidAmount).toLocaleString()}`} prefix="Rs." /></Col>
            </Row>
          </>
        )}
      </Card>

      {run && (
        <Card>
          <Tabs
            items={[
              {
                key: 'employees',
                label: `Employees (${run.items.length})`,
                children: (
                  <Table
                    rowKey="id"
                    dataSource={run.items}
                    columns={itemColumns}
                    scroll={{ x: 1100 }}
                    pagination={{ pageSize: 25 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'gl',
                label: `GL Posting Preview (${glPreview?.lines.length || 0})`,
                children: glPreview ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {glPreview.validationErrors.length > 0 && (
                      <Alert type="error" message="GL Validation Issues" description={glPreview.validationErrors.join('; ')} />
                    )}
                    <Alert
                      type={glPreview.isBalanced ? 'success' : 'error'}
                      message={`Total Debit: Rs. ${glPreview.totalDebit.toLocaleString()}  |  Total Credit: Rs. ${glPreview.totalCredit.toLocaleString()}  |  ${glPreview.isBalanced ? 'Balanced' : 'Unbalanced'}`}
                    />
                    <Table
                      rowKey={(_, idx) => String(idx)}
                      size="small"
                      pagination={{ pageSize: 20 }}
                      dataSource={glPreview.lines}
                      columns={[
                        { title: 'Debit Account', render: (_, l) => `${l.drAccountId} - ${l.drAccountTitle}` },
                        { title: 'Credit Account', render: (_, l) => `${l.crAccountId} - ${l.crAccountTitle}` },
                        { title: 'Amount', dataIndex: 'amount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
                        { title: 'Remarks', dataIndex: 'remarks' },
                      ]}
                    />
                  </Space>
                ) : <Text type="secondary">Calculate payroll to view GL preview.</Text>,
              },
              {
                key: 'disbursements',
                label: `Disbursements (${disbursements.length})`,
                children: (
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={disbursements}
                    columns={[
                      { title: 'Batch No', dataIndex: 'disbursementNo', render: (v: string) => <Text strong>{v}</Text> },
                      { title: 'Date', dataIndex: 'paymentDate' },
                      { title: 'Method', dataIndex: 'paymentMethod' },
                      { title: 'Source Account', render: (_, d) => `${d.sourceAccountId} - ${d.sourceAccountTitle}` },
                      { title: 'GL Voucher', dataIndex: 'glVoucherNo', render: (v?: string) => v ? <Tag color="blue">PV-{v}</Tag> : '-' },
                      { title: 'Staff', render: (_, d) => d.lines.length },
                      { title: 'Total Paid', dataIndex: 'totalAmount', align: 'right' as const, render: (v: number) => <Text strong>Rs. {v.toLocaleString()}</Text> },
                      {
                        title: 'Actions',
                        render: (_, d) => (
                          <Space>
                            <Button size="small" icon={<DownloadOutlined />} onClick={() => payrollDisbursementService.downloadBankAdviceCsv(d.id, d.disbursementNo)}>
                              Bank Advice CSV
                            </Button>
                            <Popconfirm title="Void this disbursement and reverse its GL Payment Voucher?" onConfirm={() => runAction(() => payrollDisbursementService.voidDisbursement(d.id), 'Disbursement voided')}>
                              <Button size="small" danger icon={<DeleteOutlined />}>Void</Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* Employee Breakdown & Adjustment Drawer */}
      <Drawer
        title={editItem ? `${editItem.employeeName} (${editItem.hrInfoId})` : 'Payroll Breakdown'}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        width={620}
        extra={isEditable && (
          <Button type="primary" loading={actionLoading} onClick={handleSaveItem}>Save & Recalculate</Button>
        )}
      >
        {editItem && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Basic Salary">Rs. {editItem.basicSalary.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Gross Earnings">Rs. {editItem.grossEarnings.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Deductions">Rs. {editItem.totalDeductions.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Loan Recovery">Rs. {editItem.loanRecoveryAmount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Net Payable" span={2}><Text strong style={{ fontSize: 15 }}>Rs. {editItem.netSalary.toLocaleString()}</Text></Descriptions.Item>
            </Descriptions>

            <Form form={itemForm} layout="vertical" disabled={!isEditable}>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="workingDays" label="Working Days"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
                <Col span={12}><Form.Item name="presentDays" label="Present Days"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="unpaidLeaveDays" label="Unpaid Leave Days"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={12}><Form.Item name="leaveChargeRate" label="Leave Charge / Day (Rs.)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="overtimeHours" label="Overtime Hours"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={12}><Form.Item name="overtimeRate" label="Overtime Rate / Hr (Rs.)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="bonusAmount" label="Bonus / Incentive (Rs.)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={12}><Form.Item name="isOnHold" label="Hold Salary Payment" valuePropName="checked"><Switch /></Form.Item></Col>
              </Row>
              <Form.Item name="remarks" label="Payslip Remarks"><Input /></Form.Item>
            </Form>

            <Divider>Calculated Component Breakdown</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={editItem.components}
              columns={[
                { title: 'Code', dataIndex: 'componentCode', width: 100 },
                { title: 'Component', dataIndex: 'componentName' },
                {
                  title: 'Type',
                  dataIndex: 'componentType',
                  width: 95,
                  render: (t: number) => t === PayrollComponentType.Earning ? <Tag color="green">Earning</Tag> : <Tag color="red">Deduction</Tag>,
                },
                { title: 'Amount', dataIndex: 'amount', align: 'right' as const, render: (v: number) => `Rs. ${v.toLocaleString()}` },
              ]}
            />
          </Space>
        )}
      </Drawer>

      {/* Bulk Disbursement Modal */}
      <Modal
        title="Disburse Salaries (Post Payment Voucher)"
        open={disburseModalOpen}
        onCancel={() => setDisburseModalOpen(false)}
        onOk={handleDisburse}
        confirmLoading={actionLoading}
      >
        <Form form={disburseForm} layout="vertical">
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Employee Payment Method Filter" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="All">All Unpaid Employees</Select.Option>
              <Select.Option value="BankTransfer">Bank Transfer Only</Select.Option>
              <Select.Option value="Cash">Cash Only</Select.Option>
              <Select.Option value="Cheque">Cheque Only</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sourceAccountId" label="Pay From (Cash / Bank Account)" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={cashBankAccounts.map(a => ({ value: a.account, label: `${a.account} - ${a.title}` }))}
            />
          </Form.Item>
          <Form.Item name="referenceNo" label="Bank Batch / Cheque Reference">
            <Input placeholder="Optional reference number" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject / Reverse Reason Modal */}
      <Modal
        title={reasonModal.mode === 'reject' ? 'Reject Payroll Run' : 'Reverse Posted Payroll Run'}
        open={reasonModal.open}
        onCancel={() => setReasonModal({ ...reasonModal, open: false })}
        onOk={handleReasonSubmit}
        confirmLoading={actionLoading}
      >
        <Input.TextArea
          rows={3}
          value={reasonText}
          onChange={e => setReasonText(e.target.value)}
          placeholder={reasonModal.mode === 'reject' ? 'Enter reason for rejection...' : 'Enter reason for GL reversal...'}
        />
      </Modal>
    </Space>
  );
};
