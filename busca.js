// Busca: "onde eu guardei?". Procura pelo nome, pelo texto das notas e pelo endereço dos links
// em todas as caixas, na bandeja de entrada e no baú (o baú só quando estiver destrancado).
import * as guarda from './guarda.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function criarBusca({ inventario, infoDe, aoIr }) {
  const ui = document.createElement('div'); ui.id = 'busca'; ui.className = 'telaCheia'; ui.hidden = true;
  ui.innerHTML = `<div class="topo"><b>Onde eu guardei?</b><button data-a="fechar" class="forte">Fechar</button></div>
    <div class="campo"><input type="search" placeholder="Procure por nome, texto de nota ou link" aria-label="Buscar" autocomplete="off" enterkeyhint="search"></div>
    <p class="resumo aviso pequeno"></p>
    <div class="lista"></div>`;
  document.body.append(ui);
  for (const ev of ['keydown', 'keyup']) ui.addEventListener(ev, (e) => e.stopPropagation());
  const campo = ui.querySelector('input'), lista = ui.querySelector('.lista'), resumo = ui.querySelector('.resumo');
  let indice = [], bauTrancado = false, achados = [];

  async function montarIndice() {
    indice = []; bauTrancado = false;
    const recs = await guarda.todosRecipientes();
    for (const r of recs) {
      for (let slot = 0; slot < r.slots.length; slot++) {
        const id = r.slots[slot]; if (!id) continue;
        let it = await guarda.item(id); if (!it) continue;
        if (it.cifrado) {
          const k = inventario.chave(r.id); if (!k) { bauTrancado = true; continue; }
          try { it = await guarda.destrancarItem(it, k); } catch { continue; }
        }
        indice.push({ it, rec: r, slot, chave: normal(`${it.nome} ${it.texto || ''} ${it.url || ''}`) });
      }
    }
  }
  function trecho(it, termos) {         // pedacinho da nota onde a palavra aparece
    if (!it.texto) return it.url || '';
    const n = normal(it.texto), i = Math.max(0, Math.min(...termos.map((t) => { const k = n.indexOf(t); return k < 0 ? Infinity : k; })));
    if (!Number.isFinite(i)) return it.texto.slice(0, 90);
    const ini = Math.max(0, i - 30); return (ini ? '…' : '') + it.texto.slice(ini, ini + 110).replace(/\s+/g, ' ') + (it.texto.length > ini + 110 ? '…' : '');
  }
  function procurar() {
    const termos = normal(campo.value).split(/\s+/).filter(Boolean);
    achados = termos.length ? indice.filter((x) => termos.every((t) => x.chave.includes(t))) : [...indice].sort((a, b) => (b.it.em || 0) - (a.it.em || 0)).slice(0, 12);
    if (termos.length) achados.sort((a, b) => (normal(a.it.nome).includes(termos[0]) ? 0 : 1) - (normal(b.it.nome).includes(termos[0]) ? 0 : 1));
    achados = achados.slice(0, 60);
    resumo.textContent = (termos.length ? (achados.length ? `${achados.length} encontrado${achados.length > 1 ? 's' : ''}.` : 'Nada encontrado com essas palavras.') : (indice.length ? 'Guardados mais recentes:' : 'Ainda não tem nada guardado.'))
      + (bauTrancado ? ' O baú está trancado, então o que está nele não aparece.' : '');
    lista.innerHTML = achados.map((x, i) => {
      const onde = infoDe(x.rec.id, x.rec).nome || 'Caixa';
      return `<div class="resultado"><span class="ico">${inventario.icone(x.it)}</span>
        <span class="txt"><b>${esc(x.it.nome)}</b><small>${esc(onde)}</small>${termos.length && (x.it.texto || x.it.url) ? `<em>${esc(trecho(x.it, termos))}</em>` : ''}</span>
        <span class="bts"><button data-abrir="${i}" class="forte">Abrir</button><button data-ir="${i}">Ir até lá</button></span></div>`;
    }).join('');
  }
  campo.addEventListener('input', procurar);
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'fechar') { ui.hidden = true; return; }
    const x = achados[+(b.dataset.abrir ?? b.dataset.ir)]; if (!x) return;
    if (b.dataset.abrir != null) inventario.abrirItem(x.it, x.rec);
    else { ui.hidden = true; aoIr(x.rec.id, x.slot); }
  });
  async function abrir() {
    ui.hidden = false; campo.value = ''; lista.innerHTML = ''; resumo.textContent = 'Procurando…';
    setTimeout(() => campo.focus(), 60);
    try { await montarIndice(); } catch { /* sem nada */ }
    procurar();
  }
  return { abrir, aberto: () => !ui.hidden };
}
