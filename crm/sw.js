/* Nurul Hadis CRM — service worker.
   Ilova qobig'i (HTML, CSS, JS, ikonkalar) keshlanadi, shuning uchun telefon tez ochiladi.
   /api/ so'rovlari HECH QACHON keshlanmaydi: pul va buyurtma ma'lumotlari doim yangi bo'lishi kerak. */

var VERSIYA = "nh-crm-v8";
var QOBIQ = [
  "/crm/",
  "/crm/app.css?v=8",
  "/crm/lucide.js?v=8",
  "/crm/app.js?v=8",
  "/crm/bts.json",
  "/crm/manifest.webmanifest",
  "/crm/icons/icon-192.png",
  "/crm/icons/icon-512.png",
  "/crm/icons/favicon-32.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSIYA).then(function (c) {
      return Promise.all(QOBIQ.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (nomlar) {
      return Promise.all(nomlar.filter(function (n) { return n !== VERSIYA; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;              // Google Fonts va boshqalar: brauzer o'zi hal qiladi
  if (url.pathname.indexOf("/api/") === 0) return;         // ma'lumotlar: faqat tarmoq
  if (url.pathname.indexOf("/crm/") !== 0) return;

  if (req.mode === "navigate") {                           // sahifa: avval tarmoq, internet bo'lmasa kesh
    e.respondWith(
      fetch(req).then(function (r) {
        var nusxa = r.clone();
        caches.open(VERSIYA).then(function (c) { c.put("/crm/", nusxa); });
        return r;
      }).catch(function () { return caches.match("/crm/"); })
    );
    return;
  }
  e.respondWith(                                           // fayllar: keshdan darrov, orqada yangilanadi
    caches.match(req).then(function (hit) {
      var tarmoq = fetch(req).then(function (r) {
        if (r && r.ok) { var nusxa = r.clone(); caches.open(VERSIYA).then(function (c) { c.put(req, nusxa); }); }
        return r;
      }).catch(function () { return hit; });
      return hit || tarmoq;
    })
  );
});

// Push xabarlar (yetkazilmagan buyurtma eslatmalari)
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data.json(); } catch (x) { d = { sarlavha: "Nurul Hadis CRM", matn: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.sarlavha || "Nurul Hadis CRM", {
    body: d.matn || "", icon: "/crm/icons/icon-192.png", badge: "/crm/icons/favicon-32.png",
    data: { url: d.url || "/crm/" }, tag: "nh-crm",
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/crm/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf("/crm/") >= 0 && "focus" in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});
