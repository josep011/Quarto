// Móveis do quarto, todos feitos por código (sem arquivos de modelo), a partir das fotos de referência.
// Medidas em metros. O gatinho tem 1,3 m de altura no jogo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- texturas desenhadas na hora ----------
export const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
export const ajusta = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
export function canvasTex(w, h, desenhar, repX = 1, repY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.repeat.set(repX, repY); return t;
}
export function texLadrilho(cor, repX, repY) {      // 1 ladrilho = 0,8 m (o mesmo da galeria do museu)
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = ajusta(cor, (rnd() - 0.5) * 0.02); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,80,60'},${0.015 + rnd() * 0.02})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 14, 2 + rnd() * 14); }
    g.strokeStyle = 'rgba(70,62,50,0.28)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }, repX / 0.8, repY / 0.8);
}
export function texVeio(cor, repX = 1, repY = 1, linhas = 26) {     // madeira com veios (para tampos e tábuas)
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = cor; g.fillRect(0, 0, w, h);
    for (let k = 0; k < linhas; k++) {
      g.strokeStyle = `rgba(${rnd() > 0.5 ? '70,42,20' : '255,235,200'},${0.04 + rnd() * 0.08})`; g.lineWidth = 1 + rnd() * 2.5;
      const y = rnd() * h; g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * 0.33, y + (rnd() - 0.5) * 30, w * 0.66, y + (rnd() - 0.5) * 30, w, y + (rnd() - 0.5) * 10); g.stroke();
    }
  }, repX, repY);
}
function texPapelao() {                     // papelão kraft
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c99a68'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '110,70,35' : '240,210,170'},${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); }
    for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(120,80,40,0.035)'; g.fillRect(0, y, w, 2); }
  });
}
function texPapelaoAlca() {                 // lateral da caixa com o furo da alça
  return canvasTex(256, 256, (g, w, h) => {
    g.drawImage(texPapelao().image, 0, 0);
    g.fillStyle = '#e9e6df'; g.beginPath(); g.ellipse(w / 2, h * 0.3, w * 0.2, h * 0.085, 0, 0, 7); g.fill();     // aro de plástico
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.ellipse(w / 2, h * 0.3, w * 0.15, h * 0.05, 0, 0, 7); g.fill();
  });
}

const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, ...extra });
function bloco(pai, w, h, d, x, y, z, m, sombra = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = sombra; o.receiveShadow = true; pai.add(o); return o;
}

// ---------- mesa de madeira (como na foto: pernas quadradas, travessas e barra embaixo) ----------
// Origem no centro do chão da mesa. A frente (onde senta) fica em +z.
export function criarMesa() {
  const L = 2.4, P = 0.6, A = 0.75, E = 0.03, PE = 0.045;      // 2,40 m de largura (o dobro)
  const g = new THREE.Group();
  const madeira = mat(0xb5824f, { map: texVeio('#b98652', 1, 1) });
  const tampoMat = mat(0xffffff, { map: texVeio('#c08d58', 1, 1, 34), roughness: 0.5 });
  bloco(g, L, E, P, 0, A - E / 2, 0, [madeira, madeira, tampoMat, madeira, madeira, madeira]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bloco(g, PE, A - E, PE, sx * (L / 2 - PE / 2 - 0.02), (A - E) / 2, sz * (P / 2 - PE / 2 - 0.02), madeira);
  const ix = L / 2 - 0.02 - PE, iz = P / 2 - 0.02 - PE;
  bloco(g, 2 * ix, 0.07, 0.02, 0, A - E - 0.035, -(P / 2 - 0.03), madeira);       // saia de trás
  bloco(g, 2 * ix, 0.05, 0.02, 0, A - E - 0.025, P / 2 - 0.03, madeira);           // saia da frente (fininha)
  for (const sx of [-1, 1]) {
    bloco(g, 0.02, 0.07, 2 * iz, sx * (L / 2 - 0.03), A - E - 0.035, 0, madeira);    // saias dos lados
    bloco(g, 0.03, 0.04, 2 * iz, sx * (L / 2 - 0.0425), 0.14, 0, madeira);          // travessas baixas dos lados
  }
  bloco(g, 2 * ix, 0.04, 0.03, 0, 0.14, -(P / 2 - 0.0425), madeira);                 // barra baixa de trás
  // luminária de mesa (da foto): base, haste e cúpula branca
  const lum = new THREE.Group(); lum.position.set(-L / 2 + 0.16, A, -P / 2 + 0.14); g.add(lum);
  const metal = mat(0x8a7a62, { metalness: 0.5, roughness: 0.4 });
  bloco(lum, 0.12, 0.015, 0.12, 0, 0.0075, 0, metal);
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 8), metal); haste.position.y = 0.17; lum.add(haste);
  const cupula = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.13, 24, 1, true), mat(0xf4efe4, { side: THREE.DoubleSide, emissive: 0xffe6c0, emissiveIntensity: 0.25 }));
  cupula.position.y = 0.36; cupula.castShadow = true; lum.add(cupula);
  return { g, L, P, A };
}

