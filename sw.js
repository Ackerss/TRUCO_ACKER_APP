// Service Worker para funcionalidade offline do Marcador de Truco Acker Pro

// Nome do cache (versão incrementada para forçar atualização quando houver mudanças nos arquivos cacheados)
const CACHE_NAME = 'truco-acker-cache-v2.0'; // ATUALIZE A VERSÃO SE ARQUIVOS MUDARAM

// Lista de arquivos essenciais para cachear na instalação
const urlsToCache = [
  '.', // Atalho para index.html na raiz
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  // 'sw.js', // O próprio service worker não precisa ser explicitamente cacheado por ele mesmo desta forma.
  'icon-192.png', // Ícone principal para PWA
  'icon-512.png'  // Ícone maior para PWA
];

// Evento 'install': Chamado quando o Service Worker é instalado.
self.addEventListener('install', event => {
  console.log('[SW] Evento Install:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto. Cacheando arquivos essenciais...');
        // Usar { cache: "reload" } para garantir que estamos pegando os arquivos mais recentes da rede durante a instalação do SW.
        // Isso é importante para que, ao atualizar o SW, ele pegue as versões mais novas dos assets.
        const cachePromises = urlsToCache.map(urlToCache => {
            return fetch(urlToCache, { cache: "reload" }) 
                .then(response => {
                     if (!response.ok) {
                        // Se um arquivo essencial falhar, a instalação pode falhar, o que é bom para evitar um SW quebrado.
                        console.error(`[SW] Falha ao buscar ${urlToCache} para cache: ${response.status} ${response.statusText}`);
                        // Lançar um erro aqui fará com que a promessa de instalação seja rejeitada.
                        throw new Error(`Falha ao cachear ${urlToCache}`);
                     }
                     return cache.put(urlToCache, response);
                })
                .catch(err => {
                    console.error(`[SW] Erro de rede ou ao colocar no cache ${urlToCache}:`, err);
                    throw err; // Propaga o erro para falhar a instalação se um asset essencial não puder ser cacheado.
                });
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
          console.log("[SW] Recursos essenciais cacheados com sucesso.");
          // Força o novo Service Worker a se tornar ativo imediatamente.
          return self.skipWaiting();
      })
      .catch(error => {
          // Se qualquer parte do cacheamento falhar, loga o erro.
          // O SW não será instalado corretamente, o que é preferível a um SW parcialmente funcional.
          console.error("[SW] Falha na instalação do Service Worker:", error);
      })
  );
});

// Evento 'fetch': Intercepta todas as requisições de rede da página.
self.addEventListener('fetch', event => {
  // Apenas para requisições GET. Outros métodos (POST, PUT, etc.) não são cacheados.
  if (event.request.method !== 'GET') return;

  // Estratégia: Cache first, then network.
  // Tenta responder com o recurso do cache. Se não estiver no cache, busca na rede.
  // Se buscar na rede, armazena a resposta no cache para futuras requisições.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // console.log('[SW] Retornando do cache:', event.request.url);
          return cachedResponse; // Encontrado no cache, retorna a resposta cacheada.
        }

        // Não está no cache, então busca na rede.
        // console.log('[SW] Buscando na rede:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Verifica se a resposta da rede é válida.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              // Se não for válida (ex: erro 404, ou resposta opaca de CDN de terceiros que não queremos cachear),
              // apenas retorna a resposta da rede sem cachear.
              return networkResponse;
            }

            // É importante clonar a resposta.
            // Uma resposta é um stream e só pode ser consumida uma vez.
            // Precisamos de uma cópia para o navegador usar e outra para colocar no cache.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log('[SW] Cacheando novo recurso:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse; // Retorna a resposta original da rede para a página.
          }
        ).catch(error => {
            // Ocorre se a busca na rede falhar (ex: offline).
            console.warn('[SW] Erro de fetch (Provavelmente offline):', event.request.url, error);
            // Opcional: Retornar uma página offline padrão aqui, se desejar.
            // Ex: return caches.match('/offline.html');
            // Por enquanto, apenas deixamos o navegador lidar com o erro de rede.
        });
      })
  );
});

// Evento 'activate': Chamado quando o Service Worker é ativado.
// É um bom momento para limpar caches antigos de versões anteriores do SW.
self.addEventListener('activate', event => {
  console.log('[SW] Evento Activate:', CACHE_NAME);
  // Lista de caches que queremos manter. Normalmente, apenas o cache atual.
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Se o nome do cache não estiver na whitelist, ele é um cache antigo e deve ser deletado.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('[SW] Caches antigos limpos.');
        // Garante que o Service Worker ativado controle a página imediatamente,
        // em vez de esperar pelo próximo carregamento.
        return self.clients.claim();
    })
  );
});
