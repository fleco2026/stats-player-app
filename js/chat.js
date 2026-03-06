// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — chat.js                                  ║
// ║  Chat UI, Gemini API interaction, main send handler        ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// ===================== CHAT UI =====================
function addMessage(role, html) {
  const conv = getActiveConv();
  if (conv) {
    conv.history.push({ role, html });
    if (role === 'user' && conv.history.filter(m => m.role === 'user').length === 1) {
      conv.title = stripHtml(html).substring(0, 50);
    }
    saveConvs(); renderConvList();
  }
  const area = document.getElementById('chatArea');
  const msg = document.createElement('div'); msg.className = `message ${role}`;
  msg.innerHTML = `<div class="message-bubble">${html}</div>`;
  area.appendChild(msg); scrollToBottom();
}

function showTyping() {
  const area = document.getElementById('chatArea');
  const ind = document.createElement('div'); ind.className = 'typing-indicator'; ind.id = 'typingIndicator';
  ind.innerHTML = '<span></span><span></span><span></span>'; area.appendChild(ind); scrollToBottom();
}

function hideTyping() { const el = document.getElementById('typingIndicator'); if (el) el.remove(); }

function scrollToBottom() { setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100); }

function quickQuery(t) { const inp = document.getElementById('queryInput'); inp.value = t; autoResize(inp); document.getElementById('btnSend').disabled = false; handleSend(); }

function renderChatArea() {
  const area = document.getElementById('chatArea');
  const conv = getActiveConv();
  if (!conv || conv.history.length === 0) {
    area.innerHTML = '';
    const loaded = Object.keys(FStats.loadedDatasets).length;
    const el = document.createElement('div'); el.className = 'message assistant';
    el.innerHTML = `<div class="message-bubble">⚽ <strong>¡Bienvenido a FútbolStats AI!</strong><br><br>Tengo cargadas <strong>${loaded} ligas argentinas</strong>:<br>${FStats.DATASETS_CONFIG.map(d => {
      const ok = FStats.loadedDatasets[d.name];
      return `${d.emoji} <strong>${d.name}</strong>` + (ok ? ` — ${ok.length} jugadores` : ' — <span style="color:var(--danger)">error</span>');
    }).join('<br>')}<br><br>Mencioná el nombre de la liga en tu consulta. Podés comparar entre ligas.</div>`;
    area.appendChild(el); return;
  }
  area.innerHTML = conv.history.map(m => `<div class="message ${m.role}"><div class="message-bubble">${m.html}</div></div>`).join('');
  scrollToBottom();
}

// ===================== API KEY =====================
function toggleApiBody() {
  const b = document.getElementById('apiBody'); b.classList.toggle('visible');
  document.getElementById('apiToggleLabel').textContent = b.classList.contains('visible') ? '▲ Cerrar' : '▼ Configurar';
}

function saveApiKey() {
  const v = document.getElementById('apiKeyInput').value.trim(); if (!v) return;
  FStats.apiKey = v;
  try { localStorage.setItem('fstats_gemini_key', v); } catch (err) {
    console.warn('[App] Error saving API key:', err);
  }
  updateApiStatus(true);
  document.getElementById('apiBody').classList.remove('visible');
  document.getElementById('apiToggleLabel').textContent = '▼ Configurar';
  document.getElementById('noAiNotice').classList.remove('visible');
}

function updateApiStatus(c) {
  const d = document.getElementById('apiDot'); const s = document.getElementById('apiSection');
  if (c) { d.classList.add('active'); s.classList.add('connected'); }
  else { d.classList.remove('active'); s.classList.remove('connected'); }
}

