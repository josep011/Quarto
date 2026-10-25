// Nosso Quarto: o escritório. Estante de caixas, baú com chave, mesa com cadeira, quadro branco, mural e a lâmpada de cordinha.
// O avatar é o Gatinho de terno do museu (mesmo modelo e animações).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { criarGato } from './gato.js?v=202610250300';
import { texLadrilho, criarMesa, criarNichos, criarCadeira, criarEstante, criarEstanteLivros, criarBau, criarQuadroBranco, criarBandeja } from './moveis.js';
import { criarBusca } from './busca.js';
import { criarInventario, criarMapaEstante } from './inventario.js';
import { criarQuadro } from './quadro.js';
import { criarMural } from './mural.js';
import * as guarda from './guarda.js';
import { criarProjetor } from './projetor.js?v=202610250120';
import { criarComputador, criarTV } from './retro.js';
import { criarTelaPc, criarTelaTv } from './telas.js';
import { criarPato } from './pato.js?v=202610250300';
import { criarBiblioteca } from './biblioteca.js?v=202610251400';

const MODELO = window.QUARTO_MODELO || './gatinho_terno_leve.glb?v=202610241300';      // cópia leve (~1 MB, menos triângulos) só do quarto
const $ = (id) => document.getElementById(id);
const QUARTO = { x0: -4.25, x1: 4.25, z0: -4.25, z1: 4.25, h: 3.2 };   // 8,5 m x 8,5 m, pé-direito de 3,2 m
const RAIO_GATO = 0.38, VELOCIDADE = 2.2;
const LAMPADA = { x: 0, z: 0 };

// ---------- avisos rápidos ----------
let tAviso = null;
function aviso(t) { const el = $('aviso'); el.textContent = t; el.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => { el.hidden = true; }, 3800); }

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('cena'), antialias: true, alpha: true });   // alpha: o quarto abre um "buraco" onde passa o YouTube
const CELULAR = matchMedia('(pointer: coarse)').matches;
// modo de desempenho: 'leve' (30 quadros, resolução menor, sem sombras) ou 'bonito'. No celular começa no leve.
let modo = CELULAR ? 'leve' : 'bonito', sombras = modo === 'bonito';
try { const s = localStorage.getItem('quarto-modo'); if (s === 'leve' || s === 'bonito') modo = s; const z = localStorage.getItem('quarto-sombras'); sombras = z === null ? modo === 'bonito' : z === '1'; } catch {}
const razaoPixel = () => Math.min(devicePixelRatio || 1, modo === 'leve' ? (CELULAR ? 1.15 : 1.25) : (CELULAR ? 1.5 : 2));
renderer.setPixelRatio(razaoPixel());
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;     // sombras só são refeitas quando algo se mexe
const cena = new THREE.Scene(); cena.background = new THREE.Color(0x1b1a1f);
const pm = new THREE.PMREMGenerator(renderer);
cena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
function ajustar() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', ajustar); ajustar();

// ---------- quarto ----------
const { x0, x1, z0, z1, h } = QUARTO, T = 0.2, W = x1 - x0, D = z1 - z0;
const matParede = new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.95 });
const matRodape = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
const matTeto = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.95 });
const paredes = new THREE.Group(); cena.add(paredes);
const caixa = (ax, ay, az, bx, by, bz, mat, pai = paredes, sombra = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(bx - ax, by - ay, bz - az), mat);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m;
};
const piso = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: texLadrilho('#d9d4c7', W, D), roughness: 0.5 }));
piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; cena.add(piso);
caixa(x0 - T, 0, z0 - T, x1 + T, h, z0, matParede);     // fundo
caixa(x0 - T, 0, z1, x1 + T, h, z1 + T, matParede);     // frente
caixa(x0 - T, 0, z0, x0, h, z1, matParede);             // esquerda
caixa(x1, 0, z0, x1 + T, h, z1, matParede);             // direita
caixa(x0 - T, h, z0 - T, x1 + T, h + 0.15, z1 + T, matTeto, cena);
for (const [a, b, c, d] of [[x0, z0, x1, z0 + 0.03], [x0, z1 - 0.03, x1, z1], [x0, z0, x0 + 0.03, z1], [x1 - 0.03, z0, x1, z1]])
  caixa(a, 0, b, c, 0.12, d, matRodape, paredes, false);

// ---------- colisões ----------
const colisores = [];
const bloquear = (ax, az, bx, bz) => colisores.push({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz) });
function empurrar(p, RAIO = RAIO_GATO) {
  for (let it = 0; it < 2; it++) for (const c of colisores) {
    const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= RAIO * RAIO) continue;
    if (d2 < 1e-8) { const e = [p.x - c.x0, c.x1 - p.x, p.z - c.z0, c.z1 - p.z], i = e.indexOf(Math.min(...e));
      if (i === 0) p.x = c.x0 - RAIO; else if (i === 1) p.x = c.x1 + RAIO; else if (i === 2) p.z = c.z0 - RAIO; else p.z = c.z1 + RAIO; }
    else { const d = Math.sqrt(d2), k = (RAIO - d) / d; p.x += dx * k; p.z += dz * k; }
  }
  p.x = Math.max(x0 + RAIO, Math.min(x1 - RAIO, p.x)); p.z = Math.max(z0 + RAIO, Math.min(z1 - RAIO, p.z));
}

// dá para ficar em (x, z) com folga de r? (usado pelo pato para escolher aonde ir)
function livre(x, z, r = 0.45) {
  if (x < x0 + r || x > x1 - r || z < z0 + r || z > z1 - r) return false;
  return !colisores.some((c) => x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r);
}

