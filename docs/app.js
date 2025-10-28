// --- Início do app.js (v4 - Lê URL completa, adiciona ao histórico) ---

const API_BASE = 'https://signals-push.brunoprof07.workers.dev';
const VAPID_PUBLIC_KEY = 'BBwW7vLsh8_shutN881ggeqNmjIdhDUtFxTJMkCXtdaQMMNtmSRuwUN6M9sGCMN2mbj7UtVqmJAwrOgdSXzPfcI'; // <<< NOVA Chave Pública

let swRegistration = null;
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); if(d){ d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>' : '') + '\n'; d.scrollTop = d.scrollHeight;} else { console.log(m); } };

// --- Funções de Histórico ---
function pushHistory(row) {
  const key = 'signals_history';
  // Garante que row tem um timestamp válido
  if (!row || !row.signalId) {
      console.error("pushHistory: Tentou adicionar linha sem signalId (timestamp).", row);
      return;
  }
  row.ts = row.signalId; // Garante que a propriedade 'ts' existe para renderHistory

  const arr = JSON.parse(localStorage.getItem(key) || '[]');

  // Evita adicionar sinais duplicados (baseado no timestamp/signalId)
  if (arr.some(existing => existing.ts === row.ts)) {
      log(`Sinal ${row.ts} já existe no histórico local.`);
      return; // Não adiciona duplicado
  }

  arr.unshift(row); // Adiciona no início
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 200))); // Limita a 200 entradas
  log(`Sinal ${row.ts} adicionado ao histórico local.`);
  renderHistory(); // Re-renderiza a tabela
}

function renderHistory() {
  const key = 'signals_history';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  const tbody = $('#hist tbody');
  if (!tbody) return;
  tbody.innerHTML = arr.map(r => `
    // Usa r.ts (que agora é igual a signalId)
    <tr data-timestamp="${r.ts}">
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td>${r.symbol || '?'}</td>
      <td>${r.strategy || '?'}</td>
      <td>${r.side || '?'}</td>
      <td>${(r.price || 0).toFixed(2)}</td>
      <td class="${(r.pnl ?? 0) >= 0 ? 'ok' : 'err'}">${(r.pnl ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');
   // Chama o destaque DEPOIS que a tabela foi atualizada
   highlightSignalFromUrl();
}

// --- Funções PUSH ---
async function sendPush(title, body) { /* ... (Sem alterações) ... */ }
async function registerPush() { /* ... (Sem alterações) ... */ }
async function testPush() { /* ... (Sem alterações) ... */ }
async function sendPush(title, body) { try { const r = await fetch(`${API_BASE}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) }); if (!r.ok) { const errorText = await r.text(); throw new Error(`send ${r.status} - ${errorText}`); } log(`Push OK: ${title}`, 'ok'); } catch (e) { log('Push falhou: ' + e.message, 'err'); } }
async function registerPush() { if (!('serviceWorker' in navigator) || !('PushManager' in window)) { log('Push não suportado.', 'err'); return; } try { log('Registrando SW...'); const swReg = await navigator.serviceWorker.register('service-worker.js'); swRegistration = swReg; log('SW registrado.', 'ok'); log('Pedindo permissão...'); const permission = await Notification.requestPermission(); if (permission !== 'granted') { log('Permissão negada.', 'err'); return; } log('Permissão concedida.', 'ok'); log('Obtendo inscrição...'); const subscription = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) }); log('Inscrição obtida.', 'ok'); log('Enviando para servidor...'); const response = await fetch(`${API_BASE}/subscribe`, { method: 'POST', body: JSON.stringify(subscription), headers: { 'Content-Type': 'application/json' } }); if (!response.ok) { const errorText = await response.text(); throw new Error(`subscribe ${response.status} - ${errorText}`); } log('Registro OK! Salvo no backend.', 'ok'); if ($('#btnRegister')) $('#btnRegister').disabled = true; if ($('#btnTest')) $('#btnTest').disabled = false; } catch (e) { log('Registro falhou: ' + e.message, 'err'); } }
async function testPush() { await sendPush('Teste Signals AI', 'Notificação de teste do App.'); }


// --- Funções Auxiliares e Inicialização ---

function urlB64ToUint8Array(base64String) { /* ... (Sem alterações) ... */ }
function urlB64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }

