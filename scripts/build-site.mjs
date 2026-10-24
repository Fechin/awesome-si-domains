import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Marked } from 'marked';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '_site');
const base = '/awesome-si-domains/';
const origin = 'https://fechin.github.io';
const site = origin + base;
const repository = 'https://github.com/Fechin/awesome-si-domains';
const email = 'hedge.pike02@icloud.com';
const escape = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plain = s => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const description = s => s.length <= 170 ? s : s.slice(0, 167).replace(/\s+\S*$/, '') + '…';
const href = file => base + (file === 'README.md' ? '' : file.replace(/\.md$/, '/'));
const absolute = file => origin + href(file);
const slug = s => plain(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
const dateFor = file => {
  try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim() || '2026-10-24'; }
  catch { return '2026-10-24'; }
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
await cp(path.join(root, 'site/assets'), path.join(out, 'assets'), { recursive: true });

const stylesheetVersion = createHash('sha256').update(await readFile(path.join(root, 'site/assets/site.css'))).digest('hex').slice(0, 12);

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const categories = [];
let category;
let categoryId;
const summaries = new Map();
for (const line of readme.split('\n')) {
  const anchor = line.match(/^<a name="([^"]+)"><\/a>/);
  if (anchor) categoryId = anchor[1];
  const heading = line.match(/^## (.+)/);
  if (heading && categoryId && !['directory'].includes(categoryId) && !heading[1].startsWith('Make the name')) {
    category = { name: heading[1], id: categoryId, domains: [] };
    categories.push(category);
    categoryId = undefined;
  }
  const row = line.match(/^\| \*\*\[([^\]]+)\]\((domains\/[^)]+\.md)\)\*\* \| (.+) \|$/);
  if (row && category) {
    summaries.set(row[2], { name: row[1], summary: row[3], category });
    category.domains.push(row[2]);
  }
}

const domainCount = summaries.size;
const categoryCount = categories.length;
const homeDescription = `Explore ${domainCount} .si domains for sale for AI agents, research and creative tools, with researched meanings, business ideas and direct purchase enquiries.`;
const editorialDate = readme.match(/Editorial update: ([^.]+)\./)?.[1] || '24 October 2026';
const artworkCount = (await readdir(path.join(root, 'assets/domains'))).filter(file => file.endsWith('.webp')).length;

