// Giả lập tối thiểu các dịch vụ Google Apps Script để chạy Code.gs + Core.gs trong Node.
const crypto = require('crypto');
function colToNum(c){ let n=0; for (const ch of c) n = n*26 + (ch.charCodeAt(0)-64); return n; }
class Range {
  constructor(sh, r, c, nr, nc){ Object.assign(this, {sh, r, c, nr, nc}); }
  getValues(){ const out=[]; for (let i=0;i<this.nr;i++){ const row=[]; for(let j=0;j<this.nc;j++){ const v=(this.sh.data[this.r-1+i]||[])[this.c-1+j]; row.push(v===undefined?'':v);} out.push(row);} return out; }
  getValue(){ return this.getValues()[0][0]; }
  setValues(v){ if (v.length!==this.nr || v[0].length!==this.nc) throw new Error(`setValues size mismatch ${v.length}x${v[0].length} vs ${this.nr}x${this.nc}`);
    for (let i=0;i<this.nr;i++){ const rr=this.r-1+i; this.sh.data[rr]=this.sh.data[rr]||[]; for(let j=0;j<this.nc;j++){ let x=v[i][j]; this.sh.data[rr][this.c-1+j]=x; } } return this; }
  setValue(x){ return this.setValues([[x]]); }
  setFontWeight(){return this;} setBackground(){return this;} setNumberFormat(){return this;} insertCheckboxes(){return this;} setDataValidation(){return this;}
}
class Sheet {
  constructor(name){ this.name=name; this.data=[]; }
  getLastRow(){ for (let i=this.data.length-1;i>=0;i--) if (this.data[i] && this.data[i].some(v=>v!==''&&v!==undefined&&v!==null)) return i+1; return 0; }
  getLastColumn(){ return Math.max(0,...this.data.map(r=>r?r.length:0)); }
  getRange(a, c, nr, nc){
    if (typeof a === 'string') { let m=a.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/); const c1=colToNum(m[1]), c2=m[3]?colToNum(m[3]):c1; const r1=m[2]?+m[2]:1, r2=m[4]?+m[4]:(m[2]?r1:Math.max(1,this.getLastRow())); return new Range(this, r1, c1, r2-r1+1, c2-c1+1); }
    return new Range(this, a, c, nr||1, nc||1);
  }
  getDataRange(){ return new Range(this, 1, 1, Math.max(1,this.getLastRow()), Math.max(1,this.getLastColumn())); }
  setFrozenRows(){} deleteRow(r){ this.data.splice(r-1,1); }
}
function makeGlobals(){
  const sheets = {}; const cache = new Map(); const props = new Map();
  const ss = { tz:'Asia/Ho_Chi_Minh', setSpreadsheetTimeZone(t){this.tz=t;}, getSpreadsheetTimeZone(){return this.tz;},
    getSheetByName(n){ return sheets[n]||null; }, insertSheet(n){ return sheets[n]=new Sheet(n); } };
  const fmt = (d, tz, f) => { const x = new Date(d.getTime() + 7*3600e3); const p=n=>String(n).padStart(2,'0');
    return f.replace('yyyy', x.getUTCFullYear()).replace('MM', p(x.getUTCMonth()+1)).replace('dd', p(x.getUTCDate())).replace('HH', p(x.getUTCHours())).replace('mm', p(x.getUTCMinutes())).replace('ss', p(x.getUTCSeconds())); };
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: ()=>ss, getUi: ()=>{ throw new Error('no ui'); },
      newDataValidation: ()=>({ requireValueInList(){return this;}, build(){return {};} }) },
    Utilities: { formatDate: fmt, getUuid: ()=>crypto.randomUUID(), DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf8'},
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s,'utf8').digest()).map(b=>b>127?b-256:b) },
    CacheService: { getScriptCache: ()=>({ get:k=>cache.has(k)?cache.get(k):null, put:(k,v)=>cache.set(k,v), remove:k=>cache.delete(k) }) },
    PropertiesService: { getScriptProperties: ()=>({ getProperty:k=>props.has(k)?props.get(k):null, setProperty:(k,v)=>props.set(k,v) }) },
    LockService: { getScriptLock: ()=>({ waitLock(){}, releaseLock(){} }) },
    ContentService: { MimeType:{JSON:'json'}, createTextOutput: s=>({ content:s, setMimeType(){ return this; }, getContent(){ return this.content; } }) },
    Logger: { log: ()=>{} }, console,
  };
  return { g, sheets, cache };
}
module.exports = { makeGlobals };
