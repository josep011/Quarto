// Computador bege dos anos 90 e TV de tubo com DVD/videocassete embaixo, feitos por código a partir das fotos.
// Sem marcas: só o formato, as cores e os detalhes. Medidas em metros; origem no chão do objeto, frente em +z.
// Para ficar leve, as peças fixas de cada material viram uma malha só (menos chamadas de desenho).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex } from './moveis.js';

const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.55, ...extra });
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// junta várias peças do mesmo material numa malha só
function oficina() {
  const porMat = new Map();
  const add = (geo, m, matriz = M()) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(matriz);
    if (!porMat.has(m)) porMat.set(m, []); porMat.get(m).push(g);
  };
  const fechar = (pai, sombra = true) => {
    for (const [m, gs] of porMat) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.castShadow = sombra; me.receiveShadow = true; pai.add(me); }
    porMat.clear();
  };
  return { add, fechar };
}
const caixa = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const arred = (w, h, d, r, s = 2) => new RoundedBoxGeometry(w, h, d, s, r);
const cil = (r, h, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);
// caixa com a traseira menor (corpo de monitor/TV de tubo). Frente em +d/2.
function afunilada(wF, hF, wB, hB, d, dyB = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = p.getZ(i) > 0;
    p.setXYZ(i, p.getX(i) * (f ? wF : wB), p.getY(i) * (f ? hF : hB) + (f ? 0 : dyB), p.getZ(i) * d);
  }
  g.computeVertexNormals(); return g;
}
// vidro de tubo levemente abaulado
function vidro(w, h, bojo) {
  const g = new THREE.PlaneGeometry(w, h, 12, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2); p.setZ(i, bojo * (1 - u * u * 0.85) * (1 - v * v * 0.85)); }
  g.computeVertexNormals(); return g;
}
function tela(w, h, emissiva = 1) {       // material de tela: liga e desliga só mudando o brilho (sem recompilar)
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0, userData: { max: emissiva } });
}
// moldura com o buraco da tela: parte maciça atrás + anel de 4 peças na frente (o vidro fica afundado)
function moldura(add, m, { cx = 0, cy, frente, W, H, abW, abH, abY, prof = 0.02, macica = 0.04, r = 0.016 }) {
  add(arred(W, H, macica, Math.min(r, macica / 2 - 0.001)), m, M(cx, cy, frente - prof - macica / 2));
  const topo = cy + H / 2 - (abY + abH / 2), base = abY - abH / 2 - (cy - H / 2), rr = Math.min(0.008, prof / 2 - 0.001);
  add(arred(W, topo, prof, Math.min(rr, topo / 2 - 0.0005)), m, M(cx, cy + H / 2 - topo / 2, frente - prof / 2));
  add(arred(W, base, prof, rr), m, M(cx, cy - H / 2 + base / 2, frente - prof / 2));
  for (const sx of [-1, 1]) add(caixa((W - abW) / 2, abH + 0.002, prof), m, M(cx + sx * (abW / 2 + (W - abW) / 4), abY, frente - prof / 2));
}
function arredRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// ======================= COMPUTADOR =======================
const BEGE = 0xe2dac4, BEGE_ESC = 0xcfc6ae, BEGE_TECLA = 0xebe5d3;

