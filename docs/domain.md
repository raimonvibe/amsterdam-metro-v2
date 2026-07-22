# Domain: amsterdammetro.nl

Production URLs for **Amsterdam Metro Live**.

| Role | URL |
|---|---|
| **Site** | https://amsterdammetro.nl |
| **Site (www)** | https://www.amsterdammetro.nl |
| **API** | https://api.amsterdammetro.nl |

Related: [render-deploy-plan.md](./render-deploy-plan.md) · [costs-and-specs.md](./costs-and-specs.md)

---

## Domain registration

| Item | Detail |
|---|---|
| **Domain** | `amsterdammetro.nl` |
| **TLD** | `.nl` (SIDN) |
| **Registrar** | Any .nl registrar (TransIP, Vimexx, Cloudflare, etc.) |
| **Typical cost** | **~€8–15/year** |
| **Subdomain** | `api.amsterdammetro.nl` — no extra registration (DNS only) |

Register the apex domain once; `www` and `api` are DNS records under the same zone.

---

## DNS records (Render)

After deploying on Render, add custom domains in the dashboard, then create records at your registrar:

| Host | Type | Target | Service |
|---|---|---|---|
| `@` | `A` / `ALIAS` / `ANAME` | Render static site IP/hostname | Frontend |
| `www` | `CNAME` | Render static site hostname | Frontend |
| `api` | `CNAME` | Render web service hostname | Backend API |

Render shows the exact values under **Settings → Custom Domains** for each service. SSL certificates are issued automatically by Render once DNS propagates.

### Render dashboard steps

1. **Static site** (`amsterdam-metro`) → Custom Domains → add:
   - `amsterdammetro.nl`
   - `www.amsterdammetro.nl`
2. **Web service** (`amsterdam-metro-api`) → Custom Domains → add:
   - `api.amsterdammetro.nl`
3. Copy DNS targets from Render into your registrar.
4. Wait for propagation (minutes to 48 h). Verify:
   ```bash
   curl -I https://amsterdammetro.nl
   curl https://api.amsterdammetro.nl/healthz
   ```

---

## Environment variables

Already configured in the repo for `amsterdammetro.nl`:

| Variable | Value | Where |
|---|---|---|
| `VITE_API_URL` | `https://api.amsterdammetro.nl` | `frontend/.env.production`, `render.yaml` |
| `CORS_ORIGINS` | `https://amsterdammetro.nl,https://www.amsterdammetro.nl` | `backend/.env.example`, `render.yaml` |
| `SITE_URL` | `https://amsterdammetro.nl` | `config/production.env.example` |

Canonical reference: [config/production.env.example](../config/production.env.example)

### Local vs production

| | Frontend | API |
|---|---|---|
| **Local dev** | http://localhost:5183 | http://localhost:8020 (Vite proxy) |
| **Production** | https://amsterdammetro.nl | https://api.amsterdammetro.nl |

Local dev uses `frontend/.env.development` with an empty `VITE_API_URL` — production env files are ignored by `npm run dev`.

---

## Files that reference the domain

| File | Purpose |
|---|---|
| `config/production.env.example` | All production URLs in one place |
| `frontend/.env.production` | Baked into `npm run build` |
| `frontend/.env.production.example` | Template for local prod preview |
| `backend/.env.example` | CORS origins |
| `render.yaml` | Render Blueprint env vars |
| `frontend/index.html` | `<link rel="canonical">`, Open Graph `og:url` |

---

## SEO & sharing

Set in `frontend/index.html`:

- **Canonical:** `https://amsterdammetro.nl/`
- **Open Graph URL:** `https://amsterdammetro.nl/`
- **Title:** Amsterdam Metro Live

Optional next steps (not in repo yet):

- Add `og:image` pointing to `https://amsterdammetro.nl/...` screenshot
- Add `https://amsterdammetro.nl/sitemap.xml`
- Register in Google Search Console

---

## Checklist

- [ ] Register `amsterdammetro.nl` at registrar
- [ ] Deploy backend + frontend on Render
- [ ] Add custom domains in Render (apex, www, api)
- [ ] Configure DNS records
- [ ] Verify HTTPS on all three hostnames
- [ ] Open https://amsterdammetro.nl — live map, no CORS errors
- [ ] (Optional) Redirect `www` → apex or vice versa in Render

---

## Troubleshooting

| Issue | Fix |
|---|---|
| CORS error in browser | Ensure `CORS_ORIGINS` includes the exact URL in the address bar (with or without `www`) |
| “Backend not reachable” | Check `VITE_API_URL` was set at **build** time; redeploy frontend after changing it |
| `api` subdomain 404 | Custom domain not added on **web service**, or DNS not propagated |
| SSL pending | Wait for DNS; check records match Render dashboard |
