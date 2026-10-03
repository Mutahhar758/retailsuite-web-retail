import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Dashboard } from './pages/dashboard/Dashboard';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { PaymentVoucherList } from './pages/daily-entries/PaymentVoucherList';
import { PaymentVoucherForm } from './pages/daily-entries/PaymentVoucherForm';
import { ReceiptVoucherList } from './pages/daily-entries/ReceiptVoucherList';
import { ReceiptVoucherForm } from './pages/daily-entries/ReceiptVoucherForm';
import { JournalVoucherList } from './pages/daily-entries/JournalVoucherList';
import { JournalVoucherForm } from './pages/daily-entries/JournalVoucherForm';
import { PurchaseList } from './pages/daily-entries/PurchaseList';
import { NormalPurchaseForm } from './pages/daily-entries/NormalPurchaseForm';
import { WandaPurchaseForm } from './pages/daily-entries/WandaPurchaseForm';
import { SaleList } from './pages/daily-entries/SaleList';
import { NormalSaleForm } from './pages/daily-entries/NormalSaleForm';
import { WandaSaleForm } from './pages/daily-entries/WandaSaleForm';
import { POSSaleForm } from './pages/daily-entries/POSSaleForm';
import { SaleSupplyList } from './pages/daily-entries/SaleSupplyList';
import { NormalSaleSupplyForm } from './pages/daily-entries/NormalSaleSupplyForm';
import { WandaSaleSupplyForm } from './pages/daily-entries/WandaSaleSupplyForm';
import { NormalSupplyRegister } from './pages/daily-entries/NormalSupplyRegister';
import { WandaSupplyRegister } from './pages/daily-entries/WandaSupplyRegister';
import { SupplyOrderList } from './pages/daily-entries/SupplyOrderList';
import { SupplyOrderForm } from './pages/daily-entries/SupplyOrderForm';
import { SaleReturnList } from './pages/daily-entries/SaleReturnList';
import { NormalSaleReturnForm } from './pages/daily-entries/NormalSaleReturnForm';
import { WandaSaleReturnForm } from './pages/daily-entries/WandaSaleReturnForm';
import { PurchaseReturnList } from './pages/daily-entries/PurchaseReturnList';
import { NormalPurchaseReturnForm } from './pages/daily-entries/NormalPurchaseReturnForm';
import { WandaPurchaseReturnForm } from './pages/daily-entries/WandaPurchaseReturnForm';
import { StockAdjustmentList } from './pages/daily-entries/StockAdjustmentList';
import { NormalStockAdjustmentForm } from './pages/daily-entries/NormalStockAdjustmentForm';
import { WandaStockAdjustmentForm } from './pages/daily-entries/WandaStockAdjustmentForm';
import { BankReconciliation } from './pages/daily-entries/BankReconciliation';
import { KitchenDisplay } from './pages/daily-entries/KitchenDisplay';
import { AccountStatement } from './pages/reports/AccountStatement';
import { AccountStatementWithDue } from './pages/reports/AccountStatementWithDue';
import { TrialBalanceReport } from './pages/reports/TrialBalanceReport';
import { AccountBalanceReport } from './pages/reports/AccountBalanceReport';
import { StockBalance } from './pages/reports/StockBalance';
import { ItemLedger } from './pages/reports/ItemLedger';
import { IncomeSummary } from './pages/reports/IncomeSummary';
import { BalanceSheet } from './pages/reports/BalanceSheet';
import { NormalCustomerBill } from './pages/reports/NormalCustomerBill';
import { WandaCustomerBill } from './pages/reports/WandaCustomerBill';
import { MilkComparisonReport } from './pages/reports/MilkComparisonReport';
import { CustomerBalanceRecoveryReport } from './pages/reports/CustomerBalanceRecoveryReport';
import { ProfitByCustomer } from './pages/reports/ProfitByCustomer';
import { ProfitByItem } from './pages/reports/ProfitByItem';
import { NarrationList } from './pages/setup/NarrationList';
import { UnitList } from './pages/setup/UnitList';
import { ItemCategoryList } from './pages/setup/ItemCategoryList';
import { PrinterSettings } from './pages/setup/PrinterSettings';
import { SettingsPage } from './pages/setup/SettingsPage';
import { ChartOfAccountList } from './pages/setup/ChartOfAccountList';
import { DetailAccountList } from './pages/setup/DetailAccountList';
import { InventoryItemList } from './pages/setup/InventoryItemList';
import { InventoryItemForm } from './pages/setup/InventoryItemForm';
import { CustomerList } from './pages/setup/CustomerList';
import { CustomerForm } from './pages/setup/CustomerForm';
import { VendorList } from './pages/setup/VendorList';
import { VendorForm } from './pages/setup/VendorForm';
import { HRInfoList } from './pages/setup/HRInfoList';
import { HRInfoForm } from './pages/setup/HRInfoForm';
import { UserList } from './pages/setup/UserList';
import { UserForm } from './pages/setup/UserForm';
import { RoleList } from './pages/setup/RoleList';
import { RoleForm } from './pages/setup/RoleForm';
import { OpeningBalance } from './pages/setup/OpeningBalance';
import { DiningTableList } from './pages/setup/DiningTableList';
import { Profile } from './pages/auth/Profile';
import { useAppStore } from './stores/useAppStore';
import { useAuthStore } from './stores/useAuthStore';
import { useOfflineStore } from './stores/useOfflineStore';
import { lightTheme, darkTheme } from './theme/themeConfig';
import { getOrCreateDeviceId } from './services/offlineDb';
import { offlineCacheService } from './services/offlineCacheService';
import { offlineSyncService } from './services/offlineSyncService';
import { saleService } from './services/saleService';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { theme, currentTenantIdentifier, licenses } = useAppStore();
  const { setDeviceId, setPendingCount } = useOfflineStore();

  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = currentOrg?.hasVariablePackFeature ?? false;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Reactive pending count update on tenant change
  useEffect(() => {
    saleService.getOfflinePendingCount(currentTenantIdentifier).then(n => setPendingCount(n));
  }, [currentTenantIdentifier, setPendingCount]);

  // Offline system bootstrap (runs once on app load)
  useEffect(() => {
    // 1. Establish device identity
    getOrCreateDeviceId().then(id => setDeviceId(id));

    // 2. Warm reference data cache if we're online
    if (navigator.onLine) {
      offlineCacheService.warmCache().catch(console.error);
    }

    // 3. Register the 'online' event listener for auto-sync
    offlineSyncService.startListening();

    return () => {
      offlineSyncService.stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConfigProvider theme={theme === 'light' ? lightTheme : darkTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            
            {/* Daily Entries */}
            <Route path="daily-entries/payment-voucher" element={<PaymentVoucherList />} />
            <Route path="daily-entries/payment-voucher/new" element={<PaymentVoucherForm />} />
            <Route path="daily-entries/payment-voucher/:voucherNo" element={<PaymentVoucherForm />} />
            
            <Route path="daily-entries/receipt-voucher" element={<ReceiptVoucherList />} />
            <Route path="daily-entries/receipt-voucher/new" element={<ReceiptVoucherForm />} />
            <Route path="daily-entries/receipt-voucher/:voucherNo" element={<ReceiptVoucherForm />} />
            
            <Route path="daily-entries/journal-voucher" element={<JournalVoucherList />} />
            <Route path="daily-entries/journal-voucher/new" element={<JournalVoucherForm />} />
            <Route path="daily-entries/journal-voucher/:voucherNo" element={<JournalVoucherForm />} />
            
            <Route path="daily-entries/purchase" element={<PurchaseList />} />
            <Route path="daily-entries/purchase/new" element={IsWandaFeature ? <WandaPurchaseForm /> : <NormalPurchaseForm />} />
            <Route path="daily-entries/purchase/:voucherNo" element={IsWandaFeature ? <WandaPurchaseForm /> : <NormalPurchaseForm />} />
            
            <Route path="daily-entries/sale" element={<SaleList />} />
            <Route path="daily-entries/sale/new" element={IsWandaFeature ? <WandaSaleForm /> : <NormalSaleForm />} />
            <Route path="daily-entries/sale/:voucherNo" element={IsWandaFeature ? <WandaSaleForm /> : <NormalSaleForm />} />
            <Route path="daily-entries/pos-sale" element={<POSSaleForm />} />

             <Route path="daily-entries/sale-supply" element={<SaleSupplyList />} />
             <Route path="daily-entries/sale-supply/new" element={IsWandaFeature ? <WandaSaleSupplyForm /> : <NormalSaleSupplyForm />} />
             <Route path="daily-entries/sale-supply/:voucherNo" element={IsWandaFeature ? <WandaSaleSupplyForm /> : <NormalSaleSupplyForm />} />
             <Route path="daily-entries/customer-supply" element={IsWandaFeature ? <WandaSupplyRegister /> : <NormalSupplyRegister />} />

            <Route path="daily-entries/sale-return" element={<SaleReturnList />} />
            <Route path="daily-entries/sale-return/new" element={IsWandaFeature ? <WandaSaleReturnForm /> : <NormalSaleReturnForm />} />
            <Route path="daily-entries/sale-return/:voucherNo" element={IsWandaFeature ? <WandaSaleReturnForm /> : <NormalSaleReturnForm />} />

            <Route path="daily-entries/purchase-return" element={<PurchaseReturnList />} />
            <Route path="daily-entries/purchase-return/new" element={IsWandaFeature ? <WandaPurchaseReturnForm /> : <NormalPurchaseReturnForm />} />
            <Route path="daily-entries/purchase-return/:voucherNo" element={IsWandaFeature ? <WandaPurchaseReturnForm /> : <NormalPurchaseReturnForm />} />

            <Route path="daily-entries/stock-adjustment" element={<StockAdjustmentList />} />
            <Route path="daily-entries/stock-adjustment/new" element={IsWandaFeature ? <WandaStockAdjustmentForm /> : <NormalStockAdjustmentForm />} />
            <Route path="daily-entries/stock-adjustment/:voucherNo" element={IsWandaFeature ? <WandaStockAdjustmentForm /> : <NormalStockAdjustmentForm />} />
            
            <Route path="daily-entries/bank-reconciliation" element={<BankReconciliation />} />
            <Route path="daily-entries/kitchen-display" element={<KitchenDisplay />} />
            
            {/* Reports */}
            <Route path="reports/account-statement" element={<AccountStatement />} />
            <Route path="reports/account-statement-with-due" element={<AccountStatementWithDue />} />
            <Route path="reports/account-balance" element={<AccountBalanceReport />} />
            <Route path="reports/trial-balance" element={<TrialBalanceReport />} />
            <Route path="reports/stock-balance" element={<StockBalance />} />
            <Route path="reports/item-ledger" element={<ItemLedger />} />
            <Route path="reports/income-summary" element={<IncomeSummary />} />
            <Route path="reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="reports/customer-bill" element={IsWandaFeature ? <WandaCustomerBill /> : <NormalCustomerBill />} />
            <Route path="reports/milk-comparison" element={<MilkComparisonReport />} />
            <Route path="reports/customer-balance-recovery" element={<CustomerBalanceRecoveryReport />} />
            <Route path="reports/profit-by-customer" element={<ProfitByCustomer />} />
            <Route path="reports/profit-by-item" element={<ProfitByItem />} />
            <Route path="profile" element={<Profile />} />
            
            {/* Setup */}
            <Route path="setup/narrations" element={<NarrationList />} />
            <Route path="setup/units" element={<UnitList />} />
            <Route path="setup/item-categories" element={<ItemCategoryList />} />
            <Route path="setup/chart-of-accounts" element={<ChartOfAccountList />} />
            <Route path="setup/detail-accounts" element={<DetailAccountList />} />
             <Route path="setup/item-details" element={<InventoryItemList />} />
            <Route path="setup/item-details/new" element={<InventoryItemForm />} />
            <Route path="setup/item-details/:id" element={<InventoryItemForm />} />
            
             <Route path="setup/customers" element={<CustomerList />} />
            <Route path="setup/customers/new" element={<CustomerForm />} />
            <Route path="setup/customers/:account" element={<CustomerForm />} />
            
            <Route path="setup/vendors" element={<VendorList />} />
            <Route path="setup/vendors/new" element={<VendorForm />} />
            <Route path="setup/vendors/:account" element={<VendorForm />} />
            
            <Route path="setup/hr-info" element={<HRInfoList />} />
            <Route path="setup/hr-info/new" element={<HRInfoForm />} />
            <Route path="setup/hr-info/:id" element={<HRInfoForm />} />
            
            <Route path="setup/users" element={<UserList />} />
            <Route path="setup/users/new" element={<UserForm />} />
            <Route path="setup/users/:id" element={<UserForm />} />
            
            <Route path="setup/roles" element={<RoleList />} />
            <Route path="setup/roles/new" element={<RoleForm />} />
            <Route path="setup/roles/:id" element={<RoleForm />} />
            
            <Route path="setup/supply-order" element={<SupplyOrderList />} />
            <Route path="setup/supply-order/new" element={<SupplyOrderForm />} />
            <Route path="setup/supply-order/:id" element={<SupplyOrderForm />} />
            <Route path="setup/settings" element={<SettingsPage />} />
            <Route path="setup/printer-settings" element={<PrinterSettings />} />
            <Route path="setup/opening-balance" element={<OpeningBalance />} />
            <Route path="setup/dining-tables" element={<DiningTableList />} />
            
            {/* Other routes */}
            <Route path="setup/*" element={<PlaceholderPage />} />
            <Route path="daily-entries/*" element={<PlaceholderPage />} />
            <Route path="reports/*" element={<PlaceholderPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
