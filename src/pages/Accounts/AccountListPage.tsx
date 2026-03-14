// FE2-02a: Lista svih racuna korisnika
// Tabelarni prikaz sa filterom po tipu, sortiranjem po stanju i paginacijom

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Account, AccountType } from '@/types/celina2';
import { accountService } from '@/services/accountService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

const accountTypeBadgeVariant: Record<string, 'info' | 'success' | 'warning'> = {
  TEKUCI: 'info',
  DEVIZNI: 'success',
  POSLOVNI: 'warning',
};

function formatBalance(amount: number, currency: string): string {
  return `${amount.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatAccountNumber(accountNumber: string): string {
  if (accountNumber.length !== 18) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${accountNumber.slice(3, 16)}-${accountNumber.slice(16)}`;
}

export default function AccountListPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountService.getMyAccounts();
      const safeData = Array.isArray(data) ? data : [];
      setAccounts(safeData);
    } catch {
      setError('Greska pri ucitavanju racuna. Pokusajte ponovo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter]);

  // Client-side filtering and sorting
  const filteredAccounts = accounts
    .filter((a) => !typeFilter || a.accountType === typeFilter)
    .sort((a, b) => b.availableBalance - a.availableBalance);

  const totalElements = filteredAccounts.length;
  const totalPages = Math.ceil(totalElements / rowsPerPage);
  const from = page * rowsPerPage + 1;
  const to = Math.min((page + 1) * rowsPerPage, totalElements);
  const paginatedAccounts = filteredAccounts.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Racuni</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filteri"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={typeFilter ?? 'ALL'}
              onValueChange={(val) => setTypeFilter(val === 'ALL' ? undefined : val as AccountType)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tip racuna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi tipovi</SelectItem>
                <SelectItem value="TEKUCI">Tekuci</SelectItem>
                <SelectItem value="DEVIZNI">Devizni</SelectItem>
                <SelectItem value="POSLOVNI">Poslovni</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj racuna</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Raspolozivo stanje</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nema pronadjenih racuna
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (account.accountType === 'POSLOVNI') {
                        navigate(`/accounts/${account.id}/business`);
                      } else {
                        navigate(`/accounts/${account.id}`);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {formatAccountNumber(account.accountNumber)}
                    </TableCell>
                    <TableCell>{account.name || `${accountTypeLabels[account.accountType]} racun`}</TableCell>
                    <TableCell>
                      <Badge variant={accountTypeBadgeVariant[account.accountType]}>
                        {accountTypeLabels[account.accountType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatBalance(account.availableBalance, account.currency)}
                    </TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell>
                      <Badge variant={account.status === 'ACTIVE' ? 'success' : account.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                        {account.status === 'ACTIVE' ? 'Aktivan' : account.status === 'BLOCKED' ? 'Blokiran' : 'Neaktivan'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Redova po stranici:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {totalElements > 0
                  ? `${from}–${to} od ${totalElements}`
                  : '0 rezultata'}
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
