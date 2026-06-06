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
