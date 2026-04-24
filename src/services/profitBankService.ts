import api from './api';
import type { ActuaryProfit } from '@/types/celina4';
import type { ClientFundPosition } from '@/types/celina4';

/*
================================================================================
 TODO — SERVICE WRAPPER ZA PORTAL "PROFIT BANKE"
 Zaduzen: sssmarta
 Spec referenca: Celina 4, linije 353-364
--------------------------------------------------------------------------------
 Samo za supervizore. Dva endpointa:
   GET /profit-bank/actuary-performance  — spisak aktuara sa profitom
   GET /profit-bank/fund-positions       — bankine pozicije u fondovima

 Napomena za tim:
  - Ako ovo nije u scope-u za KT3, server moze vraciti 501 / 403;
    handler treba graceful error.
================================================================================
*/
const profitBankService = {
  /**
   * TODO — GET /profit-bank/actuary-performance
   * Povlaci spisak svih aktuara + njihov profit u RSD (+ pozicija).
   */
  async listActuaryPerformance(): Promise<ActuaryProfit[]> {
    throw new Error('TODO: implementirati profitBankService.listActuaryPerformance');
  },

  /**
   * TODO — GET /profit-bank/fund-positions
   * Fondovi u kojima banka ima udele (ClientFundPosition sa userRole=BANK).
   */
  async listBankFundPositions(): Promise<ClientFundPosition[]> {
    throw new Error('TODO');
  },
};

export default profitBankService;
