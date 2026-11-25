# seo-generator

A single-source-of-truth generator for a multilingual static site: the
`<title>`/meta description/Open Graph/canonical/hreflang/JSON-LD block in every
page's head, optionally the body text, versioned links to CSS and JS, and the
`<lastmod>` dates in `sitemap.xml`. Plain Node.js (18 or newer), zero
dependencies, no build framework, no npm install.

## In production

This is extracted from the code running on
[girne-apartment-sale.com](https://girne-apartment-sale.com), a vanilla
HTML/CSS/JS site on Cloudflare Pages: 48 pages across 5 languages
(EN/RU/TR/PL/DE), made of 11 page types — a homepage, 4 property listings, 3
articles, 3 plain pages. Not every page exists in every language, and hreflang follows that. It
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
read from the same `assets/js/i18n.js` the browser uses, versioned asset links,
an article with a text fingerprint, and a sitemap. Edit
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
   - `--check` — don't write anything, exit 1 if anything would change or an
     article's text no longer matches its `dateModified` (for CI / pre-deploy)
   - `--article-hashes` — print the text fingerprint of every article

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

## Versioned links to CSS and JS

List your stylesheets and scripts in `ASSETS` and every link to them gets the
start of the file's sha256: `/assets/js/app.js?v=d7e7ed8e`. A changed file gets
a new link, so neither a CDN, nor a browser, nor Google's renderer draws fresh
HTML with a stale cached script; an unchanged file keeps its link and stays
cached. On the production site an old cached `app.js` kept overwriting a
`<title>` that had already been fixed in the HTML. See `assets.js`.

## Sitemap dates from git

If `<root>/sitemap.xml` exists, every `<lastmod>` for a page the data file knows
is set from git: today for a page with uncommitted changes, otherwise the date
of the last commit that changed the file. Hand-set dates freeze, and Google
stops trusting dates that never move. Commit on the day you generate and
`--check` stays clean. Nothing else in the sitemap is touched; unknown URLs and
pages missing from it are reported, not fixed. See `sitemap.js`.

A change to the asset versions alone doesn't count. Editing one script rewrites
the `?v=` on every page, and counting that gave every page today's date at once,
which tells a search engine nothing. Both the uncommitted page and each commit
in its history are compared with versions removed.

## Article dates

`datePublished` and `dateModified` are written with a time and a time zone
(`2026-10-01T00:00:00+02:00`, midnight in `TIME_ZONE`, UTC if unset): Google's
Rich Results Test rejects a bare date. A translation can carry its own dates in
`perLang`.

`dateModified` is typed by hand, and it's easy to edit an article and forget
it. Put a `textHash` next to it — the fingerprint of the page's `<article>`
text, from `--article-hashes` — and `--check` fails as soon as the text changes
while the date doesn't, printing the new fingerprint. See `article-text.js`.

## JSON-LD

Each page has a `type` that picks its JSON-LD:

| type | JSON-LD |
|---|---|
| `website` | WebSite |
| `item` | Product + BreadcrumbList |
| `listing` | RealEstateListing (Apartment or SingleFamilyResidence) + BreadcrumbList |
| `article` | Article + BreadcrumbList |
| `page` | BreadcrumbList |

On a multilingual site the text inside listing JSON-LD (the property name, the
address, the amenities) should be in the page's language too. Write it once in the
data file, in the default language, and add an `LD_LOCAL` table with the other
languages (see `example/seo-data.js`); a value with no translation is reported
instead of going out in the wrong language silently. `property.numberOfBedrooms` is
optional and sits next to `numberOfRooms`.

The builders are ordinary functions near the top of `generate-seo.js`. Swap or
add your own (`LocalBusiness`, `Event`, `Recipe`...) and register them in
`LD_BY_TYPE`; the rest of the script doesn't need to change.

## What it does NOT do

It only touches what's between the markers, the `src`/`href` of the files in
`ASSETS`, and the `<lastmod>` values. It never touches the rest of the page and
never creates HTML files: a page in the data
file whose file doesn't exist is reported as missing and skipped.

Writing the translated text is out of scope on purpose — this is a
consistency tool, not a translator. Fill in the data by hand or with whatever
tooling (including an LLM) you like; the script guarantees that whatever you put
there ends up correctly and consistently in every file.

## Validation

Before writing anything, the script checks that every language in `LANGS` has
matching data in `paths`, `PAGES[*].perLang` and `homeLabel`, that per-page
`langs` only name known languages, that articles have dates and an author,
that `TIME_ZONE` is a real time zone, that every file in `ASSETS` exists and
that `LD_LOCAL` only names languages from `LANGS`.
If not, it fails with a list of what's missing instead of writing a broken
`hreflang` link (with `undefined` in the URL) into every page. That isn't
hypothetical — it's here because that exact bug happened once.

## License

MIT.
