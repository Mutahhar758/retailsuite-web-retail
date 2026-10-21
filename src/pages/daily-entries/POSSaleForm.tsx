import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Typography, Button, Input, InputNumber, Space, message, Tag, Modal, List, Badge, Alert, Dropdown, Segmented, Select, Tooltip, Popconfirm
} from 'antd';
import {
  useThermalPrinter,
  printDirect,
  padLine,
  divider,
  type ConnectionMethod,
  ESC_ALIGN_LEFT,
  ESC_ALIGN_CENTER,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_DOUBLE_ON,
  ESC_DOUBLE_OFF
} from '../../hooks/useThermalPrinter';
import { useAppStore } from '../../stores/useAppStore';
import {
  PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined,
  PrinterOutlined, RedoOutlined, CheckCircleOutlined, UserOutlined,
  FileTextOutlined, SearchOutlined, DollarOutlined,
  DisconnectOutlined, CloudServerOutlined, DownOutlined,
  FireOutlined, ReloadOutlined, InboxOutlined, BookOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, type Item, type ItemCustomerCategoryPriceDto } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import type { NarrationDto } from '../../services/narrationService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { kotService, type DiningTableDto, type KotOrderResponse } from '../../services/kotService';
import { useSettingsStore, BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT, RESTAURANT_ENABLE_KOT_KEY, RESTAURANT_ENABLE_DINE_IN_KEY, RESTAURANT_ENABLE_KDS_KEY, RESTAURANT_ENABLE_VOICE_CALLOUT_KEY, RESTAURANT_VOICE_CALLOUT_SPEED_KEY, RESTAURANT_VOICE_CALLOUT_ACCENT_KEY, BARCODE_FAST_SCAN_SOUND_KEY } from '../../stores/useSettingsStore';
import { printKotSlip } from '../../utils/kotPrint';
import { speakKotOrder, type VoiceAccentType } from '../../utils/kotSpeech';
import { playScanSuccessTone, playScanErrorTone } from '../../utils/scannerAudio';
import { parseBarcodePayload } from '../../utils/barcodeParser';
import { getEffectiveSubUnits, getSelectablePrimaryUnits, toBasePrimaryQty, resolveDisplayQtyAndUnit } from '../../utils/unitConversion';

const { Title, Text } = Typography;

interface CartItem {
  item: Item;
  qty: number;
  rate: number;
  discount: number;
  unit: string;
  selectedUnitId?: string;
  selectedUnitFactor?: number;
  displayQty?: number;
}

interface InvoiceTab {
  id: string;
  name: string;
  selectedCustomer: ChartOfAccountHeadDto | null;
  selectedNarration: NarrationDto | null;
  cart: CartItem[];
  discountPercent: number;
  discountFlat: number;
  noteCounts: Record<number, number>;
  searchItemQuery: string;
  activeCategory: string;
  orderType: string;
  selectedTableId: number | null;
  activeKotId: number | null;
  activeSaleVoucherNo: string | null;
  remarks: string;
}

