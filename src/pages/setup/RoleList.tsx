import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Space, Typography, Tag, message, Popconfirm, Tooltip, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { roleService, type RoleResponse } from '../../services/roleService';

const { Title, Text } = Typography;

const SYSTEM_ROLES = ['Admin', 'Basic', 'Cashier', 'Inventory Manager', 'Accountant', 'Payroll Manager'];

export const RoleList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RoleResponse[]>([]);
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const roles = await roleService.getRoles();
      setData(roles || []);
    } catch (error) {
      message.error('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await roleService.delete(id);
      message.success('Role deleted successfully');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.metadata?.message || 'Failed to delete role');
    }
  };

  const filteredData = data.filter(role => 
    role.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: RoleResponse, b: RoleResponse) => a.name.localeCompare(b.name),
      render: (name: string) => {
        const isSystem = SYSTEM_ROLES.includes(name);
        return (
          <Space>
            <Text strong style={{ fontSize: '14px' }}>{name}</Text>
            {isSystem && (
              <Tag color="blue" className="rounded-full px-2 text-[11px]">System Default</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || <Text type="secondary" italic>No description provided</Text>,
    },
    {
      title: 'Actions',
      key: 'action',
      width: '120px',
      render: (_: any, record: RoleResponse) => {
        const isSystem = SYSTEM_ROLES.includes(record.name);
        return (
          <Space size="small">
            <Tooltip title={isSystem ? "View Permissions (Read-Only)" : "Edit Role & Permissions"}>
              <Button
                type="primary"
                ghost
                icon={<EditOutlined />}
                size="small"
                onClick={() => navigate(`/setup/roles/${record.id}`)}
              />
            </Tooltip>
            {!isSystem && (
              <Tooltip title="Delete Role">
                <Popconfirm
                  title="Delete this role?"
                  description="Are you sure you want to delete this role? This action cannot be undone."
                  onConfirm={() => handleDelete(record.id)}
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    icon={<DeleteOutlined />}
                    size="small"
                    danger
                    ghost
                  />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl">
      <div className="flex justify-between items-center mb-6">
        <Space align="center">
          <LockOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Roles & Permissions</Title>
            <Text type="secondary">
              Manage system roles and configure fine-grained permissions for each module and action
            </Text>
          </div>
        </Space>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => fetchData()}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/setup/roles/new')}
          >
            Create Role
          </Button>
        </Space>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by role name or description..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ maxWidth: 350 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} roles`,
        }}
        className="border border-gray-100 rounded-lg overflow-hidden"
      />
    </Card>
  );
};
