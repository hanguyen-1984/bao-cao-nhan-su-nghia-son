/**
 * HỆ THỐNG BÁO CÁO NHÂN SỰ HẰNG NGÀY – NM1 / NM2 Đồ gỗ Nghĩa Sơn
 * Backend Google Apps Script (gắn với Google Sheet chứa dữ liệu).
 *
 * File trong dự án Apps Script:
 *   - Code.gs  (file này)          – API, đăng nhập, ghi dữ liệu, menu quản trị
 *   - Core.gs  (= js/core.js)      – lõi tính toán, PHẢI giống hệt file js/core.js trên GitHub
 *
 * Triển khai: Deploy > New deployment > Web app
 *   Execute as: Me   |   Who has access: Anyone
 * Xem README.md để biết từng bước.
 */

var APP_VERSION = '1.0.0';
var TZ = 'Asia/Ho_Chi_Minh';
var SH = { DM: 'DanhMuc', ND: 'NguoiDung', NL: 'NhapLieu', LS: 'LichSu', CH: 'CauHinh', NN: 'NgayNghi' };

var DM_COLS = ['STT', 'Mã BP', 'Đơn vị', 'Xưởng', 'Bộ phận', 'Chính thức gốc', 'Thời vụ gốc', 'Áp dụng từ (yyyy-mm-dd)', 'Hiển thị riêng', 'Đang dùng', 'Ghi chú'];
var ND_COLS = ['Mã người dùng', 'Họ tên', 'Vai trò', 'Phạm vi', 'PIN (đã mã hóa)', 'Đang dùng', 'Ghi chú'];
var NL_COLS = ['Ngày', 'Mã BP', 'Đơn vị', 'Xưởng', 'Bộ phận', 'Chính thức đầu ngày', 'Thời vụ đầu ngày', 'Phép năm', 'Nghỉ không phép',
  'Nghỉ ốm', 'Thai sản', 'Việc riêng', 'Mới (chính thức)', 'Mới (thời vụ)', 'Nghỉ việc (chính thức)', 'Nghỉ việc (thời vụ)', 'Tăng ca', 'Ghi chú',
  'Tổng đầu ngày', 'Quân số trong ngày', 'Tổng vắng', 'Hiện diện', 'Tỷ lệ chuyên cần', 'Người nhập', 'Thời điểm nhập', 'Lần sửa', 'Nguồn'];
var NL_KEYS = ['ngay', 'maBP', 'donVi', 'xuong', 'boPhan', 'bcDau', 'tvDau', 'phepNam', 'khongPhep', 'om', 'thaiSan', 'viecRieng',
  'moiBC', 'moiTV', 'nvBC', 'nvTV', 'tangCa', 'ghiChu', 'tongDau', 'quanSo', 'tongVang', 'hienDien', 'tyLe',
  'nguoiNhap', 'thoiDiem', 'lanSua', 'nguon'];
var LS_COLS = ['Thời điểm', 'Người thực hiện', 'Hành động', 'Ngày số liệu', 'Mã BP', 'Bộ phận', 'Trước', 'Sau', 'Lý do'];
var NN_COLS = ['Ngày (yyyy-mm-dd)', 'Lý do'];
var CH_COLS = ['Khóa', 'Giá trị', 'Ý nghĩa'];

var CH_DEFAULT = [
  ['GIO_CHOT', '23:59', 'Giờ chốt nhập trong ngày (HH:mm, giờ Việt Nam). Sau giờ này form khóa, chỉ Admin sửa được.'],
  ['CHO_SUA_TRONG_NGAY', 'TRUE', 'TRUE: được sửa số đã gửi trước giờ chốt. FALSE: mỗi bộ phận chỉ gửi 1 lần/ngày.'],
  ['NGAY_NGHI_TUAN', 'CN', 'Ngày nghỉ trong tuần (CN hoặc T7,CN). Chỉ để nhắc "chưa nhập"; đi làm vẫn nhập được.'],
  ['NGUONG_DO', '0.9', 'Tỷ lệ chuyên cần dưới mức này: cảnh báo đỏ (0.9 = 90%).'],
  ['NGUONG_VANG', '0.95', 'Tỷ lệ chuyên cần dưới mức này: cảnh báo vàng (0.95 = 95%).'],
  ['PHIEN_GIO', '6', 'Số giờ giữ đăng nhập (tối đa 6).'],
  ['TEN_NM1', 'Công ty TNHH Đồ gỗ Nghĩa Sơn', 'Tên đầy đủ NM1'],
  ['TEN_NM2', 'Công ty TNHH SXTM Đồ gỗ Nghĩa Sơn', 'Tên đầy đủ NM2']
];

