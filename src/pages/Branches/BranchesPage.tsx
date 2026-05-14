import { useEffect, useMemo, useState } from 'react';
import { MapPin, Building2, Banknote } from 'lucide-react';
import { toast } from '@/lib/notify';
import { branchService } from '@/services/branchService';
import { BranchFilters } from '@/components/branches/BranchFilters';
import { BranchMap } from '@/components/branches/BranchMap';
import type { Branch, BranchType } from '@/types/branches';
import { getErrorMessage } from '@/utils/formatters';

/**
 * Mapa Beograda — ekspoziture + bankomati Banke 2. Dodato 14.05.2026 vece-4.
 * Spec: Info o predmetu/2026-05-14-branches-map-design.md.
 * Pristupacno svim role-ovima (klijent / agent / supervizor / admin).
 */
export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<BranchType | 'ALL'>('ALL');
  const [has24h, setHas24h] = useState(false);
  const [hasDriveThrough, setHasDriveThrough] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedBranchId, setFocusedBranchId] = useState<number | null>(null);
  // Counter koji se inkrementira pri svakom Najblize-meni klik-u —
  // koristi se kao useEffect dep u BranchMap da re-fire flyTo cak i kad
  // korisnik klikne na istu najblizu lokaciju (bez promene focusedBranchId).
  const [focusToken, setFocusToken] = useState(0);

  // Single fetch on mount — sva 72 redova (small payload, ne pravi smisla paginacija).
  useEffect(() => {
    (async () => {
      try {
        const data = await branchService.list();
        setBranches(data ?? []);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Neuspesno ucitavanje lokacija.'));
        setBranches([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filtriranje lokalno (no extra BE calls).
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (typeFilter !== 'ALL' && b.type !== typeFilter) return false;
      if (has24h && !b.has24h) return false;
      if (hasDriveThrough && !b.hasDriveThrough) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [branches, typeFilter, has24h, hasDriveThrough, search]);

  // Brojaci za KPI strip
  const branchCount = useMemo(() => filteredBranches.filter((b) => b.type === 'BRANCH').length, [filteredBranches]);
  const atmCount = useMemo(() => filteredBranches.filter((b) => b.type === 'ATM').length, [filteredBranches]);
  const h24Count = useMemo(() => filteredBranches.filter((b) => b.has24h).length, [filteredBranches]);

  const handleLocateMe = (lat: number, lon: number) => {
    // Nadji najblizu lokaciju Haversine formulom
    let closest: Branch | null = null;
    let minDist = Infinity;
    for (const b of filteredBranches) {
      const d = haversineKm(lat, lon, Number(b.latitude), Number(b.longitude));
      if (d < minDist) {
        minDist = d;
        closest = b;
      }
    }
    if (closest) {
      setFocusedBranchId(closest.id);
      // Inkrementiraj token cak i ako je id isti — fix za "drugi klik me ne zumira"
      setFocusToken((t) => t + 1);
      toast.info(`Najbliza lokacija: ${closest.name} (~${minDist.toFixed(1)} km)`);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <MapPin className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Mapa lokacija</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ekspoziture i bankomati Banke 2 — Beograd. Klik na marker za detalje.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Ekspoziture" value={branchCount} tone="violet" />
        <KpiCard icon={<Banknote className="h-4 w-4" />} label="Bankomati" value={atmCount} tone="indigo" />
        <KpiCard icon={<MapPin className="h-4 w-4" />} label="24h dostupno" value={h24Count} tone="emerald" />
      </div>

      {/* Filters */}
      <BranchFilters
        typeFilter={typeFilter}
        has24h={has24h}
        hasDriveThrough={hasDriveThrough}
        search={search}
        onTypeFilterChange={setTypeFilter}
        onHas24hChange={setHas24h}
        onHasDriveThroughChange={setHasDriveThrough}
        onSearchChange={setSearch}
        onLocateMe={handleLocateMe}
      />

      {/* Map */}
      {loading ? (
        <div className="w-full flex items-center justify-center rounded-2xl border bg-muted/30" style={{ height: 'min(72vh, 720px)', minHeight: 520 }}>
          <div className="text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
            <p className="text-sm text-muted-foreground">Ucitavanje mape...</p>
          </div>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="w-full flex items-center justify-center rounded-2xl border bg-muted/30" style={{ height: 'min(72vh, 720px)', minHeight: 520 }}>
          <div className="text-center space-y-2 max-w-md px-6">
            <MapPin className="h-10 w-10 mx-auto text-muted-foreground/50" />
            {branches.length === 0 ? (
              <>
                <p className="font-semibold">Nema seedovanih lokacija</p>
                <p className="text-sm text-muted-foreground">
                  Sistem ne sadrzi nijednu ekspozituru ni bankomat. Najverovatnije seed
                  jos nije izvrsen ili je Postgres volume star. Probaj{' '}
                  <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-xs">
                    docker compose down -v && docker compose up -d
                  </code>{' '}
                  pa sacekaj da seed kontejner zavrsi (~60s).
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Nema lokacija po trenutnim filterima</p>
                <p className="text-sm text-muted-foreground">
                  Sistem ima {branches.length} lokacija ali nijedna ne odgovara izabranim
                  filterima. Pokusaj drugacije filtere ili obrisi pretragu.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <BranchMap branches={filteredBranches} focusedBranchId={focusedBranchId} focusToken={focusToken} />
      )}

      {/* Legend */}
      <div className="rounded-2xl border bg-card/50 p-4 text-xs">
        <p className="font-semibold mb-2">Legenda</p>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md rotate-[-45deg] bg-gradient-to-br from-violet-500 to-purple-700" />
            <span className="text-muted-foreground">Ekspozitura (filijala)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 items-center justify-center text-white text-xs font-bold">$</span>
            <span className="text-muted-foreground">Bankomat</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">24h</span>
            <span className="text-muted-foreground">Non-stop dostupan</span>
          </span>
          <span className="flex items-center gap-2">
            <span>🚗</span>
            <span className="text-muted-foreground">Drive-through</span>
          </span>
        </div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'violet' | 'indigo' | 'emerald';
}

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneClasses = {
    violet: 'from-violet-500/15 to-purple-500/5 text-violet-600 dark:text-violet-400',
    indigo: 'from-indigo-500/15 to-blue-500/5 text-indigo-600 dark:text-indigo-400',
    emerald: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-400',
  }[tone];

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${toneClasses} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Haversine formula u kilometrima. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
