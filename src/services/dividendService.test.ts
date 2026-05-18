import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockujem api modul pre dividend service import-a
vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import dividendService from './dividendService';
import api from './api';
import type { DividendPayoutDto } from '../types/dividend';

const mockGet = api.get as ReturnType<typeof vi.fn>;

const sampleDividend: DividendPayoutDto = {
  id: 1,
  ownerId: 42,
  ownerType: 'CLIENT',
  stockListingId: 7,
  stockTicker: 'AAPL',
  quantity: 50,
  priceOnDate: 200,
  dividendYieldRate: 0.005,
  grossAmount: 50,
  tax: 7.5,
  netAmount: 42.5,
  creditedAccountId: 265,
  currencyCode: 'USD',
  paymentDate: '2026-03-31',
  taxExempt: false,
  createdAt: '2026-03-31T17:00:00',
};

describe('dividendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyDividends', () => {
    it('salje GET /dividends/my', async () => {
      mockGet.mockResolvedValue({ data: [] });

      await dividendService.getMyDividends();

      expect(mockGet).toHaveBeenCalledWith('/dividends/my');
    });

    it('vraca listu dividendi iz BE odgovora', async () => {
      mockGet.mockResolvedValue({ data: [sampleDividend] });

      const result = await dividendService.getMyDividends();

      expect(result).toEqual([sampleDividend]);
    });

    it('propagira gresku ako api odbije zahtev', async () => {
      mockGet.mockRejectedValue(new Error('network error'));

      await expect(dividendService.getMyDividends()).rejects.toThrow('network error');
    });
  });

  describe('getDividendsByPosition', () => {
    it('salje GET /dividends/by-position/{portfolioId}', async () => {
      mockGet.mockResolvedValue({ data: [] });

      await dividendService.getDividendsByPosition(99);

      expect(mockGet).toHaveBeenCalledWith('/dividends/by-position/99');
    });

    it('vraca istoriju dividendi za poziciju iz BE odgovora', async () => {
      mockGet.mockResolvedValue({ data: [sampleDividend] });

      const result = await dividendService.getDividendsByPosition(7);

      expect(result).toEqual([sampleDividend]);
    });

    it('propagira gresku ako api odbije zahtev', async () => {
      mockGet.mockRejectedValue(new Error('403 forbidden'));

      await expect(dividendService.getDividendsByPosition(7)).rejects.toThrow(
        '403 forbidden',
      );
    });
  });
});
