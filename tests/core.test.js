const assert = require('assert');
const C = require('../js/core.js');
const dm = [
  {maBP:'NM1-01', donVi:'NM1', xuong:'', boPhan:'NM1 - TCBG', bcGoc:34, tvGoc:4, apDung:'', rieng:false, dangDung:true},
  {maBP:'NM1-02', donVi:'NM1', xuong:'NM1-X1', boPhan:'NM1 - KHO THANH BÌNH', bcGoc:2, tvGoc:31, apDung:'', rieng:true, dangDung:true},
  {maBP:'NM2-01', donVi:'NM2', xuong:'NM2-X2', boPhan:'NM2 - SƠ CHẾ', bcGoc:22, tvGoc:12, apDung:'', rieng:false, dangDung:true},
];
const z = {vangBC:0,vangTV:0,diTC:0,denTC:0,moiBC:0,moiTV:0,nvBC:0,nvTV:0,tangCa:0,gioTC:0};
const rec = (ngay, maBP, bcDau, tvDau, v) => Object.assign({ngay, maBP, bcDau, tvDau}, z, v);
// dates
assert.equal(C.thu('2026-11-17'), 'T3'); assert.equal(C.addDays('2026-11-30',1),'2026-12-01'); assert.equal(C.monthDays('2026-02').length, 28);
assert.equal(C.fmtPct(0.9534), '95,3%'); assert.equal(C.fmtInt(1234567), '1.234.567');
// scope
assert.ok(C.inScope('NM1-X2', dm[0]));        // unassigned → any xưởng of NM1
assert.ok(!C.inScope('NM1-X2', dm[1]));       // assigned X1
assert.ok(C.inScope('NM1-X1', dm[1]));
assert.ok(!C.inScope('NM2-X1', dm[0]));
assert.ok(C.inScope('*', dm[2])); assert.ok(C.inScope('nm2', dm[2])); assert.ok(C.inScope('NM1-01', dm[0]));
assert.ok(!C.inScope('NM1-01', dm[1]));
assert.equal(C.normXuong('NM1','x1'),'NM1-X1'); assert.equal(C.normXuong('NM1','NM1-X2'),'NM1-X2'); assert.equal(C.normXuong('NM1',''),'');
assert.equal(C.tenXuong('NM2-VP'),'NM2 · Văn phòng'); assert.equal(C.tenXuong('NM1-X2','NM1'),'NM1 · Xưởng 2'); assert.equal(C.tenXuong('NM1-KHO'),'NM1 · Kho');
assert.ok(!C.inScope('NM1-VP', {donVi:'NM1', xuong:'X1', maBP:'NM1-08'})); assert.ok(C.inScope('NM1-X1', {donVi:'NM1', xuong:'x1', maBP:'NM1-08'}));
assert.ok(C.inScope('NM1-VP', {donVi:'NM1', xuong:'', maBP:'NM1-08'})); assert.ok(!C.inScope('NM1-05', {donVi:'NM1', xuong:'', maBP:'NM1-06'}));
// roll forward
const recs = [ rec('2026-11-16','NM1-01',34,4,{moiBC:2,nvTV:1}) ];
let b = C.computeBase(dm[0], recs, '2026-11-17'); assert.deepEqual([b.bc,b.tv],[36,3]);
b = C.computeBase(dm[0], recs, '2026-11-16'); assert.deepEqual([b.bc,b.tv],[34,4]); // same-day not counted
b = C.computeBase(Object.assign({}, dm[0], {apDung:'2026-11-17', bcGoc:40}), recs, '2026-11-18'); assert.equal(b.bc, 40);
// validate
let v = C.validateEntry({vangBC:'2',vangTV:'1',diTC:'3',denTC:'1',moiBC:'0',moiTV:'0',nvBC:'0',nvTV:'0',tangCa:'5',gioTC:'12,5'}, {bc:34,tv:4}, {});
assert.equal(v.errors.length, 0, v.errors.join()); assert.equal(v.derived.hienDien, 35); assert.equal(v.derived.quanSo, 38);
assert.equal(v.derived.thucTe, 33); assert.equal(v.values.gioTC, 12.5); assert.equal(v.derived.tyLe, 35/38, 'tăng cường không tính vào tỷ lệ');
v = C.validateEntry(Object.assign({}, z, {gioTC:'1.3', tangCa:1}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/0,5 giờ/.test(e)));
v = C.validateEntry(Object.assign({}, z, {gioTC:4}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/số người tăng ca/.test(e)));
v = C.validateEntry(Object.assign({}, z, {tangCa:3}), {bc:34,tv:4}, {}); assert.ok(v.warnings.some(w=>/Chưa nhập số giờ/.test(w)));
v = C.validateEntry(Object.assign({}, z, {vangTV:5}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/Nghỉ phép thời vụ/.test(e)));
v = C.validateEntry(Object.assign({}, z, {diTC:40}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/Đi tăng cường/.test(e)));
assert.equal(C.derive({bcDau:10, tvDau:0, phepNam:1, om:2, khongPhep:1}).tongVang, 4, 'đọc được bản ghi cấu trúc cũ');
assert.equal(C.fmtNum(1234.5), '1.234,5'); assert.equal(C.fmtNum(8), '8');
v = C.validateEntry({vangBC:'',vangTV:'0'}, {bc:34,tv:4}, {}); assert.ok(v.errors.length >= 9);
v = C.validateEntry(Object.assign({}, z, {vangBC:50}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/Nghỉ phép chính thức/.test(e)));
v = C.validateEntry(Object.assign({}, z, {nvTV:5}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/thời vụ/.test(e)));
v = C.validateEntry(Object.assign({}, z, {vangBC:'1.5'}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/số nguyên/.test(e)));
v = C.validateEntry(Object.assign({}, z, {vangBC:5}), {bc:34,tv:4}, {}); assert.ok(v.warnings.some(w=>/dưới ngưỡng/.test(w)));
// reports
const all = [
  rec('2026-11-16','NM1-01',34,4,{vangBC:2}), rec('2026-11-16','NM1-02',2,31,{vangTV:1}), rec('2026-11-16','NM2-01',22,12,{vangBC:4, moiTV:1}),
  rec('2026-11-17','NM1-01',34,4,{vangBC:1, nvBC:1, diTC:2, tangCa:4, gioTC:8}), rec('2026-11-17','NM2-01',22,13,{denTC:2}),
];
const ix = C.buildIndex({danhMuc:dm, records:all, cfg:{NGUONG_DO:0.9, NGUONG_VANG:0.95}, ngayNghi:[]});
const r = C.dailyReport(ix, '2026-11-17');
const tot = r.groups.find(g=>g.key==='ALL');
assert.equal(r.daNhap, 2); assert.equal(r.tongBP, 3); assert.deepEqual(r.chuaNhap, ['NM1 - KHO THANH BÌNH']);
assert.equal(tot.quanSo, 38-1 + 35); assert.equal(tot.hienDien, 36 + 35); 
assert.equal(r.ngayTruoc, '2026-11-16'); assert.equal(tot.thucTe, 36 + 35); assert.equal(tot.gioTC, 8);
assert.ok(/Tăng cường: đi 2, đến 2/.test(r.banTin) && /4 người, 8 giờ/.test(r.banTin), r.banTin);
const nm1 = r.groups.find(g=>g.key==='NM1'); assert.equal(nm1.soBP, 1); assert.equal(nm1.soBPTong, 2);
assert.ok(r.groups.some(g=>g.nhom==='rieng' && /Kho Thanh Bình \(trong NM1\)/.test(g.label)), r.groups.map(g=>g.label).join());
assert.equal(r.bienDong.length, 1); assert.equal(r.luyKeThang.moi, 1); assert.equal(r.luyKeThang.nghiViec, 1);
console.log(r.banTin);
const m = C.monthlyReport(ix, '2026-11');
assert.equal(m.days.length, 30); assert.equal(m.tong.soNgay, 2);
assert.equal(m.byBp.find(x=>x.maBP==='NM1-01').quanSoCuoi, 37);
assert.equal(m.byBp.find(x=>x.maBP==='NM2-01').quanSoCuoi, 35);
const d = C.dashboard(ix, '2026-11-17'); assert.equal(d.trend.length, 2); assert.ok(d.thapNhat.length === 2);
assert.equal(C.isWorkingDay(ix, '2026-11-22'), false);
// recalc chain
const chain = [rec('2026-11-16','NM1-01',34,4,{moiBC:3}), rec('2026-11-17','NM1-01',34,4,{nvBC:1}), rec('2026-11-18','NM1-01',34,4,{})];
const ch = C.recalcChain(dm[0], chain, '2026-11-16');
assert.equal(ch.length, 2); assert.equal(chain[1].bcDau, 37); assert.equal(chain[2].bcDau, 36);
console.log('core tests OK');
