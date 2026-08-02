import React, { useState, useEffect, useRef } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag, Alert, Modal
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  RocketOutlined, UserOutlined, FileTextOutlined, WifiOutlined, DisconnectOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import type { NarrationDto } from '../../services/narrationService';
import type { Item } from '../../services/inventoryService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useAppStore } from '../../stores/useAppStore';

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

export const SaleForm: React.FC = () => {
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetworkStatus();

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);
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

    // 1. Capture current form values and save to active tab
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

    // 2. Set new active tab
    setActiveTabId(targetId);

    // 3. Load target tab values into form and saleLines
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
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0 }]);
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
      setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
      form.setFieldsValue({ date: dayjs() });
    }
    focusCustomerSelect();
  }, [isEdit, voucherNo]);

  const loadReferenceData = async () => {
    try {
      const [customers, narrations, items, units] = await Promise.all([
        offlineCacheService.getCustomers(),
        offlineCacheService.getNarrations(),
        offlineCacheService.getItems(),
        offlineCacheService.getUnits(),
      ]);
      setCustomers(customers);
      setNarrations(narrations);
      setItems(items);
      setUnits(units);
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

        setSaleLines(details.map(d => {
          const pQty = (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? Math.round((d.qty / d.secQty) * 100) / 100 : 0);
          const pCking = (d.rate > 0 && d.secRate && d.secRate > 0) ? Math.round((d.secRate / d.rate) * 100) / 100 : ((d as any).qtyInPack || 0);
          return {
            ...d,
            key: d.seq,
            rate: d.rate,
            discount: d.discount,
            amount: hasVariablePackFeature
              ? d.qty * (d.rate - (d.discount || 0))
              : d.amount,
            secUnit: d.secUnit,
            secQty: d.secQty,
            secRate: d.secRate,
            packQty: pQty,
            packing: pCking
          };
        }));
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
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, amount: 0, secQty: 0, secRate: 0 }];
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

          if (hasVariablePackFeature) {
            let kgQty = updated.qty || 0;
            let bagQty = updated.secQty || 0;
            let packQty = updated.packQty || 0;
            let packing = updated.packing || 0;
            let kgRate = updated.rate || 0;
            let bagRate = updated.secRate || 0;

            if (field === 'qty') {
              kgQty = numVal;
              if (bagQty > 0) {
                packQty = Math.round((kgQty / bagQty) * 100) / 100;
              } else if (packQty > 0) {
                bagQty = Math.round((kgQty / packQty) * 100) / 100;
              }
            } else if (field === 'secQty') {
              bagQty = numVal;
              if (packQty > 0) {
                kgQty = Math.round((bagQty * packQty) * 100) / 100;
              } else if (kgQty > 0) {
                packQty = Math.round((kgQty / bagQty) * 100) / 100;
              }
            } else if (field === 'packQty') {
              packQty = numVal;
              if (bagQty > 0) {
                kgQty = Math.round((bagQty * packQty) * 100) / 100;
              } else if (kgQty > 0) {
                bagQty = Math.round((kgQty / packQty) * 100) / 100;
              }
            } else if (field === 'packing') {
              packing = numVal;
              if (packing > 0) {
                if (bagRate > 0) {
                  kgRate = Math.round((bagRate / packing) * 100) / 100;
                } else if (kgRate > 0) {
                  bagRate = Math.round((kgRate * packing) * 100) / 100;
                }
              }
            } else if (field === 'rate') {
              kgRate = numVal;
              if (packing > 0) {
                bagRate = Math.round((kgRate * packing) * 100) / 100;
              }
            } else if (field === 'secRate') {
              bagRate = numVal;
              if (packing > 0) {
                kgRate = Math.round((bagRate / packing) * 100) / 100;
              }
            }

            updated.qty = Math.round((kgQty || 0) * 100) / 100;
            updated.secQty = Math.round((bagQty || 0) * 100) / 100;
            updated.packQty = Math.round((packQty || 0) * 100) / 100;
            updated.packing = Math.round((packing || 0) * 100) / 100;
            updated.rate = Math.round((kgRate || 0) * 100) / 100;
            updated.secRate = Math.round((bagRate || 0) * 100) / 100;
          }

          const qty = updated.qty || 0;
          const rate = updated.rate || 0;
          const disc = updated.discount || 0;
          updated.amount = Math.round((qty * (rate - disc)) * 100) / 100;
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
    // Guard: cannot edit existing vouchers offline
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
            qtyInPack: l.packQty || l.qtyInPack || null
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
          onInputKeyDown={(e) => {
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
    ...(!hasSecondaryQty ? [
      {
        title: 'Unit',
        dataIndex: 'unit',
        key: 'unit',
        width: 100,
        render: (text: string, record: any) => {
          const item = items.find(i => String(i.id) === String(record.itemId));
          const filteredUnits = item
            ? units.filter(u => u.code === item.primaryUnit || u.code === item.secondaryUnit)
            : units;

          return (
            <Select
              style={{ width: '100%' }}
              value={text}
              disabled={!record.itemId}
              onChange={(val) => updateLine(record.key, 'unit', val)}
            >
              {filteredUnits.map(u => (
                <Select.Option key={u.code} value={u.code}>{u.title}</Select.Option>
              ))}
            </Select>
          );
        }
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Qty (Kg)' : (hasSecondaryQty ? 'Single Qty' : 'Qty'),
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
    ...(hasVariablePackFeature ? [
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
      }
    ] : []),
    {
      title: hasVariablePackFeature ? 'Rate (/Kg)' : (hasSecondaryQty ? 'Single Rate' : 'Rate'),
      dataIndex: 'rate',
      key: 'rate',
      width: 100,
      render: (val: number, record: any) => (
        <InputNumber
          style={{ width: '100%' }}
          value={val}
          min={0}
          precision={2}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value?.replace(/[^0-9.]/g, '') as any}
          onChange={(v) => updateLine(record.key, 'rate', v)}
          tabIndex={-1}
        />
      )
    },
    ...((hasSecondaryQty || hasVariablePackFeature) ? [
      {
        title: hasVariablePackFeature ? 'Bag Rate' : 'Pack Rate',
        dataIndex: 'secRate',
        key: 'secRate',
        width: 100,
        render: (val: number, record: any) => (
          <InputNumber
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={2}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value?.replace(/[^0-9.]/g, '') as any}
            onChange={(v) => updateLine(record.key, 'secRate', v)}
            tabIndex={-1}
          />
        )
      }
    ] : []),
    ...(hasSecondaryQty && !hasVariablePackFeature ? [
      {
        title: 'Pack Qty',
        dataIndex: 'secQty',
        key: 'secQty',
        width: 90,
        render: (val: number, record: any) => (
          <InputNumber
            style={{ width: '100%' }}
            value={val}
            min={0}
            onChange={(v) => updateLine(record.key, 'secQty', v)}
          />
        )
      }
    ] : []),
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

  // Cannot edit existing vouchers while offline
  const editOfflineBlocked = isEdit && !isOnline;

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <style>{`
        /* Multi-tab POS styling */
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

      {/* ── POS Multi-Tab Bar ── */}
      {!isEdit && (
        <div className="pos-tab-container">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            
            // Calculate totals for each tab
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
          
          <button
            className="pos-tab-add-btn"
            onClick={handleAddTab}
          >
            <PlusOutlined /> New Sale Tab
          </button>
        </div>
      )}
      {/* ── Offline / Online status banner ── */}
      {!isOnline && (
        <Alert
          className="mb-4"
          type={editOfflineBlocked ? 'error' : 'warning'}
          showIcon
          icon={<DisconnectOutlined />}
          message={
            editOfflineBlocked
              ? 'You are offline — editing existing vouchers requires an internet connection.'
              : 'You are offline — new sales will be queued and synced automatically when you reconnect.'
          }
        />
      )}
      {isOnline && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 mb-3">
          <WifiOutlined />
          <span>Online</span>
        </div>
      )}

      {/* ── Cache miss error ── */}
      {cacheMissError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Reference Data Not Available Offline"
          description={cacheMissError}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale')} type="text" tabIndex={-1} />
          <RocketOutlined style={{ fontSize: 24, color: '#0ea5e9' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Sale: SL-${voucherNo}` : 'New Sale'}
            </Title>
            <Text type="secondary">{isEdit ? 'Modify existing sale voucher' : 'Record a new customer sale'}</Text>
          </div>
        </Space>
        <Space>
          {isEdit && (
            <Popconfirm
              title="Delete Sale"
              description="Are you sure you want to delete this entire sale voucher?"
              onConfirm={handleDelete}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true, loading }}
              disabled={!isOnline}
            >
              <Button danger icon={<DeleteOutlined />} disabled={!isOnline} tabIndex={-1}>Delete</Button>
            </Popconfirm>
          )}
          <Button
            className="pos-save-btn"
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
            disabled={editOfflineBlocked || !!cacheMissError}
            style={{ backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
          >
            {!isOnline && !isEdit ? 'Save Offline' : 'Save Sale'}
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" onValuesChange={handleFormValuesChange}>
        <Row gutter={16}>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Voucher #">
              <Input value={isEdit ? `SL-${voucherNo}` : ''} readOnly style={{ backgroundColor: '#f5f5f5' }} tabIndex={-1} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={4}>
            <Form.Item label="Date" name="date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" tabIndex={-1} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={8}>
            <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
              <Select
                className="pos-customer-select"
                showSearch
                autoFocus
                placeholder="Select Customer"
                prefix={<UserOutlined />}
                optionFilterProp="children"
              >
                {customers.map(c => (
                  <Select.Option key={c.account} value={c.account}>{c.title}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={24} lg={8}>
            <Form.Item label="Narration" name="narration">
              <Select showSearch placeholder="Select narration" prefix={<FileTextOutlined />} allowClear tabIndex={-1}>
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
              <Input placeholder="Additional sale details..." tabIndex={-1} />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-between items-center mb-4 mt-2">
          <Title level={5} style={{ margin: 0 }}>Item Details</Title>
          <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />} tabIndex={-1}>Add Row</Button>
        </div>

        <Table
          dataSource={saleLines}
          columns={columns}
          pagination={false}
          rowKey="key"
          size="small"
          bordered
          className="mb-6"
          summary={pageData => {
            let total = 0;
            pageData.forEach(({ amount }) => { total += amount || 0; });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><b>Gross Total</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong style={{ color: '#0ea5e9' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />

        <div className="mt-8 pt-6 border-t border-gray-100">
          <Row gutter={24} align="bottom">
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Cash Receipt" name="cashReceipt">
                <InputNumber
                  className="pos-cash-receipt"
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  placeholder="0.00"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Cash Back" name="cashBack">
                <InputNumber
                  className="pos-cash-back"
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  placeholder="0.00"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      const saveBtn = document.querySelector('.pos-save-btn') as HTMLButtonElement;
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
                    {balance > 0 ? 'Receivable' : balance < 0 ? 'Change' : 'Settled'}
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

        {/* Keyboard Shortcuts Helper Bar */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
          <span style={{ fontWeight: 600 }}>⌨️ Keyboard Shortcuts:</span>
          <span><Tag color="blue" style={{ borderRadius: 4, fontWeight: 700 }}>Alt + N</Tag> New Tab</span>
          <span><Tag color="blue" style={{ borderRadius: 4, fontWeight: 700 }}>Alt + C</Tag> Close Tab</span>
          <span><Tag color="blue" style={{ borderRadius: 4, fontWeight: 700 }}>Alt + [1-9]</Tag> Switch Tab</span>
          <span><Tag color="blue" style={{ borderRadius: 4, fontWeight: 700 }}>Alt + R</Tag> Add Row</span>
          <span><Tag color="green" style={{ borderRadius: 4, fontWeight: 700 }}>Alt + S</Tag> / <Tag color="green" style={{ borderRadius: 4, fontWeight: 700 }}>F8</Tag> Save Sale</span>
        </div>
      </Form>
    </Card>
  );
};
