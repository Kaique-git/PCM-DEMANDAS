/* ============================================================
   app.js — Lógica do app | PCM Manutenção
   Funciona em MODO FIREBASE (tempo real) ou MODO LOCAL (fallback)
   ============================================================ */

/* ================= 1. UTILITÁRIOS ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = t => (t ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const hojeISO = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
const fmtData = d => { if (!d) return '—'; const [a, m, dia] = d.slice(0, 10).split('-'); return `${dia}/${m}/${a}`; };
const escGlobal = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };

function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function abrirModal(titulo, corpoHTML, acoesHTML = '') {
  $('#modalTitulo').textContent = titulo;
  $('#modalCorpo').innerHTML = corpoHTML;
  $('#modalAcoes').innerHTML = acoesHTML;
  $('#modal').classList.add('aberto');
}
function fecharModal() { $('#modal').classList.remove('aberto'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });

function confirmarModal(titulo, msg, aoConfirmar, rotulo = 'Confirmar') {
  window._cbConfirmar = aoConfirmar;
  abrirModal(titulo, `<p style="font-size:.9rem">${msg}</p>`,
    `<button onclick="fecharModal()">Cancelar</button>
     <button class="primario" onclick="fecharModal();window._cbConfirmar()">${rotulo}</button>`);
}

/* ================= 2. ESTADO E PADRÕES ================= */
const CORES = { vermelho:'#ef4444', laranja:'#f97316', amarelo:'#eab308', verde:'#22c55e', azul:'#3b82f6', cinza:'#94a3b8' };
const OPCOES_PADRAO = {
  status: [
    { nome:'Aberta', cor:'azul' }, { nome:'Em Execução', cor:'laranja' },
    { nome:'Aguardando Peça', cor:'amarelo' }, { nome:'Concluída', cor:'verde' },
    { nome:'Cancelada', cor:'cinza' }
  ],
  prioridade: [
    { nome:'Urgente', cor:'vermelho' }, { nome:'Alta', cor:'laranja' },
    { nome:'Média', cor:'amarelo' }, { nome:'Baixa', cor:'verde' }
  ]
};
const CHAVES = { demandas:'pcm_demandas', responsaveis:'pcm_responsaveis', setores:'pcm_setores', opcoes:'pcm_opcoes' };
const PRIOR_ORDEM = { 'Urgente':0, 'Alta':1, 'Média':2, 'Baixa':3 };

let demandas = [], responsaveis = [], setores = [];
let opcoes = JSON.parse(JSON.stringify(OPCOES_PADRAO));
let modoFirebase = false;
let editandoId = null, histId = null, anexosPendentes = [];
let consultaModo = 'resp', consultaAberto = {};
let filaSync = [];

const achar = id => demandas.find(d => d.id === id);
const isConcluida = d => d.status === 'Concluída';
const isCancelada = d => d.status === 'Cancelada';
const isPendente = d => !isConcluida(d) && !isCancelada(d);
const estaAtrasada = d => isPendente(d) && d.prazo && d.prazo < hojeISO();

/* ================= 3. CAMADA DE DADOS ================= */
function salvarLocal(col) {
  const dado = col === 'opcoes' ? opcoes
    : col === 'demandas' ? demandas
    : col === 'responsaveis' ? responsaveis : setores;
  try { localStorage.setItem(CHAVES[col], JSON.stringify(dado)); } catch (e) {
    toast('Armazenamento local cheio — remova anexos antigos', 'erro');
  }
}
function lerLocal(col) {
  try { return JSON.parse(localStorage.getItem(CHAVES[col])); } catch (e) { return null; }
}

const semId = o => { const c = { ...o }; delete c.id; return c; };

async function salvarColecao(col, lista) {
  salvarLocal(col);
  if (!modoFirebase) return;
  try {
    const ref = window.db.collection(col);
    if (col === 'opcoes') { await ref.doc('config').set(opcoes); return; }
    const snap = await ref.get();
    const ids = new Set(lista.map(x => x.id));
    const batch = window.db.batch();
    snap.docs.forEach(d => { if (!ids.has(d.id)) batch.delete(d.ref); });
    lista.forEach(x => batch.set(ref.doc(x.id), semId(x)));
    await batch.commit();
  } catch (e) {
    console.error(e);
    if (!filaSync.includes(col)) filaSync.push(col);
    toast('Falha ao sincronizar com o Firebase — dados salvos localmente', 'aviso');
  }
}