// ---------- móveis (posições combinadas no PDF) ----------
// Mesa no canto do fundo, à esquerda (como na foto). Quem senta olha para a parede do fundo:
//   atrás dele fica a estante de caixas, à direita a estante de livros com o baú, e na parede da esquerda o quadro branco e o mural.
const mesa = criarMesa(), MESA = { x: x0 + mesa.L / 2 + 0.03, z: z0 + mesa.P / 2 + 0.03 };
mesa.g.position.set(MESA.x, 0, MESA.z); cena.add(mesa.g); bloquear(MESA.x - mesa.L / 2, z0, MESA.x + mesa.L / 2, MESA.z + mesa.P / 2);
const nichos = criarNichos(); nichos.g.position.set(MESA.x, 1.45, z0); cena.add(nichos.g);
// em cima da mesa, da esquerda para a direita: luminária, bandeja de entrada, computador (na frente da cadeira) e a TV com o aparelho
const pc = criarComputador(); pc.g.position.set(MESA.x, mesa.A, MESA.z); cena.add(pc.g);
const tv = criarTV(); tv.g.position.set(MESA.x + 0.8, mesa.A, MESA.z - 0.12); cena.add(tv.g);
try { if (localStorage.getItem('quarto-pc') === '1') pc.ligar(true); if (localStorage.getItem('quarto-tv') === '1') tv.ligar(true); } catch {}
function alternarAparelho(a, chave) { a.ligar(!a.ligado()); clique(); try { localStorage.setItem(chave, a.ligado() ? '1' : '0'); } catch {} atualizarBotoes(true); }
const BAND = { x: MESA.x - 0.62, z: MESA.z + 0.02 };
const bandeja = criarBandeja(); bandeja.g.position.set(BAND.x, mesa.A, BAND.z); bandeja.g.rotation.y = -0.08; cena.add(bandeja.g);
const cadeira = criarCadeira(), CAD = { x: MESA.x, z: MESA.z + 0.62 };
cadeira.g.position.set(CAD.x, 0, CAD.z); cena.add(cadeira.g); bloquear(CAD.x - 0.22, CAD.z - 0.22, CAD.x + 0.22, CAD.z + 0.22);

const COL = 20, LIN = 7;
const estante = criarEstante({ colunas: COL, linhas: LIN }); estante.g.position.set(0, 0, z1); cena.add(estante.g);
bloquear(x0, z1 - estante.fundo - 0.02, x1, z1);
const caixaPorId = new Map(estante.caixas.map((c) => [c.id, c]));

const livros = criarEstanteLivros({ comLivros: false }), LIV = { z: -0.6 };
livros.g.position.set(x1, 0, LIV.z); livros.g.rotation.y = Math.PI; cena.add(livros.g);
bloquear(x1 - livros.D, LIV.z - livros.L / 2, x1, LIV.z + livros.L / 2);
// os livros da estante: clássicos em domínio público, com capa, que dá para puxar e ler
const biblioteca = criarBiblioteca({ estante: livros, aviso });
const bau = criarBau(), BAU = { z: LIV.z + livros.L / 2 + 0.18 + bau.L / 2 };      // à direita de quem olha para os livros
bau.g.position.set(x1, 0, BAU.z); bau.g.rotation.y = Math.PI; cena.add(bau.g);
bloquear(x1 - bau.D - 0.02, BAU.z - bau.L / 2, x1, BAU.z + bau.L / 2);

const QB = { w: 1.8, h: 1.1, y: 1.4, z: -1.05 };     // quadro branco: 1,80 x 1,10 m, de 0,85 m a 1,95 m do chão
const quadro = criarQuadro({ proporcao: QB.w / QB.h, aviso });
const quadroBranco = criarQuadroBranco(QB.w, QB.h, quadro.textura);
quadroBranco.g.position.set(x0, QB.y, QB.z); quadroBranco.g.rotation.y = Math.PI / 2; cena.add(quadroBranco.g);
const MU = { z: 1.75 };
// projetor no teto, projetando na parede do fundo (a mais vazia, ao lado da mesa). Imagem de até 3,20 x 1,80 m (16:9).
const TELA = { x: 0.9, y: 1.65, z: z0, w: 3.2, h: 1.8 };
const projetor = criarProjetor(cena, { tela: TELA, lente: { x: TELA.x, y: h - 0.32, z: 0.55, alturaTeto: h }, aviso });
const mural = criarMural(cena, { x: x0 + 0.005, y: 1.45, z: MU.z, w: 2.4, h: 1.2, ry: Math.PI / 2 }, { quem: () => 'Gatinho de terno', aviso });

// ---------- lâmpada de cordinha ----------
const lamp = new THREE.Group(); lamp.position.set(LAMPADA.x, 0, LAMPADA.z); cena.add(lamp);
const matFio = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
const matLatao = new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 0.35, metalness: 0.7 });
const matVidro = new THREE.MeshStandardMaterial({ color: 0xfff8ea, roughness: 0.15, transparent: true, opacity: 0.55, emissive: 0xffd9a0, emissiveIntensity: 0 });
const add = (geo, mat, y, pai = lamp) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; pai.add(m); return m; };
add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), matLatao, h - 0.01);
const yBocal = h - 0.35;
add(new THREE.CylinderGeometry(0.006, 0.006, 0.33, 6), matFio, (h + yBocal) / 2 + 0.03);
add(new THREE.CylinderGeometry(0.032, 0.036, 0.09, 18), matLatao, yBocal).castShadow = true;
const bulbo = add(new THREE.SphereGeometry(0.065, 24, 18), matVidro, yBocal - 0.1); bulbo.scale.set(1, 1.15, 1);
const filamento = add(new THREE.TorusGeometry(0.015, 0.003, 6, 16), new THREE.MeshBasicMaterial({ color: 0x6b5a3a }), yBocal - 0.1);
const corda = new THREE.Group(); corda.position.set(0.03, yBocal - 0.03, 0); lamp.add(corda);
const COMP = 1.8, NC = 90, contas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 4), matLatao, NC);
const M4 = new THREE.Matrix4();
for (let i = 0; i < NC; i++) contas.setMatrixAt(i, M4.makeTranslation(0, -i * COMP / NC, 0));
corda.add(contas);
const puxador = add(new THREE.CylinderGeometry(0.014, 0.02, 0.07, 14), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 }), -COMP - 0.035, corda); puxador.castShadow = true;
const alvoCorda = add(new THREE.CylinderGeometry(0.12, 0.12, COMP + 0.3, 8), new THREE.MeshBasicMaterial({ visible: false }), -COMP / 2 - 0.05, corda);
const luz = new THREE.PointLight(0xfff3e0, 0, 0, 1.15);
luz.position.set(0, yBocal - 0.1, 0); luz.castShadow = sombras; luz.shadow.mapSize.set(CELULAR ? 512 : 1024, CELULAR ? 512 : 1024); luz.shadow.bias = -0.002; luz.shadow.radius = 4; luz.shadow.intensity = 0.45;
function aplicarModo() {
  renderer.setPixelRatio(razaoPixel()); ajustar(); luz.castShadow = sombras; renderer.shadowMap.needsUpdate = true; window.quartoPato?.sombra(sombras && modo === 'bonito');
  document.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('on', b.dataset.modo === modo));
  const c = $('chkSombras'); if (c) c.checked = sombras;
  try { localStorage.setItem('quarto-modo', modo); localStorage.setItem('quarto-sombras', sombras ? '1' : '0'); } catch {}
}
lamp.add(luz);
const fundo = new THREE.HemisphereLight(0xaab4d6, 0x3a3540, 0.28); cena.add(fundo);
const COR_FUNDO = { apagada: [new THREE.Color(0xaab4d6), new THREE.Color(0x3a3540)], acesa: [new THREE.Color(0xfbfaf6), new THREE.Color(0xc9c2b6)] };
let acesa = true, brilho = 1, puxao = 0, audio = null;
function clique() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    for (const [f, dt] of [[2200, 0], [1400, 0.045]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.06, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.04);
      o.connect(g).connect(audio.destination); o.start(t + dt); o.stop(t + dt + 0.05);
    }
  } catch { /* sem som */ }
}
function puxar() { acesa = !acesa; puxao = 1; clique(); try { localStorage.setItem('quarto-luz', acesa ? '1' : '0'); } catch {} }
try { acesa = localStorage.getItem('quarto-luz') !== '0'; } catch { acesa = true; }
brilho = acesa ? 1 : 0;

