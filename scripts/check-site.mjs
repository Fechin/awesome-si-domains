import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '_site');
const site = new URL('https://fechin.github.io/awesome-si-domains/');
const sourceDomains = (await readdir(path.join(root, 'domains'))).filter(file => file.endsWith('.md'));
const sourceGuides = (await readdir(path.join(root, 'guides'))).filter(file => file.endsWith('.md'));
const sourceArtworks = (await readdir(path.join(root, 'assets/domains'))).filter(file => file.endsWith('.webp'));
const expectedDomainCount = sourceDomains.length;
const expectedContentCount = 1 + expectedDomainCount + sourceGuides.length;
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|#39);/gi, (_, entity) => {
  if (/^#x/i.test(entity)) return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
  return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[entity.toLowerCase()];
});
const tagsFor = html => Array.from(html.matchAll(/<([a-z][\w:-]*)\b([^>]*?)\/?\s*>/gi), match => {
  const attributes = {};
  for (const attribute of match[2].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[attribute[1].toLowerCase()] = decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
  }
  return { name: match[1].toLowerCase(), attributes };
});
const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else files.push(filename);
  }
  return files;
};
const relative = filename => path.relative(output, filename);
const urlFor = filename => new URL(relative(filename).split(path.sep).join('/').replace(/index\.html$/, ''), site);
const parsed = new Map();

async function localTarget(value, referringUrl, label, checkAnchor = true) {
  let url;
  try { url = new URL(value, referringUrl); }
  catch { errors.push(`${label}: invalid URL ${value}`); return; }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== site.origin) return;
  if (!url.pathname.startsWith(site.pathname)) {
    errors.push(`${label}: same-site URL escapes the project base: ${url.href}`);
    return;
  }
  let filename;
  try {
    filename = path.resolve(output, decodeURIComponent(url.pathname.slice(site.pathname.length)));
    assert(filename === output || filename.startsWith(output + path.sep), `${label}: URL escapes the output directory`);
    let info = await stat(filename);
    if (info.isDirectory()) {
      filename = path.join(filename, 'index.html');
      info = await stat(filename);
    }
    if (!info.isFile()) throw new Error('Not a file');
  } catch {
    errors.push(`${label}: missing local target ${url.pathname}`);
    return;
  }
  if (checkAnchor && url.hash && filename.endsWith('.html')) {
    const page = parsed.get(filename);
    let anchor;
    try { anchor = decodeURIComponent(url.hash.slice(1)); }
    catch { errors.push(`${label}: invalid encoded anchor ${url.hash}`); return; }
    // The text-fragment directive follows a normal anchor, or works without one.
    anchor = anchor.split(':~:text=')[0];
    if (anchor) assert(page?.anchors.has(anchor), `${label}: missing anchor ${url.hash} in ${relative(filename)}`);
  }
  return filename;
}

let files;
try { files = await walk(output); }
catch { console.error('Build output is missing. Run npm run build first.'); process.exit(1); }

const htmlFiles = files.filter(filename => filename.endsWith('.html'));
for (const filename of htmlFiles) {
  const html = await readFile(filename, 'utf8');
  const tags = tagsFor(html);
  const metas = new Map(tags.filter(tag => tag.name === 'meta').map(tag => [tag.attributes.name || tag.attributes.property || (tag.attributes.charset ? 'charset' : ''), tag.attributes.content ?? tag.attributes.charset]));
  const canonical = tags.filter(tag => tag.name === 'link' && tag.attributes.rel?.split(/\s+/).includes('canonical'));
  const title = decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const anchors = new Set(tags.flatMap(tag => [tag.attributes.id, tag.name === 'a' ? tag.attributes.name : undefined]).filter(Boolean));
  parsed.set(filename, { html, tags, metas, canonical, title, anchors });
}

const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
const sitemapUrls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), match => decode(match[1]));
assert(sitemapUrls.length === expectedContentCount, `Sitemap must have ${expectedContentCount} content URLs; found ${sitemapUrls.length}`);
assert(new Set(sitemapUrls).size === sitemapUrls.length, 'Sitemap contains duplicate URLs');
assert(sitemapUrls.filter(url => url.includes('/domains/')).length === expectedDomainCount, 'Sitemap must include every domain article');
assert(sitemapUrls.filter(url => url.includes('/guides/')).length === sourceGuides.length, 'Sitemap must include every guide');
assert(sitemapUrls.includes(site.href), 'Sitemap is missing the homepage');
const sitemapFiles = new Set();
for (const url of sitemapUrls) {
  assert(url.startsWith(site.href) && url.endsWith('/'), `Invalid canonical sitemap URL: ${url}`);
  const filename = await localTarget(url, site, 'Sitemap');
  if (filename) {
    sitemapFiles.add(filename);
    assert(parsed.get(filename)?.canonical[0]?.attributes.href === url, `Sitemap and page canonical disagree: ${url}`);
  }
}