// tela de abertura (estética de PC antigo ligando, com desenho e texto próprios)
function texAbertura() {
  return canvasTex(512, 388, (g, w, h) => {
    g.fillStyle = '#5bb2db'; g.fillRect(0, 0, w, h);
    // gatinho de pixel (cinza e branco, como o avatar)
    const P = [
      '..G.......G..',
      '.GPG.....GPG.',
      '.GGGGGGGGGGG.',
      'GGGGGWWWGGGGG',
      'GGKKGWWWGKKGG',
      'GGKKGWWWGKKGG',
      'GGGGWWRWWGGGG',
      '.GGWWWWWWWGG.',
      '..GGWWWWWGG..',
      '....GGGGG....',
    ];
    const cores = { G: '#77787f', P: '#e89aa8', W: '#f6f4ee', K: '#16161a', R: '#e2748a' }, t = 12, ox = w / 2 - (13 * t) / 2, oy = 30;
    P.forEach((l, j) => [...l].forEach((c, i) => { if (cores[c]) { g.fillStyle = cores[c]; g.fillRect(ox + i * t, oy + j * t, t - 1, t - 1); } }));
    // sombra de pixels "andando" para a esquerda, à moda dos logotipos da época
    for (let k = 1; k <= 3; k++) { g.globalAlpha = 0.5 - k * 0.12; P.forEach((l, j) => [...l].forEach((c, i) => { if (c === 'G' && (i + j) % 2 === 0) { g.fillStyle = '#3d5a8a'; g.fillRect(ox - k * 26 + i * t * 0.5, oy + 16 + j * t * 0.8, 4, 4); } })); }
    g.globalAlpha = 1;
    g.fillStyle = '#101418'; g.textAlign = 'center';
    g.font = '600 40px "Times New Roman", Times, serif'; g.fillText('NOSSO', w / 2, 200);
    g.font = '600 62px "Times New Roman", Times, serif'; g.fillText('QUARTO', w / 2, 256);
    g.font = '26px "Times New Roman", Times, serif'; g.fillText('Versão 1.0', w / 2, 300);
    g.font = '13px "Times New Roman", Times, serif'; g.fillText('Copyright © Nosso Quarto 2026', w / 2 + 50, 334); g.fillText('Todos os direitos reservados.', w / 2 + 50, 350);
    // leve vinheta e linhas de tubo
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,20,40,.28)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 1); }
  });
}
// área de trabalho (aparece no monitor depois que o computador termina de ligar)
function texAreaTrabalho() {
  return canvasTex(512, 388, (g, w, h) => {
    g.fillStyle = '#2f8a8c'; g.fillRect(0, 0, w, h);
    const jan = (x, y, jw, jh, titulo) => {
      g.fillStyle = '#c3c3c3'; g.fillRect(x, y, jw, jh); g.fillStyle = '#fff'; g.fillRect(x, y, jw, 2); g.fillRect(x, y, 2, jh);
      g.fillStyle = '#5a5a5a'; g.fillRect(x, y + jh - 2, jw, 2); g.fillRect(x + jw - 2, y, 2, jh);
      g.fillStyle = '#23338f'; g.fillRect(x + 4, y + 4, jw - 8, 20); g.fillStyle = '#fff'; g.font = 'bold 13px Tahoma, Verdana, sans-serif'; g.textAlign = 'center'; g.fillText(titulo, x + jw / 2, y + 19);
      g.fillStyle = '#fff'; g.fillRect(x + 6, y + 28, jw - 12, jh - 34);
    };
    jan(40, 34, 432, 250, 'Gerenciador do Quarto');
    const ic = [['#c99a68', 'Caixas'], ['#9c6a3e', 'Bandeja'], ['#fffbe0', 'Bloco'], ['#8fb4d8', 'Buscar'], ['#e9e3d0', 'Calendário'], ['#c8423c', 'Desligar']];
    ic.forEach(([c, n], i) => {
      const x = 92 + (i % 3) * 140, y = 92 + Math.floor(i / 3) * 96;
      g.fillStyle = c; g.fillRect(x - 18, y - 22, 36, 30); g.strokeStyle = '#333'; g.lineWidth = 2; g.strokeRect(x - 18, y - 22, 36, 30);
      g.fillStyle = '#111'; g.font = '13px Tahoma, Verdana, sans-serif'; g.textAlign = 'center'; g.fillText(n, x, y + 28);
    });
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,20,30,.3)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, w, 1); }
  });
}
function texTuboDesligado(cor = '#2c3130') {
  return canvasTex(256, 196, (g, w, h) => {
    g.fillStyle = cor; g.fillRect(0, 0, w, h);
    const r = g.createLinearGradient(0, 0, w, h); r.addColorStop(0, 'rgba(255,255,255,.10)'); r.addColorStop(0.35, 'rgba(255,255,255,.02)'); r.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}
// frente do gabinete (desenhada): baia do disquete, baia vazia, painel de botões e grade de ventilação
function texGabinete() {
  return canvasTex(256, 592, (g, w, h) => {
    const y = (f) => f * h, x = (f) => f * w;
    g.fillStyle = '#e4dcc7'; g.fillRect(0, 0, w, h);
    const sombra = 'rgba(90,80,60,.45)', luz = 'rgba(255,255,255,.7)';
    const caixaFunda = (a, b, c, d) => { g.fillStyle = 'rgba(120,110,90,.10)'; g.fillRect(a, b, c, d); g.strokeStyle = sombra; g.lineWidth = 2; g.beginPath(); g.moveTo(a, b + d); g.lineTo(a, b); g.lineTo(a + c, b); g.stroke(); g.strokeStyle = luz; g.beginPath(); g.moveTo(a + c, b); g.lineTo(a + c, b + d); g.lineTo(a, b + d); g.stroke(); };
    // borda da tampa frontal
    g.strokeStyle = 'rgba(120,110,90,.35)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    // baia do disquete (3,5")
    caixaFunda(x(0.08), y(0.045), x(0.84), y(0.11));
    g.fillStyle = '#2a2723'; arredRect(g, x(0.2), y(0.085), x(0.6), y(0.012), 3); g.fill();          // fenda do disquete
    g.fillStyle = 'rgba(120,110,90,.35)'; g.fillRect(x(0.2), y(0.1), x(0.6), 2);
    g.fillStyle = '#d6cdb6'; arredRect(g, x(0.68), y(0.118), x(0.12), y(0.022), 3); g.fill(); g.strokeStyle = sombra; g.lineWidth = 1.5; g.stroke();   // botão de ejetar
    g.fillStyle = '#7fae5a'; g.fillRect(x(0.24), y(0.123), x(0.05), y(0.008));                         // luz do drive
    // baia vazia (tampa)
    caixaFunda(x(0.08), y(0.19), x(0.84), y(0.1));
    g.strokeStyle = 'rgba(120,110,90,.25)'; g.beginPath(); g.moveTo(x(0.1), y(0.24)); g.lineTo(x(0.9), y(0.24)); g.stroke();
    // painel de controle (lado direito)
    caixaFunda(x(0.5), y(0.39), x(0.42), y(0.23));
    g.fillStyle = '#555'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    // ícones de luzes (alimentação / disco)
    g.strokeStyle = '#6a6252'; g.lineWidth = 2; g.beginPath(); g.arc(x(0.58), y(0.42), 7, -1.1, 4.2); g.stroke(); g.beginPath(); g.moveTo(x(0.58), y(0.405)); g.lineTo(x(0.58), y(0.42)); g.stroke();
    g.beginPath(); g.ellipse(x(0.68), y(0.42), 9, 5, 0, 0, 7); g.stroke();
    // trava de chave
    g.fillStyle = '#9b958a'; g.beginPath(); g.arc(x(0.62), y(0.53), 11, 0, 7); g.fill(); g.strokeStyle = '#5d584f'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#3b3833'; g.fillRect(x(0.62) - 2, y(0.53) - 7, 4, 14);
    // botões quadradinhos (turbo / reset)
    for (const [fx, fy] of [[0.8, 0.43], [0.8, 0.505]]) { g.fillStyle = '#d9d1bb'; arredRect(g, x(fx) - 10, y(fy) - 10, 20, 20, 3); g.fill(); g.strokeStyle = sombra; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = '#6a6252'; g.font = '9px sans-serif'; g.fillText('TURBO', x(0.8), y(0.47)); g.fillText('RESET', x(0.8), y(0.545));
    // grade de ventilação de baixo
    for (let k = 0; k < 7; k++) { g.fillStyle = '#5a5244'; arredRect(g, x(0.12), y(0.84) + k * 9, x(0.76), 4, 2); g.fill(); }
    // vinco entre a tampa e o corpo
    g.fillStyle = 'rgba(120,110,90,.3)'; g.fillRect(0, y(0.97), w, 3);
  });
}
// visor de 7 segmentos do gabinete ("120" = MHz do turbo)
function texVisor(texto, cor, apagado) {
  return canvasTex(96, 48, (g, w, h) => {
    g.fillStyle = '#120708'; g.fillRect(0, 0, w, h);
    const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ':': '' };
    const dig = (cx, ch, liga) => {
      const s = 7, a = 15, l = 3;
      const segs = { a: [cx - s, 8, 2 * s, l], d: [cx - s, 8 + 2 * a, 2 * s, l], g: [cx - s, 8 + a, 2 * s, l], f: [cx - s - l, 9, l, a], b: [cx + s, 9, l, a], e: [cx - s - l, 9 + a, l, a], c: [cx + s, 9 + a, l, a] };
      for (const [k, r] of Object.entries(segs)) { g.fillStyle = liga && SEG[ch].includes(k) ? cor : apagado; g.fillRect(...r); }
    };
    [...texto].forEach((c, i) => dig(22 + i * 26, c, true));
  });
}

export function criarComputador() {
  const g = new THREE.Group(), of = oficina();
  const bege = mat(BEGE, { roughness: 0.5 }), begeEsc = mat(BEGE_ESC, { roughness: 0.6 }), escuro = mat(0x2a2a2c, { roughness: 0.7 }), cinza = mat(0x9a948a);
  // ---------- monitor CRT ----------
  const MZ = -0.06, mon = new THREE.Group(); mon.position.set(0, 0, MZ); g.add(mon);
  const om = { add: (geo, m, mx = M()) => of.add(geo, m, M(0, 0, MZ).multiply(mx)) };
  om.add(cil(0.125, 0.018, 32), bege, M(0, 0.009, 0, 0, 0, 0, 1, 1, 0.82));                // base oval
  om.add(cil(0.075, 0.02, 24), begeEsc, M(0, 0.028, -0.01));                                   // giratório
  om.add(arred(0.11, 0.04, 0.13, 0.008), bege, M(0, 0.05, -0.02));                            // pescoço
  om.add(afunilada(0.38, 0.36, 0.27, 0.24, 0.34, -0.02), bege, M(0, 0.25, -0.06));             // corpo do tubo
  const incl = Math.atan(0.08 / 0.34);         // a tampa de cima desce para trás
  for (let k = 0; k < 7; k++) om.add(caixa(0.006, 0.004, 0.1), escuro, M(-0.09 + k * 0.03, 0.43 - (0.11 + 0.08) * 0.235 + 0.001, -0.08, -incl));   // fendas de ventilação
  // borda interna (o vidro fica afundado na moldura, com um chanfro mais claro)
  const SW = 0.31, SH = 0.235, SY = 0.27, SZ = 0.17;
  moldura(om.add, bege, { cy: 0.25, frente: SZ, W: 0.40, H: 0.38, abW: SW + 0.03, abH: SH + 0.03, abY: SY });     // moldura da frente
  om.add(caixa(SW + 0.03, 0.014, 0.012), begeEsc, M(0, SY + SH / 2 + 0.008, SZ - 0.002, -0.5));
  om.add(caixa(SW + 0.03, 0.014, 0.012), begeEsc, M(0, SY - SH / 2 - 0.008, SZ - 0.002, 0.5));
  for (const s of [-1, 1]) om.add(caixa(0.014, SH + 0.03, 0.012), begeEsc, M(s * (SW / 2 + 0.008), SY, SZ - 0.002, 0, s * 0.5));
  om.add(new THREE.PlaneGeometry(SW + 0.012, SH + 0.012), escuro, M(0, SY, SZ - 0.019));
  // queixo: botão de liga e friso
  om.add(arred(0.026, 0.026, 0.01, 0.003), begeEsc, M(0.15, 0.095, 0.172));
  om.add(caixa(0.07, 0.003, 0.003), begeEsc, M(-0.12, 0.085, 0.171));
  // ---------- gabinete torre ----------
  const T = { x: 0.37, z: -0.09, w: 0.19, h: 0.44, d: 0.42 };
  of.add(arred(T.w, T.h, T.d, 0.008), bege, M(T.x, T.h / 2, T.z));
  of.add(arred(T.w + 0.004, T.h + 0.004, 0.014, 0.005), bege, M(T.x, T.h / 2, T.z + T.d / 2));             // tampa frontal
  for (let k = 0; k < 3; k++) of.add(caixa(0.002, 0.3, 0.004), begeEsc, M(T.x + T.w / 2 + 0.001, 0.2, T.z - 0.1 + k * 0.008));   // vincos da lateral
  of.add(arred(0.03, 0.03, 0.012, 0.003), begeEsc, M(T.x - 0.055, T.h * 0.48, T.z + T.d / 2 + 0.008));    // botão de liga (retângulo saliente)
  of.add(cil(0.009, 0.006, 16), mat(0x4fb2a6, { roughness: 0.4 }), M(T.x + 0.035, T.h * 0.41, T.z + T.d / 2 + 0.009, Math.PI / 2));   // botão redondo verde-água
  // pézinhos
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) of.add(cil(0.012, 0.006, 10), escuro, M(T.x + sx * 0.07, 0.003, T.z + sz * 0.17));
  // ---------- teclado ----------
  const K = { z: 0.205, w: 0.47, d: 0.18, hF: 0.022, hB: 0.036 };
  const ang = Math.atan2(K.hB - K.hF, K.d);
  const cunha = new THREE.BoxGeometry(K.w, 1, K.d), cp = cunha.attributes.position;
  for (let i = 0; i < cp.count; i++) { const topo = cp.getY(i) > 0, z = cp.getZ(i); cp.setY(i, topo ? K.hF + (K.hB - K.hF) * (0.5 - z / K.d) : 0); }
  cunha.computeVertexNormals();
  of.add(cunha, bege, M(0, 0, K.z));
  of.add(caixa(K.w - 0.18, 0.003, 0.016), begeEsc, M(-0.08, K.hB - 0.0005, K.z - K.d / 2 + 0.014, ang));                // friso de trás
  of.add(caixa(0.07, 0.003, 0.01), mat(0x9b2b2b, { roughness: 0.5 }), M(0.172, K.hB + 0.0005, K.z - K.d / 2 + 0.016, ang));   // faixa vermelha (canto de cima)
  // ---------- mouse e mousepad ----------
  const MP = { x: 0.37, z: 0.215 };
  of.add(arred(0.2, 0.004, 0.165, 0.002, 1), mat(0x2b3446, { roughness: 0.9 }), M(MP.x, 0.002, MP.z));
  const corpoMouse = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  of.add(corpoMouse, bege, M(MP.x + 0.01, 0.004, MP.z + 0.01, 0, -0.15, 0, 0.03, 0.017, 0.054));
  of.add(caixa(0.046, 0.002, 0.002), begeEsc, M(MP.x + 0.006, 0.0165, MP.z - 0.015, 0, -0.15));
  of.add(caixa(0.002, 0.002, 0.026), begeEsc, M(MP.x + 0.008, 0.0185, MP.z - 0.03, 0, -0.15));
  // fios (mouse e teclado vão para trás do gabinete)
  const fio = (pts) => of.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, 0.0025, 5), cinza);
  fio([[MP.x + 0.002, 0.012, MP.z - 0.045], [MP.x - 0.01, 0.004, MP.z - 0.08], [0.26, 0.003, 0.09], [0.22, 0.003, -0.05], [0.26, 0.003, -0.24], [T.x, 0.06, T.z - T.d / 2 - 0.01]]);
  fio([[0, 0.02, K.z - K.d / 2], [-0.02, 0.003, 0.08], [0.15, 0.003, -0.02], [0.24, 0.003, -0.27], [T.x - 0.03, 0.08, T.z - T.d / 2 - 0.01]]);
  of.fechar(g);

  // ---------- teclas (uma malha só, instanciada) ----------
  const u = 0.0192, teclas = [];
  const linha = (zLinha, itens, x0) => { let x = x0; for (const it of itens) { if (it < 0) { x += -it; continue; } const [w, mod] = Array.isArray(it) ? it : [it, false]; teclas.push({ x: x + w / 2, z: zLinha, w, mod }); x += w; } };
  const X0 = -11.25;
  // fileira das F (Esc, F1-F4, F5-F8, F9-F12) e os três de cima à direita
  linha(-5.6, [[1, true], -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.25, [1, true], [1, true], [1, true]], X0);
  linha(-4.2, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, [2, true], -0.25, [1, true], [1, true], [1, true], -0.25, [1, true], [1, true], [1, true], [1, true]], X0);
  linha(-3.2, [[1.5, true], 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, [1.5, true], -0.25, [1, true], [1, true], [1, true], -0.25, 1, 1, 1], X0);
  linha(-2.2, [[1.75, true], 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, [2.25, true], -3.5, 1, 1, 1], X0);
  linha(-1.2, [[2.25, true], 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, [2.75, true], -1.25, [1, true], -1.25, 1, 1, 1], X0);
  linha(-0.2, [[1.5, true], -1, [1.5, true], 7, [1.5, true], -1, [1.5, true], -0.25, [1, true], [1, true], [1, true], -0.25, [2, false], 1], X0);
  // + e Enter do teclado numérico (duas alturas)
  teclas.push({ x: X0 + 22, z: -2.7, w: 1, d: 2, mod: true }, { x: X0 + 22, z: -0.7, w: 1, d: 2, mod: true });
  const tampa = new THREE.BoxGeometry(1, 1, 1), tp = tampa.attributes.position;           // tecla: topo menor que a base
  for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) { tp.setX(i, tp.getX(i) * 0.78); tp.setZ(i, tp.getZ(i) * 0.74); }
  tampa.computeVertexNormals();
  const im = new THREE.InstancedMesh(tampa, mat(0xffffff, { roughness: 0.55 }), teclas.length);
  const cA = new THREE.Color(BEGE_TECLA), cM = new THREE.Color(0xd8d0bc), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0));
  teclas.forEach((t, i) => {
    const z = K.z - K.d / 2 + 0.04 + (t.z + 5.6) * u, yTopo = K.hF + (K.hB - K.hF) * (0.5 - (z - K.z) / K.d);
    im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(t.x * u, yTopo + 0.004, z), q, new THREE.Vector3(t.w * u - 0.0022, 0.011, (t.d || 1) * u - 0.0022)));
    im.setColorAt(i, t.mod ? cM : cA);
  });
  im.receiveShadow = true; g.add(im);
  // luzinhas do teclado (Num Lock etc.) e da torre e do monitor: acendem quando liga
  const ledVerde = mat(0x2d4a2a, { emissive: 0x59ff4a, emissiveIntensity: 0 }), ledLaranja = mat(0x4a3a20, { emissive: 0xffa53a, emissiveIntensity: 0 });
  const led = (geo, m, mx) => { const o = new THREE.Mesh(geo, m); o.applyMatrix4(mx); g.add(o); return o; };
  for (let k = 0; k < 3; k++) led(caixa(0.006, 0.002, 0.004), ledVerde, M(0.152 + k * 0.022, K.hF + (K.hB - K.hF) * (0.5 - 0.04 / K.d) + 0.0015, K.z - K.d / 2 + 0.04, ang));
  led(cil(0.0035, 0.004, 10), ledVerde, M(0.122, 0.095, MZ + 0.171, Math.PI / 2));
  // ---------- frente do gabinete desenhada + visor "120" ----------
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(T.w - 0.002, T.h - 0.002), mat(0xffffff, { map: texGabinete(), roughness: 0.55 }));
  frente.position.set(T.x, T.h / 2, T.z + T.d / 2 + 0.0076); frente.receiveShadow = true; g.add(frente);
  const yF = (f) => T.h - f * T.h;      // posição vertical a partir da fração do desenho (0 = topo)
  const visorAceso = texVisor('120', '#ff3326', '#2a0d0d');
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.015), new THREE.MeshStandardMaterial({ color: 0x220a0a, emissive: 0xffffff, emissiveMap: visorAceso, emissiveIntensity: 0, roughness: 0.3 }));
  visor.position.set(T.x - 0.055, yF(0.6), T.z + T.d / 2 + 0.0085); g.add(visor);
  led(caixa(0.006, 0.004, 0.003), ledVerde, M(T.x + 0.016, yF(0.455), T.z + T.d / 2 + 0.009));
  const ledDisco = led(caixa(0.006, 0.004, 0.003), ledLaranja, M(T.x + 0.035, yF(0.455), T.z + T.d / 2 + 0.009));
  // ---------- vidro do monitor ----------
  const texOn = texAbertura(), texOff = texTuboDesligado(), texMesa = texAreaTrabalho();
  const matTela = tela(); matTela.map = texOff; matTela.emissiveMap = texOn;
  const vidroMon = new THREE.Mesh(vidro(SW, SH, 0.011), matTela); vidroMon.position.set(0, SY, SZ - 0.018); mon.add(vidroMon);

  // ---------- ligar / desligar (com o "acender" do tubo) ----------
  let ligado = false, k = 0, piscaDisco = 0, ligouEm = 0;
  function aplicar() {
    const e = Math.min(1, k);
    matTela.emissiveIntensity = e * 1.05; matTela.color.setScalar(1 - e * 0.85);
    visor.material.emissiveIntensity = e * 1.6;
    ledVerde.emissiveIntensity = e * 2.2;
  }
  aplicar();
  return {
    g, alvo: g,
    ligado: () => ligado,
    ligar(v) { ligado = v; ligouEm = performance.now(); matTela.emissiveMap = texOn; if (!v) ledLaranja.emissiveIntensity = 0; piscaDisco = v ? 2.2 : 0; },
    iniciando: () => ligado && performance.now() - ligouEm < 2600,          // ainda na tela de abertura
    atualizar(dt) {                     // devolve true enquanto está animando
      const alvo = ligado ? 1 : 0; let mexeu = false;
      if (k !== alvo) { k = ligado ? Math.min(1, k + dt / 0.9) : Math.max(0, k - dt / 0.25); aplicar(); mexeu = true; }
      if (piscaDisco > 0) { piscaDisco -= dt; ledLaranja.emissiveIntensity = piscaDisco > 0 && Math.sin(piscaDisco * 40) > 0 ? 2.2 : 0; mexeu = true; }
      if (ligado && matTela.emissiveMap === texOn) { mexeu = true; if (performance.now() - ligouEm > 2600) matTela.emissiveMap = texMesa; }     // terminou de ligar: área de trabalho
      return mexeu;
    },
  };
}

