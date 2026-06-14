import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Space, Typography, message, Divider,
  Spin, Empty, Statistic, Row, Col, Modal, InputNumber, Tag, Input, Select
} from 'antd';
import {
  SaveOutlined, ReloadOutlined, WalletOutlined, SearchOutlined
} from '@ant-design/icons';
import { openingBalanceService, type OpeningBalanceDto } from '../../services/openingBalanceService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

const { Title, Text } = Typography;
const { Search } = Input;

interface EditableRow extends OpeningBalanceDto {
  dr: number | null;
  cr: number | null;
  dirty?: boolean;
}

export const OpeningBalance: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [parentAccounts, setParentAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [selectedParent, setSelectedParent] = useState<string | undefined>(undefined);
  

  const fetchParentAccounts = useCallback(async () => {
    try {
      const heads = await chartOfAccountService.getHeads(4);
      setParentAccounts(heads);
    } catch {
      // ignore
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await openingBalanceService.getAll(selectedParent);
      const mapped: EditableRow[] = data.map(item => ({
        ...item,
        dr: item.bal > 0 ? item.bal : null,
        cr: item.bal < 0 ? -item.bal : null,
        dirty: false,
      }));
      setRows(mapped);
    } catch {
      message.error('Failed to load opening balances');
    } finally {
      setLoading(false);
    }
  }, [selectedParent]);

  useEffect(() => {
    fetchParentAccounts();
  }, [fetchParentAccounts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDrChange = (index: number, value: number | null) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], dr: value, cr: value != null ? null : next[index].cr, dirty: true };
      return next;
    });
  };

  const handleCrChange = (index: number, value: number | null) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], cr: value, dr: value != null ? null : next[index].dr, dirty: true };
      return next;
    });
  };

  const totalDr = rows.reduce((sum, r) => sum + (r.dr ?? 0), 0);
  const totalCr = rows.reduce((sum, r) => sum + (r.cr ?? 0), 0);
  const difference = totalDr - totalCr;

  const handleSave = () => {
    Modal.confirm({
      title: 'Save Opening Balances',
      content: 'Are you sure you want to save these opening balances?',
      okText: 'Yes, Save',
      cancelText: 'Cancel',
      onOk: async () => {
        setSaving(true);
        try {
          const dirtyRows = rows.filter(r => r.dirty);
          if (dirtyRows.length === 0) {
            message.info('No changes to save');
            return;
          }
          for (const row of dirtyRows) {
            await openingBalanceService.upsert({
              account: row.code,
              drAmount: row.dr ?? undefined,
              crAmount: row.cr ?? undefined,
            });
          }
          message.success('Opening balances saved successfully!');
          // Mark all as not dirty
          setRows(prev => prev.map(r => ({ ...r, dirty: false })));
        } catch {
          message.error('Failed to save opening balances');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const filteredRows = rows.filter(row =>
    !searchValue ||
    row.title.toLowerCase().includes(searchValue.toLowerCase()) ||
    row.code.toLowerCase().includes(searchValue.toLowerCase())
  );

  const dirtyCount = rows.filter(r => r.dirty).length;

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Space align="center">
          <WalletOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Opening Balances</Title>
            <Text type="secondary">Set account-wise opening debit / credit balances</Text>
          </div>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={dirtyCount === 0}
          >
            Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filters */}
      <Row gutter={16} className="mb-4">
        <Col xs={24} sm={12} md={8}>
          <Select
            placeholder="Filter by parent account (optional)"
            allowClear
            showSearch
            style={{ width: '100%' }}
            value={selectedParent}
            onChange={val => setSelectedParent(val)}
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={parentAccounts.map(p => ({
              value: p.account,
              label: `${p.title} (${p.account})`
            }))}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Search
            placeholder="Search by code or title..."
            onChange={e => setSearchValue(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Col>
      </Row>

      {/* Totals */}
      <Row gutter={16} className="mb-4">
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Statistic
              title="Total Debit"
              value={totalDr}
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
              prefix="₨"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7' }}>
            <Statistic
              title="Total Credit"
              value={totalCr}
              precision={2}
              valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
              prefix="₨"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{
              background: difference === 0 ? '#f6ffed' : '#fffbe6',
              borderColor: difference === 0 ? '#b7eb8f' : '#ffe58f'
            }}
          >
            <Statistic
              title="Difference"
              value={Math.abs(difference)}
              precision={2}
              valueStyle={{ color: difference === 0 ? '#52c41a' : '#faad14', fontSize: 18 }}
              prefix="₨"
              suffix={difference === 0 ? <Tag color="success" style={{ marginLeft: 4 }}>Balanced</Tag> : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : filteredRows.length === 0 ? (
        <Empty description="No accounts found" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--ant-color-bg-layout, #f5f5f5)' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Account Code</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>Title</th>
                <th style={{ ...thStyle, width: 160 }}>Debit (Dr)</th>
                <th style={{ ...thStyle, width: 160 }}>Credit (Cr)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                // find actual index in full rows array for mutation
                const realIdx = rows.findIndex(r => r.code === row.code);
                return (
                  <tr
                    key={row.code}
                    style={{
                      background: row.dirty ? 'rgba(22, 119, 255, 0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <td style={tdCenter}>{idx + 1}</td>
                    <td style={tdCenter}>
                      <Text strong style={{ fontFamily: 'monospace', color: '#1677ff', fontSize: 13 }}>
                        {row.code}
                      </Text>
                    </td>
                    <td style={tdLeft}>
                      <Text style={{ fontWeight: row.dirty ? 600 : 400 }}>{row.title}</Text>
                      {row.dirty && <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>Modified</Tag>}
                    </td>
                    <td style={tdRight}>
                      <InputNumber
                        value={row.dr}
                        min={0}
                        precision={2}
                        placeholder="0.00"
                        onChange={val => handleDrChange(realIdx, val)}
                        controls={false}
                        variant="borderless"
                        style={{
                          width: '100%',
                          background: row.dr ? 'rgba(82, 196, 26, 0.05)' : undefined,
                          borderRadius: 4,
                        }}
                      />
                    </td>
                    <td style={tdRight}>
                      <InputNumber
                        value={row.cr}
                        min={0}
                        precision={2}
                        placeholder="0.00"
                        onChange={val => handleCrChange(realIdx, val)}
                        controls={false}
                        variant="borderless"
                        style={{
                          width: '100%',
                          background: row.cr ? 'rgba(255, 77, 79, 0.05)' : undefined,
                          borderRadius: 4,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr style={{ background: 'var(--ant-color-bg-layout, #f0f0f0)', fontWeight: 700, borderTop: '2px solid rgba(0,0,0,0.12)' }}>
                <td colSpan={3} style={{ ...tdLeft, padding: '10px 12px' }}>
                  <Text strong>TOTAL</Text>
                </td>
                <td style={{ ...tdRight, padding: '10px 12px' }}>
                  <Text strong style={{ color: '#52c41a', fontFamily: 'monospace' }}>
                    {totalDr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </td>
                <td style={{ ...tdRight, padding: '10px 12px' }}>
                  <Text strong style={{ color: '#ff4d4f', fontFamily: 'monospace' }}>
                    {totalCr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: 13,
  borderBottom: '2px solid rgba(0,0,0,0.08)',
  whiteSpace: 'nowrap',
};

const tdCenter: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'center',
  verticalAlign: 'middle',
};

const tdLeft: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'left',
  verticalAlign: 'middle',
};

const tdRight: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'right',
  verticalAlign: 'middle',
};
