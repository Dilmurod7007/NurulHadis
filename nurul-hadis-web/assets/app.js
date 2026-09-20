/* ===========================================================
   Nurul Hadis — UI prototipi
   Backend yo'q: ma'lumot data/hadislar.js dan olinadi.
   Manzil shakli:  #/          → ro'yxat
                   #/h/<id>    → tafsilot  (QR shu manzilga olib keladi)
   =========================================================== */

(function () {
  "use strict";

  var DATA = window.NURUL_DATA || { meta: {}, hadislar: [] };

  /* Kategoriyalar — banka nakleykasidagi tartib va ranglar */
  var CATS = [
    { name: "Oila",   color: "var(--c-oila)" },
    { name: "Umid",   color: "var(--c-umid)" },
    { name: "Baraka", color: "var(--c-baraka)" },
    { name: "Ilm",    color: "var(--c-ilm)" },
    { name: "Axloq",  color: "var(--c-axloq)" },
    { name: "Sunnat", color: "var(--c-sunnat)", ring: "var(--c-sunnat-ring)" }
  ];

  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    ext:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    sun:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    moon:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'
  };

  /* ---------- yordamchilar ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function cat(name) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].name === name) return CATS[i];
    return { name: name, color: "var(--ink-3)" };
  }
  function dot(c) {
    return '<span class="dot" style="--dot:' + c.color +
      (c.ring ? ";--dot-ring:" + c.ring : "") + '"></span>';
  }
  function byId(id) {
    for (var i = 0; i < DATA.hadislar.length; i++)
      if (DATA.hadislar[i].id === id) return DATA.hadislar[i];
    return null;
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

  /* ---------- holat ---------- */
  var state = { filter: "Hammasi", q: "", tab: "hadis", full: false };

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

  /* ---------- RO'YXAT ---------- */
  function viewList() {
    var q = state.q.trim().toLowerCase();
    var html = "";

    html += '<header class="topbar">' +
      '<h1 class="topbar__title">Nurul Hadis</h1>' +
      '<button class="iconbtn" id="theme" aria-label="Rejimni almashtirish">' +
        (currentIsDark() ? ICON.sun : ICON.moon) + '</button>' +
    '</header>';

    html += '<div class="search">' + ICON.search +
      '<input id="q" type="search" placeholder="Hadis yoki manba bo‘yicha qidirish" value="' +
      esc(state.q) + '" autocomplete="off"></div>';

    /* kategoriya tanlagich */
    html += '<div class="chips" role="group" aria-label="Kategoriyalar">';
    html += '<button class="chip" data-cat="Hammasi" aria-pressed="' +
      (state.filter === "Hammasi") + '">Hammasi</button>';
    for (var i = 0; i < CATS.length; i++) {
      html += '<button class="chip" data-cat="' + esc(CATS[i].name) + '" aria-pressed="' +
        (state.filter === CATS[i].name) + '">' + dot(CATS[i]) + esc(CATS[i].name) + '</button>';
    }
    html += '</div>';

    /* guruhlar */
    var shown = state.filter === "Hammasi" ? CATS : [cat(state.filter)];
    var total = 0;

    for (var g = 0; g < shown.length; g++) {
      var c = shown[g];
      var items = DATA.hadislar.filter(function (h) {
        if (h.category !== c.name) return false;
        if (!q) return true;
        return (h.title + " " + h.paper_text + " " + h.paper_source_line + " " +
                h.narrator + " " + h.collection).toLowerCase().indexOf(q) >= 0;
      });
      if (q && !items.length) continue;
      total += items.length;

      html += '<section class="group"><div class="group__head">' +
        dot(c) + '<span class="group__name">' + esc(c.name) + '</span>' +
        '<span class="group__count">' + items.length + '</span></div>';

      if (!items.length) {
        html += '<div class="empty empty--slim">Hadislar hali yig‘ilmagan</div>';
      } else {
        html += '<div class="group__list">';
        for (var k = 0; k < items.length; k++) {
          var h = items[k];
          html += '<button class="card" data-id="' + esc(h.id) + '">' +
            '<div class="card__top">' + dot(c) +
              '<span class="card__cat">' + esc(h.category) + '</span></div>' +
            '<h2 class="card__title">' + esc(h.title) + '</h2>' +
            '<p class="card__snippet">' + esc(h.paper_text) + '</p>' +
            '<div class="card__meta"><span>' + esc(h.collection) + ", " +
              esc(h.collection_no) + '</span><span class="sep">·</span><span>' +
              esc(h.narrator.split(" roziyallohu")[0]) + '</span>' +
              (h.sharh_status === "bor" ? '<span class="sep">·</span><span>Sharhli</span>' : "") +
            '</div></button>';
        }
        html += "</div>";
      }
      html += "</section>";
    }

    if (q && !total) {
      html += '<div class="empty">“' + esc(state.q) + '” bo‘yicha hech narsa topilmadi</div>';
    }

    html += '<p class="foot">' + esc(DATA.meta.manba || "") + "<br>" +
      esc(DATA.meta.toplam || "") + "<br>" + esc(DATA.meta.eslatma || "") + "</p>";

    return html;
  }

  /* ---------- TAFSILOT ---------- */
  function viewDetail(h) {
    var c = cat(h.category);
    var html = "";

    html += '<header class="topbar">' +
      '<button class="back" id="back">' + ICON.back + "Ro‘yxat</button>" +
      '<span style="flex:1"></span>' +
      '<button class="iconbtn" id="theme" aria-label="Rejimni almashtirish">' +
        (currentIsDark() ? ICON.sun : ICON.moon) + '</button>' +
    '</header>';

    html += '<div class="hero">' +
      '<div class="hero__cat">' + dot(c) + esc(h.category) + "</div>" +
      '<h1 class="hero__title">' + esc(h.title) + "</h1></div>";

    /* tablar */
    html += '<div class="tabs" role="tablist">';
    html += '<button class="tab" role="tab" data-tab="hadis" aria-selected="' +
      (state.tab === "hadis") + '">Hadis</button>';
    html += '<button class="tab" role="tab" data-tab="sharh" aria-selected="' +
      (state.tab === "sharh") + '">Sharh' +
      (h.sharh_status === "bor" ? "" : '<span class="tab__badge">—</span>') + "</button>";
    html += '<button class="tab" role="tab" data-tab="manba" aria-selected="' +
      (state.tab === "manba") + '">Manba</button>';
    html += "</div>";

    if (state.tab === "hadis")      html += panelHadis(h);
    else if (state.tab === "sharh") html += panelSharh(h);
    else                            html += panelManba(h);

    return html;
  }

  function panelHadis(h) {
    var s = '<div class="panel">';
    s += '<p class="arabic" dir="rtl" lang="ar">' + esc(h.arabic_text) + "</p>";
    s += '<hr class="rule">';
    s += '<p class="uz">' + esc(h.uzbek_full) + "</p>";
    s += '<p class="srcline">' + esc(h.collection) + ", " + esc(h.collection_no) +
         " · " + esc(h.narrator) + "</p>";
    s += "</div>";

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

    /* qog'ozchada nima chiqadi */
    s += '<div class="slip"><div class="slip__head"><span>Qog‘ozchada</span>' +
      '<span class="slip__len">' + h.paper_len + " belgi</span></div>" +
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
    var parts = h.sharh.split("\n\n");
    var s = '<div class="panel"><div class="sharh">';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var cls = i === 0 ? " class=\"lead\"" : (/^\d+\.\s/.test(p) ? " class=\"num\"" : "");
      s += "<p" + cls + ">" + esc(p) + "</p>";
    }
    s += "</div>";
    s += '<p class="srcline" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">' +
      esc(h.sharh_ref) + "</p>";
    s += "</div>";
    return s;
  }

  function panelManba(h) {
    function row(k, v) { return "<div class=\"fact\"><dt>" + k + "</dt><dd>" + v + "</dd></div>"; }
    var s = '<div class="panel"><dl class="facts">';
    s += row("Roviy", esc(h.narrator));
    s += row("To‘plam", esc(h.collection) + ", " + esc(h.collection_no) + "-hadis");
    s += row("Daraja", '<span class="badge">' + esc(h.grade) + "</span>");
    s += row("Kitob", esc(h.ref_book));
    if (h.sharh_ref) s += row("Sharh", esc(h.sharh_ref));
    s += "</dl>";
    s += '<div class="linkrow"><a href="' + esc(h.ref_url) + '" target="_blank" rel="noopener">' +
      "hadis.islom.uz — manbadagi sahifa</a>" + ICON.ext + "</div>";
    s += '<p class="note">' + esc(DATA.meta.toplam || "") + "<br>" +
      esc(DATA.meta.eslatma || "") + "</p>";
    s += "</div>";
    return s;
  }

  /* ---------- render + hodisalar ---------- */
  var root = document.getElementById("app");

  function route() {
    var m = /^#\/h\/(.+)$/.exec(location.hash);
    return m ? byId(decodeURIComponent(m[1])) : null;
  }

  function render() {
    var h = route();
    root.innerHTML = '<div class="shell">' + (h ? viewDetail(h) : viewList()) + "</div>";
    bind(h);
  }

  function bind(h) {
    var t = document.getElementById("theme");
    if (t) t.addEventListener("click", toggleTheme);

    if (!h) {
      var q = document.getElementById("q");
      if (q) {
        q.addEventListener("input", function () {
          state.q = q.value;
          render();
          var el = document.getElementById("q");
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        });
      }
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

  window.addEventListener("hashchange", function () {
    state.tab = "hadis"; state.full = false;
    render();
    window.scrollTo(0, 0);
  });

  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(
      function () { if (!readTheme()) render(); }
    );
  }

  render();
})();
