// Writes body text into the HTML between <!-- BODY:key --> .. <!-- /BODY:key -->
// markers. Called from generate-seo.js.
//
// Why. On many static multilingual sites the copy lives in a JavaScript dictionary
// and a script fills the page on load. Browsers and Googlebot run that script; a
// lot of other crawlers don't, and they get the layout with nothing to read. On the
// site this comes from, a plain request without JavaScript returned 17 characters
// of visible text for the homepage and 23 for a listing.
//
// The fix is to put the same text into the HTML at build time. The script can keep
// redrawing the same containers on load (a language switcher keeps working), and
// as long as BODY reads from the same dictionary the browser uses, the static text
// can't drift from what the script renders: one source, one build step.
//
// BODY is a function exported by your data file: (slug, lang) => ({ key: html }).
// Values are inserted as-is, so escape plain text yourself. A key whose markers
// aren't in the page is skipped, which lets one function serve several page types.

const fs = require("fs");
const path = require("path");

const KEY = /^[A-Za-z0-9_-]+$/;

function run({ root, pages, BODY, check = false }) {
  const changed = [];
  for (const { slug, lang, file } of pages) {
    const filePath = path.join(root, file);
    const html = fs.readFileSync(filePath, "utf8");
    const blocks = BODY(slug, lang) || {};
    let next = html;
    for (const [key, value] of Object.entries(blocks)) {
      if (!KEY.test(key)) throw new Error(`BODY key "${key}" for ${file}: use letters, digits, "-" and "_" only`);
      const re = new RegExp(`(<!-- BODY:${key} -->)[\\s\\S]*?(<!-- /BODY:${key} -->)`);
      if (!re.test(next)) continue;
      // A function replacement, so "$" in the text is never read as a pattern.
      next = next.replace(re, (m, open, close) => `${open}${value}${close}`);
    }
    if (next !== html) {
      changed.push(file);
      if (!check) fs.writeFileSync(filePath, next, "utf8");
    }
  }
  return changed;
}

module.exports = { run };
