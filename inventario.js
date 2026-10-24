// Inventário das caixas e do baú, no jeito dos baús do Minecraft:
// uma grade de espaços; toque num espaço vazio para guardar algo, toque num item para abrir, pegar, renomear ou jogar fora.
// "Pegar" deixa o item na sua mão: você pode fechar, abrir outra caixa (ou o baú) e soltar num espaço.
// O baú tem chave: o que está nele fica criptografado no aparelho e só abre com a chave.
import * as guarda from './guarda.js';
import { criarVisor, ehPdf, ehImagem, tamanhoBonito, linkSeguro } from './visor.js';
import { tipoProjetavel } from './projetor.js';

export const CORES_ETIQUETA = ['#f4efe2', '#ffe08a', '#ffb3b3', '#b8e3c0', '#b3d1ff', '#e2ccfa'];
const LIMITE_AVISO = 60 * 1048576;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ext = (nome) => { const m = /\.([a-z0-9]{1,5})$/i.exec(nome || ''); return m ? m[1].toUpperCase() : 'ARQ'; };

async function miniatura(blob) {      // fotinho de 96 px para o ícone do espaço
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }), s = 96 / Math.max(bmp.width, bmp.height);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.(); return c.toDataURL('image/jpeg', 0.75);
  } catch { return null; }
}

