import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Input, Modal, Form, Row, Col, Statistic, Select, InputNumber,
  DatePicker, Radio, Divider, Tooltip, Popconfirm
} from 'antd';
import {
  ShopOutlined, PlusOutlined, ReloadOutlined,
  SearchOutlined, BankOutlined, FolderAddOutlined,
  FileTextOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { chartOfAccountService, type ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { fixedAssetService } from '../../services/fixedAssetService';

const { Title, Text } = Typography;

interface AssetTableRow {
  account: string;
  title: string;
  categoryTitle: string;
  subcategoryTitle: string;
  balance: number;
}

export const FixedAssetList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [categories, setCategories] = useState<ChartOfAccountHeadDto[]>([]);
  const [subcategories, setSubcategories] = useState<ChartOfAccountHeadDto[]>([]);
  const [assets, setAssets] = useState<ChartOfAccountHeadDto[]>([]);
  const [assetBalances, setAssetBalances] = useState<Record<string, number>>({});

  // Payment lookups
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [vendorAccounts, setVendorAccounts] = useState<ChartOfAccountHeadDto[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash_bank' | 'vendor_credit' | 'opening'>('cash_bank');

  const [assetForm] = Form.useForm();
  const [subForm] = Form.useForm();

  // Watch selected category inside modal for dynamic subcategory dropdown
  const modalSelectedCat = Form.useWatch('categoryId', assetForm);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, subs, assetList, cbAccs, vendors] = await Promise.all([
        fixedAssetService.getCategories(),
        fixedAssetService.getSubcategories(),
        fixedAssetService.getFixedAssets(),
        chartOfAccountService.getCashBankAccounts(),
        chartOfAccountService.getSupplierAccounts(),
      ]);

      setCategories(cats);
      setSubcategories(subs);
      setAssets(assetList);
      setCashBankAccounts(cbAccs);
      setVendorAccounts(vendors);

      // Fetch balances for all assets
      const balances: Record<string, number> = {};
      await Promise.all(
        assetList.map(async (a) => {
          try {
            const bal = await fixedAssetService.getAssetBalance(a.account);
            balances[a.account] = bal;
          } catch {
            balances[a.account] = 0;
          }
        })
      );
      setAssetBalances(balances);
    } catch {
      message.error('Failed to load fixed assets register');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map each asset to its Category and Subcategory
  const tableData: AssetTableRow[] = useMemo(() => {
    return assets.map((a) => {
      const catId = a.account.substring(0, 9);
      const subId = a.account.substring(0, 12);

      const cat = categories.find((c) => c.account === catId);
      const sub = subcategories.find((s) => s.account === subId);

      return {
        account: a.account,
        title: a.title,
        categoryTitle: cat ? cat.title : 'General Asset',
        subcategoryTitle: sub ? sub.title : 'Unclassified',
        balance: assetBalances[a.account] || 0,
      };
    });
  }, [assets, categories, subcategories, assetBalances]);

  // Filtered rows
  const filteredData = useMemo(() => {
    return tableData.filter((row) => {
      if (selectedCategory && !row.account.startsWith(selectedCategory)) return false;
      if (selectedSubcategory && !row.account.startsWith(selectedSubcategory)) return false;
      if (searchText) {
        const query = searchText.toLowerCase();
        return (
          row.title.toLowerCase().includes(query) ||
          row.account.toLowerCase().includes(query) ||
          row.subcategoryTitle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [tableData, selectedCategory, selectedSubcategory, searchText]);

  // Aggregate Stats
  const totalAssetValue = useMemo(() => {
    return tableData.reduce((sum, item) => sum + (item.balance || 0), 0);
  }, [tableData]);

  // Handle Add Asset Submit
  const handleAssetSubmit = async () => {
    try {
      const values = await assetForm.validateFields();
      setSubmitting(true);

      const result = await fixedAssetService.createFixedAsset({
        title: values.title,
        subcategoryId: values.subcategoryId,
        cost: values.cost,
        purchaseDate: values.purchaseDate ? values.purchaseDate.format('YYYY-MM-DD') : undefined,
        paymentMode,
        cashBankAccountId: values.cashBankAccountId,
        vendorAccountId: values.vendorAccountId,
        remarks: values.remarks,
      });

      if (result.voucherNo === 'OP-BAL') {
        message.success(
          `Existing asset "${values.title}" registered with opening value of Rs. ${Number(values.cost || 0).toLocaleString()}!`
        );
      } else {
        message.success(
          `Asset "${values.title}" created successfully! ${result.voucherNo ? `(Voucher #${result.voucherNo})` : ''}`
        );
      }
      setIsAssetModalOpen(false);
      assetForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Subcategory Submit
  const handleSubcategorySubmit = async () => {
    try {
      const values = await subForm.validateFields();
      setSubmitting(true);

      await fixedAssetService.createSubcategory(values.title, values.parentCategoryId);
      message.success(`Subcategory "${values.title}" created successfully!`);
      setIsSubcategoryModalOpen(false);
      subForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to create subcategory');
    } finally {
      setSubmitting(false);
    }
  };

  // Modal subcategories based on chosen modal category
  const modalSubcategories = useMemo(() => {
    if (!modalSelectedCat) return subcategories;
    return subcategories.filter((s) => s.account.startsWith(modalSelectedCat));
  }, [subcategories, modalSelectedCat]);

  const columns = [
    {
      title: 'Code',
      dataIndex: 'account',
      key: 'account',
      width: 140,
      render: (val: string) => <Tag style={{ fontFamily: 'monospace' }}>{val}</Tag>,
    },
    {
      title: 'Asset Name',
      dataIndex: 'title',
      key: 'title',
      render: (val: string) => <Text strong style={{ fontSize: 14 }}>{val}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'categoryTitle',
      key: 'categoryTitle',
      width: 180,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Subcategory',
      dataIndex: 'subcategoryTitle',
      key: 'subcategoryTitle',
      width: 200,
      render: (val: string) => <Tag color="cyan">{val}</Tag>,
    },
    {
      title: 'Recorded Value',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      width: 150,
      render: (val: number) => (
        <Text strong style={{ color: '#096dd9', fontSize: 14 }}>
          Rs. {Number(val || 0).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: AssetTableRow) => (
        <Space size="small">
          <Tooltip title="View Account Statement">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/reports/account-statement?account=${record.account}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Asset"
            description="Are you sure you want to delete this asset? Only assets without transactions can be deleted."
            onConfirm={async () => {
              try {
                await chartOfAccountService.delete(record.account);
                message.success('Asset deleted successfully');
                fetchData();
              } catch (err: any) {
                message.error(err.response?.data?.message || 'Failed to delete asset');
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#e6f7ff', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#096dd9' }}>Total Fixed Asset Value</Text>}
              value={totalAssetValue}
              prefix="Rs."
              precision={0}
              valueStyle={{ color: '#096dd9', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f6ffed', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#389e0d' }}>Total Registered Assets</Text>}
              value={assets.length}
              valueStyle={{ color: '#389e0d', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#fff7e6', borderRadius: 8 }}>
            <Statistic
              title={<Text strong style={{ color: '#d46b08' }}>Asset Categories</Text>}
              value={categories.length}
              valueStyle={{ color: '#d46b08', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Asset Register Card */}
      <Card
        title={
          <Space>
            <ShopOutlined style={{ color: '#1677ff', fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>Fixed Assets Register</Title>
          </Space>
        }
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                assetForm.resetFields();
                setPaymentMode('cash_bank');
                assetForm.setFieldsValue({
                  purchaseDate: dayjs(),
                  paymentMode: 'cash_bank',
                  cashBankAccountId: cashBankAccounts[0]?.account,
                });
                setIsAssetModalOpen(true);
              }}
            >
              Add Fixed Asset
            </Button>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => {
                subForm.resetFields();
                setIsSubcategoryModalOpen(true);
              }}
            >
              + Asset Subcategory
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchData} />
          </Space>
        }
      >
        {/* Filters */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              placeholder="Filter by Category"
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                setSelectedSubcategory(undefined);
              }}
            >
              {categories.map((c) => (
                <Select.Option key={c.account} value={c.account}>
                  {c.title}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              placeholder="Filter by Subcategory"
              style={{ width: '100%' }}
              value={selectedSubcategory}
              onChange={setSelectedSubcategory}
            >
              {subcategories
                .filter((s) => !selectedCategory || s.account.startsWith(selectedCategory))
                .map((s) => (
                  <Select.Option key={s.account} value={s.account}>
                    {s.title}
                  </Select.Option>
                ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search assets by name or code..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="account"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
        />
      </Card>

      {/* Add Asset Modal */}
      <Modal
        title={
          <Space>
            <ShopOutlined style={{ color: '#1677ff' }} />
            <span>Add Fixed Asset</span>
          </Space>
        }
        open={isAssetModalOpen}
        onOk={handleAssetSubmit}
        onCancel={() => setIsAssetModalOpen(false)}
        confirmLoading={submitting}
        okText="Save Asset"
        width={580}
        destroyOnClose
      >
        <Form form={assetForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="categoryId"
                label="Asset Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select
                  placeholder="Select Category"
                  onChange={() => assetForm.setFieldsValue({ subcategoryId: undefined })}
                >
                  {categories.map((c) => (
                    <Select.Option key={c.account} value={c.account}>
                      {c.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="subcategoryId"
                label="Subcategory"
                rules={[{ required: true, message: 'Please select subcategory' }]}
              >
                <Select
                  placeholder="Select Subcategory"
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          subForm.resetFields();
                          if (modalSelectedCat) {
                            subForm.setFieldsValue({ parentCategoryId: modalSelectedCat });
                          }
                          setIsSubcategoryModalOpen(true);
                        }}
                      >
                        + Add Subcategory
                      </Button>
                    </>
                  )}
                >
                  {modalSubcategories.map((s) => (
                    <Select.Option key={s.account} value={s.account}>
                      {s.title}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Asset Name"
            rules={[{ required: true, message: 'Please enter asset name' }]}
          >
            <Input placeholder="e.g. Display Chiller 2-Door, Generator 7kVA, POS Terminal" />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>Acquisition & Payment</Divider>

          <Form.Item label="Payment / Booking Mode">
            <Radio.Group
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="cash_bank">Paid from Cash / Bank</Radio.Button>
              <Radio.Button value="vendor_credit">Supplier Credit</Radio.Button>
              <Radio.Button value="opening">Existing / Opening Asset</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {paymentMode === 'opening' ? (
            <>
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#389e0d' }}>
                  ℹ️ This is an existing asset already owned by the business. Its recorded value will increase your <strong>Fixed Assets</strong> on the Balance Sheet and credit <strong>Owner's Capital / Equity</strong>.
                </Text>
              </div>

              <Row gutter={12}>
                <Col span={24}>
                  <Form.Item
                    name="cost"
                    label="Opening Valuation / Book Value (Rs.)"
                    tooltip="Estimated current value or purchase value of this existing asset."
                    rules={[{ required: true, message: 'Please enter asset opening value' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="e.g. 150,000"
                      min={1}
                      formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(val) => (val ? Number(val.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="remarks" label="Notes / Description (Optional)">
                <Input.TextArea rows={2} placeholder="e.g. Installed in store 2 years ago, in good working condition" />
              </Form.Item>
            </>
          ) : (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="cost"
                    label="Purchase Cost (Rs.)"
                    rules={[{ required: true, message: 'Please enter purchase amount' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      min={1}
                      formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(val) => (val ? Number(val.replace(/\$\s?|(,*)/g, '')) : 0) as any}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="purchaseDate"
                    label="Purchase Date"
                    rules={[{ required: true, message: 'Please select purchase date' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                </Col>
              </Row>

              {paymentMode === 'cash_bank' && (
                <Form.Item
                  name="cashBankAccountId"
                  label="Paid From (Cash / Bank)"
                  rules={[{ required: true, message: 'Please select payment account' }]}
                >
                  <Select placeholder="Select Cash or Bank account">
                    {cashBankAccounts.map((cb) => (
                      <Select.Option key={cb.account} value={cb.account}>
                        <BankOutlined style={{ marginRight: 6 }} />
                        {cb.title}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {paymentMode === 'vendor_credit' && (
                <Form.Item
                  name="vendorAccountId"
                  label="Supplier / Vendor"
                  rules={[{ required: true, message: 'Please select supplier' }]}
                >
                  <Select placeholder="Select supplier">
                    {vendorAccounts.map((v) => (
                      <Select.Option key={v.account} value={v.account}>
                        {v.title}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              <Form.Item name="remarks" label="Payment Note / Description">
                <Input.TextArea rows={2} placeholder="e.g. Purchased for Ground Floor Counter from Al-Rehman Electronics" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Add Subcategory Modal */}
      <Modal
        title={
          <Space>
            <FolderAddOutlined style={{ color: '#1677ff' }} />
            <span>Add Asset Subcategory</span>
          </Space>
        }
        open={isSubcategoryModalOpen}
        onOk={handleSubcategorySubmit}
        onCancel={() => setIsSubcategoryModalOpen(false)}
        confirmLoading={submitting}
        okText="Create Subcategory"
        destroyOnClose
      >
        <Form form={subForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="parentCategoryId"
            label="Asset Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select Category (e.g. Equipment, Furniture, Vehicles)">
              {categories.map((c) => (
                <Select.Option key={c.account} value={c.account}>
                  {c.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Subcategory Name"
            rules={[{ required: true, message: 'Please enter subcategory title' }]}
          >
            <Input placeholder="e.g. Store & Retail Equipment, POS Hardware, Display Racks" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FixedAssetList;