const files = ['README.md', ...(await readdir(path.join(root, 'domains'))).filter(f => f.endsWith('.md')).sort().map(f => 'domains/' + f), ...(await readdir(path.join(root, 'guides'))).filter(f => f.endsWith('.md')).sort().map(f => 'guides/' + f)];
const pages = [];
for (const file of files) {
  const markdown = await readFile(path.join(root, file), 'utf8');
  const heading = markdown.match(/^# (.+)$/m)?.[1];
  if (!heading) throw new Error(`Missing title: ${file}`);
  const firstParagraph = markdown.split(/\n\s*\n/).find(p => !/^(#|!\[|>|\[)/.test(p));
  const info = summaries.get(file);
  const image = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
  const page = { file, markdown, heading, title: file === 'README.md' ? 'Awesome .si Domains for Sale — Names for AI Businesses' : file.startsWith('domains/') ? `${heading.split(' — ')[0]} Domain for Sale — ${heading.split(' — ').slice(1).join(' — ')}` : heading,
    description: file === 'README.md' ? homeDescription : description(info?.summary || plain(firstParagraph || heading)), date: dateFor(file), url: absolute(file), info,
    image: image ? origin + base + path.posix.normalize(path.posix.join(path.posix.dirname(file), image)) : site + 'assets/social-card.png' };
  pages.push(page);
}
const domains = pages.filter(p => p.info);
const listedFiles = categories.flatMap(category => category.domains);
const articleCount = files.filter(file => file.startsWith('domains/')).length;
if (!domainCount || !categoryCount || domains.length !== articleCount || listedFiles.length !== domainCount || new Set(listedFiles).size !== domainCount) throw new Error(`Directory parse failed: ${domains.length} listed domains, ${articleCount} articles, ${categoryCount} categories`);

function resolveUrl(url, file) {
  const githubPrefix = repository + '/blob/main/';
  if (url.startsWith(githubPrefix)) url = url.slice(githubPrefix.length);
  else if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url;
  else url = path.posix.join(path.posix.dirname(file), url);
  const match = url.match(/^([^?#]*)(.*)$/);
  const target = path.posix.normalize(match[1]);
  return (target.endsWith('.md') ? href(target) : base + target) + match[2];
}

function render(page) {
  const ids = new Map();
  const marked = new Marked({ gfm: true, breaks: false,
    walkTokens(token) {
      if (['link', 'image'].includes(token.type)) token.href = resolveUrl(token.href, page.file);
    },
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slug(text);
        const count = ids.get(id) || 0;
        ids.set(id, count + 1);
        return `<h${depth} id="${id}${count ? '-' + count : ''}">${text}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        return `<img src="${escape(href)}" alt="${escape(text)}" width="1200" height="630" decoding="async"${title ? ` title="${escape(title)}"` : ''}>`;
      }
    }
  });
  return marked.parse(page.markdown.replace(/^# .+\n+/, '')).replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="Comparison table"><table>').replace(/<\/table>/g, '</table></div>');
}

const nav = `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner"><a class="brand" href="${base}" aria-label="Awesome .si Domains home"><span class="brand-mark">.si</span><span>Words with possibility.</span></a><nav aria-label="Main navigation"><a href="${base}#directory">The collection</a><a href="${href('guides/choose-an-ai-domain.md')}">Naming guide</a><a href="${href('guides/super-intelligence.md')}">Why .si?</a><a href="${href('guides/how-to-buy.md')}">How to buy <span aria-hidden="true">↗</span></a></nav></div></header>`;
const footer = `<footer class="site-footer"><div class="footer-inner"><div><a class="brand" href="${base}">Awesome .si Domains</a><p>Words with meaning. Names with possibility.</p><p>Curated by <a href="https://github.com/Fechin">Fechin</a>. Editorial content updated ${escape(editorialDate)}.</p></div><nav aria-label="Footer navigation"><a href="${repository}">GitHub source ↗</a><a href="${site}sitemap.xml">Sitemap</a><a href="${site}llms.txt">AI reading index</a><a href="mailto:${email}?subject=Domain%20enquiry">Email the owner</a></nav></div></footer>`;

function layout(page, body, extraSchema = [], noindex = false) {
  const graph = [
    { '@type': 'WebSite', '@id': site + '#website', url: site, name: 'Awesome .si Domains', description: `A curated collection of ${domainCount} .si domain names for sale, with researched meanings and product possibilities.`, inLanguage: 'en', publisher: { '@id': site + '#publisher' } },
    { '@type': 'Person', '@id': site + '#publisher', name: 'Fechin', url: 'https://github.com/Fechin' },
    { '@type': page.file === 'README.md' ? 'CollectionPage' : 'WebPage', '@id': page.url + '#webpage', url: page.url, name: page.heading, description: page.description, isPartOf: { '@id': site + '#website' }, inLanguage: 'en', dateModified: page.date, ...(!noindex ? { mainEntity: { '@id': page.url + '#content' } } : {}) },
    ...extraSchema
  ];
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}"><link rel="canonical" href="${page.url}"><meta name="theme-color" content="#f6f5ef"><meta property="og:type" content="${page.file === 'README.md' ? 'website' : 'article'}"><meta property="og:site_name" content="Awesome .si Domains"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${page.url}"><meta property="og:locale" content="en_US"><meta property="og:image" content="${page.image}"><meta property="og:image:alt" content="${escape(page.info ? page.info.name + ' brand artwork' : 'Awesome .si Domains — Words with meaning. Names with possibility.')}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(page.title)}"><meta name="twitter:description" content="${escape(page.description)}"><meta name="twitter:image" content="${page.image}"><link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg"><link rel="stylesheet" href="${base}assets/site.css?v=${stylesheetVersion}"><link rel="alternate" type="text/markdown" href="${site + page.file}" title="Markdown source"><link rel="alternate" type="application/json" href="${site}domains.json" title="Domain directory data"><link rel="sitemap" type="application/xml" href="${site}sitemap.xml"><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script><script src="${base}assets/site.js" defer></script></head><body>${nav}<main id="main" class="container">${body}</main>${footer}</body></html>\n`;
}

function card(page, featured = false) {
  const { name, summary, category } = page.info;
  return `<article class="domain-card" data-name="${escape(name)}" data-category="${category.id}" data-search="${escape(name + ' ' + category.name + ' ' + summary)}"><a class="card-art" href="${page.url}" tabindex="-1" aria-hidden="true"><img src="${page.image}" alt="" width="1200" height="630" loading="lazy" decoding="async"></a><div class="card-body"><p class="card-category">${escape(category.name)}</p><h3><a href="${page.url}">${escape(name)}</a></h3><p>${escape(summary)}</p><a class="card-link" href="${page.url}" aria-label="Explore ${escape(name)}">Explore the name <span aria-hidden="true">↗</span></a></div></article>`;
}

function purchaseSummary(page) {
  const listings = [...page.markdown.matchAll(/\[[^\]]+\]\((https:\/\/(?:www\.dynadot\.com\/market\/user-listings\/|www\.atom\.com\/view\/name\/)[^)]+)\)/g)];
  const contact = page.markdown.match(/\]\((mailto:[^)]+)\)/)?.[1];
  if (listings.length !== 1 || !contact) throw new Error(`Missing or ambiguous purchase information: ${page.file}`);
  const listing = listings[0][1];
  const marketplace = new URL(listing).hostname === 'www.dynadot.com' ? 'Dynadot' : 'Atom';
  return `<section class="domain-purchase" aria-labelledby="purchase-heading"><h2 id="purchase-heading">Acquire ${escape(page.info.name)}</h2><div class="hero-actions"><a class="button" href="${escape(listing)}">View listing on ${marketplace} ↗</a><a href="${escape(contact)}">Enquire about ${escape(page.info.name)} ↗</a></div><p>Domain name only. Confirm availability, pricing and terms with the owner or marketplace. <a href="${href('guides/how-to-buy.md')}">Purchase options</a>.</p></section>`;
}

const home = pages[0];
const directory = categories.map(c => `<section class="directory-section" id="${c.id}" data-category="${c.id}" aria-labelledby="heading-${c.id}"><div class="section-heading"><h2 id="heading-${c.id}">${escape(c.name)}</h2><span>${c.domains.length} names</span></div><div class="directory-grid">${c.domains.map(f => card(domains.find(p => p.file === f))).join('')}</div></section>`).join('');
const homeBody = `<section class="hero"><p class="eyebrow">A curated collection · ${domainCount} names · .si</p><h1>Awesome .si Domains for Sale</h1><p class="hero-tagline">Words with meaning.<br>Names with possibility.</p><p class="hero-copy">Find a name for your next intelligent business. Explore ${domainCount} .si domains for AI agents, research tools, creative software, and the ideas still taking shape. Every name comes with researched meanings and product possibilities.</p><div class="hero-actions"><a class="button" href="#directory">Explore the collection <span aria-hidden="true">↓</span></a><a href="${href('guides/choose-an-ai-domain.md')}">Start with a product idea ↗</a></div><p class="hero-note">In this collection, SI is a brand reading of <a href="${href('guides/super-intelligence.md')}">Super Intelligence</a>.</p></section><section class="collection-intro" id="directory" aria-labelledby="directory-heading"><div class="section-heading"><div><p class="eyebrow">The collection</p><h2 id="directory-heading">A word for what comes next.</h2></div><p>Choose a direction. Follow a name.<br>See what it could become.</p></div><nav class="category-links" aria-label="Browse domains by direction">${categories.map(c => `<a href="#${c.id}">${escape(c.name)} <span>${c.domains.length}</span></a>`).join('')}</nav><div class="directory-toolbar" hidden><div><label for="domain-search">Find a name or an idea</label><input type="search" id="domain-search" placeholder="Try audio, research, agents…" autocomplete="off"></div><div><label for="category-filter">Explore a direction</label><select id="category-filter"><option value="all">All ${categoryCount} directions</option>${categories.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('')}</select></div><button id="clear-filters" type="button">Clear filters</button></div><p id="result-count" aria-live="polite" aria-atomic="true">${domainCount} names across ${categoryCount} directions</p></section>${directory}<div id="empty-results" class="empty-results" hidden><h2>No names found.</h2><p>Try a broader idea or choose another direction.</p></div><section class="purchase-banner"><p class="eyebrow">Make the name yours</p><h2>A good idea deserves a fitting name.</h2><p>Enquire about a name, make an offer, or discuss a group of complementary domains. Availability and terms are confirmed directly or through the chosen marketplace.</p><div class="hero-actions"><a class="button" href="mailto:${email}?subject=Domain%20enquiry">Email the owner ↗</a><a href="${href('guides/how-to-buy.md')}">Explore purchase options</a></div><p class="purchase-note">The sale is for the domain name. Product directions are ideas for a future owner.</p></section>`;
await writeFile(path.join(out, 'index.html'), layout(home, homeBody, [{ '@type': 'ItemList', '@id': site + '#content', name: `${domainCount} .si domains for sale`, numberOfItems: domains.length, itemListElement: domains.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.info.name, url: p.url })) }]));

for (const page of pages.slice(1)) {
  const isDomain = !!page.info;
  const category = page.info?.category;
  const breadcrumbs = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${base}">The collection</a><span aria-hidden="true">/</span>${category ? `<a href="${base}#${category.id}">${escape(category.name)}</a><span aria-hidden="true">/</span>` : ''}<span aria-current="page">${escape(page.info?.name || page.heading)}</span></nav>`;
  const body = `${breadcrumbs}<div class="article-layout"><article class="article"><header class="article-header"><p class="eyebrow">${isDomain ? escape(category.name) + ' · Domain for sale' : 'The naming notebook'}</p><h1>${escape(page.heading)}</h1><p class="article-meta">By <a href="https://github.com/Fechin">Fechin</a> · Updated <time datetime="${page.date}">${page.date}</time></p></header>${isDomain ? purchaseSummary(page) : ''}<div class="article-body">${render(page)}</div></article><aside class="article-aside" aria-label="${isDomain ? 'Domain enquiry' : 'Explore the collection'}"><div class="aside-card"><p class="eyebrow">${isDomain ? 'Make it yours' : 'Find your name'}</p><h2>${escape(page.info?.name || `${domainCount} names. Your next idea.`)}</h2><p>${isDomain ? 'Discuss availability, an offer, or a group of complementary names with the owner.' : 'Explore researched meanings, brand character, and possibilities for your next business.'}</p><a class="button" href="${isDomain ? `mailto:${email}?subject=${encodeURIComponent('Domain enquiry: ' + page.info.name)}` : base + '#directory'}">${isDomain ? 'Enquire about this name ↗' : 'Browse all names ↗'}</a><a href="${href('guides/how-to-buy.md')}">How the purchase works</a><p class="aside-note">Domain name only. The businesses described are potential directions for a future owner.</p></div></aside></div>`;
  const article = { '@type': 'Article', '@id': page.url + '#content', headline: page.heading, description: page.description, image: page.image, author: { '@id': site + '#publisher' }, publisher: { '@id': site + '#publisher' }, dateModified: page.date, inLanguage: 'en', mainEntityOfPage: { '@id': page.url + '#webpage' }, ...(isDomain ? { articleSection: category.name, about: { '@type': 'Thing', name: page.info.name, description: 'A .si domain name offered for sale; the article describes possible future businesses.' } } : {}) };
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'The collection', item: site }, { '@type': 'ListItem', position: 2, name: page.info?.name || page.heading, item: page.url }] };
  const destination = path.join(out, page.file.replace(/\.md$/, ''), 'index.html');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, layout(page, body, [article, crumbs]));
}

