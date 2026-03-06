// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — speech.js                                ║
// ║  Speech recognition (Web Speech API)                       ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { document.getElementById('btnMic').style.display = 'none'; return; }
  FStats.recognition = new SR();
  FStats.recognition.lang = 'es-ES';
  FStats.recognition.continuous = false;
  FStats.recognition.interimResults = false;
  FStats.recognition.onresult = e => {
    const t = e.results[0][0].transcript;
    const inp = document.getElementById('queryInput'); inp.value = t; autoResize(inp);
    document.getElementById('btnSend').disabled = false; stopListening();
  };
  FStats.recognition.onerror = () => stopListening();
  FStats.recognition.onend = () => stopListening();
}

function toggleMic() {
  if (FStats.isListening) { FStats.recognition.stop(); stopListening(); } else startListening();
}

function startListening() {
  if (!FStats.recognition) return;
  FStats.isListening = true;
  document.getElementById('btnMic').classList.add('listening');
  document.getElementById('btnMic').title = 'Detener';
  FStats.recognition.start();
}

function stopListening() {
  FStats.isListening = false;
  document.getElementById('btnMic').classList.remove('listening');
  document.getElementById('btnMic').title = 'Hablar';
}
