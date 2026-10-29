import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Typography, Tag, message, 
  Input, Tooltip, Avatar, Divider
} from 'antd';
import { 
  PlusOutlined, EditOutlined, ReloadOutlined, 
  PhoneOutlined, MailOutlined, ShopOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { vendorService, type VendorResponse } from '../../services/vendorService';
import { BulkOperationModal } from '../../components/bulk/BulkOperationModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

export const VendorList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VendorResponse[]>([]);
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
      const result = await vendorService.getPagedVendors({
        pageNumber: query.page,
        pageSize: query.size,
        search: query.search || undefined,
      });
      setData(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      message.error('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  }, [query.page, query.size, query.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    navigate('/setup/vendors/new');
  };

  const handleEdit = (record: VendorResponse) => {
    navigate(`/setup/vendors/${record.account}`);
  };

  const columns = [
    {
      title: 'Vendor Name',
      key: 'title',
      sorter: (a: VendorResponse, b: VendorResponse) => a.title.localeCompare(b.title),
      render: (_: any, record: VendorResponse) => (
        <Space size="middle">
          <Avatar 
            src={record.mediaUrl || undefined}
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
          <Input.Search
            placeholder="Search vendors..."
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
            style={{ backgroundColor: '#d46b08', borderColor: '#d46b08' }}
          >
            New Vendor
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
          showTotal: (total) => `Total ${total} vendors`,
          onChange: (page, size) => updateQuery({ page, size }),
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 950 }}
      />

      <BulkOperationModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onSuccess={fetchData}
        entityType="vendors"
      />
    </Card>
  );
};
