import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Popconfirm, Tooltip
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  SearchOutlined, ReloadOutlined, ShoppingCartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supplyOrderService, type SupplyOrder } from '../../services/supplyOrderService';

const { Title, Text } = Typography;

export const SupplyOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SupplyOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await supplyOrderService.getList();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch supply orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    try {
      await supplyOrderService.delete(id);
      message.success('Supply order deleted successfully');
      fetchData();
    } catch (error) {
      message.error('Failed to delete supply order');
    }
  };

  const filteredData = data.filter(order => 
    order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toString().includes(searchQuery)
  );

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: '120px',
      render: (id: number) => <Tag color="blue">SO-{id}</Tag>,
    },
    {
      title: 'Order Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong className="text-gray-800 dark:text-gray-200">{text}</Text>,
    },
    {
      title: 'Actions',
      key: 'action',
      width: '150px',
      render: (_: any, record: SupplyOrder) => (
        <Space size="middle">
          <Tooltip title="Edit">
            <Button 
              type="primary" 
              ghost
              icon={<EditOutlined />} 
              size="small"
              onClick={() => navigate(`/setup/supply-order/${record.id}`)}
              style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
              className="hover:bg-amber-50"
            />
          </Tooltip>
          <Popconfirm
            title="Delete Supply Order"
            description="Are you sure you want to delete this supply order?"
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Space align="center" size="middle">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
            <ShoppingCartOutlined style={{ fontSize: 26, color: '#f59e0b' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>Supply Orders</Title>
            <Text type="secondary">Manage customer group templates for bulk sale distributions</Text>
          </div>
        </Space>
        <Space size="middle" className="w-full sm:w-auto">
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
            onClick={() => navigate('/setup/supply-order/new')}
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            className="hover:!bg-amber-600"
          >
            New Supply Order
          </Button>
        </Space>
      </div>

      <div className="mb-6 max-w-md">
        <Input
          placeholder="Search by title or ID..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          className="rounded-lg py-2"
        />
      </div>

      <Table 
        columns={columns} 
        dataSource={filteredData} 
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/setup/supply-order/${record.id}`)
        })}
      />
    </Card>
  );
};
