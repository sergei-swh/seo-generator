# seo-generator

A single-source-of-truth generator for the `<title>`/meta description/Open
Graph/hreflang/JSON-LD block on a multilingual static site. Plain Node.js,
zero dependencies, no build framework, no npm install.

## Why

On a static multilingual site (no framework, no templating), it's easy to
end up hand-copying the same SEO strings — title, `og:title`, JSON-LD
`name` — into every language x page-type HTML file. That works until one
copy drifts from the others, which is easy to miss across a few dozen files.

This script keeps one data file as the source of truth and injects it into
every HTML file between two markers, so there's no second copy anywhere to
forget to update.

## Usage

1. Put these markers somewhere in each page's `<head>`:

   ```html
   <!-- SEO:START (generated — do not hand-edit between markers) -->
   <!-- SEO:END -->
   ```

2. Copy `seo-data.example.js` to `seo-data.js` next to your HTML files (or
   anywhere — you can point `--data` at it) and fill in your own content.
   See the comments in the example file for the shape.

3. Run it:

   ```bash
   node generate-seo.js --root <your-site-dir> [--data <path-to-seo-data.js>] [--check]
   ```

   - `--root` — directory your HTML files live in (default: current directory)
   - `--data` — path to your data file (default: `<root>/seo-data.js`)
   - `--check` — don't write anything, exit 1 if anything would change (for CI / pre-deploy)

## What it does NOT do

It only touches the block between the markers. It never touches the rest of
the page — layout, body copy, images — and it never creates new HTML files.
If your data file lists a page/language whose HTML file doesn't exist yet,
it's reported as missing and skipped, not created.

Content generation (writing the actual translated title/description text)
is also out of scope on purpose — this is a templating/consistency tool,
not a translator. Fill in `seo-data.js` yourself, by hand or with whatever
tooling (including an LLM) you like; the script just guarantees that
whatever you put there ends up correctly and consistently in every file.

## Adapting the JSON-LD

`generate-seo.js` ships with example JSON-LD builders (`itemLd`,
`breadcrumbLd`, `websiteLd`) using generic `Product`/`BreadcrumbList`/
`WebSite` schema.org types. Swap `itemLd` for whatever type actually fits
your content — `RealEstateListing`, `Article`, `Recipe`, `Event`, etc. —
the rest of the script (marker replacement, validation, `--check`) doesn't
need to change.

## Validation

Before writing anything, the script checks that every language listed in
`LANGS` actually has matching data in `paths`, `PAGES[*].perLang`, and
`homeLabel`. If it doesn't, it fails with an explicit list of what's
missing instead of silently writing a broken `hreflang` link (with
`undefined` in the URL) into every existing page. This isn't a
hypothetical — it's here because that exact bug happened once.

## License

MIT.