// Preserve a public, readable source for every article; links retain the repository's directory structure.
for (const page of pages) await writeFile(path.join(out, page.file), page.markdown);
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p => `<url><loc>${escape(p.url)}</loc><lastmod>${p.date}</lastmod></url>`).join('')}</urlset>\n`);
await writeFile(path.join(out, 'robots.txt'), `# Project-level reference. Crawlers use the host-root /robots.txt.\nUser-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
const records = domains.map(p => ({ domain: p.info.name, category: p.info.category.name, summary: p.info.summary, url: p.url, image: p.image, markdown: site + p.file, updated: p.date }));
await writeFile(path.join(out, 'domains.json'), JSON.stringify({ name: 'Awesome .si Domains', url: site, description: 'Domain names for sale. Article product concepts are possibilities for a future owner; availability and terms require confirmation.', contact: email, count: records.length, domains: records }, null, 2));
await writeFile(path.join(out, 'llms.txt'), `# Awesome .si Domains\n\n> A curated directory of ${domainCount} .si domain names for sale, with researched name meanings and possible business directions.\n\nSI is a creative brand reading of Super Intelligence in this collection. Product concepts are ideas, not existing businesses or capabilities sold with the name. Confirm availability and purchase terms with the owner or the linked marketplace.\n\n## Directory\n\n- [Browse all names](${site}): complete directory by business direction\n- [Structured domain data](${site}domains.json): all ${domainCount} names, categories, summaries and source URLs\n- [Sitemap](${site}sitemap.xml): all canonical HTML pages\n\n## Guides\n\n${pages.filter(p => p.file.startsWith('guides/')).map(p => `- [${p.heading}](${p.url}): [Markdown](${site + p.file})`).join('\n')}\n\n## Domain articles\n\n${domains.map(p => `- [${p.heading}](${p.url}): ${p.info.summary} [Markdown](${site + p.file})`).join('\n')}\n\n## Contact and provenance\n\n- Owner: Fechin\n- Email: ${email}\n- Source repository: ${repository}\n- Content last updated: ${editorialDate}\n`);
await writeFile(path.join(out, '.nojekyll'), '');
const notFound = { ...home, title: 'Page not found — Awesome .si Domains', heading: 'Page not found', description: 'Find your way back to the .si domain collection.', url: site + '404.html' };
await writeFile(path.join(out, '404.html'), layout(notFound, `<section class="hero"><p class="eyebrow">404 · Page not found</p><h1>Let’s find a better direction.</h1><p class="hero-copy">That page could not be found. Explore the collection to find a name or a naming guide.</p><a class="button" href="${base}">Back to the collection ↗</a></section>`, [], true));
console.log(`Built ${pages.length} indexable pages (${domains.length} domain articles, 3 guides, homepage), ${artworkCount} artworks, sitemap and AI reading index.`);
