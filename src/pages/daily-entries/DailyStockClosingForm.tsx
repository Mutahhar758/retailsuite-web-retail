import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Tag, Switch, Statistic
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, SyncOutlined, CheckCircleOutlined, FilterOutlined
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
        reconciliationMode: values.reconciliationMode || 'DiscountAddLess',
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/daily-stock-closing')}>
            Back to List
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Daily Stock &amp; Cash Closing
          </Title>
          {isExisting && (
            <Tag icon={<CheckCircleOutlined />} color="processing">
              Existing Closing ({purchaseVoucherNo ? `PU-${purchaseVoucherNo}` : 'No PU'} /{' '}
              {saleVoucherNo ? `SL-${saleVoucherNo}` : 'No SL'})
            </Tag>
          )}
        </Space>
        <Space>
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
            loading={saving}
            onClick={handleSave}
          >
            {isExisting ? 'Update Daily Closing' : 'Post Daily Closing'}
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={4}>
              <Form.Item label="Closing Date" name="date" rules={[{ required: true }]}>
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  allowClear={false}
                  onChange={d => {
                    if (d) setSelectedDate(d);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
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
            <Col xs={24} sm={12} md={5}>
              <Form.Item
                label="Default Cash Supplier"
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
            <Col xs={24} sm={12} md={5}>
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
            <Col xs={24} sm={12} md={5}>
              <Form.Item label="Amount Reconciliation Mode" name="reconciliationMode">
                <Select
                  options={[
                    { value: 'DiscountAddLess', label: 'Adjust Discount / Add-Less (Keep Rates)' },
                    { value: 'ProRate', label: 'Pro-Rate Item Unit Rates' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16} align="middle">
            <Col xs={24} md={6}>
              <Form.Item label="Category Filter" style={{ marginBottom: 0 }}>
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
            <Col xs={24} md={6}>
              <Form.Item label="Search Product" style={{ marginBottom: 0 }}>
                <Input
                  allowClear
                  prefix={<FilterOutlined />}
                  placeholder="Search by title, code, or barcode..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Remarks / Notes" name="remarks" style={{ marginBottom: 0 }}>
                <Input placeholder="Optional daily closing notes..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={6} style={{ paddingTop: 22 }}>
              <Space>
                <Switch checked={showChangedOnly} onChange={setShowChangedOnly} />
                <Text>Show Only Changed Items</Text>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={
          <span id="daily-stock-closing-table-caption">
            Physical Stock Count Sheet ({filteredRows.length} items)
          </span>
        }
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 0 } }}
      >
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
            scroll={{ x: 1150, y: 460 }}
            pagination={false}
          />
        </div>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Daily Sales Summary" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Statistic
                  title="Calculated Sale Total"
                  value={calculatedSaleTotal}
                  precision={2}
                />
              </Col>
              <Col span={9}>
                <Text strong>Actual Total Sale Amount</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  min={0}
                  value={effectiveSaleTotal}
                  onChange={v => setManualSaleTotal(v)}
                />
              </Col>
              <Col span={7}>
                <Statistic
                  title="Discount / Variance"
                  value={saleDiscountVariance}
                  precision={2}
                  valueStyle={{ color: saleDiscountVariance !== 0 ? '#d46b08' : undefined, fontSize: 16 }}
                />
                {manualSaleTotal !== null && (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setManualSaleTotal(null)}>
                    Reset to Calculated
                  </Button>
                )}
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Daily Buying Summary" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Statistic
                  title="Calculated Buying Total"
                  value={calculatedPurchaseTotal}
                  precision={2}
                />
              </Col>
              <Col span={9}>
                <Text strong>Actual Total Buying Amount</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 4 }}
                  min={0}
                  value={effectivePurchaseTotal}
                  onChange={v => setManualPurchaseTotal(v)}
                />
              </Col>
              <Col span={7}>
                <Statistic
                  title="Add / Less Variance"
                  value={purchaseVariance}
                  precision={2}
                  valueStyle={{ color: purchaseVariance !== 0 ? '#1677ff' : undefined, fontSize: 16 }}
                />
                {manualPurchaseTotal !== null && (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setManualPurchaseTotal(null)}>
                    Reset to Calculated
                  </Button>
                )}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
