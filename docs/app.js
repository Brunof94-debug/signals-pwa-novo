// --- Início do app.js (v2 - Com leitura de URL e destaque) ---

const API_BASE = 'https://signals-push.brunoprof07.workers.dev';
// <<<--- CERTIFIQUE-SE QUE ESTA É A SUA CHAVE PÚBLICA VAPID MAIS RECENTE --->>>
const VAPID_PUBLIC_KEY = 'BEbKaaTkSCxP6SL09UutAEjlFckq4o1hQ5hHYl0FSQ4ovyNcvgH0wJftRx5UY5cWQlHT_voxil7FqBL2I6qKjr8';

let swRegistration = null;
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); if(d){ d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>' : '') + '\n'; d.scrollTop = d.scrollHeight;} else { console.log(m); } };

// --- Funções de Histórico (renderHistory MODIFICADA) ---
function pushHistory(row) {
  // Esta função não será chamada pelo servidor, mas pode ser útil para testes
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
  if (!tbody) return; // Sai se a tabela não existir
  tbody.innerHTML = arr.map(r => `
    // <<<--- MODIFICAÇÃO: Adiciona data-timestamp à linha --->>>
    <tr data-timestamp="${r.ts}">
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.symbol || '?'}</td>
      <td>${r.strategy || '?'}</td>
      <td>${r.side || '?'}</td>
      <td>${(r.price || 0).toFixed(2)}</td>
      <td class="${(r.pnl ?? 0) >= 0 ? 'ok' : 'err'}">${(r.pnl ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');
}

// --- Funções PUSH (Sem alterações) ---
async function sendPush(title, body) { /* ... (Sem alterações) ... */ }
async function registerPush() { /* ... (Sem alterações) ... */ }
async function testPush() { /* ... (Sem alterações) ... */ }
// Função de Envio de Push (Usada pelo botão de Teste)
async function sendPush(title, body) {
  try {
    const r = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    if (!r.ok) throw new Error('send ' + r.status);
    log(`Push OK: ${title}`, 'ok');
  } catch (e) {
    log('Push falhou: ' + e.message, 'err');
  }
}
// Função Principal de Registro
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
    if (!response.ok) { throw new Error('subscribe ' + response.status); }
    log('Registro de push OK! Inscrição salva no backend.', 'ok');
    if ($('#btnRegister')) $('#btnRegister').disabled = true;
    if ($('#btnTest')) $('#btnTest').disabled = false;
  } catch (e) { log('Registro de push falhou: ' + e.message, 'err'); }
}
async function testPush() { await sendPush('Teste Signals AI', 'Notificação de teste.'); }

// --- Funções Auxiliares e Inicialização ---

function urlB64ToUint8Array(base64String) { /* ... (Sem alterações) ... */ }
// Função auxiliar para converter a chave VAPID
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

function checkPermission() { /* ... (Sem alterações) ... */ }
// Verifica o estado da permissão ao carregar a página
function checkPermission() {
  const registerBtn = $('#btnRegister');
  const testBtn = $('#btnTest');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if(registerBtn) registerBtn.disabled = true;
    if(testBtn) testBtn.disabled = true;
    log('Push não suportado.', 'err');
    return;
  }
  if (Notification.permission === 'granted') {
    log('Permissão de notificação já concedida.');
    if(registerBtn) registerBtn.disabled = true;
    if(testBtn) testBtn.disabled = false;
    navigator.serviceWorker.register('service-worker.js').then(reg => swRegistration = reg);
  } else if (Notification.permission === 'denied') {
    log('Permissão de notificação bloqueada.', 'err');
    if(registerBtn) registerBtn.disabled = true;
    if(testBtn) testBtn.disabled = true;
  } else {
    log('Aguardando permissão para notificações...'); // Mensagem ajustada
    if(registerBtn) registerBtn.disabled = false;
    if(testBtn) testBtn.disabled = true;
  }
}

// <<<--- NOVAS FUNÇÕES: Para ler URL e destacar --- >>>
function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const signalIdParam = urlParams.get('signalId');

  if (signalIdParam) {
    log(`Recebido signalId via URL: ${signalIdParam}`);
    const signalId = parseInt(signalIdParam, 10); // Converte para número (timestamp)

    if (!isNaN(signalId)) {
        // Espera um pouco para garantir que a tabela foi renderizada pelo renderHistory()
        setTimeout(() => {
          highlightSignalInHistory(signalId);
        }, 300); // 300ms deve ser suficiente
    } else {
        log('signalId inválido na URL.', 'err');
    }
  }
}

function highlightSignalInHistory(signalId) {
  log(`Tentando destacar sinal com ID (timestamp): ${signalId}`);
  const tbody = document.querySelector('#hist tbody'); // Usa document.querySelector para garantir
  if (!tbody) {
      log('Tabela de histórico não encontrada.', 'err');
      return;
  }

  const rows = tbody.querySelectorAll('tr');
  let found = false;
  rows.forEach(row => {
    // Remove destaque de outras linhas
    row.classList.remove('highlighted-signal');

    // Obtém o timestamp do atributo data-timestamp que adicionámos
    const rowTimestamp = parseInt(row.dataset.timestamp, 10);

    // Compara os timestamps
    if (!isNaN(rowTimestamp) && rowTimestamp === signalId) {
      log(`Sinal encontrado na tabela! Adicionando destaque à linha com timestamp ${rowTimestamp}.`);
      row.classList.add('highlighted-signal');
      // Rola a página para que a linha destacada fique visível (no centro)
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });

  if (!found) {
      log(`Sinal com ID ${signalId} não encontrado na tabela renderizada.`);
  }
}
// <<<--- FIM DAS NOVAS FUNÇÕES --- >>>


// --- Configuração dos Botões ---
// Adiciona verificações para garantir que os botões existem antes de adicionar listeners
const btnRegister = $('#btnRegister');
const btnTest = $('#btnTest');
if(btnRegister) btnRegister.onclick = registerPush;
if(btnTest) btnTest.onclick = testPush;
// Botões Start/Stop foram removidos do HTML

// --- Inicialização ---
renderHistory();
checkPermission();
handleUrlParameters(); // <<<--- CHAMA a função para verificar a URL
log('JS carregado');

// --- Fim do app.js ---