// ---------- prateleira de nichos de parede (em cima da mesa, como na foto) ----------
export function criarNichos() {
  const L = 1.0, H = 0.28, D = 0.24, E = 0.018, n = 4;
  const g = new THREE.Group(), m = mat(0xffffff, { map: texVeio('#b98652') });
  bloco(g, L, E, D, 0, E / 2, D / 2, m); bloco(g, L, E, D, 0, H - E / 2, D / 2, m);
  for (let i = 0; i <= n; i++) bloco(g, E, H, D, -L / 2 + E / 2 + i * (L - E) / n, H / 2, D / 2, m);
  bloco(g, L, H, 0.008, 0, H / 2, 0.004, mat(0xa77445));
  return { g };
}

// ---------- cadeira de escritório azul (base de 5 pés com rodinhas, só o assento, sem encosto) ----------
// Origem no chão, no centro. O assento olha para -z (para a mesa).
export function criarCadeira() {
  const g = new THREE.Group(), preto = mat(0x222226, { roughness: 0.45 }), azul = mat(0x4a5f8f, { roughness: 0.85 });
  const ALT = 0.47;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, braco = new THREE.Group(); braco.rotation.y = a; g.add(braco);
    const b = bloco(braco, 0.04, 0.035, 0.3, 0, 0.075, 0.15, preto); b.rotation.x = 0.08;
    const roda = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), preto); roda.position.set(0, 0.03, 0.29); roda.castShadow = true; braco.add(roda);
  }
  const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16), preto); cubo.position.y = 0.09; g.add(cubo);
  const pistao = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12), mat(0x3a3a40, { metalness: 0.6, roughness: 0.3 })); pistao.position.y = 0.25; pistao.castShadow = true; g.add(pistao);
  bloco(g, 0.24, 0.03, 0.24, 0, ALT - 0.07, 0, preto);
  const assento = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.08, 0.43, 4, 0.035), azul); assento.position.y = ALT - 0.03; assento.castShadow = assento.receiveShadow = true; g.add(assento);
  return { g, alt: ALT };
}

