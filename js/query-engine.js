// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — query-engine.js                          ║
// ║  Column detection, filters, offline query engine           ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// ===================== COLUMN DETECTION ENGINE =====================
function detectTargetColumn(q, candidateCols) {
  if (!candidateCols.length) return { col: null, matched: false };
  const synonyms = FStats.SYNONYMS;
  const qNorm = removeAccents(q.toLowerCase());
  const qWords = qNorm.replace(/[,?¿!¡\/()]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const expandedWords = new Set(qWords);
  for (const w of qWords) { if (synonyms[w]) expandedWords.add(synonyms[w]); }

  const wantsPercent = /porcentaje|porciento|precision|%|eficacia|efectividad|ratio|tasa/i.test(qNorm);
  const wants90 = /\/90|por 90|sobre 90|cada 90|en 90/i.test(qNorm);

  let best = null; let bestScore = -1;
  for (const col of candidateCols) {
    const cl = removeAccents(col.toLowerCase());
    const colWords = cl.replace(/[\/\(\),]/g, ' ').replace(/%/g, ' % ').split(/\s+/).filter(w => w.length > 1);
    let wordMatches = 0;
    for (const cw of colWords) {
      for (const qw of expandedWords) {
        if (cw.includes(qw) || qw.includes(cw)) { wordMatches++; break; }
      }
    }
    if (wordMatches === 0) continue;
    let score = wordMatches / Math.max(colWords.length, 1);
    if (wantsPercent && cl.includes('%')) score += 2;
    if (wantsPercent && !cl.includes('%')) score -= 0.5;
    if (wants90 && cl.includes('/90')) score += 1.5;
    if (!wantsPercent && cl.includes('%') && candidateCols.some(c => !removeAccents(c.toLowerCase()).includes('%') && colWords.some(cw => removeAccents(c.toLowerCase()).includes(cw)))) score -= 0.3;
    score += wordMatches * 0.3;
    if (score > bestScore) { bestScore = score; best = col; }
  }
  if (best && bestScore > 0.3) return { col: best, matched: true };
  return { col: candidateCols[0], matched: false };
}

// Detect multiple relevant columns for a profile/tactical query
function detectProfileColumns(query, candidateCols, allColumns) {
  // Use allColumns (all columns including non-numeric like position) when available
  const searchCols = allColumns || candidateCols;
  const profiles = FStats.POSITION_PROFILES;

  const qNorm = removeAccents(query.toLowerCase());
  let matchedHints = [];

  for (const [pattern, { must, extra }] of Object.entries(profiles)) {
    if (new RegExp(pattern, 'i').test(qNorm)) {
      matchedHints = [...must, ...extra];
      break;
    }
  }

  // If no specific profile matched, use a broad set for general position queries
  if (matchedHints.length === 0) {
    if (/lateral|defens|volante|delanter|extremo|mediocampo|mediapunta|arquero|portero/i.test(qNorm)) {
      matchedHints = ['gol','asist','duelo','defensiv','entrada','intercep','centro','pase','regate','aereo','progres','carrera','aceler','xg','xa','remate','tiro','falta','tarjeta','cabeza','toques','clave','tercio','profundidad'];
    }
  }

  if (matchedHints.length === 0) return null;

  // Match hints against actual column names (search both numeric and all columns)
  const matched = [];
  for (const hint of matchedHints) {
    const re = new RegExp(hint, 'i');
    for (const col of searchCols) {
      if (re.test(removeAccents(col)) && !matched.includes(col)) {
        matched.push(col);
      }
    }
  }
  return matched.length > 0 ? matched : null;
}

// ===================== FILTER EXTRACTION ENGINE =====================
function extractFilters(q, candidateCols) {
  const filters = [];
  const simplePatterns = [
    { re: /(?:con\s+)?(?:más|mas)\s+de\s+(\d+[\d.,]*)\s+([a-záéíóúñü][a-záéíóúñü\s]{1,30})/gi, op: '>' },
    { re: /(?:con\s+)?(?:al\s+menos|mínimo|minimo)\s+(\d+[\d.,]*)\s+([a-záéíóúñü][a-záéíóúñü\s]{1,30})/gi, op: '>=' },
    { re: /(?:con\s+)?(?:menos|menor)\s+de\s+(\d+[\d.,]*)\s+([a-záéíóúñü][a-záéíóúñü\s]{1,30})/gi, op: '<' },
    { re: /(?:mayor(?:es)?)\s+de\s+(\d+[\d.,]*)\s+(años?|edad)/gi, op: '>' },
    { re: /(?:menor(?:es)?)\s+de\s+(\d+[\d.,]*)\s+(años?|edad)/gi, op: '<' },
  ];
  for (const { re, op } of simplePatterns) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(q)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      let hint = m[2].trim().toLowerCase()
        .replace(/\s+(de la|en la|del|de el|que|y)\s*.*$/, '')
        .replace(/\s+$/, '');
      if (isNaN(val) || !hint || hint.length < 3) continue;
      const colMatch = detectTargetColumn(hint, candidateCols);
      if (colMatch.matched) filters.push({ col: colMatch.col, op, val });
    }
  }
  return filters;
}

