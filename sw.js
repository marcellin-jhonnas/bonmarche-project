// =========================================================================
// SAFERUN MARKET - SERVICE WORKER ANTI-CRASH & COMPATIBLE MOBILE (tel:)
// =========================================================================

const CACHE_NAME = 'saferun-v1';

// On ne met en cache que les deux fichiers vitaux pour éviter tout risque de 404
const assets = [
  'index.html',
  'manifest.json'
];

// 1. Installation : boucle tolérante qui n'échoue jamais
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SafeRun SW] Mise en cache des ressources vitales...');
      return Promise.all(
        assets.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[SafeRun SW] Fichier ignoré pour éviter le blocage : ${url}`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation : nettoyage propre des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SafeRun SW] Suppression de l\'ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Stratégie réseau : laisse passer les protocoles d'appel (tel:) sans interception
self.addEventListener('fetch', e => {
  // SÉCURITÉ CRITIQUE : Si la requête n'est pas HTTP/HTTPS (comme un lien d'appel "tel:"), on l'ignore immédiatement
  if (!e.request.url.startsWith('http')) {
    return;
  }

  // Ignore également les requêtes vers des domaines externes (MVola, cdnjs, etc.) pour éviter les conflits
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Stratégie : Réseau en priorité, Cache en secours si le client est hors-ligne
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas de panne réseau complète, on cherche dans le cache local
        return caches.match(e.request);
      })
  );
});