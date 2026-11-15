// Fingerprint of an article's text, so dateModified can't fall behind edits.
// Called from generate-seo.js for pages of type "article" that have a textHash.
//
// Why. dateModified is typed by hand into the data file, and the text is edited in
// the HTML. On the production site two articles were edited twice that way and
// the date stayed put: Google was told 25 Oct and 15 Sep for text changed in
// November, and nobody noticed for a week. The sitemap's git date can't stand in
// for it: it moves with the footer and script versions, not with the text.
//
// How. Next to the date, perLang.<lang>.textHash holds the fingerprint of what is
// inside the page's first <article> element when the date was right. The head,
// footer and anything outside <article> don't count; whitespace is collapsed.
// Change a word or a link in the article and the fingerprint no longer matches:
// --check fails and prints the new one to put next to the new date.
// `node generate-seo.js --article-hashes` prints the current fingerprint of every
// article, which is how you add the first ones.

const crypto = require("crypto");

function articleTextHash(html) {
  const m = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/);
  if (!m) return null;
  const normalized = m[1].replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

// pages: [{ slug, lang, html, recorded, dateModified }] — only pages with a textHash.
function articleDateProblems(pages) {
  const problems = [];
  for (const p of pages) {
    const actual = articleTextHash(p.html);
    if (!actual) {
      problems.push(`${p.slug} (${p.lang}): has a textHash but no <article> element on the page`);
    } else if (p.recorded !== actual) {
      problems.push(
        `${p.slug} (${p.lang}): article text changed since dateModified ${p.dateModified} — ` +
        `set a new dateModified and textHash: "${actual}"`
      );
    }
  }
  return problems;
}

module.exports = { articleTextHash, articleDateProblems };