function applyFilters(data, filters) {
  if (!filters.length) return data;
  return data.filter(r => {
    for (const f of filters) {
      const v = parseFloat(r[f.col]);
      if (isNaN(v)) return false;
      if (f.op === '>' && !(v > f.val)) return false;
      if (f.op === '>=' && !(v >= f.val)) return false;
      if (f.op === '<' && !(v < f.val)) return false;
      if (f.op === '<=' && !(v <= f.val)) return false;
    }
    return true;
  });
}

function describeFilters(filters) {
  if (!filters.length) return '';
  return '<br><em>Filtros: ' + filters.map(f => `${f.col} ${f.op} ${f.val}`).join(', ') + '</em>';
}

// ===================== QUERY CLASSIFICATION =====================
function isSimpleOfflineQuery(q) {
  const t = q.trim();
  // Never treat position/profile queries as simple offline — they need Gemini
  if (/lateral|defens|central|volante|extremo|delanter|enganche|mediapunta|arquero|portero|carrilero|stopper|puntero|pivote|contencion|wing|scout|perfil|estilo/i.test(t)) return false;
  if (/^(cuántos|cuantos|cantidad|total de jugadores|columnas|campos|qué datos|que datos|variables|resumen|summary|overview|qué ligas|que ligas)/i.test(t)) return true;
  if (/^(datos de|info de|estadísticas de|stats de|decime sobre|buscar a|buscar)\s+/i.test(t)) return true;
  if (/^(jugadores de|plantel de|equipo)\s+/i.test(t)) return true;
  if (/^promedio\s+(de|del)\s+/i.test(t)) return true;
  if (/^top\s+\d+\s+(por|de|en)\s+/i.test(t) && !/que sea|tipo|perfil|estilo|mejor|peor|como|parecido|similar/i.test(t)) return true;
  return false;
}

function classifyQuery(query) {
  const q = removeAccents(query.toLowerCase());
  // Profile/tactical → needs Gemini with broad data
  if (/perfil|tipo|estilo|caracter[ií]stica|parecido|similar|scout|busco un|necesito un|9 tanque|enganche|lateral ofensiv|lateral izquierd|lateral derech|volante creativ|extremo|mediapunta|stopper|carrilero|defensor central|marcador central|delantero centro|centrodelantero|volante defensiv|volante ofensiv|wing.?back|puntero|referencia|ariete|pivote|contencion|interior|box.to.box|organizador|armador/i.test(q))
    return 'profile';
  // Comparison
  if (/compar[aáeé]|vs\.?|versus|diferencia entre|mejor entre/i.test(q))
    return 'compare';
  // Multi-league
  if (detectDatasets(query).length > 1 && /compar|entre|vs|ambas|todas|las \d/i.test(q))
    return 'multi-league';
  // Analysis/opinion
  if (/anali[zs]|por qu[eé]|explica|opini[oó]n|conclusi[oó]n|tendencia|patr[oó]n|insight|destac/i.test(q))
    return 'analysis';
  return 'standard';
}

