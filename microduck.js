// microduck.js — clone articulado e animado do Microduck (Pollen Robotics)
// Modelo 3D derivado do MJCF oficial: (c) Pollen Robotics, CC BY-SA-NC 4.0.
// Uso: const duck = await Microduck.load('microduck.glb'); scene.add(duck.root);
//      no loop: duck.update(dt);   controles: duck.move(frente, giro), duck.play('quack')
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Postura "STAND" oficial (microduck_constants.py, HOME_FRAME)
export const HOME = {
  left_hip_yaw: 0, right_hip_yaw: 0,
  left_hip_roll: -0.0873, right_hip_roll: 0.0873,
  left_hip_pitch: -0.4579, right_hip_pitch: 0.4579,
  left_knee: -0.0049, right_knee: 0.0049,
  left_ankle: 0.4530, right_ankle: -0.4530,
  neck_pitch: 0.3491, head_pitch: 0.3491, head_yaw: 0, head_roll: 0,
  beak: 0,
};
const LEG = ['hip_roll', 'hip_pitch', 'knee', 'ankle'];
const Z = new THREE.Vector3(0, 0, 1);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const smooth = (x) => x * x * (3 - 2 * x);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Microduck {
  static async load(url, loader = new GLTFLoader()) {
    const gltf = await loader.loadAsync(url);
    return new Microduck(gltf.scene);
  }

  constructor(model) {
    this.root = new THREE.Group();          // posição/rumo no mundo (frente = +Z)
    this.root.name = 'Microduck';
    this.hips = new THREE.Group();          // balanço do corpo
    this.root.add(this.hips);
    this.hips.add(model);

    this.joints = {};
    model.traverse((o) => {
      if (o.isMesh) {
        // o arquivo vem sem normais (mais leve); aqui elas são calculadas com quinas, para as carcaças ficarem lisas
        if (!o.geometry.attributes.normal || o.material.flatShading) {
          o.geometry = toCreasedNormals(o.geometry, 0.62);
          o.material.flatShading = false; o.material.needsUpdate = true;
        }
        o.castShadow = true; o.receiveShadow = true;
      }
      if (o.userData.range) {
        this.joints[o.name] = { node: o, range: o.userData.range, axis: new THREE.Vector3(...(o.userData.axis || [0, 0, 1])), q: 0 };
      }
    });
    for (const k in HOME) this.setJoint(k, HOME[k]);

    this.speed = 0; this.turn = 0;           // comandos (m/s, rad/s)
    this.cmdSpeed = 0; this.cmdTurn = 0;
    this.maxSpeed = 0.14; this.maxTurn = 1.4;
    this.stepTime = 0.3; this.stepHeight = 0.018;
    this.phase = 0; this.walking = false;
    this.action = null; this.actionT = 0;
    this.time = 0;
    this.lookTarget = null;
    this.head = { neck_pitch: HOME.neck_pitch, head_pitch: HOME.head_pitch, head_yaw: 0, head_roll: 0, beak: 0 };

    this._calibrate();
  }

  // ---------- juntas ----------
  setJoint(name, angle) {
    const j = this.joints[name]; if (!j) return;
    j.q = Math.min(j.range[1], Math.max(j.range[0], angle));
    j.node.quaternion.setFromAxisAngle(j.axis, j.q);
  }
  getJoint(name) { return this.joints[name]?.q ?? 0; }

  // ---------- calibração: pés, altura, posição neutra ----------
  _calibrate() {
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    this.legs = {};
    let minY = Infinity;
    for (const side of ['left', 'right']) {
      const ankle = this.joints[side + '_ankle'].node;
      box.setFromObject(ankle);
      const p = this._toRoot(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
      const sole = ankle.worldToLocal(this.root.localToWorld(p.clone()));
      // frente do pé (eixo +Z do root) no referencial do tornozelo
      tmpM.copy(ankle.matrixWorld).invert();
      const fwd = Z.clone().transformDirection(this.root.matrixWorld).transformDirection(tmpM);
      const chain = this.joints[side + '_hip_yaw'].node.parent; // corpo que começa a perna
      this.legs[side] = {
        side, ankle, sole, fwd, chain,
        names: LEG.map((n) => side + '_' + n),
        neutral: p.clone(), world: new THREE.Vector3(), start: new THREE.Vector3(),
        yaw: 0, startYaw: 0, lift: 0,
      };
      minY = Math.min(minY, p.y);
      // sentido da junta de guinada do quadril (o MJCF espelha os lados)
      const head = () => { const st = this._footDir(this.legs[side]); return Math.atan2(st.x, st.z); };
      const h0 = head(); this.setJoint(side + '_hip_yaw', 0.1); this.root.updateMatrixWorld(true);
      this.legs[side].yawSign = Math.sign(angleDiff(h0, head())); this.setJoint(side + '_hip_yaw', 0);
      this.root.updateMatrixWorld(true);
    }
    this.baseHeight = -minY;
    this.hips.position.y = this.baseHeight;
    for (const leg of Object.values(this.legs)) leg.neutral.y = 0;
    this.root.updateMatrixWorld(true);
    for (const leg of Object.values(this.legs)) {
      leg.world.copy(this.root.localToWorld(leg.neutral.clone()));
      leg.yaw = this.root.rotation.y;
    }
  }
  _footDir(leg) {
    tmpM.copy(this.root.matrixWorld).invert();
    return new THREE.Vector3().copy(leg.fwd).transformDirection(leg.ankle.matrixWorld).transformDirection(tmpM);
  }
  _toRoot(worldP) { return this.root.worldToLocal(worldP); }

  /** Coloca o pato num lugar (mantém pés plantados corretamente). */
  place(x, y, z, heading = 0) {
    this.root.position.set(x, y, z); this.root.rotation.y = heading;
    this.root.updateMatrixWorld(true);
    for (const leg of Object.values(this.legs)) {
      leg.world.copy(this.root.localToWorld(leg.neutral.clone())); leg.yaw = heading;
    }
  }

  // ---------- comandos ----------
  /** frente: -1..1, giro: -1..1 (positivo = esquerda) */
  move(forward, turn) { this.cmdSpeed = forward * this.maxSpeed; this.cmdTurn = turn * this.maxTurn; }
  stop() { this.move(0, 0); }
  lookAt(worldPoint) { this.lookTarget = worldPoint ? worldPoint.clone() : null; }
  /** 'quack' | 'peck' | 'dance' | 'happy' | 'startle' | 'nod' | 'shake' | 'sit' | 'sleep' | 'wake' */
  play(name) {
    if (name === 'wake') { if (this.resting()) this.action.ending = true; return; }
    if (this.action && this.action.name === name && (name === 'sleep' || name === 'sit') && !this.action.ending) return this;
    this.action = { name, t: 0, ending: false }; return this;
  }

  /** sentado ou dormindo (não anda até acordar) */
  resting() { return !!this.action && (this.action.name === 'sleep' || this.action.name === 'sit'); }
  /** está fazendo algo que não deve ser interrompido andando */
  busy() { return !!this.action && !['quack', 'nod', 'shake'].includes(this.action.name); }

  // ---------- IK numérica de uma perna (4 juntas → posição do pé + pé plano) ----------
  _footState(leg, out) {
    leg.chain.updateMatrixWorld(true);
    const p = this._toRoot(tmpV.copy(leg.sole).applyMatrix4(leg.ankle.matrixWorld));
    tmpM.copy(this.root.matrixWorld).invert();
    const f = tmpV2.copy(leg.fwd).transformDirection(leg.ankle.matrixWorld).transformDirection(tmpM);
    out[0] = p.x; out[1] = p.y; out[2] = p.z;
    out[3] = Math.atan2(f.y, Math.hypot(f.x, f.z)) * 0.05; // inclinação do pé (peso em metros)
    return out;
  }
  _solveLeg(leg, target, iters = 3) {
    const f0 = [0, 0, 0, 0], f1 = [0, 0, 0, 0], J = [[], [], [], []], eps = 1e-3;
    const goal = [target.x, target.y, target.z, 0];
    for (let it = 0; it < iters; it++) {
      this._footState(leg, f0);
      const e = goal.map((g, i) => g - f0[i]);
      if (Math.hypot(...e) < 2e-4) break;
      for (let c = 0; c < 4; c++) {
        const n = leg.names[c], q = this.getJoint(n);
        this.joints[n].node.quaternion.setFromAxisAngle(this.joints[n].axis, q + eps);
        this._footState(leg, f1);
        this.joints[n].node.quaternion.setFromAxisAngle(this.joints[n].axis, q);
        for (let r = 0; r < 4; r++) J[r][c] = (f1[r] - f0[r]) / eps;
      }
      // mínimos quadrados amortecidos: dq = Jᵀ (J Jᵀ + λ²I)⁻¹ e
      const A = [[], [], [], []];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        let s = 0; for (let k = 0; k < 4; k++) s += J[r][k] * J[c][k];
        A[r][c] = s + (r === c ? 1e-6 : 0);
      }
      const y = solve4(A, e);
      for (let c = 0; c < 4; c++) {
        let d = 0; for (let r = 0; r < 4; r++) d += J[r][c] * y[r];
        d = Math.max(-0.3, Math.min(0.3, d));
        this.setJoint(leg.names[c], this.getJoint(leg.names[c]) + d);
      }
    }
  }

  // ---------- loop ----------
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    const sleeping = this.resting();
    const wantS = sleeping ? 0 : this.cmdSpeed, wantT = sleeping ? 0 : this.cmdTurn;
    this.speed = damp(this.speed, wantS, 6, dt);
    this.turn = damp(this.turn, wantT, 6, dt);

    // avança o corpo
    this.root.rotation.y += this.turn * dt;
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    this.root.position.addScaledVector(fwd, this.speed * dt);
    this.root.updateMatrixWorld(true);

    // precisa dar passos?
    const moving = Math.abs(this.speed) > 0.004 || Math.abs(this.turn) > 0.05;
    let offNeutral = false;
    for (const leg of Object.values(this.legs)) {
      const n = this.root.localToWorld(leg.neutral.clone());
      if (n.distanceTo(leg.world) > 0.004 || Math.abs(angleDiff(leg.yaw, this.root.rotation.y)) > 0.05) offNeutral = true;
    }
    if (!this.walking && (moving || offNeutral)) { this.walking = true; this.phase = 0; this._beginSwing(this.legs.left); }

    let swingLeg = null, s = 0;
    if (this.walking) {
      const prev = this.phase;
      this.phase += dt / (2 * this.stepTime);
      if (prev < 0.5 && this.phase >= 0.5) {
        this._land(this.legs.left);
        if (!moving && !offNeutralAfter(this)) { this.walking = false; this.phase = 0; }
        else this._beginSwing(this.legs.right);
      }
      if (this.phase >= 1) {
        this._land(this.legs.right);
        this.phase -= 1;
        if (!moving && !offNeutralAfter(this)) { this.walking = false; this.phase = 0; }
        else this._beginSwing(this.legs.left);
      }
      if (this.walking) {
        swingLeg = this.phase < 0.5 ? this.legs.left : this.legs.right;
        s = (this.phase % 0.5) * 2;
      }
    }

    // pé em balanço: arco até o ponto de pouso
    if (swingLeg) {
      const tgt = this._landingTarget(swingLeg);
      const k = smooth(s);
      swingLeg.world.lerpVectors(swingLeg.start, tgt.p, k);
      swingLeg.world.y += Math.sin(Math.PI * s) * this.stepHeight;
      swingLeg.yaw = swingLeg.startYaw + angleDiff(swingLeg.startYaw, tgt.yaw) * k;
    }

    // corpo: balanço lateral, sobe/desce, ação atual
    const w = this.walking ? 1 : 0;
    this._sway = damp(this._sway || 0, w, 8, dt);
    const sway = this._sway * Math.sin(2 * Math.PI * this.phase) * 0.011;
    const pose = { height: this.baseHeight - this._sway * 0.004 * (1 - Math.cos(4 * Math.PI * this.phase)) / 2, x: -sway, z: 0, roll: 0, pitch: this.speed * 0.4,
      neck_pitch: HOME.neck_pitch, head_pitch: HOME.head_pitch, head_yaw: 0, head_roll: 0, beak: 0 };
    this._idle(pose, dt);
    this._applyAction(pose, dt);

    this.hips.position.set(pose.x, pose.height, pose.z);
    this.hips.rotation.set(pose.pitch, 0, pose.roll);
    this.root.updateMatrixWorld(true);

    // cabeça com "servo" suave
    for (const k of ['neck_pitch', 'head_pitch', 'head_yaw', 'head_roll', 'beak']) {
      this.head[k] = damp(this.head[k], pose[k], k === 'beak' ? 25 : 10, dt);
      this.setJoint(k, this.head[k]);
    }

    // pernas: IK até os pés
    for (const leg of Object.values(this.legs)) {
      this.setJoint(leg.side + '_hip_yaw', angleDiff(this.root.rotation.y, leg.yaw) * leg.yawSign);
      this._solveLeg(leg, this._toRoot(leg.world.clone()));
    }
  }

  _landingTarget(leg) {
    const ahead = this.stepTime; // tempo até o próximo apoio deste pé
    const yaw = this.root.rotation.y + this.turn * ahead * 0.5;
    const local = leg.neutral.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turn * ahead * 0.5);
    local.z += this.speed * ahead * 0.5;
    return { p: this.root.localToWorld(local), yaw };
  }
  _beginSwing(leg) { leg.start.copy(leg.world); leg.startYaw = leg.yaw; }
  _land(leg) { const t = this._landingTarget(leg); leg.world.copy(t.p); leg.world.y = this.root.position.y; leg.yaw = t.yaw; }

  // movimentos sutis de "vida" quando nada mais acontece
  _idle(p, dt) {
    const t = this.time;
    p.height += Math.sin(t * 1.6) * 0.0012;               // respiração
    p.neck_pitch += Math.sin(t * 0.7) * 0.04;
    p.head_pitch += Math.sin(t * 0.9 + 1) * 0.05 - this.speed * 0.6;
    if (this.lookTarget) {
      const l = this._toRoot(this.lookTarget.clone());
      p.head_yaw = Math.max(-1.6, Math.min(1.6, Math.atan2(l.x, l.z)));
      p.head_pitch += Math.max(-0.7, Math.min(0.3, Math.atan2(l.y - 0.22, Math.hypot(l.x, l.z)) * 0.7));
    } else {
      // olha em volta de vez em quando
      p.head_yaw = Math.sin(t * 0.31) * 0.5 * Math.max(0, Math.sin(t * 0.13)) + this.turn * 0.35;
      p.head_roll = Math.sin(t * 0.43) * 0.08;
    }
  }

  _applyAction(p, dt) {
    const a = this.action; if (!a) return;
    a.t += dt; const t = a.t;
    const env = (d, fade = 0.15) => Math.min(1, t / fade, Math.max(0, (d - t) / fade));
    switch (a.name) {
      case 'quack': { // cabeça para cima, bico abre 3x
        const d = 1.1, e = env(d);
        p.head_pitch += 0.35 * e; p.neck_pitch -= 0.15 * e;
        p.beak = Math.max(0, Math.sin(t * Math.PI * 2 / 0.28)) * 0.55 * e;
        if (t > d) this.action = null; break;
      }
      case 'peck': { // abaixa até o chão e belisca (como pegar meia)
        const d = 1.8, e = smooth(env(d, 0.45));
        p.neck_pitch += 0.7 * e; p.head_pitch -= 0.9 * e;
        p.pitch += 0.24 * e; p.height -= 0.022 * e;
        p.beak = (t > 0.4 && t < 1.4) ? Math.max(0, Math.sin((t - 0.4) * Math.PI * 4)) * 0.6 : 0;
        if (t > d) this.action = null; break;
      }
      case 'nod': { const d = 1.0, e = env(d); p.head_pitch += Math.sin(t * 14) * 0.25 * e; if (t > d) this.action = null; break; }
      case 'shake': { const d = 1.0, e = env(d); p.head_yaw = Math.sin(t * 16) * 0.5 * e; if (t > d) this.action = null; break; }
      case 'dance': { // rebola no lugar
        const d = 4.8, e = env(d, 0.4), b = t * Math.PI * 2 * 1.25;
        p.x += Math.sin(b) * 0.012 * e; p.roll += Math.sin(b) * 0.06 * e;
        p.height -= (0.5 + 0.5 * Math.cos(b * 2)) * 0.012 * e;
        p.head_roll = Math.sin(b) * 0.35 * e; p.head_yaw = Math.sin(b * 0.5) * 0.6 * e;
        p.neck_pitch += Math.cos(b * 2) * 0.12 * e;
        p.beak = Math.max(0, Math.sin(b * 2)) * 0.25 * e;
        if (t > d) this.action = null; break;
      }
      case 'happy': { // feliz: rebola, inclina a cabeça e grasna baixinho
        const d = 2.4, e = env(d, 0.25), b = t * Math.PI * 2 * 1.6;
        p.roll += Math.sin(b) * 0.07 * e; p.x += Math.sin(b) * 0.006 * e;
        p.head_roll = Math.sin(b) * 0.4 * e; p.head_pitch += 0.12 * e; p.neck_pitch -= 0.1 * e;
        p.height += Math.abs(Math.sin(b)) * 0.004 * e;
        p.beak = Math.max(0, Math.sin(t * Math.PI * 2 / 0.45)) * 0.45 * e;
        if (t > d) this.action = null; break;
      }
      case 'startle': { // susto: recua a cabeça, bico aberto, treme
        const d = 1.0, e = env(d, 0.06);
        p.neck_pitch -= 0.45 * e; p.head_pitch += 0.4 * e; p.pitch -= 0.08 * e; p.z -= 0.006 * e;
        p.beak = 0.6 * e; p.head_roll = Math.sin(t * 40) * 0.06 * e;
        if (t > d) this.action = null; break;
      }
      case 'sit': { // agacha e fica atento
        if (a.ending) { a.out = (a.out || 0) + dt; if (a.out > 0.5) { this.action = null; break; } }
        const e = smooth(Math.min(1, t / 0.7)) * (a.ending ? 1 - smooth(Math.min(1, a.out / 0.5)) : 1);
        p.height -= 0.026 * e; p.pitch += 0.06 * e; p.neck_pitch -= 0.15 * e;
        break;
      }
      case 'sleep': { // agacha e encolhe a cabeça
        if (a.ending) { a.out = (a.out || 0) + dt; if (a.out > 0.8) { this.action = null; break; } }
        const e = smooth(Math.min(1, t / 1.2)) * (a.ending ? 1 - smooth(Math.min(1, a.out / 0.8)) : 1);
        p.height -= 0.03 * e; p.pitch += 0.1 * e;
        p.neck_pitch -= 0.6 * e; p.head_pitch -= 0.35 * e + Math.sin(this.time * 1.2) * 0.03 * e;
        p.head_yaw *= 1 - e; p.head_roll = p.head_roll * (1 - e) + 0.15 * e;
        break;
      }
      default: this.action = null;
    }
  }
}

function offNeutralAfter(d) {
  for (const leg of Object.values(d.legs)) {
    const n = d.root.localToWorld(leg.neutral.clone());
    if (n.distanceTo(leg.world) > 0.004 || Math.abs(angleDiff(leg.yaw, d.root.rotation.y)) > 0.05) return true;
  }
  return false;
}
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function solve4(A, b) { // eliminação gaussiana 4x4
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const v = M[c][c] || 1e-12;
    for (let r = c + 1; r < 4; r++) { const f = M[r][c] / v; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = [0, 0, 0, 0];
  for (let r = 3; r >= 0; r--) { let s = M[r][4]; for (let k = r + 1; k < 4; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-12); }
  return x;
}
