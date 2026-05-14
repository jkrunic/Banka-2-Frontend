import { Fragment, useEffect, useMemo, useState } from 'react';
import { ScrollText, Zap } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import otcService from '@/services/otcService';
import { accountService } from '@/services/accountService';
import type { OtcContract, OtcContractStatus } from '@/types/celina3';
import type { Account } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { asArray, formatAmount, getErrorMessage, getPreferredAccount } from '@/utils/formatters';
import { OTC_CONTRACT_STATUS_LABELS as CONTRACT_STATUS_LABEL } from '@/utils/otcLabels';
import OtcSourceFilterChip, { type OtcSource } from '@/components/otc/OtcSourceFilterChip';
import OtcSubHero from '@/components/otc/OtcSubHero';
import OtcInterBankContractsTab from './OtcInterBankContractsTab';

// T4A-020 fix: ujednacavanje naziva izmedju filter dropdown-a i statusnih badge-ova.
// Pre fix-a filter je koristio engleske enum vrednosti, dok su badge-ovi prikazivali
// srpske labele iz OTC_CONTRACT_STATUS_LABELS. Sad oba koriste isti map.
const STATUS_LABELS = CONTRACT_STATUS_LABEL;

const STATUS_OPTIONS: Array<{ value: OtcContractStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Svi' },
  { value: 'ACTIVE', label: STATUS_LABELS.ACTIVE },
  { value: 'EXERCISED', label: STATUS_LABELS.EXERCISED },
  { value: 'EXPIRED', label: STATUS_LABELS.EXPIRED },
];

const statusBadgeVariant = (status: string): 'success' | 'secondary' | 'destructive' | 'warning' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ACCEPTED' || status === 'EXERCISED') return 'secondary';
  if (status === 'EXPIRED') return 'warning';
  return 'destructive';
};

