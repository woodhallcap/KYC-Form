// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const repoRoot = new URL('../../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, repoRoot), 'utf8');

describe('Vercel preview deployment', () => {
  it('has a vercel.json at the repo root, because the app lives in frontend/', () => {
    expect(existsSync(new URL('vercel.json', repoRoot))).toBe(true);
  });

  const config = () => JSON.parse(read('vercel.json'));

  it('builds the React app in frontend/ and serves only its dist folder', () => {
    const c = config();
    expect(c.installCommand).toBe('npm ci --prefix frontend');
    expect(c.buildCommand).toBe('npm run build --prefix frontend');
    expect(c.outputDirectory).toBe('frontend/dist');
  });

  it('never serves the repo root, which holds the PHP source and config.php', () => {
    const output: string = config().outputDirectory;
    expect(output).not.toBe('.');
    expect(output).not.toBe('');
    expect(output.startsWith('frontend/')).toBe(true);
  });

  it('uses relative asset paths so the built page works from any URL', () => {
    expect(read('frontend/vite.config.ts')).toContain("base: './'");
  });
});