// ===================== GEMINI ENGINE =====================
const BASE_SYS_INSTRUCTION = `Sos un analista de fútbol argentino experto en scouting, perfilado táctico y análisis estadístico.

REGLAS DE RESPUESTA:
- Respondé SOLO en HTML válido para insertar en un div (tags: strong,table,tr,th,td,br,em,ul,li,p,h3).
- Español rioplatense. Conciso, preciso, profesional.
- SIEMPRE basá tus respuestas en los datos proporcionados, NO inventes datos.
- Si un dato no está en los datos que recibís, verificá en ALL_COLS si la columna existe. Si la columna existe en ALL_COLS significa que el dato SÍ está disponible en el dataset aunque no te lo haya pasado. NO digas que el dataset no tiene esa información.

DATOS DISPONIBLES (MUY IMPORTANTE):
- TODAS las ligas tienen columna de POSICIÓN ESPECÍFICA (ej: "Posicin especfica", "Posicion", etc.) con posiciones como: LB, RB, CB, LCB, RCB, DMF, CMF, AMF, LW, RW, CF, GK, LWB, RWB, etc.
- TODAS las ligas tienen SEGUNDA POSICIÓN y POSICIÓN EXTRA.
- TODAS las ligas tienen MÉTRICAS DEFENSIVAS completas: Acciones defensivas realizadas/90, Duelos defensivos/90, Duelos defensivos ganados %, Duelos aéreos/90, Entradas/90, Tiros interceptados/90, Interceptaciones/90, Faltas/90, etc.
- TODAS las ligas tienen MÉTRICAS OFENSIVAS: Goles, xG, Remates, Tiros a portería, Goles de cabeza, Regates, Toques en área, etc.
- TODAS las ligas tienen MÉTRICAS DE PASE: Pases/90, Centros/90, Centros banda izquierda/90, Centros banda derecha/90, Pases progresivos, Pases en profundidad, Jugadas claves, etc.
- Los datos que recibís ya están PRE-FILTRADOS por posición cuando corresponde. La columna H indica los headers.

FORMATO DE DATOS QUE RECIBÍS:
- L=liga, P=total jugadores, F=filtrados (puede estar filtrado por posición)
- POS_FILTER=filtro de posición aplicado (si presente)
- H=headers separados por |
- D=filas de datos separadas por |
- S=stats por columna: n=min,x=max,a=avg,m=mediana
- Filt=filtros ya aplicados
- ALL_COLS=TODAS las columnas disponibles en el dataset completo
- Q=consulta del usuario

PERFILES TÁCTICOS:
Cuando pidan un perfil (9 tanque, enganche, lateral ofensivo, lateral izquierdo, etc.):
1. Usá la columna de posición para CONFIRMAR que los jugadores juegan en esa posición.
2. Elegí las columnas más relevantes del perfil táctico solicitado.
3. Armá un top y justificá con datos concretos de los datos que recibís.
4. Explicá brevemente qué columnas priorizaste y por qué.
5. NUNCA digas que no tenés datos de posición o métricas defensivas, porque SÍ los tenés.

COMPARACIONES:
Cuando comparen jugadores o ligas, usá tablas side-by-side y destacá diferencias clave.`;

function buildSystemInstruction() {
  // Base instruction + compact data context about all loaded leagues
  const dataCtx = buildSystemDataContext();
  if (!dataCtx) return BASE_SYS_INSTRUCTION;
  return BASE_SYS_INSTRUCTION + `\n\nLIGAS CARGADAS (resumen):\n${dataCtx}`;
}

function getHistoryContents() {
  const conv = getActiveConv();
  if (!conv || conv.history.length === 0) return [];
  // Send last 4 messages for better context, but strip HTML to save tokens
  return conv.history.slice(-4).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: stripHtml(m.html) }]
  }));
}

async function queryWithGemini(query, leagueName, data) {
  const { prompt, maxTokens } = buildCompactData(query, leagueName, data);
  const history = getHistoryContents();
  const userMsg = { role: 'user', parts: [{ text: prompt }] };
  const contents = [...history, userMsg];
  return await callGeminiRaw(contents, { maxTokens });
}

