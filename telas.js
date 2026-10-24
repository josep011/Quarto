// Telas do computador e da TV: abrem por cima do quarto (o quarto para de ser desenhado enquanto isso, o que poupa bateria).
import * as THREE from 'three';
import * as guarda from './guarda.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ícones de pixel (32x32) desenhados com retângulos
const px = (rects) => `<svg viewBox="0 0 32 32" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true">${rects.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')}</svg>`;
const ICONES = {
  caixas: px([[4, 10, 24, 18, '#3a2a1c'], [5, 11, 22, 16, '#c99a68'], [3, 7, 26, 5, '#3a2a1c'], [4, 8, 24, 3, '#d9ad7c'], [12, 15, 8, 4, '#f4efe2'], [12, 15, 8, 1, '#3a2a1c']]),
  bandeja: px([[3, 18, 26, 9, '#3a2a1c'], [4, 19, 24, 7, '#9c6a3e'], [7, 10, 18, 9, '#3a2a1c'], [8, 11, 16, 8, '#fbfaf6'], [10, 13, 10, 1, '#999'], [10, 15, 12, 1, '#999'], [9, 7, 16, 4, '#fff1a8'], [9, 7, 16, 1, '#3a2a1c']]),
  bloco: px([[6, 4, 20, 25, '#3a2a1c'], [7, 5, 18, 23, '#fffbe0'], [9, 10, 14, 1, '#8aa0c8'], [9, 14, 14, 1, '#8aa0c8'], [9, 18, 14, 1, '#8aa0c8'], [9, 22, 10, 1, '#8aa0c8'], [8, 2, 2, 5, '#555'], [14, 2, 2, 5, '#555'], [20, 2, 2, 5, '#555']]),
  buscar: px([[5, 5, 14, 14, '#23338f'], [7, 7, 10, 10, '#bfe0ff'], [8, 8, 3, 3, '#fff'], [17, 17, 4, 4, '#555'], [20, 20, 8, 4, '#8a5a2a'], [22, 22, 6, 6, '#8a5a2a']]),
  calendario: px([[4, 6, 24, 22, '#3a2a1c'], [5, 7, 22, 20, '#fbfaf6'], [5, 7, 22, 6, '#c8423c'], [9, 3, 2, 6, '#555'], [21, 3, 2, 6, '#555'], [8, 16, 3, 3, '#777'], [14, 16, 3, 3, '#777'], [20, 16, 3, 3, '#c8423c'], [8, 21, 3, 3, '#777'], [14, 21, 3, 3, '#777']]),
  desligar: px([[8, 8, 16, 16, '#c8423c'], [10, 10, 12, 12, '#e8e2d0'], [15, 6, 2, 10, '#c8423c'], [14, 5, 4, 2, '#e8e2d0']]),
};

