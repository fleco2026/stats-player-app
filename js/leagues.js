// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — leagues.js                               ║
// ║  League detection, column analysis, dataset loading        ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// ===================== FUZZY LEAGUE DETECTION (multi-league) =====================
function detectDatasets(query) {
  const q = removeAccents(query.toLowerCase().trim());
  const matches = [];

  for (const ds of FStats.DATASETS_CONFIG) {
    let score = 0;
    // Exact keyword match (highest priority)
    for (const kw of ds.keywords) {
      if (q.includes(removeAccents(kw))) { score = Math.max(score, 10 + kw.length); }
    }
    // Abbreviation match
    if (score === 0) {
      for (const ab of (ds.abbrevs || [])) {
        const abNorm = removeAccents(ab);
        // Match as whole word
        const re = new RegExp('\\b' + abNorm.replace(/\s+/g, '\\s*') + '\\b', 'i');
        if (re.test(q)) { score = Math.max(score, 5 + ab.length); }
      }
    }
    // Fuzzy: check if 2+ consecutive words from the league name appear
    if (score === 0) {
      const nameWords = removeAccents(ds.name.replace(/\d+/g, '')).toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let matched = 0;
      for (const w of nameWords) { if (q.includes(w)) matched++; }
      if (matched >= 2) score = matched;
    }
    if (score > 0) matches.push({ name: ds.name, score });
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches.map(m => m.name);
}

// Single-league compat wrapper
function detectDataset(query) {
  const found = detectDatasets(query);
  return found.length > 0 ? found[0] : null;
}

// ===================== COLUMN ANALYSIS =====================
function analyzeColumns(data) {
  const columns = Object.keys(data[0] || {});
  const numCols = columns.filter(col => data.slice(0, 30).some(r => typeof r[col] === 'number' || (!isNaN(parseFloat(r[col])) && r[col] !== null && r[col] !== '')));
  const nameCol = columns.find(c => /jugador|player|nombre|name/i.test(c)) || columns[0];
  const equipoCol = columns.find(c => /equipo|team|club/i.test(c));
  // Detect position column — handle broken encoding (Posicin instead of Posición)
  const posCol = columns.find(c => /posici[oó]n|posicin|position|pos\b/i.test(removeAccents(c)));
  const pos2Col = columns.find(c => /segunda\s*posici|second.*pos/i.test(removeAccents(c)));
  const pos3Col = columns.find(c => /posicion\s*extra|tercera\s*pos/i.test(removeAccents(c)));
  const edadCol = columns.find(c => /edad|age|a[ñn]os/i.test(c));
  const minutosCol = columns.find(c => /minutos?\s*(jugados?)?$|^min$/i.test(c.trim()));
  // Detect country/passport columns
  const paisCol = columns.find(c => /pa[ií]s.*nacimiento|country/i.test(removeAccents(c)));
  const pieCol = columns.find(c => /^pie$|foot/i.test(c.trim()));
  const alturaCol = columns.find(c => /altura|height/i.test(c));
  const skipCols = new Set([nameCol, equipoCol].filter(Boolean).map(c => c.toLowerCase()));
  const candidateCols = numCols.filter(c => !skipCols.has(c.toLowerCase()));
  // Categorize defensive, offensive, passing columns for easy access
  const defensiveCols = columns.filter(c => /defensiv|entrada|intercep|tiro.*intercep|bloqueo|despe|falta/i.test(removeAccents(c)));
  const attackCols = columns.filter(c => /ataque|gol|remat|tiro|xg|cabeza|regate|duel.*atac|toques.*area|aceler|carrer.*progres/i.test(removeAccents(c)));
  const passCols = columns.filter(c => /pase|centro|asist|clave|profund|progresiv|ltimo.*tercio|ultimo.*tercio/i.test(removeAccents(c)));
  return { columns, numCols, nameCol, equipoCol, posCol, pos2Col, pos3Col, edadCol, minutosCol, paisCol, pieCol, alturaCol, candidateCols, defensiveCols, attackCols, passCols };
}

// ===================== PRE-COMPUTE DATASET SUMMARIES =====================
function buildDatasetSummary(leagueName, data) {
  const { columns, numCols, nameCol, equipoCol, posCol, pos2Col, pos3Col, edadCol, candidateCols, defensiveCols, attackCols, passCols } = analyzeColumns(data);

  // Teams list
  const teams = equipoCol ? [...new Set(data.map(r => r[equipoCol]).filter(Boolean))].sort() : [];

  // Positions distribution (combining all position columns)
  const posDistrib = {};
  if (posCol) data.forEach(r => { const p = r[posCol]; if (p) posDistrib[p] = (posDistrib[p] || 0) + 1; });

  // Stats per numeric column
  const colStats = {};
  for (const col of candidateCols) {
    const vals = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const median = vals.length % 2 === 0
      ? (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
      : vals[Math.floor(vals.length / 2)];
    colStats[col] = {
      min: vals[0],
      max: vals[vals.length - 1],
      avg: +avg.toFixed(2),
      med: +median.toFixed(2),
      sum: +sum.toFixed(1),
      cnt: vals.length
    };
  }

  // Top 3 per column (precomputed for common queries)
  const topPerCol = {};
  for (const col of candidateCols.slice(0, 20)) {
    const sorted = [...data].sort((a, b) => (parseFloat(b[col]) || 0) - (parseFloat(a[col]) || 0));
    topPerCol[col] = sorted.slice(0, 3).map(r => ({
      name: r[nameCol] || '—',
      team: equipoCol ? (r[equipoCol] || '—') : undefined,
      val: r[col]
    }));
  }

  return {
    league: leagueName,
    totalPlayers: data.length,
    columns,
    numericColumns: candidateCols,
    nameCol, equipoCol, posCol, pos2Col, pos3Col, edadCol,
    teams,
    posDistrib,
    colStats,
    topPerCol,
    hasPosition: !!posCol,
    hasDefensiveMetrics: defensiveCols.length > 0,
    defensiveCols,
    attackCols,
    passCols
  };
}

// Build a compact string for the system instruction (sent once per conversation context)
function buildSystemDataContext() {
  const parts = [];
  for (const ds of FStats.DATASETS_CONFIG) {
    const s = FStats.datasetSummaries[ds.name];
    if (!s) continue;
    const shortName = ds.name.replace(/ 2025$/, '');
    const topCols = s.numericColumns.slice(0, 25).join(',');
    const teamCount = s.teams.length;
    let line = `${ds.emoji}${shortName}:${s.totalPlayers}jug,${teamCount}eq`;
    line += `|cols:${topCols}`;
    // Add position info
    if (s.hasPosition) {
      line += `|POSICIÓN DISPONIBLE:${s.posCol}`;
      if (s.pos2Col) line += `,${s.pos2Col}`;
      if (s.pos3Col) line += `,${s.pos3Col}`;
    }
    // Add position distribution if available
    if (Object.keys(s.posDistrib).length > 0) {
      line += `|pos:${Object.entries(s.posDistrib).map(([k, v]) => `${k}:${v}`).join(',')}`;
    }
    // Inform about defensive metrics
    if (s.hasDefensiveMetrics) {
      line += `|MÉTRICAS DEFENSIVAS:${s.defensiveCols.slice(0,8).join(',')}`;
    }
    // All column names (so Gemini knows everything available)
    line += `|TODAS_COLS:${s.columns.join(',')}`;
    parts.push(line);
  }
  return parts.join('\n');
}

// ===================== LOAD DATASETS =====================
async function loadAllDatasets() {
  await Promise.all(FStats.DATASETS_CONFIG.map(ds => loadDataset(ds)));
  FStats.DATASETS_CONFIG.forEach(d => { if (FStats.loadedDatasets[d.name]) updateLeagueBadge(d.name, 'loaded'); });
}

async function loadDataset(ds) {
  updateLeagueBadge(ds.name, 'loading');
  try {
    const resp = await fetch(ds.file);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    let json = XLSX.utils.sheet_to_json(ws, { defval: null });
    const fk = Object.keys(json[0] || {})[0];
    json = json.filter(r => r[fk] !== fk);
    json = json.map(r => {
      const c = {};
      for (const [k, v] of Object.entries(r)) {
        if (k && k !== 'null' && !k.startsWith('__EMPTY')) c[k] = v;
      }
      return c;
    });
    FStats.loadedDatasets[ds.name] = json;
    // Pre-compute summary
    FStats.datasetSummaries[ds.name] = buildDatasetSummary(ds.name, json);
    updateLeagueBadge(ds.name, 'loaded');
    if (getActiveConv()?.history.length === 0) renderChatArea();
  } catch (err) {
    console.error(`Error cargando ${ds.name}:`, err);
    updateLeagueBadge(ds.name, 'error');
  }
}

// ===================== LEAGUE BADGE RENDERING =====================
function renderLeagueBadges() {
  document.getElementById('leaguesGrid').innerHTML = FStats.DATASETS_CONFIG.map(d =>
    `<div class="league-badge loading" id="badge_${slugify(d.name)}"><span class="league-dot"></span>${d.emoji} ${d.name}</div>`
  ).join('');
}

function updateLeagueBadge(n, s) { const el = document.getElementById('badge_' + slugify(n)); if (el) el.className = 'league-badge ' + s; }
