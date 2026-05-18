import api from './api';
import type { DividendPayoutDto } from '../types/dividend';

/**
 * Dividend API wrapper — odgovara `/dividends/**` endpoint-ima backend-a (B9).
 *
 * FE4, zadatak 7.1 — istorija primljenih dividendi po poziciji u portfoliju.
 */
const dividendService = {
  /**
   * Sve dividende ulogovanog korisnika (CLIENT ili EMPLOYEE),
   * sortirane paymentDate DESC.
   * BE endpoint: GET /dividends/my
   */
  getMyDividends: async (): Promise<DividendPayoutDto[]> => {
    const { data } = await api.get<DividendPayoutDto[]>('/dividends/my');
    return data;
  },

  /**
   * Istorija dividendi za konkretnu poziciju u portfoliju.
   * BE endpoint: GET /dividends/by-position/{portfolioId}
   */
  getDividendsByPosition: async (portfolioId: number): Promise<DividendPayoutDto[]> => {
    const { data } = await api.get<DividendPayoutDto[]>(
      `/dividends/by-position/${portfolioId}`,
    );
    return data;
  },
};

export default dividendService;
