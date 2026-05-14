import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Branch } from '@/types/branches';

/**
 * Vraca tekuci effective theme ('light' | 'dark') sa baseom na DOM class koju
 * ThemeProvider postavlja u <html>. Reaguje na promene preko MutationObserver.
 */
function useEffectiveTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// Beograd Slavija = standardni centar
const BELGRADE_CENTER: [number, number] = [44.787, 20.457];
const DEFAULT_ZOOM = 13;

// Tile providers — light = OSM raster, dark = CartoDB Dark Matter
const LIGHT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LIGHT_TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface BranchMapProps {
  branches: Branch[];
  focusedBranchId?: number | null;
  /**
   * Counter koji se inkrementira na svaki "Najblize meni" klik. Koristi se kao
   * useEffect dep da forsira re-fire flyTo cak i kad focusedBranchId ostaje isti
   * (drugi klik na istog locatemu).
   */
  focusToken?: number;
}

/**
 * Map widget — renderuje MapContainer sa svim markerima.
 * Theme-aware tile loading prati useTheme() hook.
 *
 * NOTE: Leaflet podrazumevani CSS importovan u top-level (leaflet/dist/leaflet.css).
 * MapContainer mora imati eksplicitnu visinu u parent containeru.
 */
export function BranchMap({ branches, focusedBranchId, focusToken }: BranchMapProps) {
  const effectiveTheme = useEffectiveTheme();
  const isDark = effectiveTheme === 'dark';

  // Centar — ako fokusiramo specificnu lokaciju, koristi nju; inace Slavija
  const initialCenter = useMemo<[number, number]>(() => {
    if (focusedBranchId) {
      const branch = branches.find((b) => b.id === focusedBranchId);
      if (branch) return [Number(branch.latitude), Number(branch.longitude)];
    }
    return BELGRADE_CENTER;
  }, [branches, focusedBranchId]);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border shadow-lg"
      style={{ height: 'min(72vh, 720px)', minHeight: 520 }}
    >
      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        data-testid="branch-map-container"
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL}
          attribution={isDark ? DARK_TILE_ATTRIB : LIGHT_TILE_ATTRIB}
        />
        <MapInvalidator />
        <MapAutoCenter focusedBranchId={focusedBranchId} focusToken={focusToken} branches={branches} />
        {branches.map((branch) => (
          <BranchMarker key={branch.id} branch={branch} highlighted={branch.id === focusedBranchId} />
        ))}
      </MapContainer>
    </div>
  );
}

/**
 * Pokrene `map.invalidateSize()` posle mount-a kako bi se Leaflet
 * pravilno isporucio tile-ovima i markerima cak i kad je parent
 * pretrpio layout flip (npr. loading skeleton → map prelaz).
 */
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    // 2 retry pokusaja sa razmakom — pokriva animacioni flicker
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
}

/**
 * Re-centrira mapu na fokusiranu lokaciju. Listens na focusedBranchId I focusToken
 * — counter osigurava da drugi klik na isti najblizu lokaciju ponovo trigger-uje
 * flyTo (inace React vidi isti focusedBranchId i ne refire-uje useEffect).
 */
function MapAutoCenter({ focusedBranchId, focusToken, branches }:
    { focusedBranchId?: number | null; focusToken?: number; branches: Branch[] }) {
  const map = useMap();
  useEffect(() => {
    if (focusedBranchId) {
      const branch = branches.find((b) => b.id === focusedBranchId);
      if (branch) {
        map.flyTo([Number(branch.latitude), Number(branch.longitude)], 16, { duration: 1.2 });
      }
    }
  }, [focusedBranchId, focusToken, branches, map]);
  return null;
}

/* ── BranchMarker (custom DivIcon SVG + Popup) ─────────────────────────── */

interface BranchMarkerProps {
  branch: Branch;
  highlighted?: boolean;
}

function BranchMarker({ branch, highlighted }: BranchMarkerProps) {
  const icon = useMemo(() => buildDivIcon(branch, highlighted ?? false), [branch, highlighted]);
  return (
    <Marker position={[Number(branch.latitude), Number(branch.longitude)]} icon={icon}>
      <Popup>
        <div className="space-y-1.5 min-w-[180px]">
          <p className={`font-bold text-sm ${branch.type === 'BRANCH' ? 'text-violet-700' : 'text-indigo-600'}`}>
            {branch.name}
          </p>
          <p className="text-xs italic text-slate-600">{branch.address}</p>
          <p className="text-xs">
            <span className="text-slate-500">Radno vreme: </span>
            <span className="font-medium">{branch.openingHours}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {branch.has24h && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">24h</span>
            )}
            {branch.hasDriveThrough && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Drive-through</span>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {branch.type === 'BRANCH' ? 'Ekspozitura' : 'Bankomat'}
            </span>
          </div>
          <a
            href={`https://maps.google.com/?q=${branch.latitude},${branch.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline block pt-1"
          >
            Otvori u Google Maps →
          </a>
        </div>
      </Popup>
    </Marker>
  );
}

function buildDivIcon(branch: Branch, highlighted: boolean): L.DivIcon {
  if (branch.type === 'BRANCH') {
    // Violet pin sa zgradom — 36px
    const ringClass = highlighted ? 'ring-4 ring-violet-400/60' : '';
    const html = `
      <div class="branch-marker branch-marker-branch ${ringClass}" style="width: 36px; height: 36px;">
        <svg viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5" width="18" height="18">
          <path d="M3 21h18v-2H3v2zM5 19V9l7-4 7 4v10h-2v-7H7v7H5zm4 0v-5h6v5H9z"/>
        </svg>
      </div>`;
    return L.divIcon({
      className: 'branch-divicon',
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }
  // ATM — indigo krug 28px sa $ + badge-evi
  const ringClass = highlighted ? 'ring-4 ring-indigo-400/60' : '';
  const has24hBadge = branch.has24h
    ? `<span class="atm-badge-24h">24</span>`
    : '';
  const driveBadge = branch.hasDriveThrough
    ? `<span class="atm-badge-drive">🚗</span>`
    : '';
  const has24hClass = branch.has24h ? 'atm-glow-24h' : '';
  const html = `
    <div class="branch-marker branch-marker-atm ${ringClass} ${has24hClass}" style="width: 28px; height: 28px;">
      <span class="atm-symbol">$</span>
      ${has24hBadge}
      ${driveBadge}
    </div>`;
  return L.divIcon({
    className: 'branch-divicon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default BranchMap;
