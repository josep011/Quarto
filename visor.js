// Visor: abre o que está guardado (PDF, imagem, nota, link, texto, vídeo, áudio) numa tela por cima do quarto.
import { abrirPptx } from './pptx.js';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsPromessa = null;
export function carregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromessa) return pdfjsPromessa;
  pdfjsPromessa = new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfjsPromessa = null; erro(new Error('pdfjs')); }; document.head.append(s);
  });
  return pdfjsPromessa;
}
export const ehPdf = (it) => it.tipo === 'arquivo' && (/pdf/i.test(it.mime || '') || /\.pdf$/i.test(it.nome || ''));
export const ehImagem = (it) => it.tipo === 'arquivo' && /^image\//.test(it.mime || '');
const ehTexto = (it) => it.tipo === 'arquivo' && (/^text\/|json|xml|javascript|csv/.test(it.mime || '') || /\.(txt|md|csv|json|js|html|css|py|xml|log)$/i.test(it.nome || ''));
const ehVideo = (it) => it.tipo === 'arquivo' && /^video\//.test(it.mime || '');
const ehAudio = (it) => it.tipo === 'arquivo' && /^audio\//.test(it.mime || '');
export function tamanhoBonito(n) { if (!Number.isFinite(n)) return ''; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; }
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const linkSeguro = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

