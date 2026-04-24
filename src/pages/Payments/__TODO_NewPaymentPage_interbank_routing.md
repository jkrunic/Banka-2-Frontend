# TODO — NewPaymentPage ekstenzija: inter-bank routing

**Zaduzen:** antonije3
**Spec referenca:** Celina 4, linije 368-437 (2PC plcanja)

## Šta treba uraditi

Na `NewPaymentPage.tsx`, pre submit-a proveri prve 3 cifre primaocevog
broja racuna. Ako su razlicite od naseg prefixa (222) → prebaci se u
inter-bank mode:
- umesto `paymentService.create(dto)` → `interbankPaymentService.initiatePayment(dto)`
- prikazi toast "Inter-bank transakcija u obradi..."
- poll-uj status svakih 3s dok ne bude COMMITTED ili ABORTED

## Koraci

1. Import:
   ```tsx
   import interbankPaymentService from '@/services/interbankPaymentService';
   import type { InterbankPayment } from '@/types/celina4';
   ```

2. Helper:
   ```ts
   const OUR_PREFIX = '222';
   function isInterbank(receiverAccountNumber: string): boolean {
     return receiverAccountNumber.length >= 3
       && receiverAccountNumber.substring(0, 3) !== OUR_PREFIX;
   }
   ```

3. U submit handler-u:
   ```ts
   if (isInterbank(values.receiverAccountNumber)) {
     const tx = await interbankPaymentService.initiatePayment({
       senderAccountNumber: ..., receiverAccountNumber: ...,
       receiverName: ..., amount: ..., currency: ...,
       description: ..., otpCode: ...
     });
     // Start polling loop (useState + useEffect ili jednostavna while petlja)
     pollTxStatus(tx.transactionId);
   } else {
     // postojeci intra-bank flow
   }
   ```

4. Polling komponenta / modal: prikazi fazu (INITIATED → PREPARING →
   PREPARED → COMMITTING → COMMITTED). Kad je ABORTED, prikazi
   `failureReason`.

5. Testovi `NewPaymentPage.test.tsx`:
   - Detekcija inter-bank: mock da racun pocinje sa "111" → zove
     `interbankPaymentService.initiatePayment`
   - Postojeci (intra-bank) testovi ne smeju pasti.

## Napomena

- OTP flow: VerificationModal postojeci radi i za ovaj scenario —
  pre interbankPaymentService.initiatePayment prvo otvori modal,
  uzmi otpCode, pa salji.
