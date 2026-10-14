# seo-generator

A single-source-of-truth generator for a multilingual static site: the
`<title>`/meta description/Open Graph/canonical/hreflang/JSON-LD block in every
page's head, optionally the body text, and optionally the `<lastmod>` dates in
`sitemap.xml`. Plain Node.js, zero dependencies, no build framework, no npm
install.

## In production

This is extracted from the code running on
[girne-apartment-sale.com](https://girne-apartment-sale.com), a vanilla
HTML/CSS/JS site on Cloudflare Pages: 37 pages across 4 languages (EN/RU/TR/PL),
made of 10 page types — a homepage, 4 property listings, 2 articles, 3 plain
pages. Not every page exists in every language, and hreflang follows that. It
was written after hand-copied metadata drifted out of sync on exactly that site;
`--check` runs before every deploy there.

## Why

On a static multilingual site (no framework, no templating), it's easy to end
up hand-copying the same strings — title, `og:title`, JSON-LD `name` — into
every language x page-type HTML file. That works until one copy drifts from the
others, which is easy to miss across a few dozen files.

This script keeps one data file as the source of truth and writes it into every
HTML file between markers, so there's no second copy anywhere to forget to
update.

## Try it

```bash
node generate-seo.js --root example --check
```

`example/` is a small working site: two languages, five page types, body text
read from the same `assets/js/i18n.js` the browser uses, and a sitemap. Edit
`example/seo-data.js` or the dictionary and run it again without `--check`.

## Usage

1. Put these markers in each page's `<head>`:

   ```html
   <!-- SEO:START (generated — do not hand-edit between markers) -->
   <!-- SEO:END -->
   ```

2. Copy `example/seo-data.js` next to your HTML files (or anywhere — point
   `--data` at it) and fill in your own content. The comments in it explain the
   shape.

3. Run it:

   ```bash
   node generate-seo.js --root <your-site-dir> [--data <path-to-seo-data.js>] [--check]
   ```

   - `--root` — directory your HTML files live in (default: current directory)
   - `--data` — path to your data file (default: `<root>/seo-data.js`)
   - `--check` — don't write anything, exit 1 if anything would change (for CI / pre-deploy)

File names follow one rule: the default language has no suffix
(`house.html`), every other language does (`house-fr.html`).

## Body text for crawlers that don't run JavaScript

If your copy lives in a JavaScript dictionary and a script fills the page on
load, browsers and Googlebot see the text and many other crawlers don't. On the
production site a plain request returned 17 characters of visible text for the
homepage and 23 for a listing. You can check your own pages in ten seconds:

```bash
curl -s -A 'GPTBot/1.0' https://example.com/your-page | \
  python3 -c "import sys,re,html; b=sys.stdin.read(); b=b[b.index('<body'):]; \
  b=re.sub(r'<script.*?</script>','',b,flags=re.S); \
  print(len(re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',b))).strip()))"
```

To fix it, put markers inside the containers your script already fills:

```html
<p data-text><!-- BODY:text --><!-- /BODY:text --></p>
```

and export a `BODY` function from the data file: `(slug, lang) => ({ key: html })`.
If it reads the same dictionary the browser uses (the example does exactly
that), the static text can't drift from what the script renders. The script can
go on redrawing the same containers, so a language switcher keeps working.
Values are inserted as-is: escape plain text yourself. See `body.js`.

## Sitemap dates from git

If `<root>/sitemap.xml` exists, every `<lastmod>` for a page the data file knows
is set from git: today for a page with uncommitted changes, otherwise the date
of the last commit that touched the file. Hand-set dates freeze, and Google
stops trusting dates that never move. Commit on the day you generate and
`--check` stays clean. Nothing else in the sitemap is touched; unknown URLs and
pages missing from it are reported, not fixed. See `sitemap.js`.

## JSON-LD

Each page has a `type` that picks its JSON-LD:

| type | JSON-LD |
|---|---|
| `website` | WebSite |
| `item` | Product + BreadcrumbList |
| `listing` | RealEstateListing (Apartment or SingleFamilyResidence) + BreadcrumbList |
| `article` | Article + BreadcrumbList |
| `page` | BreadcrumbList |

The builders are ordinary functions near the top of `generate-seo.js`. Swap or
add your own (`LocalBusiness`, `Event`, `Recipe`...) and register them in
`LD_BY_TYPE`; the rest of the script doesn't need to change.

## What it does NOT do

It only touches what's between the markers and the `<lastmod>` values. It never
touches the rest of the page and never creates HTML files: a page in the data
file whose file doesn't exist is reported as missing and skipped.

Writing the translated text is out of scope on purpose — this is a
consistency tool, not a translator. Fill in the data by hand or with whatever
tooling (including an LLM) you like; the script guarantees that whatever you put
there ends up correctly and consistently in every file.

## Validation

Before writing anything, the script checks that every language in `LANGS` has
matching data in `paths`, `PAGES[*].perLang` and `homeLabel`, that per-page
`langs` only name known languages, and that articles have dates and an author.
If not, it fails with a list of what's missing instead of writing a broken
`hreflang` link (with `undefined` in the URL) into every page. That isn't
hypothetical — it's here because that exact bug happened once.

## License

MIT.
