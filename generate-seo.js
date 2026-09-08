#!/usr/bin/env node
// Regenerates the <!-- SEO:START --> .. <!-- SEO:END --> block in every
// *.html file listed in your data file — a single source of truth for
// title / meta description / Open Graph / hreflang / JSON-LD, so a
// multilingual static site never has that block hand-duplicated (and
// drifting) across every language x page-type file.
//
// Zero dependencies — only Node's built-in fs/path. No build step, no
// framework, nothing to install.
//
// Usage:
//   node generate-seo.js [--root <dir>] [--data <file>] [--check]
//
//   --root   directory the HTML files live in (default: current directory)
//   --data   path to your data module (default: <root>/seo-data.js)
//   --check  don't write anything; exit 1 if any file would change
//            (use this in CI / as a pre-deploy check)
//
// Your data file must export: DOMAIN, LANGS, STYLESHEET_PATH, paths,
// homeLabel, PAGES — see seo-data.example.js for the shape and comments.
// It's plain data (a CommonJS module), not config for this script — adapt
// buildHead()/the *Ld() functions below for your own page types and schema.

const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const CHECK = process.argv.includes("--check");
const ROOT = path.resolve(arg("--root", "."));
const DATA_PATH = path.resolve(arg("--data", path.join(ROOT, "seo-data.js")));

if (!fs.existsSync(DATA_PATH)) {
  console.error(`Data file not found: ${DATA_PATH}`);
  console.error(`Pass --data <path> or put a seo-data.js in --root. See seo-data.example.js for the shape.`);
  process.exit(1);
}

const { DOMAIN, LANGS, STYLESHEET_PATH, paths, homeLabel, PAGES } = require(DATA_PATH);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hreflangBlock(slug) {
  const p = paths[slug];
  const lines = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${DOMAIN}${p[l]}">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${DOMAIN}${p.en}">`);
  return lines.join("\n");
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

// --- Example JSON-LD builders below. These are the part you customize per
// project — swap `itemLd`/`breadcrumbLd`/`websiteLd` for whatever schema.org
// types fit your content (Product, Article, LocalBusiness, ...). The rest of
// this file (validation, marker replacement, --check) is generic and
// shouldn't need to change. ---

function itemLd(slug, lang, page, url) {
  // Example: schema.org Product. Swap for RealEstateListing, Article, etc.
  const l = page.item;
  const t = page.perLang[lang];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t.title,
    description: t.description,
    inLanguage: lang,
    url,
    image: page.ogImage,
    offers: {
      "@type": "Offer",
      price: l.offers.price,
      priceCurrency: l.offers.priceCurrency,
      availability: "https://schema.org/InStock",
    },
  };
}

function breadcrumbLd(slug, lang, page, url) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeLabel[lang], item: `${DOMAIN}${paths.index[lang]}` },
      { "@type": "ListItem", position: 2, name: page.perLang[lang].breadcrumbPage, item: url },
    ],
  };
}

function websiteLd(lang, t, url) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t.websiteName,
    url,
    description: t.websiteDescription,
    inLanguage: lang,
  };
}

function buildHead(slug, lang) {
  const page = PAGES[slug];
  const t = page.perLang[lang];
  const url = `${DOMAIN}${paths[slug][lang]}`;
  const ogDescription = t.ogDescription || t.description;

  const lines = [];
  lines.push(`<title>${esc(t.title)}</title>`);
  lines.push(`<meta name="description" content="${esc(t.description)}">`);
  lines.push(`<meta property="og:title" content="${esc(t.title)}">`);
  lines.push(`<meta property="og:description" content="${esc(ogDescription)}">`);
  if (page.ogImage) lines.push(`<meta property="og:image" content="${page.ogImage}">`);
  lines.push(`<meta property="og:type" content="website">`);
  lines.push(`<meta property="og:url" content="${url}">`);
  lines.push(`<link rel="canonical" href="${url}">`);
  lines.push(hreflangBlock(slug));
  if (STYLESHEET_PATH) lines.push(`<link rel="stylesheet" href="${STYLESHEET_PATH}">`);

  if (page.type === "website") {
    lines.push(jsonLdScript(websiteLd(lang, t, url)));
  } else if (page.type === "item") {
    lines.push(jsonLdScript(itemLd(slug, lang, page, url)));
    lines.push(jsonLdScript(breadcrumbLd(slug, lang, page, url)));
  } else if (page.type === "page") {
    lines.push(jsonLdScript(breadcrumbLd(slug, lang, page, url)));
  }

  return lines.join("\n");
}

function fileNameFor(slug, lang) {
  return lang === "en" ? `${slug}.html` : `${slug}-${lang}.html`;
}

// Fails loudly, before writing anything, if LANGS lists a language that
// paths/PAGES[*].perLang/homeLabel don't actually have data for. Without
// this, adding a language to LANGS before filling in its data silently
// injects "undefined" into every existing page's hreflang links — this
// check exists because that happened once.
function validateData() {
  const problems = [];
  for (const lang of LANGS) {
    if (!homeLabel[lang]) problems.push(`homeLabel.${lang} is missing`);
  }
  for (const slug of Object.keys(PAGES)) {
    for (const lang of LANGS) {
      if (!paths[slug] || !paths[slug][lang]) problems.push(`paths.${slug}.${lang} is missing`);
      if (!PAGES[slug].perLang || !PAGES[slug].perLang[lang]) problems.push(`PAGES.${slug}.perLang.${lang} is missing`);
    }
  }
  if (problems.length) {
    throw new Error(
      `${path.basename(DATA_PATH)} is incomplete for LANGS=[${LANGS.join(", ")}]:\n  - ${problems.join("\n  - ")}\n` +
      `Add these before running the generator — LANGS drives hreflang generation for every page, ` +
      `so a language listed there with missing data would otherwise silently produce broken links.`
    );
  }
}

validateData();

const START = "<!-- SEO:START (generated — do not hand-edit between markers) -->";
const END = "<!-- SEO:END -->";

let changed = [];
let missing = [];

for (const slug of Object.keys(PAGES)) {
  for (const lang of LANGS) {
    const file = fileNameFor(slug, lang);
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    const startIdx = content.indexOf(START);
    const endIdx = content.indexOf(END);
    if (startIdx === -1 || endIdx === -1) {
      throw new Error(`SEO markers not found in ${file}. Add:\n${START}\n${END}\nsomewhere in <head>.`);
    }
    const before = content.slice(0, startIdx + START.length);
    const after = content.slice(endIdx);
    const head = buildHead(slug, lang);
    const next = `${before}\n${head}\n${after}`;

    if (next !== content) {
      changed.push(file);
      if (!CHECK) fs.writeFileSync(filePath, next, "utf8");
    }
  }
}

if (missing.length) {
  console.error("Missing files (in your data file but not on disk):", missing.join(", "));
}

if (CHECK) {
  if (changed.length) {
    console.error("Out of date:", changed.join(", "));
    process.exit(1);
  }
  console.log("SEO head blocks are up to date.");
} else {
  console.log(changed.length ? `Regenerated: ${changed.join(", ")}` : "Nothing to regenerate — already up to date.");
}
