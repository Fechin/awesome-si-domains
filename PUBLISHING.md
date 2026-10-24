# Website publishing

Public website: https://fechin.github.io/awesome-si-domains/

The repository remains the content source. Edit `README.md`, `domains/*.md`, `guides/*.md`, or the artwork in `assets/domains/`. A push to `main` builds and deploys the static website through `.github/workflows/pages.yml`.

## Local preview

Use Node.js 20 or newer (CI uses Node.js 24):

```sh
npm ci --ignore-scripts
npm run build
npm run check
```

The generated site is in `_site/` and is ignored by Git. Serve it under `/awesome-si-domains/`, matching the GitHub Pages project path. Source templates and progressive-enhancement assets are in `scripts/build-site.mjs` and `site/assets/`.

## Search and AI discovery

- Every domain article and guide is complete static HTML, including researched text, source links, available artwork, purchase links and related names. Search/filter controls enhance the directory without replacing its HTML links.
- Stable canonical URLs, unique page metadata, social previews, Article/CollectionPage/BreadcrumbList schema and `sitemap.xml` are generated during each build.
- `llms.txt`, `domains.json` and public Markdown source provide additional reading formats. These are conveniences, not guarantees of indexing or AI citation.
- The sitemap contains the homepage, all substantive domain articles and three guides. It uses each source file's Git modification date; CI checks out the full history.
- `https://fechin.github.io/robots.txt` controls this host. The project-local `robots.txt` is only a reference and cannot override host rules. Check the host root when changing crawler access. No crawler exclusions are added by this project.
- Submit `https://fechin.github.io/awesome-si-domains/sitemap.xml` in Google Search Console for the appropriate verified property. Search Console verification and indexing decisions are separate from publishing.

GitHub Pages settings should keep Source set to **GitHub Actions** and HTTPS enabled. Availability, pricing and transactions remain with the owner and external marketplaces; the website publishes the portfolio and its editorial research.
