const CACHE = "teheccud-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./192.png",
  "./512.png",
  "./maskable-192.png",
  "./maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => {
              if (res && res.ok) return cache.put(url, res.clone()).catch(() => {});
            })
            .catch(() => {}) // tek bir asset başarısız olursa kurulumun tamamını bloklamasın
        )
      )
    ).then(() => self.skipWaiting())
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
  // Namaz vakti API'si (farklı origin) service worker'ın hiç kapsamına girmesin;
  // tarayıcı bu isteği normal şekilde, SW araya girmeden yürütsün.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(staleWhileRevalidate(e));
});

// Uygulama kabuğu (HTML/CSS/JS/ikonlar) her zaman önbellekten, ağdan
// bağımsız ve gecikmesiz olarak sunulur — bir "zaman aşımı" kavramı ve
// buna bağlı yanlış "çevrimdışı" hatası artık söz konusu değil.
// Güncelleme arka planda sessizce indirilip önbelleğe yazılır; kullanıcı
// bunu beklemez, güncel sürümü bir sonraki açılışta görür.
function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.open(CACHE).then((cache) =>
    cache.match(request, { ignoreSearch: true }).then((cached) => {
      // no-cache: tarayıcının HTTP önbelleği (GitHub Pages ~10 dk) yerine sunucuya
      // koşullu istek atar; güncelleme 10 dk gecikmeden gelir.
      const networkUpdate = fetch(request.url, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Güncelleme bitene kadar service worker'ın kapanmaması için waitUntil.
        // respondWith promise'i hâlâ beklemede olduğundan çağrı geçerlidir; yine de
        // bazı tarayıcılarda InvalidStateError ihtimaline karşı try/catch'e alındı.
        // networkUpdate zaten .catch(() => null) ile bittiğinden unhandled rejection yok.
        try { event.waitUntil(networkUpdate); } catch (_) { networkUpdate.catch(() => {}); }
        return cached;
      }

      // İlk ziyaret / önbellek boş: ağı bekle. Başarısız olursa sadece sayfa
      // açılışlarında index.html'e düş (resim gibi dosyalara HTML dönmesin).
      return networkUpdate
        .then((res) => res || (request.mode === "navigate" ? cache.match("./index.html") : null))
        .then((res) => res || new Response(
          "Çevrimdışısınız ve bu sayfa önbellekte yok.",
          { status: 503, statusText: "Offline" }
        ));
    })
  );
}
