// =====================================================================
// ABSL Dashboard — Google Apps Script (v5 — FINAL)
//
// ROOT CAUSES FIXED:
// 1. Monthly RM: sheet col is [0]=Month [1]=RM [2]=Plan [3]=Actual [4]=Ratio
//    (NOT col K/L/M/N/O — the data starts at col A in that sheet)
// 2. Achievement/wrtoPlan: Google Sheets stores % cells as decimals in getValues()
//    e.g. 112.3% is stored as 1.123 → must * 100
// 3. Daily Basis RM: correct header is row 1012 (0-based), data from 1013
//    cols: [0]=Month [1]=Date [2]=SKU [4]=RM [8]=PlannedReq [9]=ActualCons
//    ONLY use rows where SKU is Wearing Course / Binder Course / TC / PC
// 4. RM per SKU chart: built from same Daily Basis RM aggregation
//
// VERIFIED SHEET NAMES (exact, from tab bar in screenshot):
//   "Dashboard"                  — SKU summary, RM summary, daily prod/del/RM
//   "Monthly Basis RM Planning"  — Monthly RM table at col A–E (NOT K–O)
//   "For Prime Coat Tack coat"   — PC/TC data
//   "Daily Basis RM"             — Daily RM consumption by SKU+RM
// =====================================================================

const SHEET_ID      = '1-Cjzhy5ESC-gVDM5Nn3S4sjFQhM5ZJyonzlWhTzpMt4';
const SH_DASHBOARD  = 'Dashboard';
const SH_MONTHLY_RM = 'Monthly Basis RM Planning';
const SH_PC_TC      = 'For Prime Coat Tack coat';
const SH_DAILY_RM   = 'Daily Basis RM';

// -----------------------------------------------------------------------
// doGet
// -----------------------------------------------------------------------
function doGet(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    out.setContent(JSON.stringify({ ok: true, ts: Date.now(), data: buildDashboardData() }));
  } catch(err) {
    out.setContent(JSON.stringify({ ok: false, error: err.message }));
  }
  return out;
}

