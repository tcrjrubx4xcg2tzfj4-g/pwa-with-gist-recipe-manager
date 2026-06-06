// ==================== Collapsible Form ====================

function toggleForm(expand) {
  const shouldExpand =
    expand !== undefined ? expand : formCard.classList.contains("collapsed");
  formCard.classList.toggle("collapsed", !shouldExpand);
  formToggleBtn.setAttribute("aria-expanded", shouldExpand);
}

// ==================== Recipe Rendering ====================

function getFilteredRecipes() {
  const searchTerm = searchInput.value.toLowerCase();

  return recipes.filter((recipe) => {
    const matchesSearch =
      !searchTerm ||
      recipe.name.toLowerCase().includes(searchTerm) ||
      (recipe.ingredients &&
        recipe.ingredients.some((ing) =>
          ing.toLowerCase().includes(searchTerm),
        ));
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
        ${
          recipe.ingredients && recipe.ingredients.length > 0
            ? `<div class="recipe-card-ingredients">
            <strong>Ingredients:</strong> ${escapeHtml(ingredientsPreview)}${hasMoreIngredients ? "..." : ""}
        </div>`
            : ""
        }
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
  if (navigator.onLine) {
    statusEl.textContent = "🟢 Online";
    statusEl.className = "status-online";
  } else {
    statusEl.textContent = "🔴 Offline";
    statusEl.className = "status-offline";
  }
}
