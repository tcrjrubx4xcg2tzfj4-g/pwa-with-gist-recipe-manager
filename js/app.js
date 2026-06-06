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

  // Toggle form collapse
  formToggleBtn.addEventListener("click", () => toggleForm());
  formToggleBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleForm();
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