const GATO = (() => {      // o mesmo gatinho de pixel da tela do monitor
  const P = ['..G.......G..', '.GPG.....GPG.', '.GGGGGGGGGGG.', 'GGGGGWWWGGGGG', 'GGKKGWWWGKKGG', 'GGKKGWWWGKKGG', 'GGGGWWRWWGGGG', '.GGWWWWWWWGG.', '..GGWWWWWGG..', '....GGGGG....'];
  const C = { G: '#77787f', P: '#e89aa8', W: '#f6f4ee', K: '#16161a', R: '#e2748a' };
  let r = ''; P.forEach((l, y) => [...l].forEach((c, x) => { if (C[c]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${C[c]}"/>`; }));
  return `<svg viewBox="0 0 13 10" shape-rendering="crispEdges">${r}</svg>`;
})();

// ======================= COMPUTADOR =======================
export function criarTelaPc({ aoCaixas, aoBandeja, aoBuscar, aoDesligar, aoMandarNota, aviso }) {
  const ui = document.createElement('div'); ui.id = 'telaPc'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `
    <div class="topo"><b>Computador</b><span class="direita"><button data-a="fechar" class="forte">Fechar</button></span></div>
    <div class="molde"><div class="vidro"><div class="area"></div></div>
      <div class="queixo"><span class="friso"></span><i class="led" aria-hidden="true"></i><button data-a="desligar" class="liga" aria-label="Desligar o computador" title="Desligar">⏻</button></div></div>`;
  document.body.append(ui);
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') voltarOuFechar(); });
  const area = ui.querySelector('.area');
  let tela = 'mesa', relogio = null, salvarT = null, textoBloco = '';
  const janela = (titulo, corpo, { voltar = true } = {}) => `<div class="jan"><div class="barraJ">${voltar ? '<button data-a="mesa" class="bj" aria-label="Voltar">◂</button>' : '<span class="bj vazio"></span>'}<b>${esc(titulo)}</b><span class="bj vazio"></span></div><div class="corpoJ">${corpo}</div></div>`;
  function mesa() {
    tela = 'mesa'; pararRelogio();
    const itens = [['caixas', 'Minhas caixas'], ['bandeja', 'Bandeja'], ['bloco', 'Bloco de notas'], ['buscar', 'Onde guardei?'], ['calendario', 'Calendário'], ['desligar', 'Desligar']];
    area.innerHTML = janela('Gerenciador do Quarto', `<div class="icones">${itens.map(([id, n]) => `<button data-app="${id}">${ICONES[id]}<span>${n}</span></button>`).join('')}</div>`, { voltar: false });
  }
  async function bloco() {
    tela = 'bloco';
    area.innerHTML = janela('Bloco de notas', `<div class="menuJ"><button data-a="novo">Novo</button><button data-a="mandar">Mandar para a bandeja</button></div>
      <textarea spellcheck="true" placeholder="Escreva o que está na cabeça…"></textarea><p class="rodapeJ">Fica salvo aqui no computador sozinho.</p>`);
    const ta = area.querySelector('textarea');
    try { const r = await guarda.extra('pc-bloco'); textoBloco = r?.texto || ''; } catch { textoBloco = ''; }
    ta.value = textoBloco; setTimeout(() => ta.focus(), 50);
    ta.addEventListener('input', () => { textoBloco = ta.value; clearTimeout(salvarT); salvarT = setTimeout(salvarBloco, 600); });
  }
  const salvarBloco = () => guarda.salvarExtra({ id: 'pc-bloco', texto: textoBloco, em: Date.now() }).catch(() => {});
  function calendario() {
    tela = 'calendario';
    const hoje = new Date(), ano = hoje.getFullYear(), mes = hoje.getMonth(), primeiro = new Date(ano, mes, 1).getDay(), dias = new Date(ano, mes + 1, 0).getDate();
    let cel = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<b>${d}</b>`).join('');
    for (let i = 0; i < primeiro; i++) cel += '<span></span>';
    for (let d = 1; d <= dias; d++) cel += `<span class="${d === hoje.getDate() ? 'hoje' : ''}">${d}</span>`;
    const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    area.innerHTML = janela('Calendário', `<div class="relogio"></div><p class="dataLonga"></p><h4>${esc(nomeMes)}</h4><div class="mes">${cel}</div>`);
    const tic = () => { const a = new Date(); const r = area.querySelector('.relogio'); if (!r) return pararRelogio();
      r.textContent = a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); area.querySelector('.dataLonga').textContent = a.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); };
    tic(); pararRelogio(); relogio = setInterval(tic, 5000);
  }
  function pararRelogio() { if (relogio) clearInterval(relogio); relogio = null; }
  function abertura() {       // tela de abertura enquanto o computador liga
    tela = 'abertura';
    area.innerHTML = `<div class="abertura"><div class="gatoPx" aria-hidden="true">${GATO}</div><p class="n1">NOSSO</p><p class="n2">QUARTO</p><p class="v">Versão 1.0</p><p class="c">Copyright © Nosso Quarto 2026<br>Todos os direitos reservados.</p></div>`;
    setTimeout(() => { if (tela === 'abertura' && !ui.hidden) mesa(); }, 1800);
  }
  function fechar() { if (tela === 'bloco') { clearTimeout(salvarT); salvarBloco(); } pararRelogio(); ui.hidden = true; }
  function voltarOuFechar() { if (tela === 'mesa' || tela === 'abertura') fechar(); else { if (tela === 'bloco') salvarBloco(); mesa(); } }
  ui.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const app = b.dataset.app, a = b.dataset.a;
    if (a === 'fechar') fechar();
    else if (a === 'mesa') voltarOuFechar();
    else if (a === 'desligar' || app === 'desligar') { fechar(); aoDesligar(); }
    else if (app === 'caixas') { fechar(); aoCaixas(); }
    else if (app === 'bandeja') { fechar(); aoBandeja(); }
    else if (app === 'buscar') { fechar(); aoBuscar(); }
    else if (app === 'bloco') bloco();
    else if (app === 'calendario') calendario();
    else if (a === 'novo') { const ta = area.querySelector('textarea'); if (ta.value.trim() && !b.dataset.certeza) { b.dataset.certeza = '1'; b.textContent = 'Apagar tudo?'; setTimeout(() => { b.textContent = 'Novo'; delete b.dataset.certeza; }, 2500); return; } ta.value = ''; textoBloco = ''; salvarBloco(); ta.focus(); b.textContent = 'Novo'; delete b.dataset.certeza; }
    else if (a === 'mandar') {
      const ta = area.querySelector('textarea'), t = ta.value.trim(); if (!t) { aviso('O bloco está vazio.'); return; }
      if (await aoMandarNota(t)) { ta.value = ''; textoBloco = ''; salvarBloco(); }
    }
  });
  return {
    abrir({ ligando = false } = {}) { ui.hidden = false; if (ligando) abertura(); else mesa(); },
    fechar, aberta: () => !ui.hidden,
  };
}

// ======================= TV =======================
// Canal VÍDEO 1: o vídeo ou a foto que você escolher (das caixas ou do aparelho). Canal 3: chuvisco, como TV fora do ar.
const CANAIS = ['VÍDEO 1', 'CH 03'];
export function criarTelaTv({ tv3d, aoDesligar, aviso }) {
  const ui = document.createElement('div'); ui.id = 'telaTv'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `
    <div class="topo"><b>TV</b><span class="direita"><button data-a="fechar" class="forte">Fechar</button></span></div>
    <div class="molde"><div class="vidro">
        <video playsinline preload="metadata"></video><img alt="" hidden><canvas class="chuvisco" width="128" height="96" hidden></canvas>
        <div class="semFita"><p>Sem fita.</p><p class="pequeno">Toque em “Escolher vídeo” ou use “Ver na TV” num vídeo das suas caixas.</p></div>
        <div class="osd"></div>
      </div>
      <div class="faixa"><i class="botaoLiga"></i><span class="fenda"></span><span class="grade"></span></div></div>
    <div class="controles">
      <button data-a="chMenos" aria-label="Canal anterior">◂ CH</button><button data-a="chMais" aria-label="Próximo canal">CH ▸</button>
      <button data-a="tocar" class="tocar" aria-label="Tocar ou pausar">▶</button>
      <label class="vol" title="Volume">🔊<input type="range" min="0" max="1" step="0.05" value="0.8" aria-label="Volume"></label>
      <button data-a="escolher">Escolher vídeo</button><button data-a="desligar" class="perigo">Desligar</button>
    </div>
    <input type="file" accept="video/*,image/*" hidden>`;
  document.body.append(ui);
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => {
    e.stopPropagation(); if (ev !== 'keydown') return;
    if (e.key === 'Escape') fechar(); else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') trocarCanal(1); else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') trocarCanal(-1); else if (e.key === ' ') { e.preventDefault(); tocarPausar(); }
  });
  const video = ui.querySelector('video'), img = ui.querySelector('img'), chuv = ui.querySelector('.chuvisco'), osd = ui.querySelector('.osd'), semFita = ui.querySelector('.semFita');
  const btTocar = ui.querySelector('.tocar'), vol = ui.querySelector('.vol input'), arq = ui.querySelector('input[type=file]');
  const ctx = chuv.getContext('2d'), ruido = ctx.createImageData(128, 96);
  let canal = 0, atual = null, url = null, texVideo = null, texImagem = null, texChuv = null, raf = 0, tOsd = null, tChuv = 0;
  video.volume = 0.8;
  function desenharChuvisco() {
    const d = ruido.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(ruido, 0, 0);
    if (texChuv) texChuv.needsUpdate = true;
  }
  function mostrarOsd() { osd.textContent = CANAIS[canal]; osd.hidden = false; clearTimeout(tOsd); tOsd = setTimeout(() => { osd.hidden = true; }, 2500); }
  function sincronizar() {         // o que aparece na TV do quarto e aqui
    const temVideo = atual && /^video\//.test(atual.mime), temImg = atual && /^image\//.test(atual.mime);
    video.hidden = !(canal === 0 && temVideo); img.hidden = !(canal === 0 && temImg); chuv.hidden = canal !== 1; semFita.hidden = !(canal === 0 && !atual);
    btTocar.disabled = !(canal === 0 && temVideo);
    if (canal !== 0 && !video.paused) video.pause();
    if (canal === 1) { if (!texChuv) { texChuv = new THREE.CanvasTexture(chuv); texChuv.colorSpace = THREE.SRGBColorSpace; texChuv.magFilter = THREE.NearestFilter; } desenharChuvisco(); tv3d.mostrar(texChuv, 4 / 3); }
    else if (temVideo) { if (!texVideo) { texVideo = new THREE.VideoTexture(video); texVideo.colorSpace = THREE.SRGBColorSpace; } tv3d.mostrar(texVideo, (video.videoWidth / video.videoHeight) || 16 / 9); }
    else if (temImg && texImagem) tv3d.mostrar(texImagem, texImagem.image.width / texImagem.image.height);
    else tv3d.mostrar(null);
    btTocar.textContent = video.paused ? '▶' : '❚❚';
  }
  function trocarCanal(d) { canal = (canal + d + CANAIS.length) % CANAIS.length; sincronizar(); mostrarOsd(); laco(); }
  function tocarPausar() { if (btTocar.disabled) return; if (video.paused) video.play().catch(() => {}); else video.pause(); }
  video.addEventListener('play', () => { btTocar.textContent = '❚❚'; });
  video.addEventListener('pause', () => { btTocar.textContent = '▶'; });
  video.addEventListener('loadedmetadata', sincronizar);
  vol.addEventListener('input', () => { video.volume = +vol.value; });
  async function carregar(it, { tocar = true, salvar = true } = {}) {
    if (!it?.blob || !/^(video|image)\//.test(it.mime || '')) { aviso('A TV mostra vídeos e fotos.'); return; }
    video.pause(); if (url) URL.revokeObjectURL(url); if (texImagem) { texImagem.dispose(); texImagem = null; }
    atual = { nome: it.nome, mime: it.mime, blob: it.blob }; url = URL.createObjectURL(it.blob); canal = 0;
    if (/^video\//.test(it.mime)) { img.removeAttribute('src'); video.src = url; if (tocar) video.play().catch(() => {}); }
    else {
      video.removeAttribute('src'); video.load(); img.src = url;
      try { await img.decode(); texImagem = new THREE.Texture(img); texImagem.colorSpace = THREE.SRGBColorSpace; texImagem.needsUpdate = true; } catch { /* imagem quebrada */ }
    }
    sincronizar(); mostrarOsd();
    if (salvar) guarda.salvarExtra({ id: 'tv', blob: it.blob, nome: it.nome, mime: it.mime, em: Date.now() }).catch(() => {});
  }
  arq.addEventListener('change', () => { const f = arq.files[0]; arq.value = ''; if (f) carregar({ nome: f.name, mime: f.type, blob: f }); });
  // chuvisco aqui na tela cheia (o quarto não é desenhado enquanto ela está aberta)
  function laco() {
    cancelAnimationFrame(raf); if (ui.hidden || canal !== 1) return;
    let ult = 0; const passo = (t) => { if (ui.hidden || canal !== 1) return; if (t - ult > 50) { desenharChuvisco(); ult = t; } raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
  }
  function fechar() { ui.hidden = true; cancelAnimationFrame(raf); }
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'fechar') fechar();
    else if (a === 'chMais') trocarCanal(1); else if (a === 'chMenos') trocarCanal(-1);
    else if (a === 'tocar') tocarPausar();
    else if (a === 'escolher') arq.click();
    else if (a === 'desligar') { video.pause(); fechar(); aoDesligar(); }
  });
  // volta com o último vídeo (pausado)
  (async () => { try { const r = await guarda.extra('tv'); if (r?.blob) await carregar(r, { tocar: false, salvar: false }); } catch { /* nada */ } })();
  return {
    abrir() { ui.hidden = false; sincronizar(); mostrarOsd(); laco(); },
    fechar, aberta: () => !ui.hidden, carregar,
    pausar: () => video.pause(),
    // no quarto: vídeo tocando ou chuvisco mexendo precisam de quadros novos
    atualizar(dt, ligada) {
      if (!ligada) return false;
      if (canal === 1) { tChuv += dt; if (tChuv > 0.08) { tChuv = 0; desenharChuvisco(); } return true; }
      return !video.hidden && !video.paused;
    },
  };
}
