// --- Início do service-worker.js (v2 - Com dados e URL) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v2';
const urlsToCache = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest'
  // Adicione ícones se os tiver e quiser cacheá-los
];

// Evento 'install' (Sem alterações significativas, talvez skipWaiting)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Força ativação mais rápida
  );
});

// Evento 'activate' (Sem alterações)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Limpando cache antigo');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Evento 'fetch' (Sem alterações)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      }
    )
  );
});


// Evento 'push' MODIFICADO
self.addEventListener('push', event => {
  console.log('Service Worker: Push Recebido.');

  // Tenta ler os dados completos: { title, body, data: { signalId, ... } }
  let pushPayload = { title: 'Novo Sinal!', body: 'Verifique o app.', data: null};
  if (event.data) {
    try {
      pushPayload = event.data.json();
    } catch (e) {
      console.error('Service Worker: Erro ao ler dados do push', e);
      // Tenta ler como texto simples se JSON falhar
      pushPayload.body = event.data.text();
    }
  }

  const title = pushPayload.title;
  const options = {
    body: pushPayload.body,
    // icon: 'icon-192x192.png', // Adicione se tiver
    // badge: 'icon-96x96.png', // Adicione se tiver
    data: pushPayload.data // <<< GUARDA os detalhes do sinal na notificação
  };

  // Mostra a notificação
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento 'notificationclick' MODIFICADO
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notificação clicada.');
  event.notification.close(); // Fecha a notificação

  const signalData = event.notification.data; // <<< OBTÉM os detalhes do sinal
  let urlToOpen = './'; // URL Padrão

  // Se tivermos um ID (timestamp), adiciona-o à URL
  if (signalData && signalData.signalId) {
     urlToOpen = `./?signalId=${signalData.signalId}`;
     console.log('Abrindo URL com signalId:', urlToOpen);
  } else {
     console.log('Nenhum signalId encontrado, abrindo URL padrão.');
  }

  // Tenta focar numa janela existente ou abre uma nova
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Procura por uma janela já aberta do nosso app
      for (const client of clientList) {
        // Verifica se a URL base é a mesma e se podemos navegar
        // A comparação de URL pode precisar de ajustes dependendo do host
        if (client.url.startsWith(self.location.origin) && 'navigate' in client) {
          client.navigate(urlToOpen); // Navega na janela existente
          return client.focus(); // Foca nela
        }
      }
      // Se nenhuma janela foi encontrada ou focada, abre uma nova
      return clients.openWindow(urlToOpen);
    })
  );
});

// --- Fim do service-worker.js ---
