// App Configuration
const GIST_CONFIG = {
  id: "f4a344cb21cd8443b956360a1178dd9d",
  account: "tcrjrubx4xcg2tzfj4-g",
  filename: "recipes.json",
};

// App State
let deferredPrompt = null;
let isOnline = navigator.onLine;
let recipes = [];
let editingId = null;
let syncInProgress = false;
let githubToken = null;

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
const recipeListEl = document.getElementById("recipe-list");
const recipeCountEl = document.getElementById("recipe-count");
const searchInput = document.getElementById("search-input");
const modalOverlay = document.getElementById("modal-overlay");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");
const emptyState = document.getElementById("empty-state");
const syncStatus = document.getElementById("sync-status");
const syncText = document.getElementById("sync-text");
const syncNowBtn = document.getElementById("sync-now-btn");

// ==================== Servings Calculation ====================

function calculateServings(totalCalories) {
  if (!totalCalories || totalCalories <= 0) return 0;
  return Math.max(1, Math.round(totalCalories / 600));
}

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

// ==================== GitHub Gist API ====================

async function fetchGist() {
  if (!githubToken) {
    throw new Error("No GitHub token configured");
  }

  const url = `https://api.github.com/gists/${GIST_CONFIG.id}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Please check your token.");
    }
    throw new Error(`Failed to fetch gist: ${response.status}`);
  }

  return await response.json();
}

async function updateGist(content) {
  if (!githubToken) {
    throw new Error("No GitHub token configured");
  }

  const url = `https://api.github.com/gists/${GIST_CONFIG.id}`;

  const payload = {
    files: {
      [GIST_CONFIG.filename]: {
        content: JSON.stringify(content, null, 2),
      },
    },
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Please check your token.");
    }
    throw new Error(`Failed to update gist: ${response.status}`);
  }

  return await response.json();
}

// ==================== Sync Logic (Last-Write-Wins) ====================

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

async function syncWithGist() {
  if (syncInProgress || !githubToken) return;

  syncInProgress = true;
  syncText.textContent = "Syncing...";
  syncStatus.hidden = false;

  try {
    // Fetch current gist
    const gist = await fetchGist();
    const remoteContent = gist.files[GIST_CONFIG.filename]?.content;

    let remoteData = { recipes: [], lastUpdated: null };
    if (remoteContent) {
      try {
        const parsed = JSON.parse(remoteContent);
        // Handle both formats: {recipes: [...]} or just [...]
        remoteData = parsed.recipes
          ? parsed
          : { recipes: parsed, lastUpdated: null };
      } catch (e) {
        console.error("Error parsing remote recipes:", e);
      }
    }

    const remoteRecipes = remoteData.recipes || [];

    // If local is empty and remote has recipes, always load from remote
    if (recipes.length === 0 && remoteRecipes.length > 0) {
      recipes = remoteRecipes;
      saveRecipesLocal();
      console.log("[Sync] Loaded recipes from remote gist");
    } else {
      // Last-write-wins: compare timestamps
      const localLastUpdated = new Date(getRecipesLastUpdated()).getTime();
      const remoteLastUpdated = remoteData.lastUpdated
        ? new Date(remoteData.lastUpdated).getTime()
        : remoteRecipes.length > 0
          ? Math.max(
              ...remoteRecipes.map((r) =>
                new Date(r.updatedAt || r.createdAt).getTime(),
              ),
            )
          : 0;

      if (remoteLastUpdated > localLastUpdated) {
        // Remote is newer, use remote
        recipes = remoteRecipes;
        saveRecipesLocal();
        console.log("[Sync] Updated from remote gist");
      } else if (localLastUpdated > remoteLastUpdated) {
        // Local is newer, push to remote
        await updateGist({ recipes, lastUpdated: new Date().toISOString() });
        console.log("[Sync] Pushed to remote gist");
      } else {
        console.log("[Sync] Already in sync");
      }
    }

    syncText.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
    renderRecipes();
  } catch (error) {
    console.error("[Sync] Error:", error);
    syncText.textContent = `Sync failed: ${error.message}`;

    if (error.message.includes("Authentication failed")) {
      showTokenCard();
    }
  } finally {
    syncInProgress = false;
  }
}

// ==================== Recipe CRUD Operations ====================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function addRecipe(recipeData) {
  const recipe = {
    id: generateId(),
    name: recipeData.name,
    source: recipeData.source,
    calories: recipeData.calories,
    ingredients: recipeData.ingredients,
    instructions: recipeData.instructions,
    notes: recipeData.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  recipes.unshift(recipe);
  saveRecipesLocal();
  setRecipesLastUpdated();

  // Async sync to gist
  syncWithGist().catch((e) => console.error("Sync error:", e));

  return recipe;
}

