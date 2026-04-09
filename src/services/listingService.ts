import api from './api';
import type { Listing, ListingDailyPrice, OptionChain, PaginatedResponse } from '../types/celina3';

const listingService = {
  /**
   * GET /listings?type=STOCK&search=&page=0&size=20
   * Dohvata stranicu hartija od vrednosti filtrirano po tipu.
   */
  getAll: async (
    type: string = 'STOCK',
    search: string = '',
    page: number = 0,
    size: number = 20,
    filters?: {
      exchangePrefix?: string;
      priceMin?: number;
      priceMax?: number;
      settlementDateFrom?: string;
      settlementDateTo?: string;
    }
  ): Promise<PaginatedResponse<Listing>> => {
    const params: Record<string, unknown> = { type, search, page, size };
    if (filters?.exchangePrefix) params.exchangePrefix = filters.exchangePrefix;
    if (filters?.priceMin != null) params.priceMin = filters.priceMin;
    if (filters?.priceMax != null) params.priceMax = filters.priceMax;
    if (filters?.settlementDateFrom) params.settlementDateFrom = filters.settlementDateFrom;
    if (filters?.settlementDateTo) params.settlementDateTo = filters.settlementDateTo;
    const response = await api.get('/listings', { params });
    return response.data;
  },

  /**
   * GET /listings/{id}
   * Dohvata detalje jedne hartije sa izvedenim podacima.
   */
  getById: async (id: number): Promise<Listing> => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  /**
   * GET /listings/{id}/history?period=MONTH
   * Dohvata istorijske cene za grafik.
   * Periodi: DAY, WEEK, MONTH, YEAR, FIVE_YEARS, ALL
   */
  getHistory: async (id: number, period: string = 'MONTH'): Promise<ListingDailyPrice[]> => {
    const response = await api.get(`/listings/${id}/history`, {
      params: { period },
    });
    return response.data;
  },

  /**
   * POST /listings/refresh
   * Rucno osvezavanje cena hartija.
   */
  refresh: async (): Promise<void> => {
    await api.post('/listings/refresh');
  },

  /**
   * GET /options?stockListingId={id}
   * Dohvata lanac opcija za akciju.
   */
  getOptions: async (listingId: number): Promise<OptionChain[]> => {
    const response = await api.get('/options', {
      params: { stockListingId: listingId },
    });
    return response.data;
  },

  /**
   * POST /options/{id}/exercise
   * Iskoristava opciju iz portfolija.
   */
  exerciseOption: async (optionId: number): Promise<void> => {
    await api.post(`/options/${optionId}/exercise`);
  },
};

export default listingService;
