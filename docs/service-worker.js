// --- Início do service-worker.js (CORRIGIDO) ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v2'; // Mudei o nome para forçar a atualização
// Lista de arquivos que o app precisa para funcionar offline (o "App Shell")
const urlsToCache = [
  './', // <-- ESTA É A CORREÇÃO (era '/')
  'index.html',
  'app.js',
  'manifest.webmanifest'
];

// Evento 'install': Salva os arquivos essenciais no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Força o novo service worker a ativar
  );
});

// Evento 'activate': Limpa caches antigos
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
    }).then(() => self.clients.claim()) // Pega controle imediato da página
  );
});

// Evento 'fetch': Tenta pegar do cache primeiro, antes de ir para a rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se tiver no cache, retorna do cache
        if (response) {
          return response;
        }
        // Se não, vai para a rede
        return fetch(event.request);
      }
    )
  );
});

// --- A PARTE MAIS IMPORTANTE ---
// Evento 'push': O que fazer quando uma notificação chega do servidor

self.addEventListener('push', event => {
  console.log('Service Worker: Push Recebido.');

  // Tenta ler os dados da notificação (o { title, body } que enviamos)
  let data = { title: 'Novo Sinal!', body: 'Verifique o app.'};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Service Worker: Erro ao ler dados do push', e);
    }
  }

  const title = data.title;
  const options = {
    body: data.body,
    // Ícones são opcionais, mas bons de ter. Você precisaria criar
    // e subir esses arquivos para a pasta 'docs' e adicionar na lista 'urlsToCache'.
    // icon: 'icon-192x192.png', 
    // badge: 'icon-96x96.png'
  };

  // Mostra a notificação
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento 'notificationclick': O que fazer quando o usuário clica na notificação
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notificação clicada.');
  event.notification.close(); // Fecha a notificação

  // Abre o seu app (ou foca na aba, se já estiver aberta)
  event.waitUntil(
    clients.openWindow('./') // Abre a página principal do seu site
  );
});

// --- Fim do service-worker.js ---
