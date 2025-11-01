// --- Início do app.js (v6 - COM AUTENTICAÇÃO GOOGLE) ---

// <<<--- ID de Cliente Google INSERIDO --->>>
const GOOGLE_CLIENT_ID = "325904367225-llpfcqvmrpti13roj7ppo3a7ivgr8akh.apps.googleusercontent.com";

const API_BASE = 'https://signals-push.brunoprof07.workers.dev';
// <<<--- Chave Pública VAPID (a última que gerámos e funcionou com o JWK) --->>>
const VAPID_PUBLIC_KEY = 'BBwW7vLsh8_shutN881ggeqNmjIdhDUtFxTJMkCXtdaQMMNtmSRuwUN6M9sGCMN2mbj7UtVqmJAwrOgdSXzPfcI';

let swRegistration = null;
let currentUserId = null; // Guarda o ID do utilizador logado
let googleJwt = null; // Guarda o token JWT do Google

const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); if(d){ d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>':'') + '\n'; d.scrollTop = d.scrollHeight;} else { console.log(m); } };

// --- FUNÇÕES DE AUTENTICAÇÃO (NOVAS) ---
window.onload = function() {
  log('Carregando Google Sign-In...');
  try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse, // Função chamada após login
        auto_select: true
      });
      google.accounts.id.renderButton(
        document.getElementById("g_id_signin"),
        { theme: "outline", size: "large" }
      );
      // Opcional: Tenta login automático silencioso
      // google.accounts.id.prompt(); 
  } catch (e) {
      console.error("Erro ao inicializar Google Sign-In:", e);
      log("Erro ao carregar Google Sign-In. Verifique a consola.", "err");
  }
};

function handleCredentialResponse(response) {
  log('Login com Google bem-sucedido.', 'ok');
  googleJwt = response.credential; // O token JWT
  
  // Decodifica o JWT para obter o user_id (sem bibliotecas externas)
  try {
    const payload = JSON.parse(atob(googleJwt.split('.')[1]));
    currentUserId = payload.sub; // 'sub' (subject) é o ID único do Google
    log(`Utilizador ID: ${currentUserId.substring(0, 10)}...`, 'ok');
    updateUIAfterLogin(payload.email); // Atualiza a UI
    checkPermissionAndRegister(); // Verifica permissões de push
  } catch (e) {
      console.error("Erro ao decodificar JWT:", e);
      log("Erro ao processar login.", "err");
  }
}

function updateUIAfterLogin(email) {
    if ($('#g_id_signin')) $('#g_id_signin').style.display = 'none';
    if ($('#auth-status')) $('#auth-status').style.display = 'flex';
    if ($('#user-email')) $('#user-email').innerText = `Logado como: ${email}`;
    if ($('#btn-logout')) {
        $('#btn-logout').style.display = 'block';
        $('#btn-logout').onclick = handleLogout;
    }
}

function handleLogout() {
    google.accounts.id.disableAutoSelect();
    currentUserId = null;
    googleJwt = null;
    log('Logout efetuado.');
    // Reseta UI
    if ($('#g_id_signin')) $('#g_id_signin').style.display = 'block';
    if ($('#auth-status')) $('#auth-status').style.display = 'none';
    if ($('#btnRegister')) $('#btnRegister').disabled = true;
    if ($('#btnTest')) $('#btnTest').disabled = true;
    log('Aguardando login...');
}

