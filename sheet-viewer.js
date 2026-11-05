/* Spreadsheet viewer: shows an .xlsx (or .csv) file the way Excel does, read-only.
   Sheets as tabs, column letters and row numbers, cell formatting (fonts, fills, borders,
   number/date/currency formats), merged cells, column widths, frozen panes, formulas in the
   formula bar, click/drag selection with Sum/Average/Count, find, zoom, full screen, copy.
   No libraries: the file is unzipped and read in the browser.
   Used by site.js for {{sheet: file.xlsx}} in a project overview. */
(function(){
  'use strict';

  /* ---------------- unzip (central directory + deflate-raw) ---------------- */
  async function unzip(buf){
    const dv = new DataView(buf), u8 = new Uint8Array(buf), files = {};
    let e = buf.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('This file is not a valid .xlsx workbook.');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const dec = new TextDecoder();
    for (let i = 0; i < n; i++){
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true), name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      files[name.replace(/^\//, '')] = { method, csize, off };
      p += 46 + nl + xl + cl;
    }
    const get = async name => {
      const f = files[name.replace(/^\//, '')]; if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const data = u8.subarray(start, start + f.csize);
      if (f.method === 0) return dec.decode(data);
      return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
    return get;
  }
  const parseXml = s => new DOMParser().parseFromString(s || '<x/>', 'application/xml');
  const kids = (el, tag) => el ? [...el.children].filter(c => c.localName === tag) : [];
  const kid = (el, tag) => kids(el, tag)[0] || null;
  const all = (el, tag) => el ? [...el.getElementsByTagNameNS('*', tag)] : [];
  const first = (el, tag) => all(el, tag)[0] || null;
  const attr = (el, name) => el ? el.getAttribute(name) : null;
  const relId = el => el && (el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));

  /* ---------------- cell references ---------------- */
  const colNum = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const colName = n => { let s = ''; n++; while (n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const decodeRef = ref => { const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref || ''); return m ? { c: colNum(m[1]), r: +m[2] - 1 } : null; };
  const decodeRange = ref => { const [a, b] = String(ref || '').split(':'); const s = decodeRef(a), e = decodeRef(b || a); return s && e ? { s, e } : null; };
  const encode = (r, c) => colName(c) + (r + 1);

  /* ---------------- colors ---------------- */
  const INDEXED = ['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
  const DEFAULT_THEME = ['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47'];
  function tint(hex, t){
    if (!t) return hex;
    const ch = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).map(c => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t));
    return ch.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function color(el, theme){
    if (!el) return null;
    let hex = null;
    if (attr(el, 'rgb')) hex = attr(el, 'rgb').slice(-6);
    else if (attr(el, 'theme') != null) hex = theme[+attr(el, 'theme')] || null;
    else if (attr(el, 'indexed') != null){ const i = +attr(el, 'indexed'); if (i === 64 || i === 65) return null; hex = INDEXED[i] || null; }
    if (!hex) return null;
    return '#' + tint(hex, parseFloat(attr(el, 'tint') || '0'));
  }

  /* ---------------- number formats ---------------- */
  const BUILTIN = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 5: '"$"#,##0_);("$"#,##0)', 6: '"$"#,##0_);[Red]("$"#,##0)', 7: '"$"#,##0.00_);("$"#,##0.00)', 8: '"$"#,##0.00_);[Red]("$"#,##0.00)', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??', 14: 'm/d/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yyyy h:mm', 37: '#,##0_);(#,##0)', 38: '#,##0_);[Red](#,##0)', 39: '#,##0.00_);(#,##0.00)', 40: '#,##0.00_);[Red](#,##0.00)', 44: '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@' };
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function general(v){
    if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
    if (v !== 0 && (Math.abs(v) >= 1e11 || Math.abs(v) < 1e-9)) return v.toExponential(5).replace(/\.?0+e/, 'E').replace('E+', 'E+').toUpperCase();
    return String(+v.toPrecision(11));
  }
  function serialToDate(v, date1904){
    const ms = Math.round((v + (date1904 ? 1462 : 0) - 25569) * 86400000);
    return new Date(ms);
  }
  function formatDate(v, code, date1904){
    const d = serialToDate(v, date1904);
    const Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate(), W = d.getUTCDay();
    let H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
    const ampm = /AM\/PM|A\/P/i.test(code);
    const toks = code.match(/"[^"]*"|\\.|\[[^\]]*\]|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|\.0+|./gi) || [];
    let out = '', lastWasHour = false;
    toks.forEach((t, i) => {
      const l = t.toLowerCase();
      const next = toks.slice(i + 1).find(x => /^[a-z]/i.test(x)) || '';
      if (t[0] === '"') out += t.slice(1, -1);
      else if (t[0] === '\\') out += t[1];
      else if (t[0] === '['){ if (/^\[h+\]$/i.test(t)) out += Math.floor(v * 24); }
      else if (l === 'yyyy') out += Y; else if (l === 'yy') out += String(Y).slice(-2);
      else if (l === 'mmmmm') out += MONTHS[M][0];
      else if (l === 'mmmm') out += MONTHS[M];
      else if (l === 'mmm') out += MONTHS[M].slice(0, 3);
      else if (l === 'mm' || l === 'm'){
        const minute = lastWasHour || /^s/i.test(next);
        const val = minute ? Mi : M + 1; out += l === 'mm' ? String(val).padStart(2, '0') : val;
      }
      else if (l === 'dddd') out += DAYS[W]; else if (l === 'ddd') out += DAYS[W].slice(0, 3);
      else if (l === 'dd') out += String(D).padStart(2, '0'); else if (l === 'd') out += D;
      else if (l === 'hh' || l === 'h'){ const h = ampm ? ((H % 12) || 12) : H; out += l === 'hh' ? String(h).padStart(2, '0') : h; }
      else if (l === 'ss') out += String(S).padStart(2, '0'); else if (l === 's') out += S;
      else if (l === 'am/pm') out += H < 12 ? 'AM' : 'PM'; else if (l === 'a/p') out += H < 12 ? 'A' : 'P';
      else if (t[0] === '.') out += '';
      else out += t;
      if (/^h/i.test(l)) lastWasHour = true; else if (/^[a-z]/i.test(l)) lastWasHour = false;
    });
    return out;
  }
  function formatNumber(v, code, date1904){
    if (code == null || /^general$/i.test(code)) return general(v);
    const secs = []; let cur = '', q = false;
    for (const ch of code){ if (ch === '"') q = !q; if (ch === ';' && !q){ secs.push(cur); cur = ''; } else cur += ch; }
    secs.push(cur);
    let sec = secs[0], neg = false;
    if (v < 0 && secs.length > 1){ sec = secs[1]; neg = true; }
    else if (v === 0 && secs.length > 2) sec = secs[2];
    let color = null; const cm = /\[(Red|Blue|Green|Black|White|Yellow|Magenta|Cyan)\]/i.exec(sec); if (cm) color = cm[1].toLowerCase();
    const body = sec.replace(/\[(Red|Blue|Green|Black|White|Yellow|Magenta|Cyan|Color\d+)\]/gi, '');
    const bare = body.replace(/"[^"]*"|\\./g, '');
    if (/[ymdhs]/i.test(bare.replace(/\[\$[^\]]*\]/g, '')) && !/[0#?]/.test(bare)) return { text: formatDate(v, body, date1904), color };
    if (/^@$/.test(bare.trim())) return { text: String(v), color };
    let x = neg ? Math.abs(v) : v;
    const pct = /%/.test(bare); if (pct) x *= 100;
    let text;
    const decM = /\.([0#?]+)/.exec(bare), dec = decM ? decM[1].length : 0;
    if (/E[+-]/i.test(bare)) text = x.toExponential(dec).toUpperCase().replace(/E([+-])(\d)$/, 'E$10$2');
    else if (/\?\/\?/.test(bare)){
      const whole = Math.trunc(x), frac = x - whole; let best = [0, 1];
      for (let d = 1; d < 100; d++){ const n = Math.round(frac * d); if (Math.abs(frac - n / d) < Math.abs(frac - best[0] / best[1])) best = [n, d]; }
      text = (whole ? whole + ' ' : '') + (best[0] ? best[0] + '/' + best[1] : '');
    } else {
      const thousands = /[0#],[0#]/.test(bare);
      let scaled = x; const tail = /([0#])(,+)(?![0#])/.exec(bare); if (tail) scaled = x / Math.pow(1000, tail[2].length);
      text = scaled.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: thousands });
      if (!/[0#]/.test(bare.split('.')[0] || '') && Math.abs(scaled) < 1 && text.startsWith('0')) text = text.slice(1);
    }
    // literal text and currency around the number
    let pre = '', post = '', seenNum = false;
    const toks = body.match(/"[^"]*"|\\.|\[\$[^\]]*\]|_.|\*.|[0#?,.%Ee+\-\/ ]+|./g) || [];
    for (const t of toks){
      let lit = '';
      if (t[0] === '"') lit = t.slice(1, -1);
      else if (t[0] === '\\') lit = t[1];
      else if (t.startsWith('[$')) lit = (/^\[\$([^-\]]*)/.exec(t) || [])[1] || '';
      else if (t[0] === '_') lit = ' ';
      else if (t[0] === '*') lit = '';
      else if (/[0#?]/.test(t)){ seenNum = true; continue; }
      else if (/^[%]$/.test(t)) { post += '%'; continue; }
      else if (/^[\s.,]+$/.test(t)) continue;
      else lit = t;
      if (seenNum) post += lit; else pre += lit;
    }
    if (pct && !post.includes('%')) post += '%';
    let s = pre + text + post;
    if (neg && !/[(-]/.test(body.replace(/"[^"]*"/g, ''))) s = '-' + s;
    else if (!neg && v < 0 && secs.length === 1) s = '-' + s.replace(/^-/, '');
    return { text: s.replace(/\s+$/, ''), color };
  }

  /* ---------------- formulas: shift relative refs for shared formulas ---------------- */
  function shiftFormula(f, dr, dc){
    if (!dr && !dc) return f;
    return f.replace(/"[^"]*"|(?<![A-Za-z_\d.!])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z_\d(])/g, (m, cd, col, rd, row) => {
      if (m[0] === '"') return m;
      const c = cd ? col : colName(colNum(col) + dc), r = rd ? row : String(+row + dr);
      return cd + c + rd + r;
    });
  }

  /* ---------------- workbook reader ---------------- */
  async function readWorkbook(buf){
    const get = await unzip(buf);
    const wb = parseXml(await get('xl/workbook.xml'));
    const rels = parseXml(await get('xl/_rels/workbook.xml.rels'));
    const relMap = {}; all(rels, 'Relationship').forEach(r => relMap[attr(r, 'Id')] = attr(r, 'Target'));
    const date1904 = /^(1|true)$/i.test(attr(first(wb, 'workbookPr'), 'date1904') || '');

    // theme colors (Excel swaps the first two pairs)
    let theme = DEFAULT_THEME.slice();
    const th = await get('xl/theme/theme1.xml');
    if (th){
      const cs = first(parseXml(th), 'clrScheme');
      if (cs){
        const list = [...cs.children].map(c => { const s = first(c, 'srgbClr'), y = first(c, 'sysClr'); return s ? attr(s, 'val') : y ? (attr(y, 'lastClr') || '000000') : null; });
        if (list.length >= 10 && list.every(Boolean)) theme = [list[1], list[0], list[3], list[2], ...list.slice(4, 10)];
      }
    }
    // shared strings
    const shared = [];
    const ssx = await get('xl/sharedStrings.xml');
    if (ssx) kids(parseXml(ssx).documentElement, 'si').forEach(si => shared.push(all(si, 't').map(t => t.textContent).join('')));
    // styles
    const st = parseXml(await get('xl/styles.xml'));
    const numFmts = {}; all(st, 'numFmt').forEach(n => numFmts[attr(n, 'numFmtId')] = attr(n, 'formatCode'));
    const fonts = kids(first(st, 'fonts'), 'font').map(f => ({
      b: !!kid(f, 'b') && attr(kid(f, 'b'), 'val') !== '0', i: !!kid(f, 'i') && attr(kid(f, 'i'), 'val') !== '0',
      u: !!kid(f, 'u') && attr(kid(f, 'u'), 'val') !== 'none', s: !!kid(f, 'strike'),
      sz: parseFloat(attr(kid(f, 'sz'), 'val') || '11'), color: color(kid(f, 'color'), theme), name: attr(kid(f, 'name'), 'val')
    }));
    const fills = kids(first(st, 'fills'), 'fill').map(f => {
      const p = kid(f, 'patternFill'); if (!p) { const g = first(f, 'stop'); return g ? color(kid(g, 'color'), theme) : null; }
      const type = attr(p, 'patternType'); if (!type || type === 'none') return null;
      return color(kid(p, 'fgColor'), theme) || color(kid(p, 'bgColor'), theme);
    });
    const W = { thin: 1, hair: 1, dotted: 1, dashed: 1, dashDot: 1, dashDotDot: 1, medium: 2, mediumDashed: 2, mediumDashDot: 2, mediumDashDotDot: 2, slantDashDot: 2, thick: 3, double: 3 };
    const borders = kids(first(st, 'borders'), 'border').map(b => {
      const o = {};
      ['left', 'right', 'top', 'bottom'].forEach(side => {
        const e = kid(b, side), s = attr(e, 'style'); if (!s) return;
        const kind = s === 'double' ? 'double' : /dot/i.test(s) ? 'dotted' : /dash/i.test(s) ? 'dashed' : 'solid';
        o[side] = `${W[s] || 1}px ${kind} ${color(kid(e, 'color'), theme) || '#000'}`;
      });
      return o;
    });
    const xfs = kids(first(st, 'cellXfs'), 'xf').map(x => {
      const a = kid(x, 'alignment');
      return { numFmt: attr(x, 'numFmtId') || '0', font: +(attr(x, 'fontId') || 0), fill: +(attr(x, 'fillId') || 0), border: +(attr(x, 'borderId') || 0),
        h: attr(a, 'horizontal'), v: attr(a, 'vertical'), wrap: attr(a, 'wrapText') === '1' || attr(a, 'wrapText') === 'true', indent: +(attr(a, 'indent') || 0), rot: +(attr(a, 'textRotation') || 0) };
    });
    const style = { numFmts, fonts, fills, borders, xfs };

    // sheets
    const sheets = [];
    for (const s of all(wb, 'sheet')){
      const name = attr(s, 'name'), state = attr(s, 'state');
      let target = relMap[relId(s)] || ''; if (!target) continue;
      const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      if (!/worksheets\//.test(path)) continue;          // skip chart sheets
      const xml = await get(path); if (!xml) continue;
      const relPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
      const srels = {}; const rx = await get(relPath); if (rx) all(parseXml(rx), 'Relationship').forEach(r => srels[attr(r, 'Id')] = attr(r, 'Target'));
      sheets.push(readSheet(name, state === 'hidden' || state === 'veryHidden', parseXml(xml), shared, style, srels, date1904));
    }
    return { sheets, date1904 };
  }

  function readSheet(name, hidden, doc, shared, style, srels, date1904){
    const cells = new Map(); let maxR = -1, maxC = -1;
    const fmtProps = first(doc, 'sheetFormatPr');
    const defW = attr(fmtProps, 'defaultColWidth') ? parseFloat(attr(fmtProps, 'defaultColWidth')) : (attr(fmtProps, 'baseColWidth') ? +attr(fmtProps, 'baseColWidth') + 0.71 : 8.43);
    const defH = attr(fmtProps, 'defaultRowHeight') ? parseFloat(attr(fmtProps, 'defaultRowHeight')) : 15;
    const cols = [];
    all(doc, 'col').forEach(c => {
      const a = +attr(c, 'min') - 1, b = +attr(c, 'max') - 1;
      for (let i = a; i <= Math.min(b, a + 200); i++) cols[i] = { w: attr(c, 'width') ? parseFloat(attr(c, 'width')) : null, hidden: attr(c, 'hidden') === '1' || attr(c, 'hidden') === 'true', s: attr(c, 's') };
    });
    const rows = [];
    const sharedF = {};
    const sd = first(doc, 'sheetData');
    kids(sd, 'row').forEach((row, ri) => {
      const r = attr(row, 'r') ? +attr(row, 'r') - 1 : ri;
      rows[r] = { h: attr(row, 'ht') ? parseFloat(attr(row, 'ht')) : null, hidden: attr(row, 'hidden') === '1' || attr(row, 'hidden') === 'true', s: attr(row, 'customFormat') === '1' ? attr(row, 's') : null };
      let ci = -1;
      kids(row, 'c').forEach(c => {
        const ref = decodeRef(attr(c, 'r')); const col = ref ? ref.c : ci + 1; ci = col;
        const t = attr(c, 't') || 'n', v = kid(c, 'v'), fEl = kid(c, 'f'), s = +(attr(c, 's') || 0);
        let val = v ? v.textContent : null, type = t;
        if (t === 's') { val = shared[+val] ?? ''; type = 's'; }
        else if (t === 'inlineStr') { val = all(c, 't').map(x => x.textContent).join(''); type = 's'; }
        else if (t === 'str') type = 's';
        else if (t === 'b') val = val === '1';
        else if (t === 'e') type = 'e';
        else if (val !== null && val !== '') { val = +val; type = 'n'; }
        let formula = null;
        if (fEl){
          const si = attr(fEl, 'si');
          if (fEl.textContent) { formula = fEl.textContent; if (si != null) sharedF[si] = { f: formula, r, c: col }; }
          else if (si != null && sharedF[si]) formula = shiftFormula(sharedF[si].f, r - sharedF[si].r, col - sharedF[si].c);
        }
        if (val === null && !formula && !s) return;
        cells.set(r + ':' + col, { v: val, t: type, s, f: formula });
        if (val !== null || formula) { maxR = Math.max(maxR, r); maxC = Math.max(maxC, col); }
      });
    });
    const merges = all(doc, 'mergeCell').map(m => decodeRange(attr(m, 'ref'))).filter(Boolean);
    merges.forEach(m => { maxR = Math.max(maxR, m.e.r); maxC = Math.max(maxC, m.e.c); });
    const links = {};
    all(doc, 'hyperlink').forEach(h => {
      const rg = decodeRange(attr(h, 'ref')); if (!rg) return;
      const target = srels[relId(h)] || (attr(h, 'location') ? null : null);
      if (target && /^(https?:|mailto:)/i.test(target)) for (let r = rg.s.r; r <= rg.e.r; r++) for (let c = rg.s.c; c <= rg.e.c; c++) links[r + ':' + c] = target;
    });
    const pane = first(doc, 'pane');
    const frozen = pane && /frozen/i.test(attr(pane, 'state') || '') ? { rows: +(attr(pane, 'ySplit') || 0), cols: +(attr(pane, 'xSplit') || 0) } : { rows: 0, cols: 0 };
    const view = first(doc, 'sheetView');
    const gridlines = attr(view, 'showGridLines') !== '0';
    const zoom = attr(view, 'zoomScale') ? +attr(view, 'zoomScale') : 100;
    return { name, hidden, cells, cols, rows, merges, links, frozen, gridlines, zoom, defW, defH, maxR, maxC, style, date1904 };
  }

  function readCsvSheet(text){
    const rowsA = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      if (q){ if (ch === '"'){ if (text[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ','){ row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rowsA.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length){ row.push(cell); rowsA.push(row); }
    const cells = new Map(); let maxR = -1, maxC = -1;
    rowsA.forEach((r, ri) => r.forEach((c, ci) => {
      if (c === '') return;
      const num = c.trim() !== '' && !isNaN(c);
      cells.set(ri + ':' + ci, { v: num ? +c : c, t: num ? 'n' : 's', s: 0, f: null });
      maxR = Math.max(maxR, ri); maxC = Math.max(maxC, ci);
    }));
    const style = { numFmts: {}, fonts: [{ sz: 11 }], fills: [null], borders: [{}], xfs: [{ numFmt: '0', font: 0, fill: 0, border: 0 }] };
    return { sheets: [{ name: 'Sheet1', hidden: false, cells, cols: [], rows: [], merges: [], links: {}, frozen: { rows: 0, cols: 0 }, gridlines: true, zoom: 100, defW: 8.43, defH: 15, maxR, maxC, style, date1904: false }] };
  }

  /* ---------------- display value of a cell ---------------- */
  function display(sh, cell){
    if (!cell || cell.v === null || cell.v === undefined) return { text: '' };
    if (cell.t === 'b') return { text: cell.v ? 'TRUE' : 'FALSE', align: 'center' };
    if (cell.t === 'e') return { text: String(cell.v), align: 'center' };
    if (cell.t === 'n'){
      const xf = sh.style.xfs[cell.s] || {}; const id = xf.numFmt || '0';
      const code = sh.style.numFmts[id] ?? BUILTIN[id] ?? 'General';
      const r = formatNumber(cell.v, code, sh.date1904);
      return typeof r === 'string' ? { text: r, align: 'right' } : { text: r.text, color: r.color, align: 'right' };
    }
    return { text: String(cell.v), align: 'left' };
  }
  const colPx = (sh, c) => { const col = sh.cols[c]; const w = col && col.w != null ? col.w : sh.defW; return Math.max(8, Math.round(w * 7 + 5)); };
  const rowPx = (sh, r) => { const row = sh.rows[r]; return Math.round(((row && row.h != null) ? row.h : sh.defH) * 4 / 3); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- styles for the viewer (injected once) ---------------- */
  const CSS = `
.xv{--xg:#217346;width:100%;display:flex;flex-direction:column;border:1px solid #c8c8c8;background:#fff;color:#000;font:13px/1.2 Calibri,Carlito,"Segoe UI",Arial,sans-serif;margin:14px 0 6px;max-width:100%;min-width:0}
.xv *{box-sizing:border-box}
.xv-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--xg);color:#fff;padding:6px 10px}
.xv-file{font-weight:600;font-size:13px;margin-right:auto;display:flex;align-items:center;gap:8px;min-width:0}
.xv-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xv-file b{background:#fff;color:var(--xg);font:700 11px Arial,sans-serif;padding:2px 5px;border-radius:2px}
.xv-top button,.xv-top a{font:12px "Segoe UI",Arial,sans-serif;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.35);border-radius:3px;padding:4px 9px;cursor:pointer;text-decoration:none;line-height:1.2}
.xv-top button:hover,.xv-top a:hover{background:rgba(255,255,255,.25)}
.xv-find{display:flex;align-items:center;gap:4px}
.xv-find input{font:12px "Segoe UI",Arial,sans-serif;width:150px;max-width:40vw;padding:4px 7px;border:1px solid rgba(255,255,255,.5);border-radius:3px;background:#fff;color:#000}
.xv-find small{font-size:11px;opacity:.85;min-width:42px}
.xv-fx{display:flex;align-items:stretch;border-bottom:1px solid #d4d4d4;background:#fff;font:12px "Segoe UI",Arial,sans-serif}
.xv-name{width:84px;flex:none;padding:5px 8px;border-right:1px solid #d4d4d4;color:#222}
.xv-fxi{flex:none;padding:5px 9px;color:#666;font-style:italic;border-right:1px solid #e3e3e3;font-family:"Cambria Math",Georgia,serif}
.xv-val{flex:1;min-width:0;padding:5px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:Consolas,Menlo,monospace;color:#222}
.xv .xv-grid{position:relative;overflow:auto;max-height:560px;outline:none;background:#fff}
.xv .xv-grid table{display:table;border-collapse:separate;border-spacing:0;table-layout:fixed;width:max-content;margin:0;font-size:13px;overflow:visible}
.xv .xv-grid th{position:sticky;border-left:0;border-top:0;background:#f3f3f3;color:#444;font:11px "Segoe UI",Arial,sans-serif;font-weight:normal;border-right:1px solid #d4d4d4;border-bottom:1px solid #d4d4d4;text-align:center;z-index:2;padding:0;user-select:none}
.xv .xv-grid thead th{top:0;height:21px}
.xv .xv-grid tbody th{left:0;width:46px;min-width:46px;z-index:2}
.xv .xv-grid thead th.xv-corner{left:0;z-index:4;background:#e9e9e9}
.xv .xv-grid th.on{background:#d3e8dc;color:var(--xg);font-weight:600;border-bottom-color:var(--xg)}
.xv .xv-grid tbody th.on{border-right:2px solid var(--xg)}
.xv .xv-grid td{border-left:0;border-top:0;padding:0 4px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:clip;vertical-align:bottom;border-right:1px solid transparent;border-bottom:1px solid transparent;cursor:cell;position:relative;background-clip:padding-box}
.xv.grid .xv-grid td{border-right-color:#e1e1e1;border-bottom-color:#e1e1e1}
.xv .xv-grid td.wrap{white-space:pre-wrap;word-break:break-word}
.xv .xv-grid td a{color:#0563c1;text-decoration:underline}
.xv .xv-grid td.sel{background-image:linear-gradient(rgba(33,115,70,.13),rgba(33,115,70,.13))}
.xv .xv-grid td.act{outline:2px solid var(--xg);outline-offset:-2px;z-index:1}
.xv .xv-grid td.hit{background-image:linear-gradient(rgba(255,214,0,.45),rgba(255,214,0,.45))}
.xv .xv-grid td.fz,.xv .xv-grid th.fz{position:sticky;z-index:1}
.xv-tabs{display:flex;align-items:stretch;gap:0;border-top:1px solid #d4d4d4;background:#f3f3f3;overflow-x:auto;font:12px "Segoe UI",Arial,sans-serif}
.xv-tabs button{border:0;border-right:1px solid #d4d4d4;background:transparent;padding:6px 16px;cursor:pointer;color:#333;white-space:nowrap;font:inherit}
.xv-tabs button:hover{background:#e8e8e8}
.xv-tabs button[aria-selected=true]{background:#fff;color:var(--xg);font-weight:600;box-shadow:inset 0 -3px 0 var(--xg)}
.xv-status{display:flex;align-items:center;gap:16px;background:var(--xg);color:#fff;padding:3px 10px;font:11.5px "Segoe UI",Arial,sans-serif;flex-wrap:wrap}
.xv-status .sp{flex:1}
.xv-status input[type=range]{width:110px;accent-color:#fff;vertical-align:middle}
.xv-status button{background:none;border:0;color:#fff;font:13px Arial,sans-serif;cursor:pointer;padding:0 4px}
.xv-note{padding:6px 10px;font:12px "Segoe UI",Arial,sans-serif;color:#7a5b00;background:#fff8dc;border-top:1px solid #eadb9a}
.xv-msg{padding:28px 14px;text-align:center;color:#666;font:13px "Segoe UI",Arial,sans-serif}
.xv:fullscreen{margin:0;width:100vw;height:100vh;border:0}
.xv:fullscreen .xv-grid{max-height:none;flex:1}
.xv.max{position:fixed;inset:0;z-index:1000;margin:0;border:0}
.xv.max .xv-grid{max-height:none;flex:1}
@media (max-width:600px){ .xv-find input{width:110px} .xv-status .agg{display:none} }
`;
  function injectCss(){ if (document.getElementById('xv-css')) return; const s = document.createElement('style'); s.id = 'xv-css'; s.textContent = CSS; document.head.append(s); }

  const MAX_ROWS = 3000, MAX_COLS = 120;

  /* ---------------- the viewer ---------------- */
  async function mount(box, url, name){
    injectCss();
    box.className = 'xv grid';
    box.innerHTML = `<div class="xv-top"><div class="xv-file"><b>XLSX</b><span></span></div>
      <label class="xv-find"><input type="search" placeholder="Find in sheet\u2026" aria-label="Find in sheet"><small></small></label>
      <button type="button" class="xv-full" title="Full screen">\u26F6 Full screen</button>
      <a class="xv-dl" download>\u2B07 Download</a></div>
      <div class="xv-fx"><div class="xv-name">A1</div><div class="xv-fxi">fx</div><div class="xv-val"></div></div>
      <div class="xv-grid" tabindex="0" aria-label="Spreadsheet (read-only)"><div class="xv-msg">Loading spreadsheet\u2026</div></div>
      <div class="xv-tabs" role="tablist"></div>
      <div class="xv-status"><span>Read-only</span><span class="agg"></span><span class="sp"></span>
        <button type="button" class="zo" title="Zoom out">\u2212</button><input type="range" min="50" max="200" step="10" value="100" aria-label="Zoom"><button type="button" class="zi" title="Zoom in">+</button><span class="zv">100%</span></div>`;
    const $ = s => box.querySelector(s);
    $('.xv-file span').textContent = name; $('.xv-dl').href = url; $('.xv-dl').setAttribute('download', name);
    $('.xv-file b').textContent = /\.csv$/i.test(name) ? 'CSV' : 'XLSX';

    let wb;
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('missing');
      wb = /\.csv$/i.test(name) ? readCsvSheet(await r.text()) : await readWorkbook(await r.arrayBuffer());
      if (!wb.sheets.length) throw new Error('empty');
    } catch (e){
      $('.xv-grid').innerHTML = `<div class="xv-msg">${e.message === 'missing' ? 'N/A' : 'This spreadsheet could not be opened here. Use Download to open it in Excel.'}</div>`;
      $('.xv-fx').hidden = true; $('.xv-tabs').hidden = true; $('.xv-status').hidden = true; $('.xv-find').hidden = true;
      if (e.message === 'missing') $('.xv-dl').hidden = true;
      return;
    }

    const grid = $('.xv-grid'), tabs = $('.xv-tabs');
    const visible = wb.sheets.filter(s => !s.hidden);
    let sh = null, tds = [], anchor = null, focus = null, hits = [], hitAt = -1, zoom = 100;

    visible.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.role = 'tab'; b.textContent = s.name;
      b.onclick = () => show(i); tabs.append(b);
    });
    if (visible.length < 2) tabs.hidden = visible.length === 0;

    function show(i){
      sh = visible[i];
      [...tabs.children].forEach((b, k) => b.setAttribute('aria-selected', k === i));
      box.classList.toggle('grid', sh.gridlines);
      render(); setZoom(sh.zoom || 100);
      select({ r: 0, c: 0 }, { r: 0, c: 0 });
      runFind();
    }

    function render(){
      const lastR = Math.min(Math.max(sh.maxR + 1 + 15, 30), MAX_ROWS) - 1;
      const lastC = Math.min(Math.max(sh.maxC + 1 + 3, 12), MAX_COLS) - 1;
      const covered = new Map(), spans = new Map();
      sh.merges.forEach(m => {
        spans.set(m.s.r + ':' + m.s.c, { rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 });
        for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.set(r + ':' + c, m.s.r + ':' + m.s.c);
      });
      const colsShown = []; for (let c = 0; c <= lastC; c++) if (!(sh.cols[c] && sh.cols[c].hidden)) colsShown.push(c);
      let html = '<table><colgroup><col style="width:46px">';
      colsShown.forEach(c => html += `<col style="width:${colPx(sh, c)}px">`);
      html += '</colgroup><thead><tr><th class="xv-corner"></th>';
      colsShown.forEach(c => html += `<th data-c="${c}">${colName(c)}</th>`);
      html += '</tr></thead><tbody>';
      for (let r = 0; r <= lastR; r++){
        const rw = sh.rows[r]; if (rw && rw.hidden) continue;
        html += `<tr style="height:${rowPx(sh, r)}px"><th data-r="${r}">${r + 1}</th>`;
        for (const c of colsShown){
          const key = r + ':' + c;
          if (covered.has(key)) continue;
          const cell = sh.cells.get(key);
          const xfIdx = cell ? cell.s : (rw && rw.s != null ? +rw.s : (sh.cols[c] && sh.cols[c].s != null ? +sh.cols[c].s : 0));
          const xf = sh.style.xfs[xfIdx] || {}, font = sh.style.fonts[xf.font] || {}, fill = sh.style.fills[xf.fill], bd = sh.style.borders[xf.border] || {};
          const d = display(sh, cell);
          let css = '';
          if (fill) css += `background-color:${fill};`;
          if (font.b) css += 'font-weight:bold;'; if (font.i) css += 'font-style:italic;';
          if (font.u || font.s) css += `text-decoration:${font.u ? 'underline' : ''} ${font.s ? 'line-through' : ''};`;
          if (font.sz && font.sz !== 11) css += `font-size:${(font.sz * 13 / 11).toFixed(1)}px;`;
          const fc = d.color || font.color; if (fc && fc.toUpperCase() !== '#000000') css += `color:${fc};`;
          if (font.name && !/^calibri$/i.test(font.name)) css += `font-family:'${font.name.replace(/['"<>&]/g, '')}',Calibri,Carlito,Arial,sans-serif;`;
          const h = xf.h && xf.h !== 'general' ? (xf.h === 'centerContinuous' ? 'center' : xf.h === 'distributed' ? 'justify' : xf.h === 'fill' ? 'left' : xf.h) : d.align;
          if (h && h !== 'left') css += `text-align:${h};`;
          if (xf.v) css += `vertical-align:${xf.v === 'center' ? 'middle' : xf.v === 'top' ? 'top' : 'bottom'};`;
          if (xf.indent) css += `padding-left:${4 + xf.indent * 9}px;`;
          if (bd.left) css += `border-left:${bd.left};`; if (bd.right) css += `border-right:${bd.right};`;
          if (bd.top) css += `border-top:${bd.top};`; if (bd.bottom) css += `border-bottom:${bd.bottom};`;
          const sp = spans.get(key);
          const link = sh.links[key];
          const txt = esc(d.text);
          const inner = link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${txt}</a>` : txt;
          html += `<td data-r="${r}" data-c="${c}"${sp ? ` rowspan="${sp.rs}" colspan="${sp.cs}"` : ''}${xf.wrap ? ' class="wrap"' : ''}${css ? ` style="${css}"` : ''}${d.text.length > 12 ? ` title="${txt}"` : ''}>${inner}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      const truncated = sh.maxR + 1 > MAX_ROWS || sh.maxC + 1 > MAX_COLS;
      grid.innerHTML = html;
      const old = box.querySelector('.xv-note'); if (old) old.remove();
      if (truncated){ const n = document.createElement('div'); n.className = 'xv-note'; n.textContent = `Showing the first ${MAX_ROWS} rows and ${MAX_COLS} columns. Download the file to see everything.`; grid.after(n); }
      // cell lookup (merged areas point at their top-left cell)
      tds = [];
      grid.querySelectorAll('td').forEach(td => { const r = +td.dataset.r, c = +td.dataset.c; (tds[r] = tds[r] || [])[c] = td; });
      covered.forEach((k, key) => { const [r, c] = key.split(':').map(Number), [ar, ac] = k.split(':').map(Number); if (tds[ar] && tds[ar][ac]) (tds[r] = tds[r] || [])[c] = tds[ar][ac]; });
      sh._lastR = lastR; sh._lastC = lastC; sh._colsShown = colsShown;
      freeze();
    }

    function freeze(){
      const { rows: fr, cols: fc } = sh.frozen; if (!fr && !fc) return;
      const head = grid.querySelector('thead th'); const top0 = head ? head.offsetHeight : 21;
      let top = top0;
      for (let r = 0; r < fr; r++){
        const tr = grid.querySelector(`tbody th[data-r="${r}"]`); if (!tr) continue;
        const row = tr.parentElement; [...row.children].forEach(cell => { cell.classList.add('fz'); cell.style.top = top + 'px'; if (!cell.style.backgroundColor && cell.tagName === 'TD') cell.style.backgroundColor = '#fff'; cell.style.zIndex = cell.tagName === 'TH' ? 3 : 1; });
        top += row.offsetHeight;
      }
      if (fc){
        let left = 46;
        for (const c of sh._colsShown){ if (c >= fc) break;
          grid.querySelectorAll(`[data-c="${c}"]`).forEach(cell => { cell.classList.add('fz'); cell.style.left = left + 'px'; if (cell.tagName === 'TD' && !cell.style.backgroundColor) cell.style.backgroundColor = '#fff'; if (cell.tagName === 'TH') cell.style.zIndex = 3; });
          left += colPx(sh, c);
        }
      }
    }

    /* selection */
    function select(a, f){
      anchor = a; focus = f;
      grid.querySelectorAll('.sel,.act').forEach(e => e.classList.remove('sel', 'act'));
      grid.querySelectorAll('th.on').forEach(e => e.classList.remove('on'));
      const r0 = Math.min(a.r, f.r), r1 = Math.max(a.r, f.r), c0 = Math.min(a.c, f.c), c1 = Math.max(a.c, f.c);
      let sum = 0, cnt = 0, nums = 0;
      const seen = new Set();
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++){
        const td = tds[r] && tds[r][c]; if (!td || seen.has(td)) continue; seen.add(td);
        if (r1 > r0 || c1 > c0) td.classList.add('sel');
        const cell = sh.cells.get(td.dataset.r + ':' + td.dataset.c);
        if (cell && cell.v !== null && cell.v !== '') { cnt++; if (cell.t === 'n'){ sum += cell.v; nums++; } }
      }
      for (let c = c0; c <= c1; c++){ const th = grid.querySelector(`thead th[data-c="${c}"]`); if (th) th.classList.add('on'); }
      for (let r = r0; r <= r1; r++){ const th = grid.querySelector(`tbody th[data-r="${r}"]`); if (th) th.classList.add('on'); }
      const act = tds[f.r] && tds[f.r][f.c]; if (act) act.classList.add('act');
      // formula bar
      const ar = act ? +act.dataset.r : f.r, ac = act ? +act.dataset.c : f.c;
      const cell = sh.cells.get(ar + ':' + ac);
      $('.xv-name').textContent = (r1 > r0 || c1 > c0) ? `${encode(r0, c0)}:${encode(r1, c1)}` : encode(ar, ac);
      $('.xv-val').textContent = cell ? (cell.f ? '=' + cell.f : cell.t === 'b' ? (cell.v ? 'TRUE' : 'FALSE') : cell.t === 'n' ? general(cell.v) : String(cell.v ?? '')) : '';
      $('.xv-val').title = $('.xv-val').textContent;
      const fmt = n => Math.abs(n) >= 1e15 ? n.toExponential(4) : (+n.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 8 });
      $('.xv-status .agg').textContent = (cnt > 1) ? (nums ? `Average: ${fmt(sum / nums)}    Count: ${cnt}    Sum: ${fmt(sum)}` : `Count: ${cnt}`) : '';
    }
    function scrollTo(r, c){
      const td = tds[r] && tds[r][c]; if (!td) return;
      const g = grid.getBoundingClientRect(), t = td.getBoundingClientRect(), z = zoom / 100;
      const headH = 22 * z, headW = 46 * z;
      if (t.top < g.top + headH) grid.scrollTop -= (g.top + headH - t.top);
      else if (t.bottom > g.bottom - 14) grid.scrollTop += t.bottom - g.bottom + 14;
      if (t.left < g.left + headW) grid.scrollLeft -= (g.left + headW - t.left);
      else if (t.right > g.right - 14) grid.scrollLeft += t.right - g.right + 14;
    }
    let dragging = false;
    grid.addEventListener('mousedown', e => {
      const td = e.target.closest('td'), th = e.target.closest('th');
      if (e.target.closest('a')) return;
      if (td){
        e.preventDefault(); grid.focus({ preventScroll: true });
        const p = { r: +td.dataset.r, c: +td.dataset.c };
        select(e.shiftKey && anchor ? anchor : p, p); dragging = true;
      } else if (th && th.dataset.c != null){
        e.preventDefault(); grid.focus({ preventScroll: true }); const c = +th.dataset.c; select({ r: 0, c }, { r: sh._lastR, c });
      } else if (th && th.dataset.r != null){
        e.preventDefault(); grid.focus({ preventScroll: true }); const r = +th.dataset.r; select({ r, c: 0 }, { r, c: sh._lastC });
      } else if (th && th.classList.contains('xv-corner')){
        e.preventDefault(); select({ r: 0, c: 0 }, { r: sh._lastR, c: sh._lastC });
      }
    });
    grid.addEventListener('mouseover', e => {
      if (!dragging) return; const td = e.target.closest('td'); if (!td) return;
      select(anchor, { r: +td.dataset.r, c: +td.dataset.c });
    });
    document.addEventListener('mouseup', () => dragging = false);
    grid.addEventListener('keydown', e => {
      if (!focus) return;
      const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [1, 0], Tab: [0, 1] }[e.key];
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'){ copySel(); e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'){ select({ r: 0, c: 0 }, { r: sh._lastR, c: sh._lastC }); e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'){ $('.xv-find input').focus(); e.preventDefault(); return; }
      if (e.key === 'Home'){ const p = { r: (e.ctrlKey || e.metaKey) ? 0 : focus.r, c: 0 }; select(p, p); scrollTo(p.r, p.c); e.preventDefault(); return; }
      if (!mv) return;
      e.preventDefault();
      let [dr, dc] = mv; if (e.shiftKey && (e.key === 'Enter' || e.key === 'Tab')){ dr = -dr; dc = -dc; }
      // skip over hidden rows/cols and merged areas
      const cur = tds[focus.r] && tds[focus.r][focus.c];
      let r = focus.r, c = focus.c;
      if (cur && dr > 0) r = +cur.dataset.r + (+cur.rowSpan || 1) - 1;
      if (cur && dc > 0) c = +cur.dataset.c + (+cur.colSpan || 1) - 1;
      do { r += dr; c += dc; } while (r >= 0 && c >= 0 && r <= sh._lastR && c <= sh._lastC && !(tds[r] && tds[r][c]));
      if (r < 0 || c < 0 || r > sh._lastR || c > sh._lastC) return;
      const p = { r, c };
      select(e.shiftKey && e.key.startsWith('Arrow') ? anchor : p, p); scrollTo(r, c);
    });
    function copySel(){
      if (!anchor) return;
      const r0 = Math.min(anchor.r, focus.r), r1 = Math.max(anchor.r, focus.r), c0 = Math.min(anchor.c, focus.c), c1 = Math.max(anchor.c, focus.c);
      const lines = [];
      for (let r = r0; r <= r1; r++){ const row = []; for (let c = c0; c <= c1; c++) row.push(display(sh, sh.cells.get(r + ':' + c)).text); lines.push(row.join('\t')); }
      const txt = lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).catch(() => {
        const ta = document.createElement('textarea'); ta.value = txt; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch (e){} ta.remove();
      });
      $('.xv-status span').textContent = 'Copied';
      setTimeout(() => $('.xv-status span').textContent = 'Read-only', 1200);
    }

    /* find */
    const findIn = $('.xv-find input'), findN = $('.xv-find small');
    function runFind(){
      grid.querySelectorAll('td.hit').forEach(e => e.classList.remove('hit'));
      hits = []; hitAt = -1; const q = findIn.value.trim().toLowerCase();
      if (!q){ findN.textContent = ''; return; }
      grid.querySelectorAll('td').forEach(td => { if (td.textContent.toLowerCase().includes(q)){ td.classList.add('hit'); hits.push(td); } });
      findN.textContent = hits.length ? `0 of ${hits.length}` : 'No match';
    }
    findIn.addEventListener('input', runFind);
    findIn.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !hits.length) return;
      e.preventDefault(); hitAt = (hitAt + (e.shiftKey ? -1 : 1) + hits.length) % hits.length;
      const td = hits[hitAt], p = { r: +td.dataset.r, c: +td.dataset.c };
      select(p, p); scrollTo(p.r, p.c); findN.textContent = `${hitAt + 1} of ${hits.length}`;
    });

    /* zoom */
    const range = $('.xv-status input');
    function setZoom(z){
      zoom = Math.max(50, Math.min(200, z)); range.value = zoom; $('.zv').textContent = zoom + '%';
      const t = grid.querySelector('table'); if (t) t.style.zoom = zoom / 100;
    }
    range.addEventListener('input', () => setZoom(+range.value));
    $('.zo').onclick = () => setZoom(zoom - 10); $('.zi').onclick = () => setZoom(zoom + 10);
    grid.addEventListener('wheel', e => { if (e.ctrlKey){ e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? 10 : -10)); } }, { passive: false });

    /* full screen (falls back to filling the window) */
    const fullBtn = $('.xv-full');
    fullBtn.onclick = async () => {
      if (document.fullscreenElement === box){ await document.exitFullscreen(); return; }
      if (box.classList.contains('max')){ box.classList.remove('max'); fullBtn.textContent = '\u26F6 Full screen'; return; }
      try { await box.requestFullscreen(); }
      catch (e){ box.classList.add('max'); fullBtn.textContent = '\u2715 Exit full screen'; }
    };
    document.addEventListener('fullscreenchange', () => { fullBtn.textContent = document.fullscreenElement === box ? '\u2715 Exit full screen' : '\u26F6 Full screen'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('max')){ box.classList.remove('max'); fullBtn.textContent = '\u26F6 Full screen'; } });

    show(0);
  }

  window.SheetViewer = { mount, readWorkbook, formatNumber };
})();
