import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Info,
  DollarSign,
  Layers,
  Shield,
  Clock,
  Link2,
  RefreshCw,
} from 'lucide-react';
import type { Listing, ListingDailyPrice, OptionChain } from '@/types/celina3';
import listingService from '@/services/listingService';
import { toast } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PERIODS = [
  { key: 'DAY', label: '1D', days: 24 },
  { key: 'WEEK', label: '1N', days: 7 },
  { key: 'MONTH', label: '1M', days: 30 },
  { key: 'YEAR', label: '1G', days: 365 },
  { key: 'FIVE_YEARS', label: '5G', days: 60 },
  { key: 'ALL', label: 'Sve', days: 120 },
] as const;

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '-';
  return price.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(vol: number | null | undefined): string {
  if (vol == null) return '-';
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString('sr-RS');
}

function generateFakeHistory(basePrice: number, days: number): ListingDailyPrice[] {
  const data: ListingDailyPrice[] = [];
  // Start from an earlier price using mean-reverting random walk
  const dailyVolatility = 0.015; // 1.5% daily volatility
  const meanReversionStrength = 0.05;
  let price = basePrice * (0.9 + Math.random() * 0.1); // Start 90-100% of current price
  const avgVolume = Math.max(50000, Math.floor(basePrice * 500));

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Mean-reverting random walk: drift toward basePrice at the end
    const drift = (basePrice - price) * meanReversionStrength / Math.max(days, 1);
    const randomShock = (Math.random() - 0.5) * 2 * basePrice * dailyVolatility;
    const change = drift + randomShock;
    price = Math.max(price + change, basePrice * 0.5);

    const dayRange = Math.abs(randomShock) + basePrice * 0.005;
    const high = price + dayRange * (0.3 + Math.random() * 0.7);
    const low = price - dayRange * (0.3 + Math.random() * 0.7);
    // Volume varies with volatility - bigger moves = more volume
    const volMultiplier = 0.5 + Math.abs(change / basePrice) * 20 + Math.random();
    const volume = Math.floor(avgVolume * volMultiplier);

    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(price * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(Math.max(low, price * 0.95) * 100) / 100,
      change: Math.round(change * 100) / 100,
      volume,
    });
  }
  return data;
}

const TYPE_LABELS: Record<string, string> = {
  STOCK: 'Akcija',
  FUTURES: 'Futures',
  FOREX: 'Forex',
};

interface StatItemProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'positive' | 'negative';
}

