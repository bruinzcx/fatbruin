// 极简 Markdown 渲染:## 小标题 / > 引用 / - 列表 / ``` 代码 / 段落 / **粗体** `行内码` [链接](url)
(function(){
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  window.mdToHtml = function(src){
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    let out = '', list = null, code = null, para = [];
    const flushP = () => { if (para.length){ out += '<p>' + inline(para.join('')) + '</p>'; para = []; } };
    const flushL = () => { if (list){ out += '<ul>' + list.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'; list = null; } };
    for (const ln of lines){
      if (/^```/.test(ln)){
        if (code === null){ flushP(); flushL(); code = []; }
        else { out += '<pre>' + esc(code.join('\n')) + '</pre>'; code = null; }
        continue;
      }
      if (code !== null){ code.push(ln); continue; }
      if (!ln.trim()){ flushP(); flushL(); continue; }
      const h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h){ flushP(); flushL(); out += '<h2>' + inline(h[2]) + '</h2>'; continue; }
      const q = ln.match(/^>\s?(.*)$/);
      if (q){ flushP(); flushL(); out += '<blockquote>' + inline(q[1]) + '</blockquote>'; continue; }
      const li = ln.match(/^[-*]\s+(.*)$/);
      if (li){ flushP(); (list = list || []).push(li[1]); continue; }
      flushL(); para.push(ln);
    }
    if (code !== null) out += '<pre>' + esc(code.join('\n')) + '</pre>';
    flushP(); flushL();
    return out;
  };
})();
