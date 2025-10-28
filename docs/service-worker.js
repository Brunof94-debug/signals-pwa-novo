// --- Início do service-worker.js (v4 - Corrige abertura de URL) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v4'; // Incrementa versão do cache
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
        console.log('SW: Cache aberto v4');
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error("SW: Falha ao cachear durante install:", err))
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
        console.log('SW v4: Ativado e controlando clientes.');
        return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(fetchResponse => {
            return fetchResponse;
        }).catch(err => {
            console.warn(`SW: Falha no fetch para ${event.request.url}`, err);
        });
      })
  );
});

// Evento 'push' (Sem alterações)
self.addEventListener('push', event => {
  console.log('SW: Push Recebido.');
  let pushPayload = { title: 'Novo Sinal!', body: 'Verifique o app.', data: null};
  if (event.data) {
    try { pushPayload = event.data.json(); console.log("SW: Payload do Push:", pushPayload); } // Log payload
    catch (e) { console.error('SW: Erro ao ler JSON do push', e); pushPayload.body = event.data.text(); }
  } else { console.log("SW: Push recebido sem payload."); }
  const title = pushPayload.title;
  const options = { body: pushPayload.body, data: pushPayload.data }; // Guarda 'data' aqui
  console.log("SW: Mostrando notificação com options:", options);
  event.waitUntil( self.registration.showNotification(title, options) );
});

// Evento 'notificationclick' MODIFICADO (v4)
self.addEventListener('notificationclick', event => {
  console.log('SW: Notificação clicada.');
  event.notification.close();

  const signalData = event.notification.data;
  let urlToOpen = './'; // URL Padrão

  // Constrói URL com parâmetros se houver dados
  if (signalData && signalData.signalId) {
     console.log("SW: Dados encontrados na notificação:", signalData); // Log dados
     const params = new URLSearchParams();
     // Adiciona apenas parâmetros que existem e não são nulos/undefined
     for (const key in signalData) {
         if (signalData[key] !== null && signalData[key] !== undefined) {
            params.set(key, signalData[key]);
         }
     }
     if (params.toString()) { // Verifica se há algum parâmetro
        urlToOpen = `./?${params.toString()}`;
     }
     console.log('SW: URL construída:', urlToOpen);
  } else {
     console.log('SW: Nenhum dado válido (signalId) encontrado na notificação.');
  }

  // Tenta abrir uma nova janela/separador com a URL construída
  // Isto é mais fiável para garantir que os parâmetros são lidos na carga
  event.waitUntil(
    clients.openWindow(urlToOpen)
     .then(windowClient => {
         if (windowClient) {
             console.log('SW: Janela aberta/focada com sucesso.');
             return windowClient.focus(); // Tenta focar na janela (se já existia)
         } else {
             console.log('SW: Não foi possível abrir/focar a janela.');
         }
      })
     .catch(err => {
         console.error("SW: Erro ao abrir janela:", err);
     })
  );
});

// --- Fim do service-worker.js ---
