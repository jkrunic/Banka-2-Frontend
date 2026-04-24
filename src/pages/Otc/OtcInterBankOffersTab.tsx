/*
================================================================================
 TODO — TAB "AKTIVNE INTER-BANK PONUDE" (na OtcOffersAndContractsPage)
 Zaduzen: ekalajdzic13322
 Spec referenca: Celina 4, linije 444-472
--------------------------------------------------------------------------------
 Rad se dodaje na postojecu OtcOffersAndContractsPage tako da ima 4 taba:
   [ Aktivne ponude (intra) ] [ Sklopljeni ugovori (intra) ]
   [ Aktivne ponude (inter)  ] [ Sklopljeni ugovori (inter) ]

 SADRZAJ OVOG FAJLA:
  - Dohvata preko interbankOtcService.listMyOffers()
  - Za svaki OtcInterbankOffer:
    - prikazi buyerBankCode vs sellerBankCode (dodaj kolonu "Banka")
    - bojenje odstupanja pricePerStock vs currentPrice (isto kao intra-bank —
      reuse `computeOfferDeviation` iz OtcOffersAndContractsPage)
    - Badge "Moj red" / "Ceka drugu stranu"
    - Akcije ako myTurn: Prihvati, Kontraponuda, Odbij — sve ka
      interbankOtcService

 NAPOMENA:
  - Kontraponuda forma je ista kao intra-bank — razmotri ekstrakciju
    CounterOfferForm komponente.
================================================================================
*/
export default function OtcInterBankOffersTab() {
  // TODO: implementirati
  return (
    <div>
      <p className="text-sm text-muted-foreground">TODO (ekalajdzic13322): implementirati aktivne inter-bank ponude.</p>
    </div>
  );
}
