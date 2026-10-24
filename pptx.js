// Leitor de apresentações do PowerPoint (.pptx), feito à mão e sem biblioteca:
// abre o arquivo (que é um .zip de XMLs) com o descompactador do próprio navegador e desenha cada slide num canvas.
// Entende: fundo (cor, degradê, imagem), caixas de texto com fontes/cores/tamanhos/negrito/itálico/marcadores,
// formas simples (retângulo, arredondado, elipse, linha), imagens, grupos, tabelas e as anotações do apresentador.
// Não entende: gráficos, SmartArt, animações e efeitos (para ficar idêntico, salve a apresentação como PDF).

// ---------- .zip ----------
async function abrirZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer);
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('zip');
  const n = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true);
  const entradas = new Map(), dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    entradas.set(dec.decode(buf.subarray(p + 46, p + 46 + ln)), { metodo, tam, off }); p += 46 + ln + le + lc;
  }
  const cache = new Map();
  async function bytes(nome) {
    const e = entradas.get(nome); if (!e) return null;
    if (cache.has(nome)) return cache.get(nome);
    const ini = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true), dados = buf.subarray(ini, ini + e.tam);
    let r;
    if (e.metodo === 0) r = dados;
    else if (e.metodo === 8) r = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error('compressão');
    cache.set(nome, r); return r;
  }
  return { tem: (n) => entradas.has(n), bytes, texto: async (n) => { const b = await bytes(n); return b ? dec.decode(b) : null; } };
}

// ---------- XML ----------
const kids = (el, nome) => (el ? [...el.children].filter((c) => c.localName === nome) : []);
const kid = (el, nome) => (el ? [...el.children].find((c) => c.localName === nome) || null : null);
const caminho = (el, ...nomes) => { for (const n of nomes) el = kid(el, n); return el; };
const desc = (el, nome) => (el ? el.getElementsByTagNameNS('*', nome)[0] || null : null);
const num = (v, p = 0) => (v == null || v === '' ? p : +v);
const resolver = (base, alvo) => {
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partes = base.split('/'); partes.pop();
  for (const s of alvo.split('/')) { if (s === '..') partes.pop(); else if (s && s !== '.') partes.push(s); }
  return partes.join('/');
};

