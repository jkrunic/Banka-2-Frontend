# TODO — HomePage ekstenzije za Celinu 4

**Zaduzen:** sssmarta
**Spec referenca:** Celina 4

## Šta treba dodati

1. **Supervizor dashboard** (vec postoji):
   - Nova tile: "Profit Banke" → navigira na `/employee/profit-bank`
   - Nova tile: "Investicioni fondovi" → navigira na `/funds`
   - Koristi postojece widget ikone (Landmark, PiggyBank)

2. **Klijent dashboard**:
   - Pod "Brze akcije": dugme "Investicioni fondovi" → `/funds`
   - (Opciono) Widget "Moji fondovi": prikazuje top 3 pozicije

3. **Agent dashboard**:
   - Pod "Brze akcije": dugme "Investicioni fondovi" → `/funds`
   - (Opciono) Widget "Profit aktuara" — ALI ovo samo supervizor vidi;
     agent vidi samo svoje performance.

## Koraci

- U `HomePage.tsx` nadji mesto gde se renderuju "Brze akcije" i dodaj
  novi `<DashboardCard>` element za fondove.
- Koristi reuse pattern iz postojecih dashboard-a (vidi
  `SupervisorDashboardPage.tsx` i `HomePage.tsx`).

## Testovi

- Admin/Supervisor role: vidi "Profit Banke" i "Investicioni fondovi" tile.
- Client role: vidi samo "Investicioni fondovi".
- Agent role: vidi "Investicioni fondovi".
