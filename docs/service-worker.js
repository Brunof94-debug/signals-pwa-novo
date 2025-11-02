// --- Início do service-worker.js (v5 - Logs Detalhados) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v5'; // Versão v5
const urlsToCache = [
  './',
  'index.html',
  'app.js?v=6', // Corresponde à versão no index.html
  'manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW v5: Cache aberto');
        // Usa cache: 'reload' para garantir que busca da rede na instalação
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => {
        console.log('SW v5: Cache adicionado, ativando (skipWaiting)...');
        return self.skipWaiting(); // Força a ativação
      })
      .catch(err => console.error("SW v5: Falha no cache install:", err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('SW v5: Limpando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        console.log('SW v5: Ativado e controlando clientes.');
        return self.clients.claim(); // Pega controlo imediato
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignora pedidos que não são GET (ex: POST para /subscribe)
  if (event.request.method !== 'GET') {
      return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache OU busca na rede
        return response || fetch(event.request).catch(err => {
            console.warn(`SW v5: Falha no fetch (offline?): ${event.request.url}`, err);
            // Poderia retornar uma página offline aqui se tivéssemos uma
        });
      })
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
      
      // Validação Mínima
      if (!pushPayload.title) pushPayload.title = "[Push sem Título]";
      if (!pushPayload.body) pushPayload.body = "[Push sem Corpo]";
      // Garante que 'data' é o objeto interno, ou null
      pushPayload.data = pushPayload.data || null; 

    } catch (e) {
      console.error('SW v5: Erro ao ler/parsear JSON do push', e);
      pushPayload.title = "Erro no Push";
      pushPayload.body = event.data ? event.data.text() : "Payload inválido";
      pushPayload.data = null;
    }
  } else {
    console.log("SW v5: Push recebido SEM payload (event.data é nulo).");
  }

  const title = pushPayload.title;
  const options = {
      body: pushPayload.body,
      data: pushPayload.data // Guarda o objeto 'data' (que pode ser null)
    };

  console.log("SW v5: Mostrando notificação com options:", JSON.stringify(options));
  event.waitUntil( self.registration.showNotification(title, options) );
});

// Evento 'notificationclick' COM LOG DETALHADO
self.addEventListener('notificationclick', event => {
  console.log('--- SW v5: Evento NOTIFICATION CLICK ---');
  event.notification.close();

  // 1. OBTÉM OS DADOS DA NOTIFICAÇÃO
  const signalData = event.notification.data;
  console.log("SW v5: Dados lidos de event.notification.data:", signalData); // Log crucial

  let urlToOpen = './'; // URL Padrão

  // 2. CONSTRÓI A URL
  if (signalData && typeof signalData === 'object' && signalData.signalId) {
     console.log("SW v5: signalData é um objeto válido com signalId.");
     const params = new URLSearchParams();
     for (const key in signalData) {
         // Verifica se a propriedade pertence ao objeto e não é nula/undefined
         if (Object.hasOwnProperty.call(signalData, key) && signalData[key] !== null && signalData[key] !== undefined) {
            params.set(key, signalData[key]);
         }
     }
     
     if (params.toString()) {
        urlToOpen = `./?${params.toString()}`; // Ex: /?signalId=123&side=SELL...
     } else {
         console.log("SW v5: Nenhum parâmetro válido encontrado em signalData.");
     }
     console.log('SW v5: URL construída:', urlToOpen);
  } else {
     console.log('SW v5: Nenhum dado válido (signalData é nulo, não é objeto ou falta signalId) na notificação.');
     console.log("SW v5: event.notification.data era:", JSON.stringify(signalData));
  }

  // 3. ABRE A JANELA
  console.log(`SW v5: Tentando abrir/focar: ${urlToOpen}`);
  event.waitUntil(
    clients.openWindow(urlToOpen)
     .then(windowClient => {
         if (windowClient) {
             console.log('SW v5: clients.openWindow teve sucesso.');
             // Tentar focar pode não funcionar em todas as situações, mas tentamos
             return windowClient.focus().then(focusedClient => {
                 console.log('SW v5: Foco na janela tentado.');
             }).catch(focusErr => {
                 console.warn("SW v5: Não foi possível focar na janela (normal se for nova):", focusErr.message);
             });
         } else {
             console.error('SW v5: clients.openWindow retornou nulo (falhou?).');
         }
      })
     .catch(err => {
         console.error("SW v5: Erro CRÍTICO em clients.openWindow:", err);
     })
  );
});

// --- Fim do service-worker.js ---
