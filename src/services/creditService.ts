import api from './api';
import type {
  Loan,
  LoanApplicationRequest,
  LoanFilters,
  Installment,
  LoanRequest,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

export const creditService = {
  getMyLoans: async (): Promise<Loan[]> => {
    const response = await api.get<PaginatedResponse<Loan>>('/loans/my');
    return Array.isArray(response.data) ? response.data : (response.data?.content ?? []);
  },

  getAll: async (filters?: LoanFilters): Promise<PaginatedResponse<Loan>> => {
    const params = new URLSearchParams();
    if (filters?.loanType) params.append('loanType', filters.loanType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('size', String(filters.limit));

    const response = await api.get<PaginatedResponse<Loan>>('/loans', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Loan> => {
    const response = await api.get<Loan>(`/loans/${id}`);
    return response.data;
  },

  apply: async (data: LoanApplicationRequest): Promise<LoanRequest> => {
    // Mapiranje FE enum vrednosti -> BE enum vrednosti
    const loanTypeMap: Record<string, string> = {
      GOTOVINSKI: 'CASH', STAMBENI: 'MORTGAGE', AUTO: 'AUTO',
      STUDENTSKI: 'STUDENT', REFINANSIRAJUCI: 'REFINANCING',
      CASH: 'CASH', MORTGAGE: 'MORTGAGE', REFINANCING: 'REFINANCING', STUDENT: 'STUDENT',
    };
    const interestTypeMap: Record<string, string> = {
      FIKSNI: 'FIXED', VARIJABILNI: 'VARIABLE', FIXED: 'FIXED', VARIABLE: 'VARIABLE',
    };
    const payload = {
      ...data,
      loanType: loanTypeMap[data.loanType] || data.loanType,
      interestType: interestTypeMap[data.interestRateType] || data.interestRateType,
    };
    const response = await api.post<LoanRequest>('/loans', payload);
    return response.data;
  },

  approve: async (requestId: number): Promise<void> => {
    await api.patch(`/loans/requests/${requestId}/approve`);
  },

  reject: async (requestId: number): Promise<void> => {
    await api.patch(`/loans/requests/${requestId}/reject`);
  },

  getInstallments: async (loanId: number): Promise<Installment[]> => {
    const response = await api.get<Installment[]>(`/loans/${loanId}/installments`);
    return response.data;
  },

  earlyRepayment: async (loanId: number): Promise<void> => {
    await api.post(`/loans/${loanId}/early-repayment`);
  },

  getMyRequests: async (): Promise<LoanRequest[]> => {
    const response = await api.get<LoanRequest[]>('/loans/requests/my');
    return Array.isArray(response.data) ? response.data : [];
  },

  getRequests: async (filters?: LoanFilters): Promise<PaginatedResponse<LoanRequest>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('size', String(filters.limit));

    const response = await api.get<PaginatedResponse<LoanRequest>>('/loans/requests', { params });
    return response.data;
  },
};
