const assert = require('assert');
const C = require('../js/core.js');
const dm = [
  {maBP:'NM1-01', donVi:'NM1', xuong:'', boPhan:'NM1 - TCBG', bcGoc:34, tvGoc:4, apDung:'', rieng:false, dangDung:true},
  {maBP:'NM1-02', donVi:'NM1', xuong:'NM1-X1', boPhan:'NM1 - KHO THANH BÌNH', bcGoc:2, tvGoc:31, apDung:'', rieng:true, dangDung:true},
  {maBP:'NM2-01', donVi:'NM2', xuong:'NM2-X2', boPhan:'NM2 - SƠ CHẾ', bcGoc:22, tvGoc:12, apDung:'', rieng:false, dangDung:true},
];
const z = {phepNam:0,khongPhep:0,om:0,thaiSan:0,viecRieng:0,moiBC:0,moiTV:0,nvBC:0,nvTV:0,tangCa:0};
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
let v = C.validateEntry({phepNam:'1',khongPhep:'0',om:'2',thaiSan:'0',viecRieng:'0',moiBC:'0',moiTV:'0',nvBC:'0',nvTV:'0',tangCa:'5'}, {bc:34,tv:4}, {});
assert.equal(v.errors.length, 0); assert.equal(v.derived.hienDien, 35); assert.equal(v.derived.quanSo, 38);
v = C.validateEntry({phepNam:'',khongPhep:'0'}, {bc:34,tv:4}, {}); assert.ok(v.errors.length >= 9);
v = C.validateEntry(Object.assign({}, z, {om:50}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/Tổng vắng/.test(e)));
v = C.validateEntry(Object.assign({}, z, {nvTV:5}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/thời vụ/.test(e)));
v = C.validateEntry(Object.assign({}, z, {om:'1.5'}), {bc:34,tv:4}, {}); assert.ok(v.errors.some(e=>/số nguyên/.test(e)));
v = C.validateEntry(Object.assign({}, z, {om:5}), {bc:34,tv:4}, {}); assert.ok(v.warnings.some(w=>/dưới ngưỡng/.test(w)));
// reports
const all = [
  rec('2026-11-16','NM1-01',34,4,{om:2}), rec('2026-11-16','NM1-02',2,31,{phepNam:1}), rec('2026-11-16','NM2-01',22,12,{khongPhep:4, moiTV:1}),
  rec('2026-11-17','NM1-01',34,4,{om:1, nvBC:1}), rec('2026-11-17','NM2-01',22,13,{}),
];
const ix = C.buildIndex({danhMuc:dm, records:all, cfg:{NGUONG_DO:0.9, NGUONG_VANG:0.95}, ngayNghi:[]});
const r = C.dailyReport(ix, '2026-11-17');
const tot = r.groups.find(g=>g.key==='ALL');
assert.equal(r.daNhap, 2); assert.equal(r.tongBP, 3); assert.deepEqual(r.chuaNhap, ['NM1 - KHO THANH BÌNH']);
assert.equal(tot.quanSo, 38-1 + 35); assert.equal(tot.hienDien, 36 + 35); 
assert.equal(r.ngayTruoc, '2026-11-16');
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