// Danh mục gốc lấy từ file "Mau_nhap_so_lieu_nhan_su_hang_ngay_NM1_NM2_2.xlsx" (sheet Danh mục): [Đơn vị, Xưởng, Bộ phận, Chính thức, Thời vụ]
// Xưởng ghi ngắn (VP, X1, X2, KHO) – hệ thống tự hiểu là NM1-X1, NM2-VP…
var SEED_DM = [
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
var SEED_USERS = [
  ['ADMIN', 'Admin Phòng Nhân sự', 'ADMIN', '*'],
  ['BGD', 'Ban Giám đốc (chỉ xem)', 'XEM', '*'],
  ['NM1-VP', 'Thống kê NM1 – Văn phòng', 'NHAP', 'NM1-VP'],
  ['NM1-X1', 'Thống kê NM1 – Xưởng 1', 'NHAP', 'NM1-X1'],
  ['NM1-X2', 'Thống kê NM1 – Xưởng 2', 'NHAP', 'NM1-X2'],
  ['NM1-KHO', 'Thống kê NM1 – Kho Thanh Bình', 'NHAP', 'NM1-KHO'],
  ['NM2-VP', 'Thống kê NM2 – Văn phòng', 'NHAP', 'NM2-VP'],
  ['NM2-X1', 'Thống kê NM2 – Xưởng 1', 'NHAP', 'NM2-X1'],
  ['NM2-X2', 'Thống kê NM2 – Xưởng 2', 'NHAP', 'NM2-X2']
];

// =====================================================================
// MENU & KHỞI TẠO
// =====================================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Nhân sự NS')
    .addItem('1. Khởi tạo hệ thống (chạy 1 lần)', 'setup')
    .addItem('2. Cấp PIN mới cho người dùng', 'menuResetPin')
    .addItem('3. Tính lại quân số cuốn chiếu', 'menuRecalcAll')
    .addSeparator()
    .addItem('Kiểm tra cấu hình', 'menuCheck')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PIN_SALT')) props.setProperty('PIN_SALT', Utilities.getUuid());

  var dm = ensureSheet_(ss, SH.DM, DM_COLS);
  if (dm.getLastRow() < 2) {
    var cnt = {}, rows = SEED_DM.map(function (r, i) {
      cnt[r[0]] = (cnt[r[0]] || 0) + 1;
      var ma = r[0] + '-' + ('0' + cnt[r[0]]).slice(-2);
      return [i + 1, ma, r[0], r[1], r[2], r[3], r[4], '', r[2] === 'NM1 - KHO THANH BÌNH', true, ''];
    });
    dm.getRange(2, 1, rows.length, DM_COLS.length).setValues(rows);
  }
  dm.getRange('H:H').setNumberFormat('@');
  if (dm.getLastRow() >= 2) dm.getRange(2, 9, dm.getLastRow() - 1, 2).insertCheckboxes();

  var cfg = ensureSheet_(ss, SH.CH, CH_COLS);
  cfg.getRange('B:B').setNumberFormat('@');
  var have = cfg.getLastRow() >= 2 ? cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  var add = CH_DEFAULT.filter(function (r) { return have.indexOf(r[0]) < 0; });
  if (add.length) cfg.getRange(cfg.getLastRow() + 1, 1, add.length, 3).setValues(add);

  var nl = ensureSheet_(ss, SH.NL, NL_COLS);
  nl.getRange('A:A').setNumberFormat('@');
  nl.getRange('Y:Y').setNumberFormat('@');
  nl.getRange('W:W').setNumberFormat('0.0%');
  ensureSheet_(ss, SH.LS, LS_COLS).getRange('A:A').setNumberFormat('@');
  ensureSheet_(ss, SH.NN, NN_COLS).getRange('A:A').setNumberFormat('@');

  var nd = ensureSheet_(ss, SH.ND, ND_COLS);
  var created = [];
  if (nd.getLastRow() < 2) {
    var urows = SEED_USERS.map(function (u) {
      var pin = randomPin_();
      created.push(u[0] + '  →  PIN ' + pin + '   (' + u[1] + ')');
      return [u[0], u[1], u[2], u[3], hashPin_(u[0], pin), true, ''];
    });
    nd.getRange(2, 1, urows.length, ND_COLS.length).setValues(urows);
    nd.getRange(2, 6, urows.length, 1).insertCheckboxes();
  }
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(['ADMIN', 'NHAP', 'XEM'], true).build();
  nd.getRange('C2:C200').setDataValidation(rule);

  var msg = 'Đã khởi tạo xong các sheet.';
  if (created.length) msg += '\n\nPIN ban đầu (chỉ hiện 1 lần, hãy ghi lại):\n' + created.join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* chạy từ editor */ }
  return msg;
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1 || String(sh.getRange(1, 1).getValue()) === '') {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
  }
  return sh;
}

