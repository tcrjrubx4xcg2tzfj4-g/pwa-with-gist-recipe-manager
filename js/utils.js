// ==================== Utilities ====================

function calculateServings(totalCalories) {
  if (!totalCalories || totalCalories <= 0) return 0;
  return Math.max(1, Math.round(totalCalories / 600));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
