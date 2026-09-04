# Architecture

## Project Overview

A single-page PWA for managing recipes. Recipes live in a GitHub Gist (multi-device sync backend). The app works offline with localStorage and syncs via last-write-wins when online.

## Data Model

### Recipe Object

```js
{
  id: string,            // Unique ID, e.g. "l4k2j3...". Generated via generateId().
  name: string,          // Required. Recipe title.
  source: string|null,   // Optional. Source attribution, e.g. "Cookbook p. 42".
  calories: number|null, // Optional. Total calories for the recipe.
  ingredients: string[], // Array of ingredient lines, e.g. ["2 cups flour", "3 eggs"].
  instructions: string[],// Array of instruction steps, one per line.
  notes: string[],       // Array of note lines. Optional.
  createdAt: string,     // ISO 8601 timestamp.
  updatedAt: string      // ISO 8601 timestamp. Updated on edit.
}
```

### Gist Payload

The gist stores one file (`recipes.json`) containing:

```js
{
  recipes: Recipe[],     // Full array of recipes.
  lastUpdated: string    // ISO 8601 timestamp of last write.
}
```

Legacy format (flat array without wrapper object) is also handled on read.

## Component Tree (DOM)

```
index.html
├── header              # "🍳 Recipe Manager" title
├── main
│   ├── .status-bar     # Online/offline indicator + dark mode toggle
│   ├── #token-card     # GitHub token input (hidden once configured)
│   ├── #form-card      # Add/edit recipe form
│   ├── #sync-status    # Sync status text + "Sync Now" button
│   ├── .card           # Recipe list section
│   │   ├── .section-header
│   │   ├── .search-bar
│   │   └── #recipe-list
│   └── #install-btn    # PWA install prompt button
├── footer
└── #modal-overlay      # Recipe detail modal (hidden by default)
```

## State Management

All state is held in module-level variables in `js/app.js`:

| Variable          | Type      | Purpose                                      |
|-------------------|-----------|----------------------------------------------|
| `recipes`         | `Recipe[]`| Master recipe list. Source of truth for UI.  |
| `githubToken`     | `string?` | GitHub PAT loaded from localStorage.         |
| `editingId`       | `string?` | ID of recipe currently being edited in form. |
| `syncInProgress`  | `boolean` | Lock to prevent concurrent sync calls.       |
| `deferredPrompt`  | `Event?`  | PWA install prompt event.                    |
| `isOnline`        | `boolean` | Tracks `navigator.onLine`.                   |

Persistence layers:
- **localStorage** — Stores recipes, token, theme, and `recipes_last_updated` timestamp.
- **GitHub Gist** — Remote source. Synced on app load, after every CRUD operation, and on demand.

## Data Flow

```
User Action → CRUD Functions → localStorage (immediate)
                              → syncWithGist() (async, background)
```

### Sync Protocol (Last-Write-Wins)

```
syncWithGist()
  │
  ├─ Fetch gist → parse remote recipes + lastUpdated
  │
  ├─ If local recipes is empty AND remote has recipes:
  │     Load remote → save locally → render
  │
  ├─ Compare timestamps:
  │   ├─ remote > local → Remote wins: overwrite local
  │   └─ local > remote → Local wins: push to gist
  │
  └─ On auth failure → show token card
```

Sync triggers:
- App init (if token is saved)
- After add/edit/delete recipe
- Manually via "Sync Now" button
- When browser goes from offline → online

## Module Responsibilities

### `js/` (split across 7 files)

The single `js/app.js` was split into 7 files, keeping vanilla JS with global scope — no bundler needed. All files load before `DOMContentLoaded` fires, so mutual references across files are safe.

| File            | Key exports (globals)                                           |
|-----------------|----------------------------------------------------------------|
| `utils.js`      | `calculateServings()`, `generateId()`, `escapeHtml()`          |
| `state.js`      | `GIST_CONFIG`, global state variables, DOM refs, token management, localStorage helpers |
| `gist-api.js`   | `fetchGist()`, `updateGist()`                                   |
| `sync.js`       | `syncWithGist()` (last-write-wins protocol)                     |
| `ui.js`         | `toggleForm()`, `renderRecipes()`, `createRecipeCard()`, modal, theme, online/offline status |
| `recipes.js`    | `addRecipe()`, `updateRecipe()`, `deleteRecipe()`, `getRecipeById()`, form handling |
| `app.js`        | `initApp()`, event listeners, service worker registration, install prompt |

**Load order (dependency order):** `utils.js` → `state.js` → `gist-api.js` → `sync.js` → `ui.js` → `recipes.js` → `app.js`

Each file grabs its own DOM refs. Functions reference each other via the global scope.

### `css/style.css`

- CSS custom properties for theming (light/dark via `[data-theme="dark"]`)
- Card-based layout with gradient background
- Responsive design (max-width: 800px container)
- Modal overlay pattern, form styles, recipe cards

### `service-worker.js`

- Cache strategy: Cache-first for app shell (HTML, CSS, JS, icons, manifest)
- GitHub API requests (`api.github.com`) bypass cache (not intercepted)
- Old caches cleaned on activate
- `skipWaiting` triggered on install and via message from client

> ⚠️ **Agent instruction:** Whenever you change any JS, CSS, HTML, icon, or manifest file,
> **bump the `CACHE_NAME` constant** (e.g. `recipe-manager-v4` → `recipe-manager-v5`)
> so that installed PWA users receive the updated files on their next visit.
> Without this bump, the old service worker continues serving the previous cached
> version and the change has no effect for returning users.

## Ship / Release Workflow

How changes get released (single-branch flow, no pull requests):

1. **Bump `CACHE_NAME`** in `service-worker.js` if any static asset changed (see agent instruction above).
2. **Commit** — `git add` the changed files, then `git commit`.
3. **Push** — `git push origin master`; the remote serves the app directly from `master`.

Notes for agents:

- A **pre-commit hook** (`.git/hooks/pre-commit`) runs `node --check` on all staged `.js`
  files and **aborts the commit on any syntax error**. It uses `node`, so the hook
  fails if `node` is not installed. Fix errors and re-commit.
- After pushing, verify the release with `git ls-remote origin` (HEAD should match
  the local commit).

### `manifest.json`

- App name, icons (192×192, 512×512, `any maskable`)
- Display: `standalone`, theme color: `#e74c3c`
- Categories: food, lifestyle, productivity

### Supporting Files

| File                     | Purpose                                             |
|--------------------------|-----------------------------------------------------|
| `recipes-schema-org.json`| Source recipes in schema.org `Recipe` format        |
| `convert-recipes.py`     | Converts schema.org → app format (`example-recipes.json`) |
| `example-recipes.json`   | Output of conversion. Ready to seed a gist.        |

## External Dependencies

- **GitHub Gist API** (`api.github.com`): Requires personal access token with `gist` scope.
  - `GET /gists/{id}` — fetch gist
  - `PATCH /gists/{id}` — update gist file content
- No NPM dependencies, no build step.

## Key Design Decisions

1. **No framework.** Vanilla JS. DOM API directly. This minimizes tooling for an AI to reason about.
2. **Simple conflict resolution.** Last-write-wins avoids merge UI complexity.
3. **Token in localStorage.** Convenience over security. Token is scoped to gists only.
4. **CRUD is async-safe.** localStorage writes are synchronous (safe); gist syncs are fire-and-forget with error logging.
5. **Single source of truth.** Both localStorage and gist store the full recipe list, not diffs.