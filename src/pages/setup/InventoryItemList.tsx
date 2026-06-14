import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Popconfirm, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ReloadOutlined, ShoppingOutlined, SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { inventoryService, type Item } from '../../services/inventoryService';
import { itemCategoryService, type ItemCategoryDto } from '../../services/itemCategoryService';
import { unitService, type UnitDto } from '../../services/unitService';

const { Title, Text } = Typography;

export const InventoryItemList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsResult, categoriesResult, unitsResult] = await Promise.all([
        inventoryService.getItems(),
        itemCategoryService.getActiveItemCategories(),
        unitService.getActiveUnits(),
      ]);
      setData(itemsResult);
      setCategories(categoriesResult);
      setUnits(unitsResult);
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

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
    const unit = units.find(u => u.code === code);
    return unit ? unit.title : code;
  };

  const filteredData = data.filter(item => 
    item.title.toLowerCase().includes(searchText.toLowerCase()) ||
    item.id.toLowerCase().includes(searchText.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchText.toLowerCase())
  );

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
          <Text strong>{record.title}</Text>
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
        <Space size="middle">
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
          <Input
            placeholder="Search products/services..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
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
        dataSource={filteredData} 
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
