import { chartOfAccountService, type ChartOfAccountHeadDto } from './chartOfAccountService';
import { paymentService, type PaymentCreateRequest } from './paymentService';
import { journalVoucherService, type JournalVoucherCreateRequest } from './journalVoucherService';
import { openingBalanceService } from './openingBalanceService';

export const FIXED_ASSETS_PREFIX = '001001';

export interface FixedAssetDto {
  account: string;
  title: string;
  subcategoryId: string;
  subcategoryTitle?: string;
  categoryId: string;
  categoryTitle?: string;
  balance?: number;
  createdOn?: string;
}

export interface CreateFixedAssetRequest {
  title: string;
  subcategoryId: string;
  cost?: number;
  purchaseDate?: string;
  paymentMode: 'cash_bank' | 'vendor_credit' | 'opening';
  cashBankAccountId?: string;
  vendorAccountId?: string;
  remarks?: string;
}

export const fixedAssetService = {
  /**
   * Get Fixed Asset Categories (Equipment, Furniture, IT, Vehicles, Land)
   */
  async getCategories(): Promise<ChartOfAccountHeadDto[]> {
    return await chartOfAccountService.getLookup(FIXED_ASSETS_PREFIX, 3);
  },

  /**
   * Get Fixed Asset Subcategories (e.g. Store Equipment, Display Racks)
   */
  async getSubcategories(parentCategoryId?: string): Promise<ChartOfAccountHeadDto[]> {
    const prefix = parentCategoryId || FIXED_ASSETS_PREFIX;
    return await chartOfAccountService.getLookup(prefix, 4);
  },

  /**
   * Get Fixed Asset Detail Accounts
   */
  async getFixedAssets(parentSubcategoryId?: string): Promise<ChartOfAccountHeadDto[]> {
    const prefix = parentSubcategoryId || FIXED_ASSETS_PREFIX;
    return await chartOfAccountService.getLookup(prefix, 5);
  },

  /**
   * Create a new Subcategory under a Category
   */
  async createSubcategory(title: string, parentCategoryId: string): Promise<string> {
    return await chartOfAccountService.create({
      title: title.trim(),
      parentId: parentCategoryId,
    });
  },

  /**
   * Create a new Fixed Asset and optionally record purchase voucher
   */
  async createFixedAsset(req: CreateFixedAssetRequest): Promise<{ account: string; voucherNo?: string }> {
    // 1. Create detail account under the subcategory
    const account = await chartOfAccountService.create({
      title: req.title.trim(),
      parentId: req.subcategoryId,
    });

    let voucherNo: string | undefined;

    // 2. If purchase cost is provided and > 0, post accounting transaction
    if (req.cost && req.cost > 0) {
      const date = req.purchaseDate || new Date().toISOString().split('T')[0];

      if (req.paymentMode === 'cash_bank' && req.cashBankAccountId) {
        // Post Payment Voucher (Dr. Asset, Cr. Cash/Bank)
        const paymentReq: PaymentCreateRequest = {
          date,
          cashBankAccount: req.cashBankAccountId,
          narration: `Asset Acquisition: ${req.title.trim()}`,
          lines: [
            {
              seq: 1,
              account,
              amount: req.cost,
              remarks: req.remarks || `Purchase of Fixed Asset: ${req.title.trim()}`,
            },
          ],
        };
        voucherNo = await paymentService.create(paymentReq);
      } else if (req.paymentMode === 'vendor_credit' && req.vendorAccountId) {
        // Post Journal Voucher (Dr. Asset, Cr. Vendor)
        const jvReq: JournalVoucherCreateRequest = {
          date,
          narration: `Asset Acquisition on Credit: ${req.title.trim()}`,
          lines: [
            {
              seq: 1,
              drAccount: account,
              crAccount: req.vendorAccountId,
              amount: req.cost,
              remarks: req.remarks || `Purchase of Fixed Asset: ${req.title.trim()}`,
            },
          ],
        };
        voucherNo = await journalVoucherService.create(jvReq);
      } else if (req.paymentMode === 'opening') {
        // Record as Opening Balance in GL (Dr. Fixed Asset, Cr. Owner's Equity/Capital)
        await openingBalanceService.upsert({
          account,
          drAmount: req.cost,
        });
        voucherNo = 'OP-BAL';
      }
    }

    return { account, voucherNo };
  },

  /**
   * Get balance for a specific fixed asset
   */
  async getAssetBalance(account: string): Promise<number> {
    return await paymentService.getAccountBalance(account);
  },
};
