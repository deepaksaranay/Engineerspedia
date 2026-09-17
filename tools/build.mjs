#!/usr/bin/env node
/**
 * Engineerspedia build step — optional, zero dependencies, Node 18+.
 *
 *   node tools/build.mjs
 *
 * It does two things:
 *   1. VALIDATES data/site.json (the most common way to break the site is a
 *      typo'd category id or a missing content file — this catches both).
 *   2. GENERATES sitemap.xml and feed.xml from the data.
 *
 * The site works fine without ever running this. Nothing here is required
 * to render a page.
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(join(ROOT, p), 'utf8');
const write = (p, s) => writeFile(join(ROOT, p), s, 'utf8');
const exists = (p) => access(join(ROOT, p)).then(() => true, () => false);

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[c]));

const data = JSON.parse(await read('data/site.json'));
const { site, categories, articles } = data;

/* --- 1. validate ---------------------------------------------------------- */

const errors = [];
const warnings = [];

const catIds = new Set(categories.map((c) => c.id));
if (catIds.size !== categories.length) errors.push('Duplicate category id in categories[]');

for (const c of categories) {
  for (const field of ['id', 'name', 'emoji', 'color', 'blurb']) {
    if (!c[field]) errors.push(`Category "${c.id ?? '?'}" is missing "${field}"`);
  }
  if (c.color && !/^#[0-9a-f]{3,8}$/i.test(c.color)) {
    errors.push(`Category "${c.id}" has a colour that isn't a hex value: ${c.color}`);
  }
  if (!articles.some((a) => a.category === c.id)) {
    warnings.push(`Category "${c.id}" has no articles yet — it will render as an empty section.`);
  }
}

const slugs = new Set();
for (const a of articles) {
  for (const field of ['slug', 'title', 'dek', 'category', 'date', 'readMins']) {
    if (a[field] === undefined || a[field] === '') {
      errors.push(`Article "${a.slug ?? a.title ?? '?'}" is missing "${field}"`);
    }
  }
  if (slugs.has(a.slug)) errors.push(`Duplicate slug: ${a.slug}`);
  slugs.add(a.slug);

  if (!catIds.has(a.category)) {
    errors.push(`Article "${a.slug}" points at unknown category "${a.category}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) {
    errors.push(`Article "${a.slug}" has a date that isn't YYYY-MM-DD: ${a.date}`);
  }
  if (!(await exists(`content/${a.slug}.html`))) {
    errors.push(`Article "${a.slug}" has no body at content/${a.slug}.html`);
  }
  if (!a.description) {
    warnings.push(`Article "${a.slug}" has no "description" — search engines will fall back to the dek.`);
  }
}

for (const w of warnings) console.warn(`  warn  ${w}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} in data/site.json:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ data/site.json is valid — ${articles.length} articles across ${categories.length} categories`);

/* --- 2. generate ---------------------------------------------------------- */

const base = site.url.replace(/\/$/, '');
const articleUrl = (a) =>
  site.prettyUrls ? `${base}/articles/${a.slug}` : `${base}/article.html?slug=${a.slug}`;

const staticPages = ['/', '/articles.html', '/categories.html', '/mechanical-toolkit.html', '/about.html', '/contact.html'];
const newest = [...articles].sort((x, y) => (x.date < y.date ? 1 : -1));

await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map((p) => `  <url>
    <loc>${xml(base + p)}</loc>
    <changefreq>weekly</changefreq>
  </url>`).join('\n')}
${newest.map((a) => `  <url>
    <loc>${xml(articleUrl(a))}</loc>
    <lastmod>${a.date}</lastmod>
    <changefreq>monthly</changefreq>
  </url>`).join('\n')}
</urlset>
`);

const rfc822 = (d) => new Date(d + 'T09:00:00Z').toUTCString();

await write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xml(site.name)}</title>
  <link>${xml(base)}</link>
  <description>${xml(site.description)}</description>
  <language>en</language>
  <lastBuildDate>${rfc822(newest[0].date)}</lastBuildDate>
  <atom:link href="${xml(base)}/feed.xml" rel="self" type="application/rss+xml"/>
${newest.map((a) => `  <item>
    <title>${xml(a.title)}</title>
    <link>${xml(articleUrl(a))}</link>
    <guid isPermaLink="false">${xml(a.slug)}</guid>
    <pubDate>${rfc822(a.date)}</pubDate>
    <category>${xml(categories.find((c) => c.id === a.category).name)}</category>
    <description>${xml(a.description || a.dek)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);

console.log('✓ wrote sitemap.xml and feed.xml');