// ---------- estante de nichos (parede inteira) com uma caixa de papelão em cada nicho ----------
// Origem: centro da estante no chão, encostada na parede. A frente olha para -z.
export function criarEstante({ colunas = 20, linhas = 7, nicho = 0.42, fundo = 0.4 } = {}) {
  const E = 0.02, BASE = 0.05, W = colunas * nicho + E, H = BASE + linhas * nicho + E;
  const g = new THREE.Group();
  const madeira = mat(0xffffff, { map: texVeio('#b0683c', 1, 1, 20) });
  const vert = new THREE.InstancedMesh(new THREE.BoxGeometry(E, H - BASE, fundo), madeira, colunas + 1);
  const hor = new THREE.InstancedMesh(new THREE.BoxGeometry(W, E, fundo), madeira, linhas + 1);
  const M = new THREE.Matrix4();
  for (let i = 0; i <= colunas; i++) vert.setMatrixAt(i, M.makeTranslation(-W / 2 + E / 2 + i * nicho, BASE + (H - BASE) / 2, -fundo / 2));
  for (let j = 0; j <= linhas; j++) hor.setMatrixAt(j, M.makeTranslation(0, BASE + E / 2 + j * nicho, -fundo / 2));
  for (const o of [vert, hor]) { o.castShadow = true; o.receiveShadow = true; g.add(o); }
  bloco(g, W, BASE, fundo - 0.03, 0, BASE / 2, -fundo / 2 + 0.015, mat(0x8f5530));         // rodapé da estante
  bloco(g, W, H, 0.01, 0, H / 2, -0.005, mat(0x9a5c34), false);                              // fundo

  // caixas (corpo + tampa), uma por nicho
  const N = colunas * linhas, cw = nicho - E - 0.05, ch = nicho - E - 0.1, cd = fundo - 0.05, th = 0.035;
  const papel = new THREE.MeshStandardMaterial({ map: texPapelao(), roughness: 0.9 }), alca = new THREE.MeshStandardMaterial({ map: texPapelaoAlca(), roughness: 0.9 });
  const corpo = new THREE.InstancedMesh(new THREE.BoxGeometry(cw, ch, cd), [alca, alca, papel, papel, papel, papel], N);
  const tampa = new THREE.InstancedMesh(new THREE.BoxGeometry(cw + 0.012, th, cd + 0.012), papel, N);
  corpo.castShadow = tampa.castShadow = true; corpo.receiveShadow = tampa.receiveShadow = true; g.add(corpo, tampa);
  const caixas = [];
  for (let j = 0; j < linhas; j++) for (let i = 0; i < colunas; i++) {
    caixas.push({ idx: caixas.length, id: `caixa-${j + 1}-${i + 1}`, linha: j + 1, coluna: i + 1,
      x: -W / 2 + E + i * nicho + (nicho - E) / 2, y: BASE + E + j * nicho, z: -fundo / 2 - 0.01, a: 0, alvo: 0 });
  }
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), X = new THREE.Vector3(1, 0, 0), M2 = new THREE.Matrix4();
  function posicionar(c) {
    const fora = -0.17 * c.a, ang = 1.9 * c.a;
    corpo.setMatrixAt(c.idx, M.compose(P.set(c.x, c.y + ch / 2, c.z + fora), Q.identity(), S));
    // tampa presa atrás (dobradiça em +z), abre levantando a frente
    const hy = c.y + ch + th / 2, hz = c.z + fora + cd / 2;
    M.makeTranslation(c.x, hy, hz).multiply(M2.makeRotationAxis(X, ang)).multiply(M2.makeTranslation(0, 0, -cd / 2));
    tampa.setMatrixAt(c.idx, M);
  }
  caixas.forEach(posicionar);
  // etiquetas das caixas com nome
  const etiquetas = new Map();
  const CORES = ['#f4efe2', '#ffe08a', '#ffb3b3', '#b8e3c0', '#b3d1ff', '#e2ccfa'];
  function etiquetar(c, nome, cor = 0) {
    let e = etiquetas.get(c.id);
    if (!nome) { if (e) { g.remove(e); e.material.map.dispose(); e.material.dispose(); etiquetas.delete(c.id); } return; }
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const x = cv.getContext('2d');
    x.fillStyle = CORES[cor % CORES.length]; x.fillRect(0, 0, 256, 96); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 92);
    x.fillStyle = '#2b2622'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let t = nome, tam = 44; x.font = `600 ${tam}px system-ui, sans-serif`;
    while (x.measureText(t).width > 236 && tam > 24) { tam -= 2; x.font = `600 ${tam}px system-ui, sans-serif`; }
    while (x.measureText(t).width > 236 && t.length > 2) t = t.slice(0, -2) + '…';
    x.fillText(t, 128, 50);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    if (!e) { e = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.9, cw * 0.9 * 96 / 256), new THREE.MeshStandardMaterial({ roughness: 0.8 })); e.rotation.y = Math.PI; g.add(e); etiquetas.set(c.id, e); }
    else e.material.map.dispose();
    e.material.map = tex; e.material.needsUpdate = true; e.userData.c = c;
  }
  function atualizar(dt) {
    let mudou = false;
    for (const c of caixas) {
      if (c.a === c.alvo) continue;
      c.a += Math.sign(c.alvo - c.a) * Math.min(Math.abs(c.alvo - c.a), dt * 3.2); posicionar(c); mudou = true;
    }
    if (mudou) { corpo.instanceMatrix.needsUpdate = true; tampa.instanceMatrix.needsUpdate = true; }
    for (const e of etiquetas.values()) { const c = e.userData.c; e.position.set(c.x, c.y + ch * 0.45, c.z - 0.17 * c.a - cd / 2 - 0.002); }
  }
  atualizar(0);
  return { g, W, H, fundo, caixas, corpo, tampa, atualizar, etiquetar, abrir: (c, sim) => { c.alvo = sim ? 1 : 0; } };
}

