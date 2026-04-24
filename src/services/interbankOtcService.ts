import api from './api';
import type {
  OtcInterbankListing,
  OtcInterbankOffer,
  CreateOtcInterbankOfferRequest,
  CounterOtcInterbankOfferRequest,
  OtcInterbankOfferStatus,
} from '@/types/celina4';

/*
================================================================================
 TODO — SERVICE WRAPPER ZA OTC INTER-BANK (PREGOVARANJE + SAGA)
 Zaduzen: ekalajdzic13322
 Spec referenca: Celina 4, linije 438-519
--------------------------------------------------------------------------------
 Paralelno sa intra-bank `otcService.ts`, ali gadja `/interbank/otc/**`
 endpointe. Koristi se na tabu "Iz drugih banaka" na OtcTrgovinaPage i
 OtcOffersAndContractsPage.

 Key endpointi:
   GET   /interbank/otc/listings
   POST  /interbank/otc/offers
   GET   /interbank/otc/offers/my
   PATCH /interbank/otc/offers/{offerId}/counter
   PATCH /interbank/otc/offers/{offerId}/decline
   PATCH /interbank/otc/offers/{offerId}/accept?accountId=X
   GET   /interbank/otc/contracts/my?status=...
   POST  /interbank/otc/contracts/{contractId}/exercise?buyerAccountId=X
================================================================================
*/
const interbankOtcService = {
  /** TODO — GET /interbank/otc/listings */
  async listRemoteListings(): Promise<OtcInterbankListing[]> {
    throw new Error('TODO');
  },

  /** TODO — POST /interbank/otc/offers */
  async createOffer(dto: CreateOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    throw new Error('TODO');
  },

  /** TODO — GET /interbank/otc/offers/my */
  async listMyOffers(): Promise<OtcInterbankOffer[]> {
    throw new Error('TODO');
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/counter */
  async counterOffer(offerId: string, dto: CounterOtcInterbankOfferRequest): Promise<OtcInterbankOffer> {
    throw new Error('TODO');
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/decline */
  async declineOffer(offerId: string): Promise<OtcInterbankOffer> {
    throw new Error('TODO');
  },

  /** TODO — PATCH /interbank/otc/offers/{offerId}/accept?accountId=X */
  async acceptOffer(offerId: string, accountId: number): Promise<OtcInterbankOffer> {
    throw new Error('TODO');
  },

  /** TODO — GET /interbank/otc/contracts/my[?status=...] */
  async listMyContracts(status?: OtcInterbankOfferStatus | 'ALL'): Promise<unknown[]> {
    throw new Error('TODO — vrati tip posle potvrde sa BE tim-om (moze da se proširi OtcContract iz celina3.ts sa buyerBankCode/sellerBankCode)');
  },

  /** TODO — POST /interbank/otc/contracts/{contractId}/exercise?buyerAccountId=X */
  async exerciseContract(contractId: string, buyerAccountId: number): Promise<unknown> {
    throw new Error('TODO');
  },
};

export default interbankOtcService;
