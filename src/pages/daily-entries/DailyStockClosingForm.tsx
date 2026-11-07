import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import useFormShortcuts from '../../hooks/useFormShortcuts';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Tag, Switch, Popconfirm, Divider
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, SyncOutlined, CheckCircleOutlined,
  FilterOutlined, DeleteOutlined, ReconciliationOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import {
  dailyStockClosingService,
  type DailyStockClosingItemLine
} from '../../services/dailyStockClosingService';
import {
  chartOfAccountService,
  type ChartOfAccountHeadDto
} from '../../services/chartOfAccountService';
import {
  itemCategoryService,
  type ItemCategoryDto
} from '../../services/itemCategoryService';
import { round } from '../../utils/numberUtils';

const { Title, Text } = Typography;

interface EditableStockRow extends DailyStockClosingItemLine {
  manualPurchased?: boolean;
}

export const DailyStockClosingForm: React.FC = () => {
  const { closingDate } = useParams<{ closingDate: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(
    closingDate && closingDate !== 'new' && dayjs(closingDate, 'YYYY-MM-DD', true).isValid()
      ? dayjs(closingDate, 'YYYY-MM-DD')
      : dayjs()
  );

  const [isExisting, setIsExisting] = useState(false);
  const [purchaseVoucherNo, setPurchaseVoucherNo] = useState<string | null>(null);
  const [saleVoucherNo, setSaleVoucherNo] = useState<string | null>(null);

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [cashBanks, setCashBanks] = useState<ChartOfAccountHeadDto[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [showChangedOnly, setShowChangedOnly] = useState(false);

  const [rows, setRows] = useState<EditableStockRow[]>([]);
  const [manualSaleTotal, setManualSaleTotal] = useState<number | null>(null);
  const [manualPurchaseTotal, setManualPurchaseTotal] = useState<number | null>(null);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [custRes, vendRes, cashRes, catRes] = await Promise.all([
          chartOfAccountService.getCustomerAccounts(),
          chartOfAccountService.getSupplierAccounts(),
          chartOfAccountService.getCashBankAccounts(),
          itemCategoryService.getActiveItemCategoriesLookup(),
        ]);
        setCustomers(custRes || []);
        setVendors(vendRes || []);
        setCashBanks(cashRes || []);
        setCategories(catRes || []);
      } catch {
        message.error('Failed to load account and category lookups');
      }
    };
    loadLookups();
  }, []);

  const loadSheetForDate = useCallback(async (dateObj: dayjs.Dayjs) => {
    setLoading(true);
    try {
      const dateStr = dateObj.format('YYYY-MM-DD');
      const sheet = await dailyStockClosingService.getSheet(dateStr);

      setIsExisting(sheet.isExisting);
      setPurchaseVoucherNo(sheet.purchaseVoucherNo ?? null);
      setSaleVoucherNo(sheet.saleVoucherNo ?? null);

      form.setFieldsValue({
        date: dateObj,
        customerAccountId: sheet.customerAccountId || undefined,
        vendorAccountId: sheet.vendorAccountId || undefined,
        cashAccountId: sheet.cashAccountId || undefined,
        reconciliationMode: sheet.reconciliationMode || 'DiscountAddLess',
        remarks: sheet.remarks || '',
      });

      setRows(
        (sheet.items || []).map(item => ({
          ...item,
          manualPurchased: item.purchasedQty > 0 && item.soldQty > 0,
        }))
      );

      setManualSaleTotal(
        sheet.enteredSaleAmount !== undefined && sheet.enteredSaleAmount !== null
          ? sheet.enteredSaleAmount
          : null
      );
      setManualPurchaseTotal(
        sheet.enteredPurchaseAmount !== undefined && sheet.enteredPurchaseAmount !== null
          ? sheet.enteredPurchaseAmount
          : null
      );
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to load stock closing sheet');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadSheetForDate(selectedDate);
  }, [selectedDate, loadSheetForDate]);

  const handleClosingQtyChange = (itemId: string, val: number | null) => {
    const closingQty = val ?? 0;
    setRows(prev =>
      prev.map(r => {
        if (r.itemId !== itemId) return r;
        if (r.manualPurchased) {
          const soldQty = Math.max(0, round(r.openingQty + r.purchasedQty - closingQty, 4));
          return { ...r, closingQty, soldQty };
        }
        const diff = round(closingQty - r.openingQty, 4);
        const purchasedQty = diff > 0 ? diff : 0;
        const soldQty = diff < 0 ? Math.abs(diff) : 0;
        return { ...r, closingQty, purchasedQty, soldQty };
      })
    );
  };

  const handlePurchasedQtyChange = (itemId: string, val: number | null) => {
    const purchasedQty = Math.max(0, val ?? 0);
    setRows(prev =>
      prev.map(r => {
        if (r.itemId !== itemId) return r;
        const soldQty = Math.max(0, round(r.openingQty + purchasedQty - r.closingQty, 4));
        return {
          ...r,
          purchasedQty,
          soldQty,
          manualPurchased: purchasedQty > 0,
        };
      })
    );
  };

  const handleRateChange = (itemId: string, field: 'purchaseRate' | 'saleRate', val: number | null) => {
    const rate = Math.max(0, val ?? 0);
    setRows(prev =>
      prev.map(r => (r.itemId === itemId ? { ...r, [field]: rate } : r))
    );
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (categoryFilter && r.categoryCode !== categoryFilter) return false;
      if (showChangedOnly && r.purchasedQty === 0 && r.soldQty === 0) return false;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchKey = r.itemKey?.toLowerCase().includes(q);
        const matchBarcode = r.barcode?.toLowerCase().includes(q);
        if (!matchTitle && !matchKey && !matchBarcode) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, showChangedOnly, searchText]);

  const calculatedPurchaseTotal = useMemo(
    () => round(rows.reduce((sum, r) => sum + round(r.purchasedQty * r.purchaseRate, 2), 0), 2),
    [rows]
  );

  const calculatedSaleTotal = useMemo(
    () => round(rows.reduce((sum, r) => sum + round(r.soldQty * r.saleRate, 2), 0), 2),
    [rows]
  );

  const effectivePurchaseTotal = manualPurchaseTotal !== null ? manualPurchaseTotal : calculatedPurchaseTotal;
  const effectiveSaleTotal = manualSaleTotal !== null ? manualSaleTotal : calculatedSaleTotal;

  const purchaseVariance = round(effectivePurchaseTotal - calculatedPurchaseTotal, 2);
  const saleDiscountVariance = round(calculatedSaleTotal - effectiveSaleTotal, 2);

  const focusClosingInputByIndex = (rowIdx: number) => {
    const el = document.querySelector<HTMLInputElement>(`.closing-qty-input-${rowIdx} input`);
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const changedLines = rows.filter(r => r.purchasedQty > 0 || r.soldQty > 0);

      if (changedLines.length === 0 && !isExisting) {
        message.warning('No stock changes detected. Enter closing stock counts or purchased quantities first.');
        return;
      }

      setSaving(true);
      const res = await dailyStockClosingService.save({
        date: selectedDate.format('YYYY-MM-DD'),
        customerAccountId: values.customerAccountId,
        vendorAccountId: values.vendorAccountId,
        cashAccountId: values.cashAccountId,
        reconciliationMode: 'DiscountAddLess',
        enteredSaleAmount: effectiveSaleTotal,
        enteredPurchaseAmount: effectivePurchaseTotal,
        remarks: values.remarks,
        lines: changedLines.map(l => ({
          itemId: l.itemId,
          openingQty: l.openingQty,
          closingQty: l.closingQty,
          purchasedQty: l.purchasedQty,
          soldQty: l.soldQty,
          purchaseRate: l.purchaseRate,
          saleRate: l.saleRate,
        })),
      });

      message.success(
        `Daily closing saved (${res.purchaseVoucherNo ? `PU-${res.purchaseVoucherNo}` : 'No Purchase'}, ${
          res.saleVoucherNo ? `SL-${res.saleVoucherNo}` : 'No Sale'
        })`
      );
      await loadSheetForDate(selectedDate);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to save daily stock closing');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await dailyStockClosingService.delete(selectedDate.format('YYYY-MM-DD'));
      message.success('Daily stock closing deleted');
      await loadSheetForDate(selectedDate);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to delete daily stock closing');
    } finally {
      setSaving(false);
    }
  };

  useFormShortcuts({
    onSave: handleSave,
  });

  const stockColumns = [
    {
      title: 'Product',
      key: 'title',
      width: 240,
      fixed: 'left' as const,
      render: (_: any, r: EditableStockRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.title}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.itemKey || r.itemId} {r.unitTitle ? `• ${r.unitTitle}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Opening Stock',
      dataIndex: 'openingQty',
      key: 'openingQty',
      width: 120,
      align: 'right' as const,
      render: (val: number) => <Tag>{val}</Tag>,
    },
    {
      title: 'Closing Stock (Count)',
      dataIndex: 'closingQty',
      key: 'closingQty',
      width: 155,
      render: (val: number, r: EditableStockRow, idx: number) => (
        <InputNumber
          className={`closing-qty-input-${idx}`}
          style={{ width: '100%' }}
          value={val}
          step={1}
          onChange={v => handleClosingQtyChange(r.itemId, v)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              focusClosingInputByIndex(idx + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              focusClosingInputByIndex(Math.max(0, idx - 1));
            }
          }}
        />
      ),
    },
    {
      title: 'Purchased Qty',
      dataIndex: 'purchasedQty',
      key: 'purchasedQty',
      width: 135,
      render: (val: number, r: EditableStockRow) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={val}
          onChange={v => handlePurchasedQtyChange(r.itemId, v)}
        />
      ),
    },
    {
      title: 'Sold Qty',
      dataIndex: 'soldQty',
      key: 'soldQty',
      width: 110,
      align: 'right' as const,
      render: (val: number) =>
        val > 0 ? <Tag color="green">-{val}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'Buy Rate',
      dataIndex: 'purchaseRate',
      key: 'purchaseRate',
      width: 125,
      render: (val: number, r: EditableStockRow) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={val}
          onChange={v => handleRateChange(r.itemId, 'purchaseRate', v)}
        />
      ),
    },
    {
      title: 'Sale Rate',
      dataIndex: 'saleRate',
      key: 'saleRate',
      width: 125,
      render: (val: number, r: EditableStockRow) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={val}
          onChange={v => handleRateChange(r.itemId, 'saleRate', v)}
        />
      ),
    },
    {
      title: 'Calc. Buying',
      key: 'calcBuyAmt',
      width: 125,
      align: 'right' as const,
      render: (_: any, r: EditableStockRow) => {
        const amt = round(r.purchasedQty * r.purchaseRate, 2);
        return amt > 0 ? <Text strong>{amt.toLocaleString()}</Text> : <Text type="secondary">0.00</Text>;
      },
    },
    {
      title: 'Calc. Sale',
      key: 'calcSaleAmt',
      width: 125,
      align: 'right' as const,
      render: (_: any, r: EditableStockRow) => {
        const amt = round(r.soldQty * r.saleRate, 2);
        return amt > 0 ? <Text strong>{amt.toLocaleString()}</Text> : <Text type="secondary">0.00</Text>;
      },
    },
  ];

  const changedItemsCount = rows.filter(r => r.purchasedQty > 0 || r.soldQty > 0).length;

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/daily-entries/daily-stock-closing')}
            type="text"
          />
          <ReconciliationOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isExisting
                ? `Edit Daily Closing: ${selectedDate.format('DD-MMM-YYYY')}`
                : 'Daily Stock & Cash Closing'}
            </Title>
            <Text type="secondary">
              {isExisting
                ? 'Modify recorded physical stock count and daily summary totals'
                : 'Enter day-end closing stock counts and summary totals'}
            </Text>
          </div>
          {isExisting && (
            <Tag icon={<CheckCircleOutlined />} color="processing">
              {purchaseVoucherNo ? `PU-${purchaseVoucherNo}` : 'No PU'} /{' '}
              {saleVoucherNo ? `SL-${saleVoucherNo}` : 'No SL'}
            </Tag>
          )}
        </Space>
        <Space>
          {isExisting && (
            <Popconfirm
              title="Delete this daily stock closing?"
              description="This will remove the linked Purchase and Sale vouchers for this date."
              onConfirm={handleDelete}
            >
              <Button danger icon={<DeleteOutlined />} loading={saving}>
                Delete
              </Button>
            </Popconfirm>
          )}
          <Button
            icon={<SyncOutlined />}
            onClick={() => loadSheetForDate(selectedDate)}
            loading={loading}
          >
            Reload Sheet
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            data-action="save"
            className="pos-save-btn form-save-btn"
            loading={saving}
            onClick={handleSave}
            style={{
              backgroundColor: '#0ea5e9',
              borderColor: '#0ea5e9',
              height: 38,
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)',
            }}
          >
            {isExisting ? 'Update Closing (Alt+S)' : 'Save Closing (Alt+S)'}
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={12} md={5}>
            <Form.Item label="Closing Date" name="date" rules={[{ required: true }]}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD-MMM-YYYY"
                allowClear={false}
                onChange={d => {
                  if (d) setSelectedDate(d);
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Default Walk-In Customer"
              name="customerAccountId"
              rules={[{ required: true, message: 'Select default customer' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select Walk-In Customer"
                options={customers.map(c => ({ value: c.account, label: `${c.title} (${c.account})` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Default Supplier"
              name="vendorAccountId"
              rules={[{ required: true, message: 'Select default vendor' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select Default Supplier"
                options={vendors.map(v => ({ value: v.account, label: `${v.title} (${v.account})` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Form.Item label="Cash / Bank Account" name="cashAccountId">
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="Default Cash Account"
                options={cashBanks.map(b => ({ value: b.account, label: `${b.title} (${b.account})` }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Category Filter">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="All Categories"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map(c => ({ value: c.code, label: c.title }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Search Product">
              <Input
                allowClear
                prefix={<FilterOutlined />}
                placeholder="Search by title, code, or barcode..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Form.Item label="Description / Notes" name="remarks">
              <Input placeholder="Optional daily closing notes..." />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Form.Item label="Filter Changed">
              <Space>
                <Switch checked={showChangedOnly} onChange={setShowChangedOnly} />
                <Text>Changed Items Only ({changedItemsCount})</Text>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <Text strong id="daily-stock-closing-table-caption" style={{ fontSize: 16 }}>
              Physical Stock Count Sheet ({filteredRows.length} items)
            </Text>
          </Space>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="daily-stock-closing-table-caption"
          style={{
            overflow: 'auto',
            maxInlineSize: '100%',
            containerType: 'inline-size',
          }}
        >
          <Table
            rowKey="itemId"
            loading={loading}
            columns={stockColumns}
            dataSource={filteredRows}
            size="small"
            bordered
            scroll={{ x: 1150, y: 420 }}
            pagination={false}
          />
        </div>

        <KeyboardShortcutsBar
          shortcuts={[
            { key: 'Alt+S / F5', label: 'Save Closing' },
            { key: 'Enter / ↓', label: 'Next Item Count' },
            { key: '↑', label: 'Previous Item Count' },
          ]}
        />

        <div
          style={{
            marginTop: 16,
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <Row gutter={24} align="middle">
            {/* Left Side: Daily Sales Summary */}
            <Col xs={24} lg={12}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <Text type="secondary">Calculated Sale Total</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    Rs. {calculatedSaleTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Title>
                  {saleDiscountVariance !== 0 && (
                    <Text type="warning" style={{ fontSize: 12, fontWeight: 600 }}>
                      Discount / Variance: Rs. {saleDiscountVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>Actual Sale Total (Cash Received)</Text>
                    {manualSaleTotal !== null && (
                      <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setManualSaleTotal(null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                  <InputNumber
                    size="large"
                    style={{ width: '100%', marginTop: 4, fontWeight: 700 }}
                    min={0}
                    value={effectiveSaleTotal}
                    onChange={v => setManualSaleTotal(v)}
                  />
                </div>
              </div>
            </Col>

            {/* Right Side: Daily Buying Summary */}
            <Col xs={24} lg={12}>
              <Divider type="vertical" style={{ display: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <Text type="secondary">Calculated Buying Total</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    Rs. {calculatedPurchaseTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Title>
                  {purchaseVariance !== 0 && (
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#0ea5e9' }}>
                      Add / Less Variance: Rs. {purchaseVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>Actual Buying Total (Cash Paid)</Text>
                    {manualPurchaseTotal !== null && (
                      <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => setManualPurchaseTotal(null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                  <InputNumber
                    size="large"
                    style={{ width: '100%', marginTop: 4, fontWeight: 700 }}
                    min={0}
                    value={effectivePurchaseTotal}
                    onChange={v => setManualPurchaseTotal(v)}
                  />
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </Form>
    </Card>
  );
};
