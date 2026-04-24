/*
================================================================================
 TODO — TAB "IZ DRUGIH BANAKA" NA OtcTrgovinaPage
 Zaduzen: ekalajdzic13322
 Spec referenca: Celina 4, linije 440-444 (Dobavljanje OTC ponuda druge banke)
--------------------------------------------------------------------------------
 OVO NIJE STANDALONE ROUTE — renderuje se unutar OtcTrgovinaPage kao
 dodatni tab. Struktura:

   Tabs: [ Iz nase banke (postojeci) ] [ Iz drugih banaka (novi) ]

 SADRZAJ OVOG TAB-A:
  - Poziva interbankOtcService.listRemoteListings()
  - Prikazuje listu OtcInterbankListing-a
  - Kolone: ticker, banka prodavca, prodavac, cena, dostupno, akcije
  - Klik "Napravi ponudu" → otvara formu istu kao intra-bank (quantity,
    pricePerStock, premium, settlementDate). Submit -> interbankOtcService.createOffer.

 BITNO — permisije:
  - Klijenti vide ponude drugih KLIJENATA (ne aktuara).
  - Aktuari vide ponude drugih AKTUARA (supervizor-supervizor trgovina).
  - BE filtrira — FE samo prikazuje sta dobije.

 UPUTSTVO ZA INTEGRACIJU:
  U OtcTrgovinaPage.tsx (postojeci) dodaj:
    - TabsTrigger "Iz drugih banaka"
    - TabsContent koji renderuje <OtcInterBankDiscoveryTab />
  Ne menjaj ostale tabove.

 REFRESH:
  Spec kaze "vremenskom intervalu ili kada neko udje na stranicu" —
  koristi useEffect koji salje zahtev pri mountu + polling dugme "Osvezi".
================================================================================
*/
export default function OtcInterBankDiscoveryTab() {
  // TODO: implementirati
  return (
    <div>
      <p className="text-sm text-muted-foreground">TODO (ekalajdzic13322): implementirati prikaz ponuda iz drugih banaka.</p>
    </div>
  );
}
