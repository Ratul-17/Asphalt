// =====================================================================
// charts.js — All Chart.js chart definitions (FIXED v2)
// All chart functions accept pre-filtered data objects
// =====================================================================

const C = {
  blue:'#1a56db', blueA:'rgba(26,86,219,0.12)',
  green:'#057a55', greenA:'rgba(5,122,85,0.10)',
  orange:'#d97706', orangeA:'rgba(217,119,6,0.10)',
  red:'#c81e1e', redA:'rgba(200,30,30,0.10)',
  purple:'#7e3af2', purpleA:'rgba(126,58,242,0.10)',
  border:'#e5e7eb', text2:'#6b7280', text3:'#9ca3af',
};

const CHART_REGISTRY = {};

function destroyChart(id) {
  if (CHART_REGISTRY[id]) { try { CHART_REGISTRY[id].destroy(); } catch(e){} delete CHART_REGISTRY[id]; }
}

function makeChart(id, type, data, options={}) {
  destroyChart(id);
  const ctx = document.getElementById(id); if(!ctx) return;
  const base = {
    responsive:true, maintainAspectRatio:true,
    animation:{ duration:500, easing:'easeInOutQuart' },
    plugins:{
      legend:{ display:false },
      tooltip:{
        backgroundColor:'#fff', borderColor:C.border, borderWidth:1,
        titleColor:'#111827', bodyColor:'#6b7280',
        padding:10, cornerRadius:6,
        titleFont:{family:"'JetBrains Mono'",size:12},
        bodyFont:{family:"'Inter'",size:12}
      }
    },
    scales:{
      x:{ grid:{color:'#f3f4f6',drawBorder:false}, ticks:{color:C.text3,font:{size:10,family:"'Inter'"},maxRotation:45,minRotation:0} },
      y:{ grid:{color:'#f3f4f6',drawBorder:false}, ticks:{color:C.text3,font:{size:10,family:"'Inter'"}}, beginAtZero:true }
    }
  };
  const opts = deepMerge(base, options);
  const chart = new Chart(ctx, {type, data, options:opts});
  CHART_REGISTRY[id] = chart;
  return chart;
}

function deepMerge(t, s) {
  const o = Object.assign({}, t);
  for (const k in s) {
    if (s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) o[k] = deepMerge(t[k]||{}, s[k]);
    else o[k] = s[k];
  }
  return o;
}

// ---- Guard: returns true if data array has any non-zero value ----
function hasData(arr) { return arr && arr.some(v => v > 0); }