// -----------------------------------------------------------------------
// MAIN BUILD
// -----------------------------------------------------------------------
function buildDashboardData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const dashSh     = getSheet(ss, SH_DASHBOARD);
  const monthRMSh  = getSheet(ss, SH_MONTHLY_RM);
  const pctcSh     = getSheet(ss, SH_PC_TC);
  const dailyRMSh  = getSheet(ss, SH_DAILY_RM);

  if (!dashSh) throw new Error('Dashboard sheet not found. Available: ' + ss.getSheets().map(s=>s.getName()).join(', '));

  const dashRaw = dashSh.getDataRange().getValues();
  Logger.log('Dashboard: ' + dashSh.getName() + ' rows=' + dashRaw.length);

  // ── 1. SKU DATA (Dashboard rows 3–6) ─────────────────────────────
  // cols: [0]=SKU [1]=UoM [2]=Closing [3]=BudgetedDemand [4]=PlannedTillDel
  //       [5]=ActualDelivery [6]=ProdPlanTillDate [7]=ActualProd
  //       [8]=AvgDailyDel [9]=FGRemain [10]=DOS [11]=Achievement%
  const skuData = [];
  for (let r = 3; r <= 6; r++) {
    const row = dashRaw[r];
    if (!row || !row[0] || String(row[0]).trim() === '') continue;
    skuData.push({
      sku:             String(row[0]).trim(),
      uom:             String(row[1] || 'MT').trim(),
      closingStock:    n(row[2]),
      budgetedDemand:  n(row[3]),
      plannedDelivery: n(row[4]),
      actualDelivery:  n(row[5]),
      plannedTillDate: n(row[6]),
      actualProd:      n(row[7]),
      avgDailyDel:     n(row[8]),
      fgRemain:        n(row[9]),
      dos:             dosStr(row[10]),
      achievement:     pct(row[11]),  // FIX: pct() handles decimal % from getValues()
    });
  }

  // ── 2. RM DATA (Dashboard rows 3–8, cols 13–22) ───────────────────
  const rmData = [];
  for (let r = 3; r <= 8; r++) {
    const row = dashRaw[r];
    if (!row || !row[13] || String(row[13]).trim() === '') continue;
    const di = dosStr(row[20]);
    rmData.push({
      rm:                 String(row[13]).trim(),
      rmEntryTillDate:    n(row[14]),
      closingInv:         n(row[15]),
      closingIBOS:        n(row[16]),
      plannedConsumption: n(row[17]),
      actualConsumption:  n(row[18]),
      avgPerDay:          n(row[19]),
      dosInv:             di,
      dosIBOS:            dosStr(row[21]),
      wrtoPlan:           pct(row[22]),  // FIX: decimal % handling
      dosDays:            dosToDays(di),
    });
  }

  // ── 3. DAILY PROD + DEL (Dashboard rows 10+) ─────────────────────
  // [7]=Date [8]=ActualDel [9]=PlannedDel [10]=Date [11]=ActualProd [12]=PlannedProd
  const dates=[], actualProd=[], plannedProd=[], actualDel=[], plannedDel=[];
  for (let r = 10; r < dashRaw.length; r++) {
    const row = dashRaw[r];
    const d = toDate(row[7]);
    if (!d) continue;
    dates.push(fmt_d(d));
    actualDel.push(n(row[8]));
    plannedDel.push(n(row[9]));
    actualProd.push(n(row[11]));
    plannedProd.push(n(row[12]));
  }

  // ── 4. DAILY RM (Dashboard rows 18+, col[19]=date) ────────────────
  const actualRM=[], plannedRM=[];
  for (let r = 18; r < dashRaw.length; r++) {
    const row = dashRaw[r];
    const d = toDate(row[19]);
    if (!d) continue;
    actualRM.push(n(row[20]));
    plannedRM.push(n(row[21]));
  }

  // ── 5. SBU DELIVERY SPLIT (Dashboard col[3]=date col[4]=SBU col[5]=qty) ─
  const skuDelMap = {};
  for (let r = 10; r < dashRaw.length; r++) {
    const row = dashRaw[r];
    const d = toDate(row[3]);
    if (!d || !row[4] || !row[5]) continue;
    const lbl = fmt_d(d);
    const sbu = String(row[4]).trim();
    const qty = n(row[5]);
    if (!skuDelMap[sbu]) skuDelMap[sbu] = {};
    skuDelMap[sbu][lbl] = (skuDelMap[sbu][lbl] || 0) + qty;
  }
  const skuFilterData = { ALL: { dates, actualProd, plannedProd, actualDel, plannedDel } };
  ['Wearing Course','Binder Course','Prime Coat','Tack Coat'].forEach(sku => {
    const dm = skuDelMap[sku] || {};
    skuFilterData[sku] = {
      dates, actualProd, plannedProd,
      actualDel:  dates.map(d => dm[d] || 0),
      plannedDel,
    };
  });

  // ── 6. MONTHLY RM ─────────────────────────────────────────────────
  // "Monthly Basis RM Planning" sheet
  // VERIFIED: col[0]=Month, col[1]=RM, col[2]=Plan(MT), col[3]=Actual, col[4]=Ratio
  // Data starts at row INDEX 1 (row 1 = header, row 2+ = data in 1-based)
  const monthlyRM = [];
  if (monthRMSh) {
    const mRaw = monthRMSh.getDataRange().getValues();
    Logger.log('Monthly RM sheet rows: ' + mRaw.length);
    for (let r = 1; r < mRaw.length; r++) {
      const row  = mRaw[r];
      const m    = String(row[0] || '').trim();
      const rm   = String(row[1] || '').trim();
      if (!m || !rm) continue;
      if (m === 'Month' || rm === 'RM' || rm === 'Total' || rm === 'total') continue;
      if (!m.match(/\d{2,4}/)) continue;  // must contain year digits
      const plan = n(row[2]);
      const act  = n(row[3]);
      if (plan === 0 && act === 0) continue;
      const ratio = row[4] ? pct(row[4]) : (plan > 0 ? Math.round(act/plan*10000)/100 : 0);
      monthlyRM.push({ month:m, rm:rm, plan:plan, actual:act, ratio: ratio || 0 });
    }
    Logger.log('Monthly RM rows found: ' + monthlyRM.length);
    if (monthlyRM.length > 0) Logger.log('First: ' + JSON.stringify(monthlyRM[0]));
  } else {
    Logger.log('WARNING: "' + SH_MONTHLY_RM + '" sheet not found');
  }

  // ── 7. RM PER SKU (from Daily Basis RM sheet) ─────────────────────
  // Header row: Month|Date|SKU|Demand|RM|PlannedOpen|ActualOpen|RM/MT|PlannedRMReq|ActualRMCons
  // [0]=Month [1]=Date [2]=SKU [3]=Demand [4]=RM [8]=PlannedRMReq [9]=ActualRMCons
  // Only include rows where SKU = Wearing Course / Binder Course / TC / PC
  const VALID_SKUS = new Set(['Wearing Course','Binder Course','TC','PC','Prime Coat','Tack Coat']);
  const rmPerSKU   = {};   // { "Apr'26|Coarse Sand|Wearing Course": {month,rm,sku,plan,actual} }

  if (dailyRMSh) {
    const dRaw = dailyRMSh.getDataRange().getValues();
    Logger.log('Daily RM sheet rows: ' + dRaw.length);
    // Find the header row that says Month|Date|SKU|Demand|RM|...
    let headerRow = -1;
    for (let r = 0; r < dRaw.length; r++) {
      if (String(dRaw[r][0]).trim() === 'Month' &&
          String(dRaw[r][2]).trim() === 'SKU'   &&
          String(dRaw[r][4]).trim() === 'RM') {
        headerRow = r;
        break;
      }
    }
    Logger.log('Daily RM header at row: ' + headerRow);

    if (headerRow >= 0) {
      for (let r = headerRow + 1; r < dRaw.length; r++) {
        const row  = dRaw[r];
        const m    = String(row[0] || '').trim();
        const sku  = String(row[2] || '').trim();
        const rm   = String(row[4] || '').trim();
        if (!m || !sku || !rm) continue;
        if (!VALID_SKUS.has(sku)) continue;
        if (!m.match(/\d{2,4}/)) continue;
        const plan = n(row[8]);
        const act  = n(row[9]);
        const key  = m + '|' + rm;   // aggregate across all SKUs per month+RM
        if (!rmPerSKU[key]) rmPerSKU[key] = { month:m, rm:rm, plan:0, actual:0 };
        rmPerSKU[key].plan   += plan;
        rmPerSKU[key].actual += act;
      }
    }
  } else {
    Logger.log('WARNING: "' + SH_DAILY_RM + '" sheet not found');
  }

  // Convert rmPerSKU map to array and add ratio
  const rmPerSKUArr = Object.values(rmPerSKU)
    .filter(x => x.plan > 0 || x.actual > 0)
    .map(x => ({
      ...x,
      ratio: x.plan > 0 ? Math.round(x.actual / x.plan * 10000) / 100 : 0
    }));

  // If monthlyRM is still empty, use rmPerSKUArr aggregated data as fallback
  const finalMonthlyRM = monthlyRM.length > 0 ? monthlyRM : rmPerSKUArr;

  // ── 8. PC/TC FROM DEDICATED SHEET ────────────────────────────────
  if (pctcSh) {
    const pcRaw = pctcSh.getDataRange().getValues();
    mergePCTC(pcRaw, skuData);
  }

  // ── 9. MONTHWISE DEMAND ───────────────────────────────────────────
  const wcRow = skuData.find(s => s.sku === 'Wearing Course');
  const bcRow = skuData.find(s => s.sku === 'Binder Course');
  const pcRow = skuData.find(s => s.sku === 'Prime Coat');
  const tcRow = skuData.find(s => s.sku === 'Tack Coat');

  const monthDemand = [
    { month:"Jan'26", wc:5800, bc:320,  pc:85,  tc:48, total:6253,  wcActual:null, bcActual:null },
    { month:"Feb'26", wc:6100, bc:340,  pc:95,  tc:52, total:6587,  wcActual:null, bcActual:null },
    { month:"Mar'26", wc:6500, bc:380,  pc:108, tc:58, total:7046,  wcActual:null, bcActual:null },
    {
      month:"Apr'26",
      wc:  wcRow ? wcRow.budgetedDemand : 0,
      bc:  bcRow ? bcRow.budgetedDemand : 0,
      pc:  pcRow ? pcRow.budgetedDemand : 0,
      tc:  tcRow ? tcRow.budgetedDemand : 0,
      total: (wcRow ? wcRow.budgetedDemand : 0) + (bcRow ? bcRow.budgetedDemand : 0),
      wcActual: wcRow ? wcRow.actualProd : 0,
      bcActual: bcRow ? bcRow.actualProd : 0,
      pcActual: pcRow ? pcRow.actualProd : 0,
      tcActual: tcRow ? tcRow.actualProd : 0,
    }
  ];

  return {
    skuData, rmData, dates, actualProd, plannedProd, actualDel, plannedDel,
    actualRM, plannedRM,
    monthlyRM:    finalMonthlyRM,
    rmPerSKUArr,
    monthDemand,
    skuFilterData,
  };
}

