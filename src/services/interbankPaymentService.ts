import api from './api';
import type { InterbankPayment, InterbankPaymentInitiateRequest } from '@/types/celina4';

/*
================================================================================
 INTER-BANK PLACANJA — FE SERVICE WRAPPER (TEMP)
--------------------------------------------------------------------------------
 Trenutni BE (swagger) nema posebne interbank endpoint-e (nema /interbank-tx).
 Sve ide kroz standardne payment rute:

  - POST /api/payments          -> PaymentResponseDto (status: PENDING/PROCESSING/...)
  - GET  /api/payments/{id}     -> PaymentResponseDto (za polling statusa)
  - GET  /api/payments?page&size -> Page<PaymentListItemDto> (istorija/lista)

 Ovaj servis i dalje izlaže "InterbankPayment" tip (celina4) da NewPaymentPage
 zadrži overlay/poll UX, ali se podaci mapiraju iz standardnih payment DTO-a.
================================================================================
*/

type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

type PaymentResponseDto = {
  id: number;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee?: number;
  currency: string;
  recipientName?: string;
  description?: string;
  status: PaymentStatus;
  // BE moze (opciono) da posalje detaljan razlog odbacanja/zaglavljivanja kroz
  // jedno od ovih polja. FE ih probacuje kroz `pickFailureReason()` u prioritetu.
  failureReason?: string;
  rejectionReason?: string;
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
  // Populated for interbank payments: the live InterbankTransactionStatus from the
  // 2PC record. When present, takes precedence over the coarse PaymentStatus mapping.
  sagaPhase?: string | null;
};

type PaymentListItemDto = {
  id: number;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee?: number;
  currency: string;
  description?: string;
  recipientName?: string;
  status: PaymentStatus;
  failureReason?: string;
  rejectionReason?: string;
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
};

type PageDto<T> = {
  content: T[];
};

