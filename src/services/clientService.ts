import api from './api';
import type { ClientFilters } from '../types/celina2';
import type { PaginatedResponse, Client } from '../types';

export const clientService = {
  getAll: async (filters?: ClientFilters): Promise<PaginatedResponse<Client>> => {
    const params = new URLSearchParams();
    if (filters?.firstName) params.append('firstName', filters.firstName);
    if (filters?.lastName) params.append('lastName', filters.lastName);
    if (filters?.email) params.append('email', filters.email);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const response = await api.get<PaginatedResponse<Client>>('/clients', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Client> => {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  },

  create: async (data: Partial<Client>): Promise<Client> => {
    const response = await api.post<Client>('/clients', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Client>): Promise<Client> => {
    const response = await api.put<Client>(`/clients/${id}`, data);
    return response.data;
  },
};