function updateRecipe(id, recipeData) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index !== -1) {
    recipes[index] = {
      ...recipes[index],
      name: recipeData.name,
      source: recipeData.source,
      calories: recipeData.calories,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      notes: recipeData.notes,
      updatedAt: new Date().toISOString(),
    };
    saveRecipesLocal();
    setRecipesLastUpdated();

    // Async sync to gist
    syncWithGist().catch((e) => console.error("Sync error:", e));

    return recipes[index];
  }
  return null;
}

function deleteRecipe(id) {
  if (!confirm("Are you sure you want to delete this recipe?")) return;

  recipes = recipes.filter((r) => r.id !== id);
  saveRecipesLocal();
  setRecipesLastUpdated();

  // Async sync to gist
  syncWithGist().catch((e) => console.error("Sync error:", e));

  renderRecipes();
}

function getRecipeById(id) {
  return recipes.find((r) => r.id === id);
}

// ==================== Form Handling ====================

function resetForm() {
  editingId = null;
  recipeForm.reset();
  recipeIdInput.value = "";
  formTitle.textContent = "📝 Add New Recipe";
  saveBtn.textContent = "💾 Save Recipe";
  formCard.scrollIntoView({ behavior: "smooth" });
}

function populateForm(recipe) {
  editingId = recipe.id;
  recipeIdInput.value = recipe.id;
  nameInput.value = recipe.name;
  sourceInput.value = recipe.source || "";
  caloriesInput.value = recipe.calories || "";
  ingredientsInput.value = (recipe.ingredients || []).join("\n");
  instructionsInput.value = (recipe.instructions || []).join("\n");
  notesInput.value = recipe.notes ? recipe.notes.join("\n") : "";
  formTitle.textContent = "✏️ Edit Recipe";
  saveBtn.textContent = "💾 Update Recipe";
  formCard.scrollIntoView({ behavior: "smooth" });
}

function handleFormSubmit(e) {
  e.preventDefault();

  const recipeData = {
    name: nameInput.value.trim(),
    source: sourceInput.value.trim() || null,
    calories: caloriesInput.value ? parseInt(caloriesInput.value) : null,
    ingredients: ingredientsInput.value
      .split("\n")
      .filter((line) => line.trim()),
    instructions: instructionsInput.value
      .split("\n")
      .filter((line) => line.trim()),
    notes: notesInput.value
      ? notesInput.value.split("\n").filter((line) => line.trim())
      : [],
  };

  if (editingId) {
    updateRecipe(editingId, recipeData);
  } else {
    addRecipe(recipeData);
  }

  resetForm();
  renderRecipes();
}

// ==================== Recipe Rendering ====================

function getFilteredRecipes() {
  const searchTerm = searchInput.value.toLowerCase();

  return recipes.filter((recipe) => {
    const matchesSearch =
      !searchTerm ||
      recipe.name.toLowerCase().includes(searchTerm) ||
      recipe.ingredients && recipe.ingredients.some((ing) => ing.toLowerCase().includes(searchTerm));
    return matchesSearch;
  });
}

function createRecipeCard(recipe) {
  const card = document.createElement("div");
  card.className = "recipe-card";
  card.dataset.id = recipe.id;

  const ingredientsPreview = (recipe.ingredients || []).slice(0, 3).join(", ");
  const hasMoreIngredients = (recipe.ingredients || []).length > 3;

  card.innerHTML = `
        <div class="recipe-card-header">
            <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
        </div>
        <div class="recipe-card-meta">
            ${recipe.calories ? `<span>🔥 ${recipe.calories} cal</span> <span>👥 ${calculateServings(recipe.calories)} servings</span>` : ""}
            ${recipe.source ? `<span>📖 ${escapeHtml(recipe.source)}</span>` : ""}
            <span>📅 ${new Date(recipe.createdAt).toLocaleDateString()}</span>
        </div>
        ${recipe.ingredients && recipe.ingredients.length > 0 ? `<div class="recipe-card-ingredients">
            <strong>Ingredients:</strong> ${escapeHtml(ingredientsPreview)}${hasMoreIngredients ? "..." : ""}
        </div>` : ""}
        <div class="recipe-card-actions">
            <button class="btn btn-secondary btn-small" data-action="view" data-id="${recipe.id}">👁️ View</button>
            <button class="btn btn-secondary btn-small" data-action="edit" data-id="${recipe.id}">✏️ Edit</button>
            <button class="btn btn-danger btn-small" data-action="delete" data-id="${recipe.id}">🗑️ Delete</button>
        </div>
    `;

  // Add click handlers for buttons
  card.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "view") {
        showRecipeModal(id);
      } else if (action === "edit") {
        const recipe = getRecipeById(id);
        if (recipe) populateForm(recipe);
      } else if (action === "delete") {
        deleteRecipe(id);
      }
    });
  });

  // Click card to view
  card.addEventListener("click", () => {
    showRecipeModal(recipe.id);
  });

  return card;
}

