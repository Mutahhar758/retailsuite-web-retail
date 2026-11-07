import React, { useState, useEffect, useMemo } from 'react';
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
  MobileOutlined,
  SearchOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  ShoppingOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppStore } from '../stores/useAppStore';
import { useSettingsStore, RESTAURANT_ENABLE_KOT_KEY, RESTAURANT_ENABLE_DINE_IN_KEY, RESTAURANT_ENABLE_KDS_KEY, SUPPLY_ENABLE_KEY, MOBILE_SHOP_ENABLE_KEY, MANUFACTURING_ENABLE_KEY } from '../stores/useSettingsStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineStore } from '../stores/useOfflineStore';
import { profileService, logoutService } from '../services/profileService';
import api from '../services/api';
import { CURRENT_APP_VERSION } from '../utils/autoVersionRefresh';
import { GeminiAssistantWidget } from '../components/ai/GeminiAssistantWidget';
import { NavigationCommandModal, type SearchableNavItem } from '../components/common/NavigationCommandModal';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, setUser, setPermissions } = useAuthStore();
  const { theme: appTheme, setTheme, layout, setLayout, currentTenantIdentifier, licenses, updateLicenseFeatures } = useAppStore();
  const { token } = theme.useToken();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOfflineStore();

  // Global Ctrl+K / Cmd+K listener for quick search modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  React.useEffect(() => {
    if (!currentTenantIdentifier || !isOnline) return;
    const syncFeatures = async () => {
      try {
        const response = await api.get('/api/license/features');
        const body = response.data?.body || response.data;
        if (body) {
          updateLicenseFeatures(currentTenantIdentifier, {
            ...(body.name ? { name: body.name } : {}),
            hasSupplyFeature: body.hasSupplyFeature,
            hasSecondaryQty: body.hasSecondaryQty,
            hasKotFeature: body.hasKotFeature,
            hasVariablePackFeature: body.hasVariablePackFeature,
            hasMobileShopFeature: body.hasMobileShopFeature
          });
        }
      } catch (err) {
        console.error('Failed to sync tenant features', err);
      }
    };
    syncFeatures();
  }, [currentTenantIdentifier, isOnline]);

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
      'item-ledger': 'Product Ledger',
      'bank-accounts': 'Cash & Bank Accounts',
      'bom': 'Bill of Materials',
      'manufacturing': 'Manufacturing Voucher',
      'company-info': 'Company Info',
    };
    
    let label = labelMap[path] || path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    const isIdSegment = index > 0 && [
      'users', 'roles', 'hr-info', 'customers', 'vendors', 'supply-order', 'item-details',
      'payment-voucher', 'receipt-voucher', 'journal-voucher', 'purchase', 'sale',
      'pos-sale', 'sale-supply', 'sale-return', 'purchase-return', 'stock-adjustment',
      'repair-jobs', 'bom', 'manufacturing'
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
  const settingSupply = useSettingsStore(state => state.getSetting(SUPPLY_ENABLE_KEY, ''));
  const hasSupplyFeature = settingSupply !== '' ? settingSupply === 'true' : (currentOrg?.hasSupplyFeature ?? false);
  const settingKot = useSettingsStore(state => state.getSetting(RESTAURANT_ENABLE_KOT_KEY, ''));
  const hasKotFeature = settingKot !== '' ? settingKot === 'true' : (currentOrg?.hasKotFeature ?? false);
  const settingDineIn = useSettingsStore(state => state.getSetting(RESTAURANT_ENABLE_DINE_IN_KEY, ''));
  const hasDineInFeature = settingDineIn !== '' ? settingDineIn === 'true' : false;
  const settingKds = useSettingsStore(state => state.getSetting(RESTAURANT_ENABLE_KDS_KEY, ''));
  const hasKdsFeature = hasKotFeature && (settingKds !== '' ? settingKds === 'true' : false);
  const settingMobile = useSettingsStore(state => state.getSetting(MOBILE_SHOP_ENABLE_KEY, ''));
  const hasMobileShopFeature = settingMobile !== '' ? settingMobile === 'true' : (currentOrg?.hasMobileShopFeature ?? false);
  const settingManufacturing = useSettingsStore(state => state.getSetting(MANUFACTURING_ENABLE_KEY, ''));
  const hasManufacturingFeature = settingManufacturing !== '' ? settingManufacturing === 'true' : true;

  const baseMenuItems = useMemo(() => [
    { 
      key: '/setup', 
      icon: <SettingOutlined />, 
      label: 'Setup',
      children: [
        { key: '/setup/chart-of-accounts', label: 'Chart of Accounts' },
        { key: '/setup/detail-accounts', label: 'Detail Accounts' },
        { key: '/setup/fixed-assets', label: 'Fixed Assets' },
        { key: '/setup/bank-accounts', label: 'Cash & Bank Accounts' },
        { key: '/setup/customers', label: 'Customer' },
        { key: '/setup/customer-categories', label: 'Customer Category' },
        { key: '/setup/vendors', label: 'Vendor' },
        { key: '/setup/brands', label: 'Brands' },
        { key: '/setup/item-details', label: 'Product' },
        hasManufacturingFeature ? { key: '/setup/bom', label: 'Bill of Materials / Recipe' } : null,
        { key: '/setup/item-categories', label: 'Product Category' },
        { key: '/setup/units', label: 'Unit Index' },
        { key: '/setup/narrations', label: 'Narration' },
        { key: '/setup/hr-info', label: 'Employees' },
        { key: '/setup/users', label: 'Users' },
        { key: '/setup/roles', label: 'Roles & Permissions' },
        hasSupplyFeature ? { key: '/setup/supply-order', label: 'Supply Order' } : null,
        { key: '/setup/company-info', label: 'Company Info' },
        { key: '/setup/settings', label: 'Settings' },
        { key: '/setup/printer-settings', label: 'Printer Settings' },
        { key: '/setup/opening-balance', label: 'Opening Balance' },
        hasDineInFeature ? { key: '/setup/dining-tables', label: 'Dining Tables' } : null,
      ].filter(Boolean) as any[]
    },
    { 
      key: '/daily-entries', 
      icon: <AppstoreOutlined />, 
      label: 'Daily Entries',
      children: [
        { key: '/daily-entries/expenses', label: 'Expenses' },
        { key: '/daily-entries/payment-voucher', label: 'Payment Voucher' },
        { key: '/daily-entries/receipt-voucher', label: 'Receipt Voucher' },
        { key: '/daily-entries/journal-voucher', label: 'Journal Voucher' },
        { key: '/daily-entries/purchase', label: 'Purchase' },
        { key: '/daily-entries/sale', label: 'Sale' },
        { key: '/daily-entries/pos-sale', label: 'POS Touch Sale' },
        hasManufacturingFeature ? { key: '/daily-entries/manufacturing', label: 'Manufacturing Voucher' } : null,
        hasSupplyFeature ? { key: '/daily-entries/sale-supply', label: 'Sale Supply' } : null,
        hasSupplyFeature ? { key: '/daily-entries/customer-supply', label: 'Customer Supply Register' } : null,
        { key: '/daily-entries/purchase-return', label: 'Purchase Return' },
        { key: '/daily-entries/sale-return', label: 'Sale Return' },
        { key: '/daily-entries/stock-adjustment', label: 'Stock Adjustment' },
        { key: '/daily-entries/daily-stock-closing', label: 'Daily Stock Closing' },
        { key: '/daily-entries/bank-reconciliation', label: 'Bank Reconciliation' },
        { key: '/daily-entries/payroll', label: 'Payroll' },
        { key: '/daily-entries/recurring-vouchers', label: 'Recurring Vouchers' },
        hasKdsFeature ? { key: '/daily-entries/kitchen-display', label: 'Kitchen Display (KDS)' } : null,
      ].filter(Boolean) as any[]
    },
    hasMobileShopFeature ? {
      key: '/devices-repairs',
      icon: <MobileOutlined />,
      label: 'Devices & Repairs',
      children: [
        { key: '/devices-repairs/repair-jobs', label: 'Repair Job Cards' },
        { key: '/devices-repairs/imei-stock', label: 'IMEI Stock Ledger' },
        { key: '/devices-repairs/imei-history', label: 'Device Lifecycle History' },
      ]
    } : null,
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
        hasManufacturingFeature ? { key: '/reports/manufacturing', label: 'Manufacturing Report' } : null,
        { key: '/reports/purchase-supply-comparison', label: 'Purchase vs Supply Comparison' },
        { key: '/reports/customer-balance-recovery', label: 'Customer Balance & Recovery' },
        { key: '/reports/profit-by-customer', label: 'Profit by Customer' },
        { key: '/reports/profit-by-item', label: 'Profit by Item' },
        { key: '/reports/barcode-print', label: 'Barcode Print' },
      ].filter(Boolean) as any[]
    },
  ].filter(Boolean) as any[], [hasManufacturingFeature, hasSupplyFeature, hasDineInFeature, hasKdsFeature, hasMobileShopFeature]);

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

  const baseMenuItemsWithShortcuts = useMemo(() => [
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
  ], [pinnedShortcuts, baseMenuItems, token.colorPrimary]);

  const menuItems = useMemo(
    () => transformMenuItems(baseMenuItemsWithShortcuts),
    [baseMenuItemsWithShortcuts, pinnedShortcuts, token.colorPrimary]
  );

  // Flat list of items for the Search modal (only evaluated when baseMenuItems changes)
  const searchableNavItems = useMemo<SearchableNavItem[]>(() => {
    const result: SearchableNavItem[] = [
      {
        key: '/',
        label: 'Dashboard',
        moduleLabel: 'Dashboard',
        icon: <DashboardOutlined />,
        keywords: ['home', 'overview'],
      },
    ];
    for (const mod of baseMenuItems) {
      if (mod?.children) {
        for (const child of mod.children) {
          if (child?.key && child?.label) {
            result.push({
              key: child.key,
              label: child.label,
              moduleLabel: mod.label,
              icon: mod.icon,
            });
          }
        }
      }
    }
    return result;
  }, [baseMenuItems]);

  // Quick Entry (+ New) actions for Header icon dropdown and Search modal
  const quickEntryActions = useMemo<SearchableNavItem[]>(() => {
    const allActions: Array<SearchableNavItem & { onlineOnly?: boolean }> = [
      {
        key: '/daily-entries/pos-sale',
        label: 'POS Touch Sale',
        moduleLabel: 'Quick Entry',
        icon: <ThunderboltOutlined />,
        keywords: ['new', 'pos', 'touch', 'sale'],
        isQuickAction: true,
      },
      {
        key: '/daily-entries/sale/new',
        label: 'New Sale Invoice',
        moduleLabel: 'Quick Entry',
        icon: <ShoppingCartOutlined />,
        keywords: ['new', 'sale', 'invoice'],
        isQuickAction: true,
      },
      {
        key: '/daily-entries/purchase/new',
        label: 'New Purchase Bill',
        moduleLabel: 'Quick Entry',
        icon: <ShoppingOutlined />,
        keywords: ['new', 'purchase', 'bill'],
        isQuickAction: true,
        onlineOnly: true,
      },
      {
        key: '/daily-entries/receipt-voucher/new',
        label: 'New Receipt Voucher',
        moduleLabel: 'Quick Entry',
        icon: <ArrowDownOutlined />,
        keywords: ['new', 'receipt', 'voucher'],
        isQuickAction: true,
        onlineOnly: true,
      },
      {
        key: '/daily-entries/payment-voucher/new',
        label: 'New Payment Voucher',
        moduleLabel: 'Quick Entry',
        icon: <ArrowUpOutlined />,
        keywords: ['new', 'payment', 'voucher'],
        isQuickAction: true,
        onlineOnly: true,
      },
      {
        key: '/daily-entries/expenses',
        label: 'Expenses',
        moduleLabel: 'Quick Entry',
        icon: <WalletOutlined />,
        keywords: ['new', 'expense'],
        isQuickAction: true,
        onlineOnly: true,
      },
    ];
    return allActions.filter((a) => !a.onlineOnly || isOnline);
  }, [isOnline]);

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

  const activeMenuItems = isOnline ? menuItems : offlineMenuItems;

  const userMenu = {
    items: [
      { key: 'org', label: <div className="text-gray-500 text-xs px-2 py-1">{currentOrgName}</div>, disabled: true },
      { type: 'divider' as const },
      { key: 'profile', icon: <UserOutlined />, label: 'My Profile', onClick: () => navigate('/profile') },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: handleLogout, danger: true },
    ],
  };

  const quickEntryMenu = {
    items: quickEntryActions.map((act) => ({
      key: act.key,
      icon: act.icon,
      label: act.label,
      onClick: () => navigate(act.key),
    })),
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

          {!collapsed && (
            <div style={{
              padding: '8px 16px',
              fontSize: 11,
              color: token.colorTextTertiary,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}>
              <span>RetailSuite</span>
              <span style={{ fontWeight: 600 }}>v{CURRENT_APP_VERSION}</span>
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
          <div className="flex items-center flex-1 min-w-0">
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
                <div className="text-xl font-bold mr-8 shrink-0" style={{ color: !isOnline ? '#d46b08' : token.colorPrimary }}>
                  {!isOnline ? '⚡ Offline Mode' : 'RetailSuite Portal'}
                </div>
                <Menu
                  theme={appTheme}
                  mode="horizontal"
                  selectedKeys={[location.pathname]}
                  items={activeMenuItems}
                  onClick={({ key }) => navigate(key)}
                  style={{ flex: 1, minWidth: 0, borderBottom: 'none', lineHeight: '62px' }}
                />
              </>
            )}
          </div>

          <Space align="center" size="middle">
            {isOnline && (
              <div
                onClick={() => setSearchModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 34,
                  padding: '0 10px 0 12px',
                  borderRadius: 8,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  backgroundColor: token.colorFillAlter,
                  color: token.colorTextSecondary,
                  cursor: 'pointer',
                  fontSize: 13,
                  lineHeight: 1,
                  userSelect: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 14 }} />
                <span className="hidden sm:inline" style={{ paddingRight: 8 }}>Search...</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '3px 6px',
                    borderRadius: 4,
                    backgroundColor: token.colorBgContainer,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    color: token.colorTextTertiary,
                  }}
                >
                  Ctrl+K
                </span>
              </div>
            )}

            {quickEntryActions.length > 0 && (
              <Dropdown menu={quickEntryMenu} placement="bottomRight" trigger={['click']}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    fontWeight: 500,
                    paddingInline: 14,
                  }}
                >
                  New
                </Button>
              </Dropdown>
            )}

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

      {searchModalOpen && (
        <NavigationCommandModal
          open={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          items={searchableNavItems}
          quickActions={quickEntryActions}
          pinnedKeys={pinnedShortcuts.map((s) => s.key)}
          onTogglePin={togglePinByKey}
          onNavigate={(path) => navigate(path)}
        />
      )}

      <GeminiAssistantWidget />
    </Layout>
  );
};
