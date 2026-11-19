/**
 * BACKEND DEMO – mô phỏng Apps Script ngay trong trình duyệt (dữ liệu giả, mất khi tải lại trang).
 * Chỉ dùng khi js/config.js chưa có API_URL. Tài khoản demo: ADMIN, BGD, NM1-VP, NM1-X1, NM1-X2, NM1-KHO, NM2-VP, NM2-X1, NM2-X2 – PIN 123456.
 */
var Demo = (function () {
  'use strict';
  var C = NSCore;
  var SEED = [
    ['NM1', 'VP', 'NM1 - BGĐ', 2, 0], ['NM1', 'VP', 'NM1 - KẾ TOÁN', 4, 0], ['NM1', 'VP', 'NM1 - NHÂN SỰ', 5, 0], ['NM1', 'VP', 'NM1 - KINH DOANH B2B', 4, 0],
    ['NM1', 'VP', 'NM1 - KỸ THUẬT', 6, 0], ['NM1', 'VP', 'NM1 - KẾ HOẠCH', 4, 0], ['NM1', 'VP', 'NM1 - XNK', 2, 0], ['NM1', 'X1', 'NM1 - QUẢN ĐỐC - CƠ ĐIỆN', 3, 0],
    ['NM1', 'X1', 'NM1 - TÀI XẾ', 2, 0], ['NM1', 'X1', 'NM1 - NGUYÊN LIÊỤ', 6, 0], ['NM1', 'X1', 'NM1 - TCBG', 34, 4], ['NM1', 'X2', 'NM1 - TCVS', 55, 14],
    ['NM1', 'X1', 'NM1 - LẮP RÁP', 7, 0], ['NM1', 'X1', 'NM1 - NHÚNG DẦU', 9, 0], ['NM1', 'X1', 'NM1 - ĐÓNG GÓI', 15, 0], ['NM1', 'X1', 'NM1 - QC', 7, 0],
    ['NM1', 'X1', 'NM1 - THỐNG KÊ - XE NÂNG- KHO', 6, 0], ['NM1', 'X1', 'NM1 - LÒ SẤY - BẢO VỆ - TẠP VỤ', 14, 1], ['NM1', 'KHO', 'NM1 - KHO THANH BÌNH', 2, 31], ['NM2', 'VP', 'NM2 - BGĐ', 1, 0],
    ['NM2', 'VP', 'NM2 - KẾ TOÁN', 3, 0], ['NM2', 'VP', 'NM2 - NHÂN SỰ', 2, 0], ['NM2', 'VP', 'NM2 - KINH DOANH ECOM', 10, 0], ['NM2', 'VP', 'NM2 - KỸ THUẬT', 4, 0],
    ['NM2', 'VP', 'NM2 - KẾ HOẠCH', 2, 0], ['NM2', 'VP', 'NM2 - XNK', 1, 0], ['NM2', 'X1', 'NM2 - QUẢN ĐỐC - CƠ ĐIỆN', 4, 0], ['NM2', 'X1', 'NM2 - TÀI XẾ', 0, 0],
    ['NM2', 'X1', 'NM2 - NGUYÊN LIÊỤ', 5, 1], ['NM2', 'X1', 'NM2 - SƠ CHẾ', 22, 12], ['NM2', 'X2', 'NM2 - TCBG', 32, 14], ['NM2', 'X1', 'NM2 - TCVS', 32, 14],
    ['NM2', 'X2', 'NM2 - LẮP RÁP', 18, 5], ['NM2', 'X2', 'NM2 - NHÚNG DẦU VỈ', 10, 4], ['NM2', 'X1', 'NM2 - NHÚNG DẦU', 15, 6], ['NM2', 'X2', 'NM2 - ĐÓNG GÓI', 12, 17],
    ['NM2', 'X1', 'NM2 - QC', 7, 0], ['NM2', 'X1', 'NM2 - THỐNG KÊ - XE NÂNG- KHO', 10, 0], ['NM2', 'X1', 'NM2 - LÒ SẤY BẢO VỆ - TẠP VỤ', 12, 3], ['NM2', 'X2', 'NM2 - MẪU', 4, 0]
  ];
  var cnt = {};
  var danhMuc = SEED.map(function (r, i) {
    cnt[r[0]] = (cnt[r[0]] || 0) + 1;
    return { stt: i + 1, maBP: r[0] + '-' + ('0' + cnt[r[0]]).slice(-2), donVi: r[0], xuong: r[1], boPhan: r[2],
      bcGoc: r[3], tvGoc: r[4], apDung: '', rieng: r[2] === 'NM1 - KHO THANH BÌNH', dangDung: true };
  });
  var users = {};
  [
    ['ADMIN', 'Admin Phòng Nhân sự', 'ADMIN', '*'],
    ['BGD', 'Ban Giám đốc (chỉ xem)', 'XEM', '*'],
    ['NM1-VP', 'Thống kê NM1 – Văn phòng', 'NHAP', 'NM1-VP'],
    ['NM1-X1', 'Thống kê NM1 – Xưởng 1', 'NHAP', 'NM1-X1'],
    ['NM1-X2', 'Thống kê NM1 – Xưởng 2', 'NHAP', 'NM1-X2'],
    ['NM1-KHO', 'Thống kê NM1 – Kho Thanh Bình', 'NHAP', 'NM1-KHO'],
    ['NM2-VP', 'Thống kê NM2 – Văn phòng', 'NHAP', 'NM2-VP'],
    ['NM2-X1', 'Thống kê NM2 – Xưởng 1', 'NHAP', 'NM2-X1'],
    ['NM2-X2', 'Thống kê NM2 – Xưởng 2', 'NHAP', 'NM2-X2']
  ].forEach(function (u) { users[u[0]] = { ten: u[1], vaiTro: u[2], phamVi: u[3] }; });
  var cfg = { GIO_CHOT: '23:59', CHO_SUA_TRONG_NGAY: 'TRUE', NGAY_NGHI_TUAN: 'CN', NGUONG_DO: '0.9', NGUONG_VANG: '0.95' };
  var records = [], logs = [], sessions = {};

  function now() {
    var s = new Date(Date.now() + 7 * 3600000).toISOString();
    return { ymd: s.slice(0, 10), hm: s.slice(11, 16), ts: s.slice(0, 19).replace('T', ' ') };
  }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(20261117);
  var SX = /TCBG|TCVS|LẮP RÁP|NHÚNG|ĐÓNG GÓI|SƠ CHẾ|KHO THANH|LÒ SẤY|NGUYÊN|MẪU/;

  function recsOf(ma) { return records.filter(function (r) { return r.maBP === ma; }).sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; }); }
  function genRecord(bp, d, ts, who) {
    var base = C.computeBase(bp, recsOf(bp.maBP), d), qs = base.bc + base.tv, sx = SX.test(bp.boPhan);
    var r = { ngay: d, maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong, boPhan: bp.boPhan, bcDau: base.bc, tvDau: base.tv,
      phepNam: 0, khongPhep: 0, om: 0, thaiSan: 0, viecRieng: 0, moiBC: 0, moiTV: 0, nvBC: 0, nvTV: 0, tangCa: 0,
      ghiChu: '', nguoiNhap: who, thoiDiem: ts, lanSua: 0, nguon: 'FORM' };
    if (qs > 0) {
      var p = (sx ? 0.055 : 0.025) * (0.4 + R() * 1.4), vang = Math.min(qs - 1, Math.round(qs * p + (R() < 0.3 ? R() * 2 : 0)));
      var w = [['phepNam', 0.28], ['khongPhep', 0.1], ['om', 0.34], ['thaiSan', 0.1], ['viecRieng', 0.18]];
      for (var i = 0; i < vang; i++) { var x = R(), acc = 0; for (var j = 0; j < w.length; j++) { acc += w[j][1]; if (x <= acc) { r[w[j][0]]++; break; } } }
      if (sx && R() < 0.05) { if (base.tv > 0 || R() < 0.5) r.moiTV = 1 + Math.floor(R() * 2); else r.moiBC = 1; }
      if (sx && R() < 0.04) { if (base.tv > 0) r.nvTV = 1; else if (base.bc > 0) r.nvBC = 1; }
      if (sx && R() < 0.55) r.tangCa = Math.round((qs - vang) * (0.2 + R() * 0.4));
    }
    return r;
  }
  var generated = false;
  function generate() {
    if (generated) return; generated = true;
    var n = now(), d = C.addDays(n.ymd, -55);
    C.buildIndex({ danhMuc: danhMuc, records: [], cfg: cfg }); // chuẩn hóa mã xưởng (X1 → NM1-X1)
    var whoOf = function (bp) { var u = users[bp.xuong]; return u ? u.ten + ' (' + bp.xuong + ')' : 'Admin Phòng Nhân sự (ADMIN)'; };
    while (d < n.ymd) {
      if (C.weekday(d) !== 0) danhMuc.forEach(function (bp) { records.push(genRecord(bp, d, d + ' 08:' + ('0' + Math.floor(R() * 50)).slice(-2) + ':00', whoOf(bp))); });
      d = C.addDays(d, 1);
    }
    // Hôm nay: phần lớn NM2 đã nhập, NM1 mới nhập một phần
    if (C.weekday(n.ymd) !== 0) {
      var hm = n.hm < '08:30' ? n.hm : '08:' + ('0' + Math.floor(R() * 30)).slice(-2);
      danhMuc.forEach(function (bp, i) {
        var done = bp.donVi === 'NM2' ? (i % 7 !== 3) : (i % 3 === 0);
        if (done) records.push(genRecord(bp, n.ymd, n.ymd + ' ' + hm + ':00', whoOf(bp)));
      });
    }
  }

  function ix() { return C.buildIndex({ danhMuc: danhMuc, records: records, cfg: cfg, ngayNghi: [] }); }
  function err(m) { return { ok: false, error: m }; }
  function sess(t) { return sessions[t] || null; }
  function nguoi(u) { return u.ten + ' (' + u.ma + ')'; }
  function valuesOf(r) { var o = {}; C.FIELDS.forEach(function (f) { o[f] = r[f]; }); o.ghiChu = r.ghiChu || ''; return o; }
  function same(a, v) { return C.FIELDS.every(function (f) { return Number(a[f]) === Number(v[f]); }) && String(a.ghiChu || '') === String(v.ghiChu || ''); }
  function viewDate(d) { var t = now().ymd; if (!d) return t; if (!C.isYmd(d)) throw new Error('Ngày không hợp lệ.'); if (d > t) throw new Error('Không xem được ngày trong tương lai.'); return d; }
  function locked() { return now().hm > cfg.GIO_CHOT; }

  function entryForm(u) {
    var n = now(), I = ix();
    return { ok: true, ngay: n.ymd, thu: C.thuDayDu(n.ymd), gioHienTai: n.hm, gioChot: cfg.GIO_CHOT, khoa: locked(),
      choSua: C.boolCfg(cfg.CHO_SUA_TRONG_NGAY, true), ngayLamViec: C.isWorkingDay(I, n.ymd),
      rows: I.active.filter(function (bp) { return C.inScope(u.phamVi, bp); }).map(function (bp) { return rowOf(I, bp, n.ymd); }) };
  }
  function rowOf(I, bp, d) {
    var b = C.baseFor(I, bp.maBP, d), r = C.recordOf(I, d, bp.maBP);
    var o = { maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong, boPhan: bp.boPhan, bcDau: b.bc, tvDau: b.tv, nguonQuanSo: b.nguon, daNhap: !!r };
    if (r) { o.values = valuesOf(r); o.nguoiNhap = r.nguoiNhap; o.thoiDiem = r.thoiDiem; o.lanSua = r.lanSua; o.nguon = r.nguon; }
    return o;
  }
  function save(u, d, items, nguon, lyDo) {
    var I = ix(), n = now(), out = [];
    (items || []).forEach(function (it) {
      var bp = I.bpMap[it.maBP], res = { maBP: it.maBP, boPhan: bp ? bp.boPhan : it.maBP }; out.push(res);
      if (!bp) { res.ok = false; res.errors = ['Bộ phận không tồn tại']; return; }
      if (nguon === 'FORM' && !C.inScope(u.phamVi, bp)) { res.ok = false; res.errors = ['Bộ phận không thuộc phạm vi của tài khoản ' + u.ma]; return; }
      var ex = C.recordOf(I, d, bp.maBP);
      if (ex && nguon === 'FORM' && !C.boolCfg(cfg.CHO_SUA_TRONG_NGAY, true)) { res.ok = false; res.errors = ['Đã gửi, không được sửa']; return; }
      var base = C.baseFor(I, bp.maBP, d), v = C.validateEntry(it.values, base, cfg);
      res.warnings = v.warnings;
      if (v.errors.length) { res.ok = false; res.errors = v.errors; return; }
      if (ex && same(ex, v.values)) { res.ok = true; res.msg = 'Không thay đổi'; return; }
      var rec = ex || { ngay: d, maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong, boPhan: bp.boPhan };
      var truoc = ex ? JSON.stringify(valuesOf(ex)) : '';
      rec.bcDau = base.bc; rec.tvDau = base.tv;
      C.FIELDS.forEach(function (f) { rec[f] = v.values[f]; }); rec.ghiChu = v.values.ghiChu;
      rec.nguoiNhap = nguoi(u); rec.thoiDiem = n.ts; rec.lanSua = ex ? (ex.lanSua || 0) + 1 : 0; rec.nguon = nguon;
      if (!ex) records.push(rec);
      logs.push({ thoiDiem: n.ts, nguoi: nguoi(u), hanhDong: nguon === 'ADMIN' ? (ex ? 'Admin sửa' : 'Admin nhập bù') : (ex ? 'Sửa trong ngày' : 'Nhập mới'),
        ngay: d, maBP: bp.maBP, boPhan: bp.boPhan, truoc: truoc, sau: JSON.stringify(valuesOf(rec)), lyDo: lyDo || '' });
      if (nguon === 'ADMIN') C.recalcChain(bp, recsOf(bp.maBP), d);
      res.ok = true; res.msg = ex ? 'Đã cập nhật' : (nguon === 'ADMIN' ? 'Đã nhập bù' : 'Đã lưu');
    });
    return out;
  }
  function adminDay(d) { var I = ix(); return { ok: true, ngay: d, thu: C.thuDayDu(d), rows: I.active.map(function (bp) { return rowOf(I, bp, d); }) }; }

  function handle(q) {
    generate();
    try {
      var a = q.action, n = now();
      if (a === 'login') {
        var ma = String(q.ma || '').trim().toUpperCase(), u = users[ma];
        if (!u || String(q.pin) !== '123456') return err('Sai mã người dùng hoặc PIN. (Demo: PIN 123456)');
        var tok = 'demo-' + Math.random().toString(36).slice(2);
        sessions[tok] = { ma: ma, ten: u.ten, vaiTro: u.vaiTro, phamVi: u.phamVi };
        return { ok: true, token: tok, user: sessions[tok], now: n, cfg: cfg };
      }
      var s = sess(q.token);
      if (!s) return err('AUTH: Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
      var need = function (roles) { if (roles.indexOf(s.vaiTro) < 0) throw new Error('Tài khoản ' + s.ma + ' không có quyền thực hiện thao tác này.'); };
      switch (a) {
        case 'logout': delete sessions[q.token]; return { ok: true };
        case 'me': return { ok: true, user: s, now: n, cfg: cfg };
        case 'entryForm': need(['NHAP', 'ADMIN']); return entryForm(s);
        case 'submitEntry':
          need(['NHAP', 'ADMIN']);
          if (q.ngay && q.ngay !== n.ymd) return err('Form đang mở cho ngày ' + C.fmtDate(q.ngay) + ' nhưng hôm nay là ' + C.fmtDate(n.ymd) + '. Không được nhập lùi/nhập trước – trang sẽ tải lại số liệu hôm nay.');
          if (locked()) return err('Đã quá giờ chốt ' + cfg.GIO_CHOT + '. Liên hệ Phòng Nhân sự nếu cần bổ sung.');
          var res = save(s, n.ymd, q.rows, 'FORM'), f = entryForm(s); f.results = res; return f;
        case 'dailyReport': return { ok: true, report: C.dailyReport(ix(), viewDate(q.ngay)) };
        case 'monthlyReport': return { ok: true, report: C.monthlyReport(ix(), q.thang || n.ymd.slice(0, 7), n.ymd) };
        case 'dashboard': return { ok: true, report: C.dashboard(ix(), viewDate(q.ngay)), now: n };
        case 'status': var st = C.entryStatus(ix(), viewDate(q.ngay)); st.chuaPhanXuong = danhMuc.filter(function (b) { return !b.xuong; }).length; return { ok: true, report: st };
        case 'adminDay': need(['ADMIN']); return adminDay(viewDate(q.ngay));
        case 'adminSave':
          need(['ADMIN']);
          if (String(q.lyDo || '').trim().length < 5) return err('Phải ghi lý do nhập bù/sửa (ít nhất 5 ký tự).');
          var d = viewDate(q.ngay), r2 = save(s, d, q.rows, 'ADMIN', q.lyDo), day = adminDay(d); day.results = r2; return day;
        case 'adminDelete':
          need(['ADMIN']);
          if (String(q.lyDo || '').trim().length < 5) return err('Phải ghi lý do xóa (ít nhất 5 ký tự).');
          var dd = viewDate(q.ngay), idx = records.findIndex(function (r) { return r.ngay === dd && r.maBP === q.maBP; });
          if (idx < 0) return err('Không có dữ liệu để xóa.');
          var del = records.splice(idx, 1)[0];
          logs.push({ thoiDiem: n.ts, nguoi: nguoi(s), hanhDong: 'Admin xóa', ngay: dd, maBP: del.maBP, boPhan: del.boPhan, truoc: JSON.stringify(valuesOf(del)), sau: '', lyDo: q.lyDo });
          var bpD = danhMuc.filter(function (b) { return b.maBP === del.maBP; })[0]; if (bpD) C.recalcChain(bpD, recsOf(bpD.maBP), dd);
          return adminDay(dd);
        case 'history': need(['ADMIN']); return { ok: true, rows: logs.slice().reverse().slice(0, Number(q.limit) || 100) };
        default: return err('Yêu cầu không hợp lệ: ' + a);
      }
    } catch (e) { return err(e.message); }
  }
  return { handle: handle };
})();
