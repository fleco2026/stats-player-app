// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — app.js                                   ║
// ║  Main initialization, sidebar toggle, DOMContentLoaded     ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// ===================== SIDEBAR MOBILE =====================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const s = localStorage.getItem('fstats_gemini_key');
    if (s) { FStats.apiKey = s; updateApiStatus(true); }
    else { document.getElementById('noAiNotice').classList.add('visible'); }
  } catch (err) {
    console.warn('[App] Error loading API key:', err);
  }
  loadConversationsFromStorage();
  renderLeagueBadges();
  document.getElementById('loadingBar').classList.add('visible');
  await loadAllDatasets();
  document.getElementById('loadingBar').classList.remove('visible');
  if (FStats.conversations.length === 0) createNewConversation(true);
  else setActiveConversation(FStats.conversations[0].id);
  document.getElementById('queryInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.getElementById('queryInput').addEventListener('input', () => {
    document.getElementById('btnSend').disabled = !document.getElementById('queryInput').value.trim();
  });
  initSpeechRecognition();
});
