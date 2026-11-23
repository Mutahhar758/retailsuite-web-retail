export const COA_LEVELS = {
  ROOT: 1,
  GROUP: 2,
  SUB_GROUP: 3,
  CATEGORY: 4,
  DETAIL: 5,
} as const;

export const COA_ACCOUNT_TYPES = {
  PARENT: 'Parent',
  DETAIL: 'Detail',
} as const;

export const COA_ROOT_IDS = {
  ASSETS: '001',
  LIABILITIES: '002',
  INCOME: '003',
  EXPENSES: '004',
  CAPITAL: '005',
} as const;

export const COA_PREFIXES = {
  FIXED_ASSETS: '001001',
  CURRENT_ASSETS: '001002',
  CURRENT_LIABILITIES: '002001',
  OPERATING_EXPENSES: '004002',
  DEFAULT_ADMIN_EXPENSES: '004002001',
} as const;

export const COA_SEGMENT_LENGTHS = {
  LEVEL_3: 9,
  LEVEL_4: 12,
} as const;
