/*
================================================================================
 TODO — TAB "SKLOPLJENI INTER-BANK UGOVORI" (SAGA EXERCISE)
 Zaduzen: ekalajdzic13322
 Spec referenca: Celina 4, linije 473-519 (SAGA + Exercise)
--------------------------------------------------------------------------------
 Sadrzaj: lista sklopljenih inter-bank ugovora (po statusu: ACTIVE, EXERCISED, EXPIRED).

 AKCIJA "ISKORISTI" (samo za ACTIVE koje sam kupac + settlementDate > today):
   - Klikom se otvara Dialog sa pregledom (strike * qty = total cost,
     trenutna cena, profit projekcija, izbor racuna za placanje).
   - Potvrdom se poziva interbankOtcService.exerciseContract(contractId, accountId).
   - Backend kreira InterbankTransaction sa type=OTC, krece kroz SAGA.
   - FE treba da prikaze modal sa progresom:
       "1. Rezervacija sredstava..." ✓
       "2. Rezervacija hartija u drugoj banci..." ✓
       "3. Transfer sredstava..." ✓
       "4. Prenos vlasnistva..." ✓
       "5. Finalizacija..." ✓
     Implementacija: poll-uj GET /interbank/payments/{txId} (ili poseban
     OTC status endpoint) dok status ne bude COMMITTED ili ABORTED.

 PROGRES FAZE:
  BE treba da vrati "currentPhase" field u tx response (DODATI u
  InterbankTransaction DTO kao derived field). Ako BE nije jos pripremio
  to, fallback: prikazi samo "Izvrsavanje u toku..." spinner.

 INTEGRACIJA:
  OtcOffersAndContractsPage ce renderovati ovaj tab kad se klikne
  na "Sklopljeni (inter-bank)".
================================================================================
*/
export default function OtcInterBankContractsTab() {
  // TODO: implementirati
  return (
    <div>
      <p className="text-sm text-muted-foreground">TODO (ekalajdzic13322): implementirati inter-bank ugovore sa SAGA exercise flow-om.</p>
    </div>
  );
}