/**
 * Spec Celina 5 (Nova): "ABORTED prikazi razlog (npr. 'Racun primaoca neaktivan')".
 * BE error code → covecna srpska poruka. Ako BE posalje konkretan failureReason
 * tekst (kroz polje `failureReason` / `rejectionReason` / `errorMessage`), FE ga
 * propusta direktno. Ako salje samo `errorCode` (npr. "RECIPIENT_INACTIVE"),
 * mapiramo na lokalizovanu poruku. Ako nema nista, vraca generican fallback.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  RECIPIENT_INACTIVE: 'Racun primaoca je neaktivan.',
  RECIPIENT_NOT_FOUND: 'Racun primaoca ne postoji u bazi banke primaoca.',
  RECIPIENT_BLOCKED: 'Racun primaoca je blokiran.',
  INSUFFICIENT_FUNDS: 'Nedovoljno sredstava na racunu posiljaoca.',
  CURRENCY_MISMATCH: 'Konverzija valute nije moguca u ovom trenutku.',
  AMOUNT_LIMIT_EXCEEDED: 'Iznos prelazi dozvoljeni limit (dnevni ili mesecni).',
  PARTNER_BANK_UNREACHABLE: 'Banka primaoca nije dostupna. Pokusajte kasnije.',
  PARTNER_BANK_TIMEOUT: 'Banka primaoca nije odgovorila u predvidjenom roku.',
  PROTOCOL_VERSION_MISMATCH: 'Banke koriste razlicite verzije protokola za medjubankarsku komunikaciju.',
  AUTHENTICATION_FAILED: 'Autentifikacija medjubankarske poruke nije uspela.',
  INVALID_AMOUNT: 'Iznos transakcije nije validan.',
  INVALID_CURRENCY: 'Valuta transakcije nije podrzana.',
  ACCOUNT_CLOSED: 'Racun je zatvoren.',
  COMPLIANCE_REJECTED: 'Transakcija je odbacena zbog regulatornih razloga.',
  RATE_LIMIT_EXCEEDED: 'Premnog zahteva u kratkom periodu. Sacekajte malo i pokusajte ponovo.',
  INTERNAL_ERROR: 'Greska na strani banke primaoca.',
};

export function pickFailureReason(
  raw: { failureReason?: string; rejectionReason?: string; errorMessage?: string; errorCode?: string } | null | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  // 1. Konkretna BE poruka (najprioritetnija — BE zna detalje)
  const direct = raw.failureReason ?? raw.rejectionReason ?? raw.errorMessage;
  if (direct && direct.trim().length > 0) {
    return direct;
  }
  // 2. Mapiran error code
  if (raw.errorCode && ERROR_CODE_MESSAGES[raw.errorCode]) {
    return ERROR_CODE_MESSAGES[raw.errorCode];
  }
  // 3. Fallback
  return fallback;
}

// Direct mapping from backend InterbankTransactionStatus enum values to FE type.
// Used when BE returns sagaPhase from a linked InterbankTransaction record.
const SAGA_PHASE_MAP: Record<string, InterbankPayment['status']> = {
  PREPARING:   'PREPARING',
  PREPARED:    'PREPARED',
  COMMITTED:   'COMMITTED',
  ROLLED_BACK: 'ABORTED',
  STUCK:       'STUCK',
};

function mapPaymentStatus(payment: { status: PaymentStatus; sagaPhase?: string | null; failureReason?: string; rejectionReason?: string; errorMessage?: string; errorCode?: string }): { status: InterbankPayment['status']; failureReason?: string } {
  // Prefer live SAGA phase from InterbankTransaction over coarse PaymentStatus
  if (payment.sagaPhase) {
    const mapped = SAGA_PHASE_MAP[payment.sagaPhase];
    if (mapped) {
      const isFailure = mapped === 'ABORTED' || mapped === 'STUCK';
      return {
        status: mapped,
        failureReason: isFailure ? pickFailureReason(payment, 'Interbank transakcija nije uspela.') : undefined,
      };
    }
  }

  switch (payment.status) {
    case 'PENDING':
      return { status: 'INITIATED' };
    case 'PROCESSING':
      return { status: 'COMMITTING' };
    case 'COMPLETED':
      return { status: 'COMMITTED' };
    case 'REJECTED':
      return {
        status: 'ABORTED',
        failureReason: pickFailureReason(payment, 'Banka primaoca je odbacila transakciju.'),
      };
    case 'CANCELLED':
      return {
        status: 'ABORTED',
        failureReason: pickFailureReason(payment, 'Transakcija je otkazana.'),
      };
    default:
      return {
        status: 'STUCK',
        failureReason: pickFailureReason(payment, `Nepoznat status transakcije: ${payment.status}`),
      };
  }
}

function mapPaymentToInterbank(payment: PaymentResponseDto): InterbankPayment {
  const mapped = mapPaymentStatus(payment);
  return {
    id: payment.id,
    transactionId: String(payment.id),
    status: mapped.status,
    senderAccountNumber: payment.fromAccount,
    receiverAccountNumber: payment.toAccount,
    amount: payment.amount,
    currency: payment.currency,
    exchangeRate: null,
    convertedAmount: null,
    convertedCurrency: null,
    commissionAmount: payment.fee ?? null,
    createdAt: payment.createdAt,
    preparedAt: null,
    committedAt: null,
    abortedAt: null,
    failureReason: mapped.failureReason ?? null,
  };
}

function mapPaymentListItemToInterbank(item: PaymentListItemDto): InterbankPayment {
  const mapped = mapPaymentStatus(item);
  return {
    id: item.id,
    transactionId: String(item.id),
    status: mapped.status,
    senderAccountNumber: item.fromAccount,
    receiverAccountNumber: item.toAccount,
    amount: item.amount,
    currency: item.currency,
    exchangeRate: null,
    convertedAmount: null,
    convertedCurrency: null,
    commissionAmount: item.fee ?? null,
    createdAt: item.createdAt,
    preparedAt: null,
    committedAt: null,
    abortedAt: null,
    failureReason: mapped.failureReason ?? null,
  };
}

const interbankPaymentService = {
  async initiatePayment(dto: InterbankPaymentInitiateRequest): Promise<InterbankPayment> {
    const extendedDto = dto as InterbankPaymentInitiateRequest & {
      paymentCode?: string;
      paymentPurpose?: string;
      referenceNumber?: string;
    };

    const payload = {
      fromAccount: dto.senderAccountNumber,
      toAccount: dto.receiverAccountNumber,
      amount: dto.amount,
      paymentCode: extendedDto.paymentCode ?? '289',
      referenceNumber: extendedDto.referenceNumber || undefined,
      description: extendedDto.paymentPurpose ?? dto.description ?? 'Inter-bank payment',
      recipientName: dto.receiverName,
      otpCode: dto.otpCode || '',
    };

    const response = await api.post<PaymentResponseDto>('/payments', payload);
    return mapPaymentToInterbank(response.data);
  },

  async getStatus(transactionId: string): Promise<InterbankPayment> {
    const paymentId = Number(transactionId);
    if (!Number.isFinite(paymentId)) {
      throw new Error(`Invalid payment id: ${transactionId}`);
    }

    const response = await api.get<PaymentResponseDto>(`/payments/${paymentId}`);
    return mapPaymentToInterbank(response.data);
  },

  async myHistory(): Promise<InterbankPayment[]> {
    const params = new URLSearchParams();
    params.append('page', '0');
    params.append('size', '50');

    const response = await api.get<PageDto<PaymentListItemDto>>('/payments', { params });
    return response.data.content.map(mapPaymentListItemToInterbank);
  },
};

export default interbankPaymentService;