export function criarVisor() {
  const ui = document.createElement('div'); ui.id = 'visor'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `<div class="topo"><b class="titulo"></b><span class="direita"><span class="zoom" hidden><button data-a="menos" aria-label="Diminuir">−</button><button data-a="mais" aria-label="Aumentar">+</button></span><button data-a="fechar" class="forte">Fechar</button></span></div>
    <div class="conteudo"></div>`;
  document.body.append(ui);
  const corpo = ui.querySelector('.conteudo'), titulo = ui.querySelector('.titulo'), zoomEl = ui.querySelector('.zoom');
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => e.stopPropagation());
  let url = null, pdf = null, escala = 1, aoSalvarNota = null, observador = null;
  function limpar() {
    if (url) URL.revokeObjectURL(url); url = null;
    if (observador) observador.disconnect(); observador = null;
    if (pdf) { pdf.destroy(); pdf = null; }
    corpo.innerHTML = ''; corpo.className = 'conteudo'; zoomEl.hidden = true; aoSalvarNota = null;
  }
  async function mostrarPdf(blob) {
    corpo.classList.add('paginas'); corpo.innerHTML = '<p class="aviso">Abrindo o PDF…</p>';
    let lib; try { lib = await carregarPdfJs(); } catch { corpo.innerHTML = '<p class="aviso">Não consegui carregar o leitor de PDF (precisa de internet na primeira vez).</p>'; baixar(blob); return; }
    try { pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise; }
    catch { corpo.innerHTML = '<p class="aviso">Esse PDF não abriu. Ele pode estar com senha ou danificado.</p>'; baixar(blob); return; }
    corpo.innerHTML = ''; zoomEl.hidden = false; escala = 1;
    const larg = () => Math.min(corpo.clientWidth - 24, 900) * escala;
    const pags = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const caixa = document.createElement('div'); caixa.className = 'pagina'; caixa.dataset.n = n; caixa.innerHTML = `<span>${n}</span>`;
      corpo.append(caixa); pags.push(caixa);
    }
    const p1 = await pdf.getPage(1), v1 = p1.getViewport({ scale: 1 }), proporcao = v1.height / v1.width;
    const medir = () => pags.forEach((c) => { c.style.width = larg() + 'px'; c.style.height = larg() * proporcao + 'px'; c.dataset.feito = ''; c.querySelector('canvas')?.remove(); });
    async function renderizar(c) {
      if (c.dataset.feito === '1' || !pdf) return; c.dataset.feito = '1';
      const pg = await pdf.getPage(+c.dataset.n), base = pg.getViewport({ scale: 1 }), dpr = Math.min(devicePixelRatio || 1, 2);
      const vp = pg.getViewport({ scale: (larg() / base.width) * dpr }), cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height; c.style.height = (vp.height / dpr) + 'px';
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; c.querySelector('canvas')?.remove(); c.append(cv);
    }
    medir();
    observador = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) renderizar(e.target); }), { root: corpo, rootMargin: '600px 0px' });
    pags.forEach((c) => observador.observe(c));
    zoomEl.onclick = (e) => {
      const a = e.target.dataset.a; if (!a) return;
      escala = Math.min(3, Math.max(0.5, escala * (a === 'mais' ? 1.25 : 0.8))); medir();
      pags.forEach((c) => { observador.unobserve(c); observador.observe(c); });
    };
  }
  async function mostrarPptx(blob) {        // apresentação do PowerPoint: um slide embaixo do outro
    corpo.classList.add('paginas'); corpo.innerHTML = '<p class="aviso">Abrindo a apresentação…</p>';
    let a; try { a = await abrirPptx(blob); } catch { corpo.innerHTML = '<p class="aviso">Essa apresentação não abriu. Tente salvar de novo como .pptx ou como PDF.</p>'; baixar(blob); return; }
    corpo.innerHTML = '';
    const larg = Math.min(corpo.clientWidth - 24, 900), pags = [];
    for (let i = 0; i < a.total; i++) { const c = document.createElement('div'); c.className = 'pagina'; c.dataset.n = i; c.innerHTML = `<span>${i + 1}</span>`; c.style.width = larg + 'px'; c.style.height = larg / a.proporcao + 'px'; corpo.append(c); pags.push(c); }
    observador = new IntersectionObserver((es) => es.forEach(async (e) => {
      if (!e.isIntersecting || e.target.dataset.feito) return; e.target.dataset.feito = '1';
      const cv = await a.desenhar(+e.target.dataset.n, Math.round(larg * Math.min(devicePixelRatio || 1, 2))); e.target.append(cv);
    }), { root: corpo, rootMargin: '600px 0px' });
    pags.forEach((c) => observador.observe(c));
  }
  function baixar(blob, nome) {
    url = url || URL.createObjectURL(blob);
    const p = document.createElement('p'); p.className = 'aviso';
    p.innerHTML = `<a class="botaoLink" href="${url}" download="${esc(nome || 'arquivo')}" target="_blank" rel="noopener">Baixar / abrir fora daqui</a>`;
    corpo.append(p);
  }
  async function abrir(it, { salvarNota } = {}) {
    limpar(); ui.hidden = false; titulo.textContent = it.nome || 'Sem nome';
    if (it.tipo === 'nota') {
      aoSalvarNota = salvarNota;
      corpo.classList.add('nota');
      corpo.innerHTML = `<textarea spellcheck="true" placeholder="Escreva aqui…"></textarea><p class="aviso pequeno">Salva sozinho quando você fecha.</p>`;
      const ta = corpo.querySelector('textarea'); ta.value = it.texto || ''; ta.dataset.inicial = ta.value; setTimeout(() => ta.focus(), 60);
      return;
    }
    if (it.tipo === 'link') {
      const href = linkSeguro(it.url);
      corpo.classList.add('centro');
      corpo.innerHTML = `<div class="cartao"><p class="url"></p>${href ? `<a class="botaoLink" target="_blank" rel="noopener noreferrer" href="${esc(href)}">Abrir o link</a>` : '<p class="aviso">Esse link não começa com http:// ou https://.</p>'}</div>`;
      corpo.querySelector('.url').textContent = it.url || '';
      return;
    }
    const blob = it.blob;
    if (!blob) { corpo.innerHTML = '<p class="aviso">O arquivo não está aqui.</p>'; return; }
    if (ehPdf(it)) return mostrarPdf(blob);
    if (/\.pptx$/i.test(it.nome || '') || /presentationml/.test(it.mime || '')) return mostrarPptx(blob);
    if (ehImagem(it)) {
      url = URL.createObjectURL(blob); corpo.classList.add('centro', 'imagem');
      const img = document.createElement('img'); img.src = url; img.alt = it.nome || ''; img.addEventListener('click', () => img.classList.toggle('grande')); corpo.append(img); return;
    }
    if (ehVideo(it) || ehAudio(it)) {
      url = URL.createObjectURL(blob); corpo.classList.add('centro');
      const m = document.createElement(ehVideo(it) ? 'video' : 'audio'); m.controls = true; m.src = url; m.playsInline = true; corpo.append(m); return;
    }
    if (ehTexto(it) && blob.size < 3 * 1048576) {
      const pre = document.createElement('pre'); pre.textContent = await blob.text(); corpo.append(pre); return;
    }
    corpo.classList.add('centro');
    corpo.innerHTML = `<div class="cartao"><p>${esc(it.nome)}</p><p class="aviso pequeno">${esc(it.mime || 'arquivo')} · ${tamanhoBonito(blob.size)}</p><p class="aviso pequeno">Esse tipo de arquivo não abre aqui dentro.</p></div>`;
    baixar(blob, it.nome);
  }
  function fechar() {
    const ta = corpo.querySelector('.nota textarea, textarea');
    if (aoSalvarNota && ta && ta.value !== ta.dataset.inicial) aoSalvarNota(ta.value);
    limpar(); ui.hidden = true;
  }
  ui.querySelector('[data-a="fechar"]').addEventListener('click', fechar);
  return { abrir, fechar, aberto: () => !ui.hidden };
}
