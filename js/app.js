/* LiamSDD portfolio. Renders pages from /data/*.json in English or French. No dependencies, no tracking. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const page = document.body.dataset.page;
  const lang = root.dataset.lang === "fr" ? "fr" : "en";
  const langInURL = root.hasAttribute("data-lang-url");

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const asset = (p) => (!p ? "" : /^(https?:|mailto:|tel:|\/)/.test(p) ? p : "/" + p);
  const isExternal = (href) => /^https?:/.test(href) && !href.startsWith(location.origin);

  // Internal links keep ?lang= when the language came from the URL (shared links, or storage blocked).
  const local = (path) => {
    if (!langInURL) return path;
    const [p, hash] = path.split("#");
    return `${p}${p.includes("?") ? "&" : "?"}lang=${lang}${hash !== undefined ? "#" + hash : ""}`;
  };

  const getJSON = (name) =>
    fetch(`/data/${name}.json`, { credentials: "same-origin" }).then((r) => {
      if (!r.ok) throw new Error(`${name}.json: ${r.status}`);
      return r.json();
    });

  let dict = {};
  const t = (key, vars) => {
    let v = key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
    if (typeof v !== "string") return null;
    if (vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
    return v;
  };
  const tt = (key, fallback, vars) => t(key, vars) ?? fallback;

  // Project, media and site entries carry French under "fr"; merge it over the English.
  function loc(obj) {
    if (!obj || lang === "en" || !obj.fr) return obj;
    const out = { ...obj, ...obj.fr };
    if (Array.isArray(obj.fr.links) && Array.isArray(obj.links)) {
      out.links = obj.links.map((l, i) => ({ ...l, label: obj.fr.links[i] || l.label }));
    }
    if (obj.fr.contact) out.contact = { ...obj.contact, ...obj.fr.contact };
    if (obj.fr.booking) out.booking = { ...obj.booking, ...obj.fr.booking };
    return out;
  }

  const ICON_PAUSE = '<svg class="i-pause" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.6" height="9" rx=".6"/><rect x="7.4" y="1.5" width="2.6" height="9" rx=".6"/></svg>';
  const ICON_PLAY = '<svg class="i-play" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z"/></svg>';
  const ICON_EXPAND = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1h4v1.4H2.4V5H1zM11 1v4H9.6V2.4H7V1zM1 11V7h1.4v2.6H5V11zM11 11H7V9.6h2.6V7H11z"/></svg>';

  /* ---------- Language ---------- */

  function applyDict() {
    $$("[data-i18n]").forEach((el) => {
      const v = t(el.dataset.i18n);
      if (v != null) el.textContent = v;
    });
    $$("[data-i18n-aria]").forEach((el) => {
      const v = t(el.dataset.i18nAria);
      if (v != null) el.setAttribute("aria-label", v);
    });
  }

  function setMeta(title, description) {
    if (title) document.title = title;
    const m = $('meta[name="description"]');
    if (m && description) m.content = description;
  }

  function setupLangSwitch() {
    $$(".lang a[data-lang]").forEach((a) => {
      const l = a.dataset.lang;
      a.setAttribute("aria-current", l === lang ? "true" : "false");
      a.href = `${location.pathname}?lang=${l}${location.hash}`;
      a.addEventListener("click", () => {
        try { localStorage.setItem("lang", l); } catch (e) { /* the ?lang= URL carries it instead */ }
      });
    });
  }

  function localiseInternalLinks(scope = document) {
    if (!langInURL) return;
    $$('a[href^="/"]:not([data-lang])', scope).forEach((a) => {
      if (!/[?&]lang=/.test(a.getAttribute("href"))) a.setAttribute("href", local(a.getAttribute("href")));
    });
    $$('a[href^="#"]', scope).forEach((a) => {
      if (a.classList.contains("skip")) return;
      a.setAttribute("href", local(location.pathname + a.getAttribute("href")));
    });
  }

  /* ---------- Theme ---------- */

  function setupTheme() {
    const btn = $(".theme-toggle");
    if (!btn) return;
    const label = () => {
      const toLight = root.dataset.theme !== "light";
      btn.setAttribute("aria-label", tt(toLight ? "nav.toLight" : "nav.toDark", toLight ? "Switch to light theme" : "Switch to dark theme"));
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = root.dataset.theme === "light" ? "#f6f6f4" : "#0b0c0e";
    };
    label();
    btn.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* theme still switches */ }
      label();
    });
    return label;
  }

  function setupHeader() {
    const header = $(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Icons ----------
     The project marks are SVGs whose colours switch with prefers-color-scheme. As <img> they would
     follow the OS, not the site's theme toggle, so they are inlined and their colour-scheme media
     queries are rewritten to follow html[data-theme]. */

  let iconSeq = 0;
  const iconCache = new Map();

  function scopeCSS(css, scope) {
    const prefix = (sel, extra) =>
      sel.split(",").map((s) => {
        s = s.trim();
        if (!s) return s;
        const base = /^(svg|:root)\b/.test(s) ? s.replace(/^(svg|:root)/, scope) : `${scope} ${s}`;
        return extra ? `${extra} ${base}` : base;
      }).join(",");
    let out = "";
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf("{", i);
      if (open < 0) break;
      const head = css.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
      const body = css.slice(open + 1, j - 1);
      const scheme = /^@media\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)$/i.exec(head);
      if (scheme) out += scopeCSS(body, `:root[data-theme="${scheme[1].toLowerCase()}"] ${scope}`);
      else if (head.startsWith("@")) out += `${head}{${scopeCSS(body, scope)}}`;
      else out += `${prefix(head)}{${body}}`;
      i = j;
    }
    return out;
  }

  async function inlineIcons(scope = document) {
    const imgs = $$('img[data-icon][src$=".svg"]', scope);
    await Promise.all(imgs.map(async (img) => {
      const src = img.getAttribute("src");
      try {
        if (!iconCache.has(src)) iconCache.set(src, fetch(src).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));
        let text = await iconCache.get(src);
        const id = `ic${++iconSeq}`;
        // Unique ids so gradients or clip paths in two icons cannot collide.
        text = text.replace(/\bid="([^"]+)"/g, `id="${id}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`).replace(/href="#([^"]+)"/g, `href="#${id}-$1"`);
        const doc = new DOMParser().parseFromString(text, "image/svg+xml");
        const svg = doc.documentElement;
        if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return;
        svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
        svg.querySelectorAll("title").forEach((n) => n.remove());
        svg.id = id;
        svg.setAttribute("class", img.className);
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.removeAttribute("role");
        svg.removeAttribute("aria-label");
        svg.setAttribute("width", img.getAttribute("width") || "28");
        svg.setAttribute("height", img.getAttribute("height") || "28");
        svg.querySelectorAll("style").forEach((s) => { s.textContent = scopeCSS(s.textContent, `#${id}`); });
        img.replaceWith(document.importNode(svg, true));
      } catch (e) {
        /* keep the <img>: it still shows, just following the OS scheme */
      }
    }));
  }

  /* ---------- Site constants: contact, booking, source ---------- */

  function applySite(site) {
    const s = loc(site);
    const c = s.contact || {};
    const b = s.booking || {};
    if (c.href) $$("[data-contact]").forEach((a) => { a.href = c.href; });
    $$("[data-contact-line]").forEach((el) => {
      const parts = [];
      if (c.email) {
        parts.push(`<a class="u" href="mailto:${esc(c.email)}">${esc(c.email)}</a>${c.note ? ` <span class="note">(${esc(c.note)})</span>` : ""}`);
      }
      if (b.href) {
        const ext = isExternal(b.href);
        parts.push(`<a class="u" href="${esc(b.href)}"${ext ? ' rel="noopener"' : ""}>${esc(b.label || "Book a call")}${ext ? '<span class="arrow" aria-hidden="true">↗</span>' : ""}</a>`);
      }
      el.innerHTML = parts.join('<span class="sep" aria-hidden="true">·</span>');
      el.hidden = !parts.length;
    });
    if (s.source) $$("[data-source]").forEach((a) => (a.href = s.source));
    return s;
  }

  /* ---------- Rendering helpers ---------- */

  function linkHTML(l, i) {
    const href = asset(l.href);
    const ext = isExternal(href);
    return `<a class="${l.primary ? "is-primary " : ""}u u-quiet" href="${esc(ext ? href : local(href))}"${ext ? ' rel="noopener"' : ""}>${esc(l.label)}${ext ? '<span class="arrow" aria-hidden="true">↗</span>' : ""}</a>`;
  }

  function numbersHTML(p) {
    if (!p.numbers || !p.numbers.length) return "";
    return `<ul class="p-nums" style="--n:${p.numbers.length}" aria-label="${esc(tt("card.numbers", "Key numbers"))}">${p.numbers
      .map((n) => `<li><b>${esc(n.value)}</b><span>${esc(n.label)}</span></li>`)
      .join("")}</ul>`;
  }

  function terminalHTML(p) {
    const lines = (p.terminal || [])
      .map((l) => (l.t === "gap" ? "" : `<span class="l-${esc(l.t)}">${esc(l.s)}</span>`))
      .join("\n");
    return `<div class="term"><div class="term-bar">${esc(p.name)}</div><pre tabindex="0">${lines}</pre></div>`;
  }

  // Muted autoplay clip. Source and poster attach only as it nears the viewport.
  function videoHTML(p, m) {
    const full = m.full
      ? `<button class="m-btn m-full" type="button" data-full="${esc(asset(m.full))}" data-poster="${esc(asset(m.fullPoster || m.poster))}" data-title="${esc(tt("card.fullDemo", p.name + " · full demo", { name: p.name }))}" data-note="${esc(m.note || "")}">${ICON_EXPAND}${esc(tt("card.fullVideo", "Full video"))}${m.duration ? " · " + esc(m.duration) : ""}</button>`
      : "<span></span>";
    return `<figure class="media">
      <div class="frame">
        <video muted loop playsinline preload="metadata" data-poster="${esc(asset(m.poster))}" data-src="${esc(asset(m.loop))}" aria-label="${esc(m.alt)}"></video>
        <div class="m-ctrl">${full}<button class="m-btn m-toggle" type="button" aria-label="${esc(tt("card.pause", "Pause video"))}" data-state="playing">${ICON_PAUSE}${ICON_PLAY}</button></div>
      </div>
      ${m.note ? `<figcaption class="caption">${esc(m.note)}</figcaption>` : ""}
    </figure>`;
  }

  const mediaHTML = (p, m) => (m && m.loop ? videoHTML(p, m) : terminalHTML(p));

  function iconHTML(p, size) {
    if (!p.icon) return "";
    return `<img class="p-icon" data-icon src="${esc(asset(p.icon))}" alt="" width="${size}" height="${size}" decoding="async">`;
  }

  function projectHTML(p, m, i) {
    const pageHref = local(`/work/${p.id}/`);
    return `<article class="project" id="${esc(p.id)}" data-reveal aria-labelledby="t-${esc(p.id)}">
      <div class="p-media">${mediaHTML(p, m)}</div>
      <div class="p-text">
        <p class="p-kind"><span class="p-index" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span>${esc(p.kind)}</span></p>
        <h3 class="p-name" id="t-${esc(p.id)}"><a href="${esc(pageHref)}">${iconHTML(p, 28)}<span class="p-label">${esc(p.name)}</span></a></h3>
        <p class="p-line">${esc(p.tagline)}</p>
        ${numbersHTML(p)}
        <p class="p-links">${(p.links || []).map(linkHTML).join("")}<a class="u u-quiet" href="${esc(pageHref)}">${esc(tt("card.projectPage", "Project page"))}<span class="arrow arrow-r" aria-hidden="true">→</span></a></p>
        ${p.footnote ? `<p class="p-foot">${esc(p.footnote)}</p>` : ""}
      </div>
    </article>`;
  }

  /* ---------- Video behaviour ---------- */

  function setupVideos(scope = document) {
    const videos = $$(".frame video[data-src]", scope);
    if (!videos.length) return;
    const state = new Map();
    const btnFor = (v) => v.parentElement.querySelector(".m-toggle");
    const sync = (v) => {
      const b = btnFor(v);
      if (!b) return;
      b.dataset.state = v.paused ? "paused" : "playing";
      b.setAttribute("aria-label", v.paused ? tt("card.play", "Play video") : tt("card.pause", "Pause video"));
    };
    const attach = (v) => { if (!v.getAttribute("src")) v.src = v.dataset.src; };
    const tryPlay = (v) => {
      attach(v);
      const pr = v.play();
      if (pr && pr.catch) pr.catch(() => sync(v));
    };

    videos.forEach((v) => {
      state.set(v, { visible: false, userPaused: false });
      v.addEventListener("play", () => sync(v));
      v.addEventListener("pause", () => sync(v));
      sync(v);
      const b = btnFor(v);
      if (b) b.addEventListener("click", () => {
        const s = state.get(v);
        if (v.paused) { s.userPaused = false; tryPlay(v); } else { s.userPaused = true; v.pause(); }
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        const s = state.get(v);
        s.visible = e.isIntersecting;
        if (s.visible) { if (!reduceMotion.matches && !s.userPaused) tryPlay(v); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: "120px 0px", threshold: 0.15 });
    videos.forEach((v) => io.observe(v));

    const posterIO = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const v = e.target;
      if (v.dataset.poster && !v.getAttribute("poster")) v.poster = v.dataset.poster;
      posterIO.unobserve(v);
    }), { rootMargin: "1200px 0px" });
    videos.forEach((v) => posterIO.observe(v));

    const resume = () => videos.forEach((v) => {
      const s = state.get(v);
      if (reduceMotion.matches) v.pause();
      else if (s.visible && !s.userPaused) tryPlay(v);
    });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", resume);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) videos.forEach((v) => v.pause());
      else resume();
    });
  }

  function setupPlayer() {
    const dlg = $("#player");
    if (!dlg || typeof dlg.showModal !== "function") {
      document.addEventListener("click", (e) => {
        const b = e.target.closest(".m-full");
        if (b) window.open(b.dataset.full, "_blank", "noopener");
      });
      return;
    }
    const video = $("video", dlg);
    const title = $(".player-title", dlg);
    const note = $(".player-note", dlg);
    let opener = null;
    let resumeAfter = [];

    document.addEventListener("click", (e) => {
      const b = e.target.closest(".m-full");
      if (!b) return;
      opener = b;
      title.textContent = b.dataset.title;
      note.textContent = b.dataset.note || "";
      video.poster = b.dataset.poster || "";
      video.src = b.dataset.full;
      resumeAfter = $$(".frame video").filter((v) => !v.paused);
      resumeAfter.forEach((v) => v.pause());
      dlg.showModal();
      $(".player-close", dlg).focus();
      const pr = video.play();
      if (pr && pr.catch) pr.catch(() => {});
    });
    $(".player-close", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (!reduceMotion.matches) resumeAfter.forEach((v) => v.play().catch(() => {}));
      resumeAfter = [];
      if (opener) opener.focus();
    });
  }

  function setupReveal() {
    const els = $$("[data-reveal]:not(.in)");
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Pages ---------- */

  async function renderHome() {
    const [site, data, media, writing] = await Promise.all([getJSON("site"), getJSON("projects"), getJSON("media"), getJSON("writing")]);
    const s = applySite(site);
    setMeta(t("meta.title"), t("meta.description"));

    const stats = $("#stats");
    if (stats && s.stats) {
      stats.innerHTML = s.stats.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join("");
    }

    const projects = data.projects.map(loc);
    const meta = $("#work-meta");
    if (meta) meta.textContent = tt("sections.workMeta", `${projects.length} projects`, { n: String(projects.length) });

    const list = $("#projects");
    if (list) {
      const majors = projects.filter((p) => p.tier !== "tool");
      const tools = projects.filter((p) => p.tier === "tool");
      let i = 0;
      list.innerHTML =
        majors.map((p) => projectHTML(p, loc(media[p.id]), i++)).join("") +
        (tools.length ? `<p class="group-label">${esc(tt("sections.tools", "Open-source tools"))}</p>` : "") +
        tools.map((p) => projectHTML(p, loc(media[p.id]), i++)).join("");
    }
    const also = $("#also");
    const alsoText = lang === "fr" && data.alsoBuilt_fr ? data.alsoBuilt_fr : data.alsoBuilt;
    if (also) {
      if (alsoText) also.innerHTML = `<b>${esc(tt("sections.also", "Also built"))}.</b>${esc(alsoText)}`;
      else also.remove();
    }

    const wl = $("#writing-list");
    if (wl) {
      const items = (writing.items || []).map(loc).filter((w) => w.href && w.title);
      wl.innerHTML = items.map((w) => {
        const href = asset(w.href);
        const ext = isExternal(href);
        return `<li><a class="w-item" href="${esc(ext ? href : local(href))}"${ext ? ' rel="noopener"' : ""}>
          <span class="w-type">${esc(tt("writing." + w.type, w.type))}${w.date ? " · " + esc(w.date) : ""}</span>
          <span><span class="w-title">${esc(w.title)}</span>${w.summary ? `<span class="w-sum">${esc(w.summary)}</span>` : ""}</span>
          <span class="w-arrow" aria-hidden="true">${ext ? "↗" : "→"}</span>
        </a></li>`;
      }).join("");
      if (!items.length) $("#writing").hidden = true;
    }

    localiseInternalLinks();
    root.classList.remove("i18n-wait");
    inlineIcons();
    setupVideos();
    setupPlayer();
    setupReveal();

    if (location.hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  async function renderProject() {
    const id = document.body.dataset.id;
    const [site, data, media] = await Promise.all([getJSON("site"), getJSON("projects"), getJSON("media")]);
    applySite(site);
    const projects = data.projects.map(loc);
    const idx = projects.findIndex((p) => p.id === id);
    const p = projects[idx];
    const main = $("#main");
    if (!p || !main) return;
    const m = loc(media[p.id]) || {};
    const next = projects[(idx + 1) % projects.length];
    setMeta(tt("meta.project", `${p.name} · LiamSDD`, { name: p.name }), `${p.tagline} ${p.summary}`);

    let mediaBlock;
    if (m.full) {
      mediaBlock = `<figure class="pp-media">
        <div class="frame"><video controls playsinline preload="none" poster="${esc(asset(m.fullPoster || m.poster))}" src="${esc(asset(m.full))}" aria-label="${esc(m.alt)}"></video></div>
        <figcaption class="caption">${esc(tt("card.demo", p.name + " demo", { name: p.name }))}${m.duration ? ", " + esc(m.duration) : ""}.${m.note ? " " + esc(m.note) : ""}</figcaption>
      </figure>`;
    } else {
      mediaBlock = terminalHTML(p);
    }

    const sections = (p.details || []).map((d) => `<section class="pp-section">
        <h2>${esc(d.heading)}</h2>
        ${(d.body || []).map((x) => `<p>${esc(x)}</p>`).join("")}
        ${d.list ? `<ul>${d.list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </section>`).join("");

    const [primary, ...rest] = p.links || [];
    const primaryBtn = primary
      ? `<a class="btn btn-primary" href="${esc(primary.href)}"${isExternal(primary.href) ? ' rel="noopener"' : ""}>${esc(primary.label)}${isExternal(primary.href) ? '<span class="arrow" aria-hidden="true">↗</span>' : ""}</a>`
      : "";

    main.innerHTML = `
      <div class="wrap">
        <section class="pp-hero">
          <a class="back" href="${esc(local("/#" + p.id))}"><span aria-hidden="true">←</span>${esc(tt("project.allWork", "All work"))}</a>
          <p class="p-kind">${esc(p.kind)}</p>
          <div class="pp-title">${iconHTML(p, 44)}<h1>${esc(p.name)}</h1></div>
          <p class="lede">${esc(p.tagline)} ${esc(p.summary)}</p>
          <div class="actions">${primaryBtn}<p class="p-links">${rest.map(linkHTML).join("")}</p></div>
        </section>
        ${mediaBlock}
        <div class="pp-body">
          <div class="pp-main">${sections}${p.footnote ? `<p class="p-foot">${esc(p.footnote)}</p>` : ""}</div>
          <aside class="pp-aside" aria-label="${esc(tt("project.facts", "Facts"))}">
            <dl class="facts">
              <div><dt>${esc(tt("project.role", "Role"))}</dt><dd>${esc(p.role)}</dd></div>
              <div><dt>${esc(p.stackLabel === "Stack" || !p.stackLabel ? tt("project.stack", "Stack") : p.stackLabel)}</dt><dd>${esc((p.stack || []).join(" · "))}</dd></div>
            </dl>
            ${numbersHTML(p)}
          </aside>
        </div>
        <nav class="pp-next" aria-label="${esc(tt("project.next", "Next project"))}">
          <a href="${esc(local(`/work/${next.id}/`))}"><small>${esc(tt("project.next", "Next project"))}</small><span>${esc(next.name)} →</span></a>
        </nav>
      </div>`;
    localiseInternalLinks();
    root.classList.remove("i18n-wait");
    inlineIcons(main);
    setupVideos(main);
    setupPlayer();
  }

  // Case studies and articles: one JSON file per piece under /data/articles/, English under "en", French under "fr".
  async function renderArticle() {
    const id = document.body.dataset.id;
    const [site, data, writing] = await Promise.all([getJSON("site"), getJSON(`articles/${id}`), getJSON("writing")]);
    applySite(site);
    const a = (lang === "fr" && data.fr) || data.en;
    const main = $("#main");
    if (!a || !main) return;
    setMeta(tt("meta.article", `${a.title} · LiamSDD`, { title: a.title }), a.description);

    const paras = (xs) => (xs || []).map((x) => `<p>${esc(x)}</p>`).join("");
    // A list item that opens with a short lead ("Key sharing: ..." or "Every build is unique. ...") shows it in bold, for scanning.
    const item = (x) => {
      const m = /^([^.:;]{3,90}?[.:])\s/.exec(x);
      return m ? `<b class="a-lead">${esc(m[1])}</b> ${esc(x.slice(m[0].length))}` : esc(x);
    };
    const sections = (a.sections || []).map((s) => `<section class="pp-section">
        <h2>${esc(s.heading)}</h2>
        ${paras(s.body)}
        ${s.list ? `<ul>${s.list.map((x) => `<li>${item(x)}</li>`).join("")}</ul>` : ""}
        ${paras(s.after)}
      </section>`).join("");

    const facts = (a.facts || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    const nums = (a.numbers || []).map(([v, l]) => `<li><b>${esc(v)}</b><span>${esc(l)}</span></li>`).join("");
    const links = (a.links || []).map((l) => linkHTML(l)).join("");

    // Next piece: the following published item in data/writing.json that lives on this site.
    const own = (writing.items || []).map(loc).filter((w) => w.href && w.title && w.href.startsWith("/writing/"));
    const i = own.findIndex((w) => w.href === `/writing/${id}/`);
    const next = own.length > 1 && i >= 0 ? own[(i + 1) % own.length] : null;

    main.innerHTML = `
      <div class="wrap">
        <section class="pp-hero">
          <a class="back" href="${esc(local("/#writing"))}"><span aria-hidden="true">←</span>${esc(tt("article.all", "All writing"))}</a>
          <p class="p-kind">${esc(tt("writing." + a.type, a.type))}</p>
          <div class="pp-title">${iconHTML({ icon: data.icon }, 44)}<h1 class="a-title">${esc(a.title)}</h1></div>
          <p class="lede">${esc(a.lede)}</p>
        </section>
        <aside class="kf" aria-label="${esc(a.factsLabel || tt("project.facts", "Facts"))}">
          <p class="kf-label">${esc(a.factsLabel || tt("project.facts", "Facts"))}</p>
          <div class="kf-grid">
            <dl class="facts">${facts}</dl>
            ${nums ? `<ul class="p-nums kf-nums" aria-label="${esc(tt("card.numbers", "Key numbers"))}">${nums}</ul>` : ""}
          </div>
        </aside>
        <article class="a-body">
          ${sections}
          ${links ? `<p class="p-links a-links">${links}</p>` : ""}
          ${a.footnote ? `<p class="p-foot">${esc(a.footnote)}</p>` : ""}
        </article>
        ${next ? `<nav class="pp-next" aria-label="${esc(tt("article.next", "Next case study"))}">
          <a href="${esc(local(next.href))}"><small>${esc(tt("article.next", "Next case study"))}</small><span>${esc(next.title)} →</span></a>
        </nav>` : ""}
      </div>`;
    localiseInternalLinks();
    root.classList.remove("i18n-wait");
    inlineIcons(main);
  }

  async function renderPlain() {
    const site = await getJSON("site");
    applySite(site);
    if (page === "404") setMeta(t("meta.notFound"));
    localiseInternalLinks();
    root.classList.remove("i18n-wait");
  }

  async function start() {
    try { dict = await getJSON(`i18n/${lang}`); } catch (e) { dict = {}; }
    applyDict();
    setupLangSwitch();
    setupTheme();
    setupHeader();
    const run = page === "project" ? renderProject : page === "article" ? renderArticle : page === "home" ? renderHome : renderPlain;
    try {
      await run();
    } catch (err) {
      console.warn("Content failed to load:", err);
      root.classList.remove("i18n-wait");
      const target = $("#projects") || $("#main");
      if (target) {
        target.insertAdjacentHTML("beforeend", `<p class="caption">${esc(tt("error", "This section could not load. All projects are on GitHub."))} <a class="u" href="https://github.com/LiamSDD">GitHub</a></p>`);
      }
    }
  }

  start();
})();
