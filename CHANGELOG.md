# Changelog

## 2.1 — 2026-11-15

Fixes. The first three were found on the production site after 2.0.

- `RealEstateListing` offers had `businessFunction: "https://schema.org/Sell"`.
  That value doesn't exist; it is now GoodRelations
  `http://purl.org/goodrelations/v1#Sell`.
- Article `datePublished` and `dateModified` were bare dates (`2026-10-01`).
  Google's Rich Results Test reports them as "Invalid datetime value" and
  "missing a time zone". They are now midnight in `TIME_ZONE` with the offset
  for that day (`2026-10-01T00:00:00+02:00`); UTC if `TIME_ZONE` is unset, and
  a value that already has a time is left as is.
- `<lastmod>` moved for changes a reader can't see. On the production site,
  where asset versions came first, one edited script gave all 48 pages a new
  date, twice in a row, when five to eight had changed. `sitemap.js` now
  compares pages with asset versions removed, both against `HEAD` and through
  the history, and takes the date of the last commit that changed the page
  beyond them.
- The header comment and the "data file not found" message pointed to
  `seo-data.example.js`, which 2.0 replaced with `example/seo-data.js`.

New:

- `ASSETS`: links to these CSS and JS files get `?v=<sha256 prefix>`, so a cached
  old script can't redraw fresh HTML (`assets.js`). The stylesheet link in the
  head block is versioned the same way.
- `textHash` on articles: the fingerprint of the page's `<article>` text at
  `dateModified`. `--check` fails when the text changes and the date doesn't;
  `--article-hashes` prints the fingerprints (`article-text.js`).
- `perLang.<lang>.datePublished` / `dateModified` for a translation published or
  edited on its own dates.
- Validation of `TIME_ZONE` and of the files in `ASSETS`.

Data files from 2.0 keep working. Running 2.1 over them rewrites the listing and
article JSON-LD once, for the two fixes above; nothing else changes until you
add `ASSETS`, `TIME_ZONE` or `textHash`.

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
