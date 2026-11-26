import api from './api';

// --- Enums ---
export const PayrollComponentType = {
  Earning: 1,
  Deduction: 2,
} as const;
export type PayrollComponentType = typeof PayrollComponentType[keyof typeof PayrollComponentType];

export const PayrollCalculationType = {
  Fixed: 1,
  PercentageOfBasic: 2,
  PerUnit: 3,
  Formula: 4,
} as const;
export type PayrollCalculationType = typeof PayrollCalculationType[keyof typeof PayrollCalculationType];

export const PayrollRunStatus = {
  Draft: 1,
  Calculated: 2,
  PendingApproval: 3,
  Approved: 4,
  Posted: 5,
  PartiallyPaid: 6,
  Paid: 7,
  Reversed: 8,
  Cancelled: 9,
} as const;
export type PayrollRunStatus = typeof PayrollRunStatus[keyof typeof PayrollRunStatus];

export const EmployeeLoanType = {
  Loan: 1,
  SalaryAdvance: 2,
} as const;
export type EmployeeLoanType = typeof EmployeeLoanType[keyof typeof EmployeeLoanType];

export const EmployeeLoanStatus = {
  Pending: 1,
  Approved: 2,
  Active: 3,
  Completed: 4,
  Cancelled: 5,
} as const;
export type EmployeeLoanStatus = typeof EmployeeLoanStatus[keyof typeof EmployeeLoanStatus];

export const LoanInstallmentStatus = {
  Scheduled: 1,
  Deducted: 2,
  Skipped: 3,
  SettledManually: 4,
} as const;
export type LoanInstallmentStatus = typeof LoanInstallmentStatus[keyof typeof LoanInstallmentStatus];

// --- Interfaces ---
export interface PayrollComponentDto {
  id: number;
  code: string;
  name: string;
  componentType: PayrollComponentType;
  calculationType: PayrollCalculationType;
  defaultValue: number;
  formulaExpression?: string;
  isSystem: boolean;
  isRecurring: boolean;
  showOnPayslip: boolean;
  displayOrder: number;
  isActive: boolean;
  description?: string;
  expenseAccountId?: string;
  expenseAccountTitle?: string;
  liabilityAccountId?: string;
  liabilityAccountTitle?: string;
}

export interface PayrollComponentUpsertRequest {
  code: string;
  name: string;
  componentType: PayrollComponentType;
  calculationType: PayrollCalculationType;
  defaultValue: number;
  formulaExpression?: string | null;
  isRecurring: boolean;
  showOnPayslip: boolean;
  displayOrder: number;
  isActive: boolean;
  description?: string | null;
  expenseAccountId?: string | null;
  liabilityAccountId?: string | null;
}

export interface SalaryStructureLineDto {
  id: number;
  payrollComponentId: number;
  componentCode: string;
  componentName: string;
  componentType: PayrollComponentType;
  effectiveCalculationType: PayrollCalculationType;
  calculationTypeOverride?: PayrollCalculationType | null;
  value: number;
  formulaOverride?: string | null;
  displayOrder: number;
}

export interface SalaryStructureDto {
  id: number;
  code: string;
  name: string;
  description?: string;
  salaryType: string;
  isDefault: boolean;
  isActive: boolean;
  assignedEmployeeCount: number;
  lines: SalaryStructureLineDto[];
}

export interface SalaryStructureUpsertRequest {
  code: string;
  name: string;
  description?: string | null;
  salaryType: string;
  isDefault: boolean;
  isActive: boolean;
  lines: {
    payrollComponentId: number;
    calculationTypeOverride?: PayrollCalculationType | null;
    value: number;
    formulaOverride?: string | null;
    displayOrder: number;
  }[];
}

