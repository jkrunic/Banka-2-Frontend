# TODO — PortfolioPage ekstenzija: "Moji fondovi" tab

**Zaduzen:** antonije3
**Spec referenca:** Celina 4, linije 333-348

## Šta treba uraditi

1. U `PortfolioPage.tsx` dodaj Tabs (shadcn/ui) sa dva taba:
   - "Moje hartije" — trenutni sadrzaj
   - "Moji fondovi" — renderuje `<MyFundsTab />` iz `src/pages/Funds/MyFundsTab.tsx`

2. Import:
   ```tsx
   import MyFundsTab from '@/pages/Funds/MyFundsTab';
   ```

3. Klijent + Aktuar razliciti prikaz:
   - `MyFundsTab` komponenta sama interno handluje oba case-a preko useAuth.

4. Testovi u `PortfolioPage.test.tsx`:
   - Defaultan tab je "Moje hartije" (ne menja postojece testove).
   - Novi test: click na "Moji fondovi" prikazuje `MyFundsTab`.
