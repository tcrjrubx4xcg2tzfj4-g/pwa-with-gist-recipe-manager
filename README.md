# Recipe Manager PWA

A Progressive Web App for managing recipes with GitHub Gist as a backend for multi-device sync.

## Features

- **Offline Support** — Service worker caches app shell for offline use
- **Installable** — Can be installed as a standalone app on mobile/desktop
- **Responsive Design** — Works on all screen sizes
- **Modern UI** — Clean, gradient background with card-based layout
- **Network Status** — Shows online/offline status indicator
- **GitHub Gist Backend** — Sync recipes across multiple devices
- **Last-Write-Wins** — Simple conflict resolution for multi-device editing
- **Dark Mode** — Toggle between light and dark themes
- **Search** — Search recipes by name and ingredients
- **Recipe Details** — View recipes with ingredients, instructions, and notes in a modal
- **Servings Calculation** — Auto-calculates servings based on total calories (~600 cal/serving)

## Setup Instructions

### 1. Create GitHub Personal Access Token

To use the Gist sync feature, you need a GitHub Personal Access Token:

1. Log in to [GitHub](https://github.com/)
2. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Give it a name (e.g., "Recipe Manager PWA")
5. Select the **gist** scope
6. Click **Generate token**
7. **Copy the generated token immediately** (you won't see it again!)

### 2. Serve the App

Use a local server (required for service workers):

```bash
# Python
python3 -m http.server 8000
```

### 3. Open in Browser

Visit `http://localhost:8000`

### 4. Configure the App

1. When you first open the app, you'll see a token configuration card
2. Paste your GitHub Personal Access Token
3. Click **Save Token**
4. The app will sync with the gist and load any existing recipes

## Notes

- Service workers require HTTPS (or localhost for development)
- Icons should be at least 192x192 and 512x512 pixels
- You can customize colors in `manifest.json` and `css/style.css`
- The app works offline and will sync when you're back online
- Your GitHub token is stored in localStorage (the browser's local storage)

## Troubleshooting

**Authentication Failed**: Make sure you've created a GitHub Personal Access Token with the **gist** scope.

**Sync Not Working**: Check your internet connection and verify the token is saved correctly.

**App Not Installing**: Ensure you're serving the app via a local server (not opening the HTML file directly).
