// --- Início do service-worker.js (v5 - Logs Detalhados) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v5'; // Incrementa versão
const urlsToCache = [ './', 'index.html', 'app.js', 'manifest.webmanifest' ];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => { console.log('SW v5: Cache aberto'); const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' })); return cache.addAll(requests); })
      .then(() => self.skipWaiting())
      .catch(err => console.error("SW v5: Falha no cache install:", err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => { if (cache !== CACHE_NAME) { console.log('SW v5: Limpando cache antigo:', cache); return caches.delete(cache); } })
      );
    }).then(() => { console.log('SW v5: Ativado e controlando.'); return self.clients.claim(); })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => { return response || fetch(event.request).catch(err => console.warn(`SW v5: Falha no fetch ${event.request.url}`, err)); })
  );
});


// Evento 'push' COM LOG DETALHADO
self.addEventListener('push', event => {
  console.log('--- SW v5: Evento PUSH Recebido ---');
  let pushPayload = { title: '[Push sem Dados]', body: '', data: null};
  if (event.data) {
    try {
      const rawData = event.data.text(); // Lê como texto primeiro
      console.log("SW v5: Raw Push Data:", rawData);
      pushPayload = JSON.parse(rawData); // Tenta fazer parse
      console.log("SW v5: Parsed Push Payload:", pushPayload);
      if (!pushPayload.title) pushPayload.title = "[Push sem Título]";
      if (!pushPayload.body) pushPayload.body = "[Push sem Corpo]";
    } catch (e) {
      console.error('SW v5: Erro ao ler/parsear JSON do push', e);
      pushPayload.title = "Erro no Push";
      pushPayload.body = event.data.text();
      pushPayload.data = null;
    }
  } else { console.log("SW v5: Push recebido SEM payload."); }
  const title = pushPayload.title;
  const options = { body: pushPayload.body, data: pushPayload.data || null };
  console.log("SW v5: Mostrando notificação com options:", JSON.stringify(options));
  event.waitUntil( self.registration.showNotification(title, options) );
});

// Evento 'notificationclick' COM LOG DETALHADO
self.addEventListener('notificationclick', event => {
  console.log('--- SW v5: Evento NOTIFICATION CLICK ---');
  event.notification.close();
  const signalData = event.notification.data;
  console.log("SW v5: Dados lidos de event.notification.data:", signalData);
  let urlToOpen = './';
  if (signalData && typeof signalData === 'object' && signalData.signalId) {
     console.log("SW v5: signalData é um objeto válido com signalId.");
     const params = new URLSearchParams();
     for (const key in signalData) {
         if (Object.hasOwnProperty.call(signalData, key) && signalData[key] !== null && signalData[key] !== undefined) {
            params.set(key, signalData[key]);
         }
     }
     if (params.toString()) { urlToOpen = `./?${params.toString()}`; }
     else { console.log("SW v5: Nenhum parâmetro válido em signalData."); }
     console.log('SW v5: URL construída:', urlToOpen);
  } else {
     console.log('SW v5: Nenhum dado válido (signalData é nulo, não é objeto ou falta signalId).');
     console.log("SW v5: event.notification.data era:", JSON.stringify(signalData));
  }
  console.log(`SW v5: Tentando abrir/focar: ${urlToOpen}`);
  event.waitUntil(
    clients.openWindow(urlToOpen)
     .then(windowClient => {
         if (windowClient) { console.log('SW v5: clients.openWindow teve sucesso.'); return windowClient.focus().then(focusedClient => { console.log('SW v5: Foco tentado.'); }).catch(focusErr => { console.warn("SW v5: Falha ao focar:", focusErr.message); }); }
         else { console.error('SW v5: clients.openWindow retornou nulo.'); }
      })
     .catch(err => { console.error("SW v5: Erro CRÍTICO em clients.openWindow:", err); })
  );
});

// --- Fim do service-worker.js ---
