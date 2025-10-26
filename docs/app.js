// <-- CORREÇÃO FEITA: Esta é a sua URL do Cloudflare Worker
const API_BASE = 'https://signals-push.brunoprof07.workers.dev';

// <-- CORREÇÃO FEITA: Esta é a sua Chave Pública VAPID
const VAPID_PUBLIC_KEY = 'BEswMdtoguBxL-PQrAjrS2WBX3ViaoWqU6mE710ZLaoQOahYGATcL29n7SvlF-fRSWnE3MTMum1kzs7PiR5X0Mo';

const SYM = 'BTCUSDT'; // símbolo padrão
let loop = null;
let swRegistration = null; // Armazena o registro do Service Worker
const $ = s => document.querySelector(s);
const log = (m, cls = '') => { const d = $('#log'); d.innerHTML += (cls ? `<span class="${cls}">` : '') + m + (cls ? '</span>' : '') + '\n'; d.scrollTop = d.scrollHeight; };

// --- Funções de Análise (EMA, RSI, Klines) ---
// (Nenhuma mudança aqui, estão corretas)

function ema(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let emaArr = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaArr[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    emaArr[i] = v; prev = v;
  }
  return emaArr;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(ch, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-ch, 0)) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

async function getKlines(symbol, interval = '1m', limit = 120) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('binance ' + r.status);
  const data = await r.json();
  return data.map(x => ({
    openTime: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5], closeTime: x[6]
  }));
}

// --- Funções de Histórico (pushHistory, renderHistory) ---
// (Nenhuma mudança aqui)

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

// --- Funções de Lógica e PUSH ---

async function sendPush(title, body) {
  try {
    // <-- CORRIGIDO: Agora usa a nova URL base do Cloudflare
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

async function tick() {
  try {
    const strat = $('#strategy').value;
    const tf = strat === 'day' ? '1m' : '15m';
    const kl = await getKlines(SYM, tf, strat === 'day' ? 120 : 200);
    const closes = kl.map(k => k.close);
    const rsiVal = rsi(closes, 14);
    let fast, slow, side = null;

    if (strat === 'day') {
      fast = ema(closes, 9).at(-1);
      slow = ema(closes, 21).at(-1);
      if (fast && slow) {
        if (fast > slow && rsiVal && rsiVal > 45) side = 'BUY';
        if (fast < slow && rsiVal && rsiVal < 55) side = 'SELL';
      }
    } else {
      fast = ema(closes, 20).at(-1);
      slow = ema(closes, 50).at(-1);
      if (fast && slow) {
        if (fast > slow && rsiVal && rsiVal > 50) side = 'BUY';
        if (fast < slow && rsiVal && rsiVal < 50) side = 'SELL';
      }
    }

    if (side) {
      const last = closes.at(-1);
      pushHistory({ ts: Date.now(), symbol: SYM, strategy: strat, side, price: last, pnl: 0 });
      sendPush(`Sinal ${side} ${SYM}`, `${strat.toUpperCase()} @ ${last} | EMA/RSI ok`);
      log(`Sinal ${side} ${SYM} @ ${last} | RSI ${rsiVal?.toFixed(1)}`, 'ok');
    } else {
      log('Sem sinal neste tick.');
    }
  } catch (e) {
    log('Tick erro: ' + e.message, 'err');
  }
}

function start() {
  if (loop) return;
  log('Loop iniciado.');
  loop = setInterval(tick, 60 * 1000);
  tick();
}

function stop() {
  if (loop) { clearInterval(loop); loop = null; log('Loop parado.'); }
}

// <-- CORREÇÃO GERAL: Função de registro de Push reescrita
async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    log('Push não suportado neste navegador.', 'err');
    return;
  }

  try {
    log('Registrando Service Worker...');
    // 1. Registra o Service Worker (sw.js)
    // <-- CORREÇÃO AQUI: Mudei o nome do arquivo para bater com o seu
    const swReg = await navigator.serviceWorker.register('service-worker.js');
    swRegistration = swReg; // Salva o registro
    log('Service Worker registrado.', 'ok');

    // 2. Pede permissão de notificação
    log('Pedindo permissão de notificação...');
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      log('Permissão de notificação negada.', 'err');
      return;
    }

    log('Permissão concedida.', 'ok');

    // 3. Obtém a Inscrição (Subscription)
    log('Obtendo inscrição push...');
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) // Converte a chave VAPID
    });

    log('Inscrição obtida.', 'ok');

    // 4. Envia a inscrição para o seu backend (Cloudflare Worker)
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
    $('#btnRegister').disabled = true; // Desativa o botão
    $('#btnTest').disabled = false;    // Ativa o botão de teste

  } catch (e) {
    log('Registro de push falhou: ' + e.message, 'err');
  }
}

async function testPush() {
  await sendPush('Teste Signals AI', 'Se você recebeu esta notificação, o push está ativo.');
}

// --- Funções Auxiliares e Inicialização ---

// <-- NOVO: Função auxiliar para converter a chave VAPID
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

// <-- NOVO: Verifica o estado da permissão ao carregar o página
function checkPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    $('#btnRegister').disabled = true;
    $('#btnTest').disabled = true;
    log('Push não suportado.', 'err');
    return;
  }
  
  if (Notification.permission === 'granted') {
    log('Permissão de notificação já concedida.');
    $('#btnRegister').disabled = true; // Já registrado (idealmente)
    $('#btnTest').disabled = false;
    // Tenta registrar o SW silenciosamente
    navigator.serviceWorker.register('service-worker.js').then(reg => swRegistration = reg);
  } else if (Notification.permission === 'denied') {
    log('Permissão de notificação bloqueada.', 'err');
    $('#btnRegister').disabled = true;
    $('#btnTest').disabled = true;
  } else {
    log('Pronto para registrar notificações.');
    $('#btnRegister').disabled = false;
    $('#btnTest').disabled = true; // Só pode testar depois de registrar
  }
}

// --- Configuração dos Botões ---
$('#btnRegister').onclick = registerPush;
$('#btnTest').onclick = testPush;
$('#btnStart').onclick = start;
$('#btnStop').onclick = stop;

// --- Inicialização ---
renderHistory();
checkPermission(); // <-- NOVO: Verifica permissões
log('JS carregado');
