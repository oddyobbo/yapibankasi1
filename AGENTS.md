# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Archilink is a static multi-page HTML/CSS/JS architecture materials platform. There is **no build step**, no bundler, no `package.json`, and no Node.js dependencies. All third-party libraries (Tailwind CSS, Supabase, Lucide, Fabric.js, jsPDF) are loaded via CDN.

### Running the dev server

```bash
npx --yes serve . -l 4173
```

Then open `http://localhost:4173`. The `index.html` redirects to `/mvp-taslak-v1.html` (homepage).

ES modules require HTTP (not `file://`), so a static server is mandatory.

### Key architecture notes

- `layout.js` injects shared header/footer at runtime into every page.
- `core.js` initializes a global `window.AG` object with all service methods (auth, products, brands, architects, analytics, moodboards).
- `supabaseClient.js` holds the cloud Supabase URL and publishable anon key. The backend is fully cloud-hosted — no local database setup needed.
- Pages use `<script type="module">` for JS; most page-specific logic is inline or in dedicated `*Service.js` files.

### Lint / Tests / Build

- **No linter configured** — there is no ESLint, Prettier, or similar tooling in this repo.
- **No automated tests** — there is no test framework or test files.
- **No build step** — files are served as-is. Netlify `publish = "."` deploys the root directory.

### Netlify-specific features

`netlify.toml` defines URL rewrites (e.g. `/tr/p/:brand/:product` → `product-detail.html`). To test these locally, use `netlify dev` instead of plain `serve`.

### Gotchas

- The `serve` package (via `npx serve`) issues 301 redirects for paths without trailing slash. Use `-L` with curl to follow redirects, or access files with their full path (e.g. `/urunler.html`).
- Supabase auth and data operations require network access to `dbcyoveyoqjlmybklovu.supabase.co`. If network is restricted, the app UI will load but backend features (login, product data fetching) won't work.
