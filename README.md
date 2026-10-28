# GitHue — Generative GitHub Wallpaper Studio

GitHue turns the last year of your GitHub contributions into a high-resolution desktop wallpaper. Enter a username and the contribution calendar is composed over generative gradients, film grain and fractal glass, then rendered at up to 8K as a real PNG, JPEG or WebP.

**Live:** https://misbahkhan0009.github.io/Git-Wall/

Everything runs in the browser. There is no backend, no sign-in and no stored token.

## Features

- **Gradient engine.** Palettes are built in OKLCH from a *mood* (lightness/chroma envelope and hue family: balanced, deep, neon, pastel, warm, cool, earth) and a *harmony* (analogous, complementary, split-complementary, triadic, monochromatic). Colours are never random hex values. There are seven styles: mesh, aurora, glow, atmosphere, flow (noise-displaced), linear and radial. All of them interpolate in OKLab and are dithered to avoid banding.
- **Seeded and reproducible.** The same seed, constraints and locked colours always produce the same composition. You can shuffle everything or only colours, geometry, the graph palette or effects, and locked colours are always kept. A composition code captures every setting.
- **Custom gradient editor.** Drag stops on a live gradient bar, add, remove, reverse or lock them, enter positions numerically, and paste HEX, `rgb()`, `hsl()` or `oklch()` values.
- **Film grain.** Seeded noise tiles with intensity, opacity, scale, contrast, fine/coarse, mono/colour and a film texture. Grain scales with resolution, so it looks the same at 1080p and 4K.
- **Fractal glass.** An original Canvas 2D take on reeded glass, in five styles (soft, fractal shards, organic, geometric, minimal). It has controls for density, distortion, coverage, position, layers, blur, transparency, highlights, shadows, tint and blend mode.
- **Contribution graph.** A GitHub-accurate 365-day calendar with weekday alignment and month labels. Levels come from quartiles of active days, a linear scale or the source's own levels. It has 10 graph palettes (including one auto-matched to the background) plus per-level colours, cell shape, size, spacing, radius, outline, glow, shadow, blur and opacity.
- **Containers and composition.** The graph can float or sit on frosted glass (a real backdrop blur of the wallpaper), a dark, light or bordered panel, a custom colour or a transparent box. There are six composition presets, alignment, scale, offset, rotation, safe margins and optional understated text.
- **Export.** Aspect ratios are 16:9, 16:10, 21:9, 3:2, 4:3 and 1:1, plus resolution presets or a custom size up to 16384 px. The wallpaper is rendered from scratch at full resolution, independent of the preview, with every enabled effect. A transparent background exports with alpha.
- **Library.** Saved compositions (rename, duplicate, delete), favourite palettes, recent seeds and undo/redo with drag coalescing. Everything persists in `localStorage`.

## Contribution data

| Data | Source | Notes |
| --- | --- | --- |
| Profile | `api.github.com/users/{user}` | Official REST API, unauthenticated, 60 requests per hour per IP |
| Calendar | [github-contributions-api.jogruber.de](https://github.com/grubersjoe/github-contributions-api) | Open-source, CORS-enabled public mirror of the calendar on a GitHub profile |
| Import | JSON or CSV file, or pasted text | `[{date,count}]`, the service's format, GitHub GraphQL `contributionCalendar` output, or `date,count` CSV |
| Sample | Generated locally | Always labelled *Sample data*, never attributed to an account |

GitHub offers no unauthenticated, browser-accessible endpoint for the yearly calendar. Public events cover only about 90 days and miss most contribution types, and GraphQL requires a token. That is why GitHue uses the public mirror above and says so in the interface. If the mirror is unavailable, the app tells you and keeps showing clearly labelled sample data until you import your own. The Profile panel includes a GraphQL query you can run with your own token in GitHub's GraphQL Explorer; GitHue never asks for or stores the token.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` type-checks and writes the static site to `dist/`. Preview the build with `npm run preview`.

### Visual render snapshots (optional)

The test suite renders real pixels through Skia (`@napi-rs/canvas`). To write preset and seed renders to a folder for inspection:

```bash
GITHUE_RENDER_DIR=./renders npx vitest run src/tests/visual.preview.test.ts
```

## Deployment

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` to the `gh-pages` branch on every push to `main`. Under **Settings → Pages**, the source should be **Deploy from a branch → `gh-pages` / root**. The build uses relative asset paths, so it works under `/<repo>/` or any other static host.

## Architecture

```
src/
  app/                    app shell and keyboard shortcuts
  components/
    canvas/               preview stage (fit, zoom, fullscreen, hide UI) and rAF preview renderer
    controls/             editor sections: profile, background, palette, graph, effects, composition, export
    editor/ navigation/   side panel, mobile bottom sheet, top bar, toasts
    export/ landing/ presets/ ui/
  features/
    gradient-engine/      palette generation (OKLCH), geometry, seeded generator, renderer
    grain-engine/         seeded grain tiles and film texture
    glass-engine/         fractal glass
    graph-renderer/       graph palettes, cells, labels, containers
    composition/          layout, presets, auto graph palette, the full render pipeline
    contributions/        calendar model, intensity mapping, import, sample data
    github/               public API access
    export/ persistence/  high-resolution export; storage, validation, share codes
  lib/                    colour maths, canvas helpers, seeded RNG
  store/                  Zustand editor store (config, history, library)
  tests/                  Vitest suites
```

The renderers are pure functions of a typed `WallpaperConfig`. The preview and the export call the same `renderWallpaper()`, the preview at screen resolution and the export at full size. That is why nothing enabled can be missing from an export. Expensive layers (background and glass) are cached, the preview repaints on `requestAnimationFrame` outside React, and it drops to a lower resolution while a slider is being dragged.

## Known limitations

- Export rendering runs on the main thread. A 4K export takes about 1–3 seconds, during which the UI shows an *Exporting* state.
- Browsers cap canvas size (Safari is the strictest). Very large exports may fail with a message suggesting a smaller size.
- Calendar data depends on the third-party mirror's availability. Import is always available as a fallback.
