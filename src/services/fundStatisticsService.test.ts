import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockujem api modul pre fund statistics service import-a
vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import fundStatisticsService from './fundStatisticsService';
import api from './api';
import type { FundStatisticsDto } from '../types/fundStatistics';

const mockGet = api.get as ReturnType<typeof vi.fn>;

const sampleStats: FundStatisticsDto = {
  fundId: 7,
  fundName: 'Alpha Growth',
  snapshotCount: 90,
  annualizedReturnPercent: 12.34,
  volatilityPercent: 4.2,
  maxDrawdownPercent: -8.5,
  rewardToVariabilityRatio: 2.94,
  sufficientHistory: true,
};

describe('fundStatisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFundStatistics', () => {
    it('šalje GET /funds/{fundId}/statistics', async () => {
      mockGet.mockResolvedValue({ data: sampleStats });

      await fundStatisticsService.getFundStatistics(7);

      expect(mockGet).toHaveBeenCalledWith('/funds/7/statistics');
    });

    it('vraća FundStatisticsDto iz BE odgovora', async () => {
      mockGet.mockResolvedValue({ data: sampleStats });

      const result = await fundStatisticsService.getFundStatistics(7);

      expect(result).toEqual(sampleStats);
    });

    it('podržava DTO sa null metrikama (nedovoljno istorije)', async () => {
      const insufficient: FundStatisticsDto = {
        fundId: 9,
        fundName: 'Novi fond',
        snapshotCount: 5,
        annualizedReturnPercent: null,
        volatilityPercent: null,
        maxDrawdownPercent: null,
        rewardToVariabilityRatio: null,
        sufficientHistory: false,
      };
      mockGet.mockResolvedValue({ data: insufficient });

      const result = await fundStatisticsService.getFundStatistics(9);

      expect(result.sufficientHistory).toBe(false);
      expect(result.annualizedReturnPercent).toBeNull();
    });

    it('propagira grešku ako api odbije zahtev (npr. 404 dok B12 nije aktivan)', async () => {
      mockGet.mockRejectedValue(new Error('404 not found'));

      await expect(fundStatisticsService.getFundStatistics(7)).rejects.toThrow(
        '404 not found',
      );
    });
  });
});
