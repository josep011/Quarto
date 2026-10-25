// O Microduck do quarto: um bichinho que anda pelo quarto, segue o gatinho, reage aos gestos dele,
// recebe carinho, brinca, come migalhas e dorme quando a luz apaga.
// Modelo 3D: Microduck © Pollen Robotics (CC BY-SA-NC 4.0), simplificado e animado (microduck.js).
import * as THREE from 'three';
import { Microduck } from './microduck.js?v=202610250300';

const ang = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const sorte = (a, b) => a + Math.random() * (b - a);

/**
 * opcoes:
 *  escala      tamanho em relação ao robô real (25 cm). 2,2 ≈ 60 cm, na altura do joelho do gatinho
 *  inicio      { x, z, yaw }
 *  empurrar    (p, raio) => tira p de dentro dos móveis e das paredes
 *  livre       (x, z) => true se dá para ficar ali
 *  limites     { x0, x1, z0, z1 }
 *  gato        () => { x, z, yaw, andando, sentado, humor }
 *  luzAcesa    () => boolean
 */
export async function criarPato(cena, { escala = 2.2, inicio = { x: -0.8, z: 1.8, yaw: 2.4 }, empurrar, livre, limites, gato, luzAcesa, arquivo = './microduck.glb?v=202610250300' }) {
  const duck = await Microduck.load(arquivo);
  const S = escala;
  duck.maxSpeed = 0.27; duck.maxTurn = 2.0; duck.stepTime = 0.22; duck.stepHeight = 0.02;

  // o pato trabalha em "unidades do robô"; o grupo de fora aumenta tudo para o tamanho do quarto
  const grupo = new THREE.Group(); grupo.name = 'pato'; grupo.scale.setScalar(S); cena.add(grupo);
  grupo.add(duck.root);
  duck.place(inicio.x / S, 0, inicio.z / S, inicio.yaw);

  // sombrinha redonda embaixo (barata) — a sombra de verdade só no modo bonito
  {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.003; s.renderOrder = -1; duck.root.add(s);
  }
  function sombra(sim) { duck.root.traverse((o) => { if (o.isMesh && o.material.map == null) { o.castShadow = sim; o.receiveShadow = false; } }); }
  sombra(false);

  // ---------- migalhas ----------
  const NM = 14, migalhas = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.018, 0), new THREE.MeshStandardMaterial({ color: 0xe0b354, roughness: 0.8 }), NM);
  migalhas.count = 0; migalhas.frustumCulled = false; cena.add(migalhas);
  const mig = [], M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), UM = new THREE.Vector3(1, 1, 1);
  function desenharMigalhas() {
    migalhas.count = mig.length;
    mig.forEach((m, i) => { Q.setFromAxisAngle(V.set(0, 1, 0), m.r); M4.compose(V.set(m.x, m.y, m.z), Q, UM); migalhas.setMatrixAt(i, M4); });
    migalhas.instanceMatrix.needsUpdate = true;
  }

  // ---------- estado ----------
  const eu = () => ({ x: duck.root.position.x * S, z: duck.root.position.z * S, yaw: duck.root.rotation.y });
  let alvo = null;              // { x, z, perto, depois, olhar, t, rapido }
  let pausa = sorte(2, 5);      // tempo até decidir a próxima coisa
  let segurar = 0;              // fica parado olhando para o gatinho (ex.: vai receber carinho)
  let gatoParado = 0, dormindoPorLuz = false, motivo = null;
  const olharGato = new THREE.Vector3();

  function irPara(x, z, opc = {}) {
    if (duck.resting()) duck.play('wake');
    alvo = { x, z, perto: opc.perto ?? 0.18, depois: opc.depois || null, olhar: opc.olhar || null, t: 0 };
  }
  function pontoLivre() {
    for (let i = 0; i < 30; i++) {
      const x = sorte(limites.x0 + 0.6, limites.x1 - 0.6), z = sorte(limites.z0 + 0.6, limites.z1 - 0.6);
      if (livre(x, z)) return { x, z };
    }
    return null;
  }
  // um lugar perto do gatinho, de frente para ele (lado: 1 direita, -1 esquerda, 0 na frente)
  function pertoDoGato(dist = 1.0, lado = 0) {
    const g = gato(), a = g.yaw + lado * 1.1;
    let p = { x: g.x + Math.sin(a) * dist, z: g.z + Math.cos(a) * dist };
    if (!livre(p.x, p.z)) { const d = eu(), dx = d.x - g.x, dz = d.z - g.z, l = Math.hypot(dx, dz) || 1; p = { x: g.x + dx / l * dist, z: g.z + dz / l * dist }; }
    empurrar(p, 0.22); return p;
  }

  // ---------- coisas que o pato faz ----------
  const fazer = {
    quack: () => duck.play('quack'),
    feliz: () => duck.play('happy'),
    susto: () => duck.play('startle'),
    sim: () => duck.play('nod'),
    nao: () => duck.play('shake'),
    dancar: () => { alvo = null; duck.play('dance'); },
    bicar: () => duck.play('peck'),
    sentar: () => { alvo = null; duck.play('sit'); },
    dormir: () => { alvo = null; duck.play('sleep'); },
    acordar: () => duck.play('wake'),
  };

  /** o gatinho chamou: vem até a frente dele e grasna */
  function chamar() {
    segurar = 0; motivo = 'chamado';
    const p = pertoDoGato(1.0, 0);
    irPara(p.x, p.z, { olhar: 'gato', depois: () => { duck.play('quack'); motivo = null; } });
  }
  /** fica parado olhando para o gatinho por alguns segundos (ele está vindo fazer carinho) */
  function esperar(seg = 4) { alvo = null; segurar = seg; if (duck.resting()) duck.play('wake'); }
  function receberCarinho() { segurar = 3.2; setTimeout(() => duck.play('happy'), 450); }
  function brincar() { segurar = 0; alvo = null; if (duck.resting()) duck.play('wake'); setTimeout(() => duck.play('dance'), 250); }
  /** joga migalhas no chão em (x, z): o pato vai até lá e bica */
  function comida(x, z) {
    mig.length = 0;
    for (let i = 0; i < NM; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.22; mig.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y: 0.9 + Math.random() * 0.2, vy: 0, r: Math.random() * 6 }); }
    desenharMigalhas();
    motivo = 'comer'; segurar = 0;
    setTimeout(() => { const d = eu(), dx = x - d.x, dz = z - d.z, l = Math.hypot(dx, dz) || 1; irPara(x - dx / l * 0.32, z - dz / l * 0.32, { perto: 0.12, olhar: { x, z }, depois: comer }); }, 500);
  }
  let bicadas = 0;
  function comer() {
    bicadas = 3;
    const um = () => {
      if (!bicadas) return; bicadas--;
      duck.play('peck');
      setTimeout(() => { mig.splice(0, Math.ceil(NM / 3)); desenharMigalhas(); if (bicadas) um(); else { motivo = null; mig.length = 0; desenharMigalhas(); setTimeout(() => duck.play('happy'), 300); } }, 1250);
    };
    um();
  }

  /** o gatinho fez um gesto ou mudou de humor */
  function reagir(o) {
    const g = gato(), d = eu(), dist = Math.hypot(g.x - d.x, g.z - d.z);
    if (duck.action?.name === 'sleep' && !['tchau', 'acenar', 'susto', 'palmas'].includes(o)) return;
    if (['dancar', 'balancar', 'marchar'].includes(o) && dist < 4.5) { segurar = 5; brincar(); }
    else if (['comemorar', 'pular', 'pulinhos', 'palmas', 'girar'].includes(o)) { if (duck.resting()) duck.play('wake'); setTimeout(() => duck.play(dist < 2.5 ? 'happy' : 'quack'), 200); }
    else if (['susto', 'espirro', 'sacudir'].includes(o)) setTimeout(() => duck.play('startle'), 120);
    else if (['tchau', 'acenar'].includes(o)) chamar();
    else if (['reverencia', 'timida'].includes(o) && dist < 4) setTimeout(() => duck.play('nod'), 400);
    else if (o === 'pensar' && dist < 4) setTimeout(() => duck.play('shake'), 600);
    else if (o === 'dormindo' && dist < 5) { const p = pertoDoGato(0.9, 1); irPara(p.x, p.z, { olhar: 'gato', depois: () => duck.play('sleep') }); motivo = 'junto'; }
    else if (o === 'sono' && dist < 5) { const p = pertoDoGato(0.9, 1); irPara(p.x, p.z, { olhar: 'gato', depois: () => duck.play('sit') }); motivo = 'junto'; }
    else if (o === 'sentou' && dist < 4) { const p = pertoDoGato(0.95, -1); irPara(p.x, p.z, { olhar: 'gato', depois: () => duck.play('sit') }); motivo = 'junto'; }
    else if (o === 'levantou' && motivo === 'junto') { motivo = null; duck.play('wake'); pausa = sorte(0.5, 1.5); }
  }

  // ---------- a cada quadro ----------
  function atualizar(dt) {
    const g = gato(), d = eu(), dxg = g.x - d.x, dzg = g.z - d.z, distG = Math.hypot(dxg, dzg);
    gatoParado = g.andando ? 0 : gatoParado + dt;

    // luz apagada: dorme onde estiver; acende: acorda
    const luz = luzAcesa();
    if (!luz && !dormindoPorLuz && !alvo && duck.action?.name !== 'dance') { dormindoPorLuz = true; setTimeout(() => { if (!luzAcesa()) duck.play('sleep'); }, 1200); }
    if (luz && dormindoPorLuz) { dormindoPorLuz = false; if (duck.action?.name === 'sleep' && motivo !== 'junto') { duck.play('wake'); setTimeout(() => duck.play('quack'), 900); } }

    let frente = 0, giro = 0;
    if (segurar > 0) {                           // parado, virado para o gatinho
      segurar -= dt; giro = Math.max(-1, Math.min(1, ang(d.yaw, Math.atan2(dxg, dzg)) * 2.5)); if (Math.abs(giro) < 0.12) giro = 0;
    } else if (alvo) {
      alvo.t += dt;
      const dx = alvo.x - d.x, dz = alvo.z - d.z, dist = Math.hypot(dx, dz);
      if (dist > alvo.perto && alvo.t < 14) {
        const err = ang(d.yaw, Math.atan2(dx, dz));
        giro = Math.max(-1, Math.min(1, err * 2.2));
        frente = Math.min(1, dist / 0.5) * Math.max(0, Math.cos(err)) ** 3;
      } else {
        // chegou: vira para onde deve olhar
        const o = alvo.olhar === 'gato' ? g : alvo.olhar;
        const err = o ? ang(d.yaw, Math.atan2(o.x - d.x, o.z - d.z)) : 0;
        if (Math.abs(err) > 0.15 && alvo.t < 16) giro = Math.max(-1, Math.min(1, err * 2.2));
        else { const f = alvo.depois; alvo = null; pausa = sorte(4, 9); f && f(); }
      }
    } else if (!duck.busy()) {
      // segue o gatinho quando ele se afasta
      if (g.andando && distG > 2.8 && !g.sentado) { motivo = null; const p = pertoDoGato(1.2, 0); irPara(p.x, p.z, { perto: 0.5, olhar: 'gato' }); }
      else if ((pausa -= dt) <= 0) {
        pausa = sorte(5, 11);
        const r = Math.random();
        if (gatoParado > 70 && distG < 5) { const p = pertoDoGato(0.95, Math.random() < 0.5 ? 1 : -1); irPara(p.x, p.z, { olhar: 'gato', depois: () => duck.play(gatoParado > 140 ? 'sleep' : 'sit') }); }
        else if (duck.resting()) { if (motivo !== 'junto' && luz && r < 0.35) duck.play('wake'); }
        else if (r < 0.5) { const p = pontoLivre(); if (p) irPara(p.x, p.z, { depois: () => { if (Math.random() < 0.3) duck.play('peck'); } }); }
        else if (r < 0.65) duck.play('peck');
        else if (r < 0.78) duck.play('quack');
        else if (r < 0.88 && distG > 1.4) { const p = pertoDoGato(1.1, Math.random() * 2 - 1); irPara(p.x, p.z, { olhar: 'gato', depois: () => duck.play('nod') }); }
      }
    }
    duck.move(frente, giro);

    // olha para o gatinho quando ele está perto
    if (distG < 3.5 && duck.action?.name !== 'sleep' && (!alvo || segurar > 0 || alvo.olhar === 'gato')) duck.lookAt(olharGato.set(g.x, g.sentado ? 0.55 : 1.05, g.z));
    else if (alvo && alvo.olhar && alvo.olhar !== 'gato' && Math.hypot(alvo.olhar.x - d.x, alvo.olhar.z - d.z) < 1.2) duck.lookAt(olharGato.set(alvo.olhar.x, 0, alvo.olhar.z));
    else duck.lookAt(null);

    duck.update(dt);

    // não entra nos móveis, nem nas paredes, nem no gatinho
    const p = eu();
    empurrar(p, 0.2);
    const gx = p.x - g.x, gz = p.z - g.z, gd = Math.hypot(gx, gz);
    if (gd < 0.55 && gd > 1e-4) { p.x = g.x + gx / gd * 0.55; p.z = g.z + gz / gd * 0.55; }
    duck.root.position.x = p.x / S; duck.root.position.z = p.z / S;

    // migalhas caindo
    let caindo = false;
    for (const m of mig) if (m.y > 0.012) { m.vy -= 9.8 * dt; m.y = Math.max(0.012, m.y + m.vy * dt); caindo = true; }
    if (caindo) desenharMigalhas();
  }

  return {
    grupo, duck, atualizar, reagir, chamar, esperar, receberCarinho, brincar, comida, sombra, fazer,
    pos: eu,
    dormindo: () => duck.action?.name === 'sleep',
    mexendo: () => duck.walking || (!!duck.action && !duck.resting()) || mig.some((m) => m.y > 0.012),
  };
}
