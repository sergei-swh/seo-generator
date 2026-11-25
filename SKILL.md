---
name: seo-generator
description: Generates the head metadata of a multilingual static HTML site from one data file. It writes the title, meta description, Open Graph, canonical, hreflang and JSON-LD, and sitemap lastmod dates from git. Use when the user has a plain HTML site in several languages and asks to add or fix hreflang, canonical, Open Graph or JSON-LD, to keep titles and descriptions in sync across language files, or to check that they have not drifted.
when_to_use: |
  - A static site (no framework, no templating) with one HTML file per language and page
  - The user wants hreflang, canonical, og:* tags or structured data written consistently
  - Titles or descriptions were copied by hand into many files and have drifted apart
  - The user wants a pre-deploy check that the generated head blocks are current
  - Do NOT use for sites built with a framework that already templates its head (Next.js, Astro, Hugo, etc.)
---

# seo-generator

One data file (`seo-data.js`) is the single source of truth. The generator writes it into every
HTML file between two markers, so there is no second copy to forget to update. Plain Node.js 18+,
no dependencies, nothing to install. MIT licence.

Source and full documentation: https://github.com/sergei-swh/seo-generator

## What it writes

- The block between `<!-- SEO:START -->` and `<!-- SEO:END -->` in each page's `<head>`: title, meta
  description, Open Graph, canonical, hreflang (including x-default), JSON-LD.
- Optionally: body text between `<!-- BODY:key -->` markers, `?v=<hash>` on links to CSS and JS, and
  `<lastmod>` dates in `sitemap.xml` taken from git.
- Page types: `website`, `item` (Product), `listing` (RealEstateListing), `article` (Article with dates
  and a text fingerprint), `page` (breadcrumbs only). Every type except `website` also gets BreadcrumbList.

It never touches the rest of the page, never creates HTML files and never translates anything.

## Steps

1. **Find the generator.** Look for `generate-seo.js` in the project. If it is not there, tell the user
   where it lives (the repository above) and ask before fetching it. Do not fetch anything unasked.
2. **Look at the site before writing data.** List the HTML files and work out the naming rule: the
   default language has no suffix (`house.html`), every other language does (`house-fr.html`). Note which
   pages exist in which languages, because hreflang follows that.
3. **Add the markers** to each page's `<head>`, once:
   ```html
   <!-- SEO:START (generated — do not hand-edit between markers) -->
   <!-- SEO:END -->
   ```
   Remove the hand-written title, description, canonical, hreflang, og:* and JSON-LD that the generator
   will now write, so nothing appears twice. Show the user the first edited file before doing the rest.
4. **Write `seo-data.js`** from `example/seo-data.js` in the repository: `DOMAIN`, `LANGS`, `paths`,
   `homeLabel` and one entry in `PAGES` per page, with `perLang` text for each language. Take the text
   from the pages that already exist. If a language has no text for a page, say which one and ask; do
   not invent a translation, a price, a date or an address.
5. **Check, then run.**
   ```bash
   node generate-seo.js --root <site-dir> --check   # writes nothing, exits 1 if anything would change
   node generate-seo.js --root <site-dir>
   ```
   Before it writes anything the generator verifies that every language in `LANGS` has data for every
   page, and fails with a list of what is missing. Fix the list, do not work around it.
6. **Show the result.** Summarise the files changed (`git diff --stat`) and open one page in the default
   language and one in another to confirm title, hreflang and JSON-LD. Leave committing and deploying to
   the user.

## Things worth knowing

- Never edit by hand between the markers: the next run overwrites it.
- Articles carry `dateModified`. Put a `textHash` next to it (from `--article-hashes`) and `--check`
  fails when the article text changes but the date does not. Use real dates only.
- `TIME_ZONE` (an IANA name) turns the short dates in the data file into dates with a time zone, which
  structured-data validators require.
- `LD_LOCAL` translates the text inside listing JSON-LD (property name, address, amenities) into the
  page's language. A value with no translation is reported once instead of going out in the wrong language.
- `lastmod` in the sitemap comes from git: a page with an uncommitted change gets today's date, the
  others the date of their last commit. Commit in the same day as generating.
- Run `--check` in CI or before every deploy; that is what it is for.

## Example

`example/` in the repository is a small working site: two languages, five page types, an article with a
fingerprint, a sitemap.

```bash
node generate-seo.js --root example --check
```

Edit `example/seo-data.js` (a widget workshop in English and French), run it again without `--check`
and compare the HTML files with `git diff`.
