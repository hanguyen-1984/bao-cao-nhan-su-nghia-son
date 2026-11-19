/**
 * Giao diện: Nhập liệu · Dashboard · Báo cáo · Quản trị
 */
(function () {
  'use strict';
  var C = NSCore, CFG = window.NS_CONFIG || {};
  var S = { user: null, cfg: {}, view: '', charts: [], timer: null, dirty: false, skipRoute: false };
  var E = null; // trạng thái lưới nhập liệu đang mở
  var fi = C.fmtInt, fp = C.fmtPct, fd = C.fmtDate;
  var COLOR = { NM1: '#2a78d6', NM2: '#eb6834', rieng: '#1baf7a', tong: '#52514e', extra: ['#eda100', '#e87ba4', '#008300'] };
  var ROLE = { ADMIN: 'Quản trị', NHAP: 'Nhập liệu', XEM: 'Chỉ xem' };

  // ---------- Tiện ích ----------
  var mem = {};
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function todayVN() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
  function shortDate(ymd) { return ymd ? ymd.slice(8, 10) + '/' + ymd.slice(5, 7) : ''; }
  function lvlClass(m) { return m === 'do' ? 'lvl-do' : m === 'vang' ? 'lvl-vang' : m === 'tot' ? 'lvl-tot' : ''; }
  function unitColor(key, i) { return COLOR[key] || COLOR.extra[i % COLOR.extra.length]; }
  function deltaHtml(pp) {
    if (pp === null || pp === undefined) return '';
    return '<span class="' + (pp > 0.05 ? 'delta-up' : pp < -0.05 ? 'delta-down' : '') + '">' + C.fmtDelta(pp) + '</span>';
  }
  function statusChip(m, cfg) {
    if (m === 'do') return '<span class="chip crit">▼ Dưới ' + fp(C.nguongDo(cfg), 0) + '</span>';
    if (m === 'vang') return '<span class="chip warn">▲ Dưới ' + fp(C.nguongVang(cfg), 0) + '</span>';
    if (m === 'tot') return '<span class="chip good">✓ Đạt</span>';
    return '';
  }

  function toast(msg, type, ms) {
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, ms || (type === 'err' ? 7000 : 3500));
  }
  var busyN = 0;
  function busy(on) {
    busyN += on ? 1 : -1;
    var el = $('#loading');
    if (busyN > 0 && !el) { el = document.createElement('div'); el.id = 'loading'; document.body.appendChild(el); }
    if (busyN <= 0 && el) { busyN = 0; el.remove(); }
  }
  function api(action, payload) {
    busy(true);
    return API.call(action, Object.assign({ token: store.get('ns_token') }, payload || {})).then(function (r) {
      busy(false); return r;
    }, function (e) {
      busy(false);
      if (e.auth) { logout(true); }
      throw e;
    });
  }
  function showErr(e) {
    var m = $('#main');
    if (m) m.innerHTML = '<div class="banner crit">' + esc(e.message || e) + '</div>';
  }
  function copyText(text) {
    var done = function () { toast('Đã sao chép bản tin – dán vào Zalo.', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    }
    fallbackCopy(text); done();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
    ta.remove();
  }
  function downloadCSV(name, header, rows) {
    var q = function (x) { x = x === null || x === undefined ? '' : String(x); return /[",;\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var s = '\uFEFF' + [header].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Điều hướng ----------
  function navItems() {
    var r = S.user.vaiTro, it = [];
    if (r === 'NHAP' || r === 'ADMIN') it.push(['nhap', 'Nhập liệu']);
    it.push(['dashboard', 'Dashboard'], ['bao-cao', 'Báo cáo']);
    if (r === 'ADMIN') it.push(['quan-tri', 'Quản trị']);
    return it;
  }
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('?'), q = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    var seg = parts[0].split('/');
    return { view: seg[0], sub: seg[1] || '', q: q, raw: '#/' + h };
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  var lastHash = '';
  function route() {
    if (S.skipRoute) { S.skipRoute = false; return; }
    if (!S.user) return viewLogin();
    var h = parseHash(), allowed = navItems().map(function (x) { return x[0]; });
    if (allowed.indexOf(h.view) < 0) { go('#/' + (S.user.vaiTro === 'NHAP' ? 'nhap' : 'dashboard')); return; }
    if (S.dirty && lastHash && lastHash !== h.raw && !confirm('Có số liệu chưa gửi. Rời trang này và bỏ các thay đổi?')) {
      S.skipRoute = true; location.hash = lastHash; return;
    }
    lastHash = h.raw;
    S.dirty = false;
    cleanup();
    S.view = h.view;
    shell();
    ({ 'nhap': viewNhap, 'dashboard': viewDashboard, 'bao-cao': viewBaoCao, 'quan-tri': viewQuanTri })[h.view](h);
  }
  function cleanup() {
    S.charts.forEach(function (c) { c.destroy(); });
    S.charts = [];
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
  }
  function demoBar() {
    return API.demo ? '<div class="demo-bar">CHẾ ĐỘ DEMO – dữ liệu giả lập, mất khi tải lại trang. Dán API_URL vào <code>js/config.js</code> để dùng Google Sheet thật.</div>' : '';
  }
  function shell() {
    var app = $('#app');
    if (!$('.topbar', app)) {
      app.innerHTML = demoBar() + '<header class="topbar"><div class="topbar-in"><div class="brand"><b>' + esc(CFG.APP_NAME) + '</b><small>' +
        esc(CFG.SUB_NAME) + '</small></div><nav class="nav"></nav><div class="who"></div></div></header><main id="main"></main>';
    }
    $('.nav').innerHTML = navItems().map(function (x) {
      return '<a href="#/' + x[0] + '" class="' + (S.view === x[0] ? 'on' : '') + '">' + x[1] + '</a>';
    }).join('');
    $('.who').innerHTML = '<span>' + esc(S.user.ten) + '</span><span class="role">' + (ROLE[S.user.vaiTro] || S.user.vaiTro) +
      '</span><button class="btn sm" id="btn-out">Đăng xuất</button>';
    $('#btn-out').onclick = function () { if (!S.dirty || confirm('Có số liệu chưa gửi. Vẫn đăng xuất?')) logout(); };
    $('#main').innerHTML = '<div class="empty">Đang tải…</div>';
  }
  function logout(expired) {
    var tok = store.get('ns_token');
    if (tok && !expired) API.call('logout', { token: tok }).catch(function () { });
    store.del('ns_token');
    S.user = null; S.dirty = false; lastHash = '';
    cleanup();
    if (expired) toast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'err');
    history.replaceState(null, '', location.pathname + location.search);
    viewLogin();
  }

  // ---------- Đăng nhập ----------
  function viewLogin() {
    $('#app').innerHTML = demoBar() + '<div class="login"><div class="card"><h1>' + esc(CFG.APP_NAME) + '</h1><div class="muted">' + esc(CFG.SUB_NAME) +
      '</div><form id="f-login" autocomplete="off"><label class="fld">Mã người dùng<input class="input" name="ma" required placeholder="VD: NM1-X1, NM2-VP" autocapitalize="characters"></label>' +
      '<label class="fld">Mã PIN<input class="input" name="pin" type="password" inputmode="numeric" required placeholder="6 chữ số"></label>' +
      '<button class="btn primary" type="submit">Đăng nhập</button>' +
      (API.demo ? '<div class="hint">Demo – PIN <b>123456</b> cho mọi tài khoản: <b>ADMIN</b>, <b>BGD</b> (xem), <b>NM1-VP</b>, <b>NM1-X1</b>, <b>NM1-X2</b>, <b>NM1-KHO</b>, <b>NM2-VP</b>, <b>NM2-X1</b>, <b>NM2-X2</b>.</div>' : '') +
      '</form></div></div>';
    $('#f-login').onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target;
      api('login', { ma: f.ma.value, pin: f.pin.value }).then(function (r) {
        store.set('ns_token', r.token);
        S.user = r.user; S.cfg = r.cfg || {};
        if (!location.hash || location.hash === '#' || location.hash === '#/') go('#/' + (r.user.vaiTro === 'NHAP' ? 'nhap' : 'dashboard'));
        else route();
      }).catch(function (e) { toast(e.message, 'err'); f.pin.value = ''; f.pin.focus(); });
    };
    $('#f-login').ma.focus();
  }

  // =====================================================================
  // LƯỚI NHẬP LIỆU (dùng chung cho Nhập liệu hằng ngày và Admin nhập bù)
  // =====================================================================
  var GCOLS = [
    { f: 'phepNam', h: 'Phép năm', g: 'v' }, { f: 'khongPhep', h: 'Không phép', g: 'v' }, { f: 'om', h: 'Ốm', g: 'v' },
    { f: 'thaiSan', h: 'Thai sản', g: 'v' }, { f: 'viecRieng', h: 'Việc riêng', g: 'v' },
    { f: 'moiBC', h: 'Chính thức', g: 'm' }, { f: 'moiTV', h: 'Thời vụ', g: 'm' }, { f: 'nvBC', h: 'Chính thức', g: 'n' }, { f: 'nvTV', h: 'Thời vụ', g: 'n' },
    { f: 'tangCa', h: 'Tăng ca', g: '' }
  ];
  function xKey(r) { return C.tenXuong(r.xuong, r.donVi); }

  function gridHTML(rows, admin) {
    var th1 = '<tr><th rowspan="2" class="sticky-col">Bộ phận</th><th colspan="2">Quân số đầu ngày</th><th colspan="5" class="g-vang">Số người vắng</th>' +
      '<th colspan="2" class="g-bd">Nhân sự mới</th><th colspan="2" class="g-bd">Nghỉ việc</th><th rowspan="2">Tăng ca<br>(người)</th>' +
      '<th rowspan="2">Quân số<br>trong ngày</th><th rowspan="2">Hiện<br>diện</th><th rowspan="2">Tỷ lệ</th><th rowspan="2">Ghi chú</th><th rowspan="2">Trạng thái</th>' +
      (admin ? '<th rowspan="2"></th>' : '') + '</tr>';
    var th2 = '<tr><th>Chính thức</th><th>Thời vụ</th>' + GCOLS.slice(0, 9).map(function (c) {
      return '<th class="' + (c.g === 'v' ? 'g-vang' : 'g-bd') + '">' + c.h + '</th>';
    }).join('') + '</tr>';
    var body = rows.map(function (r) {
      var v = r.values || {}, ro = isReadOnly(r);
      return '<tr data-ma="' + esc(r.maBP) + '" data-x="' + esc(xKey(r)) + '"><td class="bp sticky-col">' + esc(r.boPhan) + '<small>' + esc(r.maBP) +
        ' · ' + esc(xKey(r).split(' · ')[1]) + '</small></td><td class="calc">' + r.bcDau + '</td><td class="calc">' + r.tvDau + '</td>' +
        GCOLS.map(function (c) {
          return '<td><input class="cell-in" data-f="' + c.f + '" inputmode="numeric" autocomplete="off" value="' + (r.values ? esc(v[c.f]) : '') + '"' +
            (ro ? ' disabled' : '') + ' aria-label="' + esc(r.boPhan + ' – ' + C.LABELS[c.f]) + '"></td>';
        }).join('') +
        '<td class="calc qs"></td><td class="calc hd"></td><td class="calc tl"></td><td><input class="cell-in note" data-f="ghiChu" maxlength="500" value="' +
        esc(v.ghiChu || '') + '"' + (ro ? ' disabled' : '') + ' aria-label="Ghi chú ' + esc(r.boPhan) + '"></td><td class="st"></td>' +
        (admin ? '<td>' + (r.daNhap ? '<button class="btn sm danger" data-del="' + esc(r.maBP) + '">Xóa</button>' : '') + '</td>' : '') + '</tr>';
    }).join('');
    return '<div class="tbl-wrap" style="max-height:calc(100vh - 260px)"><table class="tbl entry"><thead>' + th1 + th2 + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function isReadOnly(r) {
    if (!E || E.mode === 'admin') return false;
    if (E.data.khoa) return true;
    if (r.daNhap && !E.data.choSua) return true;
    return false;
  }
  function readRow(tr) {
    var o = {};
    $$('input[data-f]', tr).forEach(function (i) { o[i.dataset.f] = i.value.trim(); });
    return o;
  }
  function evalRow(tr) {
    var r = E.byMa[tr.dataset.ma], raw = readRow(tr), orig = r.values;
    var blanks = C.FIELDS.filter(function (f) { return raw[f] === ''; }).length;
    var dirty = orig ? (C.FIELDS.some(function (f) { return String(orig[f]) !== raw[f]; }) || String(orig.ghiChu || '') !== raw.ghiChu)
      : (blanks < C.FIELDS.length || raw.ghiChu !== '');
    var tmp = { bcDau: r.bcDau, tvDau: r.tvDau };
    C.FIELDS.forEach(function (f) { var n = Number(raw[f]); tmp[f] = raw[f] === '' || isNaN(n) ? 0 : n; });
    var d = C.derive(tmp), errors = [], warnings = [];
    if (blanks === 0) { var v = C.validateEntry(raw, { bc: r.bcDau, tv: r.tvDau }, S.cfg); errors = v.errors; warnings = v.warnings; }
    $$('input.cell-in', tr).forEach(function (i) {
      if (i.dataset.f === 'ghiChu') return;
      var x = i.value.trim();
      i.classList.toggle('bad', x !== '' && !/^\d+$/.test(x));
    });
    $('.qs', tr).textContent = d.quanSo;
    $('.hd', tr).textContent = d.hienDien;
    var tl = $('.tl', tr), m = blanks < C.FIELDS.length ? C.mucDo(d, S.cfg) : '';
    tl.textContent = blanks < C.FIELDS.length && d.tyLe !== null ? fp(d.tyLe) : '';
    tl.className = 'calc tl ' + lvlClass(m);
    tr.classList.toggle('dirty', dirty);
    tr.classList.toggle('err', errors.length > 0);
    tr.classList.toggle('warn', !errors.length && warnings.length > 0);
    var res = E.results[r.maBP], st = '';
    if (errors.length) st = errors.map(function (e) { return '<span class="e">' + esc(e) + '</span>'; }).join('');
    else if (dirty && blanks) st = '<span class="w">Còn ' + blanks + ' ô trống (không có thì ghi 0)</span>';
    else if (dirty) st = '<span class="w">● Chưa gửi</span>' + warnings.map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join('');
    else if (res && !res.ok) st = (res.errors || []).map(function (e) { return '<span class="e">' + esc(e) + '</span>'; }).join('');
    else if (r.daNhap) {
      var who = /\(([^)]+)\)\s*$/.exec(r.nguoiNhap || '');
      st = '<span class="ok" title="' + esc(r.nguoiNhap || '') + '">✓ ' + (res && res.ok ? esc(res.msg) + ' ' : 'Đã nhập ') + esc((r.thoiDiem || '').slice(11, 16)) +
        '</span> <span class="muted">· ' + esc(who ? who[1] : (r.nguoiNhap || '')) + (r.lanSua ? ' · sửa ' + r.lanSua + ' lần' : '') + (r.nguon === 'ADMIN' ? ' · Admin' : '') + '</span>';
      if (res && res.warnings && res.warnings.length) st += res.warnings.map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join('');
    } else st = '<span class="muted">Chưa nhập</span>';
    $('.st', tr).innerHTML = st;
    tr.classList.toggle('saved', !dirty && !!r.daNhap);
    E.state[r.maBP] = { raw: raw, blanks: blanks, dirty: dirty, errors: errors, warnings: warnings };
  }
  function refreshSaveBar() {
    var st = E.state, ks = Object.keys(st), dirty = ks.filter(function (k) { return st[k].dirty; });
    var bad = dirty.filter(function (k) { return st[k].errors.length || st[k].blanks; });
    S.dirty = dirty.length > 0;
    var msg = $('#save-msg'), btn = $('#btn-save');
    if (!msg) return;
    var done = E.data.rows.filter(function (r) { return r.daNhap; }).length;
    msg.innerHTML = 'Đã nhập <b>' + done + '/' + E.data.rows.length + '</b> bộ phận' +
      (dirty.length ? ' · <b>' + dirty.length + '</b> dòng chưa gửi' : '') + (bad.length ? ' · <span style="color:var(--crit)">' + bad.length + ' dòng cần sửa</span>' : '');
    btn.disabled = !dirty.length || (E.mode === 'entry' && E.data.khoa);
  }
  function bindGrid(root) {
    var tb = $('tbody', root);
    $$('tr', tb).forEach(evalRow);
    tb.addEventListener('input', function (ev) {
      var i = ev.target;
      if (!i.classList.contains('cell-in')) return;
      if (i.dataset.f !== 'ghiChu' && /[^\d]/.test(i.value)) i.value = i.value.replace(/[^\d]/g, '');
      var tr = i.closest('tr'); delete E.results[tr.dataset.ma];
      evalRow(tr); refreshSaveBar();
    });
    tb.addEventListener('keydown', function (ev) {
      var i = ev.target;
      if (!i.classList.contains('cell-in')) return;
      var dir = ev.key === 'Enter' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      var tr = i.closest('tr'), sib = tr;
      do { sib = dir > 0 ? sib.nextElementSibling : sib.previousElementSibling; } while (sib && sib.style.display === 'none');
      if (sib) { var n = $('input[data-f="' + i.dataset.f + '"]', sib); if (n && !n.disabled) { n.focus(); n.select(); } }
    });
    tb.addEventListener('focusin', function (ev) { if (ev.target.classList.contains('cell-in')) ev.target.select(); });
    refreshSaveBar();
  }
  function fillZero() {
    var n = 0;
    $$('#grid tbody tr').forEach(function (tr) {
      if (tr.style.display === 'none') return;
      var r = E.byMa[tr.dataset.ma];
      if (r.daNhap || isReadOnly(r)) return;
      var changed = false;
      $$('input.cell-in', tr).forEach(function (i) { if (i.dataset.f !== 'ghiChu' && i.value.trim() === '' && !i.disabled) { i.value = '0'; changed = true; } });
      if (changed) { evalRow(tr); n++; }
    });
    refreshSaveBar();
    toast(n ? 'Đã điền 0 cho ' + n + ' bộ phận chưa nhập. Kiểm tra lại rồi bấm Gửi.' : 'Không có ô trống nào cần điền.');
  }
  function applyFilter() {
    var x = $('#f-xuong') ? $('#f-xuong').value : '', q = ($('#f-q') ? $('#f-q').value : '').trim().toLowerCase(), only = $('#f-chua') && $('#f-chua').checked;
    $$('#grid tbody tr').forEach(function (tr) {
      var r = E.byMa[tr.dataset.ma];
      var show = (!x || tr.dataset.x === x) && (!q || (r.boPhan + ' ' + r.maBP).toLowerCase().indexOf(q) >= 0) && (!only || !r.daNhap);
      tr.style.display = show ? '' : 'none';
    });
  }
  function collectForSubmit() {
    var st = E.state, dirty = Object.keys(st).filter(function (k) { return st[k].dirty; });
    if (!dirty.length) { toast('Không có thay đổi nào để gửi.'); return null; }
    var inc = dirty.filter(function (k) { return st[k].blanks; }), bad = dirty.filter(function (k) { return st[k].errors.length; });
    if (inc.length || bad.length) {
      var names = inc.concat(bad).map(function (k) { return E.byMa[k].boPhan; });
      toast((inc.length ? inc.length + ' bộ phận còn ô trống' : '') + (inc.length && bad.length ? ', ' : '') + (bad.length ? bad.length + ' bộ phận có lỗi' : '') +
        ':\n' + uniq(names).slice(0, 6).join('\n'), 'err');
      var first = $('#grid tr[data-ma="' + (inc[0] || bad[0]) + '"]');
      if (first) { first.style.display = ''; var inp = $('input.bad', first) || $$('input.cell-in', first).filter(function (i) { return i.value === ''; })[0]; if (inp) inp.focus(); }
      return null;
    }
    return dirty.map(function (k) { return { maBP: k, values: st[k].raw }; });
  }
  function summarizeResults(results) {
    var ok = results.filter(function (r) { return r.ok && r.msg !== 'Không thay đổi'; }).length, err = results.filter(function (r) { return !r.ok; });
    if (err.length) toast('Lưu được ' + ok + ' bộ phận, ' + err.length + ' bộ phận lỗi:\n' + err.map(function (r) { return r.boPhan + ': ' + (r.errors || []).join('; '); }).join('\n'), 'err', 10000);
    else toast('Đã lưu ' + ok + ' bộ phận.', 'ok');
  }

  // ---------- Trang Nhập liệu ----------
  function viewNhap() {
    api('entryForm').then(function (d) { renderEntry(d); }).catch(showErr);
  }
  function renderEntry(data, results, keepRaw) {
    var prevFilter = { x: $('#f-xuong') ? $('#f-xuong').value : '', q: $('#f-q') ? $('#f-q').value : '', chua: $('#f-chua') ? $('#f-chua').checked : false };
    E = { mode: 'entry', data: data, byMa: {}, state: {}, results: {} };
    data.rows.forEach(function (r) { E.byMa[r.maBP] = r; });
    (results || []).forEach(function (r) { E.results[r.maBP] = r; });
    var xs = uniq(data.rows.map(xKey)).sort(), done = data.rows.filter(function (r) { return r.daNhap; }).length;
    var html = '<div class="page-head"><div><h1>Nhập số liệu ngày ' + esc(data.thu) + ', ' + fd(data.ngay) + '</h1><div class="sub">' +
      '<span class="chip info">Giờ chốt ' + esc(data.gioChot) + '</span> <span class="chip ' + (done === data.rows.length ? 'good' : '') + '">Đã nhập ' + done + '/' + data.rows.length + '</span> ' +
      (data.choSua ? '<span class="chip">Được sửa trước giờ chốt</span>' : '<span class="chip warn">Gửi 1 lần, không sửa</span>') + '</div></div>' +
      '<div class="tools">' + (xs.length > 1 ? '<select class="input" id="f-xuong"><option value="">Tất cả xưởng (' + data.rows.length + ' bộ phận)</option>' +
        xs.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' : '') +
      '<input class="input" id="f-q" placeholder="Tìm bộ phận…" style="width:170px">' +
      '<label class="chip" style="cursor:pointer"><input type="checkbox" id="f-chua"> Chỉ bộ phận chưa nhập</label>' +
      '<button class="btn" id="btn-zero"' + (data.khoa ? ' disabled' : '') + '>Điền 0 vào ô trống</button></div></div>';
    if (data.khoa) html += '<div class="banner crit">Đã quá giờ chốt ' + esc(data.gioChot) + ' – số liệu hôm nay đã khóa. Cần bổ sung/sửa, liên hệ Phòng Nhân sự (Admin nhập bù, có ghi lịch sử).</div>';
    else html += '<div class="banner info">Chỉ nhập được cho <b>ngày hôm nay</b> theo giờ máy chủ – không nhập lùi, không nhập trước. Bộ phận không có người vắng/mới/nghỉ việc vẫn ghi <b>0</b> để xác nhận đã báo cáo. Enter/↓ để xuống dòng.</div>';
    if (!data.ngayLamViec) html += '<div class="banner warn">Hôm nay là ngày nghỉ theo lịch. Chỉ nhập nếu bộ phận có đi làm.</div>';
    if (!data.rows.length) html += '<div class="card empty">Tài khoản chưa được phân công bộ phận nào. Liên hệ Phòng Nhân sự.</div>';
    else html += '<div id="grid">' + gridHTML(data.rows, false) + '</div><div class="savebar"><span class="msg" id="save-msg"></span><span style="margin-left:auto"></span>' +
      '<button class="btn" id="btn-reload">Tải lại</button><button class="btn primary" id="btn-save">Gửi số liệu</button></div>';
    $('#main').innerHTML = html;
    if (!data.rows.length) return;
    if ($('#f-xuong')) $('#f-xuong').value = prevFilter.x;
    $('#f-q').value = prevFilter.q; $('#f-chua').checked = prevFilter.chua;
    if (keepRaw) Object.keys(keepRaw).forEach(function (ma) {
      var tr = $('#grid tr[data-ma="' + ma + '"]');
      if (tr) $$('input[data-f]', tr).forEach(function (i) { if (keepRaw[ma][i.dataset.f] !== undefined) i.value = keepRaw[ma][i.dataset.f]; });
    });
    bindGrid($('#grid'));
    applyFilter();
    ['f-xuong', 'f-q', 'f-chua'].forEach(function (id) { var el = $('#' + id); if (el) el.addEventListener('input', applyFilter); });
    $('#btn-zero').onclick = fillZero;
    $('#btn-reload').onclick = function () { if (!S.dirty || confirm('Bỏ các thay đổi chưa gửi?')) { S.dirty = false; viewNhap(); } };
    $('#btn-save').onclick = function () {
      var rows = collectForSubmit();
      if (!rows) return;
      var raw = {};
      rows.forEach(function (r) { raw[r.maBP] = r.values; });
      $('#btn-save').disabled = true;
      api('submitEntry', { ngay: E.data.ngay, rows: rows }).then(function (res) {
        var failed = {};
        res.results.forEach(function (r) { if (!r.ok) failed[r.maBP] = raw[r.maBP]; });
        S.dirty = false;
        renderEntry(res, res.results, failed);
        summarizeResults(res.results);
      }).catch(function (e) {
        toast(e.message, 'err', 9000);
        if (/nhập lùi|giờ chốt/.test(e.message)) { S.dirty = false; viewNhap(); } else refreshSaveBar();
      });
    };
  }

  // =====================================================================
  // DASHBOARD
  // =====================================================================
  function setupChartDefaults() {
    if (!window.Chart || setupChartDefaults.done) return;
    setupChartDefaults.done = true;
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#52514e';
    Chart.defaults.borderColor = '#e1e0d9';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.backgroundColor = '#1f1f1d';
    Chart.defaults.plugins.tooltip.padding = 9;
    Chart.defaults.maintainAspectRatio = false;
  }
  function mkChart(el, cfg) { setupChartDefaults(); if (!window.Chart || !el) return null; var c = new Chart(el, cfg); S.charts.push(c); return c; }
  function pctScale(vals, horizontal) {
    var v = vals.filter(function (x) { return x !== null && x !== undefined; });
    var lo = v.length ? Math.min.apply(null, v) : 0.8;
    var s = { min: Math.max(0, Math.floor((lo - 0.02) * 50) / 50), max: 1, ticks: { callback: function (x) { return Math.round(x * 100) + '%'; } },
      grid: { color: '#ecebe6' }, border: { display: false } };
    if (horizontal) s.grid = { color: '#ecebe6' };
    return s;
  }
  function trendChart(el, labels, series) {
    var all = [];
    series.forEach(function (s) { all = all.concat(s.data); });
    return mkChart(el, {
      type: 'line',
      data: { labels: labels, datasets: series.map(function (s) {
        return { label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, borderWidth: 2, pointRadius: labels.length > 25 ? 0 : 3,
          pointHoverRadius: 5, tension: 0.25, spanGaps: true, borderDash: s.dash || [] };
      }) },
      options: { interaction: { mode: 'index', intersect: false },
        scales: { y: pctScale(all), x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } } },
        plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fp(c.parsed.y); } } } } }
    });
  }

  function viewDashboard(h) {
    var ngay = h.q.ngay || '';
    var load = function () { return api('dashboard', { ngay: ngay }).then(function (d) { renderDash(d.report, d.now); }).catch(showErr); };
    load();
    if (!ngay) S.timer = setInterval(load, Math.max(1, Number(CFG.AUTO_REFRESH_PHUT) || 5) * 60000);
  }
  function renderDash(R, now) {
    cleanupCharts();
    var t = R.tong, cfg = S.cfg, isToday = R.ngay === todayVN();
    var units = R.groups.filter(function (g) { return g.nhom !== 'tong'; });
    var html = '<div class="page-head"><div><h1>Dashboard nhân sự – ' + esc(C.thuDayDu(R.ngay)) + ', ' + fd(R.ngay) + '</h1><div class="sub">' +
      '<span class="chip ' + (R.daNhap === R.tongBP ? 'good' : R.daNhap ? 'warn' : 'crit') + '">Đã nhập ' + R.daNhap + '/' + R.tongBP + ' bộ phận</span> ' +
      (isToday && now ? '<span class="muted">Cập nhật lúc ' + esc(now.hm) + ' · tự làm mới mỗi ' + (CFG.AUTO_REFRESH_PHUT || 5) + ' phút</span>' : '') +
      (!R.ngayLamViec ? ' <span class="chip">Ngày nghỉ theo lịch</span>' : '') + '</div></div>' +
      '<div class="tools"><input type="date" class="input" id="d-ngay" max="' + todayVN() + '" value="' + R.ngay + '"><button class="btn" id="d-today">Hôm nay</button>' +
      '<button class="btn" id="d-reload">Làm mới</button></div></div>';
    if (!t.soBP) {
      html += '<div class="card empty">Chưa có bộ phận nào nhập số liệu cho ngày ' + fd(R.ngay) + '.</div>';
      $('#main').innerHTML = html; bindDashTools(); return;
    }
    html += '<div class="kpis">' +
      '<div class="kpi hero"><div class="lb">Tỷ lệ chuyên cần toàn công ty</div><div class="v">' + fp(t.tyLe) + '</div><div class="s">' + statusChip(t.mucDo, cfg) +
      (t.chenh !== null ? ' ' + deltaHtml(t.chenh) + ' điểm so với ' + shortDate(R.ngayTruoc) : '') +
      ' · Tháng: ' + fp(R.thang.tyLe) + '</div></div>' +
      kpi('Quân số trong ngày', fi(t.quanSo), 'Đầu ngày ' + fi(t.tongDau) + ' · chính thức ' + fi(t.bcDau) + ' · thời vụ ' + fi(t.tvDau)) +
      kpi('Hiện diện', fi(t.hienDien), 'Vắng ' + fi(t.tongVang) + ' người') +
      kpi('Nghỉ không phép', fi(t.khongPhep), 'Lũy kế tháng ' + fi(R.thang.khongPhep) + ' lượt') +
      kpi('Biến động hôm nay', '+' + t.moi + ' / −' + t.nghiViec, 'Tháng: +' + R.luyKeThang.moi + ' / −' + R.luyKeThang.nghiViec) +
      '</div>';
    html += '<div class="card"><h3>Theo đơn vị <small>Tăng ca hôm nay: ' + fi(t.tangCa) + ' người</small></h3><div class="units">' + units.map(function (g, i) {
      var col = g.nhom === 'rieng' ? COLOR.rieng : unitColor(g.key, i);
      return '<div class="unit"><div class="hd"><span class="dot" style="background:' + col + '"></span>' + esc(g.label) + '</div><div class="rt">' + (g.soBP ? fp(g.tyLe) : '—') +
        ' ' + (g.soBP ? statusChip(g.mucDo, cfg) : '') + '</div><div class="bar"><i style="width:' + (g.tyLe ? (g.tyLe * 100).toFixed(1) : 0) + '%;background:' + col + '"></i></div>' +
        '<div class="meta"><span>Hiện diện ' + fi(g.hienDien) + '/' + fi(g.quanSo) + '</span><span>Nhập ' + g.soBP + '/' + g.soBPTong + ' BP</span></div>' +
        '<div class="meta"><span>Vắng ' + fi(g.tongVang) + (g.khongPhep ? ' (KP ' + g.khongPhep + ')' : '') + '</span><span>' + deltaHtml(g.chenh) + (g.chenh !== null ? ' điểm' : '') + '</span></div></div>';
    }).join('') + '</div></div>';
    html += '<div class="grid g-21" style="margin-top:16px"><div class="card"><h3>Xu hướng tỷ lệ chuyên cần <small>45 ngày gần nhất có dữ liệu</small></h3><div class="chart-box"><canvas id="c-trend" role="img" aria-label="Biểu đồ xu hướng tỷ lệ chuyên cần"></canvas></div></div>' +
      '<div class="card"><h3>Chưa nhập <small>' + R.chuaNhap.length + ' bộ phận</small></h3>' +
      (R.chuaNhap.length ? '<ul class="list" style="max-height:290px;overflow:auto">' + R.chuaNhap.map(function (n) { return '<li><span>' + esc(n) + '</span><span class="chip crit">Chưa nhập</span></li>'; }).join('') + '</ul>'
        : '<div class="empty">Tất cả bộ phận đã nhập ✓</div>') + '</div></div>';
    html += '<div class="grid g2" style="margin-top:16px"><div class="card"><h3>Cơ cấu vắng mặt theo đơn vị <small>số người</small></h3><div class="chart-box"><canvas id="c-vang" role="img" aria-label="Biểu đồ cơ cấu vắng mặt"></canvas></div></div>' +
      '<div class="card"><h3>Tỷ lệ chuyên cần theo xưởng</h3><div class="chart-box"><canvas id="c-xuong" role="img" aria-label="Biểu đồ tỷ lệ theo xưởng"></canvas></div></div></div>';
    html += '<div class="grid g-21" style="margin-top:16px"><div class="card"><h3>Bộ phận chuyên cần thấp nhất</h3>' + lowTable(R.thapNhat) +
      (R.bienDong.length ? '<h3 style="margin-top:18px">Biến động nhân sự hôm nay</h3>' + bienDongTable(R.bienDong) : '') + '</div>' +
      '<div class="card"><h3>Bản tin nhanh <small>gửi Zalo</small></h3><pre class="bulletin" id="bt">' + esc(R.banTin) + '</pre><div style="margin-top:10px"><button class="btn primary" id="btn-copy">Sao chép bản tin</button></div></div></div>';
    $('#main').innerHTML = html;
    bindDashTools();
    $('#btn-copy').onclick = function () { copyText(R.banTin); };
    trendChart($('#c-trend'), R.trend.map(function (x) { return shortDate(x.ngay); }),
      [{ label: 'Toàn công ty', color: COLOR.tong, data: R.trend.map(function (x) { return x.tyLe; }), dash: [5, 4] }].concat(R.nhomDefs.map(function (g, i) {
        return { label: g.label, color: unitColor(g.key, i), data: R.trend.map(function (x) { return x.nhom[g.key]; }) };
      })));
    mkChart($('#c-vang'), {
      type: 'bar',
      data: { labels: C.VANG.map(function (f) { return C.LABELS[f]; }), datasets: R.vangTheoDonVi.map(function (u, i) {
        return { label: u.label, data: C.VANG.map(function (f) { return u[f]; }), backgroundColor: unitColor(u.key, i), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 };
      }) },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#ecebe6' }, border: { display: false } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'top', align: 'end' } } }
    });
    var xs = R.xuong.filter(function (x) { return x.soBP; });
    mkChart($('#c-xuong'), {
      type: 'bar',
      data: { labels: xs.map(function (x) { return x.label; }), datasets: [{ label: 'Tỷ lệ chuyên cần', data: xs.map(function (x) { return x.tyLe; }),
        backgroundColor: xs.map(function (x, i) { return unitColor(x.label.slice(0, 3), i); }), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24 }] },
      options: { indexAxis: 'y', scales: { x: pctScale(xs.map(function (x) { return x.tyLe; }), true), y: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var x = xs[c.dataIndex]; return ' ' + fp(x.tyLe) + ' · hiện diện ' + x.hienDien + '/' + x.quanSo + ' · ' + x.soBP + '/' + x.soBPTong + ' BP'; } } } } }
    });
  }
  function cleanupCharts() { S.charts.forEach(function (c) { c.destroy(); }); S.charts = []; }
  function kpi(lb, v, s) { return '<div class="kpi"><div class="lb">' + lb + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
  function bindDashTools() {
    $('#d-ngay').onchange = function () { var v = this.value; if (v) go('#/dashboard?ngay=' + v); };
    $('#d-today').onclick = function () { go('#/dashboard'); };
    $('#d-reload').onclick = function () { route(); };
  }
  function lowTable(rows) {
    if (!rows.length) return '<div class="empty">Chưa có dữ liệu.</div>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="text-align:left">Bộ phận</th><th>Quân số</th><th>Vắng</th><th>Không phép</th><th>Tỷ lệ</th><th>So với hôm trước</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="bp">' + esc(r.boPhan) + '</td><td class="num">' + fi(r.quanSo) + '</td><td class="num">' + fi(r.tongVang) + '</td><td class="num">' + (r.khongPhep || '') +
          '</td><td class="num ' + lvlClass(r.mucDo) + '">' + fp(r.tyLe) + '</td><td class="num">' + deltaHtml(r.chenh) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function bienDongTable(rows) {
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="text-align:left">Bộ phận</th><th>Mới<br>chính thức</th><th>Mới<br>thời vụ</th><th>Nghỉ việc<br>chính thức</th><th>Nghỉ việc<br>thời vụ</th><th>Lũy kế tháng: mới</th><th>Lũy kế tháng: nghỉ</th></tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr><td class="bp">' + esc(b.boPhan) + '</td><td class="num">' + (b.moiBC || '') + '</td><td class="num">' + (b.moiTV || '') + '</td><td class="num">' + (b.nvBC || '') +
          '</td><td class="num">' + (b.nvTV || '') + '</td><td class="num">' + b.moiThang + '</td><td class="num">' + b.nghiViecThang + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // =====================================================================
  // BÁO CÁO
  // =====================================================================
  function viewBaoCao(h) {
    var sub = h.sub || 'ngay';
    var tabs = [['ngay', 'Báo cáo ngày'], ['thang', 'Tổng hợp tháng'], ['bo-phan', 'Theo bộ phận (tháng)'], ['tinh-trang', 'Tình trạng nhập']];
    $('#main').innerHTML = '<div class="tabs">' + tabs.map(function (t) {
      return '<a href="#/bao-cao/' + t[0] + '" class="' + (t[0] === sub ? 'on' : '') + '">' + t[1] + '</a>';
    }).join('') + '</div><div id="rp"><div class="empty">Đang tải…</div></div>';
    if (sub === 'ngay') return rpNgay(h.q.ngay || '');
    if (sub === 'thang') return rpThang(h.q.thang || todayVN().slice(0, 7));
    if (sub === 'bo-phan') return rpBoPhan(h.q.thang || todayVN().slice(0, 7));
    if (sub === 'tinh-trang') return rpTinhTrang(h.q.ngay || '');
  }
  var AGG_COLS = [
    ['bcDau', 'Chính thức'], ['tvDau', 'Thời vụ'], ['tongDau', 'Tổng đầu ngày'], ['moi', 'Mới'], ['nghiViec', 'Nghỉ việc'], ['quanSo', 'Quân số trong ngày'],
    ['phepNam', 'Phép năm'], ['khongPhep', 'Không phép'], ['om', 'Ốm'], ['thaiSan', 'Thai sản'], ['viecRieng', 'Việc riêng'], ['tongVang', 'Tổng vắng'],
    ['hienDien', 'Hiện diện']
  ];
  function aggCells(a, entered) {
    return AGG_COLS.map(function (c) { return '<td class="num">' + (entered || c[0] === 'bcDau' || c[0] === 'tvDau' || c[0] === 'tongDau' ? fi(a[c[0]]) : '') + '</td>'; }).join('') +
      '<td class="num ' + lvlClass(a.mucDo) + '">' + fp(a.tyLe) + '</td><td class="num">' + fp(a.tyLeTruoc) + '</td><td class="num">' + deltaHtml(a.chenh) +
      '</td><td class="num">' + (entered ? fi(a.tangCa) : '') + '</td><td class="nowrap">' + esc(a.canhBao || '') + '</td>';
  }
  function aggHead(first) {
    return '<tr><th style="text-align:left" class="sticky-col">' + first + '</th>' + AGG_COLS.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') +
      '<th>Tỷ lệ chuyên cần</th><th>Ngày trước</th><th>Chênh (điểm)</th><th>Tăng ca</th><th>Cảnh báo</th></tr>';
  }
  function rpTools(inner) { return '<div class="page-head"><div class="tools" style="margin-left:0">' + inner + '</div></div>'; }

  function rpNgay(ngay) {
    api('dailyReport', { ngay: ngay }).then(function (d) {
      var R = d.report;
      var html = '<div class="page-head"><div><h1>Báo cáo nhân sự ngày ' + fd(R.ngay) + ' (' + R.thu + ')</h1><div class="sub">Đã nhập ' + R.daNhap + '/' + R.tongBP +
        ' bộ phận' + (R.ngayTruoc ? ' · so sánh với ngày ' + fd(R.ngayTruoc) : '') + ' · tỷ lệ chỉ tính bộ phận đã nhập</div></div><div class="tools">' +
        '<input type="date" class="input" id="r-ngay" max="' + todayVN() + '" value="' + R.ngay + '"><button class="btn" id="r-csv">Xuất CSV</button><button class="btn" onclick="window.print()">In</button></div></div>';
      html += '<div class="card"><h3>I. Tổng hợp theo đơn vị</h3><div class="tbl-wrap"><table class="tbl"><thead>' + aggHead('Đơn vị') + '</thead><tbody>' +
        R.groups.map(function (g) {
          return '<tr class="' + (g.nhom === 'tong' ? 'tot' : '') + '"><td class="sticky-col">' + esc(g.label) + ' <span class="muted">(' + g.soBP + '/' + g.soBPTong + ')</span></td>' + aggCells(g, g.soBP > 0) + '</tr>';
        }).join('') + '</tbody></table></div></div>';
      html += '<div class="card"><h3>Theo xưởng</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th style="text-align:left">Xưởng</th><th>BP đã nhập</th><th>Quân số</th><th>Vắng</th><th>Không phép</th><th>Hiện diện</th><th>Tỷ lệ</th><th>Tăng ca</th></tr></thead><tbody>' +
        R.xuong.map(function (x) {
          return '<tr><td>' + esc(x.label) + '</td><td class="num">' + x.soBP + '/' + x.soBPTong + '</td><td class="num">' + fi(x.quanSo) + '</td><td class="num">' + fi(x.tongVang) +
            '</td><td class="num">' + fi(x.khongPhep) + '</td><td class="num">' + fi(x.hienDien) + '</td><td class="num ' + lvlClass(x.mucDo) + '">' + fp(x.tyLe) + '</td><td class="num">' + fi(x.tangCa) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      var dvs = uniq(R.rows.map(function (r) { return r.donVi; }));
      html += '<div class="card"><h3>II. Chi tiết theo bộ phận</h3><div class="tbl-wrap" style="max-height:70vh"><table class="tbl"><thead>' + aggHead('Bộ phận') + '</thead><tbody>' +
        dvs.map(function (dv) {
          return '<tr class="grp"><td class="sticky-col" colspan="' + (AGG_COLS.length + 6) + '">' + esc(dv) + '</td></tr>' + R.rows.filter(function (r) { return r.donVi === dv; }).map(function (r) {
            return '<tr><td class="bp sticky-col">' + esc(r.boPhan) + '<small>' + esc(r.maBP + ' · ' + xKey(r).split(' · ')[1]) + (r.ghiChu ? ' · ' + esc(r.ghiChu) : '') + '</small></td>' + aggCells(r, r.daNhap) + '</tr>';
          }).join('');
        }).join('') + '</tbody></table></div></div>';
      html += '<div class="grid g-21"><div class="card"><h3>III. Biến động nhân sự</h3>' + (R.bienDong.length ? bienDongTable(R.bienDong) : '<div class="empty">Không có nhân sự mới / nghỉ việc trong ngày.</div>') +
        '<div class="muted" style="margin-top:8px">Lũy kế tháng toàn công ty: mới ' + R.luyKeThang.moi + ' (chính thức ' + R.luyKeThang.moiBC + ', thời vụ ' + R.luyKeThang.moiTV + '), nghỉ việc ' +
        R.luyKeThang.nghiViec + ' (chính thức ' + R.luyKeThang.nvBC + ', thời vụ ' + R.luyKeThang.nvTV + ').</div></div>' +
        '<div class="card"><h3>Bản tin nhanh <small>gửi Zalo</small></h3><pre class="bulletin">' + esc(R.banTin) + '</pre><div style="margin-top:10px"><button class="btn primary" id="r-copy">Sao chép bản tin</button></div></div></div>';
      $('#rp').innerHTML = html;
      $('#r-ngay').onchange = function () { if (this.value) go('#/bao-cao/ngay?ngay=' + this.value); };
      $('#r-copy').onclick = function () { copyText(R.banTin); };
      $('#r-csv').onclick = function () {
        var hd = ['Loại', 'Đơn vị', 'Xưởng', 'Bộ phận', 'Đã nhập'].concat(AGG_COLS.map(function (c) { return c[1]; })).concat(['Tỷ lệ chuyên cần', 'Tỷ lệ ngày trước', 'Chênh (điểm)', 'Tăng ca', 'Cảnh báo', 'Ghi chú']);
        var line = function (loai, a, dv, xg, bp, entered) {
          return [loai, dv, xg, bp, entered ? 'Có' : 'Chưa'].concat(AGG_COLS.map(function (c) { return entered || /Dau$/.test(c[0]) ? a[c[0]] : ''; }))
            .concat([fp(a.tyLe), fp(a.tyLeTruoc), a.chenh === null || a.chenh === undefined ? '' : a.chenh.toFixed(1).replace('.', ','), entered ? a.tangCa : '', a.canhBao || '', a.ghiChu || '']);
        };
        var rows = R.groups.map(function (g) { return line('Đơn vị', g, g.label, '', '', g.soBP > 0); })
          .concat(R.rows.map(function (r) { return line('Bộ phận', r, r.donVi, r.xuong, r.boPhan, r.daNhap); }));
        downloadCSV('BaoCaoNhanSu_' + R.ngay + '.csv', hd, rows);
      };
    }).catch(function (e) { $('#rp').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }

  function rpThang(thang) {
    api('monthlyReport', { thang: thang }).then(function (d) {
      var R = d.report, groups = R.nhomDefs;
      var html = '<div class="page-head"><div><h1>Tổng hợp chuyên cần tháng ' + R.thang.slice(5) + '/' + R.thang.slice(0, 4) + '</h1><div class="sub">' + R.tong.soNgay +
        ' ngày có dữ liệu · tỷ lệ cả tháng ' + fp(R.tong.tyLe) + ' (tính theo người-ngày)</div></div><div class="tools"><input type="month" class="input" id="r-thang" max="' + todayVN().slice(0, 7) +
        '" value="' + R.thang + '"><button class="btn" id="r-csv">Xuất CSV</button><button class="btn" onclick="window.print()">In</button></div></div>';
      html += '<div class="card"><h3>Tỷ lệ chuyên cần theo ngày</h3><div class="chart-box"><canvas id="c-m" role="img" aria-label="Tỷ lệ chuyên cần theo ngày trong tháng"></canvas></div></div>';
      var hd = ['Ngày', 'Thứ', 'BP đã nhập', 'Quân số', 'Hiện diện', 'Tổng vắng', 'Không phép', 'Tỷ lệ'].concat(groups.map(function (g) { return 'Tỷ lệ ' + g.label; })).concat(['Mới', 'Nghỉ việc', 'Tăng ca']);
      html += '<div class="card"><h3>Chi tiết theo ngày</h3><div class="tbl-wrap"><table class="tbl"><thead><tr>' + hd.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        R.days.map(function (x) {
          if (!x.coDuLieu) return '<tr class="muted"><td>' + fd(x.ngay) + '</td><td>' + x.thu + '</td><td colspan="' + (hd.length - 2) + '">' + (x.ngayLamViec ? 'Không có dữ liệu' : 'Ngày nghỉ') + '</td></tr>';
          return '<tr><td>' + fd(x.ngay) + '</td><td>' + x.thu + '</td><td class="num">' + x.soBP + '</td><td class="num">' + fi(x.quanSo) + '</td><td class="num">' + fi(x.hienDien) +
            '</td><td class="num">' + fi(x.tongVang) + '</td><td class="num">' + fi(x.khongPhep) + '</td><td class="num ' + lvlClass(x.mucDo) + '">' + fp(x.tyLe) + '</td>' +
            groups.map(function (g) { return '<td class="num">' + fp(x.nhom[g.key]) + '</td>'; }).join('') +
            '<td class="num">' + (x.moi || '') + '</td><td class="num">' + (x.nghiViec || '') + '</td><td class="num">' + fi(x.tangCa) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td colspan="2">Cả tháng (người-ngày)</td><td class="num">' + R.tong.soNgay + ' ngày</td><td class="num">' + fi(R.tong.quanSo) + '</td><td class="num">' +
        fi(R.tong.hienDien) + '</td><td class="num">' + fi(R.tong.tongVang) + '</td><td class="num">' + fi(R.tong.khongPhep) + '</td><td class="num">' + fp(R.tong.tyLe) + '</td>' +
        groups.map(function (g) { return '<td class="num">' + fp(R.tong.nhom[g.key]) + '</td>'; }).join('') + '<td class="num">' + R.tong.moi + '</td><td class="num">' + R.tong.nghiViec +
        '</td><td class="num">' + fi(R.tong.tangCa) + '</td></tr></tfoot></table></div><div class="muted" style="margin-top:8px">Tỷ lệ theo đơn vị ở dòng cả tháng là trung bình các ngày có dữ liệu. ' +
        'Tăng ca cộng theo lượt người-ngày.</div></div>';
      $('#rp').innerHTML = html;
      $('#r-thang').onchange = function () { if (this.value) go('#/bao-cao/thang?thang=' + this.value); };
      var dd = R.days.filter(function (x) { return x.coDuLieu; });
      trendChart($('#c-m'), dd.map(function (x) { return shortDate(x.ngay); }),
        [{ label: 'Toàn công ty', color: COLOR.tong, data: dd.map(function (x) { return x.tyLe; }), dash: [5, 4] }].concat(groups.map(function (g, i) {
          return { label: g.label, color: /\(trong/.test(g.label) ? COLOR.rieng : unitColor(g.key, i), data: dd.map(function (x) { return x.nhom[g.key]; }) };
        })));
      $('#r-csv').onclick = function () {
        downloadCSV('TongHopThang_' + R.thang + '.csv', hd, R.days.filter(function (x) { return x.coDuLieu; }).map(function (x) {
          return [fd(x.ngay), x.thu, x.soBP, x.quanSo, x.hienDien, x.tongVang, x.khongPhep, fp(x.tyLe)].concat(groups.map(function (g) { return fp(x.nhom[g.key]); }))
            .concat([x.moi, x.nghiViec, x.tangCa]);
        }).concat([['Cả tháng', '', R.tong.soNgay, R.tong.quanSo, R.tong.hienDien, R.tong.tongVang, R.tong.khongPhep, fp(R.tong.tyLe)]
          .concat(groups.map(function (g) { return fp(R.tong.nhom[g.key]); })).concat([R.tong.moi, R.tong.nghiViec, R.tong.tangCa])]));
      };
    }).catch(function (e) { $('#rp').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }

  function rpBoPhan(thang) {
    api('monthlyReport', { thang: thang }).then(function (d) {
      var R = d.report, rows = R.byBp.slice(), sortKey = '', sortDir = 1;
      rows.forEach(function (r) { r.xuongTen = xKey(r).split(' · ')[1]; });
      var cols = [['donVi', 'Đơn vị', 's'], ['xuongTen', 'Xưởng', 's'], ['boPhan', 'Bộ phận', 's'], ['soNgayNhap', 'Ngày đã nhập', 'n'], ['quanSoCuoi', 'Quân số cuối kỳ', 'n'],
        ['quanSo', 'Người-ngày', 'n'], ['phepNam', 'Phép năm', 'n'], ['khongPhep', 'Không phép', 'n'], ['om', 'Ốm', 'n'], ['thaiSan', 'Thai sản', 'n'], ['viecRieng', 'Việc riêng', 'n'],
        ['tongVang', 'Tổng vắng', 'n'], ['tyLe', 'Tỷ lệ chuyên cần', 'p'], ['soNgayDuoiNguong', 'Số ngày dưới ' + fp(C.nguongDo(S.cfg), 0), 'n'], ['moi', 'Mới', 'n'],
        ['nghiViec', 'Nghỉ việc', 'n'], ['tangCa', 'Tăng ca (lượt)', 'n']];
      var draw = function () {
        $('#bp-body').innerHTML = rows.map(function (r) {
          return '<tr>' + cols.map(function (c) {
            var v = r[c[0]];
            if (c[2] === 's') return '<td' + (c[0] === 'boPhan' ? ' class="bp"' : '') + '>' + esc(v) + '</td>';
            if (c[2] === 'p') return '<td class="num ' + lvlClass(r.mucDo) + '">' + fp(v) + '</td>';
            return '<td class="num">' + (r.soNgayNhap || c[0] === 'quanSoCuoi' ? fi(v) : '') + '</td>';
          }).join('') + '</tr>';
        }).join('');
      };
      var html = '<div class="page-head"><div><h1>Tổng hợp theo bộ phận – tháng ' + R.thang.slice(5) + '/' + R.thang.slice(0, 4) + '</h1><div class="sub">Từ ' + fd(R.tuNgay) + ' đến ' + fd(R.denNgay) +
        ' · bấm tiêu đề cột để sắp xếp</div></div><div class="tools"><input type="month" class="input" id="r-thang" max="' + todayVN().slice(0, 7) + '" value="' + R.thang +
        '"><button class="btn" id="r-csv">Xuất CSV</button><button class="btn" onclick="window.print()">In</button></div></div>' +
        '<div class="card"><div class="tbl-wrap" style="max-height:75vh"><table class="tbl"><thead><tr>' + cols.map(function (c, i) {
          return '<th data-i="' + i + '" style="cursor:pointer">' + esc(c[1]) + '</th>';
        }).join('') + '</tr></thead><tbody id="bp-body"></tbody></table></div></div>';
      $('#rp').innerHTML = html;
      draw();
      $$('#rp thead th').forEach(function (th) {
        th.onclick = function () {
          var c = cols[+th.dataset.i];
          sortDir = sortKey === c[0] ? -sortDir : (c[2] === 's' ? 1 : -1); sortKey = c[0];
          rows.sort(function (a, b) {
            var x = a[c[0]], y = b[c[0]];
            if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
            return (c[2] === 's' ? String(x).localeCompare(String(y), 'vi') : x - y) * sortDir;
          });
          draw();
        };
      });
      $('#r-thang').onchange = function () { if (this.value) go('#/bao-cao/bo-phan?thang=' + this.value); };
      $('#r-csv').onclick = function () {
        downloadCSV('TheoBoPhan_' + R.thang + '.csv', cols.map(function (c) { return c[1]; }), rows.map(function (r) {
          return cols.map(function (c) { return c[2] === 'p' ? fp(r[c[0]]) : r[c[0]]; });
        }));
      };
    }).catch(function (e) { $('#rp').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }

  function rpTinhTrang(ngay) {
    api('status', { ngay: ngay }).then(function (d) {
      var R = d.report, done = R.rows.filter(function (r) { return r.daNhap; }).length;
      var html = '<div class="page-head"><div><h1>Tình trạng nhập ngày ' + fd(R.ngay) + ' (' + R.thu + ')</h1><div class="sub"><span class="chip ' + (done === R.rows.length ? 'good' : 'warn') + '">Đã nhập ' +
        done + '/' + R.rows.length + '</span>' + (!R.ngayLamViec ? ' <span class="chip">Ngày nghỉ theo lịch</span>' : '') + '</div></div><div class="tools"><input type="date" class="input" id="r-ngay" max="' +
        todayVN() + '" value="' + R.ngay + '"><label class="chip" style="cursor:pointer"><input type="checkbox" id="r-chua"> Chỉ bộ phận chưa nhập</label></div></div>';
      if (R.chuaPhanXuong && S.user.vaiTro === 'ADMIN') html += '<div class="banner warn">' + R.chuaPhanXuong + ' bộ phận chưa gán Xưởng trong sheet DanhMuc. Khi chưa gán, mọi người nhập của cùng nhà máy đều thấy các bộ phận này.</div>';
      html += '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Đơn vị</th><th>Xưởng</th><th style="text-align:left">Bộ phận</th><th>Trạng thái</th><th>Người nhập</th><th>Thời điểm</th><th>Lần sửa</th><th>Nguồn</th></tr></thead><tbody>' +
        R.rows.map(function (r) {
          return '<tr data-chua="' + (r.daNhap ? 0 : 1) + '"><td>' + esc(r.donVi) + '</td><td>' + esc(xKey(r).split(' · ')[1]) + '</td><td class="bp">' + esc(r.boPhan) + '</td><td>' +
            (r.daNhap ? '<span class="chip good">✓ Đã nhập</span>' : '<span class="chip crit">Chưa nhập</span>') + '</td><td>' + esc(r.nguoiNhap) + '</td><td>' + esc(r.thoiDiem) +
            '</td><td class="num">' + (r.lanSua || '') + '</td><td>' + (r.nguon === 'ADMIN' ? 'Admin' : r.nguon ? 'Form' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      $('#rp').innerHTML = html;
      $('#r-ngay').onchange = function () { if (this.value) go('#/bao-cao/tinh-trang?ngay=' + this.value); };
      $('#r-chua').onchange = function () { var on = this.checked; $$('#rp tbody tr').forEach(function (tr) { tr.style.display = on && tr.dataset.chua === '0' ? 'none' : ''; }); };
    }).catch(function (e) { $('#rp').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }

  // =====================================================================
  // QUẢN TRỊ
  // =====================================================================
  function viewQuanTri(h) {
    var sub = h.sub || 'nhap-bu';
    var tabs = [['nhap-bu', 'Nhập bù / sửa số liệu'], ['lich-su', 'Lịch sử chỉnh sửa']];
    $('#main').innerHTML = '<div class="tabs">' + tabs.map(function (t) {
      return '<a href="#/quan-tri/' + t[0] + '" class="' + (t[0] === sub ? 'on' : '') + '">' + t[1] + '</a>';
    }).join('') + (CFG.SHEET_URL ? '<a href="' + esc(CFG.SHEET_URL) + '" target="_blank" rel="noopener">Mở Google Sheet ↗</a>' : '') + '</div><div id="qt"><div class="empty">Đang tải…</div></div>';
    if (sub === 'lich-su') return qtLichSu();
    qtNhapBu(h.q.ngay || '');
  }
  function qtNhapBu(ngay) {
    api('adminDay', { ngay: ngay }).then(function (d) { renderAdmin(d); }).catch(function (e) { $('#qt').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }
  function renderAdmin(data, results, keepRaw) {
    var prevLyDo = $('#a-lydo') ? $('#a-lydo').value : '', prevChua = $('#f-chua') ? $('#f-chua').checked : false, prevQ = $('#f-q') ? $('#f-q').value : '';
    E = { mode: 'admin', data: data, byMa: {}, state: {}, results: {} };
    data.rows.forEach(function (r) { E.byMa[r.maBP] = r; });
    (results || []).forEach(function (r) { E.results[r.maBP] = r; });
    var html = '<div class="page-head"><div><h1>Nhập bù / sửa số liệu ngày ' + esc(data.thu) + ', ' + fd(data.ngay) + '</h1><div class="sub">Chỉ Admin. Mọi thay đổi ghi vào sheet LichSu kèm lý do; quân số các ngày sau tự tính lại.</div></div>' +
      '<div class="tools"><input type="date" class="input" id="a-ngay" max="' + todayVN() + '" value="' + data.ngay + '"><input class="input" id="f-q" placeholder="Tìm bộ phận…" style="width:160px">' +
      '<label class="chip" style="cursor:pointer"><input type="checkbox" id="f-chua"> Chỉ bộ phận chưa nhập</label><button class="btn" id="btn-zero">Điền 0 vào ô trống</button></div></div>' +
      '<div id="grid">' + gridHTML(data.rows, true) + '</div><div class="savebar"><span class="msg" id="save-msg"></span><input class="input" id="a-lydo" placeholder="Lý do nhập bù/sửa (bắt buộc)" style="flex:1;min-width:240px">' +
      '<button class="btn primary" id="btn-save">Lưu thay đổi</button></div>';
    $('#qt').innerHTML = html;
    $('#a-lydo').value = prevLyDo; $('#f-chua').checked = prevChua; $('#f-q').value = prevQ;
    if (keepRaw) Object.keys(keepRaw).forEach(function (ma) {
      var tr = $('#grid tr[data-ma="' + ma + '"]');
      if (tr) $$('input[data-f]', tr).forEach(function (i) { if (keepRaw[ma][i.dataset.f] !== undefined) i.value = keepRaw[ma][i.dataset.f]; });
    });
    bindGrid($('#grid'));
    applyFilter();
    ['f-q', 'f-chua'].forEach(function (id) { $('#' + id).addEventListener('input', applyFilter); });
    $('#btn-zero').onclick = fillZero;
    $('#a-ngay').onchange = function () { if (this.value && (!S.dirty || confirm('Bỏ các thay đổi chưa lưu?'))) { S.dirty = false; go('#/quan-tri/nhap-bu?ngay=' + this.value); } };
    $('#btn-save').onclick = function () {
      var rows = collectForSubmit();
      if (!rows) return;
      var lyDo = $('#a-lydo').value.trim();
      if (lyDo.length < 5) { toast('Ghi lý do nhập bù/sửa (ít nhất 5 ký tự).', 'err'); $('#a-lydo').focus(); return; }
      var raw = {};
      rows.forEach(function (r) { raw[r.maBP] = r.values; });
      api('adminSave', { ngay: E.data.ngay, rows: rows, lyDo: lyDo }).then(function (res) {
        var failed = {};
        res.results.forEach(function (r) { if (!r.ok) failed[r.maBP] = raw[r.maBP]; });
        S.dirty = false;
        renderAdmin(res, res.results, failed);
        summarizeResults(res.results);
        if (res.capNhatCuonChieu) toast('Đã tính lại quân số cho ' + res.capNhatCuonChieu + ' dòng của các ngày sau.', 'ok');
      }).catch(function (e) { toast(e.message, 'err', 9000); });
    };
    $('#grid').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-del]');
      if (!b) return;
      var ma = b.dataset.del, r = E.byMa[ma];
      var lyDo = prompt('Xóa số liệu ngày ' + fd(E.data.ngay) + ' của ' + r.boPhan + '?\nNhập lý do xóa (bắt buộc):', '');
      if (lyDo === null) return;
      if (lyDo.trim().length < 5) { toast('Lý do xóa cần ít nhất 5 ký tự.', 'err'); return; }
      api('adminDelete', { ngay: E.data.ngay, maBP: ma, lyDo: lyDo }).then(function (res) { S.dirty = false; renderAdmin(res); toast('Đã xóa số liệu của ' + r.boPhan + '.', 'ok'); })
        .catch(function (e) { toast(e.message, 'err'); });
    });
  }
  function qtLichSu() {
    api('history', { limit: 200 }).then(function (d) {
      var diff = function (a, b) {
        try {
          var x = a ? JSON.parse(a) : {}, y = b ? JSON.parse(b) : {}, out = [];
          C.FIELDS.forEach(function (f) { if ((x[f] || 0) !== (y[f] || 0) && (a && b)) out.push(C.LABELS[f] + ' ' + (x[f] || 0) + '→' + (y[f] || 0)); });
          if (!a && b) out.push('Nhập mới: vắng ' + C.VANG.reduce(function (s, f) { return s + (y[f] || 0); }, 0));
          if (a && !b) out.push('Đã xóa');
          return out.join('; ');
        } catch (e) { return ''; }
      };
      $('#qt').innerHTML = '<div class="card"><h3>200 thao tác gần nhất <small>đầy đủ trong sheet LichSu</small></h3><div class="tbl-wrap" style="max-height:75vh"><table class="tbl"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Ngày số liệu</th><th style="text-align:left">Bộ phận</th><th style="text-align:left">Thay đổi</th><th style="text-align:left">Lý do</th></tr></thead><tbody>' +
        (d.rows.length ? d.rows.map(function (r) {
          return '<tr><td class="nowrap">' + esc(r.thoiDiem) + '</td><td>' + esc(r.nguoi) + '</td><td class="nowrap">' + esc(r.hanhDong) + '</td><td>' + fd(r.ngay) + '</td><td>' + esc(r.boPhan) +
            '</td><td>' + esc(diff(r.truoc, r.sau)) + '</td><td>' + esc(r.lyDo) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="empty">Chưa có lịch sử.</td></tr>') + '</tbody></table></div></div>';
    }).catch(function (e) { $('#qt').innerHTML = '<div class="banner crit">' + esc(e.message) + '</div>'; });
  }

  // ---------- Khởi động ----------
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (ev) { if (S.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  function init() {
    document.title = CFG.APP_NAME || document.title;
    var tok = store.get('ns_token');
    if (!tok) return viewLogin();
    api('me').then(function (r) { S.user = r.user; S.cfg = r.cfg || {}; route(); }).catch(function () { store.del('ns_token'); viewLogin(); });
  }
  init();
})();
