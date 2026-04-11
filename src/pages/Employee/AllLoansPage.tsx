import { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Inbox,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { creditService } from '@/services/creditService';
import type { Loan, LoanStatus, LoanType } from '@/types/celina2';
import { asArray, formatAmount, formatDate } from '@/utils/formatters';

function statusBadgeVariant(status: LoanStatus): 'success' | 'warning' | 'info' | 'destructive' | 'secondary' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'APPROVED') return 'info';
  if (status === 'REJECTED') return 'destructive';
  if (status === 'LATE') return 'destructive';
  if (status === 'PAID' || status === 'PAID_OFF') return 'secondary';
  return 'secondary';
}

const statusRowBorder: Record<string, string> = {
  ACTIVE: 'border-l-emerald-500',
  PENDING: 'border-l-amber-500',
  APPROVED: 'border-l-blue-500',
  REJECTED: 'border-l-red-500',
  LATE: 'border-l-red-500',
  PAID: 'border-l-gray-400',
  PAID_OFF: 'border-l-gray-400',
  CLOSED: 'border-l-gray-300',
};

function statusLabel(status: LoanStatus): string {
  if (status === 'ACTIVE') return 'Aktivan';
  if (status === 'PENDING') return 'Na cekanju';
  if (status === 'APPROVED') return 'Odobren';
  if (status === 'REJECTED') return 'Odbijen';
  if (status === 'PAID') return 'Otplacen';
  if (status === 'PAID_OFF') return 'Prevremeno otplacen';
  if (status === 'LATE') return 'Kasnjenje';
  if (status === 'CLOSED') return 'Zatvoren';
  return status;
}

export default function AllLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanType, setLoanType] = useState<LoanType | 'ALL'>('ALL');
  const [status, setStatus] = useState<LoanStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await creditService.getAll({
          page,
          limit: 10,
          loanType: loanType === 'ALL' ? undefined : loanType,
          status: status === 'ALL' ? undefined : status,
        });
        setLoans(asArray<Loan>(response.content));
        setTotalPages(Math.max(1, response.totalPages));
      } catch {
        toast.error('Neuspesno ucitavanje kredita.');
        setLoans([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loanType, page, status]);

  useEffect(() => {
    setPage(0);
  }, [loanType, status]);

  // Stats
  const stats = useMemo(() => {
    const total = loans.length;
    const active = loans.filter(l => l.status === 'ACTIVE').length;
    const late = loans.filter(l => l.status === 'LATE').length;
    const totalAmount = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
    return { total, active, late, totalAmount };
  }, [loans]);

  const statCards = [
    { label: 'Ukupno kredita', value: stats.total, icon: FileText, iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400', gradient: 'from-indigo-500 to-violet-600' },
    { label: 'Aktivni', value: stats.active, icon: CheckCircle2, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-green-600' },
    { label: 'Kasnjenje', value: stats.late, icon: AlertTriangle, iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400', gradient: 'from-red-500 to-rose-600' },
    { label: 'Ukupan iznos', value: null, displayValue: `${formatAmount(stats.totalAmount)} RSD`, icon: TrendingUp, iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Svi krediti</h1>
          <p className="text-sm text-muted-foreground">
            Pregled svih kredita u bankarskom sistemu sa filterima.
          </p>
        </div>
      </div>

      {/* Stats row */}
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
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
            <CardTitle>Filteri</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="loan-type-filter">
              Tip kredita
            </label>
            <Select
              value={loanType}
              onValueChange={(val) => setLoanType(val as LoanType | 'ALL')}
            >
              <SelectTrigger id="loan-type-filter" className="h-10">
                <SelectValue placeholder="Svi tipovi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi</SelectItem>
                <SelectItem value="GOTOVINSKI">Gotovinski</SelectItem>
                <SelectItem value="STAMBENI">Stambeni</SelectItem>
                <SelectItem value="AUTO">Auto</SelectItem>
                <SelectItem value="STUDENTSKI">Studentski</SelectItem>
                <SelectItem value="REFINANSIRAJUCI">Refinansirajuci</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="loan-status-filter">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as LoanStatus | 'ALL')}
            >
              <SelectTrigger id="loan-status-filter" className="h-10">
                <SelectValue placeholder="Svi statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Svi</SelectItem>
                <SelectItem value="ACTIVE">Aktivni</SelectItem>
                <SelectItem value="PENDING">Na cekanju</SelectItem>
                <SelectItem value="APPROVED">Odobreni</SelectItem>
                <SelectItem value="REJECTED">Odbijeni</SelectItem>
                <SelectItem value="PAID">Otplaceni</SelectItem>
                <SelectItem value="PAID_OFF">Prevremeno otplaceni</SelectItem>
                <SelectItem value="LATE">Kasnjenje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Mesecna rata</TableHead>
                <TableHead>Preostali dug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-12 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                  <TableCell className="text-center"><div className="mx-auto h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : asArray<Loan>(loans).length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Nema kredita za izabrane filtere</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pokusajte sa drugacijim filterima.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Mesecna rata</TableHead>
                <TableHead>Preostali dug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Akcija</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asArray<Loan>(loans).map((loan) => (
                <TableRow
                  key={loan.id}
                  className={`cursor-pointer hover:bg-muted/50 transition-all duration-200 border-l-4 ${statusRowBorder[loan.status] || 'border-l-transparent'} hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.1)]`}
                  onClick={() => setSelectedLoan(loan)}
                >
                  <TableCell className="font-mono text-sm tabular-nums">
                    {loan.loanNumber || loan.id}
                  </TableCell>
                  <TableCell className="font-medium">{loan.loanType}</TableCell>
                  <TableCell className="font-mono font-semibold tabular-nums">
                    {formatAmount(loan.amount)} {loan.currency}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {formatAmount(loan.monthlyPayment)} {loan.currency}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {formatAmount(loan.remainingDebt)} {loan.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(loan.status)}>
                      {statusLabel(loan.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLoan(loan);
                      }}
                    >
                      Detalji
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Strana {page + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loan details panel */}
      {selectedLoan && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
              <FileText className="h-4 w-4 text-indigo-500" />
              <CardTitle>Detalji kredita #{selectedLoan.loanNumber || selectedLoan.id}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedLoan(null)} title="Zatvori">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Tip kredita', value: selectedLoan.loanType },
                { label: 'Status', badge: true },
                { label: 'Iznos', value: `${formatAmount(selectedLoan.amount)} ${selectedLoan.currency}`, mono: true },
                { label: 'Nominalna kamata', value: `${formatAmount(selectedLoan.nominalRate)}%`, mono: true },
                { label: 'Efektivna kamata', value: `${formatAmount(selectedLoan.effectiveRate)}%`, mono: true },
                { label: 'Mesecna rata', value: `${formatAmount(selectedLoan.monthlyPayment)} ${selectedLoan.currency}`, mono: true },
                { label: 'Preostali dug', value: `${formatAmount(selectedLoan.remainingDebt)} ${selectedLoan.currency}`, mono: true },
                { label: 'Pocetak', value: formatDate(selectedLoan.startDate) },
                { label: 'Kraj', value: formatDate(selectedLoan.endDate) },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5 rounded-xl bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  {item.badge ? (
                    <Badge variant={statusBadgeVariant(selectedLoan.status)}>
                      {statusLabel(selectedLoan.status)}
                    </Badge>
                  ) : (
                    <p className={`font-medium ${item.mono ? 'font-mono tabular-nums' : ''}`}>{item.value}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