function menuResetPin() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Cấp PIN mới', 'Nhập Mã người dùng (ví dụ NM1-X1, NM2-VP):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pin = resetPin(r.getResponseText());
  ui.alert('PIN mới của ' + r.getResponseText().trim().toUpperCase() + ': ' + pin + '\n\nGửi riêng cho người dùng, không gửi vào nhóm chung.');
}

/** Cấp PIN mới (dùng được từ menu hoặc chạy tay trong editor). */
function resetPin(ma) {
  ma = String(ma || '').trim().toUpperCase();
  var sh = sheet_(SH.ND), vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toUpperCase() === ma) {
      var pin = randomPin_();
      sh.getRange(i + 1, 5).setValue(hashPin_(ma, pin));
      log_([[ts_(), 'Hệ thống', 'Cấp PIN mới', '', '', ma, '', '', '']]);
      return pin;
    }
  }
  throw new Error('Không tìm thấy người dùng ' + ma);
}

function menuRecalcAll() {
  var n = recalcAll();
  SpreadsheetApp.getUi().alert('Đã tính lại quân số. Số dòng thay đổi: ' + n);
}

function menuCheck() {
  var ix = NSCore.buildIndex(loadCtx_());
  var noX = ix.active.filter(function (bp) { return !bp.xuong; }).map(function (bp) { return bp.boPhan; });
  var users = sheet_(SH.ND).getDataRange().getValues().slice(1).filter(function (u) { return u[0] && NSCore.boolCfg(u[5], true); });
  var noUser = ix.active.filter(function (bp) {
    return !users.some(function (u) { return String(u[2]).toUpperCase() !== 'XEM' && NSCore.inScope(u[3], bp); });
  }).map(function (bp) { return bp.boPhan; });
  var msg = 'Phiên bản: ' + APP_VERSION + '\nBộ phận đang dùng: ' + ix.active.length + '\nSố dòng dữ liệu: ' + (ix.ctx.records || []).length +
    '\nGiờ chốt: ' + ix.cfg.GIO_CHOT + '\nNgày hệ thống: ' + nowVN_().ymd + ' ' + nowVN_().hm;
  if (noX.length) msg += '\n\nBộ phận CHƯA gán xưởng (' + noX.length + '): ' + noX.join(', ');
  if (noUser.length) msg += '\n\nBộ phận CHƯA có người nhập (' + noUser.length + '): ' + noUser.join(', ');
  SpreadsheetApp.getUi().alert(msg);
}

// =====================================================================
// WEB API
// =====================================================================
function doGet() {
  return json_({ ok: true, app: 'NS-NhanSu', version: APP_VERSION, now: nowVN_() });
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = route_(req);
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  var a = req.action;
  if (a === 'ping') return { ok: true, version: APP_VERSION, now: nowVN_() };
  if (a === 'login') return apiLogin_(req);
  var user = requireSession_(req.token);
  switch (a) {
    case 'logout': CacheService.getScriptCache().remove('S:' + req.token); return { ok: true };
    case 'me': return { ok: true, user: user, now: nowVN_(), cfg: publicCfg_(loadCfg_()) };
    case 'entryForm': requireRole_(user, ['NHAP', 'ADMIN']); return apiEntryForm_(user);
    case 'submitEntry': requireRole_(user, ['NHAP', 'ADMIN']); return apiSubmit_(user, req);
    case 'dailyReport': return apiDaily_(req);
    case 'monthlyReport': return apiMonthly_(req);
    case 'dashboard': return apiDashboard_(req);
    case 'status': return apiStatus_(req);
    case 'adminDay': requireRole_(user, ['ADMIN']); return apiAdminDay_(req);
    case 'adminSave': requireRole_(user, ['ADMIN']); return apiAdminSave_(user, req);
    case 'adminDelete': requireRole_(user, ['ADMIN']); return apiAdminDelete_(user, req);
    case 'history': requireRole_(user, ['ADMIN']); return apiHistory_(req);
    default: throw new Error('Yêu cầu không hợp lệ: ' + a);
  }
}

