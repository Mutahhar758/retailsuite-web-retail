import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  FileTextOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { journalVoucherService, type JournalVoucherLineRequest } from '../../services/journalVoucherService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';

const { Title, Text } = Typography;

export const JournalVoucherForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [detailAccounts, setDetailAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [voucherLines, setVoucherLines] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const isEdit = !!voucherNo && voucherNo !== 'new';

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [detailAccs, narrs] = await Promise.all([
          chartOfAccountService.getDetailAccounts(),
          narrationService.getActiveNarrations()
        ]);
        setDetailAccounts(detailAccs);
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
          const details = await journalVoucherService.getDetail(voucherNo!);
          if (details && details.length > 0) {
            const first = details[0];
            form.setFieldsValue({
              date: dayjs(first.date),
              narration: first.narrationId
            });
            setVoucherLines(details.map((d, i) => ({
              key: i,
              seq: d.seq,
              drAccount: d.drAccountId,
              crAccount: d.crAccountId,
              amount: d.amount,
              remarks: d.remarks
            })));
            
            // Load balances for accounts in lines
            details.forEach(d => {
              handleAccountChange(d.drAccountId);
              handleAccountChange(d.crAccountId);
            });
          }
        } catch (error) {
          message.error('Failed to load voucher details');
          navigate('/daily-entries/journal-voucher');
        } finally {
          setLoading(false);
        }
      };
      loadVoucher();
    } else {
      form.setFieldsValue({ date: dayjs() });
      setVoucherLines([{
        key: Date.now(),
        seq: 1,
        drAccount: undefined,
        crAccount: undefined,
        amount: 0,
        remarks: ''
      }]);
    }
  }, [isEdit, voucherNo, form, navigate]);

  const handleAccountChange = async (accountId: string) => {
    if (!accountId || balances[accountId] !== undefined) return;
    try {
      const balance = await journalVoucherService.getAccountBalance(accountId);
      setBalances(prev => ({ ...prev, [accountId]: balance }));
    } catch (error) {
      console.error('Failed to fetch balance', error);
    }
  };

  const addRow = () => {
    const maxSeq = voucherLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
    const newRow = {
      key: Date.now(),
      seq: maxSeq + 1,
      drAccount: undefined,
      crAccount: undefined,
      amount: 0,
      remarks: ''
    };
    setVoucherLines([...voucherLines, newRow]);
  };

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await journalVoucherService.deleteLine(voucherNo!, record.seq);
        message.success('Row deleted from database');
      } catch (error) {
        message.error('Failed to delete row from database');
        return;
      }
    }
    setVoucherLines(voucherLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setVoucherLines(prev => {
      const updatedLines = prev.map(row => row.key === key ? { ...row, [field]: value } : row);
      const lastRow = updatedLines[updatedLines.length - 1];
      
      // Auto-add new row if last row is partially filled
      if (lastRow.key === key && lastRow.drAccount && lastRow.crAccount && lastRow.amount > 0) {
        const maxSeq = updatedLines.reduce((max, row) => Math.max(max, row.seq || 0), 0);
        return [...updatedLines, {
          key: Date.now() + 1,
          seq: maxSeq + 1,
          drAccount: undefined,
          crAccount: undefined,
          amount: 0,
          remarks: ''
        }];
      }
      return updatedLines;
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = voucherLines.filter(l => l.drAccount && l.crAccount && l.amount > 0);
      
      if (validLines.length === 0) {
        message.warning('Please add at least one valid line with Dr/Cr accounts and amount');
        return;
      }

      setLoading(true);
      const lines: JournalVoucherLineRequest[] = validLines.map(l => ({
        seq: l.seq,
        drAccount: l.drAccount,
        crAccount: l.crAccount,
        amount: l.amount,
        remarks: l.remarks || undefined
      }));

      const request = {
        date: values.date.format('YYYY-MM-DD'),
        narration: values.narration,
        lines
      };

      if (isEdit) {
        await journalVoucherService.update(voucherNo!, request);
        message.success('Voucher updated successfully');
      } else {
        const newVNo = await journalVoucherService.create(request);
        message.success('Voucher created successfully: ' + newVNo);
        navigate(`/daily-entries/journal-voucher/${newVNo}`);
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
      await journalVoucherService.delete(voucherNo!);
      message.success('Voucher deleted successfully');
      navigate('/daily-entries/journal-voucher');
    } catch (error) {
      message.error('Failed to delete voucher');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Debit Account',
      dataIndex: 'drAccount',
      render: (text: string, record: any) => (
        <Select
          showSearch
          placeholder="Debit Account"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => {
            updateRow(record.key, 'drAccount', val);
            handleAccountChange(val);
          }}
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
      title: 'Credit Account',
      dataIndex: 'crAccount',
      render: (text: string, record: any) => (
        <Select
          showSearch
          placeholder="Credit Account"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => {
            updateRow(record.key, 'crAccount', val);
            handleAccountChange(val);
          }}
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
      width: 150,
      render: (text: number, record: any) => (
        <InputNumber
          value={text}
          style={{ width: '100%' }}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => Number(value!.replace(/Rs\.?\s?|(,*)/g, ''))}
          onChange={(val) => updateRow(record.key, 'amount', val)}
        />
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      render: (text: string, record: any) => (
        <Input value={text} onChange={(e) => updateRow(record.key, 'remarks', e.target.value)} />
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
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/journal-voucher')} />
          <FileTextOutlined style={{ fontSize: 24, color: '#16a34a' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Journal Voucher: JV-${voucherNo}` : 'New Journal Voucher'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing journal entry' : 'Create a new general journal entry'}</Text>
          </div>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            Save Voucher
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
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input readOnly value={isEdit ? `JV-${voucherNo}` : ''} style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={16}>
            <Form.Item label="Narration" name="narration" rules={[{ required: true }]}>
              <Select showSearch placeholder="Select or enter narration">
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
          <Title level={5} style={{ margin: 0 }}>Journal Lines</Title>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row</Button>
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
                  <Table.Summary.Cell index={0} colSpan={2} align="right"><b>Total Amount</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong style={{ color: '#16a34a' }}>{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />

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
  );
};
