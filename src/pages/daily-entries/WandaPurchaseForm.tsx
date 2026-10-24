import useFormShortcuts from '../../hooks/useFormShortcuts';
import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  ShoppingCartOutlined, UserOutlined, FileTextOutlined, CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { purchaseService } from '../../services/purchaseService';
import { inventoryService, type Item } from '../../services/inventoryService';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, type NarrationDto } from '../../services/narrationService';
import { round } from '../../utils/numberUtils';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';

const { Title, Text } = Typography;


interface ItemSelectCellProps {
  rowIdx: number;
  record: any;
  value: string;
  items: Array<{ id: string | number; title: string }>;
  getCellRef: (rowIdx: number, colKey: string) => React.RefObject<any>;
  handleCellKeyDown: (rowIdx: number, colKey: string, e: React.KeyboardEvent) => void;
  updateRow: (key: number, field: string, val: any) => void;
  focusCell: (rowIdx: number, colKey: string) => void;
}

const ItemSelectCell: React.FC<ItemSelectCellProps> = ({
  rowIdx,
  record,
  value,
  items,
  getCellRef,
  handleCellKeyDown,
  updateRow,
  focusCell
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Select
      ref={getCellRef(rowIdx, 'itemId')}
      className={`grid-select-itemId grid-select-row-${rowIdx}`}
      showSearch
      open={open}
      onOpenChange={setOpen}
      style={{ width: '100%' }}
      placeholder="Select Item"
      optionFilterProp="children"
      value={value}
      onSelect={(val) => {
        setOpen(false);
        updateRow(record.key, 'itemId', val);
        focusCell(rowIdx, 'qty');
      }}
      onChange={(val) => {
        updateRow(record.key, 'itemId', val);
        setOpen(false);
      }}
      onBlur={() => {
        setOpen(false);
      }}
      filterOption={(input, option) =>
        (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
      }
      options={items.map(i => ({ value: i.id, label: `${i.title} (${i.id})` }))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (open) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);

          if (record.itemId) {
            focusCell(rowIdx, 'qty');
          } else {
            const cashPaidInput = document.querySelector('.purchase-cash-paid input') as HTMLInputElement;
            if (cashPaidInput) {
              cashPaidInput.focus();
              cashPaidInput.select();
            }
          }
          return;
        }

        if (e.key === 'Tab') {
          setOpen(false);
          if (!record.itemId) {
            e.preventDefault();
            const cashPaidInput = document.querySelector('.purchase-cash-paid input') as HTMLInputElement;
            if (cashPaidInput) {
              cashPaidInput.focus();
              cashPaidInput.select();
            }
          }
          return;
        }

        handleCellKeyDown(rowIdx, 'itemId', e);
      }}
    />
  );
};

