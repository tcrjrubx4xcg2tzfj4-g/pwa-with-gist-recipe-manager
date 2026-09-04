// ==================== Collapsible Form ====================

function toggleForm(expand) {
  const shouldExpand =
    expand !== undefined ? expand : formCard.classList.contains("collapsed");
  formCard.classList.toggle("collapsed", !shouldExpand);
  formToggleBtn.setAttribute("aria-expanded", shouldExpand);
}

// ==================== Recipe Rendering ====================

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getFilteredRecipes() {
  const searchTerm = searchInput.value.toLowerCase();

  const filtered = recipes.filter((recipe) => {
    const matchesSearch =
      !searchTerm ||
      recipe.name.toLowerCase().includes(searchTerm) ||
      (recipe.ingredients &&
        recipe.ingredients.some((ing) =>
          ing.toLowerCase().includes(searchTerm),
        ));
    return matchesSearch;
  });

  if (shuffleActive) {
    return shuffleArray(filtered);
  }
  return filtered;
}

function createRecipeCard(recipe) {
  const card = document.createElement("div");
  card.className = "recipe-card";
  card.dataset.id = recipe.id;

  const portions = calculateServings(recipe.calories);

  card.innerHTML = `
        <div class="recipe-card-header">
            <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
            ${portions > 0 ? `<span class="recipe-card-portions">👥 ${portions} Portionen</span>` : ""}
        </div>
    `;

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
            ${recipe.source ? `<span>📖 Source: ${isUrl(recipe.source) ? `<a href="${escapeHtml(recipe.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.source)}</a>` : escapeHtml(recipe.source)}</span>` : ""}
        </div>
        ${
          recipe.ingredients && recipe.ingredients.length > 0
            ? `
        <div class="modal-section">
            <h3>📋 Ingredients</h3>
            <ul>
                ${recipe.ingredients.map((ing) => `<li>${escapeHtml(ing)}</li>`).join("")}
            </ul>
        </div>
        `
            : ""
        }
        ${
          recipe.instructions && recipe.instructions.length > 0
            ? `
        <div class="modal-section">
            <h3>📝 Instructions</h3>
            <ol>
                ${recipe.instructions.map((inst) => `<li>${escapeHtml(inst)}</li>`).join("")}
            </ol>
        </div>
        `
            : ""
        }
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

  // Start battery save timer (inactivity → pure black + wake lock)
  resetInactivityTimer();
}

function toggleShuffle() {
  shuffleActive = !shuffleActive;
  updateShuffleBtn();
  renderRecipes();
}

function updateShuffleBtn() {
  if (shuffleActive) {
    shuffleBtn.textContent = "📋";
    shuffleBtn.classList.add("active");
    shuffleBtn.title = "Restore original order";
  } else {
    shuffleBtn.textContent = "🔀";
    shuffleBtn.classList.remove("active");
    shuffleBtn.title = "Shuffle recipe order";
  }
}

function hideModal() {
  modalOverlay.hidden = true;
  clearTimeout(inactivityTimer);
  exitBatterySaveMode();
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

// ==================== Screen Wake Lock ====================

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.log('[App] Screen Wake Lock API not supported');
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      console.log('[App] Screen wake lock released');
    });
    console.log('[App] Screen wake lock acquired');
  } catch (e) {
    console.error('[App] Failed to acquire screen wake lock:', e);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => {
      wakeLock = null;
    }).catch((e) => {
      console.error('[App] Failed to release screen wake lock:', e);
    });
  }
}

// ==================== Battery Save Mode ====================

const INACTIVITY_TIMEOUT = 12000; // 12 seconds
let inactivityTimer = null;
let batterySaveActive = false;

function handleModalInteraction() {
  if (modalOverlay.hidden) return;

  if (batterySaveActive) {
    exitBatterySaveMode();
  }

  resetInactivityTimer();
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  inactivityTimer = setTimeout(enterBatterySaveMode, INACTIVITY_TIMEOUT);
}

function enterBatterySaveMode() {
  if (batterySaveActive || modalOverlay.hidden) return;
  batterySaveActive = true;
  document.querySelector('.modal').classList.add('modal-battery-save');
  requestWakeLock();
  console.log('[App] Battery save mode activated');
}

function exitBatterySaveMode() {
  if (!batterySaveActive) return;
  batterySaveActive = false;
  document.querySelector('.modal').classList.remove('modal-battery-save');
  releaseWakeLock();
  console.log('[App] Battery save mode deactivated');
}

function setupBatterySaveListeners() {
  const modal = document.querySelector('.modal');
  if (!modal) return;
  modal.addEventListener('pointerdown', handleModalInteraction);
  modal.addEventListener('touchstart', handleModalInteraction);
  modal.addEventListener('scroll', handleModalInteraction);
  console.log('[App] Battery save listeners attached');
}

// Initialize battery save listeners when the module loads
document.addEventListener('DOMContentLoaded', setupBatterySaveListeners);
