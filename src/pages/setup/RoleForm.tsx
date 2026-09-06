import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Space, Typography, Form, Input, Row, Col, message, Divider, Switch, Tabs, Badge, Alert } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, LockOutlined, InfoCircleOutlined, SettingOutlined, AppstoreOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { roleService, type PermissionResponse } from '../../services/roleService';

const { Title, Text } = Typography;

const SYSTEM_ROLES = ['Admin', 'Basic', 'Cashier', 'Inventory Manager', 'Accountant', 'Payroll Manager'];

const CATEGORY_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  'Setup': { label: 'Setup', icon: <SettingOutlined /> },
  'Daily Entries': { label: 'Daily Entries', icon: <AppstoreOutlined /> },
  'Analytics & Reports': { label: 'Analytics & Reports', icon: <BarChartOutlined /> }
};

// Module grouping map
const MODULE_CATEGORIES: Record<string, string> = {
  // Setup
  Users: 'Setup',
  Roles: 'Setup',
  ChartOfAccounts: 'Setup',
  DetailAccounts: 'Setup',
  Customers: 'Setup',
  Vendors: 'Setup',
  InventoryItems: 'Setup',
  ItemCategories: 'Setup',
  Units: 'Setup',
  Narrations: 'Setup',
  HRInfo: 'Setup',
  SupplyOrders: 'Setup',
  PrinterSettings: 'Setup',
  Settings: 'Setup',
  OpeningBalances: 'Setup',
  // Daily Entries
  PaymentVouchers: 'Daily Entries',
  ReceiptVouchers: 'Daily Entries',
  JournalVouchers: 'Daily Entries',
  Purchases: 'Daily Entries',
  Sales: 'Daily Entries',
  POSSales: 'Daily Entries',
  SaleSupplies: 'Daily Entries',
  PurchaseReturns: 'Daily Entries',
  SaleReturns: 'Daily Entries',
  StockAdjustments: 'Daily Entries',
  BankReconciliations: 'Daily Entries',
  Payrolls: 'Daily Entries',
  // Reports
  Dashboard: 'Analytics & Reports',
  Reports: 'Analytics & Reports',
};

