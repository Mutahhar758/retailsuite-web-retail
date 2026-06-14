import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Tooltip, Avatar, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ReloadOutlined, 
  UserOutlined, SearchOutlined, PhoneOutlined, MailOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerService, type CustomerResponse } from '../../services/customerService';

const { Title, Text } = Typography;

export const CustomerList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerResponse[]>([]);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomers();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/customers/new');
  };

  const handleEdit = (record: CustomerResponse) => {
    navigate(`/setup/customers/${record.account}`);
  };

  const filteredData = data.filter(customer => 
    customer.title.toLowerCase().includes(searchText.toLowerCase()) ||
    customer.account.toLowerCase().includes(searchText.toLowerCase()) ||
    (customer.phone1 && customer.phone1.toLowerCase().includes(searchText.toLowerCase())) ||
    (customer.email && customer.email.toLowerCase().includes(searchText.toLowerCase())) ||
    (customer.cnic && customer.cnic.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'Customer Name',
      key: 'title',
      sorter: (a: CustomerResponse, b: CustomerResponse) => a.title.localeCompare(b.title),
      render: (_: any, record: CustomerResponse) => (
        <Space size="middle">
          <Avatar 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#e6f4ff', color: '#1677ff', border: '1px solid #bae0ff' }} 
          />
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: '15px' }}>{record.title}</Text>
            {record.cnic && <Text type="secondary" style={{ fontSize: '12px' }}>CNIC: {record.cnic}</Text>}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Account Code',
      dataIndex: 'account',
      key: 'account',
      width: '150px',
      render: (text: string) => (
        <Text strong style={{ fontFamily: 'monospace', color: '#1677ff' }}>
          {text}
        </Text>
      ),
      sorter: (a: CustomerResponse, b: CustomerResponse) => a.account.localeCompare(b.account),
    },
    {
      title: 'Contact Information',
      key: 'contact',
      render: (_: any, record: CustomerResponse) => (
        <Space direction="vertical" size={0}>
          {record.phone1 ? (
            <Space size={4}>
              <PhoneOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
              <Text style={{ fontSize: '13px' }}>{record.phone1}</Text>
            </Space>
          ) : record.phone2 ? (
            <Space size={4}>
              <PhoneOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
              <Text style={{ fontSize: '13px' }}>{record.phone2}</Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>No phone</Text>
          )}
          {record.email && (
            <Space size={4}>
              <MailOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>{record.email}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (text?: string) => text ? <Text style={{ fontSize: '13px' }}>{text}</Text> : <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>-</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: '100px',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'error'} className="rounded-full px-3">
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: '100px',
      fixed: 'right' as const,
      render: (_: any, record: CustomerResponse) => (
        <Tooltip title="Edit Customer Details">
          <Button 
            type="primary" 
            ghost
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Customer Directory</Title>
            <Text type="secondary">Manage customer detailed information, contact info, and preferences</Text>
          </div>
        </Space>
        <Space>
          <Input
            placeholder="Search customers..."
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
            New Customer
          </Button>
        </Space>
      </div>

      <Divider />

      <Table 
        columns={columns} 
        dataSource={filteredData} 
        loading={loading}
        rowKey="account"
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} customers`
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 900 }}
      />
    </Card>
  );
};
