// Example data file — fictional content, real shape. Copy it next to your own
// HTML files (or point --data at your copy) and replace everything.
//
// This is the single source of truth generate-seo.js reads from. Edit values
// here, then run `node generate-seo.js --root <dir>`. Never hand-edit between the
// SEO or BODY markers in the HTML — the next run overwrites it.

const path = require("path");

const DOMAIN = "https://example.com";
const LANGS = ["en", "fr"];

// Optional. The language whose files have no suffix (house.html, not
// house-en.html); also the hreflang x-default. Defaults to "en" if LANGS has
// it, otherwise to LANGS[0].
const DEFAULT_LANG = "en";

// Optional: a stylesheet <link> to put into every page's head. Omit it if you
// don't want this script managing your stylesheet tag.
const STYLESHEET_PATH = "/assets/css/style.css";

const IMG_WIDGET = `${DOMAIN}/img/widget.jpg`;
const IMG_HOUSE = `${DOMAIN}/img/house.jpg`;

// Path (without domain) for each page slug + language, used for canonical,
// og:url, hreflang and sitemap matching. "index" doubles as the homepage slug.
const paths = {
  index: { en: "/", fr: "/index-fr" },
  widget: { en: "/widget", fr: "/widget-fr" },
  house: { en: "/house", fr: "/house-fr" },
  notes: { en: "/notes" },
  about: { en: "/about", fr: "/about-fr" },
};

// Short "site home" label, used as the first breadcrumb item, per language.
const homeLabel = {
  en: "Example Workshop",
  fr: "Atelier Exemple",
};

const PAGES = {
  // type "website": a WebSite JSON-LD block. Typically your homepage.
  index: {
    type: "website",
    ogImage: IMG_WIDGET,
    perLang: {
      en: {
        title: "Example Workshop — Handmade Widgets",
        description: "Small-batch handmade widgets, shipped worldwide.",
        websiteName: "Example Workshop",
        websiteDescription: "Small-batch handmade widgets, shipped worldwide.",
      },
      fr: {
        title: "Atelier Exemple — Widgets faits main",
        description: "Widgets faits main en petites séries, expédiés dans le monde entier.",
        websiteName: "Atelier Exemple",
        websiteDescription: "Widgets faits main en petites séries, expédiés dans le monde entier.",
      },
    },
  },

  // type "item": a Product JSON-LD block plus a BreadcrumbList. Needs pricing.
  widget: {
    type: "item",
    ogImage: IMG_WIDGET,
    item: { offers: { price: "29.00", priceCurrency: "USD" } },
    perLang: {
      en: {
        title: "The Widget — Example Workshop",
        description: "A handmade widget, made to order.",
        breadcrumbPage: "The Widget",
      },
      fr: {
        title: "Le Widget — Atelier Exemple",
        description: "Un widget fait main, fabriqué sur commande.",
        breadcrumbPage: "Le Widget",
      },
    },
  },

  // type "listing": a RealEstateListing JSON-LD block plus a BreadcrumbList.
  // The language-independent facts live once, in `listing`; only the text that
  // changes with the language goes into perLang.
  house: {
    type: "listing",
    ogImage: IMG_HOUSE,
    listing: {
      datePosted: "2026-09-01",
      offers: { price: 240000, priceCurrency: "EUR" },
      property: {
        schemaType: "SingleFamilyResidence", // default is Apartment
        name: "Three-bedroom house by the river",
        numberOfRooms: 4,
        numberOfBathroomsTotal: 2,
        floorSize: 140,
        lotSize: 500, // goes to additionalProperty, see realEstateListingLd()
        numberOfFloors: 2,
        address: { addressLocality: "Exampleville", addressCountry: "FR" },
        geo: { latitude: 45.0, longitude: 4.0 },
        amenityFeature: ["Garden", "Parking", "Fireplace"],
      },
    },
    perLang: {
      en: {
        title: "Three-bedroom house by the river — For Sale by Owner",
        description: "140 m² on two floors, 500 m² plot, a short walk to the river. €240,000.",
        breadcrumbPage: "House by the river",
      },
      fr: {
        title: "Maison de trois chambres au bord de la rivière — vente directe",
        description: "140 m² sur deux niveaux, terrain de 500 m², la rivière à deux pas. 240 000 €.",
        breadcrumbPage: "Maison au bord de la rivière",
      },
    },
  },

  // type "article": an Article JSON-LD block plus a BreadcrumbList. `langs`
  // says this page exists in English only for now, so it gets no hreflang and
  // no French file is expected.
  notes: {
    type: "article",
    langs: ["en"],
    ogImage: IMG_WIDGET,
    article: {
      datePublished: "2026-09-10",
      dateModified: "2026-10-01",
      authorName: "A. Example",
      publisherName: "Example Workshop",
    },
    perLang: {
      en: {
        title: "Why we build in small batches — Example Workshop",
        headline: "Why we build in small batches",
        description: "A batch of twenty is small enough to check every piece by hand.",
        breadcrumbPage: "Small batches",
      },
    },
  },

  // type "page": just a BreadcrumbList. For About, FAQ, Terms and the like.
  about: {
    type: "page",
    perLang: {
      en: { title: "About — Example Workshop", description: "Who makes these widgets and why.", breadcrumbPage: "About" },
      fr: { title: "À propos — Atelier Exemple", description: "Qui fabrique ces widgets et pourquoi.", breadcrumbPage: "À propos" },
    },
  },
};

// Optional: body text for <!-- BODY:key --> markers, as (slug, lang) => ({ key: html }).
// Here it reads the same dictionary the browser uses, assets/js/i18n.js, so the
// static HTML and what app.js draws come from one source.
global.window = {};
require(path.join(__dirname, "assets", "js", "i18n.js"));
const I18N = global.window.__I18N__;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function BODY(slug, lang) {
  const t = I18N[lang][slug === "index" ? "home" : slug];
  return { title: esc(t.title), text: esc(t.text) };
}

module.exports = { DOMAIN, LANGS, DEFAULT_LANG, STYLESHEET_PATH, paths, homeLabel, PAGES, BODY };
