import React, { useState, useEffect, useMemo } from 'react';
import {
  Space,
  Typography,
  Table,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  BankOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../services/chartOfAccountService';

const { Text } = Typography;

export interface PaymentEntry {
  key: string;
  accountId: string;
  accountTitle?: string;
  amount: number;
  reference?: string;
  checkNum?: string;
  checkDate?: string;
}

interface InlineMultiPaymentSectionProps {
  type: 'sale' | 'purchase';
  netAmount: number;
  partyName?: string;
  payments: PaymentEntry[];
  onChange: (payments: PaymentEntry[], totalPaid: number, balance: number) => void;
  onSave?: () => void;
}

export const InlineMultiPaymentSection: React.FC<InlineMultiPaymentSectionProps> = ({
  type,
  netAmount,
  partyName,
  payments,
  onChange,
  onSave
}) => {
  const [accounts, setAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Helper to distinguish Bank vs Cash
  const isBankAccount = (accountTitle: string = '') => {
    const lower = accountTitle.toLowerCase();
    return (
      lower.includes('bank') ||
      lower.includes('hbl') ||
      lower.includes('meezan') ||
      lower.includes('mcb') ||
      lower.includes('alfalah') ||
      lower.includes('ubl') ||
      lower.includes('allied') ||
      lower.includes('habib')
    );
  };

  // Fetch Cash & Bank accounts from Chart of Accounts
  useEffect(() => {
    let isMounted = true;
    setLoadingAccounts(true);
    chartOfAccountService
      .getCashBankAccounts()
      .then(res => {
        if (isMounted) {
          setAccounts(res || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAccounts([
            { account: '001002002001001', title: 'Main Cash' },
            { account: '001002002001002', title: 'Shop Petty Cash' },
            { account: '001002002002001', title: 'Meezan Bank' },
            { account: '001002002002002', title: 'HBL Islamic' }
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingAccounts(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Find the default cash account
  const defaultCashAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    return (
      accounts.find(a => a.title.toLowerCase() === 'cash') ||
      accounts.find(a => a.title.toLowerCase().includes('main cash')) ||
      accounts.find(a => a.title.toLowerCase().includes('cash in hand')) ||
      accounts.find(a => !isBankAccount(a.title)) ||
      accounts[0]
    );
  }, [accounts]);

  // By default, automatically select default cash account and set amount = netAmount
  useEffect(() => {
    if (defaultCashAccount && payments.length === 0 && netAmount > 0) {
      const initialLine: PaymentEntry = {
        key: 'default-cash-1',
        accountId: defaultCashAccount.account,
        accountTitle: defaultCashAccount.title,
        amount: netAmount
      };
      onChange([initialLine], netAmount, 0);
    }
  }, [defaultCashAccount, netAmount, payments.length]);

  const totalPaid = useMemo(() => {
    return payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [payments]);

  const balance = useMemo(() => {
    return Number((netAmount - totalPaid).toFixed(2));
  }, [netAmount, totalPaid]);

  const notifyChange = (updatedLines: PaymentEntry[]) => {
    const sum = updatedLines.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const bal = Number((netAmount - sum).toFixed(2));
    onChange(updatedLines, sum, bal);
  };

  const handleAddLine = (customRemainder?: number, customPayments?: PaymentEntry[]) => {
    const basePayments = customPayments || payments;
    const usedAccIds = new Set(basePayments.map(l => l.accountId));
    // Default next account to a bank or petty cash not yet selected
    const nextAcc = accounts.find(a => !usedAccIds.has(a.account)) || defaultCashAccount || accounts[0];
    const remainder = customRemainder !== undefined ? customRemainder : Math.max(0, balance);

    const newLine: PaymentEntry = {
      key: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      accountId: nextAcc?.account || '',
      accountTitle: nextAcc?.title || '',
      amount: remainder
    };

    const nextPayments = [...basePayments, newLine];
    notifyChange(nextPayments);

    // Auto-focus the new row's account selector or amount input
    setTimeout(() => {
      const newIdx = nextPayments.length - 1;
      const accSelectInput = document.querySelector<HTMLInputElement>(
        `.payment-account-select-${newIdx} input, .payment-account-select-${newIdx} .ant-select-selection-search-input`
      );
      if (accSelectInput) {
        accSelectInput.focus();
      } else {
        const amtInput = document.querySelector<HTMLInputElement>(`.payment-amount-input-${newIdx} input`);
        if (amtInput) {
          amtInput.focus();
          amtInput.select?.();
        }
      }
    }, 60);

    return newLine;
  };

  const handleRemoveLine = (key: string) => {
    const remaining = payments.filter(l => l.key !== key);
    notifyChange(remaining);
  };

  const handleUpdateLine = (key: string, updates: Partial<PaymentEntry>) => {
    const updated = payments.map(line => {
      if (line.key === key) {
        const newLine = { ...line, ...updates };
        if (updates.accountId) {
          const accObj = accounts.find(a => a.account === updates.accountId);
          if (accObj) {
            newLine.accountTitle = accObj.title;
          }
        }
        return newLine;
      }
      return line;
    });
    notifyChange(updated);
  };

  const handleFillRemainder = (key: string) => {
    const otherLinesSum = payments.filter(l => l.key !== key).reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const rem = Math.max(0, Number((netAmount - otherLinesSum).toFixed(2)));
    handleUpdateLine(key, { amount: rem });
  };

  return (
    <Card
      size="small"
      style={{
        marginTop: 16,
        borderRadius: 10,
        border: '1px solid #cbd5e1',
        background: '#f8fafc',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      {/* Top Bar: Section Title + Add Account Button */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <Space align="center" size="small">
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: type === 'sale' ? '#0284c7' : '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 15
            }}
          >
            {type === 'sale' ? <WalletOutlined /> : <DollarOutlined />}
          </div>
          <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
            {type === 'sale' ? 'Payment Settlement & Multi-Account Receipt' : 'Payment Settlement & Multi-Account Tender'}
          </Text>
          {partyName && (
            <Tag color="default" style={{ marginLeft: 4 }}>
              Party: {partyName}
            </Tag>
          )}
        </Space>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleAddLine()}
          style={{ fontWeight: 600 }}
        >
          Add Account
        </Button>
      </div>

      {/* Main Grid: Left = Payments Table, Right = Net Summary & Balance */}
      <Row gutter={16} align="top">
        {/* Left Side: Payment Accounts Breakdown */}
        <Col xs={24} lg={17}>
          <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <Table
              dataSource={payments}
              pagination={false}
              rowKey="key"
              size="small"
              locale={{
                emptyText: (
                  <div style={{ padding: '16px 0', textAlign: 'center' }}>
                    <Text type="secondary">
                      No payment accounts added. This transaction will be posted as{' '}
                      <Text strong style={{ color: '#d97706' }}>
                        100% Credit / Unpaid
                      </Text>{' '}
                      to party ledger.
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => handleAddLine()}>
                        Add Payment Line
                      </Button>
                    </div>
                  </div>
                )
              }}
              columns={[
                {
                  title: 'Account (Bank / Petty Cash)',
                  dataIndex: 'accountId',
                  width: '42%',
                  render: (_: any, record: PaymentEntry, index: number) => {
                    return (
                      <Select
                        showSearch
                        loading={loadingAccounts}
                        className={`payment-account-select payment-account-select-${index}`}
                        value={record.accountId || undefined}
                        placeholder="Select Account"
                        style={{ width: '100%' }}
                        optionFilterProp="children"
                        onChange={val => handleUpdateLine(record.key, { accountId: val })}
                        onInputKeyDown={e => {
                          if (e.key === 'Enter') {
                            setTimeout(() => {
                              const amtInput = document.querySelector<HTMLInputElement>(
                                `.payment-amount-input-${index} input`
                              );
                              if (amtInput) {
                                amtInput.focus();
                                amtInput.select?.();
                              }
                            }, 50);
                          }
                        }}
                      >
                        {accounts.map(acc => {
                          const bank = isBankAccount(acc.title);
                          return (
                            <Select.Option key={acc.account} value={acc.account}>
                              <Space>
                                {bank ? (
                                  <Tag color="blue" icon={<BankOutlined />} style={{ margin: 0 }}>
                                    Bank
                                  </Tag>
                                ) : (
                                  <Tag color="green" icon={<WalletOutlined />} style={{ margin: 0 }}>
                                    Cash
                                  </Tag>
                                )}
                                <span style={{ fontWeight: 500 }}>{acc.title}</span>
                              </Space>
                            </Select.Option>
                          );
                        })}
                      </Select>
                    );
                  }
                },
                {
                  title: 'Amount (Rs.)',
                  dataIndex: 'amount',
                  width: '28%',
                  render: (_: any, record: PaymentEntry, index: number) => (
                    <Space size={4} style={{ width: '100%' }}>
                      <InputNumber
                        className={`payment-amount-input payment-amount-input-${index} ${index === 0 ? 'payment-record-amount' : ''}`}
                        min={0}
                        precision={2}
                        value={record.amount}
                        controls={false}
                        formatter={v => (v !== undefined && v !== null ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
                        parser={v => Number(v?.replace(/,/g, '') || 0)}
                        style={{ width: 140, fontWeight: 'bold', fontSize: 14 }}
                        onChange={val => handleUpdateLine(record.key, { amount: Number(val) || 0 })}
                        onFocus={e => {
                          const input = e.target as HTMLInputElement;
                          input?.select?.();
                          setTimeout(() => input?.select?.(), 20);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();

                            // Get the most up-to-date amount (even if typed just before pressing enter)
                            const inputElem = e.target as HTMLInputElement;
                            const rawText = inputElem?.value;
                            const currentVal = rawText !== undefined && rawText !== ''
                              ? Number(rawText.replace(/,/g, ''))
                              : (Number(record.amount) || 0);
                            const finalAmt = isNaN(currentVal) ? (Number(record.amount) || 0) : currentVal;

                            // Update this line with finalAmt
                            const updatedLines = payments.map(l => l.key === record.key ? { ...l, amount: finalAmt } : l);
                            notifyChange(updatedLines);

                            // 1. If amount is zero and entered -> goto save
                            if (finalAmt === 0) {
                              if (onSave) onSave();
                              return;
                            }

                            // Calculate total paid across all lines
                            const currentTotalPaid = updatedLines.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                            const remainingBal = Number((netAmount - currentTotalPaid).toFixed(2));

                            // 2. If amount is less than total balance amount and entered -> auto add new row
                            if (remainingBal > 0) {
                              handleAddLine(remainingBal, updatedLines);
                            } else {
                              // Amount is >= total balance -> goto save
                              if (onSave) onSave();
                            }
                          }
                        }}
                      />
                      <Tooltip title="Auto-fill unpaid balance">
                        <Button
                          size="small"
                          type="text"
                          onClick={() => handleFillRemainder(record.key)}
                          style={{ padding: '0 4px', fontSize: 11, color: '#0284c7' }}
                        >
                          Fill
                        </Button>
                      </Tooltip>
                    </Space>
                  )
                },
                {
                  title: 'Reference / Cheque Details',
                  dataIndex: 'reference',
                  render: (_: any, record: PaymentEntry) => {
                    const accObj = accounts.find(a => a.account === record.accountId);
                    const isBank = accObj ? isBankAccount(accObj.title) : false;

                    return (
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Input
                          placeholder={isBank ? 'Trx ID / Cheque #' : 'Slip # / Note'}
                          value={record.reference || record.checkNum}
                          onChange={e => {
                            handleUpdateLine(record.key, {
                              reference: e.target.value,
                              checkNum: e.target.value
                            });
                          }}
                          size="small"
                        />
                        {isBank && (
                          <DatePicker
                            size="small"
                            placeholder="Cheque / Trx Date"
                            style={{ width: '100%' }}
                            value={record.checkDate ? dayjs(record.checkDate) : undefined}
                            onChange={date =>
                              handleUpdateLine(record.key, {
                                checkDate: date ? date.format('YYYY-MM-DD') : undefined
                              })
                            }
                          />
                        )}
                      </Space>
                    );
                  }
                },
                {
                  title: '',
                  key: 'action',
                  width: 36,
                  render: (_: any, record: PaymentEntry) => (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveLine(record.key)}
                    />
                  )
                }
              ]}
            />
          </div>
        </Col>

        {/* Right Side: Visual Accounting Breakdown Cards */}
        <Col xs={24} lg={7}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Net Bill Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Net Invoice:
              </Text>
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </div>

            {/* Total Paid Card */}
            <div
              style={{
                background: totalPaid > 0 ? '#f0fdf4' : '#ffffff',
                border: `1px solid ${totalPaid > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total Paid ({payments.length} Acc):
              </Text>
              <Text strong style={{ fontSize: 15, color: totalPaid > 0 ? '#16a34a' : '#64748b' }}>
                Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </div>

            {/* Balance / Status Card */}
            <div
              style={{
                background: balance > 0 ? '#fffbeb' : balance < 0 ? '#eff6ff' : '#f0fdf4',
                border: `1px solid ${balance > 0 ? '#fde68a' : balance < 0 ? '#bfdbfe' : '#bbf7d0'}`,
                borderRadius: 8,
                padding: '10px 12px',
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
                {balance > 0 ? (
                  <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 14 }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                )}
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: balance > 0 ? '#d97706' : balance < 0 ? '#2563eb' : '#16a34a'
                  }}
                >
                  {balance > 0 ? 'Partial Payment (Unpaid Due)' : balance < 0 ? 'Change Due to Customer' : 'Fully Settled (Rs. 0)'}
                </Text>
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: balance > 0 ? '#b45309' : balance < 0 ? '#1d4ed8' : '#15803d'
                }}
              >
                Rs. {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>

              {balance > 0 && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, lineHeight: 1.3 }}>
                  Remaining balance stays on {type === 'sale' ? 'customer' : 'supplier'} ledger. Recover anytime via{' '}
                  {type === 'sale' ? 'Receipt Voucher (RV)' : 'Payment Voucher (PV)'}.
                </Text>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
