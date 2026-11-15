// Version query on links to your CSS and JS: `/assets/js/app.js?v=3f9a2c1b`, where
// v is the start of the sha256 of the file. Called from generate-seo.js; does
// nothing unless the data file exports ASSETS.
//
// Why. A CDN or a browser keeps a script for hours, and Google's renderer keeps
// its own copy for longer. Without a version in the link, fresh HTML can be drawn
// by a stale script after a deploy: on the production site an old app.js kept
// overwriting a <title> that had already been fixed in the HTML. A changed file
// gets a new link and the cache is bypassed; an unchanged file keeps its link and
// stays cached.
//
// The catch, found two days later. Editing one script changes the link on every
// page, so every page had uncommitted changes and got today's <lastmod>: all 48
// pages at once, twice in a row, when five to eight had really changed. strip()
// exists for that: sitemap.js compares pages with versions removed, so a page
// whose only difference is a ?v= keeps its date.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// list: paths as they appear in your HTML, with or without a leading slash,
// relative to root: ["/assets/css/style.css", "/assets/js/app.js"].
function create(root, list) {
  const rels = (list || []).map((p) => p.replace(/^\//, ""));
  const missing = rels.filter((rel) => !fs.existsSync(path.join(root, rel)));

  const cache = {};
  function hashOf(rel) {
    if (!cache[rel]) {
      const buf = fs.readFileSync(path.join(root, rel));
      cache[rel] = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
    }
    return cache[rel];
  }

  // src="..." or href="..." pointing at one of the assets, with or without a
  // leading slash and with or without a version already.
  const link = rels.length
    ? new RegExp(`((?:src|href)=")(/?)(${rels.map(escRe).join("|")})(?:\\?v=[0-9a-f]+)?"`, "g")
    : null;

  // For the stylesheet link that generate-seo.js writes into the head block. It has
  // to produce the same string as rewrite(), or the two steps would undo each other.
  function versioned(p) {
    const rel = p.replace(/^\//, "");
    return rels.includes(rel) ? `${p}?v=${hashOf(rel)}` : p;
  }

  function rewrite(html) {
    return link ? html.replace(link, (_, attr, slash, rel) => `${attr}${slash}${rel}?v=${hashOf(rel)}"`) : html;
  }

  function strip(html) {
    return link ? html.replace(link, (_, attr, slash, rel) => `${attr}${slash}${rel}"`) : html;
  }

  // files: page files relative to root. Returns the ones that changed.
  function run({ files, check = false }) {
    if (!link) return [];
    const changed = [];
    for (const file of files) {
      const filePath = path.join(root, file);
      const html = fs.readFileSync(filePath, "utf8");
      const next = rewrite(html);
      if (next !== html) {
        changed.push(file);
        if (!check) fs.writeFileSync(filePath, next, "utf8");
      }
    }
    return changed;
  }

  return { missing, versioned, rewrite, strip, run, enabled: Boolean(link) };
}

module.exports = { create };
