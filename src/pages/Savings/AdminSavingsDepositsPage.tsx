import { useEffect, useState } from 'react';
import { Vault } from 'lucide-react';
import { toast } from '@/lib/notify';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import { savingsService } from '@/services/savingsService';
import {
  type SavingsDepositDto,
  type PageDto,
  type SavingsDepositStatus,
  STATUS_LABEL_SR,
} from '@/types/savings';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

const STATUS_VARIANT: Record<SavingsDepositStatus, 'success' | 'secondary' | 'warning' | 'info'> = {
  ACTIVE: 'success',
  MATURED: 'secondary',
  WITHDRAWN_EARLY: 'warning',
  RENEWED: 'info',
};

function fmtAmount(n: number, c: string) {
  try {
    return new Intl.NumberFormat('sr-RS', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
}

export default function AdminSavingsDepositsPage() {
  const [page, setPage] = useState<PageDto<SavingsDepositDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterClientId, setFilterClientId] = useState<string>('');
  const [pageNum, setPageNum] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const result = await savingsService.adminListAll({
        status: filterStatus || undefined,
        clientId: filterClientId ? Number(filterClientId) : undefined,
        page: pageNum,
        size: 20,
      });
      setPage(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Neuspeh ucitavanja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [pageNum]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader
        icon={<Vault />}
        title="Svi orocni depoziti"
        description="Admin/supervizor pregled svih stednih depozita u sistemu"
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="status-filter">Status</Label>
            <select
              id="status-filter"
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              data-testid="status-filter"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Svi</option>
              <option value="ACTIVE">Aktivni</option>
              <option value="MATURED">Dospeli</option>
              <option value="WITHDRAWN_EARLY">Raskinuti</option>
              <option value="RENEWED">Auto-obnovljeni</option>
            </select>
          </div>
          <div>
            <Label htmlFor="client-filter">Client ID</Label>
            <Input
              id="client-filter"
              type="number"
              data-testid="client-filter"
              value={filterClientId}
              onChange={e => setFilterClientId(e.target.value)}
            />
          </div>
          <Button onClick={() => { setPageNum(0); load(); }} data-testid="apply-filter">
            Primeni filter
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ucitavanje...</div>
      ) : page && page.content.length > 0 ? (
        <>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Klijent</TableHead>
                  <TableHead className="text-right">Glavnica</TableHead>
                  <TableHead className="text-center">Rok</TableHead>
                  <TableHead className="text-center">Stopa</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Datum otvaranja</TableHead>
                  <TableHead>Dospece</TableHead>
                  <TableHead className="text-right">Isplaceno kamata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.content.map(d => (
                  <TableRow key={d.id} data-testid={`admin-deposit-row-${d.id}`}>
                    <TableCell className="tabular-nums">{d.id}</TableCell>
                    <TableCell>
                      {d.clientName}{' '}
                      <span className="text-muted-foreground">#{d.clientId}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtAmount(d.principalAmount, d.currencyCode)}
                    </TableCell>
                    <TableCell className="text-center">{d.termMonths}m</TableCell>
                    <TableCell className="text-center">{d.annualInterestRate}%</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL_SR[d.status]}</Badge>
                    </TableCell>
                    <TableCell>{new Date(d.startDate).toLocaleDateString('sr-RS')}</TableCell>
                    <TableCell>{new Date(d.maturityDate).toLocaleDateString('sr-RS')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtAmount(d.totalInterestPaid, d.currencyCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-muted-foreground">
              Strana {page.number + 1} od {page.totalPages} ({page.totalElements} ukupno)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page.number === 0}
                onClick={() => setPageNum(page.number - 1)}
              >
                Prethodna
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page.number >= page.totalPages - 1}
                onClick={() => setPageNum(page.number + 1)}
              >
                Sledeca
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Card className="p-12 text-center text-muted-foreground">
          Nema depozita za prikazane filtere.
        </Card>
      )}
    </div>
  );
}
