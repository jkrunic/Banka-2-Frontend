import api from './api';
import type {
  Account,
  BusinessAccount,
  AccountFilters,
  CreateAccountRequest,
  ChangeLimitRequest,
} from '../types/celina2';
import type { PaginatedResponse } from '../types';

export const accountService = {
  // Employee portal - svi racuni
  getAll: async (filters?: AccountFilters): Promise<PaginatedResponse<Account>> => {
    const params = new URLSearchParams();
    if (filters?.ownerName) params.append('ownerName', filters.ownerName);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<PaginatedResponse<Account>>('/accounts/all', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Account> => {
    const response = await api.get<Account>(`/accounts/${id}`);
    return response.data;
  },

  getMyAccounts: async (): Promise<Account[]> => {
    const response = await api.get<Account[]>('/accounts/my');
    return response.data;
  },

  // Employee portal - racuni po klijentu
  getByClientId: async (clientId: number): Promise<Account[]> => {
    const response = await api.get<Account[]>(`/accounts/client/${clientId}`);
    return response.data;
  },

  create: async (data: CreateAccountRequest): Promise<Account> => {
    const response = await api.post<Account>('/accounts', data);
    return response.data;
  },

  updateName: async (accountId: number, name: string): Promise<Account> => {
    const response = await api.patch<Account>(`/accounts/${accountId}/name`, { name });
    return response.data;
  },

  changeLimit: async (accountId: number, data: ChangeLimitRequest): Promise<void> => {
    await api.patch(`/accounts/${accountId}/limits`, data);
  },
};
