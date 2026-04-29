// =====================================================================
// app.js — UI rendering, tab switching, tables, KPIs, FILTERS (v5 FINAL)
// =====================================================================

function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleString('en-BD', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}
updateClock(); setInterval(updateClock, 30000);

// ---- Tabs ----
const TAB_NAMES = ['overview','daily','rm','monthwise','sku'];
function switchTab(name, btn) {
  TAB_NAMES.forEach(t => { const p=document.getElementById('tab-'+t); if(p) p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('tab-'+name);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(() => { Object.values(CHART_REGISTRY).forEach(c => { try{c.resize();}catch(e){} }); }, 50);
}

// ---- Number formatting ----
const fmt    = (n, dec=1) => (n==null||isNaN(n)) ? '—' : Number(n).toLocaleString('en-BD',{maximumFractionDigits:dec,minimumFractionDigits:0});
const fmtPct = n => (n==null||isNaN(n)) ? '—' : Number(n).toFixed(1)+'%';

// ---- Active filters ----
const FILTER = { month:'Apr26', sku:'ALL', rm:'ALL' };

function filterBySKU()   { FILTER.sku   = document.getElementById('skuFilter').value;   renderAll(); }
function filterByRM()    { FILTER.rm    = document.getElementById('rmFilter').value;     renderRMSection(); }
function filterByMonth() { FILTER.month = document.getElementById('monthFilter').value;  renderAll(); }

const SKU_MAP  = { ALL:'ALL', WC:'Wearing Course', BC:'Binder Course', PC:'Prime Coat', TC:'Tack Coat' };
const RM_SHORT = {
  'Coarse Sand FM 2.2-3.0': 'CS',
  'Stone Dust (0-5mm) Local': 'SD',
  'Bitumen Grade 60/70 Jay Embossed Packed in 180 kg new steel drums': 'BT',
  'Limestone 10-20 mm': 'LS',
  'Crushed Stone 05-10 mm (Limestone)': 'CR',
  'Kerosene': 'KE',
};

// ---- Filtered data helpers ----
function getFilteredDaily(d) {
  const name = SKU_MAP[FILTER.sku];
  if (name !== 'ALL' && d.skuFilterData && d.skuFilterData[name])
    return { dates:d.dates, ...d.skuFilterData[name] };
  return { dates:d.dates, actualProd:d.actualProd, plannedProd:d.plannedProd,
           actualDel:d.actualDel, plannedDel:d.plannedDel };
}
function getFilteredRM(d) {
  if (FILTER.rm === 'ALL') return d.rmData;
  return d.rmData.filter(r => (RM_SHORT[r.rm]||'') === FILTER.rm);
}
function getFilteredMonthlyRM(d) {
  let rows = d.monthlyRM || [];
  if (FILTER.rm !== 'ALL') rows = rows.filter(r => (RM_SHORT[r.rm]||'') === FILTER.rm);
  return rows;
}
function getFilteredRMPerSKU(d) {
  let rows = d.rmPerSKUArr || [];
  if (FILTER.rm !== 'ALL') rows = rows.filter(r => (RM_SHORT[r.rm]||'') === FILTER.rm);
  return rows;
}

// =====================================================================
// KPI CARDS
// =====================================================================
function renderKPIs(d) {
  const fd = getFilteredDaily(d);
  const tPP = fd.plannedProd.reduce((a,b)=>a+b,0);
  const tAP = fd.actualProd.reduce((a,b)=>a+b,0);
  const tPD = fd.plannedDel.reduce((a,b)=>a+b,0);
  const tAD = fd.actualDel.reduce((a,b)=>a+b,0);
  const cRM = d.rmData.filter(r=>r.dosDays<1).length;

  const achPct = tPP>0 ? (tAP/tPP*100).toFixed(1) : '—';
  const delPct = tPD>0 ? (tAD/tPD*100).toFixed(1) : '—';
  const achGood = parseFloat(achPct) >= 100;
  const delGood = parseFloat(delPct) >= 95;

  setKPI('kpi-plan-prod',   fmt(tPP,0));
  setKPI('kpi-actual-prod', fmt(tAP,0));
  setKPI('kpi-plan-del',    fmt(tPD,0));
  setKPI('kpi-actual-del',  fmt(tAD,0));
  setKPI('kpi-rm',          cRM);

  setTrend('trend-plan-prod',  (achGood?'▲':'▼')+' '+achPct+'%', achGood);
  setTrend('trend-actual-prod', achPct+'% vs Plan',               achGood);
  setTrend('trend-plan-del',    delPct+'% vs Plan',               delGood);
  setTrend('trend-actual-del',  delPct+'% achievement',           delGood);
  setTrendRed('trend-rm', cRM>0 ? cRM+' urgent' : '✓ All OK',    cRM>0);

  const mP=Math.max(tPP,tAP)||1, mD=Math.max(tPD,tAD)||1;
  setBar('bar-plan-prod',  Math.min(tPP/mP*100,100));
  setBar('bar-actual-prod',Math.min(tAP/mP*100,100));
  setBar('bar-plan-del',   Math.min(tPD/mD*100,100));
  setBar('bar-actual-del', Math.min(tAD/mD*100,100));
  setBar('bar-rm',         Math.min(cRM/Math.max(d.rmData.length,1)*100,100));
}
function setKPI(id,val) { const e=document.getElementById(id); if(e) e.textContent=val; }
function setBar(id,p)   { const e=document.getElementById(id); if(e) e.style.width=p+'%'; }
function setTrend(id,t,good) {
  const e=document.getElementById(id); if(!e) return;
  e.textContent=t; e.className='kpi-trend'+(good?'':' kpi-trend-warn');
}
function setTrendRed(id,t,bad) {
  const e=document.getElementById(id); if(!e) return;
  e.textContent=t; e.className='kpi-trend'+(bad?' kpi-trend-red':'');
}

// =====================================================================
// ACHIEVE GRID  — FIX: achievement value from sheet is already a %
// e.g. 112.3 means 112.3%, not 1.123
// =====================================================================
function renderAchieveGrid(d) {
  const grid = document.getElementById('achieveGrid'); if(!grid) return;
  const name = SKU_MAP[FILTER.sku];
  const rows = name==='ALL' ? d.skuData : d.skuData.filter(s=>s.sku===name);
  if (!rows.length) { grid.innerHTML='<div style="color:#6b7280;padding:12px">No data for selected SKU.</div>'; return; }
  grid.innerHTML = rows.map(s => {
    // achievement is already in % form (e.g. 112.3 = 112.3%)
    // If null, compute from plannedTillDate vs actualProd
    const achv = s.achievement != null
      ? s.achievement
      : (s.plannedTillDate > 0 ? Math.round(s.actualProd / s.plannedTillDate * 1000) / 10 : null);
    const col = achv==null ? '#6b7280' : achv>=100 ? '#057a55' : achv>=75 ? '#d97706' : '#c81e1e';
    const fw  = achv==null ? 0 : Math.min(achv, 130);
    return `<div class="achieve-card">
      <div class="achieve-sku">${s.sku}</div>
      <div class="achieve-pct" style="color:${col}">${achv!=null ? achv.toFixed(1)+'%' : '—'}</div>
      <div class="achieve-row">
        <span>Planned: <strong>${fmt(s.plannedTillDate)} ${s.uom}</strong></span>
        <span>Actual: <strong>${fmt(s.actualProd)} ${s.uom}</strong></span>
      </div>
      <div class="achieve-row">
        <span>DOS: <strong>${s.dos}</strong></span>
        <span>Avg Del/day: <strong>${fmt(s.avgDailyDel)}</strong></span>
      </div>
      <div class="achieve-bar-wrap"><div class="achieve-bar-fill" style="width:${fw}%;background:${col}"></div></div>
    </div>`;
  }).join('');
}

// =====================================================================
// DAILY TABLE
// =====================================================================
function renderDailyTable(d) {
  const tbody = document.getElementById('dailyTableBody'); if(!tbody) return;
  const fd = getFilteredDaily(d);
  if (!fd.dates.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:20px">No data available</td></tr>'; return; }
  tbody.innerHTML = fd.dates.map((date,i) => {
    const ap=fd.actualProd[i], pp=fd.plannedProd[i];
    const ad=fd.actualDel[i],  pd=fd.plannedDel[i];
    const pv=ap-pp, dv=ad-pd;
    const pvc=pv>=0?'#057a55':'#c81e1e', dvc=dv>=0?'#057a55':'#c81e1e';
    const st = ap===0 ? '<span class="badge badge-neutral">No Production</span>'
      : ap>=pp ? '<span class="badge badge-ok">▲ Above Plan</span>'
               : '<span class="badge badge-critical">▼ Below Plan</span>';
    return `<tr><td><strong>${date}</strong></td><td>${fmt(ap)}</td><td>${fmt(pp)}</td>
      <td style="color:${pvc};font-weight:600">${pv>=0?'+':''}${fmt(pv)}</td>
      <td>${fmt(ad)}</td><td>${fmt(pd)}</td>
      <td style="color:${dvc};font-weight:600">${dv>=0?'+':''}${fmt(dv)}</td>
      <td>${st}</td></tr>`;
  }).join('');
}

// =====================================================================
// RM ALERTS
// =====================================================================
function renderAlertGrid(d) {
  const grid = document.getElementById('alertGrid'); if(!grid) return;
  const rows = getFilteredRM(d);
  const alerts = [];
  rows.forEach(r => {
    if (r.dosDays < 1)
      alerts.push({type:'critical', title:`⛔ CRITICAL — ${r.rm}`,
        body:`Closing stock: <strong>${fmt(r.closingInv,1)} MT</strong> (IBOS: ${fmt(r.closingIBOS,1)} MT). DOS = ${r.dosInv}. Consumption ${fmtPct(r.wrtoPlan)} of plan.`,
        tag:'🛒 RAISE PO NOW'});
    else if (r.dosDays < 3)
      alerts.push({type:'warning', title:`⚠ WARNING — ${r.rm}`,
        body:`Closing stock: <strong>${fmt(r.closingInv,1)} MT</strong> (IBOS: ${fmt(r.closingIBOS,1)} MT). DOS = ${r.dosInv}. Consumption ${fmtPct(r.wrtoPlan)} of plan.`,
        tag:'📋 ORDER WITHIN 24H'});
    else if (r.wrtoPlan > 0 && r.wrtoPlan < 20)
      alerts.push({type:'info', title:`ℹ INFO — ${r.rm}`,
        body:`Actual consumption only ${fmtPct(r.wrtoPlan)} of plan. Closing stock: ${fmt(r.closingInv,1)} MT. Review plan requirement.`,
        tag:'📊 REVIEW PLAN'});
  });
  if (!alerts.length) {
    grid.innerHTML=`<div class="alert-card alert-info" style="grid-column:1/-1">
      <div class="alert-title">✅ All RM stocks are adequate</div>
      <div class="alert-body">No critical or warning items. Continue monitoring daily.</div></div>`;
    return;
  }
  grid.innerHTML = alerts.map(a=>`
    <div class="alert-card alert-${a.type}">
      <div class="alert-title">${a.title}</div>
      <div class="alert-body">${a.body}</div>
      <div class="alert-tag">${a.tag}</div>
    </div>`).join('');
}

// =====================================================================
// PO GRID
// =====================================================================
function renderPOGrid(d) {
  const grid = document.getElementById('poGrid'); if(!grid) return;
  const SHORT = {'Coarse Sand FM 2.2-3.0':'Coarse Sand','Stone Dust (0-5mm) Local':'Stone Dust',
    'Bitumen Grade 60/70 Jay Embossed Packed in 180 kg new steel drums':'Bitumen 60/70',
    'Limestone 10-20 mm':'Limestone','Crushed Stone 05-10 mm (Limestone)':'Crushed Stone','Kerosene':'Kerosene'};
  grid.innerHTML = getFilteredRM(d).map(r => {
    const cls = r.dosDays<1?'po-critical': r.dosDays<3?'po-warning': r.dosDays<999?'po-ok':'po-neutral';
    const act = r.dosDays<1?'🛒 RAISE NOW': r.dosDays<3?'⚠ Order Today': r.dosDays<999?'✓ Plan Ahead':'— Monitor';
    return `<div class="po-card ${cls}">
      <div class="po-rm-name">${SHORT[r.rm]||r.rm}</div>
      <div class="po-dos">${r.dosInv}</div>
      <div class="po-action">${act}</div>
    </div>`;
  }).join('');
}

// =====================================================================
// RM TABLE
// =====================================================================
function renderRMTable(d) {
  const tbody = document.getElementById('rmTableBody'); if(!tbody) return;
  const rows = getFilteredRM(d);
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="10" style="text-align:center;color:#6b7280;padding:20px">No data for selected RM.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const dc = r.dosDays<1?'badge-critical': r.dosDays<3?'badge-warn':'badge-ok';
    const pc = r.wrtoPlan>110?'#c81e1e': r.wrtoPlan>102?'#d97706':'#057a55';
    const pw = Math.min(r.wrtoPlan||0, 130);
    return `<tr>
      <td><strong>${r.rm}</strong></td>
      <td>${fmt(r.rmEntryTillDate)}</td><td>${fmt(r.closingInv)}</td><td>${fmt(r.closingIBOS)}</td>
      <td>${fmt(r.plannedConsumption)}</td><td>${fmt(r.actualConsumption)}</td><td>${fmt(r.avgPerDay)}</td>
      <td><span class="badge ${dc}">${r.dosInv}</span></td>
      <td><span class="badge ${dc}">${r.dosIBOS}</span></td>
      <td><div class="pct-cell"><div class="pct-track"><div class="pct-fill" style="width:${pw}%;background:${pc}"></div></div>
        <span style="color:${pc};font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600">${fmtPct(r.wrtoPlan)}</span></div></td>
    </tr>`;
  }).join('');
}

// =====================================================================
// MONTHLY RM TABLE
// =====================================================================
function renderMonthRMTable(d) {
  const tbody = document.getElementById('monthRMTableBody'); if(!tbody) return;
  const rows = getFilteredMonthlyRM(d);
  if (!rows || !rows.length) {
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:20px">
      No monthly RM data. Ensure "Monthly Basis RM Planning" sheet exists and testRun() passes.</td></tr>`;
    return;
  }
  let tP=0, tA=0;
  let html = rows.map(r => {
    tP+=r.plan||0; tA+=r.actual||0;
    const ratio = r.ratio||0;
    const rc = ratio>105?'#c81e1e': ratio>100?'#d97706':'#057a55';
    const cls= ratio>105?'badge-critical': ratio>100?'badge-warn':'badge-ok';
    const st = ratio>105?'Over-consumed': ratio>100?'Slightly Over': ratio<20?'Under Plan':'On Track';
    return `<tr>
      <td>${r.month}</td><td>${r.rm}</td>
      <td>${fmt(r.plan)}</td><td>${fmt(r.actual)}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:${rc}">${fmtPct(ratio)}</span></td>
      <td><span class="badge ${cls}">${st}</span></td>
    </tr>`;
  }).join('');
  if (tP > 0) {
    const tot = Math.round((tA/tP-1)*10000)/100;
    html += `<tr style="background:#f9fafb;font-weight:700">
      <td colspan="2">TOTAL</td><td>${fmt(tP)}</td><td>${fmt(tA)}</td>
      <td style="color:#d97706;font-family:'JetBrains Mono',monospace">${tot>=0?'+':''}${fmtPct(tot)}</td>
      <td></td></tr>`;
    const sub = document.querySelector('[data-monthly-sub]');
    if (sub) sub.textContent = `Total Plan: ${fmt(tP)} MT · Actual: ${fmt(tA)} MT · Variance: ${tot>=0?'+':''}${fmtPct(tot)}`;
  }
  tbody.innerHTML = html;
}

// =====================================================================
// MONTH SUMMARY CARDS
// =====================================================================
function renderMonthSummaryGrid(d) {
  const grid = document.getElementById('monthSummaryGrid'); if(!grid) return;
  const dem = d.monthDemand || [];
  grid.innerHTML = dem.map(m => {
    const cur = m.month === "Apr'26";
    const total = (m.wc||0) + (m.bc||0);
    const actual = m.wcActual != null ? (m.wcActual||0) + (m.bcActual||0) : null;
    return `<div class="month-card ${cur?'current':''}">
      <div class="month-name">${m.month}${cur?' ← Current':''}</div>
      <div class="month-val">${fmt(total,0)}</div>
      <div class="month-sub">MT Budgeted (WC+BC)</div>
      ${actual!=null ? `<div class="month-actual">Actual: ${fmt(actual,0)} MT</div>` : ''}
    </div>`;
  }).join('');
}

// =====================================================================
// SKU TABLE  — FIX: use correct achievement value
// =====================================================================
function renderSKUTable(d) {
  const tbody = document.getElementById('skuTableBody'); if(!tbody) return;
  const name = SKU_MAP[FILTER.sku];
  const rows = name==='ALL' ? d.skuData : d.skuData.filter(s=>s.sku===name);
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="12" style="text-align:center;color:#6b7280;padding:20px">No data for selected SKU.</td></tr>'; return; }
  tbody.innerHTML = rows.map(s => {
    // FIX: compute achievement correctly
    // achievement from sheet is already in % (e.g. 112.3) thanks to pct() fix in Apps Script
    // If null, compute from plannedTillDate vs actualProd
    const achv = s.achievement != null
      ? s.achievement
      : (s.plannedTillDate > 0 ? Math.round(s.actualProd / s.plannedTillDate * 1000) / 10 : null);
    const ac = achv==null?'badge-neutral': achv>=100?'badge-ok': achv>=75?'badge-warn':'badge-critical';
    const dc = (!s.dos||s.dos==='—') ? 'badge-neutral'
      : (s.dos.includes('0 days') && !s.dos.includes('0 days 0')) ? 'badge-critical' : 'badge-ok';
    return `<tr>
      <td><strong>${s.sku}</strong></td><td>${s.uom}</td>
      <td>${fmt(s.closingStock)}</td><td>${fmt(s.budgetedDemand)}</td>
      <td>${fmt(s.plannedTillDate)}</td><td>${fmt(s.plannedDelivery)}</td>
      <td style="font-weight:600">${fmt(s.actualProd)}</td>
      <td>${fmt(s.actualDelivery)}</td><td>${fmt(s.avgDailyDel)}</td>
      <td>${fmt(s.fgRemain)}</td>
      <td><span class="badge ${dc}">${s.dos}</span></td>
      <td>${achv!=null ? `<div class="pct-cell">
        <div class="pct-track"><div class="pct-fill" style="width:${Math.min(achv,130)}%;background:${achv>=100?'#057a55':achv>=75?'#d97706':'#c81e1e'}"></div></div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:${achv>=100?'#057a55':achv>=75?'#d97706':'#c81e1e'}">${fmtPct(achv)}</span>
      </div>` : '<span class="badge badge-neutral">—</span>'}</td>
    </tr>`;
  }).join('');
}

// =====================================================================
// RM SECTION (called on RM filter change)
// =====================================================================
function renderRMSection() {
  const d = window.SHEET_DATA; if(!d) return;
  renderAlertGrid(d); renderPOGrid(d); renderRMTable(d);
  renderMonthRMTable(d); renderMonthSummaryGrid(d);
  renderRMBarChart(d); renderRMLineChart(d);
  renderMonthRMChart(d); renderRMPerSKUChart(d);
}

// =====================================================================
// CSV EXPORT
// =====================================================================
function exportTableCSV(tableId, filename) {
  const t = document.getElementById(tableId); if(!t) return;
  const csv = Array.from(t.querySelectorAll('tr'))
    .map(r => Array.from(r.querySelectorAll('th,td'))
      .map(c => '"'+c.innerText.replace(/"/g,'""')+'"').join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = filename+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

// =====================================================================
// RENDER ALL
// =====================================================================
function renderAll() {
  const d = window.SHEET_DATA; if(!d) return;
  const fd = getFilteredDaily(d);
  renderKPIs(d);
  renderAchieveGrid(d);
  renderDailyTable(d);
  renderAlertGrid(d);
  renderPOGrid(d);
  renderRMTable(d);
  renderMonthRMTable(d);
  renderMonthSummaryGrid(d);
  renderSKUTable(d);
  renderProdOverviewChart(fd);
  renderDeliveryOverviewChart(fd);
  renderSKUDonutChart(d);
  renderDailyProdChart(fd);
  renderCumulProdChart(fd);
  renderDailyDelChart(fd);
  renderRMBarChart(d);
  renderRMLineChart(d);
  renderMonthRMChart(d);
  renderMonthDemandChart(d);
  renderSKUAchieveChart(d);
  renderRMPerSKUChart(d);
}
