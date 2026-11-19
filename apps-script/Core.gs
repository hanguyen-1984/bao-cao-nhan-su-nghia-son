/**
 * NSCore – lõi tính toán dùng chung cho Hệ thống báo cáo nhân sự hằng ngày NM1/NM2.
 * File này chạy được ở 2 nơi, nội dung PHẢI giống hệt nhau:
 *   - Trình duyệt (GitHub Pages):  js/core.js
 *   - Google Apps Script:          apps-script/Core.gs
 * Không dùng API riêng của trình duyệt hay của Apps Script trong file này.
 */
var NSCore = (function () {
  'use strict';

  var VANG = ['phepNam', 'khongPhep', 'om', 'thaiSan', 'viecRieng'];
  var BIEN_DONG = ['moiBC', 'moiTV', 'nvBC', 'nvTV'];
  var FIELDS = VANG.concat(BIEN_DONG).concat(['tangCa']);
  var LABELS = {
    phepNam: 'Phép năm', khongPhep: 'Nghỉ không phép', om: 'Nghỉ ốm', thaiSan: 'Thai sản',
    viecRieng: 'Việc riêng', moiBC: 'Mới (chính thức)', moiTV: 'Mới (thời vụ)',
    nvBC: 'Nghỉ việc (chính thức)', nvTV: 'Nghỉ việc (thời vụ)', tangCa: 'Tăng ca (người)'
  };
  var THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var THU_DAY_DU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  // ---------- Ngày tháng (chuỗi yyyy-MM-dd, không phụ thuộc múi giờ) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function toUTC(ymd) { var p = ymd.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fromUTC(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(ymd, n) { return fromUTC(toUTC(ymd) + n * 86400000); }
  function weekday(ymd) { return new Date(toUTC(ymd)).getUTCDay(); }
  function thu(ymd) { return THU[weekday(ymd)]; }
  function thuDayDu(ymd) { return THU_DAY_DU[weekday(ymd)]; }
  function fmtDate(ymd) { if (!isYmd(ymd)) return ''; var p = ymd.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function monthDays(ym) {
    var out = [], d = ym + '-01';
    while (d.slice(0, 7) === ym) { out.push(d); d = addDays(d, 1); }
    return out;
  }
  function eom(ym) { var days = monthDays(ym); return days[days.length - 1]; }

  // ---------- Định dạng số kiểu Việt Nam ----------
  function fmtInt(n) {
    if (n === null || n === undefined || n === '') return '';
    var s = String(Math.round(Number(n))), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + s;
  }
  function fmtPct(x, digits) {
    if (x === null || x === undefined || x === '' || isNaN(x)) return '';
    return (x * 100).toFixed(digits === undefined ? 1 : digits).replace('.', ',') + '%';
  }
  function fmtDelta(pp) {
    if (pp === null || pp === undefined || isNaN(pp)) return '';
    var s = Math.abs(pp).toFixed(1).replace('.', ',');
    return (pp > 0.05 ? '+' : pp < -0.05 ? '−' : '±') + s;
  }

  // ---------- Cấu hình ----------
  function cfgNum(cfg, key, def) { var v = Number(cfg && cfg[key]); return isNaN(v) || cfg[key] === '' ? def : v; }
  function nguongDo(cfg) { return cfgNum(cfg, 'NGUONG_DO', 0.9); }
  function nguongVang(cfg) { return cfgNum(cfg, 'NGUONG_VANG', 0.95); }
  function ngayNghiTuan(cfg) {
    var raw = String((cfg && cfg.NGAY_NGHI_TUAN) || 'CN').toUpperCase();
    return raw.split(/[,; ]+/).map(function (t) { return THU.indexOf(t.trim()); }).filter(function (i) { return i >= 0; });
  }
  function boolCfg(v, def) {
    if (v === true || v === false) return v;
    if (v === undefined || v === null || v === '') return def;
    return /^(true|1|có|co|yes|x)$/i.test(String(v).trim());
  }

  // ---------- Phạm vi người nhập ----------
  /**
   * Phạm vi là danh sách mã, cách nhau dấu phẩy: "*" (tất cả), mã nhà máy "NM1",
   * mã xưởng "NM1-X1" hoặc mã bộ phận "NM1-05".
   * Bộ phận CHƯA được gán xưởng thì người phụ trách bất kỳ xưởng nào của cùng nhà máy đều thấy
   * (để hệ thống chạy được ngay, trước khi Nhân sự điền cột Xưởng).
   */
  var XUONG_TEN = { VP: 'Văn phòng', KHO: 'Kho' };
  /** Chuẩn hóa mã xưởng: "X1" của NM1 → "NM1-X1"; đã có tiền tố thì giữ nguyên. */
  function normXuong(donVi, xuong) {
    var dv = String(donVi || '').trim().toUpperCase(), x = String(xuong || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!x) return '';
    return x.indexOf(dv + '-') === 0 ? x : dv + '-' + x;
  }
  /** Tên hiển thị: "NM1-X1" → "NM1 · Xưởng 1", "NM2-VP" → "NM2 · Văn phòng". */
  function tenXuong(code, donVi) {
    var c = String(code || '').toUpperCase(), dv = String(donVi || c.split('-')[0] || '').toUpperCase();
    if (!c || c === dv + '-?') return dv + ' · chưa phân xưởng';
    var suf = c.indexOf(dv + '-') === 0 ? c.slice(dv.length + 1) : c, m = /^X(\d+)$/.exec(suf);
    return dv + ' · ' + (m ? 'Xưởng ' + m[1] : XUONG_TEN[suf] || suf);
  }
  function scopeTokens(phamVi) {
    return String(phamVi || '').toUpperCase().split(/[,;]+/).map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function inScope(phamVi, bp) {
    var tk = scopeTokens(phamVi);
    if (tk.indexOf('*') >= 0) return true;
    var dv = String(bp.donVi || '').toUpperCase(), xg = normXuong(dv, bp.xuong), ma = String(bp.maBP || '').toUpperCase();
    if (tk.indexOf(ma) >= 0 || tk.indexOf(dv) >= 0 || (xg && tk.indexOf(xg) >= 0)) return true;
    if (!xg) { // chưa gán xưởng: người phụ trách bất kỳ nhóm nào của cùng nhà máy đều thấy
      for (var i = 0; i < tk.length; i++) if (tk[i].indexOf(dv + '-') === 0 && !/^\d+$/.test(tk[i].slice(dv.length + 1))) return true;
    }
    return false;
  }

  // ---------- Chỉ mục dữ liệu ----------
  /** ctx = { danhMuc:[...], records:[...], cfg:{}, ngayNghi:[ymd] } */
  function buildIndex(ctx) {
    var byDate = {}, byBp = {}, dates = [], bpMap = {};
    (ctx.danhMuc || []).forEach(function (bp) { bp.xuong = normXuong(bp.donVi, bp.xuong); bpMap[bp.maBP] = bp; });
    (ctx.records || []).forEach(function (r) {
      if (!isYmd(r.ngay)) return;
      if (!byDate[r.ngay]) { byDate[r.ngay] = []; dates.push(r.ngay); }
      byDate[r.ngay].push(r);
      (byBp[r.maBP] = byBp[r.maBP] || []).push(r);
    });
    dates.sort();
    Object.keys(byBp).forEach(function (k) { byBp[k].sort(function (a, b) { return a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0; }); });
    var active = (ctx.danhMuc || []).filter(function (bp) { return bp.dangDung !== false; });
    var donVis = [];
    active.forEach(function (bp) { if (donVis.indexOf(bp.donVi) < 0) donVis.push(bp.donVi); });
    return {
      ctx: ctx, cfg: ctx.cfg || {}, byDate: byDate, byBp: byBp, dates: dates, bpMap: bpMap,
      active: active, donVis: donVis,
      ngayNghi: (ctx.ngayNghi || []).reduce(function (m, d) { m[d] = true; return m; }, {})
    };
  }

  function isWorkingDay(ix, ymd) {
    return ngayNghiTuan(ix.cfg).indexOf(weekday(ymd)) < 0 && !ix.ngayNghi[ymd];
  }
  function prevDataDate(ix, ymd) {
    for (var i = ix.dates.length - 1; i >= 0; i--) if (ix.dates[i] < ymd) return ix.dates[i];
    return '';
  }
  function lastDataDate(ix, upTo) {
    for (var i = ix.dates.length - 1; i >= 0; i--) if (!upTo || ix.dates[i] <= upTo) return ix.dates[i];
    return '';
  }
  function recordOf(ix, ymd, maBP) {
    var list = ix.byDate[ymd] || [];
    for (var i = 0; i < list.length; i++) if (list[i].maBP === maBP) return list[i];
    return null;
  }

  // ---------- Quân số cuốn chiếu ----------
  /**
   * Quân số đầu ngày của bộ phận = cuối ngày của lần nhập gần nhất trước đó
   * (đầu ngày + mới − nghỉ việc, tách chính thức/thời vụ).
   * Nếu Danh mục có "Áp dụng từ": từ ngày đó quân số bắt đầu lại bằng số gốc rồi cuốn chiếu tiếp;
   * các ngày trước ngày áp dụng giữ nguyên lịch sử.
   */
  function computeBase(bp, recsAsc, ymd) {
    var from = isYmd(bp.apDung) && ymd >= bp.apDung ? bp.apDung : '', last = null;
    (recsAsc || []).forEach(function (r) { if (r.ngay < ymd && r.ngay >= from) last = r; });
    if (!last) return { bc: num(bp.bcGoc), tv: num(bp.tvGoc), tuNgay: from || null, nguon: 'Danh mục' };
    return {
      bc: Math.max(0, num(last.bcDau) + num(last.moiBC) - num(last.nvBC)),
      tv: Math.max(0, num(last.tvDau) + num(last.moiTV) - num(last.nvTV)),
      tuNgay: last.ngay, nguon: 'Cuốn chiếu'
    };
  }
  function baseFor(ix, maBP, ymd) {
    var bp = ix.bpMap[maBP];
    return bp ? computeBase(bp, ix.byBp[maBP] || [], ymd) : { bc: 0, tv: 0, tuNgay: null, nguon: '' };
  }

  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }

  function derive(r) {
    var o = {};
    o.bcDau = num(r.bcDau); o.tvDau = num(r.tvDau);
    FIELDS.forEach(function (f) { o[f] = num(r[f]); });
    o.tongDau = o.bcDau + o.tvDau;
    o.moi = o.moiBC + o.moiTV;
    o.nghiViec = o.nvBC + o.nvTV;
    o.quanSo = o.tongDau + o.moi - o.nghiViec;
    o.tongVang = VANG.reduce(function (s, f) { return s + o[f]; }, 0);
    o.hienDien = o.quanSo - o.tongVang;
    o.tyLe = o.quanSo > 0 ? o.hienDien / o.quanSo : null;
    return o;
  }

  // ---------- Kiểm tra số liệu nhập ----------
  /** raw: object các ô nhập (chuỗi hoặc số). base: {bc, tv}. Trả về {values, derived, errors, warnings}. */
  function validateEntry(raw, base, cfg) {
    var errors = [], warnings = [], values = {};
    FIELDS.forEach(function (f) {
      var v = raw ? raw[f] : undefined;
      if (v === '' || v === null || v === undefined) { errors.push(LABELS[f] + ': chưa nhập (không có thì ghi 0)'); return; }
      var n = Number(String(v).trim());
      if (!isFinite(n) || Math.floor(n) !== n) { errors.push(LABELS[f] + ': phải là số nguyên'); return; }
      if (n < 0) { errors.push(LABELS[f] + ': không được âm'); return; }
      if (n > 9999) { errors.push(LABELS[f] + ': số quá lớn'); return; }
      values[f] = n;
    });
    values.ghiChu = raw && raw.ghiChu ? String(raw.ghiChu).slice(0, 500) : '';
    if (errors.length) return { values: values, derived: null, errors: errors, warnings: warnings };
    var d = derive({ bcDau: base.bc, tvDau: base.tv, phepNam: values.phepNam, khongPhep: values.khongPhep, om: values.om,
      thaiSan: values.thaiSan, viecRieng: values.viecRieng, moiBC: values.moiBC, moiTV: values.moiTV,
      nvBC: values.nvBC, nvTV: values.nvTV, tangCa: values.tangCa });
    if (values.nvBC > num(base.bc) + values.moiBC) errors.push('Nghỉ việc chính thức (' + values.nvBC + ') lớn hơn quân số chính thức (' + (num(base.bc) + values.moiBC) + ')');
    if (values.nvTV > num(base.tv) + values.moiTV) errors.push('Nghỉ việc thời vụ (' + values.nvTV + ') lớn hơn quân số thời vụ (' + (num(base.tv) + values.moiTV) + ')');
    if (d.tongVang > d.quanSo) errors.push('Tổng vắng (' + d.tongVang + ') lớn hơn quân số trong ngày (' + d.quanSo + ')');
    if (!errors.length) {
      if (d.tangCa > d.hienDien) warnings.push('Tăng ca (' + d.tangCa + ') nhiều hơn số hiện diện (' + d.hienDien + ')');
      if (d.tyLe !== null && d.tyLe < nguongDo(cfg)) warnings.push('Tỷ lệ chuyên cần ' + fmtPct(d.tyLe) + ' dưới ngưỡng ' + fmtPct(nguongDo(cfg), 0));
    }
    return { values: values, derived: d, errors: errors, warnings: warnings };
  }

  // ---------- Cộng dồn ----------
  var SUM_KEYS = ['bcDau', 'tvDau', 'tongDau', 'moiBC', 'moiTV', 'moi', 'nvBC', 'nvTV', 'nghiViec', 'quanSo',
    'phepNam', 'khongPhep', 'om', 'thaiSan', 'viecRieng', 'tongVang', 'hienDien', 'tangCa'];
  function emptyAgg() { var a = { soBP: 0 }; SUM_KEYS.forEach(function (k) { a[k] = 0; }); return a; }
  function addAgg(a, d) { SUM_KEYS.forEach(function (k) { a[k] += num(d[k]); }); a.soBP++; return a; }
  function finishAgg(a) { a.tyLe = a.quanSo > 0 ? a.hienDien / a.quanSo : null; return a; }

  function canhBao(d, cfg) {
    if (!d || d.tyLe === null || d.tyLe === undefined) return '';
    var out = [];
    if (d.tyLe < nguongDo(cfg)) out.push('Dưới ' + fmtPct(nguongDo(cfg), 0));
    else if (d.tyLe < nguongVang(cfg)) out.push('Dưới ' + fmtPct(nguongVang(cfg), 0));
    if (d.khongPhep > 0) out.push('Có nghỉ không phép');
    return out.join(' | ');
  }
  function mucDo(d, cfg) {
    if (!d || d.tyLe === null || d.tyLe === undefined) return '';
    return d.tyLe < nguongDo(cfg) ? 'do' : d.tyLe < nguongVang(cfg) ? 'vang' : 'tot';
  }

  /** Cộng các bản ghi của 1 ngày theo bộ lọc bộ phận. */
  function aggDay(ix, ymd, filter) {
    var a = emptyAgg();
    (ix.byDate[ymd] || []).forEach(function (r) {
      var bp = ix.bpMap[r.maBP] || r;
      if (!filter || filter(bp)) addAgg(a, derive(r));
    });
    return finishAgg(a);
  }

  function groupDefs(ix) {
    var g = ix.donVis.map(function (dv) {
      return { key: dv, label: dv, nhom: 'donvi', filter: function (bp) { return bp.donVi === dv; } };
    });
    ix.active.forEach(function (bp) {
      if (bp.rieng) g.push({ key: bp.maBP, label: tenRieng(bp), nhom: 'rieng', filter: function (b) { return b.maBP === bp.maBP; } });
    });
    g.push({ key: 'ALL', label: 'Toàn công ty', nhom: 'tong', filter: null });
    return g;
  }
  function tenRieng(bp) {
    var n = String(bp.boPhan || '').replace(/^NM\d+\s*-\s*/i, '');
    n = n.toLowerCase().replace(/(^|\s)(\S)/g, function (m, s, c) { return s + c.toUpperCase(); });
    return n + ' (trong ' + bp.donVi + ')';
  }
  function xuongKey(bp) { return bp.xuong ? String(bp.xuong) : bp.donVi + '-?'; }
  function xuongDefs(ix) {
    var keys = [], dvOf = {};
    ix.active.forEach(function (bp) { var k = xuongKey(bp); if (keys.indexOf(k) < 0) { keys.push(k); dvOf[k] = bp.donVi; } });
    return keys.map(function (k) { return { key: k, label: tenXuong(k, dvOf[k]), filter: function (bp) { return xuongKey(bp) === k; } }; });
  }

  // ---------- Báo cáo ngày ----------
  function dailyReport(ix, ymd) {
    var cfg = ix.cfg, prev = prevDataDate(ix, ymd), ym = ymd.slice(0, 7);
    var entered = 0;
    var rows = ix.active.map(function (bp) {
      var r = recordOf(ix, ymd, bp.maBP), row = { maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong || '', boPhan: bp.boPhan, daNhap: !!r };
      if (r) {
        entered++;
        var d = derive(r);
        for (var k in d) row[k] = d[k];
        row.ghiChu = r.ghiChu || ''; row.nguoiNhap = r.nguoiNhap || ''; row.thoiDiem = r.thoiDiem || ''; row.nguon = r.nguon || '';
        var pr = prev ? recordOf(ix, prev, bp.maBP) : null;
        row.tyLeTruoc = pr ? derive(pr).tyLe : null;
        row.chenh = row.tyLe !== null && row.tyLeTruoc !== null ? (row.tyLe - row.tyLeTruoc) * 100 : null;
        row.canhBao = canhBao(d, cfg); row.mucDo = mucDo(d, cfg);
      } else {
        var b = baseFor(ix, bp.maBP, ymd);
        row.bcDau = b.bc; row.tvDau = b.tv; row.tongDau = b.bc + b.tv; row.tyLe = null; row.canhBao = 'Chưa nhập'; row.mucDo = 'chua';
      }
      return row;
    });
    var groups = groupDefs(ix).map(function (g) {
      var a = aggDay(ix, ymd, g.filter), p = prev ? aggDay(ix, prev, g.filter) : null;
      a.key = g.key; a.label = g.label; a.nhom = g.nhom;
      a.tyLeTruoc = p ? p.tyLe : null;
      a.chenh = a.tyLe !== null && a.tyLeTruoc !== null ? (a.tyLe - a.tyLeTruoc) * 100 : null;
      a.canhBao = canhBao(a, cfg); a.mucDo = mucDo(a, cfg);
      a.soBPTong = ix.active.filter(function (bp) { return !g.filter || g.filter(bp); }).length;
      return a;
    });
    var xuong = xuongDefs(ix).map(function (g) {
      var a = aggDay(ix, ymd, g.filter); a.key = g.key; a.label = g.label; a.mucDo = mucDo(a, cfg);
      a.soBPTong = ix.active.filter(g.filter).length; return a;
    });
    var bienDong = rows.filter(function (r) { return r.daNhap && (r.moi > 0 || r.nghiViec > 0); }).map(function (r) {
      var lk = luyKe(ix, r.maBP, ym + '-01', ymd);
      return { maBP: r.maBP, donVi: r.donVi, boPhan: r.boPhan, moi: r.moi, nghiViec: r.nghiViec,
        moiBC: r.moiBC, moiTV: r.moiTV, nvBC: r.nvBC, nvTV: r.nvTV, moiThang: lk.moi, nghiViecThang: lk.nghiViec };
    });
    var lkAll = luyKe(ix, null, ym + '-01', ymd);
    var rep = {
      ngay: ymd, thu: thu(ymd), ngayTruoc: prev, ngayLamViec: isWorkingDay(ix, ymd),
      daNhap: entered, tongBP: ix.active.length, rows: rows, groups: groups, xuong: xuong, bienDong: bienDong,
      chuaNhap: rows.filter(function (r) { return !r.daNhap; }).map(function (r) { return r.boPhan; }),
      luyKeThang: lkAll
    };
    rep.banTin = bulletin(rep);
    return rep;
  }

  function luyKe(ix, maBP, from, to) {
    var o = { moi: 0, nghiViec: 0, moiBC: 0, moiTV: 0, nvBC: 0, nvTV: 0 };
    var list = maBP ? (ix.byBp[maBP] || []) : (ix.ctx.records || []);
    list.forEach(function (r) {
      if (r.ngay >= from && r.ngay <= to) {
        o.moiBC += num(r.moiBC); o.moiTV += num(r.moiTV); o.nvBC += num(r.nvBC); o.nvTV += num(r.nvTV);
      }
    });
    o.moi = o.moiBC + o.moiTV; o.nghiViec = o.nvBC + o.nvTV;
    return o;
  }

  function bulletin(rep) {
    var t = rep.groups[rep.groups.length - 1];
    if (!t || t.soBP === 0) return 'Chưa có dữ liệu nhân sự ngày ' + fmtDate(rep.ngay) + '.';
    var L = [];
    L.push('BÁO CÁO NHÂN SỰ NGÀY ' + fmtDate(rep.ngay) + ' (' + rep.thu + ')');
    L.push('Đã nhập: ' + rep.daNhap + '/' + rep.tongBP + ' bộ phận');
    L.push('• Toàn công ty: quân số ' + fmtInt(t.quanSo) + ', hiện diện ' + fmtInt(t.hienDien) + ' (' + fmtPct(t.tyLe) + ')' +
      (t.chenh !== null ? ', ' + fmtDelta(t.chenh) + ' điểm so với ' + fmtDate(rep.ngayTruoc) : ''));
    rep.groups.forEach(function (g) {
      if (g.nhom === 'tong' || g.soBP === 0) return;
      L.push('• ' + g.label + ': ' + fmtInt(g.hienDien) + '/' + fmtInt(g.quanSo) + ' (' + fmtPct(g.tyLe) + ')');
    });
    L.push('Vắng ' + fmtInt(t.tongVang) + ': phép năm ' + t.phepNam + ', không phép ' + t.khongPhep + ', ốm ' + t.om +
      ', thai sản ' + t.thaiSan + ', việc riêng ' + t.viecRieng);
    var bd = 'Nhân sự mới ' + t.moi + ', nghỉ việc ' + t.nghiViec;
    if (rep.bienDong.length) {
      var parts = rep.bienDong.slice(0, 8).map(function (b) {
        var s = []; if (b.moi) s.push('+' + b.moi); if (b.nghiViec) s.push('−' + b.nghiViec);
        return b.boPhan + ' ' + s.join('/');
      });
      bd += ' (' + parts.join('; ') + (rep.bienDong.length > 8 ? '; …' : '') + ')';
    }
    L.push(bd);
    L.push('Lũy kế tháng: mới ' + rep.luyKeThang.moi + ', nghỉ việc ' + rep.luyKeThang.nghiViec);
    L.push('Tăng ca: ' + fmtInt(t.tangCa) + ' người');
    var low = rep.rows.filter(function (r) { return r.mucDo === 'do'; });
    if (low.length) L.push('Chuyên cần thấp: ' + low.map(function (r) { return r.boPhan + ' ' + fmtPct(r.tyLe); }).join('; '));
    if (rep.chuaNhap.length) L.push('Chưa nhập: ' + rep.chuaNhap.join(', '));
    return L.join('\n');
  }

  // ---------- Tổng hợp tháng ----------
  function monthlyReport(ix, ym, upTo) {
    var cfg = ix.cfg, defs = groupDefs(ix);
    var days = monthDays(ym).filter(function (d) { return !upTo || d <= upTo; }).map(function (d) {
      var t = aggDay(ix, d, null), o = { ngay: d, thu: thu(d), ngayLamViec: isWorkingDay(ix, d), coDuLieu: t.soBP > 0 };
      SUM_KEYS.forEach(function (k) { o[k] = t[k]; });
      o.tyLe = t.tyLe; o.soBP = t.soBP; o.mucDo = mucDo(t, cfg);
      o.nhom = {};
      defs.forEach(function (g) { if (g.nhom !== 'tong') o.nhom[g.key] = aggDay(ix, d, g.filter).tyLe; });
      return o;
    });
    var tot = emptyAgg(), soNgay = 0;
    days.forEach(function (d) { if (d.coDuLieu) { soNgay++; SUM_KEYS.forEach(function (k) { tot[k] += d[k]; }); } });
    finishAgg(tot);
    tot.soNgay = soNgay;
    tot.nhom = {};
    defs.forEach(function (g) {
      if (g.nhom === 'tong') return;
      var vals = days.map(function (d) { return d.nhom[g.key]; }).filter(function (v) { return v !== null && v !== undefined; });
      tot.nhom[g.key] = vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : null;
    });
    var from = ym + '-01', to = upTo && upTo < eom(ym) ? upTo : eom(ym);
    var byBp = ix.active.map(function (bp) {
      var a = emptyAgg(), duoi = 0;
      (ix.byBp[bp.maBP] || []).forEach(function (r) {
        if (r.ngay < from || r.ngay > to) return;
        var d = derive(r); addAgg(a, d);
        if (d.tyLe !== null && d.tyLe < nguongDo(cfg)) duoi++;
      });
      finishAgg(a);
      a.maBP = bp.maBP; a.donVi = bp.donVi; a.xuong = bp.xuong || ''; a.boPhan = bp.boPhan; a.soNgayNhap = a.soBP;
      a.soNgayDuoiNguong = duoi; a.mucDo = mucDo(a, cfg);
      a.quanSoCuoi = (function () { var b = baseFor(ix, bp.maBP, addDays(to, 1)); return b.bc + b.tv; })();
      return a;
    });
    var nhomDefs = defs.filter(function (g) { return g.nhom !== 'tong'; }).map(function (g) { return { key: g.key, label: g.label }; });
    return { thang: ym, tuNgay: from, denNgay: to, days: days, tong: tot, byBp: byBp, nhomDefs: nhomDefs,
      soNgayLamViec: days.filter(function (d) { return d.ngayLamViec; }).length };
  }

  // ---------- Dashboard ----------
  function dashboard(ix, ymd) {
    var rep = dailyReport(ix, ymd), cfg = ix.cfg;
    var trendDates = ix.dates.filter(function (d) { return d <= ymd && d > addDays(ymd, -45); });
    var defs = groupDefs(ix).filter(function (g) { return g.nhom === 'donvi'; });
    var trend = trendDates.map(function (d) {
      var o = { ngay: d, tyLe: aggDay(ix, d, null).tyLe, nhom: {} };
      defs.forEach(function (g) { o.nhom[g.key] = aggDay(ix, d, g.filter).tyLe; });
      return o;
    });
    var vangTheoDonVi = defs.map(function (g) {
      var a = aggDay(ix, ymd, g.filter), o = { key: g.key, label: g.label };
      VANG.forEach(function (f) { o[f] = a[f]; });
      return o;
    });
    var thap = rep.rows.filter(function (r) { return r.daNhap && r.tyLe !== null; })
      .sort(function (a, b) { return a.tyLe - b.tyLe; }).slice(0, 8);
    var thang = monthlyReport(ix, ymd.slice(0, 7), ymd);
    return {
      ngay: ymd, thu: thu(ymd), ngayTruoc: rep.ngayTruoc, ngayLamViec: rep.ngayLamViec, daNhap: rep.daNhap, tongBP: rep.tongBP,
      tong: rep.groups[rep.groups.length - 1], groups: rep.groups, xuong: rep.xuong, chuaNhap: rep.chuaNhap,
      bienDong: rep.bienDong, luyKeThang: rep.luyKeThang, trend: trend, nhomDefs: defs.map(function (g) { return { key: g.key, label: g.label }; }),
      vangTheoDonVi: vangTheoDonVi, thapNhat: thap, banTin: rep.banTin,
      thang: { tyLe: thang.tong.tyLe, soNgay: thang.tong.soNgay, khongPhep: thang.tong.khongPhep, tangCa: thang.tong.tangCa }
    };
  }

  // ---------- Tình trạng nhập ----------
  function entryStatus(ix, ymd) {
    return {
      ngay: ymd, thu: thu(ymd), ngayLamViec: isWorkingDay(ix, ymd),
      rows: ix.active.map(function (bp) {
        var r = recordOf(ix, ymd, bp.maBP);
        return { maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong || '', boPhan: bp.boPhan, daNhap: !!r,
          nguoiNhap: r ? r.nguoiNhap : '', thoiDiem: r ? r.thoiDiem : '', lanSua: r ? r.lanSua : 0, nguon: r ? r.nguon : '' };
      })
    };
  }

  /** Tính lại quân số đầu ngày cho chuỗi bản ghi của 1 bộ phận (sau khi sửa ngày cũ hoặc đổi số gốc). */
  function recalcChain(bp, recsAsc, fromYmd) {
    var changed = [];
    var sorted = (recsAsc || []).slice().sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
    sorted.forEach(function (r, i) {
      if (fromYmd && r.ngay <= fromYmd) return;
      if (isYmd(bp.apDung) && r.ngay < bp.apDung) return; // trước ngày áp dụng số gốc mới: giữ nguyên lịch sử
      var b = computeBase(bp, sorted.slice(0, i), r.ngay);
      if (num(r.bcDau) !== b.bc || num(r.tvDau) !== b.tv) { r.bcDau = b.bc; r.tvDau = b.tv; changed.push(r); }
    });
    return changed;
  }

  return {
    VANG: VANG, BIEN_DONG: BIEN_DONG, FIELDS: FIELDS, LABELS: LABELS,
    isYmd: isYmd, addDays: addDays, weekday: weekday, thu: thu, thuDayDu: thuDayDu, fmtDate: fmtDate, monthDays: monthDays,
    fmtInt: fmtInt, fmtPct: fmtPct, fmtDelta: fmtDelta, boolCfg: boolCfg, nguongDo: nguongDo, nguongVang: nguongVang,
    inScope: inScope, normXuong: normXuong, tenXuong: tenXuong, buildIndex: buildIndex, isWorkingDay: isWorkingDay, prevDataDate: prevDataDate, lastDataDate: lastDataDate,
    recordOf: recordOf, computeBase: computeBase, baseFor: baseFor, derive: derive, validateEntry: validateEntry,
    dailyReport: dailyReport, monthlyReport: monthlyReport, dashboard: dashboard, entryStatus: entryStatus,
    recalcChain: recalcChain, luyKe: luyKe, mucDo: mucDo
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NSCore;
