// ---------------------------------------------------------------
// CendurOFF – ZIP a Excel (.xlsx) bez dalších knihoven (v4.17)
//  zipBuild([{ name, data:Buffer|string }]) → Buffer   (deflate, názvy v UTF-8)
//  zipRead(buf) → [{ name, data:Buffer }]
//  xlsxBuild([{ name, columns:[{title, width?}], rows:[[…]] }]) → Buffer
//    buňka: číslo → číslo, Date → datum a čas, jinak text; null = prázdná
// ---------------------------------------------------------------
const zlib = require('zlib');

const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf){ let c = 0xFFFFFFFF; for(let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function dosTime(d){
  const t = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [t, day];
}

function zipBuild(files){
  const parts = [], central = []; let off = 0;
  const [tm, dt] = dosTime(new Date());
  for(const f of files){
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8');
    const crc = crc32(raw);
    // už zabalené (gz, jpg…) jen uložit, ostatní zkomprimovat
    const store = /\.(gz|zip|jpe?g|png|webp|xlsx)$/i.test(f.name);
    const body = store ? raw : zlib.deflateRawSync(raw, { level: 6 });
    const method = store ? 0 : 8;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(tm, 10); lh.writeUInt16LE(dt, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(tm, 12); ch.writeUInt16LE(dt, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cd, end]));
}

function zipRead(buf){
  let e = -1;
  for(let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if(buf.readUInt32LE(i) === 0x06054b50){ e = i; break; }
  if(e < 0) throw new Error('není zip');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
  for(let k = 0; k < n; k++){
    if(buf.readUInt32LE(p) !== 0x02014b50) throw new Error('poškozený zip');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    const lnl = buf.readUInt16LE(lo + 26), lxl = buf.readUInt16LE(lo + 28);
    const body = buf.slice(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize);
    out.push({ name, get data(){ return method === 8 ? zlib.inflateRawSync(body) : body; } });
    p += 46 + nl + xl + cl;
  }
  return out;
}

// ---------- Excel ----------
const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colName(i){ let s = ''; i++; while(i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
// Excel počítá dny od 30. 12. 1899; čas zobrazíme v českém čase
function excelDate(d){
  const local = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  return (Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes(), local.getSeconds()) - Date.UTC(1899, 11, 30)) / 86400000;
}
function sheetXml(sh){
  const cols = sh.columns.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.width || 14) + '" customWidth="1"/>').join('');
  const cell = (v, r, c, hdr) => {
    const ref = colName(c) + r;
    if(v == null || v === '') return '';
    if(hdr) return '<c r="' + ref + '" t="inlineStr" s="1"><is><t>' + xe(v) + '</t></is></c>';
    if(v instanceof Date && !isNaN(v)) return '<c r="' + ref + '" s="2"><v>' + excelDate(v) + '</v></c>';
    if(typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (Number.isInteger(v) ? '' : ' s="3"') + '><v>' + v + '</v></c>';
    if(typeof v === 'boolean') return '<c r="' + ref + '" t="inlineStr"><is><t>' + (v ? 'ano' : 'ne') + '</t></is></c>';
    return '<c r="' + ref + '" t="inlineStr" s="4"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>';
  };
  const rows = ['<row r="1">' + sh.columns.map((c, i) => cell(c.title, 1, i, true)).join('') + '</row>']
    .concat(sh.rows.map((row, ri) => '<row r="' + (ri + 2) + '">' + row.map((v, ci) => cell(v, ri + 2, ci, false)).join('') + '</row>'));
  const last = colName(sh.columns.length - 1) + (sh.rows.length + 1);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<cols>' + cols + '</cols><sheetData>' + rows.join('') + '</sheetData>' +
    (sh.rows.length ? '<autoFilter ref="A1:' + last + '"/>' : '') + '</worksheet>';
}
function xlsxBuild(sheets){
  const files = [];
  files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' });
  files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
  files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => '<sheet name="' + xe(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
    '<definedNames>' + sheets.map((s, i) => s.rows.length ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xe(s.name.slice(0, 31)).replace(/'/g, "''") + '\'!$A$1:$' + colName(s.columns.length - 1) + '$' + (s.rows.length + 1) + '</definedName>' : '').join('') + '</definedNames></workbook>' });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
  // styly: 0 běžný, 1 hlavička (tučně, šedé pozadí), 2 datum a čas, 3 desetinné číslo, 4 text (zalomit)
  files.push({ name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="d.m.yyyy h:mm"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDE4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="0"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
  sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }));
  return zipBuild(files);
}

module.exports = { zipBuild, zipRead, xlsxBuild, crc32 };
