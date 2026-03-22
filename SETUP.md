# Vacation Portal v2 — Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" — name it something like `wfp-vacation-portal`
3. Disable Google Analytics (not needed)
4. Wait for project creation

## 2. Enable Firestore

1. In the Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. Select **Start in test mode** (we'll add rules later)
4. Choose a region close to you (e.g., `us-central1`)

## 3. Register a Web App

1. In Project Settings (gear icon), scroll to "Your apps"
2. Click the web icon (`</>`) to add a web app
3. Name it "Vacation Portal"
4. **Do NOT** enable Firebase Hosting (we're using GitHub Pages)
5. Copy the `firebaseConfig` object from the setup screen

## 4. Configure the Portal

1. Copy `firebase-config.example.js` to `firebase-config.js`
2. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "wfp-vacation-portal.firebaseapp.com",
    projectId: "wfp-vacation-portal",
    storageBucket: "wfp-vacation-portal.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};

export default firebaseConfig;
```

## 5. Apply Firestore Security Rules

1. In the Firebase Console, go to **Firestore Database > Rules**
2. Replace the default rules with the contents of `firestore.rules`
3. Click "Publish"

## 6. Seed Initial Data

1. Open `scripts/seed.html` in a browser (served via HTTP, not file://)
2. Click "Seed Firestore"
3. This creates the doctor roster and sets the shared password to `wheaton2026`

To change the password or cutoff date later:
- Go to Firestore Console > `config` collection > `settings` document
- Edit the `password` or `cutoffDate` fields directly

## 7. Deploy to GitHub Pages

### Option A: Serve from subdirectory (same repo)

1. Go to your repo's **Settings > Pages**
2. Under "Source", select **GitHub Actions**
3. Create `.github/workflows/deploy-portal.yml`:

```yaml
name: Deploy Vacation Portal
on:
  push:
    branches: [main]
    paths: [vacation-portal-v2/**]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: vacation-portal-v2
      - id: deployment
        uses: actions/deploy-pages@v4
```

4. Push to main — the portal deploys to `https://<username>.github.io/<repo>/`

### Option B: Separate repo

1. Create a new repo (e.g., `wfp-vacation-portal`)
2. Copy the `vacation-portal-v2/` contents to the new repo root
3. Enable GitHub Pages from Settings > Pages > Source: main branch
4. The portal deploys to `https://<username>.github.io/wfp-vacation-portal/`

**Important:** Add `firebase-config.js` to the deployed files but NOT to version control. You can add it manually via the GitHub web UI or use a GitHub Action secret.

## 8. Share with Colleagues

Send your colleagues the GitHub Pages URL and the practice password. They can bookmark it on their phone or computer.

## Managing the Portal

| Task | How |
|------|-----|
| Change password | Edit `config/settings` in Firebase Console |
| Change cutoff date | Edit `config/settings.cutoffDate` in Firebase Console |
| Add/remove a doctor | Add/delete docs in `doctors` collection in Firebase Console |
| View all vacation data | Open Firestore Console > `vacations` collection |
