# PWA-with-gist — Agent Quick Reference

Read `ARCHITECTURE.md` for the full design overview, data model, sync protocol, and module responsibilities. This file covers only conventions an agent must follow when modifying code.

## CRUD Convention (always do in this order)

1. Modify the `recipes` array
2. `saveRecipesLocal()` → `setRecipesLastUpdated()` → `syncWithGist()` (async, fire-and-forget) → `renderRecipes()`

## When Adding a New File

- Add `<script src="js/your-file.js">` (or `<link>`) to `index.html`
- Add the path to `ASSETS_TO_CACHE` in `service-worker.js`
- JS files must load after their dependencies (load order: utils → state → gist-api → sync → ui → recipes → app)

## When Adding a New Recipe Field

You need to touch **5 places**:

1. **index.html** — Add a new `<input>` or `<textarea>` in the form
2. **state.js** — Add a new DOM ref (`const newFieldInput = document.getElementById("...")`)
3. **recipes.js** — In `handleFormSubmit()` read the value; in `populateForm()` set it; split textareas on `\n` and filter empty lines
4. **ui.js** — In `createRecipeCard()` and `showRecipeModal()` render the new field (guard with optional chaining for backward compat)
5. No schema migration needed — existing recipes just won't have the field

## CSS Conventions

- Use `:root` CSS custom properties, never hardcoded colors
- Dark overrides under `[data-theme="dark"]`
- Transitions: `0.3s ease` on background/shadow/text-color
- Responsive breakpoints: 768px, 480px

## DOM Ref Pattern

All `document.getElementById()` calls are done once at module level in `state.js`. Never re-query the DOM for elements already referenced there.