// ===================== OFFLINE QUERY ENGINE =====================
function queryOffline(query, leagueName, data) {
  const q = query.toLowerCase();
  const { columns, numCols, nameCol, equipoCol, candidateCols } = analyzeColumns(data);
  const colResult = detectTargetColumn(q, candidateCols);
  const targetCol = colResult.col;
  const keywordMatched = colResult.matched;

  function extractCount() {
    if (/^(quién|quien|cuál|cual) (fue|es|era)\s+(el|la)\b/i.test(q)) return 1;
    const topMatch = q.match(/top\s*(\d{1,3})\b/i);
    if (topMatch) return parseInt(topMatch[1]);
    const nums = [...q.matchAll(/\b(\d{1,3})\b/g)].map(m => parseInt(m[1])).filter(n => n >= 1 && n <= 200);
    return nums[0] || 10;
  }

  const filters = extractFilters(q, candidateCols);
  const filteredData = applyFilters(data, filters);
  const filterNote = describeFilters(filters);

  // TOP / RANKING
  if (/top|más|mayor|mejor|máximo|ranking|max|líder|lider|quién fue|quien fue|cuál fue|cual fue/i.test(q)) {
    const n = extractCount();
    if (targetCol && keywordMatched) {
      const sorted = [...filteredData].sort((a, b) => (parseFloat(b[targetCol]) || 0) - (parseFloat(a[targetCol]) || 0));
      const showEquipo = equipoCol && targetCol !== equipoCol;
      let html = `<strong>🏆 Top ${n} por ${targetCol} — ${leagueName}</strong>${filterNote}<br><table><thead><tr><th>#</th><th>${nameCol}</th>${showEquipo ? `<th>Equipo</th>` : ''}<th>${targetCol}</th></tr></thead><tbody>`;
      sorted.slice(0, n).forEach((r, i) => {
        html += `<tr><td>${i + 1}</td><td>${r[nameCol] ?? '—'}</td>${showEquipo ? `<td>${r[equipoCol] ?? '—'}</td>` : ''}<td>${r[targetCol] ?? '—'}</td></tr>`;
      });
      return { confident: true, html: html + '</tbody></table>' };
    }
  }

  // PROMEDIO
  if (/promedio|media|average|avg/i.test(q) && targetCol && keywordMatched) {
    const vals = filteredData.map(r => parseFloat(r[targetCol])).filter(v => !isNaN(v));
    if (vals.length) return { confident: true, html: `📊 Promedio de <strong>${targetCol}</strong> en <strong>${leagueName}</strong>: <strong>${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}</strong> (${vals.length} jugadores).${filterNote}` };
  }

  // MÍNIMO
  if (/mínimo|minimo|menor|peor|bajo/i.test(q) && targetCol && keywordMatched) {
    const n = extractCount();
    const sorted = [...filteredData].sort((a, b) => (parseFloat(a[targetCol]) || 0) - (parseFloat(b[targetCol]) || 0)).filter(r => parseFloat(r[targetCol]) > 0);
    const showEquipo = equipoCol && targetCol !== equipoCol;
    let html = `<strong>📉 Menor ${n} por ${targetCol} — ${leagueName}</strong>${filterNote}<br><table><thead><tr><th>#</th><th>${nameCol}</th>${showEquipo ? `<th>Equipo</th>` : ''}<th>${targetCol}</th></tr></thead><tbody>`;
    sorted.slice(0, n).forEach((r, i) => {
      html += `<tr><td>${i + 1}</td><td>${r[nameCol] ?? '—'}</td>${showEquipo ? `<td>${r[equipoCol] ?? '—'}</td>` : ''}<td>${r[targetCol] ?? '—'}</td></tr>`;
    });
    return { confident: true, html: html + '</tbody></table>' };
  }

  // PLAYER SEARCH
  const jugadorMatch = q.match(/(?:datos de|info de|estadísticas de|stats de|decime sobre|buscar a|buscar)\s+(.+)/i);
  if (jugadorMatch) {
    const nombre = jugadorMatch[1].trim().toLowerCase().replace(/de la .*|en la .*|de el .*/i, '').trim();
    const found = data.filter(r => (r[nameCol] || '').toLowerCase().includes(nombre));
    if (found.length > 0) {
      let html = `<strong>🔍 "${jugadorMatch[1]}" — ${leagueName}</strong><br>`;
      found.slice(0, 5).forEach(r => {
        html += `<table><tbody>`;
        for (const [k, v] of Object.entries(r)) { if (v !== null && v !== '') html += `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`; }
        html += `</tbody></table><br>`;
      });
      return { confident: true, html };
    }
  }

  // TEAM SEARCH
  if (equipoCol && /equipo|club|plantel|jugadores de/i.test(q)) {
    const equipoWords = q.replace(/.*(?:equipo|club|plantel|jugadores de)\s*/i, '').trim().replace(/de la .*/i, '').trim();
    if (equipoWords.length > 2) {
      const found = data.filter(r => (r[equipoCol] || '').toLowerCase().includes(equipoWords));
      if (found.length > 0) {
        let html = `<strong>👥 ${found.length} jugadores — "${equipoWords}" — ${leagueName}</strong><br><table><thead><tr><th>${nameCol}</th>${numCols.slice(0, 4).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
        found.forEach(r => { html += `<tr><td>${r[nameCol] ?? '—'}</td>${numCols.slice(0, 4).map(c => `<td>${r[c] ?? '—'}</td>`).join('')}</tr>`; });
        return { confident: true, html: html + '</tbody></table>' };
      }
    }
  }

  // COUNT
  if (/cuántos|cuantos|cantidad|total de jugadores/i.test(q)) {
    return { confident: true, html: `📋 <strong>${leagueName}</strong> tiene <strong>${data.length}</strong> jugadores registrados.` };
  }

  // SUMMARY
  if (/resumen|summary|general|overview/i.test(q)) {
    const summary = FStats.datasetSummaries[leagueName];
    let html = `<strong>📋 ${leagueName}</strong><br>Jugadores: <strong>${data.length}</strong><br>`;
    if (summary) {
      if (summary.teams.length) html += `Equipos: <strong>${summary.teams.length}</strong><br>`;
      if (Object.keys(summary.posDistrib).length) {
        html += `<strong>Posiciones:</strong> ${Object.entries(summary.posDistrib).map(([k, v]) => `${k}: ${v}`).join(', ')}<br>`;
      }
      for (const col of Object.keys(summary.colStats).slice(0, 8)) {
        const s = summary.colStats[col];
        html += `<strong>${col}</strong>: avg ${s.avg} · max ${s.max} · median ${s.med}<br>`;
      }
    }
    return { confident: true, html };
  }

  // COLUMNS
  if (/columnas|campos|qué datos|que datos|variables/i.test(q)) {
    return { confident: true, html: `📋 Columnas en <strong>${leagueName}</strong>:<br>${columns.map(c => `• <code>${c}</code>`).join('<br>')}` };
  }

  return { confident: false, html: `🤔 No pude resolver eso localmente. Probá: <em>"Top 10 goleadores de la ${leagueName}"</em> o <em>"Promedio de edad de la ${leagueName}"</em>.` };
}

// ===================== NO LEAGUE =====================
function buildNoLeagueOffline() {
  return `🤔 No detecté a qué liga querés consultar:<br><br>` +
    FStats.DATASETS_CONFIG.map(d => {
      const ds = FStats.loadedDatasets[d.name];
      return `${d.emoji} <strong>${d.name}</strong>` + (ds ? ` (${ds.length} jug.)` : ``);
    }).join('<br>') + `<br><br>Mencioná el nombre de la liga en tu consulta.`;
}

// ===================== SMART DATA SLICER FOR GEMINI =====================
function buildCompactData(query, leagueName, data) {
  const { columns, numCols, nameCol, equipoCol, posCol, pos2Col, pos3Col, edadCol, paisCol, pieCol, alturaCol, candidateCols, defensiveCols, attackCols, passCols } = analyzeColumns(data);
  const totalRows = data.length;
  const qType = classifyQuery(query);
  const qNorm = removeAccents(query.toLowerCase());

  // Pre-filter by explicit filters in query
  const filters = extractFilters(query.toLowerCase(), candidateCols);
  let filtered = applyFilters(data, filters);
  const filterDesc = filters.map(f => `${f.col}${f.op}${f.val}`).join(',');

  // Pre-filter by position if the query mentions a specific position
  const positionFilter = extractPositionFilter(qNorm);
  if (positionFilter && posCol) {
    const posFiltered = filtered.filter(r => {
      const p1 = removeAccents((r[posCol] || '').toString().toLowerCase());
      const p2 = pos2Col ? removeAccents((r[pos2Col] || '').toString().toLowerCase()) : '';
      const p3 = pos3Col ? removeAccents((r[pos3Col] || '').toString().toLowerCase()) : '';
      return positionFilter.some(pf => p1.includes(pf) || p2.includes(pf) || p3.includes(pf));
    });
    // Only use position filter if it yields results
    if (posFiltered.length > 0) filtered = posFiltered;
  }

  // Detect sort column
  const colResult = detectTargetColumn(query.toLowerCase(), candidateCols);
  const sortCol = colResult.col || candidateCols[0] || numCols[0];

  // Determine how many rows and which columns based on query type
  let topN, selectedCols, maxTokens;

  // Always include identity columns
  const identityCols = [nameCol, equipoCol, posCol, pos2Col, pos3Col, edadCol, pieCol, alturaCol].filter(Boolean);

  if (qType === 'profile') {
    // Profile query → send MANY more rows with ALL relevant columns
    topN = Math.min(filtered.length, 60);
    const profileCols = detectProfileColumns(query, candidateCols, columns);
    // Include identity + all profile-relevant + defensive + attack + pass columns
    selectedCols = [...identityCols, ...(profileCols || candidateCols.slice(0, 30))];
    // Add defensive cols explicitly for any query mentioning defense/lateral/central
    if (/lateral|defens|central|zaguero|volante|contencion|marca/i.test(qNorm)) {
      selectedCols.push(...defensiveCols);
    }
    // Add attack cols for attack-related profiles
    if (/ofensiv|goleador|extremo|delantero|puntero|enganche|atac/i.test(qNorm)) {
      selectedCols.push(...attackCols);
    }
    // Add pass cols for creative/midfield profiles
    if (/creativ|enganche|volante|lateral|mediapunta|armador|organiz/i.test(qNorm)) {
      selectedCols.push(...passCols);
    }
    selectedCols = [...new Set(selectedCols)];
    maxTokens = 16384;
  } else if (qType === 'compare') {
    topN = Math.min(filtered.length, 40);
    selectedCols = [...identityCols, ...candidateCols];
    selectedCols = [...new Set(selectedCols)];
    maxTokens = 12288;
  } else if (qType === 'analysis') {
    topN = Math.min(filtered.length, 40);
    selectedCols = [...identityCols, ...candidateCols.slice(0, 30)];
    selectedCols = [...new Set(selectedCols)];
    maxTokens = 12288;
  } else {
    // Standard → focused data but still include position
    topN = Math.min(filtered.length, 30);
    const focusCols = colResult.matched ? [colResult.col, ...candidateCols.filter(c => c !== colResult.col).slice(0, 15)] : candidateCols.slice(0, 18);
    selectedCols = [...identityCols, ...focusCols];
    selectedCols = [...new Set(selectedCols)];
    maxTokens = 8192;
  }

  // Sort and slice
  const sorted = [...filtered].sort((a, b) => (parseFloat(b[sortCol]) || 0) - (parseFloat(a[sortCol]) || 0));
  // Also include bottom 5 for context on distribution
  const topRows = sorted.slice(0, topN);
  const bottomRows = (qType === 'profile' || qType === 'analysis') ? sorted.slice(-5) : [];
  const allRows = [...topRows, ...bottomRows];

  // Build CSV-style compact data (more token-efficient than JSON)
  const h = selectedCols.map(c => c.length > 30 ? c.substring(0, 30) : c);
  const csvRows = allRows.map(row => selectedCols.map(c => {
    const v = row[c];
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return Number.isInteger(v) ? v : +v.toFixed(2);
    return v;
  }));

  // Compact stats from precomputed summary
  const summary = FStats.datasetSummaries[leagueName];
  let statsStr = '';
  if (summary) {
    const relevantStats = {};
    for (const col of selectedCols.filter(c => summary.colStats[c])) {
      const s = summary.colStats[col];
      relevantStats[col.length > 30 ? col.substring(0, 30) : col] = { n: s.min, x: s.max, a: s.avg, m: s.med };
    }
    statsStr = JSON.stringify(relevantStats);
  }

  // Build prompt
  let prompt = `L:"${leagueName}"|P:${totalRows}|F:${filtered.length}`;
  if (positionFilter) prompt += `|POS_FILTER:${positionFilter.join(',')}`;
  prompt += `\nH:${h.join('|')}`;
  prompt += `\nD:${csvRows.map(r => r.join('|')).join('\n')}`;
  if (statsStr) prompt += `\nS:${statsStr}`;
  if (filterDesc) prompt += `\nFilt:${filterDesc}`;
  if (bottomRows.length) prompt += `\n[last ${bottomRows.length} rows = bottom of ranking]`;
  // List ALL available columns so Gemini knows everything in the dataset
  prompt += `\nALL_COLS:${columns.join(',')}`;
  prompt += `\nQ:${query}`;

  return { prompt, maxTokens };
}

// Extract position filter from query
function extractPositionFilter(qNorm) {
  const posMap = {
    'lateral izquierd': ['lb','lwb','lateral izquierd','li','left back','wing-back izq'],
    'lateral derech': ['rb','rwb','lateral derech','ld','right back','wing-back der'],
    'lateral': ['lb','rb','lwb','rwb','lateral','wing-back','carrilero'],
    'central': ['cb','central','defensor central','zaguero','stopper'],
    'volante central': ['cdm','cm','dmf','cmf','volante','mediocampista central','pivote','mediocentro'],
    'volante ofensiv': ['cam','amf','volante ofensiv','mediapunta','enganche'],
    'extremo izquierd': ['lw','lm','lwf','extremo izquierd','puntero izquierd'],
    'extremo derech': ['rw','rm','rwf','extremo derech','puntero derech'],
    'extremo': ['lw','rw','lm','rm','lwf','rwf','extremo','puntero','wing'],
    'delantero': ['cf','st','fw','delantero','centrodelantero','9'],
    'mediapunta': ['cam','amf','mediapunta','enganche','10'],
    'arquero': ['gk','arquero','portero','guardameta'],
  };
  for (const [keyword, positions] of Object.entries(posMap)) {
    if (qNorm.includes(keyword)) return positions;
  }
  return null;
}

// Build data for multi-league queries
function buildMultiLeagueData(query, leagueNames) {
  let prompt = '';
  for (const ln of leagueNames) {
    const data = FStats.loadedDatasets[ln];
    if (!data) continue;
    const { nameCol, equipoCol, posCol, pos2Col, edadCol, candidateCols } = analyzeColumns(data);
    const colResult = detectTargetColumn(query.toLowerCase(), candidateCols);
    const sortCol = colResult.col || candidateCols[0];
    const sorted = [...data].sort((a, b) => (parseFloat(b[sortCol]) || 0) - (parseFloat(a[sortCol]) || 0));
    const top15 = sorted.slice(0, 15);
    const cols = [nameCol, equipoCol, posCol, edadCol, sortCol, ...candidateCols.filter(c => c !== sortCol).slice(0, 10)].filter(Boolean);
    const uniqueCols = [...new Set(cols)];
    prompt += `\n---${ln}(${data.length}jug)---\nH:${uniqueCols.join('|')}\n`;
    prompt += top15.map(r => uniqueCols.map(c => r[c] ?? '').join('|')).join('\n');
  }
  prompt += `\nQ:${query}`;
  return { prompt, maxTokens: 12288 };
}
