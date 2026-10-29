/* Nurul Hadis CRM — bitta fayldagi oddiy (vanilla) JS dastur. */
(function () {
  "use strict";

  var API = "/api/crm";
  var root = document.getElementById("root");
  var S = { me: null, page: "dashboard", davr: "30", cache: {}, chartKey: "tushum" };

  /* ── yordamchilar ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function som(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? "−" : "") + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }
  function compact(n) {
    var a = Math.abs(n), s = n < 0 ? "−" : "";
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".0", "") + " mln";
    if (a >= 1e3) return s + Math.round(a / 1e3) + " k";
    return s + a;
  }
  function today() {
    var d = new Date(), m = ("0" + (d.getMonth() + 1)).slice(-2), k = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + k;
  }
  function fdate(s) { return s ? s.split("-").reverse().join(".") : ""; }
  function cookie(n) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function toast(msg, bad) {
    var el = document.createElement("div");
    el.className = "toast" + (bad ? " bad" : "");
    el.textContent = msg;
    document.getElementById("toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, bad ? 6000 : 2600);
  }
  function xatoMatni(d) {
    if (!d) return "Xatolik yuz berdi.";
    if (typeof d === "string") return d;
    if (d.xato) return d.xato;
    if (d.detail) return d.detail;
    var out = [];
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      if (Array.isArray(v)) v = v.map(function (x) { return typeof x === "object" ? xatoMatni(x) : x; }).join(" ");
      else if (typeof v === "object") v = xatoMatni(v);
      out.push((k === "non_field_errors" ? "" : k + ": ") + v);
    });
    return out.join(" · ");
  }
  function api(path, opt) {
    opt = opt || {};
    var h = { "Accept": "application/json" };
    if (opt.body !== undefined) h["Content-Type"] = "application/json";
    if ((opt.method || "GET") !== "GET") h["X-CSRFToken"] = cookie("csrftoken");
    return fetch(API + path, {
      method: opt.method || "GET", headers: h, credentials: "same-origin",
      body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
    }).catch(function () {
      throw new Error("Internet yo‘q yoki server javob bermayapti. Ulanishni tekshiring.");
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) {
          if (r.status === 401 || (r.status === 403 && d && /credentials|authenticat/i.test(JSON.stringify(d)))) {
            S.me = null; render();
          }
          var e = new Error(xatoMatni(d)); e.data = d; throw e;
        }
        return d;
      });
    });
  }
  function list(path) {
    return api(path).then(function (d) { return Array.isArray(d) ? d : (d && d.results) || []; });
  }

  /* ── ikonkalar ────────────────────────────────────────────────── */
  var ALIAS = { dashboard: "layout-dashboard", orders: "shopping-bag", cost: "wallet", stock: "warehouse", box: "package", out: "log-out",
    money: "banknote", trend: "trending-up", cart: "shopping-cart", debt: "hand-coins", install: "download", more: "ellipsis" };
  function ic(n, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' +
      (cls ? ' class="' + cls + '"' : "") + ">" + ((window.LUCIDE || {})[ALIAS[n] || n] || "") + "</svg>";
  }

  /* ── drawer ───────────────────────────────────────────────────── */
  function drawer(opt) {
    var ov = document.createElement("div");
    ov.className = "ov";
    ov.innerHTML =
      '<div class="drawer" role="dialog"><div class="hd"><h2>' + esc(opt.title) + '</h2>' +
      '<button class="icon-x" data-x aria-label="Yopish">' + ic("x") + '</button></div>' +
      '<div class="bd">' + opt.body + '</div>' +
      '<div class="ft">' + (opt.onDelete ? '<button class="btn bad" data-del>O‘chirish</button><span class="sp"></span>' : "") +
      '<button class="btn" data-x>Bekor</button><button class="btn pri" data-save>Saqlash</button></div></div>';
    document.body.appendChild(ov);
    var oldOverflow = document.body.style.overflow, yopilgan = false;
    document.body.style.overflow = "hidden";
    // Telefonda «orqaga» tugmasi ilovadan chiqarib yubormasdan, oynani yopsin
    history.pushState({ nhDrawer: 1 }, "");
    function onPop() { close(true); }
    function close(popdan) {
      if (yopilgan) return;
      yopilgan = true;
      ov.remove();
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", esc_);
      window.removeEventListener("popstate", onPop);
      if (!popdan && history.state && history.state.nhDrawer) history.back();
    }
    function esc_(e) { if (e.key === "Escape") close(); }
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", esc_);
    ov.close = function () { close(); };
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    Array.prototype.forEach.call(ov.querySelectorAll("[data-x]"), function (b) { b.onclick = function () { close(); }; });
    var save = ov.querySelector("[data-save]");
    save.onclick = function () {
      save.disabled = true;
      Promise.resolve(opt.onSave(ov)).then(function (ok) {
        if (ok !== false) close(); else save.disabled = false;
      }).catch(function (e) { save.disabled = false; toast(e.message, true); });
    };
    var del = ov.querySelector("[data-del]");
    if (del) del.onclick = function () {
      if (!confirm("Rostdan ham o‘chirasizmi?")) return;
      Promise.resolve(opt.onDelete()).then(function () { close(); }).catch(function (e) { toast(e.message, true); });
    };
    if (opt.onOpen) opt.onOpen(ov);
    return ov;
  }
  function val(ov, name) { var el = ov.querySelector('[name="' + name + '"]'); return el ? el.value : ""; }
  function intv(ov, name) { return parseInt(val(ov, name), 10) || 0; }
  function opts(arr, sel, textKey) {
    return arr.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o.id, t = Array.isArray(o) ? o[1] : o[textKey || "nom"];
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(t) + "</option>";
    }).join("");
  }

  var TUR = [["sotuv", "Oddiy sotuv"], ["reklama", "Reklama uchun tekin"], ["sovga", "Sovg‘a (tekin)"]];
  var HOLAT = [["yangi", "Yangi"], ["tasdiqlandi", "Tasdiqlandi"], ["yolda", "Yetkazilmoqda"], ["yetkazildi", "Yetkazildi"], ["bekor", "Bekor qilindi"], ["qaytarildi", "Qaytarildi"]];
  var MANBA = [["ig_reklama", "Instagram reklama"], ["ig_organik", "Instagram (bio, direct)"], ["telegram", "Telegram"], ["sayt", "Sayt"], ["tanish", "Tanish / og‘zaki"], ["boshqa", "Boshqa"]];
  var YET = [["yandex", "Yandex"], ["pochta", "Pochta orqali"], ["ozim", "O‘zim olib beraman"], ["ozi", "O‘zi olib ketadi"]];
  var TOLOV = [["naqd", "Naqd"], ["karta", "Karta (Click, Payme)"], ["otkazma", "Hisobga o‘tkazma"], ["yetkazganda", "Yetkazganda to‘laydi"]];
  var XKAT = [["reklama", "Reklama (Instagram, Meta)"], ["qadoqlash", "Qadoqlash, bosma"], ["ish_haqi", "Ish haqi"], ["sayt", "Sayt, server, domen"], ["ijara", "Ijara, kommunal"], ["soliq", "Soliq, to‘lov komissiyasi"], ["boshqa", "Boshqa"], ["material", "Material xaridi"]];
  var TEL0 = "+998 ";
  function telTozala(t) { t = String(t || "").trim(); return /^\+?998?$/.test(t.replace(/\s/g, "")) ? "" : t; }
  function fmtTel(t) {
    var d = String(t || "").replace(/\D/g, "");
    return d.length === 12 && d.indexOf("998") === 0 ? "+998 " + d.slice(3, 5) + " " + d.slice(5, 8) + " " + d.slice(8, 10) + " " + d.slice(10) : String(t || "");
  }
  /* ── mavzu: yorug' / tungi / avto ── */
  var MAVZU = [["light", "Yorug‘", "sun"], ["dark", "Tungi", "moon"], ["auto", "Avto", "monitor"]];
  function mavzuTanlangan() { try { return localStorage.getItem("nh_theme") || "auto"; } catch (e) { return "auto"; } }
  function mavzuQoll(r) {
    var qora = r === "dark" || (r === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = qora ? "dark" : "light";
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = qora ? "#161722" : "#6D4AE0";
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (mavzuTanlangan() === "auto") mavzuQoll("auto"); });
  mavzuQoll(mavzuTanlangan());
  function nomi(arr, k) { for (var i = 0; i < arr.length; i++) if (arr[i][0] === k) return arr[i][1]; return k; }

  var HOLAT_IC = { yangi: "sparkles", tasdiqlandi: "circle-check", yolda: "truck", yetkazildi: "package-check", bekor: "circle-x", qaytarildi: "undo-2" };
  var TUR_IC = { sotuv: "shopping-bag", reklama: "megaphone", sovga: "gift" };
  var YET_IC = { yandex: "car-taxi-front", pochta: "mail", ozim: "user-round", ozi: "store" };
  var TOLOV_IC = { "To'langan": "badge-check", "Qisman": "circle-dashed", "To'lanmagan": "circle-alert" };
  function badge(c, icon, text) { return '<span class="badge ' + c + '">' + (icon ? ic(icon) : "") + esc(text) + "</span>"; }
  function holatBadge(h) {
    return badge(HOLAT_C[h] || "", HOLAT_IC[h], nomi(HOLAT, h));
  }
  function turBadge(t) {
    return badge(t === "sotuv" ? "" : "warn", TUR_IC[t], t === "sotuv" ? "Sotuv" : t === "reklama" ? "Reklama" : "Sovg‘a");
  }
  function tolovBadge(h) {
    var c = h === "To'langan" ? "ok" : h === "Qisman" ? "warn" : h === "To'lanmagan" ? "bad" : "";
    return badge(c, TOLOV_IC[h], h);
  }
  function yetLabel(k, nom) { return '<span class="yl">' + (YET_IC[k] ? ic(YET_IC[k]) : "") + '<span class="yt">' + esc(nom) + "</span></span>"; }

  /* tanlov tugmalari (select o'rniga): yashirin input + ikonkali tugmalar */
  function chipField(name, label, arr, sel, icons, short) {
    return '<div class="field"><label>' + label + '</label><input type="hidden" name="' + name + '" value="' + esc(sel) + '"><div class="chips" data-chips="' + name + '">' +
      arr.map(function (o) {
        return '<button type="button" class="chip' + (o[0] === sel ? " on" : "") + '" data-v="' + esc(o[0]) + '">' + (icons[o[0]] ? ic(icons[o[0]]) : "") + esc(short && short[o[0]] || o[1]) + "</button>";
      }).join("") + "</div></div>";
  }
  function bindChips(ov) {
    Array.prototype.forEach.call(ov.querySelectorAll("[data-chips]"), function (box) {
      var inp = ov.querySelector('input[name="' + box.dataset.chips + '"]');
      Array.prototype.forEach.call(box.querySelectorAll(".chip"), function (b) {
        b.onclick = function () {
          inp.value = b.dataset.v;
          Array.prototype.forEach.call(box.querySelectorAll(".chip"), function (x) { x.classList.toggle("on", x === b); });
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        };
      });
    });
  }

  /* ── pastki oyna (sheet): holat tanlash, xabarlar ─────────────── */
  function sheet(opt) {
    var ov = document.createElement("div");
    ov.className = "ov sheetov";
    ov.innerHTML = '<div class="sheet" role="dialog"><div class="hd"><h2>' + esc(opt.title) + '</h2>' +
      '<button class="icon-x" data-x aria-label="Yopish">' + ic("x") + '</button></div><div class="bd">' + opt.body + "</div></div>";
    document.body.appendChild(ov);
    var oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) { if (e.key === "Escape") close(); }
    function close() {
      if (!ov.parentNode) return;
      ov.remove();
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
    }
    document.addEventListener("keydown", onKey);
    ov.close = close;
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    ov.querySelector("[data-x]").onclick = close;
    if (opt.onOpen) opt.onOpen(ov);
    return ov;
  }

  var HOLAT_C = { yangi: "blue", tasdiqlandi: "acc", yolda: "warn", yetkazildi: "ok", bekor: "bad", qaytarildi: "bad" };
  var HOLAT_KEYIN = { yangi: "tasdiqlandi", tasdiqlandi: "yolda", yolda: "yetkazildi" };
  // Ro'yxatdagi holat belgisi: bosilsa holatni tezda o'zgartirish oynasi ochiladi
  function holatQuick(b) {
    return '<button type="button" class="badge qs ' + (HOLAT_C[b.holat] || "") + '" data-q="' + b.id + '" title="Holatni o‘zgartirish">' +
      ic(HOLAT_IC[b.holat]) + esc(nomi(HOLAT, b.holat)) + ic("chevron-down") + "</button>";
  }
  function holatTanla(b, done) {
    var body = '<div class="pick">' + HOLAT.map(function (o) {
      var hozir = o[0] === b.holat, keyin = HOLAT_KEYIN[b.holat] === o[0];
      return '<button type="button" class="pk ' + (HOLAT_C[o[0]] || "") + (hozir ? " on" : "") + (keyin ? " nx" : "") + '" data-v="' + o[0] + '">' + ic(HOLAT_IC[o[0]]) +
        "<span>" + esc(o[1]) + "</span>" + (hozir ? ic("check") : keyin ? "<em>keyingi</em>" : "") + "</button>";
    }).join("") + "</div>";
    sheet({
      title: "#" + b.id + " · " + b.mijoz_nom, body: body,
      onOpen: function (ov) {
        Array.prototype.forEach.call(ov.querySelectorAll(".pk"), function (btn) {
          btn.onclick = function () {
            var v = btn.dataset.v;
            if (v === b.holat) { ov.close(); return; }
            btn.disabled = true;
            api("/buyurtmalar/" + b.id + "/holat/", { method: "PATCH", body: { holat: v } }).then(function () {
              ov.close(); toast("Holat: " + nomi(HOLAT, v)); S.cache = {}; done();
            }).catch(function (e) { btn.disabled = false; toast(e.message, true); });
          };
        });
      },
    });
  }

  /* ── pochta va BTS filiallari ─────────────────────────────────── */
  var POCHTA = [["bts", "BTS"], ["emu", "EMU"], ["uzpost", "UZ POST"]];
  var VILOYAT = ["Toshkent shahri", "Toshkent viloyati", "Andijon viloyati", "Buxoro viloyati", "Farg'ona viloyati", "Jizzax viloyati", "Namangan viloyati",
    "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog'iston Respublikasi", "Samarqand viloyati", "Sirdaryo viloyati", "Surxondaryo viloyati", "Xorazm viloyati"];
  function loadBts() {
    if (S.bts) return Promise.resolve(S.bts);
    return fetch("/crm/bts.json").then(function (r) { return r.json(); }).then(function (d) { Object.keys(d).forEach(function (k) { d[k].forEach(function (x) { x.v = k; }); }); S.bts = d; return d; }).catch(function () { return {}; });
  }
  function yetNom(b) {
    if (b.yetkazish_turi !== "pochta" || !b.pochta) return b.yetkazish_turi_nom;
    var f = b.bts_filial ? b.bts_filial.split(" · ")[1] : "";
    return b.pochta_nom + (f ? " · " + f : b.viloyat ? " · " + b.viloyat : "");
  }
  // Buyurtma formasidagi viloyat → tuman → BTS filiali tanlovlari
  function btsOrnat(ov, b) {
    var data = S.bts || {};
    var v = ov.querySelector('[name="viloyat"]'), t = ov.querySelector("#btstuman"), f = ov.querySelector('[name="bts_filial"]'), info = ov.querySelector("#btsinfo");
    var hammasi = [], ichki = false;
    Object.keys(data).forEach(function (k) { hammasi = hammasi.concat(data[k]); });
    function royxat() { return v.value ? (data[v.value] || []) : hammasi; }     // viloyat tanlanmagan bo'lsa, hamma filiallar ichidan qidiriladi
    function kodi(s) { return String(s || "").split(" · ")[0]; }
    function tumanlar(tanlangan) {
      var l = v.value ? royxat() : [], set = [];
      l.forEach(function (x) { if (set.indexOf(x.tuman) < 0) set.push(x.tuman); });
      set.sort(function (a, c) { return a.localeCompare(c); });
      t.disabled = !v.value;
      t.innerHTML = '<option value="">Hammasi' + (l.length ? " (" + l.length + " ta filial)" : "") + "</option>" +
        set.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("");
      t.value = tanlangan || "";
    }
    function izoh(x) {
      var m = x.manzil || "";
      if (x.moljal && m.toLowerCase().indexOf(x.moljal.toLowerCase()) < 0) m += (m ? " · " : "") + "Mo‘ljal: " + x.moljal;
      return m;
    }
    function filiallar(tanlangan) {
      var l = royxat().filter(function (x) { return !t.value || x.tuman === t.value; });
      f.innerHTML = '<option value="">' + (v.value ? "Filialni tanlang yoki qidiring…" : "Filialni qidiring (viloyat tanlash shart emas)…") + "</option>" + l.map(function (x) {
        return '<option value="' + esc(x.kod + " · " + x.nom) + '" data-v="' + esc(x.v || "") + '" data-sub="' + esc(izoh(x)) + '" data-s="' +
          esc([x.nom, x.tuman, x.manzil, x.moljal, x.kod, x.v].join(" ")) + '">' + esc(x.nom + " — " + x.tuman + (v.value ? "" : ", " + (x.v || "").replace(/ (viloyati|shahri|Respublikasi)$/, ""))) + "</option>";
      }).join("");
      if (tanlangan) {
        f.value = tanlangan;
        if (f.value !== tanlangan) { var o = document.createElement("option"); o.value = tanlangan; o.textContent = tanlangan; f.appendChild(o); f.value = tanlangan; }
      }
      korsat();
    }
    function korsat() {
      var x = hammasi.filter(function (y) { return y.kod === kodi(f.value); })[0];
      info.innerHTML = x ? "<div>" + ic("map-pin") + esc(x.manzil) + "</div>" + (x.moljal ? '<div class="muted">Mo‘ljal: ' + esc(x.moljal) + "</div>" : "") +
        '<div class="muted">' + esc(x.vaqt) + "</div>" : "";
    }
    v.onchange = function () { if (ichki) return; tumanlar(""); filiallar(""); };
    t.onchange = function () { filiallar(""); };
    f.onchange = function () {
      // viloyat tanlanmagan holda filial tanlansa, viloyat o'zi qo'yiladi
      var o = f.selectedOptions[0];
      if (o && o.value && !v.value && o.dataset.v) {
        var saqla = f.value;
        ichki = true; v.value = o.dataset.v; v.dispatchEvent(new Event("change", { bubbles: true })); ichki = false;
        tumanlar(""); filiallar(saqla);
      }
      korsat();
    };
    f.dataset.sph = "Filial nomi, manzil yoki mo‘ljal bo‘yicha qidiring…";
    v.value = b.viloyat || "";
    var saqlangan = royxat().filter(function (x) { return x.kod === kodi(b.bts_filial); })[0];
    tumanlar(saqlangan ? saqlangan.tuman : "");
    filiallar(b.bts_filial || "");
  }

  /* ── bildirishnomalar va push ─────────────────────────────────── */
  function xabarSoni(majbur) {
    if (!S.me) return;
    if (!majbur && S.xt && Date.now() - S.xt < 60000) { bellBoyash(); return; }
    S.xt = Date.now();
    api("/bildirishnomalar/").then(function (d) { S.unread = d.oqilmagan; bellBoyash(); }).catch(function () {});
  }
  function bellBoyash() {
    var el = document.querySelector("#bell .dot");
    if (!el) return;
    el.classList.toggle("hide", !S.unread);
    el.textContent = S.unread > 9 ? "9+" : S.unread || "";
  }
  function fvaqt(iso) {
    var d = new Date(iso), n = new Date(), p = function (x) { return (x < 10 ? "0" : "") + x; };
    var kun = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    var s = p(d.getHours()) + ":" + p(d.getMinutes());
    return kun === 0 ? "Bugun " + s : kun === 1 ? "Kecha " + s : p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }
  function urlB64(b) {
    var pad = "=".repeat((4 - b.length % 4) % 4), raw = atob((b + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
  }
  // Service worker ro'yxatdan o'tmagan bo'lsa, ro'yxatdan o'tkazib, tayyor bo'lishini kutadi
  function swTayyor() {
    return navigator.serviceWorker.getRegistration("/crm/").then(function (r) {
      return r || navigator.serviceWorker.register("/crm/sw.js", { scope: "/crm/" });
    }).then(function () { return navigator.serviceWorker.ready; });
  }
  function pushYoq() {
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("Ruxsat berilmadi. Telefon sozlamalaridan Nurul Hadis uchun xabarlarga ruxsat bering.");
      return api("/push/kalit/");
    }).then(function (k) {
      return swTayyor().then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) {
          return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(k.kalit) });
        });
      });
    }).then(function (sub) { return api("/push/obuna/", { method: "POST", body: sub.toJSON() }); });
  }
  function pushOchir() {
    return swTayyor().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return null;
      return api("/push/bekor/", { method: "POST", body: { endpoint: sub.endpoint } }).then(function () { return sub.unsubscribe(); });
    });
  }
  function pushBox(el) {
    var qoll = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!qoll) {
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      el.innerHTML = '<div class="pushc"><span class="hic">' + ic("bell-off") + "</span><div><b>Telefonga xabar kelmaydi</b><small>" +
        (ios && !standalone() ? "iPhone’da avval ilovani Bosh ekranga qo‘shing (Safari → Ulashish → Bosh ekranga qo‘shish), so‘ng uni Bosh ekrandan oching." : "Bu brauzer push xabarlarni qo‘llamaydi.") +
        "</small></div></div>";
      return;
    }
    function chiz(on) {
      el.innerHTML = on
        ? '<div class="pushc on"><span class="hic kirim">' + ic("bell-ring") + "</span><div><b>Telefonga xabar yoqilgan</b><small>Ilova yopiq bo‘lsa ham eslatma keladi.</small></div>" +
          '<div class="pa"><button class="btn sm" id="ptest">' + ic("send") + 'Sinash</button><button class="btn sm" id="poff">O‘chirish</button></div></div>'
        : '<div class="pushc"><span class="hic">' + ic("bell") + "</span><div><b>Telefonga xabarni yoqing</b><small>Yetkazilmagan buyurtmalar haqida ilova yopiq bo‘lsa ham xabar keladi.</small></div>" +
          '<div class="pa"><button class="btn pri sm" id="pon">Yoqish</button></div></div>';
      var on_ = el.querySelector("#pon"), off = el.querySelector("#poff"), test = el.querySelector("#ptest");
      if (on_) on_.onclick = function () {
        on_.disabled = true;
        pushYoq().then(function () { toast("Xabarlar yoqildi"); chiz(true); }).catch(function (e) { on_.disabled = false; toast(e.message, true); });
      };
      if (off) off.onclick = function () { pushOchir().then(function () { toast("Xabarlar o‘chirildi"); chiz(false); }).catch(function (e) { toast(e.message, true); }); };
      if (test) test.onclick = function () {
        api("/push/sinov/", { method: "POST" }).then(function (d) { toast(d.yuborildi ? "Sinov xabari yuborildi" : "Yuborilmadi: obuna topilmadi, qayta yoqing", !d.yuborildi); })
          .catch(function (e) { toast(e.message, true); });
      };
    }
    swTayyor().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { chiz(!!sub && Notification.permission === "granted"); }).catch(function () { chiz(false); });
  }
  function xabarlarOyna() {
    sheet({
      title: "Xabarlar", body: '<div id="pushbox"></div><div class="sec">Eslatmalar</div><div id="xlist"><div class="muted">Yuklanmoqda…</div></div>',
      onOpen: function (ov) {
        pushBox(ov.querySelector("#pushbox"));
        api("/bildirishnomalar/").then(function (d) {
          ov.querySelector("#xlist").innerHTML = d.royxat.length ? '<div class="hist">' + d.royxat.map(function (x) {
            return '<div class="hrow click xit' + (x.yangi ? " new" : "") + '" data-b="' + (x.buyurtma || "") + '"><span class="hic tuzatish">' + ic("truck") + '</span><div class="hm"><b>' +
              esc(x.sarlavha) + "</b><small>" + esc(x.matn) + '</small><small class="t">' + fvaqt(x.vaqt) + "</small></div></div>";
          }).join("") + "</div>" : '<div class="muted" style="padding:0.375rem 0">Hozircha xabar yo‘q. Buyurtma 3 kundan ortiq «Yetkazilmoqda»da tursa, shu yerda eslatma chiqadi.</div>';
          Array.prototype.forEach.call(ov.querySelectorAll(".xit"), function (r) {
            r.onclick = function () {
              if (!r.dataset.b) return;
              ov.close();
              api("/buyurtmalar/" + r.dataset.b + "/").then(buyurtmaForm).catch(function (e) { toast(e.message, true); });
            };
          });
          if (d.oqilmagan) api("/bildirishnomalar/oqildi/", { method: "POST" }).then(function () { S.unread = 0; bellBoyash(); });
        }).catch(function (e) { ov.querySelector("#xlist").innerHTML = '<div class="muted">' + esc(e.message) + "</div>"; });
      },
    });
  }

  /* ── stiker chop etish (Xprinter, 40×30 mm) ───────────────────── */
  var STIKER_ENI = 40, STIKER_BOYI = 30;     // mm
  var BT_XIZMAT = ["000018f0-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "0000fee7-0000-1000-8000-00805f9b34fb", "0000ae30-0000-1000-8000-00805f9b34fb"];

  // Stikerga chiqadigan matn: ism, telefon, pochta manzili
  function stikerMatni(b) {
    var adr = [];
    if (b.yetkazish_turi === "pochta") {
      var f = b.bts_filial ? b.bts_filial.split(" · ") : [], x = null;
      if (f[0] && S.bts && S.bts[b.viloyat]) x = S.bts[b.viloyat].filter(function (y) { return y.kod === f[0]; })[0] || null;
      adr.push((b.pochta_nom || "Pochta") + (f[1] ? " · " + f[1] : ""));
      var joy = [b.viloyat, x && x.tuman].filter(Boolean).join(", ");
      if (joy) adr.push(joy);
      if (x && x.manzil) adr.push(x.manzil);
    } else {
      adr.push(b.yetkazish_turi_nom);
    }
    return { ism: b.mijoz_nom || "", tel: b.mijoz_telefon || "", adr: adr };
  }

  // Stikerni rasmga chizadi (k = 1 mm necha piksel). Matn sig'masa shrift kichrayadi.
  function stikerRasm(t, k) {
    var W = STIKER_ENI * k, H = STIKER_BOYI * k, pad = 1.6 * k, eni = W - 2 * pad;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#000"; g.textBaseline = "top";
    var FONT = "'Courier New', Courier, 'Liberation Mono', monospace";
    function qatorlar(matn, px, vazn) {
      g.font = vazn + " " + px + "px " + FONT;
      var natija = [];
      String(matn).split("\n").forEach(function (par) {
        var so = par.split(/\s+/), joriy = "";
        so.forEach(function (w) {
          var sinov = joriy ? joriy + " " + w : w;
          if (g.measureText(sinov).width <= eni || !joriy) joriy = sinov; else { natija.push(joriy); joriy = w; }
        });
        natija.push(joriy);
      });
      return natija;
    }
    function qisqart(q, px, vazn, n) {
      var l = q.slice(0, n);
      if (q.length > n) {
        g.font = vazn + " " + px + "px " + FONT;
        var s = l[n - 1];
        while (s.length > 1 && g.measureText(s + "…").width > eni) s = s.slice(0, -1);
        l[n - 1] = s + "…";
      }
      return l;
    }
    var y = pad;
    function chiz(matn, maxMm, minMm, vazn, maxQator, oraliq) {
      if (!matn) return;
      var px = maxMm * k, q;
      for (; px > minMm * k; px -= 0.25 * k) { q = qatorlar(matn, px, vazn); if (q.length <= maxQator && q.every(function (s) { return g.measureText(s).width <= eni; })) break; }
      q = qisqart(qatorlar(matn, px, vazn), px, vazn, maxQator);
      g.font = vazn + " " + px + "px " + FONT;
      q.forEach(function (s) { g.fillText(s, pad, y); y += px * 1.12; });
      y += (oraliq || 0) * k;
    }
    chiz(t.ism, 3.8, 2.4, "bold", 2, 0.4);
    chiz(fmtTel(t.tel), 3.6, 2.8, "bold", 1, 0.7);
    g.fillRect(pad, y - 0.3 * k, eni, 0.25 * k);
    y += 0.6 * k;
    // manzil: qolgan joyga sig'adigan eng katta shrift
    var qolgan = H - pad - y, matn = t.adr.join("\n"), px = 3.0 * k, q;
    for (; px > 1.95 * k; px -= 0.15 * k) { q = qatorlar(matn, px, "bold"); if (q.length * px * 1.12 <= qolgan) break; }
    q = qatorlar(matn, px, "bold");
    var sigadi = Math.max(1, Math.floor(qolgan / (px * 1.12)));
    q = qisqart(q, px, "bold", sigadi);
    g.font = "bold " + px + "px " + FONT;
    q.forEach(function (s) { g.fillText(s, pad, y); y += px * 1.12; });
    return c;
  }

  // Oddiy printer / kompyuter: brauzerning chop etish oynasi (sahifa o'lchami 40×30 mm)
  function stikerChop(canvas) {
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    f.onload = function () {
      setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); }, 250);
      setTimeout(function () { f.remove(); }, 120000);
    };
    f.srcdoc = "<!doctype html><html><head><meta charset=utf-8><style>@page{size:" + STIKER_ENI + "mm " + STIKER_BOYI + "mm;margin:0}" +
      "html,body{margin:0;padding:0;background:#fff}img{display:block;width:" + STIKER_ENI + "mm;height:" + STIKER_BOYI + "mm}</style></head><body><img src=\"" +
      canvas.toDataURL("image/png") + "\"></body></html>";
  }

  // Bluetooth (TSPL): rasm qora-oq nuqtalarga aylantirilib printerga yuboriladi
  function tsplBuyruq(canvas, teskari) {
    var w = canvas.width, h = canvas.height, d = canvas.getContext("2d").getImageData(0, 0, w, h).data, wb = Math.ceil(w / 8);
    var bit = new Uint8Array(wb * h), x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = (y * w + x) * 4;
      var qora = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 185;
      if ((qora ? 0 : 1) ^ (teskari ? 1 : 0)) bit[y * wb + (x >> 3)] |= 1 << (7 - (x & 7));
    }
    function matn(s) { return Uint8Array.from(s.split(""), function (c) { return c.charCodeAt(0); }); }
    var bosh = matn("SIZE " + STIKER_ENI + " mm," + STIKER_BOYI + " mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0," + wb + "," + h + ",0,"), oxir = matn("\r\nPRINT 1,1\r\n");
    var out = new Uint8Array(bosh.length + bit.length + oxir.length);
    out.set(bosh, 0); out.set(bit, bosh.length); out.set(oxir, bosh.length + bit.length);
    return out;
  }
  function kichik(c, eni) {
    var r = document.createElement("canvas"); r.width = eni; r.height = Math.round(c.height * eni / c.width);
    var g = r.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, r.width, r.height); g.drawImage(c, 0, 0, r.width, r.height);
    return r;
  }
  function btYoz(bytes) {
    if (!navigator.bluetooth) return Promise.reject(new Error("Bu brauzer Bluetooth’ni qo‘llamaydi. Android’da Chrome ishlating."));
    var p = S.btDev ? Promise.resolve(S.btDev) : navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_XIZMAT }).then(function (d) { S.btDev = d; return d; });
    return p.then(function (d) { return d.gatt.connected ? d.gatt : d.gatt.connect(); }).then(function (server) {
      return server.getPrimaryServices();
    }).then(function (xizmatlar) {
      var qidir = xizmatlar.reduce(function (zanjir, x) {
        return zanjir.then(function (topildi) {
          if (topildi) return topildi;
          return x.getCharacteristics().then(function (cs) {
            return cs.filter(function (c) { return c.properties.writeWithoutResponse || c.properties.write; })[0] || null;
          });
        });
      }, Promise.resolve(null));
      return qidir;
    }).then(function (char) {
      if (!char) throw new Error("Printerda yozish kanali topilmadi. Bu printer oddiy Bluetooth (SPP) bo‘lishi mumkin — u brauzerdan ishlamaydi.");
      function yubor(hajm) {
        var navbat = Promise.resolve();
        for (let i = 0; i < bytes.length; i += hajm) {
          navbat = navbat.then(function () {
            var qism = bytes.slice(i, i + hajm);
            return (char.properties.writeWithoutResponse ? char.writeValueWithoutResponse(qism) : char.writeValue(qism))
              .then(function () { return new Promise(function (r) { setTimeout(r, 12); }); });
          });
        }
        return navbat;
      }
      return yubor(160).catch(function () { return yubor(20); });
    });
  }

  function stikerOyna(b) {
    loadBts().then(function () {
      var t = stikerMatni(b);
      var teskari = false;
      try { teskari = localStorage.getItem("nh_stiker_teskari") === "1"; } catch (e) {}
      var btBor = !!navigator.bluetooth;
      sheet({
        title: "Stiker · #" + b.id,
        body: '<div class="stprev" id="stprev"></div>' +
          '<p class="hintp">Stiker o‘lchami ' + STIKER_ENI + "×" + STIKER_BOYI + " mm: mijoz ismi, telefon va pochta filiali.</p>" +
          '<div class="stbtn"><button class="btn pri" id="stp">' + ic("printer") + "Chop etish</button>" +
          (btBor ? '<button class="btn" id="stb">' + ic("bluetooth") + "Bluetooth orqali</button>" : "") + "</div>" +
          (btBor ? '<label class="chk" style="margin-top:0.875rem"><input type="checkbox" id="stinv"' + (teskari ? " checked" : "") + "> Bluetooth: stiker teskari (qora fon) chiqsa, buni yoqing</label>" : '<p class="hintp" style="margin-top:0.75rem">Telefondan Bluetooth orqali chop etish faqat Android’dagi Chrome’da ishlaydi.</p>'),
        onOpen: function (ov) {
          var rasm = stikerRasm(t, 16);
          ov.querySelector("#stprev").appendChild(rasm);
          ov.querySelector("#stp").onclick = function () { stikerChop(rasm); };
          var bt = ov.querySelector("#stb");
          if (bt) bt.onclick = function () {
            var inv = ov.querySelector("#stinv").checked;
            try { localStorage.setItem("nh_stiker_teskari", inv ? "1" : "0"); } catch (e) {}
            bt.disabled = true;
            btYoz(tsplBuyruq(kichik(stikerRasm(t, 16), STIKER_ENI * 8), inv)).then(function () { toast("Printerga yuborildi"); })
              .catch(function (e) { toast(/cancel|chosen/i.test(e.message) ? "Printer tanlanmadi" : e.message, true); })
              .then(function () { bt.disabled = false; });
          };
        },
      });
    });
  }

  /* ── chart (SVG) ──────────────────────────────────────────────── */
  function chart(host, seriya, key, color) {
    var sc = 1;
    var W = Math.max(host.clientWidth, 300), H = 280 * sc, pl = 46 * sc, pb = 30 * sc, pt = 14 * sc, pr = 8 * sc;
    var vals = seriya.map(function (s) { return s[key]; });
    var max = Math.max.apply(null, vals.concat([1])), min = Math.min.apply(null, vals.concat([0]));
    var span = max - min || 1;
    function nice(v) { var p = Math.pow(10, Math.floor(Math.log10(v))); var f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
    var top = max > 0 ? nice(max) : 0, bot = min < 0 ? -nice(-min) : 0;
    span = top - bot || 1;
    var iw = W - pl - pr, ih = H - pt - pb, n = seriya.length, bw = iw / n;
    function y(v) { return pt + ih - ((v - bot) / span) * ih; }
    var g = "", i;
    for (i = 0; i <= 4; i++) {
      var v = bot + (span * i) / 4, yy = y(v);
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/>' +
        '<text x="' + (pl - 8 * sc) + '" y="' + (yy + 4 * sc) + '" text-anchor="end" font-size="' + 11.5 * sc + '" class="gt">' + compact(v) + "</text>";
    }
    var bars = "", labels = "", every = Math.ceil(n / 8), zero = y(0);
    seriya.forEach(function (s, k) {
      var v = s[key], x = pl + k * bw + bw * 0.18, w = bw * 0.64;
      var h = Math.abs(y(v) - zero), by = v >= 0 ? y(v) : zero;
      bars += '<rect class="bg" data-i="' + k + '" x="' + (pl + k * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>' +
        '<rect x="' + x + '" y="' + by + '" width="' + w + '" height="' + Math.max(h, v ? 2 : 0) + '" rx="5" style="fill:' + (v < 0 ? "var(--bad)" : color) + '" opacity=".92" pointer-events="none"/>';
      if (k % every === 0) labels += '<text x="' + (pl + k * bw + bw / 2) + '" y="' + (H - 8 * sc) + '" text-anchor="middle" font-size="' + 11.5 * sc + '" class="gt">' + esc(s.nom) + "</text>";
    });
    host.innerHTML = '<div class="chart"><svg viewBox="0 0 ' + W + " " + H + '">' + g + bars + labels + "</svg>" +
      '<div class="tip hide"></div></div>';
    var tip = host.querySelector(".tip"), box = host.querySelector(".chart");
    Array.prototype.forEach.call(host.querySelectorAll(".bg"), function (r) {
      r.addEventListener("mouseenter", function () {
        var s = seriya[+r.dataset.i];
        tip.innerHTML = esc(s.nom) + "<b>" + som(s[key]) + (key === "soni" ? " ta" : " so‘m") + "</b>";
        tip.classList.remove("hide");
        var bx = box.getBoundingClientRect(), rr = r.getBoundingClientRect();
        tip.style.left = rr.left - bx.left + rr.width / 2 + "px";
        tip.style.top = (y(Math.max(s[key], 0)) + (H > 0 ? 0 : 0)) * (bx.height / H) + "px";
      });
      r.addEventListener("mouseleave", function () { tip.classList.add("hide"); });
    });
  }

  /* ── sahifalar ────────────────────────────────────────────────── */
  var PAGES = [
    ["dashboard", "Dashboard", "dashboard", true],
    ["buyurtmalar", "Buyurtmalar", "orders", false],
    ["mijozlar", "Mijozlar", "users", false],
    ["xarajatlar", "Xarajatlar", "cost", true],
    ["ombor", "Ombor", "stock", true],
    ["mahsulotlar", "Mahsulotlar", "box", false],
  ];

  function delta(a, b, teskari) {
    if (b === null || b === undefined) return "";
    if (!b) return a ? '<span class="delta up">yangi</span>' : "";
    var p = Math.round(((a - b) / Math.abs(b)) * 100);
    if (p === 0) return '<span class="delta flat">0%</span>';
    var good = teskari ? p < 0 : p > 0;
    return '<span class="delta ' + (good ? "up" : "down") + '">' + (p > 0 ? "↑ " : "↓ ") + Math.abs(p) + "%</span>";
  }

  function pageDashboard(el) {
    var DAVR = [["1", "Bugun"], ["7", "7 kun"], ["30", "30 kun"], ["oy", "Bu oy"], ["0", "Hammasi"]];
    el.innerHTML = '<div class="empty">Yuklanmoqda…</div>';
    Promise.all([api("/dashboard/?davr=" + S.davr), list("/buyurtmalar/")]).then(function (res) {
      var d = res[0], r = d.hisob, o = d.oldingi || {}, last = res[1].slice(0, 6);
      var hasPrev = d.oldingi !== null;
      var maxManba = Math.max.apply(null, r.manbalar.map(function (m) { return m.soni; }).concat([1]));
      var maxX = Math.max.apply(null, r.xarajatlar.map(function (x) { return x.summa; }).concat([1]));
      var h = "";
      if (r.tannarxsiz.length) h += '<div class="alert">Tannarx kiritilmagan: <b>' + esc(r.tannarxsiz.join(", ")) + '</b>. Foyda noto‘g‘ri chiqadi. <a href="#/mahsulotlar">Mahsulotlarga o‘ting</a>.</div>';
      h += '<div class="toolbar"><div class="seg" id="davr">' + DAVR.map(function (x) {
        return '<button data-d="' + x[0] + '" class="' + (x[0] === S.davr ? "on" : "") + '">' + x[1] + "</button>";
      }).join("") + "</div></div>";
      h += '<div class="grid kpis">' +
        kpi("money", "Tushum", som(r.tushum), "so‘m", hasPrev ? delta(r.tushum, o.tushum) : "") +
        kpi("trend", "Sof foyda", '<span class="' + (r.sof_foyda < 0 ? "neg" : "") + '">' + som(r.sof_foyda) + "</span>", "so‘m · " + r.marja + "%", hasPrev ? delta(r.sof_foyda, o.sof_foyda) : "") +
        kpi("cart", "Buyurtmalar", r.buyurtma_soni, r.pullik_soni + " pullik · " + r.tekin_soni + " tekin", hasPrev ? delta(r.buyurtma_soni, o.buyurtma_soni) : "") +
        kpi("debt", "Qarz (to‘lanmagan)", '<span class="' + (r.qarz ? "neg" : "") + '">' + som(r.qarz) + "</span>", "so‘m", hasPrev ? delta(r.qarz, o.qarz, true) : "") +
        "</div>";
      h += '<div class="grid g2"><div class="card"><div class="toolbar" style="margin:0 0 6px;justify-content:space-between">' +
        '<h3 style="margin:0">Grafik</h3><div class="seg" id="ck">' +
        [["tushum", "Tushum"], ["foyda", "Sof foyda"], ["soni", "Buyurtma"]].map(function (x) {
          return '<button data-k="' + x[0] + '" class="' + (x[0] === S.chartKey ? "on" : "") + '">' + x[1] + "</button>";
        }).join("") + '</div></div><div id="chart"></div></div>' +
        '<div class="card"><h3>Foyda qanday chiqdi</h3><div class="pl">' +
        pl("Mahsulotlar summasi", r.mahsulot_summasi) + pl("− Chegirmalar", -r.chegirma) +
        '<div class="r tot"><span>Tushum</span><span>' + som(r.tushum) + "</span></div>" +
        pl("− Tannarx", -r.tannarx) +
        '<div class="r muted" style="font-size:0.8125rem"><span>&nbsp;&nbsp;shundan bonuslar</span><span>' + som(r.bonus_tannarx) + "</span></div>" +
        '<div class="r muted" style="font-size:0.8125rem"><span>&nbsp;&nbsp;shundan tekin buyurtmalar</span><span>' + som(r.tekin_tannarx) + "</span></div>" +
        pl("− Yetkazish xarajati", -r.yetkazish_xarajati) + pl("− Xarajatlar", -r.operatsion) +
        '<div class="r tot"><span>Sof foyda</span><span class="' + (r.sof_foyda < 0 ? "neg" : "pos") + '">' + som(r.sof_foyda) + "</span></div>" +
        "</div></div></div>";

      h += '<div class="grid g3">' +
        '<div class="card"><h3>Qayerdan keldi</h3><div class="bars">' + (r.manbalar.map(function (m) {
          return '<div class="bar"><div class="t"><span>' + esc(m.nom) + "</span><span>" + m.soni + ' ta · ' + compact(m.tushum) + '</span></div><div class="tr"><i style="width:' + Math.round(m.soni / maxManba * 100) + '%"></i></div></div>';
        }).join("") || '<div class="muted">Ma’lumot yo‘q</div>') + "</div></div>" +
        '<div class="card"><h3>Xarajatlar</h3><div class="bars">' + (r.xarajatlar.map(function (x) {
          return '<div class="bar"><div class="t"><span>' + esc(x.nom) + "</span><span>" + som(x.summa) + '</span></div><div class="tr"><i style="width:' + Math.round(x.summa / maxX * 100) + '%;background:' + (x.foydaga ? "var(--accent)" : "var(--bar-off)") + '"></i></div></div>';
        }).join("") || '<div class="muted">Xarajat kiritilmagan</div>') + "</div></div>" +
        '<div class="card"><h3>Ombor</h3>' + (r.ombor.length ? '<div class="pl">' + r.ombor.map(function (t) {
          return '<div class="r"><span>' + esc(t.nom) + "</span><span>" + (t.kam ? '<span class="badge bad">Kam: ' : "<b>") + t.qoldiq + " " + esc(t.birlik) + (t.kam ? "</span>" : "</b>") + "</span></div>";
        }).join("") + "</div>" : '<div class="muted">Ombor bo‘sh. <a href="#/ombor">Qo‘shing</a>.</div>') + "</div></div>";

      h += '<div class="grid g2e"><div class="card"><h3>Instagram reklama</h3>' + (function () {
        var a = r.reklama;
        if (!a.xarajat && !a.kirgan && !a.buyurtma) return '<div class="muted">Hali ma‘lumot yo‘q. Reklama xarajatini «Xarajatlar»ga yozing, buyurtmaning manbasini «Instagram reklama» deb belgilang.</div>';
        return '<div class="pl">' +
          pl("Reklama xarajati", a.xarajat) +
          '<div class="r"><span>Saytga kirgan (reklamadan)</span><span>' + a.kirgan + " ta</span></div>" +
          '<div class="r"><span>Tugma bosgan</span><span>' + a.bosgan + " ta</span></div>" +
          '<div class="r"><span>Buyurtma (Instagram reklama)</span><span>' + a.buyurtma + " ta</span></div>" +
          pl("Shu buyurtmalardan tushum", a.tushum) +
          '<div class="r"><span>Bitta buyurtma narxi</span><span>' + (a.buyurtma_narxi === null ? "—" : som(a.buyurtma_narxi) + " so‘m") + "</span></div>" +
          '<div class="r tot"><span>ROI (tushum ÷ xarajat)</span><span>' + (a.roi === null ? "—" : "×" + a.roi) + "</span></div></div>";
      })() + "</div>" +
        '<div class="card"><h3>Oxirgi buyurtmalar</h3>' + (last.length ? '<table class="tbl"><tbody>' + last.map(function (b) {
          return '<tr class="click" data-o="' + b.id + '"><td><b>' + esc(b.mijoz_nom) + '</b><div class="muted" style="font-size:0.7812rem">' + fdate(b.sana) + " · " + b.dona + ' dona</div></td><td>' + holatBadge(b.holat) +
            '</td><td class="n">' + som(b.tushum) + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="muted">Buyurtma yo‘q.</div>') + "</div></div>";
      el.innerHTML = h;

      Array.prototype.forEach.call(el.querySelectorAll("#davr button"), function (b) {
        b.onclick = function () { S.davr = b.dataset.d; pageDashboard(el); };
      });
      Array.prototype.forEach.call(el.querySelectorAll("#ck button"), function (b) {
        b.onclick = function () { S.chartKey = b.dataset.k; drawChart(); Array.prototype.forEach.call(el.querySelectorAll("#ck button"), function (x) { x.classList.toggle("on", x === b); }); };
      });
      Array.prototype.forEach.call(el.querySelectorAll("tr[data-o]"), function (tr) {
        tr.onclick = function () { buyurtmaForm(res[1].filter(function (b) { return b.id === +tr.dataset.o; })[0]); };
      });
      function drawChart() {
        chart(el.querySelector("#chart"), d.seriya, S.chartKey, S.chartKey === "foyda" ? "var(--ok)" : "var(--accent)");
      }
      drawChart();
      window.onresize = drawChart;
    }).catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });

    function kpi(icon, t, v, sub, dl) {
      return '<div class="card kpi"><div class="h"><span class="ic">' + ic(icon) + "</span>" + t + '</div><div class="v">' + v +
        " " + dl + "<small>" + sub + "</small></div></div>";
    }
    function pl(t, v) { return '<div class="r"><span>' + t + "</span><span>" + som(v) + "</span></div>"; }
  }

  /* ── buyurtmalar ──────────────────────────────────────────────── */
  function pageBuyurtmalar(el) {
    var f = S.fb || (S.fb = { q: "", holat: "", tur: "" });
    var TABS = [["", "Hammasi", "list"], ["sotuv", "Sotuvlar", "shopping-bag"], ["reklama", "Reklama", "megaphone"], ["sovga", "Sovg‘a", "gift"]];
    el.innerHTML = '<div class="toolbar"><div class="seg eq" id="turtab">' + TABS.map(function (x) {
        return '<button data-t="' + x[0] + '" class="' + (x[0] === f.tur ? "on" : "") + '">' + ic(x[2]) + x[1] + "</button>";
      }).join("") + "</div>" +
      '<input type="search" id="q" placeholder="Mijoz, telefon, izoh…" value="' + esc(f.q) + '">' +
      '<select id="holat"><option value="">Barcha holatlar</option>' + opts(HOLAT, f.holat) + "</select>" +
      "</div>" +
      (S.mijozFilter ? '<div class="alert" style="display:flex;justify-content:space-between;align-items:center;gap:0.625rem">Bitta mijozning buyurtmalari ko‘rsatilmoqda <button class="btn sm" id="clrf">Hammasini ko‘rsat</button></div>' : "") +
      '<div class="card tcard" id="tbl"><div class="empty">Yuklanmoqda…</div></div>';
    var timer;
    el.querySelector("#q").oninput = function (e) { f.q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
    el.querySelector("#holat").onchange = function (e) { f.holat = e.target.value; load(); };
    Array.prototype.forEach.call(el.querySelectorAll("#turtab button"), function (b) {
      b.onclick = function () {
        f.tur = b.dataset.t;
        Array.prototype.forEach.call(el.querySelectorAll("#turtab button"), function (x) { x.classList.toggle("on", x === b); });
        load();
      };
    });
    var clr = el.querySelector("#clrf");
    if (clr) clr.onclick = function () { S.mijozFilter = null; render(); };
    load();

    function load() {
      var qs = "?q=" + encodeURIComponent(f.q) + "&holat=" + f.holat + "&tur=" + f.tur + (S.mijozFilter ? "&mijoz=" + S.mijozFilter : "");
      list("/buyurtmalar/" + qs).then(function (rows) {
        var box = el.querySelector("#tbl");
        if (!rows.length) { box.innerHTML = '<div class="empty">Buyurtma topilmadi.</div>'; return; }
        var foyda = S.me.foyda;
        box.innerHTML = '<table class="tbl stack"><thead><tr><th class="hide-l">№</th><th>Sana</th><th>Mijoz</th><th class="xl">Telefon</th><th>Turi</th><th>Holati</th><th class="hide-l">Yetkazish</th><th class="xl">Qayerdan</th><th class="n">Dona</th><th class="n">Tushum</th>' +
          (foyda ? '<th class="n">Qolgan summa</th>' : "") + "<th>To‘lov</th><th></th></tr></thead><tbody>" + rows.map(function (b) {
            return '<tr class="click" data-id="' + b.id + '"><td class="hide-m hide-l">#' + b.id + '</td><td class="c-sub">' + fdate(b.sana) + '</td><td class="c-main">' + esc(b.mijoz_nom) +
              '</td><td class="xl muted">' + esc(b.mijoz_telefon || "") + '</td><td class="c-sub">' + turBadge(b.tur) + '</td><td class="c-sub">' + holatQuick(b) + '</td><td class="c-sub hide-l">' + yetLabel(b.yetkazish_turi, yetNom(b)) + '</td><td class="xl muted">' + esc(b.manba_nom || "") +
              '</td><td class="n c-sub">' + b.dona + ' dona</td><td class="n c-amt">' + (b.tur === "sotuv" ? som(b.tushum) : '<span class="muted">tekin</span>') + '</td><td class="br"></td>' +
              (foyda ? '<td class="n c-sub' + (b.qolgan_summa ? "" : " hide-m") + '" data-l="Qolgan">' + som(b.qolgan_summa) + "</td>" : "") +
              '<td class="c-sub' + (b.tolov_holati === "—" ? " hide-m" : "") + '">' + tolovBadge(b.tolov_holati) + '</td><td class="c-sub pr"><button type="button" class="icon-x" data-p="' + b.id + '" title="Stiker chop etish" aria-label="Stiker chop etish">' + ic("printer") + "</button></td></tr>";
          }).join("") + "</tbody></table>";
        Array.prototype.forEach.call(box.querySelectorAll("tr[data-id]"), function (tr) {
          tr.onclick = function () { buyurtmaForm(rows.filter(function (b) { return b.id === +tr.dataset.id; })[0]); };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-p]"), function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            stikerOyna(rows.filter(function (b) { return b.id === +btn.dataset.p; })[0]);
          };
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-q]"), function (btn) {
          btn.onclick = function (e) {
            e.stopPropagation();
            holatTanla(rows.filter(function (b) { return b.id === +btn.dataset.q; })[0], load);
          };
        });
      }).catch(function (e) { el.querySelector("#tbl").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
    }
  }

  function loadRef() {
    return Promise.all([list("/mijozlar/"), list("/mahsulotlar/")]).then(function (r) {
      S.cache.mijozlar = r[0]; S.cache.mahsulotlar = r[1];
    });
  }

  function buyurtmaForm(b) {
    Promise.all([loadRef(), loadBts()]).then(function () {
      var mijozlar = S.cache.mijozlar, mahsulotlar = S.cache.mahsulotlar.filter(function (m) { return m.faol || (b && b.qatorlar.some(function (q) { return q.mahsulot === m.id; })); });
      var edit = !!b;
      b = b || { sana: today(), tur: "sotuv", holat: "yangi", manba: "ig_reklama", tolov_usuli: "naqd", chegirma: 0, yetkazish_turi: "yandex", yetkazish_xarajati: 0, tolangan: 0, chegirma_izoh: "", izoh: "", qatorlar: [], bonuslar: [] };
      var cur = edit ? mijozlar.filter(function (m) { return m.id === b.mijoz; })[0] : null;
      var foyda = S.me.foyda;
      var qator = b.qatorlar.length ? b.qatorlar : [{ mahsulot: mahsulotlar[0] && mahsulotlar[0].id, miqdor: 1, narx: null }];

      var body =
        '<div class="field"><label>Mijoz</label><input name="mijoz_ism" list="mlist" placeholder="Ism yozing yoki tanlang" value="' + esc(cur ? cur.ism : "") + '" autocomplete="off">' +
        '<datalist id="mlist">' + mijozlar.map(function (m) { return '<option value="' + esc(m.ism) + '">' + esc(m.telefon) + "</option>"; }).join("") + "</datalist></div>" +
        '<div class="row2"><div class="field"><label>Telefon</label><input name="mijoz_tel" type="tel" inputmode="tel" placeholder="+998 90 123 45 67" value="' + esc((cur && cur.telefon) || TEL0) + '"></div>' +
        '<div class="field"><label>Telegram / Instagram</label><input name="mijoz_user" placeholder="@username" value="' + esc(cur ? cur.username : "") + '"></div></div>' +
        chipField("tur", "Turi <span style=\"font-weight:400;color:var(--faint)\">(reklama va sovg‘a — tekin)</span>", TUR, b.tur, TUR_IC, { sotuv: "Sotuv", reklama: "Reklama", sovga: "Sovg‘a" }) +
        '<div class="row2 keep"><div class="field"><label>Sana</label><input type="date" name="sana" value="' + esc(b.sana) + '"></div>' +
        '<div class="field"><label>Qayerdan keldi</label><select name="manba">' + opts(MANBA, b.manba) + "</select></div></div>" +
        chipField("holat", "Holati", HOLAT, b.holat, HOLAT_IC) +
        '<div class="sec">Mahsulotlar</div><div class="ith" id="ith"><span>Mahsulot</span><span>Soni</span><span>Narxi (so‘m)</span></div><div class="items" id="items"></div>' +
        '<button class="btn sm" type="button" id="addrow">' + ic("plus") + "Mahsulot qo‘shish</button>" +
        '<div class="sec">Bonus (sovg‘a)</div><div class="items bonus" id="bonus"></div>' +
        '<button class="btn sm" type="button" id="addbonus">' + ic("plus") + "Bonus qo‘shish</button>" +
        '<div data-pay><div class="sec">Narx va to‘lov</div>' +
        '<div class="row2"><div class="field"><label>Chegirma (so‘m)</label><input type="number" min="0" name="chegirma" value="' + b.chegirma + '"></div>' +
        '<div class="field"><label>Chegirma sababi</label><input name="chegirma_izoh" value="' + esc(b.chegirma_izoh) + '"></div></div></div>' +
        '<div class="sec">Yetkazish</div>' +
        chipField("yetkazish_turi", "Yetkazish turi", YET, b.yetkazish_turi || "yandex", YET_IC, { pochta: "Pochta", ozim: "O‘zim olib beraman", ozi: "O‘zi olib ketadi" }) +
        '<div data-poch>' + chipField("pochta", "Qaysi pochta?", POCHTA, b.pochta || "bts", {}) +
        '<div class="row2 keep"><div class="field"><label>Viloyat</label><select name="viloyat"><option value="">Tanlang…</option>' +
        VILOYAT.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field" data-bts><label>Tuman / shahar</label><select id="btstuman"><option value="">Hammasi</option></select></div></div>' +
        '<div class="field" data-bts><label>BTS filiali</label><select name="bts_filial"><option value="">Avval viloyatni tanlang</option></select><div class="btsinfo" id="btsinfo"></div></div>' +
        '</div>' +
        (foyda ? '<div class="field" data-yx><label>Yetkazish xarajati (so‘m)</label><input type="number" min="0" name="yetkazish_xarajati" value="' + b.yetkazish_xarajati + '"></div>' : "") +
        '<div class="row2" data-pay><div class="field"><label>To‘lov usuli</label><select name="tolov_usuli">' + opts(TOLOV, b.tolov_usuli) + "</select></div>" +
        '<div class="field"><label>To‘langan summa <a href="#" id="full" style="font-weight:600">to‘liq</a></label><input type="number" min="0" name="tolangan" value="' + b.tolangan + '"></div></div>' +
        '<div class="field"><label>Izoh</label><textarea name="izoh">' + esc(b.izoh) + "</textarea></div>" +
        '<div class="summary" id="sum"></div>';

      drawer({
        title: edit ? "Buyurtma #" + b.id : "Yangi buyurtma",
        body: body,
        onOpen: function (ov) {
          var items = ov.querySelector("#items"), bonus = ov.querySelector("#bonus");
          bindChips(ov);
          btsOrnat(ov, b);
          ov.querySelector('[name="mijoz_ism"]').addEventListener("input", function (e) {
            var m = mijozlar.filter(function (x) { return x.ism.toLowerCase() === e.target.value.trim().toLowerCase(); })[0];
            var tel = ov.querySelector('[name="mijoz_tel"]'), us = ov.querySelector('[name="mijoz_user"]');
            if (m && telTozala(tel.value) === "" && m.telefon) tel.value = m.telefon;
            if (m && !us.value && m.username) us.value = m.username;
          });
          function row(q) {
            var d = document.createElement("div");
            d.className = "it";
            d.innerHTML = '<select data-f="mahsulot">' + opts(mahsulotlar, q.mahsulot) + "</select>" +
              '<input type="number" min="1" data-f="miqdor" value="' + (q.miqdor || 1) + '" title="Soni">' +
              '<input type="number" min="0" data-f="narx" placeholder="narx" value="' + (q.narx === null || q.narx === undefined ? (mah(q.mahsulot) || {}).narx || "" : q.narx) + '" title="Narxi (so‘m). Mahsulot narxi avtomatik qo‘yiladi, kerak bo‘lsa o‘zgartiring.">' +
              '<button type="button" class="icon-x" data-rm title="Olib tashlash">' + ic("x") + "</button>";
            if (q.id) d.dataset.id = q.id;
            d.querySelector("[data-rm]").onclick = function () { d.remove(); calc(); };
            d.querySelector('[data-f="mahsulot"]').addEventListener("change", function () {
              d.querySelector('[data-f="narx"]').value = (mah(this.value) || {}).narx || "";
            });
            items.appendChild(d);
          }
          function bonusRow(x) {
            var d = document.createElement("div");
            d.className = "it bn";
            d.innerHTML = '<input data-f="nom" placeholder="Bonus nomi" value="' + esc(x.nom || "") + '">' +
              (foyda ? '<input type="number" min="0" data-f="tannarx" placeholder="tannarx" value="' + (x.tannarx || "") + '" title="Ixtiyoriy: sizga qanchaga tushgan">' : "") +
              '<button type="button" class="icon-x" data-rm title="Olib tashlash">' + ic("x") + "</button>";
            d.querySelector("[data-rm]").onclick = function () { d.remove(); calc(); };
            bonus.appendChild(d);
          }
          qator.forEach(row);
          (b.bonuslar || []).forEach(bonusRow);
          ov.querySelector("#addrow").onclick = function () {
            row({ mahsulot: mahsulotlar[0] && mahsulotlar[0].id, miqdor: 1, narx: null }); calc();
          };
          ov.querySelector("#addbonus").onclick = function () { bonusRow({}); calc(); };
          ov.querySelector("#full").onclick = function (e) {
            e.preventDefault(); calc(); ov.querySelector('[name="tolangan"]').value = ov._tushum || 0; calc();
          };
          function mah(id) { return mahsulotlar.filter(function (m) { return String(m.id) === String(id); })[0]; }
          function calc() {
            var tur = val(ov, "tur"), jami = 0, tannarx = 0, bonusCost = 0;
            Array.prototype.forEach.call(items.querySelectorAll(".it"), function (r) {
              var m = mah(r.querySelector('[data-f="mahsulot"]').value) || {};
              var q = parseInt(r.querySelector('[data-f="miqdor"]').value, 10) || 0;
              var narxEl = r.querySelector('[data-f="narx"]');
              var narx = narxEl.value === "" ? (m.narx || 0) : parseInt(narxEl.value, 10) || 0;
              jami += q * narx;
              tannarx += q * (m.tannarx || 0);
            });
            Array.prototype.forEach.call(bonus.querySelectorAll(".it"), function (r) {
              var t = r.querySelector('[data-f="tannarx"]');
              if (t) bonusCost += parseInt(t.value, 10) || 0;
            });
            var tekin = tur !== "sotuv";
            Array.prototype.forEach.call(ov.querySelectorAll("[data-pay]"), function (e) { e.classList.toggle("hide", tekin); });
            items.classList.toggle("tekin", tekin);
            ov.querySelector("#ith").classList.toggle("tekin", tekin);
            var oziOladi = val(ov, "yetkazish_turi") === "ozi";
            Array.prototype.forEach.call(ov.querySelectorAll("[data-yx]"), function (e) { e.classList.toggle("hide", oziOladi); });
            var pochtaOrqali = val(ov, "yetkazish_turi") === "pochta";
            ov.querySelector("[data-poch]").classList.toggle("hide", !pochtaOrqali);
            Array.prototype.forEach.call(ov.querySelectorAll("[data-bts]"), function (e) { e.classList.toggle("hide", !pochtaOrqali || val(ov, "pochta") !== "bts"); });
            var ch = tekin ? 0 : Math.min(intv(ov, "chegirma"), jami);
            var tushum = tekin || val(ov, "holat") === "bekor" ? 0 : Math.max(0, jami - ch);
            ov._tushum = tushum;
            var yetkazish = foyda && !oziOladi ? intv(ov, "yetkazish_xarajati") : 0;
            ov.querySelector("#sum").innerHTML =
              '<div class="r"><span>Mahsulotlar</span><span>' + (tekin ? "tekin" : som(jami) + " so‘m") + "</span></div>" +
              (tekin ? "" : '<div class="r"><span>Chegirma</span><span>− ' + som(ch) + "</span></div>") +
              '<div class="r tot"><span>Tushum</span><span>' + som(tushum) + " so‘m</span></div>" +
              (foyda ? '<div class="r"><span>Yetkazib berish narxi</span><span>− ' + som(yetkazish) + " so‘m</span></div>" +
                '<div class="r tot"><span>Qolgan summa</span><span class="' + (tushum - yetkazish < 0 ? "neg" : "") + '">' + som(tushum - yetkazish) + " so‘m</span></div>" : "");
          }
          ov.addEventListener("input", calc);
          ov.addEventListener("change", calc);
          calc();
        },
        onSave: function (ov) {
          var ism = val(ov, "mijoz_ism").trim();
          if (!ism) { toast("Mijoz ismini yozing.", true); return false; }
          var qatorlar = [], bonuslar = [];
          Array.prototype.forEach.call(ov.querySelectorAll("#items .it"), function (r) {
            var q = {
              mahsulot: parseInt(r.querySelector('[data-f="mahsulot"]').value, 10),
              miqdor: parseInt(r.querySelector('[data-f="miqdor"]').value, 10) || 1,
              narx: null,
            };
            var narx = r.querySelector('[data-f="narx"]').value;
            if (narx !== "" && val(ov, "tur") === "sotuv") q.narx = parseInt(narx, 10);
            if (r.dataset.id) q.id = +r.dataset.id;
            qatorlar.push(q);
          });
          if (!qatorlar.length) { toast("Kamida bitta mahsulot qo‘shing.", true); return false; }
          Array.prototype.forEach.call(ov.querySelectorAll("#bonus .it"), function (r) {
            var nom = r.querySelector('[data-f="nom"]').value.trim();
            var t = r.querySelector('[data-f="tannarx"]');
            if (nom) bonuslar.push({ nom: nom, tannarx: t ? parseInt(t.value, 10) || 0 : 0 });
          });
          var mavjud = S.cache.mijozlar.filter(function (m) { return m.ism.toLowerCase() === ism.toLowerCase(); })[0];
          var mijozData = { ism: ism, telefon: telTozala(val(ov, "mijoz_tel")), username: val(ov, "mijoz_user").trim() };
          if (mavjud) {      // bo'sh qoldirilsa, mijozning eski telefon/username'i o'chib ketmasin
            mijozData.telefon = mijozData.telefon || mavjud.telefon;
            mijozData.username = mijozData.username || mavjud.username;
          }
          var p = mavjud
            ? (mavjud.telefon !== mijozData.telefon || mavjud.username !== mijozData.username
              ? api("/mijozlar/" + mavjud.id + "/", { method: "PATCH", body: mijozData }) : Promise.resolve(mavjud))
            : api("/mijozlar/", { method: "POST", body: mijozData });
          var tekinTur = val(ov, "tur") !== "sotuv";
          return p.then(function (m) {
            var data = {
              mijoz: m.id, sana: val(ov, "sana"), tur: val(ov, "tur"), holat: val(ov, "holat"), manba: val(ov, "manba"),
              chegirma: tekinTur ? 0 : intv(ov, "chegirma"), chegirma_izoh: tekinTur ? "" : val(ov, "chegirma_izoh"),
              tolov_usuli: val(ov, "tolov_usuli"), tolangan: tekinTur ? 0 : intv(ov, "tolangan"),
              izoh: val(ov, "izoh"), qatorlar: qatorlar, bonuslar: bonuslar,
              yetkazish_turi: val(ov, "yetkazish_turi"),
            };
            var pochtaOrqali = data.yetkazish_turi === "pochta";
            data.pochta = pochtaOrqali ? val(ov, "pochta") : "";
            data.viloyat = pochtaOrqali ? val(ov, "viloyat") : "";
            data.bts_filial = pochtaOrqali && data.pochta === "bts" ? val(ov, "bts_filial") : "";
            if (S.me.foyda) data.yetkazish_xarajati = data.yetkazish_turi === "ozi" ? 0 : intv(ov, "yetkazish_xarajati");
            return api(edit ? "/buyurtmalar/" + b.id + "/" : "/buyurtmalar/", { method: edit ? "PUT" : "POST", body: data });
          }).then(function () { toast("Saqlandi"); S.cache = {}; render(); });
        },
        onDelete: edit ? function () {
          return api("/buyurtmalar/" + b.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
        } : null,
      });
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ── mijozlar ─────────────────────────────────────────────────── */
  function pageMijozlar(el) {
    el.innerHTML = '<div class="toolbar"><input type="search" id="q" placeholder="Ism, telefon, username…">' +
      '<span class="sp"></span><button class="btn pri" id="new">' + ic("plus") + "Yangi mijoz</button></div>" +
      '<div class="card tcard" id="tbl"><div class="empty">Yuklanmoqda…</div></div>';
    var timer;
    el.querySelector("#q").oninput = function (e) { clearTimeout(timer); timer = setTimeout(function () { load(e.target.value); }, 250); };
    el.querySelector("#new").onclick = function () { mijozForm(null); };
    load("");
    function load(q) {
      list("/mijozlar/?q=" + encodeURIComponent(q)).then(function (rows) {
        var box = el.querySelector("#tbl");
        if (!rows.length) { box.innerHTML = '<div class="empty">Mijoz topilmadi.</div>'; return; }
        var foyda = S.me.foyda;
        box.innerHTML = '<table class="tbl stack"><thead><tr><th>Ism</th><th>Telefon</th><th>Username</th><th>Manzil</th><th class="n">Buyurtma</th>' +
          (foyda ? '<th class="n">Jami</th>' : "") + "</tr></thead><tbody>" + rows.map(function (m) {
            return '<tr class="click" data-id="' + m.id + '"><td class="c-main">' + esc(m.ism) + '</td><td class="c-sub">' + esc(m.telefon) + '</td><td class="c-sub">' + esc(m.username) +
              '</td><td class="c-sub">' + esc(m.manzil) + '</td><td class="n c-amt">' + m.buyurtma_soni + ' ta</td><td class="br"></td>' +
              (foyda ? '<td class="n c-sub" data-l="Jami">' + som(m.jami_summa) + "</td>" : "") + "</tr>";
          }).join("") + "</tbody></table>";
        Array.prototype.forEach.call(box.querySelectorAll("tr[data-id]"), function (tr) {
          tr.onclick = function () { mijozForm(rows.filter(function (m) { return m.id === +tr.dataset.id; })[0]); };
        });
      }).catch(function (e) { el.querySelector("#tbl").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
    }
  }
  function mijozForm(m) {
    var edit = !!m; m = m || { ism: "", telefon: "", username: "", manzil: "", izoh: "" };
    drawer({
      title: edit ? m.ism : "Yangi mijoz",
      body: '<div class="field"><label>Ism</label><input name="ism" value="' + esc(m.ism) + '"></div>' +
        '<div class="row2"><div class="field"><label>Telefon</label><input name="telefon" type="tel" inputmode="tel" placeholder="+998 90 123 45 67" value="' + esc(m.telefon || TEL0) + '"></div>' +
        '<div class="field"><label>Telegram / Instagram</label><input name="username" value="' + esc(m.username) + '"></div></div>' +
        '<div class="field"><label>Manzil / shahar</label><input name="manzil" value="' + esc(m.manzil) + '"></div>' +
        '<div class="field"><label>Izoh</label><textarea name="izoh">' + esc(m.izoh) + "</textarea></div>" +
        (edit ? '<a class="btn sm" href="#/buyurtmalar" id="ords">Buyurtmalarini ko‘rish</a>' : ""),
      onOpen: function (ov) {
        var a = ov.querySelector("#ords");
        if (a) a.onclick = function () { S.mijozFilter = m.id; ov.close(); };
      },
      onSave: function (ov) {
        var data = { ism: val(ov, "ism").trim(), telefon: telTozala(val(ov, "telefon")), username: val(ov, "username"), manzil: val(ov, "manzil"), izoh: val(ov, "izoh") };
        if (!data.ism) { toast("Ismni yozing.", true); return false; }
        return api(edit ? "/mijozlar/" + m.id + "/" : "/mijozlar/", { method: edit ? "PUT" : "POST", body: data })
          .then(function () { toast("Saqlandi"); S.cache = {}; render(); });
      },
      onDelete: edit ? function () {
        return api("/mijozlar/" + m.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
      } : null,
    });
  }

  /* ── xarajatlar ───────────────────────────────────────────────── */
  function pageXarajatlar(el) {
    el.innerHTML = '<div class="toolbar"><span class="sp"></span><button class="btn pri" id="new">' + ic("plus") + "Xarajat qo‘shish</button></div>" +
      '<div class="card tcard" id="tbl"><div class="empty">Yuklanmoqda…</div></div>';
    el.querySelector("#new").onclick = function () { xarajatForm(null); };
    list("/xarajatlar/").then(function (rows) {
      var box = el.querySelector("#tbl");
      if (!rows.length) { box.innerHTML = '<div class="empty">Xarajat kiritilmagan.</div>'; return; }
      box.innerHTML = '<table class="tbl stack"><thead><tr><th>Sana</th><th>Turi</th><th>Izoh</th><th class="n">Summa</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr class="click" data-id="' + x.id + '"><td class="c-sub">' + fdate(x.sana) + '</td><td class="c-main"><span class="badge ' + (x.kategoriya === "material" ? "" : "acc") + '">' + esc(x.kategoriya_nom) +
            '</span></td><td class="c-sub">' + esc(x.izoh) + '</td><td class="n c-amt"><b>' + som(x.summa) + '</b></td><td class="br"></td></tr>';
        }).join("") + "</tbody></table>";
      Array.prototype.forEach.call(box.querySelectorAll("tr[data-id]"), function (tr) {
        tr.onclick = function () { xarajatForm(rows.filter(function (x) { return x.id === +tr.dataset.id; })[0]); };
      });
    }).catch(function (e) { el.querySelector("#tbl").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }
  function xarajatForm(x) {
    var edit = !!x; x = x || { sana: today(), kategoriya: "reklama", summa: "", izoh: "" };
    drawer({
      title: edit ? "Xarajat" : "Yangi xarajat",
      body: '<div class="row2"><div class="field"><label>Sana</label><input type="date" name="sana" value="' + esc(x.sana) + '"></div>' +
        '<div class="field"><label>Turi</label><select name="kategoriya">' + opts(XKAT, x.kategoriya) + "</select></div></div>" +
        '<div class="field"><label>Summa (so‘m)</label><input type="number" min="0" name="summa" value="' + esc(x.summa) + '"></div>' +
        '<div class="field"><label>Izoh</label><input name="izoh" value="' + esc(x.izoh) + '"></div>',
      onSave: function (ov) {
        var data = { sana: val(ov, "sana"), kategoriya: val(ov, "kategoriya"), summa: intv(ov, "summa"), izoh: val(ov, "izoh") };
        if (!data.summa) { toast("Summani yozing.", true); return false; }
        return api(edit ? "/xarajatlar/" + x.id + "/" : "/xarajatlar/", { method: edit ? "PUT" : "POST", body: data })
          .then(function () { toast("Saqlandi"); render(); });
      },
      onDelete: edit ? function () {
        return api("/xarajatlar/" + x.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
      } : null,
    });
  }

  /* ── ombor ────────────────────────────────────────────────────── */
  var HAR_IC = { kirim: "arrow-down-to-line", chiqim: "arrow-up-from-line", tuzatish: "sliders-horizontal" };
  function stokHolat(t) {
    if (t.qoldiq < 0) return ["bad", "circle-x", "Yetishmaydi"];
    if (t.qoldiq === 0) return ["bad", "circle-x", "Tugagan"];
    if (t.kam) return ["warn", "triangle-alert", "Kam qoldi"];
    return ["ok", "circle-check", "Yetarli"];
  }
  // Ombor harakati — bitta qator (tovar sahifasida tovar nomi kerak emas)
  function harRow(h, tovarNomi) {
    var t = h.turi, info = [fdate(h.sana)];
    var nom = t === "kirim" ? "Kirim" : t === "chiqim" ? "Buyurtmaga ketdi" : "Tuzatish";
    if (t === "chiqim" && h.buyurtma && String(h.izoh || "").indexOf("#" + h.buyurtma) < 0) info.push("Buyurtma #" + h.buyurtma);
    if (t === "kirim" && h.birlik_narx) info.push(Math.abs(h.miqdor) + " × " + som(h.birlik_narx) + (h.jami ? " = " + som(h.jami) + " so‘m" : ""));
    if (h.izoh) info.push(esc(h.izoh));
    return '<div class="hrow ' + (t === "chiqim" || h.buyurtma ? "" : "click") + '" data-id="' + h.id + '"><span class="hic ' + t + '">' + ic(HAR_IC[t] || "sliders-horizontal") + "</span>" +
      '<div class="hm"><b>' + (tovarNomi ? esc(h.tovar_nom) + ' <span class="muted">· ' + nom + "</span>" : nom) + "</b><small>" + info.join(" · ") + "</small></div>" +
      '<div class="hq ' + (h.miqdor < 0 ? "neg" : "pos") + '">' + (h.miqdor > 0 ? "+" : "") + h.miqdor + "</div></div>";
  }

  function pageOmbor(el) {
    var TABS = [["qoldiq", "Qoldiq", "boxes"], ["tarix", "Tarix", "history"]];
    el.innerHTML = '<div class="toolbar"><div class="seg eq" id="otab">' + TABS.map(function (x) {
        return '<button data-t="' + x[0] + '" class="' + (x[0] === (S.omborTab || "qoldiq") ? "on" : "") + '">' + ic(x[2]) + x[1] + "</button>";
      }).join("") + '</div><span class="sp"></span><button class="btn" id="nt">' + ic("plus") + "Yangi tovar</button>" +
      '<button class="btn pri" id="kirim">' + ic("arrow-down-to-line") + "Kirim</button></div>" +
      '<div id="ob"><div class="empty">Yuklanmoqda…</div></div>';
    Promise.all([list("/ombor/"), list("/harakatlar/")]).then(function (res) {
      var tov = res[0], har = res[1], ob = el.querySelector("#ob");
      el.querySelector("#nt").onclick = function () { tovarForm(null); };
      el.querySelector("#kirim").onclick = function () { harakatForm(tov, null, { turi: "kirim" }); };
      Array.prototype.forEach.call(el.querySelectorAll("#otab button"), function (b) {
        b.onclick = function () {
          S.omborTab = b.dataset.t;
          Array.prototype.forEach.call(el.querySelectorAll("#otab button"), function (x) { x.classList.toggle("on", x === b); });
          draw();
        };
      });
      function tovarById(id) { return tov.filter(function (t) { return t.id === +id; })[0]; }
      function draw() {
        if ((S.omborTab || "qoldiq") === "tarix") {
          ob.innerHTML = har.length ? '<div class="card hist">' + har.map(function (h) { return harRow(h, true); }).join("") + "</div>"
            : '<div class="empty">Hali harakat yo‘q. Birinchi «Kirim»ni yozing.</div>';
          Array.prototype.forEach.call(ob.querySelectorAll(".hrow.click"), function (r) {
            r.onclick = function () { harakatForm(tov, har.filter(function (h) { return h.id === +r.dataset.id; })[0]); };
          });
          return;
        }
        var how = '<details class="howto"' + (tov.length && har.length ? "" : " open") + "><summary>" + ic("info") + "Ombor qanday ishlaydi?</summary><ol>" +
          "<li><b>Tovar qo‘shing</b> — ombordagi narsa: banka, quti, qopqoq… («Yangi tovar»)</li>" +
          "<li><b>Sotib olganingizda «Kirim»</b> bosing: nechta kelgani va dona narxini yozing. Xohlasangiz xarajatga ham yoziladi.</li>" +
          "<li><b>Mahsulotlar</b> bo‘limida har bir mahsulot sotilganda qaysi tovardan nechta ketishini belgilang.</li>" +
          "<li>Shundan so‘ng <b>buyurtma qilganingizda qoldiq o‘zi kamayadi</b>. Buzilsa yoki sanoqda farq chiqsa — «Tuzatish».</li></ol></details>";
        if (!tov.length) { ob.innerHTML = how + '<div class="empty">Ombor bo‘sh. «Yangi tovar» bilan boshlang.</div>'; return; }
        ob.innerHTML = how + '<div class="stock">' + tov.map(function (t) {
          var sh = stokHolat(t);
          return '<div class="scard click" data-id="' + t.id + '"><div class="sh"><span class="sic">' + ic("package") + '</span><div class="sn"><b>' + esc(t.nom) + "</b><small>" +
            (t.min_qoldiq > 0 ? "Kam qoldiq chegarasi: " + t.min_qoldiq : "Chegara belgilanmagan") + "</small></div>" + badge(sh[0], sh[1], sh[2]) + "</div>" +
            '<div class="sq ' + (t.qoldiq <= 0 ? "neg" : "") + '"><b>' + t.qoldiq + "</b><span>" + esc(t.birlik) + " qoldi</span></div>" +
            (t.qoldiq < 0 ? '<div class="sw">Sotilgan, lekin omborga kirim yozilmagan. «Kirim» bosib, sotib olganingizni yozing.</div>' : "") +
            '<div class="sa"><button class="btn sm" data-k>' + ic("arrow-down-to-line") + 'Kirim</button><button class="btn sm" data-z>' + ic("sliders-horizontal") + "Tuzatish</button></div></div>";
        }).join("") + "</div>";
        Array.prototype.forEach.call(ob.querySelectorAll(".scard"), function (c) {
          var t = tovarById(c.dataset.id);
          c.onclick = function () { tovarForm(t); };
          c.querySelector("[data-k]").onclick = function (e) { e.stopPropagation(); harakatForm(tov, null, { turi: "kirim", tovar: t.id }); };
          c.querySelector("[data-z]").onclick = function (e) { e.stopPropagation(); harakatForm(tov, null, { turi: "tuzatish", tovar: t.id }); };
        });
      }
      draw();
    }).catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }
  function tovarForm(t) {
    var edit = !!t; t = t || { nom: "", birlik: "dona", min_qoldiq: 0 };
    drawer({
      title: edit ? t.nom : "Yangi tovar",
      body: (edit ? '<div class="summary" style="margin:0 0 14px"><div class="r tot" style="border:0;margin:0;padding:0"><span>Hozirgi qoldiq</span><span>' + t.qoldiq + " " + esc(t.birlik) + "</span></div></div>" : "") +
        '<div class="field"><label>Nomi</label><input name="nom" value="' + esc(t.nom) + '" placeholder="Shisha banka"></div>' +
        '<div class="row2"><div class="field"><label>Birlik</label><input name="birlik" value="' + esc(t.birlik) + '"><small>dona, kg, metr…</small></div>' +
        '<div class="field"><label>Kam qoldiq chegarasi</label><input type="number" min="0" name="min_qoldiq" value="' + t.min_qoldiq + '"><small>Qoldiq shundan oshmasa «Kam qoldi» deb ogohlantiradi</small></div></div>' +
        (edit ? '<div class="sec">So‘nggi harakatlar</div><div class="hist" id="thist"><div class="muted">Yuklanmoqda…</div></div>' : ""),
      onOpen: edit ? function (ov) {
        list("/harakatlar/?tovar=" + t.id).then(function (rows) {
          ov.querySelector("#thist").innerHTML = rows.slice(0, 10).map(function (h) { return harRow(h, false); }).join("") || '<div class="muted">Hali harakat yo‘q.</div>';
        }).catch(function () { ov.querySelector("#thist").innerHTML = '<div class="muted">Yuklab bo‘lmadi.</div>'; });
      } : null,
      onSave: function (ov) {
        var data = { nom: val(ov, "nom").trim(), birlik: val(ov, "birlik") || "dona", min_qoldiq: intv(ov, "min_qoldiq") };
        if (!data.nom) { toast("Nomini yozing.", true); return false; }
        return api(edit ? "/ombor/" + t.id + "/" : "/ombor/", { method: edit ? "PUT" : "POST", body: data }).then(function () { toast("Saqlandi"); render(); });
      },
      onDelete: edit ? function () {
        return api("/ombor/" + t.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
      } : null,
    });
  }
  function harakatForm(tov, h, pre) {
    var edit = !!h;
    pre = pre || {};
    if (!tov.length) { toast("Avval «Yangi tovar» qo‘shing.", true); return; }
    h = h || { tovar: pre.tovar || (tov[0] && tov[0].id), turi: pre.turi || "kirim", miqdor: "", birlik_narx: "", sana: today(), izoh: "", xarajatga: true, qoshimcha_xarajat: "" };
    var turi = h.turi === "kirim" ? "kirim" : "tuzatish";
    drawer({
      title: edit ? "Ombor harakati" : turi === "kirim" ? "Omborga kirim" : "Ombor tuzatishi",
      body: '<div class="field"><label>Tovar</label><select name="tovar">' + opts(tov, h.tovar) + "</select></div>" +
        chipField("turi", "Nima bo‘ldi?", [["kirim", "Kirim (sotib olindi)"], ["tuzatish", "Tuzatish (buzildi, yo‘qoldi, sanoq)"]], turi, HAR_IC, { kirim: "Kirim", tuzatish: "Tuzatish" }) +
        '<div class="row2 keep"><div class="field"><label id="mlabel">Omborga kirgan soni</label><input type="number" inputmode="numeric" name="miqdor" value="' + esc(h.miqdor) + '" placeholder="0"></div>' +
        '<div class="field" data-k><label>Dona narxi (so‘m)</label><input type="number" inputmode="numeric" min="0" name="birlik_narx" value="' + esc(h.birlik_narx || "") + '" placeholder="0"></div></div>' +
        '<div class="field" data-tz><small style="margin:-0.375rem 0 0">Kamaytirish uchun minus bilan yozing: <b>−3</b> (3 ta buzildi). Ko‘paytirish: <b>3</b>.</small></div>' +
        '<div data-k><div class="summary" id="ksum"></div>' +
        '<div class="field" style="margin-top:0.875rem"><label class="chk"><input type="checkbox" name="xarajatga"' + (h.xarajatga !== false ? " checked" : "") + '> Xarajat sifatida yozilsin</label></div>' +
        '<div class="field" data-x><label>Qo‘shimcha xarajat (yo‘l kira, olib kelish…) (so‘m)</label><input type="number" inputmode="numeric" min="0" name="qoshimcha_xarajat" value="' + esc(h.qoshimcha_xarajat || "") + '" placeholder="0">' +
        "<small>Xarid summasiga qo‘shilib, bitta xarajat bo‘lib yoziladi.</small></div></div>" +
        '<div class="field"><label>Sana</label><input type="date" name="sana" value="' + esc(h.sana) + '"></div>' +
        '<div class="field"><label>Izoh</label><input name="izoh" value="' + esc(h.izoh) + '" placeholder="Masalan: Chorsudan olindi"></div>',
      onOpen: function (ov) {
        bindChips(ov);
        function calc() {
          var kirim = val(ov, "turi") === "kirim";
          Array.prototype.forEach.call(ov.querySelectorAll("[data-k]"), function (e) { e.classList.toggle("hide", !kirim); });
          ov.querySelector("[data-tz]").classList.toggle("hide", kirim);
          ov.querySelector("#mlabel").textContent = kirim ? "Omborga kirgan soni" : "Qancha o‘zgardi? (−3 yoki +3)";
          var xg = ov.querySelector('[name="xarajatga"]').checked;
          ov.querySelector("[data-x]").classList.toggle("hide", !xg);
          var soni = Math.abs(intv(ov, "miqdor")), narx = intv(ov, "birlik_narx"), qosh = xg ? intv(ov, "qoshimcha_xarajat") : 0;
          var xarid = soni * narx, jami = xarid + qosh;
          ov.querySelector("#ksum").innerHTML =
            '<div class="r"><span>Xarid jami (' + soni + " × " + som(narx) + ")</span><span>" + som(xarid) + " so‘m</span></div>" +
            (xg ? '<div class="r"><span>Qo‘shimcha xarajat</span><span>+ ' + som(qosh) + " so‘m</span></div>" +
              '<div class="r tot"><span>Xarajatga yoziladi</span><span>' + som(jami) + " so‘m</span></div>"
              : '<div class="r tot"><span>Xarajatga yozilmaydi</span><span>—</span></div>') +
            (soni && jami ? '<div class="r"><span>Bitta dona tannarxi' + (qosh ? " (yo‘l bilan)" : "") + "</span><span>" + som(Math.round(jami / soni)) + " so‘m</span></div>" : "");
        }
        ov.addEventListener("input", calc);
        ov.addEventListener("change", calc);
        calc();
      },
      onSave: function (ov) {
        var kirim = val(ov, "turi") === "kirim", xg = ov.querySelector('[name="xarajatga"]').checked;
        var data = { tovar: parseInt(val(ov, "tovar"), 10), turi: val(ov, "turi"), miqdor: parseInt(val(ov, "miqdor"), 10), sana: val(ov, "sana"), izoh: val(ov, "izoh"),
          birlik_narx: kirim ? intv(ov, "birlik_narx") : 0, xarajatga: kirim ? xg : false,
          qoshimcha_xarajat: kirim && xg ? intv(ov, "qoshimcha_xarajat") : 0 };
        if (!data.miqdor) { toast("Sonini yozing.", true); return false; }
        return api(edit ? "/harakatlar/" + h.id + "/" : "/harakatlar/", { method: edit ? "PUT" : "POST", body: data }).then(function () { toast("Saqlandi"); render(); });
      },
      onDelete: edit ? function () {
        return api("/harakatlar/" + h.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
      } : null,
    });
  }

  /* ── mahsulotlar ──────────────────────────────────────────────── */
  function pageMahsulotlar(el) {
    el.innerHTML = '<div class="toolbar"><span style="flex:1"></span>' + (S.me.foyda ? '<button class="btn pri" id="new">' + ic("plus") + "Yangi mahsulot</button>" : "") + "</div>" +
      '<div class="grid g3" id="cards"><div class="empty">Yuklanmoqda…</div></div>';
    list("/mahsulotlar/").then(function (rows) {
      var box = el.querySelector("#cards");
      box.innerHTML = rows.map(function (m) {
        var marja = S.me.foyda && m.narx ? Math.round(100 * (m.narx - m.tannarx) / m.narx) : null;
        return '<div class="card click" data-id="' + m.id + '" style="cursor:pointer"><h3>' + esc(m.nom) + (m.faol ? "" : ' <span class="badge">Sotuvda emas</span>') + "</h3>" +
          '<div class="pl"><div class="r"><span>Sotuv narxi</span><b>' + som(m.narx) + " so‘m</b></div>" +
          (S.me.foyda ? '<div class="r"><span>Tannarx</span><b>' + som(m.tannarx) + " so‘m</b></div>" +
            '<div class="r"><span>Foyda (1 dona)</span><b class="' + (m.narx - m.tannarx < 0 ? "neg" : "pos") + '">' + som(m.narx - m.tannarx) + " so‘m · " + marja + "%</b></div>" +
            '<div class="r"><span>Ombordan chiqadi</span><span class="muted">' + ((m.tarkib || []).map(function (t) { return esc(t.tovar_nom) + " ×" + t.miqdor; }).join(", ") || "—") + "</span></div>" : "") +
          "</div></div>";
      }).join("") || '<div class="empty">Mahsulot yo‘q.</div>';
      if (S.me.foyda) {
        Array.prototype.forEach.call(box.querySelectorAll("[data-id]"), function (c) {
          c.onclick = function () { mahsulotForm(rows.filter(function (m) { return m.id === +c.dataset.id; })[0]); };
        });
        el.querySelector("#new").onclick = function () { mahsulotForm(null); };
      }
    }).catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }
  function mahsulotForm(m) {
    list("/ombor/").then(function (tov) {
      var edit = !!m; m = m || { nom: "", narx: 235000, tannarx: 0, faol: true, tarkib: [] };
      drawer({
        title: edit ? m.nom : "Yangi mahsulot",
        body: '<div class="field"><label>Nomi</label><input name="nom" value="' + esc(m.nom) + '"></div>' +
          '<div class="row2"><div class="field"><label>Sotuv narxi (so‘m)</label><input type="number" min="0" name="narx" value="' + m.narx + '"></div>' +
          '<div class="field"><label>Tannarx (so‘m)</label><input type="number" min="0" name="tannarx" value="' + m.tannarx + '"></div></div>' +
          '<div class="field"><label><input type="checkbox" name="faol" style="width:auto;margin-right:0.375rem"' + (m.faol ? " checked" : "") + ">Sotuvda</label></div>" +
          '<div class="sec">Sotilganda ombordan chiqadigan narsalar</div>' +
          '<p class="hintp">Bu mahsulotdan 1 dona sotilganda ombordan qaysi tovardan nechta kamayishini belgilang. Masalan: 1 ta banka, 1 ta quti.</p><div class="items" id="tk"></div>' +
          '<button class="btn sm" type="button" id="addt">' + ic("plus") + "Qator qo‘shish</button>",
        onOpen: function (ov) {
          var box = ov.querySelector("#tk");
          function row(t) {
            var d = document.createElement("div");
            d.className = "it"; d.style.gridTemplateColumns = "2fr 1fr auto";
            d.innerHTML = '<select data-f="tovar">' + opts(tov, t.tovar) + '</select><input type="number" min="1" data-f="miqdor" value="' + (t.miqdor || 1) + '">' +
              '<button type="button" class="icon-x">' + ic("x") + "</button>";
            d.querySelector("button").onclick = function () { d.remove(); };
            box.appendChild(d);
          }
          (m.tarkib || []).forEach(row);
          ov.querySelector("#addt").onclick = function () {
            if (!tov.length) { toast("Avval Omborda tovar qo‘shing.", true); return; }
            row({ tovar: tov[0].id, miqdor: 1 });
          };
        },
        onSave: function (ov) {
          var tarkib = [];
          Array.prototype.forEach.call(ov.querySelectorAll("#tk .it"), function (r) {
            tarkib.push({ tovar: parseInt(r.querySelector('[data-f="tovar"]').value, 10), miqdor: parseInt(r.querySelector('[data-f="miqdor"]').value, 10) || 1 });
          });
          var data = { nom: val(ov, "nom").trim(), narx: intv(ov, "narx"), tannarx: intv(ov, "tannarx"), faol: ov.querySelector('[name="faol"]').checked, tarkib: tarkib };
          if (!data.nom) { toast("Nomini yozing.", true); return false; }
          return api(edit ? "/mahsulotlar/" + m.id + "/" : "/mahsulotlar/", { method: edit ? "PUT" : "POST", body: data }).then(function () { toast("Saqlandi"); S.cache = {}; render(); });
        },
        onDelete: edit ? function () {
          return api("/mahsulotlar/" + m.id + "/", { method: "DELETE" }).then(function () { toast("O‘chirildi"); render(); });
        } : null,
      });
    });
  }

  /* ── ramka, login, PWA, router ────────────────────────────────── */
  var installEvt = null;
  function standalone() { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); installEvt = e;
    var b = document.getElementById("install"); if (b) b.classList.remove("hide");
  });
  window.addEventListener("appinstalled", function () {
    installEvt = null;
    var b = document.getElementById("install"); if (b) b.classList.add("hide");
    toast("Ilova o‘rnatildi");
  });

  function loginView() {
    root.innerHTML = '<div class="login"><form class="box" id="lf"><div class="brand-logo"><img src="/crm/icons/icon-192.png" alt=""></div>' +
      "<h1>Nurul Hadis CRM</h1><p>Hisobingizga kiring</p><div id=\"err\"></div>" +
      '<div class="field"><label>Login</label><input name="username" autocomplete="username" autocapitalize="none" autocorrect="off" autofocus></div>' +
      '<div class="field"><label>Parol</label><input type="password" name="password" autocomplete="current-password"></div>' +
      '<button class="btn pri" style="width:100%" type="submit">Kirish</button></form></div>';
    document.getElementById("lf").onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      api("/kirish/", { method: "POST", body: { username: f.username.value, password: f.password.value } }).then(function (d) {
        S.me = d; S.cache = {};
        location.hash = d.foyda ? "#/dashboard" : "#/buyurtmalar";
        render();
      }).catch(function (er) {
        document.getElementById("err").innerHTML = '<div class="err">' + esc(er.message) + "</div>";
      });
    };
  }

  function render() {
    window.onresize = null;
    if (!S.me) return loginView();
    var visible = PAGES.filter(function (p) { return !p[3] || S.me.foyda; });
    var hash = location.hash.replace("#/", "");
    var p = hash.split("?")[0];
    var yangi = /[?&]yangi=1/.test(hash);
    if (!visible.some(function (x) { return x[0] === p; })) p = visible[0][0];
    S.page = p;
    if (p !== "buyurtmalar") S.mijozFilter = null;
    var title = visible.filter(function (x) { return x[0] === p; })[0][1];
    var tabs = visible.slice(0, 3);
    function tab(x) { return '<a href="#/' + x[0] + '" class="' + (x[0] === p ? "on" : "") + '">' + ic(x[2]) + "<span>" + x[1] + "</span></a>"; }

    root.innerHTML =
      '<div class="app"><aside class="side" id="side"><div class="brand"><span class="brand-logo"><img src="/crm/icons/icon-192.png" alt=""></span>' +
      "<div><b>Nurul Hadis</b><small>Savdo CRM</small></div></div>" +
      '<nav class="nav">' + visible.map(function (x) {
        return '<a href="#/' + x[0] + '" class="' + (x[0] === p ? "on" : "") + '">' + ic(x[2]) + x[1] + "</a>";
      }).join("") + '</nav><div class="grow"></div>' +
      '<div class="seg eq themeseg" id="themeseg">' + MAVZU.map(function (x) {
        return '<button data-m="' + x[0] + '" class="' + (x[0] === mavzuTanlangan() ? "on" : "") + '" title="' + x[1] + '">' + ic(x[2]) + x[1] + "</button>";
      }).join("") + "</div>" +
      (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone() ? '<div class="hint"><b>iPhone:</b> Safari’da pastdagi «Ulashish» tugmasini bosing, so‘ng «Bosh ekranga qo‘shish»ni tanlang.</div>' : "") +
      '<div class="user"><span class="avatar">' + esc((S.me.ism || "?").charAt(0).toUpperCase()) + '</span><div class="t"><b>' + esc(S.me.ism) +
      "</b><small>" + (S.me.foyda ? "Egasi" : "Yordamchi") + '</small></div><button class="linkbtn" id="out" title="Chiqish">' + ic("out") + "</button></div></aside>" +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="main"><header class="top"><span class="mlogo"><img src="/crm/icons/icon-192.png" alt=""></span><h1>' + esc(title) + "</h1>" +
      '<button class="bell" id="bell" aria-label="Xabarlar">' + ic("bell") + '<i class="dot hide"></i></button>' +
      '<button class="btn pri" id="topnew">' + ic("plus") + "<span>Yangi buyurtma</span></button></header>" +
      '<div class="page" id="page"></div></div>' +
      '<nav class="tabbar">' + tab(tabs[0]) + (tabs[1] ? tab(tabs[1]) : "<span></span>") +
      '<button class="fab" id="fab" aria-label="Yangi buyurtma"><span>' + ic("plus") + "</span><b style=\"margin-top:34px;font-weight:600\">Yangi</b></button>" +
      (tabs[2] ? tab(tabs[2]) : "<span></span>") + '<button id="more">' + ic("more") + "<span>Yana</span></button></nav></div>";

    function menu(ochiq) {
      document.getElementById("side").classList.toggle("open", ochiq);
      document.getElementById("scrim").classList.toggle("on", ochiq);
    }
    document.getElementById("out").onclick = function () {
      api("/chiqish/", { method: "POST" }).then(function () { S.me = null; S.cache = {}; render(); });
    };
    document.getElementById("more").onclick = function () { menu(true); };
    document.getElementById("scrim").onclick = function () { menu(false); };
    Array.prototype.forEach.call(document.querySelectorAll("#side .nav a"), function (a) { a.onclick = function () { menu(false); }; });
    Array.prototype.forEach.call(document.querySelectorAll("#themeseg button"), function (b) {
      b.onclick = function () {
        try { localStorage.setItem("nh_theme", b.dataset.m); } catch (e) {}
        mavzuQoll(b.dataset.m);
        Array.prototype.forEach.call(document.querySelectorAll("#themeseg button"), function (x) { x.classList.toggle("on", x === b); });
      };
    });
    document.getElementById("topnew").onclick = function () { buyurtmaForm(null); };
    document.getElementById("bell").onclick = xabarlarOyna;
    xabarSoni();
    document.getElementById("fab").onclick = function () { buyurtmaForm(null); };
    var page = document.getElementById("page");
    ({ dashboard: pageDashboard, buyurtmalar: pageBuyurtmalar, mijozlar: pageMijozlar, xarajatlar: pageXarajatlar, ombor: pageOmbor, mahsulotlar: pageMahsulotlar }[p])(page);
    if (yangi) { history.replaceState(null, "", "#/buyurtmalar"); buyurtmaForm(null); }
  }

  /* ── dizaynga mos dropdown (select o'rniga) ───────────────────── */
  var ddOchiq = null;
  function ddYop() {
    if (!ddOchiq) return;
    var o = ddOchiq; ddOchiq = null;
    o.bg.remove(); o.menu.remove();
    o.btn.classList.remove("on"); o.btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", o.key, true);
    window.removeEventListener("resize", o.resize);
    window.removeEventListener("scroll", o.scroll, true);
    if (o.vv && window.visualViewport) { window.visualViewport.removeEventListener("resize", o.vv); window.visualViewport.removeEventListener("scroll", o.vv); }
  }
  function ddNorm(s) { return String(s || "").toLowerCase().replace(/[ʻʼ‘’`´'"]/g, ""); }
  function ddOch(sel, btn) {
    ddYop();
    var optlar = Array.prototype.slice.call(sel.options), mobil = window.matchMedia("(max-width:860px)").matches;
    var bg = document.createElement("div"); bg.className = "dd-bg" + (mobil ? " m" : "");
    var menu = document.createElement("div"); menu.className = "dd-menu" + (mobil ? " m" : ""); menu.setAttribute("role", "listbox");
    menu.innerHTML = (optlar.length > 10 ? '<input class="dd-q" type="search" placeholder="' + esc(sel.dataset.sph || "Qidirish…") + '" autocomplete="off">' : "") + '<div class="dd-l"></div>';
    var list = menu.querySelector(".dd-l"), q = menu.querySelector(".dd-q"), hot = -1;
    function chiz(f) {
      var terms = ddNorm(f).split(/\s+/).filter(Boolean);
      var h = optlar.map(function (o, i) {
        if (terms.length) {          // qidirilganda bo'sh «Tanlang…» qatori ko'rinmaydi
          if (!o.value) return "";
          var hay = ddNorm(o.dataset.s || o.text);
          if (terms.some(function (w) { return hay.indexOf(w) < 0; })) return "";
        }
        return '<button type="button" class="dd-o' + (o.selected ? " on" : "") + (o.disabled ? " dis" : "") + (!o.value ? " ph" : "") + '" data-i="' + i + '"><span class="dd-x"><span>' + esc(o.text) + "</span>" +
          (o.dataset.sub ? "<small>" + esc(o.dataset.sub) + "</small>" : "") + "</span>" + (o.selected ? ic("check") : "") + "</button>";
      }).join("");
      list.innerHTML = h || '<div class="dd-e">Topilmadi</div>';
      hot = -1;
    }
    function tanla(i) {
      if (optlar[i].disabled) return;
      sel.value = optlar[i].value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      ddYop(); btn.focus();
    }
    function harakat(d) {
      var bs = Array.prototype.slice.call(list.querySelectorAll(".dd-o:not(.dis)"));
      if (!bs.length) return;
      hot = Math.max(0, Math.min(bs.length - 1, hot + d));
      bs.forEach(function (b, k) { b.classList.toggle("hot", k === hot); });
      bs[hot].scrollIntoView({ block: "nearest" });
    }
    chiz("");
    document.body.appendChild(bg); document.body.appendChild(menu);
    // joylashuv
    var r = btn.getBoundingClientRect();
    if (!mobil) {
      var eni = Math.max(r.width, 200), left = Math.min(r.left, window.innerWidth - eni - 8);
      var past = window.innerHeight - r.bottom - 12, tepa = r.top - 12, pastga = past >= 220 || past >= tepa;
      menu.style.width = eni + "px"; menu.style.left = Math.max(8, left) + "px";
      menu.style.maxHeight = Math.min(340, pastga ? past : tepa) + "px";
      if (pastga) menu.style.top = r.bottom + 4 + "px"; else menu.style.bottom = window.innerHeight - r.top + 4 + "px";
    }
    btn.classList.add("on"); btn.setAttribute("aria-expanded", "true");
    var on = list.querySelector(".dd-o.on"); if (on) on.scrollIntoView({ block: "center" });
    bg.addEventListener("mousedown", function (e) { e.preventDefault(); ddYop(); });
    list.addEventListener("click", function (e) { var b = e.target.closest(".dd-o"); if (b) tanla(+b.dataset.i); });
    if (q) { q.addEventListener("input", function () { chiz(q.value); }); if (!mobil) q.focus(); }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ddYop(); btn.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); harakat(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); harakat(-1); }
      else if (e.key === "Enter") {
        var h = list.querySelector(".dd-o.hot") || (q && list.querySelector(".dd-o:not(.dis)"));
        if (h) { e.preventDefault(); e.stopPropagation(); tanla(+h.dataset.i); }
      }
    }
    function scroll(e) { if (!menu.contains(e.target) && !menu.contains(document.activeElement)) ddYop(); }
    function resize() { if (!menu.contains(document.activeElement)) ddYop(); }     // telefonda klaviatura chiqqanda yopilmasin
    // iPhone: klaviatura chiqqanda oyna uning ustida turishi uchun (ko'rinadigan maydonga moslanadi)
    function vv() {
      var v = window.visualViewport;
      if (!v || !mobil) return;
      var klav = v.height < window.innerHeight * 0.85;
      menu.style.bottom = Math.max(0, window.innerHeight - v.height - v.offsetTop) + "px";
      menu.style.maxHeight = Math.max(160, klav ? v.height - 16 : Math.min(v.height - 24, window.innerHeight * 0.72)) + "px";
    }
    if (mobil && window.visualViewport) { window.visualViewport.addEventListener("resize", vv); window.visualViewport.addEventListener("scroll", vv); vv(); }
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    ddOchiq = { bg: bg, menu: menu, btn: btn, key: key, scroll: scroll, resize: resize, vv: vv };
  }
  function ddOrnat(root) {
    Array.prototype.forEach.call(root.querySelectorAll("select:not([data-dd])"), function (sel) {
      sel.dataset.dd = "1";
      var w = document.createElement("div"); w.className = "dd";
      if (sel.id) w.dataset.for = sel.id;
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "dd-btn"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span class="dd-t"></span>' + ic("chevron-down");
      var t = btn.firstChild;
      function sync() {
        var o = sel.options[sel.selectedIndex];
        t.textContent = o ? o.text : "";
        t.classList.toggle("ph", !o || !o.value);
        btn.disabled = sel.disabled;
      }
      sel.parentNode.insertBefore(w, sel); w.appendChild(btn); w.appendChild(sel);
      sync();
      sel.addEventListener("change", sync);
      new MutationObserver(sync).observe(sel, { childList: true, subtree: true });
      btn.onclick = function () { if (ddOchiq && ddOchiq.btn === btn) ddYop(); else ddOch(sel, btn); };
    });
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === "SELECT" && !n.dataset.dd) ddOrnat(n.parentNode);
        else if (n.querySelector) ddOrnat(n);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener("hashchange", function () { if (S.me) render(); });
  // iPhone'da ikki barmoq bilan kattalashtirishni o'chirish
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) xabarSoni(true); });
  api("/me/").then(function (d) { S.me = d.kirgan ? d : null; render(); }).catch(function () { S.me = null; render(); });
  if ("serviceWorker" in navigator) {
    // Yangi versiya chiqsa, ochiq turgan ilova o'zi yangilanadi (eski kod bilan ishlab qolmasin)
    var swBor = !!navigator.serviceWorker.controller;
    function yangila() { if (document.querySelector(".ov")) setTimeout(yangila, 5000); else location.reload(); }
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!swBor) { swBor = true; return; }          // birinchi o'rnatish: qayta yuklash shart emas
      yangila();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/crm/sw.js", { scope: "/crm/" }).then(function (reg) {
        document.addEventListener("visibilitychange", function () { if (!document.hidden) reg.update().catch(function () {}); });
        setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      }).catch(function () {});
    });
  }
})();