// ---------- guardados: caixas, baú, mapa da estante ----------
// nomes e tamanhos de cada lugar onde se guarda coisas
let entradaN = 0;
function infoDe(id, r) {
  if (id === 'entrada') return { espacos: guarda.ESPACOS_CAIXA, nome: 'Bandeja de entrada', titulo: 'Bandeja de entrada', onde: 'Organize: toque num item e em Guardar em…' };
  if (id === 'bau') return { espacos: guarda.ESPACOS_BAU, trancavel: true, nome: 'Baú', titulo: 'Baú', onde: 'Trancado com chave' };
  const c = caixaPorId.get(id);
  return { espacos: guarda.ESPACOS_CAIXA, nome: r && r.nome ? `Caixa "${r.nome}"` : c ? `Caixa da fileira ${c.linha}, coluna ${c.coluna}` : 'Caixa', onde: c ? `Caixa da fileira ${c.linha}, coluna ${c.coluna}` : '' };
}
const inventario = criarInventario({
  aviso, infoDe,
  aoEscolherDestino: (origemId, cb) => mapa.abrir({ titulo: 'Guardar em…', aoEscolher: cb, extras: [{ id: 'entrada', nome: 'Bandeja de entrada' }, { id: 'bau', nome: 'Baú' }].filter((x) => x.id !== origemId) }),
  aoAbrir: (r, destrancou) => {
    if (r.id === 'bau') { bau.abrir(!!destrancou || inventario.estaDestrancado('bau')); bau.chave.visible = inventario.estaDestrancado('bau'); }
    else { const c = caixaPorId.get(r.id); if (c) estante.abrir(c, true); }
  },
  aoFechar: (r) => {
    if (r.id === 'bau') { bau.abrir(false); bau.chave.visible = inventario.estaDestrancado('bau'); }
    else { const c = caixaPorId.get(r.id); if (c) estante.abrir(c, false); }
  },
  aoMudarRecipiente: (r) => { if (r.id === 'entrada') { entradaN = r.slots.filter(Boolean).length; bandeja.definir(entradaN); return; } const c = caixaPorId.get(r.id); if (c) estante.etiquetar(c, r.nome, r.cor); },
  aoProjetar: (it) => projetor.projetar(it),
  aoVerNaTv: async (it) => { if (!tv.ligado()) alternarAparelho(tv, 'quarto-tv'); await telaTv.carregar(it); telaTv.abrir(); },
});
// ---------- telas do computador e da TV ----------
const telaPc = criarTelaPc({ aviso,
  aoCaixas: () => mapa.abrir(), aoBandeja: () => abrirEntrada(), aoBuscar: () => busca.abrir(),
  aoDesligar: () => { if (pc.ligado()) alternarAparelho(pc, 'quarto-pc'); },
  aoMandarNota: (t) => inventario.guardarNota(t) });
