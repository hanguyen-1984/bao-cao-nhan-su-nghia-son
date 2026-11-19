const fs = require('fs'), vm = require('vm'), assert = require('assert');
const { makeGlobals } = require('./gas-mock');
const { g, sheets } = makeGlobals();
const ctx = vm.createContext(g);
vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Core.gs', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8'), ctx);
let NOW = new Date('2026-11-17T01:30:00Z'); // 08:30 giờ VN
vm.runInContext('now_ = function(){ return __NOW(); }', Object.assign(ctx, { __NOW: () => NOW }));
const call = (o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(o) } }).getContent());
const ok = (r, m) => { if (!r.ok) throw new Error((m||'') + ' → ' + r.error); return r; };
const fail = (r, re) => { assert.ok(!r.ok, 'expected failure'); if (re) assert.match(r.error, re); return r; };

const msg = ctx.setup();
const pins = {}; msg.replace(/^(\S+)\s+→\s+PIN (\d{6})/gm, (_, u, p) => pins[u] = p);
assert.equal(Object.keys(pins).length, 9, msg);
assert.equal(sheets.DanhMuc.getLastRow(), 41);
ctx.setup(); assert.equal(sheets.DanhMuc.getLastRow(), 41, 'setup idempotent');

fail(call({action:'login', ma:'NM1-X1', pin:'000000'}), /Sai/);
fail(call({action:'entryForm', token:'xyz'}), /AUTH/);
const tX1 = ok(call({action:'login', ma:'nm1-x1', pin:pins['NM1-X1']})).token;
const tAd = ok(call({action:'login', ma:'ADMIN', pin:pins['ADMIN']})).token;
const tBgd = ok(call({action:'login', ma:'BGD', pin:pins['BGD']})).token;
fail(call({action:'entryForm', token:tBgd}), /không có quyền/);

