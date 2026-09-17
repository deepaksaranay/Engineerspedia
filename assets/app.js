/* ==========================================================================
   Engineerspedia — single renderer for every page.

   Everything on this site is generated from data/site.json plus the HTML
   fragments in /content. To add a category or an article you edit that one
   JSON file — no page templates, no CSS, no nav edits.

   Each page shell just declares <body data-page="home|articles|categories|
   article|page|404"> and provides <div data-slot="..."> mount points.
   ========================================================================== */

(() => {
  'use strict';

  const DATA_URL = 'data/site.json';
  const CONTENT_DIR = 'content';

  /* --- tiny helpers ----------------------------------------------------- */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Escape a value for safe interpolation into HTML. */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  /**
   * Root prefix so every page — at any folder depth, on any host, at any
   * subpath (domain root on Netlify, /RepoName/ on GitHub Pages project
   * pages, a custom sub-path, etc.) — resolves assets and data/site.json
   * correctly. Anchored to this very <script> tag's own resolved URL,
   * which the browser has already made absolute, rather than guessing
   * from the page's path depth (which breaks under a subpath).
   */
  const ROOT = (() => {
    try {
      const script = document.currentScript ||
        Array.from(document.scripts).find((s) => /assets\/app\.js(\?|#|$)/.test(s.src));
      const i = script.src.indexOf('assets/');
      if (i === -1) throw new Error('app.js not found in a recognizable assets/ path');
      return script.src.slice(0, i);
    } catch (_) {
      // Fallback: old depth-based guess (works at domain root).
      const depth = window.location.pathname
        .replace(/\/[^/]*$/, '/')
        .split('/').filter(Boolean).length;
      return depth === 0 ? '' : '../'.repeat(depth);
    }
  })();

  const asset = (p) => {
    const rel = p.replace(/^\//, '');
    return ROOT + (rel === '' ? 'index.html' : rel);
  };

  const fmtDate = (iso) => {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  };

  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  /* --- data ------------------------------------------------------------- */

  let DATA = null;
  const catIndex = new Map();

  const category = (id) => catIndex.get(id) || {
    id, name: id, emoji: '📘', color: '#4f46e5', blurb: ''
  };

  const articleHref = (a) =>
    DATA.site.prettyUrls
      ? asset(`articles/${a.slug}`)
      : asset(`article.html?slug=${encodeURIComponent(a.slug)}`);

  const categoryHref = (id) => asset(`categories.html#${id}`);

  const countIn = (id) => DATA.articles.filter((a) => a.category === id).length;

  /* --- shared chrome ---------------------------------------------------- */

  function renderHeader() {
    const slot = $('[data-slot="header"]');
    if (!slot) return;
    const { site, nav, navCta } = DATA;
    const here = window.location.pathname.split('/').pop() || 'index.html';

    const links = nav.map((n) => {
      const file = n.href.replace(/^\//, '') || 'index.html';
      const active = file === here || (here === '' && file === 'index.html');
      return `<li><a href="${esc(asset(n.href))}"${active ? ' class="active" aria-current="page"' : ''}>${esc(n.label)}</a></li>`;
    }).join('');

    slot.outerHTML = `
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <nav class="nav" aria-label="Primary">
    <a href="${esc(asset('/'))}" class="brand">
      <span class="mark" aria-hidden="true">Ep</span>
      <span>${esc(site.name)}<span class="sub">${esc(site.tagline)}</span></span>
    </a>
    <ul class="nav-links" id="nav-links">
      ${links}
      <li><a href="${esc(asset(navCta.href))}" class="nav-cta">${esc(navCta.label)}</a></li>
    </ul>
    <button class="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"></path>
      </svg>
    </button>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Toggle menu">☰</button>
  </nav>
</header>`;

    wireNav();
  }

  function wireNav() {
    const toggle = $('.nav-toggle');
    const links = $('.nav-links');
    const mq = window.matchMedia('(max-width: 860px)');

    const sync = () => {
      if (mq.matches) {
        links.hidden = toggle.getAttribute('aria-expanded') !== 'true';
      } else {
        links.hidden = false;
      }
    };
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', toggle.getAttribute('aria-expanded') !== 'true');
      sync();
    });
    mq.addEventListener('change', sync);
    sync();

    // Theme toggle — remembers the choice per viewer, degrades gracefully.
    const themeBtn = $('.theme-toggle');
    const apply = (t) => {
      if (t) document.documentElement.setAttribute('data-theme', t);
      else document.documentElement.removeAttribute('data-theme');
    };
    let stored = null;
    try { stored = localStorage.getItem('ep-theme'); } catch (_) {}
    apply(stored);
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = current ? (current === 'dark' ? 'light' : 'dark')
                           : (prefersDark ? 'light' : 'dark');
      apply(next);
      try { localStorage.setItem('ep-theme', next); } catch (_) {}
    });
  }

  function renderFooter() {
    const slot = $('[data-slot="footer"]');
    if (!slot) return;
    const { site, nav } = DATA;

    const explore = DATA.categories.slice(0, 4)
      .map((c) => `<li><a href="${esc(categoryHref(c.id))}">${esc(c.name)}</a></li>`).join('');
    const siteLinks = nav.filter((n) => !['/', '/articles.html'].includes(n.href))
      .map((n) => `<li><a href="${esc(asset(n.href))}">${esc(n.label)}</a></li>`).join('');
    const social = site.social
      .map((s) => `<li><a href="${esc(s.href)}">${esc(s.label)}</a></li>`).join('');

    slot.outerHTML = `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a href="${esc(asset('/'))}" class="brand" style="margin-bottom:14px;">
          <span class="mark" aria-hidden="true">Ep</span>
          <span>${esc(site.name)}</span>
        </a>
        <p style="max-width:280px; font-size:0.9rem;">${esc(site.footerBlurb)}</p>
      </div>
      <div>
        <h5>Disciplines</h5>
        <ul>${explore}</ul>
      </div>
      <div>
        <h5>Site</h5>
        <ul><li><a href="${esc(asset('/articles.html'))}">All articles</a></li>${siteLinks}</ul>
      </div>
      <div>
        <h5>Follow</h5>
        <ul>${social}</ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(site.name)}. All rights reserved.</span>
      <span>${esc(site.footerNote)}</span>
    </div>
  </div>
</footer>`;
  }

  /* --- components ------------------------------------------------------- */

  function articleCard(a) {
    const c = category(a.category);
    const href = articleHref(a);
    return `
<article class="card" style="--cat:${esc(c.color)}">
  <div class="card-media" aria-hidden="true">${esc(a.emoji || c.emoji)}</div>
  <div class="card-body">
    <span class="card-tag">${esc(c.name)}</span>
    <h3><a href="${esc(href)}">${esc(a.title)}</a></h3>
    <p>${esc(a.dek)}</p>
    <div class="card-meta">
      <span>${esc(a.readMins)} min read</span>
      <a href="${esc(href)}" class="read-link" aria-label="Read ${esc(a.title)}">Read →</a>
    </div>
  </div>
</article>`;
  }

  const cardGrid = (list) =>
    `<div class="card-grid">${list.map(articleCard).join('')}</div>`;

  function categoryTile(c) {
    const n = countIn(c.id);
    return `
<a class="cat-tile" href="${esc(categoryHref(c.id))}" style="--cat:${esc(c.color)}">
  <span class="cat-emoji" aria-hidden="true">${esc(c.emoji)}</span>
  <h3>${esc(c.name)}</h3>
  <p>${esc(c.blurb)}</p>
  <span class="count">${n} article${n === 1 ? '' : 's'} →</span>
</a>`;
  }

  /* --- pages ------------------------------------------------------------ */

  function renderHome() {
    const sorted = [...DATA.articles].sort(byDateDesc);
    const featured = sorted.filter((a) => a.featured).slice(0, 3);
    const latest = sorted.slice(0, 6);
    const avg = Math.round(
      DATA.articles.reduce((s, a) => s + a.readMins, 0) / DATA.articles.length
    );

    $('[data-slot="main"]').innerHTML = `
<section class="hero blueprint-bg">
  <div class="container">
    <span class="eyebrow">Engineering, explained</span>
    <h1>Engineering knowledge,<br>without the jargon.</h1>
    <p class="lede">Plain-language explainers across ${DATA.categories.length} disciplines — written for
      curious people who want to understand how things actually work, not pass an exam.</p>
    <div class="btn-row">
      <a class="btn btn-primary" href="${esc(asset('/articles.html'))}">Start reading</a>
      <a class="btn btn-ghost" href="${esc(asset('/categories.html'))}">Browse by discipline</a>
    </div>
    <div class="hero-stats">
      <div><strong>${DATA.articles.length}</strong><span>articles</span></div>
      <div><strong>${DATA.categories.length}</strong><span>disciplines</span></div>
      <div><strong>~${avg} min</strong><span>average read</span></div>
      <div><strong>Free</strong><span>always</span></div>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="section-head">
      <div>
        <h2>Featured explainers</h2>
        <p>Good places to start if you're new here.</p>
      </div>
      <a class="read-link" href="${esc(asset('/articles.html'))}">All articles →</a>
    </div>
    ${cardGrid(featured)}
  </div>
</section>

<section class="tight">
  <div class="container">
    <div class="section-head">
      <div>
        <h2>Browse by discipline</h2>
        <p>Every article belongs to exactly one.</p>
      </div>
    </div>
    <div class="cat-grid">${DATA.categories.map(categoryTile).join('')}</div>
  </div>
</section>

<section>
  <div class="container">
    <div class="section-head"><div><h2>Latest</h2></div></div>
    ${cardGrid(latest)}
  </div>
</section>

<section class="tight">
  <div class="container">${subscribeBlock()}</div>
</section>`;
  }

  const subscribeBlock = () => `
<div class="subscribe">
  <h2>One explainer a week</h2>
  <p>No spam, no sales pitch — just one new piece of engineering explained in plain language.</p>
  <form data-newsletter>
    <input type="email" name="email" placeholder="you@example.com" aria-label="Email address" required>
    <button class="btn-solid" type="submit">Subscribe</button>
  </form>
  <p data-newsletter-msg style="margin-top:12px; font-size:.88rem;" hidden></p>
</div>`;

  function renderArticlesPage() {
    const params = new URLSearchParams(window.location.search);
    let activeCat = params.get('cat') || 'all';
    let query = '';

    const chips = [
      `<button class="chip" data-cat="all" aria-pressed="false">All</button>`,
      ...DATA.categories.map((c) =>
        `<button class="chip" data-cat="${esc(c.id)}" style="--cat:${esc(c.color)}" aria-pressed="false">${esc(c.emoji)} ${esc(c.name)}</button>`)
    ].join('');

    $('[data-slot="main"]').innerHTML = `
<section class="article-hero blueprint-bg">
  <div class="container">
    <h1>All articles</h1>
    <p style="max-width:38rem; margin:0;">Filter by discipline or search by title, topic or tag.</p>
  </div>
</section>
<section>
  <div class="container">
    <div class="toolbar">
      <div class="chip-row">${chips}</div>
      <input class="search-box" type="search" placeholder="Search articles…" aria-label="Search articles">
    </div>
    <p class="result-count" data-count role="status"></p>
    <div data-results></div>
  </div>
</section>`;

    const results = $('[data-results]');
    const countEl = $('[data-count]');

    const draw = () => {
      const q = query.trim().toLowerCase();
      const list = [...DATA.articles].sort(byDateDesc).filter((a) => {
        if (activeCat !== 'all' && a.category !== activeCat) return false;
        if (!q) return true;
        const hay = [a.title, a.dek, a.description, category(a.category).name, ...(a.tags || [])]
          .join(' ').toLowerCase();
        return hay.includes(q);
      });

      const label = activeCat === 'all' ? '' : ` in ${category(activeCat).name}`;
      countEl.textContent = `${list.length} article${list.length === 1 ? '' : 's'}${label}${q ? ` matching "${query.trim()}"` : ''}`;

      results.innerHTML = list.length
        ? cardGrid(list)
        : `<div class="empty-state"><p><strong>Nothing matched.</strong></p><p>Try a different discipline or a broader search term.</p></div>`;

      $$('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === activeCat)));

      const url = new URL(window.location.href);
      if (activeCat === 'all') url.searchParams.delete('cat');
      else url.searchParams.set('cat', activeCat);
      history.replaceState(null, '', url);
    };

    $$('.chip').forEach((b) => b.addEventListener('click', () => {
      activeCat = b.dataset.cat;
      draw();
    }));

    let t;
    $('.search-box').addEventListener('input', (e) => {
      clearTimeout(t);
      const v = e.target.value;
      t = setTimeout(() => { query = v; draw(); }, 120);
    });

    draw();
  }

  function renderCategoriesPage() {
    const sections = DATA.categories.map((c) => {
      const list = DATA.articles.filter((a) => a.category === c.id).sort(byDateDesc);
      return `
<section class="cat-section" id="${esc(c.id)}" style="--cat:${esc(c.color)}">
  <div class="cat-section-head">
    <span class="cat-emoji" aria-hidden="true">${esc(c.emoji)}</span>
    <div>
      <h2>${esc(c.name)}</h2>
      <p>${esc(c.blurb)}</p>
    </div>
    <span class="count">${list.length} article${list.length === 1 ? '' : 's'}</span>
  </div>
  ${list.length
    ? cardGrid(list)
    : `<div class="empty-state"><p>No articles here yet — this discipline is next up.</p></div>`}
</section>`;
    }).join('');

    $('[data-slot="main"]').innerHTML = `
<section class="article-hero blueprint-bg">
  <div class="container">
    <h1>Categories</h1>
    <p style="max-width:38rem; margin:0;">${DATA.categories.length} disciplines, ${DATA.articles.length} articles.</p>
  </div>
</section>
<section>
  <div class="container">
    <div class="cat-grid" style="margin-bottom:52px;">${DATA.categories.map(categoryTile).join('')}</div>
    ${sections}
  </div>
</section>`;

    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  async function renderArticlePage() {
    const params = new URLSearchParams(window.location.search);
    const pathSlug = (window.location.pathname.match(/\/articles\/([^/]+?)(?:\.html)?$/) || [])[1];
    const slug = params.get('slug') || pathSlug;

    const main = $('[data-slot="main"]');
    const meta = DATA.articles.find((a) => a.slug === slug);

    if (!meta) return notFound(main, 'That article doesn't exist (or has moved).');

    let body;
    try {
      const res = await fetch(asset(`${CONTENT_DIR}/${meta.slug}.html`));
      if (!res.ok) throw new Error(res.status);
      body = await res.text();
    } catch (err) {
      return notFound(main, 'The article body could not be loaded.');
    }

    const c = category(meta.category);
    const related = pickRelated(meta);

    document.title = `${meta.title} — ${DATA.site.name}`;
    setMeta('description', meta.description || meta.dek);
    setMeta('og:title', meta.title, 'property');
    setMeta('og:description', meta.description || meta.dek, 'property');
    setMeta('og:type', 'article', 'property');

    main.innerHTML = `
<section class="article-hero blueprint-bg" style="--cat:${esc(c.color)}">
  <div class="container">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="${esc(asset('/'))}">Home</a> /
      <a href="${esc(asset('/articles.html'))}">Articles</a> /
      <a href="${esc(categoryHref(c.id))}">${esc(c.name)}</a>
    </nav>
    <span class="card-tag">${esc(c.name)}</span>
    <h1 style="margin-top:14px;">${esc(meta.title)}</h1>
    <div class="article-meta">
      <span><strong>${esc(meta.author || DATA.site.defaultAuthor)}</strong></span>
      <span>Published ${esc(fmtDate(meta.date))}</span>
      <span>${esc(meta.readMins)} min read</span>
    </div>
  </div>
</section>

<article class="article-body" style="--cat:${esc(c.color)}">
  ${body}
  <hr class="article-divider">
  <div class="tag-row">
    ${(meta.tags || []).map((t) => `<span class="tag-pill">${esc(t)}</span>`).join('')}
  </div>
</article>

${related.length ? `
<section class="related-grid">
  <div class="container">
    <div class="section-head"><h2 style="font-size:1.3rem;">Keep reading</h2></div>
    ${cardGrid(related)}
  </div>
</section>` : ''}`;
  }

  /** Same category first, then the most recent from anywhere else. */
  function pickRelated(meta, limit = 3) {
    const others = DATA.articles.filter((a) => a.slug !== meta.slug).sort(byDateDesc);
    const same = others.filter((a) => a.category === meta.category);
    const rest = others.filter((a) => a.category !== meta.category);
    return [...same, ...rest].slice(0, limit);
  }

  function setMeta(name, content, attr = 'name') {
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function notFound(main, message) {
    main.innerHTML = `
<section class="article-hero blueprint-bg">
  <div class="container">
    <h1>Not found</h1>
    <p style="margin:0;">${esc(message)}</p>
  </div>
</section>
<section>
  <div class="container" style="text-align:center;">
    <p style="color:var(--muted);">Try the full article list instead.</p>
    <a class="btn btn-solid" href="${esc(asset('/articles.html'))}">Browse all articles</a>
  </div>
</section>`;
  }

  /* --- static page decoration ------------------------------------------- */

  function decorateStaticPage() {
    const slot = $('[data-slot="subscribe"]');
    if (slot) slot.innerHTML = subscribeBlock();

    const catList = $('[data-slot="category-list"]');
    if (catList) catList.innerHTML = DATA.categories
      .map((c) => `<li><strong>${esc(c.emoji)} ${esc(c.name)}</strong> — ${esc(c.blurb)}</li>`).join('');

    const catSelect = $('[data-slot="category-select"]');
    if (catSelect) catSelect.innerHTML =
      `<option value="">No particular discipline</option>` +
      DATA.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }

  /* Newsletter + contact forms are front-end only in this build.
     Point them at a Netlify Form or your provider when you're ready. */
  function wireForms() {
    $$('form[data-newsletter]').forEach((f) => {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = f.parentElement.querySelector('[data-newsletter-msg]');
        if (msg) {
          msg.hidden = false;
          msg.textContent = 'Thanks — hook this form up to Netlify Forms or your email provider to start collecting addresses.';
        }
        f.reset();
      });
    });
  }

  /* --- boot ------------------------------------------------------------- */

  async function boot() {
    try {
      const res = await fetch(asset(DATA_URL), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      DATA = await res.json();
    } catch (err) {
      document.body.innerHTML = `
<div style="max-width:44rem;margin:12vh auto;padding:0 20px;font-family:system-ui,sans-serif;">
  <h1>Couldn't load site data</h1>
  <p>${esc(String(err))}</p>
  <p>This site reads <code>data/site.json</code> over <code>fetch()</code>, which browsers block on
     <code>file://</code> URLs. Serve the folder over HTTP instead:</p>
  <pre style="background:#f3f3f0;padding:14px;border-radius:8px;overflow:auto;">python3 -m http.server 8000</pre>
  <p>then open <a href="http://localhost:8000">http://localhost:8000</a>.</p>
</div>`;
      return;
    }

    DATA.categories.forEach((c) => catIndex.set(c.id, c));

    renderHeader();
    renderFooter();

    const page = document.body.dataset.page;
    if (page === 'home') renderHome();
    else if (page === 'articles') renderArticlesPage();
    else if (page === 'categories') renderCategoriesPage();
    else if (page === 'article') await renderArticlePage();
    else if (page === '404') notFound($('[data-slot="main"]'), 'We couldn't find that page.');

    decorateStaticPage();
    wireForms();

    document.body.classList.add('ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
