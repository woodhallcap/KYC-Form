// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const frontend = new URL('../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, frontend), 'utf8');
const html = () => read('index.html');

/** The content of <meta property|name="key" content="..."> */
function meta(key: string): string | undefined {
  const tag = html().match(new RegExp(`<meta[^>]*(?:property|name)="${key}"[^>]*>`));
  return tag?.[0].match(/content="([^"]*)"/)?.[1];
}

describe('link preview (Open Graph / Twitter)', () => {
  it('describes the page for search and for people who paste the link', () => {
    expect(meta('description')).toMatch(/KYC|due diligence/i);
    expect(meta('description')!.length).toBeLessThanOrEqual(160);
    expect(meta('og:type')).toBe('website');
    expect(meta('og:site_name')).toBe('Woodhall Finance');
    expect(meta('og:title')).toBe('KYC / CDD Form — Woodhall Finance');
    expect(meta('og:description')!.length).toBeGreaterThan(40);
    expect(meta('og:description')!.length).toBeLessThanOrEqual(200);
    expect(meta('theme-color')).toBe('#224834');
  });

  it('builds absolute urls from VITE_SITE_URL, because crawlers need full addresses for the image', () => {
    expect(meta('og:url')).toBe('%VITE_SITE_URL%/');
    expect(meta('og:image')).toBe('%VITE_SITE_URL%/og-image.png');
    expect(meta('twitter:image')).toBe('%VITE_SITE_URL%/og-image.png');
  });

  it('ships a default site address that is https and has no trailing slash', () => {
    const env = read('.env');
    const value = env.match(/^VITE_SITE_URL=(.+)$/m)?.[1];
    expect(value).toMatch(/^https:\/\/[^/\s]+$/);
  });

  it('declares the image size and alt text so previews do not wait on the download', () => {
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt')).toBe('Woodhall Finance');
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe('KYC / CDD Form — Woodhall Finance');
  });

  it('has a real 1200x630 PNG with the logo, in the public folder so it ships at the site root', () => {
    expect(existsSync(new URL('public/og-image.png', frontend))).toBe(true);
    const png = readFileSync(new URL('public/og-image.png', frontend));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeGreaterThan(5_000);
    expect(png.length).toBeLessThan(300_000);
  });
});