export interface EmployeeSalaryComponentDto {
  id: number;
  hrInfoId: string;
  payrollComponentId: number;
  componentCode: string;
  componentName: string;
  componentType: PayrollComponentType;
  calculationTypeOverride?: PayrollCalculationType | null;
  value: number;
  formulaOverride?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface EmployeeLoanScheduleDto {
  id: number;
  installmentNo: number;
  dueYear: number;
  dueMonth: number;
  scheduledAmount: number;
  deductedAmount: number;
  status: LoanInstallmentStatus;
  payrollRunItemId?: number | null;
  remarks?: string | null;
}

export interface EmployeeLoanDto {
  id: number;
  loanNo: string;
  hrInfoId: string;
  employeeName: string;
  designation?: string;
  loanType: EmployeeLoanType;
  principalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  remainingBalance: number;
  startYear: number;
  startMonth: number;
  status: EmployeeLoanStatus;
  disbursementDate?: string | null;
  disbursementAccountId?: string | null;
  disbursementAccountTitle?: string | null;
  receivableAccountId?: string | null;
  receivableAccountTitle?: string | null;
  glVoucherNo?: string | null;
  remarks?: string | null;
  approvedBy?: string | null;
  approvedOn?: string | null;
  createdBy: string;
  createdOn: string;
  schedules: EmployeeLoanScheduleDto[];
}

export interface EmployeeLoanCreateRequest {
  hrInfoId: string;
  loanType: EmployeeLoanType;
  principalAmount: number;
  installmentCount: number;
  startYear: number;
  startMonth: number;
  receivableAccountId?: string | null;
  remarks?: string | null;
}

export interface EmployeeLoanDisburseRequest {
  disbursementDate: string;
  disbursementAccountId: string;
  receivableAccountId?: string | null;
  remarks?: string | null;
}

export interface PayrollDashboardKpiDto {
  currentMonthNetPayroll: number;
  pendingApprovalCount: number;
  unpaidPayableBalance: number;
  activeLoanPortfolio: number;
  activeEmployeeCount: number;
}

export interface PayrollRunSummaryDto {
  id: number;
  runNo: string;
  payYear: number;
  payMonth: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  salaryType: string;
  status: PayrollRunStatus;
  description?: string;
  employeeCount: number;
  totalGrossEarnings: number;
  totalDeductions: number;
  totalLoanRecovery: number;
  totalNetSalary: number;
  totalPaidAmount: number;
  glVoucherNo?: string | null;
  reversalGlVoucherNo?: string | null;
  submittedBy?: string | null;
  submittedOn?: string | null;
  approvedBy?: string | null;
  approvedOn?: string | null;
  postedBy?: string | null;
  postedOn?: string | null;
  rejectionReason?: string | null;
  createdBy: string;
  createdOn: string;
}

export interface PayrollRunItemComponentDto {
  id: number;
  payrollComponentId?: number | null;
  componentCode: string;
  componentName: string;
  componentType: PayrollComponentType;
  calculationType: PayrollCalculationType;
  quantity: number;
  rate: number;
  amount: number;
  isManualOverride: boolean;
  showOnPayslip: boolean;
  displayOrder: number;
  glAccountId?: string | null;
}

export interface PayrollRunItemDto {
  id: number;
  hrInfoId: string;
  employeeName: string;
  designation?: string;
  department?: string;
  cnic?: string;
  paymentMethod: string;
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNo?: string;
  iban?: string;
  expenseAccountId?: string;
  payableAccountId?: string;
  workingDays: number;
  presentDays: number;
  unpaidLeaveDays: number;
  leaveChargeRate: number;
  overtimeHours: number;
  overtimeRate: number;
  bonusAmount: number;
  basicSalary: number;
  grossEarnings: number;
  totalDeductions: number;
  loanRecoveryAmount: number;
  netSalary: number;
  paidAmount: number;
  balanceAmount: number;
  isOnHold: boolean;
  remarks?: string;
  components: PayrollRunItemComponentDto[];
}

export interface PayrollRunDetailDto extends PayrollRunSummaryDto {
  items: PayrollRunItemDto[];
}

export interface PayrollRunCreateRequest {
  payYear: number;
  payMonth: number;
  periodStart?: string;
  periodEnd?: string;
  payDate: string;
  salaryType: string;
  description?: string;
  autoCalculate: boolean;
}

export interface PayrollRunItemUpdateRequest {
  workingDays: number;
  presentDays: number;
  unpaidLeaveDays: number;
  leaveChargeRate: number;
  overtimeHours: number;
  overtimeRate: number;
  bonusAmount: number;
  isOnHold: boolean;
  remarks?: string;
  expenseAccountId?: string;
  payableAccountId?: string;
  adHocComponents?: {
    payrollComponentId?: number | null;
    componentCode: string;
    componentName: string;
    componentType: PayrollComponentType;
    amount: number;
    glAccountId?: string | null;
  }[];
}

export interface PayrollGlPreviewLineDto {
  drAccountId: string;
  drAccountTitle: string;
  crAccountId: string;
  crAccountTitle: string;
  amount: number;
  remarks: string;
}

export interface PayrollGlPreviewDto {
  payrollRunId: number;
  runNo: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  validationErrors: string[];
  lines: PayrollGlPreviewLineDto[];
}

export interface PayrollDisbursementLineDto {
  id: number;
  payrollRunItemId: number;
  hrInfoId: string;
  employeeName: string;
  amount: number;
  bankNameSnapshot?: string;
  bankAccountSnapshot?: string;
  ibanSnapshot?: string;
}

export interface PayrollDisbursementDto {
  id: number;
  disbursementNo: string;
  payrollRunId: number;
  runNo: string;
  paymentDate: string;
  paymentMethod: string;
  sourceAccountId: string;
  sourceAccountTitle: string;
  totalAmount: number;
  glVoucherNo?: string;
  referenceNo?: string;
  remarks?: string;
  createdBy: string;
  createdOn: string;
  lines: PayrollDisbursementLineDto[];
}

export interface PayrollDisbursementCreateRequest {
  payrollRunId: number;
  paymentDate: string;
  paymentMethod: string;
  sourceAccountId: string;
  referenceNo?: string;
  remarks?: string;
  payrollRunItemIds?: number[];
}

// --- API Clients ---
export const payrollComponentService = {
  async getAll(isActive?: boolean) {
    const res = await api.get('/api/payroll/components', { params: { isActive } });
    return (res.data.body || []) as PayrollComponentDto[];
  },
  async create(data: PayrollComponentUpsertRequest) {
    const res = await api.post('/api/payroll/components', data);
    return res.data.body as number;
  },
  async update(id: number, data: PayrollComponentUpsertRequest) {
    const res = await api.put(`/api/payroll/components/${id}`, data);
    return res.data.body as string;
  },
  async delete(id: number) {
    const res = await api.delete(`/api/payroll/components/${id}`);
    return res.data.body as string;
  },
};

export const salaryStructureService = {
  async getAll() {
    const res = await api.get('/api/payroll/structures');
    return (res.data.body || []) as SalaryStructureDto[];
  },
  async getById(id: number) {
    const res = await api.get(`/api/payroll/structures/${id}`);
    return res.data.body as SalaryStructureDto;
  },
  async create(data: SalaryStructureUpsertRequest) {
    const res = await api.post('/api/payroll/structures', data);
    return res.data.body as number;
  },
  async update(id: number, data: SalaryStructureUpsertRequest) {
    const res = await api.put(`/api/payroll/structures/${id}`, data);
    return res.data.body as string;
  },
  async delete(id: number) {
    const res = await api.delete(`/api/payroll/structures/${id}`);
    return res.data.body as string;
  },
  async getEmployeeOverrides(hrInfoId: string) {
    const res = await api.get(`/api/payroll/structures/employee/${hrInfoId}/components`);
    return (res.data.body || []) as EmployeeSalaryComponentDto[];
  },
  async saveEmployeeOverrides(hrInfoId: string, items: any[]) {
    const res = await api.put(`/api/payroll/structures/employee/${hrInfoId}/components`, items);
    return res.data.body as string;
  },
};

export const employeeLoanService = {
  async getList(params?: { hrInfoId?: string; status?: number; loanType?: number }) {
    const res = await api.get('/api/payroll/loans', { params });
    return (res.data.body || []) as EmployeeLoanDto[];
  },
  async getById(id: number) {
    const res = await api.get(`/api/payroll/loans/${id}`);
    return res.data.body as EmployeeLoanDto;
  },
  async create(data: EmployeeLoanCreateRequest) {
    const res = await api.post('/api/payroll/loans', data);
    return res.data.body as number;
  },
  async approve(id: number) {
    const res = await api.post(`/api/payroll/loans/${id}/approve`);
    return res.data.body as string;
  },
  async disburse(id: number, data: EmployeeLoanDisburseRequest) {
    const res = await api.post(`/api/payroll/loans/${id}/disburse`, data);
    return res.data.body as string;
  },
  async cancel(id: number, reason?: string) {
    const res = await api.post(`/api/payroll/loans/${id}/cancel`, null, { params: { reason } });
    return res.data.body as string;
  },
  async skipInstallment(loanId: number, scheduleId: number, remarks?: string) {
    const res = await api.post(`/api/payroll/loans/${loanId}/schedules/${scheduleId}/skip`, { remarks });
    return res.data.body as string;
  },
  async settleInstallment(loanId: number, scheduleId: number, data: { remarks?: string; settlementDate?: string; settlementAccountId?: string }) {
    const res = await api.post(`/api/payroll/loans/${loanId}/schedules/${scheduleId}/settle`, data);
    return res.data.body as string;
  },
};

export const payrollRunService = {
  async getKpis() {
    const res = await api.get('/api/payroll/runs/kpis');
    return res.data.body as PayrollDashboardKpiDto;
  },
  async getList(params?: { payYear?: number; payMonth?: number; status?: number; salaryType?: string }) {
    const res = await api.get('/api/payroll/runs', { params });
    return (res.data.body || []) as PayrollRunSummaryDto[];
  },
  async getById(id: number) {
    const res = await api.get(`/api/payroll/runs/${id}`);
    return res.data.body as PayrollRunDetailDto;
  },
  async create(data: PayrollRunCreateRequest) {
    const res = await api.post('/api/payroll/runs', data);
    return res.data.body as number;
  },
  async calculate(id: number) {
    const res = await api.post(`/api/payroll/runs/${id}/calculate`);
    return res.data.body as PayrollRunDetailDto;
  },
  async updateItem(runId: number, itemId: number, data: PayrollRunItemUpdateRequest) {
    const res = await api.put(`/api/payroll/runs/${runId}/items/${itemId}`, data);
    return res.data.body as PayrollRunItemDto;
  },
  async submit(id: number) {
    const res = await api.post(`/api/payroll/runs/${id}/submit`);
    return res.data.body as string;
  },
  async approve(id: number) {
    const res = await api.post(`/api/payroll/runs/${id}/approve`);
    return res.data.body as string;
  },
  async reject(id: number, reason: string) {
    const res = await api.post(`/api/payroll/runs/${id}/reject`, { reason });
    return res.data.body as string;
  },
  async getGlPreview(id: number) {
    const res = await api.get(`/api/payroll/runs/${id}/gl-preview`);
    return res.data.body as PayrollGlPreviewDto;
  },
  async post(id: number) {
    const res = await api.post(`/api/payroll/runs/${id}/post`);
    return res.data.body as string;
  },
  async reverse(id: number, reason: string) {
    const res = await api.post(`/api/payroll/runs/${id}/reverse`, { reason });
    return res.data.body as string;
  },
  async cancel(id: number) {
    const res = await api.post(`/api/payroll/runs/${id}/cancel`);
    return res.data.body as string;
  },
  async downloadPayslipPdf(runId: number, itemId: number, fileName?: string) {
    const res = await api.get(`/api/payroll/runs/${runId}/items/${itemId}/payslip-pdf`, { responseType: 'blob' });
    triggerBlobDownload(res.data, fileName || `Payslip_Run${runId}_${itemId}.pdf`);
  },
  async downloadBulkPayslipsPdf(runId: number, runNo?: string) {
    const res = await api.get(`/api/payroll/runs/${runId}/payslips-pdf`, { responseType: 'blob' });
    triggerBlobDownload(res.data, `Payslips_${runNo || runId}.pdf`);
  },
  async downloadRegisterPdf(runId: number, runNo?: string) {
    const res = await api.get(`/api/payroll/runs/${runId}/register-pdf`, { responseType: 'blob' });
    triggerBlobDownload(res.data, `PayrollRegister_${runNo || runId}.pdf`);
  },
};

export const payrollDisbursementService = {
  async getByRun(payrollRunId: number) {
    const res = await api.get(`/api/payroll/disbursements/by-run/${payrollRunId}`);
    return (res.data.body || []) as PayrollDisbursementDto[];
  },
  async create(data: PayrollDisbursementCreateRequest) {
    const res = await api.post('/api/payroll/disbursements', data);
    return res.data.body as PayrollDisbursementDto;
  },
  async voidDisbursement(id: number) {
    const res = await api.delete(`/api/payroll/disbursements/${id}`);
    return res.data.body as string;
  },
  async downloadBankAdviceCsv(id: number, disbursementNo?: string) {
    const res = await api.get(`/api/payroll/disbursements/${id}/bank-advice-csv`, { responseType: 'blob' });
    triggerBlobDownload(res.data, `BankAdvice_${disbursementNo || id}.csv`);
  },
};

function triggerBlobDownload(blobData: BlobPart, fileName: string) {
  const url = window.URL.createObjectURL(new Blob([blobData]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
