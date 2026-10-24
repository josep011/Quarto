// Quadro branco: desenhar e escrever com canetinhas. O desenho aparece no quadro da parede e fica guardado no aparelho.
import * as THREE from 'three';
import * as guarda from './guarda.js';

const CW = 2048;
const CORES = [['Preto', '#1e1e22'], ['Azul', '#2456c4'], ['Vermelho', '#c42f2f'], ['Verde', '#1f8a43']];
const PONTAS = [['Fina', 5], ['Média', 10], ['Grossa', 20]];

export function criarQuadro({ proporcao, aviso }) {
  const CH = Math.round(CW / proporcao);
  const tela = document.createElement('canvas'); tela.width = CW; tela.height = CH; const g = tela.getContext('2d');
  const limpar = (ctx) => { ctx.fillStyle = '#fbfcfd'; ctx.fillRect(0, 0, CW, CH); };
  limpar(g);
  const textura = new THREE.CanvasTexture(tela); textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 8;

  (async () => {      // desenho guardado
    try {
      const r = await guarda.extra('quadro-branco');
      if (r && r.blob) { const img = await createImageBitmap(r.blob); g.drawImage(img, 0, 0, CW, CH); textura.needsUpdate = true; }
    } catch { /* quadro em branco */ }
  })();
  async function salvar() {
    try { const blob = await new Promise((ok) => tela.toBlob(ok, 'image/png')); await guarda.salvarExtra({ id: 'quadro-branco', blob, em: Date.now() }); }
    catch { aviso && aviso('Não deu para guardar o desenho no aparelho.'); }
  }

  // ---------- tela cheia para desenhar ----------
  const ui = document.createElement('div'); ui.id = 'quadroUI2'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `<div class="topo"><b>Quadro branco</b><button data-a="fechar" class="forte">Concluir</button></div>
    <div class="area quadroArea"><canvas></canvas></div>
    <div class="barra">
      <span class="grupo cores">${CORES.map(([n, c], i) => `<button data-cor="${i}" aria-label="${n}" class="bolinha" style="--c:${c}"></button>`).join('')}</span>
      <span class="grupo">${PONTAS.map(([n], i) => `<button data-ponta="${i}">${n}</button>`).join('')}</span>
      <span class="grupo"><button data-a="borracha">Apagador</button><button data-a="desfazer">Desfazer</button><button data-a="limpar">Limpar tudo</button></span>
    </div>
    <div class="confirma" hidden><span>Apagar o quadro inteiro?</span><button data-a="naoLimpar">Não</button><button data-a="simLimpar" class="perigo">Apagar tudo</button></div>`;
  document.body.append(ui);
  const cv = ui.querySelector('canvas'), cx = cv.getContext('2d'), area = ui.querySelector('.area');
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => e.stopPropagation());
  let cor = 0, ponta = 1, borracha = false, k = 1, ox = 0, oy = 0, dpr = 1;
  const historico = [];
  function marcar() {
    ui.querySelectorAll('[data-cor]').forEach((b) => b.classList.toggle('on', !borracha && +b.dataset.cor === cor));
    ui.querySelectorAll('[data-ponta]').forEach((b) => b.classList.toggle('on', +b.dataset.ponta === ponta));
    ui.querySelector('[data-a="borracha"]').classList.toggle('on', borracha);
  }
  function encaixar() {
    dpr = Math.min(devicePixelRatio || 1, 2); const r = area.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    k = Math.min(r.width / CW, r.height / CH) * 0.98; ox = (r.width - CW * k) / 2; oy = (r.height - CH * k) / 2;
  }
  function desenhar() {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    cx.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr); cx.drawImage(tela, 0, 0);
  }
  const noQuadro = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - ox) / k, (e.clientY - r.top - oy) / k]; };
  let traco = null;
  cv.addEventListener('pointerdown', (e) => {
    if (traco) return; cv.setPointerCapture(e.pointerId);
    historico.push(g.getImageData(0, 0, CW, CH)); if (historico.length > 6) historico.shift();
    const [x, y] = noQuadro(e); traco = { id: e.pointerId, x, y };
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = borracha ? '#fbfcfd' : CORES[cor][1]; g.lineWidth = borracha ? 60 : PONTAS[ponta][1] * 1.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.01, y); g.stroke(); desenhar();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!traco || e.pointerId !== traco.id) return;
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    g.beginPath(); g.moveTo(traco.x, traco.y);
    for (const p of pts) { const [x, y] = noQuadro(p); g.lineTo(x, y); traco.x = x; traco.y = y; }
    g.stroke(); desenhar();
  });
  const fim = (e) => { if (traco && e.pointerId === traco.id) { traco = null; textura.needsUpdate = true; } };
  cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cor) { cor = +b.dataset.cor; borracha = false; marcar(); return; }
    if (b.dataset.ponta) { ponta = +b.dataset.ponta; marcar(); return; }
    const a = b.dataset.a;
    if (a === 'fechar') fechar();
    else if (a === 'borracha') { borracha = !borracha; marcar(); }
    else if (a === 'desfazer') { const ant = historico.pop(); if (ant) { g.putImageData(ant, 0, 0); desenhar(); textura.needsUpdate = true; } }
    else if (a === 'limpar') ui.querySelector('.confirma').hidden = false;
    else if (a === 'naoLimpar') ui.querySelector('.confirma').hidden = true;
    else if (a === 'simLimpar') { historico.push(g.getImageData(0, 0, CW, CH)); limpar(g); desenhar(); textura.needsUpdate = true; ui.querySelector('.confirma').hidden = true; }
  });
  addEventListener('resize', () => { if (!ui.hidden) { encaixar(); desenhar(); } });
  function abrir() { ui.hidden = false; encaixar(); desenhar(); marcar(); }
  function fechar() { ui.hidden = true; ui.querySelector('.confirma').hidden = true; textura.needsUpdate = true; salvar(); }
  return { textura, abrir, fechar, aberto: () => !ui.hidden };
}
