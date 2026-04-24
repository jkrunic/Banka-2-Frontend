/*
================================================================================
 TODO — DISCOVERY STRANICA INVESTICIONIH FONDOVA
 Zaduzen: jkrunic
 Spec referenca: Celina 4, linije 300-304 (Discovery page)
--------------------------------------------------------------------------------
 ROUTE: /funds            (authenticated — klijenti + aktuari)

 LAYOUT:
  - Header sa naslovom "Investicioni fondovi"
  - (Samo supervizor) dugme "Kreiraj fond" → /funds/create
  - Filter bar: search (po naziv/opis), sort (naziv, vrednost, profit,
    minimalni ulog)
  - Tabelarni prikaz fondova:
      Kolone: Naziv, Opis (kratak), Minimalni ulog, Vrednost, Profit
      Klikom na red otvara se /funds/{id}

 LOGIKA:
  - useEffect -> investmentFundService.list(params)
  - Skeleton loader dok se ucitava
  - Empty state: ikona + "Nema dostupnih fondova"
  - Bojenje profit celije: zelena za >0, crvena za <0

 AUTH:
  - Svi autentifikovani vide Discovery
  - "Kreiraj fond" dugme vidi samo isSupervisor (useAuth)

 DEPENDENCIES:
  - investmentFundService (jkrunic)
  - types iz celina4.ts (jkrunic)
  - shadcn/ui: Table, Input, Select, Button, Badge, Card

 TESTOVI:
  - FundsDiscoveryPage.test.tsx: renderuje listu, primenjuje filter,
    klik na red navigira na detalj, supervizor vidi "Kreiraj fond".

 REFERENCA: `src/pages/Securities/SecuritiesListPage.tsx` kao uzor za
  tabelu sa filterima i sortiranjem.
================================================================================
*/
export default function FundsDiscoveryPage() {
  // TODO: implementirati
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">Investicioni fondovi</h1>
      <p className="text-sm text-muted-foreground">TODO (jkrunic): implementirati discovery tabelu prema TODO bloku iznad.</p>
    </div>
  );
}
