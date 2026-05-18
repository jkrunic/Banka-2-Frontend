import api from './api';
import type { FundStatisticsDto } from '../types/fundStatistics';

/**
 * Fund statistics API wrapper — odgovara `/funds/{id}/statistics` endpoint-u (B12).
 *
 * FE4, zadatak 7.2 — metrike performansi investicionih fondova
 * (anualizovani prinos, volatilnost, max drawdown, reward-to-variability).
 */
const fundStatisticsService = {
  /**
   * Statisticke metrike performansi jednog fonda.
   * BE endpoint: GET /funds/{fundId}/statistics
   */
  getFundStatistics: async (fundId: number): Promise<FundStatisticsDto> => {
    const { data } = await api.get<FundStatisticsDto>(`/funds/${fundId}/statistics`);
    return data;
  },
};

export default fundStatisticsService;