async function queryMultiLeagueGemini(query, leagueNames) {
  const { prompt, maxTokens } = buildMultiLeagueData(query, leagueNames);
  const history = getHistoryContents();
  const userMsg = { role: 'user', parts: [{ text: prompt }] };
  const contents = [...history, userMsg];
  return await callGeminiRaw(contents, { maxTokens });
}

async function queryGeminiGeneral(query) {
  const mentionsData = /jugador|gol|asist|equipo|club|pase|tiro|minuto|comparar|compará/i.test(query);
  const maxTokens = mentionsData ? 4096 : 2048;
  // Send compact league summary in prompt
  const ligasSummary = FStats.DATASETS_CONFIG.map(ds => {
    const s = FStats.datasetSummaries[ds.name];
    if (!s) return null;
    return `${ds.emoji}${ds.name.replace(/ 2025$/, '')}:${s.totalPlayers}jug,${s.teams.length}eq`;
  }).filter(Boolean).join('; ');
  const prompt = `Ligas:[${ligasSummary}]\nQ:${query}`;
  const history = getHistoryContents();
  const userMsg = { role: 'user', parts: [{ text: prompt }] };
  const contents = [...history, userMsg];
  return await callGeminiRaw(contents, { maxTokens });
}

async function callGeminiRaw(contents, opts = {}) {
  const maxTokens = opts.maxTokens || 4096;
  const sysInstruction = buildSystemInstruction();
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sysInstruction }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens }
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${FStats.GEMINI_MODEL}:generateContent?key=${FStats.apiKey}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    if (resp.status === 429 || /quota|rate.?limit/i.test(msg)) {
      const wait = parseFloat(msg.match(/retry in ([\d.]+)/i)?.[1] || '3');
      await new Promise(r => setTimeout(r, (wait + 1) * 1000));
      const r2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (r2.ok) {
        const d = await r2.json();
        return d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '(sin respuesta)';
      }
      throw new Error('⏳ Cuota de Gemini agotada. Esperá unos minutos o usá consultas offline (top, promedio, resumen).');
    }
    if ([400, 401, 403].includes(resp.status)) {
      FStats.apiKey = '';
      try { localStorage.removeItem('fstats_gemini_key'); } catch (err) {
        console.warn('[Chat] Error removing API key:', err);
      }
      updateApiStatus(false); document.getElementById('noAiNotice').classList.add('visible');
      throw new Error('API key inválida. Reconfigurala.');
    }
    throw new Error(msg || `Error ${resp.status}`);
  }
  const data = await resp.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) return '(sin respuesta)';
  // If the model hit the output token limit, retry once with a doubled budget
  if (candidate?.finishReason === 'MAX_TOKENS') {
    const retryMaxTokens = Math.min(maxTokens * 2, 65536);
    const retryBody = JSON.stringify({
      systemInstruction: { parts: [{ text: sysInstruction }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: retryMaxTokens }
    });
    const r2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: retryBody });
    if (r2.ok) {
      const d2 = await r2.json();
      const text2 = d2.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (text2) return text2;
    }
    return text + '<br><em style="color:var(--warning,#f90)">⚠️ Respuesta extensa. Podés pedir más detalles en otra consulta.</em>';
  }
  return text;
}