// ---------------- Đăng nhập ----------------
function apiLogin_(req) {
  var ma = String(req.ma || '').trim().toUpperCase(), pin = String(req.pin || '').trim();
  if (!ma || !pin) throw new Error('Nhập mã người dùng và PIN.');
  var cache = CacheService.getScriptCache(), fk = 'F:' + ma, fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw new Error('Sai PIN quá 5 lần. Thử lại sau 15 phút hoặc nhờ Nhân sự cấp PIN mới.');
  var u = findUser_(ma);
  if (!u || !u.dangDung || u.pinHash !== hashPin_(ma, pin)) {
    cache.put(fk, String(fails + 1), 900);
    throw new Error('Sai mã người dùng hoặc PIN.');
  }
  cache.remove(fk);
  var cfg = loadCfg_();
  var hours = Math.min(6, Math.max(1, Number(cfg.PHIEN_GIO) || 6));
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var sess = { ma: u.ma, ten: u.ten, vaiTro: u.vaiTro, phamVi: u.phamVi };
  cache.put('S:' + token, JSON.stringify(sess), hours * 3600);
  return { ok: true, token: token, user: sess, now: nowVN_(), cfg: publicCfg_(cfg) };
}

function requireSession_(token) {
  if (!token) throw new Error('AUTH: Chưa đăng nhập.');
  var raw = CacheService.getScriptCache().get('S:' + token);
  if (!raw) throw new Error('AUTH: Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  var s = JSON.parse(raw), u = findUser_(s.ma);
  if (!u || !u.dangDung) throw new Error('AUTH: Tài khoản đã bị khóa.');
  return { ma: u.ma, ten: u.ten, vaiTro: u.vaiTro, phamVi: u.phamVi };
}

function requireRole_(user, roles) {
  if (roles.indexOf(user.vaiTro) < 0) throw new Error('Tài khoản ' + user.ma + ' không có quyền thực hiện thao tác này.');
}

function findUser_(ma) {
  var vals = sheet_(SH.ND).getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toUpperCase() === ma) {
      return { ma: ma, ten: String(vals[i][1] || ma), vaiTro: String(vals[i][2] || '').trim().toUpperCase(),
        phamVi: String(vals[i][3] || ''), pinHash: String(vals[i][4] || ''), dangDung: NSCore.boolCfg(vals[i][5], true) };
    }
  }
  return null;
}

