/**
 * @typedef {Object} Recipe
 * @property {string}   id          - Unique ID, generated via generateId()
 * @property {string}   name        - Recipe title (required)
 * @property {?string}  source      - Source attribution, e.g. "Cookbook p. 42"
 * @property {?number}  calories    - Total calories for the recipe
 * @property {string[]} ingredients - Ingredient lines, e.g. ["2 cups flour", "3 eggs"]
 * @property {string[]} instructions - Instruction steps, one per line
 * @property {string[]} notes       - Additional notes, optional
 * @property {string}   createdAt   - ISO 8601 timestamp of creation
 * @property {string}   updatedAt   - ISO 8601 timestamp of last edit
 */

/**
 * @typedef {Object} GistPayload
 * @property {Recipe[]} recipes     - Full array of recipes
 * @property {string}   lastUpdated - ISO 8601 timestamp of last write
 * @property {Object}   files       - Gist file map (keyed by filename)
 */

// App Configuration
const GIST_CONFIG = {
  id: "f4a344cb21cd8443b956360a1178dd9d",
  filename: "recipes.json",
};

// App State
let deferredPrompt = null;
let recipes = [];
let editingId = null;
let syncInProgress = false;
let githubToken = null;
let wakeLock = null;
let shuffleActive = false;

// DOM Elements
const statusEl = document.getElementById("status");
const installBtn = document.getElementById("install-btn");
const themeToggleBtn = document.getElementById("theme-toggle");
const tokenCard = document.getElementById("token-card");
const tokenInput = document.getElementById("github-token");
const saveTokenBtn = document.getElementById("save-token-btn");
const tokenError = document.getElementById("token-error");
const formCard = document.getElementById("form-card");
const formTitle = document.getElementById("form-title");
const recipeForm = document.getElementById("recipe-form");
const recipeIdInput = document.getElementById("recipe-id");
const nameInput = document.getElementById("recipe-name");
const sourceInput = document.getElementById("recipe-source");
const caloriesInput = document.getElementById("recipe-calories");
const ingredientsInput = document.getElementById("recipe-ingredients");
const instructionsInput = document.getElementById("recipe-instructions");
const notesInput = document.getElementById("recipe-notes");
const saveBtn = document.getElementById("save-btn");
const formToggleBtn = document.getElementById("form-toggle-btn");
const recipeListEl = document.getElementById("recipe-list");
const recipeCountEl = document.getElementById("recipe-count");
const searchInput = document.getElementById("search-input");
const modalOverlay = document.getElementById("modal-overlay");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");
const emptyState = document.getElementById("empty-state");
const shuffleBtn = document.getElementById("shuffle-btn");
const syncStatus = document.getElementById("sync-status");
const syncText = document.getElementById("sync-text");
const syncNowBtn = document.getElementById("sync-now-btn");

// ==================== Token Management ====================

function loadToken() {
  try {
    const stored = localStorage.getItem("github_token");
    if (stored) {
      githubToken = stored;
      return true;
    }
  } catch (e) {
    console.error("Error loading token:", e);
  }
  return false;
}

function saveToken(token) {
  try {
    localStorage.setItem("github_token", token);
    githubToken = token;
    return true;
  } catch (e) {
    console.error("Error saving token:", e);
    return false;
  }
}

function showTokenCard() {
  tokenCard.hidden = false;
  formCard.hidden = true;
  syncStatus.hidden = true;
}

function hideTokenCard() {
  tokenCard.hidden = true;
  formCard.hidden = false;
  syncStatus.hidden = false;
}

function showTokenError(message) {
  tokenError.textContent = message;
  tokenError.hidden = false;
}

function hideTokenError() {
  tokenError.hidden = true;
}

// ==================== Local Storage Helpers ====================

function loadRecipesLocal() {
  try {
    const stored = localStorage.getItem("recipes");
    recipes = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading recipes:", e);
    recipes = [];
  }
}

function saveRecipesLocal() {
  try {
    localStorage.setItem("recipes", JSON.stringify(recipes));
  } catch (e) {
    console.error("Error saving recipes:", e);
  }
}

function getRecipesLastUpdated() {
  try {
    return localStorage.getItem("recipes_last_updated") || "0";
  } catch (e) {
    return "0";
  }
}

function setRecipesLastUpdated() {
  try {
    localStorage.setItem("recipes_last_updated", new Date().toISOString());
  } catch (e) {
    console.error("Error saving timestamp:", e);
  }
}
