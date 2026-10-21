import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, Button, Space, Typography, Form, Input, Select, InputNumber, Row, Col, Checkbox, message, Popconfirm, Upload, Modal, Table
} from 'antd';
import { 
  SaveOutlined, ArrowLeftOutlined, ShoppingOutlined, DeleteOutlined, UploadOutlined, LoadingOutlined, PlusOutlined, TagsOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { inventoryService } from '../../services/inventoryService';
import { customerCategoryService } from '../../services/customerCategoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';
import { brandService, type BrandLookupDto } from '../../services/brandService';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore, MOBILE_SHOP_ENABLE_KEY } from '../../stores/useSettingsStore';
import { getPresentableUploadErrorMessage } from '../../utils/errorUtils';

const { Title, Text } = Typography;
const { Option } = Select;

export const InventoryItemForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const { getSetting } = useSettingsStore();
  const settingMobile = getSetting(MOBILE_SHOP_ENABLE_KEY, '');
  const hasMobileShopFeature = settingMobile !== '' ? settingMobile === 'true' : (currentOrg?.hasMobileShopFeature ?? false);

  const [form] = Form.useForm();
  const itemType = Form.useWatch('itemType', form);
  const selectedPrimaryUnitCode = Form.useWatch('primaryUnit', form);
  const overrideSubUnits = Form.useWatch('overrideSubUnits', form);
  const lowStockAlert = Form.useWatch('lowStockAlert', form);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [brands, setBrands] = useState<BrandLookupDto[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [catRatesModalVisible, setCatRatesModalVisible] = useState(false);
  const [catRatesLoading, setCatRatesLoading] = useState(false);
  const [savingCatRates, setSavingCatRates] = useState(false);
  const [catRates, setCatRates] = useState<Array<{
    customerCategoryId: string;
    customerCategoryTitle: string;
    priRate: number;
    secRate: number;
  }>>([]);

  const handleOpenCatRates = async () => {
    setCatRatesModalVisible(true);
    setCatRatesLoading(true);
    try {
      const lookupCategories = await customerCategoryService.getLookup();
      const currentPriRate = form.getFieldValue('priRate') || 0;
      const currentSecRate = form.getFieldValue('secRate') || 0;

      let existingPrices: any[] = [];
      if (isEdit && id) {
        existingPrices = await inventoryService.getItemCategoryPrices(id);
      }

      const merged = lookupCategories.map(cat => {
        const inState = catRates.find(c => c.customerCategoryId === cat.code);
        if (inState && !isEdit) {
          return inState;
        }

        const found = existingPrices.find(p => p.customerCategoryId === cat.code);
        return {
          customerCategoryId: cat.code,
          customerCategoryTitle: cat.title,
          priRate: found ? Number(found.priRate) : (inState ? inState.priRate : Number(currentPriRate)),
          secRate: found && found.secRate != null ? Number(found.secRate) : (inState ? inState.secRate : Number(currentSecRate))
        };
      });
      setCatRates(merged);
    } catch (err) {
      console.error(err);
      message.error('Failed to load category rates');
    } finally {
      setCatRatesLoading(false);
    }
  };

  const handleSaveCatRates = async () => {
    if (isEdit && id) {
      try {
        setSavingCatRates(true);
        await inventoryService.saveItemCategoryPrices(id, catRates.map(r => ({
          customerCategoryId: r.customerCategoryId,
          priRate: r.priRate,
          secRate: r.secRate
        })));
        message.success('Customer category rates updated successfully');
        setCatRatesModalVisible(false);
      } catch (err: any) {
        message.error(err.response?.data?.message || 'Failed to save customer category rates');
      } finally {
        setSavingCatRates(false);
      }
    } else {
      message.success('Category rates configured. They will be saved when you save the product.');
      setCatRatesModalVisible(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesResult, unitsResult, brandsResult] = await Promise.all([
        itemCategoryService.getActiveItemCategories(),
        unitService.getActiveUnits(),
        brandService.getActiveBrands().catch(() => [])
      ]);
      setCategories(categoriesResult);
      setUnits(unitsResult);
      setBrands(brandsResult);

      if (isEdit) {
        const item = await inventoryService.getById(id!);
        if (item) {
          let quickQtyPresetsArray = [];
          if (item.quickQtyPresets) {
            try {
              quickQtyPresetsArray = JSON.parse(item.quickQtyPresets);
            } catch (e) {
              quickQtyPresetsArray = item.quickQtyPresets.split(',').map((p: string) => {
                const match = p.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
                if (match) {
                  const value = parseFloat(match[1]);
                  const unit = match[2];
                  const type = unit.toLowerCase() === 'rs' ? 'rs' : (['g', 'ml'].includes(unit.toLowerCase()) ? 'secondary' : 'primary');
                  return { label: p.trim(), value, type, unit };
                }
                return { label: p.trim(), value: 0, type: 'primary', unit: '' };
              });
            }
          }
          let hasCustomSubUnits = false;
          let customSubUnitsList: Array<{ unitId: string; factor: number }> = [];
          if (item.additionalUnits && item.additionalUnits.trim() !== '') {
            try {
              const parsed = JSON.parse(item.additionalUnits);
              if (Array.isArray(parsed)) {
                hasCustomSubUnits = true;
                customSubUnitsList = parsed.map((u: any) => ({
                  unitId: u.unitId,
                  factor: Number(u.factor),
                }));
              }
            } catch {
              hasCustomSubUnits = false;
            }
          }
          form.setFieldsValue({
            ...item,
            requireImei: item.requireImei ?? false,
            brandId: item.brandId ?? undefined,
            modelName: item.modelName ?? undefined,
            storage: item.storage ?? undefined,
            ram: item.ram ?? undefined,
            color: item.color ?? undefined,
            quickQtyPresets: quickQtyPresetsArray,
            overrideSubUnits: hasCustomSubUnits,
            customAdditionalUnits: customSubUnitsList,
          });
          if (item.mediaUrl) {
            setImageUrl(item.mediaUrl);
          }
        } else {
          message.error('Item not found');
          navigate('/setup/item-details');
        }
      }
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      let serializedAdditionalUnits: string | null = null;
      if (values.overrideSubUnits) {
        const list = (values.customAdditionalUnits || [])
          .filter((x: any) => x && x.unitId && Number(x.factor) > 1)
          .map((x: any) => {
            const matchedUnit = units.find(u => u.code === x.unitId);
            return {
              unitId: x.unitId,
              unitTitle: matchedUnit?.title || x.unitId,
              shortTitle: matchedUnit?.shortTitle || null,
              factor: Number(x.factor),
            };
          });
        serializedAdditionalUnits = JSON.stringify(list);
      }

      const apiValues = {
        ...values,
        lowStockQty: values.lowStockAlert ? (values.lowStockQty ?? null) : null,
        quickQtyPresets: values.quickQtyPresets && values.quickQtyPresets.length > 0
          ? JSON.stringify(values.quickQtyPresets)
          : null,
        additionalUnits: serializedAdditionalUnits,
      };
      if (isEdit) {
        await inventoryService.update(id!, apiValues);
        message.success('Item updated successfully');
      } else {
        const newId = await inventoryService.create(apiValues);
        if (catRates.length > 0 && newId) {
          try {
            await inventoryService.saveItemCategoryPrices(newId, catRates.map(r => ({
              customerCategoryId: r.customerCategoryId,
              priRate: r.priRate,
              secRate: r.secRate
            })));
          } catch (err) {
            console.error('Failed to save category rates after creation:', err);
          }
        }
        message.success('Item created successfully');
      }
      navigate('/setup/item-details');
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await inventoryService.delete(id!);
      message.success('Item deleted successfully');
      navigate('/setup/item-details');
    } catch (error) {
      message.error('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setUploading(true);
      // 1. Get pre-signed URL and fileId from BE
      const { fileId, uploadUrl } = await inventoryService.getPresignedUploadUrl(file.name);
      
      // 2. Perform direct upload to Media Service using the pre-signed URL
      const formData = new FormData();
      formData.append('File', file);
      
      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // 3. Set mediaId in the Form values
      form.setFieldsValue({ mediaId: fileId });
      
      // 4. Generate local preview URL
      const localUrl = URL.createObjectURL(file);
      setImageUrl(localUrl);
      
      message.success('Image uploaded successfully');
      onSuccess?.("ok");
    } catch (err: any) {
      console.error(err);
      message.error(getPresentableUploadErrorMessage(err, 'Unable to upload product image. Please try again.'));
      onError?.(err as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/setup/item-details')} 
          />
          <ShoppingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? 'Edit Product' : 'New Product'}
            </Title>
            <Text type="secondary">
              {isEdit ? 'Update product information and pricing' : 'Add a new product to your database'}
            </Text>
          </div>
        </Space>
        <Space>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSave} 
            loading={loading}
            style={{ 
              backgroundColor: !isEdit && catRates.some(r => r.priRate > 0) ? '#ea580c' : '#1677ff', 
              borderColor: !isEdit && catRates.some(r => r.priRate > 0) ? '#ea580c' : '#1677ff' 
            }}
          >
            {isEdit ? 'Update Product' : (!isEdit && catRates.some(r => r.priRate > 0) ? '* Save Product' : 'Save Product')}
          </Button>
          {isEdit && (
            <Popconfirm
              title="Delete Product"
              description="Are you sure you want to delete this product?"
              onConfirm={handleDelete}
              okText="Yes"
              cancelText="No"
              okButtonProps={{ danger: true, loading }}
            >
              <Button type="primary" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ itemType: 'Product', alert: false, lowStockAlert: false, priRate: 0, secRate: 0, qtyInPack: 1 }}
      >
        {/* Hidden field to bind mediaId to form submit values */}
        <Form.Item name="mediaId" noStyle><Input type="hidden" /></Form.Item>

        <Row gutter={24}>
          <Col xs={24} md={18}>
            <Title level={5} className="mb-4">Basic Information</Title>
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item
                  name="itemType"
                  label="Type"
                  rules={[{ required: true, message: 'Type is required' }]}
                >
                  <Select placeholder="Select type" disabled={isEdit}>
                    <Option value="Product">Product</Option>
                    <Option value="Service">Service</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="barcode"
                  label="Barcode"
                >
                  <Input placeholder="Scan or enter barcode" disabled={itemType === 'Service'} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="itemCategoryCode"
                  label="Category"
                  rules={[{ required: true, message: 'Category is required' }]}
                >
                  <Select placeholder="Select category" showSearch optionFilterProp="children">
                    {categories.map(cat => (
                      <Option key={cat.code} value={cat.code}>{cat.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="brandId"
                  label="Brand"
                >
                  <Select placeholder="Select brand" allowClear showSearch optionFilterProp="children">
                    {brands.map(b => (
                      <Option key={b.id} value={b.id}>{b.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={18}>
                <Form.Item
                  name="title"
                  label="Product Title"
                  rules={[{ required: true, message: 'Product title is required' }]}
                >
                  <Input placeholder="Enter full product name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="itemKey"
                  label="Search Key"
                >
                  <Input placeholder="Quick search key" />
                </Form.Item>
              </Col>
            </Row>

            {hasMobileShopFeature && itemType !== 'Service' && (
              <div className="mt-4 mb-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <Title level={5} className="mb-3" style={{ fontSize: 14 }}>Device & IMEI Specifications</Title>
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="requireImei"
                      valuePropName="checked"
                      label="IMEI Tracking"
                    >
                      <Checkbox>Requires IMEI / Serial</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="modelName"
                      label="Model Name"
                    >
                      <Input placeholder="e.g. iPhone 15 Pro, S24" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Item
                      name="storage"
                      label="Storage"
                    >
                      <Input placeholder="e.g. 128GB, 256GB" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Item
                      name="ram"
                      label="RAM"
                    >
                      <Input placeholder="e.g. 8GB, 12GB" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item
                      name="color"
                      label="Color"
                    >
                      <Input placeholder="e.g. Black, Silver" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 mt-6">
              <Title level={5} style={{ margin: 0 }}>Pricing & Units</Title>
              <Button 
                icon={<TagsOutlined />} 
                onClick={handleOpenCatRates}
                style={{ borderColor: '#1677ff', color: '#1677ff' }}
              >
                Customer Category Rates {catRates.length > 0 && !isEdit ? `(${catRates.filter(r => r.priRate > 0).length} set)` : ''}
              </Button>
            </div>
            {itemType !== 'Service' ? (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="primaryUnit"
                      label="Primary Unit"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <Select placeholder="Select primary unit">
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="priRate"
                      label="Primary Rate"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="secondaryUnit"
                      label="Secondary Unit"
                    >
                      <Select placeholder="Optional unit" allowClear>
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="secRate"
                      label="Secondary Rate"
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="defaultUnit"
                      label="Default Unit"
                    >
                      <Select placeholder="Automatic">
                        {units.map(u => (
                          <Option key={u.code} value={u.code}>{u.title}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="qtyInPack"
                      label="Quantity in Pack"
                    >
                      <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={lowStockAlert ? 6 : 12}>
                    <div style={{ marginTop: '32px' }}>
                      <Space size="large">
                        <Form.Item name="alert" valuePropName="checked" noStyle>
                          <Checkbox>Enable Alerts</Checkbox>
                        </Form.Item>
                        <Form.Item name="lowStockAlert" valuePropName="checked" noStyle>
                          <Checkbox>Low Stock Alert</Checkbox>
                        </Form.Item>
                      </Space>
                    </div>
                  </Col>
                  {lowStockAlert && (
                    <Col xs={24} md={6}>
                      <Form.Item
                        name="lowStockQty"
                        label="Low Stock Qty"
                        rules={[{ required: true, message: 'Please enter low stock quantity' }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Alert on or below qty" />
                      </Form.Item>
                    </Col>
                  )}
                </Row>

                <Row gutter={16}>
                  <Col xs={24}>
                    {(() => {
                      const primaryUnitObj = units.find(u => u.code === selectedPrimaryUnitCode);
                      const primaryLabel = primaryUnitObj?.shortTitle || primaryUnitObj?.title || 'Primary Unit';
                      const inheritedSubUnits = units.filter(
                        u => u.parentUnitId === selectedPrimaryUnitCode && u.conversionRatio && Number(u.conversionRatio) > 1
                      );

                      return (
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          backgroundColor: '#f8fafc',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                ⚖️ Sub-Units for Fractional Quantities (e.g. 50g, 250g, 1250g)
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                Prices remain on Primary/Secondary Unit. Fractional quantities convert automatically on bills & reports.
                              </Text>
                            </div>
                            <Form.Item name="overrideSubUnits" valuePropName="checked" noStyle>
                              <Checkbox
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const currentCustom = form.getFieldValue('customAdditionalUnits');
                                    if (!currentCustom || currentCustom.length === 0) {
                                      form.setFieldValue(
                                        'customAdditionalUnits',
                                        inheritedSubUnits.map(u => ({
                                          unitId: u.code,
                                          factor: Number(u.conversionRatio),
                                        }))
                                      );
                                    }
                                  }
                                }}
                              >
                                Override for this Product
                              </Checkbox>
                            </Form.Item>
                          </div>

                          {!overrideSubUnits ? (
                            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                              {inheritedSubUnits.length > 0 ? (
                                <span>
                                  Using default sub-unit(s) from <strong>{primaryUnitObj?.title}</strong>:{' '}
                                  {inheritedSubUnits.map(u => (
                                    <span
                                      key={u.code}
                                      style={{
                                        display: 'inline-block',
                                        background: '#e0f2fe',
                                        color: '#0369a1',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        fontWeight: 600,
                                        marginRight: 6,
                                      }}
                                    >
                                      {u.conversionRatio} {u.shortTitle || u.title} = 1 {primaryLabel}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span>
                                  No default sub-units configured for <strong>{primaryUnitObj?.title || 'selected Primary Unit'}</strong>. Check &ldquo;Override for this Product&rdquo; to add one specifically for this item, or configure a default Parent Unit in Units Setup.
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ marginTop: 12 }}>
                              <Form.List name="customAdditionalUnits">
                                {(fields, { add, remove }) => (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {fields.map(({ key, name, ...restField }) => (
                                      <Row key={key} gutter={12} align="middle">
                                        <Col xs={12}>
                                          <Form.Item
                                            {...restField}
                                            name={[name, 'unitId']}
                                            style={{ marginBottom: 4 }}
                                            rules={[{ required: true, message: 'Select sub-unit' }]}
                                          >
                                            <Select placeholder="Select smaller sub-unit (e.g. Gram)">
                                              {units
                                                .filter(u => u.code !== selectedPrimaryUnitCode)
                                                .map(u => (
                                                  <Option key={u.code} value={u.code}>
                                                    {u.title}{u.shortTitle ? ` (${u.shortTitle})` : ''}
                                                  </Option>
                                                ))}
                                            </Select>
                                          </Form.Item>
                                        </Col>
                                        <Col xs={10}>
                                          <Form.Item
                                            {...restField}
                                            name={[name, 'factor']}
                                            style={{ marginBottom: 4 }}
                                            rules={[
                                              { required: true, message: 'Enter ratio > 1' },
                                              {
                                                validator: (_, val) =>
                                                  val && Number(val) > 1
                                                    ? Promise.resolve()
                                                    : Promise.reject(new Error('Ratio must be > 1')),
                                              },
                                            ]}
                                          >
                                            <InputNumber
                                              style={{ width: '100%' }}
                                              min={1.0001}
                                              placeholder={`How many in 1 ${primaryLabel}? (e.g. 1000)`}
                                              addonAfter={`= 1 ${primaryLabel}`}
                                            />
                                          </Form.Item>
                                        </Col>
                                        <Col xs={2}>
                                          <Button
                                            danger
                                            type="text"
                                            icon={<DeleteOutlined />}
                                            onClick={() => remove(name)}
                                          />
                                        </Col>
                                      </Row>
                                    ))}
                                    <Button
                                      type="dashed"
                                      onClick={() => add({ unitId: undefined, factor: 1000 })}
                                      icon={<PlusOutlined />}
                                      size="small"
                                      style={{ width: 220, marginTop: 4 }}
                                    >
                                      Add Custom Sub-Unit
                                    </Button>
                                  </div>
                                )}
                              </Form.List>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24}>
                    <div style={{
                      border: '1px solid #f1f5f9',
                      borderRadius: '12px',
                      padding: '20px',
                      backgroundColor: '#f8fafc',
                      marginBottom: '24px'
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>
                        ⚡ Touch POS Quick Quantity & Price Presets
                      </div>
                      
                      <Form.List name="quickQtyPresets">
                        {(fields, { add, remove }) => (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {fields.map(({ key, name, ...restField }) => (
                              <Row key={key} gutter={12}>
                                <Col xs={8}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'type']}
                                    rules={[{ required: true, message: 'Required' }]}
                                  >
                                    <Select placeholder="Type" style={{ width: '100%' }}>
                                      <Option value="rs">Price Target (Rs.)</Option>
                                      <Option value="secondary">Secondary Unit (e.g. ml, g)</Option>
                                      <Option value="primary">Primary Unit (e.g. L, kg)</Option>
                                    </Select>
                                  </Form.Item>
                                </Col>
                                <Col xs={7}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'value']}
                                    rules={[{ required: true, message: 'Required' }]}
                                  >
                                    <InputNumber placeholder="Value" min={0.001} style={{ width: '100%' }} />
                                  </Form.Item>
                                </Col>
                                <Col xs={7}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'label']}
                                    rules={[{ required: true, message: 'Required' }]}
                                  >
                                    <Input placeholder="Label (e.g. 250ml)" style={{ width: '100%' }} />
                                  </Form.Item>
                                </Col>
                                <Col xs={2}>
                                  <Form.Item>
                                    <Button 
                                      danger 
                                      type="text" 
                                      icon={<DeleteOutlined style={{ fontSize: 16 }} />} 
                                      onClick={() => remove(name)} 
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                                    />
                                  </Form.Item>
                                </Col>
                              </Row>
                            ))}
                            <Button 
                              type="dashed" 
                              onClick={() => add({ type: 'rs', value: 100, label: '100 Rs' })} 
                              block 
                              icon={<PlusOutlined />}
                              style={{ height: 40, borderRadius: 8, borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
                            >
                              Add Preset Option
                            </Button>
                          </div>
                        )}
                      </Form.List>
                    </div>
                  </Col>
                </Row>
              </>
            ) : (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={24}>
                    <Form.Item
                      name="priRate"
                      label="Rate"
                      rules={[{ required: true, message: 'Required' }]}
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={24}>
                    <div style={{ marginTop: '16px' }}>
                      <Form.Item name="alert" valuePropName="checked" noStyle>
                        <Checkbox>Enable Alerts</Checkbox>
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {itemType !== 'Service' && (
              <>
                <div className="flex justify-between items-center mb-4 mt-6">
                  <Title level={5} style={{ margin: 0 }}>Opening Stock</Title>
                </div>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="opnStock"
                      label="Opening Quantity"
                    >
                      <InputNumber 
                        style={{ width: '100%' }} 
                        min={0} 
                        placeholder="0.00" 
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="opnRate"
                      label="Opening Rate"
                    >
                      <InputNumber<any> 
                        style={{ width: '100%' }} 
                        min={0} 
                        placeholder="0.00"
                        formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={value => value ? value.replace(/Rs\.\s?|(,*)/g, '') : ''}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}
          </Col>

          <Col xs={24} md={6}>
            {itemType !== 'Service' && (
              <Card 
                title="Product Media" 
                className="shadow-sm border-gray-100 rounded-xl"
                style={{ textAlign: 'center', marginBottom: '24px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {imageUrl ? (
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                      <img 
                        src={imageUrl} 
                        alt="Product" 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 4, backgroundColor: '#ffffff' }} 
                      />
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        width: '100%', 
                        paddingBottom: '100%', 
                        position: 'relative',
                        marginBottom: '16px', 
                        borderRadius: '8px', 
                        backgroundColor: '#fafafa', 
                        border: '1px dashed #d9d9d9',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <ShoppingOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>No Image</Text>
                      </div>
                    </div>
                  )}

                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    customRequest={handleCustomUpload}
                    disabled={uploading}
                  >
                    <Button 
                      icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} 
                      loading={uploading}
                      type="dashed"
                      style={{ width: '100%' }}
                    >
                      {imageUrl ? 'Change Image' : 'Upload Image'}
                    </Button>
                  </Upload>

                  <div style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    textAlign: 'left',
                    width: '100%'
                  }}>
                    <Text strong style={{ fontSize: 12, color: '#334155', display: 'block', marginBottom: 4 }}>
                      📸 Recommended Image Specs:
                    </Text>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: '1.6' }}>
                      <div>• <strong>Aspect Ratio:</strong> 1:1 (Square) or 4:5 (Portrait)</div>
                      <div>• <strong>Optimal Dimensions:</strong> 600 × 600 px to 1000 × 1000 px</div>
                      <div>• <strong>File Size & Format:</strong> Max 5MB (JPG, PNG, WebP)</div>
                      <div>• <strong>POS Tip:</strong> Products with centered framing and clean white/transparent background look best on the POS screen.</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </Col>
        </Row>
      </Form>

      <Modal
        title="Customer Category Rates"
        open={catRatesModalVisible}
        onCancel={() => setCatRatesModalVisible(false)}
        onOk={handleSaveCatRates}
        confirmLoading={savingCatRates}
        width={650}
        destroyOnClose
      >
        <Text type="secondary" className="block mb-4">
          Define custom selling rates for this product per customer category. If no rate is defined, the default product rate will be used.
        </Text>
        <Table
          dataSource={catRates}
          rowKey="customerCategoryId"
          loading={catRatesLoading}
          pagination={false}
          size="small"
          bordered
          columns={[
            {
              title: 'Customer Category',
              dataIndex: 'customerCategoryTitle',
              key: 'title',
              render: (title: string) => <Text strong>{title}</Text>
            },
            {
              title: 'Primary Rate (Rs)',
              dataIndex: 'priRate',
              key: 'priRate',
              render: (val: number, record: any) => (
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  value={val}
                  onChange={(v) => {
                    const newVal = v != null ? Number(v) : 0;
                    setCatRates(prev => prev.map(r => r.customerCategoryId === record.customerCategoryId ? { ...r, priRate: newVal } : r));
                  }}
                />
              )
            },
            {
              title: 'Secondary Rate (Rs)',
              dataIndex: 'secRate',
              key: 'secRate',
              render: (val: number, record: any) => (
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  value={val}
                  onChange={(v) => {
                    const newVal = v != null ? Number(v) : 0;
                    setCatRates(prev => prev.map(r => r.customerCategoryId === record.customerCategoryId ? { ...r, secRate: newVal } : r));
                  }}
                />
              )
            }
          ]}
        />
      </Modal>
    </Card>
  );
};