function hashPin_(ma, pin) {
  var salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT') || '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + String(ma).toUpperCase() + '|' + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function randomPin_() { return String(Math.floor(100000 + Math.random() * 900000)); }

// ---------------- Nhập liệu (chỉ ngày hôm nay) ----------------
function isLocked_(cfg, now) {
  var gio = normHM_(cfg.GIO_CHOT) || '23:59';
  return now.hm > gio;
}

function apiEntryForm_(user) {
  var now = nowVN_(), ctx = loadCtx_(), ix = NSCore.buildIndex(ctx), cfg = ix.cfg;
  var rows = ix.active.filter(function (bp) { return NSCore.inScope(user.phamVi, bp); }).map(function (bp) {
    var base = NSCore.baseFor(ix, bp.maBP, now.ymd), r = NSCore.recordOf(ix, now.ymd, bp.maBP), o = {
      maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong || '', boPhan: bp.boPhan,
      bcDau: base.bc, tvDau: base.tv, nguonQuanSo: base.nguon, daNhap: !!r
    };
    if (r) {
      o.values = {}; NSCore.FIELDS.forEach(function (f) { o.values[f] = Number(r[f]) || 0; });
      o.values.ghiChu = r.ghiChu || '';
      o.nguoiNhap = r.nguoiNhap; o.thoiDiem = r.thoiDiem; o.lanSua = r.lanSua; o.nguon = r.nguon;
    }
    return o;
  });
  return {
    ok: true, ngay: now.ymd, thu: NSCore.thuDayDu(now.ymd), gioHienTai: now.hm, gioChot: normHM_(cfg.GIO_CHOT) || '23:59',
    khoa: isLocked_(cfg, now), choSua: NSCore.boolCfg(cfg.CHO_SUA_TRONG_NGAY, true),
    ngayLamViec: NSCore.isWorkingDay(ix, now.ymd), rows: rows
  };
}

function apiSubmit_(user, req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var results = [];
  try {
    var now = nowVN_(), ctx = loadCtx_(), ix = NSCore.buildIndex(ctx), cfg = ix.cfg;
    if (req.ngay && req.ngay !== now.ymd) {
      throw new Error('Form đang mở cho ngày ' + NSCore.fmtDate(req.ngay) + ' nhưng hôm nay là ' + NSCore.fmtDate(now.ymd) +
        '. Không được nhập lùi/nhập trước – trang sẽ tải lại số liệu hôm nay.');
    }
    if (isLocked_(cfg, now)) throw new Error('Đã quá giờ chốt ' + normHM_(cfg.GIO_CHOT) + '. Liên hệ Phòng Nhân sự nếu cần bổ sung.');
    var choSua = NSCore.boolCfg(cfg.CHO_SUA_TRONG_NGAY, true);
    var sh = sheet_(SH.NL), appendRows = [], logs = [];
    (req.rows || []).forEach(function (item) {
      var bp = ix.bpMap[item.maBP], res = { maBP: item.maBP, boPhan: bp ? bp.boPhan : item.maBP };
      results.push(res);
      if (!bp || bp.dangDung === false) { res.ok = false; res.errors = ['Bộ phận không tồn tại hoặc đã ngừng dùng']; return; }
      if (!NSCore.inScope(user.phamVi, bp)) { res.ok = false; res.errors = ['Bộ phận không thuộc phạm vi của tài khoản ' + user.ma]; return; }
      var existing = NSCore.recordOf(ix, now.ymd, bp.maBP);
      if (existing && !choSua) { res.ok = false; res.errors = ['Đã gửi lúc ' + existing.thoiDiem + '. Cấu hình không cho sửa trong ngày.']; return; }
      var base = NSCore.baseFor(ix, bp.maBP, now.ymd);
      var v = NSCore.validateEntry(item.values, base, cfg);
      res.warnings = v.warnings;
      if (v.errors.length) { res.ok = false; res.errors = v.errors; return; }
      if (existing && sameValues_(existing, v.values)) { res.ok = true; res.msg = 'Không thay đổi'; return; }
      var rec = makeRecord_(now.ymd, bp, base, v.values, user, now, existing, 'FORM');
      if (existing) { writeRow_(sh, existing._row, rec); } else { appendRows.push(recordToRow_(rec)); }
      logs.push([now.ts, nguoi_(user), existing ? 'Sửa trong ngày' : 'Nhập mới', now.ymd, bp.maBP, bp.boPhan,
        existing ? valuesJson_(existing) : '', valuesJson_(rec), '']);
      res.ok = true; res.msg = existing ? 'Đã cập nhật' : 'Đã lưu';
    });
    if (appendRows.length) sh.getRange(sh.getLastRow() + 1, 1, appendRows.length, NL_COLS.length).setValues(appendRows);
    if (logs.length) log_(logs);
  } finally {
    lock.releaseLock();
  }
  var form = apiEntryForm_(user);
  form.results = results;
  return form;
}

// ---------------- Báo cáo ----------------
function checkViewDate_(ymd) {
  var today = nowVN_().ymd;
  if (!ymd) return today;
  if (!NSCore.isYmd(ymd)) throw new Error('Ngày không hợp lệ.');
  if (ymd > today) throw new Error('Không xem được ngày trong tương lai.');
  return ymd;
}
function apiDaily_(req) {
  var ymd = checkViewDate_(req.ngay), ix = NSCore.buildIndex(loadCtx_());
  return { ok: true, report: NSCore.dailyReport(ix, ymd) };
}
function apiMonthly_(req) {
  var today = nowVN_().ymd, ym = String(req.thang || today.slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('Tháng không hợp lệ.');
  var ix = NSCore.buildIndex(loadCtx_());
  return { ok: true, report: NSCore.monthlyReport(ix, ym, today) };
}
function apiDashboard_(req) {
  var ymd = checkViewDate_(req.ngay), ix = NSCore.buildIndex(loadCtx_());
  return { ok: true, report: NSCore.dashboard(ix, ymd), now: nowVN_() };
}
function apiStatus_(req) {
  var ymd = checkViewDate_(req.ngay), ix = NSCore.buildIndex(loadCtx_());
  var st = NSCore.entryStatus(ix, ymd);
  st.chuaPhanXuong = ix.active.filter(function (bp) { return !bp.xuong; }).length;
  return { ok: true, report: st };
}

// ---------------- Quản trị: nhập bù / sửa ngày cũ ----------------
function apiAdminDay_(req) {
  var ymd = checkViewDate_(req.ngay), ix = NSCore.buildIndex(loadCtx_());
  var rows = ix.active.filter(function (bp) { return !req.maBP || bp.maBP === req.maBP; }).map(function (bp) {
    var base = NSCore.baseFor(ix, bp.maBP, ymd), r = NSCore.recordOf(ix, ymd, bp.maBP);
    var o = { maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong || '', boPhan: bp.boPhan, bcDau: base.bc, tvDau: base.tv, daNhap: !!r };
    if (r) {
      o.values = {}; NSCore.FIELDS.forEach(function (f) { o.values[f] = Number(r[f]) || 0; });
      o.values.ghiChu = r.ghiChu || ''; o.nguoiNhap = r.nguoiNhap; o.thoiDiem = r.thoiDiem; o.lanSua = r.lanSua; o.nguon = r.nguon;
    }
    return o;
  });
  return { ok: true, ngay: ymd, thu: NSCore.thuDayDu(ymd), rows: rows };
}

function apiAdminSave_(user, req) {
  var lyDo = String(req.lyDo || '').trim();
  if (lyDo.length < 5) throw new Error('Phải ghi lý do nhập bù/sửa (ít nhất 5 ký tự).');
  var ymd = checkViewDate_(req.ngay);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var results = [], touched = [];
  try {
    var now = nowVN_(), ix = NSCore.buildIndex(loadCtx_()), cfg = ix.cfg, sh = sheet_(SH.NL), appendRows = [], logs = [];
    (req.rows || []).forEach(function (item) {
      var bp = ix.bpMap[item.maBP], res = { maBP: item.maBP, boPhan: bp ? bp.boPhan : item.maBP };
      results.push(res);
      if (!bp) { res.ok = false; res.errors = ['Bộ phận không tồn tại']; return; }
      var existing = NSCore.recordOf(ix, ymd, bp.maBP), base = NSCore.baseFor(ix, bp.maBP, ymd);
      var v = NSCore.validateEntry(item.values, base, cfg);
      res.warnings = v.warnings;
      if (v.errors.length) { res.ok = false; res.errors = v.errors; return; }
      if (existing && sameValues_(existing, v.values)) { res.ok = true; res.msg = 'Không thay đổi'; return; }
      var rec = makeRecord_(ymd, bp, base, v.values, user, now, existing, 'ADMIN');
      if (existing) writeRow_(sh, existing._row, rec); else appendRows.push(recordToRow_(rec));
      logs.push([now.ts, nguoi_(user), existing ? 'Admin sửa' : 'Admin nhập bù', ymd, bp.maBP, bp.boPhan,
        existing ? valuesJson_(existing) : '', valuesJson_(rec), sanitize_(lyDo)]);
      touched.push(bp.maBP);
      res.ok = true; res.msg = existing ? 'Đã sửa' : 'Đã nhập bù';
    });
    if (appendRows.length) sh.getRange(sh.getLastRow() + 1, 1, appendRows.length, NL_COLS.length).setValues(appendRows);
    if (logs.length) log_(logs);
    var changed = touched.length ? recalcBps_(touched, ymd) : 0;
  } finally {
    lock.releaseLock();
  }
  var day = apiAdminDay_({ ngay: ymd });
  day.results = results; day.capNhatCuonChieu = changed;
  return day;
}

function apiAdminDelete_(user, req) {
  var lyDo = String(req.lyDo || '').trim();
  if (lyDo.length < 5) throw new Error('Phải ghi lý do xóa (ít nhất 5 ký tự).');
  var ymd = checkViewDate_(req.ngay);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ix = NSCore.buildIndex(loadCtx_()), r = NSCore.recordOf(ix, ymd, req.maBP);
    if (!r) throw new Error('Không có dữ liệu để xóa.');
    sheet_(SH.NL).deleteRow(r._row);
    log_([[nowVN_().ts, nguoi_(user), 'Admin xóa', ymd, r.maBP, r.boPhan, valuesJson_(r), '', sanitize_(lyDo)]]);
    recalcBps_([r.maBP], ymd);
  } finally {
    lock.releaseLock();
  }
  return apiAdminDay_({ ngay: ymd });
}

function apiHistory_(req) {
  var sh = sheet_(SH.LS), last = sh.getLastRow(), lim = Math.min(500, Number(req.limit) || 100);
  if (last < 2) return { ok: true, rows: [] };
  var start = Math.max(2, last - lim + 1);
  var vals = sh.getRange(start, 1, last - start + 1, LS_COLS.length).getValues().reverse();
  return { ok: true, rows: vals.map(function (v) {
    return { thoiDiem: String(v[0]), nguoi: v[1], hanhDong: v[2], ngay: ymdOf_(v[3]), maBP: v[4], boPhan: v[5], truoc: v[6], sau: v[7], lyDo: v[8] };
  }) };
}

// ---------------- Cuốn chiếu quân số ----------------
function recalcBps_(maBPs, fromYmd) {
  var ix = NSCore.buildIndex(loadCtx_()), sh = sheet_(SH.NL), n = 0;
  maBPs.forEach(function (ma) {
    var bp = ix.bpMap[ma]; if (!bp) return;
    NSCore.recalcChain(bp, ix.byBp[ma] || [], fromYmd).forEach(function (rec) { writeRow_(sh, rec._row, rec); n++; });
  });
  return n;
}

/** Tính lại toàn bộ (dùng sau khi Nhân sự sửa số gốc / "Áp dụng từ" trong DanhMuc). */
function recalcAll() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return recalcBps_(NSCore.buildIndex(loadCtx_()).active.map(function (bp) { return bp.maBP; }), null); }
  finally { lock.releaseLock(); }
}