// ======================= TV DE TUBO + DVD/VIDEOCASSETE =======================
const TV_COR = 0x55565a;
function texTvLigada() {
  return canvasTex(512, 392, (g, w, h) => {
    g.fillStyle = '#1b2fd0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4dff6a'; g.font = 'bold 34px "Courier New", monospace'; g.textAlign = 'left';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowOffsetX = 3; g.shadowOffsetY = 3;
    g.fillText('VÍDEO 1', 34, 62); g.font = 'bold 26px "Courier New", monospace'; g.fillText('CH 03', w - 140, h - 40);
    g.shadowColor = 'transparent';
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.8); v.addColorStop(0, 'rgba(255,255,255,.05)'); v.addColorStop(1, 'rgba(0,0,20,.45)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y, w, 1); }
  });
}
// faixa de baixo da TV: fenda da fita, grade do alto-falante e plaquinhas (sem nomes)
function texFaixaTv() {
  return canvasTex(640, 200, (g, w, h) => {
    g.fillStyle = '#4b4c50'; g.fillRect(0, 0, w, h);
    const x = (f) => f * w, y = (f) => f * h;
    // fenda do videocassete com a portinha
    g.fillStyle = '#2c2d30'; arredRect(g, x(0.2), y(0.1), x(0.44), y(0.3), 6); g.fill();
    g.fillStyle = '#38393d'; arredRect(g, x(0.215), y(0.15), x(0.41), y(0.2), 4); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x(0.215), y(0.15)); g.lineTo(x(0.625), y(0.15)); g.stroke();
    // plaquinha dourada vazia (onde ficaria o nome)
    g.fillStyle = 'rgba(200,170,100,.5)'; g.fillRect(x(0.38), y(0.02), x(0.08), y(0.035));
    // grade do alto-falante (furinhos)
    g.fillStyle = '#26272a';
    for (let i = 0; i < 26; i++) for (let j = 0; j < 9; j++) { g.beginPath(); g.arc(x(0.66) + i * 7.2, y(0.22) + j * 7.2, 2.1, 0, 7); g.fill(); }
    // faixinha embaixo da fenda e marcações dos botões
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x(0.03), y(0.52), x(0.6), 2);
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 6; i++) g.fillRect(x(0.06) + i * 18, y(0.56), 10, 2);
    g.fillStyle = '#e4508f'; g.fillRect(x(0.2), y(0.56), x(0.03), y(0.05));       // etiquetinha rosa (como na foto)
    // sensor do controle remoto e entrada de fone
    g.fillStyle = '#1b1b1e'; arredRect(g, x(0.7), y(0.66), x(0.05), y(0.09), 3); g.fill();
    g.fillStyle = '#18181a'; g.beginPath(); g.arc(x(0.86), y(0.75), 7, 0, 7); g.fill();
  });
}
function texAparelho() {        // frente do DVD + videocassete (prata)
  return canvasTex(640, 136, (g, w, h) => {
    const x = (f) => f * w, y = (f) => f * h;
    const fundo = g.createLinearGradient(0, 0, 0, h); fundo.addColorStop(0, '#c4c6c8'); fundo.addColorStop(1, '#9fa1a4'); g.fillStyle = fundo; g.fillRect(0, 0, w, h);
    const sulco = (a, b, c, d, cor = '#6d6f73') => { g.fillStyle = cor; arredRect(g, a, b, c, d, 3); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke(); };
    // gaveta do DVD (esquerda, em cima)
    sulco(x(0.03), y(0.2), x(0.36), y(0.16), '#8a8c90'); g.fillStyle = '#2b2c2f'; g.fillRect(x(0.04), y(0.27), x(0.34), 3);
    // botõezinhos do DVD
    for (let i = 0; i < 4; i++) { g.fillStyle = '#d2d4d6'; g.beginPath(); g.arc(x(0.07) + i * 20, y(0.62), 5, 0, 7); g.fill(); g.strokeStyle = '#6d6f73'; g.stroke(); }
    // faixa escura do meio (onde fica o visor)
    g.fillStyle = '#1d1e21'; g.fillRect(x(0.24), y(0.48), x(0.24), y(0.42));
    // portinha do VHS (direita)
    sulco(x(0.52), y(0.16), x(0.36), y(0.26), '#7e8084'); g.fillStyle = '#2a2b2e'; g.fillRect(x(0.53), y(0.22), x(0.34), y(0.12));
    // fileira de botões do videocassete
    for (let i = 0; i < 3; i++) sulco(x(0.62) + i * 26, y(0.58), 18, y(0.13), '#d8dadc');
    g.fillStyle = '#d8dadc'; g.beginPath(); g.arc(x(0.86), y(0.64), 6, 0, 7); g.fill();
    // linha de acabamento de baixo
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 4, w, 4);
  });
}
function texVfd() {       // visor azul-verde do aparelho
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5ff2d8'; g.font = 'bold 34px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('0:00:00', w / 2, 44);
    g.font = 'bold 12px sans-serif'; g.fillText('VCR', 22, 18);
  });
}
function texVentilacao(n, cor = '#4e5054') {
  return canvasTex(128, 64, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h); g.fillStyle = cor; for (let i = 0; i < n; i++) g.fillRect(8 + i * ((w - 16) / n), 8, (w - 16) / n * 0.45, h - 16); });
}

