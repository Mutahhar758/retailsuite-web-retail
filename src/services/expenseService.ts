import { chartOfAccountService, type ChartOfAccountHeadDto } from './chartOfAccountService';
import { paymentService, type PaymentCreateRequest } from './paymentService';

export interface ExpenseItemDto {
  account: string;
  title: string;
  subcategoryId?: string;
  subcategoryTitle?: string;
  balance?: number;
}

export interface RecordExpenseRequest {
  date: string;
  expenseAccountId: string;
  cashBankAccountId: string;
  amount: number;
  remarks?: string;
  payee?: string;
}

export interface ExpenseRecordDto {
  voucherNo: string;
  date: string;
  expenseAccountId: string;
  expenseTitle?: string;
  subcategoryId?: string;
  subcategoryTitle?: string;
  cashBankAccountId: string;
  cashBankTitle?: string;
  amount: number;
  remarks?: string;
  createdBy: string;
  createdOn: string;
}

export const OPERATING_EXPENSES_PREFIX = '004002';
export const DEFAULT_ADMIN_EXPENSES_PREFIX = '004002001';

export const expenseService = {
  /**
   * Get expense subcategories (e.g. Utility Bills, Rent, Maintenance)
   */
  async getSubcategories(): Promise<ChartOfAccountHeadDto[]> {
    return await chartOfAccountService.getLookup(OPERATING_EXPENSES_PREFIX, 4);
  },

  /**
   * Get broad expense categories
   */
  async getParentCategories(): Promise<ChartOfAccountHeadDto[]> {
    return await chartOfAccountService.getLookup(OPERATING_EXPENSES_PREFIX, 3);
  },

  /**
   * Get expense detail accounts (e.g. Electricity Bill, Shop Rent)
   */
  async getExpenseItems(subcategoryId?: string): Promise<ChartOfAccountHeadDto[]> {
    const prefix = subcategoryId || OPERATING_EXPENSES_PREFIX;
    return await chartOfAccountService.getLookup(prefix, 5);
  },

  /**
   * Create a new expense item under a subcategory
   */
  async createExpenseItem(title: string, parentSubcategoryId: string): Promise<string> {
    return await chartOfAccountService.create({
      title: title.trim(),
      parentId: parentSubcategoryId,
    });
  },

  /**
   * Create a new subcategory under an expense category
   */
  async createSubcategory(title: string, parentCategoryId: string = DEFAULT_ADMIN_EXPENSES_PREFIX): Promise<string> {
    return await chartOfAccountService.create({
      title: title.trim(),
      parentId: parentCategoryId,
    });
  },

  /**
   * Record a daily expense payment
   */
  async recordExpense(req: RecordExpenseRequest): Promise<string> {
    const paymentReq: PaymentCreateRequest = {
      date: req.date,
      cashBankAccount: req.cashBankAccountId,
      narration: req.payee ? `Paid to: ${req.payee}` : undefined,
      lines: [
        {
          seq: 1,
          account: req.expenseAccountId,
          amount: req.amount,
          remarks: req.remarks || (req.payee ? `Paid to ${req.payee}` : undefined),
        },
      ],
    };

    return await paymentService.create(paymentReq);
  },

  /**
   * Get recent expenses list
   */
  async getRecentExpenses(params?: {
    fromDate?: string;
    toDate?: string;
    cashBankAccount?: string;
    expenseAccount?: string;
    pageNumber?: number;
    pageSize?: number;
  }) {
    return await paymentService.getList({
      fromDate: params?.fromDate,
      toDate: params?.toDate,
      cashBankAccount: params?.cashBankAccount,
      account: params?.expenseAccount,
      pageNumber: params?.pageNumber || 1,
      pageSize: params?.pageSize || 20,
    });
  },
};
