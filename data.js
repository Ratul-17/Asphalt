// =====================================================================
// data.js — Live Google Sheets via Apps Script Web App (v3)
// =====================================================================

// ▼▼▼ PASTE YOUR APPS SCRIPT WEB APP URL HERE ▼▼▼
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

const POLL_MS = 30000; // 30 seconds
let _lastHash = null, _pollTimer = null;

// ── fetch ─────────────────────────────────────────────────────────────
async function fetchLiveData() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_APPS_SCRIPT')) {
    throw new Error('SETUP_NEEDED');
  }
  // no-cors mode not needed — Apps Script sets CORS headers automatically
  const resp = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), {
    redirect: 'follow',
    cache:    'no-store',
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
  const json = await resp.json();
  if (!json.ok) throw new Error('Script error: ' + (json.error || 'unknown'));
  return json;
}

// ── hash ──────────────────────────────────────────────────────────────
function hashData(obj) {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return h.toString(36);
}

// ── UI helpers ────────────────────────────────────────────────────────
function setSyncState(state, text) {
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLabel');
  if (dot) dot.className = 'sync-dot ' + state;          // loading | synced | error
  if (lbl) lbl.textContent = text;
}
function showError(msg) {
  const b = document.getElementById('errorBanner');
  const t = document.getElementById('errorMsg');
  if (b) b.style.display = 'flex';
  if (t) t.innerHTML = msg;
}
function hideError() {
  const b = document.getElementById('errorBanner');
  if (b) b.style.display = 'none';
}
function showMain() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('mainContent').style.display   = 'block';
}

// ── main load ─────────────────────────────────────────────────────────
async function loadSheetData() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.classList.add('spinning');
  setSyncState('loading', 'Fetching…');
  hideError();

  try {
    const result = await fetchLiveData();
    const newHash = hashData(result.data);
    const changed = newHash !== _lastHash;

    if (changed) {
      window.SHEET_DATA = result.data;
      _lastHash = newHash;
      renderAll();
      // update footer timestamp
      const ft = document.getElementById('footerTs');
      if (ft) ft.textContent = 'Last updated: ' + new Date(result.ts).toLocaleString('en-BD');
      setSyncState('synced', '↻ Updated');
      setTimeout(() => setSyncState('synced', 'Live ✓'), 2500);
    } else {
      setSyncState('synced', 'Live ✓');
    }

  } catch(err) {
    console.error('[ABSL] fetch error:', err);

    if (err.message === 'SETUP_NEEDED') {
      showError(
        '⚙️ <strong>Setup needed:</strong> Open <code>data.js</code> and replace ' +
        '<code>YOUR_APPS_SCRIPT_WEB_APP_URL_HERE</code> with your deployed Apps Script URL. ' +
        'See README.md for full instructions.'
      );
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      showError(
        '🔌 <strong>Network error.</strong> Possible causes:<br>' +
        '① The Apps Script URL is wrong — double-check it in <code>data.js</code><br>' +
        '② The Web App access is not set to <strong>"Anyone"</strong> — re-deploy with that setting<br>' +
        '③ Your browser is blocking the request — try opening the URL directly: ' +
        '<a href="' + APPS_SCRIPT_URL + '" target="_blank">test link</a>'
      );
    } else if (err.message.includes('Script error')) {
      showError(
        '⚠️ <strong>Apps Script returned an error:</strong> ' + err.message + '<br>' +
        'Run <code>testRun()</code> in the Apps Script editor to diagnose.'
      );
    } else {
      showError('❌ ' + err.message);
    }

    setSyncState('error', 'Error');
  }

  if (btn) btn.classList.remove('spinning');
  showMain();
}

function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => loadSheetData().catch(() => {}), POLL_MS);
}

// ── boot ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSheetData().then(startPolling);
});
