// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const frontend = new URL('../', import.meta.url);
const file = (name: string) => new URL(`public/${name}`, frontend);
const html = () => readFileSync(new URL('index.html', frontend), 'utf8');

/** The attributes of the <link> tag whose rel is `rel` (and, when given, whose href is `href`). */
function link(rel: string, href?: string): Record<string, string> | undefined {
  const tags = html().match(/<link\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    const attrs = Object.fromEntries([...tag.matchAll(/(\w[\w-]*)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    if (attrs.rel === rel && (href === undefined || attrs.href === href)) return attrs;
  }
  return undefined;
}

describe('tab icon', () => {
  it('has an SVG icon that is just the logo tree: one square-viewBox path in the logo copper', () => {
    const svg = readFileSync(file('favicon.svg'), 'utf8');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
    expect(w).toBeCloseTo(h, 1);
    expect(svg.match(/<path\b/g)).toHaveLength(1);
    expect(svg).toContain('#b48569');
  });

  it('has a 1x ICO with 16, 32 and 48 pixel images for older browsers', () => {
    const ico = readFileSync(file('favicon.ico'));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('has a 180x180 opaque PNG for iPhone and iPad home screens', () => {
    const png = readFileSync(file('apple-touch-icon.png'));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
    // PNG colour type 2 = RGB with no alpha, so iOS has no transparent corners to fill with black
    expect(png[25]).toBe(2);
  });

  it('links all three icons from the page, and every linked file exists', () => {
    const ico = link('icon', '/favicon.ico');
    const svg = link('icon', '/favicon.svg');
    const apple = link('apple-touch-icon', '/apple-touch-icon.png');
    expect(ico).toBeDefined();
    expect(svg?.type).toBe('image/svg+xml');
    expect(apple).toBeDefined();
    for (const l of [ico, svg, apple]) {
      expect(existsSync(file(l!.href.replace(/^\//, ''))), l!.href).toBe(true);
    }
  });

  it('does not ship a stray 32px PNG that nothing links to', () => {
    expect(existsSync(file('favicon-32.png'))).toBe(false);
  });
});
