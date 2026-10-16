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
  var ICON = {
    dashboard: '<path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z"/>',
    orders: '<path d="M6 4h12l2 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zM4 8h16M9 12h6"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.7.8 3 2.6 3 5.6"/>',
    cost: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/>',
    stock: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>',
    box: '<path d="M7 3h10v4H7zM6 7h12l1 4v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.7c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>',
    trend: '<path d="M4 17l5-5 4 4 7-8M15 8h5v5"/>',
    cart: '<path d="M4 5h2l2 11h10l2-8H7M10 20h.01M17 20h.01"/>',
    debt: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  function ic(n, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' +
      (cls ? ' class="' + cls + '"' : "") + ">" + ICON[n] + "</svg>";
  }

  /* ── drawer ───────────────────────────────────────────────────── */
  function drawer(opt) {
    var ov = document.createElement("div");
    ov.className = "ov";
    ov.innerHTML =
      '<div class="drawer" role="dialog"><div class="hd"><h2>' + esc(opt.title) + '</h2>' +
      '<button class="icon-x" data-x>' + ic("x") + '</button></div>' +
      '<div class="bd">' + opt.body + '</div>' +
      '<div class="ft">' + (opt.onDelete ? '<button class="btn bad" data-del>O‘chirish</button><span class="sp"></span>' : "") +
      '<button class="btn" data-x>Bekor</button><button class="btn pri" data-save>Saqlash</button></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); document.removeEventListener("keydown", esc_); }
    function esc_(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc_);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    Array.prototype.forEach.call(ov.querySelectorAll("[data-x]"), function (b) { b.onclick = close; });
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
  function nomi(arr, k) { for (var i = 0; i < arr.length; i++) if (arr[i][0] === k) return arr[i][1]; return k; }

  function holatBadge(h) {
    var c = { yangi: "blue", tasdiqlandi: "acc", yolda: "warn", yetkazildi: "ok", bekor: "bad", qaytarildi: "bad" }[h] || "";
    return '<span class="badge ' + c + '">' + esc(nomi(HOLAT, h)) + "</span>";
  }
  function turBadge(t) {
    if (t === "sotuv") return '<span class="badge">Sotuv</span>';
    return '<span class="badge warn">' + (t === "reklama" ? "Reklama" : "Sovg‘a") + "</span>";
  }
  function tolovBadge(h) {
    var c = h === "To'langan" ? "ok" : h === "Qisman" ? "warn" : h === "To'lanmagan" ? "bad" : "";
    return '<span class="badge ' + c + '">' + esc(h) + "</span>";
  }

  /* ── chart (SVG) ──────────────────────────────────────────────── */
  function chart(host, seriya, key, color) {
    var W = Math.max(host.clientWidth, 300), H = 280, pl = 46, pb = 30, pt = 14, pr = 8;
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
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="#ECECF3" stroke-dasharray="4 4"/>' +
        '<text x="' + (pl - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11.5" fill="#9A9AB0">' + compact(v) + "</text>";
    }
    var bars = "", labels = "", every = Math.ceil(n / 8), zero = y(0);
    seriya.forEach(function (s, k) {
      var v = s[key], x = pl + k * bw + bw * 0.18, w = bw * 0.64;
      var h = Math.abs(y(v) - zero), by = v >= 0 ? y(v) : zero;
      bars += '<rect class="bg" data-i="' + k + '" x="' + (pl + k * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>' +
        '<rect x="' + x + '" y="' + by + '" width="' + w + '" height="' + Math.max(h, v ? 2 : 0) + '" rx="5" fill="' + (v < 0 ? "#D92D20" : color) + '" opacity=".92" pointer-events="none"/>';
      if (k % every === 0) labels += '<text x="' + (pl + k * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11.5" fill="#9A9AB0">' + esc(s.nom) + "</text>";
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
        '<div class="r muted" style="font-size:13px"><span>&nbsp;&nbsp;shundan bonuslar</span><span>' + som(r.bonus_tannarx) + "</span></div>" +
        '<div class="r muted" style="font-size:13px"><span>&nbsp;&nbsp;shundan tekin buyurtmalar</span><span>' + som(r.tekin_tannarx) + "</span></div>" +
        pl("− Yetkazish xarajati", -r.yetkazish_xarajati) + pl("− Xarajatlar", -r.operatsion) +
        '<div class="r tot"><span>Sof foyda</span><span class="' + (r.sof_foyda < 0 ? "neg" : "pos") + '">' + som(r.sof_foyda) + "</span></div>" +
        "</div></div></div>";

      h += '<div class="grid g3">' +
        '<div class="card"><h3>Qayerdan keldi</h3><div class="bars">' + (r.manbalar.map(function (m) {
          return '<div class="bar"><div class="t"><span>' + esc(m.nom) + "</span><span>" + m.soni + ' ta · ' + compact(m.tushum) + '</span></div><div class="tr"><i style="width:' + Math.round(m.soni / maxManba * 100) + '%"></i></div></div>';
        }).join("") || '<div class="muted">Ma’lumot yo‘q</div>') + "</div></div>" +
        '<div class="card"><h3>Xarajatlar</h3><div class="bars">' + (r.xarajatlar.map(function (x) {
          return '<div class="bar"><div class="t"><span>' + esc(x.nom) + "</span><span>" + som(x.summa) + '</span></div><div class="tr"><i style="width:' + Math.round(x.summa / maxX * 100) + '%;background:' + (x.foydaga ? "var(--accent)" : "#C4C4D4") + '"></i></div></div>';
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
          return '<tr class="click" data-o="' + b.id + '"><td><b>' + esc(b.mijoz_nom) + '</b><div class="muted" style="font-size:12.5px">' + fdate(b.sana) + " · " + b.dona + ' dona</div></td><td>' + holatBadge(b.holat) +
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
        chart(el.querySelector("#chart"), d.seriya, S.chartKey, S.chartKey === "foyda" ? "#12A150" : "#6D4AE0");
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
    el.innerHTML = '<div class="toolbar"><input type="search" id="q" placeholder="Mijoz, telefon, izoh…" value="' + esc(f.q) + '">' +
      '<select id="holat"><option value="">Barcha holatlar</option>' + opts(HOLAT, f.holat) + "</select>" +
      '<select id="tur"><option value="">Barcha turlar</option>' + opts(TUR, f.tur) + "</select>" +
      '<span style="flex:1"></span><button class="btn pri" id="new">' + ic("plus") + "Yangi buyurtma</button></div>" +
      '<div class="card tcard" id="tbl"><div class="empty">Yuklanmoqda…</div></div>';
    var timer;
    el.querySelector("#q").oninput = function (e) { f.q = e.target.value; clearTimeout(timer); timer = setTimeout(load, 250); };
    el.querySelector("#holat").onchange = function (e) { f.holat = e.target.value; load(); };
    el.querySelector("#tur").onchange = function (e) { f.tur = e.target.value; load(); };
    el.querySelector("#new").onclick = function () { buyurtmaForm(null); };
    load();

    function load() {
      var qs = "?q=" + encodeURIComponent(f.q) + "&holat=" + f.holat + "&tur=" + f.tur + (S.mijozFilter ? "&mijoz=" + S.mijozFilter : "");
      list("/buyurtmalar/" + qs).then(function (rows) {
        var box = el.querySelector("#tbl");
        if (!rows.length) { box.innerHTML = '<div class="empty">Buyurtma topilmadi.</div>'; return; }
        var foyda = S.me.foyda;
        box.innerHTML = '<table class="tbl stack"><thead><tr><th>№</th><th>Sana</th><th>Mijoz</th><th>Turi</th><th>Holati</th><th>Yetkazish</th><th class="n">Dona</th><th class="n">Tushum</th>' +
          (foyda ? '<th class="n">Foyda</th>' : "") + "<th>To‘lov</th></tr></thead><tbody>" + rows.map(function (b) {
            return '<tr class="click" data-id="' + b.id + '"><td data-l="№">#' + b.id + '</td><td data-l="Sana">' + fdate(b.sana) + '</td><td data-l="Mijoz"><b>' + esc(b.mijoz_nom) +
              "</b></td><td data-l=\"Turi\">" + turBadge(b.tur) + '</td><td data-l="Holati">' + holatBadge(b.holat) + '</td><td data-l="Yetkazish">' + esc(b.yetkazish_turi_nom) + '</td><td class="n" data-l="Dona">' + b.dona +
              '</td><td class="n" data-l="Tushum">' + som(b.tushum) + "</td>" +
              (foyda ? '<td class="n ' + (b.foyda < 0 ? "neg" : "") + '" data-l="Foyda">' + som(b.foyda) + "</td>" : "") +
              '<td data-l="To‘lov">' + tolovBadge(b.tolov_holati) + "</td></tr>";
          }).join("") + "</tbody></table>";
        Array.prototype.forEach.call(box.querySelectorAll("tr[data-id]"), function (tr) {
          tr.onclick = function () { buyurtmaForm(rows.filter(function (b) { return b.id === +tr.dataset.id; })[0]); };
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
    loadRef().then(function () {
      var mijozlar = S.cache.mijozlar, mahsulotlar = S.cache.mahsulotlar.filter(function (m) { return m.faol || (b && b.qatorlar.some(function (q) { return q.mahsulot === m.id; })); });
      var edit = !!b;
      b = b || { sana: today(), tur: "sotuv", holat: "yangi", manba: "telegram", tolov_usuli: "naqd", chegirma: 0, yetkazish_turi: "yandex", yetkazish_xarajati: 0, tolangan: 0, chegirma_izoh: "", izoh: "", qatorlar: [], bonuslar: [] };
      var cur = edit ? mijozlar.filter(function (m) { return m.id === b.mijoz; })[0] : null;
      var foyda = S.me.foyda;
      var qator = b.qatorlar.length ? b.qatorlar : [{ mahsulot: mahsulotlar[0] && mahsulotlar[0].id, miqdor: 1, narx: null }];

      var body =
        '<div class="field"><label>Mijoz</label><input name="mijoz_ism" list="mlist" placeholder="Ism yozing yoki tanlang" value="' + esc(cur ? cur.ism : "") + '" autocomplete="off">' +
        '<datalist id="mlist">' + mijozlar.map(function (m) { return '<option value="' + esc(m.ism) + '">' + esc(m.telefon) + "</option>"; }).join("") + "</datalist></div>" +
        '<div class="row2"><div class="field"><label>Telefon</label><input name="mijoz_tel" placeholder="+998 90 123 45 67" value="' + esc(cur ? cur.telefon : "") + '"></div>' +
        '<div class="field"><label>Telegram / Instagram</label><input name="mijoz_user" placeholder="@username" value="' + esc(cur ? cur.username : "") + '"></div></div>' +
        '<div class="row3"><div class="field"><label>Sana</label><input type="date" name="sana" value="' + esc(b.sana) + '"></div>' +
        '<div class="field"><label>Turi</label><select name="tur">' + opts(TUR, b.tur) + "</select></div>" +
        '<div class="field"><label>Holati</label><select name="holat">' + opts(HOLAT, b.holat) + "</select></div></div>" +
        '<div class="field"><label>Qayerdan keldi</label><select name="manba">' + opts(MANBA, b.manba) + "</select></div>" +
        '<div class="sec">Mahsulotlar</div><div class="items" id="items"></div>' +
        '<button class="btn sm" type="button" id="addrow">' + ic("plus") + "Mahsulot qo‘shish</button>" +
        '<div class="sec">Bonus (sovg‘a)</div><div class="items bonus" id="bonus"></div>' +
        '<button class="btn sm" type="button" id="addbonus">' + ic("plus") + "Bonus qo‘shish</button>" +
        '<div data-pay><div class="sec">Narx va to‘lov</div>' +
        '<div class="row2"><div class="field"><label>Chegirma (so‘m)</label><input type="number" min="0" name="chegirma" value="' + b.chegirma + '"></div>' +
        '<div class="field"><label>Chegirma sababi</label><input name="chegirma_izoh" value="' + esc(b.chegirma_izoh) + '"></div></div></div>' +
        '<div class="sec">Yetkazish</div>' +
        '<div class="row2"><div class="field"><label>Yetkazish turi</label><select name="yetkazish_turi">' + opts(YET, b.yetkazish_turi || "yandex") + "</select></div>" +
        (foyda ? '<div class="field" data-yx><label>Yetkazish xarajati (so‘m)</label><input type="number" min="0" name="yetkazish_xarajati" value="' + b.yetkazish_xarajati + '"></div>' : "<div></div>") + "</div>" +
        '<div class="row2" data-pay><div class="field"><label>To‘lov usuli</label><select name="tolov_usuli">' + opts(TOLOV, b.tolov_usuli) + "</select></div>" +
        '<div class="field"><label>To‘langan summa <a href="#" id="full" style="font-weight:600">to‘liq</a></label><input type="number" min="0" name="tolangan" value="' + b.tolangan + '"></div></div>' +
        '<div class="field"><label>Izoh</label><textarea name="izoh">' + esc(b.izoh) + "</textarea></div>" +
        '<div class="summary" id="sum"></div>';

      drawer({
        title: edit ? "Buyurtma #" + b.id : "Yangi buyurtma",
        body: body,
        onOpen: function (ov) {
          var items = ov.querySelector("#items"), bonus = ov.querySelector("#bonus");
          function row(q) {
            var d = document.createElement("div");
            d.className = "it";
            d.innerHTML = '<select data-f="mahsulot">' + opts(mahsulotlar, q.mahsulot) + "</select>" +
              '<input type="number" min="1" data-f="miqdor" value="' + (q.miqdor || 1) + '" title="Soni">' +
              '<input type="number" min="0" data-f="narx" placeholder="narx" value="' + (q.narx === null || q.narx === undefined ? "" : q.narx) + '" title="Narxi (bo‘sh = odatdagi narx)">' +
              '<button type="button" class="icon-x" data-rm title="Olib tashlash">' + ic("x") + "</button>";
            if (q.id) d.dataset.id = q.id;
            d.querySelector("[data-rm]").onclick = function () { d.remove(); calc(); };
            items.appendChild(d);
          }
          function bonusRow(x) {
            var d = document.createElement("div");
            d.className = "it bn";
            d.innerHTML = '<input data-f="nom" placeholder="Bonus nomi (masalan Tasbeh)" value="' + esc(x.nom || "") + '">' +
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
            var oziOladi = val(ov, "yetkazish_turi") === "ozi";
            Array.prototype.forEach.call(ov.querySelectorAll("[data-yx]"), function (e) { e.classList.toggle("hide", oziOladi); });
            var ch = tekin ? 0 : Math.min(intv(ov, "chegirma"), jami);
            var tushum = tekin || val(ov, "holat") === "bekor" ? 0 : Math.max(0, jami - ch);
            ov._tushum = tushum;
            var jamiTannarx = tannarx + bonusCost;
            var f = tushum - jamiTannarx - (foyda && !oziOladi ? intv(ov, "yetkazish_xarajati") : 0);
            ov.querySelector("#sum").innerHTML =
              '<div class="r"><span>Mahsulotlar</span><span>' + (tekin ? "tekin" : som(jami) + " so‘m") + "</span></div>" +
              '<div class="r"><span>Chegirma</span><span>' + (tekin ? "—" : "− " + som(ch)) + "</span></div>" +
              '<div class="r tot"><span>Tushum</span><span>' + som(tushum) + " so‘m</span></div>" +
              (foyda ? '<div class="r"><span>Tannarx' + (bonusCost ? " (bonus: " + som(bonusCost) + ")" : "") + "</span><span>" + som(jamiTannarx) + " so‘m</span></div>" +
                '<div class="r tot"><span>Foyda</span><span class="' + (f < 0 ? "neg" : "pos") + '">' + som(f) + " so‘m</span></div>" : "");
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
          var mijozData = { ism: ism, telefon: val(ov, "mijoz_tel"), username: val(ov, "mijoz_user") };
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
      '<span style="flex:1"></span><button class="btn pri" id="new">' + ic("plus") + "Yangi mijoz</button></div>" +
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
            return '<tr class="click" data-id="' + m.id + '"><td data-l="Ism"><b>' + esc(m.ism) + '</b></td><td data-l="Telefon">' + esc(m.telefon) + '</td><td data-l="Username">' + esc(m.username) +
              '</td><td data-l="Manzil">' + esc(m.manzil) + '</td><td class="n" data-l="Buyurtma">' + m.buyurtma_soni + "</td>" +
              (foyda ? '<td class="n" data-l="Jami">' + som(m.jami_summa) + "</td>" : "") + "</tr>";
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
        '<div class="row2"><div class="field"><label>Telefon</label><input name="telefon" value="' + esc(m.telefon) + '"></div>' +
        '<div class="field"><label>Telegram / Instagram</label><input name="username" value="' + esc(m.username) + '"></div></div>' +
        '<div class="field"><label>Manzil / shahar</label><input name="manzil" value="' + esc(m.manzil) + '"></div>' +
        '<div class="field"><label>Izoh</label><textarea name="izoh">' + esc(m.izoh) + "</textarea></div>" +
        (edit ? '<a class="btn sm" href="#/buyurtmalar" id="ords">Buyurtmalarini ko‘rish</a>' : ""),
      onOpen: function (ov) {
        var a = ov.querySelector("#ords");
        if (a) a.onclick = function () { S.mijozFilter = m.id; ov.remove(); };
      },
      onSave: function (ov) {
        var data = { ism: val(ov, "ism").trim(), telefon: val(ov, "telefon"), username: val(ov, "username"), manzil: val(ov, "manzil"), izoh: val(ov, "izoh") };
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
    el.innerHTML = '<div class="toolbar"><span style="flex:1"></span><button class="btn pri" id="new">' + ic("plus") + "Xarajat qo‘shish</button></div>" +
      '<div class="card tcard" id="tbl"><div class="empty">Yuklanmoqda…</div></div>';
    el.querySelector("#new").onclick = function () { xarajatForm(null); };
    list("/xarajatlar/").then(function (rows) {
      var box = el.querySelector("#tbl");
      if (!rows.length) { box.innerHTML = '<div class="empty">Xarajat kiritilmagan.</div>'; return; }
      box.innerHTML = '<table class="tbl stack"><thead><tr><th>Sana</th><th>Turi</th><th>Izoh</th><th class="n">Summa</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr class="click" data-id="' + x.id + '"><td data-l="Sana">' + fdate(x.sana) + '</td><td data-l="Turi"><span class="badge ' + (x.kategoriya === "material" ? "" : "acc") + '">' + esc(x.kategoriya_nom) +
            '</span></td><td data-l="Izoh">' + esc(x.izoh) + '</td><td class="n" data-l="Summa"><b>' + som(x.summa) + "</b></td></tr>";
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
  function pageOmbor(el) {
    el.innerHTML = '<div class="toolbar"><span style="flex:1"></span><button class="btn" id="nt">' + ic("plus") + "Yangi tovar</button>" +
      '<button class="btn pri" id="kirim">' + ic("plus") + "Kirim / tuzatish</button></div>" +
      '<div class="grid g2e"><div class="card tcard" id="tov"><div class="empty">Yuklanmoqda…</div></div>' +
      '<div class="card tcard" id="har"><div class="empty">Yuklanmoqda…</div></div></div>';
    Promise.all([list("/ombor/"), list("/harakatlar/")]).then(function (res) {
      var tov = res[0], har = res[1];
      el.querySelector("#nt").onclick = function () { tovarForm(null); };
      el.querySelector("#kirim").onclick = function () { harakatForm(tov); };
      el.querySelector("#tov").innerHTML = tov.length ? '<table class="tbl"><thead><tr><th>Tovar</th><th class="n">Qoldiq</th><th>Holat</th></tr></thead><tbody>' +
        tov.map(function (t) {
          return '<tr class="click" data-id="' + t.id + '"><td><b>' + esc(t.nom) + '</b></td><td class="n">' + t.qoldiq + " " + esc(t.birlik) + "</td><td>" +
            (t.kam ? '<span class="badge bad">Kam qoldi</span>' : '<span class="badge ok">Yetarli</span>') + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="empty">Ombor bo‘sh. «Yangi tovar» bilan boshlang (banka, quti, sumka…).</div>';
      Array.prototype.forEach.call(el.querySelectorAll("#tov tr[data-id]"), function (tr) {
        tr.onclick = function () { tovarForm(tov.filter(function (t) { return t.id === +tr.dataset.id; })[0]); };
      });
      el.querySelector("#har").innerHTML = har.length ? '<table class="tbl"><thead><tr><th>Sana</th><th>Tovar</th><th class="n">Miqdor</th><th>Izoh</th></tr></thead><tbody>' +
        har.map(function (h) {
          return '<tr data-id="' + h.id + '" class="' + (h.buyurtma ? "" : "click") + '"><td>' + fdate(h.sana) + "</td><td>" + esc(h.tovar_nom) + '</td><td class="n ' + (h.miqdor < 0 ? "neg" : "pos") + '">' + (h.miqdor > 0 ? "+" : "") + h.miqdor +
            "</td><td>" + esc(h.izoh) + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="empty">Harakat yo‘q.</div>';
      Array.prototype.forEach.call(el.querySelectorAll("#har tr.click"), function (tr) {
        tr.onclick = function () { harakatForm(tov, har.filter(function (h) { return h.id === +tr.dataset.id; })[0]); };
      });
    }).catch(function (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }
  function tovarForm(t) {
    var edit = !!t; t = t || { nom: "", birlik: "dona", min_qoldiq: 0 };
    drawer({
      title: edit ? t.nom : "Yangi tovar",
      body: '<div class="field"><label>Nomi</label><input name="nom" value="' + esc(t.nom) + '" placeholder="Shisha banka"></div>' +
        '<div class="row2"><div class="field"><label>Birlik</label><input name="birlik" value="' + esc(t.birlik) + '"></div>' +
        '<div class="field"><label>Kam qoldiq chegarasi</label><input type="number" min="0" name="min_qoldiq" value="' + t.min_qoldiq + '"></div></div>',
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
  function harakatForm(tov, h) {
    var edit = !!h; h = h || { tovar: tov[0] && tov[0].id, turi: "kirim", miqdor: "", birlik_narx: 0, sana: today(), izoh: "" };
    if (!tov.length) { toast("Avval ombor tovarini qo‘shing.", true); return; }
    drawer({
      title: edit ? "Ombor harakati" : "Kirim / tuzatish",
      body: '<div class="field"><label>Tovar</label><select name="tovar">' + opts(tov, h.tovar) + "</select></div>" +
        '<div class="row2"><div class="field"><label>Turi</label><select name="turi">' + opts([["kirim", "Kirim (sotib olindi / tayyorlandi)"], ["tuzatish", "Tuzatish (buzildi, yo‘qoldi)"]], h.turi) + "</select></div>" +
        '<div class="field"><label>Sana</label><input type="date" name="sana" value="' + esc(h.sana) + '"></div></div>' +
        '<div class="row2"><div class="field"><label>Miqdor</label><input type="number" name="miqdor" value="' + esc(h.miqdor) + '"><small class="muted">Tuzatishda kamayish uchun manfiy son (−3).</small></div>' +
        '<div class="field"><label>Birligi narxi (faqat kirim)</label><input type="number" min="0" name="birlik_narx" value="' + h.birlik_narx + '"></div></div>' +
        '<div class="field"><label>Izoh</label><input name="izoh" value="' + esc(h.izoh) + '"></div>',
      onSave: function (ov) {
        var data = { tovar: parseInt(val(ov, "tovar"), 10), turi: val(ov, "turi"), miqdor: parseInt(val(ov, "miqdor"), 10), birlik_narx: intv(ov, "birlik_narx"), sana: val(ov, "sana"), izoh: val(ov, "izoh") };
        if (!data.miqdor) { toast("Miqdorni yozing.", true); return false; }
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
          '<div class="field"><label><input type="checkbox" name="faol" style="width:auto;margin-right:6px"' + (m.faol ? " checked" : "") + ">Sotuvda</label></div>" +
          '<div class="sec">Sotilganda ombordan chiqadigan narsalar</div><div class="items" id="tk"></div>' +
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

  /* ── ramka, login, router ─────────────────────────────────────── */
  function loginView() {
    root.innerHTML = '<div class="login"><form class="box" id="lf"><div class="brand-logo" style="width:46px;height:46px"><img src="/assets/landing/logo-icon.png" alt=""></div>' +
      "<h1>Nurul Hadis CRM</h1><p>Hisobingizga kiring</p><div id=\"err\"></div>" +
      '<div class="field"><label>Login</label><input name="username" autocomplete="username" autofocus></div>' +
      '<div class="field"><label>Parol</label><input type="password" name="password" autocomplete="current-password"></div>' +
      '<button class="btn pri" style="width:100%;justify-content:center;padding:12px" type="submit">Kirish</button></form></div>';
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
    var p = (location.hash.replace("#/", "") || "").split("?")[0];
    if (!visible.some(function (x) { return x[0] === p; })) p = visible[0][0];
    S.page = p;
    if (p !== "buyurtmalar") S.mijozFilter = null;
    var title = visible.filter(function (x) { return x[0] === p; })[0][1];
    root.innerHTML =
      '<div class="app"><aside class="side" id="side"><div class="brand"><span class="brand-logo"><img src="/assets/landing/logo-icon.png" alt=""></span>' +
      "<div><b>Nurul Hadis</b><small>Savdo CRM</small></div></div>" +
      '<nav class="nav">' + visible.map(function (x) {
        return '<a href="#/' + x[0] + '" class="' + (x[0] === p ? "on" : "") + '">' + ic(x[2]) + x[1] + "</a>";
      }).join("") + '</nav><div class="grow"></div>' +
      '<div class="user"><span class="avatar">' + esc((S.me.ism || "?").charAt(0).toUpperCase()) + '</span><div class="t"><b>' + esc(S.me.ism) +
      "</b><small>" + (S.me.foyda ? "Egasi" : "Yordamchi") + '</small></div><button class="linkbtn" id="out" title="Chiqish">' + ic("out") + "</button></div></aside>" +
      '<div class="main"><header class="top"><button class="burger" id="bg">' + ic("menu") + "</button><h1>" + esc(title) + "</h1>" +
      '<button class="btn pri" id="topnew">' + ic("plus") + "<span>Yangi buyurtma</span></button></header>" +
      '<div class="page" id="page"></div></div></div>';
    document.getElementById("out").onclick = function () {
      api("/chiqish/", { method: "POST" }).then(function () { S.me = null; S.cache = {}; render(); });
    };
    document.getElementById("bg").onclick = function () { document.getElementById("side").classList.toggle("open"); };
    document.getElementById("topnew").onclick = function () { buyurtmaForm(null); };
    var page = document.getElementById("page");
    ({ dashboard: pageDashboard, buyurtmalar: pageBuyurtmalar, mijozlar: pageMijozlar, xarajatlar: pageXarajatlar, ombor: pageOmbor, mahsulotlar: pageMahsulotlar }[p])(page);
  }

  window.addEventListener("hashchange", function () { if (S.me) render(); });
  api("/me/").then(function (d) { S.me = d.kirgan ? d : null; render(); }).catch(function () { S.me = null; render(); });
})();