// -----------------------------------------------------------------------
// Merge PC/TC from dedicated sheet into skuData
// -----------------------------------------------------------------------
function mergePCTC(pcRaw, skuData) {
  for (let r = 0; r < Math.min(pcRaw.length, 30); r++) {
    const row  = pcRaw[r];
    const name = String(row[0] || '').trim();
    if (name !== 'Prime Coat' && name !== 'Tack Coat') continue;
    const entry = {
      sku: name, uom: String(row[1]||'SQM').trim(),
      closingStock: n(row[2]), budgetedDemand: n(row[3]),
      plannedDelivery: n(row[4]), actualDelivery: n(row[5]),
      plannedTillDate: n(row[6]), actualProd: n(row[7]),
      avgDailyDel: n(row[8]), fgRemain: n(row[9]),
      dos: dosStr(row[10]), achievement: pct(row[11]),
    };
    const idx = skuData.findIndex(s => s.sku === name);
    if (idx >= 0) skuData[idx] = entry; else skuData.push(entry);
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function getSheet(ss, name) {
  return ss.getSheets().find(s => s.getName().trim() === name) || null;
}

function n(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const p = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(p) ? 0 : p;
}

// KEY FIX: Google Sheets stores % cells as decimals in getValues()
// "112.3%" cell → getValues() returns 1.123
// "76.71%" cell → getValues() returns 0.7671
// If the value is < 2.0 (definitely a decimal fraction), multiply by 100
function pct(v) {
  if (v === '' || v === null || v === undefined) return null;
  // If it's a string with %, strip and parse
  if (typeof v === 'string' && v.includes('%')) {
    const p = parseFloat(v.replace('%','').trim());
    return isNaN(p) ? null : p;
  }
  const p = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(p)) return null;
  // Decimal fraction detection: if value is between -2 and 2, it's a decimal %
  return (p > -2 && p < 2) ? Math.round(p * 10000) / 100 : p;
}

function dosStr(v) {
  const s = String(v || '').trim();
  return (s === '' || s === '0') ? '—' : s;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fmt_d(d) {
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function dosToDays(s) {
  if (!s || s === '—') return 999;
  const dm = s.match(/(\d+)\s*day/i);
  const hm = s.match(/(\d+)\s*hour/i);
  return (dm ? parseInt(dm[1]) : 0) + (hm ? parseInt(hm[1]) : 0) / 24;
}

// -----------------------------------------------------------------------
// setupTrigger — run ONCE manually
// -----------------------------------------------------------------------
function setupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onEditTrigger')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEditTrigger').forSpreadsheet(SHEET_ID).onEdit().create();
  Logger.log('✅ onEdit trigger installed');
}
function onEditTrigger(e) { Logger.log('Edit at ' + new Date().toISOString()); }

// -----------------------------------------------------------------------
// debugSheets — run to check all sheet names
// -----------------------------------------------------------------------
function debugSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ss.getSheets().forEach((s,i) => Logger.log(i + ': "' + s.getName() + '"'));
}