export function criarInventario({ aviso, aoMudarRecipiente, aoAbrir, aoFechar, aoProjetar, aoVerNaTv, aoEscolherDestino, infoDe }) {
  const visor = criarVisor();
  const chaves = new Map();          // chaves dos baús abertos nesta visita (só na memória)
  let rec = null, cfg = null, itens = new Map(), sel = -1, mao = null;

  // ---------- telas ----------
  const ui = document.createElement('div'); ui.id = 'inventario'; ui.hidden = true;
  ui.innerHTML = `<div class="janela" role="dialog" aria-label="Guardados">
      <div class="cabeca"><input class="nome" maxlength="40" placeholder="Dar um nome" aria-label="Nome"><button data-a="trancar" hidden>Trancar</button><button data-a="fechar" class="forte">Fechar</button></div>
      <div class="corEtiqueta">${CORES_ETIQUETA.map((c, i) => `<button data-cor="${i}" style="--c:${c}" aria-label="Cor ${i + 1}"></button>`).join('')}<span class="onde"></span></div>
      <div class="grade"></div>
      <div class="info"><span class="texto"></span><span class="botoes"></span></div>
      <div class="confirma" hidden><span></span><button data-a="nao">Não</button><button data-a="sim" class="perigo">Jogar fora</button></div>
      <div class="chave" hidden></div>
    </div>
    <input type="file" multiple hidden><input type="file" class="captura" multiple hidden>`;
  const modal = document.createElement('div'); modal.id = 'invModal'; modal.hidden = true;
  modal.innerHTML = `<form class="caixa"><b></b><input class="t1"><textarea class="t2"></textarea><div class="linha"><button type="button" data-a="cancelar">Cancelar</button><button type="submit" class="forte">Guardar</button></div></form>`;
  const maoEl = document.createElement('div'); maoEl.id = 'mao'; maoEl.hidden = true;
  maoEl.innerHTML = `<span class="icone"></span><span class="texto"></span><button data-a="soltarMao">Devolver</button>`;
  document.body.append(ui, modal, maoEl);
  for (const el of [ui, modal]) for (const ev of ['keydown', 'keyup']) el.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => ui.querySelector(s), grade = $('.grade'), arq = ui.querySelector('input[type=file]:not(.captura)'), arqCaptura = ui.querySelector('input.captura');

  // ---------- ícones ----------
  function icone(it) {
    if (!it) return '';
    if (it.mini) return `<img src="${it.mini}" alt="">`;
    if (it.tipo === 'nota') return '<i class="ic nota"><b></b><b></b><b></b></i>';
    if (it.tipo === 'link') return '<i class="ic link">LINK</i>';
    if (ehPdf(it)) return '<i class="ic pdf">PDF</i>';
    if (/\.pptx$/i.test(it.nome || '') || /presentationml/.test(it.mime || '')) return '<i class="ic ppt">PPT</i>';
    return `<i class="ic arq">${esc(ext(it.nome))}</i>`;
  }
  // ---------- ler itens do recipiente aberto (destranca os do baú) ----------
  async function lerItem(id, r = rec) {
    const reg = await guarda.item(id); if (!reg) return null;
    if (!reg.cifrado) return reg;
    const k = chaves.get(r.id); if (!k) throw new Error('trancado');
    return guarda.destrancarItem(reg, k);
  }
  async function gravarItem(it, r) {          // grava no formato do recipiente (trancado no baú)
    const k = r.trancavel ? chaves.get(r.id) : null;
    if (r.trancavel && !k) throw new Error('trancado');
    await guarda.salvarItem(k ? await guarda.trancarItem(it, k) : it);
  }

  // ---------- desenhar ----------
  function desenhar() {
    if (!rec) return;
    grade.style.setProperty('--linhas', Math.ceil(rec.slots.length / 9));
    grade.innerHTML = rec.slots.map((id, i) => {
      const it = id ? itens.get(id) : null, levando = mao && mao.de === rec.id && mao.slot === i;
      return `<button class="espaco${i === sel ? ' sel' : ''}${levando ? ' levando' : ''}" data-i="${i}" title="${esc(it ? it.nome : '')}" aria-label="${it ? esc(it.nome) : 'Espaço vazio ' + (i + 1)}">${icone(it)}</button>`;
    }).join('');
    const info = $('.info .texto'), bt = $('.info .botoes'), it = sel >= 0 && rec.slots[sel] ? itens.get(rec.slots[sel]) : null;
    if (mao) {
      info.innerHTML = `Na mão: <b>${esc(mao.nome)}</b>. Toque num espaço para soltar.`;
      bt.innerHTML = '<button data-a="soltarMao">Devolver</button>';
    } else if (it) {
      const det = it.tipo === 'nota' ? 'nota' : it.tipo === 'link' ? 'link' : tamanhoBonito(it.tamanho);
      info.innerHTML = `<b>${esc(it.nome)}</b> <small>${esc(det)}</small>`;
      const proj = aoProjetar && it.blob && tipoProjetavel(it.mime, it.nome) ? '<button data-a="projetar">Projetar</button>' : '';
      const mover = aoEscolherDestino ? '<button data-a="guardarEm">Guardar em…</button>' : '';
      const naTv = aoVerNaTv && it.blob && /^(video|image)\//.test(it.mime || '') ? '<button data-a="verTv">Ver na TV</button>' : '';
      bt.innerHTML = '<button data-a="abrirItem" class="forte">Abrir</button>' + proj + naTv + mover + '<button data-a="pegar">Pegar</button><button data-a="renomear">Renomear</button><button data-a="jogar">Jogar fora</button>';
    } else if (sel >= 0) {
      info.textContent = 'Guardar aqui:';
      bt.innerHTML = '<button data-a="addArquivo" class="forte">Arquivo</button><button data-a="addNota">Nota</button><button data-a="addLink">Link</button>';
    } else {
      const n = rec.slots.filter(Boolean).length;
      info.textContent = n ? `${n} de ${rec.slots.length} espaços usados. Toque num item ou num espaço vazio.` : 'Vazio. Toque num espaço para guardar algo (ou arraste arquivos para cá).';
      bt.innerHTML = '';
    }
    $('.nome').value = cfg.titulo || rec.nome || '';
    ui.querySelectorAll('[data-cor]').forEach((b) => { b.hidden = !!cfg.titulo; }); $('.onde').textContent = cfg.onde || '';
    ui.querySelectorAll('[data-cor]').forEach((b) => b.classList.toggle('on', +b.dataset.cor === (rec.cor || 0)));
    $('.onde').textContent = cfg.onde || '';
    $('[data-a="trancar"]').hidden = !rec.trancavel || !chaves.has(rec.id);
    desenharMao();
  }
  function desenharMao() {
    maoEl.hidden = !mao || !ui.hidden;
    if (mao) { maoEl.querySelector('.icone').innerHTML = icone(mao.it); maoEl.querySelector('.texto').innerHTML = `Na mão: <b>${esc(mao.nome)}</b> · abra uma caixa ou o baú para guardar`; }
  }

  // ---------- abrir / fechar ----------
  async function abrir(id, opcoes = {}) {
    opcoes = { ...(infoDe ? infoDe(id) : {}), ...opcoes };
    cfg = opcoes; sel = opcoes.selecionar ?? -1;
    rec = await guarda.recipiente(id, { espacos: opcoes.espacos, extra: opcoes.trancavel ? { trancavel: true } : {} });
    if (opcoes.trancavel) rec.trancavel = true;
    ui.hidden = false; $('.chave').hidden = true; $('.confirma').hidden = true; grade.hidden = false; $('.info').hidden = false;
    aoAbrir && aoAbrir(rec);
    $('.nome').value = cfg.titulo || rec.nome || ''; $('.nome').readOnly = !!cfg.titulo; $('.nome').placeholder = 'Dar um nome';
    ui.querySelectorAll('[data-cor]').forEach((b) => { b.hidden = !!cfg.titulo; }); $('.onde').textContent = cfg.onde || ''; $('[data-a="trancar"]').hidden = true; desenharMao();
    if (rec.trancavel && !chaves.has(rec.id)) return pedirChave();
    await carregarItens(); desenhar();
  }
  async function carregarItens() {
    itens = new Map();
    await Promise.all(rec.slots.filter(Boolean).map(async (id) => { try { const it = await lerItem(id); if (it) itens.set(id, it); } catch { /* item estragado */ } }));
  }
  function fechar() {
    if (!rec) return;
    const r = rec; ui.hidden = true; modal.hidden = true; rec = null; sel = -1; desenharMao();
    aoFechar && aoFechar(r);
  }
  // ---------- chave do baú ----------
  function pedirChave() {
    grade.hidden = true; $('.info').hidden = true; const box = $('.chave'); box.hidden = false;
    const nova = !rec.chave;
    box.innerHTML = nova
      ? `<form><p><b>Crie a chave do baú.</b> Tudo o que você guardar aqui fica trancado no aparelho e só abre com ela.</p>
         <input type="password" class="s1" placeholder="Chave (mínimo 4 caracteres)" autocomplete="new-password" minlength="4" required>
         <input type="password" class="s2" placeholder="Repita a chave" autocomplete="new-password" required>
         <p class="pequeno">Se você esquecer a chave, ninguém consegue abrir o que está dentro, nem você.</p>
         <p class="erro" hidden></p><button class="forte" type="submit">Criar chave e abrir</button></form>`
      : `<form><p><b>O baú está trancado.</b></p><input type="password" class="s1" placeholder="Chave" autocomplete="current-password" required>
         <p class="erro" hidden></p><button class="forte" type="submit">Abrir</button></form>`;
    const f = box.querySelector('form'), erro = box.querySelector('.erro');
    setTimeout(() => f.querySelector('.s1').focus(), 60);
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); erro.hidden = true; const s1 = f.querySelector('.s1').value, btn = f.querySelector('button'); btn.disabled = true;
      try {
        if (nova) {
          if (s1.length < 4) { erro.textContent = 'A chave precisa ter pelo menos 4 caracteres.'; erro.hidden = false; return; }
          if (s1 !== f.querySelector('.s2').value) { erro.textContent = 'As duas chaves não são iguais.'; erro.hidden = false; return; }
          const { chave, info } = await guarda.criarChave(s1); rec.chave = info; await guarda.salvarRecipiente(rec); chaves.set(rec.id, chave);
        } else {
          const k = await guarda.abrirComChave(s1, rec.chave);
          if (!k) { erro.textContent = 'Chave errada. Tente de novo.'; erro.hidden = false; f.querySelector('.s1').select(); return; }
          chaves.set(rec.id, k);
        }
        box.hidden = true; grade.hidden = false; $('.info').hidden = false;
        aoAbrir && aoAbrir(rec, true);
        await carregarItens(); desenhar();
      } finally { btn.disabled = false; }
    });
  }
  function trancar() {
    if (!rec || !rec.trancavel) return;
    if (mao && mao.de === rec.id) mao = null;
    chaves.delete(rec.id); fechar();
    aviso && aviso('Baú trancado.');
  }
  const estaDestrancado = (id) => chaves.has(id);

  // ---------- guardar coisas novas ----------
  function vazios(aPartir) { const v = []; for (let k = 0; k < rec.slots.length; k++) { const i = (aPartir + k) % rec.slots.length; if (!rec.slots[i]) v.push(i); } return v; }
  async function guardarNovos(lista, aPartir) {
    const livres = vazios(Math.max(0, aPartir)); let n = 0;
    for (const it of lista) {
      const i = livres[n]; if (i == null) { aviso && aviso('Não cabe mais nada aqui. Use outra caixa.'); break; }
      try { await gravarItem(it, rec); } catch { aviso && aviso('Não consegui guardar "' + it.nome + '".'); continue; }
      rec.slots[i] = it.id; itens.set(it.id, it); n++;
    }
    await guarda.salvarRecipiente(rec); guarda.pedirPersistencia();
    sel = -1; desenhar(); aoMudarRecipiente && aoMudarRecipiente(rec);
  }
  async function deArquivos(files, aPartir) { await guardarNovos(await itensDeArquivos(files), aPartir); }
  async function itensDeArquivos(files) {
    const lista = [];
    for (const f of files) {
      if (f.size > LIMITE_AVISO) aviso && aviso(`"${f.name}" é grande (${tamanhoBonito(f.size)}). Pode ocupar bastante espaço no aparelho.`);
      const it = { id: guarda.novoId('item'), tipo: 'arquivo', nome: f.name || 'arquivo', mime: f.type || '', tamanho: f.size, blob: f, em: Date.now() };
      if (/^image\//.test(it.mime)) it.mini = await miniatura(f);
      lista.push(it);
    }
    return lista;
  }
  function pedirTexto({ titulo, campo1, campo2, valor1 = '', valor2 = '', botao = 'Guardar' }) {
    return new Promise((ok) => {
      const f = modal.querySelector('form'), t1 = f.querySelector('.t1'), t2 = f.querySelector('.t2');
      f.querySelector('b').textContent = titulo; f.querySelector('[type=submit]').textContent = botao;
      t1.placeholder = campo1; t1.value = valor1; t2.hidden = !campo2; t2.placeholder = campo2 || ''; t2.value = valor2;
      modal.hidden = false; setTimeout(() => t1.focus(), 60);
      const fim = (v) => { modal.hidden = true; f.onsubmit = null; f.querySelector('[data-a=cancelar]').onclick = null; ok(v); };
      f.onsubmit = (e) => { e.preventDefault(); fim({ a: t1.value.trim(), b: t2.value }); };
      f.querySelector('[data-a=cancelar]').onclick = () => fim(null);
    });
  }

  // ---------- pegar e soltar (o item fica na mão) ----------
  async function soltarEm(i) {
    const alvoId = rec.slots[i];
    if (alvoId === mao.id) { mao = null; desenhar(); return; }      // devolveu para o mesmo lugar
    const origem = mao.de === rec.id ? rec : await guarda.recipiente(mao.de, { espacos: mao.espacos });
    if (origem.slots[mao.slot] !== mao.id) { mao = null; desenhar(); aviso && aviso('Esse item já mudou de lugar.'); return; }
    if (origem.trancavel && !chaves.has(origem.id)) { mao = null; desenhar(); aviso && aviso('O baú foi trancado. O item continua lá.'); return; }
    try {
      const it = await lerItem(mao.id, origem);
      let outro = null;
      if (alvoId) { outro = itens.get(alvoId) || await lerItem(alvoId); }      // troca de lugar
      await gravarItem(it, rec);
      if (outro) await gravarItem(outro, origem);
      if (origem === rec) { rec.slots[mao.slot] = alvoId || null; rec.slots[i] = mao.id; }
      else { origem.slots[mao.slot] = alvoId || null; rec.slots[i] = mao.id; await guarda.salvarRecipiente(origem); aoMudarRecipiente && aoMudarRecipiente(origem); }
      await guarda.salvarRecipiente(rec);
      itens.set(it.id, it); if (outro && origem !== rec) itens.delete(outro.id); else if (outro) itens.set(outro.id, outro);
      mao = null; sel = i; desenhar(); aoMudarRecipiente && aoMudarRecipiente(rec);
    } catch { aviso && aviso('Não consegui mudar o item de lugar.'); }
  }

  // ---------- cliques ----------
  ui.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || !rec) return;
    if (b.dataset.i != null) {
      const i = +b.dataset.i;
      if (mao) return soltarEm(i);
      sel = sel === i ? -1 : i; $('.confirma').hidden = true; desenhar(); return;
    }
    if (b.dataset.cor != null) { rec.cor = +b.dataset.cor; await guarda.salvarRecipiente(rec); desenhar(); aoMudarRecipiente && aoMudarRecipiente(rec); return; }
    const a = b.dataset.a, it = sel >= 0 && rec.slots[sel] ? itens.get(rec.slots[sel]) : null;
    if (a === 'fechar') fechar();
    else if (a === 'trancar') trancar();
    else if (a === 'soltarMao') { mao = null; desenhar(); }
    else if (a === 'addArquivo') { arq.dataset.i = sel; arq.click(); }
    else if (a === 'addNota') {
      const r = await pedirTexto({ titulo: 'Nova nota', campo1: 'Título', campo2: 'Escreva aqui…' }); if (!r) return;
      await guardarNovos([{ id: guarda.novoId('item'), tipo: 'nota', nome: r.a || 'Nota', texto: r.b, em: Date.now() }], sel);
    } else if (a === 'addLink') {
      const r = await pedirTexto({ titulo: 'Guardar link', campo1: 'Endereço (https://…)', campo2: 'Nome (opcional)' }); if (!r || !r.a) return;
      let u = r.a; if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
      if (!linkSeguro(u)) { aviso && aviso('Esse endereço não parece um link de site.'); return; }
      await guardarNovos([{ id: guarda.novoId('item'), tipo: 'link', nome: (r.b || '').trim() || new URL(u).hostname, url: u, em: Date.now() }], sel);
    } else if (!it) return;
    else if (a === 'abrirItem') {
      const r0 = rec;
      visor.abrir(it, { salvarNota: async (texto) => { it.texto = texto; it.em = Date.now(); try { await gravarItem(it, r0); } catch { aviso && aviso('Não consegui salvar a nota.'); } } });
    } else if (a === 'guardarEm') { const origem = { id: rec.id, slot: sel, cfg }; fechar(); aoEscolherDestino(origem.id, (destino) => moverEntre(origem, destino));
    } else if (a === 'verTv') { const copia = { nome: it.nome, mime: it.mime, blob: it.blob }; fechar(); aoVerNaTv(copia);
    } else if (a === 'projetar') { const copia = { nome: it.nome, mime: it.mime, blob: it.blob }; fechar(); aoProjetar(copia);
    } else if (a === 'pegar') { mao = { id: it.id, de: rec.id, slot: sel, espacos: rec.slots.length, nome: it.nome, it: { ...it, blob: undefined } }; sel = -1; desenhar(); }
    else if (a === 'renomear') {
      const r = await pedirTexto({ titulo: 'Renomear', campo1: 'Nome', valor1: it.nome, botao: 'Salvar' }); if (!r || !r.a) return;
      it.nome = r.a.slice(0, 120); try { await gravarItem(it, rec); } catch { /* fica como estava */ } desenhar();
    } else if (a === 'jogar') { const c = $('.confirma'); c.querySelector('span').textContent = `Jogar fora "${it.nome}"? Não dá para desfazer.`; c.hidden = false; }
    else if (a === 'nao') $('.confirma').hidden = true;
    else if (a === 'sim') {
      $('.confirma').hidden = true; rec.slots[sel] = null; itens.delete(it.id);
      await guarda.salvarRecipiente(rec); await guarda.apagarItem(it.id); sel = -1; desenhar(); aoMudarRecipiente && aoMudarRecipiente(rec);
    }
  });
  maoEl.addEventListener('click', (e) => { if (e.target.closest('[data-a=soltarMao]')) { mao = null; desenharMao(); } });
  arq.addEventListener('change', async () => { const files = [...arq.files]; arq.value = ''; if (files.length) await deArquivos(files, +arq.dataset.i || 0); });
  $('.nome').addEventListener('change', async () => { if (!rec || cfg.titulo) return; rec.nome = $('.nome').value.trim().slice(0, 40); await guarda.salvarRecipiente(rec); aoMudarRecipiente && aoMudarRecipiente(rec); });
  // arrastar arquivos do computador direto para a grade
  ui.addEventListener('dragover', (e) => { if (rec && !grade.hidden) { e.preventDefault(); ui.classList.add('soltando'); } });
  ui.addEventListener('dragleave', (e) => { if (e.target === ui) ui.classList.remove('soltando'); });
  ui.addEventListener('drop', async (e) => {
    e.preventDefault(); ui.classList.remove('soltando'); if (!rec || grade.hidden) return;
    const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
    const alvo = e.target.closest('[data-i]'); await deArquivos(files, alvo ? +alvo.dataset.i : 0);
  });
  ui.addEventListener('click', (e) => { if (e.target === ui) fechar(); });

  // ---------- mandar um item direto para outro lugar (sem abrir os dois) ----------
  const especie = (id) => { const i = infoDe ? infoDe(id) : {}; return { espacos: i.espacos || guarda.ESPACOS_CAIXA, extra: i.trancavel ? { trancavel: true } : {} }; };
  async function moverEntre(origem, destinoId) {
    if (!destinoId || destinoId === origem.id) { abrir(origem.id, { ...origem.cfg, selecionar: origem.slot }); return; }
    try {
      const o = await guarda.recipiente(origem.id, especie(origem.id)), d = await guarda.recipiente(destinoId, especie(destinoId));
      const id = o.slots[origem.slot]; if (!id) return;
      if (d.trancavel && !chaves.has(d.id)) { aviso && aviso('O baú está trancado. Abra o baú uma vez com a chave e tente de novo.'); return abrir(origem.id, { ...origem.cfg, selecionar: origem.slot }); }
      const i = d.slots.indexOf(null); if (i < 0) { aviso && aviso('Esse lugar está cheio.'); return abrir(origem.id, { ...origem.cfg, selecionar: origem.slot }); }
      const it = await lerItem(id, o); await gravarItem(it, d);
      o.slots[origem.slot] = null; d.slots[i] = id; await guarda.salvarRecipiente(d); await guarda.salvarRecipiente(o);
      if (aoMudarRecipiente) { aoMudarRecipiente(o); aoMudarRecipiente(d); }
      const nomeD = (infoDe && infoDe(destinoId, d).nome) || 'outra caixa';
      aviso && aviso(`"${it.nome}" foi para ${nomeD}.`);
      abrir(origem.id, origem.cfg);        // volta para onde estava (bom para esvaziar a bandeja de entrada)
    } catch { aviso && aviso('Não consegui mudar o item de lugar.'); }
  }
  async function guardarNovosEm(destinoId, lista) {
    if (rec && rec.id === destinoId && !ui.hidden) { await guardarNovos(lista, 0); return lista.length; }
    const d = await guarda.recipiente(destinoId, especie(destinoId)); let n = 0;
    for (const it of lista) {
      const i = d.slots.indexOf(null); if (i < 0) { aviso && aviso('A bandeja de entrada está cheia. Esvazie um pouco guardando nas caixas.'); break; }
      try { await gravarItem(it, d); d.slots[i] = it.id; n++; } catch { /* não guardou */ }
    }
    await guarda.salvarRecipiente(d); guarda.pedirPersistencia(); aoMudarRecipiente && aoMudarRecipiente(d);
    return n;
  }
  // anotar rápido (vai para a bandeja de entrada, de qualquer lugar do quarto)
  let destinoCaptura = 'entrada';
  async function capturar(tipo, destino = 'entrada') {
    destinoCaptura = destino;
    if (tipo === 'arquivo') { arqCaptura.click(); return; }
    let it = null;
    if (tipo === 'nota') {
      const r = await pedirTexto({ titulo: 'Anotar rápido', campo1: 'Título (opcional)', campo2: 'O que está na cabeça?' }); if (!r || !(r.a || r.b.trim())) return;
      it = { id: guarda.novoId('item'), tipo: 'nota', nome: r.a || r.b.trim().split('\n')[0].slice(0, 40) || 'Nota', texto: r.b, em: Date.now() };
    } else if (tipo === 'link') {
      const r = await pedirTexto({ titulo: 'Guardar link', campo1: 'Endereço (https://…)', campo2: 'Nome (opcional)' }); if (!r || !r.a) return;
      let u = r.a; if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
      if (!linkSeguro(u)) { aviso && aviso('Esse endereço não parece um link de site.'); return; }
      it = { id: guarda.novoId('item'), tipo: 'link', nome: (r.b || '').trim() || new URL(u).hostname, url: u, em: Date.now() };
    }
    if (it && await guardarNovosEm(destino, [it])) aviso && aviso('Guardado na bandeja de entrada.');
  }
  arqCaptura.addEventListener('change', async () => {
    const files = [...arqCaptura.files]; arqCaptura.value = ''; if (!files.length) return;
    const n = await guardarNovosEm(destinoCaptura, await itensDeArquivos(files));
    if (n) aviso && aviso(n === 1 ? 'Guardado na bandeja de entrada.' : `${n} arquivos guardados na bandeja de entrada.`);
  });

  return { abrir, fechar, aberto: () => !ui.hidden || !modal.hidden || visor.aberto(), estaDestrancado, mao: () => mao, visor, icone,
    capturar, chave: (id) => chaves.get(id),
    guardarNota: async (texto) => { const t = texto.trim(); const it = { id: guarda.novoId('item'), tipo: 'nota', nome: t.split('\n')[0].slice(0, 40) || 'Nota', texto: t, em: Date.now() }; const n = await guardarNovosEm('entrada', [it]); if (n) aviso && aviso('Mandado para a bandeja de entrada.'); return n > 0; },
    abrirItem: (it, r) => visor.abrir(it, { salvarNota: async (t) => { it.texto = t; it.em = Date.now(); try { await gravarItem(it, r); } catch { aviso && aviso('Não consegui salvar a nota.'); } } }) };
}