function StatItem({ label, value, sub, highlight }: StatItemProps) {
  return (
    <div className="p-3.5 rounded-lg bg-muted/30 dark:bg-slate-800/40 border border-border/30">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono tabular-nums ${
        highlight === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
        highlight === 'negative' ? 'text-red-600 dark:text-red-400' : ''
      }`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

export default function SecuritiesDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [history, setHistory] = useState<ListingDailyPrice[]>([]);
  const [period, setPeriod] = useState('MONTH');
  const [loading, setLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orderDirection, setOrderDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [orderType, setOrderType] = useState('MARKET');

  // Options chain state
  const [optionChains, setOptionChains] = useState<OptionChain[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(false);
  const [selectedSettlementDate, setSelectedSettlementDate] = useState<string>('');
  const [strikeCountFilter, setStrikeCountFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [l, h] = await Promise.all([
          listingService.getById(Number(id)),
          listingService.getHistory(Number(id), period),
        ]);
        if (!cancelled) {
          setListing(l);
          setHistory(h);
          setIsSimulated(!h || h.length === 0);
        }
      } catch {
        if (!cancelled) {
          toast.error('Greska pri ucitavanju detalja hartije');
          setListing(null); setHistory([]); setIsSimulated(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, period]);

  const refreshHistory = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const h = await listingService.getHistory(Number(id), period);
      setHistory(h);
      setIsSimulated(!h || h.length === 0);
    } catch {
      // Keep existing data on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [id, period]);

  // Load options chain for stocks
  useEffect(() => {
    if (!id || !listing || listing.listingType !== 'STOCK') return;
    let cancelled = false;
    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(false);
      try {
        const data = await listingService.getOptions(Number(id));
        if (!cancelled) {
          setOptionChains(Array.isArray(data) ? data : []);
          if (Array.isArray(data) && data.length > 0) {
            setSelectedSettlementDate(data[0].settlementDate);
          }
        }
      } catch {
        if (!cancelled) {
          setOptionsError(true);
          setOptionChains([]);
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    loadOptions();
    return () => { cancelled = true; };
  }, [id, listing]);

  // Compute filtered options for the selected settlement date
  const selectedChain = useMemo(() => {
    return optionChains.find((c) => c.settlementDate === selectedSettlementDate) ?? null;
  }, [optionChains, selectedSettlementDate]);

  const filteredStrikes = useMemo(() => {
    if (!selectedChain) return { calls: [], puts: [] };
    const allCalls = [...selectedChain.calls].sort((a, b) => a.strikePrice - b.strikePrice);
    const allPuts = [...selectedChain.puts].sort((a, b) => a.strikePrice - b.strikePrice);

    // Collect all unique strike prices
    const allStrikePrices = [...new Set([...allCalls.map((c) => c.strikePrice), ...allPuts.map((p) => p.strikePrice)])].sort((a, b) => a - b);

    if (strikeCountFilter === 'ALL') return { calls: allCalls, puts: allPuts, strikes: allStrikePrices };

    const count = parseInt(strikeCountFilter);
    const currentPrice = selectedChain.currentStockPrice;
    // Find the closest strikes around the current price
    const sorted = [...allStrikePrices].sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice));
    const selectedStrikes = new Set(sorted.slice(0, count));

    return {
      calls: allCalls.filter((c) => selectedStrikes.has(c.strikePrice)),
      puts: allPuts.filter((p) => selectedStrikes.has(p.strikePrice)),
      strikes: allStrikePrices.filter((s) => selectedStrikes.has(s)),
    };
  }, [selectedChain, strikeCountFilter]);

  // Generate fake data when history is empty
  const chartData = useMemo(() => {
    if (history.length > 0) return history;
    if (!listing) return [];
    const periodDays = PERIODS.find(p => p.key === period)?.days ?? 30;
    return generateFakeHistory(listing.price, periodDays);
  }, [history, listing, period]);

  const chartDirection = useMemo(() => {
    if (chartData.length < 2) return true;
    return chartData[chartData.length - 1].price >= chartData[0].price;
  }, [chartData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded bg-muted" />
        <div className="h-[400px] animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto p-6 text-center py-20">
        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-semibold">Hartija nije pronadjena</h2>
        <p className="text-sm text-muted-foreground mt-1">Trazena hartija od vrednosti ne postoji ili je uklonjena</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/securities')}>
          Nazad na listu
        </Button>
      </div>
    );
  }

  const change = listing.priceChange ?? 0;
  const changePct = listing.changePercent ?? 0;
  const isPositive = change >= 0;
  const chartColor = chartDirection ? '#10B981' : '#EF4444';
  const spread = listing.ask && listing.bid ? listing.ask - listing.bid : null;
  const estimatedTotal = listing.price * (parseInt(orderQuantity) || 0);

  return (
    <div className="container mx-auto p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => navigate('/securities')} className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Hartije
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-mono font-semibold">{listing.ticker}</span>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono tracking-tight">{listing.ticker}</h1>
            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-mono text-xs">
              {TYPE_LABELS[listing.listingType] || listing.listingType}
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              {listing.exchangeAcronym}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{listing.name}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-4xl font-bold font-mono tabular-nums tracking-tight">
            {formatPrice(listing.price)}
          </p>
          <div className={`flex items-center gap-2 mt-1 lg:justify-end ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold font-mono ${
              isPositive
                ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                : 'bg-red-500/10 ring-1 ring-red-500/20'
            }`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? '+' : ''}{formatPrice(change)}
              <span className="text-xs ml-1">({isPositive ? '+' : ''}{changePct.toFixed(2)}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart + Stats - takes 2 cols */}
        <div className="lg:col-span-2 space-y-5">
          {/* Chart */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-muted/10 dark:bg-slate-900/30">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                    Kretanje cene
                  </CardTitle>
                  {isSimulated && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono text-amber-600 dark:text-amber-400 border-amber-400/40 bg-amber-500/5">
                      Simulirani podaci
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshHistory}
                    disabled={refreshing}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                    title="Osvezi podatke"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Osvezi
                  </button>
                  <div className="flex gap-0.5 bg-muted/50 dark:bg-slate-800/50 p-0.5 rounded-lg">
                    {PERIODS.map((p) => (
                      <button
                        type="button"
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                          period === p.key
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="bg-muted/20 dark:bg-slate-900/40 rounded-xl p-3">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d: string) => {
                        const date = new Date(d);
                        return period === 'DAY'
                          ? date.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.4 }}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => formatPrice(v)}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: unknown) => [formatPrice(Number(value)), 'Cena']}
                      labelFormatter={(label: unknown) => {
                        const date = new Date(String(label));
                        return period === 'DAY'
                          ? date.toLocaleString('sr-RS')
                          : date.toLocaleDateString('sr-RS', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
                      }}
                      cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={chartColor}
                      strokeWidth={2}
                      fill="url(#colorPriceGrad)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {isSimulated && (
                <p className="text-[10px] text-amber-600/60 dark:text-amber-400/50 text-center mt-2 font-mono">
                  * Prikazani su simulirani podaci jer istorijski podaci jos nisu dostupni sa servera
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid - Bloomberg style */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                Podaci o hartiji
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatItem label="Cena" value={formatPrice(listing.price)} />
                <StatItem
                  label="Promena"
                  value={`${isPositive ? '+' : ''}${formatPrice(change)}`}
                  sub={`${isPositive ? '+' : ''}${changePct.toFixed(2)}%`}
                  highlight={isPositive ? 'positive' : 'negative'}
                />
                <StatItem label="Bid" value={formatPrice(listing.bid)} />
                <StatItem
                  label="Ask"
                  value={formatPrice(listing.ask)}
                  sub={spread != null ? `Spread: ${formatPrice(spread)}` : undefined}
                />
                <StatItem label="Volume" value={formatVolume(listing.volume)} />
                <StatItem label="Initial Margin" value={formatPrice(listing.initialMarginCost)} />
                <StatItem label="Maintenance Margin" value={formatPrice(listing.maintenanceMargin)} />

                {/* Stock-specific */}
                {listing.listingType === 'STOCK' && listing.marketCap != null && (
                  <StatItem label="Market Cap" value={formatVolume(listing.marketCap)} />
                )}
                {listing.listingType === 'STOCK' && listing.outstandingShares != null && (
                  <StatItem label="Shares Outstanding" value={listing.outstandingShares.toLocaleString('sr-RS')} />
                )}
                {listing.listingType === 'STOCK' && listing.dividendYield != null && (
                  <StatItem label="Dividend Yield" value={`${listing.dividendYield.toFixed(2)}%`} />
                )}

                {/* Forex-specific */}
                {listing.listingType === 'FOREX' && listing.baseCurrency && (
                  <StatItem label="Bazna valuta" value={listing.baseCurrency} />
                )}
                {listing.listingType === 'FOREX' && listing.quoteCurrency && (
                  <StatItem label="Kvotna valuta" value={listing.quoteCurrency} />
                )}
                {listing.listingType === 'FOREX' && listing.liquidity && (
                  <StatItem label="Likvidnost" value={listing.liquidity} />
                )}

                {/* Futures-specific */}
                {listing.listingType === 'FUTURES' && listing.contractSize != null && (
                  <StatItem label="Velicina ugovora" value={listing.contractSize.toString()} sub={listing.contractUnit} />
                )}
                {listing.listingType === 'FUTURES' && listing.settlementDate && (
                  <StatItem label="Datum isteka" value={new Date(listing.settlementDate).toLocaleDateString('sr-RS')} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* High/Low chart data summary */}
          {chartData.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                  Statistika perioda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatItem
                    label="Najvisa cena"
                    value={formatPrice(Math.max(...chartData.map(d => d.high)))}
                    highlight="positive"
                  />
                  <StatItem
                    label="Najniza cena"
                    value={formatPrice(Math.min(...chartData.map(d => d.low)))}
                    highlight="negative"
                  />
                  <StatItem
                    label="Prosecna cena"
                    value={formatPrice(chartData.reduce((s, d) => s + d.price, 0) / chartData.length)}
                  />
                  <StatItem
                    label="Ukupan volume"
                    value={formatVolume(chartData.reduce((s, d) => s + d.volume, 0))}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options Chain - only for stocks */}
          {listing.listingType === 'STOCK' && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                    <Link2 className="h-4 w-4 text-indigo-500" />
                    Lanac opcija
                  </CardTitle>
                  {optionChains.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedSettlementDate} onValueChange={setSelectedSettlementDate}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Datum dospeća" />
                        </SelectTrigger>
                        <SelectContent>
                          {optionChains.map((chain) => (
                            <SelectItem key={chain.settlementDate} value={chain.settlementDate}>
                              {new Date(chain.settlementDate).toLocaleDateString('sr-RS')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={strikeCountFilter} onValueChange={setStrikeCountFilter}>
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="ALL">Sve</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {optionsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : optionsError || optionChains.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <Link2 className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Opcije nisu dostupne za ovu hartiju
                    </p>
                  </div>
                ) : selectedChain ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center text-xs font-semibold">Call Bid</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Call Ask</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Call Last</TableHead>
                          <TableHead className="text-center text-xs font-bold bg-muted/30">Strike</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Put Bid</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Put Ask</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Put Last</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const strikes = filteredStrikes.strikes ?? [];
                          const callMap = new Map(filteredStrikes.calls.map((c) => [c.strikePrice, c]));
                          const putMap = new Map(filteredStrikes.puts.map((p) => [p.strikePrice, p]));
                          const currentPrice = selectedChain.currentStockPrice;
                          let separatorInserted = false;

                          const rows: React.ReactNode[] = [];

                          for (let i = 0; i < strikes.length; i++) {
                            const strike = strikes[i];
                            const call = callMap.get(strike);
                            const put = putMap.get(strike);
                            const callITM = strike < currentPrice;
                            const putITM = strike > currentPrice;

                            // Insert current price separator
                            if (!separatorInserted && strike >= currentPrice) {
                              separatorInserted = true;
                              rows.push(
                                <TableRow key="separator" className="border-0">
                                  <TableCell colSpan={7} className="p-0">
                                    <div className="flex items-center gap-2 py-1">
                                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                                      <span className="text-[10px] font-mono font-bold text-indigo-500 whitespace-nowrap">
                                        Trenutna cena: {formatPrice(currentPrice)}
                                      </span>
                                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            rows.push(
                              <TableRow
                                key={strike}
                                className={`transition-colors ${
                                  callITM
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                                    : putITM
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                                    : 'bg-red-500/10 hover:bg-red-500/15'
                                }`}
                              >
                                <TableCell className="text-center font-mono text-xs tabular-nums">
                                  {call ? formatPrice(call.bid) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums">
                                  {call ? formatPrice(call.ask) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums font-semibold">
                                  {call ? formatPrice(call.price) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums font-bold bg-muted/30">
                                  {formatPrice(strike)}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums">
                                  {put ? formatPrice(put.bid) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums">
                                  {put ? formatPrice(put.ask) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-mono text-xs tabular-nums font-semibold">
                                  {put ? formatPrice(put.price) : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return rows;
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar - Order panel + Info */}
        <div className="space-y-5">
          {/* Order Panel */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500/5 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/10 px-5 py-3 border-b border-border/50">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-indigo-500" />
                Brzi nalog
              </h3>
            </div>
            <CardContent className="p-5 space-y-4">
              {/* Buy/Sell Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderDirection('BUY')}
                  className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    orderDirection === 'BUY'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    KUPI
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDirection('SELL')}
                  className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    orderDirection === 'SELL'
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <TrendingDown className="h-4 w-4" />
                    PRODAJ
                  </span>
                </button>
              </div>

              {/* Order Type */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">
                  Tip naloga
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setOrderType(t)}
                      className={`px-2 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                        orderType === t
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                          : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5 block">
                  Kolicina
                </label>
                <Input
                  type="number"
                  min="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                  className="font-mono text-center bg-muted/30 dark:bg-slate-800/40"
                />
              </div>

              {/* Price display */}
              <div className="bg-muted/30 dark:bg-slate-800/30 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cena po jedinici</span>
                  <span className="font-mono font-semibold">{formatPrice(listing.price)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Kolicina</span>
                  <span className="font-mono font-semibold">{parseInt(orderQuantity) || 0}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between">
                  <span className="text-xs font-medium">Procenjena vrednost</span>
                  <span className="font-mono font-bold text-sm">{formatPrice(estimatedTotal)}</span>
                </div>
              </div>

              {/* Submit */}
              <Button
                className={`w-full font-bold shadow-lg transition-all ${
                  orderDirection === 'BUY'
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20 hover:shadow-red-500/30'
                }`}
                onClick={() => {
                  const qty = parseInt(orderQuantity);
                  if (!Number.isFinite(qty) || qty < 1) {
                    toast.error('Kolicina mora biti najmanje 1.');
                    return;
                  }
                  navigate(`/orders/new?listingId=${listing.id}&direction=${orderDirection}`);
                }}
              >
                {orderDirection === 'BUY' ? (
                  <><TrendingUp className="h-4 w-4 mr-2" /> Kupi {listing.ticker}</>
                ) : (
                  <><TrendingDown className="h-4 w-4 mr-2" /> Prodaj {listing.ticker}</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Trading Parameters */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-500" />
                Parametri trgovanja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3 w-3" /> Initial Margin
                </span>
                <span className="font-mono font-semibold">{formatPrice(listing.initialMarginCost)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Maintenance Margin
                </span>
                <span className="font-mono font-semibold">{formatPrice(listing.maintenanceMargin)}</span>
              </div>
              {listing.listingType === 'FUTURES' && listing.contractSize && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Velicina ugovora
                  </span>
                  <span className="font-mono font-semibold">
                    {listing.contractSize} {listing.contractUnit || ''}
                  </span>
                </div>
              )}
              {listing.listingType === 'FUTURES' && listing.settlementDate && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Datum isteka
                  </span>
                  <span className="font-mono font-semibold">
                    {new Date(listing.settlementDate).toLocaleDateString('sr-RS')}
                  </span>
                </div>
              )}
              {spread != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Bid/Ask Spread</span>
                  <span className="font-mono font-semibold">{formatPrice(spread)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How to Trade Info Card */}
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1.5">Kako trgovati</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold mt-0.5">1.</span>
                      Izaberite smer (Kupi/Prodaj)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold mt-0.5">2.</span>
                      Unesite zeljenu kolicinu
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold mt-0.5">3.</span>
                      Izaberite tip naloga
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-indigo-500 font-bold mt-0.5">4.</span>
                      Potvrdite nalog
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
