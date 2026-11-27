/* Runs before first paint: theme and language, so neither flashes. Works without storage. */
(function () {
  var d = document.documentElement, t, s;
  d.classList.add("js");
  try { t = localStorage.getItem("theme"); s = localStorage.getItem("lang"); } catch (e) { /* storage blocked */ }
  if (t !== "light" && t !== "dark") t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  d.setAttribute("data-theme", t);
  var m = /[?&]lang=(en|fr)(?:&|#|$)/.exec(location.search);
  var browser = (navigator.language || "").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
  var l = m ? m[1] : (s === "en" || s === "fr") ? s : browser;
  d.lang = l;
  d.setAttribute("data-lang", l);
  if (m) d.setAttribute("data-lang-url", "");
  if (l !== "en") {
    d.classList.add("i18n-wait");
    setTimeout(function () { d.classList.remove("i18n-wait"); }, 1500);
  }
})();