// =====================================================================
// ĐỌC / GHI SHEET
// =====================================================================
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Thiếu sheet "' + name + '". Chạy menu Nhân sự NS > Khởi tạo hệ thống.');
  return sh;
}

function loadCtx_() {
  return { danhMuc: loadDanhMuc_(), records: loadRecords_(), cfg: loadCfg_(), ngayNghi: loadNgayNghi_() };
}

function loadDanhMuc_() {
  var vals = sheet_(SH.DM).getDataRange().getValues(), out = [];
  for (var i = 1; i < vals.length; i++) {
    var v = vals[i];
    if (!String(v[1]).trim()) continue;
    out.push({
      stt: Number(v[0]) || i, maBP: String(v[1]).trim().toUpperCase(), donVi: String(v[2]).trim().toUpperCase(),
      xuong: String(v[3] || '').trim().toUpperCase(), boPhan: String(v[4]).trim(),
      bcGoc: Number(v[5]) || 0, tvGoc: Number(v[6]) || 0, apDung: ymdOf_(v[7]),
      rieng: NSCore.boolCfg(v[8], false), dangDung: NSCore.boolCfg(v[9], true), ghiChu: String(v[10] || '')
    });
  }
  out.sort(function (a, b) { return a.stt - b.stt; });
  return out;
}