const telaTv = criarTelaTv({ tv3d: tv, aviso, aoDesligar: () => { if (tv.ligado()) alternarAparelho(tv, 'quarto-tv'); } });
function usarPc() {                 // senta na cadeira (se precisar) e abre a tela
  if (!pc.ligado()) alternarAparelho(pc, 'quarto-pc');
  const abrir = () => telaPc.abrir({ ligando: pc.iniciando() });
  if (eu.sentado === 'cadeira') abrir(); else irAte(CAD.x + 0.05, CAD.z + 0.6, CAD.x, CAD.z, () => { sentar('cadeira'); setTimeout(abrir, 600); });
}
function verTv() { if (!tv.ligado()) alternarAparelho(tv, 'quarto-tv'); telaTv.abrir(); }
const abrirCaixa = (id, slot) => { if (caixaPorId.has(id)) inventario.abrir(id, { selecionar: slot }); };
const abrirBau = (slot) => inventario.abrir('bau', { selecionar: slot });
const abrirEntrada = (slot) => inventario.abrir('entrada', { selecionar: slot });
const mapa = criarMapaEstante({ colunas: COL, linhas: LIN, aoEscolher: (id) => irAteRecipiente(id) });
(async () => { try { for (const r of await guarda.todosRecipientes()) { if (r.id === 'entrada') { entradaN = r.slots.filter(Boolean).length; bandeja.definir(entradaN); } const c = caixaPorId.get(r.id); if (c && r.nome) estante.etiquetar(c, r.nome, r.cor); } } catch { /* nada guardado ainda */ } })();
const busca = criarBusca({ inventario, infoDe, aoIr: (id, slot) => irAteRecipiente(id, slot) });
$('btnBuscar').addEventListener('click', () => { fecharMenus(); busca.abrir(); });
$('btnAnotar').addEventListener('click', () => { const m = $('anotarMenu'), ab = m.hidden; fecharMenus(); m.hidden = !ab; });
$('anotarMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; $('anotarMenu').hidden = true; inventario.capturar(b.dataset.c); });
function fecharMenus() { $('anotarMenu').hidden = true; $('menu').classList.remove('on'); $('painel').classList.remove('on'); }

// ---------- avatar ----------
const ALTURA_GATO = 1.3;
const gltf = await new GLTFLoader().loadAsync(MODELO, (e) => { $('barra').style.width = Math.min(98, 100 * e.loaded / (e.total || 1110668)) + '%'; });     // sem tamanho informado, usa o tamanho do gatinho leve
$('carregando').classList.add('fim');
const gato = criarGato(gltf);
const caixaG = new THREE.Box3().setFromObject(gato.modelo);
const esc = ALTURA_GATO / (caixaG.max.y - caixaG.min.y);
const interno = new THREE.Group(); interno.scale.setScalar(esc); interno.position.y = -caixaG.min.y * esc; interno.add(gato.modelo);
const avatar = new THREE.Group(); avatar.add(interno); cena.add(avatar);
gato.modelo.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
const eu = { x: 0.6, z: 1.2, yaw: 0, andando: false, sentado: null, altSent: 0 };   // sentado: null | 'chao' | 'cadeira'
avatar.position.set(eu.x, 0, eu.z); avatar.updateMatrixWorld(true);
const vq = new THREE.Vector3(), perna = gato.modelo.getObjectByName('perna_esq');
const hipAlt = perna ? perna.getWorldPosition(vq).y : 0.26;
{
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.position.y = 0.006; avatar.add(s);
}

// ---------- o Microduck (bichinho do quarto) ----------
const pato = await criarPato(cena, {
  escala: 2.6, inicio: { x: -0.7, z: 2.0, yaw: 2.6 }, empurrar, livre, limites: QUARTO,
  gato: () => ({ x: eu.x, z: eu.z, yaw: eu.yaw, andando: eu.andando, sentado: eu.sentado, humor: humorAtual }),
  luzAcesa: () => acesa,
});
const distPato = () => { const d = pato.pos(); return Math.hypot(eu.x - d.x, eu.z - d.z); };
// o gatinho vai até o pato (para a uma certa distância, de frente para ele) e depois faz algo
function irAtePato(dist, depois) {
  const d = pato.pos(), dx = eu.x - d.x, dz = eu.z - d.z, l = Math.hypot(dx, dz) || 1, p = { x: d.x + dx / l * dist, z: d.z + dz / l * dist };
  empurrar(p); pato.esperar(8);
  const f = () => setTimeout(depois, 90);     // espera o "parar de andar" terminar, senão ele cancela o gesto
  if (Math.hypot(p.x - eu.x, p.z - eu.z) < 0.2) { irAte(eu.x, eu.z, d.x, d.z, f); return; }
  irAte(p.x, p.z, d.x, d.z, f);
}
const carinhoNoPato = () => irAtePato(0.8, () => { gato.acao('fazer_carinho_pato'); pato.receberCarinho(); });
const brincarComPato = () => irAtePato(1.15, () => { gato.acao('dancar'); setTimeout(() => gato.acao('dancar'), 2800); pato.brincar(); });
function darComida() {
  levantar(); ir = null; if (eu.andando) { gato.parar(0.1); eu.andando = false; }
  const p = { x: eu.x + Math.sin(eu.yaw) * 0.85, z: eu.z + Math.cos(eu.yaw) * 0.85 }; empurrar(p, 0.25);
  gato.acao('jogar_comida'); setTimeout(() => pato.comida(p.x, p.z), 650);
}
function chamarPato() { if (eu.andando) { gato.parar(0.1); eu.andando = false; } gato.acao('acenar'); pato.chamar(); }
const PATO = { chamar: ['Chamar', chamarPato], carinho: ['Fazer carinho', carinhoNoPato], brincar: ['Brincar', brincarComPato], comida: ['Dar comida', darComida],
  dormir: ['Dormir / acordar', () => (pato.dormindo() ? pato.fazer.acordar() : pato.fazer.dormir())], quack: ['Pedir um quack', () => pato.fazer.quack()] };

// humores e gestos (os mesmos do museu, sem os românticos)
const HUMORES = { normal: 'Normal', feliz: 'Feliz', falando: 'Falando', triste: 'Triste', chorando: 'Chorando', brava: 'Bravo', irritada: 'Irritado', surpresa: 'Surpreso', tonta: 'Tonto', sono: 'Com sono', dormindo: 'Dormindo', marota: 'Maroto', envergonhada: 'Envergonhado' };
const GESTOS = { tchau: 'Dar tchau', acenar: 'Acenar', pular: 'Pular', pulinhos: 'Pulinhos', comemorar: 'Comemorar', dancar: 'Dançar', palmas: 'Palmas', espreguicar: 'Espreguiçar', marchar: 'Marchar', girar: 'Girar', reverencia: 'Reverência', pensar: 'Pensar', olhar: 'Olhar ao redor', espirro: 'Espirrar', susto: 'Susto', timida: 'Tímido', sacudir: 'Sacudir', balancar: 'Balançar' };
let humorAtual = 'normal', tTchau = null;
const botao = (txt, fn) => { const b = document.createElement('button'); b.textContent = txt; b.addEventListener('click', fn); return b; };
function marcarHumor() { for (const b of $('gradeHumores').children) b.classList.toggle('sel', b.dataset.h === humorAtual); }
for (const [k, v] of Object.entries(HUMORES)) { const b = botao(v, () => { clearTimeout(tTchau); humorAtual = k; gato.humor(k); marcarHumor(); pato.reagir(k); }); b.dataset.h = k; $('gradeHumores').append(b); }
for (const [k, v] of Object.entries(GESTOS)) $('gradeGestos').append(botao(v, () => {
  if (eu.andando) { gato.parar(0.1); eu.andando = false; }
  if (k === 'tchau') { gato.humor('tchau'); clearTimeout(tTchau); tTchau = setTimeout(() => gato.humor(humorAtual), 2600); }
  else gato.acao(k);
  pato.reagir(k);
}));
marcarHumor();
for (const [, [txt, fn]] of Object.entries(PATO)) $('gradePato').append(botao(txt, () => { fecharMenus(); fn(); }));
$('btnEmocoes').addEventListener('click', () => { $('menu').classList.remove('on'); $('painel').classList.toggle('on'); });

// ---------- sentar (no chão ou na cadeira) ----------
function sentar(onde) {
  if (eu.andando) { gato.parar(0.1); eu.andando = false; }
  ir = null;
  if (onde === 'cadeira') { eu.x = CAD.x; eu.z = CAD.z + 0.02; eu.yaw = Math.PI; eu.altSent = cadeira.alt + 0.03 - hipAlt; gato.sentar(true, false); }
  else { eu.altSent = 0.02 - hipAlt; gato.sentar(true, true); pato.reagir('sentou'); }
  eu.sentado = onde; atualizarBotoes();
}
function levantar() {
  assistindo = false;
  if (!eu.sentado) return;
  if (eu.sentado === 'cadeira') { eu.z = CAD.z + 0.62; eu.yaw = 0; }
  eu.sentado = null; gato.sentar(false); pato.reagir('levantou'); atualizarBotoes();
}
$('btnSentar').addEventListener('click', () => (eu.sentado ? levantar() : sentar('chao')));
addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat) (eu.sentado ? levantar() : sentar('chao')); });