// Fila de sincronização: tenta reenviar coleções pendentes
setInterval(() => {
  if (modoFirebase && filaSync.length) {
    const cols = [...new Set(filaSync)]; filaSync = [];
    cols.forEach(c => salvarColecao(c, c === 'demandas' ? demandas : c === 'responsaveis' ? responsaveis : c === 'setores' ? setores : opcoes));
  }
}, 15000);

function setIndicador(estado) {
  const el = $('#indConexao');
  if (estado === 'ok') el.textContent = '🟢 Firebase conectado • Sincronização em tempo real';
  else if (estado === 'local') el.textContent = '🟡 Modo local (localStorage)';
  else el.textContent = '🔴 Reconectando...';
}

function initDados() {
  demandas = lerLocal('demandas') || [];
  responsaveis = lerLocal('responsaveis') || [];
  setores = lerLocal('setores') || [];
  const op = lerLocal('opcoes');
  if (op && op.status && op.status.length) opcoes = op;

  if (window.firebaseAtivo) {
    setIndicador('erro'); // "Reconectando..." até o primeiro snapshot chegar
    ['demandas', 'responsaveis', 'setores', 'opcoes'].forEach(col => {
      window.db.collection(col).onSnapshot(snap => {
        if (col === 'opcoes') {
          const o = snap.docs.map(d => d.data())[0];
          if (o && o.status && o.status.length) opcoes = o;
        } else {
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (col === 'demandas') demandas = lista;
          else if (col === 'responsaveis') responsaveis = lista;
          else setores = lista;
        }
        salvarLocal(col);
        modoFirebase = true;
        setIndicador('ok');
        renderTudo();
      }, err => {
        console.error(err);
        modoFirebase = false;
        setIndicador('erro');
      });
    });
    modoFirebase = true;
  } else {
    setIndicador('local');
  }
  renderTudo();
}

/* ================= 4. TEMA ================= */
function aplicarTema(t) {
  document.body.classList.toggle('claro', t === 'claro');
  $('#btnTema').textContent = t === 'claro' ? '🌙' : '☀️';
  localStorage.setItem('pcm_tema', t);
}
function alternarTema() {
  aplicarTema(document.body.classList.contains('claro') ? 'escuro' : 'claro');
}
aplicarTema(localStorage.getItem('pcm_tema') || 'escuro');

/* ================= 5. NAVEGAÇÃO ================= */
function trocarAba(nome) {
  $$('.aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === nome));
  $$('.tab').forEach(t => t.classList.toggle('ativa', t.id === 'tab-' + nome));
  if (nome === 'graficos') renderGraficos();
  if (nome === 'consulta') renderConsulta();
}

/* ================= 6. HELPERS DE OPÇÕES ================= */
const corOpt = (nome, tipo) => {
  const o = (opcoes[tipo] || []).find(x => x.nome === nome);
  return CORES[o ? o.cor : 'cinza'];
};
const badge = (tipo, nome) => {
  const c = corOpt(nome, tipo);
  return `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}66">${esc(nome)}</span>`;
};
function selectOpcoes(tipo, atual, onchange, classe = '') {
  const opts = (opcoes[tipo] || []).map(o =>
    `<option ${o.nome === atual ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');
  return `<select class="${classe}" onchange="${onchange}">${opts}</select>`;
}
function selectOpcoesHTML(tipo, idSel, vazio) {
  const opts = (vazio ? '<option value="">Todos</option>' : '') +
    (opcoes[tipo] || []).map(o => `<option>${esc(o.nome)}</option>`).join('');
  return opts;
}

/* ================= 7. ABA DEMANDAS ================= */
const filtros = { busca:'', status:'', prior:'', resp:'', setor:'', prazo:'', anexos:'', ordenar:'prazo', de:'', ate:'' };

function bindFiltros() {
  const mapa = { fBusca:'busca', fStatus:'status', fPrior:'prior', fResp:'resp', fSetor:'setor', fPrazo:'prazo', fAnexos:'anexos', fOrdenar:'ordenar', fDe:'de', fAte:'ate' };
  Object.entries(mapa).forEach(([id, chave]) => {
    const el = $('#' + id);
    el.addEventListener('input', () => { filtros[chave] = el.value; renderDemandas(); });
    el.addEventListener('change', () => { filtros[chave] = el.value; renderDemandas(); });
  });
}

function resetFiltros() {
  Object.assign(filtros, { busca:'', status:'', prior:'', resp:'', setor:'', prazo:'', anexos:'', ordenar:'prazo', de:'', ate:'' });
  Object.entries({ fBusca