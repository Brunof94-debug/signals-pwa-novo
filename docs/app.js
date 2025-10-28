// --- Início do app.js (v3 - Com NOVA Chave Pública VAPID) ---

const API_BASE = 'https://signals-push.brunoprof07.workers.dev';
// <<<--- ESTA É A NOVA CHAVE PÚBLICA VAPID --->>>
const VAPID_PUBLIC_KEY = 'BBwW7vLsh8_shutN881ggeqNmjIdhDUtFxTJMkCXtdaQMMNtmSRuwUN6M9sGCMN2mbj7UtVqmJAwrOgdSXzPfcI';

let swRegistration = null;
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); if(d){ d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>' : '') + '\n'; d.scrollTop = d.scrollHeight;} else { console.log(m); } };

// --- Funções de Histórico ---
function pushHistory(row) {
  const key = 'signals_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.unshift(row);
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
  renderHistory();
}

function renderHistory() {
  const key = 'signals_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  const tbody = $('#hist tbody');
  if (!tbody) return;
  tbody.innerHTML = arr.map(r => `
    <tr data-timestamp="${r.ts || r.signalId}"> // Usa signalId se ts não estiver presente
      <td>${new Date(r.ts || r.signalId).toLocaleString()}</td>
      <td>${r.symbol || '?'}</td>
      <td>${r.strategy || '?'}</td>
      <td>${r.side || '?'}</td>
      <td>${(r.price || 0).toFixed(2)}</td>
      <td class="${(r.pnl ?? 0) >= 0 ? 'ok' : 'err'}">${(r.pnl ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');
   // Após renderizar, tenta destacar se houver um ID na URL
   highlightSignalFromUrl();
}

// --- Funções PUSH ---
async function sendPush(title, body) {
  try {
    const r = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    if (!r.ok) {
        const errorText = await r.text();
        throw new Error(`send ${r.status} - ${errorText}`);
    }
    log(`Push OK: ${title}`, 'ok');
  } catch (e) {
    log('Push falhou: ' + e.message, 'err');
  }
}

async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { log('Push não suportado.', 'err'); return; }
  try {
    log('Registrando Service Worker...');
    const swReg = await navigator.serviceWorker.register('service-worker.js');
    swRegistration = swReg; log('Service Worker registrado.', 'ok');
    log('Pedindo permissão...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { log('Permissão negada.', 'err'); return; }
    log('Permissão concedida.', 'ok');
    log('Obtendo inscrição...');
    const subscription = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
    log('Inscrição obtida.', 'ok');
    log('Enviando inscrição para o servidor...');
    const response = await fetch(`${API_BASE}/subscribe`, { method: 'POST', body: JSON.stringify(subscription), headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`subscribe ${response.status} - ${errorText}`);
     }
    log('Registro de push OK! Inscrição salva no backend.', 'ok');
    if ($('#btnRegister')) $('#btnRegister').disabled = true;
    if ($('#btnTest')) $('#btnTest').disabled = false;
  } catch (e) { log('Registro de push falhou: ' + e.message, 'err'); }
}
async function testPush() { await sendPush('Teste Signals AI', 'Notificação de teste enviada do App.'); }

// --- Funções Auxiliares e Inicialização ---

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

function checkPermission() {
  const registerBtn = $('#btnRegister');
  const testBtn = $('#btnTest');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if(registerBtn) registerBtn.disabled = true;
    if(testBtn) testBtn.disabled = true;
    log('Push não suportado.', 'err');
    return;
  }
  // Verifica se já existe uma subscrição ATIVA
  navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(subscription => {
          if (subscription) {
              log('Permissão já concedida e subscrição ativa.');
              if(registerBtn) registerBtn.disabled = true;
              if(testBtn) testBtn.disabled = false;
          } else {
              // Não há subscrição, verifica a permissão
              if (Notification.permission === 'granted') {
                log('Permissão concedida, mas precisa registrar.');
                if(registerBtn) registerBtn.disabled = false;
                if(testBtn) testBtn.disabled = true;
              } else if (Notification.permission === 'denied') {
                log('Permissão bloqueada.', 'err');
                if(registerBtn) registerBtn.disabled = true;
                if(testBtn) testBtn.disabled = true;
              } else {
                log('Aguardando permissão...');
                if(registerBtn) registerBtn.disabled = false;
                if(testBtn) testBtn.disabled = true;
              }
          }
      });
  });
}


// <<<--- Funções para ler URL e destacar --- >>>
// Função movida para ser chamada DEPOIS de renderHistory
function highlightSignalFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const signalIdParam = urlParams.get('signalId');

  if (signalIdParam) {
    log(`Recebido signalId via URL: ${signalIdParam}`);
    const signalId = parseInt(signalIdParam, 10);

    if (!isNaN(signalId)) {
        highlightSignalInHistory(signalId);
    } else {
        log('signalId inválido na URL.', 'err');
    }
  }
}

function highlightSignalInHistory(signalId) {
  log(`Tentando destacar sinal com ID (timestamp): ${signalId}`);
  const tbody = document.querySelector('#hist tbody');
  if (!tbody) { log('Tabela de histórico não encontrada.', 'err'); return; }

  const rows = tbody.querySelectorAll('tr');
  let found = false;
  rows.forEach(row => {
    row.classList.remove('highlighted-signal');
    const rowTimestamp = parseInt(row.dataset.timestamp, 10);
    if (!isNaN(rowTimestamp) && rowTimestamp === signalId) {
      log(`Sinal encontrado! Destacando linha ${rowTimestamp}.`);
      row.classList.add('highlighted-signal');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });

  if (!found) { log(`Sinal com ID ${signalId} não encontrado na tabela.`); }
}
// <<<--- FIM DAS FUNÇÕES --- >>>


// --- Configuração dos Botões ---
const btnRegister = $('#btnRegister');
const btnTest = $('#btnTest');
if(btnRegister) btnRegister.onclick = registerPush;
if(btnTest) btnTest.onclick = testPush;

// --- Inicialização ---
renderHistory(); // Renderiza o histórico primeiro
checkPermission();
// handleUrlParameters(); // Removido daqui, chamado dentro de renderHistory
log('JS carregado');

// --- Fim do app.js ---
