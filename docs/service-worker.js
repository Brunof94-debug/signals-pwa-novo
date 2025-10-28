// --- Início do service-worker.js (v3 - Passa dados completos na URL) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v3'; // Incrementa versão do cache
const urlsToCache = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cache aberto');
        // Usar addAll com { cache: 'reload' } para garantir que busca da rede na instalação
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error("SW: Falha ao cachear durante install:", err)) // Log de erro no cache
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        console.log('SW: Ativado e controlando clientes.');
        return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Estratégia Cache-First (com fallback para rede)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache OU busca na rede
        return response || fetch(event.request).then(fetchResponse => {
            // Opcional: Cachear novas requisições (cuidado com recursos dinâmicos)
            // if (fetchResponse.ok) {
            //   // Abre o cache e clona a resposta para guardar
            // }
            return fetchResponse;
        }).catch(err => {
            // Se falhar (offline?), poderia retornar uma página offline padrão
            console.warn(`SW: Falha no fetch para ${event.request.url}`, err);
            // return caches.match('/offline.html'); // Se tivesse uma página offline
        });
      })
  );
});


// Evento 'push' (Sem alterações, já recebe 'data')
self.addEventListener('push', event => {
  console.log('SW: Push Recebido.');
  let pushPayload = { title: 'Novo Sinal!', body: 'Verifique o app.', data: null};
  if (event.data) {
    try { pushPayload = event.data.json(); } catch (e) { console.error('SW: Erro ao ler JSON do push', e); pushPayload.body = event.data.text(); }
  }
  const title = pushPayload.title;
  const options = { body: pushPayload.body, data: pushPayload.data };
  event.waitUntil( self.registration.showNotification(title, options) );
});

// Evento 'notificationclick' MODIFICADO (v3)
self.addEventListener('notificationclick', event => {
  console.log('SW: Notificação clicada.');
  event.notification.close();

  const signalData = event.notification.data;
  let urlToOpen = './'; // URL Padrão

  // <<<--- MODIFICAÇÃO: Constrói URL com todos os parâmetros --->>>
  if (signalData && signalData.signalId) {
     const params = new URLSearchParams();
     params.set('signalId', signalData.signalId);
     if(signalData.side) params.set('side', signalData.side);
     if(signalData.price) params.set('price', signalData.price);
     if(signalData.symbol) params.set('symbol', signalData.symbol);
     if(signalData.strategy) params.set('strategy', signalData.strategy);
     if(signalData.rsi) params.set('rsi', signalData.rsi);
     urlToOpen = `./?${params.toString()}`; // Ex: /?signalId=123&side=SELL...
     console.log('SW: Abrindo URL com dados:', urlToOpen);
  } else {
     console.log('SW: Nenhum dado na notificação, abrindo URL padrão.');
  }
  // <<<--- FIM DA MODIFICAÇÃO --->>>

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        // Tenta encontrar uma janela na mesma origem
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'navigate' in client) {
          console.log('SW: Navegando cliente existente para:', urlToOpen);
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      console.log('SW: Abrindo nova janela para:', urlToOpen);
      return clients.openWindow(urlToOpen);
    })
  );
});

// --- Fim do service-worker.js ---
