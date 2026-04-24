# TODO — EmployeeEditPage: fund ownership reassignment dijalog

**Zaduzen:** sssmarta
**Spec referenca:** Celina 4, linija 326

## Šta treba uraditi

Kad admin ukloni permisiju **isSupervisor** zaposlenom koji upravlja
nekim fondovima, spec zahteva da se vlasnistvo tih fondova prebaci
na admina koji je uklonio permisiju.

## UX Flow

1. Admin klikne "Sacuvaj" posle uklanjanja isSupervisor.
2. FE prvo proverava (preko `investmentFundService.list()` i filter po
   `managerEmployeeId === editedEmployeeId`) da li ima fondova koje taj
   supervizor upravlja.
3. Ako ima:
   - Prikazi Confirmation Dialog:
     > "Ovaj supervizor upravlja sa X fondova (navesti naziv svakog).
     > Uklanjanjem isSupervisor permisije, svi ovi fondovi ce biti
     > prebaceni na vas kao novog menadzera. Da li ste sigurni?"
   - Dugmad: "Potvrdi" i "Otkazi".
4. Na potvrdu: PATCH /employees/{id}/permissions se poziva kao i ranije;
   backend (ActuaryService) automatski zove
   `InvestmentFundService.reassignFundManager(oldId, adminId)`.

## Koraci

1. Import:
   ```tsx
   import investmentFundService from '@/services/investmentFundService';
   ```

2. Dodaj state:
   ```ts
   const [fundsManagedByUser, setFundsManagedByUser] = useState<InvestmentFundSummary[]>([]);
   const [showReassignConfirm, setShowReassignConfirm] = useState(false);
   ```

3. U handleSubmit: pre PATCH-a, ako user uklanja isSupervisor, proveri
   da li `fundsManagedByUser.length > 0` i otvori dialog umesto da odmah
   salje PATCH.

4. Testovi:
   - Admin uklanja isSupervisor od usera sa 2 fonda → prikazuje dialog
     sa "2 fonda".
   - "Potvrdi" zove PATCH + refreshuje listu.
   - "Otkazi" vraca checkbox za isSupervisor u checked stanje.

## Zavisnosti

- Backend treba da u `ActuaryService.removeIsSupervisor` pozove
  `InvestmentFundService.reassignFundManager(oldSupervisorId, adminId)`.
  (To je vec napomenuto u InvestmentFundService.java TODO bloku.)
