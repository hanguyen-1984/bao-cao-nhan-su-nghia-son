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
const z = {vangBC:0,vangTV:0,diTC:0,denTC:0,moiBC:0,moiTV:0,nvBC:0,nvTV:0,tangCa:0,gioTC:0};
const tcbg = f.rows.find(r => r.boPhan === 'NM1 - TCBG');
assert.equal(tcbg.bcDau, 34); assert.equal(tcbg.tvDau, 4);
// nhập lùi / nhập trước bị chặn
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-16', rows:[{maBP:tcbg.maBP, values:z}]}), /Không được nhập lùi/);
fail(call({action:'submitEntry', token:tX1, ngay:'2026-11-18', rows:[{maBP:tcbg.maBP, values:z}]}), /Không được nhập lùi/);
// nhập hợp lệ
let s = ok(call({action:'submitEntry', token:tX1, ngay:'2026-11-17', rows:[
  {maBP:tcbg.maBP, values:Object.assign({}, z, {vangBC:2, moiBC:2, nvTV:1, diTC:1, tangCa:10, gioTC:15, ghiChu:'=HACK()'})},
  {maBP:'NM1-08', values:z},
  {maBP:'NM2-01', values:z},
  {maBP:'NM1-01', values:z},
  {maBP:'NM1-09', values:Object.assign({}, z, {vangBC:99})},
  {maBP:'NM1-10', values:Object.assign({}, z, {vangTV:''})},
]}));
const res = Object.fromEntries(s.results.map(r => [r.maBP, r]));
assert.ok(res[tcbg.maBP].ok && res['NM1-08'].ok);
assert.match(res['NM2-01'].errors[0], /phạm vi/);
assert.match(res['NM1-01'].errors[0], /phạm vi/, 'Văn phòng không thuộc Xưởng 1');
assert.match(res['NM1-09'].errors.join(), /Nghỉ phép chính thức/);
assert.match(res['NM1-10'].errors.join(), /chưa nhập/);
assert.equal(sheets.NhapLieu.getLastRow(), 3);
assert.equal(sheets.NhapLieu.data[1][17], "'=HACK()", 'ghi chú bị chặn công thức');
assert.deepEqual(sheets.NhapLieu.data[1].slice(7, 17), [2, 0, 1, 0, 2, 0, 0, 1, 10, 15], 'cột dữ liệu v2');
assert.equal(sheets.NhapLieu.data[1][23], 39 - 2 - 1, 'thực tế làm việc');
// sửa trong ngày
s = ok(call({action:'submitEntry', token:tX1, ngay:'2026-11-17', rows:[{maBP:'NM1-08', values:Object.assign({}, z, {vangTV:0, vangBC:1})}]}));
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
let a = ok(call({action:'adminSave', token:tAd, ngay:'2026-11-17', lyDo:'Bổ sung 3 người mới chưa báo', rows:[{maBP:tcbg.maBP, values:Object.assign({}, z, {vangBC:2, moiBC:5, nvTV:1, tangCa:10, gioTC:15})}]}));
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
// Quản lý người dùng & PIN
{
  const tA = ok(call({action:'login', ma:'ADMIN', pin:pins['ADMIN']})).token;
  fail(call({action:'userList', token:tBgd}), /không có quyền/);
  let L = ok(call({action:'userList', token:tA}));
  assert.equal(L.users.length, 9); assert.ok(L.scope.xuong.some(x => x.ma === 'NM1-X1')); assert.ok(!JSON.stringify(L).includes(sheets.NguoiDung.data[1][4]), 'không trả hash PIN');
  fail(call({action:'userSave', token:tA, moi:true, ma:'NM1-X1-HUNG', ten:'Hùng', vaiTro:'NHAP', phamVi:'NM1-X1', pin:'123456'}), /liên tiếp/);
  fail(call({action:'userSave', token:tA, moi:true, ma:'NM1-X1-HUNG', ten:'Hùng', vaiTro:'NHAP', phamVi:'NM1-X1', pin:'1111'}), /6 chữ số/);
  fail(call({action:'userSave', token:tA, moi:true, ma:'NM1-X1-HUNG', ten:'Hùng', vaiTro:'NHAP', phamVi:'NM9-X7', pin:'246810'}), /DanhMuc/);
  fail(call({action:'userSave', token:tA, moi:true, ma:'NM1-X1', ten:'Trùng', vaiTro:'NHAP', phamVi:'NM1-X1', pin:'246810'}), /đã tồn tại/);
  fail(call({action:'userSave', token:tA, moi:true, ma:'X', ten:'a', vaiTro:'NHAP', phamVi:'NM1-X1', pin:'246810'}), /2–20/);
  L = ok(call({action:'userSave', token:tA, moi:true, ma:'nm1-x1-hung', ten:'Nguyễn Văn Hùng', vaiTro:'NHAP', phamVi:'NM1-X1, NM2-05', pin:'246810'}));
  assert.equal(L.users.length, 10); const hu = L.users.find(u => u.ma === 'NM1-X1-HUNG'); assert.equal(hu.phamVi, 'NM1-X1, NM2-05'); assert.ok(hu.coPin && hu.dangDung);
  const tH = ok(call({action:'login', ma:'NM1-X1-HUNG', pin:'246810'})).token;
  const fH = ok(call({action:'entryForm', token:tH})); assert.ok(fH.rows.some(r => r.maBP === 'NM2-05'));
  // Đổi PIN
  fail(call({action:'changePin', token:tH, pinCu:'000000', pinMoi:'135790'}), /không đúng/);
  fail(call({action:'changePin', token:tH, pinCu:'246810', pinMoi:'999999'}), /giống nhau/);
  ok(call({action:'changePin', token:tH, pinCu:'246810', pinMoi:'135790'}));
  fail(call({action:'login', ma:'NM1-X1-HUNG', pin:'246810'})); ok(call({action:'login', ma:'NM1-X1-HUNG', pin:'135790'}));
  // Admin đặt lại PIN + khóa
  ok(call({action:'userSave', token:tA, ma:'NM1-X1-HUNG', ten:'Nguyễn Văn Hùng', vaiTro:'XEM', phamVi:'NM1-X1', pin:'975310', dangDung:true}));
  const tH2 = ok(call({action:'login', ma:'NM1-X1-HUNG', pin:'975310'})); assert.equal(tH2.user.vaiTro, 'XEM'); assert.equal(tH2.user.phamVi, '*');
  ok(call({action:'userSave', token:tA, ma:'NM1-X1-HUNG', ten:'Nguyễn Văn Hùng', vaiTro:'XEM', phamVi:'', dangDung:false}));
  fail(call({action:'login', ma:'NM1-X1-HUNG', pin:'975310'}));
  fail(call({action:'entryForm', token:tH2.token}), /bị khóa|không có quyền/);
  // Không tự khóa / không còn Admin
  fail(call({action:'userSave', token:tA, ma:'ADMIN', ten:'Admin', vaiTro:'XEM', phamVi:'*', dangDung:true}), /tự bỏ quyền/);
  assert.ok(!sheets.LichSu.data.some(r => r.join('|').includes('975310') || r.join('|').includes('246810')), 'PIN không bị ghi vào lịch sử');
  assert.ok(sheets.LichSu.data.some(r => r[2] === 'Thêm người dùng'));
}
// Chuyển dữ liệu cấu trúc cũ (v1) sang v2
{
  const M = makeGlobals(), c2 = vm.createContext(M.g);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Core.gs', 'utf8'), c2);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8'), c2);
  const old = M.g.SpreadsheetApp.getActiveSpreadsheet().insertSheet('NhapLieu');
  old.data = [['Ngày','Mã BP','Đơn vị','Xưởng','Bộ phận','Chính thức đầu ngày','Thời vụ đầu ngày','Phép năm','Nghỉ không phép','Nghỉ ốm','Thai sản','Việc riêng','Mới (chính thức)','Mới (thời vụ)','Nghỉ việc (chính thức)','Nghỉ việc (thời vụ)','Tăng ca','Ghi chú','Tổng đầu ngày','Quân số trong ngày','Tổng vắng','Hiện diện','Tỷ lệ chuyên cần','Người nhập','Thời điểm nhập','Lần sửa','Nguồn'],
    ['2026-11-17','NM1-11','NM1','NM1-X1','NM1 - TCBG',34,4,1,1,2,0,1,2,0,0,1,10,'ghi chú',38,39,5,34,0.8718,'A (NM1-X1)','2026-11-17 08:30:00',0,'FORM']];
  c2.setup();
  const nl = M.sheets.NhapLieu.data;
  assert.equal(nl[0][7], 'Nghỉ phép (chính thức)'); assert.equal(nl.length, 2);
  assert.deepEqual(nl[1].slice(0, 18), ['2026-11-17','NM1-11','NM1','NM1-X1','NM1 - TCBG',34,4,5,0,0,0,2,0,0,1,10,0,'ghi chú']);
  assert.equal(nl[1][21], 34); assert.equal(nl[1][25], '2026-11-17 08:30:00'); assert.equal(nl[1][27], 'FORM');
  assert.equal(M.sheets.NhapLieu_cu.data[1][9], 2, 'đã sao lưu bản cũ');
  assert.equal(c2.migrateNhapLieuV2_(), 0, 'chỉ chuyển 1 lần');
}
console.log('GAS tests OK –', sheets.NhapLieu.getLastRow()-1, 'dòng dữ liệu,', sheets.LichSu.getLastRow()-1, 'dòng lịch sử');
