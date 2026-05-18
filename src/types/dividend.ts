// ============================================================
// FE4 — Istorija dividendi u portfoliju (zadatak 7.1, Developer: Jovan Krunic)
//
// Tipovi odgovaraju B9 backend ugovoru (DividendController / DividendPayoutDto).
// ============================================================

/** Vlasnik koji je primio dividendu. */
export type DividendOwnerType = 'CLIENT' | 'EMPLOYEE';

/**
 * Jedna isplacena dividenda — odgovor sa GET /dividends/my i
 * GET /dividends/by-position/{portfolioId}. Mapira se 1:1 iz BE DividendPayoutDto.
 */
export interface DividendPayoutDto {
  id: number;
  ownerId: number;
  ownerType: DividendOwnerType;
  stockListingId: number;
  stockTicker: string;
  quantity: number;
  /** Cena akcije na dan obracuna. */
  priceOnDate: number;
  /** Kvartalni prinos (godisnji dividendYield / 4). */
  dividendYieldRate: number;
  /** Bruto iznos pre poreza. */
  grossAmount: number;
  /** Iznos poreza po odbitku (0 za EMPLOYEE — vidi taxExempt). */
  tax: number;
  /** Neto iznos knjizen na racun. */
  netAmount: number;
  creditedAccountId: number;
  currencyCode: string;
  /** ISO datum isplate (YYYY-MM-DD). */
  paymentDate: string;
  /** true za EMPLOYEE (aktuar drzi akcije u ime banke — bez 15% poreza). */
  taxExempt: boolean;
  /** ISO datetime kreiranja zapisa. */
  createdAt: string;
}
