/*
================================================================================
 TODO — PORTAL "PROFIT BANKE" (OPCIONO ZA GEN 2024/25)
 Zaduzen: sssmarta
 Spec referenca: Celina 4, linije 353-364
--------------------------------------------------------------------------------
 ROUTE: /employee/profit-bank   (supervisorOnly)

 LAYOUT:
  Tabs:
    [ Profit aktuara ] [ Pozicije u fondovima ]

  Tab 1 "Profit aktuara":
    - Tabela: ime, prezime, pozicija (SUPERVISOR/AGENT), profit u RSD
    - Sortiranje po profitu (desc default)
    - Opcioni filter po imenu

  Tab 2 "Pozicije u fondovima":
    - Tabela bankinih pozicija u fondovima
    - Kolone: fond, menadzer, udeo %, RSD vrednost, profit
    - Akcije po fondu: "Uplati (banka)" + "Povuci (banka)"
    - "Uplati" otvara FundInvestDialog sa supervisor=true (koristi
      bankin racun bez komisije).
    - "Povuci" otvara FundWithdrawDialog sa supervisor=true.

 LOGIKA:
  - useEffect -> profitBankService.listActuaryPerformance / listBankFundPositions
  - Skeleton + empty state

 ZAVISNOSTI:
  - profitBankService (sssmarta)
  - FundInvestDialog + FundWithdrawDialog (antonije3) — reuse!
  - types: ActuaryProfit, BankFundPosition (implicitno ClientFundPosition)

 NAPOMENA:
  Spec kaze da je ovaj portal opciono. Ako BE nije jos implementirao,
  sakrij tab koji vraca 501/404 i prikazi info banner.

 TESTOVI: ProfitBankPage.test.tsx — oba taba, mock servisi, tab switch
  cuva state.
================================================================================
*/
export default function ProfitBankPage() {
  // TODO: implementirati
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">Profit Banke</h1>
      <p className="text-sm text-muted-foreground">TODO (sssmarta): implementirati tabove prema TODO bloku.</p>
    </div>
  );
}
