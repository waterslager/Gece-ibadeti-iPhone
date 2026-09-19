const CACHE = "teheccud-v4";
const ASSETS = ["./", "./index.html", "./1_192.png", "./2_512.png"];

// Ağ isteğini bir zaman aşımıyla sarmalar. Bağlantı sonsuza dek askıda
// kalırsa (WiFi geçişi, zayıf sinyal vb.) timeoutMs sonra reddeder,
// böylece çağıran taraf cache'e düşebilir. Bunsuz, index.html'in kendi
// yüklenme isteği askıda kaldığında sayfa hiç boyanmıyor ve uygulama
// açılış logosunda sonsuza dek takılı kalıyordu.
function fetchWithTimeout(request, options, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        fetch(request, options).then((res) => {
            clearTimeout(timer);
            resolve(res);
        }).catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(url =>
        fetchWithTimeout(url, { cache: "reload" }, 10000)
          .then(res => c.put(url, res))
          .catch(() => {}) // tek bir asset zaman aşımına uğrarsa kurulumun tamamını bloklamasın
      ))
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
    fetchWithTimeout(e.request, { cache: "no-store" }, 4000)
      .catch(() => caches.match(e.request))
      .then((res) => res || new Response(
        "Çevrimdışısınız ve bu sayfa önbellekte yok.",
        { status: 503, statusText: "Offline" }
      ))
  );
});
