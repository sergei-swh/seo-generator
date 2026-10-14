#!/usr/bin/env node
// Regenerates everything on a multilingual static site that would otherwise be
// hand-copied into every language x page-type file, from one data file:
//
//   1. the <!-- SEO:START --> .. <!-- SEO:END --> block in <head>: title, meta
//      description, Open Graph, canonical, hreflang, JSON-LD;
//   2. optional body text between <!-- BODY:key --> .. <!-- /BODY:key --> markers
//      (see body.js), so crawlers that don't run JavaScript still get the copy;
//   3. optional <lastmod> dates in sitemap.xml, taken from git (see sitemap.js).
//
// Zero dependencies — only Node's built-ins. No build step, no framework,
// nothing to install.
//
// Usage:
//   node generate-seo.js [--root <dir>] [--data <file>] [--check]
//
//   --root   directory the HTML files live in (default: current directory)
//   --data   path to your data module (default: <root>/seo-data.js)
//   --check  don't write anything; exit 1 if any file would change
//            (use this in CI / as a pre-deploy check)
//
// Your data file must export: DOMAIN, LANGS, paths, homeLabel, PAGES. Optional:
// DEFAULT_LANG, STYLESHEET_PATH, BODY. See seo-data.example.js for the shape and
// comments. It's plain data (a CommonJS module), not config for this script —
// adapt buildHead()/the *Ld() functions below for your own page types and schema.

const fs = require("fs");
const path = require("path");
const body = require("./body");
const sitemap = require("./sitemap");

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

const data = require(DATA_PATH);
const { DOMAIN, LANGS, STYLESHEET_PATH, paths, homeLabel, PAGES } = data;
// The language whose files have no suffix (widget.html, not widget-en.html).
// It is also the hreflang x-default. Defaults to "en" when LANGS has it (as in
// version 1), otherwise to the first language.
const DEFAULT_LANG = data.DEFAULT_LANG || (LANGS.includes("en") ? "en" : LANGS[0]);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// A page doesn't have to exist in every language: PAGES[slug].langs narrows the set
// (an article may be published in one language before the others). Without it, a
// page gets all of LANGS. hreflang is built from the same set, so it never points
// at a translation that doesn't exist.
function langsFor(slug) {
  const declared = PAGES[slug].langs;
  if (!declared) return LANGS;
  return LANGS.filter((l) => declared.includes(l));
}

