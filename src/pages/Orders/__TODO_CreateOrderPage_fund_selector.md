# TODO — CreateOrderPage ekstenzija: "Kupujem u ime" selektor

**Zaduzen:** antonije3
**Spec referenca:** Celina 4, linije 327-331

## Šta treba uraditi

Za supervizore na `CreateOrderPage.tsx` dodaj selektor "Kupujem u ime":
- **Banka** (trenutno ponasanje)
- **Fond: <naziv>** (jedan po fondu kojim taj supervizor upravlja)

## Koraci

1. U komponenti, dohvati fondove koje user upravlja:
   ```tsx
   const { user, isSupervisor } = useAuth();
   const [myFunds, setMyFunds] = useState<InvestmentFundSummary[]>([]);
   useEffect(() => {
     if (isSupervisor) {
       investmentFundService.list()
         .then(all => setMyFunds(all.filter(f => f.managerEmployeeId === user?.id)));
     }
   }, [isSupervisor, user?.id]);
   ```
   (Napomena: `InvestmentFundSummary` nema `managerEmployeeId`; dodaj ga u DTO ili koristi getFundDetails za filter.)

2. State: `const [buyingFor, setBuyingFor] = useState<'BANK' | `fund:${number}``>('BANK');`

3. UI: Radio group ili Select vidljiv samo ako `isSupervisor && myFunds.length > 0`.

4. Kad je `buyingFor === 'fund:X'`:
   - Pre order submit-a proveri da je fund.account.balance >= approxPrice
     (ili pusti backend da validira i prikazi gresku).
   - Izmeni CreateOrderDto sa `fundId: X` (BE tim treba dodati polje na
     `CreateOrderDto` i u `Order` entitet; kolona `fund_id` null za obicne
     ordere).
   - `accountId` = fund.accountId umesto bankinog racuna.

5. Testovi:
   - CreateOrderPage.test.tsx: mock useAuth sa isSupervisor=true,
     mock investmentFundService.list, proveri da se prikazuje selector.
   - Submit sa izabranim fondom salje fundId u DTO.

## Zavisnosti

- Backend treba da doda `fund_id` polje na `Order` entitet + validaciju
  u OrderService.createOrder.
- Ovo je cross-funkcija: dogovori se sa BE tim-om da dodaju polje **pre**
  nego sto FE promena merguje se.