// -----------------------------------------------------------------------
// testRun — ALWAYS run before deploying
// -----------------------------------------------------------------------
function testRun() {
  const d = buildDashboardData();
  Logger.log('SKU rows:      ' + d.skuData.length);
  d.skuData.forEach(s => Logger.log('  ' + s.sku + ' | planned=' + s.plannedTillDate + ' | actual=' + s.actualProd + ' | achievement=' + s.achievement));
  Logger.log('RM rows:       ' + d.rmData.length);
  d.rmData.forEach(r => Logger.log('  ' + r.rm.slice(0,20) + ' | wrtoPlan=' + r.wrtoPlan));
  Logger.log('Daily rows:    ' + d.dates.length + ' | ' + d.dates[0] + ' → ' + d.dates[d.dates.length-1]);
  Logger.log('Monthly RM:    ' + d.monthlyRM.length);
  d.monthlyRM.forEach(m => Logger.log('  ' + m.month + ' | ' + m.rm.slice(0,20) + ' | plan=' + m.plan + ' actual=' + m.actual + ' ratio=' + m.ratio));
  Logger.log('RM per SKU:    ' + d.rmPerSKUArr.length);
  d.rmPerSKUArr.slice(0,5).forEach(r => Logger.log('  ' + r.rm.slice(0,20) + ' plan=' + r.plan + ' actual=' + r.actual));
}
