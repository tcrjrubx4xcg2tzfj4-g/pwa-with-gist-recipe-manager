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

// ==================== Settings Defaults ====================

const DEFAULT_SETTINGS = {
  github_token: '',
  // Future settings go here, e.g.:
  // ai_api_key: '',
  // ai_model: '',
  // theme: 'dark',
};

let settings = {};

// ==================== Settings Management ====================

function loadSettings() {
  try {
    const stored = localStorage.getItem('settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults so new settings get defaults
      settings = { ...DEFAULT_SETTINGS, ...parsed };
    } else {
      // Try to migrate old github_token
      const oldToken = localStorage.getItem('github_token');
      settings = { ...DEFAULT_SETTINGS };
      if (oldToken) {
        settings.github_token = oldToken;
        localStorage.removeItem('github_token');
      }
    }
  } catch (e) {
    console.error('Error loading settings:', e);
    settings = { ...DEFAULT_SETTINGS };
  }
  // Update the global githubToken
  githubToken = settings.github_token || null;
}

function saveSettings() {
  try {
    localStorage.setItem('settings', JSON.stringify(settings));
    // Update the global githubToken
    githubToken = settings.github_token || null;
    return true;
  } catch (e) {
    console.error('Error saving settings:', e);
    return false;
  }
}

function getSetting(key) {
  return settings[key];
}

function setSetting(key, value) {
  settings[key] = value;
}

// ==================== App Configuration ====================

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
const installBtn = document.getElementById("install-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const settingsContent = document.getElementById("settings-content");
const settingsTokenInput = document.getElementById("settings-github-token");
const settingsSaveBtn = document.getElementById("settings-save-btn");
const settingsCancelBtn = document.getElementById("settings-cancel-btn");
const settingsError = document.getElementById("settings-error");
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

// ==================== Settings UI Helpers ====================

function showSettingsError(message) {
  settingsError.textContent = message;
  settingsError.hidden = false;
}

function hideSettingsError() {
  settingsError.hidden = true;
}

function populateSettingsForm() {
  settingsTokenInput.value = settings.github_token || '';
}

function readSettingsForm() {
  return {
    github_token: settingsTokenInput.value.trim(),
  };
}

// ==================== Local Storage Helpers ====================

// The old loadToken/saveToken/showTokenCard/hideTokenCard functions have been
// replaced by the settings-based approach above.
// All settings (including github_token) are now managed through loadSettings()
// and saveSettings(), stored as a single 'settings' JSON object in localStorage.

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