export const WandaPurchaseForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [purchaseLines, setPurchaseLines] = useState<any[]>([]);

  const isEdit = !!voucherNo && voucherNo !== 'new' && voucherNo !== '[object Object]';

  // Keyboard navigation refs
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const datePickerRef = useRef<any>(null);
  const vendorSelectRef = useRef<any>(null);
  const narrationSelectRef = useRef<any>(null);

  const addRow = useCallback(() => {
    setPurchaseLines(prev => {
      const maxSeq = prev.reduce((max, row) => Math.max(max, row.seq || 0), 0);
      return [
        ...prev,
        {
          key: Date.now(),
          seq: maxSeq + 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0,
          packQty: 0,
          packing: 0
        }
      ];
    });
  }, []);

  const enterCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing'];
  const arrowCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing', 'rate', 'secRate', 'addLess'];

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: purchaseLines.length,
    enterCols,
    arrowCols,
    firstColKey: 'itemId',
    onAddRow: addRow,
    pendingFocusRef,
    isRowValid: (idx) => !!purchaseLines[idx]?.itemId,
    onSave: () => handleSave(),
  });

  const handleNew = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), cashPaid: 0, cashBack: 0 });
    setPurchaseLines([{
      key: Date.now(),
      seq: 1,
      itemId: undefined,
      unit: undefined,
      qty: 1,
      rate: 0,
      addLess: 0,
      amount: 0,
      secQty: 0,
      secRate: 0,
      packQty: 0,
      packing: 0
    }]);
    setTimeout(() => datePickerRef.current?.focus(), 50);
  }, [form]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, vendorsRes, narrsRes] = await Promise.all([
          inventoryService.getItemsLookup(undefined, true),
          chartOfAccountService.getDetailAccounts(),
          narrationService.getActiveNarrationsLookup()
        ]);
        setItems(itemsRes);
        setVendors(vendorsRes);
        setNarrations(narrsRes);
      } catch {
        message.error('Failed to load lookups');
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    if (isEdit) {
      const loadPurchase = async () => {
        try {
          setLoading(true);
          const details = await purchaseService.getDetail(voucherNo!);
          if (details && details.length > 0) {
            const first = details[0];
            form.setFieldsValue({
              date: dayjs(first.date),
              account: first.accountId,
              narration: first.narrationId,
              description: first.description,
              cashPaid: (first as any).cashPaid ?? 0,
              cashBack: (first as any).cashBack ?? 0
            });
            setPurchaseLines(details.map((d, i) => ({
              key: i,
              seq: d.seq,
              itemId: d.itemId,
              unit: d.unit,
              qty: d.qty,
              rate: d.rate,
              addLess: d.addLess,
              amount: (d.qty * d.rate) + (d.addLess || 0),
              secQty: d.secQty,
              secRate: d.secRate,
              secUnit: d.secUnit,
              packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
              packing: (d as any).packing || 0
            })));
          }
        } catch {
          message.error('Failed to load purchase details');
          navigate('/daily-entries/purchase');
        } finally {
          setLoading(false);
        }
      };
      loadPurchase();
    } else {
      const copyFrom = (location.state as any)?.copyFrom;
      if (copyFrom) {
        form.setFieldsValue({
          date: dayjs(),
          account: copyFrom.account,
          narration: copyFrom.narration,
          description: copyFrom.description,
          cashPaid: copyFrom.cashPaid,
          cashBack: copyFrom.cashBack
        });
        const initialLines = (copyFrom.lines || []).map((l: any, idx: number) => ({
          ...l,
          key: Date.now() + idx,
          seq: idx + 1,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          secUnit: l.secUnit || null,
          packQty: l.packQty || 0,
          packing: l.packing || 0
        }));
        setPurchaseLines(initialLines.length > 0 ? initialLines : [{
          key: Date.now(),
          seq: 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0,
          packQty: 0,
          packing: 0
        }]);
      } else {
        form.setFieldsValue({ date: dayjs() });
        setPurchaseLines([{
          key: Date.now(),
          seq: 1,
          itemId: undefined,
          unit: undefined,
          qty: 1,
          rate: 0,
          addLess: 0,
          amount: 0,
          secQty: 0,
          secRate: 0,
          packQty: 0,
          packing: 0
        }]);
      }
    }
  }, [isEdit, voucherNo, form, navigate, location.state]);

  const removeRow = async (record: any) => {
    if (isEdit && record.seq) {
      try {
        await purchaseService.deleteLine(voucherNo!, record.seq);
        message.success('Row deleted from database');
      } catch {
        message.error('Failed to delete row from database');
        return;
      }
    }
    setPurchaseLines(purchaseLines.filter(row => row.key !== record.key));
  };

  const updateRow = (key: any, field: string, value: any) => {
    setPurchaseLines(purchaseLines.map(row => {
      if (row.key === key) {
        const updated = { ...row, [field]: value };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (field === 'itemId') {
          const item = items.find(i => String(i.id) === String(value));
          if (item) {
            updated.unit = item.defaultUnit || item.primaryUnit || '';
            updated.rate = item.lastPurchaseRate ?? item.costRate ?? 0;
            updated.secUnit = item.secondaryUnit || '';
            const pSize = Number(item.qtyInPack || (item as any)?.QtyInPack || (item as any)?.qty_in_pack || 0);
            updated.secRate = item.lastPurchaseSecRate ?? item.secCostRate ?? ((updated.rate || 0) * (pSize > 0 ? pSize : 1));
            updated.packQty = pSize;
            updated.packing = (item as any)?.packing || 0;
          }
        }

        if (field === 'secQty') {
          const sQty = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          if (pQty > 0 || pck > 0) {
            updated.qty = round(sQty * (pQty + pck), 2);
          }
        }

        if (field === 'packQty' || field === 'packing') {
          const sQty = Number(updated.secQty) || 0;
          const pQty = field === 'packQty' ? numVal : (Number(updated.packQty) || 0);
          const pck = field === 'packing' ? numVal : (Number(updated.packing) || 0);
          if (sQty > 0) {
            updated.qty = round(sQty * (pQty + pck), 2);
          }
        }

        if (field === 'rate') {
          const r = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const totalPack = pQty + pck;
          if (totalPack > 0) {
            updated.secRate = round(r * totalPack, 2);
          }
        }

        if (field === 'secRate') {
          const sr = numVal;
          const pQty = Number(updated.packQty) || 0;
          const pck = Number(updated.packing) || 0;
          const totalPack = pQty + pck;
          if (totalPack > 0) {
            updated.rate = round(sr / totalPack, 4);
          }
        }

        const qty = Number(updated.qty) || 0;
        const rate = Number(updated.rate) || 0;
        const addLess = Number(updated.addLess) || 0;
        updated.amount = round((qty * rate) + addLess, 2);

        return updated;
      }
      return row;
    }));
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await purchaseService.delete(voucherNo!);
      message.success('Purchase deleted successfully');
      navigate('/daily-entries/purchase');
    } catch {
      message.error('Failed to delete purchase');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = purchaseLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const cashPaid = Form.useWatch('cashPaid', form) || 0;
  const cashBack = Form.useWatch('cashBack', form) || 0;
  const balance = totalAmount - cashPaid + cashBack;

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({ cashPaid: totalAmount, cashBack: 0 });
    }
  }, [totalAmount, isEdit, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const validLines = purchaseLines.filter(l => l.itemId && l.qty > 0);

      if (validLines.length === 0) {
        message.error('Please add at least one valid item');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        cashPaid: values.cashPaid || 0,
        cashBack: values.cashBack || 0,
        lines: validLines.map(l => ({
          seq: l.seq,
          itemId: l.itemId,
          unit: l.unit || null,
          qty: l.qty,
          rate: l.rate,
          addLess: l.addLess || 0,
          secUnit: l.secUnit || null,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          qtyInPack: l.packQty || 0,
          packing: l.packing || 0
        }))
      };

      if (isEdit) {
        await purchaseService.update(voucherNo!, request);
        message.success('Purchase updated successfully');
      } else {
        const res = await purchaseService.create(request);
        const newVNo = (typeof res === 'object' && res !== null) ? ((res as any).body || (res as any).voucherNo || String(res)) : String(res);
        message.success('Purchase created successfully');
        navigate(`/daily-entries/purchase/${newVNo}`);
      }
    } catch {
      message.error('Failed to save purchase');
    } finally {
      setLoading(false);
    }
  };

  // Form shortcut keys
  useFormShortcuts({
    onNew: handleNew,
    onFocusSearch: () => vendorSelectRef.current?.focus(),
    onSave: handleSave,
    onAddRow: () => {
      pendingFocusRef.current = { rowIdx: purchaseLines.length, colKey: 'itemId' };
      addRow();
    },
  });

  const handleDatePickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => vendorSelectRef.current?.focus(), 50);
    }
  };

  const handleVendorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => narrationSelectRef.current?.focus(), 50);
    }
  };

  const handleNarrationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => focusCell(0, 'itemId'), 50);
    }
  };

  const columns = [
    {
      title: 'Seq',
      dataIndex: 'seq',
      width: 60,
    },
    {
      title: 'Item Description',
      dataIndex: 'itemId',
      render: (text: string, record: any, rowIdx: number) => (
        <ItemSelectCell
          rowIdx={rowIdx}
          record={record}
          value={text}
          items={items}
          getCellRef={getCellRef}
          handleCellKeyDown={handleCellKeyDown}
          updateRow={updateRow}
          focusCell={focusCell}
        />
      )
    },
    {
      title: 'Qty (Kg)',
      dataIndex: 'qty',
      width: 110,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'qty')}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'qty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Bag Qty',
      dataIndex: 'secQty',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'secQty')}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'secQty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Pack Qty',
      dataIndex: 'packQty',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packQty')}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'packQty', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packQty', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Packing',
      dataIndex: 'packing',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packing')}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'packing', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packing', e)}
          min={0}
          precision={2}
        />
      )
    },
    {
      title: 'Rate (/Kg)',
      dataIndex: 'rate',
      width: 120,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'rate')}
          tabIndex={-1}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'rate', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'rate', e)}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
        />
      )
    },
    {
      title: 'Bag Rate',
      dataIndex: 'secRate',
      width: 120,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'secRate')}
          tabIndex={-1}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'secRate', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secRate', e)}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
        />
      )
    },
    {
      title: 'Add/Less',
      dataIndex: 'addLess',
      width: 100,
      render: (text: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'addLess')}
          value={text}
          style={{ width: '100%' }}
          onFocus={(e) => {
            const input = e.target as HTMLInputElement;
            input?.select?.();
            setTimeout(() => input?.select?.(), 20);
          }}
          controls={false}
          keyboard={false}
          onChange={(val) => updateRow(record.key, 'addLess', val)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'addLess', e)}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 150,
      align: 'right' as const,
      render: (text: number) => <Text strong>{text.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      width: 60,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => removeRow(record)} 
          disabled={purchaseLines.length === 1} 
        />
      )
    }
  ];

  return (
    <div tabIndex={-1} style={{ outline: 'none' }}>
      <Card className="shadow-sm border-gray-100 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <Space align="center">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/purchase')} type="text" />
            <ShoppingCartOutlined style={{ fontSize: 24, color: '#16a34a' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit ? `Edit Purchase: PU-${voucherNo}` : 'New Purchase'}
              </Title>
              <Text type="secondary">{isEdit ? 'Modify existing purchase record' : 'Record a new inventory purchase'}</Text>
            </div>
          </Space>
          <Space>
            {isEdit && (
              <Popconfirm title="Delete this purchase?" onConfirm={handleDelete}>
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            )}
            {isEdit && (
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  const values = form.getFieldsValue();
                  navigate('/daily-entries/purchase/new', {
                    state: {
                      copyFrom: {
                        account: values.account,
                        narration: values.narration,
                        description: values.description,
                        cashPaid: values.cashPaid,
                        cashBack: values.cashBack,
                        lines: purchaseLines
                      }
                    }
                  });
                }}
              >
                Copy as New
              </Button>
            )}
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              data-action="save" className="purchase-save-btn form-save-btn" onClick={handleSave} 
              loading={loading}
              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            >
              Save Purchase (F5)
            </Button>
          </Space>
        </div>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8} lg={4}>
              <Form.Item label="Voucher #">
                <Input value={isEdit ? `PU-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
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
            <Col xs={24} sm={8} lg={8}>
              <Form.Item label="Vendor / Supplier" name="account" rules={[{ required: true }]}>
                <Select
                  ref={vendorSelectRef}
                  showSearch
                  placeholder="Select Vendor"
                  prefix={<UserOutlined />}
                  optionFilterProp="children"
                  onKeyDown={handleVendorKeyDown}
                >
                  {vendors.map(v => (
                    <Select.Option key={v.account} value={v.account}>{v.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <Form.Item label="Narration" name="narration">
                <Select
                  ref={narrationSelectRef}
                  showSearch
                  placeholder="Select narration"
                  prefix={<FileTextOutlined />}
                  allowClear
                  onKeyDown={handleNarrationKeyDown}
                >
                  {narrations.map(n => (
                    <Select.Option key={n.code} value={n.code}>{n.title}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={24}>
              <Form.Item label="Description" name="description">
                <Input placeholder="Additional purchase details..." />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-between items-center mb-4 mt-2">
            <Title level={5} style={{ margin: 0 }}>Purchase Items</Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRow}>Add Row (Ins)</Button>
          </div>

          <Table
            dataSource={purchaseLines}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            className="mb-4"
            summary={pageData => {
              let totalQty = 0;
              let totalSecQty = 0;
              let totalAmount = 0;
              pageData.forEach(({ qty, secQty, amount }) => {
                totalQty += qty || 0;
                totalSecQty += secQty || 0;
                totalAmount += amount || 0;
              });
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2} align="right"><b>Totals</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}><b>{totalQty.toLocaleString(undefined, { minimumFractionDigits: 2 })} Kg</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={2}><b>{totalSecQty.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bags</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={4} align="right"><b>Net Total</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong style={{ color: '#16a34a' }}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New' }, { key: 'F2', label: 'Vendor' }, { key: 'F5', label: 'Save' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Row gutter={24} align="bottom">
              <Col xs={24} sm={8} lg={6}>
                <Form.Item label="Cash Paid" name="cashPaid">
                  <InputNumber
                    className="purchase-cash-paid"
                    style={{ width: '100%' }}
                    onFocus={(e) => {
                      const input = e.target as HTMLInputElement;
                      input?.select?.();
                      setTimeout(() => input?.select?.(), 20);
                    }}
                    size="large"
                    min={0}
                    controls={false}
                    keyboard={false}
                    placeholder="0.00"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8} lg={6}>
                <Form.Item label="Cash Back" name="cashBack">
                  <InputNumber
                    className="purchase-cash-back"
                    style={{ width: '100%' }}
                    size="large"
                    min={0}
                    controls={false}
                    keyboard={false}
                    placeholder="0.00"
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        const saveBtn = document.querySelector('.purchase-save-btn') as HTMLButtonElement;
                        if (saveBtn) {
                          saveBtn.focus();
                        }
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8} lg={12}>
                <div className="text-right pb-6">
                  <Text type="secondary" className="uppercase text-xs tracking-widest block mb-1">Net Balance</Text>
                  <div className="flex items-center justify-end gap-3">
                    <Tag color={balance > 0 ? 'red' : balance < 0 ? 'green' : 'blue'} className="px-3 py-0.5 rounded-full border-none font-bold uppercase text-[10px]">
                      {balance > 0 ? 'Payable' : balance < 0 ? 'Change' : 'Settled'}
                    </Tag>
                    <div className={`text-4xl font-bold tracking-tight ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      <span className="text-xl mr-1 font-medium opacity-50">Rs.</span>
                      {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </Form>
      </Card>
    </div>
  );
};
