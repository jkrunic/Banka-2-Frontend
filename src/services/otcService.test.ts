import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import otcService from './otcService';

vi.mock('./api');
const mockedApi = vi.mocked(api);

describe('otcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDiscovery', () => {
    it('treba da vrati listu javnih OTC ponuda', async () => {
      const listings = [
        { sellerId: 1, sellerName: 'Stefan', listingId: 10, listingTicker: 'AAPL', currentPrice: 195, availableQuantity: 25 },
      ];
      mockedApi.get.mockResolvedValue({ data: listings });

      const result = await otcService.listDiscovery();

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/listings');
      expect(result).toEqual(listings);
    });

    it('propagira greske iz API-ja', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network down'));
      await expect(otcService.listDiscovery()).rejects.toThrow('Network down');
    });
  });

  describe('listMyActiveOffers', () => {
    it('treba da vrati moje aktivne pregovore', async () => {
      const offers = [{ id: 1, status: 'ACTIVE', amount: 5, pricePerStock: 200, premium: 100 }];
      mockedApi.get.mockResolvedValue({ data: offers });

      const result = await otcService.listMyActiveOffers();

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/offers/active');
      expect(result).toEqual(offers);
    });
  });

  describe('createOffer', () => {
    it('treba da posalje POST sa request payload-om', async () => {
      const request = { listingId: 10, amount: 5, pricePerStock: 200, settlementDate: '2026-12-31', premium: 75 };
      const created = { id: 99, ...request, status: 'ACTIVE' };
      mockedApi.post.mockResolvedValue({ data: created });

      const result = await otcService.createOffer(request);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/offers', request);
      expect(result).toEqual(created);
    });
  });

  describe('counterOffer', () => {
    it('treba da posalje POST na counter rutu sa offer ID-om', async () => {
      const request = { amount: 4, pricePerStock: 220, settlementDate: '2026-12-31', premium: 90 };
      const updated = { id: 99, status: 'ACTIVE', ...request };
      mockedApi.post.mockResolvedValue({ data: updated });

      const result = await otcService.counterOffer(99, request);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/offers/99/counter', request);
      expect(result).toEqual(updated);
    });
  });

  describe('acceptOffer', () => {
    it('treba da prihvati ponudu bez buyerAccountId', async () => {
      const accepted = { id: 99, status: 'ACCEPTED' };
      mockedApi.post.mockResolvedValue({ data: accepted });

      await otcService.acceptOffer(99);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/offers/99/accept', null, {
        params: undefined,
      });
    });

    it('treba da prosledi buyerAccountId kao query param', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await otcService.acceptOffer(99, 5);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/offers/99/accept', null, {
        params: { buyerAccountId: 5 },
      });
    });
  });

  describe('declineOffer', () => {
    it('treba da posalje POST na decline rutu', async () => {
      mockedApi.post.mockResolvedValue({ data: { id: 99, status: 'DECLINED' } });

      const result = await otcService.declineOffer(99);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/offers/99/decline');
      expect(result.status).toBe('DECLINED');
    });
  });

  describe('listMyContracts', () => {
    it('vraca sve ugovore bez statusa kad nije naveden', async () => {
      const contracts = [{ id: 1, status: 'ACTIVE' }];
      mockedApi.get.mockResolvedValue({ data: contracts });

      const result = await otcService.listMyContracts();

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/contracts', {
        params: undefined,
      });
      expect(result).toEqual(contracts);
    });

    it('prosledjuje status filter kao query param', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await otcService.listMyContracts('ACTIVE');

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/contracts', {
        params: { status: 'ACTIVE' },
      });
    });

    it('prosledjuje "ALL" kao status', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await otcService.listMyContracts('ALL');

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/contracts', {
        params: { status: 'ALL' },
      });
    });
  });

  describe('exerciseContract', () => {
    it('iskoriscava ugovor bez buyerAccountId', async () => {
      mockedApi.post.mockResolvedValue({ data: { id: 1, status: 'EXERCISED' } });

      const result = await otcService.exerciseContract(1);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/contracts/1/exercise', null, {
        params: undefined,
      });
      expect(result.status).toBe('EXERCISED');
    });

    it('iskoriscava ugovor sa buyerAccountId', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });

      await otcService.exerciseContract(1, 7);

      expect(mockedApi.post).toHaveBeenCalledWith('/otc/contracts/1/exercise', null, {
        params: { buyerAccountId: 7 },
      });
    });

    it('propagira greske', async () => {
      mockedApi.post.mockRejectedValue(new Error('Settlement date passed'));
      await expect(otcService.exerciseContract(1)).rejects.toThrow('Settlement date passed');
    });
  });

  // --- FE4 (7.3) — istorija OTC pregovora ---

  describe('getNegotiationHistory', () => {
    const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 };

    it('salje GET /otc/negotiation-history sa filterima kao query params', async () => {
      mockedApi.get.mockResolvedValue({ data: emptyPage });

      await otcService.getNegotiationHistory({ status: 'ACCEPTED', page: 1, size: 20 });

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/negotiation-history', {
        params: { status: 'ACCEPTED', page: 1, size: 20 },
      });
    });

    it('salje prazan params objekat kad filteri nisu prosledjeni', async () => {
      mockedApi.get.mockResolvedValue({ data: emptyPage });

      await otcService.getNegotiationHistory();

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/negotiation-history', { params: {} });
    });

    it('vraca paginiran odgovor iz API-ja', async () => {
      const page = {
        content: [{ id: 1, negotiationId: 5 }],
        totalElements: 1, totalPages: 1, number: 0, size: 20,
      };
      mockedApi.get.mockResolvedValue({ data: page });

      const result = await otcService.getNegotiationHistory();

      expect(result).toEqual(page);
    });

    it('propagira gresku (npr. 404 dok B10 nije aktivan)', async () => {
      mockedApi.get.mockRejectedValue(new Error('404 not found'));
      await expect(otcService.getNegotiationHistory()).rejects.toThrow('404 not found');
    });
  });

  describe('getNegotiationHistoryById', () => {
    it('salje GET /otc/negotiation-history/{negotiationId}', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      await otcService.getNegotiationHistoryById(42);

      expect(mockedApi.get).toHaveBeenCalledWith('/otc/negotiation-history/42');
    });

    it('vraca lanac kontraponuda iz API-ja', async () => {
      const chain = [
        { id: 1, negotiationId: 42 },
        { id: 2, negotiationId: 42 },
      ];
      mockedApi.get.mockResolvedValue({ data: chain });

      const result = await otcService.getNegotiationHistoryById(42);

      expect(result).toEqual(chain);
    });
  });
});