// =====================================================================
// OVERVIEW CHARTS
// =====================================================================
function renderProdOverviewChart(fd) {
  makeChart('prodOverviewChart','line',{
    labels: fd.dates,
    datasets:[
      { label:'Planned', data:fd.plannedProd, borderColor:C.blue, backgroundColor:C.blueA,
        tension:0.35, fill:true, pointRadius:2, borderWidth:2 },
      { label:'Actual',  data:fd.actualProd,  borderColor:C.green, backgroundColor:C.greenA,
        tension:0.35, fill:true, pointRadius:3, borderWidth:2,
        pointBackgroundColor: fd.actualProd.map((v,i)=>
          v===0?C.text3: v>=fd.plannedProd[i]?C.green:C.red) }
    ]
  },{plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} MT`}}}});
}

function renderDeliveryOverviewChart(fd) {
  makeChart('deliveryOverviewChart','bar',{
    labels:fd.dates,
    datasets:[
      { label:'Planned', data:fd.plannedDel, backgroundColor:'rgba(26,86,219,0.45)', borderRadius:3 },
      { label:'Actual',  data:fd.actualDel,  backgroundColor:'rgba(217,119,6,0.65)', borderRadius:3 }
    ]
  },{});
}

function renderSKUDonutChart(d) {
  const skus = d.skuData.filter(s=>s.actualProd>0);
  if (!skus.length) { destroyChart('skuDonutChart'); return; }
  makeChart('skuDonutChart','doughnut',{
    labels: skus.map(s=>s.sku),
    datasets:[{
      data: skus.map(s=>s.actualProd),
      backgroundColor:[C.blue,C.green,C.purple,C.orange,'#e11d48'],
      borderColor:'#fff', borderWidth:3, hoverOffset:6
    }]
  },{
    plugins:{legend:{display:true,position:'bottom',labels:{color:C.text2,font:{size:11,family:"'Inter'"},padding:12,usePointStyle:true}}},
    cutout:'68%',
    scales:{x:{display:false},y:{display:false}}
  });
}

// =====================================================================
// DAILY CHARTS
// =====================================================================
function renderDailyProdChart(fd) {
  makeChart('dailyProdChart','bar',{
    labels:fd.dates,
    datasets:[
      { label:'Planned', data:fd.plannedProd, backgroundColor:'rgba(26,86,219,0.35)', borderRadius:3, order:2 },
      { label:'Actual',  data:fd.actualProd,  borderRadius:3, order:1,
        backgroundColor:fd.actualProd.map((v,i)=>
          v===0?'rgba(156,163,175,0.5)': v>=fd.plannedProd[i]?'rgba(5,122,85,0.75)':'rgba(200,30,30,0.7)') }
    ]
  },{plugins:{legend:{display:false}}});
}

function renderCumulProdChart(fd) {
  let cp=0, ca=0;
  const cumP = fd.plannedProd.map(v=>+(cp+=v).toFixed(1));
  const cumA = fd.actualProd.map(v =>+(ca+=v).toFixed(1));
  makeChart('cumulProdChart','line',{
    labels:fd.dates,
    datasets:[
      { label:'Planned', data:cumP, borderColor:C.blue,  tension:0.3, fill:false, pointRadius:0, borderWidth:2 },
      { label:'Actual',  data:cumA, borderColor:C.green, tension:0.3, fill:false, pointRadius:0, borderWidth:2 }
    ]
  },{plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}}});
}

function renderDailyDelChart(fd) {
  makeChart('dailyDelChart','line',{
    labels:fd.dates,
    datasets:[
      { label:'Planned', data:fd.plannedDel, borderColor:C.blue,   tension:0.3, fill:false, pointRadius:2, borderWidth:2, borderDash:[4,3] },
      { label:'Actual',  data:fd.actualDel,  borderColor:C.orange, tension:0.3, fill:false, pointRadius:2, borderWidth:2 }
    ]
  },{plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}}});
}

// =====================================================================
// RM CHARTS
// =====================================================================
function renderRMBarChart(d) {
  const rows = getFilteredRM(d);
  if (!rows.length) { destroyChart('rmBarChart'); return; }
  const SHORT={'Coarse Sand FM 2.2-3.0':'Coarse Sand','Stone Dust (0-5mm) Local':'Stone Dust',
    'Bitumen Grade 60/70 Jay Embossed Packed in 180 kg new steel drums':'Bitumen 60/70',
    'Limestone 10-20 mm':'Limestone','Crushed Stone 05-10 mm (Limestone)':'Crushed Stone','Kerosene':'Kerosene'};
  makeChart('rmBarChart','bar',{
    labels: rows.map(r=>SHORT[r.rm]||r.rm),
    datasets:[
      { label:'Planned', data:rows.map(r=>r.plannedConsumption), backgroundColor:'rgba(26,86,219,0.5)', borderRadius:4 },
      { label:'Actual',  data:rows.map(r=>r.actualConsumption),  borderRadius:4,
        backgroundColor:rows.map(r=>r.actualConsumption>r.plannedConsumption?'rgba(200,30,30,0.7)':'rgba(5,122,85,0.65)') }
    ]
  },{plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}}});
}

function renderRMLineChart(d) {
  // daily RM uses the global actualRM/plannedRM arrays
  if (!hasData(d.actualRM) && !hasData(d.plannedRM)) { destroyChart('rmLineChart'); return; }
  const len = Math.min(d.dates.length, d.actualRM.length, d.plannedRM.length);
  makeChart('rmLineChart','line',{
    labels:d.dates.slice(0,len),
    datasets:[
      { label:'Planned', data:d.plannedRM.slice(0,len), borderColor:C.blue,  tension:0.3, fill:false, pointRadius:0, borderWidth:2, borderDash:[4,3] },
      { label:'Actual',  data:d.actualRM.slice(0,len),  borderColor:C.red,   tension:0.3, fill:false, pointRadius:2, borderWidth:2 }
    ]
  },{plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}}});
}

// =====================================================================
// MONTHWISE CHARTS  (FIXED — was blank because monthlyRM was empty)
// =====================================================================
function renderMonthRMChart(d) {
  const rows = getFilteredMonthlyRM(d);
  if (!rows || !rows.length) { destroyChart('monthRMChart'); return; }
  // Shorten RM labels
  const SHORT={'Coarse Sand FM 2.2-3.0':'Coarse Sand','Stone Dust (0-5mm) Local':'Stone Dust',
    'Bitumen Grade 60/70 Jay Embossed Packed in 180 kg new steel drums':'Bitumen 60/70',
    'Limestone 10-20 mm':'Limestone','Crushed Stone 05-10 mm (Limestone)':'Crushed Stone','Kerosene':'Kerosene'};
  makeChart('monthRMChart','bar',{
    labels: rows.map(r=>SHORT[r.rm]||r.rm),
    datasets:[
      { label:'Plan',   data:rows.map(r=>r.plan),   backgroundColor:'rgba(26,86,219,0.5)', borderRadius:4 },
      { label:'Actual', data:rows.map(r=>r.actual), backgroundColor:'rgba(217,119,6,0.65)', borderRadius:4 }
    ]
  },{
    plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}},
    scales:{
      x:{grid:{color:'#f3f4f6'},ticks:{color:C.text3,font:{size:9},maxRotation:35}},
      y:{grid:{color:'#f3f4f6'},ticks:{color:C.text3,font:{size:10}},beginAtZero:true}
    }
  });
}

function renderMonthDemandChart(d) {
  const dem = d.monthDemand || [];
  if (!dem.length) { destroyChart('monthDemandChart'); return; }
  makeChart('monthDemandChart','bar',{
    labels: dem.map(m=>m.month),
    datasets:[
      { label:'Wearing Course', data:dem.map(m=>m.wc||0), backgroundColor:'rgba(26,86,219,0.65)', borderRadius:4 },
      { label:'Binder Course',  data:dem.map(m=>m.bc||0), backgroundColor:'rgba(5,122,85,0.65)',  borderRadius:4 },
      { label:'Prime Coat',     data:dem.map(m=>m.pc||0), backgroundColor:'rgba(126,58,242,0.55)',borderRadius:4 },
      { label:'Tack Coat',      data:dem.map(m=>m.tc||0), backgroundColor:'rgba(217,119,6,0.55)', borderRadius:4 },
    ]
  },{
    plugins:{legend:{display:true,position:'top',labels:{color:C.text2,font:{size:11},usePointStyle:true}}}
  });
}

// =====================================================================
// SKU CHARTS  (FIXED — was blank because of empty/null achievement values)
// =====================================================================
function renderSKUAchieveChart(d) {
  const skuName = SKU_MAP[FILTER.sku];
  const allRows = skuName==='ALL' ? d.skuData : d.skuData.filter(s=>s.sku===skuName);
  // FIX: compute achievement correctly — same logic as app.js
  const rows = allRows.map(s => ({
    sku: s.sku,
    achv: s.achievement != null
      ? s.achievement
      : (s.plannedTillDate > 0 ? Math.round(s.actualProd / s.plannedTillDate * 1000) / 10 : null)
  })).filter(s => s.achv != null && !isNaN(s.achv));

  if (!rows.length) { destroyChart('skuAchieveChart'); return; }
  makeChart('skuAchieveChart','bar',{
    labels: rows.map(s=>s.sku),
    datasets:[{
      label:'Achievement %',
      data:  rows.map(s=>s.achv),
      backgroundColor: rows.map(s=>
        s.achv>=100?'rgba(5,122,85,0.75)':
        s.achv>=75 ?'rgba(217,119,6,0.75)':'rgba(200,30,30,0.75)'),
      borderRadius:5
    }]
  },{
    plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` Achievement: ${ctx.parsed.y.toFixed(1)}%`}}},
    scales:{
      x:{grid:{color:'#f3f4f6'},ticks:{color:C.text3}},
      y:{grid:{color:'#f3f4f6'},ticks:{color:C.text3,callback:v=>v+'%'},beginAtZero:true,max:150}
    }
  });
}

function renderRMPerSKUChart(d) {
  // Use rmPerSKUArr (from Daily Basis RM sheet) — fallback to monthlyRM
  const source = (d.rmPerSKUArr && d.rmPerSKUArr.length > 0) ? d.rmPerSKUArr : (d.monthlyRM || []);
  const rows = FILTER.rm === 'ALL' ? source : source.filter(r => (RM_SHORT[r.rm]||'') === FILTER.rm);
  if (!rows || !rows.length) { destroyChart('rmPerSKUChart'); return; }
  const SHORT = {'Coarse Sand FM 2.2-3.0':'Coarse Sand','Stone Dust (0-5mm) Local':'Stone Dust',
    'Bitumen Grade 60/70 Jay Embossed Packed in 180 kg new steel drums':'Bitumen 60/70',
    'Limestone 10-20 mm':'Limestone','Crushed Stone 05-10 mm (Limestone)':'Crushed Stone','Kerosene':'Kerosene'};
  makeChart('rmPerSKUChart','bar',{
    labels: rows.map(r=>SHORT[r.rm]||r.rm),
    datasets:[{
      label:'Consumption vs Plan %',
      data:  rows.map(r=>r.ratio||0),
      backgroundColor: rows.map(r=>
        (r.ratio||0)>110?'rgba(200,30,30,0.75)':
        (r.ratio||0)>100?'rgba(217,119,6,0.75)':'rgba(5,122,85,0.65)'),
      borderRadius:4
    }]
  },{
    plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` W.R to Plan: ${ctx.parsed.y.toFixed(2)}%`}}},
    scales:{
      x:{grid:{color:'#f3f4f6'},ticks:{color:C.text3,font:{size:9},maxRotation:30}},
      y:{grid:{color:'#f3f4f6'},ticks:{color:C.text3,callback:v=>v+'%'},beginAtZero:false,min:0,max:150}
    }
  });
}
