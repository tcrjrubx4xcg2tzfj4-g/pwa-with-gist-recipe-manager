// ==================== Recipe CRUD Operations ====================

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
  toggleForm(true);
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
  toggleForm(false);
}
