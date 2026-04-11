// FE2-14a: Employee portal - pregled svih racuna sa filterima

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  CreditCard,
  Search,
  Wallet,
  Inbox,
  TrendingUp,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { formatBalance, formatAccountNumber } from '@/utils/formatters';
import { accountService } from '@/services/accountService';
import type { Account, AccountStatus, AccountType } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
};

const accountTypeColors: Record<string, string> = {
  TEKUCI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  DEVIZNI: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  POSLOVNI: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktivan',
  BLOCKED: 'Blokiran',
  INACTIVE: 'Neaktivan',
};

const statusDotColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
  INACTIVE: 'bg-gray-400 dark:bg-gray-500',
};

const normalizeAccountType = (raw: string | undefined): AccountType => {
  switch (raw) {
    case 'CHECKING':
    case 'TEKUCI':
      return 'TEKUCI';
    case 'FOREIGN':
    case 'DEVIZNI':
      return 'DEVIZNI';
    case 'BUSINESS':
    case 'POSLOVNI':
      return 'POSLOVNI';
    default:
      return 'TEKUCI';
  }
};

export default function AccountsPortalPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [accountType, setAccountType] = useState<AccountType | undefined>(undefined);
  const [status, setStatus] = useState<AccountStatus | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await accountService.getAll({
        ownerEmail: ownerEmail || undefined,
        accountType,
        status,
        page,
        limit: rowsPerPage,
      });
      const normalized = (Array.isArray(response.content) ? response.content : []).map((acc) => ({
        ...acc,
        accountType: normalizeAccountType((acc as { accountType?: string }).accountType),
      })) as Account[];
      setAccounts(normalized);
      setTotalElements(response.totalElements ?? 0);
      setTotalPages(response.totalPages ?? 0);
    } catch {
      setError('Greska pri ucitavanju racuna.');
      setAccounts([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [ownerEmail, accountType, status, page, rowsPerPage]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setPage(0);
  }, [ownerEmail, accountType, status]);

  const changeStatus = async (accountId: number, nextStatus: AccountStatus) => {
    try {
      await accountService.changeStatus(accountId, nextStatus);
      toast.success(`Status racuna promenjen u ${nextStatus}.`);
      await loadAccounts();
    } catch {
      toast.error('Promena statusa racuna nije uspela.');
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.status === 'ACTIVE').length;
    const blocked = accounts.filter(a => a.status === 'BLOCKED').length;
    const totalBalance = accounts.reduce((sum, a) => sum + (a.availableBalance || 0), 0);
    return { total, active, blocked, totalBalance };
  }, [accounts]);

  const from = totalElements > 0 ? page * rowsPerPage + 1 : 0;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);

  const statCards = [
    { label: 'Ukupno racuna', value: stats.total, icon: Wallet, gradient: 'from-indigo-500 to-violet-600', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Aktivni', value: stats.active, icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Blokirani', value: stats.blocked, icon: Ban, gradient: 'from-red-500 to-rose-600', iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400' },
    { label: 'Ukupno stanje', value: null, displayValue: formatBalance(stats.totalBalance, 'RSD'), icon: TrendingUp, gradient: 'from-blue-500 to-indigo-600', iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portal racuna</h1>
            <p className="text-sm text-muted-foreground">Upravljajte svim bankovnim racunima klijenata.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filteri"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/employee/accounts/new')} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all">
            <Plus className="mr-2 h-4 w-4" /> Kreiraj racun
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
                    {stat.value !== null ? stat.value : stat.displayValue}
                  </p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${stat.gradient} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="rounded-2xl p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filteri pretrage</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">Email vlasnika</label>
              <div className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
                <Search className={`absolute left-3 top-2.5 h-4 w-4 transition-colors ${searchFocused ? 'text-indigo-500' : 'text-muted-foreground'}`} />
                <Input
                  placeholder="Pretrazi po emailu..."
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tip racuna</label>
              <Select
                value={accountType ?? 'ALL'}
                onValueChange={(val) => setAccountType(val === 'ALL' ? undefined : val as AccountType)}
              >
                <SelectTrigger className="w-[170px] h-10">
                  <SelectValue placeholder="Svi tipovi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi tipovi</SelectItem>
                  <SelectItem value="TEKUCI">Tekuci</SelectItem>
                  <SelectItem value="DEVIZNI">Devizni</SelectItem>
                  <SelectItem value="POSLOVNI">Poslovni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={status ?? 'ALL'}
                onValueChange={(val) => setStatus(val === 'ALL' ? undefined : val as AccountStatus)}
              >
                <SelectTrigger className="w-[170px] h-10">
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi statusi</SelectItem>
                  <SelectItem value="ACTIVE">Aktivan</SelectItem>
                  <SelectItem value="BLOCKED">Blokiran</SelectItem>
                  <SelectItem value="INACTIVE">Neaktivan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Accounts table */}
      {loading ? (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vlasnik</TableHead>
                <TableHead>Broj racuna</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Stanje</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-40 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-12 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell className="text-right"><div className="ml-auto h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vlasnik</TableHead>
                <TableHead>Broj racuna</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Stanje</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-auto p-0">
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">Nema pronadjenih racuna</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Pokusajte sa drugim filterima.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="group hover:bg-muted/50 transition-all duration-200 hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.1)]"
                  >
                    <TableCell className="font-medium">{account.ownerName}</TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">
                      {formatAccountNumber(account.accountNumber)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${accountTypeColors[account.accountType] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {accountTypeLabels[account.accountType]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-semibold tabular-nums">
                      {formatBalance(account.availableBalance, account.currency)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{account.currency}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${statusDotColors[account.status]}`} />
                        <span className="text-sm">{statusLabels[account.status] || account.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {account.status === 'ACTIVE' && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(account.id, 'BLOCKED')} className="h-8">
                            Blokiraj
                          </Button>
                        )}
                        {account.status === 'BLOCKED' && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(account.id, 'ACTIVE')} className="h-8">
                            Aktiviraj
                          </Button>
                        )}
                        {account.status !== 'INACTIVE' && (
                          <Button size="sm" variant="destructive" onClick={() => changeStatus(account.id, 'INACTIVE')} className="h-8">
                            Deaktiviraj
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/employee/accounts/${account.id}/cards`)}
                          title="Kartice"
                          className="h-8"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(
                            account.accountType === 'POSLOVNI'
                              ? `/accounts/${account.id}/business`
                              : `/accounts/${account.id}`
                          )}
                          className="h-8"
                        >
                          Detalji
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="text-sm text-muted-foreground">
              {totalElements > 0
                ? `${from}–${to} od ${totalElements}`
                : '0 rezultata'}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Strana {page + 1} / {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
