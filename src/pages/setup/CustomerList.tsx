import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Tooltip, Avatar, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ReloadOutlined, 
  UserOutlined, PhoneOutlined, MailOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { customerService, type CustomerResponse } from '../../services/customerService';
import { BulkOperationModal } from '../../components/bulk/BulkOperationModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

export const CustomerList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CustomerResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
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
      const result = await customerService.getPagedCustomers({
        pageNumber: query.page,
        pageSize: query.size,
        search: query.search || undefined,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      message.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [query.page, query.size, query.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/customers/new');
  };

  const handleEdit = (record: CustomerResponse) => {
    navigate(`/setup/customers/${record.account}`);
  };

  const columns = [
    {
      title: 'Customer Name',
      key: 'title',
      sorter: (a: CustomerResponse, b: CustomerResponse) => a.title.localeCompare(b.title),
      render: (_: any, record: CustomerResponse) => (
        <Space size="middle">
          <Avatar 
            src={record.mediaUrl || undefined}
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
      title: 'Account Type',
      key: 'accountType',
      width: '160px',
      render: (_: any, record: CustomerResponse) => record.parentCustomerAccountId ? (
        <Tooltip title={`Main Account: ${record.parentCustomerTitle || record.parentCustomerAccountId}`}>
          <Tag color="cyan">Sub-Account</Tag>
          <div style={{ fontSize: '11px', color: '#64748b' }}>{record.parentCustomerTitle || record.parentCustomerAccountId}</div>
        </Tooltip>
      ) : (
        <Tag color="default">Main Account</Tag>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'customerCategoryTitle',
      key: 'customerCategoryTitle',
      width: '130px',
      render: (cat?: string) => cat ? (
        <Tag color="blue">{cat}</Tag>
      ) : (
        <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>-</Text>
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
          <Input.Search
            placeholder="Search customers..."
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
          <Button 
            icon={<FileExcelOutlined style={{ color: '#52c41a' }} />} 
            onClick={() => setBulkModalVisible(true)}
          >
            Bulk Operations
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
        dataSource={data} 
        loading={loading}
        rowKey="account"
        pagination={{ 
          current: query.page,
          pageSize: query.size,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total ${total} customers`,
          onChange: (page, size) => updateQuery({ page, size }),
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 900 }}
      />

      <BulkOperationModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onSuccess={fetchData}
        entityType="customers"
      />
    </Card>
  );
};
