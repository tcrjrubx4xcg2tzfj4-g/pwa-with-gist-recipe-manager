// ==================== Event Listeners Setup ====================

function setupEventListeners() {
  recipeForm.addEventListener("submit", handleFormSubmit);
  searchInput.addEventListener("input", renderRecipes);
  syncNowBtn.addEventListener("click", () => syncWithGist());

  // Settings button
  settingsBtn.addEventListener("click", () => {
    showSettings();
  });

  // Settings save button
  settingsSaveBtn.addEventListener("click", async () => {
    const formData = readSettingsForm();

    hideSettingsError();

    // Save all settings immediately so user input is never lost.
    Object.keys(formData).forEach((key) => {
      settings[key] = formData[key];
    });

    if (!saveSettings()) {
      showSettingsError("Failed to save settings");
      return;
    }

    // Test configuration and show per-field feedback.
    settingsSaveBtn.disabled = true;
    const originalText = settingsSaveBtn.textContent;
    settingsSaveBtn.textContent = "⏳ Testing...";

    try {
      await validateAndReportSettings(formData);
    } finally {
      settingsSaveBtn.disabled = false;
      settingsSaveBtn.textContent = originalText;
    }

    renderRecipes();
  });

  // Settings cancel button
  settingsCancelBtn.addEventListener("click", () => {
    hideSettings();
  });

  // Settings close button
  settingsClose.addEventListener("click", () => {
    hideSettings();
  });

  // Settings overlay click to close
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) {
      hideSettings();
    }
  });

  // ESC to close settings
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsOverlay.hidden) {
      hideSettings();
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

  // Shuffle button
  shuffleBtn.addEventListener("click", toggleShuffle);

  // Toggle form collapse
  formToggleBtn.addEventListener("click", () => toggleForm());
  formToggleBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleForm();
    }
  });

  // Re-acquire wake lock if user returns to page while modal is open
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !modalOverlay.hidden && wakeLock === null) {
      requestWakeLock();
    }
  });
}

async function validateAndReportSettings(formData) {
  setSettingsStatus(settingsGithubStatus, "pending", "⏳ Testing...");
  setSettingsStatus(settingsAiKeyStatus, "pending", "⏳ Testing...");
  setSettingsStatus(settingsAiModelStatus, "pending", "⏳ Testing...");

  let githubResult = null;
  if (formData.github_token) {
    githubResult = await testGithubToken(formData.github_token);
  }

  if (githubResult === null) {
    setSettingsStatus(settingsGithubStatus, "skipped", "— not set");
  } else if (githubResult.ok) {
    setSettingsStatus(settingsGithubStatus, "ok", "✅ Valid");
  } else {
    setSettingsStatus(settingsGithubStatus, "error", `❌ ${githubResult.message}`);
  }

  let aiResult = null;
  if (formData.ai_api_key) {
    aiResult = await testOpenRouterConfig(
      formData.ai_api_key,
      formData.ai_model || DEFAULT_AI_MODEL,
    );
  }

  if (aiResult === null) {
    setSettingsStatus(settingsAiKeyStatus, "skipped", "— not set");
    setSettingsStatus(settingsAiModelStatus, "skipped", "— not set");
  } else if (aiResult.ok) {
    setSettingsStatus(settingsAiKeyStatus, "ok", "✅ Valid");
    setSettingsStatus(settingsAiModelStatus, "ok", "✅ Valid");
  } else if (aiResult.field === "model") {
    setSettingsStatus(settingsAiKeyStatus, "ok", "✅ Key accepted");
    setSettingsStatus(settingsAiModelStatus, "error", `❌ ${aiResult.message}`);
  } else {
    setSettingsStatus(settingsAiKeyStatus, "error", `❌ ${aiResult.message}`);
    setSettingsStatus(settingsAiModelStatus, "skipped", "— not tested");
  }

  const hasErrors =
    (githubResult !== null && !githubResult.ok) ||
    (aiResult !== null && !aiResult.ok);

  if (hasErrors) {
    showSettingsError(
      "Some settings failed validation. Fix the marked fields, then save again.",
    );
    return;
  }

  hideSettingsError();
  hideSettings();

  // Trigger an initial sync if a valid GitHub token was configured.
  if (githubResult !== null && githubResult.ok && githubToken) {
    syncWithGist();
  }
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

          // Check for updates to the service worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available — tell the old SW to skip waiting
                newWorker.postMessage({ action: "skipWaiting" });
              }
            });
          });

          // When a new service worker takes over, reload the page immediately
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
          });
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
  // Load settings first (migrates old format if needed)
  loadSettings();
  // Load local recipes
  loadRecipesLocal();
  setupServiceWorker();
  setupInstallPrompt();
  setupEventListeners();

  // If token is configured, sync with gist
  if (githubToken) {
    syncWithGist();
  }

  renderRecipes();
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);
