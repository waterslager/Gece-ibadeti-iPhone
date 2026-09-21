const CACHE = "teheccud-v5";
const ASSETS = ["./", "./index.html", "./1_192.png", "./2_512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Namaz vakti API'si (farklı origin) service worker'ın hiç kapsamına girmesin;
  // tarayıcı bu isteği normal şekilde, SW araya girmeden yürütsün.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(staleWhileRevalidate(e.request));
});

// Uygulama kabuğu (HTML/CSS/JS/ikonlar) her zaman önbellekten, ağdan
// bağımsız ve gecikmesiz olarak sunulur — bir "zaman aşımı" kavramı ve
// buna bağlı yanlış "çevrimdışı" hatası artık söz konusu değil.
// Güncelleme arka planda sessizce indirilip önbelleğe yazılır; kullanıcı
// bunu beklemez, güncel sürümü bir sonraki açılışta görür.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request, { ignoreSearch: true }).then((cached) => {
      const networkUpdate = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // networkUpdate zaten arka planda çalışmaya başladı; kullanıcıyı
        // bekletmeden önbellekteki sürümü hemen döndürüyoruz.
        return cached;
      }

      // İlk ziyaret / önbellek boş: ağı bekle, o da başarısız olursa
      // en azından uygulama kabuğuna (index.html) düş.
      return networkUpdate
        .then((res) => res || cache.match("./index.html"))
        .then((res) => res || new Response(
          "Çevrimdışısınız ve bu sayfa önbellekte yok.",
          { status: 503, statusText: "Offline" }
        ));
    })
  );
}
