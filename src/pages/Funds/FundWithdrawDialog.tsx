/*
================================================================================
 TODO — DIALOG ZA POVLACENJE NOVCA IZ FONDA
 Zaduzen: antonije3
 Spec referenca: Celina 4, linije 342-343
--------------------------------------------------------------------------------
 PROPS:
  - fundId, fundName, myPosition (ClientFundPosition) — current user-ova pozicija
  - open, onClose, onSuccess

 FORMA:
  - "povuci iznos" (positive, <= position.currentValue) ili checkbox
    "povuci celu poziciju" (amount = undefined u requestu)
  - destinationAccountId:
      - Klijent: njegov racun
      - Supervizor (banka): bankin racun

 BITNO (spec linija 261):
  Ako server vrati transakciju sa status=PENDING, prikazi poruku da
  ce isplata biti obradjena naknadno (fond nema dovoljno RSD).

 POSLE SUBMIT:
  - investmentFundService.withdraw(fundId, dto)
  - Uspesno status=COMPLETED → toast "Povuceno X RSD"
  - Uspesno status=PENDING   → toast "Povlacenje ce biti obradjeno kad
    fond proda hartije"
  - Greska → toast.error
================================================================================
*/
export default function FundWithdrawDialog() {
  // TODO: implementirati
  return null;
}
