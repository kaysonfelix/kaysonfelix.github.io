/* Shared helpers: load Markdown files from the projects folder and turn them into HTML.
   You shouldn't need to edit this file. */
window.Site = (() => {
  async function load(path){
    try {
      const r = await fetch(path, { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.text();
    } catch { return null; }
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* small Markdown renderer, used only if the marked library fails to load */
  function mini(src){
    const inline = t => esc(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const out = []; let list = null, para = [], code = null;
    const flush = () => { if (para.length){ out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (list){ out.push(`</${list}>`); list = null; } };
    for (const line of src.replace(/<!--[\s\S]*?-->/g, '').split('\n')){
      if (code !== null){ if (/^```/.test(line)){ out.push('<pre><code>' + esc(code) + '</code></pre>'); code = null; } else code += line + '\n'; continue; }
      if (/^```/.test(line)){ flush(); code = ''; continue; }
      let m;
      if (!line.trim()){ flush(); continue; }
      if ((m = line.match(/^(#{1,6})\s+(.*)/))){ flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
      if ((m = line.match(/^\s*([-*]|\d+\.)\s+(.*)/))){
        const t = /\d/.test(m[1]) ? 'ol' : 'ul';
        if (para.length){ out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
        if (list !== t){ if (list) out.push(`</${list}>`); out.push(`<${t}>`); list = t; }
        out.push('<li>' + inline(m[2]) + '</li>'); continue;
      }
      if (list){ out.push(`</${list}>`); list = null; }
      para.push(line.trim());
    }
    flush();
    return out.join('\n');
  }

  /* Markdown -> HTML; relative image/link paths are resolved from the project folder */
  function render(src, base, el){
    const html = window.marked ? window.marked.parse(src) : mini(src);
    el.innerHTML = html;
    const rel = u => u && !/^([a-z]+:|\/|#)/i.test(u);
    el.querySelectorAll('img').forEach(img => {
      const s = img.getAttribute('src');
      if (rel(s)) img.src = base + s;
      img.loading = 'lazy';
      // an image on its own line becomes a figure, with its alt text as the caption
      const p = img.parentElement;
      if (p && p.tagName === 'P' && p.childNodes.length === 1){
        const fig = document.createElement('figure');
        fig.appendChild(img);
        if (img.alt){ const c = document.createElement('figcaption'); c.textContent = img.alt; fig.appendChild(c); }
        p.replaceWith(fig);
      }
    });
    el.querySelectorAll('a').forEach(a => {
      const h = a.getAttribute('href');
      if (rel(h)) a.href = base + h;
      if (/^https?:/i.test(a.getAttribute('href') || '')){ a.target = '_blank'; a.rel = 'noopener'; }
    });
    // a line like {{sheet: bom.xlsx}} becomes a table read from that spreadsheet (.xlsx or .csv)
    el.querySelectorAll('p').forEach(p => {
      const m = /^\{\{\s*sheet:\s*([^}\s]+)\s*\}\}$/.exec(p.textContent.trim());
      if (m) embedSheet(p, base + m[1], m[1]);
    });
  }

  /* ---------- spreadsheets: read .xlsx (or .csv) in the browser, no library needed ---------- */
  async function unzip(buf){
    const dv = new DataView(buf), u8 = new Uint8Array(buf), files = {};
    let e = buf.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not a zip');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const dec = new TextDecoder();
    for (let i = 0; i < n; i++){
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true), name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      files[name] = { method, csize, off };
      p += 46 + nl + xl + cl;
    }
    return async name => {
      const f = files[name]; if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const data = u8.subarray(start, start + f.csize);
      if (f.method === 0) return dec.decode(data);
      const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
      return await out.text();
    };
  }
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  async function readXlsx(buf){
    const get = await unzip(buf), xml = s => new DOMParser().parseFromString(s, 'application/xml');
    const shared = [];
    const ss = await get('xl/sharedStrings.xml');
    if (ss) xml(ss).querySelectorAll('si').forEach(si => shared.push([...si.querySelectorAll('t')].map(t => t.textContent).join('')));
    // first sheet listed in the workbook
    let path = 'xl/worksheets/sheet1.xml';
    try {
      const wb = xml(await get('xl/workbook.xml')), rels = xml(await get('xl/_rels/workbook.xml.rels'));
      const rid = wb.querySelector('sheet').getAttribute('r:id') || wb.querySelector('sheet').getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const t = [...rels.querySelectorAll('Relationship')].find(r => r.getAttribute('Id') === rid).getAttribute('Target');
      path = 'xl/' + t.replace(/^\/?(xl\/)?/, '');
    } catch (e) {}
    const sheet = xml(await get(path)), rows = [];
    sheet.querySelectorAll('sheetData > row').forEach(r => {
      const row = [];
      r.querySelectorAll('c').forEach(c => {
        const t = c.getAttribute('t'), v = c.querySelector('v');
        let val = v ? v.textContent : '';
        if (t === 's') val = shared[+val] ?? '';
        else if (t === 'inlineStr') val = [...c.querySelectorAll('is t')].map(x => x.textContent).join('');
        else if (t === 'b') val = val === '1' ? 'TRUE' : 'FALSE';
        else if (val !== '' && t !== 'str' && t !== 'e') val = +val;
        row[colIndex(c.getAttribute('r'))] = val;
      });
      rows.push(row);
    });
    return rows;
  }
  function readCsv(text){
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      if (q){ if (ch === '"'){ if (text[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ','){ row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => (c.trim() !== '' && !isNaN(c)) ? +c : c));
  }
  async function embedSheet(p, url, name){
    const box = document.createElement('div'); box.className = 'sheet';
    box.innerHTML = '<p class="empty">Loading spreadsheet…</p>';
    p.replaceWith(box);
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('missing');
      let rows = /\.csv$/i.test(name) ? readCsv(await r.text()) : await readXlsx(await r.arrayBuffer());
      rows = rows.map(r => Array.from(r || [], c => c ?? '')).filter(r => r.some(c => c !== ''));
      if (!rows.slice(1).some(r => !/^total/i.test(String(r[0] ?? '')))) throw new Error('empty');
      const width = Math.max(...rows.map(r => r.length));
      const head = rows[0], money = head.map(h => /cost|price|total|amount|\$|usd/i.test(String(h)));
      const fmt = (v, i) => typeof v === 'number'
        ? (money[i] ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 3 })))
        : String(v);
      const link = v => /^https?:\/\//i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])} ↗</a>` : esc(v);
      let html = '<div class="sheet-scroll"><table><thead><tr>';
      const numCol = [...Array(width)].map((_, i) => rows.slice(1).some(r => typeof r[i] === 'number'));
      for (let i = 0; i < width; i++) html += `<th${numCol[i] ? ' class="num"' : ''}>${esc(String(head[i] ?? ''))}</th>`;
      html += '</tr></thead><tbody>';
      rows.slice(1).forEach(r => {
        const total = /^total/i.test(String(r[0] ?? ''));
        html += `<tr${total ? ' class="total"' : ''}>`;
        for (let i = 0; i < width; i++){
          const v = r[i] ?? '';
          html += `<td${typeof v === 'number' ? ' class="num"' : ''}>${typeof v === 'number' ? fmt(v, i) : link(String(v))}</td>`;
        }
        html += '</tr>';
      });
      html += `</tbody></table></div><a class="sheet-dl" href="${esc(url)}" download>Download ${esc(name)}</a>`;
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<p class="empty">N/A</p>';
    }
  }

  /* log.md is split into entries at each line starting with "## "
     header format: ## YYYY-MM-DD | Title | Author (author optional) */
  function parseLog(src){
    const clean = src.replace(/<!--[\s\S]*?-->/g, '');
    const parts = clean.split(/^##\s+/m).slice(1);
    return parts.map(p => {
      const nl = p.indexOf('\n');
      const head = (nl < 0 ? p : p.slice(0, nl)).trim();
      const body = nl < 0 ? '' : p.slice(nl + 1).trim();
      const parts = head.split('|').map(x => x.trim());
      if (parts.length < 2) return { date: '', title: head, body, author: '' };
      return { date: parts[0], title: parts[1], author: parts.slice(2).join(' / '), body };
    });
  }

  function fmtDate(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return s || '';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* collaborator profile pictures (set in admin.html → Homepage → Profile picture) */
  let peopleP = null;
  function people(){
    if (!peopleP) peopleP = fetch('featured.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => j.people || {}).catch(() => ({}));
    return peopleP;
  }
  function avatar(name, map){
    const p = (map || {})[String(name || '').trim().toLowerCase()];
    const el = document.createElement('span'); el.className = 'avatar'; el.title = name || '';
    if (p && typeof p.photo === 'string' && /^media\/people\/[\w.-]+$/.test(p.photo)){
      const img = document.createElement('img'); img.src = p.photo; img.alt = ''; el.append(img);
    } else {
      el.textContent = String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }
    return el;
  }

  /* projects list (edited in admin.html → Projects; saved to projects.json).
     Until projects.json exists, this default is shown. */
  const defaultProjects = [{
    id: 'project-1',
    title: 'PAT Laser Tracking System',
    status: 'In progress',
    tags: 'beam steering, beacon tracking, closed-loop control, free-space optics',
    summary: 'A bench-scale pointing, acquisition and tracking (PAT) system that locks a laser onto a moving light beacon with closed-loop control, modeled on the terminals used in satellite laser links.',
    thumb: ''
  }];
  async function projects(){
    try {
      const r = await fetch('projects.json', { cache: 'no-cache' });
      if (r.ok){ const j = await r.json(); if (Array.isArray(j.projects)) return j.projects.filter(p => p && /^[a-z0-9_-]+$/i.test(p.id)); }
    } catch (e) {}
    return defaultProjects.map(p => ({ ...p }));
  }

  return { load, render, parseLog, fmtDate, esc, people, avatar, projects, defaultProjects };
})();
