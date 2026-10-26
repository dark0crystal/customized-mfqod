/**
 * Pixel diff of two capture directories.
 *
 *   A_DIR=/shots/baseline B_DIR=/shots/candidate OUT=/shots/diff [FAIL_PCT=0.1] [PM_THRESHOLD=0.1] npx tsx scripts/compare.ts
 *
 * Writes OUT/report.json ({summary, results[]}) and OUT/<same path>.png diff images for every
 * non-identical pair. Images with different sizes are padded (padding counts as diff) and flagged.
 * Exit code 1 when FAIL_PCT is set and any image exceeds it, or an image is missing in B.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const A_DIR = path.resolve(process.env.A_DIR || '');
const B_DIR = path.resolve(process.env.B_DIR || '');
const OUT = path.resolve(process.env.OUT || 'out/diff');
const FAIL_PCT = process.env.FAIL_PCT ? Number(process.env.FAIL_PCT) : null;
const PM_THRESHOLD = Number(process.env.PM_THRESHOLD || '0.1');

type Result = {
  file: string;
  status: 'identical' | 'different' | 'missing-in-b' | 'missing-in-a';
  diffPixels?: number;
  totalPixels?: number;
  diffPct?: number;
  sizeA?: [number, number];
  sizeB?: [number, number];
  sizeMismatch?: boolean;
  diffImage?: string;
};

function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p, base);
    return d.name.endsWith('.png') ? [path.relative(base, p)] : [];
  });
}

function pad(img: PNG, w: number, h: number): PNG {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0); // transparent black: always differs from real content
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

function main() {
  if (!process.env.A_DIR || !process.env.B_DIR) {
    console.error('Usage: A_DIR=... B_DIR=... OUT=... tsx scripts/compare.ts');
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const aFiles = walk(A_DIR);
  const bSet = new Set(walk(B_DIR));
  const results: Result[] = [];
  for (const f of aFiles) {
    if (!bSet.has(f)) {
      results.push({ file: f, status: 'missing-in-b' });
      continue;
    }
    bSet.delete(f);
    const a = PNG.sync.read(fs.readFileSync(path.join(A_DIR, f)));
    const b = PNG.sync.read(fs.readFileSync(path.join(B_DIR, f)));
    const w = Math.max(a.width, b.width);
    const h = Math.max(a.height, b.height);
    const pa = pad(a, w, h);
    const pb = pad(b, w, h);
    const diff = new PNG({ width: w, height: h });
    const n = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: PM_THRESHOLD, includeAA: false, alpha: 0.2 });
    const r: Result = {
      file: f,
      status: n === 0 ? 'identical' : 'different',
      diffPixels: n,
      totalPixels: w * h,
      diffPct: +((n / (w * h)) * 100).toFixed(4),
      sizeA: [a.width, a.height],
      sizeB: [b.width, b.height],
      sizeMismatch: a.width !== b.width || a.height !== b.height,
    };
    if (n > 0) {
      const dp = path.join(OUT, f);
      fs.mkdirSync(path.dirname(dp), { recursive: true });
      fs.writeFileSync(dp, PNG.sync.write(diff));
      r.diffImage = path.relative(OUT, dp);
    }
    results.push(r);
  }
  for (const f of bSet) results.push({ file: f, status: 'missing-in-a' });
  results.sort((x, y) => (y.diffPct ?? 101) - (x.diffPct ?? 101) || x.file.localeCompare(y.file));

  const compared = results.filter((r) => r.diffPct !== undefined);
  const pcts = compared.map((r) => r.diffPct!);
  const summary = {
    aDir: A_DIR,
    bDir: B_DIR,
    pixelmatchThreshold: PM_THRESHOLD,
    failPct: FAIL_PCT,
    compared: compared.length,
    identical: results.filter((r) => r.status === 'identical').length,
    different: results.filter((r) => r.status === 'different').length,
    sizeMismatch: compared.filter((r) => r.sizeMismatch).length,
    missingInB: results.filter((r) => r.status === 'missing-in-b').length,
    missingInA: results.filter((r) => r.status === 'missing-in-a').length,
    maxDiffPct: pcts.length ? Math.max(...pcts) : 0,
    meanDiffPct: pcts.length ? +(pcts.reduce((s, x) => s + x, 0) / pcts.length).toFixed(4) : 0,
    overFailPct: FAIL_PCT === null ? null : compared.filter((r) => r.diffPct! > FAIL_PCT).map((r) => r.file),
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ summary, results }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const r of results.filter((r) => r.status !== 'identical').slice(0, 40)) {
    console.log(`${r.status.padEnd(13)} ${String(r.diffPct ?? '').padStart(8)}%  ${r.file}${r.sizeMismatch ? `  size ${r.sizeA} vs ${r.sizeB}` : ''}`);
  }
  const fail = summary.missingInB > 0 || (FAIL_PCT !== null && (summary.overFailPct?.length ?? 0) > 0);
  process.exit(fail ? 1 : 0);
}

main();
