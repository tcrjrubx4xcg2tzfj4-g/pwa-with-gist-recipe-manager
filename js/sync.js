// ==================== Sync Logic (Last-Write-Wins) ====================

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
