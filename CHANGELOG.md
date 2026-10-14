# Changelog

## 2.0 — 2026-10-14

- Body text between `<!-- BODY:key -->` markers, from a `BODY` function in the
  data file (`body.js`), so crawlers that don't run JavaScript get the copy.
- `<lastmod>` in `sitemap.xml` from git, if the file exists (`sitemap.js`).
- JSON-LD types `listing` (RealEstateListing) and `article`, next to `item`
  (Product), `website` and `page`.
- `PAGES[slug].langs` for pages that don't exist in every language; hreflang
  follows it.
- `DEFAULT_LANG`, defaulting to `en` as before.
- `example/`, a small working site, replaces `seo-data.example.js`.

Data files from 1.x keep working.

## 1.0 — 2026-09-08

- Head block generator: title, meta description, Open Graph, canonical,
  hreflang, JSON-LD (WebSite, Product, BreadcrumbList).
- `--check` for CI and pre-deploy.
- Validation of the data file against `LANGS` before anything is written.
- 2026-09-12: README says where it runs in production.