// ---------- estante de livros com laterais inclinadas (fica no chão) ----------
// Origem: no chão, encostada na parede, no meio do comprimento. A frente olha para +x local.
export function criarEstanteLivros({ comLivros = true } = {}) {
  const L = 1.3, H = 0.8, DB = 0.42, DT = 0.2, E = 0.03;
  const g = new THREE.Group(), madeira = mat(0xffffff, { map: texVeio('#6e4126', 1, 1, 30), roughness: 0.55 });
  const forma = new THREE.Shape(); forma.moveTo(0, 0); forma.lineTo(DB, 0); forma.lineTo(DT, H); forma.lineTo(0, H); forma.closePath();
  const lado = new THREE.ExtrudeGeometry(forma, { depth: E, bevelEnabled: false });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(lado, madeira); m.position.z = s > 0 ? L / 2 - E : -L / 2; m.castShadow = m.receiveShadow = true; g.add(m); }
  const prof = (y) => DB - (DB - DT) * (y / H);
  for (const y of [0.06, 0.4, H - E / 2]) bloco(g, prof(y) - 0.01, E, L - 2 * E, (prof(y) - 0.01) / 2, y, 0, madeira);
  bloco(g, 0.01, H, L - 2 * E, 0.005, H / 2, 0, madeira);
  // livros coloridos (em pé, inclinados e deitados)
  const cores = [0x7d2e2e, 0x2f4f6f, 0x4f6b3a, 0xc9a34a, 0x8c5a3c, 0x3d3d5c, 0xa04a2a, 0x2e6b6b, 0xd8cdb4, 0x5a2e4f];
  const livros = new THREE.Group(); g.add(livros);
  // vãos das prateleiras (a biblioteca usa para pôr os livros de verdade)
  const prateleiras = [{ y0: 0.06 + E / 2, maxH: 0.3, ini: -L / 2 + E + 0.02, fim: L / 2 - E - 0.25 }, { y0: 0.4 + E / 2, maxH: 0.3, ini: -L / 2 + E + 0.02, fim: L / 2 - E - 0.02 }];
  if (!comLivros) {
    for (let i = 0; i < 3; i++) { const b = bloco(livros, 0.17, 0.03, 0.2, 0.11, 0.06 + E / 2 + 0.015 + i * 0.031, L / 2 - E - 0.13, mat(cores[(i * 3 + 2) % cores.length], { roughness: 0.7 })); b.rotation.y = (rnd() - 0.5) * 0.2; b.castShadow = false; }
    return { g, L, D: DB, prateleiras, prof };
  }
  for (const [y0, maxH, ini, fim] of [[0.06 + E / 2, 0.3, -L / 2 + E + 0.02, L / 2 - E - 0.25], [0.4 + E / 2, 0.3, -L / 2 + E + 0.25, L / 2 - E - 0.02]]) {
    let z = ini;
    while (z < fim) {
      const lg = 0.022 + rnd() * 0.03, alt = maxH * (0.72 + rnd() * 0.26), pf = Math.min(prof(y0 + alt) - 0.03, 0.15 + rnd() * 0.06);
      const b = bloco(livros, pf, alt, lg, pf / 2 + 0.015, y0 + alt / 2, z + lg / 2, mat(cores[Math.floor(rnd() * cores.length)], { roughness: 0.7 }));
      b.castShadow = false; z += lg + 0.002;
    }
  }
  for (let i = 0; i < 3; i++) {     // pilhinha deitada no fim da prateleira de baixo
    const b = bloco(livros, 0.17, 0.03, 0.2, 0.11, 0.06 + E / 2 + 0.015 + i * 0.031, L / 2 - E - 0.13, mat(cores[(i * 3 + 2) % cores.length], { roughness: 0.7 })); b.rotation.y = (rnd() - 0.5) * 0.2; b.castShadow = false;
  }
  return { g, L, D: DB };
}

