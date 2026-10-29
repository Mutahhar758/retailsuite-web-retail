import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Popconfirm, Tooltip, Dropdown
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, ShoppingOutlined, BarcodeOutlined, FileExcelOutlined,
  DownOutlined, DatabaseOutlined, CheckSquareOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { inventoryService, type Item } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';
import { BulkOperationModal, mapProductToBulkRow } from '../../components/bulk/BulkOperationModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

export const InventoryItemList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkModalState, setBulkModalState] = useState<{
    visible: boolean;
    initialRows?: any[];
    autoPopulate?: boolean;
  }>({ visible: false });
  const navigate = useNavigate();

  const query = useMemo(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const size = parseInt(searchParams.get('size') || String(DEFAULT_PAGE_SIZE), 10);
    const search = searchParams.get('search') || '';
    return {
      page: Number.isNaN(page) || page < 1 ? 1 : page,
      size: Number.isNaN(size) || size < 1 ? DEFAULT_PAGE_SIZE : size,
      search,
    };
  }, [searchParams]);

  const [searchDraft, setSearchDraft] = useState(query.search);
  useEffect(() => {
    setSearchDraft(query.search);
  }, [query.search]);

  const updateQuery = useCallback((patch: Partial<{ page: number; size: number; search: string }>) => {
    const next = new URLSearchParams(searchParams);
    if (patch.page !== undefined) next.set('page', String(patch.page));
    if (patch.size !== undefined) next.set('size', String(patch.size));
    if (patch.search !== undefined) {
      if (patch.search) next.set('search', patch.search);
      else next.delete('search');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsResult, categoriesResult, unitsResult] = await Promise.all([
        inventoryService.getPagedItems({
          pageNumber: query.page,
          pageSize: query.size,
          search: query.search || undefined,
        }),
        itemCategoryService.getActiveItemCategories(),
        unitService.getActiveUnits(),
      ]);
      setData(itemsResult.data);
      setTotalCount(itemsResult.totalCount);
      setCategories(categoriesResult);
      setUnits(unitsResult);
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [query.page, query.size, query.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/item-details/new');
  };

  const handleEdit = (record: Item) => {
    navigate(`/setup/item-details/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await inventoryService.delete(id);
      message.success('Item deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete item');
    }
  };

  const getUnitTitle = (code?: string) => {
    if (!code) return '-';
    const unit = units.find(u => u.code === code || u.title?.toLowerCase() === code.toLowerCase());
    if (unit) return unit.title;
    return isNaN(Number(code)) ? code : '-';
  };

  const columns = [
    {
      title: 'Title',
      key: 'title',
      render: (_: any, record: Item) => (
        <Space size="middle" align="center">
          {record.itemType !== 'Service' && (
            <div 
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '6px', 
                overflow: 'hidden', 
                border: '1px solid #eef2f6',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {record.mediaUrl ? (
                <img 
                  src={record.mediaUrl} 
                  alt={record.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <ShoppingOutlined style={{ fontSize: 18, color: '#bfbfbf' }} />
              )}
            </div>
          )}
          <div>
            <Text strong>{record.title}</Text>
            {(record.brandTitle || record.modelName || record.requireImei) && (
              <div style={{ marginTop: 2 }}>
                {record.brandTitle && <Tag color="blue" style={{ fontSize: 11 }}>{record.brandTitle}</Tag>}
                {record.modelName && <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>{record.modelName}</Text>}
                {record.requireImei && <Tag color="purple" style={{ fontSize: 11 }}>Req IMEI</Tag>}
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'itemType',
      key: 'itemType',
      render: (type: string) => (
        <Tag color={type === 'Service' ? 'orange' : 'blue'}>
          {type || 'Product'}
        </Tag>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'itemCategoryCode',
      key: 'itemCategoryCode',
      render: (code: string) => {
        const category = categories.find(c => c.code === code);
        return category ? category.title : <Tag>{code}</Tag>;
      },
    },
    {
      title: 'Primary Rate',
      dataIndex: 'priRate',
      key: 'priRate',
      align: 'right' as const,
      render: (rate: number) => (
        <Text strong>
          Rs. {rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Units',
      key: 'units',
      render: (_: any, record: Item) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>{getUnitTitle(record.primaryUnit)}</Text>
          {record.secondaryUnit && (
            <Text type="secondary" style={{ fontSize: '12px' }}>{getUnitTitle(record.secondaryUnit)}</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Stock',
      key: 'opnStock',
      align: 'right' as const,
      render: (_: any, record: Item) => {
        if (record.itemType === 'Service') {
          return <Text type="secondary">N/A</Text>;
        }
        return record.opnStock?.toLocaleString() || 0;
      },
    },
    {
      title: 'Actions',
      key: 'action',
      width: '120px',
      render: (_: any, record: Item) => (
        <Space size="small">
          <Tooltip title="Print Barcode">
            <Button 
              icon={<BarcodeOutlined />} 
              size="small"
              onClick={() => navigate(`/reports/barcode-print?itemId=${record.id}`)}
              disabled={record.itemType === 'Service'}
              style={{ color: '#0284c7', borderColor: '#bae6fd' }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="primary" 
              ghost
              icon={<EditOutlined />} 
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Item"
            description="Are you sure you want to delete this item?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleOpenBulkModal = (mode: 'blank' | 'populateAll' | 'selected' | 'filtered') => {
    if (mode === 'selected') {
      const selectedItems = data.filter(d => selectedRowKeys.includes(d.id));
      setBulkModalState({
        visible: true,
        initialRows: selectedItems.map(mapProductToBulkRow),
      });
    } else if (mode === 'filtered') {
      setBulkModalState({
        visible: true,
        initialRows: data.map(mapProductToBulkRow),
      });
    } else if (mode === 'populateAll') {
      setBulkModalState({
        visible: true,
        autoPopulate: true,
      });
    } else {
      setBulkModalState({
        visible: true,
      });
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <ShoppingOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Product</Title>
            <Text type="secondary">Manage products, services, barcodes and pricing</Text>
          </div>
        </Space>
        <Space>
          <Input.Search
            placeholder="Search products/services..."
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            onSearch={val => updateQuery({ search: val.trim(), page: 1 })}
            style={{ width: 250 }}
            allowClear
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
            loading={loading}
          >
            Refresh
          </Button>

          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => handleOpenBulkModal('selected')}
            >
              Bulk Update ({selectedRowKeys.length})
            </Button>
          )}

          <Dropdown
            menu={{
              items: [
                {
                  key: 'populateAll',
                  label: `Bulk Update All Products (${totalCount})`,
                  icon: <DatabaseOutlined />,
                  onClick: () => handleOpenBulkModal('populateAll'),
                },
                ...(selectedRowKeys.length > 0
                  ? [
                      {
                        key: 'selected',
                        label: `Bulk Update Selected (${selectedRowKeys.length})`,
                        icon: <CheckSquareOutlined />,
                        onClick: () => handleOpenBulkModal('selected'),
                      },
                    ]
                  : []),
                {
                  type: 'divider' as const,
                },
                {
                  key: 'blank',
                  label: 'Blank Bulk Grid (Create / Manual)',
                  icon: <PlusOutlined />,
                  onClick: () => handleOpenBulkModal('blank'),
                },
              ],
            }}
          >
            <Button icon={<FileExcelOutlined style={{ color: '#52c41a' }} />}>
              Bulk Operations <DownOutlined />
            </Button>
          </Dropdown>

          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAdd}
          >
            New Product
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{ 
          current: query.page,
          pageSize: query.size,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total ${total} products`,
          onChange: (page, size) => updateQuery({ page, size }),
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />

      <BulkOperationModal
        visible={bulkModalState.visible}
        initialRows={bulkModalState.initialRows}
        autoPopulate={bulkModalState.autoPopulate}
        onClose={() => setBulkModalState({ visible: false })}
        onSuccess={() => {
          fetchData();
          setSelectedRowKeys([]);
        }}
        entityType="products"
      />
    </Card>
  );
};