function loadRecords_() {
  var sh = sheet_(SH.NL), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, NL_COLS.length).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], r = { _row: i + 2 };
    NL_KEYS.forEach(function (k, j) { r[k] = v[j]; });
    r.ngay = ymdOf_(r.ngay);
    if (!r.ngay || !r.maBP) continue;
    r.maBP = String(r.maBP).trim().toUpperCase();
    r.thoiDiem = String(r.thoiDiem || '');
    r.lanSua = Number(r.lanSua) || 0;
    out.push(r);
  }
  return out;
}

function loadCfg_() {
  var sh = sheet_(SH.CH), vals = sh.getDataRange().getValues(), cfg = {};
  CH_DEFAULT.forEach(function (r) { cfg[r[0]] = r[1]; });
  for (var i = 1; i < vals.length; i++) {
    var k = String(vals[i][0] || '').trim(), v = vals[i][1];
    if (!k) continue;
    if (v instanceof Date) v = Utilities.formatDate(v, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'HH:mm');
    v = String(v).trim();
    if (/^NGUONG_/.test(k)) {
      var p = /%$/.test(v), n = Number(v.replace('%', '').replace(',', '.'));
      v = isNaN(n) ? '' : String(p || n > 1 ? n / 100 : n);
    }
    cfg[k] = v;
  }
  return cfg;
}

