# TODO — OtcOffersAndContractsPage inter-bank ekstenzija

**Zaduzen:** ekalajdzic13322
**Spec referenca:** Celina 4, linije 444-519

## Šta treba uraditi

1. Promeniti `type Tab = 'offers' | 'contracts';` u:
   ```ts
   type Tab =
     | 'offers-local'
     | 'contracts-local'
     | 'offers-remote'
     | 'contracts-remote';
   ```

2. Dodati TabsTriggers za nova 2 taba (render `<OtcInterBankOffersTab />` i
   `<OtcInterBankContractsTab />`).

3. `computeOfferDeviation()` vec postoji — reuse za inter-bank offers
   (ucitaj `listingPrice` iz `OtcInterbankOffer.currentPrice`).

4. Testovi:
   - Prelazak na 'offers-remote' zove `interbankOtcService.listMyOffers()`.
   - Prelazak na 'contracts-remote' zove `interbankOtcService.listMyContracts()`.