// ===================== MAIN SEND HANDLER =====================
async function handleSend() {
  const inp = document.getElementById('queryInput');
  const query = inp.value.trim();
  if (!query || FStats.isProcessing) return;
  if (!getActiveConv()) createNewConversation(true);
  FStats.isProcessing = true; inp.value = ''; inp.style.height = 'auto';
  document.getElementById('btnSend').disabled = true;
  addMessage('user', escapeHtml(query));
  showTyping();

  try {
    const detectedLeagues = detectDatasets(query);
    const ln = detectedLeagues.length > 0 ? detectedLeagues[0] : null;
    const isMultiLeague = detectedLeagues.length > 1 && /compar|entre|vs|ambas|todas/i.test(query);
    const cacheLeagueKey = isMultiLeague ? detectedLeagues.join('+') : (ln || '');

    // Check persistent cache
    const cached = FStats.CacheManager.get(query, cacheLeagueKey);
    if (cached) {
      hideTyping(); addMessage('assistant', cached);
      FStats.isProcessing = false; return;
    }

    let response;

    // ===== MULTI-LEAGUE =====
    if (isMultiLeague) {
      const conv = getActiveConv();
      if (conv && !conv.leagueEmoji) { conv.leagueEmoji = '🔄'; saveConvs(); }

      if (FStats.apiKey) {
        response = await queryMultiLeagueGemini(query, detectedLeagues);
      } else {
        // Offline multi-league: show side-by-side summaries
        let html = `<strong>📊 Comparación entre ligas</strong><br><br>`;
        for (const lName of detectedLeagues) {
          const data = FStats.loadedDatasets[lName];
          if (!data) { html += `❌ ${lName}: sin datos<br>`; continue; }
          const s = FStats.datasetSummaries[lName];
          html += `<strong>${FStats.DATASETS_CONFIG.find(d => d.name === lName)?.emoji || ''} ${lName}</strong>: ${data.length} jugadores`;
          if (s && s.teams.length) html += `, ${s.teams.length} equipos`;
          html += `<br>`;
        }
        html += `<br><em>Para análisis detallados entre ligas, conectá Gemini AI.</em>`;
        response = html;
      }
    }
    // ===== NO LEAGUE DETECTED =====
    else if (!ln) {
      // Check if it's a "qué ligas" query
      if (/qu[eé] ligas|ligas cargadas|ligas disponibles|ligas ten[eé]s/i.test(query)) {
        let html = `📋 <strong>Ligas cargadas:</strong><br><br>`;
        for (const ds of FStats.DATASETS_CONFIG) {
          const data = FStats.loadedDatasets[ds.name];
          const s = FStats.datasetSummaries[ds.name];
          html += `${ds.emoji} <strong>${ds.name}</strong>`;
          if (data) html += ` — ${data.length} jugadores`;
          if (s && s.teams.length) html += `, ${s.teams.length} equipos`;
          if (s && s.numericColumns.length) html += `<br><em style="color:var(--text-dim);font-size:12px">Métricas: ${s.numericColumns.slice(0, 8).join(', ')}${s.numericColumns.length > 8 ? '...' : ''}</em>`;
          html += `<br>`;
        }
        response = html;
      } else if (FStats.apiKey) {
        response = await queryGeminiGeneral(query);
      } else {
        response = buildNoLeagueOffline();
      }
    }
    // ===== SINGLE LEAGUE =====
    else {
      const data = FStats.loadedDatasets[ln];
      if (!data) {
        response = `❌ Los datos de <strong>${ln}</strong> no pudieron cargarse.`;
      } else {
        const conv = getActiveConv();
        if (conv && !conv.leagueEmoji) {
          conv.leagueEmoji = FStats.DATASETS_CONFIG.find(d => d.name === ln)?.emoji || '💬';
          saveConvs();
        }

        const simple = isSimpleOfflineQuery(query);

        if (simple) {
          const offlineResult = queryOffline(query, ln, data);
          response = offlineResult.html;
        } else if (FStats.apiKey) {
          response = await queryWithGemini(query, ln, data);
        } else {
          // No API key → try offline, then suggest
          const offlineResult = queryOffline(query, ln, data);
          if (offlineResult.confident) {
            response = offlineResult.html;
          } else {
            response = offlineResult.html + `<br><br><em>💡 Conectá Gemini AI para consultas avanzadas, perfiles tácticos y análisis.</em>`;
          }
        }
      }
    }

    // Save to persistent cache
    FStats.CacheManager.set(query, cacheLeagueKey, response);
    hideTyping(); addMessage('assistant', response);
  } catch (err) {
    hideTyping(); addMessage('assistant', `❌ Error: ${escapeHtml(err.message)}`);
  }
  FStats.isProcessing = false;
}