let f = ok(call({action:'entryForm', token:tX1}));
assert.equal(f.ngay, '2026-11-17'); assert.equal(f.rows.length, 10, 'NM1-X1 thấy 10 bộ phận của Xưởng 1'); assert.equal(f.khoa, false);
assert.ok(f.rows.every(r => r.xuong === 'NM1-X1'));
assert.equal(ok(call({action:'entryForm', token: ok(call({action:'login', ma:'NM2-VP', pin:pins['NM2-VP']})).token})).rows.length, 7);
const z = {phepNam:0,khongPhep:0,om:0,thaiSan:0,viecRieng:0,moiBC:0,moiTV:0,nvBC:0,nvTV:0,tangCa:0};
const tcbg = f.rows.find(r => r.boPhan === 'NM1 - TCBG');
assert.equal(tcbg.bcDau, 34); assert.equal(tcbg.tvDau, 4);
// nhập lùi / nhập trước bị chặn
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-16', rows:[{maBP:tcbg.maBP, values:z}]}), /Không được nhập lùi/);
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-18', rows:[{maBP:tcbg.maBP, values:z}]}), /Không được nhập lùi/);
// nhập hợp lệ
let s = ok(call({action:'submitEntry', token:tX1, ngay:'2026-11-17', rows:[
  {maBP:tcbg.maBP, values:Object.assign({}, z, {om:2, moiBC:2, nvTV:1, tangCa:10, ghiChu:'=HACK()'})},
  {maBP:'NM1-08', values:z},
  {maBP:'NM2-01', values:z},
  {maBP:'NM1-01', values:z},
  {maBP:'NM1-09', values:Object.assign({}, z, {om:99})},
  {maBP:'NM1-10', values:Object.assign({}, z, {om:''})},
]}));
const res = Object.fromEntries(s.results.map(r => [r.maBP, r]));
assert.ok(res[tcbg.maBP].ok && res['NM1-08'].ok);
assert.match(res['NM2-01'].errors[0], /phạm vi/);
assert.match(res['NM1-01'].errors[0], /phạm vi/, 'Văn phòng không thuộc Xưởng 1');
assert.match(res['NM1-09'].errors.join(), /Tổng vắng/);
assert.match(res['NM1-10'].errors.join(), /chưa nhập/);
assert.equal(sheets.NhapLieu.getLastRow(), 3);
assert.equal(sheets.NhapLieu.data[1][17], "'=HACK()", 'ghi chú bị chặn công thức');
// sửa trong ngày
s = ok(call({action:'submitEntry', token:tX1, ngay:'2026-11-17', rows:[{maBP:'NM1-08', values:Object.assign({}, z, {phepNam:1})}]}));
assert.equal(s.results[0].msg, 'Đã cập nhật'); assert.equal(sheets.NhapLieu.getLastRow(), 3);
assert.equal(s.rows.find(r=>r.maBP==='NM1-08').lanSua, 1);
// Hôm sau: quân số cuốn chiếu
NOW = new Date('2026-11-18T02:00:00Z');
f = ok(call({action:'entryForm', token:tX1}));
const tc2 = f.rows.find(r => r.maBP === tcbg.maBP);
assert.equal(f.ngay, '2026-11-18'); assert.equal(tc2.bcDau, 36); assert.equal(tc2.tvDau, 3); assert.equal(tc2.daNhap, false);
// Form cũ (mở từ hôm qua) gửi sau nửa đêm → bị chặn
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-17', rows:[{maBP:'NM1-08', values:z}]}), /hôm nay là 18\/11\/2026/);
ok(call({action:'submitEntry', token:tX1, ngay:'2026-11-18', rows:[{maBP:tcbg.maBP, values:z}]}));
// Giờ chốt
sheets.CauHinh.data.find(r => r[0]==='GIO_CHOT')[1] = '10:00';
NOW = new Date('2026-11-18T03:30:00Z'); // 10:30
f = ok(call({action:'entryForm', token:tX1})); assert.equal(f.khoa, true);
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-18', rows:[{maBP:'NM1-01', values:z}]}), /quá giờ chốt/);
// Admin sửa ngày 17 → cuốn chiếu ngày 18 tự cập nhật
fail(call({action:'adminSave', token:tAd, ngay:'2026-11-17', lyDo:'', rows:[]}), /lý do/);
fail(call({action:'adminSave', token:tX1, ngay:'2026-11-17', lyDo:'abcdef', rows:[]}), /không có quyền/);
fail(call({action:'adminSave', token:tAd, ngay:'2026-11-19', lyDo:'abcdef', rows:[]}), /tương lai/);
let a = ok(call({action:'adminSave', token:tAd, ngay:'2026-11-17', lyDo:'Bổ sung 3 người mới chưa báo', rows:[{maBP:tcbg.maBP, values:Object.assign({}, z, {om:2, moiBC:5, nvTV:1, tangCa:10})}]}));
assert.equal(a.capNhatCuonChieu, 1);
const r18 = sheets.NhapLieu.data.find(r => r[0]==='2026-11-18' && r[1]===tcbg.maBP);
assert.equal(r18[5], 39, 'BC đầu ngày 18 = 34 + 5');
// Admin nhập bù cho bộ phận quên nhập ngày 17
a = ok(call({action:'adminSave', token:tAd, ngay:'2026-11-17', lyDo:'Bộ phận quên nhập', rows:[{maBP:'NM2-05', values:z}]}));
assert.equal(a.results[0].msg, 'Đã nhập bù');
// Báo cáo
const d = ok(call({action:'dailyReport', token:tBgd, ngay:'2026-11-17'})).report;
assert.equal(d.daNhap, 3); assert.equal(d.tongBP, 40); assert.ok(d.banTin.includes('BÁO CÁO NHÂN SỰ NGÀY 17/11/2026'));
fail(call({action:'dailyReport', token:tBgd, ngay:'2026-11-30'}), /tương lai/);
const m = ok(call({action:'monthlyReport', token:tBgd, thang:'2026-11'})).report;
assert.equal(m.days.length, 18); assert.equal(m.tong.soNgay, 2);
const db = ok(call({action:'dashboard', token:tBgd})).report; assert.equal(db.ngay, '2026-11-18');
const st = ok(call({action:'status', token:tAd, ngay:'2026-11-17'})).report; assert.equal(st.chuaPhanXuong, 0);
assert.deepEqual(d.xuong.map(x => x.label).slice(0, 4), ['NM1 · Văn phòng', 'NM1 · Xưởng 1', 'NM1 · Xưởng 2', 'NM1 · Kho']);
const h = ok(call({action:'history', token:tAd})); assert.ok(h.rows.length >= 5); assert.equal(h.rows[0].hanhDong, 'Admin nhập bù');
// Xóa
a = ok(call({action:'adminDelete', token:tAd, ngay:'2026-11-17', maBP:'NM2-05', lyDo:'Nhập nhầm bộ phận'}));
assert.equal(a.rows.find(r=>r.maBP==='NM2-05').daNhap, false);
// Phân xưởng → phạm vi thu hẹp
assert.equal(sheets.DanhMuc.data[11][4], 'NM1 - TCBG');
sheets.DanhMuc.data[11][3] = 'X2'; // dòng 12 = NM1-11 TCBG, ghi ngắn "X2" 
f = ok(call({action:'entryForm', token:tX1})); assert.ok(!f.rows.some(r=>r.maBP==='NM1-11'), 'TCBG đã sang X2');
// Khóa sai PIN
for (let i=0;i<5;i++) call({action:'login', ma:'NM2-X1', pin:'111111'});
fail(call({action:'login', ma:'NM2-X1', pin:pins['NM2-X1']}), /quá 5 lần/);
// Đặt lại PIN
const np = ctx.resetPin('NM2-X2'); fail(call({action:'login', ma:'NM2-X2', pin:pins['NM2-X2']})); ok(call({action:'login', ma:'NM2-X2', pin:np}));
// Khóa tài khoản
sheets.NguoiDung.data.find(r=>r[0]==='NM1-X1')[5] = false;
fail(call({action:'entryForm', token:tX1}), /bị khóa/);
// recalcAll sau khi đổi số gốc có "Áp dụng từ"
sheets.DanhMuc.data[11][5] = 50; sheets.DanhMuc.data[11][7] = '2026-11-18';
assert.equal(ctx.recalcAll(), 1);
assert.equal(sheets.NhapLieu.data.find(r => r[0]==='2026-11-18' && r[1]==='NM1-11')[5], 50);
console.log('GAS tests OK –', sheets.NhapLieu.getLastRow()-1, 'dòng dữ liệu,', sheets.LichSu.getLastRow()-1, 'dòng lịch sử');