export const RoleForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleName, setRoleName] = useState<string>('');
  
  const [permissionsList, setPermissionsList] = useState<PermissionResponse[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const isSystemRole = useMemo(() => SYSTEM_ROLES.includes(roleName), [roleName]);
  const isAdminRole = useMemo(() => roleName === 'Admin', [roleName]);

  const fetchRoleData = useCallback(async () => {
    try {
      setLoading(true);
      const allPermissions = await roleService.getAllPermissions();
      setPermissionsList(allPermissions || []);

      if (isEdit) {
        const role = await roleService.getRoleWithPermissions(id!);
        if (role) {
          setRoleName(role.name);
          form.setFieldsValue({
            name: role.name,
            description: role.description || '',
          });
          setSelectedPermissions(role.permissions || []);
        } else {
          message.error('Role not found');
          navigate('/setup/roles');
        }
      }
    } catch (error) {
      message.error('Failed to load role and permissions details');
      navigate('/setup/roles');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, navigate, form]);

  useEffect(() => {
    fetchRoleData();
  }, [fetchRoleData]);

  // Handler for switches
  const handleTogglePermission = (permissionName: string, checked: boolean, resource: string, action: string) => {
    if (isAdminRole) return;

    let updated = [...selectedPermissions];
    
    if (checked) {
      if (!updated.includes(permissionName)) {
        updated.push(permissionName);
      }
      // Dependency Rule 1: Toggle View to true if any sub-action is checked
      if (action !== 'View') {
        const viewPermission = permissionsList.find(p => p.resource === resource && p.action === 'View');
        if (viewPermission && !updated.includes(viewPermission.name)) {
          updated.push(viewPermission.name);
        }
      }
    } else {
      updated = updated.filter(name => name !== permissionName);
      // Dependency Rule 2: Toggle all actions to false if View is unchecked
      if (action === 'View') {
        const otherPermissions = permissionsList.filter(p => p.resource === resource && p.action !== 'View');
        const namesToClear = otherPermissions.map(p => p.name);
        updated = updated.filter(name => !namesToClear.includes(name));
      }
    }
    
    setSelectedPermissions(updated);
  };

  // Toggle all permissions inside a single module card
  const handleToggleModuleAll = (resource: string, checked: boolean) => {
    if (isAdminRole) return;

    const modulePermissions = permissionsList.filter(p => p.resource === resource);
    const names = modulePermissions.map(p => p.name);
    let updated = [...selectedPermissions];

    if (checked) {
      names.forEach(name => {
        if (!updated.includes(name)) {
          updated.push(name);
        }
      });
    } else {
      updated = updated.filter(name => !names.includes(name));
    }

    setSelectedPermissions(updated);
  };

  // Helper selectors
  const isModuleAllSelected = (resource: string) => {
    const pList = permissionsList.filter(p => p.resource === resource);
    if (pList.length === 0) return false;
    return pList.every(p => selectedPermissions.includes(p.name));
  };

  const getModuleSelectedCount = (resource: string) => {
    const pList = permissionsList.filter(p => p.resource === resource);
    return pList.filter(p => selectedPermissions.includes(p.name)).length;
  };

  const getModuleTotalCount = (resource: string) => {
    return permissionsList.filter(p => p.resource === resource).length;
  };

  // Group modules by Category
  const modulesByCategory = useMemo(() => {
    const grouped: Record<string, string[]> = {
      'Setup': [],
      'Daily Entries': [],
      'Analytics & Reports': []
    };

    const uniqueModules = Array.from(new Set(permissionsList.map(p => p.resource)));
    
    uniqueModules.forEach(m => {
      const cat = MODULE_CATEGORIES[m] || 'Setup';
      if (grouped[cat]) {
        grouped[cat].push(m);
      }
    });

    return grouped;
  }, [permissionsList]);

  // Tab Badge count calculator
  const getCategorySelectedCount = (category: string) => {
    const categoryModules = modulesByCategory[category] || [];
    let count = 0;
    categoryModules.forEach(m => {
      count += getModuleSelectedCount(m);
    });
    return count;
  };

  const getCategoryTotalCount = (category: string) => {
    const categoryModules = modulesByCategory[category] || [];
    let count = 0;
    categoryModules.forEach(m => {
      count += getModuleTotalCount(m);
    });
    return count;
  };

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      const roleId = isEdit ? id! : undefined;
      await roleService.createOrUpdate({
        id: roleId,
        name: values.name,
        description: values.description || '',
      });

      let targetId = roleId;
      if (!isEdit) {
        const roles = await roleService.getRoles();
        const newRole = roles.find(r => r.name.toLowerCase() === values.name.toLowerCase());
        if (newRole) {
          targetId = newRole.id;
        }
      }

      if (targetId && !isAdminRole) {
        await roleService.updatePermissions({
          roleId: targetId,
          permissions: selectedPermissions,
        });
      }

      message.success(`Role and permissions ${isEdit ? 'updated' : 'created'} successfully`);
      navigate('/setup/roles');
    } catch (error: any) {
      message.error(error.response?.data?.metadata?.message || `Failed to save role and permissions`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-sm border-gray-100 rounded-xl" loading={loading}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/roles')}>
          Back
        </Button>
        <Space align="center">
          <LockOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit Role: ${roleName}` : 'Create New Role'}
            </Title>
            <Text type="secondary">
              {isEdit ? 'Configure custom access rights by toggling switches per module' : 'Define a new role and establish its initial access levels'}
            </Text>
          </div>
        </Space>
      </div>

      {isAdminRole && (
        <Alert
          message="System Administrator Role"
          description="This is the default Administrator role. Its permissions are fixed to Full Access and cannot be modified."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          className="mb-6 rounded-lg"
        />
      )}

      {isSystemRole && !isAdminRole && (
        <Alert
          message="System Default Role"
          description="This is a system default role. Renaming or deleting this role is restricted, but you can customize its permissions below."
          type="warning"
          showIcon
          className="mb-6 rounded-lg"
        />
      )}

      <Divider />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Role Name"
              name="name"
              rules={[
                { required: true, message: 'Role name is required' },
                { max: 50, message: 'Name cannot exceed 50 characters' },
              ]}
            >
              <Input placeholder="e.g. Cashier Counter 1" disabled={isSystemRole} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Description"
              name="description"
              rules={[{ max: 150, message: 'Description cannot exceed 150 characters' }]}
            >
              <Input placeholder="Describe the access context..." disabled={isSystemRole} />
            </Form.Item>
          </Col>
        </Row>

        <Divider />

        {/* Categories Tab Layout */}
        <div className="mb-6">
          <Title level={5} style={{ marginBottom: 16 }}>Detailed Access Configurator</Title>
          
          <Tabs
            type="card"
            items={Object.keys(CATEGORY_MAP).map(catKey => {
              const cat = CATEGORY_MAP[catKey];
              const selectedCount = getCategorySelectedCount(catKey);
              const totalCount = getCategoryTotalCount(catKey);
              
              return {
                key: catKey,
                label: (
                  <Space>
                    {cat.icon}
                    <span>{cat.label}</span>
                    <Badge 
                      count={`${selectedCount}/${totalCount}`} 
                      style={{ 
                        backgroundColor: selectedCount === totalCount ? '#52c41a' : selectedCount > 0 ? '#1890ff' : '#d9d9d9',
                        color: '#fff',
                        fontSize: '10px'
                      }} 
                    />
                  </Space>
                ),
                children: (
                  <div className="pt-4">
                    <Row gutter={[16, 16]}>
                      {(modulesByCategory[catKey] || []).map(mKey => {
                        const modulePermissions = permissionsList.filter(p => p.resource === mKey);
                        const selectedCount = getModuleSelectedCount(mKey);
                        const totalCount = getModuleTotalCount(mKey);
                        const allSelected = isModuleAllSelected(mKey);
                        
                        // PascalCase to spaced display
                        const moduleDisplayName = mKey.replace(/([A-Z])/g, ' $1').trim();

                        return (
                          <Col xs={24} sm={12} lg={8} key={mKey}>
                            <Card 
                              size="small"
                              className={`shadow-sm border rounded-xl transition-all duration-200 hover:shadow-md ${
                                allSelected 
                                  ? 'border-green-200 bg-green-50/10' 
                                  : selectedCount > 0 
                                    ? 'border-blue-200 bg-blue-50/10' 
                                    : 'border-gray-200'
                              }`}
                              title={
                                <div className="flex justify-between items-center w-full">
                                  <div className="flex flex-col">
                                    <Text strong className="text-[14px]">{moduleDisplayName}</Text>
                                    <Text type="secondary" className="text-[11px] font-normal">
                                      {selectedCount === totalCount ? 'Full Access' : selectedCount > 0 ? `${selectedCount}/${totalCount} Active` : 'No Access'}
                                    </Text>
                                  </div>
                                  <Switch 
                                    size="small"
                                    checked={allSelected}
                                    onChange={checked => handleToggleModuleAll(mKey, checked)}
                                    disabled={isAdminRole}
                                    checkedChildren="All"
                                    unCheckedChildren="None"
                                  />
                                </div>
                              }
                            >
                              <div className="flex flex-col gap-2.5 pt-1">
                                {modulePermissions.map(p => {
                                  const isChecked = selectedPermissions.includes(p.name);
                                  return (
                                    <div key={p.name} className="flex justify-between items-center">
                                      <Text className="text-[13px]">{p.action}</Text>
                                      <Switch 
                                        size="small"
                                        checked={isChecked}
                                        onChange={checked => handleTogglePermission(p.name, checked, mKey, p.action)}
                                        disabled={isAdminRole}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  </div>
                )
              };
            })}
          />
        </div>

        <Divider />

        <Space>
          {!isAdminRole && (
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={submitting}
            >
              Save Role & Permissions
            </Button>
          )}
          <Button onClick={() => navigate('/setup/roles')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
};
