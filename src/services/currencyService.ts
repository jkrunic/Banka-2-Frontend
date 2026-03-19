import api from './api';
import type { ExchangeRate, ExchangeRequest } from '../types/celina2';

export const currencyService = {
  getExchangeRates: async (): Promise<ExchangeRate[]> => {
    const response = await api.get<ExchangeRate[]>('/exchange-rates');
    return response.data;
  },

  convert: async (data: ExchangeRequest): Promise<{ convertedAmount: number; exchangeRate: number; fromCurrency: string; toCurrency: string }> => {
    const response = await api.get('/exchange/calculate', {
      params: {
        amount: data.amount,
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
      },
    });
    return response.data;
  },
};
