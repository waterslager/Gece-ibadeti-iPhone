const CACHE = "teheccud-v27";
const SHELL = ["./", "./index.html"];
const ASSETS = [...SHELL, "./manifest.json", "./192.png", "./512.png", "./maskable-192.png", "./maskable-512.png"];

const putFresh = (cache, url) =>
  fetch(url, { cache: "reload" })
    .then((res) => (res && res.ok ? cache.put(url, res) : null))
    .catch(() => {}); // tek bir dosya başarısız olursa diğerleri etkilenmesin

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((url) => putFresh(cache, url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("teheccud-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Farklı origin (namaz vakti API'leri) service worker'a hiç girmez.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(staleWhileRevalidate(e));
});

const isShell = (request) => request.mode === "navigate" || /\.html$/.test(new URL(request.url).pathname);

async function differs(a, b) {
  const [x, y] = (await Promise.all([a.arrayBuffer(), b.arrayBuffer()])).map((buf) => new Uint8Array(buf));
  return x.length !== y.length || x.some((v, i) => v !== y[i]);
}

// Kabuk (index.html) yenilenince açık sayfalara mesaj gider.
let shellUpdate = null;
function updateShell(cache) {
  if (!shellUpdate) {
    shellUpdate = Promise.all(SHELL.map((url) => putFresh(cache, url)))
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.postMessage("updated")))
      .finally(() => { shellUpdate = null; });
  }
  return shellUpdate;
}

// Kabuk önbellekten gecikmesiz sunulur; arka planda sunucuyla karşılaştırılır. Değişiklik varsa
// yeni sürüm indirilir ve sayfa hemen yenilenir, yani yeni sürüm ilk açılışta devreye girer.
function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.open(CACHE).then((cache) =>
    cache.match(request, { ignoreSearch: true }).then((cached) => {
      const before = cached && isShell(request) ? cached.clone() : null; // gövde tüketilmeden önce kopyalanmalı
      // no-cache: HTTP önbelleği yerine sunucuya koşullu istek atar (GitHub Pages ~10 dk gecikmesi olmaz).
      const networkUpdate = fetch(request.url, { cache: "no-cache" })
        .then(async (res) => {
          if (res && res.ok) {
            const changed = before && await differs(before, res.clone());
            cache.put(request, res.clone()).catch(() => {});
            if (changed) await updateShell(cache);
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // SW güncelleme bitene kadar kapanmasın; bazı tarayıcılarda InvalidStateError ihtimaline karşı try/catch.
        try { event.waitUntil(networkUpdate); } catch (_) {}
        return cached;
      }

      // Önbellek boş: ağı bekle; başarısızsa yalnızca sayfa açılışlarında index.html'e düş.
      return networkUpdate
        .then((res) => res || (request.mode === "navigate" ? cache.match("./index.html") : null))
        .then((res) => res || new Response(
          "Çevrimdışısınız ve bu sayfa önbellekte yok.",
          { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } }
        ));
    })
  );
}