// ---------- puxar a cordinha ----------
const bracoD = gato.modelo.getObjectByName('braco_dir'), antebracoD = gato.modelo.getObjectByName('antebraco_dir');
const pata = gato.modelo.getObjectByName('pata_dir') || antebracoD, vPata = new THREE.Vector3(), vCorda = new THREE.Vector3(), qCorda = new THREE.Quaternion(), BAIXO = new THREE.Vector3(0, -1, 0);
let pux = null;
const qSem = { b: new THREE.Quaternion(), a: new THREE.Quaternion() }, qTmp = new THREE.Quaternion(), EZ = new THREE.Vector3(0, 0, 1), EX = new THREE.Vector3(1, 0, 0);
function pedirPuxar() { if (pux) return; levantar(); ir = null; if (eu.andando) { gato.parar(0.1); eu.andando = false; } pux = { t: 0, feito: false }; }

// ---------- andar sozinho até um móvel e depois fazer algo ----------
let ir = null;     // { x, z, ox, oz, depois, t }
function irAte(x, z, ox, oz, depois) { levantar(); pux = null; ir = { x, z, ox, oz, depois, t: 0 }; }
function irAteCaixa(c, slot) { if (!c) return; irAte(c.x, z1 - estante.fundo - 0.5, c.x, z1, () => abrirCaixa(c.id, slot)); }
const irAteBau = (slot) => irAte(x1 - bau.D - 0.5, BAU.z, x1, BAU.z, () => abrirBau(slot));
const irAteEntrada = (slot) => (eu.sentado === 'cadeira' ? abrirEntrada(slot) : irAte(BAND.x + 0.2, MESA.z + 0.66, BAND.x, MESA.z, () => abrirEntrada(slot)));
function irAteRecipiente(id, slot) { if (id === 'entrada') irAteEntrada(slot); else if (id === 'bau') irAteBau(slot); else irAteCaixa(caixaPorId.get(id), slot); }
const irAteLivros = (depois) => irAte(x1 - livros.D - 0.55, LIV.z, x1, LIV.z, depois);
const abrirEstanteLivros = () => irAteLivros(() => biblioteca.abrirLista((i) => biblioteca.abrirLivro(i)));
const irAteQuadro = () => irAte(x0 + 0.75, QB.z, x0, QB.z, () => quadro.abrir());
const irAteMural = () => irAte(x0 + 0.75, MU.z, x0, MU.z, () => mural.abrir());
let assistindo = false;
const irAssistir = () => irAte(TELA.x, z0 + 3.1, TELA.x, z0, () => { sentar('chao'); assistindo = true; });
projetor.aoAssistir = irAssistir;
// apresentação: o gatinho vai para o lado da imagem, de frente para o quarto, e "fala" a cada slide
let apresentando = false, tFala = null;
projetor.aoApresentar = (sim) => {
  apresentando = sim; clearTimeout(tFala);
  if (sim) { const px = TELA.x - projetor.largura() / 2 - 0.55; irAte(px, z0 + 0.95, px, z0 + 5, null); }
  else gato.humor(humorAtual);
};
projetor.aoMudarSlide = () => { if (!apresentando) return; gato.humor('falando'); clearTimeout(tFala); tFala = setTimeout(() => gato.humor(humorAtual), 1600); };
projetor.aoLuz = () => puxar();
const irAteCadeira = () => irAte(CAD.x + 0.05, CAD.z + 0.6, CAD.x, CAD.z, () => sentar('cadeira'));

