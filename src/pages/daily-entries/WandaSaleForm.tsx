import KeyboardShortcutsBar from '../../components/common/KeyboardShortcutsBar';
import React, { useState, useEffect, useRef } from 'react';
import {
  Row, Col, Card, Typography, Form, DatePicker, Select, Input, Button,
  Table, Space, message, InputNumber, Popconfirm, Tag, Alert, Modal, Tooltip,
  Dropdown
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, ArrowLeftOutlined,
  RocketOutlined, UserOutlined, FileTextOutlined, WifiOutlined, DisconnectOutlined,
  CopyOutlined, HistoryOutlined, WarningOutlined, PrinterOutlined, DownOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import type { NarrationDto } from '../../services/narrationService';
import { inventoryService, type Item, type ItemCustomerCategoryPriceDto } from '../../services/inventoryService';
import {
  useSettingsStore,
  TRANSACTION_ENABLE_CARRIAGE_KEY,
  BILL_THANK_YOU_KEY,
  BILL_THANK_YOU_DEFAULT
} from '../../stores/useSettingsStore';
import { useAppStore } from '../../stores/useAppStore';
import { round } from '../../utils/numberUtils';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { CustomerPriceHistoryModal } from '../../components/sale/CustomerPriceHistoryModal';
import { useGridKeyboard } from '../../hooks/useGridKeyboard';
import { SaleReceiptModal } from '../../components/SaleReceiptModal';
import {
  printSaleReceiptDirect,
  type SaleReceiptData,
  type SaleReceiptLineItem
} from '../../utils/saleReceiptPrint';

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
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { voucherNo } = useParams<{ voucherNo: string }>();
  const isEdit = !!voucherNo && voucherNo !== 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const { getSetting, fetchSettings } = useSettingsStore();
  const enableCarriage = getSetting(TRANSACTION_ENABLE_CARRIAGE_KEY, 'false') === 'true';
  const [form] = Form.useForm();

  // Keyboard navigation & Focus management
  const pendingFocusRef = useRef<{ rowIdx: number; colKey: string } | null>(null);
  const datePickerRef = useRef<any>(null);
  const customerSelectRef = useRef<any>(null);
  const narrationSelectRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const { isOnline } = useNetworkStatus();

  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string; shortTitle?: string | null }[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<ItemCustomerCategoryPriceDto[]>([]);
  const [saleLines, setSaleLines] = useState<any[]>([]);
  const [cacheMissError, setCacheMissError] = useState<string | null>(null);
  const prevTotalAmountRef = useRef(0);
  const originalAccountIdRef = useRef<string | null>(null);

  // Price history modal state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyTargetLineKey, setHistoryTargetLineKey] = useState<number | null>(null);
  const [historyTargetItemId, setHistoryTargetItemId] = useState<string | null>(null);

  // Sale Receipt modal state
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<SaleReceiptData | null>(null);

  const getResolvedUnitTitle = (unitCodeOrTitle?: string | null, item?: Item | null): string => {
    const code = unitCodeOrTitle;
    if (!code && !item) return '';

    const matched = units.find(u =>
      u.code?.toLowerCase() === String(code || '').toLowerCase() ||
      u.title?.toLowerCase() === String(code || '').toLowerCase()
    );
    if (matched) {
      return (matched.shortTitle && matched.shortTitle.trim()) || matched.title;
    }

    if (item) {
      if (code && item.defaultUnit && item.defaultUnit.toLowerCase() === String(code).toLowerCase() && (item as any).defaultUnitTitle) {
        return (item as any).defaultUnitTitle;
      }
      if (code && item.primaryUnit && item.primaryUnit.toLowerCase() === String(code).toLowerCase() && item.primaryUnitTitle) {
        return item.primaryUnitTitle;
      }
      if (code && item.secondaryUnit && item.secondaryUnit.toLowerCase() === String(code).toLowerCase() && item.secondaryUnitTitle) {
        return item.secondaryUnitTitle;
      }
      if (!code && (item.primaryUnitTitle || (item as any).defaultUnitTitle)) {
        return (item as any).defaultUnitTitle || item.primaryUnitTitle;
      }
    }

    return code || '';
  };

  const buildReceiptData = (overrideVoucherNo?: string, isReprint: boolean = false): SaleReceiptData | null => {
    const values = form.getFieldsValue();
    const validLines = saleLines.filter(l => l.itemId && l.qty > 0);
    if (validLines.length === 0) return null;

    const currentAcc = customers.find(a => a.account === values.account);
    const currentNarr = narrations.find(n => n.code === values.narration);

    const receiptLines: SaleReceiptLineItem[] = validLines.map((l, idx) => {
      const item = items.find(i => i.id === l.itemId);
      const amount = (l.qty * l.rate) - (l.discount || 0);
      const displayUnit = item?.itemType === 'Service' ? '' : getResolvedUnitTitle(l.unit, item);
      return {
        seq: idx + 1,
        itemTitle: item?.title || 'Item',
        unit: displayUnit,
        qty: l.qty,
        rate: l.rate,
        discount: l.discount || 0,
        amount
      };
    });

    const grossTotal = validLines.reduce((acc, l) => acc + (l.qty * l.rate), 0);
    const totalDiscount = validLines.reduce((acc, l) => acc + (l.discount || 0), 0);
    const cashReceiptVal = values.cashReceipt || 0;
    const cashBackVal = values.cashBack || 0;
    const netAmount = totalAmount;

    return {
      voucherNo: overrideVoucherNo || (isEdit ? `SL-${voucherNo}` : 'DRAFT'),
      date: values.date || dayjs(),
      customerName: currentAcc?.title || 'Walk-in Customer',
      customerPhone: (currentAcc as any)?.phone || undefined,
      narration: currentNarr?.title,
      description: values.description,
      lines: receiptLines,
      grossTotal,
      totalDiscount,
      netAmount,
      cashReceived: cashReceiptVal,
      cashBack: cashBackVal,
      balance: Math.max(0, netAmount - cashReceiptVal),
      orgName: currentOrg?.name,
      orgAddress: (currentOrg as any)?.address,
      orgPhone: (currentOrg as any)?.phone,
      thankYouMessage: getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT),
      isDuplicate: isReprint || isEdit
    };
  };

  const handleOpenPreview = () => {
    const data = buildReceiptData();
    if (!data) {
      message.error('Please add at least one item before previewing the receipt');
      return;
    }
    setActiveReceiptData(data);
    setReceiptModalVisible(true);
  };

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
      saleLines: [{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]
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
    if (customerSelectRef.current) {
      customerSelectRef.current.focus();
    }
    setTimeout(() => {
      if (customerSelectRef.current) {
        customerSelectRef.current.focus();
      }
      const customerInput = document.querySelector<HTMLInputElement>(
        '.pos-customer-select .ant-select-selection-search-input, .pos-customer-select input, [name="account"] input'
      );
      if (customerInput) {
        customerInput.focus();
        customerInput.select?.();
      }
    }, 30);
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
          carriage: l.carriage || 0,
          secQty: l.secQty || 0,
          secRate: l.secRate || 0,
          secUnit: l.secUnit || null,
          packQty: l.packQty || 0,
          packing: l.packing || 0
        }));
        setSaleLines(initialLines.length > 0 ? initialLines : [{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
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
        originalAccountIdRef.current = null;
        setSaleLines([{ key: Date.now(), seq: 1, qty: 1, rate: 0, discount: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }]);
        form.setFieldsValue({ date: dayjs() });
      }
    }
    focusCustomerSelect();
  }, [isEdit, voucherNo, location.state]);

  const loadReferenceData = async () => {
    try {
      const [customers, narrations, items, unitsList] = await Promise.all([
        offlineCacheService.getCustomers(),
        offlineCacheService.getNarrations(),
        offlineCacheService.getItems(),
        offlineCacheService.getUnits().catch(() => []),
      ]);
      fetchSettings();
      setCustomers(customers);
      setNarrations(narrations);
      setItems(items);
      setUnits(unitsList || []);
      inventoryService.getCustomerCategoryPrices().then(setCategoryPrices).catch(() => []);
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

  const resolveItemRates = (itemId: string, customerAccountId?: string | null) => {
    const item = items.find(i => String(i.id) === String(itemId));
    if (!item) return { priRate: 0, secRate: 0 };

    const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
    let priRate = Number(item.priRate) || 0;
    let secRate = item.secRate != null ? Number(item.secRate) : (priRate * (pSize > 0 ? pSize : 1));

    if (customerAccountId) {
      const cust = customers.find(c => c.account === customerAccountId);
      if (cust?.customerCategoryId) {
        const catPrice = categoryPrices.find(cp => cp.itemId === itemId && cp.customerCategoryId === cust.customerCategoryId);
        if (catPrice) {
          if (catPrice.priRate > 0) {
            priRate = Number(catPrice.priRate);
          }
          if (catPrice.secRate != null && catPrice.secRate > 0) {
            secRate = Number(catPrice.secRate);
          }
        }
      }
    }

    return { priRate, secRate };
  };

  const handleCustomerChange = (newAccount: string) => {
    form.setFieldValue('account', newAccount);
    const isOriginal = originalAccountIdRef.current && String(newAccount) === String(originalAccountIdRef.current);
    setSaleLines(prev => prev.map(l => {
      if (!l.itemId) return l;
      let kgR: number;
      let bagR: number;

      if (isOriginal && (l as any).savedRate !== undefined) {
        kgR = (l as any).savedRate;
        bagR = (l as any).savedSecRate ?? 0;
      } else {
        const { priRate, secRate } = resolveItemRates(l.itemId, newAccount);
        const pSize = Number(l.packing || l.packQty || 0);
        bagR = secRate || (priRate * (pSize > 0 ? pSize : 1));
        kgR = (pSize > 0 && bagR > 0) ? round(bagR / pSize, 8) : priRate;
      }

      const qty = l.qty || 1;
      const disc = l.discount || 0;
      const carriage = l.carriage || 0;
      const secQty = l.secQty || 0;
      const amount = round((qty * kgR) - disc + (secQty * carriage), 2);
      return {
        ...l,
        rate: kgR,
        secRate: bagR,
        amount
      };
    }));
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const details = await saleService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        originalAccountIdRef.current = first.accountId ? String(first.accountId) : null;
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
          savedRate: d.rate,
          discount: d.discount,
          carriage: d.carriage || 0,
          amount: d.amount != null ? d.amount : ((d.qty * d.rate) - (d.discount || 0) + ((d.secQty || 0) * (d.carriage || 0))),
          secUnit: d.secUnit,
          secQty: d.secQty,
          secRate: d.secRate,
          savedSecRate: d.secRate ?? 0,
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


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleAddTab();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        focusCustomerSelect();
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleSave({ shouldPrint: false });
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        handleSave({ shouldPrint: true });
        return;
      }
      if (e.key === 'Insert') {
        e.preventDefault();
        if (pendingFocusRef) {
          pendingFocusRef.current = { rowIdx: saleLines.length, colKey: 'itemId' };
        }
        handleAddRow();
        return;
      }
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

      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleSave({ shouldPrint: true });
        return;
      }

      if ((e.altKey && e.key.toLowerCase() === 's') || e.key === 'F8') {
        e.preventDefault();
        handleSave({ shouldPrint: false });
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleAddRow();
        return;
      }
    };

    const handleHelp = (e: Event) => {
      e.preventDefault();
      return false;
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('help', handleHelp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('help', handleHelp, { capture: true });
    };
  }, [tabs, activeTabId, saleLines, items, form]);



  const enterCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing'];
  const arrowCols = ['itemId', 'qty', 'secQty', 'packQty', 'packing', 'rate', 'secRate', 'discount', ...(enableCarriage ? ['carriage'] : [])];

  const handleAddRow = () => {
    setSaleLines(prev => {
      const newSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [...prev, { key: Date.now(), seq: newSeq, qty: 1, rate: 0, discount: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
    });
  };

  const { getCellRef, handleCellKeyDown, focusCell } = useGridKeyboard({
    rowCount: saleLines.length,
    enterCols,
    arrowCols,
    firstColKey: 'itemId',
    onAddRow: handleAddRow,
    pendingFocusRef,
    isRowValid: (idx) => !!saleLines[idx]?.itemId,
    onSave: () => handleSave(),
  });

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
              updated.secUnit = item.secondaryUnit;
              const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
              updated.packQty = pSize;
              updated.packing = pSize;
              const currentCust = form.getFieldValue('account');
              const { priRate: resolvedPriRate, secRate: resolvedSecRate } = resolveItemRates(item.id, currentCust);
              const bagR = resolvedSecRate || ((resolvedPriRate || 0) * (pSize > 0 ? pSize : 1));
              updated.secRate = bagR;
              updated.rate = (pSize > 0 && bagR > 0) ? round(bagR / pSize, 8) : (resolvedPriRate || 0);
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
            const effectivePack = packQty > 0 ? packQty : (packing > 0 ? packing : 0);
            bagQty = effectivePack > 0 ? round(kgQty / effectivePack, 2) : 0;
          } else if (field === 'secQty') {
            bagQty = numVal;
            const effectivePack = packQty > 0 ? packQty : (packing > 0 ? packing : 0);
            kgQty = round(bagQty * effectivePack, 2);
          } else if (field === 'packQty') {
            packQty = numVal;
            bagQty = packQty > 0 ? round(kgQty / packQty, 2) : 0;
          } else if (field === 'packing') {
            if (l.packing && round(numVal, 2) === round(l.packing, 2)) {
              packing = l.packing;
            } else {
              packing = numVal;
              if (packing > 0) {
                if (bagRate > 0) {
                  kgRate = round(bagRate / packing, 8);
                } else if (kgRate > 0) {
                  bagRate = round(kgRate * packing, 2);
                }
              }
            }
          } else if (field === 'rate') {
            if (l.rate && round(numVal, 2) === round(l.rate, 2)) {
              kgRate = l.rate;
            } else {
              kgRate = numVal;
              if (packing > 0) {
                bagRate = round(kgRate * packing, 2);
              }
            }
          } else if (field === 'secRate') {
            if (l.secRate && round(numVal, 2) === round(l.secRate, 2)) {
              bagRate = l.secRate;
            } else {
              bagRate = numVal;
              if (packing > 0) {
                kgRate = round(bagRate / packing, 8);
              }
            }
          }

          updated.qty = round(kgQty, 2);
          updated.secQty = round(bagQty, 2);
          updated.packQty = round(packQty, 2);
          updated.packing = round(packing, 2);
          updated.rate = round(kgRate, 8);
          updated.secRate = round(bagRate, 2);

          const currentCust = form.getFieldValue('account');
          if ((field === 'rate' || field === 'secRate') && originalAccountIdRef.current && String(currentCust) === String(originalAccountIdRef.current)) {
            updated.savedRate = updated.rate;
            updated.savedSecRate = updated.secRate;
          }

          if (field === 'discount') {
            updated.discount = numVal;
          }
          if (field === 'carriage') {
            updated.carriage = numVal;
          }

          const qty = updated.qty || 0;
          const rate = updated.rate || 0;
          const disc = updated.discount || 0;
          const carriage = updated.carriage || 0;
          const secQty = updated.secQty || 0;
          updated.amount = round((qty * rate) - disc + (secQty * carriage), 2);
          return updated;
        }
        return l;
      });

      const lastRow = newLines[newLines.length - 1];
      if (lastRow.key === key && lastRow.itemId) {
        const newSeq = newLines.length > 0 ? Math.max(...newLines.map(l => l.seq)) + 1 : 1;
        return [...newLines, { key: Date.now() + 1, seq: newSeq, qty: 1, rate: 0, discount: 0, carriage: 0, amount: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }];
      }

      return newLines;
    });
  };

  const handleOpenPriceHistory = (lineKey: number, itemId: string) => {
    const currentCust = form.getFieldValue('account');
    if (!currentCust) {
      message.warning('Please select a customer first.');
      return;
    }
    if (!itemId) {
      message.warning('Please select an item first.');
      return;
    }
    setHistoryTargetLineKey(lineKey);
    setHistoryTargetItemId(itemId);
    setHistoryModalVisible(true);
  };

  const handleApplyHistoricalRate = (rate: number, secRate?: number) => {
    if (historyTargetLineKey !== null) {
      if (secRate !== undefined && secRate > 0) {
        updateLine(historyTargetLineKey, 'secRate', secRate);
      } else {
        updateLine(historyTargetLineKey, 'rate', rate);
      }
      message.success(`Applied historical rate: ₨ ${rate}`);
    }
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

  const handleSave = async (options: { shouldPrint?: boolean } = {}) => {
    const shouldPrint = options.shouldPrint ?? true;
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

      const receiptDraft = buildReceiptData();
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
            carriage: l.carriage || 0,
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
        if (shouldPrint && receiptDraft) {
          receiptDraft.voucherNo = `SL-${voucherNo}`;
          receiptDraft.isDuplicate = true;
          await printSaleReceiptDirect(receiptDraft);
        }
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

        if (shouldPrint && receiptDraft) {
          receiptDraft.voucherNo = `SL-${newVno}`;
          await printSaleReceiptDirect(receiptDraft);
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
      render: (text: string, record: any, rowIdx: number) => (
        <Select
          ref={getCellRef(rowIdx, 'itemId')}
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
            handleCellKeyDown(rowIdx, 'itemId', e);
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
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'qty')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          precision={2}
          onChange={(v) => updateLine(record.key, 'qty', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'qty', e)}
        />
      )
    },
    {
      title: 'Bag Qty',
      dataIndex: 'secQty',
      key: 'secQty',
      width: 90,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'secQty')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          precision={2}
          onChange={(v) => updateLine(record.key, 'secQty', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'secQty', e)}
        />
      )
    },
    {
      title: 'Pack Qty',
      dataIndex: 'packQty',
      key: 'packQty',
      width: 90,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packQty')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          precision={2}
          onChange={(v) => updateLine(record.key, 'packQty', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packQty', e)}
        />
      )
    },
    {
      title: 'Packing',
      dataIndex: 'packing',
      key: 'packing',
      width: 90,
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'packing')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          precision={2}
          onChange={(v) => updateLine(record.key, 'packing', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'packing', e)}
        />
      )
    },
    {
      title: 'Rate (/Kg)',
      dataIndex: 'rate',
      key: 'rate',
      width: 165,
      render: (val: number, record: any) => {
        const minPrice = Number(items.find(i => String(i.id) === String(record.itemId))?.minSalePrice ?? 0);
        const atMinPrice = !!record.itemId && minPrice > 0 && Number(val || 0) <= minPrice;
        return (
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            status={atMinPrice ? 'warning' : undefined}
            style={{ width: '100%' }}
            value={val}
            min={0}
            step={0.01}
            controls={false}
            keyboard={false}
            formatter={(value: any, info: any) => {
              if (value == null || value === '') return '';
              if (info?.userTyping) {
                return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              }
              const num = Number(value);
              if (isNaN(num)) return `${value}`;
              return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }}
            parser={value => value?.replace(/[^0-9.]/g, '') as any}
            onChange={(v) => updateLine(record.key, 'rate', v)}
            tabIndex={0}
          />
          <Tooltip title="View last sale price & history">
            <Button
              icon={<HistoryOutlined style={{ color: record.itemId ? '#1677ff' : undefined }} />}
              disabled={!record.itemId}
              onClick={() => handleOpenPriceHistory(record.key, record.itemId)}
              tabIndex={-1}
            />
          </Tooltip>
        {atMinPrice && (
          <Tooltip title={`Price is at the minimum sale price (Rs. ${minPrice.toLocaleString()})`}>
            <Button icon={<WarningOutlined style={{ color: '#faad14' }} />} style={{ borderColor: '#faad14' }} tabIndex={-1} />
          </Tooltip>
        )}
        </Space.Compact>
      );
      }
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
          precision={2}
          step={0.01}
            controls={false}
            keyboard={false}
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
      render: (val: number, record: any, rowIdx: number) => (
        <InputNumber
          ref={getCellRef(rowIdx, 'discount')}
          style={{ width: '100%' }}
          value={val}
          min={0}
          controls={false}
          keyboard={false}
          onChange={(v) => updateLine(record.key, 'discount', v)}
          onKeyDown={(e) => handleCellKeyDown(rowIdx, 'discount', e)}
          tabIndex={-1}
        />
      )
    },
    ...(enableCarriage ? [
      {
        title: 'Carriage',
        dataIndex: 'carriage',
        key: 'carriage',
        width: 90,
        render: (val: number, record: any) => (
          <InputNumber
            style={{ width: '100%' }}
            value={val}
            min={0}
            precision={2}
            step={1}
            controls={false}
            keyboard={false}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value?.replace(/[^0-9.]/g, '') as any}
            onChange={(v) => updateLine(record.key, 'carriage', v)}
            tabIndex={-1}
          />
        )
      }
    ] : []),
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
              icon={<PrinterOutlined />}
              onClick={() => {
                const receiptData = buildReceiptData(`SL-${voucherNo}`, true);
                if (receiptData) {
                  setActiveReceiptData(receiptData);
                  setReceiptModalVisible(true);
                } else {
                  message.error('No items found to generate receipt');
                }
              }}
            >
              Print Receipt
            </Button>
          )}
          {isEdit && (
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                const values = form.getFieldsValue();
                navigate('/daily-entries/sale/wanda/new', {
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
          <Dropdown.Button
            type="primary"
            icon={<DownOutlined />}
            data-action="save"
            className="pos-save-btn form-save-btn"
            onClick={() => handleSave({ shouldPrint: true })}
            loading={loading}
            menu={{
              items: [
                {
                  key: 'save-only',
                  icon: <SaveOutlined />,
                  label: 'Save Only (Alt+S / F5)',
                  onClick: () => handleSave({ shouldPrint: false })
                },
                {
                  key: 'preview-receipt',
                  icon: <EyeOutlined />,
                  label: 'Preview Receipt',
                  onClick: handleOpenPreview
                }
              ]
            }}
            style={{
              height: 38,
              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
            }}
          >
            <PrinterOutlined style={{ marginRight: 6 }} />
            {isEdit ? 'Update & Print (Alt+P)' : 'Save & Print (Alt+P)'}
          </Dropdown.Button>
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
              <DatePicker
                ref={datePickerRef}
                style={{ width: '100%' }}
                format="DD-MMM-YYYY"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusCustomerSelect();
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} lg={6}>
            <Form.Item label="Customer" name="account" rules={[{ required: true }]}>
              <Select
                ref={customerSelectRef}
                showSearch
                placeholder="Walk-in Customer"
                optionFilterProp="children"
                className="pos-customer-select"
                prefix={<UserOutlined />}
                onChange={handleCustomerChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    narrationSelectRef.current?.focus();
                  }
                }}
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
                ref={narrationSelectRef}
                showSearch
                placeholder="Select Narration"
                optionFilterProp="children"
                allowClear
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusCell(0, 'itemId');
                  }
                }}
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
        <KeyboardShortcutsBar shortcuts={[{ key: 'F1', label: 'New Tab' }, { key: 'F2', label: 'Customer' }, { key: 'F3', label: 'Barcode' }, { key: 'Alt+P / F12', label: 'Save & Print' }, { key: 'Alt+S / F5', label: 'Save Only' }, { key: 'Ins', label: 'Add Row' }, { key: 'Enter', label: 'Next Field' }, { key: '↑↓←→', label: 'Navigate' }, { key: 'Esc', label: 'Cancel Edit' }]} />

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
                      controls={false}
                      keyboard={false}
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
                      controls={false}
                      keyboard={false}
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

      <CustomerPriceHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        accountId={form.getFieldValue('account')}
        customerName={
          customers.find(c => c.account === form.getFieldValue('account'))?.title
        }
        itemId={historyTargetItemId}
        itemTitle={items.find(i => String(i.id) === String(historyTargetItemId))?.title}
        hasSecondaryQty={true}
        onApplyRate={handleApplyHistoricalRate}
      />

      <SaleReceiptModal
        visible={receiptModalVisible}
        receiptData={activeReceiptData}
        onClose={() => setReceiptModalVisible(false)}
      />
    </Card>
  );
};
