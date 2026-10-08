// ==================== Recipe CRUD Operations ====================

function addRecipe(recipeData) {
  const recipe = {
    id: generateId(),
    name: recipeData.name,
    source: recipeData.source,
    calories: recipeData.calories,
    caloriesSource: recipeData.caloriesSource,
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

  renderRecipes();

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
      caloriesSource: recipeData.caloriesSource,
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      notes: recipeData.notes,
      updatedAt: new Date().toISOString(),
    };
    saveRecipesLocal();
    setRecipesLastUpdated();

    // Async sync to gist
    syncWithGist().catch((e) => console.error("Sync error:", e));

    renderRecipes();

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

function setRecipeCalories(id, calories, source = "ai") {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return false;

  recipes[index].calories = calories;
  recipes[index].caloriesSource = source;

  saveRecipesLocal();
  setRecipesLastUpdated();

  // Async sync to gist
  syncWithGist().catch((e) => console.error("Sync error:", e));

  renderRecipes();

  return true;
}

// ==================== Form Handling ====================

function resetForm() {
  editingId = null;
  recipeForm.reset();
  recipeIdInput.value = "";
  formTitle.textContent = "📝 Add New Recipe";
  saveBtn.textContent = "💾 Save Recipe";
  formCard.scrollIntoView({ behavior: "smooth" });
  toggleForm(true);
}

function populateForm(recipe) {
  originalIngredients = [...(recipe.ingredients || [])];
  editingId = recipe.id;
  recipeIdInput.value = recipe.id;
  nameInput.value = recipe.name;
  sourceInput.value = recipe.source || "";
  // AI-generated calories are cleared so they can be re-estimated on save
  // rather than accidentally treated as a manual value.
  caloriesInput.value = recipe.caloriesSource === "ai" ? "" : recipe.calories || "";
  ingredientsInput.value = (recipe.ingredients || []).join("\n");
  instructionsInput.value = (recipe.instructions || []).join("\n");
  notesInput.value = recipe.notes ? recipe.notes.join("\n") : "";
  formTitle.textContent = "✏️ Edit Recipe";
  saveBtn.textContent = "💾 Update Recipe";
  formCard.scrollIntoView({ behavior: "smooth" });
  toggleForm(true);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const recipeData = {
    name: nameInput.value.trim(),
    source: sourceInput.value.trim() || null,
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

  // Decide calorie strategy:
  // 1. A value typed into the field is always a manual override.
  // 2. Manual calories (including legacy recipes) are preserved untouched.
  // 3. Everything else is AI territory: keep unchanged calories when the
  //    ingredients did not change, otherwise clear and re-estimate in the
  //    background.
  const userEnteredCalories = caloriesInput.value.trim() !== "";
  const existing = editingId ? getRecipeById(editingId) : null;

  if (userEnteredCalories) {
    recipeData.calories = parseInt(caloriesInput.value, 10);
    recipeData.caloriesSource = "manual";
  } else if (existing && calorieSourceOf(existing) === "manual") {
    recipeData.calories = existing.calories;
    recipeData.caloriesSource = "manual";
  } else {
    const ingredientsChanged =
      originalIngredients !== null &&
      JSON.stringify(originalIngredients) !== JSON.stringify(recipeData.ingredients);

    if (existing && !ingredientsChanged) {
      recipeData.calories = existing.calories;
      recipeData.caloriesSource = existing.caloriesSource || null;
    } else {
      recipeData.calories = null;
      recipeData.caloriesSource = undefined;
    }
  }

  // Save immediately (synchronous from the user's perspective)
  const saved = editingId
    ? updateRecipe(editingId, recipeData)
    : addRecipe(recipeData);

  // Fire-and-forget AI estimation when appropriate
  const shouldFireAI =
    saved &&
    saved.calories === null &&
    saved.ingredients.length > 0 &&
    getSetting("ai_api_key");

  if (shouldFireAI) {
    estimateCalories(saved.name, saved.ingredients)
      .then((estimated) => {
        if (estimated === null) return;
        setRecipeCalories(saved.id, estimated, "ai");
      })
      .catch((e) => console.error("[AI] Estimation error:", e));
  }

  originalIngredients = null;
  resetForm();
  toggleForm(false);
}
