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
  caloriesSource: "ai"|"manual"|null, // Origin of calories. null/absent = legacy (treated as manual when calories present).
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
│   ├── #form-card      # Add/edit recipe form
│   ├── #sync-status    # Sync status text + "Sync Now" button
│   ├── .card           # Recipe list section
│   │   ├── .section-header
│   │   ├── .search-bar
│   │   └── #recipe-list
│   └── #install-btn    # PWA install prompt button
├── footer
├── #settings-overlay   # Settings modal (GitHub token + OpenRouter AI config)
└── #modal-overlay      # Recipe detail modal (hidden by default)
```

## State Management

All state is held in module-level variables in `js/state.js`:

| Variable             | Type        | Purpose                                          |
|----------------------|-------------|--------------------------------------------------|
| `recipes`            | `Recipe[]`  | Master recipe list. Source of truth for UI.      |
| `settings`           | `Object`    | Persisted settings (GitHub token, AI provider/key/model). |
| `githubToken`        | `string?`   | GitHub PAT loaded from `settings`.               |
| `editingId`          | `string?`   | ID of recipe currently being edited in form.     |
| `originalIngredients`| `string[]?` | Ingredient snapshot captured on edit; used to detect changes for AI re-estimation. |
| `syncInProgress`     | `boolean`   | Lock to prevent concurrent sync calls.           |
| `deferredPrompt`     | `Event?`    | PWA install prompt event.                        |

Persistence layers:
- **localStorage** — Stores recipes, settings (GitHub token + OpenRouter API key/model), and `recipes_last_updated` timestamp.
- **GitHub Gist** — Remote source. Synced on app load, after every CRUD operation, and on demand.

## Data Flow

```
User Action → CRUD Functions → localStorage (immediate)
                              → syncWithGist() (async, background)
```

### AI Calorie Estimation (background)

On save, `handleFormSubmit()` decides whether calories are manual or AI-managed:

- A number typed into the calories field → `caloriesSource: "manual"`, no AI call.
- Editing a recipe with manual/legacy calories → calories preserved, no AI call.
- New recipe, or edited AI recipe with changed ingredients → saved with `calories: null`, then `estimateCalories()` runs fire-and-forget; on success the recipe is updated with `caloriesSource: "ai"` and re-synced.
- Offline / no API key / API failure → recipe stays saved with `calories: null`.

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
  └─ On auth failure → show sync error text (update token in Settings)
```

Sync triggers:
- App init (if token is saved)
- After add/edit/delete recipe
- After saving settings with a valid GitHub token
- Manually via "Sync Now" button

## Module Responsibilities

### `js/` (split across 8 files)

The single `js/app.js` was split into 8 files, keeping vanilla JS with global scope — no bundler needed. All files load before `DOMContentLoaded` fires, so mutual references across files are safe.

| File            | Key exports (globals)                                           |
|-----------------|----------------------------------------------------------------|
| `utils.js`      | `calculateServings()`, `generateId()`, `escapeHtml()`          |
| `state.js`      | `GIST_CONFIG`, `DEFAULT_SETTINGS`, global state variables, DOM refs, settings & localStorage helpers, `calorieSourceOf()` |
| `gist-api.js`   | `fetchGist()`, `updateGist()`, `testGithubToken()`              |
| `sync.js`       | `syncWithGist()` (last-write-wins protocol)                     |
| `ui.js`         | `toggleForm()`, `renderRecipes()`, `createRecipeCard()`, modal (incl. 🤖 AI indicator) |
| `ai.js`         | `estimateCalories()`, `testOpenRouterConfig()` (OpenRouter API) |
| `recipes.js`    | `addRecipe()`, `updateRecipe()`, `deleteRecipe()`, `getRecipeById()`, form handling & calorie strategy |
| `app.js`        | `initApp()`, event listeners, settings validation, service worker registration, install prompt |

**Load order (dependency order):** `utils.js` → `state.js` → `gist-api.js` → `sync.js` → `ui.js` → `ai.js` → `recipes.js` → `app.js`

Each file grabs its own DOM refs. Functions reference each other via the global scope.

### `css/style.css`

- CSS custom properties for theming (dark theme by default)
- Card-based layout with gradient background
- Responsive design (max-width: 800px container)
- Modal overlay pattern, form styles, recipe cards

### `service-worker.js`

- Cache strategy: Cache-first for app shell (HTML, CSS, JS, icons, manifest)
- GitHub API and OpenRouter API responses are not cached (cross-origin responses are only cached when `response.type === "basic"`)
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
- **OpenRouter API** (`openrouter.ai/api/v1/chat/completions`): Requires an API key (stored in settings). Used for AI calorie estimation and settings validation.
  - Default model: `~openai/gpt-mini-latest`
- No NPM dependencies, no build step.

## Key Design Decisions

1. **No framework.** Vanilla JS. DOM API directly. This minimizes tooling for an AI to reason about.
2. **Simple conflict resolution.** Last-write-wins avoids merge UI complexity.
3. **Token in localStorage.** Convenience over security. Token is scoped to gists only.
4. **CRUD is async-safe.** localStorage writes are synchronous (safe); gist syncs are fire-and-forget with error logging.
5. **Single source of truth.** Both localStorage and gist store the full recipe list, not diffs.
6. **AI calories are additive and fire-and-forget.** Recipes save instantly; calorie estimation happens in the background and never blocks or loses data.