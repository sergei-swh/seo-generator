// Example data file — shape only, fictional content. Copy this to
// seo-data.js (or point --data at your own copy) and replace everything.
//
// This is the single source of truth generate-seo.js reads from. Edit
// values here, then run `node generate-seo.js` to write the SEO:START..
// SEO:END block into every *.html file below. Never hand-edit that block
// directly in the HTML — it gets overwritten on the next run.

const DOMAIN = "https://example.com";
const LANGS = ["en", "fr", "de"];

// Optional: a stylesheet <link> to inject into every page's head. Leave
// STYLESHEET_PATH undefined/omit it if you don't want this script managing
// your stylesheet tag.
const STYLESHEET_PATH = "assets/css/style.css";

const IMG_WIDGET = `${DOMAIN}/img/widget.jpg`;

// path (without domain) for each page slug + language — used for
// canonical/og:url/hreflang. "index" doubles as your homepage slug.
const paths = {
  index: { en: "/", fr: "/index-fr", de: "/index-de" },
  widget: { en: "/widget", fr: "/widget-fr", de: "/widget-de" },
  about: { en: "/about", fr: "/about-fr", de: "/about-de" },
};

// short "site home" label used as the position-1 breadcrumb item, per language
const homeLabel = {
  en: "Example Shop",
  fr: "Boutique Exemple",
  de: "Beispielladen",
};

const PAGES = {
  // type "website": gets a WebSite JSON-LD block. Typically your homepage.
  index: {
    type: "website",
    ogImage: IMG_WIDGET,
    perLang: {
      en: {
        title: "Example Shop — Handmade Widgets",
        description: "Small-batch handmade widgets, shipped worldwide.",
        ogDescription: "Small-batch handmade widgets, shipped worldwide.",
        websiteName: "Example Shop",
        websiteDescription: "Small-batch handmade widgets, shipped worldwide.",
      },
      fr: {
        title: "Boutique Exemple — Widgets Faits Main",
        description: "Widgets faits main en petites séries, expédiés dans le monde entier.",
        ogDescription: "Widgets faits main en petites séries, expédiés dans le monde entier.",
        websiteName: "Boutique Exemple",
        websiteDescription: "Widgets faits main en petites séries, expédiés dans le monde entier.",
      },
      de: {
        title: "Beispielladen — Handgefertigte Widgets",
        description: "Handgefertigte Widgets in kleinen Serien, weltweiter Versand.",
        ogDescription: "Handgefertigte Widgets in kleinen Serien, weltweiter Versand.",
        websiteName: "Beispielladen",
        websiteDescription: "Handgefertigte Widgets in kleinen Serien, weltweiter Versand.",
      },
    },
  },

  // type "item": gets a Product JSON-LD block (see itemLd() in
  // generate-seo.js — swap for RealEstateListing, Article, etc. as needed)
  // plus a BreadcrumbList. Needs an `item` object with pricing.
  widget: {
    type: "item",
    ogImage: IMG_WIDGET,
    item: {
      offers: { price: "29.00", priceCurrency: "USD" },
    },
    perLang: {
      en: {
        title: "The Widget — Example Shop",
        description: "A handmade widget, made to order.",
        ogDescription: "A handmade widget, made to order.",
        breadcrumbPage: "The Widget",
      },
      fr: {
        title: "Le Widget — Boutique Exemple",
        description: "Un widget fait main, fabriqué sur commande.",
        ogDescription: "Un widget fait main, fabriqué sur commande.",
        breadcrumbPage: "Le Widget",
      },
      de: {
        title: "Das Widget — Beispielladen",
        description: "Ein handgefertigtes Widget, auf Bestellung gefertigt.",
        ogDescription: "Ein handgefertigtes Widget, auf Bestellung gefertigt.",
        breadcrumbPage: "Das Widget",
      },
    },
  },

  // type "page": gets just a BreadcrumbList (no WebSite/Product schema).
  // Use for plain content pages (About, FAQ, Terms, ...).
  about: {
    type: "page",
    perLang: {
      en: { title: "About — Example Shop", description: "Who makes these widgets and why.", breadcrumbPage: "About" },
      fr: { title: "À propos — Boutique Exemple", description: "Qui fabrique ces widgets et pourquoi.", breadcrumbPage: "À propos" },
      de: { title: "Über uns — Beispielladen", description: "Wer diese Widgets herstellt und warum.", breadcrumbPage: "Über uns" },
    },
  },
};

module.exports = { DOMAIN, LANGS, STYLESHEET_PATH, paths, homeLabel, PAGES };
