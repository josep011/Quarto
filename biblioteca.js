// Biblioteca: os livros da estante são clássicos em domínio público. Cada lombada tem título e autor,
// cada livro tem capa, e dá para puxar da estante e ler. Leve: lombadas e capas são desenhadas na hora
// (nenhuma imagem baixada), a estante inteira é 1 malha só, e o texto de cada livro (comprimido) só é
// baixado quando você abre aquele livro.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIVROS } from './livros/catalogo.js?v=202610251400';

const AREAS = {
  br: { nome: 'Literatura brasileira', cores: ['#1f4d3a', '#2c5e3f', '#16403a', '#3b5a2a', '#24473f'] },
  pt: { nome: 'Literatura portuguesa', cores: ['#6b1f2a', '#7a2a24', '#5a1d33', '#82342b'] },
  mundo: { nome: 'Romances do mundo', cores: ['#1f2f52', '#3b2a1e', '#2d3f5c', '#5b3a22', '#2a2a3d', '#6b4a2a', '#1d3a4a'] },
  poesia: { nome: 'Poesia e teatro', cores: ['#4a2550', '#3a2a55', '#5a2a3f'] },
  ciencia: { nome: 'Ciência', cores: ['#123c48', '#1f4f5a', '#2a3f4a', '#0f3340'] },
  filosofia: { nome: 'Filosofia', cores: ['#2b2b2b', '#4a1f1f', '#3a3326', '#2d2a3a', '#1f2a26'] },
  politica: { nome: 'Política, economia e estratégia', cores: ['#4a3420', '#38301f', '#5a2f1d'] },
};
const OURO = '#d9b86a';
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const anoTxt = (a) => (a < 0 ? `${-a} a.C.` : String(a));

for (const l of LIVROS) { const a = AREAS[l.area]; l.cor = a.cores[Math.floor(hash(l.id) * a.cores.length)]; }

// ---------- capa (canvas 2D) ----------
function ornamento(x, area, cx, cy, r) {
  x.save(); x.strokeStyle = OURO; x.fillStyle = OURO; x.lineWidth = r * 0.06; x.translate(cx, cy);
  if (area === 'ciencia') { for (let i = 0; i < 3; i++) { x.save(); x.rotate(i * Math.PI / 3); x.beginPath(); x.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI * 2); x.stroke(); x.restore(); } x.beginPath(); x.arc(0, 0, r * 0.14, 0, Math.PI * 2); x.fill(); }
  else if (area === 'filosofia') { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(-r * 0.6, r * 0.5); x.lineTo(0, -r * 0.7); x.lineTo(r * 0.6, r * 0.5); x.closePath(); x.stroke(); }
  else if (area === 'poesia') { for (let i = 0; i < 8; i++) { x.rotate(Math.PI / 4); x.beginPath(); x.ellipse(0, -r * 0.5, r * 0.18, r * 0.5, 0, 0, Math.PI * 2); x.stroke(); } }
  else if (area === 'politica') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.stroke(); }
  else { x.beginPath(); x.moveTo(-r, 0); x.lineTo(r, 0); x.stroke(); for (const s of [-1, 1]) { x.beginPath(); x.arc(s * r * 0.55, 0, r * 0.3, 0, Math.PI * 2); x.stroke(); } x.beginPath(); x.moveTo(0, -r * 0.45); x.lineTo(r * 0.2, 0); x.lineTo(0, r * 0.45); x.lineTo(-r * 0.2, 0); x.closePath(); x.fill(); }
  x.restore();
}
function quebrar(x, texto, larg) {
  const pal = texto.split(' '), linhas = []; let l = '';
  for (const p of pal) { const t = l ? l + ' ' + p : p; if (x.measureText(t).width > larg && l) { linhas.push(l); l = p; } else l = t; }
  if (l) linhas.push(l); return linhas;
}
export function desenharCapa(livro, W = 360) {
  const H = Math.round(W * 1.5), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, livro.cor); gr.addColorStop(1, '#000'); x.fillStyle = livro.cor; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.35; x.fillStyle = gr; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; x.fillRect(Math.random() * W, Math.random() * H, 1, 1 + Math.random() * 3); }   // textura de tecido
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, W * 0.05, H);            // vinco da lombada
  const m = W * 0.1; x.strokeStyle = OURO; x.lineWidth = W * 0.008; x.strokeRect(m, m, W - 2 * m, H - 2 * m); x.lineWidth = W * 0.003; x.strokeRect(m + W * 0.02, m + W * 0.02, W - 2 * m - W * 0.04, H - 2 * m - W * 0.04);
  x.fillStyle = OURO; x.textAlign = 'center';
  x.font = `600 ${Math.round(W * 0.05)}px Georgia, serif`; x.fillText(livro.autor.toUpperCase(), W / 2, H * 0.2);
  let fs = W * 0.105; x.font = `700 ${Math.round(fs)}px Georgia, serif`; let ls = quebrar(x, livro.titulo, W - 2 * m - W * 0.1);
  while (ls.length > 4 && fs > W * 0.06) { fs *= 0.88; x.font = `700 ${Math.round(fs)}px Georgia, serif`; ls = quebrar(x, livro.titulo, W - 2 * m - W * 0.1); }
  const y0 = H * 0.36; ls.forEach((l, i) => x.fillText(l, W / 2, y0 + i * fs * 1.15));
  ornamento(x, livro.area, W / 2, H * 0.68, W * 0.13);
  x.font = `${Math.round(W * 0.042)}px Georgia, serif`; x.fillText(anoTxt(livro.ano), W / 2, H * 0.84);
  return c;
}

