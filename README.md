# ABSL Production Planning Dashboard
**AKIJ Resource Group — Asphalt SBU**

Live dashboard that **auto-updates whenever you edit the Google Sheet** — no page refresh needed. Uses Google Apps Script as a serverless backend.

---

## ⚡ How it works

```
Google Sheet edited
        ↓
Apps Script onEdit trigger fires → cache cleared
        ↓
Dashboard polls Apps Script URL every 30s
        ↓
If data changed → re-render all charts & tables instantly
```

---

## 🚀 Full Deployment Guide

### PART 1 — Set up the Apps Script backend (5 minutes)

**Step 1** — Open your Google Sheet:


**Step 2** — Go to **Extensions → Apps Script**

**Step 3** — Delete all existing code, then paste the entire contents of `google_apps_script.gs`

**Step 4** — Click **Save** (💾 icon or Ctrl+S)

**Step 5** — Deploy as Web App:
- Click **Deploy** → **New deployment**
- Click the gear icon ⚙️ next to "Type" → select **Web App**
- Description: `ABSL Dashboard API`
- Execute as: **Me**
- Who has access: **Anyone**
- Click **Deploy**
- ✅ **Copy the Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`)

**Step 6** — Install the auto-update trigger:
- In Apps Script editor, click the function dropdown (top bar) → select `setupTrigger`
- Click **Run ▶**
- When prompted, click **Review permissions** → **Allow**
- You should see `✅ onEdit trigger installed` in the log

---

### PART 2 — Configure the dashboard

**Step 7** — Open `data.js` in any text editor

**Step 8** — On line 17, replace the placeholder with your URL:
```js
// BEFORE:
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// AFTER:
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec';
```

---

### PART 3 — Deploy to GitHub Pages

**Step 9** — Create a new public GitHub repo at https://github.com/new
- Name: `absl-dashboard`
- Visibility: **Public**
- Click **Create repository**

**Step 10** — Upload all these files to the repo:
```
index.html
style.css
data.js          ← make sure you saved the URL in Step 8
charts.js
app.js
README.md
.github/workflows/deploy.yml
```

> **Easiest way:** On the repo page click "uploading an existing file" → drag all files → Commit changes

**Step 11** — Enable GitHub Pages:
- Repo **Settings** → **Pages**
- Source: **GitHub Actions** (if using deploy.yml) OR **Deploy from branch → main → / (root)**
- Click **Save**

**Step 12** — Wait ~2 minutes, then visit:
```
https://YOUR_GITHUB_USERNAME.github.io/absl-dashboard/
```

---

## 🔄 How auto-update works after deployment

| Event | What happens |
|-------|-------------|
| You edit any cell in the sheet | Apps Script `onEdit` fires → internal cache cleared |
| Dashboard polls (every 30s) | Fetches fresh JSON from Apps Script |
| Data is different from last fetch | All charts, KPIs, and tables re-render |
| Data is same | Nothing happens (no flicker) |
| Manual click on Refresh button | Immediate fetch + render |

The sync status dot in the header shows:
- 🔵 **Fetching…** — request in progress
- 🟢 **Live ✓** — connected and up to date
- 🟢 **↻ Updated** — data just changed and re-rendered
- 🔴 **Error** — Apps Script unreachable (check URL)

---

## 📁 File Structure
```
absl-dashboard/
├── index.html                    # Dashboard shell + all HTML
├── style.css                     # White-mode design system
├── data.js                       # Apps Script poller (put URL here)
├── charts.js                     # All 12 Chart.js chart definitions
├── app.js                        # KPI rendering, tables, filters
├── google_apps_script.gs         # Paste into Apps Script editor
├── README.md
└── .github/workflows/deploy.yml  # Auto GitHub Pages deploy
```

---

## 🛠️ Troubleshooting

**Dashboard shows "Setup required"**
→ You haven't pasted the Apps Script URL into `data.js` yet.

**Dashboard shows "Error – check Apps Script URL"**
→ The URL is wrong, or the Web App isn't deployed yet. Re-check Step 5.

**Data appears but doesn't update when sheet changes**
→ The `setupTrigger` function wasn't run. Go to Apps Script → Run → `setupTrigger`.

**CORS error in browser console**
→ Make sure "Who has access" is set to **Anyone** (not "Anyone with Google account") when deploying.

**Apps Script asks for permissions again after a while**
→ Normal — Google periodically re-prompts. Re-authorize in Apps Script editor.

---

*Built for AKIJ Resource Group · Operations Planning · April 2026*
