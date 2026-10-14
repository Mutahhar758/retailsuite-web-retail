import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Select, InputNumber, Button, Space,
  Row, Col, Table, message, Switch, Radio, Divider,
  Popconfirm, Tag, Spin
} from 'antd';
import {
  PrinterOutlined, PlusOutlined, DeleteOutlined,
  DownloadOutlined, EyeOutlined, CheckCircleOutlined,
  ClearOutlined, BarcodeOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { reportService, type BarcodePrintItem, type BarcodePrintRequest } from '../../services/reportService';
import { inventoryService } from '../../services/inventoryService';
import { itemCategoryService } from '../../services/itemCategoryService';
import { useAppStore } from '../../stores/useAppStore';

const { Title, Text } = Typography;

interface ProductOption {
  id: string;
  title: string;
  barcode?: string;
  priRate: number;
  itemCategoryCode: string;
  itemType?: string;
}

interface CategoryOption {
  code: string;
  title: string;
}


interface BarItem {
  x: number;
  width: number;
}

// Client-side Code 128 bar calculator for crisp native SVG preview
const getCode128Bars = (text: string, unitWidth = 2, quietZone = 8): { bars: BarItem[]; totalWidth: number } => {
  const patterns: number[][] = [
    [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
    [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
    [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
    [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
    [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
    [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
    [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
    [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
    [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
    [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
    [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
    [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
    [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
    [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
    [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
    [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
    [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
    [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
    [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
    [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
    [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
    [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
    [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
    [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
    [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
    [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1],
    [2, 1, 1, 4, 1, 2], // 103 (Start A)
    [2, 1, 1, 2, 1, 4], // 104 (Start B)
    [2, 1, 1, 2, 3, 2], // 105 (Start C)
    [2, 3, 3, 1, 1, 1, 2] // 106 (Stop)
  ];

  const safeText = text || '1000001';
  const codes: number[] = [104]; // Start B
  let checksum = 104;

  for (let i = 0; i < safeText.length; i++) {
    let code = safeText.charCodeAt(i) - 32;
    if (code < 0 || code > 95) code = 0;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop

  let x = quietZone;
  const bars: BarItem[] = [];

  for (const c of codes) {
    const pattern = patterns[c];
    if (!pattern) continue;
    let isBar = true;
    for (const w of pattern) {
      const barW = w * unitWidth;
      if (isBar) {
        bars.push({ x, width: barW });
      }
      x += barW;
      isBar = !isBar;
    }
  }

  return { bars, totalWidth: x + quietZone };
};


export const BarcodePrint: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentTenantIdentifier, licenses } = useAppStore();

  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const companyName = currentOrg?.name || 'Retail Suite';

  // Products and Categories
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  // Active Item Configuration
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<ProductOption | null>(null);
  const [printPrice, setPrintPrice] = useState<number>(0);
  const [copies, setCopies] = useState<number>(10);

  // Layout & Content Options
  const [layout, setLayout] = useState<'Roll4Inch3Up' | 'ThermalRoll' | 'SheetA4'>('Roll4Inch3Up');
  const [includeCompanyName, setIncludeCompanyName] = useState<boolean>(true);
  const [includeTitle, setIncludeTitle] = useState<boolean>(true);
  const [includePrice, setIncludePrice] = useState<boolean>(true);

  // Batch Print Queue
  const [batchQueue, setBatchQueue] = useState<BarcodePrintItem[]>([]);

  // Generated PDF State
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Local printer bridge status
  const [bridgeOnline, setBridgeOnline] = useState<boolean>(false);
  const [directPrinting, setDirectPrinting] = useState<boolean>(false);

  // Check local printer bridge
  useEffect(() => {
    fetch('http://localhost:5000/printers')
      .then(res => {
        if (res.ok) setBridgeOnline(true);
      })
      .catch(() => setBridgeOnline(false));
  }, []);

  // Fetch products and categories
  useEffect(() => {
    let isMounted = true;
    setLoadingProducts(true);

    const loadData = async () => {
      try {
        // 1. Fetch categories
        let cats: CategoryOption[] = [];
        try {
          cats = (await itemCategoryService.getActiveItemCategoriesLookup()) as CategoryOption[];
        } catch {
          try {
            cats = (await itemCategoryService.getActiveItemCategories()) as CategoryOption[];
          } catch (e) {
            console.warn('Could not load categories via service', e);
          }
        }

        // 2. Fetch products
        let items: ProductOption[] = [];
        try {
          items = (await inventoryService.getItemsLookup()) as ProductOption[];
        } catch {
          try {
            items = (await inventoryService.getItems()) as ProductOption[];
          } catch (e) {
            console.warn('Could not load products via service', e);
          }
        }

        if (!isMounted) return;

        setCategories(cats || []);
        setProducts(items || []);

        // 3. Handle item selection
        const paramItemId = searchParams.get('itemId');
        if (paramItemId) {
          const match = items.find(i => i.id === paramItemId);
          if (match) {
            setSelectedProductId(match.id);
            setSelectedItem(match);
            setPrintPrice(match.priRate || 0);
            if (match.itemCategoryCode) {
              setSelectedCategory(match.itemCategoryCode);
            }
          }
        } else if (items.length > 0) {
          setSelectedProductId(items[0].id);
          setSelectedItem(items[0]);
          setPrintPrice(items[0].priRate || 0);
        }
      } catch (err) {
        console.error('Failed to load items/categories', err);
        message.error('Failed to load products list');
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter(p => p.itemCategoryCode === selectedCategory);
  }, [products, selectedCategory]);

  // Handle category filter selection
  const handleSelectCategory = (catCode?: string) => {
    setSelectedCategory(catCode);
    if (catCode) {
      const matchInCat = products.filter(p => p.itemCategoryCode === catCode);
      if (matchInCat.length > 0 && (!selectedItem || selectedItem.itemCategoryCode !== catCode)) {
        setSelectedProductId(matchInCat[0].id);
        setSelectedItem(matchInCat[0]);
        setPrintPrice(matchInCat[0].priRate || 0);
      }
    }
  };

  // Handle product selection
  const handleSelectProduct = (itemId: string) => {
    setSelectedProductId(itemId);
    const prod = products.find(p => p.id === itemId) || null;
    setSelectedItem(prod);
    if (prod) {
      setPrintPrice(prod.priRate || 0);
    }
  };


  // Add current item to batch queue
  const handleAddToBatch = () => {
    if (!selectedItem) {
      message.warning('Please select a product first');
      return;
    }

    const newItem: BarcodePrintItem = {
      itemId: selectedItem.id,
      title: selectedItem.title,
      barcode: selectedItem.barcode || selectedItem.id,
      rate: printPrice,
      copies: Math.max(1, copies)
    };

    setBatchQueue(prev => [...prev, newItem]);
    message.success(`Added ${copies}x "${selectedItem.title}" to batch queue`);
  };

  // Remove from batch
  const handleRemoveFromBatch = (index: number) => {
    setBatchQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  // Clear batch
  const handleClearBatch = () => {
    setBatchQueue([]);
  };

  // Build request payload
  const buildPayload = (): BarcodePrintRequest => {
    let itemsToPrint: BarcodePrintItem[] = [];

    if (batchQueue.length > 0) {
      itemsToPrint = [...batchQueue];
    } else if (selectedItem) {
      itemsToPrint = [{
        itemId: selectedItem.id,
        title: selectedItem.title,
        barcode: selectedItem.barcode || selectedItem.id,
        rate: printPrice,
        copies: Math.max(1, copies)
      }];
    }

    return {
      items: itemsToPrint,
      layout,
      includeCompanyName,
      includeTitle,
      includePrice,
      companyName
    };
  };

  // Generate PDF from API
  const handleGeneratePdf = async (silent = false) => {
    const payload = buildPayload();
    if (payload.items.length === 0) {
      if (!silent) message.warning('Please select a product or add items to the batch queue');
      return null;
    }

    setGeneratingPdf(true);
    try {
      const blob = await reportService.getBarcodeLabelsPdf(payload);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);

      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      if (!silent) message.success('Barcode labels generated successfully');
      return blob;
    } catch (err: any) {
      console.error(err);
      if (!silent) message.error(err?.response?.data?.message || 'Failed to generate barcode labels PDF');
      return null;
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Auto-generate preview whenever item or layout settings change
  useEffect(() => {
    if (!selectedItem) return;

    const timer = setTimeout(() => {
      handleGeneratePdf(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [
    selectedItem?.id,
    selectedItem?.barcode,
    printPrice,
    copies,
    layout,
    includeCompanyName,
    includeTitle,
    includePrice,
    batchQueue.length
  ]);

  // Direct Print via hidden iframe
  const handleDirectPrint = async () => {
    let currentUrl = pdfBlobUrl;
    if (!currentUrl) {
      const blob = await handleGeneratePdf();
      if (!blob) return;
      currentUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(currentUrl);
    }

    setDirectPrinting(true);
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = currentUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Failed to trigger browser print dialog', e);
          } finally {
            setTimeout(() => {
              document.body.removeChild(iframe);
              setDirectPrinting(false);
            }, 60000);
          }
        }, 400);
      };
    } catch (err) {
      console.error(err);
      setDirectPrinting(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `BarcodeLabels_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live preview barcode bars
  const activeBarcode = selectedItem?.barcode || selectedItem?.id || '1000001';
  const barcodeData = useMemo(() => getCode128Bars(activeBarcode, 2, 8), [activeBarcode]);

  // Total stickers in queue
  const totalQueueStickers = batchQueue.reduce((acc, curr) => acc + curr.copies, 0);

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <Space align="center" size="middle">
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 22
          }}>
            <BarcodeOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Barcode Label Printing
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Generate & print barcode labels for 4" thermal rolls (3 across), 1-Up rolls (50x30mm), or A4 sheets
            </Text>
          </div>
        </Space>

        <Space>
          {bridgeOnline ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Printer Relay Ready
            </Tag>
          ) : (
            <Tag color="default">
              Browser Print Mode
            </Tag>
          )}

          <Button
            type="primary"
            icon={<PrinterOutlined />}
            size="large"
            loading={generatingPdf || directPrinting}
            onClick={handleDirectPrint}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderColor: '#059669',
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
            }}
          >
            Print Labels
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        {/* Left Column: Configuration Controls */}
        <Col xs={24} lg={13}>
          {/* 1. Item Selection Card */}
          <Card
            title={<span style={{ fontWeight: 600 }}>1. Product & Pricing Configuration</span>}
            size="small"
            style={{ borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}
          >
            <Row gutter={12}>
              <Col span={10}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>CATEGORY FILTER</div>
                <Select
                  placeholder="All Categories"
                  allowClear
                  style={{ width: '100%' }}
                  value={selectedCategory}
                  onChange={handleSelectCategory}
                  options={categories.map(c => ({ label: c.title, value: c.code }))}
                />

              </Col>
              <Col span={14}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>SELECT PRODUCT</div>
                <Select
                  showSearch
                  placeholder="Search by title or barcode..."
                  style={{ width: '100%' }}
                  loading={loadingProducts}
                  value={selectedProductId}
                  onChange={handleSelectProduct}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={filteredProducts.map(p => ({
                    value: p.id,
                    label: `${p.title}${p.barcode ? ` [${p.barcode}]` : ''} - Rs. ${p.priRate}`
                  }))}
                />
              </Col>
            </Row>

            {selectedItem && (
              <div style={{
                marginTop: 14,
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>BARCODE</Text>
                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                      {selectedItem.barcode || selectedItem.id || 'N/A'}
                    </Text>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>PRINT PRICE (RS)</div>
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%', marginTop: 2 }}
                      value={printPrice}
                      onChange={val => setPrintPrice(val || 0)}
                    />
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>COPIES / QTY</div>
                    <InputNumber
                      min={1}
                      max={1000}
                      style={{ width: '100%', marginTop: 2 }}
                      value={copies}
                      onChange={val => setCopies(val || 1)}
                    />
                  </Col>
                </Row>

                {/* Quick Copies Presets */}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Quick copies:</Text>
                  {[1, 5, 10, 24, 50, 100].map(cnt => (
                    <Button
                      key={cnt}
                      size="small"
                      type={copies === cnt ? 'primary' : 'default'}
                      onClick={() => setCopies(cnt)}
                      style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                    >
                      {cnt}
                    </Button>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button
                    type="primary"
                    ghost
                    icon={<PlusOutlined />}
                    onClick={handleAddToBatch}
                    style={{ fontWeight: 600 }}
                  >
                    Add to Batch Queue
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 2. Format & Layout Settings */}
          <Card
            title={<span style={{ fontWeight: 600 }}>2. Print Format & Sticker Layout</span>}
            size="small"
            style={{ borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#64748b' }}>PRINT FORMAT:</div>
              <Radio.Group
                value={layout}
                onChange={e => setLayout(e.target.value)}
                buttonStyle="solid"
                style={{ width: '100%', display: 'flex' }}
              >
                <Radio.Button value="Roll4Inch3Up" style={{ flex: 1.2, textAlign: 'center', fontWeight: 600 }}>
                  <BarcodeOutlined style={{ marginRight: 6 }} />
                  4" Roll (3 Across)
                </Radio.Button>
                <Radio.Button value="ThermalRoll" style={{ flex: 1, textAlign: 'center' }}>
                  <BarcodeOutlined style={{ marginRight: 6 }} />
                  1-Up Roll (50 x 30 mm)
                </Radio.Button>
                <Radio.Button value="SheetA4" style={{ flex: 1, textAlign: 'center' }}>
                  <AppstoreOutlined style={{ marginRight: 6 }} />
                  A4 Sheet (24 labels)
                </Radio.Button>
              </Radio.Group>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <Switch
                  size="small"
                  checked={includeCompanyName}
                  onChange={setIncludeCompanyName}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ fontSize: 13 }}>Include Company Header</Text>
              </div>
              <div>
                <Switch
                  size="small"
                  checked={includeTitle}
                  onChange={setIncludeTitle}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ fontSize: 13 }}>Include Product Title</Text>
              </div>
              <div>
                <Switch
                  size="small"
                  checked={includePrice}
                  onChange={setIncludePrice}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ fontSize: 13 }}>Include Price</Text>
              </div>
            </div>
          </Card>

          {/* 3. Batch Queue Table */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>
                  Batch Queue ({batchQueue.length} items, {totalQueueStickers} total stickers)
                </span>
                {batchQueue.length > 0 && (
                  <Popconfirm
                    title="Clear Batch Queue?"
                    onConfirm={handleClearBatch}
                    okText="Clear"
                    cancelText="Cancel"
                  >
                    <Button size="small" type="text" danger icon={<ClearOutlined />}>
                      Clear All
                    </Button>
                  </Popconfirm>
                )}
              </div>
            }
            size="small"
            style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}
          >
            {batchQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Queue is empty. You can print directly or add multiple items to print in a single batch.
                </Text>
              </div>
            ) : (
              <Table
                dataSource={batchQueue.map((item, idx) => ({ ...item, key: idx }))}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Product',
                    dataIndex: 'title',
                    key: 'title',
                    render: (t, r) => (
                      <div>
                        <Text strong style={{ fontSize: 12 }}>{t}</Text>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Barcode: {r.barcode}</div>
                      </div>
                    )
                  },
                  {
                    title: 'Price',
                    dataIndex: 'rate',
                    key: 'rate',
                    align: 'right',
                    render: r => `Rs. ${r?.toLocaleString()}`
                  },
                  {
                    title: 'Copies',
                    dataIndex: 'copies',
                    key: 'copies',
                    align: 'center',
                    render: c => <Tag color="blue">{c}</Tag>
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    width: 50,
                    align: 'center',
                    render: (_, __, idx) => (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFromBatch(idx)}
                      />
                    )
                  }
                ]}
              />
            )}
          </Card>
        </Col>

        {/* Right Column: Live Sticker Preview & PDF Viewer */}
        <Col xs={24} lg={11}>
          {/* Live Thermal Sticker Preview Card */}
          <Card
            title={
              <Space>
                <EyeOutlined />
                <span style={{ fontWeight: 600 }}>Real-Time Sticker Preview</span>
                {layout === 'Roll4Inch3Up' ? (
                  <Tag color="blue">4" Roll (3 Across)</Tag>
                ) : layout === 'ThermalRoll' ? (
                  <Tag color="cyan">50mm x 30mm</Tag>
                ) : (
                  <Tag color="purple">A4 Sheet (3x8)</Tag>
                )}
              </Space>
            }
            size="small"
            style={{ borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px 14px',
              background: '#f1f5f9',
              borderRadius: '8px',
              overflowX: 'auto'
            }}>
              {layout === 'Roll4Inch3Up' ? (
                /* 4-inch 3-Up Row Mockup */
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  background: '#e2e8f0',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px dashed #94a3b8'
                }}>
                  {[1, 2, 3].map(colIdx => (
                    <div key={colIdx} style={{
                      width: '120px',
                      height: '115px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}>
                      {includeCompanyName && (
                        <div style={{
                          fontSize: '8px',
                          fontWeight: 700,
                          color: '#475569',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%'
                        }}>
                          {companyName}
                        </div>
                      )}

                      {includeTitle && (
                        <div style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%'
                        }}>
                          {selectedItem?.title || 'Product Name'}
                        </div>
                      )}

                      {/* Barcode Bars */}
                      <div style={{ width: '100%', height: '30px', margin: '2px 0', display: 'flex', justifyContent: 'center' }}>
                        <svg
                          viewBox={`0 0 ${barcodeData.totalWidth} 40`}
                          style={{ width: '100%', height: '100%' }}
                          preserveAspectRatio="none"
                        >
                          {barcodeData.bars.map((bar, idx) => (
                            <rect key={idx} x={bar.x} y={0} width={bar.width} height={40} fill="#0f172a" />
                          ))}
                        </svg>
                      </div>

                      <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>
                        {activeBarcode}
                      </div>

                      {includePrice && (
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#0f172a'
                        }}>
                          Rs. {Number(printPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Single Thermal Roll Mockup */
                <div style={{
                  width: '260px',
                  height: '160px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}>
                  {includeCompanyName && (
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}>
                      {companyName}
                    </div>
                  )}

                  {includeTitle && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0f172a',
                      lineHeight: '1.2',
                      maxHeight: '28px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {selectedItem?.title || 'Selected Product Name'}
                    </div>
                  )}

                  <div style={{ width: '100%', height: '46px', margin: '4px 0', display: 'flex', justifyContent: 'center' }}>
                    <svg
                      viewBox={`0 0 ${barcodeData.totalWidth} 44`}
                      style={{ width: '100%', height: '100%' }}
                      preserveAspectRatio="none"
                    >
                      {barcodeData.bars.map((bar, idx) => (
                        <rect key={idx} x={bar.x} y={0} width={bar.width} height={44} fill="#0f172a" />
                      ))}
                    </svg>
                  </div>

                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '1px' }}>
                    {activeBarcode}
                  </div>

                  {includePrice && (
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.2px'
                    }}>
                      Rs. {Number(printPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {layout === 'Roll4Inch3Up'
                  ? 'Continuous 4-inch (101.6 mm) thermal roll feed with 3 stickers across per row.'
                  : layout === 'ThermalRoll'
                    ? 'Single 50 x 30 mm thermal roll sticker.'
                    : 'Standard A4 sheet layout (24 stickers: 3 columns x 8 rows).'}
              </Text>
            </div>
          </Card>

          {/* PDF Preview & Direct Actions */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>PDF Document Preview</span>
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    loading={generatingPdf}
                    onClick={() => handleGeneratePdf(false)}
                  >
                    Generate Preview
                  </Button>

                  {pdfBlobUrl && (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadPdf}
                    >
                      Download
                    </Button>
                  )}
                </Space>
              </div>
            }
            size="small"
            style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }}
          >
            {generatingPdf ? (
              <div style={{ height: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" />
                <Text type="secondary" style={{ marginTop: 12, fontSize: 13 }}>Generating vector PDF stickers...</Text>
              </div>
            ) : pdfBlobUrl ? (
              <div style={{ height: '440px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#525659' }}>
                <iframe
                  src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  title="Barcode PDF Preview"
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              </div>
            ) : (
              <div style={{
                height: '240px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#fafafa',
                borderRadius: '6px',
                color: '#94a3b8'
              }}>
                <PrinterOutlined style={{ fontSize: 32, marginBottom: 8, color: '#cbd5e1' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Select an item to view preview
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