// ---------- cores ----------
function hexRgb(h) { h = (h || '000000').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; let h = 0, s = 0;
  if (M !== m) { const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m); h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hslRgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
const PRESET = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080' };

// ---------- abrir a apresentação ----------
export async function abrirPptx(blob) {
  const zip = await abrirZip(blob), parser = new DOMParser();
  const xmlCache = new Map();
  async function xml(n) { if (!xmlCache.has(n)) { const t = await zip.texto(n); xmlCache.set(n, t ? parser.parseFromString(t, 'application/xml').documentElement : null); } return xmlCache.get(n); }
  async function rels(n) {
    const partes = n.split('/'), arq = partes.pop(), r = await xml([...partes, '_rels', arq + '.rels'].join('/')), m = new Map();
    for (const x of kids(r, 'Relationship')) m.set(x.getAttribute('Id'), { alvo: x.getAttribute('TargetMode') === 'External' ? null : resolver(n, x.getAttribute('Target')), tipo: (x.getAttribute('Type') || '').split('/').pop() });
    return m;
  }
  const porTipo = (rs, t) => [...rs.values()].find((r) => r.tipo === t)?.alvo;
  const pres = await xml('ppt/presentation.xml'); if (!pres) throw new Error('pptx');
  const tam = kid(pres, 'sldSz'), CX = num(tam?.getAttribute('cx'), 12192000), CY = num(tam?.getAttribute('cy'), 6858000);
  const presRels = await rels('ppt/presentation.xml');
  const slides = kids(kid(pres, 'sldIdLst'), 'sldId').map((s) => presRels.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id'))?.alvo).filter(Boolean);
  const imagens = new Map();
  async function imagem(n) {
    if (!imagens.has(n)) imagens.set(n, (async () => { const b = await zip.bytes(n); if (!b || /\.(emf|wmf|tiff?)$/i.test(n)) return null; try { return await createImageBitmap(new Blob([b])); } catch { return null; } })());
    return imagens.get(n);
  }

  // ---------- contexto de um slide: slide -> layout -> mestre -> tema ----------
  async function contexto(i) {
    const nS = slides[i], sRels = await rels(nS), nL = porTipo(sRels, 'slideLayout'), lRels = nL ? await rels(nL) : new Map(), nM = porTipo(lRels, 'slideMaster');
    const mRels = nM ? await rels(nM) : new Map(), nT = porTipo(mRels, 'theme'), tema = nT ? await xml(nT) : null, mestre = nM ? await xml(nM) : null;
    const esquema = {}; for (const c of [...(caminho(tema, 'themeElements', 'clrScheme')?.children || [])]) { const v = c.firstElementChild; esquema[c.localName] = v?.getAttribute('lastClr') || v?.getAttribute('val') || '000000'; }
    const mapa = {}; const cm = kid(mestre, 'clrMap'); if (cm) for (const a of cm.attributes) mapa[a.name] = a.value;
    const fontes = caminho(tema, 'themeElements', 'fontScheme');
    const fonteMaior = desc(kid(fontes, 'majorFont'), 'latin')?.getAttribute('typeface') || 'Calibri Light', fonteMenor = desc(kid(fontes, 'minorFont'), 'latin')?.getAttribute('typeface') || 'Calibri';
    const nN = porTipo(sRels, 'notesSlide');
    return { slide: await xml(nS), layout: nL ? await xml(nL) : null, mestre, sRels, lRels, mRels, nS, nL, nM, esquema, mapa, fonteMaior, fonteMenor, nN };
  }
  function corDe(el, ctx, fallback = null) {
    if (!el) return fallback;
    const c = [...el.children].find((x) => /Clr$/.test(x.localName)); if (!c) return fallback;
    let hex;
    if (c.localName === 'srgbClr') hex = c.getAttribute('val');
    else if (c.localName === 'schemeClr') { let v = c.getAttribute('val'); if (v === 'phClr') v = ctx.phClr || 'tx1'; v = ctx.mapa[v] || v; hex = ctx.esquema[v] || ({ bg1: 'FFFFFF', tx1: '000000' })[v] || '000000'; }
    else if (c.localName === 'sysClr') hex = c.getAttribute('lastClr') || (c.getAttribute('val') === 'window' ? 'FFFFFF' : '000000');
    else if (c.localName === 'prstClr') hex = PRESET[c.getAttribute('val')] || '000000';
    else if (c.localName === 'scrgbClr') hex = [c.getAttribute('r'), c.getAttribute('g'), c.getAttribute('b')].map((v) => Math.round(num(v) / 100000 * 255).toString(16).padStart(2, '0')).join('');
    let rgb = hexRgb(hex), alfa = 1;
    for (const m of c.children) {
      const v = num(m.getAttribute('val')) / 100000;
      if (m.localName === 'alpha') alfa = v;
      else if (m.localName === 'lumMod' || m.localName === 'lumOff') { const h = rgbHsl(rgb); h[2] = m.localName === 'lumMod' ? h[2] * v : Math.min(1, h[2] + v); rgb = hslRgb(h); }
      else if (m.localName === 'tint') rgb = rgb.map((x) => x + (255 - x) * (1 - v));
      else if (m.localName === 'shade') rgb = rgb.map((x) => x * v);
    }
    return `rgba(${rgb.map((x) => Math.round(Math.max(0, Math.min(255, x)))).join(',')},${alfa})`;
  }
  function corEsquema(ctx, v) { v = ctx.mapa[v] || v; const h = hexRgb(ctx.esquema[v] || (v === 'lt1' ? 'FFFFFF' : '000000')); return `rgb(${h.join(',')})`; }
  // preenchimento: devolve uma função que pinta (cor, degradê ou imagem) ou null
  async function preenchimento(spPr, ctx, relsDe, estilo) {
    if (!spPr) return null;
    if (kid(spPr, 'noFill')) return 'nada';
    const s = kid(spPr, 'solidFill'); if (s) { const c = corDe(s, ctx); return (g) => { g.fillStyle = c; g.fill(); }; }
    const gr = kid(spPr, 'gradFill');
    if (gr) {
      const paradas = kids(kid(gr, 'gsLst'), 'gs').map((x) => [num(x.getAttribute('pos')) / 100000, corDe(x, ctx, '#000')]), ang = num(kid(gr, 'lin')?.getAttribute('ang'), 5400000) / 60000 * Math.PI / 180;
      return (g, w, h) => { const cx = w / 2, cy = h / 2, r = (Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang))) / 2;
        const lg = g.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        for (const [p, c] of paradas) lg.addColorStop(Math.min(1, Math.max(0, p)), c); g.fillStyle = lg; g.fill(); };
    }
    const bl = kid(spPr, 'blipFill');
    if (bl) { const id = desc(bl, 'blip')?.getAttribute('r:embed'), alvo = id && relsDe.get(id)?.alvo, img = alvo && await imagem(alvo); if (img) return (g, w, h) => { g.save(); g.clip(); g.drawImage(img, 0, 0, w, h); g.restore(); }; }
    if (estilo) { const ref = kid(estilo, 'fillRef'); if (ref && num(ref.getAttribute('idx')) > 0) { const c = corDe(ref, ctx); if (c) return (g) => { g.fillStyle = c; g.fill(); }; } }
    return null;
  }
  function linhaDe(spPr, ctx, estilo, s) {
    const ln = kid(spPr, 'ln');
    if (ln && kid(ln, 'noFill')) return null;
    let cor = ln && corDe(kid(ln, 'solidFill'), ctx);
    if (!cor && estilo) { const ref = kid(estilo, 'lnRef'); if (ref && num(ref.getAttribute('idx')) > 0) cor = corDe(ref, ctx); }
    if (!cor) return null;
    return { cor, larg: Math.max(1, num(ln?.getAttribute('w'), 12700) * s) };
  }

  // ---------- placeholders herdados (layout e mestre) ----------
  const tipoPh = (sp) => { const ph = desc(kid(sp, 'nvSpPr') || kid(sp, 'nvPicPr') || sp, 'ph'); return ph ? { tipo: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx'), tem: true } : null; };
  function acharPh(arvore, ph) {
    if (!arvore || !ph) return null;
    const todos = [...arvore.getElementsByTagNameNS('*', 'sp'), ...arvore.getElementsByTagNameNS('*', 'pic')];
    const norm = (t) => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t);
    if (ph.idx != null) { const a = todos.find((x) => { const p = tipoPh(x); return p && p.idx === ph.idx; }); if (a) return a; }
    return todos.find((x) => { const p = tipoPh(x); return p && norm(p.tipo) === norm(ph.tipo); }) || null;
  }

  // ---------- desenhar um slide ----------
  async function desenhar(i, largura = 1600) {
    const ctx = await contexto(i), s = largura / CX, W = largura, H = Math.round(CY * s);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    // fundo
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (const [doc, rs] of [[ctx.slide, ctx.sRels], [ctx.layout, ctx.lRels], [ctx.mestre, ctx.mRels]]) {
      const bg = caminho(doc, 'cSld', 'bg'); if (!bg) continue;
      const bgPr = kid(bg, 'bgPr'), bgRef = kid(bg, 'bgRef');
      g.beginPath(); g.rect(0, 0, W, H);
      if (bgPr) { const f = await preenchimento(bgPr, ctx, rs); if (f && f !== 'nada') f(g, W, H); }
      else if (bgRef) { g.fillStyle = corDe(bgRef, ctx, '#fff'); g.fill(); }
      break;
    }
    // formas do mestre e do layout que não são placeholders (logos, faixas), depois o slide
    const mostrarMestre = ctx.layout?.getAttribute('showMasterSp') !== '0' && ctx.slide?.getAttribute('showMasterSp') !== '0';
    if (mostrarMestre) await arvore(caminho(ctx.mestre, 'cSld', 'spTree'), ctx, ctx.mRels, s, g, 'fundo');
    await arvore(caminho(ctx.layout, 'cSld', 'spTree'), ctx, ctx.lRels, s, g, 'fundo');
    await arvore(caminho(ctx.slide, 'cSld', 'spTree'), ctx, ctx.sRels, s, g, 'slide');
    return cv;
  }
  async function arvore(spTree, ctx, rs, s, g, modo, grupo = null) {
    if (!spTree) return;
    for (const el of spTree.children) {
      const n = el.localName;
      if (modo === 'fundo' && (n === 'sp' || n === 'pic') && tipoPh(el)) continue;      // placeholders vazios do layout não aparecem
      if (n === 'sp' || n === 'cxnSp') await forma(el, ctx, rs, s, g, grupo, modo);
      else if (n === 'pic') await figura(el, ctx, rs, s, g, grupo);
      else if (n === 'grpSp') {
        const xf = caminho(el, 'grpSpPr', 'xfrm'), off = kid(xf, 'off'), ext = kid(xf, 'ext'), co = kid(xf, 'chOff'), ce = kid(xf, 'chExt');
        const t = { ox: num(off?.getAttribute('x')), oy: num(off?.getAttribute('y')), sx: num(ext?.getAttribute('cx'), 1) / (num(ce?.getAttribute('cx'), 1) || 1), sy: num(ext?.getAttribute('cy'), 1) / (num(ce?.getAttribute('cy'), 1) || 1), cx: num(co?.getAttribute('x')), cy: num(co?.getAttribute('y')) };
        await arvore(el, ctx, rs, s, g, modo, (r) => { const a = { x: t.ox + (r.x - t.cx) * t.sx, y: t.oy + (r.y - t.cy) * t.sy, w: r.w * t.sx, h: r.h * t.sy, rot: r.rot, fh: r.fh, fv: r.fv }; return grupo ? grupo(a) : a; });
      } else if (n === 'graphicFrame') await quadroGrafico(el, ctx, s, g, grupo);
    }
  }
  function retangulo(xfrm, grupo) {
    if (!xfrm) return null;
    const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext'); if (!off || !ext) return null;
    const r = { x: num(off.getAttribute('x')), y: num(off.getAttribute('y')), w: num(ext.getAttribute('cx')), h: num(ext.getAttribute('cy')), rot: num(xfrm.getAttribute('rot')) / 60000, fh: xfrm.getAttribute('flipH') === '1', fv: xfrm.getAttribute('flipV') === '1' };
    return grupo ? grupo(r) : r;
  }
  function posicionar(g, r, s) {
    g.translate((r.x + r.w / 2) * s, (r.y + r.h / 2) * s); if (r.rot) g.rotate(r.rot * Math.PI / 180); g.scale(r.fh ? -1 : 1, r.fv ? -1 : 1); g.translate(-r.w / 2 * s, -r.h / 2 * s);
  }
  function caminhoForma(g, geo, w, h, aj) {
    g.beginPath();
    if (geo === 'ellipse') g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (geo === 'roundRect') { const r = Math.min(w, h) * (aj ?? 0.16667); g.roundRect ? g.roundRect(0, 0, w, h, r) : g.rect(0, 0, w, h); }
    else if (geo === 'triangle') { g.moveTo(w / 2, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); }
    else if (geo === 'line' || geo === 'straightConnector1') { g.moveTo(0, 0); g.lineTo(w, h); }
    else if (geo === 'rightArrow') { const a = h * 0.5; g.moveTo(0, h * 0.25); g.lineTo(w - a, h * 0.25); g.lineTo(w - a, 0); g.lineTo(w, h / 2); g.lineTo(w - a, h); g.lineTo(w - a, h * 0.75); g.lineTo(0, h * 0.75); g.closePath(); }
    else if (geo === 'chevron' || geo === 'homePlate') { const a = h * 0.5; g.moveTo(0, 0); g.lineTo(w - a, 0); g.lineTo(w, h / 2); g.lineTo(w - a, h); g.lineTo(0, h); if (geo === 'chevron') g.lineTo(a, h / 2); g.closePath(); }
    else g.rect(0, 0, w, h);
  }
  async function forma(sp, ctx, rs, s, g, grupo, modo) {
    const ph = tipoPh(sp), phL = ph ? acharPh(caminho(ctx.layout, 'cSld', 'spTree'), ph) : null, phM = ph ? acharPh(caminho(ctx.mestre, 'cSld', 'spTree'), phL ? tipoPh(phL) : ph) : null;
    if (ph && ['dt', 'ftr', 'sldNum'].includes(ph.tipo) && modo !== 'slide') return;
    const spPr = kid(sp, 'spPr'), estilo = kid(sp, 'style');
    const r = retangulo(kid(spPr, 'xfrm'), grupo) || retangulo(kid(kid(phL, 'spPr'), 'xfrm'), null) || retangulo(kid(kid(phM, 'spPr'), 'xfrm'), null);
    if (!r) return;
    g.save(); posicionar(g, r, s);
    const w = r.w * s, h = r.h * s, geo = kid(spPr, 'prstGeom')?.getAttribute('prst') || (kid(spPr, 'custGeom') ? 'rect' : ph ? 'rect' : 'rect');
    const gd = desc(kid(spPr, 'prstGeom'), 'gd'), aj = gd ? num(/val (\d+)/.exec(gd.getAttribute('fmla') || '')?.[1], 16667) / 100000 : undefined;
    const fill = await preenchimento(spPr, ctx, rs, sp.localName === 'cxnSp' ? null : estilo) || (ph ? await preenchimento(kid(phL, 'spPr'), ctx, ctx.lRels) : null);
    if (fill && fill !== 'nada' && !(geo === 'line' || geo === 'straightConnector1')) { caminhoForma(g, geo, w, h, aj); fill(g, w, h); }
    const ln = linhaDe(spPr, ctx, estilo, s);
    if (ln) { caminhoForma(g, geo, w, h, aj); g.strokeStyle = ln.cor; g.lineWidth = ln.larg; g.stroke(); }
    const tx = kid(sp, 'txBody'); if (tx) texto(g, tx, w, h, s, ctx, ph, phL, phM, estilo);
    g.restore();
  }
  async function figura(pic, ctx, rs, s, g, grupo) {
    const ph = tipoPh(pic), phL = ph ? acharPh(caminho(ctx.layout, 'cSld', 'spTree'), ph) : null;
    const r = retangulo(caminho(pic, 'spPr', 'xfrm'), grupo) || retangulo(caminho(phL, 'spPr', 'xfrm'), null); if (!r) return;
    const blip = desc(kid(pic, 'blipFill'), 'blip'), id = blip?.getAttribute('r:embed'), alvo = id && rs.get(id)?.alvo, img = alvo && await imagem(alvo); if (!img) return;
    const src = desc(kid(pic, 'blipFill'), 'srcRect'), c = (a) => num(src?.getAttribute(a)) / 100000;
    const sx = img.width * c('l'), sy = img.height * c('t'), sw = img.width * (1 - c('l') - c('r')), sh = img.height * (1 - c('t') - c('b'));
    g.save(); posicionar(g, r, s);
    const geo = caminho(pic, 'spPr', 'prstGeom')?.getAttribute('prst'); if (geo && geo !== 'rect') { caminhoForma(g, geo, r.w * s, r.h * s); g.clip(); }
    g.drawImage(img, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, r.w * s, r.h * s); g.restore();
  }
  async function quadroGrafico(gf, ctx, s, g, grupo) {
    const r = retangulo(kid(gf, 'xfrm'), grupo); if (!r) return;
    const tbl = desc(gf, 'tbl');
    g.save(); posicionar(g, r, s);
    if (!tbl) {        // gráfico ou SmartArt: deixa um aviso discreto no lugar
      g.fillStyle = 'rgba(120,120,120,.08)'; g.fillRect(0, 0, r.w * s, r.h * s); g.strokeStyle = 'rgba(120,120,120,.5)'; g.setLineDash([8, 6]); g.strokeRect(0, 0, r.w * s, r.h * s);
      g.fillStyle = 'rgba(90,90,90,.8)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${Math.round(Math.min(r.w, r.h) * s / 10)}px system-ui, sans-serif`; g.fillText('Gráfico (abra o PDF para ver)', r.w * s / 2, r.h * s / 2);
      g.restore(); return;
    }
    const cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map((c) => num(c.getAttribute('w')) * s);
    let y = 0;
    kids(tbl, 'tr').forEach((tr, li) => {
      const hh = num(tr.getAttribute('h')) * s; let x = 0;
      kids(tr, 'tc').forEach((tc, ci) => {
        const w = cols[ci] || 0, tcPr = kid(tc, 'tcPr'), cor = corDe(kid(tcPr, 'solidFill'), ctx, li === 0 ? corEsquema(ctx, 'accent1') : li % 2 ? 'rgba(207,213,234,1)' : 'rgba(233,235,245,1)');
        g.fillStyle = cor; g.fillRect(x, y, w, hh); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, 19050 * s); g.strokeRect(x, y, w, hh);
        const tx = kid(tc, 'txBody'); if (tx) { g.save(); g.translate(x, y); texto(g, tx, w, hh, s, { ...ctx, corPadrao: li === 0 ? '#fff' : '#000' }, null, null, null, null); g.restore(); }
        x += w;
      });
      y += hh;
    });
    g.restore();
  }

  // ---------- texto ----------
  function nivelPr(lst, lvl) { return lst ? kid(lst, `lvl${lvl}pPr`) : null; }
  function texto(g, txBody, w, h, s, ctx, ph, phL, phM, estilo) {
    const tipo = ph?.tipo || '', ehTitulo = tipo === 'title' || tipo === 'ctrTitle';
    const estiloMestre = caminho(ctx.mestre, 'txStyles', ehTitulo ? 'titleStyle' : (ph && ['body', 'subTitle', 'obj'].includes(tipo)) || (ph && !tipo) ? 'bodyStyle' : 'otherStyle');
    const cadeia = (lvl) => [nivelPr(kid(txBody, 'lstStyle'), lvl), nivelPr(caminho(phL, 'txBody', 'lstStyle'), lvl), nivelPr(caminho(phM, 'txBody', 'lstStyle'), lvl), nivelPr(estiloMestre, lvl)].filter(Boolean);
    const bodyPr = [kid(txBody, 'bodyPr'), caminho(phL, 'txBody', 'bodyPr'), caminho(phM, 'txBody', 'bodyPr')].filter(Boolean);
    const bp = (a, p) => { for (const b of bodyPr) { const v = b.getAttribute(a); if (v != null) return v; } return p; };
    const insL = num(bp('lIns'), 91440) * s, insR = num(bp('rIns'), 91440) * s, insT = num(bp('tIns'), 45720) * s, insB = num(bp('bIns'), 45720) * s;
    const ancora = bp('anchor', ehTitulo && tipo === 'ctrTitle' ? 'b' : ehTitulo ? 'ctr' : 't'), quebra = bp('wrap', 'square') !== 'none';
    const auto = bodyPr.map((b) => kid(b, 'normAutofit')).find(Boolean), escalaFonte = auto ? num(auto.getAttribute('fontScale'), 100000) / 100000 : 1;
    const vert = bp('vert', 'horz'); if (vert !== 'horz' && vert !== 'eaVert') { /* texto vertical: desenha deitado */ }
    const corTexto = (estilo && corDe(kid(estilo, 'fontRef'), ctx)) || ctx.corPadrao || corEsquema(ctx, 'tx1');
    const largUtil = Math.max(4, w - insL - insR);

    function montar(fator) {
      const linhas = []; let num1 = 0;
      for (const p of kids(txBody, 'p')) {
        const pPr = kid(p, 'pPr'), lvl = num(pPr?.getAttribute('lvl')) + 1, ch = [pPr, ...cadeia(lvl)].filter(Boolean);
        const pa = (a, d) => { for (const x of ch) { const v = x.getAttribute(a); if (v != null) return v; } return d; };
        const pk = (n) => { for (const x of ch) { const v = kid(x, n); if (v) return v; } return null; };
        const algn = pa('algn', 'l'), marL = num(pa('marL'), 0) * s, ind = num(pa('indent'), 0) * s;
        const defR = (a, d) => { for (const x of ch) { const r = kid(x, 'defRPr'); const v = r?.getAttribute(a); if (v != null) return v; } return d; };
        const estiloMestreLvl = nivelPr(estiloMestre, lvl), corEstilo = estilo && corDe(kid(estilo, 'fontRef'), ctx);
        const defCor = () => { for (const x of ch) { if (x === estiloMestreLvl && corEstilo) return corEstilo; const r = kid(x, 'defRPr'); const c = r && corDe(kid(r, 'solidFill'), ctx); if (c) return c; } return null; };
        const defFonte = () => { for (const x of ch) { const f = kid(kid(x, 'defRPr'), 'latin')?.getAttribute('typeface'); if (f) return f; } return null; };
        const lnSpc = pk('lnSpc'), espaco = lnSpc && kid(lnSpc, 'spcPct') ? num(kid(lnSpc, 'spcPct').getAttribute('val'), 100000) / 100000 : 1;
        const antes = pk('spcBef'), antesPx = antes && kid(antes, 'spcPts') ? num(kid(antes, 'spcPts').getAttribute('val')) / 100 * 12700 * s * fator : 0;
        // pedaços de texto com estilo
        const pedacos = [];
        for (const r of p.children) {
          if (r.localName === 'br') { pedacos.push({ quebra: true }); continue; }
          if (r.localName !== 'r' && r.localName !== 'fld') continue;
          const rPr = kid(r, 'rPr'), t = kid(r, 't')?.textContent ?? '';
          const sz = num(rPr?.getAttribute('sz') ?? defR('sz', ehTitulo ? 4400 : 1800)) / 100;
          let face = kid(rPr, 'latin')?.getAttribute('typeface') || defFonte() || (ehTitulo ? '+mj-lt' : '+mn-lt');
          if (face === '+mj-lt') face = ctx.fonteMaior; else if (face === '+mn-lt') face = ctx.fonteMenor;
          const b = (rPr?.getAttribute('b') ?? defR('b', '0')) === '1', it = (rPr?.getAttribute('i') ?? defR('i', '0')) === '1', u = (rPr?.getAttribute('u') ?? defR('u', 'none')) !== 'none';
          const cor = corDe(kid(rPr, 'solidFill'), ctx) || defCor() || corTexto;
          const caps = (rPr?.getAttribute('cap') ?? defR('cap', 'none')) === 'all';
          const px = sz * 12700 * s * escalaFonte * fator;
          pedacos.push({ t: caps ? t.toUpperCase() : t, px, fonte: `${it ? 'italic ' : ''}${b ? 'bold ' : ''}${px.toFixed(2)}px "${face}", "Segoe UI", Roboto, Arial, sans-serif`, cor, u });
        }
        const tamBase = pedacos.find((x) => x.px)?.px || num(defR('sz', 1800)) / 100 * 12700 * s * escalaFonte * fator;
        // marcador
        let marcador = null;
        if (!kid(pPr, 'buNone') && pedacos.some((x) => x.t && x.t.trim())) {
          const bc = pk('buChar'), ba = pk('buAutoNum'), bn = pk('buNone');
          if (ba && !bn) { num1++; marcador = `${num1}.`; } else if (bc && !bn) { marcador = bc.getAttribute('char') || '•'; if (marcador === '' || /[-]/.test(marcador)) marcador = '•'; }
        }
        // quebra em linhas
        const x0 = marL, larg = largUtil - marL;
        let linha = { itens: [], larg: 0, alto: tamBase, algn, x0, marcador: marcador ? { t: marcador, x: marL + ind, px: tamBase, cor: pedacos[0]?.cor || corTexto, fonte: pedacos[0]?.fonte || `${tamBase}px sans-serif` } : null, antes: antesPx, espaco };
        const fecha = () => { linhas.push(linha); linha = { itens: [], larg: 0, alto: tamBase, algn, x0, marcador: null, antes: 0, espaco }; };
        for (const pd of pedacos) {
          if (pd.quebra) { fecha(); continue; }
          g.font = pd.fonte;
          for (const pal of pd.t.split(/(\s+)/)) {
            if (!pal) continue;
            const lw = g.measureText(pal).width;
            if (quebra && linha.larg + lw > larg && linha.itens.length && pal.trim()) fecha();
            if (!linha.itens.length && !pal.trim()) continue;
            linha.itens.push({ ...pd, t: pal, x: linha.larg, lw }); linha.larg += lw; linha.alto = Math.max(linha.alto, pd.px);
          }
        }
        fecha();
      }
      let total = 0; for (const l of linhas) total += l.antes + l.alto * 1.2 * l.espaco;
      return { linhas, total };
    }
    let fator = 1, m = montar(1);
    if (auto && !auto.getAttribute('fontScale')) while (m.total > h - insT - insB && fator > 0.45) { fator *= 0.9; m = montar(fator); }
    let y = insT + (ancora === 'ctr' ? (h - insT - insB - m.total) / 2 : ancora === 'b' ? h - insB - insT - m.total : 0);
    g.textBaseline = 'alphabetic';
    for (const l of m.linhas) {
      y += l.antes; const alt = l.alto * 1.2 * l.espaco, base = y + l.alto * 0.95 + (alt - l.alto * 1.2) / 2;
      const sobra = largUtil - l.x0 - l.larg, dx = insL + l.x0 + (l.algn === 'ctr' ? sobra / 2 : l.algn === 'r' ? sobra : 0);
      if (l.marcador) { g.font = l.marcador.fonte; g.fillStyle = l.marcador.cor; g.textAlign = 'left'; g.fillText(l.marcador.t, insL + l.marcador.x, base); }
      g.textAlign = 'left';
      for (const it of l.itens) {
        g.font = it.fonte; g.fillStyle = it.cor; g.fillText(it.t, dx + it.x, base);
        if (it.u) g.fillRect(dx + it.x, base + it.px * 0.1, it.lw, Math.max(1, it.px * 0.06));
      }
      y += alt;
    }
  }

  // ---------- anotações do apresentador ----------
  async function anotacoes(i) {
    try {
      const ctx = await contexto(i); if (!ctx.nN) return '';
      const n = await xml(ctx.nN); const sps = [...n.getElementsByTagNameNS('*', 'sp')].filter((sp) => tipoPh(sp)?.tipo === 'body');
      return sps.map((sp) => kids(kid(sp, 'txBody'), 'p').map((p) => [...p.getElementsByTagNameNS('*', 't')].map((t) => t.textContent).join('')).join('\n')).join('\n').trim();
    } catch { return ''; }
  }
  return { total: slides.length, proporcao: CX / CY, desenhar, anotacoes };
}