// --- FUNÇÕES DE HISTÓRICO (v5 - Sem alterações) ---
function pushHistory(row) {
  const key = 'signals_history';
  if (!row || !row.signalId) { console.error("pushHistory: Linha inválida, falta signalId.", row); return false; }
  row.ts = row.signalId;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  if (arr.some(existing => existing.ts === row.ts)) { log(`Sinal ${row.ts} já existe no local.`); return false; }
  arr.unshift(row);
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
  log(`Sinal ${row.ts} adicionado ao local.`);
  renderHistory(row.ts);
  return true;
}
function renderHistory(signalIdToHighlight = null) {
  console.log("renderHistory. Highlight:", signalIdToHighlight);
  const key = 'signals_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  const tbody = $('#hist tbody');
  if (!tbody) { console.error("renderHistory: Tabela tbody não encontrada!"); return; }
  tbody.innerHTML = arr.map(r => `
    <tr data-timestamp="${r.ts || r.signalId}">
      <td>${new Date(r.ts || r.signalId).toLocaleString()}</td>
      <td>${r.symbol || '?'}</td>
      <td>${r.strategy || '?'}</td>
      <td>${r.side || '?'}</td>
      <td>${(r.price || 0).toFixed(2)}</td>
      <td class="${(r.pnl ?? 0) >= 0 ? 'ok' : 'err'}">${(r.pnl ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');
  log(`Histórico renderizado com ${arr.length} entradas.`);
  if (signalIdToHighlight !== null) {
      setTimeout(() => { highlightSignalInHistory(signalIdToHighlight); }, 50);
  }
}
function highlightSignalInHistory(signalId) {
  if (isNaN(signalId)) return;
  log(`--- highlight: Procurando por ${signalId} ---`);
  const tbody = document.querySelector('#hist tbody');
  if (!tbody) { log('highlight: Tabela tbody não encontrada.', 'err'); return; }
  const rows = tbody.querySelectorAll('tr');
  log(`highlight: Encontradas ${rows.length} linhas.`);
  let found = false;
  rows.forEach(row => {
    row.classList.remove('highlighted-signal');
    const rowTimestamp = parseInt(row.dataset.timestamp, 10);
    console.log(`highlight: Comparando linha TS ${rowTimestamp} com signalId ${signalId}`);
    if (!isNaN(rowTimestamp) && rowTimestamp === signalId) {
      log(`highlight: SINAL ENCONTRADO! Destacando ${rowTimestamp}.`);
      row.classList.add('highlighted-signal');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });
  if (!found) { log(`highlight: Sinal ${signalId} NÃO encontrado na tabela.`, 'warn'); }
}


// --- Funções PUSH (MODIFICADAS para enviar userId) ---

async function sendPush(title, body) {
  if (!currentUserId) { log('Faça login para enviar um teste.', 'err'); return; }
  log('Enviando push de teste para o servidor...');
  try {
    const r = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          title: title, 
          body: body, 
          userId: currentUserId // <<< Envia o userId no Teste
      }) 
    });
    if (!r.ok) { const errorText = await r.text(); throw new Error(`send ${r.status} - ${errorText}`); }
    log(`Push OK: ${title}`, 'ok');
  } catch (e) {
    log('Push falhou: ' + e.message, 'err');
  }
}
async function testPush() { await sendPush('Teste Signals AI', 'Notificação de teste do App.'); }

async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { log('Push não suportado.', 'err'); return; }
  if (!currentUserId) { log('Precisa fazer login antes de registar o push.', 'err'); return; }
  
  try {
    log('Registrando SW...');
    const swReg = await navigator.serviceWorker.register('service-worker.js');
    swRegistration = swReg; log('SW registrado.', 'ok');
    log('Pedindo permissão...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { log('Permissão negada.', 'err'); return; }
    log('Permissão concedida.', 'ok');
    log('Obtendo inscrição...');
    const subscription = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
    log('Inscrição obtida.', 'ok');
    log('Enviando para servidor...');
    
    // <<<--- MODIFICAÇÃO: Envia o userId E a subscrição --->>>
    const response = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUserId,
            subscription: subscription
        }),
        headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) { const errorText = await response.text(); throw new Error(`subscribe ${response.status} - ${errorText}`); }
    log('Registro OK! Salvo no backend.', 'ok');
    if ($('#btnRegister')) $('#btnRegister').disabled = true;
    if ($('#btnTest')) $('#btnTest').disabled = false;
  } catch (e) { log('Registro falhou: ' + e.message, 'err'); }
}

// --- Funções Auxiliares e Inicialização ---
function urlB64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }

// Modificado para ser chamado APÓS o login
function checkPermissionAndRegister() {
  const registerBtn = $('#btnRegister');
  const testBtn = $('#btnTest');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = true; log('Push não suportado.', 'err'); return; }
  navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(subscription => {
          if (subscription) {
              log('Permissão OK e subscrição ativa.');
              if(registerBtn) registerBtn.disabled = true;
              if(testBtn) testBtn.disabled = false;
              // Idealmente: Re-enviar a subscrição com o userId para o backend
              // para garantir que está associada
              reregisterSubscription(subscription);
          } else {
              if (Notification.permission === 'granted') {
                log('Permissão OK. Clique "Ativar Notificações" para ligar.');
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

// Função para garantir que o backend tem a nossa subscrição
async function reregisterSubscription(subscription) {
    if (!currentUserId) return; // Precisa de userId
    log("Verificando associação da subscrição no backend...");
     const response = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUserId,
            subscription: subscription
        }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) { log("Subscrição confirmada no backend.", "ok"); }
    else { log("Falha ao re-confirmar subscrição.", "err"); }
}

function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const signalIdParam = urlParams.get('signalId');
  if (signalIdParam) {
    log(`Recebido signalId ${signalIdParam} via URL.`);
    const signalId = parseInt(signalIdParam, 10);
    if (!isNaN(signalId)) {
        const signalFromUrl = {
            signalId: signalId,
            side: urlParams.get('side'),
            price: parseFloat(urlParams.get('price')),
            symbol: urlParams.get('symbol'),
            strategy: urlParams.get('strategy'),
            rsi: urlParams.get('rsi'),
            pnl: 0
        };
        if (signalFromUrl.side && !isNaN(signalFromUrl.price)) {
            log('Dados do sinal recebidos da URL:', JSON.stringify(signalFromUrl));
            pushHistory(signalFromUrl);
        } else {
             log('Dados do sinal incompletos na URL.', 'warn');
             highlightSignalInHistory(signalId);
        }
    } else { log('signalId inválido na URL.', 'err'); }
  } else { log('Nenhum signalId encontrado na URL.'); }
}


// --- Configuração dos Botões ---
const btnRegister = $('#btnRegister');
const btnTest = $('#btnTest');
if(btnRegister) btnRegister.onclick = registerPush;
if(btnTest) btnTest.onclick = testPush;

// --- Inicialização ---
renderHistory();
// checkPermission(); // <<-- Comentado, agora é chamado após o login
handleUrlParameters();
// log('JS carregado'); // Movido para o callback do Google

// --- Fim do app.js ---