function loadNgayNghi_() {
  var sh = sheet_(SH.NN), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return ymdOf_(r[0]); }).filter(Boolean);
}

function publicCfg_(cfg) {
  return { GIO_CHOT: normHM_(cfg.GIO_CHOT) || '23:59', CHO_SUA_TRONG_NGAY: NSCore.boolCfg(cfg.CHO_SUA_TRONG_NGAY, true),
    NGAY_NGHI_TUAN: cfg.NGAY_NGHI_TUAN, NGUONG_DO: Number(cfg.NGUONG_DO) || 0.9, NGUONG_VANG: Number(cfg.NGUONG_VANG) || 0.95,
    TEN_NM1: cfg.TEN_NM1, TEN_NM2: cfg.TEN_NM2 };
}

function makeRecord_(ymd, bp, base, values, user, now, existing, nguon) {
  var r = { ngay: ymd, maBP: bp.maBP, donVi: bp.donVi, xuong: bp.xuong || '', boPhan: bp.boPhan, bcDau: base.bc, tvDau: base.tv };
  NSCore.FIELDS.forEach(function (f) { r[f] = values[f]; });
  r.ghiChu = sanitize_(values.ghiChu || '');
  r.nguoiNhap = nguoi_(user); r.thoiDiem = now.ts;
  r.lanSua = existing ? (Number(existing.lanSua) || 0) + 1 : 0;
  r.nguon = nguon;
  return r;
}

function recordToRow_(r) {
  var d = NSCore.derive(r), all = {};
  NL_KEYS.forEach(function (k) { all[k] = r[k]; });
  all.tongDau = d.tongDau; all.quanSo = d.quanSo; all.tongVang = d.tongVang; all.hienDien = d.hienDien;
  all.tyLe = d.tyLe === null ? '' : Math.round(d.tyLe * 10000) / 10000;
  return NL_KEYS.map(function (k) { var v = all[k]; return v === undefined || v === null ? '' : v; });
}

function writeRow_(sh, rowNum, rec) {
  sh.getRange(rowNum, 1, 1, NL_COLS.length).setValues([recordToRow_(rec)]);
}

function sameValues_(a, b) {
  for (var i = 0; i < NSCore.FIELDS.length; i++) { var f = NSCore.FIELDS[i]; if (Number(a[f]) !== Number(b[f])) return false; }
  return String(a.ghiChu || '') === String(sanitize_(b.ghiChu || ''));
}

function valuesJson_(r) {
  var o = { bc: r.bcDau, tv: r.tvDau };
  NSCore.FIELDS.forEach(function (f) { o[f] = Number(r[f]) || 0; });
  if (r.ghiChu) o.ghiChu = r.ghiChu;
  return JSON.stringify(o);
}

function log_(rows) {
  var sh = sheet_(SH.LS);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, LS_COLS.length).setValues(rows);
}

function nguoi_(user) { return user.ten + ' (' + user.ma + ')'; }

/** Chặn chèn công thức vào sheet qua ô ghi chú. */
function sanitize_(s) {
  s = String(s || '').slice(0, 500);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ymdOf_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function normHM_(v) {
  var m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

/** Thời điểm hiện tại theo giờ Việt Nam – lấy từ máy chủ Google, không tin giờ máy người dùng. */
function now_() { return new Date(); }
function nowVN_() {
  var d = now_();
  return { ymd: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), hm: Utilities.formatDate(d, TZ, 'HH:mm'), ts: Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss') };
}
function ts_() { return nowVN_().ts; }
