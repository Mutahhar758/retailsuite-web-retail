import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LockOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  accountingPeriodService,
  type AccountingPeriodCloseDetailResponse,
  type AccountingPeriodCloseResponse,
  type ClosingVoucherLineDto,
  type PeriodClosePreviewResponse,
} from '../../services/accountingPeriodService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { usePeriodLockStore } from '../../stores/usePeriodLockStore';
import { useAuthStore } from '../../stores/useAuthStore';

const { Title, Text } = Typography;

const formatMoney = (value: number) =>
  (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PeriodClosingPage: React.FC = () => {
  const [form] = Form.useForm();
  const { status: lockStatus, fetchLockStatus } = usePeriodLockStore();
  const permissions = useAuthStore((s) => s.permissions);

  const canCreate = permissions.includes('Permissions.AccountingPeriods.Create') || permissions.length === 0;
  const canApprove = permissions.includes('Permissions.AccountingPeriods.Approve') || permissions.length === 0;

  const [history, setHistory] = useState<AccountingPeriodCloseResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [equityAccounts, setEquityAccounts] = useState<ChartOfAccountHeadDto[]>([]);

  const [wizardStep, setWizardStep] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [preview, setPreview] = useState<PeriodClosePreviewResponse | null>(null);

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AccountingPeriodCloseDetailResponse | null>(null);

  const [reopenModalTarget, setReopenModalTarget] = useState<AccountingPeriodCloseResponse | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);

  const loadData = async () => {
    setHistoryLoading(true);
    try {
      const [hist, eqAccounts] = await Promise.all([
        accountingPeriodService.getHistory(),
        chartOfAccountService.getLookup('005001', 5),
        fetchLockStatus(),
      ]);
      setHistory(hist || []);
      // Exclude Income Summary (005001001001003) from destination equity choices
      setEquityAccounts((eqAccounts || []).filter((a) => a.account !== '005001001001003'));
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load accounting periods.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (lockStatus?.defaultTargetEquityAccountId && !form.getFieldValue('targetEquityAccountId')) {
      form.setFieldsValue({
        targetEquityAccountId: lockStatus.defaultTargetEquityAccountId,
        closeDrawings: true,
      });
    }
  }, [lockStatus, form]);

  const handlePreview = async () => {
    try {
      const values = await form.validateFields(['periodName', 'closingDate', 'targetEquityAccountId', 'closeDrawings']);
      setPreviewLoading(true);
      const res = await accountingPeriodService.previewClose({
        closingDate: (values.closingDate as Dayjs).format('YYYY-MM-DD'),
        targetEquityAccountId: values.targetEquityAccountId,
        closeDrawings: !!values.closeDrawings,
      });
      setPreview(res);
      setWizardStep(1);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to generate closing preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmClose = () => {
    if (!preview || !preview.canClose) return;
    const values = form.getFieldsValue();
    const closingDateStr = (values.closingDate as Dayjs).format('DD-MMM-YYYY');

    Modal.confirm({
      title: 'Confirm Accounting Period Close',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            You are about to close <strong>{values.periodName}</strong> through{' '}
            <strong>{closingDateStr}</strong>.
          </p>
          <ul style={{ paddingLeft: 18 }}>
            <li>
              <strong>{preview.proposedEntries.length}</strong> closing journal entries (<code>CL</code>) will be posted on{' '}
              <strong>{closingDateStr}</strong>.
            </li>
            <li>
              Net {preview.netProfitLoss >= 0 ? 'Profit' : 'Loss'} of{' '}
              <strong>{formatMoney(Math.abs(preview.netProfitLoss))}</strong> will be transferred to{' '}
              <strong>{preview.targetEquityAccountTitle}</strong>.
            </li>
            <li>
              All transactions on or before <strong>{closingDateStr}</strong> will be locked against backdated creation, edits, or deletion.
            </li>
          </ul>
        </div>
      ),
      okText: 'Close Period & Lock Books',
      okButtonProps: { danger: true },
      onOk: async () => {
        setExecuteLoading(true);
        try {
          await accountingPeriodService.executeClose({
            periodName: values.periodName,
            closingDate: (values.closingDate as Dayjs).format('YYYY-MM-DD'),
            targetEquityAccountId: values.targetEquityAccountId,
            closeDrawings: !!values.closeDrawings,
            notes: values.notes,
          });
          message.success(`Period "${values.periodName}" closed and books locked through ${closingDateStr}.`);
          setPreview(null);
          setWizardStep(0);
          form.resetFields(['periodName', 'closingDate', 'notes']);
          await loadData();
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Failed to close accounting period.');
        } finally {
          setExecuteLoading(false);
        }
      },
    });
  };

  const handleViewDetail = async (record: AccountingPeriodCloseResponse) => {
    setDetailDrawerOpen(true);
    setDetailLoading(true);
    try {
      const detail = await accountingPeriodService.getDetail(record.id);
      setSelectedDetail(detail);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load closing voucher details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExecuteReopen = async () => {
    if (!reopenModalTarget) return;
    if (!reopenReason.trim()) {
      message.warning('Please enter a reason for reopening this closed period.');
      return;
    }
    setReopenLoading(true);
    try {
      await accountingPeriodService.reopenLatest(reopenModalTarget.id, reopenReason.trim());
      message.success(`Period "${reopenModalTarget.periodName}" reopened. Closing entries reversed.`);
      setReopenModalTarget(null);
      setReopenReason('');
      await loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to reopen accounting period.');
    } finally {
      setReopenLoading(false);
    }
  };

  const disabledClosingDate = (current: Dayjs) => {
    if (!current) return false;
    if (current.isAfter(dayjs().endOf('day'))) return true;
    if (lockStatus?.lockDate) {
      return !current.startOf('day').isAfter(dayjs(lockStatus.lockDate).startOf('day'));
    }
    return false;
  };

  const entryColumns = [
    { title: '#', dataIndex: 'seq', width: 55 },
    {
      title: 'Debit Account',
      key: 'dr',
      render: (_: any, r: ClosingVoucherLineDto) => (
        <div>
          <Text strong>{r.drAccountTitle}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.drAccountId}</Text></div>
        </div>
      ),
    },
    {
      title: 'Credit Account',
      key: 'cr',
      render: (_: any, r: ClosingVoucherLineDto) => (
        <div>
          <Text strong>{r.crAccountTitle}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.crAccountId}</Text></div>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatMoney(val)}</Text>,
    },
    { title: 'Remarks', dataIndex: 'remarks' },
  ];

  const historyColumns = [
    {
      title: 'Period Name',
      dataIndex: 'periodName',
      render: (text: string, r: AccountingPeriodCloseResponse) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.periodStartDate).format('DD-MMM-YYYY')} → {dayjs(r.closingDate).format('DD-MMM-YYYY')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Voucher',
      dataIndex: 'closingVoucherNo',
      render: (v: string) => <Tag color="blue">CL-{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) =>
        s === 'Closed' ? (
          <Tag icon={<LockOutlined />} color="green">Closed</Tag>
        ) : (
          <Tag icon={<RollbackOutlined />} color="orange">Reopened</Tag>
        ),
    },
    {
      title: 'Net Profit / (Loss)',
      dataIndex: 'netProfitLoss',
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v >= 0 ? '#16a34a' : '#dc2626' }}>
          {v >= 0 ? formatMoney(v) : `(${formatMoney(Math.abs(v))})`}
        </Text>
      ),
    },
    {
      title: 'Transferred To',
      dataIndex: 'targetEquityAccountTitle',
    },
    {
      title: 'Balance Sheet',
      dataIndex: 'isBalanced',
      render: (ok: boolean) =>
        ok ? <Tag color="success">Balanced</Tag> : <Tag color="warning">Check Op Bal</Tag>,
    },
    {
      title: 'Closed By',
      key: 'closedBy',
      render: (_: any, r: AccountingPeriodCloseResponse) => (
        <Space direction="vertical" size={0}>
          <Text>{r.closedBy || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.closedOn).format('DD-MMM-YYYY HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: AccountingPeriodCloseResponse) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
            Entries
          </Button>
          {canApprove && r.canReopen && (
            <Tooltip title="Reopen most recent closed period">
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() => {
                  setReopenModalTarget(r);
                  setReopenReason('');
                }}
              >
                Reopen
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              Accounting Period Closing
            </Title>
            <Text type="secondary">
              Close books on any cutoff date (monthly, quarterly, or fiscal year-end), finalize Profit &amp; Loss into Equity, and lock backdated transactions.
            </Text>
          </div>
        </div>

        {lockStatus?.lockDate ? (
          <Alert
            type="info"
            showIcon
            icon={<LockOutlined />}
            message={
              <span>
                Books are currently locked through{' '}
                <strong>{dayjs(lockStatus.lockDate).format('DD-MMM-YYYY')}</strong>{' '}
                ({lockStatus.lastClosedPeriodName}). Next open transaction date:{' '}
                <strong>{dayjs(lockStatus.nextOpenDate).format('DD-MMM-YYYY')}</strong>.
              </span>
            }
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="No accounting periods have been closed yet. All historical transaction dates are currently open."
          />
        )}

        {canCreate && (
          <Card title="Close Accounting Period">
            <Steps
              current={wizardStep}
              style={{ marginBottom: 24 }}
              items={[
                { title: 'Select Closing Date & Options' },
                { title: 'Review Summary & Closing Entries' },
              ]}
            />

            {wizardStep === 0 && (
              <Form form={form} layout="vertical" initialValues={{ closeDrawings: true }}>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="periodName"
                      label="Period Name"
                      rules={[{ required: true, message: 'Enter a name (e.g., Q1 2026 or FY 2025-26)' }]}
                    >
                      <Input placeholder="e.g. FY 2025-26 or Q2 2026" maxLength={150} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="closingDate"
                      label="Closing Cutoff Date"
                      rules={[{ required: true, message: 'Select a closing date' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD-MMM-YYYY"
                        disabledDate={disabledClosingDate}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Form.Item
                      name="targetEquityAccountId"
                      label="Transfer Net Profit / (Loss) To"
                      rules={[{ required: true, message: 'Select target equity account' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Select Equity Account (e.g. Retained Earnings)"
                        options={equityAccounts.map((a) => ({
                          value: a.account,
                          label: `${a.title} (${a.account})`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="notes" label="Closing Notes (Optional)">
                      <Input placeholder="Audit remarks or fiscal period notes" maxLength={500} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'center' }}>
                    <Form.Item name="closeDrawings" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Checkbox>Also close Owner Drawing accounts (005002*) into Owner&apos;s Equity</Checkbox>
                    </Form.Item>
                  </Col>
                </Row>

                <Button type="primary" loading={previewLoading} onClick={handlePreview}>
                  Generate Closing Preview
                </Button>
              </Form>
            )}

            {wizardStep === 1 && preview && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {preview.validationErrors.length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    message="Cannot Close Period"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {preview.validationErrors.map((e, idx) => <li key={idx}>{e}</li>)}
                      </ul>
                    }
                  />
                )}

                {preview.validationWarnings.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    message="Pre-Close Warnings (Review Before Confirming)"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {preview.validationWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                      </ul>
                    }
                  />
                )}

                <Row gutter={16}>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic title="Total Income" value={preview.totalIncome} precision={2} />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic title="Cost of Goods Sold" value={preview.totalCogs} precision={2} />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic title="Operating Expenses" value={preview.totalExpenses} precision={2} />
                    </Card>
                  </Col>
                  <Col xs={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title={preview.netProfitLoss >= 0 ? 'Net Profit' : 'Net Loss'}
                        value={Math.abs(preview.netProfitLoss)}
                        precision={2}
                        valueStyle={{ color: preview.netProfitLoss >= 0 ? '#16a34a' : '#dc2626' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                  <Descriptions.Item label="Period Range">
                    {dayjs(preview.periodStartDate).format('DD-MMM-YYYY')} → {dayjs(preview.closingDate).format('DD-MMM-YYYY')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Opening FIFO Stock">{formatMoney(preview.openingStockValue)}</Descriptions.Item>
                  <Descriptions.Item label="Closing FIFO Stock">{formatMoney(preview.closingStockValue)}</Descriptions.Item>
                  <Descriptions.Item label="Post-Close Assets">{formatMoney(preview.postCloseTotalAssets)}</Descriptions.Item>
                  <Descriptions.Item label="Post-Close Liabilities">{formatMoney(preview.postCloseTotalLiabilities)}</Descriptions.Item>
                  <Descriptions.Item label="Post-Close Equity">
                    {formatMoney(preview.postCloseTotalEquity)}{' '}
                    {preview.isBalanced ? (
                      <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginLeft: 6 }}>Balanced</Tag>
                    ) : (
                      <Tag color="warning" style={{ marginLeft: 6 }}>Diff: {formatMoney(preview.balanceSheetDifference)}</Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>

                <Divider>
                  Proposed Closing Journal Entries ({preview.proposedEntries.length})
                </Divider>

                <Table
                  size="small"
                  rowKey="seq"
                  columns={entryColumns}
                  dataSource={preview.proposedEntries}
                  pagination={false}
                  scroll={{ x: 700 }}
                />

                <Space>
                  <Button onClick={() => setWizardStep(0)}>Back to Edit</Button>
                  <Button
                    type="primary"
                    danger
                    icon={<LockOutlined />}
                    disabled={!preview.canClose}
                    loading={executeLoading}
                    onClick={handleConfirmClose}
                  >
                    Confirm &amp; Close Period
                  </Button>
                </Space>
              </Space>
            )}
          </Card>
        )}

        <Card title="Closed & Reopened Periods History">
          <Table
            rowKey="id"
            loading={historyLoading}
            columns={historyColumns}
            dataSource={history}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
          />
        </Card>
      </Space>

      <Drawer
        title={selectedDetail ? `Closing Voucher CL-${selectedDetail.closingVoucherNo} — ${selectedDetail.periodName}` : 'Closing Details'}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={820}
      >
        {selectedDetail && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Period">
                {dayjs(selectedDetail.periodStartDate).format('DD-MMM-YYYY')} → {dayjs(selectedDetail.closingDate).format('DD-MMM-YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedDetail.status === 'Closed' ? 'green' : 'orange'}>{selectedDetail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Income">{formatMoney(selectedDetail.totalIncome)}</Descriptions.Item>
              <Descriptions.Item label="Total COGS">{formatMoney(selectedDetail.totalCogs)}</Descriptions.Item>
              <Descriptions.Item label="Total Expenses">{formatMoney(selectedDetail.totalExpenses)}</Descriptions.Item>
              <Descriptions.Item label="Net Profit / (Loss)">{formatMoney(selectedDetail.netProfitLoss)}</Descriptions.Item>
              <Descriptions.Item label="Opening Stock">{formatMoney(selectedDetail.openingStockValue)}</Descriptions.Item>
              <Descriptions.Item label="Closing Stock">{formatMoney(selectedDetail.closingStockValue)}</Descriptions.Item>
              <Descriptions.Item label="Post-Close Assets">{formatMoney(selectedDetail.totalAssets)}</Descriptions.Item>
              <Descriptions.Item label="Post-Close Liab + Equity">
                {formatMoney(selectedDetail.totalLiabilities + selectedDetail.totalEquity)}
              </Descriptions.Item>
              {selectedDetail.reopenReason && (
                <Descriptions.Item label="Reopen Audit" span={2}>
                  Reopened by <strong>{selectedDetail.reopenedBy}</strong> on{' '}
                  {selectedDetail.reopenedOn ? dayjs(selectedDetail.reopenedOn).format('DD-MMM-YYYY HH:mm') : '-'} —{' '}
                  {selectedDetail.reopenReason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Table
              size="small"
              loading={detailLoading}
              rowKey="seq"
              columns={entryColumns}
              dataSource={selectedDetail.closingEntries}
              pagination={false}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title={`Reopen Period: ${reopenModalTarget?.periodName || ''}`}
        open={!!reopenModalTarget}
        onCancel={() => setReopenModalTarget(null)}
        onOk={handleExecuteReopen}
        confirmLoading={reopenLoading}
        okText="Reopen Period"
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Reopening will reverse (soft-delete) this period's CL closing voucher and unlock transactions after the previous closed period."
        />
        <Input.TextArea
          rows={3}
          placeholder="Enter mandatory audit reason for reopening this period..."
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </div>
  );
};
