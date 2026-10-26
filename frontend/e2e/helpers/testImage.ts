import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Writes a small deterministic PNG (blue/white checker) and returns its path. */
export function makeTestImage(dir: string, name = 'e2e-upload.png'): string {
  fs.mkdirSync(dir, { recursive: true });
  const w = 64, h = 64;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const on = ((x >> 3) + (y >> 3)) % 2 === 0;
    png.data[i] = on ? 0x32 : 0xff; png.data[i + 1] = on ? 0x77 : 0xff; png.data[i + 2] = on ? 0xae : 0xff; png.data[i + 3] = 0xff;
  }
  const p = path.join(dir, name);
  fs.writeFileSync(p, PNG.sync.write(png));
  return p;
}
