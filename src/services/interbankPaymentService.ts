import api from './api';
import type { InterbankPayment, InterbankPaymentInitiateRequest } from '@/types/celina4';

/*
================================================================================
 TODO — SERVICE WRAPPER ZA INTER-BANK PLACANJA
 Zaduzen: antonije3
 Spec referenca: Celina 4, linije 368-437 (2PC placanja)
--------------------------------------------------------------------------------
 SCOPE:
  - initiatePayment() salje POST /interbank/payments/initiate
  - getStatus() poll-uje /interbank/payments/{id}
  - myHistory() prikazuje listu svih korisnikovih inter-bank placanja

 INTEGRACIJA SA POSTOJECIM PAYMENT FLOW-OM:
  - Na PaymentCreatePage-u (ili Transfers page), kad korisnik unese
    receiverAccountNumber, FE proverava prve 3 cifre. Ako su razlicite
    od naseg prefixa (222) → prebaci se u inter-bank mode i koristi
    ovaj service umesto obicnog paymentService.
  - Po prijemu transactionId-a, prikazi toast "Transakcija u obradi"
    i poll-uj status svakih ~3s dok status ne bude COMMITTED ili ABORTED.

 TODO — tipovi:
  Dodati `InterbankPaymentInitiateRequest` u celina4.ts (postoji vec).
================================================================================
*/
const interbankPaymentService = {
  /**
   * TODO — POST /interbank/payments/initiate
   * Za OTP flow: backend ce vratiti 403 sa `devOtp` ako OTP nije tacan.
   * FE koristi VerificationModal isti kao za /payments.
   */
  async initiatePayment(dto: InterbankPaymentInitiateRequest): Promise<InterbankPayment> {
    throw new Error('TODO: implementirati initiatePayment');
  },

  /**
   * TODO — GET /interbank/payments/{transactionId}
   * Poll-uj dok status nije terminal (COMMITTED/ABORTED/STUCK).
   */
  async getStatus(transactionId: string): Promise<InterbankPayment> {
    throw new Error('TODO');
  },

  /**
   * TODO — GET /interbank/payments/my
   * Istorija svih inter-bank placanja korisnika.
   */
  async myHistory(): Promise<InterbankPayment[]> {
    throw new Error('TODO');
  },
};

export default interbankPaymentService;