function renderRecipes() {
  const filteredRecipes = getFilteredRecipes();

  recipeListEl.innerHTML = "";

  if (filteredRecipes.length === 0) {
    emptyState.hidden = false;
    recipeListEl.hidden = true;
  } else {
    emptyState.hidden = true;
    recipeListEl.hidden = false;

    filteredRecipes.forEach((recipe) => {
      const card = createRecipeCard(recipe);
      recipeListEl.appendChild(card);
    });
  }

  recipeCountEl.textContent = `${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? "s" : ""}`;
}

// ==================== Modal ====================

function showRecipeModal(id) {
  const recipe = getRecipeById(id);
  if (!recipe) return;

  modalContent.innerHTML = `
        <div class="modal-header">
            <h2>${escapeHtml(recipe.name)}</h2>
        </div>
        <div class="modal-meta">
            ${recipe.calories ? `<span>🔥 ${recipe.calories} calories</span> <span>👥 ${calculateServings(recipe.calories)} servings</span>` : ""}
            ${recipe.source ? `<span>📖 Source: ${escapeHtml(recipe.source)}</span>` : ""}
        </div>
        ${recipe.ingredients && recipe.ingredients.length > 0 ? `
        <div class="modal-section">
            <h3>📋 Ingredients</h3>
            <ul>
                ${recipe.ingredients.map((ing) => `<li>${escapeHtml(ing)}</li>`).join("")}
            </ul>
        </div>
        ` : ""}
        ${recipe.instructions && recipe.instructions.length > 0 ? `
        <div class="modal-section">
            <h3>📝 Instructions</h3>
            <ol>
                ${recipe.instructions.map((inst) => `<li>${escapeHtml(inst)}</li>`).join("")}
            </ol>
        </div>
        ` : ""}
        ${
          recipe.notes && recipe.notes.length > 0
            ? `
        <div class="modal-section">
            <h3>📌 Notes</h3>
            <ul>
                ${recipe.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
            </ul>
        </div>
        `
            : ""
        }
        <div class="modal-section">
            <p class="hint">Created: ${new Date(recipe.createdAt).toLocaleString()}</p>
            <p class="hint">Updated: ${new Date(recipe.updatedAt).toLocaleString()}</p>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-edit-btn">✏️ Edit</button>
            <button class="btn btn-danger" id="modal-delete-btn">🗑️ Delete</button>
        </div>
    `;

  // Add modal button handlers
  document.getElementById("modal-edit-btn").addEventListener("click", () => {
    hideModal();
    populateForm(recipe);
  });

  document.getElementById("modal-delete-btn").addEventListener("click", () => {
    hideModal();
    deleteRecipe(id);
  });

  modalOverlay.hidden = false;
}

function hideModal() {
  modalOverlay.hidden = true;
}

// ==================== Theme Management ====================

function initTheme() {
  try {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeToggleBtn.textContent = "☀️";
    }
  } catch (e) {
    console.error("Error loading theme:", e);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    themeToggleBtn.textContent = "🌙";
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggleBtn.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  }
}

// ==================== Online/Offline Status ====================

function updateOnlineStatus() {
  isOnline = navigator.onLine;
  if (isOnline) {
    statusEl.textContent = "🟢 Online";
    statusEl.className = "status-online";
  } else {
    statusEl.textContent = "🔴 Offline";
    statusEl.className = "status-offline";
  }
}

// ==================== Utilities ====================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Event Listeners Setup ====================

function setupEventListeners() {
  recipeForm.addEventListener("submit", handleFormSubmit);
  searchInput.addEventListener("input", renderRecipes);
  themeToggleBtn.addEventListener("click", toggleTheme);
  syncNowBtn.addEventListener("click", () => syncWithGist());

  // Token save button
  saveTokenBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    if (!token) {
      showTokenError("Please enter a valid token");
      return;
    }

    hideTokenError();
    if (saveToken(token)) {
      hideTokenCard();
      syncWithGist();
    } else {
      showTokenError("Failed to save token");
    }
  });

  // Modal close
  modalClose.addEventListener("click", hideModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  // ESC to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) {
      hideModal();
    }
  });
}

function setupNetworkListeners() {
  window.addEventListener("online", () => {
    updateOnlineStatus();
    console.log("[App] Back online");
    // Try to sync when back online
    if (githubToken) {
      syncWithGist();
    }
  });

  window.addEventListener("offline", () => {
    updateOnlineStatus();
    console.log("[App] Gone offline");
  });
}

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log(
            "[App] ServiceWorker registration successful:",
            registration,
          );
        })
        .catch((error) => {
          console.log("[App] ServiceWorker registration failed:", error);
        });
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
    console.log("[App] Install prompt ready");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[App] User response to install prompt: ${outcome}`);

    deferredPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    console.log("[App] PWA was installed");
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function initApp() {
  // Load local recipes first
  loadRecipesLocal();
  initTheme();
  updateOnlineStatus();
  setupServiceWorker();
  setupInstallPrompt();
  setupNetworkListeners();
  setupEventListeners();

  // Check if token is configured
  if (loadToken()) {
    hideTokenCard();
    // Initial sync with gist
    syncWithGist();
  } else {
    showTokenCard();
  }

  renderRecipes();
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);
