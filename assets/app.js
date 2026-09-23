/* ===========================================================
   Nurul Hadis — UI

   Ma'lumot ikki manbadan kelishi mumkin:
     1. Django API  (/api/hadislar/)  — asosiy
     2. data/hadislar.js              — API javob bermasa, zaxira

   Manzil shakli:  #/          → ro'yxat
                   #/h/<id>    → tafsilot  (QR shu manzilga olib keladi)
   =========================================================== */

(function () {
  "use strict";

  /* API manzili: sahifa serverdan ochilsa — nisbiy,
     fayl sifatida ochilsa — lokal Django serveri. */
  var API = location.protocol === "file:"
    ? "http://127.0.0.1:8000/api"
    : "/api";

  /* API javob bermasa ishlatiladigan kategoriya ro'yxati */
  var ZAXIRA_KATEGORIYALAR = [
    { name: "Oila",   color: "#E8B33F", order: 1 },
    { name: "Umid",   color: "#45B96A", order: 2 },
    { name: "Baraka", color: "#4B9BDC", order: 3 },
    { name: "Ilm",    color: "#E87B93", order: 4 },
    { name: "Axloq",  color: "#DC463F", order: 5 },
    { name: "Sunnat", color: "#FFFFFF", order: 6 }
  ];

  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    ext:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    sun:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    moon:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'
  };

  /* ---------- ombor ---------- */
  var store = {
    manba: null,      // "api" | "zaxira"
    yuklanmoqda: true,
    xato: null,
    meta: {},
    kategoriyalar: [],
    royxat: [],
    tafsilot: {}      // id → to'liq obyekt (keshlanadi)
  };

  var state = { filter: "Hammasi", q: "", tab: "hadis", full: false };

  /* ---------- yordamchilar ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getJSON(url) {
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        return r.json();
      });
  }

  function cat(name) {
    for (var i = 0; i < store.kategoriyalar.length; i++)
      if (store.kategoriyalar[i].name === name) return store.kategoriyalar[i];
    return { name: name, color: "#A2917C" };
  }

  /* Oq rangli kategoriya (Sunnat) fon ustida ko'rinmay qoladi —
     shunga halqa qo'shamiz. */
  function ochRangmi(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return false;
    var r = parseInt(h.slice(0, 2), 16),
        g = parseInt(h.slice(2, 4), 16),
        b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 225;
  }

  function dot(c) {
    var ring = ochRangmi(c.color) ? ";--dot-ring:var(--c-sunnat-ring)" : "";
    return '<span class="dot" style="--dot:' + esc(c.color) + ring + '"></span>';
  }

  /* Qog'ozchadagi jumlani to'liq matn ichidan topib belgilaydi */
  function markCore(full, uz) {
    var m = /"([^"]{25,})"/.exec(uz || "");
    if (!m) return esc(full);
    var core = m[1].replace(/[.,]\s*$/, "");
    var i = full.indexOf(core);
    if (i < 0) return esc(full);
    return esc(full.slice(0, i)) + "<mark>" + esc(full.slice(i, i + core.length)) +
           "</mark>" + esc(full.slice(i + core.length));
  }

  /* ---------- ma'lumot yuklash ---------- */
  function zaxiraniYuk() {
    var d = window.NURUL_DATA;
    if (!d) return false;
    store.manba = "zaxira";
    store.meta = d.meta || {};
    store.kategoriyalar = ZAXIRA_KATEGORIYALAR.slice();
    store.royxat = (d.hadislar || []).map(function (h) {
      store.tafsilot[h.id] = h;          // zaxirada hamma narsa bor
      return h;
    });
    return true;
  }

  function royxatniYuk() {
    store.yuklanmoqda = true;
    render();
    getJSON(API + "/hadislar/")
      .then(function (d) {
        store.manba = "api";
        store.meta = d.meta || {};
        store.kategoriyalar = (d.kategoriyalar || []).length
          ? d.kategoriyalar : ZAXIRA_KATEGORIYALAR.slice();
        store.royxat = d.hadislar || [];
        store.yuklanmoqda = false;
        render();
      })
      .catch(function () {
        store.yuklanmoqda = false;
        if (!zaxiraniYuk()) store.xato = "Ma’lumotni yuklab bo‘lmadi.";
        render();
      });
  }

  function tafsilotniYuk(id) {
    if (store.tafsilot[id]) { render(); return; }
    store.yuklanmoqda = true;
    render();
    getJSON(API + "/hadislar/" + encodeURIComponent(id) + "/")
      .then(function (h) {
        store.tafsilot[h.id] = h;
        store.yuklanmoqda = false;
        render();
      })
      .catch(function () {
        store.yuklanmoqda = false;
        store.xato = "Bu hadisni yuklab bo‘lmadi.";
        render();
      });
  }

  /* ---------- mavzu (yorug'/qorong'i) ---------- */
  function readTheme() {
    try { return localStorage.getItem("nh-theme"); } catch (e) { return null; }
  }
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function currentIsDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    var next = currentIsDark() ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("nh-theme", next); } catch (e) {}
    render();
  }
  applyTheme(readTheme());

  function themeBtn() {
    return '<button class="iconbtn" id="theme" aria-label="Rejimni almashtirish">' +
      (currentIsDark() ? ICON.sun : ICON.moon) + "</button>";
  }

  /* ---------- RO'YXAT ---------- */
  function viewList() {
    var q = state.q.trim().toLowerCase();
    var html = "";

    html += '<header class="topbar"><h1 class="topbar__title">Nurul Hadis</h1>' +
      themeBtn() + "</header>";

    if (store.yuklanmoqda && !store.royxat.length) {
      return html + '<div class="empty">Yuklanmoqda…</div>';
    }
    if (store.xato && !store.royxat.length) {
      return html + '<div class="empty">' + esc(store.xato) + "</div>";
    }

    html += '<div class="search">' + ICON.search +
      '<input id="q" type="search" placeholder="Hadis yoki manba bo‘yicha qidirish" value="' +
      esc(state.q) + '" autocomplete="off"></div>';

    html += '<div class="chips" role="group" aria-label="Kategoriyalar">';
    html += '<button class="chip" data-cat="Hammasi" aria-pressed="' +
      (state.filter === "Hammasi") + '">Hammasi</button>';
    for (var i = 0; i < store.kategoriyalar.length; i++) {
      var c = store.kategoriyalar[i];
      html += '<button class="chip" data-cat="' + esc(c.name) + '" aria-pressed="' +
        (state.filter === c.name) + '">' + dot(c) + esc(c.name) + "</button>";
    }
    html += "</div>";

    var shown = state.filter === "Hammasi" ? store.kategoriyalar : [cat(state.filter)];
    var total = 0;

    for (var g = 0; g < shown.length; g++) {
      var k = shown[g];
      var items = store.royxat.filter(function (h) {
        if (h.category !== k.name) return false;
        if (!q) return true;
        return (h.title + " " + h.paper_text + " " + h.paper_source_line + " " +
                h.narrator + " " + h.collection).toLowerCase().indexOf(q) >= 0;
      });
      if (q && !items.length) continue;
      total += items.length;

      html += '<section class="group"><div class="group__head">' + dot(k) +
        '<span class="group__name">' + esc(k.name) + "</span>" +
        '<span class="group__count">' + items.length + "</span></div>";

      if (!items.length) {
        html += '<div class="empty empty--slim">Hadislar hali yig‘ilmagan</div>';
      } else {
        html += '<div class="group__list">';
        for (var n = 0; n < items.length; n++) {
          var h = items[n];
          html += '<button class="card" data-id="' + esc(h.id) + '">' +
            '<div class="card__top">' + dot(k) +
              '<span class="card__cat">' + esc(h.category) + "</span></div>" +
            '<h2 class="card__title">' + esc(h.title) + "</h2>" +
            '<p class="card__snippet">' + esc(h.paper_text) + "</p>" +
            '<div class="card__meta"><span>' + esc(h.collection) + ", " +
              esc(h.collection_no) + '</span><span class="sep">·</span><span>' +
              esc(String(h.narrator).split(" roziyallohu")[0]) + "</span>" +
              (h.sharh_status === "bor"
                ? '<span class="sep">·</span><span>Sharhli</span>' : "") +
            "</div></button>";
        }
        html += "</div>";
      }
      html += "</section>";
    }

    if (q && !total) {
      html += '<div class="empty">“' + esc(state.q) +
        '” bo‘yicha hech narsa topilmadi</div>';
    }

    html += footer();
    return html;
  }

  function footer() {
    var manba = store.manba === "api"
      ? "Ma’lumot API dan"
      : "Ma’lumot zaxira fayldan (API javob bermadi)";
    return '<p class="foot">' + esc(store.meta.manba || "") + "<br>" +
      esc(store.meta.toplam || "") + "<br>" + esc(store.meta.eslatma || "") +
      "<br><span style=\"opacity:.7\">" + manba + "</span></p>";
  }

  /* ---------- TAFSILOT ---------- */
  function viewDetail(id) {
    var h = store.tafsilot[id];
    var html = '<header class="topbar">' +
      '<button class="back" id="back">' + ICON.back + "Ro‘yxat</button>" +
      '<span style="flex:1"></span>' + themeBtn() + "</header>";

    if (!h) {
      return html + '<div class="empty">' +
        (store.xato ? esc(store.xato) : "Yuklanmoqda…") + "</div>";
    }

    var c = cat(h.category);
    html += '<div class="hero"><div class="hero__cat">' + dot(c) +
      esc(h.category) + '</div><h1 class="hero__title">' + esc(h.title) +
      "</h1></div>";

    html += '<div class="tabs" role="tablist">' +
      '<button class="tab" role="tab" data-tab="hadis" aria-selected="' +
        (state.tab === "hadis") + '">Hadis</button>' +
      '<button class="tab" role="tab" data-tab="sharh" aria-selected="' +
        (state.tab === "sharh") + '">Sharh' +
        (h.sharh_status === "bor" ? "" : '<span class="tab__badge">—</span>') +
      "</button>" +
      '<button class="tab" role="tab" data-tab="manba" aria-selected="' +
        (state.tab === "manba") + '">Manba</button></div>';

    if (state.tab === "hadis")      html += panelHadis(h);
    else if (state.tab === "sharh") html += panelSharh(h);
    else                            html += panelManba(h);

    return html;
  }

  function panelHadis(h) {
    var s = '<div class="panel">';
    s += '<p class="uz">' + esc(h.uzbek_full) + "</p>";
    s += '<hr class="rule">';
    s += '<p class="arabic" dir="rtl" lang="ar">' + esc(h.arabic_text) + "</p>";
    s += '<p class="srcline">' + esc(h.collection) + ", " + esc(h.collection_no) +
         " · " + esc(h.narrator) + "</p></div>";

    if (h.parent_hadith && h.parent_hadith.bor) {
      s += '<button class="fullbtn" id="fullbtn" aria-expanded="' + state.full + '">' +
        '<span><span class="fullbtn__label">Hadisning to‘liq matnini ko‘rish</span>' +
        '<span class="fullbtn__note">' + esc(h.parent_hadith.ref_book) + "</span></span>" +
        ICON.chev + "</button>";
      if (state.full) {
        s += '<div class="fulltext"><p class="fulltext__label">To‘liq matn</p>' +
          '<p class="uz">' + markCore(h.parent_hadith.uzbek_full, h.uzbek_full) + "</p>" +
          '<p class="srcline">' + esc(h.parent_hadith.ref_book) + "</p></div>";
      }
    }

    s += '<div class="slip"><div class="slip__head"><span>Qog‘ozchada</span>' +
      '<span class="slip__len">' + esc(h.paper_len) + " belgi</span></div>" +
      '<div class="slip__paper"><p class="slip__text">' + esc(h.paper_text) + "</p>" +
      '<p class="slip__src">' + esc(h.paper_source_line) + "</p></div></div>";

    return s;
  }

  function panelSharh(h) {
    if (h.sharh_status !== "bor" || !h.sharh) {
      return '<div class="panel"><div class="empty" style="border:0;padding:8px 0">' +
        "Bu hadisga manbada sharh berilmagan.</div>" +
        (h.sharh_url ? '<div class="linkrow"><a href="' + esc(h.sharh_url) +
          '" target="_blank" rel="noopener">Manbadagi sahifa</a>' + ICON.ext + "</div>" : "") +
        "</div>";
    }
    var parts = String(h.sharh).split("\n\n");
    var s = '<div class="panel"><div class="sharh">';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var cls = i === 0 ? ' class="lead"' : (/^\d+\.\s/.test(p) ? ' class="num"' : "");
      s += "<p" + cls + ">" + esc(p) + "</p>";
    }
    s += "</div>";
    if (h.sharh_ref) {
      s += '<p class="srcline" style="margin-top:20px;padding-top:16px;' +
        'border-top:1px solid var(--line)">' + esc(h.sharh_ref) + "</p>";
    }
    return s + "</div>";
  }

  function panelManba(h) {
    function row(k, v) { return '<div class="fact"><dt>' + k + "</dt><dd>" + v + "</dd></div>"; }
    var s = '<div class="panel"><dl class="facts">';
    s += row("Roviy", esc(h.narrator));
    s += row("To‘plam", esc(h.collection) + ", " + esc(h.collection_no) + "-hadis");
    s += row("Daraja", '<span class="badge">' + esc(h.grade) + "</span>");
    s += row("Kitob", esc(h.ref_book));
    if (h.sharh_ref) s += row("Sharh", esc(h.sharh_ref));
    s += "</dl>";
    if (h.ref_url) {
      s += '<div class="linkrow"><a href="' + esc(h.ref_url) +
        '" target="_blank" rel="noopener">hadis.islom.uz — manbadagi sahifa</a>' +
        ICON.ext + "</div>";
    }
    s += '<p class="note">' + esc(store.meta.toplam || "") + "<br>" +
      esc(store.meta.eslatma || "") + "</p></div>";
    return s;
  }

  /* ---------- render + hodisalar ---------- */
  var root = document.getElementById("app");

  function routeId() {
    var m = /^#\/h\/(.+)$/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function render() {
    var id = routeId();
    root.innerHTML = '<div class="shell">' +
      (id ? viewDetail(id) : viewList()) + "</div>";
    bind(id);
  }

  function bind(id) {
    var t = document.getElementById("theme");
    if (t) t.addEventListener("click", toggleTheme);

    if (!id) {
      var q = document.getElementById("q");
      if (q) q.addEventListener("input", function () {
        state.q = q.value;
        render();
        var el = document.getElementById("q");
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
      Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) {
        b.addEventListener("click", function () { state.filter = b.dataset.cat; render(); });
      });
      Array.prototype.forEach.call(document.querySelectorAll(".card"), function (b) {
        b.addEventListener("click", function () {
          state.tab = "hadis"; state.full = false;
          location.hash = "#/h/" + encodeURIComponent(b.dataset.id);
        });
      });
      return;
    }

    var back = document.getElementById("back");
    if (back) back.addEventListener("click", function () {
      if (history.length > 1) history.back(); else location.hash = "#/";
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.addEventListener("click", function () { state.tab = b.dataset.tab; render(); });
    });
    var fb = document.getElementById("fullbtn");
    if (fb) fb.addEventListener("click", function () {
      state.full = !state.full;
      render();
      var el = document.getElementById("fullbtn");
      if (el) el.focus();
    });
  }

  function onRoute() {
    state.tab = "hadis";
    state.full = false;
    store.xato = null;
    var id = routeId();
    if (id) tafsilotniYuk(id); else render();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", onRoute);

  /* Sichqoncha bilan bosib-sudrab gorizontal scroll (.chips) —
     real qurilmada barmoq bilan surish allaqachon ishlaydi,
     bu faqat sichqoncha/trackpad uchun qo'shimcha. */
  (function () {
    var dragEl = null, startX = 0, startScroll = 0, moved = false;
    document.addEventListener("mousedown", function (e) {
      var el = e.target.closest && e.target.closest(".chips");
      if (!el) return;
      dragEl = el; moved = false;
      startX = e.clientX; startScroll = el.scrollLeft;
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragEl) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) dragEl.scrollLeft = startScroll - dx;
    });
    window.addEventListener("mouseup", function () { dragEl = null; });
    document.addEventListener("click", function (e) {
      if (moved && e.target.closest && e.target.closest(".chips")) {
        e.stopPropagation();
        e.preventDefault();
      }
      moved = false;
    }, true);
  })();

  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change")
                         : mq.addListener.bind(mq))(
      function () { if (!readTheme()) render(); }
    );
  }

  /* Boshlanish: ro'yxatni yuklab, keyin manzilga qarab tafsilotni ochamiz */
  royxatniYuk();
  var boshlangichId = routeId();
  if (boshlangichId) tafsilotniYuk(boshlangichId);
})();