// ---------- botões do que está perto ----------
const PERTO = [
  { id: 'patoCarinho', rotulo: () => 'Fazer carinho no pato', perto: () => !eu.sentado && distPato() < 1.7, fazer: carinhoNoPato },
  { id: 'patoBrincar', rotulo: () => 'Brincar com o pato', perto: () => !eu.sentado && distPato() < 1.7, fazer: brincarComPato },
  { id: 'cordinha', rotulo: () => (acesa ? 'Apagar a luz' : 'Acender a luz'), perto: () => Math.hypot(eu.x - LAMPADA.x, eu.z - LAMPADA.z) < 1.6, fazer: pedirPuxar },
  { id: 'cadeira', rotulo: () => (eu.sentado === 'cadeira' ? 'Levantar da cadeira' : 'Sentar na cadeira'), perto: () => eu.sentado === 'cadeira' || Math.hypot(eu.x - CAD.x, eu.z - CAD.z) < 1.3, fazer: () => (eu.sentado === 'cadeira' ? levantar() : irAteCadeira()) },
  { id: 'entrada', rotulo: () => 'Bandeja de entrada' + (entradaN ? ` (${entradaN})` : ''), perto: () => eu.sentado === 'cadeira' || Math.hypot(eu.x - BAND.x, eu.z - (MESA.z + 0.6)) < 1.3, fazer: () => irAteEntrada() },
  { id: 'pc', rotulo: () => (pc.ligado() ? 'Usar o computador' : 'Ligar o computador'), perto: () => eu.sentado === 'cadeira' || Math.hypot(eu.x - MESA.x, eu.z - (MESA.z + 0.7)) < 1.2, fazer: usarPc },
  { id: 'tv', rotulo: () => (tv.ligado() ? 'Ver a TV' : 'Ligar a TV'), perto: () => eu.sentado === 'cadeira' || Math.hypot(eu.x - (MESA.x + 0.8), eu.z - (MESA.z + 0.7)) < 1.2, fazer: verTv },
  { id: 'estante', rotulo: () => 'Estante de caixas', perto: () => eu.z > z1 - 1.7 || eu.sentado === 'cadeira', fazer: () => mapa.abrir() },
  { id: 'livros', rotulo: () => 'Pegar um livro', perto: () => Math.hypot(eu.x - (x1 - 0.95), eu.z - LIV.z) < 1.4, fazer: abrirEstanteLivros },
  { id: 'bau', rotulo: () => 'Abrir o baú', perto: () => Math.hypot(eu.x - (x1 - 0.8), eu.z - BAU.z) < 1.4, fazer: irAteBau },
  { id: 'projetor', rotulo: () => 'Projetor', perto: () => eu.z < z0 + 3.8 && eu.x > TELA.x - 2.2 && eu.x < TELA.x + 2.6, fazer: () => projetor.abrirPainel() },
  { id: 'quadro', rotulo: () => 'Quadro branco', perto: () => eu.x < x0 + 1.8 && Math.abs(eu.z - QB.z) < 1.4, fazer: irAteQuadro },
  { id: 'mural', rotulo: () => 'Mural', perto: () => eu.x < x0 + 1.8 && Math.abs(eu.z - MU.z) < 1.6, fazer: irAteMural },
];
let pertoAgora = '';
function atualizarBotoes(forcar) {
  const lista = PERTO.filter((p) => p.perto());
  const chave = lista.map((p) => p.id + ':' + p.rotulo()).join('|') + (eu.sentado || '') + (pux ? 'p' : '');
  if (chave === pertoAgora && !forcar) return; pertoAgora = chave;
  const el = $('interacoes'); el.innerHTML = '';
  if (!pux) lista.slice(0, 4).forEach((p, i) => { const b = botao(p.rotulo(), p.fazer); b.className = 'vidro pilula' + (i === 0 ? ' forte' : ''); el.append(b); });     // no máximo 4, para não cobrir a tela
  $('btnSentar').textContent = eu.sentado ? 'Levantar' : 'Sentar no chão';
}
addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) { const p = PERTO.find((q) => q.perto()); if (p) p.fazer(); } });

// ---------- entrada ----------
const teclas = new Set();
addEventListener('keydown', (e) => { teclas.add(e.code); });
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
const joy = { x: 0, y: 0, id: null }, joyEl = $('joy'), knob = $('knob');
function joyMover(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`; joy.x = dx / R; joy.y = -dy / R;
}
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMover(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMover(e); });
const joyFim = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', joyFim); joyEl.addEventListener('pointercancel', joyFim);

const cam = { yaw: 0.35, pitch: 0.22, dist: 3.6 };
let arrasto = null;
const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
$('cena').addEventListener('pointerdown', (e) => { if (!arrasto) arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; $('cena').setPointerCapture(e.pointerId); });
$('cena').addEventListener('pointermove', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  cam.yaw -= (e.clientX - arrasto.x) * 0.0055; cam.pitch = Math.max(-0.2, Math.min(1.1, cam.pitch + (e.clientY - arrasto.y) * 0.004));
  arrasto.x = e.clientX; arrasto.y = e.clientY;
});
$('cena').addEventListener('pointerup', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const toque = Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 8; arrasto = null;
  if (!toque) return;
  fecharMenus();
  ponteiro.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raio.setFromCamera(ponteiro, camera);
  const hit = raio.intersectObjects([bandeja.g, pc.g, tv.g, alvoCorda, bulbo, puxador, estante.corpo, estante.tampa, bau.g, quadroBranco.g, cadeira.g, cena.getObjectByName('muralGrupo'), projetor.aparelho, projetor.ligado() ? projetor.imagem : null, pato.grupo, biblioteca.malha, livros.g].filter(Boolean), true)[0];
  if (!hit || hit.distance > 7) return;
  const dono = (o, g) => { for (let p = o; p; p = p.parent) if (p === g) return true; return false; };
  if (dono(hit.object, pato.grupo)) carinhoNoPato();
  else if (hit.object === biblioteca.malha) { const i = biblioteca.indiceDoToque(hit.faceIndex); irAteLivros(() => biblioteca.abrirLivro(i)); }
  else if (dono(hit.object, livros.g)) abrirEstanteLivros();
  else if (hit.object === estante.corpo || hit.object === estante.tampa) irAteCaixa(estante.caixas[hit.instanceId]);
  else if (dono(hit.object, bandeja.g)) irAteEntrada();
  else if (dono(hit.object, pc.g)) usarPc();
  else if (dono(hit.object, tv.g)) verTv();
  else if (dono(hit.object, projetor.aparelho) || hit.object === projetor.imagem) projetor.abrirPainel();
  else if (dono(hit.object, bau.g)) irAteBau();
  else if (dono(hit.object, quadroBranco.g)) irAteQuadro();
  else if (dono(hit.object, cadeira.g)) (eu.sentado === 'cadeira' ? levantar() : irAteCadeira());
  else if (hit.object.name === 'muralPlaca' || dono(hit.object, cena.getObjectByName('muralGrupo'))) irAteMural();
  else if (Math.hypot(eu.x - LAMPADA.x, eu.z - LAMPADA.z) < 2.2) pedirPuxar();
});
$('cena').addEventListener('pointercancel', () => { arrasto = null; });
$('cena').addEventListener('wheel', (e) => { cam.dist = Math.max(1.4, Math.min(5, cam.dist + e.deltaY * 0.003)); }, { passive: true });

// ---------- menu: backup ----------
$('btnMenu').addEventListener('click', async () => {
  $('painel').classList.remove('on'); $('anotarMenu').hidden = true; const m = $('menu'); m.classList.toggle('on'); if (!m.classList.contains('on')) return;
  const est = await guarda.espaco(), ult = await guarda.extra('config-backup').catch(() => null);
  $('infoEspaco').textContent = est && est.usage != null ? `Ocupando ${(est.usage / 1048576).toFixed(1)} MB neste aparelho.` : '';
  $('infoBackup').textContent = ult ? `Último backup: ${new Date(ult.em).toLocaleDateString('pt-BR')}.` : 'Você ainda não fez backup.';
});
$('btnBackup').addEventListener('click', async () => {
  try {
    const blob = await guarda.gerarBackup(), a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob); a.download = `quarto-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    aviso('Backup baixado. Guarde o arquivo num lugar seguro (ele não vai para o GitHub).'); $('menu').classList.remove('on');
  } catch { aviso('Não consegui fazer o backup.'); }
});
$('btnRestaurar').addEventListener('click', () => { $('confirmaRestaurar').hidden = false; });
$('naoRestaurar').addEventListener('click', () => { $('confirmaRestaurar').hidden = true; });
$('simRestaurar').addEventListener('click', () => { $('confirmaRestaurar').hidden = true; $('arqBackup').click(); });
$('arqBackup').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { await guarda.restaurarBackup(f); aviso('Backup restaurado. Recarregando…'); setTimeout(() => location.reload(), 900); }
  catch { aviso('Esse arquivo não é um backup do quarto.'); }
});
(async () => {     // lembrete de backup (uma vez por visita, se faz tempo)
  try {
    const recs = await guarda.todosRecipientes(); if (!recs.some((r) => r.slots.some(Boolean))) return;
    const ult = await guarda.extra('config-backup');
    if (!ult || Date.now() - ult.em > 14 * 864e5) setTimeout(() => aviso('Faz tempo que você não faz backup. Está no menu ☰.'), 4000);
  } catch { /* sem lembrete */ }
})();

