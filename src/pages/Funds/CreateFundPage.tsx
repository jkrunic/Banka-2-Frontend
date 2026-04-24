/*
================================================================================
 TODO — KREIRANJE NOVOG INVESTICIONOG FONDA (samo supervizor)
 Zaduzen: antonije3
 Spec referenca: Celina 4, linije 318-324 (Create investment fund page)
--------------------------------------------------------------------------------
 ROUTE: /funds/create
 GUARD: supervisorOnly (dodaj tu vrstu u ProtectedRoute ako ne postoji,
        ili koristi useAuth.isSupervisor i redirect ako false).

 FORMA (react-hook-form + Zod):
  - name (unique, 3-128 chars) — input
  - description (max 1024) — textarea
  - minimumContribution (positive BigDecimal) — numericki input sa RSD suffix

 POSLE SUBMIT:
  - investmentFundService.create(dto)
  - Uspesno: toast.success("Fond kreiran") + navigate(`/funds/${newFund.id}`)
  - Greska: toast.error(getErrorMessage(e, "Neuspesno kreiranje"))

 NAPOMENA:
  - BE automatski kreira bankin RSD racun za fond (linija 324).
  - Menadzer = trenutni supervizor (uzmi iz useAuth.user).

 TESTOVI: CreateFundPage.test.tsx — validira required polja, poziva
 service sa pravim DTO, navigira na detaljan prikaz.

 REFERENCA: src/pages/Employee/CreateAccountPage.tsx za jednostavan create pattern.
================================================================================
*/
export default function CreateFundPage() {
  // TODO: implementirati
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">Novi investicioni fond</h1>
      <p className="text-sm text-muted-foreground">TODO (antonije3): implementirati formu prema TODO bloku.</p>
    </div>
  );
}
