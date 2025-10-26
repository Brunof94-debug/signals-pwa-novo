// --- Início do app.js (LIMPO) ---

// URL do seu Worker
const API_BASE = 'https://signals-push.brunoprof07.workers.dev';

// Sua Chave VAPID Pública
const VAPID_PUBLIC_KEY = 'BEswMdtoguBxL-PQrAjrS2WBX3ViaoWqU6mE710ZLaoQOahYGATcL29n7SvlF-fRSWnE3MTMum1kzs7PiR5X0Mo';

let swRegistration = null; // Armazena o registro do Service Worker
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>' : '') + '\n'; d.scrollTop = d.scrollHeight; };

// --- Funções de Histórico (Não serão mais chamadas, mas deixamos aqui) ---
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
  tbody.innerHTML = arr.map(r => `
    <tr>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.symbol}</td>
      <td>${r.strategy}</td>
      <td>${r.side}</td>
      <td>${r.price.toFixed(2)}</td>
      <td class="${r.pnl >= 0 ? 'ok' : 'err'}">${(r.pnl ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');
}

// --- Função de Envio de Push (Usada pelo botão de Teste) ---
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

// --- Função Principal de Registro ---
async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    log('Push não suportado neste navegador.', 'err');
    return;
  }

  try {
    log('Registrando Service Worker...');
    const swReg = await navigator.serviceWorker.register('service-worker.js');
    swRegistration = swReg; 
    log('Service Worker registrado.', 'ok');

    log('Pedindo permissão de notificação...');
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      log('Permissão de notificação negada.', 'err');
      return;
    }
    log('Permissão concedida.', 'ok');

    log('Obtendo inscrição push...');
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    log('Inscrição obtida.', 'ok');

    log('Enviando inscrição para o servidor...');
    const response = await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('subscribe ' + response.status);
    }

    log('Registro de push OK! Inscrição salva no backend.', 'ok');
    $('#btnRegister').disabled = true; 
    $('#btnTest').disabled = false;    

  } catch (e) {
    log('Registro de push falhou: ' + e.message, 'err');
  }
}

async function testPush() {
  await sendPush('Teste Signals AI', 'Se você recebeu esta notificação, o push está ativo.');
}

// --- Funções Auxiliares e Inicialização ---

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function checkPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    $('#btnRegister').disabled = true;
    $('#btnTest').disabled = true;
    log('Push não suportado.', 'err');
    return;
  }
  
  if (Notification.permission === 'granted') {
    log('Permissão de notificação já concedida.');
    $('#btnRegister').disabled = true; 
    $('#btnTest').disabled = false;
    navigator.serviceWorker.register('service-worker.js').then(reg => swRegistration = reg);
  } else if (Notification.permission === 'denied') {
    log('Permissão de notificação bloqueada.', 'err');
    $('#btnRegister').disabled = true;
    $('#btnTest').disabled = true;
  } else {
    log('Pronto para registrar notificações.');
    $('#btnRegister').disabled = false;
    $('#btnTest').disabled = true; 
  }
}

// --- Configuração dos Botões (Apenas Register e Test) ---
$('#btnRegister').onclick = registerPush;
$('#btnTest').onclick = testPush;

// --- Inicialização ---
renderHistory(); 
checkPermission(); 
log('JS carregado');

// --- Fim do app.js (LIMPO) ---