// ---------- baú de madeira com tampa e fechadura ----------
// Origem: no chão, encostado na parede. A frente olha para +x local, comprimento em z.
export function criarBau() {
  const L = 0.72, D = 0.44, HC = 0.3, HT = 0.1, E = 0.02;
  const g = new THREE.Group(), madeira = mat(0xffffff, { map: texVeio('#5b3720', 1, 1, 30), roughness: 0.5 });
  const latao = mat(0xc9a14a, { metalness: 0.75, roughness: 0.3 });
  bloco(g, D, E, L, D / 2, E / 2 + 0.01, 0, madeira);                       // fundo
  bloco(g, E, HC, L, E / 2, HC / 2 + 0.01, 0, madeira); bloco(g, E, HC, L, D - E / 2, HC / 2 + 0.01, 0, madeira);
  bloco(g, D, HC, E, D / 2, HC / 2 + 0.01, -L / 2 + E / 2, madeira); bloco(g, D, HC, E, D / 2, HC / 2 + 0.01, L / 2 - E / 2, madeira);
  bloco(g, D - 2 * E, 0.004, L - 2 * E, D / 2, 0.035, 0, mat(0x2e1d12));    // forro escuro
  for (const s of [-1, 1]) for (const k of [0.25, 0.75]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), latao); p.position.set(D * k, 0.1 + (k > 0.5 ? 0.12 : 0), s * (L / 2 + 0.001)); g.add(p); }
  // tampa com dobradiça atrás (x = 0)
  const tampa = new THREE.Group(); tampa.position.set(0, HC + 0.01, 0); g.add(tampa);
  bloco(tampa, D, E, L, D / 2, HT - E / 2, 0, madeira);
  bloco(tampa, E, HT - E, L, E / 2, (HT - E) / 2, 0, madeira); bloco(tampa, E, HT - E, L, D - E / 2, (HT - E) / 2, 0, madeira);
  bloco(tampa, D, HT - E, E, D / 2, (HT - E) / 2, -L / 2 + E / 2, madeira); bloco(tampa, D, HT - E, E, D / 2, (HT - E) / 2, L / 2 - E / 2, madeira);
  // fechadura de latão na frente
  bloco(g, 0.006, 0.07, 0.06, D + 0.003, HC - 0.03, 0, latao);
  const furo = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), mat(0x111111)); furo.position.set(D + 0.0065, HC - 0.035, 0); furo.rotation.y = Math.PI / 2; g.add(furo);
  bloco(tampa, 0.006, 0.04, 0.04, D + 0.003, 0.01, 0, latao);
  // chavinha (aparece quando o baú está aberto com a chave)
  const chave = new THREE.Group(); chave.position.set(D + 0.012, HC - 0.035, 0); g.add(chave);
  const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), latao); hs.rotation.z = Math.PI / 2; hs.position.x = 0.02; chave.add(hs);
  const arg = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 8, 16), latao); arg.position.x = 0.045; arg.rotation.y = Math.PI / 2; chave.add(arg);
  chave.visible = false;
  let a = 0, alvo = 0;
  return { g, L, D, chave, abrir: (sim) => { alvo = sim ? 1 : 0; }, atualizar: (dt) => { if (a !== alvo) { a += Math.sign(alvo - a) * Math.min(Math.abs(alvo - a), dt * 2.6); tampa.rotation.z = 1.75 * (a * a * (3 - 2 * a)); } } };
}

