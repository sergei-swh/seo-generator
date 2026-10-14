// Fills the page from the dictionary on load, as a multilingual static site often
// does. The generator has already put the same text into the HTML, so a crawler
// that doesn't run this script still gets it; here it just redraws the same nodes.
(function () {
  var lang = document.documentElement.lang || "en";
  var page = document.body.getAttribute("data-page");
  var t = (window.__I18N__[lang] || window.__I18N__.en)[page];
  if (!t) return;
  document.querySelector("[data-title]").textContent = t.title;
  document.querySelector("[data-text]").textContent = t.text;
})();
