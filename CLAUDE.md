# GBFS Explorer - Claude Project Memory

## Project Overview

GBFS Explorer - A React app for exploring GBFS (General Bikeshare Feed Specification) mobility data worldwide.

| Item | Value |
|------|-------|
| Framework | React + Vite |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Package Manager | Yarn 4 (PnP) |
| Hosting | Vercel |
| Repo | github.com/johanhal/gbfs-explorer |

---

## Embedding Strategy

**Use iframe, NOT npm package.**

### Why iframe (Decided 2026-02-04)

After extensive failed attempts to embed as an npm package, we determined:

1. **CSS isolation is impossible without major rework** - The app has its own Tailwind config, CSS variables, and shadcn/ui components that conflict with host apps
2. **WebGL/backdrop-filter browser bug** - Mapbox GL canvas interferes with `backdrop-filter` on parent elements, causing visual glitches (glow effects on headers)
3. **Industry standard** - YouTube, Stripe, Google Maps all embed via iframe for good reason
4. **Simplicity** - iframe provides complete isolation with zero maintenance burden

### Embed Mode

When embedded via iframe, pass `?embed=true` to hide the app's own header/title:

```
https://[vercel-url]/?embed=true&city=Oslo
```

The app checks for this param and conditionally renders the title/subtitle.

---

## Lessons Learned (2026-02-04)

### What NOT to do:

1. **Don't try to embed a full app as an npm package** unless it was designed for embedding from the start (scoped CSS, no global styles)

2. **Don't mix Tailwind versions** - Migrating between v3 and v4 mid-project corrupts the build. Pick one and stick with it.

3. **Don't use `yarn cache clean --all` with Yarn PnP** - It corrupts the `.pnp.cjs` resolution map and creates cascading failures

4. **Don't apply CSS layer hacks** - Tailwind v4 uses `@layer` internally. Adding more layers breaks the cascade.

5. **Don't keep patching symptoms** - If you've tried 5+ fixes and each creates new errors, step back and reconsider the architecture

### What TO do:

1. **Use iframe for embedding complex apps** - Complete CSS/JS isolation, no conflicts

2. **Test the standalone app before embedding** - Make sure the source app works first

3. **Keep dependencies stable** - Don't change package managers, Tailwind versions, or build tools mid-debugging

4. **Revert to known-good state** - When deep in dependency hell, git reset is faster than debugging

---

## Vercel Deployment

- Disable "Vercel Authentication" in project settings for public access
- The app auto-deploys from `main` branch

---

## URL Parameters

| Param | Description |
|-------|-------------|
| `city` | Pre-fill search with city name (e.g., `?city=Oslo`) |
| `embed` | Hide title/subtitle when `true` (e.g., `?embed=true`) |

---

## Related Projects

| Project | Purpose |
|---------|---------|
| betamobility.com | Host site that embeds GBFS Explorer via iframe |
