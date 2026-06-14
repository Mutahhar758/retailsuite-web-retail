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
import { PurchaseForm } from './pages/daily-entries/PurchaseForm';
import { SaleList } from './pages/daily-entries/SaleList';
import { SaleForm } from './pages/daily-entries/SaleForm';
import { POSSaleForm } from './pages/daily-entries/POSSaleForm';
import { SaleSupplyList } from './pages/daily-entries/SaleSupplyList';
import { SaleSupplyForm } from './pages/daily-entries/SaleSupplyForm';
import { SupplyOrderList } from './pages/daily-entries/SupplyOrderList';
import { SupplyOrderForm } from './pages/daily-entries/SupplyOrderForm';
import { SaleReturnList } from './pages/daily-entries/SaleReturnList';
import { SaleReturnForm } from './pages/daily-entries/SaleReturnForm';
import { PurchaseReturnList } from './pages/daily-entries/PurchaseReturnList';
import { PurchaseReturnForm } from './pages/daily-entries/PurchaseReturnForm';
import { StockAdjustmentList } from './pages/daily-entries/StockAdjustmentList';
import { StockAdjustmentForm } from './pages/daily-entries/StockAdjustmentForm';
import { BankReconciliation } from './pages/daily-entries/BankReconciliation';
import { AccountStatement } from './pages/reports/AccountStatement';
import { AccountStatementWithDue } from './pages/reports/AccountStatementWithDue';
import { TrialBalanceReport } from './pages/reports/TrialBalanceReport';
import { AccountBalanceReport } from './pages/reports/AccountBalanceReport';
import { StockBalance } from './pages/reports/StockBalance';
import { ItemLedger } from './pages/reports/ItemLedger';
import { IncomeSummary } from './pages/reports/IncomeSummary';
import { BalanceSheet } from './pages/reports/BalanceSheet';
import { CustomerBill } from './pages/reports/CustomerBill';
import { NarrationList } from './pages/setup/NarrationList';
import { UnitList } from './pages/setup/UnitList';
import { ItemCategoryList } from './pages/setup/ItemCategoryList';
import { PrinterSettings } from './pages/setup/PrinterSettings';
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
import { OpeningBalance } from './pages/setup/OpeningBalance';
import { Profile } from './pages/auth/Profile';
import { useAppStore } from './stores/useAppStore';
import { useAuthStore } from './stores/useAuthStore';
import { lightTheme, darkTheme } from './theme/themeConfig';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { theme } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
            <Route path="daily-entries/purchase/new" element={<PurchaseForm />} />
            <Route path="daily-entries/purchase/:voucherNo" element={<PurchaseForm />} />
            
            <Route path="daily-entries/sale" element={<SaleList />} />
            <Route path="daily-entries/sale/new" element={<SaleForm />} />
            <Route path="daily-entries/sale/:voucherNo" element={<SaleForm />} />
            <Route path="daily-entries/pos-sale" element={<POSSaleForm />} />

             <Route path="daily-entries/sale-supply" element={<SaleSupplyList />} />
             <Route path="daily-entries/sale-supply/new" element={<SaleSupplyForm />} />
             <Route path="daily-entries/sale-supply/:voucherNo" element={<SaleSupplyForm />} />

            <Route path="daily-entries/sale-return" element={<SaleReturnList />} />
            <Route path="daily-entries/sale-return/new" element={<SaleReturnForm />} />
            <Route path="daily-entries/sale-return/:voucherNo" element={<SaleReturnForm />} />

            <Route path="daily-entries/purchase-return" element={<PurchaseReturnList />} />
            <Route path="daily-entries/purchase-return/new" element={<PurchaseReturnForm />} />
            <Route path="daily-entries/purchase-return/:voucherNo" element={<PurchaseReturnForm />} />

            <Route path="daily-entries/stock-adjustment" element={<StockAdjustmentList />} />
            <Route path="daily-entries/stock-adjustment/new" element={<StockAdjustmentForm />} />
            <Route path="daily-entries/stock-adjustment/:voucherNo" element={<StockAdjustmentForm />} />
            
            <Route path="daily-entries/bank-reconciliation" element={<BankReconciliation />} />
            
            {/* Reports */}
            <Route path="reports/account-statement" element={<AccountStatement />} />
            <Route path="reports/account-statement-with-due" element={<AccountStatementWithDue />} />
            <Route path="reports/account-balance" element={<AccountBalanceReport />} />
            <Route path="reports/trial-balance" element={<TrialBalanceReport />} />
            <Route path="reports/stock-balance" element={<StockBalance />} />
            <Route path="reports/item-ledger" element={<ItemLedger />} />
            <Route path="reports/income-summary" element={<IncomeSummary />} />
            <Route path="reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="reports/customer-bill" element={<CustomerBill />} />
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
            
            <Route path="setup/supply-order" element={<SupplyOrderList />} />
            <Route path="setup/supply-order/new" element={<SupplyOrderForm />} />
            <Route path="setup/supply-order/:id" element={<SupplyOrderForm />} />
            <Route path="setup/printer-settings" element={<PrinterSettings />} />
            <Route path="setup/opening-balance" element={<OpeningBalance />} />
            
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
