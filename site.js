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
  }

  /* log.md is split into entries at each line starting with "## " */
  function parseLog(src){
    const clean = src.replace(/<!--[\s\S]*?-->/g, '');
    const parts = clean.split(/^##\s+/m).slice(1);
    return parts.map(p => {
      const nl = p.indexOf('\n');
      const head = (nl < 0 ? p : p.slice(0, nl)).trim();
      const body = nl < 0 ? '' : p.slice(nl + 1).trim();
      const [date, ...rest] = head.split('|');
      const title = rest.join('|').trim();
      return title ? { date: date.trim(), title, body } : { date: '', title: head, body };
    });
  }

  function fmtDate(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return s || '';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return { load, render, parseLog, fmtDate, esc };
})();
