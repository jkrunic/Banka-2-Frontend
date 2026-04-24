/*
================================================================================
 TODO — DETALJAN PRIKAZ JEDNOG FONDA
 Zaduzen: jkrunic
 Spec referenca: Celina 4, linije 306-316 (Detaljan prikaz fonda)
--------------------------------------------------------------------------------
 ROUTE: /funds/:id

 PRIKAZ:
  1. Zaglavlje: naziv, opis, menadzer
  2. 4 Card tile-a (KPIs): Vrednost fonda, Likvidnost, Profit,
     Minimalni ulog
  3. Sekcija "Hartije u fondu":
     Tabela: Ticker, Price, Change, Volume, InitialMarginCost,
             AcquisitionDate
     - Supervizor (owner) vidi dugme "Prodaj" pored svake hartije
       → vodi na CreateOrderPage sa pre-popunjenim SELL + userRole=FUND
  4. Sekcija "Performanse":
     - Grafik (Recharts LineChart) sa vrednoscu fonda u RSD po datumu
     - Toggle: mesec / kvartal / godina (menja from/to u getPerformance)
  5. Akcije na dnu:
     - Klijent: "Uplati u fond" + "Povuci iz fonda" (ako ima poziciju)
     - Supervizor: ovi isti + "Uplati u ime banke"

 LOGIKA:
  - useEffect -> fetch service.get(id), service.getPerformance(id, ...)
  - Parallel dispatch (Promise.all)
  - Error: navigate to /funds sa toast-om
  - Loading: skeleton za sve sekcije

 INVEST/WITHDRAW DIALOG:
  Kreirati zaseban komponentu `FundInvestDialog.tsx` / `FundWithdrawDialog.tsx`
  u istoj folderi (nije u ovom TODO-u, ali povezano).

 DEPENDENCIES:
  - investmentFundService
  - recharts za grafik (vec u projektu)
  - shadcn/ui

 TESTOVI: FundDetailsPage.test.tsx — mock service, proveri da se prikazuje
 sve info + profit znak + grafik renderuje.
================================================================================
*/
export default function FundDetailsPage() {
  // TODO: implementirati (vidi TODO blok iznad)
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">Detalji fonda</h1>
      <p className="text-sm text-muted-foreground">TODO (jkrunic): implementirati detaljan prikaz prema TODO bloku.</p>
    </div>
  );
}
