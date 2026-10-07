// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const frontend = fileURLToPath(new URL('../', import.meta.url));

describe('brand', () => {
  it('never says Woodhall Capital in the front end', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
    const files = [...walk(join(frontend, 'src')), join(frontend, 'index.html')]
      .filter((p) => /\.(ts|tsx|css|html)$/.test(p) && !/\.test\.tsx?$/.test(p));
    expect(files.length).toBeGreaterThan(10);
    files.forEach((p) => expect(readFileSync(p, 'utf8'), p).not.toMatch(/Woodhall Capital/));
  });
});