export const POSSaleForm: React.FC = () => {

  const [loading, setLoading] = useState(false);
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const currentOrgName = currentOrg?.name || 'Retail Store';
  const { isOnline } = useNetworkStatus();
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const { getSetting, fetchSettings, initialized: settingsInitialized } = useSettingsStore();
  const settingKot = getSetting(RESTAURANT_ENABLE_KOT_KEY, '');
  const hasKotFeature = settingKot !== '' ? settingKot === 'true' : (currentOrg?.hasKotFeature ?? false);
  const settingDineIn = getSetting(RESTAURANT_ENABLE_DINE_IN_KEY, '');
  const hasDineInFeature = settingDineIn !== '' ? settingDineIn === 'true' : false;
  const settingKds = getSetting(RESTAURANT_ENABLE_KDS_KEY, '');
  const hasKdsFeature = hasKotFeature && (settingKds !== '' ? settingKds === 'true' : false);
  const settingVoiceCallout = getSetting(RESTAURANT_ENABLE_VOICE_CALLOUT_KEY, '');
  const hasVoiceCallout = hasKotFeature && (settingVoiceCallout !== '' ? settingVoiceCallout === 'true' : false);
  const voiceSpeed = parseFloat(getSetting(RESTAURANT_VOICE_CALLOUT_SPEED_KEY, '1.0')) || 1.0;
  const voiceAccent = (getSetting(RESTAURANT_VOICE_CALLOUT_ACCENT_KEY, 'pakistani_male') as VoiceAccentType) || 'pakistani_male';

  useEffect(() => {
    if (!settingsInitialized) {
      fetchSettings();
    }
  }, [settingsInitialized, fetchSettings]);

  // Data states
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<ItemCustomerCategoryPriceDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);
  const [diningTables, setDiningTables] = useState<DiningTableDto[]>([]);

  // KOT states
  const [isKotModalVisible, setIsKotModalVisible] = useState(false);
  const [activeKots, setActiveKots] = useState<KotOrderResponse[]>([]);
  const [kotLoading, setKotLoading] = useState(false);

  const fetchActiveKots = useCallback(async () => {
    try {
      setKotLoading(true);
      const data = await kotService.getActive();
      setActiveKots(data.filter(k => k.status !== 'Paid' && k.status !== 'Cancelled'));
    } catch (err) {
      console.error('Failed to load active KOT orders', err);
    } finally {
      setKotLoading(false);
    }
  }, []);

  // Multi-tab states
  const [tabs, setTabs] = useState<InvoiceTab[]>(() => {
    const initialId = Date.now().toString();
    return [{
      id: initialId,
      name: 'Tab 1',
      selectedCustomer: null,
      selectedNarration: null,
      cart: [],
      discountPercent: 0,
      discountFlat: 0,
      noteCounts: { 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 },
      searchItemQuery: '',
      activeCategory: 'all',
      orderType: 'Takeaway',
      selectedTableId: null,
      activeKotId: null,
      activeSaleVoucherNo: null,
      remarks: ''
    }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  // Derived active tab state
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const cart = activeTab?.cart || [];
  const discountPercent = activeTab?.discountPercent || 0;
  const discountFlat = activeTab?.discountFlat || 0;
  const noteCounts = activeTab?.noteCounts || { 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 };
  const selectedCustomer = activeTab?.selectedCustomer || null;
  const selectedNarration = activeTab?.selectedNarration || null;
  const searchItemQuery = activeTab?.searchItemQuery || '';
  const activeCategory = activeTab?.activeCategory || 'all';
  const orderType = activeTab?.orderType || 'Takeaway';
  const selectedTableId = activeTab?.selectedTableId || null;
  const activeKotId = activeTab?.activeKotId || null;
  const activeSaleVoucherNo = activeTab?.activeSaleVoucherNo || null;
  const remarks = activeTab?.remarks || '';

  // Helper to update active tab's properties
  const updateActiveTab = (updater: Partial<InvoiceTab> | ((tab: InvoiceTab) => InvoiceTab)) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return typeof updater === 'function' ? updater(t) : { ...t, ...updater };
      }
      return t;
    }));
  };

  // Helper state setters for active tab properties to match existing state logic
  const setCart = (val: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    updateActiveTab(t => ({ ...t, cart: typeof val === 'function' ? val(t.cart) : val }));
  };

  const setDiscountPercent = (val: number | ((prev: number) => number)) => {
    updateActiveTab(t => ({ ...t, discountPercent: typeof val === 'function' ? val(t.discountPercent) : val }));
  };

  const setDiscountFlat = (val: number | ((prev: number) => number)) => {
    updateActiveTab(t => ({ ...t, discountFlat: typeof val === 'function' ? val(t.discountFlat) : val }));
  };

  const setNoteCounts = (val: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => {
    updateActiveTab(t => ({ ...t, noteCounts: typeof val === 'function' ? val(t.noteCounts) : val }));
  };

  const setSelectedCustomer = (val: ChartOfAccountHeadDto | null | ((prev: ChartOfAccountHeadDto | null) => ChartOfAccountHeadDto | null)) => {
    updateActiveTab(t => ({ ...t, selectedCustomer: typeof val === 'function' ? val(t.selectedCustomer) : val }));
  };

  const setSelectedNarration = (val: NarrationDto | null | ((prev: NarrationDto | null) => NarrationDto | null)) => {
    updateActiveTab(t => ({ ...t, selectedNarration: typeof val === 'function' ? val(t.selectedNarration) : val }));
  };

  const setSearchItemQuery = (val: string | ((prev: string) => string)) => {
    updateActiveTab(t => ({ ...t, searchItemQuery: typeof val === 'function' ? val(t.searchItemQuery) : val }));
  };

  const setActiveCategory = (val: string | ((prev: string) => string)) => {
    updateActiveTab(t => ({ ...t, activeCategory: typeof val === 'function' ? val(t.activeCategory) : val }));
  };

  const setOrderType = (val: string | ((prev: string) => string)) => {
    updateActiveTab(t => ({ ...t, orderType: typeof val === 'function' ? val(t.orderType) : val }));
  };

  const setSelectedTableId = (val: number | null | ((prev: number | null) => number | null)) => {
    updateActiveTab(t => ({ ...t, selectedTableId: typeof val === 'function' ? val(t.selectedTableId) : val }));
  };

  const setActiveKotId = (val: number | null | ((prev: number | null) => number | null)) => {
    updateActiveTab(t => ({ ...t, activeKotId: typeof val === 'function' ? val(t.activeKotId) : val }));
  };

  const setActiveSaleVoucherNo = (val: string | null | ((prev: string | null) => string | null)) => {
    updateActiveTab(t => ({ ...t, activeSaleVoucherNo: typeof val === 'function' ? val(t.activeSaleVoucherNo) : val }));
  };

  const setRemarks = (val: string | ((prev: string) => string)) => {
    updateActiveTab(t => ({ ...t, remarks: typeof val === 'function' ? val(t.remarks) : val }));
  };

  // Dialogs
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [isNarrationModalVisible, setIsNarrationModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [savedVoucherNo, setSavedVoucherNo] = useState<string>('');
  const [savedTokenNo, setSavedTokenNo] = useState<number | null>(null);
  const [savedOrderType, setSavedOrderType] = useState<string>('Takeaway');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>('');

  // Printer Configuration States
  const [connectionMethod] = useState<ConnectionMethod>(() => {
    const saved = localStorage.getItem('pos_printer_method');
    if (saved) return saved as ConnectionMethod;
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('CrOS')) {
      return 'WEB_USB';
    }
    return 'LOCAL_RELAY';
  });
  const [printerName] = useState<string>(() => {
    return localStorage.getItem('pos_printer_name') || 'XP-80';
  });
  const [openDrawer] = useState<boolean>(false);
  const [cutPaper] = useState<boolean>(() => {
    const saved = localStorage.getItem('pos_printer_cut_paper');
    return saved !== null ? saved === 'true' : true;
  });

  const currencyNotes = [1, 2, 5, 10, 20, 50, 100, 500, 1000, 5000];

  const noteStyles: Record<number, { bg: string; border: string; text: string }> = {
    1: { bg: 'linear-gradient(135deg, #b45309, #d97706)', border: '#b45309', text: '#ffffff' },
    2: { bg: 'linear-gradient(135deg, #94a3b8, #cbd5e1)', border: '#94a3b8', text: '#1e293b' },
    5: { bg: 'linear-gradient(135deg, #ca8a04, #eab308)', border: '#ca8a04', text: '#ffffff' },
    10: { bg: 'linear-gradient(135deg, #15803d, #22c55e)', border: '#15803d', text: '#ffffff' },
    20: { bg: 'linear-gradient(135deg, #c2410c, #f97316)', border: '#c2410c', text: '#ffffff' },
    50: { bg: 'linear-gradient(135deg, #6b21a8, #a855f7)', border: '#6b21a8', text: '#ffffff' },
    100: { bg: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '#b91c1c', text: '#ffffff' },
    500: { bg: 'linear-gradient(135deg, #047857, #10b981)', border: '#047857', text: '#ffffff' },
    1000: { bg: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '#1d4ed8', text: '#ffffff' },
    5000: { bg: 'linear-gradient(135deg, #a16207, #eab308)', border: '#a16207', text: '#ffffff' }
  };

  useEffect(() => {
    offlineCacheService.getCustomers()
      .then(data => {
        setCustomers(data);
        if (data.length > 0) {
            setTabs(prev => prev.map(t => ({...t, selectedCustomer: data[0]})));
        }
      })
      .catch(err => {
        if (err instanceof OfflineCacheMissError) {
          message.warning('Customer data not cached. Please go online first.');
        }
      });

    itemCategoryService.getActiveItemCategoriesLookup().then(setCategories);

    offlineCacheService.getItems()
      .then(setItems)
      .catch(err => {
        if (err instanceof OfflineCacheMissError) {
          message.warning('Item data not cached. Please go online first.');
        }
      });

    offlineCacheService.getNarrations()
      .then(setNarrations)
      .catch(() => { /* Non-critical */ });

    offlineCacheService.getUnits()
      .then(setUnits)
      .catch(() => { /* Non-critical */ });

    inventoryService.getCustomerCategoryPrices()
      .then(setCategoryPrices)
      .catch(() => { /* Non-critical */ });

    if (hasDineInFeature) {
      kotService.getDiningTables()
        .then(setDiningTables)
        .catch(console.error);
    }

    if (hasKotFeature) {
      fetchActiveKots();
    }
  }, [hasDineInFeature, hasKotFeature, fetchActiveKots]);

  // Periodic refresh of active KOTs every 20 seconds while POS screen is active
  useEffect(() => {
    if (!hasKotFeature) return;
    fetchActiveKots();
    const interval = setInterval(() => {
      fetchActiveKots();
    }, 20000);
    return () => clearInterval(interval);
  }, [hasKotFeature, fetchActiveKots]);

  const resolveCustomerItemRate = (itemId: string, customerAccount?: string | null, unit?: string): number => {
    const item = items.find(i => i.id === itemId);
    if (!item) return 0;
    const isSec = !!(unit && item.secondaryUnit && unit.trim().toLowerCase() === item.secondaryUnit.trim().toLowerCase());
    const defaultRate = isSec ? (item.secRate || item.priRate || 0) : (item.priRate || 0);
    if (!customerAccount) return defaultRate;

    const cust = customers.find(c => c.account === customerAccount);
    if (!cust?.customerCategoryId) return defaultRate;

    const catPrice = categoryPrices.find(p => p.itemId === itemId && p.customerCategoryId === cust.customerCategoryId);
    if (catPrice) {
      if (isSec && catPrice.secRate != null && catPrice.secRate > 0) {
        return catPrice.secRate;
      }
      if (!isSec && catPrice.priRate > 0) {
        return catPrice.priRate;
      }
    }
    return defaultRate;
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.itemCategoryCode === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchItemQuery.toLowerCase()) || 
                          (item.barcode && item.barcode.includes(searchItemQuery));
    return matchesCategory && matchesSearch;
  });

  const filteredCustomers = customers.filter(c => 
    c.title.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
    c.account.includes(searchCustomerQuery)
  );

  const handleAddToCart = (item: Item, scanQty: number = 1, customRate?: number, customUnit?: string) => {
    const unit = customUnit || item.defaultUnit || item.primaryUnit || '';
    const catRate = resolveCustomerItemRate(item.id, selectedCustomer?.account, unit);
    const effectiveRate = customRate !== undefined ? customRate : catRate;

    setCart(prev => {
      // If same record with SAME price exists in cart, increment quantity; otherwise add new row
      const existing = prev.find(
        i => i.item.id === item.id && Math.abs((i.rate || 0) - effectiveRate) < 0.001
      );

      if (existing) {
        return prev.map(i => {
          if (i.item.id === item.id && Math.abs((i.rate || 0) - effectiveRate) < 0.001) {
            const factor = i.selectedUnitFactor || 1;
            const newQty = Math.round(((i.qty + scanQty) + Number.EPSILON) * 1000) / 1000;
            const newDisplayQty = Number((newQty * factor).toFixed(4));
            return {
              ...i,
              qty: newQty,
              displayQty: newDisplayQty
            };
          }
          return i;
        });
      } else {
        return [...prev, {
          item,
          qty: scanQty,
          rate: effectiveRate,
          discount: 0,
          unit: customUnit || item.defaultUnit || item.primaryUnit || '',
          selectedUnitId: item.defaultUnit || item.primaryUnit || '',
          selectedUnitFactor: 1,
          displayQty: scanQty
        }];
      }
    });

    if (scanQty !== 1 || customRate !== undefined) {
      message.success(`Added: ${item.title} (${scanQty} ${customUnit || item.defaultUnit || item.primaryUnit || 'unit'} @ Rs. ${effectiveRate})`);
    } else {
      message.success(`${item.title} added to cart`);
    }
  };

  const handleUpdateQty = (itemId: string, increment: boolean) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const resolved = i.selectedUnitId
          ? { displayQty: i.displayQty ?? i.qty, selectedUnitId: i.selectedUnitId, factor: i.selectedUnitFactor || 1 }
          : resolveDisplayQtyAndUnit(i.qty, i.item, units as any);
        const step = resolved.factor > 1 ? (resolved.factor >= 1000 ? 50 : 1) : 1;
        const nextDisplayQty = increment ? resolved.displayQty + step : resolved.displayQty - step;
        if (nextDisplayQty <= 0) return i;
        return {
          ...i,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          displayQty: nextDisplayQty,
          qty: toBasePrimaryQty(nextDisplayQty, resolved.factor)
        };
      }
      return i;
    }));
  };

  const handleSetCartItemDisplayQty = (itemId: string, newDisplayQty: number | null) => {
    const cleanVal = newDisplayQty !== null && !isNaN(Number(newDisplayQty)) ? Number(newDisplayQty) : 0;
    if (cleanVal <= 0) return;
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const resolved = i.selectedUnitId
          ? { selectedUnitId: i.selectedUnitId, factor: i.selectedUnitFactor || 1 }
          : resolveDisplayQtyAndUnit(i.qty, i.item, units as any);
        return {
          ...i,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          displayQty: cleanVal,
          qty: toBasePrimaryQty(cleanVal, resolved.factor)
        };
      }
      return i;
    }));
  };

  const handleSetCartItemUnit = (itemId: string, unitId: string) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const selectable = getSelectablePrimaryUnits(i.item, units as any);
        const opt = selectable.find(u => u.unitId === unitId);
        const factor = opt?.factor || 1;
        const newDisplayQty = Number((i.qty * factor).toFixed(4));
        return {
          ...i,
          unit: unitId,
          selectedUnitId: unitId,
          selectedUnitFactor: factor,
          displayQty: newDisplayQty,
          qty: toBasePrimaryQty(newDisplayQty, factor)
        };
      }
      return i;
    }));
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
    message.info('Item removed from cart');
  };

  interface PresetOption {
    label: string;
    value: number;
    type: 'rs' | 'secondary' | 'primary';
    unit?: string;
  }

  const parsePresets = (presetsStr?: string): PresetOption[] => {
    if (!presetsStr) return [];
    try {
      if (presetsStr.trim().startsWith('[')) {
        return JSON.parse(presetsStr);
      }
      return presetsStr.split(',').map(p => p.trim()).filter(Boolean).map(p => {
        const match = p.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
        if (!match) return null;
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        
        let type: 'rs' | 'secondary' | 'primary' = 'primary';
        if (unit === 'rs') {
          type = 'rs';
        } else if (unit === 'g' || unit === 'ml' || unit === 'gram' || unit === 'grams') {
          type = 'secondary';
        }
        
        return {
          label: p,
          value,
          type,
          unit
        } as PresetOption;
      }).filter((x): x is PresetOption => x !== null);
    } catch (e) {
      console.error('Failed to parse quick quantity presets:', e);
      return [];
    }
  };

  const handleAddWithPreset = (item: Item, preset: PresetOption) => {
    let targetQty = 1;
    const targetUnit = item.defaultUnit || item.primaryUnit || '';
    const targetRate = resolveCustomerItemRate(item.id, selectedCustomer?.account, targetUnit);

    if (preset.type === 'rs') {
      if (targetRate > 0) {
        targetQty = parseFloat((preset.value / targetRate).toFixed(4));
      }
    } else if (preset.type === 'secondary') {
      const subUnits = getEffectiveSubUnits(item, units as any);
      const subFactor = subUnits.length > 0 && subUnits[0].factor > 1 ? subUnits[0].factor : (item.qtyInPack && item.qtyInPack > 1 ? item.qtyInPack : 1000);
      targetQty = parseFloat((preset.value / subFactor).toFixed(4));
    } else {
      targetQty = preset.value;
    }

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        const nextQty = parseFloat((existing.qty + targetQty).toFixed(4));
        const resolved = resolveDisplayQtyAndUnit(nextQty, item, units as any);
        return prev.map(i => i.item.id === item.id ? {
          ...i,
          qty: nextQty,
          unit: targetUnit,
          rate: targetRate,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          displayQty: resolved.displayQty
        } : i);
      } else {
        const resolved = resolveDisplayQtyAndUnit(targetQty, item, units as any);
        return [...prev, {
          item,
          qty: targetQty,
          rate: targetRate,
          discount: 0,
          unit: targetUnit,
          selectedUnitId: resolved.selectedUnitId,
          selectedUnitFactor: resolved.factor,
          displayQty: resolved.displayQty
        }];
      }
    });
    message.success(`Added ${item.title} (${preset.label}) to cart`);
  };

  const grossTotal = cart.reduce((sum, line) => sum + (line.qty * line.rate), 0);
  const totalItemDiscount = cart.reduce((sum, line) => sum + (line.qty * line.discount), 0);
  const percentDiscountAmount = (grossTotal - totalItemDiscount) * (discountPercent / 100);
  const totalDiscount = totalItemDiscount + percentDiscountAmount + discountFlat;
  const netAmount = Math.max(0, grossTotal - totalDiscount);

  const cashReceived = Object.entries(noteCounts).reduce((sum, [note, count]) => sum + (Number(note) * count), 0);
  const cashBack = Math.max(0, cashReceived - netAmount);

  const generateReceiptTextLines = (
    voucherNo: string,
    tokenNoOverride?: number | null,
    orderTypeOverride?: string | null
  ): string[] => {
    const width = 48;
    const lines: string[] = [];

    const activeToken = tokenNoOverride !== undefined ? tokenNoOverride : savedTokenNo;
    const activeType = orderTypeOverride !== undefined ? orderTypeOverride : savedOrderType;

    const format4Columns = (col1: string, col2: string, col3: string, col4: string): string => {
      const w1 = 20;
      const w2 = 5;
      const w3 = 10;
      const w4 = 13;

      let c1 = col1.trim();
      if (c1.length > w1 - 1) {
        c1 = c1.substring(0, w1 - 1);
      }
      c1 = c1.padEnd(w1, ' ');

      let c2 = col2.trim();
      if (c2.length > w2) c2 = c2.substring(0, w2);
      c2 = c2.padStart(w2, ' ');

      let c3 = col3.trim();
      if (c3.length > w3) c3 = c3.substring(0, w3);
      c3 = c3.padStart(w3, ' ');

      let c4 = col4.trim();
      if (c4.length > w4) c4 = c4.substring(0, w4);
      c4 = c4.padStart(w4, ' ');

      return c1 + c2 + c3 + c4;
    };

    // Header styling using ESC/POS native alignment and sizing (double-size only, without extra bold to avoid over-weight strokes)
    lines.push(ESC_ALIGN_CENTER + ESC_DOUBLE_ON + currentOrgName.toUpperCase());
    lines.push(ESC_DOUBLE_OFF + 'Sale Receipt');

    if (activeToken) {
      lines.push(divider('*', width));
      lines.push(ESC_DOUBLE_ON + `TOKEN #${activeToken}` + ESC_DOUBLE_OFF);
      lines.push(`[${(activeType || 'TAKEAWAY').toUpperCase()}]`);
      lines.push(divider('*', width));
    }

    lines.push(`Voucher: ${voucherNo}`);
    lines.push(`Date: ${dayjs().format('DD-MMM-YYYY HH:mm')}`);
    lines.push(ESC_ALIGN_LEFT + divider('-', width));

    lines.push(`Customer: ${selectedCustomer?.title || 'Walk-in Customer'}`);
    if (selectedNarration) {
      lines.push(`Narration: ${selectedNarration.title}`);
    }
    lines.push(divider('-', width));

    lines.push(format4Columns('Item', 'Qty', 'Price', 'Amount'));
    lines.push(divider('-', width));

    cart.forEach(line => {
      const itemTitle = line.item.title;
      const resolved = resolveDisplayQtyAndUnit(line.qty, line.item, units as any);
      const qtyStr = resolved.factor > 1 ? `${resolved.displayQty}${resolved.unitLabel}` : line.qty.toString();
      const priceStr = line.rate.toString(); 
      const amountStr = (line.qty * line.rate).toFixed(2);
      lines.push(format4Columns(itemTitle, qtyStr, priceStr, amountStr));
    });
    lines.push(divider('-', width));

    lines.push(padLine('Gross Total:', `Rs. ${grossTotal.toFixed(2)}`, width));
    if (totalDiscount > 0) {
      lines.push(padLine('Discount:', `-Rs. ${totalDiscount.toFixed(2)}`, width));
    }
    lines.push(divider('=', width));
    
    // Bold Net Amount
    lines.push(ESC_BOLD_ON + padLine('Net Amount:', `Rs. ${netAmount.toFixed(2)}`, width));
    lines.push(ESC_BOLD_OFF + padLine('Cash Received:', `Rs. ${cashReceived.toFixed(2)}`, width));
    lines.push(padLine('Cash Back / Change:', `Rs. ${cashBack.toFixed(2)}`, width));
    lines.push(divider('-', width));

    const thankYouMsg = getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT);
    if (thankYouMsg) {
      lines.push(ESC_ALIGN_CENTER + thankYouMsg);
    }
    if (savedTokenNo) {
      lines.push(ESC_ALIGN_CENTER + ESC_BOLD_ON + `*** TOKEN #${savedTokenNo} ***`);
      lines.push('Please collect your order at the Kitchen Counter' + ESC_BOLD_OFF);
    }
    lines.push(ESC_ALIGN_LEFT); // Reset alignment to default
    lines.push('');
    lines.push('');
    lines.push('');

    return lines;
  };

  const receiptLines = generateReceiptTextLines(savedVoucherNo);

  const { print: printThermal, loading: printerLoading } = useThermalPrinter(
    receiptLines,
    connectionMethod,
    {
      printerName,
      openDrawer,
      cutPaper
    }
  );

  const handleNoteTap = (note: number) => {
    setNoteCounts(prev => ({
      ...prev,
      [note]: prev[note] + 1
    }));
  };

  const handleResetCash = () => {
    setNoteCounts({ 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 });
    message.info('Cash received reset');
  };

  const handleExactCash = () => {
    let remaining = Math.ceil(netAmount);
    const newCounts: Record<number, number> = { 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 };
    
    const sortedNotes = [...currencyNotes].reverse();
    for (const note of sortedNotes) {
      if (remaining >= note) {
        const count = Math.floor(remaining / note);
        newCounts[note] = count;
        remaining %= note;
      }
    }
    if (remaining > 0) {
      newCounts[1] = (newCounts[1] || 0) + remaining;
    }
    setNoteCounts(newCounts);
    message.success('Auto-selected exact cash notes');
  };

  const handleQuickDiscount = (pct: number) => {
    setDiscountPercent(pct);
    setDiscountFlat(0);
    message.success(`Applied ${pct}% Discount`);
  };

  const handleQuickFlatDiscount = (flat: number) => {
    setDiscountFlat(flat);
    setDiscountPercent(0);
    message.success(`Applied Rs. ${flat} Discount`);
  };

  const handleResetAll = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountFlat(0);
    handleResetCash();
    setSelectedNarration(null);
    if (customers.length > 0) {
      setSelectedCustomer(customers[0]);
    }
    setSearchItemQuery('');
    setActiveCategory('all');
    setRemarks('');
    setSelectedTableId(null);
    setActiveKotId(null);
    setActiveSaleVoucherNo(null);
    setOrderType('Takeaway');
  };

  const handleSaveSale = async () => {
    if (cart.length === 0) {
      message.error('Cart is empty. Please add at least one item');
      return;
    }
    if (!selectedCustomer) {
      message.error('Please select a customer');
      return;
    }

    setLoading(true);
    try {
      const saleRequest = {
        date: dayjs().format('YYYY-MM-DD'),
        account: selectedCustomer.account,
        narration: selectedNarration?.code || undefined,
        description: activeKotId 
          ? `KOT Order Paid (Token #${activeKots.find(k => k.id === activeKotId)?.tokenNo || ''})` 
          : 'Touch Screen POS Sale',
        cashReceipt: cashReceived,
        cashBack: cashBack,
        lines: cart.map((line, idx) => ({
          seq: idx + 1,
          itemId: line.item.id,
          unit: line.item.itemType === 'Service' ? null : (line.unit || null),
          qty: line.qty,
          rate: line.rate,
          discount: line.discount
        }))
      };

      let finalVoucherNo = activeSaleVoucherNo;
      let tokenNumber: number | null = null;

      if (activeSaleVoucherNo && !activeSaleVoucherNo.includes('-')) {
        // DINE-IN PAYMENT SETTLEMENT LATER:
        // The sale invoice ALREADY exists and stock was already deducted when KOT was placed!
        // DO NOT CREATE A NEW SALE! Just update existing voucher with cashReceipt and cashBack!
        await saleService.update(activeSaleVoucherNo, saleRequest);
        finalVoucherNo = activeSaleVoucherNo;

        // Finalize KOT payment
        if (activeKotId) {
          try {
            await kotService.finalizePayment(activeKotId, finalVoucherNo);
            tokenNumber = activeKots.find(k => k.id === activeKotId)?.tokenNo || null;
            fetchActiveKots();
          } catch (kotErr) {
            console.error('Failed to finalize KOT payment', kotErr);
          }
        }
        // NO NEW KOT IS GENERATED — 1 BILL = 1 KOT!
      } else {
        // PREPAID COUNTER SALE (Takeaway / Direct Checkout):
        // Create the sale invoice now (reduces stock immediately!)
        finalVoucherNo = await saleService.create(saleRequest, { offlineFallback: true });

        if (activeKotId && !finalVoucherNo.includes('-')) {
          try {
            await kotService.finalizePayment(activeKotId, finalVoucherNo);
            tokenNumber = activeKots.find(k => k.id === activeKotId)?.tokenNo || null;
            fetchActiveKots();
          } catch (kotErr) {
            console.error('Failed to finalize KOT payment', kotErr);
          }
        } else if (hasKotFeature && !finalVoucherNo.includes('-')) {
          // Exactly 1 KOT order is created for this prepaid sale:
          try {
            const kotRequest = {
              orderType: orderType || 'Takeaway',
              tableId: orderType === 'DineIn' ? (selectedTableId || undefined) : undefined,
              customerId: selectedCustomer.account || undefined,
              remarks: remarks || undefined,
              saleVoucherNo: finalVoucherNo,
              status: !hasKdsFeature ? 'Served' : 'Pending',
              lines: cart.map(line => ({
                itemId: line.item.id,
                qty: line.qty,
                rate: line.rate,
                notes: undefined
              }))
            };
            const createdKot = await kotService.create(kotRequest);
            tokenNumber = createdKot.tokenNo;
            fetchActiveKots();

            if (hasVoiceCallout) {
              speakKotOrder({
                tokenNo: createdKot.tokenNo,
                orderType: orderType || 'Takeaway',
                tableName: diningTables.find(t => t.id === selectedTableId)?.name,
                lines: cart.map(c => ({ itemTitle: c.item.title, qty: c.qty }))
              }, { rate: voiceSpeed, accent: voiceAccent });
            }

            try {
              await printKotSlip(createdKot, connectionMethod, { printerName, cutPaper });
            } catch (kPrintErr) {
              console.warn('Failed to print KOT slip', kPrintErr);
            }
          } catch (kotErr) {
            console.error('Failed to auto-create prepaid KOT', kotErr);
          }
        }
      }

      setSavedTokenNo(tokenNumber);
      setSavedOrderType(orderType || 'Takeaway');

      // Auto-print customer bill receipt on sale creation (prints both KOT and Bill for takeaway)
      try {
        const billLines = generateReceiptTextLines(finalVoucherNo, tokenNumber, orderType || 'Takeaway');
        await printDirect(billLines, connectionMethod, { printerName, openDrawer, cutPaper });
      } catch (billPrintErr) {
        console.warn('Failed to auto-print bill receipt', billPrintErr);
      }

      const isOfflineResult = finalVoucherNo ? (finalVoucherNo.includes('-') && finalVoucherNo.length <= 10) : false;
      setIsOfflineSaved(isOfflineResult);
      setSavedVoucherNo(finalVoucherNo || '');
      setIsPaymentModalVisible(false);
      setSuccessModalVisible(true);
      
      if (isOfflineResult) {
        message.warning(`Saved offline as ${finalVoucherNo} — will sync when you reconnect`, 6);
      } else {
        message.success(tokenNumber ? `Payment settled for Token #${tokenNumber} (Bill #${finalVoucherNo})` : `Sale #${finalVoucherNo} saved successfully`);
      }
    } catch (error) {
      console.error(error);
      message.error('Failed to save POS sale');
    } finally {
      setLoading(false);
    }
  };



  const handleSaveKot = async () => {
    if (orderType === 'Takeaway') {
      // For takeaway, payment and KOT are completed together in one step!
      setIsPaymentModalVisible(true);
      return;
    }

    if (cart.length === 0) {
      message.error('Cart is empty. Please add items to order');
      return;
    }
    if (!selectedCustomer) {
      message.error('Please select a customer');
      return;
    }

    setLoading(true);
    try {
      let voucherNoToLink = activeSaleVoucherNo;

      const saleRequest = {
        date: dayjs().format('YYYY-MM-DD'),
        account: selectedCustomer.account,
        narration: selectedNarration?.code || undefined,
        description: orderType === 'DineIn' 
          ? `Dine-In Kitchen Order (Table: ${diningTables.find(t => t.id === selectedTableId)?.name || 'N/A'})` 
          : 'Kitchen Order (Unpaid)',
        cashReceipt: 0,
        cashBack: 0,
        lines: cart.map((line, idx) => ({
          seq: idx + 1,
          itemId: line.item.id,
          unit: line.item.itemType === 'Service' ? null : (line.unit || null),
          qty: line.qty,
          rate: line.rate,
          discount: line.discount
        }))
      };

      if (activeSaleVoucherNo && !activeSaleVoucherNo.includes('-')) {
        // Order was loaded and more items added: update existing sale invoice (deducts new items stock!)
        await saleService.update(activeSaleVoucherNo, saleRequest);
      } else {
        // Create new Sale invoice immediately (reduces inventory stock right on order placement!)
        voucherNoToLink = await saleService.create(saleRequest, { offlineFallback: true });
      }

      // Ensure exactly 1 KOT ticket is maintained for this sale invoice:
      let kotOrder: KotOrderResponse;
      let isRunning = false;
      const newItemsToPrint: { itemTitle: string; qty: number; notes?: string }[] = [];

      if (activeKotId) {
        // EXISTING KOT: The user added more items to an existing order!
        const existingDetail = await kotService.getByTokenOrId(activeKotId.toString());
        const previousLines = existingDetail?.lines || [];

        // Calculate ONLY the newly added items:
        const existingQtyMap = new Map<string, number>();
        previousLines.forEach(l => {
          existingQtyMap.set(l.itemId, (existingQtyMap.get(l.itemId) || 0) + l.qty);
        });

        // Determine additional items/quantities
        const additionalItemsRequest: { itemId: string; qty: number; rate: number; notes?: string }[] = [];
        cart.forEach(c => {
          const prevQty = existingQtyMap.get(c.item.id) || 0;
          if (c.qty > prevQty) {
            const addedQty = c.qty - prevQty;
            additionalItemsRequest.push({
              itemId: c.item.id,
              qty: addedQty,
              rate: c.rate,
              notes: undefined
            });
            newItemsToPrint.push({
              itemTitle: c.item.title,
              qty: addedQty,
              notes: undefined
            });
          }
        });

        if (additionalItemsRequest.length > 0) {
          isRunning = true;
          kotOrder = await kotService.appendLines(activeKotId, additionalItemsRequest);
        } else {
          kotOrder = existingDetail || ({ id: activeKotId, tokenNo: 0, lines: [] } as any);
        }
      } else {
        // NEW ORDER:
        const kotRequest = {
          orderType: orderType,
          tableId: orderType === 'DineIn' ? (selectedTableId || undefined) : undefined,
          customerId: selectedCustomer?.account || undefined,
          remarks: remarks || undefined,
          saleVoucherNo: voucherNoToLink || undefined,
          lines: cart.map(line => ({
            itemId: line.item.id,
            qty: line.qty,
            rate: line.rate,
            notes: undefined
          }))
        };
        kotOrder = await kotService.create(kotRequest);
      }

      if (isRunning) {
        message.success(`Running KOT #${kotOrder.tokenNo} sent to kitchen with ${newItemsToPrint.length} additional item(s)!`);
        if (hasVoiceCallout) {
          speakKotOrder({
            tokenNo: kotOrder.tokenNo,
            orderType: orderType || 'DineIn',
            tableName: diningTables.find(t => t.id === selectedTableId)?.name,
            lines: newItemsToPrint.map(c => ({ itemTitle: c.itemTitle, qty: c.qty })),
            isRunning: true
          }, { rate: voiceSpeed, accent: voiceAccent });
        }
        try {
          // Print ONLY the newly added items on the kitchen slip!
          await printKotSlip(kotOrder, connectionMethod, { 
            printerName, 
            cutPaper, 
            isRunningKot: true, 
            itemsToPrint: newItemsToPrint 
          });
        } catch (printErr) {
          console.warn('Failed to print Running KOT slip', printErr);
        }
      } else {
        message.success(`KOT #${kotOrder.tokenNo} sent to kitchen! (Bill #${voucherNoToLink} created, inventory deducted)`);
        if (hasVoiceCallout) {
          speakKotOrder({
            tokenNo: kotOrder.tokenNo,
            orderType: orderType || 'DineIn',
            tableName: diningTables.find(t => t.id === selectedTableId)?.name,
            lines: cart.map(c => ({ itemTitle: c.item.title, qty: c.qty })),
            isRunning: false
          }, { rate: voiceSpeed, accent: voiceAccent });
        }
        try {
          await printKotSlip(kotOrder, connectionMethod, { printerName, cutPaper });
        } catch (printErr) {
          console.warn('Failed to print KOT slip', printErr);
        }
      }

      handleResetAll();
      fetchActiveKots();
    } catch (err) {
      console.error(err);
      message.error('Failed to send order to kitchen');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadKot = async (kotOrder: KotOrderResponse) => {
    try {
      const detail = await kotService.getByTokenOrId(kotOrder.id.toString());
      if (!detail) {
        message.error('Order details not found');
        return;
      }
      
      const cartItems: CartItem[] = detail.lines.map(line => {
        const matchedItem = items.find(i => i.id === line.itemId);
        return {
          item: matchedItem || {
            id: line.itemId,
            title: line.itemTitle,
            itemKey: '',
            priRate: line.rate,
            secRate: 0,
            primaryUnit: 'Pcs',
            secondaryUnit: 'Pcs',
            defaultUnit: 'Pcs',
            qtyInPack: 1,
            alert: false,
            itemCategoryCode: line.itemCategoryCode || '',
            itemType: 'Standard'
          },
          qty: line.qty,
          rate: line.rate,
          discount: 0,
          unit: matchedItem?.defaultUnit || 'Pcs'
        };
      });
      
      const tabUpdates: Partial<InvoiceTab> = {
        selectedTableId: detail.tableId || null,
        orderType: detail.orderType,
        remarks: detail.remarks || '',
        activeKotId: detail.id,
        activeSaleVoucherNo: detail.saleVoucherNo || null,
        cart: cartItems
      };

      if (detail.customerId) {
        const foundCust = customers.find(c => c.account === detail.customerId);
        if (foundCust) {
          tabUpdates.selectedCustomer = foundCust;
        }
      }
      
      updateActiveTab(tabUpdates);
      setIsKotModalVisible(false);
      message.success(`KOT order loaded for Token #${detail.tokenNo}`);
    } catch (err) {
      console.error(err);
      message.error('Failed to load KOT details');
    }
  };

  const handlePrintReceipt = async () => {
    try {
      await printThermal();
      message.success('Print job submitted successfully');
    } catch (err: any) {
      message.error(err.message || 'Printing failed');
    }
  };

  const handleCloseActiveTabAfterSave = () => {
    setSuccessModalVisible(false);
    setIsOfflineSaved(false);
    setSavedTokenNo(null);
    setSavedOrderType('Takeaway');
    
    const tabToCloseId = activeTabId;
    if (tabs.length === 1) {
      handleResetAll();
    } else {
      const tabToCloseIndex = tabs.findIndex(t => t.id === tabToCloseId);
      const newTabs = tabs.filter(t => t.id !== tabToCloseId);
      setTabs(newTabs);
      const nextActiveIndex = Math.min(tabToCloseIndex, newTabs.length - 1);
      setActiveTabId(newTabs[nextActiveIndex].id);
      message.info("Transaction closed");
    }
  };

  const handleAddTab = () => {
    const nextNum = tabs.length > 0 ? Math.max(...tabs.map(t => {
      const match = t.name.match(/Tab\s+(\d+)/);
      return match ? parseInt(match[1]) : 0;
    })) + 1 : 1;

    const newTabId = Date.now().toString();
    const newTab: InvoiceTab = {
      id: newTabId,
      name: `Tab ${nextNum}`,
      selectedCustomer: customers.length > 0 ? customers[0] : null,
      selectedNarration: null,
      cart: [],
      discountPercent: 0,
      discountFlat: 0,
      noteCounts: { 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 },
      searchItemQuery: '',
      activeCategory: 'all',
      orderType: 'Takeaway',
      selectedTableId: null,
      activeKotId: null,
      activeSaleVoucherNo: null,
      remarks: ''
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    message.success(`Created Tab ${nextNum}`);
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
        setActiveTabId(newTabs[nextActiveIndex].id);
      }
      message.info(`Closed ${targetTab.name}`);
    };

    if (targetTab.cart.length > 0) {
      Modal.confirm({
        title: 'Discard Invoice?',
        content: `"${targetTab.name}" has items in the cart. Are you sure you want to discard this draft?`,
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

  return (
    <div style={{ margin: -24, padding: 24, height: 'calc(100vh - 140px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <style>{`
        /* Modern POS Enhancements */
        .pos-search-input {
          transition: all 0.2s ease !important;
          border-color: #cbd5e1 !important;
        }
        .pos-search-input:focus, .pos-search-input:hover {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
        }
        .pos-category-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .pos-category-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .pos-category-btn:active {
          transform: translateY(0);
        }
        .pos-item-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          background: #ffffff;
        }
        .pos-item-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08) !important;
          border-color: #3b82f6 !important;
        }
        .pos-item-card:active {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.06) !important;
        }
        .pos-qty-btn {
          transition: all 0.2s ease !important;
          border-color: #cbd5e1 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .pos-qty-btn:hover {
          transform: scale(1.1);
          background-color: #f1f5f9 !important;
          border-color: #94a3b8 !important;
          color: #0f172a !important;
        }
        .pos-qty-btn:active {
          transform: scale(0.95);
        }
        .pos-pay-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative;
          overflow: hidden;
        }
        .pos-pay-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(22, 163, 74, 0.35) !important;
          filter: brightness(1.05);
        }
        .pos-pay-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .pos-cash-note-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .pos-cash-note-btn:hover {
          transform: translateY(-3px) scale(1.02);
          filter: brightness(1.08);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
        }
        .pos-cash-note-btn:active {
          transform: translateY(0) scale(1);
        }
        .pos-cash-coin-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .pos-cash-coin-btn:hover {
          transform: translateY(-3px) scale(1.06);
          filter: brightness(1.08);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2) !important;
        }
        .pos-cash-coin-btn:active {
          transform: translateY(0) scale(1);
        }
        /* Readable, modern scrollbar for touch screen/seniors */
        .pos-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .pos-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
          border: 3px solid #f1f5f9;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        /* Custom styles for Ant Design lists & inputs in modals */
        .pos-modal-list-item {
          transition: all 0.2s ease;
        }
        .pos-modal-list-item:hover {
          background-color: #f8fafc !important;
        }

        /* Multi-tab POS styling */
        .pos-tab-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 6px;
          overflow-x: auto;
          flex-shrink: 0;
        }
        .pos-tab-item {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          height: 52px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          color: #475569;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          user-select: none;
        }
        .pos-tab-item:hover {
          border-color: #94a3b8;
          background: #f8fafc;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .pos-tab-item.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
        .pos-tab-item.active:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
          color: #ffffff;
        }
        .pos-tab-close-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 10px;
          color: inherit;
          opacity: 0.6;
          transition: all 0.2s;
          margin-left: 4px;
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
          height: 52px;
          padding: 0 16px;
          background: #eff6ff;
          border: 1px dashed #3b82f6 !important;
          color: #2563eb;
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pos-tab-add-btn:hover {
          background: #dbeafe;
          transform: translateY(-1px);
        }
      `}</style>

      {/* ── Offline mode banner ── */}
      {!isOnline && (
        <Alert
          style={{ marginBottom: 16, flexShrink: 0, borderRadius: 12, padding: '12px 20px', fontSize: 15 }}
          type="warning"
          showIcon
          icon={<DisconnectOutlined style={{ fontSize: 18 }} />}
          message={
            <span>
              <strong>OFFLINE MODE ACTIVE</strong> — Sales will be saved locally and auto-synced when you reconnect.
            </span>
          }
        />
      )}

      {/* ── POS Multi-Tab Bar ── */}
      <div className="pos-tab-container pos-scrollbar">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          
          // Calculate totals for each tab
          const gross = tab.cart.reduce((sum, line) => sum + (line.qty * line.rate), 0);
          const itemDisc = tab.cart.reduce((sum, line) => sum + (line.qty * line.discount), 0);
          const pctDisc = (gross - itemDisc) * (tab.discountPercent / 100);
          const totalDisc = itemDisc + pctDisc + tab.discountFlat;
          const net = Math.max(0, gross - totalDisc);
          const qtyCount = tab.cart.reduce((sum, line) => sum + line.qty, 0);
          
          const customerTitle = tab.selectedCustomer?.title || 'Walk-in Customer';
          
          return (
            <div
              key={tab.id}
              className={`pos-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <FileTextOutlined style={{ fontSize: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 160 }}>
                  {customerTitle}
                </span>
                <span style={{ fontSize: 11, opacity: isActive ? 0.95 : 0.65, fontWeight: 600 }}>
                  {qtyCount} {qtyCount === 1 ? 'item' : 'items'} • Rs. {net.toLocaleString()}
                </span>
              </div>

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
          <PlusOutlined /> New Customer Tab
        </button>
      </div>

      {/* Main Terminal Area */}
      <div style={{ display: 'flex', flex: 1, gap: 24, overflow: 'hidden' }}>
        
        {/* Left Side: Category selector and Item grid (65% width) */}
        <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Search bar & Touch Controls Row */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            {/* Search Input */}
            <Input
              className="pos-search-input"
              prefix={<SearchOutlined style={{ color: '#64748b', fontSize: 18 }} />}
              placeholder="Search products or scan barcode (Enter)..."
              value={searchItemQuery}
              onChange={e => setSearchItemQuery(e.target.value)}
              onPressEnter={() => {
                const query = searchItemQuery.trim();
                if (!query) return;

                // Use unified barcode parser (Smart Code-128, EAN-13 Scale, Multiplier, Standard)
                const parseResult = parseBarcodePayload(query, items);

                if (parseResult) {
                  const { matchedItem, qty, rate, unit } = parseResult;
                  handleAddToCart(matchedItem, qty, rate, unit);
                  setSearchItemQuery('');
                  if (getSetting(BARCODE_FAST_SCAN_SOUND_KEY, 'true') !== 'false') {
                    playScanSuccessTone();
                  }
                } else if (filteredItems.length === 1) {
                  // Fallback: single item left in filtered search results
                  handleAddToCart(filteredItems[0]);
                  setSearchItemQuery('');
                  if (getSetting(BARCODE_FAST_SCAN_SOUND_KEY, 'true') !== 'false') {
                    playScanSuccessTone();
                  }
                } else {
                  if (getSetting(BARCODE_FAST_SCAN_SOUND_KEY, 'true') !== 'false') {
                    playScanErrorTone();
                  }
                  message.warning(`No item found matching barcode "${query}"`);
                }
              }}
              style={{ height: 50, borderRadius: 12, fontSize: 15, flex: 1.5 }}
              suffix={
                searchItemQuery && (
                  <Button 
                    type="text" 
                    onClick={() => setSearchItemQuery('')} 
                    style={{ 
                      margin: 0, 
                      padding: '0 10px', 
                      height: 30, 
                      fontSize: 13, 
                      fontWeight: 700,
                      backgroundColor: '#e2e8f0',
                      borderRadius: 6
                    }}
                  >
                    Clear
                  </Button>
                )
              }
            />

            {/* Active KOTs Button */}
            {hasKotFeature && (
              <Badge count={activeKots.length} overflowCount={99} size="small" style={{ backgroundColor: '#f97316' }}>
                <Button 
                  type="default" 
                  icon={<InboxOutlined style={{ fontSize: 16 }} />} 
                  onClick={() => {
                    fetchActiveKots();
                    setIsKotModalVisible(true);
                  }}
                  style={{ 
                    height: 50, 
                    borderRadius: 12, 
                    fontWeight: 700, 
                    fontSize: 14,
                    color: '#ea580c',
                    borderColor: '#ffedd5',
                    backgroundColor: '#fff7ed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%'
                  }}
                >
                  Active KOTs
                </Button>
              </Badge>
            )}

            {/* Customer select button */}
            <Button 
              type="primary" 
              icon={<UserOutlined style={{ fontSize: 14 }} />} 
              onClick={() => setIsCustomerModalVisible(true)}
              style={{ 
                height: 50, 
                borderRadius: 12, 
                fontWeight: 700, 
                fontSize: 14,
                flex: 1,
                backgroundColor: '#0284c7', 
                borderColor: '#0284c7',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              Cust: {selectedCustomer ? selectedCustomer.title : 'Select Customer'}
            </Button>

            {/* Narration Select button */}
            <Button 
              type="default" 
              icon={<FileTextOutlined style={{ fontSize: 14 }} />} 
              onClick={() => setIsNarrationModalVisible(true)}
              style={{ 
                height: 50, 
                borderRadius: 12, 
                fontWeight: 700, 
                fontSize: 14,
                flex: 0.9,
                color: '#334155',
                borderColor: '#cbd5e1',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              Narr: {selectedNarration ? selectedNarration.title : 'None'}
            </Button>

            {/* Clear All button */}
            <Button 
              danger 
              icon={<RedoOutlined style={{ fontSize: 14 }} />} 
              onClick={handleResetAll} 
              style={{ 
                height: 50, 
                borderRadius: 12, 
                fontWeight: 700, 
                fontSize: 14,
                flex: 0.8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              Clear All
            </Button>
          </div>

          {/* Category Tabs */}
          <div 
            className="pos-scrollbar"
            style={{ 
              display: 'flex', 
              gap: 10, 
              overflowX: 'auto', 
              paddingBottom: 10, 
              marginBottom: 16, 
              flexShrink: 0
            }}
          >
            <Button
              className="pos-category-btn"
              type={activeCategory === 'all' ? 'primary' : 'default'}
              onClick={() => setActiveCategory('all')}
              style={{ 
                height: 50, 
                borderRadius: 25, 
                padding: '0 24px 0 10px', 
                fontWeight: 700,
                fontSize: 15,
                backgroundColor: activeCategory === 'all' ? '#2563eb' : '#ffffff',
                borderColor: activeCategory === 'all' ? '#2563eb' : '#e2e8f0',
                color: activeCategory === 'all' ? '#ffffff' : '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: activeCategory === 'all' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <span style={{ fontSize: 20 }}>⭐</span> All Products
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.code}
                className="pos-category-btn"
                type={activeCategory === cat.code ? 'primary' : 'default'}
                onClick={() => setActiveCategory(cat.code)}
                style={{ 
                  height: 50, 
                  borderRadius: 25, 
                  padding: cat.mediaUrl ? '0 24px 0 10px' : '0 28px', 
                  fontWeight: 700,
                  fontSize: 15,
                  backgroundColor: activeCategory === cat.code ? '#2563eb' : '#ffffff',
                  borderColor: activeCategory === cat.code ? '#2563eb' : '#e2e8f0',
                  color: activeCategory === cat.code ? '#ffffff' : '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: activeCategory === cat.code ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 2px 6px rgba(0,0,0,0.02)'
                }}
              >
                {cat.mediaUrl ? (
                  <img 
                    src={cat.mediaUrl} 
                    alt={cat.title} 
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} 
                  />
                ) : (
                  <span style={{ fontSize: 20 }}>📦</span>
                )}
                {cat.title}
              </Button>
            ))}
          </div>

          {/* Items Grid Container */}
          <div className="pos-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            <Row gutter={[12, 12]}>
              {filteredItems.map(item => (
                <Col xs={12} sm={6} md={6} lg={6} xl={6} key={item.id}>
                  <div
                    className="pos-item-card"
                    onClick={() => handleAddToCart(item)}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      height: 240,
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {/* Image area — fills card, full picture visible */}
                    <div style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {item.mediaUrl ? (
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            padding: 4
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 44,
                          fontWeight: 900,
                          color: '#2563eb',
                        }}>
                          {item.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Info strip at bottom */}
                    <div style={{
                      padding: '8px 10px',
                      backgroundColor: '#ffffff',
                      borderTop: '1px solid #f1f5f9',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#0f172a',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        marginBottom: 2,
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div>
                          <span style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: '#16a34a',
                            display: 'block'
                          }}>
                            Rs. {item.priRate}
                          </span>
                          {item.barcode && (
                            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{item.barcode}</span>
                          )}
                        </div>
                        
                        {item.quickQtyPresets && (
                          <Dropdown
                            trigger={['click']}
                            placement="bottomRight"
                            menu={{
                              items: parsePresets(item.quickQtyPresets).map((preset, idx) => ({
                                key: idx.toString(),
                                label: (
                                  <div style={{ fontSize: '15px', padding: '4px 10px', fontWeight: 600, color: '#1e293b' }}>
                                    ⚡ {preset.label}
                                  </div>
                                )
                              })),
                              onClick: ({ key, domEvent }) => {
                                domEvent.stopPropagation();
                                const preset = parsePresets(item.quickQtyPresets)[parseInt(key)];
                                handleAddWithPreset(item, preset);
                              }
                            }}
                          >
                            <Button
                              type="text"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                height: '36px',
                                borderRadius: '18px',
                                padding: '0 14px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                fontWeight: 700,
                                fontSize: '13px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              Quick Qty <DownOutlined style={{ fontSize: '11px', fontWeight: 900 }} />
                            </Button>
                          </Dropdown>
                        )}
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
              {filteredItems.length === 0 && (
                <div style={{ width: '100%', textAlign: 'center', padding: '80px 0', color: '#64748b' }}>
                  <ShoppingCartOutlined style={{ fontSize: 64, marginBottom: 16, color: '#cbd5e1' }} />
                  <p style={{ fontSize: 18, fontWeight: 600 }}>No items found in this category.</p>
                </div>
              )}
            </Row>
          </div>
        </div>

        {/* Right Side: Cart list, currency selectors & pay button (35% width) */}
        <div 
          style={{ 
            flex: 1.2, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            backgroundColor: '#ffffff',
            borderRadius: 20, 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            padding: 20,
            overflow: 'hidden'
          }}
        >
          {/* Cart Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
              <ShoppingCartOutlined style={{ color: '#2563eb', fontSize: 20 }} /> Cart Items
            </span>
            <Badge 
              count={cart.reduce((sum, i) => sum + i.qty, 0)} 
              showZero 
              style={{ backgroundColor: '#2563eb', fontSize: 14, height: 24, minWidth: 24, borderRadius: 12, lineHeight: '24px' }} 
            />
          </div>

          {/* Active KOT loaded Alert */}
          {hasKotFeature && activeKotId && (
            <Alert
              message={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    <strong>Loaded KOT Order: Token #{activeKots.find(k => k.id === activeKotId)?.tokenNo || activeKotId}</strong>
                  </span>
                  {activeSaleVoucherNo && (
                    <Tag color="blue" style={{ fontWeight: 700, margin: 0 }}>
                      Bill #{activeSaleVoucherNo}
                    </Tag>
                  )}
                  <Tag color="cyan" style={{ fontWeight: 700, margin: 0 }}>
                    📦 Stock already deducted on order
                  </Tag>
                </div>
              }
              type="info"
              showIcon
              closable
              onClose={() => {
                handleResetAll();
                message.info('Cleared active KOT Order');
              }}
              style={{ marginBottom: 12, borderRadius: 8 }}
            />
          )}

          {/* Order Type & Dine-in Table Selection */}
          {(hasKotFeature || hasDineInFeature) && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              {hasDineInFeature && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13, color: '#475569' }}>Order Type</Text>
                  <Segmented
                    value={orderType}
                    onChange={(val) => {
                      setOrderType(val as string);
                      if (val !== 'DineIn') setSelectedTableId(null);
                    }}
                    options={[
                      { label: '🏃 Takeaway', value: 'Takeaway' },
                      { label: '🍽️ Dine-In', value: 'DineIn' }
                    ]}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}

              {hasDineInFeature && orderType === 'DineIn' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Select
                    placeholder="Select Dining Table"
                    value={selectedTableId}
                    onChange={setSelectedTableId}
                    style={{ flex: 1 }}
                    dropdownStyle={{ borderRadius: 8 }}
                  >
                    {diningTables.map(table => (
                      <Select.Option key={table.id} value={table.id}>
                        {table.name} (Cap: {table.capacity} | {table.status})
                      </Select.Option>
                    ))}
                  </Select>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={() => {
                      kotService.getDiningTables().then(setDiningTables).catch(console.error);
                      message.success('Tables refreshed');
                    }}
                    title="Refresh tables"
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}

              {hasKotFeature && (
                <div>
                  <Input
                    placeholder="Kitchen remarks/notes..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    style={{ borderRadius: 8 }}
                    prefix={<BookOutlined style={{ color: '#94a3b8' }} />}
                  />
                </div>
              )}
            </div>
          )}

          {/* Cart List */}
          <div className="pos-scrollbar" style={{ flex: 1, overflowY: 'auto', marginBottom: 16, borderBottom: '1px dashed #e2e8f0', paddingRight: 4 }}>
            {cart.map(line => {
              const selectableUnits = getSelectablePrimaryUnits(line.item, units as any);
              const resolved = line.selectedUnitId
                ? {
                    displayQty: line.displayQty ?? line.qty,
                    selectedUnitId: line.selectedUnitId,
                    unitLabel: selectableUnits.find(u => u.unitId === line.selectedUnitId)?.label || '',
                    factor: line.selectedUnitFactor || 1
                  }
                : resolveDisplayQtyAndUnit(line.qty, line.item, units as any);

              return (
              <div 
                key={line.item.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 12px', 
                  borderRadius: 12,
                  backgroundColor: '#f8fafc',
                  marginBottom: 8,
                  border: '1px solid #f1f5f9'
                }}
              >
                {line.item.mediaUrl && (
                  <div 
                    style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '6px', 
                      overflow: 'hidden', 
                      border: '1px solid #e2e8f0',
                      marginRight: '10px',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={line.item.mediaUrl} 
                      alt={line.item.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                )}
                <div style={{ flex: 1.5, minWidth: 0, paddingRight: 8 }}>
                  <Text strong style={{ display: 'block', fontSize: 16, color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {line.item.title}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                      Rs. {line.rate} | Unit: {selectableUnits.find(u => u.unitId === (line.selectedUnitId || line.unit))?.label || units.find(u => u.code === line.unit)?.title || line.unit}
                    </Text>
                    {!!line.item.minSalePrice && Number(line.item.minSalePrice) > 0 && Number(line.rate || 0) <= Number(line.item.minSalePrice) && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        ⚠️ Min Cap (Rs. {line.item.minSalePrice})
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Touch Quantity Controls + Conditional Sub-Unit Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.3, justifyContent: 'center' }}>
                  <Button 
                    className="pos-qty-btn"
                    shape="circle" 
                    icon={<MinusOutlined style={{ fontSize: 12, fontWeight: 900 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, false)}
                    style={{ width: 32, height: 32 }}
                  />
                  <InputNumber
                    size="small"
                    min={0.01}
                    value={resolved.displayQty}
                    onChange={(val) => handleSetCartItemDisplayQty(line.item.id, val)}
                    controls={false}
                    style={{ width: selectableUnits.length > 1 ? 58 : 48, textAlign: 'center', fontWeight: 800 }}
                  />
                  {selectableUnits.length > 1 && (
                    <Select
                      size="small"
                      value={resolved.selectedUnitId}
                      onChange={(unitId) => handleSetCartItemUnit(line.item.id, unitId)}
                      style={{ width: 54 }}
                      popupMatchSelectWidth={false}
                    >
                      {selectableUnits.map(u => (
                        <Select.Option key={u.unitId} value={u.unitId}>
                          {u.label}
                        </Select.Option>
                      ))}
                    </Select>
                  )}
                  <Button 
                    className="pos-qty-btn"
                    shape="circle" 
                    icon={<PlusOutlined style={{ fontSize: 12, fontWeight: 900 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, true)}
                    style={{ width: 32, height: 32 }}
                  />
                </div>

                <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                    Rs. {Math.round((line.qty * line.rate) * 100) / 100}
                  </Text>
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined style={{ fontSize: 14 }} />} 
                    onClick={() => handleRemoveFromCart(line.item.id)}
                    style={{ height: 24, padding: '0 4px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              );
            })}
            {cart.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                <ShoppingCartOutlined style={{ fontSize: 48, marginBottom: 12, color: '#cbd5e1' }} />
                <p style={{ fontSize: 15, fontWeight: 600 }}>Cart is empty.<br />Tap products on the left to add.</p>
              </div>
            )}
          </div>

          {/* Totals & Notes Section Side-by-Side */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexShrink: 0 }}>
            {/* Totals Summary */}
            <div style={{ flex: 1.5, backgroundColor: '#f1f5f9', borderRadius: 12, padding: '10px 14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Gross</Text>
                <Text strong style={{ fontSize: 14, color: '#0f172a' }}>Rs. {grossTotal.toLocaleString()}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Discount</Text>
                <Text strong style={{ fontSize: 14, color: '#ea580c' }}>- Rs. {totalDiscount.toLocaleString()}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Net Due</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#2563eb' }}>Rs. {netAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Right column: Discounts on top, Pay Button on bottom */}
            <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'space-between' }}>
              {/* Quick Discounts Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Button onClick={() => handleQuickDiscount(5)} style={{ flex: 1, minWidth: '32px', height: 28, padding: 0, fontSize: 11, borderRadius: 6, fontWeight: 700 }}>5%</Button>
                  <Button onClick={() => handleQuickDiscount(10)} style={{ flex: 1, minWidth: '32px', height: 28, padding: 0, fontSize: 11, borderRadius: 6, fontWeight: 700 }}>10%</Button>
                  <Button onClick={() => handleQuickFlatDiscount(100)} style={{ flex: 1, minWidth: '36px', height: 28, padding: 0, fontSize: 11, borderRadius: 6, fontWeight: 700 }}>100</Button>
                  <Button onClick={() => handleQuickFlatDiscount(500)} style={{ flex: 1, minWidth: '36px', height: 28, padding: 0, fontSize: 11, borderRadius: 6, fontWeight: 700 }}>500</Button>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <Button danger onClick={() => { setDiscountPercent(0); setDiscountFlat(0); }} style={{ flex: 1, height: 28, padding: 0, fontSize: 11, borderRadius: 6, fontWeight: 800 }}>Reset</Button>
                  {totalDiscount > 0 && (
                    <Tag color="orange" style={{ margin: 0, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      -Rs. {Math.round(totalDiscount)}
                    </Tag>
                  )}
                </div>
              </div>

              {/* Payment Button Row */}
              <div style={{ display: 'flex', gap: 6, width: '100%', alignItems: 'center' }}>
                {hasKotFeature && orderType === 'DineIn' && (
                  <Button
                    type="default"
                    size="large"
                    icon={<FireOutlined style={{ fontSize: 16, color: '#ea580c' }} />}
                    onClick={handleSaveKot}
                    disabled={cart.length === 0}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 10,
                      fontWeight: 800,
                      color: '#ea580c',
                      borderColor: '#f97316',
                      backgroundColor: '#fff7ed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>KOT</span>
                  </Button>
                )}

                {hasKotFeature && (
                  <Badge count={activeKots.length} overflowCount={99} offset={[-4, 4]}>
                    <Button
                      type="default"
                      size="large"
                      icon={<InboxOutlined style={{ fontSize: 16, color: '#0369a1' }} />}
                      onClick={() => {
                        fetchActiveKots();
                        setIsKotModalVisible(true);
                      }}
                      style={{
                        height: 48,
                        borderRadius: 10,
                        fontWeight: 800,
                        color: '#0369a1',
                        borderColor: '#bae6fd',
                        backgroundColor: '#f0f9ff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '0 10px'
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 900 }}>Active KOTs</span>
                    </Button>
                  </Badge>
                )}

                <Button
                  className="pos-pay-btn"
                  type="primary"
                  size="large"
                  icon={<DollarOutlined style={{ fontSize: 18 }} />}
                  onClick={() => {
                    if (cart.length === 0) {
                      message.error('Cart is empty. Please add items');
                      return;
                    }
                    setIsPaymentModalVisible(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flex: hasKotFeature && orderType === 'DineIn' ? 1.3 : 2,
                    height: 48,
                    borderRadius: 10,
                    fontWeight: 800,
                    backgroundColor: '#16a34a',
                    borderColor: '#16a34a',
                    boxShadow: '0 4px 10px rgba(22, 163, 74, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {hasKotFeature && orderType === 'Takeaway' ? 'Pay & Print (KOT + Bill)' : 'Pay Now'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>👥 Touch Customer Directory</div>}
        open={isCustomerModalVisible}
        onCancel={() => setIsCustomerModalVisible(false)}
        footer={null}
        width={550}
        bodyStyle={{ padding: '16px 0 24px' }}
      >
        <div style={{ padding: '0 24px 16px' }}>
          <Input
            className="pos-search-input"
            prefix={<SearchOutlined style={{ fontSize: 18, color: '#64748b' }} />}
            placeholder="Tap and type to search customer..."
            value={searchCustomerQuery}
            onChange={e => setSearchCustomerQuery(e.target.value)}
            style={{ height: 48, borderRadius: 10, fontSize: 15 }}
          />
        </div>
        <div className="pos-scrollbar" style={{ maxHeight: 350, overflowY: 'auto', padding: '0 12px' }}>
          <List
            dataSource={filteredCustomers}
            renderItem={item => (
              <List.Item
                className="pos-modal-list-item"
                onClick={() => {
                  setSelectedCustomer(item);
                  setIsCustomerModalVisible(false);
                  setSearchCustomerQuery('');
                  message.success(`Selected customer: ${item.title}`);
                  setCart(prev => prev.map(cartItem => ({
                    ...cartItem,
                    rate: resolveCustomerItemRate(cartItem.item.id, item.account, cartItem.unit)
                  })));
                }}
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  backgroundColor: selectedCustomer?.account === item.account ? '#eff6ff' : 'transparent',
                  border: selectedCustomer?.account === item.account ? '1px solid #bfdbfe' : '1px solid transparent',
                  marginBottom: 6,
                  transition: 'all 0.2s ease'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ 
                      width: 42, 
                      height: 42, 
                      borderRadius: 21, 
                      backgroundColor: selectedCustomer?.account === item.account ? '#2563eb' : '#f1f5f9', 
                      color: selectedCustomer?.account === item.account ? '#ffffff' : '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 16
                    }}>
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                  }
                  title={<span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{item.title}</span>}
                  description={<span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Code: {item.account}</span>}
                />
              </List.Item>
            )}
          />
        </div>
      </Modal>

      {/* Narration Selection Modal */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>📝 Select Narration</div>}
        open={isNarrationModalVisible}
        onCancel={() => setIsNarrationModalVisible(false)}
        footer={null}
        width={450}
        bodyStyle={{ padding: '16px 0 24px' }}
      >
        <div className="pos-scrollbar" style={{ maxHeight: 350, overflowY: 'auto', padding: '0 12px' }}>
          <List
            dataSource={narrations}
            renderItem={item => (
              <List.Item
                className="pos-modal-list-item"
                onClick={() => {
                  setSelectedNarration(item);
                  setIsNarrationModalVisible(false);
                  message.success(`Selected narration: ${item.title}`);
                }}
                style={{
                  padding: '14px 20px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  backgroundColor: selectedNarration?.code === item.code ? '#f0fdf4' : 'transparent',
                  border: selectedNarration?.code === item.code ? '1px solid #bbf7d0' : '1px solid transparent',
                  marginBottom: 6,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{item.title}</div>
              </List.Item>
            )}
          />
          <div style={{ padding: '12px 12px 0' }}>
            <Button 
              block 
              danger 
              size="large"
              onClick={() => {
                setSelectedNarration(null);
                setIsNarrationModalVisible(false);
                message.info('Narration cleared');
              }}
              style={{ height: 48, borderRadius: 10, fontWeight: 700, fontSize: 15 }}
            >
              Clear Narration
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receipt Success Dialog */}
      <Modal
        open={successModalVisible}
        footer={null}
        closable={false}
        width={450}
        bodyStyle={{ padding: 24, textAlign: 'center' }}
        style={{ top: 20 }}
      >
        <CheckCircleOutlined style={{ fontSize: 64, color: isOfflineSaved ? '#f59e0b' : '#16a34a', marginBottom: 16 }} />
        <Title level={3} style={{ margin: 0, fontWeight: 900, fontSize: 24 }}>
          {isOfflineSaved ? 'Sale Queued Offline!' : 'Sale Completed!'}
        </Title>
        {isOfflineSaved && (
          <Alert
            type="warning"
            showIcon
            icon={<CloudServerOutlined style={{ fontSize: 16 }} />}
            message={`Saved as ${savedVoucherNo} — will sync when you reconnect`}
            style={{ marginBottom: 16, marginTop: 12, textAlign: 'left', borderRadius: 10, fontSize: 14 }}
          />
        )}
        {savedTokenNo && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Badge 
              count={`TOKEN #${savedTokenNo}`} 
              style={{ 
                backgroundColor: '#ea580c', 
                fontSize: 22, 
                height: 42, 
                lineHeight: '42px', 
                padding: '0 24px', 
                borderRadius: 21, 
                fontWeight: 900,
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
              }} 
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
              {hasKdsFeature ? `Order sent to Kitchen Display (${savedOrderType})` : `Order completed & KOT printed (${savedOrderType})`}
            </span>
          </div>
        )}
        <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 20 }}>
          Voucher: <b style={{ color: '#0f172a' }}>{savedVoucherNo}</b>
        </Text>

        {/* THERMAL RECEIPT DISPLAY */}
        <div 
          id="printable-report"
          className="pos-scrollbar"
          style={{ 
            border: '1px solid #cbd5e1', 
            borderRadius: 12, 
            padding: 16, 
            textAlign: 'left', 
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#000000',
            marginBottom: 24,
            maxHeight: 250,
            overflowY: 'auto'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 15 }}>{currentOrgName.toUpperCase()}</h3>
            <p style={{ margin: 0, fontSize: 11 }}>Sale Receipt</p>
            {savedTokenNo && (
              <div style={{ margin: '6px 0', border: '1px dashed #000', padding: '4px' }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>*** TOKEN #{savedTokenNo} ***</span><br />
                <span style={{ fontSize: 11, fontWeight: 700 }}>[{savedOrderType.toUpperCase()}]</span>
              </div>
            )}
            <p style={{ margin: 0, fontSize: 11 }}>Voucher: {savedVoucherNo}</p>
            <p style={{ margin: 0, fontSize: 11 }}>Date: {dayjs().format('DD-MMM-YYYY HH:mm')}</p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8 }}>
            <strong>Customer:</strong> {selectedCustomer?.title}<br />
            {selectedNarration && <><strong>Narration:</strong> {selectedNarration.title}<br /></>}
          </div>

          {/* Lines */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', paddingBottom: 4 }}>Item</th>
                <th style={{ textAlign: 'center', paddingBottom: 4 }}>Qty</th>
                <th style={{ textAlign: 'right', paddingBottom: 4 }}>Price</th>
                <th style={{ textAlign: 'right', paddingBottom: 4 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(line => {
                const resolved = resolveDisplayQtyAndUnit(line.qty, line.item, units as any);
                const qtyDisplay = resolved.factor > 1 ? `${resolved.displayQty} ${resolved.unitLabel}` : line.qty;
                return (
                  <tr key={line.item.id}>
                    <td style={{ textAlign: 'left', padding: '6px 0' }}>{line.item.title}</td>
                    <td style={{ textAlign: 'center', padding: '6px 0' }}>{qtyDisplay}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{line.rate}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{(line.qty * line.rate).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', paddingTop: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Gross Total:</span>
              <strong>Rs. {grossTotal.toFixed(2)}</strong>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Discount:</span>
                <strong>-Rs. {totalDiscount.toFixed(2)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px double #000', paddingTop: 6, marginBottom: 6, fontSize: 14 }}>
              <strong>Net Amount:</strong>
              <strong>Rs. {netAmount.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Cash Received:</span>
              <strong>Rs. {cashReceived.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Cash Back / Change:</span>
              <strong>Rs. {cashBack.toFixed(2)}</strong>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #000', paddingTop: 10, marginTop: 10, textAlign: 'center', fontSize: 11 }}>
            {getSetting(BILL_THANK_YOU_KEY, BILL_THANK_YOU_DEFAULT)}
          </div>
        </div>

        {/* Dialog Actions */}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Button
            type="primary"
            icon={<PrinterOutlined style={{ fontSize: 16 }} />}
            size="large"
            block
            loading={printerLoading}
            onClick={handlePrintReceipt}
            style={{ 
              height: 52, 
              borderRadius: 10, 
              fontWeight: 800, 
              fontSize: 16,
              backgroundColor: '#0284c7', 
              borderColor: '#0284c7',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
            }}
          >
            Print Receipt
          </Button>
          <Button
            type="default"
            size="large"
            block
            onClick={handleCloseActiveTabAfterSave}
            style={{ height: 52, borderRadius: 10, fontWeight: 800, fontSize: 16 }}
          >
            Close Tab
          </Button>
        </Space>
      </Modal>

      {/* Visual Cash Payment Modal */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>💸 POS Touch Payment</div>}
        open={isPaymentModalVisible}
        onCancel={() => setIsPaymentModalVisible(false)}
        footer={null}
        width={580}
        bodyStyle={{ padding: '16px 20px 20px' }}
        style={{ top: 40 }}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          
          {/* Combined 3-Column Dashboard */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 16px', 
            backgroundColor: '#f8fafc', 
            borderRadius: 14,
            border: '1px solid #cbd5e1',
            textAlign: 'center',
            gap: 8
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Net Payable</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Rs. {netAmount.toLocaleString()}</span>
            </div>
            <div style={{ height: 32, width: 1, backgroundColor: '#cbd5e1' }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Cash Received</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#0284c7' }}>Rs. {cashReceived.toLocaleString()}</span>
            </div>
            <div style={{ height: 32, width: 1, backgroundColor: '#cbd5e1' }} />
            <div style={{ flex: 1.2 }}>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
                {cashReceived >= netAmount ? 'Return Change' : 'Due Balance'}
              </span>
              <span style={{ fontSize: 18, fontWeight: 950, color: cashBack > 0 ? '#16a34a' : '#ef4444' }}>
                Rs. {Math.abs(cashReceived - netAmount).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Cash Denominations Section (Coins & Notes combined) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash Denominations</span>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>(Tap to Add)</span>
            </div>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
              {/* Coins: 1, 2, 5 */}
              {[1, 2, 5].map(coin => {
                const style = noteStyles[coin];
                const count = noteCounts[coin] || 0;
                return (
                  <Button
                    key={coin}
                    className="pos-cash-coin-btn"
                    onClick={() => handleNoteTap(coin)}
                    style={{
                      width: 50,
                      height: 50,
                      background: style.bg,
                      borderColor: style.border,
                      color: style.text,
                      fontWeight: 900,
                      fontSize: 15,
                      padding: 0,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 3px 6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)',
                      border: `2px solid ${style.border}`
                    }}
                  >
                    {count > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        border: 'none'
                      }}>
                        {count}
                      </div>
                    )}
                    <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{coin}</span>
                  </Button>
                );
              })}

              {/* Notes: 10, 20, 50, 100, 500, 1000, 5000 */}
              {[10, 20, 50, 100, 500, 1000, 5000].map(note => {
                const style = noteStyles[note];
                const count = noteCounts[note] || 0;
                return (
                  <Button
                    key={note}
                    className="pos-cash-note-btn"
                    onClick={() => handleNoteTap(note)}
                    style={{
                      width: 72,
                      height: 44,
                      background: style.bg,
                      borderColor: style.border,
                      color: style.text,
                      fontWeight: 900,
                      fontSize: 14,
                      padding: 0,
                      borderRadius: 8,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                      border: 'none'
                    }}
                  >
                    {count > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {count}
                      </div>
                    )}
                    <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{note}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Note Selection Details readout */}
          {Object.entries(noteCounts).some(([_, count]) => count > 0) && (
            <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, marginTop: 2 }}>
              <strong>Selected:</strong> {Object.entries(noteCounts)
                .filter(([_, count]) => count > 0)
                .map(([note, count]) => `${count} x Rs.${note}`)
                .join(', ')}
            </div>
          )}

          {/* Helper Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            <Button 
              type="dashed" 
              onClick={handleExactCash} 
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 700, 
                color: '#16a34a', 
                borderColor: '#22c55e',
                backgroundColor: '#f0fdf4',
                borderRadius: 10,
                fontSize: 13
              }}
            >
              💵 Same / Exact Amount
            </Button>
            <Button 
              type="dashed" 
              danger
              onClick={handleResetCash} 
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 700, 
                borderRadius: 10,
                fontSize: 13
              }}
            >
              🧹 Clear Cash
            </Button>
          </div>

          {/* Checkout Save Button */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Button
              size="large"
              onClick={() => setIsPaymentModalVisible(false)}
              style={{ flex: 1, height: 48, borderRadius: 10, fontWeight: 700, fontSize: 14 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<DollarOutlined style={{ fontSize: 16 }} />}
              loading={loading}
              onClick={handleSaveSale}
              style={{
                flex: 2,
                height: 48,
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 15,
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                boxShadow: '0 4px 10px rgba(22, 163, 74, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              {hasKotFeature && orderType === 'Takeaway' ? 'CONFIRM & PRINT (KOT + BILL)' : 'CONFIRM & SAVE TRANSACTION'}
            </Button>
          </div>
        </Space>
      </Modal>

      {/* Active KOTs Modal */}
      {hasKotFeature && (
        <Modal
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, paddingRight: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📥 Active Kitchen Orders</span>
                <Badge count={activeKots.length} style={{ backgroundColor: '#f97316' }} />
              </div>
              <Button
                size="small"
                icon={<ReloadOutlined spin={kotLoading} />}
                onClick={fetchActiveKots}
                style={{ borderRadius: 6, fontWeight: 600 }}
              >
                Refresh
              </Button>
            </div>
          }
          open={isKotModalVisible}
          onCancel={() => setIsKotModalVisible(false)}
          footer={null}
          width={750}
          style={{ top: 30 }}
          bodyStyle={{ padding: '16px 24px' }}
        >
          <List
            loading={kotLoading}
            dataSource={activeKots}
            renderItem={kot => (
              <List.Item
                className="pos-modal-list-item"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#ffffff'
                }}
              >
                <div>
                  <Space size="middle">
                    <Badge count={`Token #${kot.tokenNo}`} style={{ backgroundColor: '#f97316', fontSize: 13, fontWeight: 800, padding: '2px 8px', borderRadius: 6, height: 'auto', lineHeight: 'normal' }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                      {kot.orderType === 'DineIn' ? `🍽️ Table: ${kot.tableName || 'N/A'}` : '🏃 Takeaway'}
                    </span>
                    <Tag 
                      color={kot.status === 'Ready' ? 'green' : kot.status === 'Served' ? 'purple' : kot.status === 'Preparing' ? 'blue' : 'orange'} 
                      style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}
                    >
                      {kot.status}
                    </Tag>
                    {kot.saleVoucherNo && (
                      <Tag color="cyan" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                        Bill #{kot.saleVoucherNo}
                      </Tag>
                    )}
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      {dayjs(`${kot.orderDate}T${kot.orderTime}`).format('hh:mm A')}
                    </span>
                  </Space>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>
                    <strong>Items:</strong> {kot.lines.map(l => `${l.itemTitle} (x${l.qty})`).join(', ')}
                  </div>
                  {kot.remarks && (
                    <div style={{ marginTop: 2, fontSize: 12, color: '#ea580c', fontStyle: 'italic' }}>
                      * Remarks: {kot.remarks}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Due</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#2563eb' }}>Rs. {kot.totalAmount.toLocaleString()}</div>
                  </div>
                  <Button
                    type="primary"
                    onClick={() => handleLoadKot(kot)}
                    style={{
                      borderRadius: 8,
                      fontWeight: 700,
                      backgroundColor: '#2563eb',
                      borderColor: '#2563eb'
                    }}
                  >
                    Load Order
                  </Button>
                  <Tooltip title="Print / Reprint KOT Slip">
                    <Button
                      icon={<PrinterOutlined />}
                      onClick={() => printKotSlip(kot, connectionMethod, { printerName, cutPaper, isDuplicate: true })}
                      style={{ borderRadius: 8 }}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Cancel Order?"
                    description="Are you sure you want to cancel this KOT order?"
                    onConfirm={async () => {
                      try {
                        await kotService.updateOrderStatus(kot.id, 'Cancelled');
                        message.success(`KOT order #${kot.tokenNo} cancelled`);
                        fetchActiveKots();
                        if (hasDineInFeature) {
                          kotService.getDiningTables().then(setDiningTables).catch(console.error);
                        }
                      } catch (err) {
                        message.error('Failed to cancel order');
                      }
                    }}
                    okText="Yes"
                    cancelText="No"
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="Cancel Order">
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        style={{ borderRadius: 8 }}
                      />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </List.Item>
            )}
            locale={{ emptyText: <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>No active Kitchen Orders found</div> }}
          />
        </Modal>
      )}
    </div>
  );
};
