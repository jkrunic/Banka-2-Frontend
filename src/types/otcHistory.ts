// ============================================================
// FE4 — Istorija OTC pregovora (zadatak 7.3, Developer: Jovan Krunic)
//
// Tipovi odgovaraju B10 backend ugovoru
// (OtcNegotiationHistoryDto / /otc/negotiation-history endpoint-i).
// ============================================================

/**
 * Jedan zapis u istoriji OTC pregovora — snimak jedne iteracije pregovora
 * (inicijalna ponuda ili kontraponuda). Mapira se 1:1 iz BE OtcNegotiationHistoryDto.
 */
export interface OtcNegotiationHistoryDto {
  id: number;
  /** ID originalne ponude (OtcOffer) na koju se zapis odnosi. */
  negotiationId: number;
  /** Kolicina akcija u toj iteraciji pregovora. */
  quantity: number;
  /** Cena po akciji u toj iteraciji. */
  pricePerShare: number;
  /** Premija opcije u toj iteraciji. */
  premium: number;
  /** ISO datum izmirenja koji je vazio u toj iteraciji. */
  settlementDate: string;
  /** Status ponude u trenutku zapisa (ACTIVE, ACCEPTED, DECLINED...). */
  status: string;
  /** ID korisnika koji je izvrsio izmenu. */
  modifiedById: number;
  /** Puno ime korisnika koji je izvrsio izmenu (snapshot). */
  modifiedByName: string;
  /** ISO datetime kada je zapis nastao. */
  createdAt: string;
}

/** Spring `Page` omotac za paginiran odgovor istorije pregovora. */
export interface OtcNegotiationHistoryPage {
  content: OtcNegotiationHistoryDto[];
  totalElements: number;
  totalPages: number;
  /** Trenutna strana (0-bazirano). */
  number: number;
  size: number;
}

/** Query parametri za GET /otc/negotiation-history. */
export interface OtcNegotiationHistoryFilters {
  status?: string;
  /** Filter po korisniku koji je izvrsio izmenu (druga strana u pregovoru). */
  modifiedById?: number;
  /** ISO datetime — pocetak opsega. */
  from?: string;
  /** ISO datetime — kraj opsega. */
  to?: string;
  page?: number;
  size?: number;
}
