// --- Início do app.js (v5 - Melhor timing e logs para destaque) ---

const API_BASE = 'https://signals-push.brunoprof07.workers.dev';
const VAPID_PUBLIC_KEY = 'BBwW7vLsh8_shutN881ggeqNmjIdhDUtFxTJMkCXtdaQMMNtmSRuwUN6M9sGCMN2mbj7UtVqmJAwrOgdSXzPfcI'; // <<< NOVA Chave Pública

let swRegistration = null;
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); if(d){ d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>':'') + '\n'; d.scrollTop = d.scrollHeight;} else { console.log(m); } };

// --- Funções de Histórico ---
function pushHistory(row) {
  const key = 'signals_history';
  if (!row || !row.signalId) { console.error("pushHistory: Linha inválida, falta signalId.", row); return false; }
  row.ts = row.signalId; // Garante 'ts'

  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  if (arr.some(existing => existing.ts === row.ts)) {
      log(`Sinal ${row.ts} já existe no histórico local.`);
      return false; // Sinal já existe
  }

  arr.unshift(row);
  localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
  log(`Sinal ${row.ts} adicionado ao histórico local.`);
  return true; // Sinal foi adicionado
}

function renderHistory(signalIdToHighlight = null) { // Aceita ID para destacar
  console.log("renderHistory chamado. signalIdToHighlight:", signalIdToHighlight); // Log extra
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

  // <<<--- MODIFICAÇÃO: Chama o destaque DEPOIS de renderizar --->>>
  if (signalIdToHighlight !== null) {
      // Usa setTimeout para garantir que o DOM atualizou antes de tentar destacar
      setTimeout(() => {
          highlightSignalInHistory(signalIdToHighlight);
      }, 50); // Pequeno delay
  }
}

// --- Funções PUSH ---
async function sendPush(title, body) { /* ... */ }
async function registerPush() { /* ... */ }
async function testPush() { /* ... */ }
// (Cole as funções PUSH completas da v4 aqui - sem alterações nelas)
async function sendPush(title, body) { try { const r = await fetch(`${API_BASE}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) }); if (!r.ok) { const errorText = await r.text(); throw new Error(`send ${r.status} - ${errorText}`); } log(`Push OK: ${title}`, 'ok'); } catch (e) { log('Push falhou: ' + e.message, 'err'); } }
async function registerPush() { if (!('serviceWorker' in navigator) || !('PushManager' in window)) { log('Push não suportado.', 'err'); return; } try { log('Registrando SW...'); const swReg = await navigator.serviceWorker.register('service-worker.js'); swRegistration = swReg; log('SW registrado.', 'ok'); log('Pedindo permissão...'); const permission = await Notification.requestPermission(); if (permission !== 'granted') { log('Permissão negada.', 'err'); return; } log('Permissão concedida.', 'ok'); log('Obtendo inscrição...'); const subscription = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) }); log('Inscrição obtida.', 'ok'); log('Enviando para servidor...'); const response = await fetch(`${API_BASE}/subscribe`, { method: 'POST', body: JSON.stringify(subscription), headers: { 'Content-Type': 'application/json' } }); if (!response.ok) { const errorText = await response.text(); throw new Error(`subscribe ${response.status} - ${errorText}`); } log('Registro OK! Salvo no backend.', 'ok'); if ($('#btnRegister')) $('#btnRegister').disabled = true; if ($('#btnTest')) $('#btnTest').disabled = false; } catch (e) { log('Registro falhou: ' + e.message, 'err'); } }
async function testPush() { await sendPush('Teste Signals AI', 'Notificação de teste do App.'); }


// --- Funções Auxiliares e Inicialização ---

function urlB64ToUint8Array(base64String) { /* ... */ }
// (Cole a função urlB64ToUint8Array completa da v4 aqui)
function urlB64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }

function checkPermission() { /* ... */ }
// (Cole a função checkPermission completa da v4 aqui)
function checkPermission() { const registerBtn = $('#btnRegister'); const testBtn = $('#btnTest'); if (!('serviceWorker' in navigator) || !('PushManager' in window)) { if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = true; log('Push não suportado.', 'err'); return; } navigator.serviceWorker.ready.then(reg => { reg.pushManager.getSubscription().then(subscription => { if (subscription) { log('Permissão OK e subscrição ativa.'); if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = false; } else { if (Notification.permission === 'granted') { log('Permissão OK, mas precisa registrar.'); if(registerBtn) registerBtn.disabled = false; if(testBtn) testBtn.disabled = true; } else if (Notification.permission === 'denied') { log('Permissão bloqueada.', 'err'); if(registerBtn) registerBtn.disabled = true; if(testBtn) testBtn.disabled = true; } else { log('Aguardando permissão...'); if(registerBtn) registerBtn.disabled = false; if(testBtn) testBtn.disabled = true; } } }); }); }


// <<<--- FUNÇÃO handleUrlParameters MODIFICADA (v5) --->>>
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
            // Tenta adicionar ao histórico. Retorna true se foi adicionado, false se já existia.
            const added = pushHistory(signalFromUrl);
            if (added) {
                // Se foi adicionado, renderHistory foi chamado, que chamará highlight com delay
                log("Sinal adicionado, renderHistory chamado para destacar.");
            } else {
                // Se já existia, renderHistory não foi chamado, então chamamos highlight diretamente
                log("Sinal já existia, chamando highlight diretamente.");
                highlightSignalInHistory(signalId);
            }
        } else {
             log('Dados do sinal incompletos na URL.', 'warn');
             highlightSignalInHistory(signalId); // Tenta destacar mesmo assim
        }
        // Limpa a URL após processar
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
  if (isNaN(signalId)) return;
  log(`--- highlightSignalInHistory: Procurando por ${signalId} ---`); // Log início
  const tbody = document.querySelector('#hist tbody');
  if (!tbody) { log('highlight: Tabela tbody não encontrada.', 'err'); return; }

  const rows = tbody.querySelectorAll('tr');
  log(`highlight: Encontradas ${rows.length} linhas na tabela.`); // Log contagem
  let found = false;
  rows.forEach(row => {
    row.classList.remove('highlighted-signal');
    const rowTimestamp = parseInt(row.dataset.timestamp, 10);
    // Log detalhado da comparação
    console.log(`highlight: Comparando linha TS ${rowTimestamp} com signalId ${signalId}`);

    if (!isNaN(rowTimestamp) && rowTimestamp === signalId) {
      log(`highlight: SINAL ENCONTRADO! Destacando linha ${rowTimestamp}.`); // Log sucesso
      row.classList.add('highlighted-signal');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    }
  });

  if (!found) { log(`highlight: Sinal com ID ${signalId} NÃO encontrado na tabela.`, 'warn'); } // Log falha
}

// --- Configuração dos Botões ---
const btnRegister = $('#btnRegister');
const btnTest = $('#btnTest');
if(btnRegister) btnRegister.onclick = registerPush;
if(btnTest) btnTest.onclick = testPush;

// --- Inicialização ---
renderHistory(); // Renderiza o histórico inicial (sem parâmetro de destaque)
checkPermission();
handleUrlParameters(); // Processa a URL após a renderização inicial
log('JS carregado');

// --- Fim do app.js ---
