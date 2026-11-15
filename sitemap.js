// Sets <lastmod> in <root>/sitemap.xml from each page's git history. Called from
// generate-seo.js; does nothing if there is no sitemap.xml.
//
// Why. A hand-written sitemap gets its dates once, when a page is added, and they
// freeze: on the site this comes from, a listing still said 2026-09-07 a month and
// two price changes later. Google only relies on lastmod when the dates match what
// it sees on the page, and stops trusting dates that never move.
//
// Where the date comes from. A page with uncommitted changes (the generator just
// rewrote it, or you edited it by hand) gets today's date; any other page gets the
// date of the last commit that changed it. Commit on the same day you generate and
// both agree, so --check passes cleanly.
//
// "Changed" ignores asset versions (see assets.js). Editing one script rewrites the
// ?v= on every page; counting that as a change gave every page a new date at once,
// and dates that move without the page changing are as useless to Google as dates
// that never move. So both the uncommitted page and each commit in its history are
// compared with versions stripped, and a commit that only bumped a ?v= is skipped.
//
// Nothing else in sitemap.xml (order, changefreq, priority) is touched. URLs the
// data file doesn't know are left alone and reported, and so are pages missing
// from the sitemap: adding or removing URLs stays a decision you make by hand.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function sitemapPath(root) {
  return path.join(root, "sitemap.xml");
}

function exists(root) {
  return fs.existsSync(sitemapPath(root));
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// pages: [{ url, file }] — every page the generator writes.
// strip: html => html with asset versions removed (identity if there are none).
function run({ root, pages, check = false, strip = (html) => html }) {
  if (!exists(root)) return [];

  const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    throw new Error(`${root} has a sitemap.xml but is not inside a git repository, so there are no dates to take`);
  }

  const blobs = new Map();
  function blob(sha) {
    if (!blobs.has(sha)) {
      const text = execFileSync("git", ["-C", root, "cat-file", "blob", sha], { encoding: "utf8", maxBuffer: 64 << 20 });
      blobs.set(sha, strip(text));
    }
    return blobs.get(sha);
  }

  function lastModified(file) {
    if (git(["status", "--porcelain", "--", file])) {
      let head = null;
      try {
        // "./" makes the path relative to root, which may be a subdirectory of the repository.
        head = blob(git(["rev-parse", `HEAD:./${file}`]));
      } catch {
        // not in HEAD yet: a new page
      }
      const work = strip(fs.readFileSync(path.join(root, file), "utf8"));
      if (head === null || head !== work) return today();
    }
    // Commits that touched the file, newest first, with its blob before and after.
    // The date is the first one where the file appeared or changed beyond versions.
    const log = git(["log", "--no-renames", "--raw", "--no-abbrev", "--format=%x00%cs", "--", file]);
    for (const entry of log.split("\0").filter(Boolean)) {
      const [date, ...rest] = entry.trim().split("\n");
      const raw = rest.find((l) => l.startsWith(":"));
      if (!raw) continue; // a merge with no change of its own to this file
      const [, , before, after, status] = raw.slice(1).split(/\s+/);
      if (status === "D") continue;
      if (/^0+$/.test(before) || blob(before) !== blob(after)) return date;
    }
    throw new Error(`${file} has no git history and no pending changes`);
  }

  const fileByUrl = new Map(pages.map((p) => [p.url, p.file]));
  const xml = fs.readFileSync(sitemapPath(root), "utf8");
  const updated = [];
  const unknown = [];
  const listed = new Set();

  const next = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const file = fileByUrl.get(loc);
    if (!file) {
      unknown.push(loc);
      return block;
    }
    listed.add(loc);
    const date = lastModified(file);
    const re = /<lastmod>[^<]*<\/lastmod>/;
    const nextBlock = re.test(block)
      ? block.replace(re, `<lastmod>${date}</lastmod>`)
      : block.replace(/(\s*)<loc>[^<]+<\/loc>/, (m, indent) => `${m}${indent}<lastmod>${date}</lastmod>`);
    if (nextBlock !== block) updated.push(loc.replace(/^https?:\/\/[^/]+/, "") || "/");
    return nextBlock;
  });

  if (unknown.length) {
    console.error("Sitemap URLs the data file doesn't know (left as is):", unknown.join(", "));
  }
  const absent = pages.filter((p) => !listed.has(p.url)).map((p) => p.url);
  if (absent.length) {
    console.error("Pages missing from sitemap.xml (add them by hand):", absent.join(", "));
  }

  if (updated.length && !check) fs.writeFileSync(sitemapPath(root), next, "utf8");
  return updated;
}

module.exports = { run, exists };