const AMARELO = mat(0xe7c21a, { roughness: 0.4 }), BRANCO = mat(0xf1f1ee, { roughness: 0.4 }), VERMELHO = mat(0xc8262b, { roughness: 0.4 });
export function criarTV() {
  const g = new THREE.Group(), of = oficina();
  const plast = mat(TV_COR, { roughness: 0.45 }), plastEsc = mat(0x3a3b3f, { roughness: 0.5 }), prata = mat(0xb0b2b5, { roughness: 0.4, metalness: 0.35 }), preto = mat(0x1d1e21, { roughness: 0.6 });
  // ---------- aparelho DVD + videocassete ----------
  const A = { w: 0.43, h: 0.088, d: 0.3, y: 0.008 };
  of.add(arred(A.w, A.h, A.d, 0.006), prata, M(0, A.y + A.h / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) of.add(cil(0.012, A.y, 10), preto, M(sx * 0.18, A.y / 2, sz * 0.12));
  // entradas de áudio e vídeo (amarela, branca, vermelha) e botões redondos
  [AMARELO, BRANCO, VERMELHO].forEach((m, i) => of.add(cil(0.0045, 0.008, 12), m, M(0.12 + i * 0.016, A.y + 0.016, A.d / 2 + 0.003, Math.PI / 2)));
  of.add(cil(0.006, 0.006, 12), mat(0xdedfe1), M(0.185, A.y + 0.03, A.d / 2 + 0.003, Math.PI / 2));
  for (let k = 0; k < 9; k++) of.add(caixa(0.002, 0.045, 0.005), preto, M(A.w / 2 + 0.0005, A.y + A.h / 2, -0.11 + k * 0.012));     // fendas da lateral direita
  // ---------- TV de tubo ----------
  const TV = { x: -0.015, y: A.y + A.h, z: 0.0, w: 0.4, h: 0.41 }, F = 0.13;      // frente da TV em z = F
  const yT = (v) => TV.y + v;
  of.add(afunilada(0.385, 0.385, 0.29, 0.26, 0.3, -0.035), plast, M(TV.x, yT(TV.h / 2), F - 0.07 - 0.15));
  const inclTv = Math.atan(0.0975 / 0.3);
  for (let k = 0; k < 8; k++) of.add(caixa(0.006, 0.004, 0.11), preto, M(TV.x - 0.105 + k * 0.03, yT(0.2 + 0.1925 - 0.17 * 0.325) + 0.001, F - 0.24, -inclTv));   // ventilação de cima
  // moldura da tela
  const SW = 0.305, SH = 0.225, SY = yT(0.26);
  moldura(of.add, plast, { cx: TV.x, cy: yT(TV.h / 2), frente: F, W: TV.w, H: TV.h, abW: SW + 0.03, abH: SH + 0.03, abY: SY, macica: 0.05, r: 0.022 });
  of.add(caixa(SW + 0.03, 0.016, 0.014), plastEsc, M(TV.x, SY + SH / 2 + 0.009, F + 0.0, -0.55));
  of.add(caixa(SW + 0.03, 0.016, 0.014), plastEsc, M(TV.x, SY - SH / 2 - 0.009, F + 0.0, 0.55));
  for (const s of [-1, 1]) of.add(caixa(0.016, SH + 0.03, 0.014), plastEsc, M(TV.x + s * (SW / 2 + 0.009), SY, F + 0.0, 0, s * 0.55));
  of.add(new THREE.PlaneGeometry(SW + 0.014, SH + 0.014), preto, M(TV.x, SY, F - 0.019));
  // botão de liga (redondo, à esquerda), quatro botões do vídeo, botõezinhos redondos e entradas da frente
  of.add(cil(0.011, 0.008, 20), plastEsc, M(TV.x - 0.172, yT(0.118), F + 0.003, Math.PI / 2));
  const btnTv = mat(0x37383c, { roughness: 0.45 }); for (let i = 0; i < 4; i++) of.add(arred(0.022, 0.016, 0.01, 0.003), btnTv, M(TV.x - 0.07 + i * 0.024, yT(0.045), F + 0.004));
  for (let i = 0; i < 3; i++) of.add(cil(0.0045, 0.006, 12), plastEsc, M(TV.x + 0.028 + i * 0.016, yT(0.045), F + 0.003, Math.PI / 2));
  [AMARELO, BRANCO].forEach((m, i) => of.add(cil(0.004, 0.007, 12), m, M(TV.x - 0.165 + i * 0.014, yT(0.045), F + 0.003, Math.PI / 2)));
  for (let i = 0; i < 3; i++) of.add(cil(0.0035, 0.004, 10), preto, M(TV.x - 0.125 + i * 0.012, yT(0.045), F + 0.002, Math.PI / 2));
  of.fechar(g);
  // frentes desenhadas
  const faixa = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.122), mat(0xffffff, { map: texFaixaTv(), roughness: 0.5 }));
  faixa.position.set(TV.x, yT(0.067), F + 0.0005); faixa.receiveShadow = true; g.add(faixa);
  const frenteAp = new THREE.Mesh(new THREE.PlaneGeometry(A.w - 0.006, A.h - 0.004), mat(0xffffff, { map: texAparelho(), roughness: 0.4, metalness: 0.25 }));
  frenteAp.position.set(0, A.y + A.h / 2, A.d / 2 + 0.0006); frenteAp.receiveShadow = true; g.add(frenteAp);
  const vfd = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.024), new THREE.MeshStandardMaterial({ color: 0x050606, emissive: 0xffffff, emissiveMap: texVfd(), emissiveIntensity: 0, roughness: 0.25 }));
  vfd.position.set(-0.06, A.y + A.h - 0.69 * A.h, A.d / 2 + 0.0012); g.add(vfd);
  // vidro da TV
  const texPadrao = texTvLigada(), matTela = tela(); matTela.map = texTuboDesligado('#3a3f3e'); matTela.emissiveMap = texPadrao;
  const vid = new THREE.Mesh(vidro(SW, SH, 0.012), matTela); vid.position.set(TV.x, SY, F - 0.018); g.add(vid);
  const ledTv = new THREE.Mesh(caixa(0.005, 0.004, 0.003), mat(0x3a1010, { emissive: 0xff2a1a, emissiveIntensity: 0 }));
  ledTv.position.set(TV.x - 0.15, yT(0.118), F + 0.002); g.add(ledTv);

  let ligado = false, k = 0;
  function aplicar() {
    // tubo acendendo: primeiro uma linha clara no meio, depois a imagem abre na altura toda
    const e = Math.min(1, k);
    matTela.emissiveIntensity = e * 1.0; matTela.color.setScalar(1 - e * 0.85);
    vid.scale.y = ligado ? 0.04 + 0.96 * Math.min(1, e * 1.6) : 1;
    vfd.material.emissiveIntensity = e * 1.5; ledTv.material.emissiveIntensity = e * 2;
  }
  aplicar();
  return {
    g, alvo: g,
    ligado: () => ligado,
    ligar(v) { ligado = v; },
    mostrar(tex, proporcao = 4 / 3) {      // null = tela azul "VÍDEO 1"; senão corta o centro para caber na tela 4:3
      if (tex) {
        const alvo = SW / SH; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        if (proporcao > alvo) { tex.repeat.set(alvo / proporcao, 1); tex.offset.set((1 - alvo / proporcao) / 2, 0); }
        else { tex.repeat.set(1, proporcao / alvo); tex.offset.set(0, (1 - proporcao / alvo) / 2); }
      }
      matTela.emissiveMap = tex || texPadrao;
    },
    atualizar(dt) {
      const alvo = ligado ? 1 : 0; if (k === alvo) return false;
      k = ligado ? Math.min(1, k + dt / 0.7) : Math.max(0, k - dt / 0.2); aplicar(); return true;
    },
  };
}
