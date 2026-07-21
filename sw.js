const CACHE = "teheccud-v2";
const ASSETS = ["./", "./index.html", "./1_192.png", "./2_512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(url => fetch(url, { cache: "reload" }).then(res => c.put(url, res))))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Namaz vakti API'si (farklı origin) service worker'ın hiç kapsamına girmesin;
  // tarayıcı bu isteği normal şekilde, SW araya girmeden yürütsün. Zaten aşağıdaki
  // no-store network-first stratejisi API'yi de doğru yönetiyor, ama bu satır
  // niyeti kesinleştirip ileride yapılacak değişikliklerde API'nin yanlışlıkla
  // önbelleğe alınmasını imkansız hale getiriyor.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request))
  );
});
