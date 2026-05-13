import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/notify';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PiggyBank,
  Plus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import investmentFundService from '@/services/investmentFundService';
import type { InvestmentFundSummary } from '@/types/celina4';
import { formatAmount } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortField = 'name' | 'fundValue' | 'profit' | 'minimumContribution';
type SortDirection = 'asc' | 'desc';

export default function FundsDiscoveryPage() {
  const navigate = useNavigate();
  const { isSupervisor } = useAuth();

  const [funds, setFunds] = useState<InvestmentFundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Numericki filteri (min/max) — string state za UX (prazno polje = bez filtera).
  const [minContribution, setMinContribution] = useState('');
  const [maxContribution, setMaxContribution] = useState('');
  const [minFundValue, setMinFundValue] = useState('');
  const [maxFundValue, setMaxFundValue] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [maxProfit, setMaxProfit] = useState('');
  const [debouncedFilters, setDebouncedFilters] = useState({
    minContribution: '', maxContribution: '',
    minFundValue: '', maxFundValue: '',
    minProfit: '', maxProfit: '',
  });

  // Debounce search + numeric filters (jedan timer za sve da bi se izbegao spam BE poziva)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedFilters({
        minContribution, maxContribution,
        minFundValue, maxFundValue,
        minProfit, maxProfit,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, minContribution, maxContribution, minFundValue, maxFundValue, minProfit, maxProfit]);

  const parseNum = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const result = await investmentFundService.list({
        search: debouncedSearch || undefined,
        sort: sortBy,
        direction: sortDirection,
        minContribution: parseNum(debouncedFilters.minContribution),
        maxContribution: parseNum(debouncedFilters.maxContribution),
        minFundValue: parseNum(debouncedFilters.minFundValue),
        maxFundValue: parseNum(debouncedFilters.maxFundValue),
        minProfit: parseNum(debouncedFilters.minProfit),
        maxProfit: parseNum(debouncedFilters.maxProfit),
      });
      setFunds(result);
    } catch {
      toast.error('Greška pri učitavanju fondova');
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortBy, sortDirection, debouncedFilters]);

  useEffect(() => { fetchFunds(); }, [fetchFunds]);

  // Client-side sort fallback (in case backend doesn't sort)
  const sortedFunds = useMemo(() => {
    const sorted = [...funds];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'sr-RS');
          break;
        case 'fundValue':
          cmp = a.fundValue - b.fundValue;
          break;
        case 'profit':
          cmp = a.profit - b.profit;
          break;
        case 'minimumContribution':
          cmp = a.minimumContribution - b.minimumContribution;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [funds, sortBy, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PiggyBank className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Investicioni fondovi</h1>
        </div>
        {isSupervisor && (
          <Button onClick={() => navigate('/funds/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Kreiraj fond
          </Button>
        )}
      </div>

      {/* Search + numericki filteri */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po nazivu ili opisu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Min. ulog (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minContribution}
                  onChange={e => setMinContribution(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxContribution}
                  onChange={e => setMaxContribution(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Vrednost fonda (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minFundValue}
                  onChange={e => setMinFundValue(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxFundValue}
                  onChange={e => setMaxFundValue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Profit (RSD)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="od"
                  value={minProfit}
                  onChange={e => setMinProfit(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="do"
                  value={maxProfit}
                  onChange={e => setMaxProfit(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : sortedFunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Nema dostupnih fondova</p>
              {debouncedSearch && (
                <p className="text-sm mt-1">Pokušajte sa drugačijim terminom pretrage</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Naziv
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Opis</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('minimumContribution')}
                  >
                    <div className="flex items-center justify-end">
                      Min. ulog
                      <SortIcon field="minimumContribution" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('fundValue')}
                  >
                    <div className="flex items-center justify-end">
                      Vrednost
                      <SortIcon field="fundValue" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('profit')}
                  >
                    <div className="flex items-center justify-end">
                      Profit
                      <SortIcon field="profit" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFunds.map(fund => (
                  <TableRow
                    key={fund.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">{fund.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fund.managerName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[300px]">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {fund.description}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatAmount(fund.minimumContribution)} RSD
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">
                      {formatAmount(fund.fundValue)} RSD
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {fund.profit >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            fund.profit >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {formatAmount(fund.profit)} RSD
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
