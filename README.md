# 📔 Personal Digital Diary

> A private, distraction-free, offline-first personal digital diary with tactile paper aesthetics, multi-user isolation, Google Drive sync, and 4-digit PIN security.

[![React](https://img.shields.io/badge/React-18.3-61dafb.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Dexie.js](https://img.shields.io/badge/IndexedDB-Dexie.js-purple.svg)](https://dexie.org/)
[![PWA](https://img.shields.io/badge/PWA-Installable-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ✨ Features

- **📖 Authentic Journaling Feel:** Designed with a vintage paper aesthetic, custom Lora serif typography, ruled lines, and seamless switching between Paper and Night modes.
- **⚡ 100% Offline-First (IndexedDB):** All your memories, entries, and settings are saved locally in your browser using Dexie.js. Writes without internet and never loses your work.
- **🔄 Debounced Auto-Save:** Automatically saves your thoughts 650ms after you pause writing, with visual save indicators and manual <kbd>Ctrl</kbd> + <kbd>S</kbd> support.
- **🔒 Multi-User Database Isolation:** Each Gmail account is partitioned into its own separate IndexedDB instance (`PersonalDiaryDB_<email>`). Multiple accounts on the same computer never share or see each other's entries.
- **🛡️ 4-Digit PIN Lock & Auto-Lock:**
  - Secure your diary with an on-screen keypad or physical keyboard.
  - Optional **Auto-Lock on Blur** (locks the moment you switch tabs or minimize the window).
  - Quick-lock shortcut (<kbd>Ctrl</kbd> + <kbd>L</kbd>).
  - Forgot your PIN? Verify your identity with Google Sign-In to reset.
- **☁️ Two-Way Google Drive Synchronization:**
  - Uses the minimal, secure `drive.file` scope (the app can *only* access files it created).
  - Automatic download on login to retrieve entries written on other devices or last night.
  - Smart merging algorithm ensures newer edits are never overwritten.
- **📅 Interactive Calendar & Mood Tracker:**
  - Monthly calendar with entry indicators and mood badges (😊 Happy, 😌 Calm, ☕ Reflective, 🌧️ Thoughtful, ✨ Inspired).
  - Instant day previews with quick navigation to read or write.
- **✨ Memories & "On This Day" Time Travel:**
  - Rediscover entries written on the same date in previous years (*"1 year ago today"*).
  - Instant full-text search across titles, contents, tags, and moods.
  - Dedicated Favorites gallery for bookmarked reflections.
- **📸 Polaroid Photo Attachments:** Attach photos to your entries with retro Polaroid-style frames and tape effects, stored locally as Data URLs.
- **📄 Versatile Exporting & Printing:**
  - **Google Docs:** Export any entry to a cleanly formatted Google Doc in your Drive with one click.
  - **Markdown:** Download entries as offline `.md` files.
  - **Print / PDF:** Formatted print stylesheet for printing or saving clean PDFs (<kbd>Ctrl</kbd> + <kbd>P</kbd>).
  - **Full JSON Backup & Restore:** Export complete diary archives with duplicate detection and smart merge.
- **📱 Progressive Web App (PWA):** Installable as a standalone app on Windows, macOS, Android, and iOS with full offline service worker caching.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>S</kbd> | Force save active entry |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>L</kbd> | Instantly lock diary with PIN |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>D</kbd> | Toggle Paper / Night mode |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>P</kbd> | Open print / save as PDF dialog |
| <kbd>Alt</kbd> + <kbd>←</kbd> | Navigate to previous day |
| <kbd>Alt</kbd> + <kbd>→</kbd> | Navigate to next day |
| <kbd>Tab</kbd> (in editor) | Indent text by 2 spaces |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended)
- **npm** or **yarn** / **pnpm**
- *(Optional)* A Google Cloud OAuth 2.0 Web Client ID for Google Drive sync and Google Docs export.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/personal-digital-diary.git
cd personal-digital-diary
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Google OAuth Web Client ID:

```env
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

> **Note:** If you don't have a Google Client ID yet, you can still run the app! The diary allows you to continue as a **Local Guest (Offline Mode)** or configure your Client ID directly in the UI later via Settings.

### 4. Start the development server

```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## 🌐 Google Cloud Console Setup

To enable Google Sign-In, Google Drive Sync, and Google Docs Export:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Personal Diary`).
3. Navigate to **APIs & Services** > **Library**:
   - Enable **Google Drive API**
   - Enable **Google Docs API**
4. Configure the **OAuth consent screen**:
   - User Type: **External**
   - App Name: `Personal Digital Diary`
   - Scopes:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/documents`
     - `openid`, `email`, `profile`
   - In **Test users**, add your own Gmail address (if the app is in "Testing" mode).
5. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Application Type: **Web application**.
   - **Authorized JavaScript origins**:
     - For local development: `http://localhost:3000`
     - For production: `https://diary.yourdomain.com` *(HTTPS is mandatory for remote hosts)*
   - Authorized redirect URIs: Leave blank (GIS token client uses popup/in-page flow).
6. Copy the generated **Client ID** into your `.env` or paste it in the app's Settings page.

---

## 🛠️ Production Build & Self-Hosting

Because this is a client-side Single Page Application, it builds into static files (`dist/`) that can be hosted on any web server or VPS.

```bash
npm run build
```

### Option 1: Nginx (Ubuntu / Debian VPS)

1. Copy the `dist/` directory to `/var/www/diary`:
   ```bash
   sudo mkdir -p /var/www/diary
   sudo cp -r dist/* /var/www/diary/
   ```

2. Create `/etc/nginx/sites-available/diary`:
   ```nginx
   server {
       listen 80;
       server_name diary.yourdomain.com;

       root /var/www/diary;
       index index.html;

       # Single Page Application fallback
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Service Worker caching rules
       location /sw.js {
           add_header Cache-Control "no-cache";
           expires off;
       }

       # Static assets cache
       location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

3. Enable the site and configure SSL with Certbot:
   ```bash
   sudo ln -s /etc/nginx/sites-available/diary /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d diary.yourdomain.com
   ```

---

### Option 2: Docker & Docker Compose

Create a `Dockerfile` in the root:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Run with `docker compose`:

```yaml
services:
  diary:
    build:
      context: .
      args:
        VITE_GOOGLE_CLIENT_ID: "your-client-id.apps.googleusercontent.com"
    ports:
      - "8080:80"
    restart: always
```

```bash
docker compose up -d --build
```

---

### Option 3: Caddy Server (Automatic HTTPS)

Add to `/etc/caddy/Caddyfile`:

```caddy
diary.yourdomain.com {
    root * /var/www/diary
    file_server
    try_files {path} /index.html
}
```

```bash
sudo systemctl reload caddy
```

---

## 📁 Project Directory Structure

```
├── public/
│   ├── icons/            # App icons for PWA & favicon
│   ├── manifest.json     # PWA Web App Manifest
│   └── sw.js             # Service Worker for offline support
├── src/
│   ├── auth/
│   │   └── googleAuth.js # Google OAuth 2.0 GIS token client & account management
│   ├── backup/
│   │   ├── backup.js     # JSON archive export, import, validation & merge logic
│   │   └── googleDrive.js# Google Drive API v3 sync & file operations
│   ├── components/
│   │   ├── AuthScreen.jsx  # Sign-in / Guest mode gatekeeper
│   │   ├── Calendar.jsx    # Monthly calendar with entry previews & mood indicators
│   │   ├── DiaryPage.jsx   # Core journaling sheet, photo attachments & editor
│   │   ├── LockScreen.jsx  # 4-digit PIN security lock screen & keypad
│   │   ├── Memories.jsx    # "On This Day" flashbacks, search & favorites
│   │   ├── Navigation.jsx  # Navigation bar, user profile & quick lock
│   │   └── SettingsPage.jsx# Cloud sync, PIN security, theme & client config
│   ├── database/
│   │   ├── db.js         # Dexie.js database schema & per-user partitioning proxy
│   │   └── diaryStore.js # CRUD operations, search, PIN storage & migrations
│   ├── export/
│   │   └── googleDocs.js # Google Docs API exporter & print/markdown handlers
│   ├── styles/           # CSS modules for paper aesthetic, night mode & UI
│   ├── App.jsx           # Main application state, theme, lock & router
│   └── main.jsx          # App bootstrap & service worker registration
├── .env.example          # Environment variable template
├── index.html            # Main HTML entry with Lora & Inter web fonts
├── package.json          # Dependencies & scripts
└── vite.config.js        # Vite build configuration
```

---

## 🔒 Privacy & Security Architecture

1. **Zero Third-Party Servers:** Your diary entries are never sent to any intermediary server. All requests go directly between your browser and Google APIs.
2. **Minimal Scopes:** The app requests `drive.file`, meaning it can only see and edit the `diary-backup.json` file it created. It cannot view any of your other Google Drive files.
3. **No Secret Keys in Client:** Authentication is handled strictly via client-side OAuth 2.0 Access Tokens. No Google Client Secrets are stored or required.
4. **Physical Device Protection:** The 4-digit PIN lock prevents unauthorized viewing when stepping away from your desk.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