const titles = new Map();
const descriptions = new Map();
for (const [filename, page] of parsed) {
  const label = relative(filename);
  const pageUrl = urlFor(filename);
  const { html, tags, metas, canonical, title } = page;
  const isContent = sitemapFiles.has(filename);
  assert(tags.filter(tag => tag.name === 'h1').length === 1, `${label}: expected exactly one H1`);
  assert(/<!doctype html>/i.test(html), `${label}: missing HTML doctype`);
  assert(tags.find(tag => tag.name === 'html')?.attributes.lang === 'en', `${label}: missing English page language`);
  assert(canonical.length === 1, `${label}: expected exactly one canonical URL`);
  assert(canonical[0]?.attributes.href === pageUrl.href, `${label}: canonical must match the public page URL`);
  assert(title.length > 0, `${label}: missing title`);
  for (const key of ['description', 'charset', 'viewport', 'robots', 'og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert(Boolean(metas.get(key)), `${label}: missing ${key} metadata`);
  }
  assert(metas.get('og:url') === pageUrl.href, `${label}: Open Graph URL and canonical disagree`);
  assert(metas.get('og:title') === title && metas.get('twitter:title') === title, `${label}: social titles and page title disagree`);
  assert(metas.get('og:description') === metas.get('description') && metas.get('twitter:description') === metas.get('description'), `${label}: social descriptions disagree`);
  if (isContent) {
    assert(!/noindex/i.test(metas.get('robots') || ''), `${label}: content page must be indexable`);
    for (const [value, map, field] of [[title, titles, 'title'], [metas.get('description'), descriptions, 'description']]) {
      assert(!map.has(value), `${label}: duplicate ${field} with ${map.get(value)}`);
      map.set(value, label);
    }
  } else {
    assert(label === '404.html', `${label}: unexpected HTML page outside sitemap`);
    assert(/noindex/i.test(metas.get('robots') || ''), `${label}: error page must be noindex`);
  }

  const schema = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  assert(schema.length > 0, `${label}: missing JSON-LD`);
  for (const [, json] of schema) {
    try {
      const data = JSON.parse(json);
      assert(data['@context'] === 'https://schema.org', `${label}: incorrect schema context`);
      assert(Array.isArray(data['@graph']) && data['@graph'].length > 0, `${label}: missing schema graph`);
    } catch (error) { errors.push(`${label}: invalid JSON-LD (${error.message})`); }
  }

  for (const tag of tags) {
    for (const attribute of ['href', 'src']) {
      const value = tag.attributes[attribute];
      if (!value) continue;
      if (attribute === 'href' && /\.md(?:[?#]|$)/i.test(value)) {
        const markdownAlternate = tag.name === 'link' && tag.attributes.rel?.split(/\s+/).includes('alternate') && tag.attributes.type === 'text/markdown';
        assert(markdownAlternate || 'download' in tag.attributes, `${label}: navigation still points to Markdown: ${value}`);
      }
      await localTarget(value, pageUrl, `${label} ${tag.name}[${attribute}]`);
    }
  }
  for (const key of ['og:image', 'twitter:image']) {
    if (metas.get(key)) await localTarget(metas.get(key), pageUrl, `${label} ${key}`, false);
  }
}
assert(htmlFiles.length === expectedContentCount + 1, `Expected ${expectedContentCount} content pages and one 404; found ${htmlFiles.length} HTML pages`);

const directory = JSON.parse(await readFile(path.join(output, 'domains.json'), 'utf8'));
const records = directory.domains || [];
assert(directory.count === expectedDomainCount && records.length === expectedDomainCount, 'domains.json must contain every domain article');
assert(new Set(records.map(record => record.domain.toLowerCase())).size === expectedDomainCount, 'domains.json contains duplicate domain names');
assert(new Set(records.map(record => record.url)).size === expectedDomainCount, 'domains.json contains duplicate article URLs');
const artworks = files.filter(filename => /[/\\]assets[/\\]domains[/\\][^/\\]+\.webp$/.test(filename));
assert(artworks.length === sourceArtworks.length, `Expected ${sourceArtworks.length} domain artworks; found ${artworks.length}`);
for (const record of records) {
  const label = `domains.json ${record.domain}`;
  for (const field of ['domain', 'category', 'summary', 'url', 'image', 'markdown', 'updated']) {
    assert(typeof record[field] === 'string' && record[field].trim().length > 0, `${label}: missing ${field}`);
  }
  assert(sitemapUrls.includes(record.url), `${label}: article is missing from sitemap`);
  const sourceRelative = new URL(record.markdown).pathname.slice(site.pathname.length);
  assert(sourceRelative.startsWith('domains/') && sourceDomains.includes(path.basename(sourceRelative)), `${label}: unexpected Markdown source`);
  const source = await readFile(path.join(root, sourceRelative), 'utf8');
  const sourceImage = source.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
  const expectedImage = sourceImage ? new URL(sourceImage, new URL(sourceRelative, site)).href : `${site.href}assets/social-card.png`;
  assert(record.image === expectedImage, `${label}: image does not match the article artwork or its shared fallback`);
  if (sourceArtworks.includes(`${record.domain.toLowerCase()}.webp`)) {
    assert(record.image === `${site.href}assets/domains/${record.domain.toLowerCase()}.webp`, `${label}: existing dedicated artwork must remain in use`);
  }
  assert(/^\d{4}-\d{2}-\d{2}$/.test(record.updated), `${label}: invalid update date`);
  await localTarget(record.url, site, label);
  await localTarget(record.image, site, label, false);
  await localTarget(record.markdown, site, label, false);
}
const aiIndex = await readFile(path.join(output, 'llms.txt'), 'utf8');
for (const url of sitemapUrls) assert(aiIndex.includes(url), `AI reading index is missing ${url}`);
assert(files.some(filename => relative(filename) === '.nojekyll'), 'Missing .nojekyll marker');

if (errors.length) {
  console.error(`Site integrity check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Site integrity check passed: ${expectedContentCount} canonical content pages, unique metadata, valid JSON-LD, internal links and anchors, ${expectedDomainCount} domain records and ${artworks.length} artworks.`);
}
