import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space, theme, Breadcrumb, Tooltip, Badge, message } from 'antd';
import { 
  MenuFoldOutlined, 
  MenuUnfoldOutlined, 
  DashboardOutlined, 
  AppstoreOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  LayoutOutlined,
  BellOutlined,
  PushpinOutlined,
  PushpinFilled
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { profileService, logoutService } from '../services/profileService';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, setUser } = useAuthStore();
  const { theme: appTheme, setTheme, layout, setLayout, currentTenantIdentifier, licenses } = useAppStore();
  const { token } = theme.useToken();

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await profileService.getProfile();
        setUser({
          ...user,
          userName: profile.userName,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          imageUrl: profile.imageUrl
        });
      } catch (error) {
        console.error('Failed to fetch profile', error);
      }
    };
    fetchProfile();
  }, []);

  const breadcrumbItems = location.pathname.split('/').filter(i => i).map((path, index, array) => {
    const url = `/${array.slice(0, index + 1).join('/')}`;
    const labelMap: Record<string, string> = {
      'item-details': 'Product',
      'item-categories': 'Product Category',
      'item-ledger': 'Product Ledger'
    };
    const label = labelMap[path] || path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return { title: index === array.length - 1 ? label : <a onClick={(e) => { e.preventDefault(); navigate(url); }}>{label}</a> };
  });

  if (location.pathname !== '/') {
    breadcrumbItems.unshift({ title: <a onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a> });
  } else {
    breadcrumbItems.unshift({ title: 'Dashboard' });
  }

  const currentOrgName = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier)?.name || 'Unknown Org';

  const handleLogout = async () => {
    await logoutService.logout();
    logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(appTheme === 'light' ? 'dark' : 'light');
  };

  const toggleLayout = () => {
    setLayout(layout === 'vertical' ? 'horizontal' : 'vertical');
  };

  const baseMenuItems = [
    { 
      key: '/setup', 
      icon: <SettingOutlined />, 
      label: 'Setup',
      children: [
        { key: '/setup/chart-of-accounts', label: 'Chart of Accounts' },
        { key: '/setup/detail-accounts', label: 'Detail Accounts' },
        { key: '/setup/customers', label: 'Customer' },
        { key: '/setup/vendors', label: 'Vendor' },
        { key: '/setup/item-details', label: 'Product' },
        { key: '/setup/item-categories', label: 'Product Category' },
        { key: '/setup/units', label: 'Unit Index' },
        { key: '/setup/narrations', label: 'Narration' },
        { key: '/setup/hr-info', label: 'HR Info' },
        { key: '/setup/supply-order', label: 'Supply Order' },
        { key: '/setup/printer-settings', label: 'Printer Settings' },
        { key: '/setup/opening-balance', label: 'Opening Balance' },
      ]
    },
    { 
      key: '/daily-entries', 
      icon: <AppstoreOutlined />, 
      label: 'Daily Entries',
      children: [
        { key: '/daily-entries/payment-voucher', label: 'Payment Voucher' },
        { key: '/daily-entries/receipt-voucher', label: 'Receipt Voucher' },
        { key: '/daily-entries/journal-voucher', label: 'Journal Voucher' },
        { key: '/daily-entries/purchase', label: 'Purchase' },
        { key: '/daily-entries/sale', label: 'Sale' },
        { key: '/daily-entries/pos-sale', label: 'POS Touch Sale' },
        { key: '/daily-entries/sale-supply', label: 'Sale Supply' },
        { key: '/daily-entries/purchase-return', label: 'Purchase Return' },
        { key: '/daily-entries/sale-return', label: 'Sale Return' },
        { key: '/daily-entries/stock-adjustment', label: 'Stock Adjustment' },
        { key: '/daily-entries/bank-reconciliation', label: 'Bank Reconciliation' },
        { key: '/daily-entries/payroll', label: 'Payroll' },
      ]
    },
    { 
      key: '/reports', 
      icon: <BarChartOutlined />, 
      label: 'Reports',
      children: [
        { key: '/reports/account-statement', label: 'Account Statement' },
        { key: '/reports/account-statement-with-due', label: 'Account Statement with Due' },
        { key: '/reports/account-balance', label: 'Account Balance' },
        { key: '/reports/trial-balance', label: 'Trial Balance' },
        { key: '/reports/stock-balance', label: 'Stock Balance' },
        { key: '/reports/item-ledger', label: 'Product Ledger' },
        { key: '/reports/income-summary', label: 'Income Summary' },
        { key: '/reports/balance-sheet', label: 'Balance Sheet' },
        { key: '/reports/customer-bill', label: 'Customer Bill' },
      ]
    },
  ];

  interface ShortcutItem {
    key: string;
    label: string;
  }

  const [pinnedShortcuts, setPinnedShortcuts] = useState<ShortcutItem[]>(() => {
    const saved = localStorage.getItem('pinnedShortcuts');
    const initialList: ShortcutItem[] = saved ? JSON.parse(saved) : [];
    return initialList.filter(s => s.key !== '/' && s.key !== '' && s.label !== 'Dashboard');
  });

  const togglePinByKey = (key: string, labelText: string) => {
    if (key === '/' || key === '' || labelText === 'Dashboard') return;
    const isPinned = pinnedShortcuts.some(s => s.key === key);
    let updated: ShortcutItem[];
    if (isPinned) {
      updated = pinnedShortcuts.filter(s => s.key !== key);
      message.success('Removed from Shortcuts');
    } else {
      updated = [...pinnedShortcuts, { key, label: labelText }];
      message.success('Added to Shortcuts');
    }
    setPinnedShortcuts(updated);
    localStorage.setItem('pinnedShortcuts', JSON.stringify(updated));
  };

  const transformMenuItems = (items: any[], isShortcutGroup = false): any[] => {
    return items.map(item => {
      if (item.children) {
        return {
          ...item,
          children: transformMenuItems(item.children, item.key === '/shortcuts-group' || isShortcutGroup)
        };
      }

      if (item.key === '/' || item.key.startsWith('/shortcuts') || isShortcutGroup || item.label === 'Dashboard') {
        return item;
      }

      const isItemPinned = pinnedShortcuts.some(s => s.key === item.key);

      return {
        ...item,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{item.label}</span>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePinByKey(item.key, item.label as string);
              }}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                padding: '4px',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              {isItemPinned ? (
                <PushpinFilled style={{ color: token.colorPrimary, fontSize: '13px' }} />
              ) : (
                <PushpinOutlined style={{ color: 'rgba(0, 0, 0, 0.25)', fontSize: '13px' }} />
              )}
            </span>
          </div>
        )
      };
    });
  };

  const baseMenuItemsWithShortcuts = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    ...(pinnedShortcuts.filter(s => s.key !== '/' && s.label !== 'Dashboard').length > 0 ? [{
      key: '/shortcuts-group',
      icon: <PushpinOutlined style={{ color: token.colorPrimary }} />,
      label: 'Shortcuts',
      children: pinnedShortcuts.filter(s => s.key !== '/' && s.label !== 'Dashboard').map(s => ({
        key: s.key,
        label: s.label
      }))
    }] : []),
    ...baseMenuItems
  ];

  const menuItems = transformMenuItems(baseMenuItemsWithShortcuts);

  const userMenu = {
    items: [
      { key: 'org', label: <div className="text-gray-500 text-xs px-2 py-1">{currentOrgName}</div>, disabled: true },
      { type: 'divider' as const },
      { key: 'profile', icon: <UserOutlined />, label: 'My Profile', onClick: () => navigate('/profile') },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout, danger: true },
    ],
  };

  const isHorizontal = layout === 'horizontal';

  return (
    <Layout className="min-h-screen">
      {!isHorizontal && (
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed}
          width={280}
          theme={appTheme}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            borderRight: appTheme === 'light' ? `1px solid ${token.colorBorderSecondary}` : 'none',
            zIndex: 100
          }}
        >
          <div className="h-16 flex items-center justify-center m-4 text-xl font-bold" style={{ color: token.colorPrimary }}>
            {collapsed ? 'R' : 'Retail'}
          </div>
          <Menu
            theme={appTheme}
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
      )}
      
      <Layout style={{ marginLeft: !isHorizontal ? (collapsed ? 80 : 280) : 0, transition: 'all 0.2s' }}>
        <Header 
          style={{ 
            padding: '0 24px', 
            background: token.colorBgContainer, 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}
        >
          <div className="flex items-center flex-1">
            {!isHorizontal && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '16px', width: 64, height: 64, marginLeft: -24 }}
              />
            )}
            
            {isHorizontal && (
              <>
                <div className="text-xl font-bold mr-8" style={{ color: token.colorPrimary }}>RetailSuite Portal</div>
                <Menu
                  theme={appTheme}
                  mode="horizontal"
                  selectedKeys={[location.pathname]}
                  items={menuItems}
                  onClick={({ key }) => navigate(key)}
                  style={{ flex: 1, borderBottom: 'none', lineHeight: '62px' }}
                />
              </>
            )}
          </div>

          <Space align="center" size="middle">
            <Tooltip title={`Switch to ${appTheme === 'light' ? 'Dark' : 'Light'} Mode`}>
              <Button 
                type="text" 
                icon={appTheme === 'light' ? <MoonOutlined /> : <SunOutlined />} 
                onClick={toggleTheme}
                style={{ fontSize: '18px' }}
              />
            </Tooltip>
            
            <Tooltip title={`Switch to ${layout === 'vertical' ? 'Top' : 'Side'} Menu`}>
              <Button 
                type="text" 
                icon={<LayoutOutlined />} 
                onClick={toggleLayout}
                style={{ fontSize: '18px' }}
              />
            </Tooltip>

            <Tooltip title="Notifications">
              <Badge count={3} dot size="small">
                <Button type="text" icon={<BellOutlined />} style={{ fontSize: '18px' }} />
              </Badge>
            </Tooltip>

            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <div className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1 rounded-full transition-colors border border-gray-100 dark:border-gray-800">
                <Avatar 
                  src={user?.imageUrl} 
                  icon={!user?.imageUrl && <UserOutlined />} 
                  className="bg-blue-500" 
                />
                <span className="ml-2 hidden sm:block font-medium">{user?.userName || 'User'}</span>
              </div>
            </Dropdown>
          </Space>
        </Header>
        
        <div style={{ padding: '16px 24px 0' }}>
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <Content 
          style={{ 
            margin: '16px', 
            padding: 24, 
            minHeight: 280, 
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
