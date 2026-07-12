import React, { useState, useEffect } from 'react';
import {
  Row, Col, Typography, Button, Input, Space, message, Tag, Modal, List, Badge, Alert, Dropdown
} from 'antd';
import { useThermalPrinter, centerLine, padLine, divider, type ConnectionMethod } from '../../hooks/useThermalPrinter';
import { useAppStore } from '../../stores/useAppStore';
import {
  PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined,
  PrinterOutlined, RedoOutlined, CheckCircleOutlined, UserOutlined,
  FileTextOutlined, SearchOutlined, DollarOutlined,
  DisconnectOutlined, CloudServerOutlined, DownOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { saleService } from '../../services/saleService';
import { offlineCacheService, OfflineCacheMissError } from '../../services/offlineCacheService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import type { Item } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import type { NarrationDto } from '../../services/narrationService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const { Title, Text } = Typography;

interface CartItem {
  item: Item;
  qty: number;
  rate: number;
  discount: number;
  unit: string;
}

export const POSSaleForm: React.FC = () => {

  const [loading, setLoading] = useState(false);
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrgName = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier)?.name || 'Retail Store';
  const { isOnline } = useNetworkStatus();
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Data states
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [units, setUnits] = useState<{ code: string; title: string }[]>([]);

  // Selection states
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchItemQuery, setSearchItemQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<ChartOfAccountHeadDto | null>(null);
  const [selectedNarration, setSelectedNarration] = useState<NarrationDto | null>(null);

  // Cart & Checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFlat, setDiscountFlat] = useState<number>(0);

  // Currency Note counters (1, 2, 5, 10, 20, 50, 100, 500, 1000, 5000)
  const [noteCounts, setNoteCounts] = useState<Record<number, number>>({
    1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0
  });

  // Dialogs
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [isNarrationModalVisible, setIsNarrationModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [savedVoucherNo, setSavedVoucherNo] = useState<string>('');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState<string>('');

  // Printer Configuration States
  const [connectionMethod] = useState<ConnectionMethod>(() => {
    const saved = localStorage.getItem('pos_printer_method');
    if (saved) return saved as ConnectionMethod;
    // Auto-detect connection method based on Operating System if not configured
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('CrOS')) {
      return 'WEB_USB'; // ChromeOS uses WebUSB
    }
    return 'LOCAL_RELAY'; // Windows / Linux / macOS default to Local Relay
  });
  const [printerName] = useState<string>(() => {
    return localStorage.getItem('pos_printer_name') || 'XP-80';
  });
  const [openDrawer] = useState<boolean>(false);
  const [cutPaper] = useState<boolean>(() => {
    const saved = localStorage.getItem('pos_printer_cut_paper');
    return saved !== null ? saved === 'true' : true;
  });





  // Currency Notes Setup
  const currencyNotes = [1, 2, 5, 10, 20, 50, 100, 500, 1000, 5000];

  const noteStyles: Record<number, { bg: string; border: string; text: string }> = {
    1: { bg: 'linear-gradient(135deg, #b45309, #d97706)', border: '#b45309', text: '#ffffff' }, // 1 Rs Bronze/Gold coin
    2: { bg: 'linear-gradient(135deg, #94a3b8, #cbd5e1)', border: '#94a3b8', text: '#1e293b' }, // 2 Rs Silver coin
    5: { bg: 'linear-gradient(135deg, #ca8a04, #eab308)', border: '#ca8a04', text: '#ffffff' }, // 5 Rs Gold coin
    10: { bg: 'linear-gradient(135deg, #15803d, #22c55e)', border: '#15803d', text: '#ffffff' }, // 10 Rs Green Note
    20: { bg: 'linear-gradient(135deg, #c2410c, #f97316)', border: '#c2410c', text: '#ffffff' }, // 20 Rs Orange Note
    50: { bg: 'linear-gradient(135deg, #6b21a8, #a855f7)', border: '#6b21a8', text: '#ffffff' }, // 50 Rs Purple Note
    100: { bg: 'linear-gradient(135deg, #b91c1c, #ef4444)', border: '#b91c1c', text: '#ffffff' }, // 100 Rs Red Note
    500: { bg: 'linear-gradient(135deg, #047857, #10b981)', border: '#047857', text: '#ffffff' }, // 500 Rs Deep Emerald Green Note
    1000: { bg: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', border: '#1d4ed8', text: '#ffffff' }, // 1000 Rs Dark Blue Note
    5000: { bg: 'linear-gradient(135deg, #a16207, #eab308)', border: '#a16207', text: '#ffffff' } // 5000 Rs Mustard Yellow Note
  };

  useEffect(() => {
    // Load initial configurations (via cache service — works online AND offline)
    offlineCacheService.getCustomers()
      .then(data => {
        setCustomers(data);
        if (data.length > 0) setSelectedCustomer(data[0]);
      })
      .catch(err => {
        if (err instanceof OfflineCacheMissError) {
          message.warning('Customer data not cached. Please go online first.');
        }
      });

    itemCategoryService.getActiveItemCategories().then(setCategories);

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
  }, []);

  // Filter Items
  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.itemCategoryCode === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchItemQuery.toLowerCase()) || 
                          (item.barcode && item.barcode.includes(searchItemQuery));
    return matchesCategory && matchesSearch;
  });

  // Filter Customers for touch selection modal
  const filteredCustomers = customers.filter(c => 
    c.title.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
    c.account.includes(searchCustomerQuery)
  );

  // Cart operations
  const handleAddToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      } else {
        return [...prev, {
          item,
          qty: 1,
          rate: item.priRate || 0,
          discount: 0,
          unit: item.defaultUnit || item.primaryUnit || ''
        }];
      }
    });
    message.success(`${item.title} added to cart`);
  };

  const handleUpdateQty = (itemId: string, increment: boolean) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const newQty = increment ? i.qty + 1 : i.qty - 1;
        return newQty > 0 ? { ...i, qty: newQty } : i;
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
    let targetUnit = item.defaultUnit || item.primaryUnit || '';
    let targetRate = item.priRate || 0;

    if (preset.type === 'rs') {
      if (item.priRate > 0) {
        targetQty = parseFloat((preset.value / item.priRate).toFixed(3));
      }
    } else if (preset.type === 'secondary') {
      const packQty = item.qtyInPack || 1000;
      targetQty = parseFloat((preset.value / packQty).toFixed(3));
      targetUnit = item.primaryUnit || '';
    } else {
      targetQty = preset.value;
      targetUnit = item.primaryUnit || '';
    }

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: parseFloat((i.qty + targetQty).toFixed(3)), unit: targetUnit, rate: targetRate } : i);
      } else {
        return [...prev, {
          item,
          qty: targetQty,
          rate: targetRate,
          discount: 0,
          unit: targetUnit
        }];
      }
    });
    message.success(`Added ${item.title} (${preset.label}) to cart`);
  };

  // Computations
  const grossTotal = cart.reduce((sum, line) => sum + (line.qty * line.rate), 0);
  const totalItemDiscount = cart.reduce((sum, line) => sum + (line.qty * line.discount), 0);
  const percentDiscountAmount = (grossTotal - totalItemDiscount) * (discountPercent / 100);
  const totalDiscount = totalItemDiscount + percentDiscountAmount + discountFlat;
  const netAmount = Math.max(0, grossTotal - totalDiscount);

  // Cash computations from note counts
  const cashReceived = Object.entries(noteCounts).reduce((sum, [note, count]) => sum + (Number(note) * count), 0);
  const cashBack = Math.max(0, cashReceived - netAmount);

  // Formatter for thermal receipt text
  const generateReceiptTextLines = (voucherNo: string): string[] => {
    const width = 48; // Updated to 3-inch thermal printer width (48 characters)
    const lines: string[] = [];

    // Helper to format 4 columns for 3-inch slip (Item: 20, Qty: 5, Price: 10, Amount: 13)
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

    // Header
    const escBoldOn = '\x1b!\x08\x1bE\x01\x1bE1';
    const escBoldOff = '\x1b!\x00\x1bE\x00\x1bE0';
    lines.push(escBoldOn + centerLine(currentOrgName.toUpperCase(), width) + escBoldOff);
    lines.push(centerLine('POS Transaction Receipt', width));
    lines.push(centerLine(`Voucher: ${voucherNo}`, width));
    lines.push(centerLine(`Date: ${dayjs().format('DD-MMM-YYYY HH:mm')}`, width));
    lines.push(divider('-', width));

    // Customer
    lines.push(`Customer: ${selectedCustomer?.title || 'Walk-in Customer'}`);
    lines.push('Type: POS CASH SALE');
    if (selectedNarration) {
      lines.push(`Narration: ${selectedNarration.title}`);
    }
    lines.push(divider('-', width));

    // Table Header
    lines.push(format4Columns('Item', 'Qty', 'Price', 'Amount'));
    lines.push(divider('-', width));

    cart.forEach(line => {
      const itemTitle = line.item.title;
      const qtyStr = line.qty.toString();
      // Match UI: Price displays as integer (no decimal) if it's round, or format it
      const priceStr = line.rate.toString(); 
      const amountStr = (line.qty * line.rate).toFixed(2);
      lines.push(format4Columns(itemTitle, qtyStr, priceStr, amountStr));
    });
    lines.push(divider('-', width));

    // Totals
    lines.push(padLine('Gross Total:', `Rs. ${grossTotal.toFixed(2)}`, width));
    if (totalDiscount > 0) {
      lines.push(padLine('Discount:', `-Rs. ${totalDiscount.toFixed(2)}`, width));
    }
    lines.push(divider('=', width));
    lines.push(padLine('Net Amount:', `Rs. ${netAmount.toFixed(2)}`, width));
    lines.push(padLine('Cash Received:', `Rs. ${cashReceived.toFixed(2)}`, width));
    lines.push(padLine('Cash Back / Change:', `Rs. ${cashBack.toFixed(2)}`, width));
    lines.push(divider('-', width));

    // Footer
    lines.push(centerLine('Thank you for shopping with us!', width));
    lines.push(centerLine('Software Powered by Bizgrip Solutions', width));
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

  // Quick Currency Operations
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
    // Distribute netAmount into notes greedily
    let remaining = Math.ceil(netAmount);
    const newCounts: Record<number, number> = { 1: 0, 2: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0, 5000: 0 };
    
    const sortedNotes = [...currencyNotes].reverse(); // large to small
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

  // Full transaction reset
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
      const request = {
        date: dayjs().format('YYYY-MM-DD'),
        account: selectedCustomer.account,
        narration: selectedNarration?.code || undefined,
        description: 'Touch Screen POS Sale',
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

      const newVno = await saleService.create(request, { offlineFallback: true });
      const isOfflineResult = newVno.includes('-') && newVno.length <= 10;
      setIsOfflineSaved(isOfflineResult);
      setSavedVoucherNo(newVno);
      setIsPaymentModalVisible(false);
      setSuccessModalVisible(true);
      if (isOfflineResult) {
        message.warning(`Saved offline as ${newVno} — will sync when you reconnect`, 6);
      } else {
        message.success('POS Sale saved successfully');
      }
    } catch (error) {
      console.error(error);
      message.error('Failed to save POS sale');
    } finally {
      setLoading(false);
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

  const handleNewTransaction = () => {
    setSuccessModalVisible(false);
    setIsOfflineSaved(false);
    handleResetAll();
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
              placeholder="Search products..."
              value={searchItemQuery}
              onChange={e => setSearchItemQuery(e.target.value)}
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
            <Row gutter={[16, 16]}>
              {filteredItems.map(item => (
                <Col xs={12} sm={8} md={8} key={item.id}>
                  <div
                    className="pos-item-card"
                    onClick={() => handleAddToCart(item)}
                    style={{
                      borderRadius: 16,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      height: 210,
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {/* Image area — fills card, full picture visible */}
                    <div style={{
                      flex: 1,
                      backgroundColor: '#f8fafc',
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
                            padding: 8
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
                      padding: '10px 12px',
                      backgroundColor: '#ffffff',
                      borderTop: '1px solid #f1f5f9',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 16,
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
                            fontSize: 15,
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

          {/* Cart List */}
          <div className="pos-scrollbar" style={{ flex: 1, overflowY: 'auto', marginBottom: 16, borderBottom: '1px dashed #e2e8f0', paddingRight: 4 }}>
            {cart.map(line => (
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
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                    Rs. {line.rate} | Unit: {units.find(u => u.code === line.unit)?.title || line.unit}
                  </Text>
                </div>
                
                {/* Touch Quantity Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
                  <Button 
                    className="pos-qty-btn"
                    shape="circle" 
                    icon={<MinusOutlined style={{ fontSize: 12, fontWeight: 900 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, false)}
                    style={{ width: 36, height: 36 }}
                  />
                  <span style={{ fontSize: 16, fontWeight: 800, minWidth: 24, textAlign: 'center', color: '#0f172a' }}>{line.qty}</span>
                  <Button 
                    className="pos-qty-btn"
                    shape="circle" 
                    icon={<PlusOutlined style={{ fontSize: 12, fontWeight: 900 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, true)}
                    style={{ width: 36, height: 36 }}
                  />
                </div>

                <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                    Rs. {line.qty * line.rate}
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
            ))}
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

              {/* Payment Button */}
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
                  height: 48,
                  borderRadius: 10,
                  fontWeight: 800,
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  boxShadow: '0 4px 10px rgba(22, 163, 74, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%'
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Pay Now</span>
              </Button>
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
            <p style={{ margin: 0, fontSize: 11 }}>POS Transaction Receipt</p>
            <p style={{ margin: 0, fontSize: 11 }}>Voucher: {savedVoucherNo}</p>
            <p style={{ margin: 0, fontSize: 11 }}>Date: {dayjs().format('DD-MMM-YYYY HH:mm')}</p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8 }}>
            <strong>Customer:</strong> {selectedCustomer?.title}<br />
            <strong>Type:</strong> POS CASH SALE<br />
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
              {cart.map(line => (
                <tr key={line.item.id}>
                  <td style={{ textAlign: 'left', padding: '6px 0' }}>{line.item.title}</td>
                  <td style={{ textAlign: 'center', padding: '6px 0' }}>{line.qty}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0' }}>{line.rate}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0' }}>{(line.qty * line.rate).toFixed(2)}</td>
                </tr>
              ))}
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
            Thank you for shopping with us!<br />
            Software Powered by Bizgrip Solutions
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
            onClick={handleNewTransaction}
            style={{ height: 52, borderRadius: 10, fontWeight: 800, fontSize: 16 }}
          >
            Start New Transaction
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
              CONFIRM & SAVE TRANSACTION
            </Button>
          </div>

        </Space>
      </Modal>
    </div>
  );
};
