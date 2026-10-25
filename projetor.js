// Projetor de teto: projeta vídeo, imagem, apresentações (PowerPoint .pptx, PDF ou várias imagens) e toca áudio,
// na parede do fundo ao lado da mesa. Como um projetor de verdade: a imagem é luz na parede, fica lavada com a lâmpada
// acesa e viva com a luz apagada, tem o facho saindo da lente e ilumina quem passa na frente.
// Modo apresentação: setas, teclado (e passador de slides), deslizar o dedo e anotações do apresentador.
// O último arquivo projetado fica guardado no aparelho (nunca vai para o GitHub).
// Links do YouTube: o vídeo do YouTube não pode virar textura 3D (o navegador não deixa). Então o player oficial fica
// ATRÁS do quarto, deformado em perspectiva, e a parede ganha um "buraco" transparente do tamanho da imagem: o que estiver
// na frente (o gatinho, a cadeira) continua desenhado por cima, como numa projeção de verdade. Precisa de internet.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as guarda from './guarda.js';
import { carregarPdfJs } from './visor.js';
import { abrirPptx } from './pptx.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tempo = (s) => { if (!Number.isFinite(s)) return '0:00'; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
export const tipoProjetavel = (mime = '', nome = '') => {
  if (/^video\//.test(mime) || /\.(mp4|webm|mov|m4v|ogv)$/i.test(nome)) return 'video';
  if (/^image\//.test(mime) || /\.(png|jpe?g|gif|webp|avif)$/i.test(nome)) return 'imagem';
  if (/pdf/i.test(mime) || /\.pdf$/i.test(nome)) return 'pdf';
  if (/presentationml\.presentation/.test(mime) || /\.pptx$/i.test(nome)) return 'pptx';
  if (/^audio\//.test(mime) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(nome)) return 'audio';
  return null;
};
// aceita youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/, m. e music., com ou sem https e com ?t=
export function idYoutube(txt = '') {
  const s = String(txt).trim(); if (/^[\w-]{11}$/.test(s)) return { id: s, inicio: 0, vertical: false };
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, ''); let id = null, vertical = false;
  if (host === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (/^youtube(-nocookie)?\.com$/.test(host)) {
    id = u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) { id = m[2]; vertical = m[1] === 'shorts'; }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = u.searchParams.get('t') || u.searchParams.get('start') || ''; let inicio = 0;
  const mm = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/); if (mm) inicio = (+mm[1] || 0) * 3600 + (+mm[2] || 0) * 60 + (+mm[3] || 0);
  return { id, inicio, vertical };
}
const naoAbre = (nome = '') => (/\.(ppt|pps|odp|key)$/i.test(nome) ? 'Esse formato de apresentação não abre aqui. No programa da apresentação, use "Salvar como" PowerPoint (.pptx) ou PDF.' : null);

// tela da parede: { x, y, z, w, h } (z = parede, a imagem olha para +z) ; lente: { x, y, z, alturaTeto }
export function criarProjetor(cena, { tela, lente, aviso }) {
  const g = new THREE.Group(); cena.add(g);

  // ---------- o aparelho, preso no teto ----------
  const branco = new THREE.MeshStandardMaterial({ color: 0xe9e9ec, roughness: 0.45 });
  const cinza = new THREE.MeshStandardMaterial({ color: 0x2b2c31, roughness: 0.5 });
  const aparelho = new THREE.Group(); aparelho.position.set(lente.x + 0.07, lente.y, lente.z + 0.15); g.add(aparelho);
  const corpo = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.11, 0.28, 4, 0.025), branco); corpo.castShadow = true; aparelho.add(corpo);
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, lente.alturaTeto - lente.y - 0.05, 10), cinza);
  haste.position.y = (lente.alturaTeto - lente.y) / 2 + 0.03; aparelho.add(haste);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 18), cinza); base.position.y = lente.alturaTeto - lente.y - 0.008; aparelho.add(base);
  const suporte = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.16), cinza); suporte.position.y = 0.06; aparelho.add(suporte);
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 24), cinza); aro.rotation.x = Math.PI / 2; aro.position.set(-0.07, 0, -0.15); aparelho.add(aro);
  const vidroLente = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.1, metalness: 0.4, emissive: 0xfff2dd, emissiveIntensity: 0 });
  const lenteM = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), vidroLente); lenteM.position.set(-0.07, 0, -0.168); lenteM.rotation.y = Math.PI; aparelho.add(lenteM);
  for (let i = 0; i < 5; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.06, 0.006), cinza); v.position.set(0.04 + i * 0.022, 0, -0.141); aparelho.add(v); }
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xd23b3b }); const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), ledMat); led.position.set(0.14, 0.035, -0.135); aparelho.add(led);
  const ponta = new THREE.Vector3(lente.x, lente.y, lente.z - 0.02);

  // ---------- a imagem na parede, o facho e a luz ----------
  const telaMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const imagem = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), telaMat); imagem.position.set(tela.x, tela.y, tela.z + 0.004); imagem.renderOrder = 2; g.add(imagem);
  const fachoGeo = new THREE.BufferGeometry(); fachoGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
  const fachoMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  // o buraco: escreve transparente (alfa 0) no quadro, mas grava profundidade, então quem está na frente tapa o vídeo
  const furoMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const furo = new THREE.Mesh(imagem.geometry, furoMat); furo.position.copy(imagem.position); furo.renderOrder = 1; furo.visible = false; g.add(furo);
  const facho = new THREE.Mesh(fachoGeo, fachoMat); facho.renderOrder = 3; facho.frustumCulled = false; g.add(facho);
  const spot = new THREE.SpotLight(0xfff4e6, 0, 0, 0.4, 0.5, 1.2); spot.position.copy(ponta); spot.target.position.set(tela.x, tela.y, tela.z); g.add(spot, spot.target);
  let largura = tela.w, altura = tela.h;
  function encaixar(ar) {
    if (ar > tela.w / tela.h) { largura = tela.w; altura = tela.w / ar; } else { altura = tela.h; largura = tela.h * ar; }
    imagem.scale.set(largura, altura, 1); furo.scale.copy(imagem.scale);
    const p = fachoGeo.attributes.position.array, cx = tela.x, cy = tela.y, z = tela.z + 0.01;
    const c = [[cx - largura / 2, cy - altura / 2], [cx + largura / 2, cy - altura / 2], [cx + largura / 2, cy + altura / 2], [cx - largura / 2, cy + altura / 2]];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; p.set([ponta.x, ponta.y, ponta.z, a[0], a[1], z, b[0], b[1], z], i * 9); }
    fachoGeo.attributes.position.needsUpdate = true; fachoGeo.computeBoundingSphere();
    spot.angle = Math.atan(Math.hypot(largura, altura) / 2 / ponta.distanceTo(spot.target.position)) * 1.05;
  }
  encaixar(16 / 9);
  const cartaz = (desenho) => { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; desenho(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const espera = cartaz((x) => {
    const gr = x.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#16314f'); gr.addColorStop(1, '#0b1a2c'); x.fillStyle = gr; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.textAlign = 'center'; x.font = '600 54px system-ui, sans-serif'; x.fillText('Projetor', 640, 330);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '34px system-ui, sans-serif'; x.fillText('Escolha um arquivo para projetar', 640, 400);
  });
  const telaAudio = (nome) => cartaz((x) => {
    x.fillStyle = '#120f1a'; x.fillRect(0, 0, 1280, 720); x.fillStyle = '#e8c98f'; x.textAlign = 'center'; x.font = '700 140px system-ui, sans-serif'; x.fillText('♪', 640, 340);
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '40px system-ui, sans-serif'; let t = nome; while (x.measureText(t).width > 1100 && t.length > 3) t = t.slice(0, -2); x.fillText(t === nome ? t : t + '…', 640, 450);
  });

  const telaYt = cartaz((x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, 1280, 720); x.fillStyle = '#e33'; x.beginPath(); x.roundRect(560, 300, 160, 112, 28); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(620, 330); x.lineTo(620, 382); x.lineTo(668, 356); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,.6)'; x.textAlign = 'center'; x.font = '32px system-ui, sans-serif'; x.fillText('YouTube (precisa de internet)', 640, 480);
  });

  // ---------- YouTube: o player oficial por cima da imagem na parede ----------
  let yt = null;                                        // { el, id, estado, t, dur, mudo, cheio, ar }
  const fecharCheio = document.createElement('button'); fecharCheio.id = 'ytFechar'; fecharCheio.className = 'vidro'; fecharCheio.textContent = 'Voltar ao quarto'; fecharCheio.hidden = true;
  fecharCheio.addEventListener('click', () => ytCheio(false)); document.body.append(fecharCheio);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && yt && yt.cheio) { e.stopImmediatePropagation(); ytCheio(false); } }, true);
  const ytEnviar = (func, args = []) => { try { yt?.el.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch {} };
  const ytTocando = () => !!yt && (yt.estado === 1 || yt.estado === 3);
  function ytSoltar() { if (!yt) return; yt.el.remove(); yt = null; ytCheio(false); }
  function ytMontar(id, inicio, tocar, ar) {
    ytSoltar();
    const el = document.createElement('iframe'); el.className = 'ytTela'; el.title = 'YouTube';
    el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; el.allowFullscreen = true; el.referrerPolicy = 'strict-origin-when-cross-origin';
    const lado = 720; el.width = ar >= 1 ? lado : Math.round(lado * ar); el.height = ar >= 1 ? Math.round(lado / ar) : lado;
    el.src = `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&iv_load_policy=3&autoplay=${tocar ? 1 : 0}&start=${inicio | 0}&origin=${encodeURIComponent(location.origin)}`;
    el.addEventListener('load', () => { try { el.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch {} });
    el.style.visibility = 'hidden';
    const quarto = document.getElementById('cena'); if (quarto) quarto.before(el); else document.body.prepend(el);  // antes do quarto: aparece pelo buraco
    yt = { el, id, estado: tocar ? 3 : -1, t: inicio | 0, dur: 0, mudo: false, cheio: false, ar };
  }
  function ytCheio(sim) {
    if (!yt) sim = false; if (yt) { yt.cheio = sim; yt.el.classList.toggle('cheio', sim); }
    fecharCheio.hidden = !sim; if (sim) ui.hidden = true;
  }
  addEventListener('message', (e) => {
    if (!yt || e.source !== yt.el.contentWindow) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d.event) return; const antes = yt.estado;
    if (d.event === 'onReady') ytEnviar('setVolume', [Math.round(video.volume * 100)]);
    else if (d.event === 'onStateChange') yt.estado = d.info;
    else if (d.event === 'onError') { aviso && aviso('Esse vídeo do YouTube não deixa ser passado fora do site deles (ou foi removido). Tente outro link.'); yt.estado = -1; }
    else if (d.event === 'infoDelivery' || d.event === 'initialDelivery') {
      const i = d.info || {};
      if (i.playerState != null) yt.estado = i.playerState; if (i.currentTime != null) yt.t = i.currentTime;
      if (i.duration) yt.dur = i.duration; if (i.muted != null) yt.mudo = i.muted;
      const titulo = i.videoData && i.videoData.title;
      if (titulo && atual && atual.tipo === 'youtube' && atual.nome !== titulo) { atual.nome = titulo; guardarEstado(); painel(); }
    }
    if (yt.estado !== antes) painel();
  });

  // ---------- reprodução ----------
  const video = document.createElement('video'); video.playsInline = true; video.preload = 'auto'; video.setAttribute('webkit-playsinline', '');
  let ligado = false, atual = null, url = null, textura = null, k = 0, slides = null, n = 1, gerando = 0;
  function trocarTextura(t) { if (textura && textura !== espera && textura !== t) textura.dispose(); textura = t; telaMat.map = t; telaMat.needsUpdate = true; }
  function soltar() {
    video.pause(); video.removeAttribute('src'); video.load(); ytSoltar();
    if (url) URL.revokeObjectURL(url); url = null; if (slides && slides.fechar) slides.fechar(); slides = null;
  }
  // ---------- apresentações: PDF, PowerPoint ou várias imagens viram "slides" ----------
  async function fontePdf(blob) {
    const lib = await carregarPdfJs(), pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    return { total: pdf.numPages, fechar: () => pdf.destroy(), anotacoes: async () => '',
      desenhar: async (i) => { const pg = await pdf.getPage(i + 1), v = pg.getViewport({ scale: 1 }), s = 1600 / Math.max(v.width, v.height), vp = pg.getViewport({ scale: s });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise; return c; } };
  }
  async function fontePptx(blob) { const a = await abrirPptx(blob); if (!a.total) throw new Error('vazio'); return { total: a.total, anotacoes: (i) => a.anotacoes(i), desenhar: (i) => a.desenhar(i, 1600) }; }
  function fonteImagens(blobs) {
    return { total: blobs.length, anotacoes: async () => '',
      desenhar: async (i) => { const bmp = await createImageBitmap(blobs[i], { imageOrientation: 'from-image' }), s = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.(); return c; } };
  }
  const cacheSlides = new Map();
  async function slideCanvas(i) {
    if (!cacheSlides.has(i)) cacheSlides.set(i, slides.desenhar(i).catch(() => null));
    if (cacheSlides.size > 5) for (const key of [...cacheSlides.keys()]) if (Math.abs(key - i) > 2) cacheSlides.delete(key);
    return cacheSlides.get(i);
  }
  async function irSlide(m) {
    if (!slides) return;
    n = Math.max(1, Math.min(slides.total, m)); const pedido = ++gerando;
    const c = await slideCanvas(n - 1); if (pedido !== gerando || !c) return;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; trocarTextura(t); encaixar(c.width / c.height);
    if (n < slides.total) slideCanvas(n);              // já prepara o próximo
    if (atual) { atual.pagina = n; guardarEstado(); }
    painel(); apresentacao.atualizar(); aoMudarSlide && aoMudarSlide(n);
  }

  async function carregar(arq, { tocar = true, paginaInicial = 1 } = {}) {
    soltar(); cacheSlides.clear();
    if (arq.youtube) {
      const ar = arq.vertical ? 9 / 16 : 16 / 9;
      atual = { ...arq, tipo: 'youtube', pagina: 1 }; trocarTextura(telaYt); encaixar(ar);
      if (ligado) ytMontar(arq.youtube, arq.inicio || 0, tocar, ar);
      painel(); return true;
    }
    const lista = arq.blobs || null, tipo = lista ? 'imagens' : tipoProjetavel(arq.mime, arq.nome);
    if (!tipo) { aviso && aviso(naoAbre(arq.nome) || 'O projetor passa vídeo, imagem, apresentação (PowerPoint ou PDF) e áudio. Esse arquivo não dá.'); return false; }
    atual = { ...arq, tipo, pagina: paginaInicial };
    try {
      if (tipo === 'video' || tipo === 'audio') {
        url = URL.createObjectURL(arq.blob); video.src = url; video.loop = !!arq.repetir;
        await new Promise((ok) => { video.onloadedmetadata = ok; video.onerror = ok; });
        if (video.error) { aviso && aviso('Esse vídeo não abre neste navegador. Tente MP4 (H.264) ou WebM.'); atual = null; trocarTextura(espera); painel(); return false; }
        if (tipo === 'video') { const t = new THREE.VideoTexture(video); t.colorSpace = THREE.SRGBColorSpace; trocarTextura(t); encaixar((video.videoWidth || 16) / (video.videoHeight || 9)); }
        else { trocarTextura(telaAudio(arq.nome)); encaixar(16 / 9); }
        if (tocar) video.play().catch(() => {});
      } else if (tipo === 'imagem') {
        url = URL.createObjectURL(arq.blob); const img = new Image(); img.src = url; await img.decode();
        const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; trocarTextura(t); encaixar(img.naturalWidth / img.naturalHeight);
      } else {
        slides = tipo === 'pdf' ? await fontePdf(arq.blob) : tipo === 'pptx' ? await fontePptx(arq.blob) : fonteImagens(lista);
        await irSlide(paginaInicial);
      }
    } catch {
      aviso && aviso(tipo === 'pdf' ? 'Esse PDF não abriu (o leitor de PDF precisa de internet na primeira vez).' : tipo === 'pptx' ? 'Essa apresentação não abriu. Tente salvar de novo como .pptx ou como PDF.' : 'Esse arquivo não abriu.');
      atual = null; slides = null; trocarTextura(espera); encaixar(16 / 9); painel(); return false;
    }
    painel(); return true;
  }
  async function guardarEstado() {
    try { await guarda.salvarExtra({ id: 'projetor', youtube: atual?.youtube || null, inicio: yt ? Math.floor(yt.t) : atual?.inicio || 0, vertical: !!atual?.vertical, blob: atual && !atual.blobs ? atual.blob : null, blobs: atual?.blobs || null, nome: atual?.nome || '', mime: atual?.mime || '', pagina: atual?.pagina || 1, ligado, em: Date.now() }); }
    catch { aviso && aviso('O arquivo é grande demais para guardar no aparelho. Ele projeta agora, mas não fica salvo.'); }
  }
  async function projetar(arq) {
    ligar(true);
    const ok = await carregar(arq.blobs ? { nome: arq.nome, blobs: arq.blobs } : { nome: arq.nome, mime: arq.mime || arq.blob.type || '', blob: arq.blob });
    if (ok) { guardarEstado(); abrirPainel(); }
  }
  function ligar(sim) {
    ligado = sim; if (!sim) { video.pause(); ytEnviar('pauseVideo'); ytCheio(false); }
    if (sim && !atual) trocarTextura(espera);
    if (sim && atual && atual.tipo === 'youtube' && !yt) ytMontar(atual.youtube, atual.inicio || 0, false, atual.vertical ? 9 / 16 : 16 / 9);
    guardarEstado(); painel();
  }
  function passarYoutube(txt) {
    const v = idYoutube(txt);
    if (!v) { aviso && aviso('Esse link não parece ser de um vídeo do YouTube. Copie o link pelo botão Compartilhar do vídeo.'); return; }
    ligado = true; carregar({ nome: 'Vídeo do YouTube', youtube: v.id, inicio: v.inicio, vertical: v.vertical }, { tocar: true }).then(() => { guardarEstado(); painel(); });
  }
  (async () => {
    try {
      const r = await guarda.extra('projetor');
      if (r && r.youtube) await carregar({ nome: r.nome || 'Vídeo do YouTube', youtube: r.youtube, inicio: r.inicio || 0, vertical: !!r.vertical }, { tocar: false });
      else if (r && (r.blob || (r.blobs && r.blobs.length))) await carregar(r.blobs ? { nome: r.nome, blobs: r.blobs } : { nome: r.nome, mime: r.mime, blob: r.blob }, { tocar: false, paginaInicial: r.pagina || 1 });
      else trocarTextura(espera);
      if (r && r.ligado) { ligado = true; if (atual && atual.tipo === 'youtube') ytMontar(atual.youtube, atual.inicio || 0, false, atual.vertical ? 9 / 16 : 16 / 9); }
    } catch { trocarTextura(espera); }
    painel();
  })();

  // ---------- painel de controle ----------
  const ui = document.createElement('div'); ui.id = 'projetorUI'; ui.className = 'vidro'; ui.hidden = true;
  ui.innerHTML = `<div class="cab"><b>Projetor</b><button data-a="ligar"></button><button data-a="fechar" aria-label="Fechar">✕</button></div>
    <p class="arquivo"></p>
    <div class="midia"><button data-a="play" class="forte"></button><input type="range" class="busca" min="0" max="1000" value="0" aria-label="Posição"><span class="tempo"></span></div>
    <div class="midia2"><button data-a="som"></button><input type="range" class="volume" min="0" max="100" value="80" aria-label="Volume"><button data-a="repetir">Repetir</button><button data-a="voltar10">−10 s</button><button data-a="avancar10">+10 s</button><button data-a="cheio">Tela cheia</button></div>
    <div class="paginas"><button data-a="ant" aria-label="Slide anterior">‹ Voltar</button><span class="pag"></span><button data-a="prox" aria-label="Próximo slide">Avançar ›</button><button data-a="apresentar" class="forte">Apresentar</button></div>
    <div class="linha"><button data-a="escolher" class="forte">Escolher arquivo</button><button data-a="assistir">Assistir</button><button data-a="tirar">Tirar arquivo</button></div>
    <div class="yt"><input type="url" inputmode="url" placeholder="Cole aqui um link do YouTube" aria-label="Link do YouTube"><button data-a="yt" class="forte">Passar</button></div>
    <p class="dica">Vídeo, imagem, áudio ou apresentação: PowerPoint (.pptx), PDF ou várias imagens de uma vez. Também dá para abrir uma caixa e tocar em <b>Projetar</b>.</p>
    <input type="file" multiple accept="video/*,image/*,audio/*,application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.ppt,.odp,.key" hidden>`;
  document.body.append(ui);
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => ui.querySelector(s), arqEl = ui.querySelector('input[type=file]');
  video.volume = 0.8;
  let arrastandoBusca = false, aoAssistir = null, aoApresentar = null, aoMudarSlide = null, aoLuz = null;
  function painel() {
    $('[data-a=ligar]').textContent = ligado ? 'Desligar' : 'Ligar'; $('[data-a=ligar]').className = ligado ? '' : 'forte';
    $('.arquivo').innerHTML = atual ? `<b>${esc(atual.nome)}</b>` : 'Nenhum arquivo no projetor.';
    const ehYt = atual && atual.tipo === 'youtube', midia = atual && (atual.tipo === 'video' || atual.tipo === 'audio' || ehYt);
    $('.midia').hidden = $('.midia2').hidden = !midia; $('.paginas').hidden = !slides;
    $('[data-a=play]').textContent = (ehYt ? !ytTocando() : video.paused) ? 'Tocar' : 'Pausar';
    $('[data-a=som]').textContent = (ehYt ? yt?.mudo : video.muted) ? 'Ligar som' : 'Sem som';
    $('[data-a=repetir]').hidden = !!ehYt; $('[data-a=cheio]').hidden = !ehYt;
    $('[data-a=repetir]').classList.toggle('on', video.loop);
    if (slides) $('.pag').textContent = `${n} / ${slides.total}`;
    $('[data-a=tirar]').hidden = !atual; $('[data-a=assistir]').hidden = !atual || !!slides;
  }
  ui.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (a === 'fechar') ui.hidden = true;
    else if (a === 'ligar') ligar(!ligado);
    else if (a === 'escolher') arqEl.click();
    else if (a === 'yt') { const c = $('.yt input'); passarYoutube(c.value); c.value = ''; }
    else if (a === 'cheio') { if (!ligado) ligar(true); ytCheio(true); }
    else if (atual && atual.tipo === 'youtube' && ['play', 'som', 'voltar10', 'avancar10'].includes(a)) {
      if (!ligado) ligar(true);
      if (a === 'play') { if (ytTocando()) { ytEnviar('pauseVideo'); yt.estado = 2; } else { ytEnviar('playVideo'); if (yt) yt.estado = 3; } }
      else if (a === 'som') { ytEnviar(yt?.mudo ? 'unMute' : 'mute'); if (yt) yt.mudo = !yt.mudo; }
      else if (yt) { const t = Math.max(0, yt.t + (a === 'voltar10' ? -10 : 10)); ytEnviar('seekTo', [t, true]); yt.t = t; }
    }
    else if (a === 'play') { if (!ligado) ligar(true); if (video.paused) video.play().catch(() => {}); else video.pause(); }
    else if (a === 'som') video.muted = !video.muted;
    else if (a === 'repetir') video.loop = !video.loop;
    else if (a === 'voltar10') video.currentTime = Math.max(0, video.currentTime - 10);
    else if (a === 'avancar10') video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    else if (a === 'ant') irSlide(n - 1);
    else if (a === 'prox') irSlide(n + 1);
    else if (a === 'apresentar') apresentacao.abrir();
    else if (a === 'assistir') { if (!ligado) ligar(true); if (atual && atual.tipo === 'youtube') { if (!ytTocando()) { ytEnviar('playVideo'); if (yt) yt.estado = 3; } aoAssistir && aoAssistir(); }
      else if (atual && atual.tipo !== 'imagem' && video.paused) video.play().catch(() => {}); aoAssistir && aoAssistir(); }
    else if (a === 'tirar') { soltar(); atual = null; trocarTextura(espera); encaixar(16 / 9); guardarEstado(); }
    painel();
  });
  function deArquivos(files) {
    if (!files.length) return;
    const imgs = files.filter((f) => /^image\//.test(f.type));
    if (files.length > 1 && imgs.length === files.length) {       // várias imagens = apresentação, na ordem do nome
      imgs.sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true }));
      projetar({ nome: `${imgs.length} imagens`, blobs: imgs });
    } else projetar({ nome: files[0].name, mime: files[0].type, blob: files[0] });
  }
  $('.yt input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); passarYoutube(e.target.value); e.target.value = ''; } });
  arqEl.addEventListener('change', () => { const f = [...arqEl.files]; arqEl.value = ''; deArquivos(f); });
  const busca = $('.busca');
  busca.addEventListener('input', () => { arrastandoBusca = true; if (atual && atual.tipo === 'youtube') { if (yt && yt.dur) { yt.t = (busca.value / 1000) * yt.dur; ytEnviar('seekTo', [yt.t, true]); } return; } if (video.duration) video.currentTime = (busca.value / 1000) * video.duration; });
  busca.addEventListener('change', () => { arrastandoBusca = false; });
  $('.volume').addEventListener('input', (e) => { video.volume = e.target.value / 100; video.muted = false; ytEnviar('setVolume', [+e.target.value]); if (yt && yt.mudo) { ytEnviar('unMute'); yt.mudo = false; } painel(); });
  for (const ev of ['play', 'pause', 'ended', 'volumechange']) video.addEventListener(ev, painel);
  ui.addEventListener('dragover', (e) => e.preventDefault());
  ui.addEventListener('drop', (e) => { e.preventDefault(); deArquivos([...(e.dataTransfer?.files || [])]); });
  function abrirPainel() { ui.hidden = false; painel(); }

  // ---------- modo apresentação ----------
  const apresentacao = (() => {
    const el = document.createElement('div'); el.id = 'apresentacao'; el.hidden = true;
    el.innerHTML = `<button class="lado esq" data-a="ant" aria-label="Slide anterior">‹</button><button class="lado dir" data-a="prox" aria-label="Próximo slide">›</button>
      <div class="barraAp vidro"><button data-a="sair">Sair</button><button data-a="ant">‹ Voltar</button><span class="cont"></span><button data-a="prox" class="forte">Avançar ›</button><button data-a="luz">Luz</button><button data-a="notas">Anotações</button></div>
      <div class="notasAp vidro" hidden></div>`;
    document.body.append(el);
    const cont = el.querySelector('.cont'), notasEl = el.querySelector('.notasAp');
    let verNotas = false, x0 = null;
    async function atualizar() {
      if (el.hidden || !slides) return;
      cont.textContent = `${n} / ${slides.total}`;
      el.querySelector('.lado.esq').disabled = n <= 1; el.querySelector('.lado.dir').disabled = n >= slides.total;
      if (verNotas) { const t = await slides.anotacoes(n - 1); notasEl.textContent = t || 'Sem anotações neste slide.'; }
    }
    function abrir() {
      if (!slides) return; if (!ligado) ligar(true);
      ui.hidden = true; el.hidden = false; document.body.classList.add('apresentando'); atualizar(); aoApresentar && aoApresentar(true);
    }
    function sair() { el.hidden = true; document.body.classList.remove('apresentando'); notasEl.hidden = true; verNotas = false; aoApresentar && aoApresentar(false); }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
      if (a === 'ant') irSlide(n - 1); else if (a === 'prox') irSlide(n + 1); else if (a === 'sair') sair();
      else if (a === 'luz') aoLuz && aoLuz();
      else if (a === 'notas') { verNotas = !verNotas; notasEl.hidden = !verNotas; b.classList.toggle('on', verNotas); atualizar(); }
    });
    // deslizar o dedo: para a esquerda avança, para a direita volta
    el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) irSlide(n + (dx < 0 ? 1 : -1)); });
    addEventListener('keydown', (e) => {
      if (el.hidden) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'KeyN'].includes(e.key) || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); irSlide(n + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'KeyP'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); irSlide(n - 1); }
      else if (e.key === 'Home') irSlide(1); else if (e.key === 'End') irSlide(slides ? slides.total : 1);
      else if (e.key === 'Escape') sair();
    }, true);
    return { abrir, sair, atualizar, aberta: () => !el.hidden };
  })();

  // ---------- a cada quadro ----------
  const cantos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  // coloca o player do YouTube exatamente sobre a imagem da parede (homografia: retângulo -> quadrilátero na tela)
  function posicionarYt(camera, oculto, brilhoSala) {
    const el = yt.el; furo.visible = false;
    if (yt.cheio) { el.style.visibility = 'visible'; return; }
    if (!camera || oculto || !ligado || k < 0.3) { el.style.visibility = 'hidden'; return; }
    const W = innerWidth, H = innerHeight, cx = tela.x, cy = tela.y, z = tela.z + 0.006, l = largura / 2, a = altura / 2;
    cantos[0].set(cx - l, cy + a, z); cantos[1].set(cx + l, cy + a, z); cantos[2].set(cx + l, cy - a, z); cantos[3].set(cx - l, cy - a, z);
    const P = [];
    for (const c of cantos) {
      if (camera.position.z <= z) { el.style.visibility = 'hidden'; return; }
      c.project(camera); if (c.z > 1 || c.z < -1) { el.style.visibility = 'hidden'; return; }
      P.push([(c.x + 1) / 2 * W, (1 - c.y) / 2 * H]);
    }
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1; if (Math.abs(den) < 1e-9) { el.style.visibility = 'hidden'; return; }
    const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
    const A = x1 - x0 + g * x1, B = x3 - x0 + h * x3, D = y1 - y0 + g * y1, E = y3 - y0 + h * y3;
    const w = el.width, hh = el.height;
    el.style.transform = `matrix3d(${A / w},${D / w},0,${g / w},${B / hh},${E / hh},0,${h / hh},0,0,1,0,${x0},${y0},0,1)`;
    el.style.opacity = k.toFixed(3);
    const lavado = 0.4 * brilhoSala; furoMat.opacity = lavado; furoMat.color.setRGB(0.8 * lavado, 0.77 * lavado, 0.72 * lavado);   // lâmpada acesa: imagem lavada, como no projetor
    el.style.visibility = 'visible'; furo.visible = true;
  }
  function atualizar(dt, brilhoSala) {
    k += ((ligado ? 1 : 0) - k) * Math.min(1, dt * 4);
    telaMat.opacity = k * (0.5 + 0.5 * (1 - brilhoSala));          // com a lâmpada acesa a imagem fica lavada
    telaMat.color.setScalar(0.95 * (ligado && k < 0.98 ? 0.85 + 0.15 * Math.random() : 1));
    fachoMat.opacity = k * (0.012 + 0.05 * (1 - brilhoSala));
    spot.intensity = k * 4; vidroLente.emissiveIntensity = k * 2.2; ledMat.color.setHex(ligado ? 0x37c45a : 0xd23b3b);
    imagem.visible = facho.visible = k > 0.003; if (furo.visible) imagem.visible = false;   // com o YouTube aparecendo, o cartaz some
    if (!ui.hidden && atual && atual.tipo === 'youtube' && yt) {
      if (!arrastandoBusca && yt.dur) busca.value = Math.round((yt.t / yt.dur) * 1000);
      $('.tempo').textContent = `${tempo(yt.t)} / ${tempo(yt.dur)}`;
    } else if (!ui.hidden && atual && (atual.tipo === 'video' || atual.tipo === 'audio')) {
      if (!arrastandoBusca && video.duration) busca.value = Math.round((video.currentTime / video.duration) * 1000);
      $('.tempo').textContent = `${tempo(video.currentTime)} / ${tempo(video.duration)}`;
    }
  }
  return { g, aparelho, imagem, atualizar, projetar, abrirPainel, painelAberto: () => !ui.hidden, ligado: () => ligado, tocando: () => ligado && (atual && atual.tipo === 'youtube' ? ytTocando() : !video.paused),
    youtubeCheio: () => !!yt && yt.cheio, posicionarTela: (camera, oculto, brilhoSala) => { if (yt) posicionarYt(camera, oculto, brilhoSala); else furo.visible = false; },
    apresentando: () => apresentacao.aberta(), largura: () => largura,
    set aoAssistir(f) { aoAssistir = f; }, set aoApresentar(f) { aoApresentar = f; }, set aoMudarSlide(f) { aoMudarSlide = f; }, set aoLuz(f) { aoLuz = f; } };
}
