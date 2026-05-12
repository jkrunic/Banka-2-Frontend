import api from './api';
import type {
  SavingsDepositDto,
  SavingsTransactionDto,
  SavingsRateDto,
  OpenDepositRequest,
  ToggleAutoRenewRequest,
  WithdrawEarlyRequest,
  UpsertRateRequest,
  PageDto,
} from '../types/savings';

interface AdminListParams {
  status?: string;
  clientId?: number;
  page?: number;
  size?: number;
}

export const savingsService = {
  openDeposit: async (dto: OpenDepositRequest): Promise<SavingsDepositDto> => {
    const { data } = await api.post<SavingsDepositDto>('/savings/deposits', dto);
    return data;
  },

  listMyDeposits: async (): Promise<SavingsDepositDto[]> => {
    const { data } = await api.get<SavingsDepositDto[]>('/savings/deposits/my');
    return data;
  },

  getDeposit: async (id: number): Promise<SavingsDepositDto> => {
    const { data } = await api.get<SavingsDepositDto>(`/savings/deposits/${id}`);
    return data;
  },

  getTransactions: async (id: number): Promise<SavingsTransactionDto[]> => {
    const { data } = await api.get<SavingsTransactionDto[]>(`/savings/deposits/${id}/transactions`);
    return data;
  },

  toggleAutoRenew: async (id: number, autoRenew: boolean): Promise<SavingsDepositDto> => {
    const payload: ToggleAutoRenewRequest = { autoRenew };
    const { data } = await api.patch<SavingsDepositDto>(`/savings/deposits/${id}/auto-renew`, payload);
    return data;
  },

  withdrawEarly: async (id: number, otpCode: string): Promise<SavingsDepositDto> => {
    const payload: WithdrawEarlyRequest = { otpCode };
    const { data } = await api.post<SavingsDepositDto>(`/savings/deposits/${id}/withdraw-early`, payload);
    return data;
  },

  getRates: async (currency?: string): Promise<SavingsRateDto[]> => {
    const { data } = await api.get<SavingsRateDto[]>('/savings/rates', {
      params: currency ? { currency } : {},
    });
    return data;
  },

  adminListAll: async (params: AdminListParams): Promise<PageDto<SavingsDepositDto>> => {
    const { data } = await api.get<PageDto<SavingsDepositDto>>('/admin/savings/deposits', { params });
    return data;
  },

  adminListAllRates: async (): Promise<SavingsRateDto[]> => {
    const { data } = await api.get<SavingsRateDto[]>('/admin/savings/rates');
    return data;
  },

  adminUpsertRate: async (dto: UpsertRateRequest): Promise<SavingsRateDto> => {
    const { data } = await api.post<SavingsRateDto>('/admin/savings/rates', dto);
    return data;
  },
};