// ---------- loop ----------
let ultimo = performance.now();
const olhar = new THREE.Vector3(), desejada = new THREE.Vector3();
const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const algoAberto = () => biblioteca.aberto() || telaPc.aberta() || telaTv.aberta() || projetor.apresentando() || busca.aberto() || inventario.aberto() || quadro.aberto() || mural.aberto() || mapa.aberto();
const telaCheia = () => biblioteca.aberto() || telaPc.aberta() || telaTv.aberta() || busca.aberto() || quadro.aberto() || mural.aberto() || mapa.aberto() || inventario.visor.aberto();
let quadroN = 0, sombraN = 0;
const virarPara = (x, z, dt, vel = 10) => { let d = Math.atan2(x - eu.x, z - eu.z) - eu.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); eu.yaw += d * Math.min(1, dt * vel); return Math.abs(d); };
camera.position.set(eu.x + Math.sin(cam.yaw) * cam.dist, 1.6, eu.z + Math.cos(cam.yaw) * cam.dist);
window.quartoPato = pato;
window.quarto = { biblioteca, abrirEstanteLivros, pato, busca, abrirEntrada, cam, eu, gato, projetor, irAssistir, pedirPuxar, abrirCaixa, abrirBau, irAteCaixa, irAteBau, quadro, mural, mapa, inventario, sentar, levantar };     // para testar pelo console
atualizarBotoes(true);
let ultimoDesenho = 0, ultimaEntrada = performance.now(), ocioso = false;
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, () => { ultimaEntrada = performance.now(); }, { passive: true });
const intervalo = () => (ocioso ? (modo === 'leve' ? 1000 / 15 : 1000 / 30) : (modo === 'leve' ? 1000 / 30 : 1000 / 60));   // nunca passa de 60, nem em tela de 120 Hz
aplicarModo();
for (const b of document.querySelectorAll('[data-modo]')) b.addEventListener('click', () => { modo = b.dataset.modo; sombras = modo === 'bonito'; aplicarModo(); aviso(modo === 'leve' ? 'Modo leve: esquenta menos e gasta menos bateria.' : 'Modo bonito: sombras e imagem mais nítida.'); });
$('chkSombras').addEventListener('change', (e) => { sombras = e.target.checked; aplicarModo(); });
renderer.setAnimationLoop(() => {
  const agora = performance.now();
  if (agora - ultimoDesenho < intervalo() - 3) return;        // limita os quadros por segundo (30 no modo leve, menos ainda parado)
  ultimoDesenho = agora;
  const dt = Math.min(0.075, (agora - ultimo) / 1000); ultimo = agora;     // aguenta 15 quadros/s sem deixar a animação lenta

  let ix = joy.x, iy = joy.y;
  if (!algoAberto()) {
    if (teclas.has('KeyW') || teclas.has('ArrowUp')) iy += 1; if (teclas.has('KeyS') || teclas.has('ArrowDown')) iy -= 1;
    if (teclas.has('KeyD') || teclas.has('ArrowRight')) ix += 1; if (teclas.has('KeyA') || teclas.has('ArrowLeft')) ix -= 1;
  } else ix = iy = 0;
  const mag = Math.min(1, Math.hypot(ix, iy));
  if (mag > 0.08) { if (eu.sentado && !pux) levantar(); ir = null; }
  let andandoAgora = false;
  if (mag > 0.08 && !pux && !eu.sentado) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * iy + rx * ix, mz = fz * iy + rz * ix; const n = Math.hypot(mx, mz); mx /= n; mz /= n;
    eu.x += mx * VELOCIDADE * mag * dt; eu.z += mz * VELOCIDADE * mag * dt; empurrar(eu);
    virarPara(eu.x + mx, eu.z + mz, dt, 12); andandoAgora = true;
  } else if (ir) {          // andando sozinho até um móvel
    ir.t += dt; const dx = ir.x - eu.x, dz = ir.z - eu.z, dist = Math.hypot(dx, dz);
    if (dist > 0.12 && ir.t < 6) {
      const sp = Math.min(dist, VELOCIDADE * dt); eu.x += dx / dist * sp; eu.z += dz / dist * sp; empurrar(eu);
      virarPara(eu.x + dx, eu.z + dz, dt, 12); andandoAgora = true;
    } else if (virarPara(ir.ox, ir.oz, dt) < 0.25 || ir.t > 7) { const f = ir.depois; ir = null; f && f(); }
  }
  if (andandoAgora && !eu.andando) { gato.acao('andar'); eu.andando = true; }
  else if (!andandoAgora && eu.andando && !pux) { gato.parar(0.25); eu.andando = false; }

  // puxando a cordinha
  let kBraco = 0, kPuxa = 0;
  if (pux) {
    const dx = LAMPADA.x + 0.03 - eu.x, dz = LAMPADA.z - eu.z, dist = Math.hypot(dx, dz);
    if (pux.t === 0 && dist > 0.34) {
      const k = Math.max(0.35, Math.min(1, (dist - 0.28) / 0.3)), sp = VELOCIDADE * 0.8 * k * dt;
      eu.x += dx / dist * sp; eu.z += dz / dist * sp;
      if (!eu.andando) { gato.acao('andar'); eu.andando = true; }
    } else if (eu.andando) { gato.parar(0.15); eu.andando = false; }
    const d = virarPara(LAMPADA.x + 0.03, LAMPADA.z, dt);
    if (!eu.andando && (pux.t > 0 || d < 0.35)) pux.t += dt;
    const t = pux.t;
    kBraco = sm(t / 0.35) * (1 - sm((t - 0.95) / 0.35));
    kPuxa = t > 0.45 ? Math.sin(Math.min(1, (t - 0.45) / 0.35) * Math.PI) : 0;
    if (!pux.feito && t > 0.6) { pux.feito = true; puxar(); }
    if (t > 1.35) pux = null;
  }

  avatar.position.set(eu.x, 0, eu.z); avatar.rotation.y = eu.yaw;
  if (kBraco > 0.001 || qSem.ativo) { bracoD.quaternion.copy(qSem.b); antebracoD.quaternion.copy(qSem.a); }
  gato.atualizar(dt);
  avatar.position.y = eu.altSent * gato.nivelSentado();
  pato.atualizar(dt);
  qSem.b.copy(bracoD.quaternion); qSem.a.copy(antebracoD.quaternion); qSem.ativo = kBraco > 0.001;
  if (qSem.ativo) {
    bracoD.quaternion.multiply(qTmp.setFromAxisAngle(EZ, (2.5 - 0.35 * kPuxa) * kBraco)).multiply(qTmp.setFromAxisAngle(EX, -0.55 * kBraco));
    antebracoD.quaternion.multiply(qTmp.setFromAxisAngle(EZ, (0.35 + 0.4 * kPuxa) * kBraco));
  }
  atualizarBotoes();

  // móveis que se mexem
  estante.atualizar(dt); bau.atualizar(dt); biblioteca.atualizar(dt); projetor.atualizar(dt, brilho);

  // lâmpada
  brilho += ((acesa ? 1 : 0) - brilho) * Math.min(1, dt * 18);
  luz.intensity = 13 * brilho; matVidro.emissiveIntensity = 3 * brilho; filamento.material.color.setRGB(0.42 + 0.58 * brilho, 0.35 + 0.6 * brilho, 0.23 + 0.5 * brilho);
  fundo.intensity = 0.38 + 0.42 * brilho;
  fundo.color.copy(COR_FUNDO.apagada[0]).lerp(COR_FUNDO.acesa[0], brilho); fundo.groundColor.copy(COR_FUNDO.apagada[1]).lerp(COR_FUNDO.acesa[1], brilho);
  cena.environmentIntensity = 0.08 + 0.26 * brilho;
  puxao = Math.max(0, puxao - dt * 2.2);
  corda.position.y = yBocal - 0.03 - Math.sin((1 - puxao) * Math.PI) * 0.07 * (puxao > 0 ? 1 : 0);
  corda.rotation.set(0, 0, Math.sin(agora / 140) * 0.12 * puxao + Math.sin(agora / 900) * 0.01);
  const pega = pux ? kBraco * kBraco : 0;
  if (pega > 0.001) { pata.getWorldPosition(vPata); corda.getWorldPosition(vCorda); vPata.sub(vCorda).normalize(); qCorda.setFromUnitVectors(BAIXO, vPata); corda.quaternion.slerp(qCorda, pega); }

  // câmera em 3ª pessoa, sem sair do quarto nem entrar na estante
  if (apresentando) {                               // apresentando: câmera no meio do quarto vendo a parede inteira e o gatinho do lado
    olhar.set(TELA.x - 0.45, TELA.y - 0.15, TELA.z); const dAp = Math.min(z1 - z0 - 0.75, Math.max(4.0, 2.3 / (Math.tan(Math.PI / 6) * camera.aspect)));    // celular em pé: câmera mais para trás
    desejada.set(TELA.x - 0.35, 1.45, z0 + dAp); cam.yaw = 0;
  } else if (assistindo && eu.sentado === 'chao') {        // assistindo: câmera atrás do gatinho, olhando a imagem na parede
    olhar.set(TELA.x, TELA.y - 0.1, TELA.z); desejada.set(eu.x + 0.35, 1.25, eu.z + 1.5); cam.yaw = 0;
  } else {
    olhar.set(eu.x, 0.95 + avatar.position.y * 0.6, eu.z);
    desejada.set(eu.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, 1.0 + Math.sin(cam.pitch) * cam.dist, eu.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  }
  desejada.x = Math.max(x0 + 0.15, Math.min(x1 - 0.15, desejada.x)); desejada.z = Math.max(z0 + 0.15, Math.min(z1 - estante.fundo - 0.12, desejada.z));
  desejada.y = Math.max(0.25, Math.min(h - 0.2, desejada.y));
  camera.position.lerp(desejada, 1 - Math.exp(-12 * dt)); camera.lookAt(olhar);
  camera.updateMatrixWorld(); projetor.posicionarTela(camera, telaCheia() || inventario.aberto() || projetor.apresentando(), brilho);   // player do YouTube colado na parede
  quadroN++;
  if (telaCheia()) return;                                   // tela cheia por cima: não precisa desenhar o quarto
  if (inventario.aberto() && quadroN % 3) return;            // inventário aberto: desenha o quarto mais devagar
  const aparelhos = pc.atualizar(dt) | tv.atualizar(dt) | telaTv.atualizar(dt, tv.ligado());
  const mexendo = aparelhos || projetor.tocando() || eu.andando || pato.mexendo() || biblioteca.mexendo() || pux || ir || puxao > 0 || Math.abs(brilho - (acesa ? 1 : 0)) > 0.001 || gato.nivelSentado() % 1 !== 0 || estante.caixas.some((c) => c.a !== c.alvo);
  if (mexendo) { sombraN = 0; if (quadroN % 2 === 0) renderer.shadowMap.needsUpdate = true; }
  else if (sombraN < 2) { sombraN++; renderer.shadowMap.needsUpdate = true; }
  ocioso = !mexendo && agora - ultimaEntrada > 2500 && !projetor.tocando();
  renderer.render(cena, camera);
});
