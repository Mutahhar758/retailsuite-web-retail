import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space, theme, Breadcrumb, Tooltip, Badge, message, Modal } from 'antd';
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
  PushpinFilled,
  DisconnectOutlined,
  RocketOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineStore } from '../stores/useOfflineStore';
import { profileService, logoutService } from '../services/profileService';

const { Header, Sider, Content } = Layout;

const permissionMap: Record<string, string> = {
  '/': 'Permissions.Dashboard.View',
  '/setup/chart-of-accounts': 'Permissions.ChartOfAccounts.View',
  '/setup/detail-accounts': 'Permissions.DetailAccounts.View',
  '/setup/customers': 'Permissions.Customers.View',
  '/setup/vendors': 'Permissions.Vendors.View',
  '/setup/item-details': 'Permissions.InventoryItems.View',
  '/setup/item-categories': 'Permissions.ItemCategories.View',
  '/setup/units': 'Permissions.Units.View',
  '/setup/narrations': 'Permissions.Narrations.View',
  '/setup/hr-info': 'Permissions.HRInfo.View',
  '/setup/users': 'Permissions.Users.View',
  '/setup/roles': 'Permissions.Roles.View',
  '/setup/supply-order': 'Permissions.SupplyOrders.View',
  '/setup/printer-settings': 'Permissions.PrinterSettings.View',
  '/setup/opening-balance': 'Permissions.OpeningBalances.View',

  '/daily-entries/payment-voucher': 'Permissions.PaymentVouchers.View',
  '/daily-entries/receipt-voucher': 'Permissions.ReceiptVouchers.View',
  '/daily-entries/journal-voucher': 'Permissions.JournalVouchers.View',
  '/daily-entries/purchase': 'Permissions.Purchases.View',
  '/daily-entries/sale': 'Permissions.Sales.View',
  '/daily-entries/pos-sale': 'Permissions.POSSales.View',
  '/daily-entries/sale-supply': 'Permissions.SaleSupplies.View',
  '/daily-entries/customer-supply': 'Permissions.SaleSupplies.View',
  '/daily-entries/purchase-return': 'Permissions.PurchaseReturns.View',
  '/daily-entries/sale-return': 'Permissions.SaleReturns.View',
   '/daily-entries/stock-adjustment': 'Permissions.StockAdjustments.View',
  '/daily-entries/bank-reconciliation': 'Permissions.BankReconciliations.View',
  '/daily-entries/payroll': 'Permissions.Payrolls.View',
  '/setup/dining-tables': 'Permissions.DiningTables.View',
  '/daily-entries/kitchen-display': 'Permissions.KotOrders.View',

  '/reports': 'Permissions.Reports.View',
  '/reports/account-statement': 'Permissions.Reports.View',
  '/reports/account-statement-with-due': 'Permissions.Reports.View',
  '/reports/account-balance': 'Permissions.Reports.View',
  '/reports/trial-balance': 'Permissions.Reports.View',
  '/reports/stock-balance': 'Permissions.Reports.View',
  '/reports/item-ledger': 'Permissions.Reports.View',
  '/reports/income-summary': 'Permissions.Reports.View',
  '/reports/balance-sheet': 'Permissions.Reports.View',
  '/reports/customer-bill': 'Permissions.Reports.View',
};

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, setUser, permissions, setPermissions } = useAuthStore();
  const { theme: appTheme, setTheme, layout, setLayout, currentTenantIdentifier, licenses } = useAppStore();
  const { token } = theme.useToken();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOfflineStore();

  React.useEffect(() => {
    const fetchProfileAndPermissions = async () => {
      try {
        const [profile, perms] = await Promise.all([
          profileService.getProfile(),
          profileService.getPermissions()
        ]);
        setUser({
          ...user,
          userName: profile.userName,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          imageUrl: profile.imageUrl,
          isOwner: profile.isOwner
        });
        setPermissions(perms || []);
      } catch (error) {
        console.error('Failed to fetch profile and permissions', error);
      }
    };
    fetchProfileAndPermissions();
  }, []);

  React.useEffect(() => {
    if (!isOnline) {
      const allowedPaths = ['/daily-entries/sale', '/daily-entries/pos-sale'];
      const currentPath = location.pathname;
      const isAllowed = allowedPaths.some(path => currentPath.startsWith(path));
      if (!isAllowed) {
        navigate('/daily-entries/sale', { replace: true });
      }
    }
  }, [isOnline, location.pathname, navigate]);

  const breadcrumbItems = location.pathname.split('/').filter(i => i).map((path, index, array) => {
    const url = `/${array.slice(0, index + 1).join('/')}`;
    const labelMap: Record<string, string> = {
      'item-details': 'Product',
      'item-categories': 'Product Category',
      'item-ledger': 'Product Ledger'
    };
    
    let label = labelMap[path] || path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Check if the current segment is an ID parameter following a list route
    const isIdSegment = index > 0 && [
      'users', 'roles', 'hr-info', 'customers', 'vendors', 'supply-order', 'item-details',
      'payment-voucher', 'receipt-voucher', 'journal-voucher', 'purchase', 'sale',
      'pos-sale', 'sale-supply', 'sale-return', 'purchase-return', 'stock-adjustment'
    ].includes(array[index - 1]);
    
    if (isIdSegment && path !== 'new') {
      label = 'Edit';
    }

    return { title: index === array.length - 1 ? label : <a onClick={(e) => { e.preventDefault(); navigate(url); }}>{label}</a> };
  });

  if (location.pathname !== '/') {
    breadcrumbItems.unshift({ title: <a onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a> });
  } else {
    breadcrumbItems.unshift({ title: 'Dashboard' });
  }

  const currentOrgName = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier)?.name || 'Unknown Org';

  const doLogout = async () => {
    await logoutService.logout();
    logout();
    navigate('/login');
  };

  const handleLogout = () => {
    if (pendingCount > 0) {
      Modal.confirm({
        title: 'Pending Sync Vouchers',
        content: (
          <div>
            <p>You have <strong>{pendingCount}</strong> offline sale voucher{pendingCount > 1 ? 's' : ''} that {pendingCount > 1 ? 'have' : 'has'} not been synced to the server yet.</p>
            <p style={{ color: '#d46b08', marginTop: 8 }}>ℹ️ They are saved securely on this device and will automatically sync the next time you log back in to this organization.</p>
          </div>
        ),
        okText: 'Log Out Now',
        cancelText: 'Cancel',
        onOk: doLogout,
      });
    } else {
      doLogout();
    }
  };

  const toggleTheme = () => {
    setTheme(appTheme === 'light' ? 'dark' : 'light');
  };

  const toggleLayout = () => {
    setLayout(layout === 'vertical' ? 'horizontal' : 'vertical');
  };

  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSupplyFeature = currentOrg?.hasSupplyFeature ?? false;
  const hasKotFeature = currentOrg?.hasKotFeature ?? false;

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
        { key: '/setup/users', label: 'Users' },
        { key: '/setup/roles', label: 'Roles & Permissions' },
        hasSupplyFeature ? { key: '/setup/supply-order', label: 'Supply Order' } : null,
        { key: '/setup/printer-settings', label: 'Printer Settings' },
        { key: '/setup/opening-balance', label: 'Opening Balance' },
        hasKotFeature ? { key: '/setup/dining-tables', label: 'Dining Tables' } : null,
      ].filter(Boolean) as any[]
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
        hasSupplyFeature ? { key: '/daily-entries/sale-supply', label: 'Sale Supply' } : null,
        hasSupplyFeature ? { key: '/daily-entries/customer-supply', label: 'Customer Supply Register' } : null,
        { key: '/daily-entries/purchase-return', label: 'Purchase Return' },
        { key: '/daily-entries/sale-return', label: 'Sale Return' },
        { key: '/daily-entries/stock-adjustment', label: 'Stock Adjustment' },
        { key: '/daily-entries/bank-reconciliation', label: 'Bank Reconciliation' },
        { key: '/daily-entries/payroll', label: 'Payroll' },
        hasKotFeature ? { key: '/daily-entries/kitchen-display', label: 'Kitchen Display (KDS)' } : null,
      ].filter(Boolean) as any[]
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

  const filterMenuItemsByPermissions = (items: any[]): any[] => {
    return items
      .map(item => {
        if (!item) return null;
        if (item.children) {
          const filteredChildren = filterMenuItemsByPermissions(item.children);
          if (filteredChildren.length === 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }

        const requiredPermission = permissionMap[item.key];
        if (requiredPermission && !user?.isOwner && (!permissions || !permissions.includes(requiredPermission))) {
          return null;
        }

        return item;
      })
      .filter(Boolean);
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

  const menuItems = transformMenuItems(filterMenuItemsByPermissions(baseMenuItemsWithShortcuts));

  // ── Offline mode: only show Sale and POS Sale ──────────────────────────────
  const offlineMenuItems = [
    {
      key: '/daily-entries/sale',
      icon: <RocketOutlined />,
      label: 'Sale Voucher',
    },
    {
      key: '/daily-entries/pos-sale',
      icon: <ShoppingCartOutlined />,
      label: 'POS Touch Sale',
    },
  ];

  const activeMenuItems = isOnline ? menuItems : filterMenuItemsByPermissions(offlineMenuItems);

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
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo / brand */}
          <div className="h-16 flex items-center justify-center m-4 text-xl font-bold" style={{ color: !isOnline ? '#d46b08' : token.colorPrimary }}>
            {collapsed
              ? (!isOnline ? '✕' : 'R')
              : (!isOnline ? '⚡ Offline' : 'Retail')
            }
          </div>

          {/* Menu */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Menu
              theme={appTheme}
              mode="inline"
              selectedKeys={[location.pathname]}
              items={activeMenuItems}
              onClick={({ key }) => navigate(key)}
            />
          </div>

          {/* Offline mode strip at bottom of sider */}
          {!isOnline && (
            <div style={{
              padding: collapsed ? '12px 8px' : '10px 16px',
              backgroundColor: '#fff7e6',
              borderTop: '1px solid #ffd591',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#d46b08',
              flexShrink: 0,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
              <DisconnectOutlined style={{ fontSize: 14 }} />
              {!collapsed && (
                <span>
                  OFFLINE MODE<br />
                  {pendingCount > 0 && (
                    <span style={{ fontWeight: 400, fontSize: 10 }}>
                      {pendingCount} voucher{pendingCount > 1 ? 's' : ''} pending sync
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
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
                <div className="text-xl font-bold mr-8" style={{ color: !isOnline ? '#d46b08' : token.colorPrimary }}>
                  {!isOnline ? '⚡ Offline Mode' : 'RetailSuite Portal'}
                </div>
                <Menu
                  theme={appTheme}
                  mode="horizontal"
                  selectedKeys={[location.pathname]}
                  items={activeMenuItems}
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
