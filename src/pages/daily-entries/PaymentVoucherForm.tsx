import useFormShortcuts from '../../hooks/useFormShortcuts';
import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Alert
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  FileTextOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { paymentService, type PaymentLineRequest } from '../../services/paymentService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;

export const PaymentVoucherForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const draftData = (location.state as any)?.draftData;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detailAccounts, setDetailAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [voucherLines, setVoucherLines] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const isEdit = !!voucherNo && voucherNo !== 'new';

  // Keyboard navigation & Focus management
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const datePickerRef = useRef<any>(null);
  const cashBankSelectRef = useRef<any>(null);
  const narrationSelectRef = useRef<any>(null);

  const addRow = useCallback(() => {
    setVoucherLines(prev => {
      const maxSeq = prev.reduce((max, row) => Math.max(max, row.seq || 0), 0);
      return [
        ...prev,
        {
          key: Date.now(),
          seq: maxSeq + 1,
          account: undefined,
          amount: 0,
          checkNum: '',
          checkDate: null,
          remarks: ''
        }
      ];
    });
  }, []);

  const gridCols = ['account', 'amount', 'checkNum', 'remarks'];

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: voucherLines.length,
    enterCols: gridCols,
    arrowCols: gridCols,
    firstColKey: 'account',
    onAddRow: addRow,
    pendingFocusRef,
    isRowValid: (idx) => !!voucherLines[idx]?.account,
    onSave: () => handleSave(),
  });

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setVoucherLines([{
      key: Date.now(),
      seq: 1,
      account: undefined,
      amount: 0,
      checkNum: '',
      checkDate: null,
      remarks: ''
    }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [detailAccs, cbAccs, narrs] = await Promise.all([
          chartOfAccountService.getDetailAccounts(),
          chartOfAccountService.getCashBankAccounts(),
          narrationService.getActiveNarrationsLookup()
        ]);
        setDetailAccounts(detailAccs);
        setCashBankAccounts(cbAccs);
        setNarrations(narrs);
      } catch (error) {
        message.error('Failed to load lookups');
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    if (isEdit) {
      const loadVoucher = async () => {
        try {
          setLoading(true);
          const details = await paymentService.getDetail(voucherNo!);
          if (details && details.length > 0) {
            const first = details[0];
            form.setFieldsValue({
              date: dayjs(first.date),
              clearingDate: first.clearingDate ? dayjs(first.clearingDate) : null,
              cashBankAccount: first.cashBankAccountId,
              narration: first.narrationId
            });
            setVoucherLines(details.map((d, i) => ({
              key: i,
              seq: d.seq,
              account: d.accountId,
              amount: d.amount,
              checkNum: d.checkNum,
              checkDate: d.checkDate ? dayjs(d.checkDate) : null,
              remarks: d.remarks
            })));
          }
        } catch (error) {
          message.error('Failed to load voucher details');
          navigate('/daily-entries/payment-voucher');
        } finally {
          setLoading(false);
        }
      };
      loadVoucher();
    } else {
      form.setFieldsValue({
        date: dayjs(),
        cashBankAccount: draftData?.cashBankAccountId || undefined,
        narration: draftData?.remarks || undefined
      });
      setVoucherLines([{
        key: Date.now(),
        seq: 1,
        account: draftData?.vendorId || undefined,
        amount: Number(draftData?.amount) || 0,
        checkNum: '',
        checkDate: null,
        remarks: draftData?.remarks || ''
      }]);
    }
  }, [isEdit, voucherNo, form, navigate, draftData]);

  const handleAccountChange = async (accountId: string) => {
    if (!accountId) return;
    try {
      const balance = await paymentService.getAccountBalance(accountId);
      setBalances(prev => ({ ...prev, [accountId]: balance }));
    } catch (error) {
      console.error('Failed to fetch balance', error);
    }
  };

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await paymentService.deleteLine(voucherNo!, record.seq);
        message.success('Row deleted from database');
      } catch (error) {
        message.error('Failed to delete row from database');
        return;
      }
    }
    setVoucherLines(voucherLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setVoucherLines(prev => prev.map(row => row.key === key ? { ...row, [field]: value } : row));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = voucherLines.filter(l => l.account && l.amount > 0);
      
      if (validLines.length === 0) {
        message.warning('Please add at least one valid line with account and amount');
        return;
      }

      setLoading(true);
      const lines: PaymentLineRequest[] = validLines.map(l => ({
        seq: l.seq,
        account: l.account,
        amount: l.amount,
        checkNum: l.checkNum || undefined,
        checkDate: l.checkDate ? l.checkDate.format('YYYY-MM-DD') : undefined,
        remarks: l.remarks || undefined
      }));

      const request = {
        date: values.date.format('YYYY-MM-DD'),
        clearingDate: values.clearingDate ? values.clearingDate.format('YYYY-MM-DD') : undefined,
        cashBankAccount: values.cashBankAccount,
        narration: values.narration,
        lines
      };

      if (isEdit) {
        await paymentService.update(voucherNo!, request);
        message.success('Voucher updated successfully');
      } else {
        const newVNo = await paymentService.create(request);
        message.success('Voucher created successfully: ' + newVNo);
        navigate(`/daily-entries/payment-voucher/${newVNo}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await paymentService.delete(voucherNo!);
      message.success('Voucher deleted successfully');
      navigate('/daily-entries/payment-voucher');
    } catch (error) {
      message.error('Failed to delete voucher');
    } finally {
      setLoading(false);
    }
  };

  // Global form shortcut keys
  useFormShortcuts({
    onNew: handleNew,
    onFocusSearch: () => cashBankSelectRef.current?.focus(),
    onSave: handleSave,
    onAddRow: () => {
      pendingFocusRef.current = { rowIdx: voucherLines.length, colKey: 'account' };
      addRow();
    },
  });

  const handleDatePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => cashBankSelectRef.current?.focus(), 50);
    }
  };

  const handleCashBankKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => narrationSelectRef.current?.focus(), 50);
    }
  };

  const handleNarrationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => focusCell(0, 'account'), 50);
    }
  };

  const columns = [
    {
      title: 'Account',
      dataIndex: 'account',
      render: (text: string, record: any, rowIdx: number) => (
        <Select
          ref={getCellRef(rowIdx, 'account')}
          showSearch
          placeholder="Select Account"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => {
            updateRow(record.key, 'account', val);
            handleAccountChange(val);
          }}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'account', e)}
          optionFilterProp="children"
        >
          {detailAccounts.map(acc => (
            <Select.Option key={acc.account} value={acc.account}>
              {acc.title}
            </Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 170,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'amount')}
          value={text}
          style={{ width: '100%' }}
          controls={false}
          keyboard={false}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => Number(value!.replace(/Rs\.?\s?|(,*)/g, ''))}
          onChange={(val) => updateRow(record.key, 'amount', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'amount', e)}
        />
      )
    },
    {
      title: 'Check #',
      dataIndex: 'checkNum',
      width: 130,
      render: (text: string, record: any, rowIdx: number) => (
        <Input
          ref={getCellRef(rowIdx, 'checkNum')}
          value={text}
          onChange={(e) => updateRow(record.key, 'checkNum', e.target.value)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'checkNum', e)}
        />
      )
    },
    {
      title: 'Check Date',
      dataIndex: 'checkDate',
      width: 150,
      render: (text: any, record: any) => (
        <DatePicker value={text} onChange={(date) => updateRow(record.key, 'checkDate', date)} />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      render: (text: string, record: any, rowIdx: number) => (
        <Input
          ref={getCellRef(rowIdx, 'remarks')}
          value={text}
          onChange={(e) => updateRow(record.key, 'remarks', e.target.value)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'remarks', e)}
        />
      )
    },
    {
      title: 'Actions',
      width: 80,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeRow(record)} 
          disabled={voucherLines.length === 1}
        />
      )
    }
  ];

  return (
    <div tabIndex={-1} style={{ outline: 'none' }}>
      {draftData && (
        <Alert
          message="AI Assistant Draft"
          description={`Pre-filled voucher details for ${draftData.vendorName || 'vendor'} (Amount: ${draftData.amount || 0}). Please review and save.`}
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/payment-voucher')} />
            <FileTextOutlined style={{ fontSize: 24, color: '#dc2626' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Payment Voucher: PV-${voucherNo}` : 'New Payment Voucher'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing payment voucher' : 'Record payments to suppliers, expenses or accounts'}</Text>
            </div>
          </Space>
          <Space>
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              data-action="save" className="form-save-btn" onClick={handleSave} 
              loading={loading}
              danger
            >
              Save Voucher (F5)
            </Button>
            {isEdit && (
              <Popconfirm title="Delete this voucher?" onConfirm={handleDelete}>
                <Button type="primary" danger icon={<DeleteOutlined />} loading={loading}>Delete</Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={3}>
              <Form.Item label="Voucher #">
                <Input readOnly value={isEdit ? `PV-${voucherNo}` : ''} style={{ backgroundColor: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                <DatePicker
                  ref={datePickerRef}
                  style={{ width: '100%' }}
                  format="DD-MMM-YYYY"
                  onKeyDown={handleDatePickerKeyDown}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Clearing Date" name="clearingDate">
                <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item label="Cash / Bank Account" name="cashBankAccount" rules={[{ required: true }]}>
                <Select
                  ref={cashBankSelectRef}
                  showSearch
                  placeholder="Select Cash / Bank Account"
                  optionFilterProp="children"
                  onKeyDown={handleCashBankKeyDown}
                >
                  {cashBankAccounts.map(acc => (
                    <Select.Option key={acc.account} value={acc.account}>
                      {acc.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={7}>
              <Form.Item label="Narration" name="narration">
                <Select
                  ref={narrationSelectRef}
                  showSearch
                  placeholder="Select or enter narration"
                  onKeyDown={handleNarrationKeyDown}
                >
                  {narrations.map(n => (
                    <Select.Option key={n.code} value={n.code}>
                      {n.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Payment Details</Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row (Ins)</Button>
          </div>

          <Table
            dataSource={voucherLines}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            className="mb-4"
            summary={pageData => {
              let totalAmount = 0;
              pageData.forEach(({ amount }) => {
                totalAmount += amount || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} align="right"><b>Total Amount</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong style={{ color: '#dc2626' }}>{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={4}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Cash / Bank' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />

          {Object.keys(balances).length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <Text strong className="text-gray-500 uppercase text-xs tracking-wider mb-3 block">Current Balances</Text>
              <div className="flex flex-wrap gap-4">
                {Object.entries(balances).map(([acc, bal]) => {
                  const account = detailAccounts.find(a => a.account === acc);
                  const isPositive = bal >= 0;
                  return (
                    <div 
                      key={acc} 
                      className={`flex items-center gap-4 px-8 py-4 rounded-2xl border transition-all shadow-sm ${
                        isPositive 
                          ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800' 
                          : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800'
                      }`}
                      style={{ minWidth: '200px', width: 'max-content' }}
                    >
                      <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <BankOutlined style={{ fontSize: 20 }} />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">
                          {account?.title || acc}
                        </div>
                        <div className={`text-[18px] font-bold leading-none whitespace-nowrap ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                          <span className="text-[12px] mr-1 opacity-60">Rs.</span>
                          {Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="text-[12px] ml-2 font-bold opacity-90">{isPositive ? 'Dr' : 'Cr'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Form>
      </Card>
    </div>
  );
};
