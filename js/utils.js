// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — utils.js                                 ║
// ║  Shared utility functions                                  ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || d.innerText || '').substring(0, 250); }
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, '_'); }
function removeAccents(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
