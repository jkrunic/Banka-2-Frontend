import api from './api';

/**
 * FIXME: Backend mozda jos nije implementirao ove endpointove.
 */

export interface MarginAccount {
  id: number;
  accountNumber: string;
  linkedAccountId: number;
  linkedAccountNumber: string;
  status: 'ACTIVE' | 'BLOCKED';
  initialMargin: number;
  loanValue: number;
  maintenanceMargin: number;
  bankParticipation: number;
  currency: string;
}

export interface MarginTransaction {
  id: number;
  marginAccountId: number;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  currency: string;
  createdAt: string;
  description?: string;
}

const marginService = {
  /**
   * GET /margin-accounts/my
   * Dohvata marzne racune trenutnog korisnika.
   */
  getMyAccounts: async (): Promise<MarginAccount[]> => {
    const response = await api.get('/margin-accounts/my');
    return response.data;
  },

  /**
   * POST /margin-accounts/{id}/deposit
   * Uplata na marzni racun.
   */
  deposit: async (id: number, amount: number): Promise<void> => {
    await api.post(`/margin-accounts/${id}/deposit`, { amount });
  },

  /**
   * POST /margin-accounts/{id}/withdraw
   * Isplata sa marznog racuna.
   */
  withdraw: async (id: number, amount: number): Promise<void> => {
    await api.post(`/margin-accounts/${id}/withdraw`, { amount });
  },

  /**
   * GET /margin-accounts/{id}/transactions
   * Dohvata istoriju transakcija za marzni racun.
   */
  getTransactions: async (id: number): Promise<MarginTransaction[]> => {
    const response = await api.get(`/margin-accounts/${id}/transactions`);
    return response.data;
  },
};

export default marginService;
