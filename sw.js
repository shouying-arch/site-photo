/* 離線快取
   HTML 走「網路優先」：有網路一定拿到最新版（改版即時生效）；沒網路才用快取。
   其他靜態檔走「快取優先」：載入快。
   改版時把 CACHE 版號 +1，舊快取會自動清掉。 */
const CACHE = 'sitephoto-v8';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './tender-items.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const path = new URL(req.url).pathname;
  /* HTML 與資料檔(json)走網路優先：改版與資料更新才會即時生效 */
  const isFresh = req.mode === 'navigate' ||
                  (req.headers.get('accept') || '').includes('text/html') ||
                  path.endsWith('/index.html') || path.endsWith('.json');
  if (isFresh) {
    // 網路優先
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => {
        if (hit) return hit;
        /* 離線後備只給「本 App 自己的頁面」，
           不要把同一個網站底下的其他頁（例如教官 App）也導到這裡 */
        const own = path.endsWith('/') || path.endsWith('/index.html');
        return own ? caches.match('./index.html') : Response.error();
      }))
    );
  } else {
    // 快取優先
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  }
});