// ---------- quadro branco de parede (moldura de madeira clara e bandeja) ----------
// Origem: centro do quadro, encostado na parede. Olha para +z local.
export function criarQuadroBranco(w, h, textura) {
  const g = new THREE.Group(), f = 0.035;
  const madeira = mat(0xffffff, { map: texVeio('#cfa66c') });
  bloco(g, w + 2 * f, h + 2 * f, 0.015, 0, 0, 0.0075, mat(0xd8d8d8), false);
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textura, roughness: 0.25, metalness: 0.05 }));
  placa.position.z = 0.016; placa.receiveShadow = true; g.add(placa);
  for (const [bw, bh, x, y] of [[w + 2 * f, f, 0, h / 2 + f / 2], [w + 2 * f, f, 0, -h / 2 - f / 2], [f, h, -w / 2 - f / 2, 0], [f, h, w / 2 + f / 2, 0]]) bloco(g, bw, bh, 0.03, x, y, 0.015, madeira);
  bloco(g, w * 0.5, 0.02, 0.07, 0, -h / 2 - f - 0.01, 0.045, madeira);       // bandeja
  const cores = [0x222222, 0x2f5fc4, 0xc43a3a, 0x2f9a4c];
  cores.forEach((c, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 10), mat(c)); m.rotation.z = Math.PI / 2; m.position.set(-0.2 + i * 0.12, -h / 2 - f + 0.005, 0.05); g.add(m); });
  return { g, placa };
}

// ---------- bandeja de entrada (em cima da mesa): a pilha de papéis cresce com o que está lá ----------
export function criarBandeja() {
  const g = new THREE.Group(), madeira = mat(0xffffff, { map: texVeio('#9c6a3e') }), W = 0.34, D = 0.25, H = 0.05, E = 0.012;
  bloco(g, W, E, D, 0, E / 2, 0, madeira);
  bloco(g, W, H, E, 0, H / 2, -D / 2 + E / 2, madeira); bloco(g, W, H * 0.6, E, 0, H * 0.3, D / 2 - E / 2, madeira);
  for (const s of [-1, 1]) { const l = bloco(g, E, H, D, s * (W / 2 - E / 2), H / 2, 0, madeira); l.castShadow = true; }
  const papeis = new THREE.Group(); g.add(papeis);
  const cores = [0xfbfaf6, 0xfbfaf6, 0xfff1a8, 0xfbfaf6, 0xdfeaff];
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.0035, 0.15), mat(cores[i % cores.length], { roughness: 0.9 }));
    p.position.set((rnd() - 0.5) * 0.02, E + 0.002 + i * 0.0038, (rnd() - 0.5) * 0.015); p.rotation.y = (rnd() - 0.5) * 0.14; p.castShadow = true; p.visible = false; papeis.add(p);
  }
  return { g, definir: (n) => papeis.children.forEach((p, i) => { p.visible = i < Math.min(n, 14); }) };
}
