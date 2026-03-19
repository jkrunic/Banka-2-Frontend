import api from './api';
import type { Card, NewCardRequest } from '../types/celina2';

export const cardService = {
  getByAccount: async (accountId: number): Promise<Card[]> => {
    const response = await api.get<Card[]>(`/cards/account/${accountId}`);
    return response.data;
  },

  getMyCards: async (): Promise<Card[]> => {
    const response = await api.get<Card[]>('/cards');
    return response.data;
  },

  create: async (data: NewCardRequest): Promise<Card> => {
    const response = await api.post<Card>('/cards', data);
    return response.data;
  },

  block: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/block`);
  },

  unblock: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/unblock`);
  },

  deactivate: async (cardId: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/deactivate`);
  },

  changeLimit: async (cardId: number, cardLimit: number): Promise<void> => {
    await api.patch(`/cards/${cardId}/limit`, { cardLimit });
  },
};