const normalizeName = (s: string | undefined) =>
  // NFD razbija "ć" → "c" + U+0301 i sl., pa skidamo sve combining diacritice (U+0300–U+036F).
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export default function OtcContractsPage() {
  const { user, isAdmin, isAgent, isSupervisor } = useAuth();
  const isEmployee = isAdmin || isAgent || isSupervisor;
  // Klijent JWT nema id claim, a clientService.getAll je cesto 403 za CLIENT-a,
  // pa se na user.id ne mozemo osloniti. BE vec filtrira /otc/contracts na "moje",
  // pa unutar tog skupa identitet razresavamo i preko normalizovanog imena.
  const myFullName = normalizeName(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`);
  const isMe = (partyId: number, partyName: string) =>
    (user?.id ?? 0) > 0 && user?.id === partyId
      ? true
      : myFullName.length > 0 && normalizeName(partyName) === myFullName;
  const [source, setSource] = useState<OtcSource>('all');
  const [statusFilter, setStatusFilter] = useState<OtcContractStatus | 'ALL'>('ALL');
  const [contracts, setContracts] = useState<OtcContract[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyContractId, setBusyContractId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await otcService.listMyContracts(statusFilter);
        if (!cancelled) setContracts(data ?? []);
      } catch {
        if (!cancelled) setContracts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const list = isEmployee
          ? asArray<Account>(await accountService.getBankAccounts())
          : asArray<Account>(await accountService.getMyAccounts());
        if (!cancelled) setAccounts(list.filter((a) => a.status === 'ACTIVE'));
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [statusFilter, isEmployee]);

  const filteredContracts = useMemo(() => contracts, [contracts]);

  const handleExercise = async (contract: OtcContract) => {
    if (!window.confirm(`Iskoristiti ugovor za ${contract.quantity} x ${contract.listingTicker}?`)) return;
    const buyerAccount = getPreferredAccount(accounts, contract.listingCurrency);
    if (!buyerAccount) { toast.error('Nemate aktivan racun za placanje strike cene.'); return; }
    setBusyContractId(contract.id);
    try {
      await otcService.exerciseContract(contract.id, buyerAccount.id);
      toast.success('Opcioni ugovor je iskoriscen — akcije su prebacene, strike cena skinuta sa racuna.');
      // T4A-002 fix: posle exercise strike cena je skinuta sa kupcevog racuna,
      // akcije prebacene u portfolio. Refresh oba (contracts + accounts) da UI prikaze novo stanje.
      const [data, refreshedAccounts] = await Promise.all([
        otcService.listMyContracts(statusFilter),
        isEmployee
          ? accountService.getBankAccounts()
          : accountService.getMyAccounts(),
      ]);
      setContracts(data ?? []);
      setAccounts(asArray<Account>(refreshedAccounts).filter((a) => a.status === 'ACTIVE'));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Iskoriscavanje nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  /**
   * Odustajanje od opcije — kupac priznaje da nece iskoristiti ugovor.
   * Premija je vec placena pri accept-u i NE VRACA SE (to je cena opcije po spec-u
   * Celina 4 — kupljeno je PRAVO ne obaveza). Ugovor → EXPIRED, prodavcev
   * publicQuantity se automatski oslobadja.
   */
  const handleAbandon = async (contract: OtcContract) => {
    const premiumLabel = `${contract.premium ?? 0} ${contract.listingCurrency}`;
    if (
      !window.confirm(
        `Odustani od ugovora za ${contract.quantity} x ${contract.listingTicker}?\n\n` +
        `VAZNO: premija koju ste platili prodavcu (${premiumLabel}) se NE VRACA — ` +
        `to je cena opcionog ugovora. Nazad dobijate samo slobodu da ne kupite akcije.`,
      )
    ) return;
    setBusyContractId(contract.id);
    try {
      await otcService.abandonContract(contract.id);
      toast.success('Odustali ste od ugovora. Premija ostaje kod prodavca.');
      const data = await otcService.listMyContracts(statusFilter);
      setContracts(data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Odustajanje nije uspelo.'));
    } finally {
      setBusyContractId(null);
    }
  };

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const exercisedCount = contracts.filter((c) => c.status === 'EXERCISED').length;
  const expiredCount = contracts.filter((c) => c.status === 'EXPIRED').length;
  const itmCount = contracts.filter(
    (c) => c.status === 'ACTIVE' && isMe(c.buyerId, c.buyerName) && c.currentPrice != null && c.currentPrice > c.strikePrice,
  ).length;

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-up">
      <OtcSubHero
        icon={ScrollText}
        title="Sklopljeni ugovori"
        description="Opcioni ugovori iz prihvacenih ponuda. Kupac moze iskoristiti pre settlement datuma."
        gradientFrom="from-amber-500"
        gradientTo="to-orange-600"
        kpis={source === 'inter' ? undefined : [
          { label: STATUS_LABELS.ACTIVE, value: String(activeCount), tone: activeCount > 0 ? 'success' : 'default' },
          { label: 'ITM kao kupac', value: String(itmCount), tone: itmCount > 0 ? 'warning' : 'default' },
          { label: STATUS_LABELS.EXERCISED, value: String(exercisedCount) },
          { label: STATUS_LABELS.EXPIRED, value: String(expiredCount) },
        ]}
      />

      <div className="space-y-2">
        <OtcSourceFilterChip value={source} onChange={setSource} />
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              aria-pressed={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={
                statusFilter === opt.value
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                  : ''
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {source === 'inter' ? (
        <OtcInterBankContractsTab />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Moji ugovori (intra-bank)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Kako rade opcioni ugovori:</strong> kad prihvati pregovor, kupac <em>placa premiju</em>{' '}
              prodavcu odmah — to je cena <strong>prava da kupi</strong>. Klikom na <strong>Iskoristi</strong>{' '}
              kupac placa strike × kolicina i dobija akcije. Ako <strong>odustane</strong> ili pusti settlement
              da prodje, premija ostaje kod prodavca (vec je placena) — to je standardna option mehanika.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
                ))}
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nemate sklopljene OTC ugovore.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hartija</TableHead>
                    <TableHead>Kupac / Prodavac</TableHead>
                    <TableHead>Kolicina</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Premija</TableHead>
                    <TableHead>Trenutna cena</TableHead>
                    <TableHead>Dospece</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((c) => {
                    const inTheMoney =
                      c.currentPrice != null && c.strikePrice != null && c.currentPrice > c.strikePrice;
                    return (
                      <Fragment key={c.id}>
                        <TableRow>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{c.listingTicker}</span>
                              <span className="text-xs text-muted-foreground">{c.listingName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span>Kupac: {c.buyerName}</span>
                                {isMe(c.buyerId, c.buyerName) && (
                                  <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-1.5">
                                <span>Prodavac: {c.sellerName}</span>
                                {isMe(c.sellerId, c.sellerName) && (
                                  <Badge variant="info" className="text-[10px] px-1 py-0 h-4">VI</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{c.quantity}</TableCell>
                          <TableCell className="font-mono">{formatAmount(c.strikePrice)} {c.listingCurrency}</TableCell>
                          <TableCell className="font-mono">{formatAmount(c.premium)} {c.listingCurrency}</TableCell>
                          <TableCell className="font-mono">
                            {c.currentPrice != null ? (
                              <span className={inTheMoney ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                {formatAmount(c.currentPrice)} {c.listingCurrency}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{c.settlementDate}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(c.status)}>
                              {CONTRACT_STATUS_LABEL[c.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status === 'ACTIVE' && isMe(c.buyerId, c.buyerName) ? (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={busyContractId === c.id}
                                  onClick={() => handleExercise(c)}
                                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                                >
                                  <Zap className="h-3.5 w-3.5 mr-1" />
                                  {busyContractId === c.id ? '...' : 'Iskoristi'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyContractId === c.id}
                                  onClick={() => handleAbandon(c)}
                                  title="Premija se NE vraca. Samo zatvara ugovor pre settlementa."
                                  data-testid={`otc-abandon-${c.id}`}
                                >
                                  Odustani
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