function checkPermission() { /* ... (Sem alterações) ... */ }
function checkPermission() { const registerBtn = $('#btnRegister'); const testBtn = $('#btnTest'); if (!('serviceWorker' in navigator) || !('PushManager' in window)) { if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = true; log('Push não suportado.', 'err'); return; } navigator.serviceWorker.ready.then(reg => { reg.pushManager.getSubscription().then(subscription => { if (subscription) { log('Permissão OK e subscrição ativa.'); if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = false; } else { if (Notification.permission === 'granted') { log('Permissão OK, mas precisa registrar.'); if(registerBtn) registerBtn.disabled = false; if(testBtn) testBtn.disabled = true; } else if (Notification.permission === 'denied') { log('Permissão bloqueada.', 'err'); if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = true; } else { log('Aguardando permissão...'); if(registerBtn) registerBtn.disabled = false; if(testBtn) testBtn.disabled = true; } } }); }); }

// <<<--- FUNÇÃO handleUrlParameters MODIFICADA (v4) --->>>
function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const signalIdParam = urlParams.get('signalId');

  if (signalIdParam) {
    log(`Recebido signalId ${signalIdParam} via URL.`);
    const signalId = parseInt(signalIdParam, 10);

    if (!isNaN(signalId)) {
        // Tenta ler os outros parâmetros
        const signalFromUrl = {
            signalId: signalId, // Guarda o timestamp original
            side: urlParams.get('side'),
            price: parseFloat(urlParams.get('price')), // Converte para número
            symbol: urlParams.get('symbol'),
            strategy: urlParams.get('strategy'),
            rsi: urlParams.get('rsi'), // Vem como string
            pnl: 0 // Assume PNL 0 para novos sinais
        };

        // Verifica se temos dados mínimos
        if (signalFromUrl.side && !isNaN(signalFromUrl.price)) {
            log('Dados do sinal recebidos da URL:', signalFromUrl);
            // Adiciona este sinal ao histórico local (que também re-renderiza a tabela)
            pushHistory(signalFromUrl);
            // O destaque será chamado pelo renderHistory agora
        } else {
             log('Dados do sinal incompletos na URL.', 'warn');
             // Ainda tenta destacar caso o sinal já estivesse no localStorage por algum motivo
             highlightSignalInHistory(signalId);
        }

        // Limpa os parâmetros da URL para evitar reprocessamento no refresh (opcional)
        // window.history.replaceState({}, document.title, window.location.pathname);

    } else {
        log('signalId inválido na URL.', 'err');
    }
  } else {
      log('Nenhum signalId encontrado na URL.');
  }
}
// <<<--- FIM DA MODIFICAÇÃO --->>>

function highlightSignalInHistory(signalId) {
  // Esta função agora é chamada pelo renderHistory,
  // apenas destacamos a linha se o signalId for válido
  if (isNaN(signalId)) return;

  log(`Tentando destacar sinal com ID (timestamp): ${signalId}`);
  const tbody = document.querySelector('#hist tbody');
  if (!tbody) { log('Tabela de histórico não encontrada.', 'err'); return; }

  const rows = tbody.querySelectorAll('tr');
  let found = false;
  rows.forEach(row => {
    row.classList.remove('highlighted-signal'); // Limpa destaques antigos
    const rowTimestamp = parseInt(row.dataset.timestamp, 10);
    if (!isNaN(rowTimestamp) && rowTimestamp === signalId) {
      log(`Sinal encontrado! Destacando linha ${rowTimestamp}.`);
      row.classList.add('highlighted-signal');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });
  // Não mostra log se não encontrar, pois pode ser chamado antes do pushHistory terminar
  // if (!found) { log(`Sinal com ID ${signalId} não encontrado na tabela.`); }
}

// --- Configuração dos Botões ---
const btnRegister = $('#btnRegister');
const btnTest = $('#btnTest');
if(btnRegister) btnRegister.onclick = registerPush;
if(btnTest) btnTest.onclick = testPush;

// --- Inicialização ---
renderHistory(); // Renderiza o histórico do localStorage primeiro
checkPermission();
handleUrlParameters(); // Chama para processar a URL na carga inicial
log('JS carregado');

// --- Fim do app.js ---
