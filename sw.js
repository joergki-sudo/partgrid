/* PartGrid Service Worker – macht die App offline nutzbar.
   WICHTIG: Diese Nummer muss immer mit  const VERSION  in index.html
   übereinstimmen. Wird sie nicht hochgezählt, bleibt die alte Fassung im Cache. */
const V = 'partgrid-v0.9.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* Seitenaufrufe IMMER aus dem Cache beantworten.
     Grund: Der Kurzbefehl übergibt Foto und erkannten Text als Adresse. Mit Bild wird die
     schnell länger als die rund 8000 Zeichen, die GitHub Pages annimmt – der Server würde
     mit „URI too long" ablehnen. Aus dem Cache bedient, verlässt die Adresse das Gerät nie.
     Die frische Fassung wird im Hintergrund nachgeladen und beim nächsten Aufruf benutzt. */
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(V).then(c =>
        c.match('./index.html').then(cached => {
          const netz = fetch('./index.html')
            .then(res => { c.put('./index.html', res.clone()); return res; })
            .catch(() => null);
          return cached || netz || fetch(req);
        })
      )
    );
    return;
  }

  // Übrige App-Dateien: erst Netz (frische Version), sonst Cache.
  if (new URL(req.url).origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(V).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Fremde Ressourcen (z.B. Texterkennungs-Bibliothek): erst Cache, dann Netz.
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(V).then(c => c.put(req, copy));
      return res;
    }).catch(() => new Response('', { status: 504 })))
  );
});
