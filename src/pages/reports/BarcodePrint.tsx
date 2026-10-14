import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Select, InputNumber, Button, Space,
  Row, Col, message, Switch, Radio,
  Popconfirm, Spin, Empty, Tooltip
} from 'antd';
import {
  PrinterOutlined, PlusOutlined, DeleteOutlined,
  DownloadOutlined, ClearOutlined, BarcodeOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ExportOutlined,
  SearchOutlined
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [directPrinting, setDirectPrinting] = useState<boolean>(false);

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
    message.success(`Added ${copies}x "${selectedItem.title}" to queue`);
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

  // Auto-generate preview on initial select or options change
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

  // Open in New Tab
  const handleOpenInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    }
  };

  const totalQueueStickers = batchQueue.reduce((acc, curr) => acc + curr.copies, 0);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8fafc'
    }}>
      {/* Top Action Header Bar (matches standard RetailSuite report layout) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarcodeOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Barcode Label Printing
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Generate & print barcode price stickers for 4" thermal roll (3-Up across), 1-Up roll, or A4 sheet
            </Text>
          </div>
        </div>

        <Space wrap>
          <Tooltip title={isCollapsed ? 'Show Parameters' : 'Hide Parameters'}>
            <Button
              icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          </Tooltip>

          {pdfBlobUrl && (
            <>
              <Tooltip title="Direct 1-click print">
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handleDirectPrint}
                  loading={directPrinting}
                >
                  Print PDF
                </Button>
              </Tooltip>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
              <Tooltip title="Open in New Tab">
                <Button
                  icon={<ExportOutlined />}
                  onClick={handleOpenInNewTab}
                />
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      {/* Main Side-by-Side Workspace */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '16px',
        height: 'calc(100vh - 180px)',
        width: '100%',
        padding: '14px 16px 0 16px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {/* Left: Fixed Collapsible Parameters Panel */}
        {!isCollapsed && (
          <div style={{
            width: '360px',
            minWidth: '360px',
            maxWidth: '360px',
            height: '100%',
            overflowY: 'auto'
          }}>
            <Card
              title={<span style={{ fontSize: 13, fontWeight: 600 }}>Print Parameters</span>}
              size="small"
              className="shadow-sm"
              style={{ borderRadius: 8, height: '100%' }}
            >
              {/* Category Filter */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#334155' }}>
                  Category Filter
                </div>
                <Select
                  style={{ width: '100%' }}
                  placeholder="All Categories"
                  allowClear
                  value={selectedCategory}
                  onChange={handleSelectCategory}
                  options={categories.map(c => ({ label: c.title, value: c.code }))}
                />
              </div>

              {/* Product Select */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#334155' }}>
                  Product / Item <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <Select
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  placeholder="Select product to print"
                  loading={loadingProducts}
                  value={selectedProductId}
                  onChange={handleSelectProduct}
                  options={filteredProducts.map(p => ({
                    label: `${p.title} (${p.barcode || p.id}) - Rs. ${Number(p.priRate || 0).toLocaleString()}`,
                    value: p.id
                  }))}
                />
              </div>

              {/* Copies & Rate */}
              <Row gutter={10} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#334155' }}>
                    Copies
                  </div>
                  <InputNumber
                    min={1}
                    max={5000}
                    value={copies}
                    onChange={val => setCopies(val || 1)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#334155' }}>
                    Print Price (Rs)
                  </div>
                  <InputNumber
                    min={0}
                    value={printPrice}
                    onChange={val => setPrintPrice(val || 0)}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>

              {/* Print Format Selector */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#334155' }}>
                  Print Format
                </div>
                <Radio.Group
                  value={layout}
                  onChange={e => setLayout(e.target.value)}
                  buttonStyle="solid"
                  style={{ width: '100%', display: 'flex' }}
                >
                  <Radio.Button value="Roll4Inch3Up" style={{ flex: 1.2, textAlign: 'center', fontSize: 11, padding: '0 4px', fontWeight: 600 }}>
                    4" Roll (3-Up)
                  </Radio.Button>
                  <Radio.Button value="ThermalRoll" style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '0 4px' }}>
                    50x30mm
                  </Radio.Button>
                  <Radio.Button value="SheetA4" style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '0 4px' }}>
                    A4 (3x8)
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* Display Options */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 16,
                background: '#f8fafc',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>Company Header</Text>
                  <Switch size="small" checked={includeCompanyName} onChange={setIncludeCompanyName} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>Product Title</Text>
                  <Switch size="small" checked={includeTitle} onChange={setIncludeTitle} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>Rate / Price</Text>
                  <Switch size="small" checked={includePrice} onChange={setIncludePrice} />
                </div>
              </div>

              {/* Primary Action Button */}
              <div style={{ marginBottom: 12 }}>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  loading={generatingPdf}
                  onClick={() => handleGeneratePdf(false)}
                  block
                  style={{
                    backgroundColor: '#16a34a',
                    borderColor: '#16a34a',
                    height: 38,
                    fontWeight: 500
                  }}
                >
                  Generate Report
                </Button>
              </div>

              {/* Add to Queue / Clear Queue */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <Button
                  icon={<PlusOutlined />}
                  onClick={handleAddToBatch}
                  style={{ flex: 1, fontSize: 12 }}
                >
                  Queue Item
                </Button>
                {batchQueue.length > 0 && (
                  <Popconfirm title="Clear entire queue?" onConfirm={handleClearBatch}>
                    <Button danger icon={<ClearOutlined />} style={{ fontSize: 12 }} />
                  </Popconfirm>
                )}
              </div>

              {/* Queue Summary Table */}
              {batchQueue.length > 0 && (
                <div style={{
                  background: '#f1f5f9',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 11 }}>
                      Print Queue ({batchQueue.length} items, {totalQueueStickers} total)
                    </Text>
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {batchQueue.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '3px 0',
                        fontSize: 11,
                        borderBottom: '1px dashed #cbd5e1'
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {item.copies}x {item.title}
                        </span>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveFromBatch(idx)}
                          style={{ padding: '0 4px', height: 20 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Right: Full-Height PDF Preview Workspace (standard dark gray document background) */}
        <div style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <Card
            size="small"
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 8,
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}
            styles={{
              body: {
                flex: 1,
                padding: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: '#525659'
              }
            }}
          >
            {generatingPdf ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <Spin size="large" />
                <Text style={{ marginTop: 16, color: '#64748b' }}>Generating Barcode Labels PDF...</Text>
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title="Barcode Labels Preview"
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block' }}
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc'
              }}>
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      Select a product and click <b>Generate Report</b> to preview barcode stickers.
                    </span>
                  }
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
