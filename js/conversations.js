// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — conversations.js                         ║
// ║  Conversation management (create, load, delete, render)    ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

function loadConversationsFromStorage() {
  try {
    const r = localStorage.getItem('fstats_conversations');
    if (r) FStats.conversations = JSON.parse(r);
  } catch (err) {
    console.warn('[Conversations] Error loading conversations:', err);
    FStats.conversations = [];
  }
  renderConvList();
}

function saveConvs() {
  try {
    localStorage.setItem('fstats_conversations', JSON.stringify(FStats.conversations));
  } catch (err) {
    console.warn('[Conversations] Error saving conversations:', err);
  }
}

function createNewConversation(silent) {
  const id = Date.now().toString();
  FStats.conversations.unshift({ id, title: 'Nueva consulta', history: [], leagueEmoji: null, createdAt: Date.now() });
  saveConvs(); setActiveConversation(id);
  if (!silent) addMessage('assistant', `⚽ <strong>Nueva conversación.</strong><br>Tengo <strong>${Object.keys(FStats.loadedDatasets).length} ligas</strong> cargadas. Mencioná el nombre en tu consulta.`);
  renderConvList();
}

function newConversation() { createNewConversation(false); closeSidebar(); }

function setActiveConversation(id) { FStats.activeConvId = id; renderConvList(); renderChatArea(); }

function getActiveConv() { return FStats.conversations.find(c => c.id === FStats.activeConvId) || null; }

function deleteConversation(id, e) {
  e.stopPropagation();
  FStats.conversations = FStats.conversations.filter(c => c.id !== id); saveConvs();
  if (FStats.activeConvId === id) {
    if (FStats.conversations.length > 0) setActiveConversation(FStats.conversations[0].id);
    else createNewConversation(true);
  } else renderConvList();
}

function renderConvList() {
  const list = document.getElementById('convList');
  if (!FStats.conversations.length) { list.innerHTML = '<div class="sidebar-empty">Aún no hay conversaciones.<br>¡Hacé tu primera consulta!</div>'; return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  const groups = { 'Hoy': [], 'Ayer': [], 'Últimos 7 días': [], 'Anteriores': [] };
  for (const c of FStats.conversations) {
    const d = new Date(c.createdAt); d.setHours(0, 0, 0, 0);
    if (d >= today) groups['Hoy'].push(c);
    else if (d >= yesterday) groups['Ayer'].push(c);
    else if (d >= week) groups['Últimos 7 días'].push(c);
    else groups['Anteriores'].push(c);
  }
  let html = '';
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    html += `<div class="sidebar-section-label">${label}</div>`;
    for (const c of items) {
      const act = c.id === FStats.activeConvId ? 'active' : '';
      const icon = c.leagueEmoji || '💬';
      html += `<div class="conv-item ${act}" onclick="loadConv('${c.id}')"><span class="conv-item-icon">${icon}</span><div class="conv-item-info"><div class="conv-item-title">${escapeHtml(c.title)}</div><div class="conv-item-meta">${c.history.length} msgs</div></div><button class="conv-item-del" onclick="deleteConversation('${c.id}',event)" title="Eliminar">✕</button></div>`;
    }
  }
  list.innerHTML = html;
}

function loadConv(id) { setActiveConversation(id); closeSidebar(); }
