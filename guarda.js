// Guarda tudo do quarto SÓ no aparelho (IndexedDB do navegador). Nada vai para o GitHub nem para servidor.
// - recipientes: as caixas da estante e o baú (nome, cor, espaços)
// - itens: o que está guardado (arquivos, notas, links). No baú, cada item fica trancado (criptografado) com a chave.
// - extras: o desenho do quadro branco, os recados do mural e configurações
// O backup baixa um arquivo para o aparelho. Os itens do baú vão no backup ainda trancados.
const BANCO = 'nosso-quarto';
export const ESPACOS_CAIXA = 27, ESPACOS_BAU = 54;     // como no Minecraft: baú pequeno 9x3, baú grande 9x6

let dbPromessa = null;
function abrir() {
  if (dbPromessa) return dbPromessa;
  dbPromessa = new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const n of ['recipientes', 'itens', 'extras']) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result); r.onerror = () => { dbPromessa = null; erro(r.error); };
  });
  return dbPromessa;
}
const pedido = (rq) => new Promise((ok, erro) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => erro(rq.error); });
async function loja(nome, modo = 'readonly') { const db = await abrir(); return db.transaction(nome, modo).objectStore(nome); }
const pegar = async (l, id) => pedido((await loja(l)).get(id));
const por = async (l, v) => pedido((await loja(l, 'readwrite')).put(v));
const tirar = async (l, id) => pedido((await loja(l, 'readwrite')).delete(id));
const todos = async (l) => pedido((await loja(l)).getAll());

export const novoId = (p) => p + '-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);

// ---------- recipientes ----------
export async function recipiente(id, padrao) {
  let r = await pegar('recipientes', id);
  if (!r) r = { id, nome: '', cor: 0, slots: Array(padrao.espacos).fill(null), ...padrao.extra };
  if (r.slots.length < padrao.espacos) r.slots = r.slots.concat(Array(padrao.espacos - r.slots.length).fill(null));
  return r;
}
export const salvarRecipiente = (r) => por('recipientes', r);
export const todosRecipientes = () => todos('recipientes');

// ---------- itens ----------
export const item = (id) => pegar('itens', id);
export const salvarItem = (it) => por('itens', it);
export const apagarItem = (id) => tirar('itens', id);

// ---------- extras (quadro branco, mural, config) ----------
export const extra = (id) => pegar('extras', id);
export const salvarExtra = (v) => por('extras', v);
export const apagarExtra = (id) => tirar('extras', id);
export const todosExtras = () => todos('extras');
// o mural (copiado do museu) usa este formato de "armazem", com os recados guardados nos extras
export const armazemMural = {
  todas: async () => (await todosExtras()).filter((r) => r.id.startsWith('mural-')),
  guardar: (reg) => salvarExtra(reg),
  apagar: (id, em = Date.now()) => salvarExtra({ id, apagado: true, em }),
};

// ---------- chave do baú (criptografia de verdade: PBKDF2 + AES-GCM) ----------
const enc = new TextEncoder(), dec = new TextDecoder();
async function derivar(senha, sal) {
  const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const TESTE = 'bau-do-quarto-ok';
export async function criarChave(senha) {          // devolve { chave (fica só na memória), info (vai para o recipiente) }
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivar(senha, sal);
  const teste = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(TESTE));
  return { chave, info: { sal, iv, teste } };
}
export async function abrirComChave(senha, info) {  // devolve a chave, ou null se a senha estiver errada
  try {
    const chave = await derivar(senha, new Uint8Array(info.sal));
    const t = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(info.iv) }, chave, info.teste);
    return dec.decode(t) === TESTE ? chave : null;
  } catch { return null; }
}
// item normal <-> item trancado
export async function trancarItem(it, chave) {
  const { blob, ...meta } = it;
  const json = enc.encode(JSON.stringify({ ...meta, temBlob: !!blob })), bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array(0);
  const junto = new Uint8Array(4 + json.length + bytes.length);
  new DataView(junto.buffer).setUint32(0, json.length); junto.set(json, 4); junto.set(bytes, 4 + json.length);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, junto);
  return { id: it.id, cifrado: true, iv, dados, em: Date.now() };
}
export async function destrancarItem(reg, chave) {
  const junto = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(reg.iv) }, chave, reg.dados));
  const n = new DataView(junto.buffer).getUint32(0), meta = JSON.parse(dec.decode(junto.subarray(4, 4 + n)));
  const resto = junto.subarray(4 + n);
  return { ...meta, blob: meta.temBlob ? new Blob([resto], { type: meta.mime || '' }) : undefined };
}

// ---------- pedir para o navegador não apagar os dados sozinho ----------
export async function pedirPersistencia() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; } }
export async function espaco() { try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; } }

// ---------- backup: um arquivo .json com tudo (os do baú vão trancados) ----------
const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function empacotar(v) {          // troca Blob/ArrayBuffer/Uint8Array por texto
  if (v instanceof Blob) return { $blob: b64(await v.arrayBuffer()), tipo: v.type };
  if (v instanceof ArrayBuffer) return { $bytes: b64(v) };
  if (ArrayBuffer.isView(v)) return { $bytes: b64(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) };
  if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await empacotar(x)); return o; }
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await empacotar(x); return o; }
  return v;
}
function desempacotar(v) {
  if (Array.isArray(v)) return v.map(desempacotar);
  if (v && typeof v === 'object') {
    if (typeof v.$blob === 'string') return new Blob([deB64(v.$blob)], { type: v.tipo || '' });
    if (typeof v.$bytes === 'string') return deB64(v.$bytes).buffer;
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = desempacotar(x); return o;
  }
  return v;
}
export async function gerarBackup() {
  const partes = ['{"formato":"nosso-quarto","versao":1,"em":' + Date.now()];
  for (const l of ['recipientes', 'itens', 'extras']) {
    partes.push(',"' + l + '":[');
    const lista = await todos(l);
    for (let i = 0; i < lista.length; i++) partes.push((i ? ',' : '') + JSON.stringify(await empacotar(lista[i])));
    partes.push(']');
  }
  partes.push('}');
  await salvarExtra({ id: 'config-backup', em: Date.now() });
  return new Blob(partes, { type: 'application/json' });
}
export async function restaurarBackup(arquivo) {
  const dados = JSON.parse(await arquivo.text());
  if (!dados || dados.formato !== 'nosso-quarto') throw new Error('formato');
  const db = await abrir();
  await new Promise((ok, erro) => {
    const tx = db.transaction(['recipientes', 'itens', 'extras'], 'readwrite');
    for (const l of ['recipientes', 'itens', 'extras']) { const s = tx.objectStore(l); s.clear(); for (const r of dados[l] || []) s.put(desempacotar(r)); }
    tx.oncomplete = ok; tx.onerror = () => erro(tx.error);
  });
}
