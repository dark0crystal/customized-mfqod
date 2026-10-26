/**
 * Runtime application configuration.
 *
 * Precedence for every key:
 *   1. window.__APP_CONFIG__  — set by /config.js (loaded by index.html before the app bundle;
 *                               in Docker it is generated from env vars at container start,
 *                               so one image works on any server without a rebuild)
 *   2. import.meta.env.VITE_*  — build-time fallback (e.g. `VITE_API_URL=... npm run build`)
 *   3. the defaults below
 *
 * Replaces every `process.env.NEXT_PUBLIC_HOST_NAME || '...'` from the Next.js app:
 *   import { API_URL } from '@/config'
 */

export type MapTilesType = 'pmtiles' | 'xyz' | 'none';

export interface AppConfig {
  /** Backend base URL, no trailing slash. e.g. http://127.0.0.1:8000 */
  API_URL: string;
  /** URL of the offline map tiles: a .pmtiles file, or an XYZ template ({z}/{x}/{y}). */
  MAP_TILES_URL: string;
  /** How MAP_TILES_URL is interpreted. 'none' hides the tile layer. */
  MAP_TILES_TYPE: MapTilesType;
  /** Attribution HTML shown on the map. */
  MAP_ATTRIBUTION: string;
  /** Show links to external map services (e.g. Google Maps). Off for air-gapped deployments. */
  SHOW_EXTERNAL_MAP_LINKS: boolean;
}

const DEFAULTS: AppConfig = {
  API_URL: 'http://localhost:8000',
  MAP_TILES_URL: '/map/oman.pmtiles',
  MAP_TILES_TYPE: 'pmtiles',
  MAP_ATTRIBUTION: '© OpenStreetMap contributors · Protomaps',
  SHOW_EXTERNAL_MAP_LINKS: false,
};

type RawValue = string | boolean | undefined | null;

function runtimeValue(key: keyof AppConfig): RawValue {
  if (typeof window === 'undefined') return undefined;
  const cfg = window.__APP_CONFIG__;
  if (!cfg || typeof cfg !== 'object') return undefined;
  return (cfg as Record<string, RawValue>)[key];
}

function envValue(key: keyof AppConfig): RawValue {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return env[`VITE_${key}`];
}

function pick(key: keyof AppConfig): RawValue {
  for (const v of [runtimeValue(key), envValue(key)]) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
}

function str(key: keyof AppConfig, fallback: string): string {
  const v = pick(key);
  return v === undefined || v === null ? fallback : String(v).trim();
}

function bool(key: keyof AppConfig, fallback: boolean): boolean {
  const v = pick(key);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
  }
  return fallback;
}

function tilesType(): MapTilesType {
  const v = str('MAP_TILES_TYPE', DEFAULTS.MAP_TILES_TYPE).toLowerCase();
  return v === 'xyz' || v === 'none' || v === 'pmtiles' ? v : DEFAULTS.MAP_TILES_TYPE;
}

export const config: AppConfig = Object.freeze({
  API_URL: str('API_URL', DEFAULTS.API_URL).replace(/\/+$/, ''),
  MAP_TILES_URL: str('MAP_TILES_URL', DEFAULTS.MAP_TILES_URL),
  MAP_TILES_TYPE: tilesType(),
  MAP_ATTRIBUTION: str('MAP_ATTRIBUTION', DEFAULTS.MAP_ATTRIBUTION),
  SHOW_EXTERNAL_MAP_LINKS: bool('SHOW_EXTERNAL_MAP_LINKS', DEFAULTS.SHOW_EXTERNAL_MAP_LINKS),
});

export const API_URL = config.API_URL;
export const MAP_TILES_URL = config.MAP_TILES_URL;
export const MAP_TILES_TYPE = config.MAP_TILES_TYPE;
export const MAP_ATTRIBUTION = config.MAP_ATTRIBUTION;
export const SHOW_EXTERNAL_MAP_LINKS = config.SHOW_EXTERNAL_MAP_LINKS;

export default config;
