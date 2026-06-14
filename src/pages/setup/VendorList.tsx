import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Tooltip, Avatar, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ReloadOutlined, 
  SearchOutlined, PhoneOutlined, MailOutlined, ShopOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { vendorService, type VendorResponse } from '../../services/vendorService';

const { Title, Text } = Typography;

export const VendorList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VendorResponse[]>([]);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await vendorService.getVendors();
      setData(result);
    } catch (error) {
      message.error('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/vendors/new');
  };

  const handleEdit = (record: VendorResponse) => {
    navigate(`/setup/vendors/${record.account}`);
  };

  const filteredData = data.filter(vendor => 
    vendor.title.toLowerCase().includes(searchText.toLowerCase()) ||
    vendor.account.toLowerCase().includes(searchText.toLowerCase()) ||
    (vendor.phone1 && vendor.phone1.toLowerCase().includes(searchText.toLowerCase())) ||
    (vendor.email && vendor.email.toLowerCase().includes(searchText.toLowerCase())) ||
    (vendor.cnic && vendor.cnic.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'Vendor Name',
      key: 'title',
      sorter: (a: VendorResponse, b: VendorResponse) => a.title.localeCompare(b.title),
      render: (_: any, record: VendorResponse) => (
        <Space size="middle">
          <Avatar 
            icon={<ShopOutlined />} 
            style={{ backgroundColor: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591' }} 
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
        <Text strong style={{ fontFamily: 'monospace', color: '#d46b08' }}>
          {text}
        </Text>
      ),
      sorter: (a: VendorResponse, b: VendorResponse) => a.account.localeCompare(b.account),
    },
    {
      title: 'Contact Information',
      key: 'contact',
      render: (_: any, record: VendorResponse) => (
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
      title: 'Sales Visibility',
      dataIndex: 'showInSales',
      key: 'showInSales',
      width: '130px',
      render: (showInSales: boolean) => (
        <Tag color={showInSales ? 'processing' : 'default'} className="rounded-full px-3">
          {showInSales ? 'Yes' : 'No'}
        </Tag>
      ),
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
      render: (_: any, record: VendorResponse) => (
        <Tooltip title="Edit Vendor Details">
          <Button 
            type="primary" 
            ghost
            icon={<EditOutlined />} 
            size="small"
            style={{ color: '#d46b08', borderColor: '#ffd591' }}
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
          <ShopOutlined style={{ fontSize: 24, color: '#d46b08' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Vendor Directory</Title>
            <Text type="secondary">Manage vendor detailed information, contact info, and visibility settings</Text>
          </div>
        </Space>
        <Space>
          <Input
            placeholder="Search vendors..."
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
            style={{ backgroundColor: '#d46b08', borderColor: '#d46b08' }}
          >
            New Vendor
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
          showTotal: (total) => `Total ${total} vendors`
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 950 }}
      />
    </Card>
  );
};
