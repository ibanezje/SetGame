# Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the app version (from `client/package.json`) as a small footer on the home screen.

**Architecture:** Vite's `define` config injects the version string at build time as a global constant `__APP_VERSION__`. `Home.jsx` renders it in a `<p>` at the bottom of the screen. A CSS class styles it as muted, small footer text.

**Tech Stack:** Vite (define), React, CSS

---

### Task 1: Inject version via Vite define

**Files:**
- Modify: `client/vite.config.js`

- [ ] **Step 1: Add version injection to vite.config.js**

Open `client/vite.config.js` and add the `define` field so the version from `package.json` is available as `__APP_VERSION__` at build/dev time:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'SET Multiplayer',
        short_name: 'SET',
        description: 'Real-time multiplayer SET card game',
        theme_color: '#1a5c38',
        background_color: '#1a5c38',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
cd client
npm run dev
```

Expected: server starts on `http://localhost:5173` with no errors. Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add client/vite.config.js
git commit -m "build: inject app version via vite define"
```

---

### Task 2: Render version in Home.jsx

**Files:**
- Modify: `client/src/pages/Home.jsx`

- [ ] **Step 1: Add version footer to Home.jsx**

At the very bottom of the returned JSX in `Home.jsx`, after the existing `<p className="home-rules-hint">` line, add:

```jsx
<p className="home-version">v{__APP_VERSION__}</p>
```

The full return block bottom should look like:

```jsx
      <p className="home-rules-hint">2–4 players · Find SETs before your opponents!</p>
      <p className="home-version">v{__APP_VERSION__}</p>
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "feat: show app version on home screen"
```

---

### Task 3: Style the version footer

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Add CSS class for version text**

Find the `.home-rules-hint` rule in `client/src/index.css` and add the new class directly after it:

```css
.home-version { color: rgba(255,255,255,.35); font-size: 11px; text-align: center; margin-top: 4px; }
```

- [ ] **Step 2: Verify visually**

```bash
cd client
npm run dev
```

Open `http://localhost:5173`. The home screen should show a small, muted `v1.0.0` at the bottom of the page.

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "style: version footer on home screen"
```
