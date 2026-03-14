// FE2-03a: Detaljan prikaz licnog racuna (tekuci/devizni)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Pencil,
  CreditCard,
  ArrowLeftRight,
  History,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { accountService } from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import type { Account, Transaction } from '@/types/celina2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const accountTypeLabels: Record<string, string> = {
  TEKUCI: 'Tekuci',
  DEVIZNI: 'Devizni',
  POSLOVNI: 'Poslovni',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktivan',
  BLOCKED: 'Blokiran',
  INACTIVE: 'Neaktivan',
};

const statusVariant: Record<string, 'success' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
  INACTIVE: 'secondary',
};

const txStatusLabels: Record<string, string> = {
  PENDING: 'Na cekanju',
  COMPLETED: 'Zavrsena',
  REJECTED: 'Odbijena',
  CANCELLED: 'Otkazana',
};

const txStatusVariant: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

function formatBalance(amount: number, currency: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AccountDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameValue, setRenameValue] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingLimits, setIsSavingLimits] = useState(false);

  useEffect(() => {
    const accountId = Number(id);
    if (!accountId || Number.isNaN(accountId)) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const accountData = await accountService.getById(accountId);
        setAccount(accountData);
        setRenameValue(accountData.name || '');
        setDailyLimit(String(accountData.dailyLimit));
        setMonthlyLimit(String(accountData.monthlyLimit));

        const transactionsResponse = await transactionService.getAll({
          accountNumber: accountData.accountNumber,
          page: 0,
          limit: 10,
        });
        setTransactions(Array.isArray(transactionsResponse.content) ? transactionsResponse.content : []);
      } catch {
        toast.error('Greska pri ucitavanju detalja racuna.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const dailyProgress = useMemo(() => {
    if (!account || account.dailyLimit <= 0) return 0;
    return Math.min(100, (account.dailySpending / account.dailyLimit) * 100);
  }, [account]);

  const monthlyProgress = useMemo(() => {
    if (!account || account.monthlyLimit <= 0) return 0;
    return Math.min(100, (account.monthlySpending / account.monthlyLimit) * 100);
  }, [account]);

  const saveName = async () => {
    if (!account) return;
    const newName = renameValue.trim();
    if (!newName) {
      toast.error('Naziv racuna ne sme biti prazan.');
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await accountService.updateName(account.id, newName);
      setAccount(updated);
      toast.success('Naziv racuna je uspesno promenjen.');
    } catch {
      toast.error('Promena naziva nije uspela.');
    } finally {
      setIsSavingName(false);
    }
  };

  const saveLimits = async () => {
    if (!account) return;
    const parsedDaily = Number(dailyLimit);
    const parsedMonthly = Number(monthlyLimit);
    if (Number.isNaN(parsedDaily) || Number.isNaN(parsedMonthly) || parsedDaily < 0 || parsedMonthly < 0) {
      toast.error('Limiti moraju biti nenegativni brojevi.');
      return;
    }

    setIsSavingLimits(true);
    try {
      await accountService.changeLimit(account.id, {
        dailyLimit: parsedDaily,
        monthlyLimit: parsedMonthly,
      });
      setAccount({ ...account, dailyLimit: parsedDaily, monthlyLimit: parsedMonthly });
      toast.success('Limiti su uspesno sacuvani.');
    } catch {
      toast.error('Promena limita nije uspela.');
    } finally {
      setIsSavingLimits(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na racune
        </Button>
        <p className="text-muted-foreground">Racun nije pronadjen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Nazad na racune
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{account.name || 'Detalji racuna'}</h1>
        <Badge variant={statusVariant[account.status]}>
          {statusLabels[account.status] || account.status}
        </Badge>
        <Badge variant="info">
          {accountTypeLabels[account.accountType] || account.accountType}
        </Badge>
      </div>
      <p className="text-muted-foreground">{formatAccountNumber(account.accountNumber)}</p>

      {/* Balance card */}
      <Card>
        <CardHeader>
          <CardTitle>Stanje racuna</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Ukupno stanje</p>
              <p className="text-xl font-semibold">{formatBalance(account.balance, account.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Raspolozivo</p>
              <p className="text-xl font-semibold">{formatBalance(account.availableBalance, account.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rezervisano</p>
              <p className="text-lg font-medium text-muted-foreground">{formatBalance(account.reservedBalance, account.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Odrzavanje</p>
              <p className="text-lg font-medium text-muted-foreground">{formatBalance(account.maintenanceFee, account.currency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limits card */}
      <Card>
        <CardHeader>
          <CardTitle>Limiti i potrosnja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Dnevna potrosnja</span>
              <span className="font-medium">
                {formatBalance(account.dailySpending, account.currency)} / {formatBalance(account.dailyLimit, account.currency)}
              </span>
            </div>
            <Progress value={dailyProgress} className="h-2" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Mesecna potrosnja</span>
              <span className="font-medium">
                {formatBalance(account.monthlySpending, account.currency)} / {formatBalance(account.monthlyLimit, account.currency)}
              </span>
            </div>
            <Progress value={monthlyProgress} className="h-2" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Novi dnevni limit</Label>
              <Input id="dailyLimit" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyLimit">Novi mesecni limit</Label>
              <Input id="monthlyLimit" type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveLimits} disabled={isSavingLimits}>
            {isSavingLimits ? 'Cuvanje...' : 'Sacuvaj limite'}
          </Button>
        </CardContent>
      </Card>

      {/* Actions card */}
      <Card>
        <CardHeader>
          <CardTitle>Akcije</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Novi naziv racuna"
              className="max-w-sm"
            />
            <Button onClick={saveName} disabled={isSavingName}>
              {isSavingName ? 'Cuvanje...' : 'Promeni naziv'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/payments/new?from=${account.accountNumber}`)}>
              <CreditCard className="mr-2 h-4 w-4" /> Novo placanje
            </Button>
            <Button variant="outline" onClick={() => navigate(`/transfers?from=${account.accountNumber}`)}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Prenos
            </Button>
            <Button variant="outline" onClick={() => navigate(`/payments/history?account=${account.accountNumber}`)}>
              <History className="mr-2 h-4 w-4" /> Sve transakcije
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Poslednje transakcije</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nema transakcija za ovaj racun.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Primalac / Posiljalac</TableHead>
                  <TableHead>Svrha</TableHead>
                  <TableHead className="text-right">Iznos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isOutgoing = tx.fromAccountNumber === account.accountNumber;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {isOutgoing ? (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell>
                        {tx.recipientName || '—'}
                        <span className="block text-xs text-muted-foreground">
                          {isOutgoing
                            ? formatAccountNumber(tx.toAccountNumber)
                            : formatAccountNumber(tx.fromAccountNumber)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.paymentPurpose}>
                        {tx.paymentPurpose}
                      </TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${isOutgoing ? 'text-destructive' : 'text-green-600'}`}>
                        {isOutgoing ? '−' : '+'}{formatBalance(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={txStatusVariant[tx.status]}>
                          {txStatusLabels[tx.status] || tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
