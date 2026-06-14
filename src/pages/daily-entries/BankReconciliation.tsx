import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Button,
  Table, Space, message, Checkbox, Statistic, Tag
} from 'antd';
import {
  SearchOutlined, SaveOutlined, BankOutlined, CalendarOutlined,
  CheckCircleOutlined, InfoCircleOutlined, SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { bankReconciliationService, type BankReconciliationLine } from '../../services/bankReconciliationService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const BankReconciliation: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [data, setData] = useState<BankReconciliationLine[]>([]);
  const [reconcileBalance, setReconcileBalance] = useState(0);
  const [statementBalance, setStatementBalance] = useState(0);

  const rangePresets: { label: string; value: [dayjs.Dayjs, dayjs.Dayjs] }[] = [
    { label: 'Today', value: [dayjs(), dayjs()] },
    { label: 'Yesterday', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
    { label: 'Last 7 Days', value: [dayjs().subtract(7, 'days'), dayjs()] },
    { label: 'Last 30 Days', value: [dayjs().subtract(30, 'days'), dayjs()] },
    { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  ];

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await chartOfAccountService.getCashBankAccounts();
        setBankAccounts(accounts);
      } catch (error) {
        message.error('Failed to load bank accounts');
      }
    };
    fetchAccounts();
    
    // Set default dates: 1 month back to today
    form.setFieldsValue({
      range: [dayjs().subtract(1, 'month'), dayjs()]
    });
  }, [form]);

  const handleFetch = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const filter = {
        bankAccount: values.bankAccount,
        fromDate: values.range[0].format('YYYY-MM-DD'),
        toDate: values.range[1].format('YYYY-MM-DD')
      };
      const result = await bankReconciliationService.getSnapshot(filter);
      setData(result.lines);
      setReconcileBalance(result.reconcileBalance);
      setStatementBalance(result.statementBalance);
    } catch (error) {
      message.error('Failed to fetch reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClear = (voucherNo: string, vSeq: number, checked: boolean) => {
    setData(prev => {
        const line = prev.find(l => l.voucherNo === voucherNo && l.vSeq === vSeq);
        if (line) {
            const amount = line.dr - line.cr;
            if (checked) {
                setReconcileBalance(curr => curr + amount);
            } else {
                setReconcileBalance(curr => curr - amount);
            }
        }
        return prev.map(l => (l.voucherNo === voucherNo && l.vSeq === vSeq) ? { ...l, clear: checked } : l);
    });
  };

  const handleToggleAllClear = (checked: boolean) => {
    setData(prev => {
        let newReconcileBalance = reconcileBalance;
        const newData = prev.map(l => {
            if (l.clear !== checked) {
                const amount = l.dr - l.cr;
                if (checked) {
                    newReconcileBalance += amount;
                } else {
                    newReconcileBalance -= amount;
                }
            }
            return { ...l, clear: checked };
        });
        setReconcileBalance(newReconcileBalance);
        return newData;
    });
  };

  const isAllChecked = data.length > 0 && data.every(l => l.clear);
  const isSomeChecked = data.some(l => l.clear) && !isAllChecked;

  const handleSave = async () => {
    try {
      setSaving(true);
      const request = {
        lines: data.map(l => ({
          voucherNo: l.voucherNo,
          vSeq: l.vSeq,
          clear: l.clear
        }))
      };
      await bankReconciliationService.save(request);
      message.success('Reconciliation saved successfully');
    } catch (error) {
      message.error('Failed to save reconciliation');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Voucher #',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 150,
      render: (text: string) => <Tag color="blue" className="rounded-md px-2 font-medium">{text}</Tag>
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (val: string) => <Text type="secondary">{dayjs(val).format('DD-MMM-YYYY')}</Text>
    },
    {
      title: 'Check #',
      dataIndex: 'checkNum',
      key: 'checkNum',
      width: 120,
      render: (text: string) => text ? <Tag icon={<CalendarOutlined />} color="default">{text}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'Check Date',
      dataIndex: 'checkDate',
      key: 'checkDate',
      width: 120,
      render: (val: string) => val ? dayjs(val).format('DD-MMM-YYYY') : <Text type="secondary">-</Text>
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Debit',
      dataIndex: 'dr',
      key: 'dr',
      width: 120,
      align: 'right' as const,
      render: (val: number) => val > 0 ? (
        <Text strong className="text-emerald-600">
          {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: 'Credit',
      dataIndex: 'cr',
      key: 'cr',
      width: 120,
      align: 'right' as const,
      render: (val: number) => val > 0 ? (
        <Text strong className="text-rose-600">
          {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: (
        <Space size={4}>
            <Checkbox 
                checked={isAllChecked} 
                indeterminate={isSomeChecked}
                onChange={(e) => handleToggleAllClear(e.target.checked)} 
            />
            <span className="text-xs uppercase font-bold text-gray-500">Clear</span>
        </Space>
      ),
      dataIndex: 'clear',
      key: 'clear',
      width: 100,
      align: 'center' as const,
      render: (val: boolean, record: any) => (
        <Checkbox 
          checked={val} 
          onChange={(e) => handleToggleClear(record.voucherNo, record.vSeq, e.target.checked)} 
          className="scale-110"
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <BankOutlined style={{ fontSize: 24, color: '#16a34a' }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>Bank Reconciliation</Title>
              <Text type="secondary">Clear bank transactions and reconcile balances</Text>
            </div>
          </Space>
          {data.length > 0 && (
             <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave} 
                loading={saving} 
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                size="large"
                className="shadow-md"
              >
                Save Reconciliation
              </Button>
          )}
        </div>

        <Form form={form} layout="vertical" onFinish={handleFetch}>
          <Row gutter={16} align="bottom">
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Bank Account" name="bankAccount" rules={[{ required: true }]}>
                <Select 
                    showSearch 
                    placeholder="Select Bank Account" 
                    optionFilterProp="children"
                    size="large"
                >
                  {bankAccounts.map(a => (
                    <Select.Option key={a.account} value={a.account}>{a.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={10} lg={8}>
              <Form.Item label="Date Range" name="range" rules={[{ required: true }]}>
                <RangePicker presets={rangePresets} style={{ width: '100%' }} format="DD-MMM-YYYY" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6} lg={4}>
              <Form.Item>
                <Button 
                    type="primary" 
                    icon={<SearchOutlined />} 
                    htmlType="submit" 
                    loading={loading} 
                    block 
                    size="large"
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  Load Data
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {data.length > 0 ? (
        <div className="animate-fade-in">
          <Row gutter={16} className="mb-6">
            <Col span={12}>
              <Card className="shadow-sm border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircleOutlined className="text-emerald-600" />
                    <span className="font-semibold text-emerald-800 uppercase tracking-wider text-xs">Reconciled Balance</span>
                  </div>
                  <Tag color="success">Bank Ledger</Tag>
                </div>
                <div className="p-4">
                  <Statistic 
                    value={reconcileBalance} 
                    precision={2} 
                    valueStyle={{ color: '#059669', fontWeight: 800, fontSize: '28px' }}
                    prefix={<span className="text-sm mr-1">Rs.</span>} 
                  />
                  <Text type="secondary" className="text-xs">Based on cleared transactions in the selected period</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card className="shadow-sm border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <InfoCircleOutlined className="text-blue-600" />
                    <span className="font-semibold text-blue-800 uppercase tracking-wider text-xs">Statement Balance</span>
                  </div>
                  <Tag color="processing">All Entries</Tag>
                </div>
                <div className="p-4">
                  <Statistic 
                    value={statementBalance} 
                    precision={2} 
                    valueStyle={{ color: '#2563eb', fontWeight: 800, fontSize: '28px' }}
                    prefix={<span className="text-sm mr-1">Rs.</span>} 
                  />
                  <Text type="secondary" className="text-xs">Total ledger balance regardless of clearance</Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Card className="shadow-sm border-gray-100 rounded-xl" bodyStyle={{ padding: 0 }}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <Title level={5} style={{ margin: 0 }}>Transaction List</Title>
              <Text type="secondary">{data.length} transactions found</Text>
            </div>
            
            <Table
              dataSource={data}
              columns={columns}
              pagination={false}
              rowKey={(record) => `${record.voucherNo}-${record.vSeq}`}
              size="middle"
              scroll={{ y: 500 }}
              className="bank-recon-table"
            />
          </Card>
        </div>
      ) : !loading && (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <SyncOutlined spin={loading} style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
            <Text type="secondary" strong>Select an account and date range to begin reconciliation</Text>
            <Text type="secondary" className="text-xs mt-1">Transactions with check numbers will appear here for clearance</Text>
          </div>
      )}
    </div>
  );
};
