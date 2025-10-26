// --- Início do service-worker.js ---

const CACHE_NAME = 'signals-ai-v9.2-cache-v1';
// Lista de arquivos que o app precisa para funcionar offline (o "App Shell")
const urlsToCache = [
  '/',
  'index.html',
  'app.js',
  'manifest.webmanifest'
  // Adicione aqui o caminho para seus ícones, se tiver
];

// Evento 'install': Salva os arquivos essenciais no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': Tenta pegar do cache primeiro, antes de ir para a rede
// Isso faz o app carregar instantaneamente e funcionar offline
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
    icon: 'icon-192x192.png', // <-- Troque isso se o nome do seu ícone for outro
    badge: 'icon-96x96.png'  // <-- Troque isso se o nome do seu ícone for outro
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
    clients.openWindow('/') // Abre a página principal do seu site
  );
});

// --- Fim do service-worker.js ---
