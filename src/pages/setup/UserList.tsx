import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Space, Typography, Tag, message,
  Input, Tooltip, Avatar, Divider, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, ReloadOutlined,
  UserOutlined, SearchOutlined, MailOutlined, PhoneOutlined,
  CheckCircleOutlined, StopOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { userService, type UserResponse } from '../../services/userService';

const { Title, Text } = Typography;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'Unconfirmed': { label: 'Unconfirmed', color: 'warning' },
  'Blocked': { label: 'Inactive', color: 'error' },
  'Active': { label: 'Active', color: 'success' },
};

export const UserList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [data, setData] = useState<UserResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

  const PAGE_SIZE = 20;

  const fetchData = useCallback(async (page = 1, keyword = '') => {
    try {
      setLoading(true);
      const result = await userService.getUsers({ pageNumber: page, pageSize: PAGE_SIZE, keyword: keyword || undefined });
      setData(result.data || []);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentPage, searchText);
  }, [fetchData, currentPage, searchText]);

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchText(searchInput);
  };

  const handleToggleStatus = async (record: UserResponse) => {
    const isActive = record.status === 'Active';
    try {
      setToggleLoading(record.id);
      await userService.toggleStatus(record.id, !isActive);
      message.success(`User ${isActive ? 'blocked' : 'activated'} successfully`);
      fetchData(currentPage, searchText);
    } catch (error: any) {
      message.error(error.response?.data?.metadata?.message || 'Failed to update user status');
    } finally {
      setToggleLoading(null);
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      sorter: (a: UserResponse, b: UserResponse) =>
        (a.firstName || '').localeCompare(b.firstName || ''),
      render: (_: any, record: UserResponse) => {
        const fullName = [record.firstName, record.lastName].filter(Boolean).join(' ') || record.userName || '—';
        const initials = [record.firstName?.[0], record.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
        return (
          <Space size="middle">
            <Avatar
              src={record.imageUrl || undefined}
              style={{ backgroundColor: '#e6f4ff', color: '#1677ff', border: '1px solid #bae0ff', fontWeight: 600 }}
            >
              {!record.imageUrl && initials}
            </Avatar>
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: '14px' }}>{fullName}</Text>
              {record.userName && (
                <Text type="secondary" style={{ fontSize: '12px' }}>@{record.userName}</Text>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_: any, record: UserResponse) => (
        <Space direction="vertical" size={2}>
          {record.email ? (
            <Space size={4}>
              <MailOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
              <Text style={{ fontSize: '13px' }}>{record.email}</Text>
            </Space>
          ) : (
            <Text type="secondary" style={{ fontSize: '13px', fontStyle: 'italic' }}>No email</Text>
          )}
          {record.phoneNumber && (
            <Space size={4}>
              <PhoneOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>{record.phoneNumber}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '120px',
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Blocked' },
        { text: 'Unconfirmed', value: 'Unconfirmed' },
      ],
      onFilter: (value: any, record: UserResponse) => record.status === value,
      render: (status: string) => {
        const s = STATUS_MAP[status] ?? { label: 'Unknown', color: 'default' };
        return <Tag color={s.color} className="rounded-full px-3">{s.label}</Tag>;
      },
    },
    {
      title: 'Email Verified',
      dataIndex: 'emailConfirmed',
      key: 'emailConfirmed',
      width: '130px',
      render: (confirmed: boolean) =>
        confirmed
          ? <Tag color="success" icon={<CheckCircleOutlined />}>Verified</Tag>
          : <Tag color="warning">Unverified</Tag>,
    },
    {
      title: 'Actions',
      key: 'action',
      width: '120px',
      fixed: 'right' as const,
      render: (_: any, record: UserResponse) => {
        const isActive = record.status === 'Active';
        return (
          <Space size="small">
            <Tooltip title="Edit User">
              <Button
                type="primary"
                ghost
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/setup/users/${record.id}`)}
              />
            </Tooltip>
            <Tooltip title={isActive ? 'Deactivate User' : 'Activate User'}>
              <Popconfirm
                title={isActive ? 'Deactivate this user?' : 'Activate this user?'}
                description={
                  isActive
                    ? 'This user will be deactivated and will no longer be able to sign in.'
                    : 'This user will be activated and will be able to sign in.'
                }
                onConfirm={() => handleToggleStatus(record)}
                okText={isActive ? 'Deactivate' : 'Activate'}
                cancelText="Cancel"
                okButtonProps={{ danger: isActive, loading: toggleLoading === record.id }}
              >
                <Button
                  icon={isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                  size="small"
                  danger={isActive}
                  ghost={isActive}
                  loading={toggleLoading === record.id}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <TeamOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>User Management</Title>
            <Text type="secondary">
              Manage system users — create accounts, edit details, and control access
            </Text>
          </div>
        </Space>
        <Space>
          <Input
            placeholder="Search users..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
            allowClear
            onClear={() => { setSearchInput(''); setSearchText(''); setCurrentPage(1); }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(currentPage, searchText)} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/setup/users/new')}>
            New User
          </Button>
        </Space>
      </div>

      <Divider />

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: currentPage,
          pageSize: PAGE_SIZE,
          total: totalCount,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} users`,
          onChange: (page) => setCurrentPage(page),
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
        scroll={{ x: 900 }}
      />
    </Card>
  );
};
