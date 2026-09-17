# Engineerspedia

A JSON-driven static site. Every page — the homepage, the article list, the category
sections, the individual articles, the nav and the footer — is rendered from
**one file: `data/site.json`**.

No framework, no build step, no npm install. It deploys to Netlify exactly as it is.

---

## Add a new discipline (the thing that used to take 5 file edits)

Open `data/site.json`, find `"categories"`, and add one object:

```json
{
  "id": "biomedical",
  "name": "Biomedical",
  "emoji": "🩺",
  "color": "#be123c",
  "blurb": "Where engineering meets the human body."
}
```

That's it. Save, refresh. The new discipline now appears:

- as a tile on the homepage
- as a filter chip on `/articles.html`
- as its own section and anchor at `/categories.html#biomedical`
- in the footer discipline list
- in the contact form's dropdown

**No CSS to write.** The `color` you set is injected as a CSS custom property
(`--cat`) and drives the pill, the card gradient, the section rule, the callout
and the blockquote automatically.

---

## Add a new article

Two steps.

**1.** Write the body as an HTML fragment at `content/<slug>.html`. No `<html>`,
no header, no footer, no title — just the content, starting with a `<p>`:

```html
<p>Opening paragraph.</p>

<h2>A section</h2>
<p>Body text with <strong>bold</strong> and <code>inline code</code>.</p>

<div class="callout">
  <strong>Worth knowing:</strong> callouts pick up the category colour automatically.
</div>

<blockquote>A pull quote, if the piece earns one.</blockquote>
```

Available classes inside a body: `.callout`, plus plain `h2`, `h3`, `p`, `ul`,
`ol`, `pre`/`code`, `blockquote`. The tag row and the "Keep reading" section are
generated for you — don't write them.

**2.** Add the entry to `"articles"` in `data/site.json`:

```json
{
  "slug": "how-mri-machines-work",
  "title": "How MRI Machines Actually Work",
  "dek": "Spinning protons, a very large magnet, and some clever listening.",
  "category": "biomedical",
  "emoji": "🧲",
  "date": "2026-09-20",
  "readMins": 9,
  "featured": false,
  "description": "Meta description for search engines and social cards.",
  "tags": ["biomedical engineering", "imaging", "physics"]
}
```

`slug` must match the filename in `content/`. The article is now live, listed,
searchable, filterable, and linked from related articles' "Keep reading" grids.

### Field reference

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | Must match `content/<slug>.html`. Lowercase, hyphens. |
| `title` | yes | Shown everywhere. |
| `dek` | yes | One-line summary on cards. |
| `category` | yes | Must match a category `id`. |
| `date` | yes | `YYYY-MM-DD`. Drives sort order. |
| `readMins` | yes | Integer. |
| `emoji` | no | Per-article override; falls back to the category emoji. |
| `featured` | no | `true` puts it in the homepage Featured row. |
| `description` | no | Meta description. Falls back to `dek`. |
| `tags` | no | Pills at the foot of the article; also searchable. |
| `author` | no | Falls back to `site.defaultAuthor`. |

---

## Run it locally

`fetch()` is blocked on `file://` URLs, so you need a local server — opening
`index.html` by double-clicking will show an error telling you the same thing.

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

## Check your data before you push

```bash
node tools/build.mjs
```

Catches the mistakes that actually happen: a typo'd category id, a duplicate
slug, a missing `content/` file, a malformed date. It also regenerates
`sitemap.xml` and `feed.xml`. Netlify runs it on every deploy (see
`netlify.toml`) — a broken `site.json` fails the build instead of shipping.

---

## Deploy

Push to GitHub and connect the repo to Netlify. Publish directory is the repo
root; the build command is already in `netlify.toml`.

### Optional: pretty article URLs

Out of the box, articles live at `/article.html?slug=big-o-notation` — which
works everywhere, including a plain local server.

`netlify.toml` already contains a rewrite so `/articles/big-o-notation` serves
the same page with a clean URL. To switch the site over to it, set:

```json
"prettyUrls": true
```

in the `site` block of `data/site.json`. Do this **after** deploying — the
rewrite is a Netlify feature, so pretty URLs will 404 on a local
`python3 -m http.server`.

---

## Layout

```
.
├── index.html          shell — data-page="home"
├── articles.html       shell — data-page="articles"   (filter + search)
├── categories.html     shell — data-page="categories"
├── article.html        shell — data-page="article"    (renders any slug)
├── about.html          real content + data slots
├── contact.html        real content + Netlify form
├── 404.html
├── data/
│   └── site.json       ← everything lives here
├── content/
│   └── <slug>.html     one body fragment per article
├── assets/
│   ├── style.css       no per-category rules — colours come from the data
│   └── app.js          the whole renderer, ~450 lines, no dependencies
├── tools/
│   └── build.mjs       validator + sitemap/feed generator (Node 18+, no deps)
├── netlify.toml
├── robots.txt
├── sitemap.xml         generated
└── feed.xml            generated
```

## How the rendering works

Each page shell declares what it is and where to mount:

```html
<body data-page="articles">
  <div data-slot="header"></div>
  <main id="main"><div data-slot="main"></div></main>
  <div data-slot="footer"></div>
  <script src="assets/app.js"></script>
</body>
```

`app.js` fetches `data/site.json` once, renders the header and footer into their
slots, then switches on `data-page` to render the body. Static pages
(`about`, `contact`) use `data-page="page"` and get only the chrome, plus any
optional slots they declare (`category-list`, `category-select`, `subscribe`).

## Things worth knowing

- **Dark mode** follows the OS by default; the ◐ button in the header overrides
  it and remembers the choice in `localStorage`.
- **The contact form** is wired for Netlify Forms (`data-netlify="true"`).
  Submissions appear under Site settings → Forms after deploy.
- **The newsletter form** is a stub — it shows a confirmation but stores
  nothing. Point it at your email provider when you have one.
- **SEO**: titles, meta descriptions and OG tags are set per-article at runtime.
  Google renders JavaScript and will index these fine, but social scrapers vary.
  If that matters, add a prerender step or use Netlify's prerendering.
