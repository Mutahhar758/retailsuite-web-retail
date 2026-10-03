import React, { useState, useEffect, useRef } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag, Alert, Modal
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  RocketOutlined, UserOutlined, FileTextOutlined, WifiOutlined, DisconnectOutlined,
  CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import type { NarrationDto } from '../../services/narrationService';
import type { Item } from '../../services/inventoryService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { round } from '../../utils/numberUtils';

const { Title, Text } = Typography;

interface SaleTab {
  id: string;
  name: string;
  account: string | null;
  narration: string | null;
  description: string;
  cashReceipt: number;
  cashBack: number;
  date: any;
  saleLines: any[];
}

export const WandaSaleForm: React.FC = () => {
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetworkStatus();

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [saleLines, setSaleLines] = useState<any[]>([]);
  const [cacheMissError, setCacheMissError] = useState<string | null>(null);
  const prevTotalAmountRef = useRef(0);

  // Multi-tab state management for rapid checkout drafts
  const [tabs, setTabs] = useState<SaleTab[]>(() => {
    const initialId = Date.now().toString();
    return [{
      id: initialId,
      name: 'Tab 1',
      account: null,
      narration: null,
      description: '',
      cashReceipt: 0,
      cashBack: 0,
      date: dayjs(),
      saleLines: [{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]
    }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  // Sync saleLines to current active tab state whenever saleLines updates
  useEffect(() => {
    if (activeTabId && !isEdit) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return { ...t, saleLines };
        }
        return t;
      }));
    }
  }, [saleLines, activeTabId, isEdit]);

  const handleFormValuesChange = (_: any, allValues: any) => {
    if (isEdit) return;
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          account: allValues.account || null,
          narration: allValues.narration || null,
          description: allValues.description || '',
          cashReceipt: allValues.cashReceipt || 0,
          cashBack: allValues.cashBack || 0,
          date: allValues.date || dayjs()
        };
      }
      return t;
    }));
  };

  const handleSwitchTab = (targetId: string) => {
    if (targetId === activeTabId) return;

    const currentValues = form.getFieldsValue();
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          account: currentValues.account || null,
          narration: currentValues.narration || null,
          description: currentValues.description || '',
          cashReceipt: currentValues.cashReceipt || 0,
          cashBack: currentValues.cashBack || 0,
          date: currentValues.date || dayjs(),
          saleLines: saleLines
        };
      }
      return t;
    }));

    setActiveTabId(targetId);

    const targetTab = tabs.find(t => t.id === targetId);
    if (targetTab) {
      form.setFieldsValue({
        date: targetTab.date,
        account: targetTab.account,
        narration: targetTab.narration,
        description: targetTab.description,
        cashReceipt: targetTab.cashReceipt,
        cashBack: targetTab.cashBack
      });
      setSaleLines(targetTab.saleLines);
      focusCustomerSelect();
    }
  };

  const handleAddTab = () => {
    const currentValues = form.getFieldsValue();
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          account: currentValues.account || null,
          narration: currentValues.narration || null,
          description: currentValues.description || '',
          cashReceipt: currentValues.cashReceipt || 0,
          cashBack: currentValues.cashBack || 0,
          date: currentValues.date || dayjs(),
          saleLines: saleLines
        };
      }
      return t;
    }));

    const nextNum = tabs.length > 0 ? Math.max(...tabs.map(t => {
      const match = t.name.match(/Tab\s+(\d+)/);
      return match ? parseInt(match[1]) : 0;
    })) + 1 : 1;

    const newTabId = Date.now().toString();
    const newTab: SaleTab = {
      id: newTabId,
      name: `Tab ${nextNum}`,
      account: null,
      narration: null,
      description: '',
      cashReceipt: 0,
      cashBack: 0,
      date: dayjs(),
      saleLines: [{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);

    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setSaleLines(newTab.saleLines);
    message.success(`Created Tab ${nextNum}`);
    focusCustomerSelect();
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetTab = tabs.find(t => t.id === id);
    if (!targetTab) return;

    if (tabs.length === 1) {
      message.warning("At least one tab must remain open");
      return;
    }

    const performClose = () => {
      const tabToCloseIndex = tabs.findIndex(t => t.id === id);
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);

      if (activeTabId === id) {
        const nextActiveIndex = Math.min(tabToCloseIndex, newTabs.length - 1);
        const nextTab = newTabs[nextActiveIndex];
        setActiveTabId(nextTab.id);

        form.setFieldsValue({
          date: nextTab.date,
          account: nextTab.account,
          narration: nextTab.narration,
          description: nextTab.description,
          cashReceipt: nextTab.cashReceipt,
          cashBack: nextTab.cashBack
        });
        setSaleLines(nextTab.saleLines);
      }
      message.info(`Closed ${targetTab.name}`);
    };

    const hasItems = targetTab.saleLines.some(l => l.itemId && (l.qty > 0 || l.rate > 0));
    if (hasItems) {
      Modal.confirm({
        title: 'Discard Draft Sale?',
        content: `"${targetTab.name}" has details filled. Are you sure you want to discard this draft?`,
        okText: 'Yes, Discard',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk() {
          performClose();
        }
      });
    } else {
      performClose();
    }
  };

  const handleCloseActiveTabAfterSave = () => {
    const tabToCloseId = activeTabId;
    if (tabs.length === 1) {
      form.resetFields();
      form.setFieldsValue({ date: dayjs() });
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
      focusCustomerSelect();
    } else {
      const tabToCloseIndex = tabs.findIndex(t => t.id === tabToCloseId);
      const newTabs = tabs.filter(t => t.id !== tabToCloseId);
      setTabs(newTabs);

      const nextActiveIndex = Math.min(tabToCloseIndex, newTabs.length - 1);
      const nextTab = newTabs[nextActiveIndex];
      setActiveTabId(nextTab.id);

      form.setFieldsValue({
        date: nextTab.date,
        account: nextTab.account,
        narration: nextTab.narration,
        description: nextTab.description,
        cashReceipt: nextTab.cashReceipt,
        cashBack: nextTab.cashBack
      });
      setSaleLines(nextTab.saleLines);
      message.info("Closed completed sale tab");
      focusCustomerSelect();
    }
  };

  const focusCustomerSelect = () => {
    setTimeout(() => {
      const customerInput = document.querySelector('.pos-customer-select .ant-select-selection-search-input') as HTMLInputElement;
      if (customerInput) {
        customerInput.focus();
        customerInput.select();
      }
    }, 20);
  };

  useEffect(() => {
    loadReferenceData();

    if (isEdit) {
      fetchDetail();
    } else {
      const copyFrom = (location.state as any)?.copyFrom;
      if (copyFrom) {
        form.setFieldsValue({
          date: dayjs(),
          account: copyFrom.account,
          narration: copyFrom.narration,
          description: copyFrom.description,
          cashReceipt: copyFrom.cashReceipt,
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
        setSaleLines(initialLines.length > 0 ? initialLines : [{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
        setTabs(prev => prev.map((t, idx) => idx === 0 ? {
          ...t,
          account: copyFrom.account,
          narration: copyFrom.narration,
          description: copyFrom.description,
          cashReceipt: copyFrom.cashReceipt,
          cashBack: copyFrom.cashBack,
          date: dayjs(),
          saleLines: initialLines.length > 0 ? initialLines : t.saleLines
        } : t));
      } else {
        setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
        form.setFieldsValue({ date: dayjs() });
      }
    }
    focusCustomerSelect();
  }, [isEdit, voucherNo, location.state]);

  const loadReferenceData = async () => {
    try {
      const [customers, narrations, items] = await Promise.all([
        offlineCacheService.getCustomers(),
        offlineCacheService.getNarrations(),
        offlineCacheService.getItems(),
      ]);
      setCustomers(customers);
      setNarrations(narrations);
      setItems(items);
      setCacheMissError(null);
      focusCustomerSelect();
    } catch (err) {
      if (err instanceof OfflineCacheMissError) {
        setCacheMissError(err.message);
      } else {
        message.error('Failed to load reference data');
      }
    }
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        form.setFieldsValue({
          date: dayjs(first.date),
          account: first.accountId,
          narration: first.narrationId,
          description: first.description,
          cashReceipt: first.cashReceipt,
          cashBack: first.cashBack
        });

        setSaleLines(details.map(d => ({
          ...d,
          key: d.seq,
          rate: d.rate,
          discount: d.discount,
          amount: d.qty * (d.rate - (d.discount || 0)),
          secUnit: d.secUnit,
          secQty: d.secQty,
          secRate: d.secRate,
          packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
          packing: (d as any).packing || 0
        })));
      }
    } catch {
      message.error('Failed to fetch sale details');
    } finally {
      setLoading(false);
    }
  };

  const focusLastRowSelect = () => {
    setTimeout(() => {
      const selectInputs = document.querySelectorAll('.ant-select-selection-search-input');
      if (selectInputs.length > 0) {
        const lastInput = selectInputs[selectInputs.length - 1] as HTMLInputElement;
        if (lastInput) {
          lastInput.focus();
          lastInput.click();
        }
      }
    }, 100);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          handleSwitchTab(tabs[tabIndex].id);
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
        return;
      }

      if (e.altKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'q')) {
        e.preventDefault();
        handleCloseTab(activeTabId, e as any);
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 's') || e.key === 'F8') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleAddRow();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabs, activeTabId, saleLines, items, form]);

  const handleAddRow = () => {
    setSaleLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
    });
    focusLastRowSelect();
  };

  const handleRemoveRow = async (key: number, seq: number) => {
    if (isEdit && typeof key === 'number' && key < 1000000000) {
      try {
        await saleService.deleteLine(voucherNo!, seq);
      } catch {
        message.error('Failed to delete line from server');
        return;
      }
    }
    setSaleLines(prev => prev.filter(l => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    setSaleLines(prev => {
      const newLines = prev.map(l => {
        if (l.key === key) {
          const updated = { ...l, [field]: value };
          const targetItemId = field === 'itemId' ? value : updated.itemId;
          const item = items.find(i => String(i.id) === String(targetItemId));

          if (field === 'itemId') {
            if (item) {
              updated.unit = item.defaultUnit || item.primaryUnit;
              updated.rate = item.priRate || 0;
              updated.secUnit = item.secondaryUnit;
              const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
              updated.packQty = pSize;
              updated.packing = pSize;
              updated.secRate = item.secRate || ((item.priRate || 0) * (pSize > 0 ? pSize : 1));
              updated.secQty = 0;
            }
          }

          const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
          const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

          let kgQty = updated.qty || 0;
          let bagQty = updated.secQty || 0;
          let packQty = updated.packQty || 0;
          let packing = updated.packing || 0;
          let kgRate = updated.rate || 0;
          let bagRate = updated.secRate || 0;

          if (field === 'qty') {
            kgQty = numVal;
            if (bagQty > 0) {
              packQty = round(kgQty / bagQty, 2);
            } else if (packQty > 0) {
              bagQty = round(kgQty / packQty, 2);
            }
          } else if (field === 'secQty') {
            bagQty = numVal;
            if (packQty > 0) {
              kgQty = round(bagQty * packQty, 2);
            } else if (kgQty > 0) {
              packQty = round(kgQty / bagQty, 2);
            }
          } else if (field === 'packQty') {
            packQty = numVal;
            if (bagQty > 0) {
              kgQty = round(bagQty * packQty, 2);
            } else if (kgQty > 0) {
              bagQty = round(kgQty / packQty, 2);
            }
          } else if (field === 'packing') {
            packing = numVal;
            if (packing > 0) {
              if (bagRate > 0) {
                kgRate = round(bagRate / packing, 4);
              } else if (kgRate > 0) {
                bagRate = round(kgRate * packing, 4);
              }
            }
          } else if (field === 'rate') {
            kgRate = numVal;
            if (packing > 0) {
              bagRate = round(kgRate * packing, 4);
            }
          } else if (field === 'secRate') {
            bagRate = numVal;
            if (packing > 0) {
              kgRate = round(bagRate / packing, 4);
            }
          }

          updated.qty = round(kgQty, 2);
          updated.secQty = round(bagQty, 2);
          updated.packQty = round(packQty, 2);
          updated.packing = round(packing, 2);
          updated.rate = round(kgRate, 4);
          updated.secRate = round(bagRate, 4);

          if (field === 'discount') {
            updated.discount = numVal;
          }

          const qty = updated.qty || 0;
          const rate = updated.rate || 0;
          const disc = updated.discount || 0;
          updated.amount = round(qty * (rate - disc), 2);
          return updated;
        }
        return l;
      });

      const lastRow = newLines[newLines.length - 1];
      if (lastRow.key === key && lastRow.itemId) {
        const newSeq = newLines.length > 0 ? Math.max(...newLines.map(l => l.seq)) + 1 : 1;
        return [...newLines, { key: Date.now() + 1, seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
      }

      return newLines;
    });
  };

  const totalAmount = saleLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const cashReceipt = Form.useWatch('cashReceipt', form) || 0;
  const cashBack = Form.useWatch('cashBack', form) || 0;
  const balance = totalAmount - cashReceipt + cashBack;

  useEffect(() => {
    if (!isEdit) {
      const currentReceipt = form.getFieldValue('cashReceipt');
      const isAutoSynced = currentReceipt === undefined || currentReceipt === null || currentReceipt === 0 || currentReceipt === prevTotalAmountRef.current;
      
      if (isAutoSynced) {
        form.setFieldsValue({
          cashReceipt: totalAmount,
          cashBack: 0
        });
      } else {
        form.setFieldValue('cashBack', Math.max(0, (currentReceipt || 0) - totalAmount));
      }
      prevTotalAmountRef.current = totalAmount;
    } else if (isEdit && loading === false) {
      form.setFieldValue('cashBack', Math.max(0, cashReceipt - totalAmount));
    }
  }, [totalAmount, cashReceipt, isEdit, loading]);

  const handleSave = async () => {
    if (isEdit && !isOnline) {
      message.error('Editing existing vouchers requires an internet connection.');
      return;
    }

    try {
      const values = await form.validateFields();
      const validLines = saleLines.filter(l => l.itemId && l.qty > 0);

      if (validLines.length === 0) {
        message.error('Please add at least one item');
        return;
      }

      setLoading(true);
      const request = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        cashReceipt: values.cashReceipt || 0,
        cashBack: values.cashBack || 0,
        lines: validLines.map(l => {
          const item = items.find(i => i.id === l.itemId);
          return {
            seq: l.seq,
            itemId: l.itemId,
            unit: item?.itemType === 'Service' ? null : (l.unit || null),
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            secUnit: l.secUnit || null,
            secQty: l.secQty || 0,
            secRate: l.secRate || 0,
            qtyInPack: l.packQty || l.qtyInPack || null,
            packing: l.packing || null
          };
        })
      };

      if (isEdit) {
        await saleService.update(voucherNo!, request);
        message.success('Sale updated successfully');
      } else {
        const newVno = await saleService.create(request, { offlineFallback: true });

        if (newVno.includes('-') && newVno.length <= 10) {
          message.warning({
            content: `Sale saved offline as ${newVno}. It will sync automatically when you reconnect.`,
            duration: 8,
          });
        } else {
          message.success(`Sale created successfully. Voucher: SL-${newVno}`);
        }
        handleCloseActiveTabAfterSave();
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes('internet')) {
        message.error(error.message);
      } else {
        message.error('Failed to save sale');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await saleService.delete(voucherNo!);
      message.success('Sale deleted successfully');
      navigate('/daily-entries/sale');
    } catch {
      message.error('Failed to delete sale');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Seq',
      dataIndex: 'seq',
      key: 'seq',
      width: 50,
    },
    {
      title: 'Item Description',
      dataIndex: 'itemId',
      key: 'itemId',
      render: (text: string, record: any) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="Select Item"
          optionFilterProp="children"
          value={text}
          onChange={(val) => updateLine(record.key, 'itemId', val)}
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          options={items.map(i => ({ value: i.id, label: `${i.title} (${i.id})` }))}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !record.itemId) {
              e.preventDefault();
              const cashReceiptInput = document.querySelector('.pos-cash-receipt input') as HTMLInputElement;
              if (cashReceiptInput) {
                cashReceiptInput.focus();
                cashReceiptInput.select();
              }
            }
          }}
        >
          {items.map(i => (
            <Select.Option key={i.id} value={i.id}>{i.title}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Qty (Kg)',
      dataIndex: 'qty',
      key: 'qty',
      width: 90,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          onChange={(v) => updateLine(record.key, 'qty', v)}
        />
      )
    },
    {
      title: 'Bag Qty',
      dataIndex: 'secQty',
      key: 'secQty',
      width: 90,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          onChange={(v) => updateLine(record.key, 'secQty', v)}
        />
      )
    },
    {
      title: 'Pack Qty',
      dataIndex: 'packQty',
      key: 'packQty',
      width: 90,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          onChange={(v) => updateLine(record.key, 'packQty', v)}
        />
      )
    },
    {
      title: 'Packing',
      dataIndex: 'packing',
      key: 'packing',
      width: 90,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          onChange={(v) => updateLine(record.key, 'packing', v)}
        />
      )
    },
    {
      title: 'Rate (/Kg)',
      dataIndex: 'rate',
      key: 'rate',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/[^0-9.]/g, '') as any}
          onChange={(v) => updateLine(record.key, 'rate', v)}
          tabIndex={0}
        />
      )
    },
    {
      title: 'Bag Rate',
      dataIndex: 'secRate',
      key: 'secRate',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={4}
          step={0.01}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/[^0-9.]/g, '') as any}
          onChange={(v) => updateLine(record.key, 'secRate', v)}
          tabIndex={0}
        />
      )
    },
    {
      title: 'Disc',
      dataIndex: 'discount',
      key: 'discount',
      width: 90,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          onChange={(v) => updateLine(record.key, 'discount', v)}
          tabIndex={-1}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number) => <Text strong>{(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveRow(record.key, record.seq)}
          disabled={saleLines.length === 1}
          tabIndex={-1}
        />
      )
    }
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <style>{`
        .pos-tab-container {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
          padding-bottom: 6px;
          overflow-x: auto;
          flex-shrink: 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .pos-tab-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          height: 36px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          color: #475569;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          user-select: none;
          white-space: nowrap;
        }
        .pos-tab-item:hover {
          border-color: #94a3b8;
          background: #f8fafc;
          color: #0f172a;
        }
        .pos-tab-item.active {
          background: #0ea5e9;
          border-color: #0ea5e9;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(14, 165, 233, 0.15);
        }
        .pos-tab-item.active:hover {
          background: #0284c7;
          border-color: #0284c7;
          color: #ffffff;
        }
        .pos-tab-close-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          font-size: 8px;
          color: inherit;
          opacity: 0.6;
          transition: all 0.2s;
          margin-left: 6px;
        }
        .pos-tab-close-btn:hover {
          background: rgba(15, 23, 42, 0.1);
          opacity: 1;
        }
        .pos-tab-item.active .pos-tab-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .pos-tab-add-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 36px;
          padding: 0 12px;
          background: #f0f9ff;
          border: 1px dashed #0ea5e9 !important;
          color: #0ea5e9;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pos-tab-add-btn:hover {
          background: #e0f2fe;
        }
      `}</style>

      {!isEdit && (
        <div className="pos-tab-container">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const amount = tab.saleLines.reduce((sum, l) => sum + (l.amount || 0), 0);
            const qtyCount = tab.saleLines.filter(l => l.itemId).reduce((sum, l) => sum + (l.qty || 0), 0);
            const customerObj = customers.find(c => c.account === tab.account);
            const customerTitle = customerObj?.title || 'Walk-in Customer';

            return (
              <div
                key={tab.id}
                className={`pos-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSwitchTab(tab.id)}
              >
                <FileTextOutlined style={{ fontSize: 13 }} />
                <span>
                  <strong style={{ fontWeight: 700 }}>{customerTitle}</strong>
                  <span style={{ fontSize: 11, opacity: isActive ? 0.9 : 0.65, marginLeft: 6, fontWeight: 500 }}>
                    ({qtyCount} {qtyCount === 1 ? 'item' : 'items'} • Rs. {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </span>
                </span>

                {tabs.length > 1 && (
                  <span
                    className="pos-tab-close-btn"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                  >
                    ✕
                  </span>
                )}
              </div>
            );
          })}

          <button className="pos-tab-add-btn" onClick={handleAddTab}>
            <PlusOutlined /> New Sale Tab
          </button>
        </div>
      )}

      {cacheMissError && (
        <Alert
          type="warning"
          message="Offline Data Not Available"
          description={cacheMissError}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale')} type="text" />
          <RocketOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Sale: SL-${voucherNo}` : 'Sale Invoice'}
            </Title>
            <Text type="secondary">
              {isEdit ? 'Modify recorded sale transaction' : 'Direct Retail Billing & Quick Checkout'}
            </Text>
          </div>
          {isOnline ? (
            <Tag icon={<WifiOutlined />} color="success">Online</Tag>
          ) : (
            <Tag icon={<DisconnectOutlined />} color="warning">Offline Mode</Tag>
          )}
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm title="Delete this sale?" onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          {isEdit && (
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                const values = form.getFieldsValue();
                navigate('/daily-entries/sale/new', {
                  state: {
                    copyFrom: {
                      account: values.account,
                      narration: values.narration,
                      description: values.description,
                      cashReceipt: values.cashReceipt,
                      cashBack: values.cashBack,
                      lines: saleLines
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
            onClick={handleSave}
            loading={loading}
            className="pos-save-btn"
            style={{
              backgroundColor: '#0ea5e9',
              borderColor: '#0ea5e9',
              height: 38,
              padding: '0 20px',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
            }}
          >
            {isEdit ? 'Update Sale (Alt+S)' : 'Complete Sale (Alt+S)'}
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormValuesChange}
        initialValues={{
          cashReceipt: 0,
          cashBack: 0,
          date: dayjs()
        }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input value={isEdit ? `SL-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={6}>
            <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Walk-in Customer"
                optionFilterProp="children"
                className="pos-customer-select"
                prefix={<UserOutlined />}
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={customers.map(c => ({ value: c.account, label: `${c.title} (${c.account})` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Form.Item label="Narration" name="narration">
              <Select
                showSearch
                placeholder="Select Narration"
                optionFilterProp="children"
                allowClear
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={narrations.map(n => ({ value: n.code, label: `${n.title}` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Form.Item label="Description" name="description">
              <Input placeholder="Additional Notes" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <Text strong style={{ fontSize: 16 }}>Items Details</Text>
          </Space>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>
            Add Line (Alt+R)
          </Button>
        </div>

        <Table
          dataSource={saleLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="small"
          bordered
        />

        <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8 }}>
          <Row gutter={24} align="middle">
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'left' }}>
                <Text type="secondary">Total Items:</Text>
                <Title level={4} style={{ margin: 0 }}>
                  {saleLines.filter(l => l.itemId).length} lines
                </Title>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="Cash Tendered (Rs.)" name="cashReceipt" style={{ marginBottom: 0 }}>
                    <InputNumber
                      className="pos-cash-receipt"
                      style={{ width: '100%', fontSize: 16, fontWeight: 'bold' }}
                      min={0}
                      precision={2}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Change Due (Rs.)" name="cashBack" style={{ marginBottom: 0 }}>
                    <InputNumber
                      style={{
                        width: '100%',
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: cashBack > 0 ? '#10b981' : undefined
                      }}
                      min={0}
                      precision={2}
                      readOnly
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">Net Total Bill</Text>
                <Title level={2} style={{ margin: 0, color: '#0ea5e9' }}>
                  Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Title>
                {balance !== 0 && (
                  <Text type="danger" style={{ fontSize: 13, fontWeight: 'bold' }}>
                    {balance > 0
                      ? `Pending Balance: Rs. ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : `Overpaid: Rs. ${Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </Text>
                )}
              </div>
            </Col>
          </Row>
        </div>
      </Form>
    </Card>
  );
};
