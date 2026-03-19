import api from './api';
import type {
  PaymentRecipient,
  CreateRecipientRequest,
  UpdateRecipientRequest,
} from '../types/celina2';

export const paymentRecipientService = {
  getAll: async (): Promise<PaymentRecipient[]> => {
    const response = await api.get<PaymentRecipient[]>('/payment-recipients');
    return response.data;
  },

  getById: async (id: number): Promise<PaymentRecipient> => {
    const response = await api.get<PaymentRecipient>(`/payment-recipients/${id}`);
    return response.data;
  },

  create: async (data: CreateRecipientRequest): Promise<PaymentRecipient> => {
    const response = await api.post<PaymentRecipient>('/payment-recipients', data);
    return response.data;
  },

  update: async (id: number, data: UpdateRecipientRequest): Promise<PaymentRecipient> => {
    const response = await api.put<PaymentRecipient>(`/payment-recipients/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/payment-recipients/${id}`);
  },
};
