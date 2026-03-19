import api from './api';
import type {
  Loan,
  LoanApplicationRequest,
  LoanFilters,
  Installment,
  LoanRequest,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

// Backend endpointi za kredite ce biti implementirani u Sprint 3
// URL-ovi su pripremljeni prema specifikaciji

export const creditService = {
  getMyLoans: async (): Promise<Loan[]> => {
    const response = await api.get<Loan[]>('/loans/my');
    return response.data;
  },

  getAll: async (filters?: LoanFilters): Promise<PaginatedResponse<Loan>> => {
    const params = new URLSearchParams();
    if (filters?.loanType) params.append('loanType', filters.loanType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<PaginatedResponse<Loan>>('/loans', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Loan> => {
    const response = await api.get<Loan>(`/loans/${id}`);
    return response.data;
  },

  apply: async (data: LoanApplicationRequest): Promise<Loan> => {
    const response = await api.post<Loan>('/loans/apply', data);
    return response.data;
  },

  approve: async (loanId: number): Promise<void> => {
    await api.patch(`/loans/${loanId}/approve`);
  },

  reject: async (loanId: number, reason: string): Promise<void> => {
    await api.patch(`/loans/${loanId}/reject`, { reason });
  },

  getInstallments: async (loanId: number): Promise<Installment[]> => {
    const response = await api.get<Installment[]>(`/loans/${loanId}/installments`);
    return response.data;
  },

  getRequests: async (filters?: LoanFilters): Promise<PaginatedResponse<LoanRequest>> => {
    const params = new URLSearchParams();
    if (filters?.loanType) params.append('loanType', filters.loanType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.accountNumber) params.append('accountNumber', filters.accountNumber);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<PaginatedResponse<LoanRequest>>('/loans/requests', { params });
    return response.data;
  },
};