// ---------- mapa da estante (para achar e abrir qualquer caixa, até as lá de cima) ----------
export function criarMapaEstante({ colunas, linhas, aoEscolher }) {
  const ui = document.createElement('div'); ui.id = 'mapaEstante'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `<div class="topo"><b>Estante</b><button data-a="fechar" class="forte">Fechar</button></div>
    <p class="aviso pequeno">Toque numa caixa para abrir. As de cima ficam no alto da estante.</p>
    <div class="extras"></div>
    <div class="rolar"><div class="mapa" style="--colunas:${colunas}"></div></div>`;
  document.body.append(ui);
  const mapa = ui.querySelector('.mapa');
  let escolha = null;
  async function abrir(opcoes = {}) {
    escolha = opcoes.aoEscolher || null;
    ui.querySelector('.topo b').textContent = opcoes.titulo || 'Estante';
    ui.querySelector('.aviso').textContent = opcoes.aoEscolher ? 'Toque na caixa onde quer guardar.' : 'Toque numa caixa para abrir. As de cima ficam no alto da estante.';
    const recs = new Map((await guarda.todosRecipientes()).map((r) => [r.id, r]));
    let h = '';
    for (let j = linhas; j >= 1; j--) for (let i = 1; i <= colunas; i++) {
      const id = `caixa-${j}-${i}`, r = recs.get(id), n = r ? r.slots.filter(Boolean).length : 0;
      h += `<button data-id="${id}" class="${n ? 'cheia' : ''}" style="--c:${CORES_ETIQUETA[(r && r.cor) || 0]}" title="${esc(r && r.nome ? r.nome : 'Caixa ' + j + '-' + i)}">${r && r.nome ? `<span class="rot">${esc(r.nome)}</span>` : ''}${n ? `<small>${n}</small>` : ''}</button>`;
    }
    mapa.innerHTML = h;
    ui.querySelector('.extras').innerHTML = (opcoes.extras || []).map((x) => `<button data-id="${x.id}">${esc(x.nome)}</button>`).join('');
    ui.hidden = false;
  }
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fechar') { ui.hidden = true; if (escolha) { const f = escolha; escolha = null; f(null); } }
    else if (b.dataset.id) { ui.hidden = true; const f = escolha || aoEscolher; escolha = null; f(b.dataset.id); }
  });
  return { abrir, aberto: () => !ui.hidden, fechar: () => { ui.hidden = true; } };
}