// ---------- estante: lombadas num atlas + 1 malha ----------
export function criarBiblioteca({ estante, aviso }) {
  const PX = 512 / 0.3;                              // pixels por metro na altura da lombada
  const itens = LIVROS.map((l) => {
    const h = hash(l.id + 'h');
    return { livro: l, lg: Math.min(0.062, Math.max(0.021, 0.018 + Math.sqrt(l.tam / 3.3e6) * 0.05)), alt: 0.225 + h * 0.06 };
  });
  // arruma na estante, na ordem do catálogo (por área), de baixo para cima
  // (z local diminui da esquerda para a direita de quem olha a estante)
  let p = 0, z = estante.prateleiras[0].fim;
  for (const it of itens) {
    let pr = estante.prateleiras[p];
    if (z - it.lg < pr.ini && p < estante.prateleiras.length - 1) { p++; pr = estante.prateleiras[p]; z = pr.fim; }
    it.y0 = pr.y0; it.z = z - it.lg / 2; it.pf = Math.min(estante.prof(pr.y0 + it.alt) - 0.03, 0.17 + hash(it.livro.id + 'p') * 0.03);
    z -= it.lg + 0.0025;
  }
  // atlas: lombadas em 2 fileiras de 512 px + amostras de cor
  const AW = 2048, AH = 1024, atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH;
  const x = atlas.getContext('2d'); x.fillStyle = '#efe6d2'; x.fillRect(0, 0, AW, AH);
  let ax = 0, ay = 0;
  for (const it of itens) {
    const w = Math.max(30, Math.round(it.lg * PX)), hpx = Math.round(it.alt * PX);
    if (ax + w > AW) { ax = 0; ay += 512; }
    it.uv = { x: ax, y: ay, w, h: hpx };
    const l = it.livro;
    x.fillStyle = l.cor; x.fillRect(ax, ay, w, hpx);
    const g = x.createLinearGradient(ax, 0, ax + w, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.3, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); x.fillStyle = g; x.fillRect(ax, ay, w, hpx);
    x.fillStyle = OURO;
    for (const yy of [0.06, 0.09, 0.91, 0.94]) x.fillRect(ax + 2, ay + hpx * yy, w - 4, Math.max(2, hpx * 0.008));
    // título na vertical (de cima para baixo), autor embaixo
    x.save(); x.translate(ax + w / 2, ay + hpx * 0.13); x.rotate(Math.PI / 2);
    let fs = Math.min(w * 0.5, 30); x.font = `700 ${fs}px Georgia, serif`; x.textBaseline = 'middle';
    const max = hpx * 0.56; let t = l.titulo.replace(/ \(.*\)/, '');
    while (x.measureText(t).width > max && fs > 11) { fs -= 1; x.font = `700 ${fs}px Georgia, serif`; }
    if (x.measureText(t).width > max) { while (x.measureText(t + '…').width > max && t.length > 3) t = t.slice(0, -1); t += '…'; }
    x.fillText(t, 0, 0);
    let fa = Math.min(w * 0.32, 17); x.font = `${fa}px Georgia, serif`; let a = l.autor.split(' ').slice(-1)[0];
    while (x.measureText(a).width > hpx * 0.17 && fa > 9) { fa -= 1; x.font = `${fa}px Georgia, serif`; }
    x.fillText(a, hpx * 0.6, 0);
    x.restore();
    ax += w + 2;
  }
  // amostras: cor de cada livro (capas) e cor das páginas
  const amostra = (cor, i) => { const sx = AW - 8 - (i % 200) * 10, sy = AH - 8 - Math.floor(i / 200) * 10; x.fillStyle = cor; x.fillRect(sx - 2, sy - 2, 8, 8); return { x: sx + 2, y: sy + 2 }; };
  itens.forEach((it, i) => { it.am = amostra(it.livro.cor, i); });
  const papel = amostra('#e9dfc6', itens.length);
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;

  function geometriaLivro(it) {
    const geo = new THREE.BoxGeometry(it.pf, it.alt, it.lg), uv = geo.attributes.uv;
    const U = (px) => px / AW, V = (py) => 1 - py / AH;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i);
      if (f === 0) uv.setXY(i, U(it.uv.x + u * it.uv.w), V(it.uv.y + (1 - v) * it.uv.h));   // +x: a lombada, virada para o quarto
      else { const s = f === 2 || f === 3 ? papel : it.am; uv.setXY(i, U(s.x), V(s.y)); }          // topo/fundo: páginas; o resto: capa
    }
    // a lombada (+x) fica rente à borda da prateleira
    geo.translate(it.pf / 2 + 0.015, it.y0 + it.alt / 2, it.z);
    return geo;
  }
  const geos = itens.map(geometriaLivro);
  const malha = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
  malha.name = 'livrosDaEstante'; malha.receiveShadow = true; estante.g.add(malha);
  geos.forEach((g) => g.dispose());
  const pos = malha.geometry.attributes.position, guardado = new Float32Array(24 * 3);

  // ---------- puxar um livro da estante ----------
  let puxado = null;        // { i, mesh, k, alvo, depois }
  function esconder(i, sim) {
    if (sim) { guardado.set(pos.array.subarray(i * 72, i * 72 + 72)); const c = pos.array.subarray(i * 72, i * 72 + 72); for (let j = 0; j < 72; j += 3) { c[j] = 0; c[j + 1] = -1; c[j + 2] = 0; } }
    else pos.array.set(guardado, i * 72);
    pos.needsUpdate = true; malha.geometry.computeBoundingSphere();
  }
  function puxar(i, depois) {
    if (puxado) devolver(true);
    const it = itens[i], geo = geometriaLivro(it); geo.translate(-(it.pf + 0.015), -it.y0, -it.z);   // origem no pé da lombada: é por ali que ele inclina
    const mesh = new THREE.Mesh(geo, malha.material); mesh.position.set(it.pf + 0.015, it.y0, it.z);
    estante.g.add(mesh); esconder(i, true);
    puxado = { i, mesh, k: 0, alvo: 1, depois };
  }
  function devolver(agora) {
    if (!puxado) return;
    if (agora) { estante.g.remove(puxado.mesh); puxado.mesh.geometry.dispose(); esconder(puxado.i, false); puxado = null; return; }
    puxado.alvo = 0; puxado.depois = null;
  }
  function atualizar(dt) {
    if (!puxado) return false;
    const d = puxado.alvo - puxado.k; puxado.k += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8);
    const k = puxado.k, s = k * k * (3 - 2 * k);
    // desliza para fora e inclina para a frente, como quem puxa pela parte de cima
    puxado.mesh.position.x = itens[puxado.i].pf + 0.015 + 0.16 * s;
    puxado.mesh.position.y = itens[puxado.i].y0 + 0.03 * Math.sin(Math.PI * s);
    puxado.mesh.rotation.z = -0.22 * s;
    if (puxado.alvo === 1 && k >= 1 && puxado.depois) { const f = puxado.depois; puxado.depois = null; f(); }
    if (puxado.alvo === 0 && k <= 0) devolver(true);
    return true;
  }

  // ---------- leitor ----------
  const tela = document.createElement('div'); tela.id = 'leitor'; tela.className = 'telaCheia'; tela.hidden = true;
  tela.innerHTML = `<div class="topo"><b class="titulo"></b><div class="direita"><button data-a="sumario">Sumário</button><button data-a="menor" aria-label="Letra menor">A−</button><button data-a="maior" aria-label="Letra maior">A+</button><button data-a="fechar" class="forte">Guardar</button></div></div>
    <div class="area"><div class="pagina"></div><div class="sumario vidro" hidden></div></div>
    <div class="barra"><input type="range" class="progresso" min="0" max="1000" value="0" aria-label="Ir para"><span class="pct">0%</span></div>`;
  document.body.append(tela);
  for (const ev of ['keydown', 'keyup']) tela.addEventListener(ev, (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  const $ = (s) => tela.querySelector(s), area = $('.area'), pagina = $('.pagina'), sumEl = $('.sumario'), prog = $('.progresso');
  let atual = null, paras = [], a = 0, b = 0, fonte = 19, salvarT = 0, aoFechar = null;
  try { fonte = +localStorage.getItem('quarto-livro-fonte') || 19; } catch {}
  const BLOCO = 120;
  const elPara = (i) => {
    const t = paras[i], el = document.createElement(atual.verso || t.includes('\n') ? 'pre' : 'p');
    el.textContent = t; el.dataset.i = i;
    if (t.length < 70 && !/[.;,:!?”"]$/.test(t) && (t === t.toUpperCase() || /^(cap[ií]tulo|chapter|book|part|parte|livro|canto|act|scene|lyra|lira)\b/i.test(t))) el.className = 'cab';
    return el;
  };
  function render(desde) {
    pagina.innerHTML = ''; a = Math.max(0, desde - 20); b = a;
    if (a === 0) { const capa = document.createElement('div'); capa.className = 'capaLivro'; capa.append(desenharCapa(atual, 300));
      const info = document.createElement('p'); info.className = 'infoLivro';
      info.innerHTML = `<b>${esc(atual.titulo)}</b><br>${esc(atual.autor)} · ${anoTxt(atual.ano)}<br><small>Domínio público · texto do Projeto Gutenberg${atual.lingua === 'en' ? ' · em inglês' : ''}</small>`;
      capa.append(info); pagina.append(capa); }
    mais(BLOCO + 20);
    const alvo = pagina.querySelector(`[data-i="${desde}"]`); pagina.scrollTop = alvo && desde > 0 ? alvo.offsetTop - 12 : 0;
  }
  function mais(n) { const f = document.createDocumentFragment(); const fim = Math.min(paras.length, b + n); for (; b < fim; b++) f.append(elPara(b)); pagina.append(f); }
  function antes(n) {
    if (a === 0) return; const ini = Math.max(0, a - n), f = document.createDocumentFragment();
    for (let i = ini; i < a; i++) f.append(elPara(i));
    const h0 = pagina.scrollHeight; pagina.prepend(f); a = ini; pagina.scrollTop += pagina.scrollHeight - h0;
  }
  function paraNoTopo() {
    const y = pagina.scrollTop + 20;
    for (const el of pagina.querySelectorAll('[data-i]')) if (el.offsetTop + el.offsetHeight > y) return +el.dataset.i;
    return b - 1;
  }
  pagina.addEventListener('scroll', () => {
    if (!atual || !paras.length) return;
    if (pagina.scrollTop + pagina.clientHeight > pagina.scrollHeight - 1500) mais(BLOCO);
    if (pagina.scrollTop < 800 && a > 0) antes(BLOCO);
    const i = paraNoTopo(); prog.value = Math.round(1000 * i / Math.max(1, paras.length - 1)); $('.pct').textContent = Math.round(100 * i / Math.max(1, paras.length - 1)) + '%';
    clearTimeout(salvarT); salvarT = setTimeout(() => { try { localStorage.setItem('quarto-livro-' + atual.id, String(i)); } catch {} }, 400);
  }, { passive: true });
  prog.addEventListener('change', () => render(Math.round(prog.value / 1000 * (paras.length - 1))));
  function aplicarFonte() { pagina.style.fontSize = fonte + 'px'; try { localStorage.setItem('quarto-livro-fonte', String(fonte)); } catch {} }
  function montarSumario() {
    const lista = [];
    paras.forEach((t, i) => { if (t.length < 70 && !/[.;,!?”"]$/.test(t) && (/^(cap[ií]tulo|chapter|book|part|parte|livro|canto|act|lyra|lira|letter|carta)\b/i.test(t) || /^[IVXLC]+\.?$/.test(t) || (t === t.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(t) && t.length < 50))) lista.push(i); });
    const sel = lista.length > 400 ? lista.filter((i) => /^(cap|chap|book|part|parte|livro|canto|act)/i.test(paras[i])) : lista;
    sumEl.innerHTML = sel.length ? '' : '<p>Este livro não tem capítulos marcados. Use a barra de baixo para ir a qualquer parte.</p>';
    const rotulo = (i) => { let t = paras[i].replace(/\n/g, ' '); const n = paras[i + 1]; if (t.length < 14 && n && n.length < 70 && !n.includes('\n')) t += ' — ' + n; return t.slice(0, 70); };
    for (const i of sel.filter((i) => i > 12 || /^(cap|chap|book|part|parte|livro|canto|act)/i.test(paras[i])).slice(0, 500)) { const bt = document.createElement('button'); bt.textContent = rotulo(i); bt.addEventListener('click', () => { sumEl.hidden = true; render(i); }); sumEl.append(bt); }
  }
  tela.addEventListener('click', (e) => {
    const bt = e.target.closest('button[data-a]'); if (!bt) return; const ac = bt.dataset.a;
    if (ac === 'fechar') fechar();
    else if (ac === 'maior') { fonte = Math.min(30, fonte + 2); aplicarFonte(); }
    else if (ac === 'menor') { fonte = Math.max(13, fonte - 2); aplicarFonte(); }
    else if (ac === 'sumario') { if (sumEl.hidden && !sumEl.childElementCount) montarSumario(); sumEl.hidden = !sumEl.hidden; }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tela.hidden) fechar(); });

  async function baixar(l) {
    const r = await fetch(`./livros/${l.id}.txt.gz?v=1`); if (!r.ok) throw new Error('http ' + r.status);
    const buf = await r.arrayBuffer(), u8 = new Uint8Array(buf);
    if (u8[0] === 0x1f && u8[1] === 0x8b) {              // .gz de verdade: descomprime aqui
      if (!('DecompressionStream' in window)) throw new Error('sem-descompressor');
      return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return new TextDecoder().decode(u8);                 // o servidor já descomprimiu
  }
  const cacheTexto = new Map();
  async function ler(l) {
    atual = l; paras = []; tela.hidden = false; sumEl.hidden = true; sumEl.innerHTML = '';
    $('.titulo').textContent = `${l.titulo} — ${l.autor}`; aplicarFonte();
    pagina.innerHTML = `<div class="capaLivro"></div><p class="infoLivro">Abrindo o livro… (${l.kb} KB)</p>`; pagina.firstChild.append(desenharCapa(l, 300));
    try {
      let txt = cacheTexto.get(l.id); if (!txt) { txt = await baixar(l); cacheTexto.clear(); cacheTexto.set(l.id, txt); }
      if (atual !== l) return;
      paras = txt.split('\n\n');
      let ini = 0; try { ini = Math.min(paras.length - 1, +localStorage.getItem('quarto-livro-' + l.id) || 0); } catch {}
      render(ini);
      if (ini > 0) aviso && aviso('Continuando de onde você parou.');
    } catch (e) {
      pagina.querySelector('.infoLivro').textContent = String(e.message) === 'sem-descompressor' ? 'Este navegador é antigo demais para abrir o livro. Atualize o navegador.' : 'Não consegui abrir este livro. Confira se a pasta "livros" foi enviada para o GitHub, e a internet.';
    }
  }
  function fechar() { tela.hidden = true; atual = null; pagina.innerHTML = ''; paras = []; devolver(false); aoFechar && aoFechar(); }

  // ---------- lista de livros (escolher) ----------
  const lista = document.createElement('div'); lista.id = 'listaLivros'; lista.className = 'telaCheia'; lista.hidden = true;
  lista.innerHTML = `<div class="topo"><b>Estante de livros</b><div class="direita"><button data-a="fechar" class="forte">Fechar</button></div></div><div class="rolar"></div>`;
  document.body.append(lista);
  let escolher = null;
  function abrirLista(aoEscolher) {
    escolher = aoEscolher; const rol = lista.querySelector('.rolar');
    if (!rol.childElementCount) {
      for (const [k, ar] of Object.entries(AREAS)) {
        const ls = LIVROS.filter((l) => l.area === k); if (!ls.length) continue;
        const h = document.createElement('h3'); h.textContent = ar.nome; rol.append(h);
        const gr = document.createElement('div'); gr.className = 'capas'; rol.append(gr);
        for (const l of ls) {
          const bt = document.createElement('button'); bt.className = 'livroBt'; bt.dataset.id = l.id; bt.append(desenharCapa(l, 150));
          const s = document.createElement('span'); s.innerHTML = `<b>${esc(l.titulo)}</b><small>${esc(l.autor)}${l.lingua === 'en' ? ' · inglês' : ''}</small>`; bt.append(s); gr.append(bt);
        }
      }
    }
    lista.hidden = false;
  }
  lista.addEventListener('click', (e) => {
    if (e.target.closest('[data-a=fechar]')) { lista.hidden = true; return; }
    const bt = e.target.closest('.livroBt'); if (!bt) return;
    lista.hidden = true; const i = itens.findIndex((it) => it.livro.id === bt.dataset.id); escolher && escolher(i);
  });

  /** puxa o livro i da estante e abre para ler */
  function abrirLivro(i, depoisDeFechar) { aoFechar = depoisDeFechar || null; puxar(i, () => ler(itens[i].livro)); }

  return {
    malha, livros: itens.map((it) => it.livro), abrirLista, abrirLivro, atualizar,
    indiceDoToque: (faceIndex) => Math.floor(faceIndex / 12),
    aberto: () => !tela.hidden || !lista.hidden,
    mexendo: () => !!puxado,
  };
}