function hreflangBlock(slug) {
  const p = paths[slug];
  const langs = langsFor(slug);
  if (langs.length < 2) return "";
  const lines = langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${DOMAIN}${p[l]}">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${DOMAIN}${p[DEFAULT_LANG]}">`);
  return lines.join("\n");
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

// --- JSON-LD builders. These are the part you customize per project: keep the
// ones that fit your content, swap or add others (LocalBusiness, Event, Recipe...).
// The rest of this file (validation, marker replacement, --check) is generic and
// shouldn't need to change. ---

// type "item": schema.org Product.
function productLd(slug, lang, page, url) {
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
      price: page.item.offers.price,
      priceCurrency: page.item.offers.priceCurrency,
      availability: "https://schema.org/InStock",
    },
  };
}

// type "listing": schema.org RealEstateListing, as used in production for
// apartments and houses for sale.
function realEstateListingLd(slug, lang, page, url) {
  const l = page.listing;
  const t = page.perLang[lang];
  const p = l.property;
  // The property type. Apartment by default; a detached house should say
  // SingleFamilyResidence, or search engines get the wrong kind of home.
  const about = {
    "@type": p.schemaType || "Apartment",
    name: p.name,
    numberOfRooms: p.numberOfRooms,
    numberOfBathroomsTotal: p.numberOfBathroomsTotal,
    floorSize: { "@type": "QuantitativeValue", value: p.floorSize, unitCode: "MTK" },
  };
  if (p.address) about.address = { "@type": "PostalAddress", ...p.address };
  if (p.geo) about.geo = { "@type": "GeoCoordinates", ...p.geo };
  if (p.amenityFeature) {
    about.amenityFeature = p.amenityFeature.map((name) => ({ "@type": "LocationFeatureSpecification", name }));
  }
  // Plot size and number of floors have no dedicated properties on these types,
  // so they go into additionalProperty instead of inventing a lotSize.
  const extra = [];
  if (p.lotSize) extra.push({ "@type": "PropertyValue", name: "Plot size", value: p.lotSize, unitCode: "MTK" });
  if (p.numberOfFloors) extra.push({ "@type": "PropertyValue", name: "Floors", value: p.numberOfFloors });
  if (extra.length) about.additionalProperty = extra;

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: t.title,
    description: t.description,
    inLanguage: lang,
    url,
    image: page.ogImage,
    datePosted: l.datePosted,
    about,
    offers: {
      "@type": "Offer",
      price: l.offers.price,
      priceCurrency: l.offers.priceCurrency,
      availability: "https://schema.org/InStock",
      businessFunction: "https://schema.org/Sell",
    },
  };
}

// type "article". Dates are required: a reader (and a search engine) should see
// when the text was last updated, especially if it quotes figures.
function articleLd(slug, lang, page, url) {
  const t = page.perLang[lang];
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.headline || t.title,
    description: t.description,
    inLanguage: lang,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    datePublished: page.article.datePublished,
    dateModified: page.article.dateModified || page.article.datePublished,
    author: { "@type": "Person", name: page.article.authorName },
    publisher: { "@type": "Organization", name: page.article.publisherName },
    isAccessibleForFree: true,
  };
  if (page.ogImage) ld.image = page.ogImage;
  return ld;
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

const LD_BY_TYPE = {
  website: (slug, lang, page, url) => [websiteLd(lang, page.perLang[lang], url)],
  item: (slug, lang, page, url) => [productLd(slug, lang, page, url), breadcrumbLd(slug, lang, page, url)],
  listing: (slug, lang, page, url) => [realEstateListingLd(slug, lang, page, url), breadcrumbLd(slug, lang, page, url)],
  article: (slug, lang, page, url) => [articleLd(slug, lang, page, url), breadcrumbLd(slug, lang, page, url)],
  page: (slug, lang, page, url) => [breadcrumbLd(slug, lang, page, url)],
};

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
  lines.push(`<meta property="og:type" content="${page.type === "article" ? "article" : "website"}">`);
  lines.push(`<meta property="og:url" content="${url}">`);
  lines.push(`<link rel="canonical" href="${url}">`);
  const hreflang = hreflangBlock(slug);
  if (hreflang) lines.push(hreflang);
  if (STYLESHEET_PATH) lines.push(`<link rel="stylesheet" href="${STYLESHEET_PATH}">`);

  for (const ld of LD_BY_TYPE[page.type](slug, lang, page, url)) lines.push(jsonLdScript(ld));

  return lines.join("\n");
}

function fileNameFor(slug, lang) {
  return lang === DEFAULT_LANG ? `${slug}.html` : `${slug}-${lang}.html`;
}

// Fails loudly, before writing anything, if the data file is incomplete. Without
// this, adding a language to LANGS before filling in its data silently injects
// "undefined" into every existing page's hreflang links — this check exists
// because that happened once.
function validateData() {
  const problems = [];
  if (!LANGS.includes(DEFAULT_LANG)) problems.push(`DEFAULT_LANG "${DEFAULT_LANG}" is not in LANGS`);
  for (const lang of LANGS) {
    if (!homeLabel[lang]) problems.push(`homeLabel.${lang} is missing`);
  }
  for (const slug of Object.keys(PAGES)) {
    const page = PAGES[slug];
    if (!LD_BY_TYPE[page.type]) {
      problems.push(`PAGES.${slug}.type "${page.type}" is unknown (known: ${Object.keys(LD_BY_TYPE).join(", ")})`);
    }
    if (page.langs) {
      const unknown = page.langs.filter((l) => !LANGS.includes(l));
      if (unknown.length) problems.push(`PAGES.${slug}.langs lists unknown language(s): ${unknown.join(", ")}`);
      if (!page.langs.includes(DEFAULT_LANG)) {
        problems.push(`PAGES.${slug}.langs must include "${DEFAULT_LANG}" — it is the x-default`);
      }
    }
    if (page.type === "article") {
      if (!page.article) problems.push(`PAGES.${slug}.article is missing (type "article" needs dates and author)`);
      else {
        for (const field of ["datePublished", "authorName", "publisherName"]) {
          if (!page.article[field]) problems.push(`PAGES.${slug}.article.${field} is missing`);
        }
      }
    }
    for (const lang of langsFor(slug)) {
      if (!paths[slug] || !paths[slug][lang]) problems.push(`paths.${slug}.${lang} is missing`);
      if (!page.perLang || !page.perLang[lang]) problems.push(`PAGES.${slug}.perLang.${lang} is missing`);
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

// Every page the data file describes, in every language it exists in.
const pages = [];
for (const slug of Object.keys(PAGES)) {
  for (const lang of langsFor(slug)) {
    pages.push({ slug, lang, file: fileNameFor(slug, lang), url: `${DOMAIN}${paths[slug][lang]}` });
  }
}

// --- 1. Head blocks ---

const START = "<!-- SEO:START (generated — do not hand-edit between markers) -->";
const END = "<!-- SEO:END -->";

const headChanged = [];
const missing = [];

for (const { slug, lang, file } of pages) {
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
  const next = `${before}\n${buildHead(slug, lang)}\n${after}`;

  if (next !== content) {
    headChanged.push(file);
    if (!CHECK) fs.writeFileSync(filePath, next, "utf8");
  }
}

if (missing.length) {
  console.error("Missing files (in your data file but not on disk):", missing.join(", "));
}

// --- 2. Body text (only if the data file exports BODY) ---
// Same run, on purpose: a second script is a second thing to forget, and then the
// static text drifts from what the page's JavaScript renders.

const bodyChanged = data.BODY
  ? body.run({ root: ROOT, pages: pages.filter((p) => !missing.includes(p.file)), BODY: data.BODY, check: CHECK })
  : [];

// --- 3. Sitemap lastmod (only if <root>/sitemap.xml exists) ---
// Last, because the date depends on whether a page has uncommitted changes, and
// steps 1 and 2 may have just made some.

const sitemapChanged = sitemap.run({ root: ROOT, pages, check: CHECK });

// --- Report ---
// In --check mode every step runs before exiting, so one out-of-date step doesn't
// hide the others and the report lists every file that would change.

function report(label, changed) {
  if (CHECK) {
    if (changed.length) console.error(`${label} out of date: ${changed.join(", ")}`);
    else console.log(`${label} up to date.`);
  } else {
    console.log(changed.length ? `${label} written: ${changed.join(", ")}` : `${label} already up to date.`);
  }
}

report("Head blocks", headChanged);
if (data.BODY) report("Body blocks", bodyChanged);
if (sitemap.exists(ROOT)) report("Sitemap lastmod", sitemapChanged);

if (CHECK && (headChanged.length || bodyChanged.length || sitemapChanged.length)) process.exit(1);
