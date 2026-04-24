# TODO — OtcTrgovinaPage ekstenzija za inter-bank discovery

**Zaduzen:** ekalajdzic13322
**Spec referenca:** Celina 4, linije 440-444

## Šta treba uraditi

1. U `OtcTrgovinaPage.tsx` dodati `Tabs` (shadcn/ui) sa dva taba:
   - "Iz nase banke" — trenutni sadrzaj (discovery iz intra-bank)
   - "Iz drugih banaka" — renderuje `<OtcInterBankDiscoveryTab />`

2. Import:
   ```tsx
   import OtcInterBankDiscoveryTab from './OtcInterBankDiscoveryTab';
   import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
   ```

3. State: `const [tab, setTab] = useState<'local' | 'remote'>('local');`

4. Testovi u `OtcTrgovinaPage.test.tsx`:
   - Novi test: prebacuje tab na "Iz drugih banaka", poziva `interbankOtcService.listRemoteListings`.
   - Postojeci testovi za intra-bank tab ne smeju pasti.
