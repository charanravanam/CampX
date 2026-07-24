# AttendWise - PWA Attendance Tracker & Forecast

AttendWise is a Progressive Web App (PWA) designed to track college attendance, calculate subject metrics, and forecast future attendance scenarios.

## Features & PWA Capabilities
- **Installable**: Supports "Add to Home Screen" on Android, iOS, and desktop browsers.
- **Offline Support**: Static UI assets and dataset cached via Service Worker.
- **Local Persistence**: User attendance records stored seamlessly in `localStorage`.
- **Automated Deployment**: GitHub Actions workflow builds and deploys to GitHub Pages on every push to `main`.

---

## Deployment to GitHub Pages Guide

Follow these steps to deploy **AttendWise** on GitHub Pages:

### 1. How to Create a GitHub Repository
1. Go to [GitHub](https://github.com) and sign in to your account.
2. Click the **+** icon in the top right corner and select **New repository**.
3. Name your repository (e.g., `AttendWise`).
4. Set visibility to **Public** (or **Private** if you have GitHub Pro/Enterprise for Pages).
5. Do **not** initialize with a README, .gitignore, or license. Click **Create repository**.

### 2. How to Change the Repository Name in `vite.config.ts`
1. Open `vite.config.ts` in your code editor.
2. Update the `repoName` variable on line 8 to match your exact GitHub repository name:
   ```typescript
   const repoName = 'AttendWise'; // Replace with your repository name
   ```
3. *Note:* When deployed via GitHub Actions, the workflow automatically sets `GITHUB_REPOSITORY`, so the base path will be configured dynamically as `/${repository_name}/`.

### 3. How to Push the Project to GitHub
Open your terminal in the project directory and run:

```bash
git init
git add .
git commit -m "Initial commit - AttendWise PWA"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

### 4. How to Enable GitHub Pages
1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Pages** (under Code and automation).
3. Under **Build and deployment**:
   - Set **Source** to **GitHub Actions**.
4. The `.github/workflows/deploy.yml` workflow will automatically run on every push to `main` and deploy your app.
5. Once the workflow completes, your app will be live at:
   `https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`

---

## Local Development & Build

### Run locally:
```bash
npm install
npm run dev
```

### Build for production:
```bash
npm run build
```
