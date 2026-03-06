// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — utils.js                                 ║
// ║  Shared utility functions                                  ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

// Minimum ratio of maxLen that must be before a sentence boundary to use it for truncation.
const MIN_TRUNCATION_RATIO = 0.5;

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent || d.innerText || '').substring(0, 250); }
function stripHtmlFull(html, maxLen = 1500) {
  const d = document.createElement('div');
  d.innerHTML = html;
  const text = (d.textContent || d.innerText || '');
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutAt = Math.max(lastPeriod, lastNewline);
  return (cutAt > maxLen * MIN_TRUNCATION_RATIO) ? truncated.substring(0, cutAt + 1) + '...' : truncated + '...';
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, '_'); }
function removeAccents(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
