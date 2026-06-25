import React, { useState, useEffect } from 'react';
import {
  Row, Col, Typography, Button, Input, Space, message, Tag, Modal, List, Badge, Alert
} from 'antd';
import { useThermalPrinter, centerLine, padLine, divider, type ConnectionMethod } from '../../hooks/useThermalPrinter';
import { useAppStore } from '../../stores/useAppStore';
import {
  PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined,
  PrinterOutlined, RedoOutlined, CheckCircleOutlined, UserOutlined,
  FileTextOutlined, ArrowLeftOutlined, SearchOutlined, DollarOutlined,
  DisconnectOutlined, CloudServerOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <div style={{ margin: -24, padding: 24, height: 'calc(100vh - 140px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* ── Offline mode banner ── */}
      {!isOnline && (
        <Alert
          style={{ marginBottom: 12, flexShrink: 0 }}
          type="warning"
          showIcon
          icon={<DisconnectOutlined />}
          message={
            <span>
              <strong>OFFLINE MODE</strong> — Sales will be queued and synced automatically when internet is restored.
            </span>
          }
        />
      )}
      {/* POS Top Header - Zero Keyboard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/daily-entries/sale')} type="text" />
          <Title level={3} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
            ⚡ POS Touch Terminal
          </Title>
        </Space>
        
        <Space size="middle">
          {/* Touch Customer Button */}
          <Button 
            type="primary" 
            icon={<UserOutlined />} 
            onClick={() => setIsCustomerModalVisible(true)}
            style={{ 
              height: 48, 
              borderRadius: 8, 
              fontWeight: 600, 
              backgroundColor: '#0284c7', 
              borderColor: '#0284c7',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)' 
            }}
          >
            Cust: {selectedCustomer ? selectedCustomer.title : 'Select Customer'}
          </Button>

          {/* Touch Narration Button */}
          <Button 
            type="default" 
            icon={<FileTextOutlined />} 
            onClick={() => setIsNarrationModalVisible(true)}
            style={{ height: 48, borderRadius: 8, fontWeight: 600 }}
          >
            Narr: {selectedNarration ? selectedNarration.title : 'None'}
          </Button>

          <Button 
            danger 
            icon={<RedoOutlined />} 
            onClick={handleResetAll} 
            style={{ height: 48, borderRadius: 8, fontWeight: 600 }}
          >
            Clear All
          </Button>
        </Space>
      </div>

      {/* Main Terminal Area */}
      <div style={{ display: 'flex', flex: 1, gap: 20, overflow: 'hidden' }}>
        
        {/* Left Side: Category selector and Item grid (65% width) */}
        <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Quick Filters */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 10, flexShrink: 0 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
              placeholder="Tap to search items..."
              value={searchItemQuery}
              onChange={e => setSearchItemQuery(e.target.value)}
              style={{ height: 44, borderRadius: 8, fontSize: 15 }}
              suffix={
                searchItemQuery && (
                  <Button type="text" size="small" onClick={() => setSearchItemQuery('')} style={{ margin: 0, padding: 0 }}>
                    Clear
                  </Button>
                )
              }
            />
          </div>

          {/* Category Tabs */}
          <div 
            style={{ 
              display: 'flex', 
              gap: 8, 
              overflowX: 'auto', 
              paddingBottom: 8, 
              marginBottom: 12, 
              flexShrink: 0,
              scrollbarWidth: 'none'
            }}
          >
            <Button
              type={activeCategory === 'all' ? 'primary' : 'default'}
              onClick={() => setActiveCategory('all')}
              style={{ 
                height: 44, 
                borderRadius: 22, 
                padding: '0 20px 0 8px', 
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: activeCategory === 'all' ? '#0ea5e9' : undefined,
                borderColor: activeCategory === 'all' ? '#0ea5e9' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ fontSize: 16 }}>⭐</span> All Products
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.code}
                type={activeCategory === cat.code ? 'primary' : 'default'}
                onClick={() => setActiveCategory(cat.code)}
                style={{ 
                  height: 44, 
                  borderRadius: 22, 
                  padding: cat.mediaUrl ? '0 20px 0 8px' : '0 24px', 
                  fontWeight: 600,
                  fontSize: 14,
                  backgroundColor: activeCategory === cat.code ? '#0ea5e9' : undefined,
                  borderColor: activeCategory === cat.code ? '#0ea5e9' : undefined,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {cat.mediaUrl ? (
                  <img 
                    src={cat.mediaUrl} 
                    alt={cat.title} 
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} 
                  />
                ) : (
                  <span style={{ fontSize: 16 }}>📦</span>
                )}
                {cat.title}
              </Button>
            ))}
          </div>

          {/* Items Grid Container */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            <Row gutter={[12, 12]}>
              {filteredItems.map(item => (
                <Col xs={12} sm={8} md={6} key={item.id}>
                  <div
                    onClick={() => handleAddToCart(item)}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      height: 180,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
                      border: '1px solid #e8edf2',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.14)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.10)';
                    }}
                  >
                    {/* Image area — fills card, full picture visible */}
                    <div style={{
                      flex: 1,
                      backgroundColor: '#f5f7fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {item.mediaUrl ? (
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 36,
                          fontWeight: 800,
                          color: '#3b82f6',
                        }}>
                          {item.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Info strip at bottom */}
                    <div style={{
                      padding: '6px 8px',
                      backgroundColor: '#ffffff',
                      borderTop: '1px solid #eef1f5',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 12,
                        color: '#1e293b',
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
                        <span style={{
                          fontWeight: 700,
                          fontSize: 12,
                          color: '#0ea5e9',
                        }}>
                          Rs.{item.priRate}
                        </span>
                        {item.barcode && (
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>{item.barcode}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
              {filteredItems.length === 0 && (
                <div style={{ width: '100%', textAlign: 'center', padding: '60px 0', color: '#8c8c8c' }}>
                  <ShoppingCartOutlined style={{ fontSize: 48, marginBottom: 12, color: '#d9d9d9' }} />
                  <p style={{ fontSize: 15 }}>No items found in this category.</p>
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
            borderRadius: 16, 
            border: '1px solid #f0f0f0', 
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
            padding: 16,
            overflow: 'hidden'
          }}
        >
          {/* Cart Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingCartOutlined style={{ color: '#0ea5e9' }} /> Cart Items
            </span>
            <Badge count={cart.reduce((sum, i) => sum + i.qty, 0)} showZero style={{ backgroundColor: '#0ea5e9' }} />
          </div>

          {/* Cart List */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, borderBottom: '1px dashed #e8e8e8', paddingRight: 4 }}>
            {cart.map(line => (
              <div 
                key={line.item.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '6px 8px', 
                  borderRadius: 10,
                  backgroundColor: '#f9fafb',
                  marginBottom: 6
                }}
              >
                {line.item.mediaUrl && (
                  <div 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '4px', 
                      overflow: 'hidden', 
                      border: '1px solid #eef2f6',
                      marginRight: '8px',
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
                  <Text strong style={{ display: 'block', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {line.item.title}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Rate: Rs.{line.rate} | Unit: {line.unit}
                  </Text>
                </div>
                
                {/* Touch Quantity Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
                  <Button 
                    shape="circle" 
                    size="small" 
                    icon={<MinusOutlined style={{ fontSize: 10 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, false)}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{line.qty}</span>
                  <Button 
                    shape="circle" 
                    size="small" 
                    icon={<PlusOutlined style={{ fontSize: 10 }} />} 
                    onClick={() => handleUpdateQty(line.item.id, true)}
                  />
                </div>

                <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Text strong style={{ fontSize: 13 }}>
                    Rs. {line.qty * line.rate}
                  </Text>
                  <Button 
                    type="text" 
                    danger 
                    size="small" 
                    icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                    onClick={() => handleRemoveFromCart(line.item.id)}
                    style={{ height: 20, padding: 0 }}
                  />
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf' }}>
                <ShoppingCartOutlined style={{ fontSize: 32, marginBottom: 8, color: '#e8e8e8' }} />
                <p style={{ fontSize: 12 }}>Cart is empty. Tap products to add.</p>
              </div>
            )}
          </div>

          {/* Quick Discounts Panel */}
          <div style={{ marginBottom: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600 }}>QUICK DISCOUNT</span>
              {totalDiscount > 0 && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Rs. {Math.round(totalDiscount)} Off</Tag>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => handleQuickDiscount(5)} style={{ borderRadius: 6, fontSize: 11 }}>5%</Button>
              <Button size="small" onClick={() => handleQuickDiscount(10)} style={{ borderRadius: 6, fontSize: 11 }}>10%</Button>
              <Button size="small" onClick={() => handleQuickFlatDiscount(100)} style={{ borderRadius: 6, fontSize: 11 }}>Rs. 100</Button>
              <Button size="small" onClick={() => handleQuickFlatDiscount(500)} style={{ borderRadius: 6, fontSize: 11 }}>Rs. 500</Button>
              <Button size="small" danger onClick={() => { setDiscountPercent(0); setDiscountFlat(0); }} style={{ borderRadius: 6, fontSize: 11 }}>Reset</Button>
            </div>
          </div>

          {/* Totals & Notes Section */}
          <div style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Gross Total</Text>
              <Text strong style={{ fontSize: 12 }}>Rs. {grossTotal.toLocaleString()}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Discount</Text>
              <Text strong style={{ fontSize: 12, color: '#ea580c' }}>- Rs. {totalDiscount.toLocaleString()}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Net Payable</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Rs. {netAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Proceed to Payment Checkout Button */}
          <Button
            type="primary"
            size="large"
            icon={<DollarOutlined />}
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
              fontSize: 15,
              backgroundColor: '#16a34a',
              borderColor: '#16a34a',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
              flexShrink: 0
            }}
          >
            PROCEED TO PAYMENT
          </Button>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <Modal
        title={<div style={{ fontSize: 18, fontWeight: 800 }}>👥 Touch Customer Directory</div>}
        open={isCustomerModalVisible}
        onCancel={() => setIsCustomerModalVisible(false)}
        footer={null}
        width={500}
        bodyStyle={{ padding: '12px 0 24px' }}
      >
        <div style={{ padding: '0 24px 12px' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tap to search customer by name..."
            value={searchCustomerQuery}
            onChange={e => setSearchCustomerQuery(e.target.value)}
            style={{ height: 44, borderRadius: 8 }}
          />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '0 12px' }}>
          <List
            dataSource={filteredCustomers}
            renderItem={item => (
              <List.Item
                onClick={() => {
                  setSelectedCustomer(item);
                  setIsCustomerModalVisible(false);
                  setSearchCustomerQuery('');
                  message.success(`Selected customer: ${item.title}`);
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  backgroundColor: selectedCustomer?.account === item.account ? '#eff6ff' : 'transparent',
                  border: selectedCustomer?.account === item.account ? '1px solid #bfdbfe' : '1px solid transparent',
                  marginBottom: 4
                }}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: 18, 
                      backgroundColor: selectedCustomer?.account === item.account ? '#3b82f6' : '#f3f4f6', 
                      color: selectedCustomer?.account === item.account ? '#ffffff' : '#4b5563', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      {item.title.charAt(0).toUpperCase()}
                    </div>
                  }
                  title={<span style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</span>}
                  description={<span style={{ fontSize: 11 }}>Code: {item.account}</span>}
                />
              </List.Item>
            )}
          />
        </div>
      </Modal>

      {/* Narration Selection Modal */}
      <Modal
        title={<div style={{ fontSize: 18, fontWeight: 800 }}>📝 Select Narration</div>}
        open={isNarrationModalVisible}
        onCancel={() => setIsNarrationModalVisible(false)}
        footer={null}
        width={400}
        bodyStyle={{ padding: '12px 0 24px' }}
      >
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '0 12px' }}>
          <List
            dataSource={narrations}
            renderItem={item => (
              <List.Item
                onClick={() => {
                  setSelectedNarration(item);
                  setIsNarrationModalVisible(false);
                  message.success(`Selected narration: ${item.title}`);
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  backgroundColor: selectedNarration?.code === item.code ? '#f0fdf4' : 'transparent',
                  border: selectedNarration?.code === item.code ? '1px solid #bbf7d0' : '1px solid transparent',
                  marginBottom: 4
                }}
              >
                <div style={{ fontWeight: 600 }}>{item.title}</div>
              </List.Item>
            )}
          />
          <Button 
            block 
            danger 
            onClick={() => {
              setSelectedNarration(null);
              setIsNarrationModalVisible(false);
              message.info('Narration cleared');
            }}
            style={{ marginTop: 12, borderRadius: 8 }}
          >
            Clear Narration
          </Button>
        </div>
      </Modal>

      {/* Receipt Success Dialog */}
      <Modal
        open={successModalVisible}
        footer={null}
        closable={false}
        width={400}
        bodyStyle={{ padding: 24, textAlign: 'center' }}
        style={{ top: 20 }}
      >
        <CheckCircleOutlined style={{ fontSize: 56, color: isOfflineSaved ? '#f59e0b' : '#16a34a', marginBottom: 12 }} />
        <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
          {isOfflineSaved ? 'Sale Queued Offline!' : 'Sale Completed!'}
        </Title>
        {isOfflineSaved && (
          <Alert
            type="warning"
            showIcon
            icon={<CloudServerOutlined />}
            message={`Saved as ${savedVoucherNo} — will sync when you reconnect`}
            style={{ marginBottom: 12, textAlign: 'left' }}
          />
        )}
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
          Voucher: <b>{savedVoucherNo}</b>
        </Text>

        {/* THERMAL RECEIPT DISPLAY */}
        <div 
          id="printable-report"
          style={{ 
            border: '1px solid #e8e8e8', 
            borderRadius: 8, 
            padding: 16, 
            textAlign: 'left', 
            backgroundColor: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.4,
            color: '#000000',
            marginBottom: 24
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontWeight: 800 }}>{currentOrgName.toUpperCase()}</h3>
            <p style={{ margin: 0, fontSize: 9 }}>POS Transaction Receipt</p>
            <p style={{ margin: 0, fontSize: 9 }}>Voucher: {savedVoucherNo}</p>
            <p style={{ margin: 0, fontSize: 9 }}>Date: {dayjs().format('DD-MMM-YYYY HH:mm')}</p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: 6, marginBottom: 8 }}>
            <strong>Customer:</strong> {selectedCustomer?.title}<br />
            <strong>Type:</strong> POS CASH SALE<br />
            {selectedNarration && <><strong>Narration:</strong> {selectedNarration.title}<br /></>}
          </div>

          {/* Lines */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left' }}>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(line => (
                <tr key={line.item.id}>
                  <td style={{ textAlign: 'left', padding: '4px 0' }}>{line.item.title}</td>
                  <td style={{ textAlign: 'center', padding: '4px 0' }}>{line.qty}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{line.rate}</td>
                  <td style={{ textAlign: 'right', padding: '4px 0' }}>{(line.qty * line.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', paddingTop: 6, fontSize: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Gross Total:</span>
              <strong>Rs. {grossTotal.toFixed(2)}</strong>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Discount:</span>
                <strong>-Rs. {totalDiscount.toFixed(2)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px double #000', paddingTop: 4, marginBottom: 4, fontSize: 12 }}>
              <strong>Net Amount:</strong>
              <strong>Rs. {netAmount.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Cash Received:</span>
              <strong>Rs. {cashReceived.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Cash Back / Change:</span>
              <strong>Rs. {cashBack.toFixed(2)}</strong>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #000', paddingTop: 10, marginTop: 10, textAlign: 'center', fontSize: 9 }}>
            Thank you for shopping with us!<br />
            Software Powered by Bizgrip Solutions
          </div>
        </div>

        {/* Dialog Actions */}
        <Space direction="vertical" style={{ width: '100%' }} size={10}>

          <Button
            type="primary"
            icon={<PrinterOutlined />}
            size="large"
            block
            loading={printerLoading}
            onClick={handlePrintReceipt}
            style={{ height: 48, borderRadius: 8, fontWeight: 700, backgroundColor: '#0284c7', borderColor: '#0284c7' }}
          >
            Print Receipt
          </Button>
          <Button
            type="default"
            size="large"
            block
            onClick={handleNewTransaction}
            style={{ height: 48, borderRadius: 8, fontWeight: 700 }}
          >
            Start New Transaction
          </Button>
        </Space>
      </Modal>

      {/* Visual Cash Payment Modal */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>💸 POS Touch Payment</div>}
        open={isPaymentModalVisible}
        onCancel={() => setIsPaymentModalVisible(false)}
        footer={null}
        width={550}
        bodyStyle={{ padding: '16px 24px 24px' }}
        style={{ top: 40 }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          
          {/* Header Summary display */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 16px', 
            backgroundColor: '#f8fafc', 
            borderRadius: 12,
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Net Payable</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Rs. {netAmount.toLocaleString()}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Cash Received</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>Rs. {cashReceived.toLocaleString()}</span>
            </div>
          </div>

          {/* Change Display */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 16px', 
            backgroundColor: cashBack > 0 ? '#f0fdf4' : '#eff6ff', 
            borderRadius: 12,
            border: cashBack > 0 ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
          }}>
            <div>
              <span style={{ fontSize: 11, display: 'block', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                {cashReceived >= netAmount ? 'Change to Return' : 'Remaining Due'}
              </span>
              <span style={{ fontSize: 24, fontWeight: 950, color: cashBack > 0 ? '#16a34a' : '#2563eb' }}>
                Rs. {Math.abs(cashReceived - netAmount).toLocaleString()}
              </span>
            </div>
            <Tag color={cashReceived >= netAmount ? 'green' : 'blue'} style={{ padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: 12, border: 'none' }}>
              {cashReceived >= netAmount ? 'PAID / SETTLED' : 'PARTIAL DUE'}
            </Tag>
          </div>

          {/* Coins Grid */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.5px' }}>Coins</span>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {[1, 2, 5].map(coin => {
                const style = noteStyles[coin];
                const count = noteCounts[coin] || 0;
                return (
                  <Button
                    key={coin}
                    onClick={() => handleNoteTap(coin)}
                    style={{
                      width: 56,
                      height: 56,
                      background: style.bg,
                      borderColor: style.border,
                      color: style.text,
                      fontWeight: 900,
                      fontSize: 12,
                      padding: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.15), inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -2px 2px rgba(0,0,0,0.2)',
                      border: `2px solid ${style.border}`
                    }}
                  >
                    {count > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
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
                    <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{coin}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Notes Grid */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.5px' }}>Notes</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[10, 20, 50, 100, 500, 1000, 5000].map(note => {
                const style = noteStyles[note];
                const count = noteCounts[note] || 0;
                return (
                  <Button
                    key={note}
                    onClick={() => handleNoteTap(note)}
                    style={{
                      height: 44,
                      background: style.bg,
                      borderColor: style.border,
                      color: style.text,
                      fontWeight: 800,
                      fontSize: 12,
                      padding: 0,
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                    }}
                  >
                    {count > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: -6,
                        right: -4,
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        fontSize: 9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {count}
                      </div>
                    )}
                    <span style={{ fontSize: 20, fontWeight: 900 }}>{note}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Note Selection Details readout */}
          {Object.entries(noteCounts).some(([_, count]) => count > 0) && (
            <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <strong>Tapped Notes:</strong> {Object.entries(noteCounts)
                .filter(([_, count]) => count > 0)
                .map(([note, count]) => `${count} x Rs.${note}`)
                .join(', ')}
            </div>
          )}

          {/* Helper Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button 
              type="dashed" 
              onClick={handleExactCash} 
              style={{ 
                flex: 1, 
                height: 44, 
                fontWeight: 800, 
                color: '#16a34a', 
                borderColor: '#22c55e',
                backgroundColor: '#f0fdf4',
                borderRadius: 8,
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
                height: 44, 
                fontWeight: 800, 
                borderRadius: 8,
                fontSize: 13
              }}
            >
              🧹 Clear Cash
            </Button>
          </div>

          {/* Checkout Save Button */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Button
              size="large"
              onClick={() => setIsPaymentModalVisible(false)}
              style={{ flex: 1, height: 48, borderRadius: 10, fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<DollarOutlined />}
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
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
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
