/**
 * AUDIOBOOK — Leitura sincronizada com áudio
 * Destaque palavra por palavra usando requestAnimationFrame
 * e busca binária para máxima fluidez.
 *
 * Autor: Lucas Bitencourt e Éric Borges
 */

// ==============================
// Referências do DOM
// ==============================
const elLivro        = document.getElementById('livro');
const elConteudo     = document.getElementById('conteudo-texto');
const elErro         = document.getElementById('erro');
const elErroMsg      = document.getElementById('erro-msg');
const audio          = document.getElementById('audio');
const btnPlay        = document.getElementById('btn-play');
const iconePlay      = document.getElementById('icone-play');
const iconePause     = document.getElementById('icone-pause');
const barraProgresso = document.getElementById('barra-progresso');
const elTempoAtual   = document.getElementById('tempo-atual');
const elTempoTotal   = document.getElementById('tempo-total');
const btnVelocidade  = document.getElementById('btn-velocidade');
const btnSync        = document.getElementById('btn-sync');
const btnVoltar      = document.getElementById('btn-voltar');

// ==============================
// Estado global
// ==============================
const VELOCIDADES = [0.75, 1, 1.25, 1.5];
let idxVelocidade = 1;  // começa em 1×

let palavrasDOM = [];        // array de elementos <span> no DOM
let palavrasSync = [];       // array do sync.json (com start/end)
let mapeamento = [];         // índice DOM → índice sync (ou -1)
let mapaReverso = {};        // índice sync → índice DOM
let indiceAtivo = -1;        // índice em palavrasDOM da palavra ativa
let autoScroll = true;       // acompanhamento automático
let scrollManual = false;    // a pessoa rolou manualmente?
let animFrameId = null;      // ID do requestAnimationFrame
let duracaoTotal = 0;

// Chave para localStorage
const CHAVE_POSICAO = 'audiobook-posicao-leitura';

// ==============================
// Utilitários
// ==============================

/** Formata segundos em m:ss */
function formatarTempo(seg) {
  if (!isFinite(seg) || seg < 0) seg = 0;
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Remove acentos, pontuação e coloca em minúsculas */
function normalizar(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // acentos
    .replace(/[^\w\s]/g, '')            // pontuação
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Mostra mensagem de erro na tela */
function mostrarErro(msg) {
  elErroMsg.textContent = msg;
  elErro.hidden = false;
  elLivro.style.display = 'none';
}

// ==============================
// Carregar dados
// ==============================
async function carregarDados() {
  try {
    const [resTexto, resSync] = await Promise.all([
      fetch('texto.txt'),
      fetch('sync.json')
    ]);

    if (!resTexto.ok) throw new Error(`Falha ao carregar texto.txt (${resTexto.status})`);
    if (!resSync.ok)  throw new Error(`Falha ao carregar sync.json (${resSync.status})`);

    const textoRaw = await resTexto.text();
    const syncData = await resSync.json();

    return { textoRaw, syncData };
  } catch (e) {
    mostrarErro(`Erro ao carregar os arquivos: ${e.message}`);
    console.error(e);
    return null;
  }
}

// ==============================
// Montar texto no DOM
// ==============================

/**
 * Verifica se a linha é uma introdução falada que não deve aparecer na tela
 */
function eLinhaIntro(linha) {
  const norm = normalizar(linha);
  return norm.includes('este trabalho foi realizado') || 
         norm.includes('acompanhe o texto transcrito');
}

function montarTexto(textoRaw) {
  elConteudo.innerHTML = '';
  palavrasDOM = [];

  const linhas = textoRaw.split('\n').filter(l => l.trim().length > 0);
  let idPalavra = 0;

  // Ocultar linhas de introdução do texto visível
  const linhasFiltradas = linhas.filter(linha => !eLinhaIntro(linha));

  linhasFiltradas.forEach(linha => {
    const trimmed = linha.trim();
    if (!trimmed) return;

    let el;
    const norm = normalizar(trimmed);

    if (norm.startsWith('produzido por')) {
      el = document.createElement('p');
      el.className = 'creditos';
    } else if (norm === 'milton santos e a globalizacao brasileira') {
      el = document.createElement('h1');
      el.className = 'titulo-principal';
    } else if (trimmed.length < 65 && !trimmed.endsWith('.')) {
      el = document.createElement('h2');
      el.className = 'titulo-secao';
    } else {
      el = document.createElement('p');
      el.className = 'paragrafo';
    }

    // Quebrar a linha em palavras e envolver cada uma em <span>
    const palavras = trimmed.split(/\s+/);
    palavras.forEach((pal, i) => {
      const span = document.createElement('span');
      span.className = 'palavra';
      span.textContent = pal;
      span.dataset.idx = idPalavra;
      palavrasDOM.push(span);
      el.appendChild(span);

      // Espaço entre palavras
      if (i < palavras.length - 1) {
        el.appendChild(document.createTextNode(' '));
      }
      idPalavra++;
    });

    elConteudo.appendChild(el);
  });
}

// ==============================
// Casamento texto ↔ sync.json
// ==============================

/**
 * Casa as palavras do DOM com as do sync.json por ordem sequencial.
 * Pula as palavras da introdução áudio para começar no título "Milton Santos...".
 */
function casarPalavras(syncWords) {
  palavrasSync = syncWords;
  mapeamento = new Array(palavrasDOM.length).fill(-1);

  // Encontrar o ponto inicial de sincronização no syncWords
  // procurando a sequência do título ("Milton", "Santos") no áudio após a introdução
  let jSync = 0;
  if (palavrasDOM.length > 1) {
    const p0 = normalizar(palavrasDOM[0].textContent);
    const p1 = normalizar(palavrasDOM[1].textContent);

    for (let s = 0; s < syncWords.length - 1; s++) {
      if (normalizar(syncWords[s].word) === p0 && normalizar(syncWords[s + 1].word) === p1) {
        // Se encontramos "Milton Santos" no título (após o offset da intro ~30 palavras)
        if (s > 10) {
          jSync = s;
          break;
        }
      }
    }
  }

  let casados = 0;

  for (let i = 0; i < palavrasDOM.length; i++) {
    const textoDOM = normalizar(palavrasDOM[i].textContent);
    if (!textoDOM) continue;

    let encontrado = false;
    const JANELA = 12;

    for (let k = 0; k < JANELA && (jSync + k) < syncWords.length; k++) {
      const textoSync = normalizar(syncWords[jSync + k].word);
      if (textoDOM === textoSync) {
        mapeamento[i] = jSync + k;
        jSync = jSync + k + 1;
        casados++;
        encontrado = true;
        break;
      }
    }

    if (!encontrado) {
      for (let k = JANELA; k < JANELA + 20 && (jSync + k) < syncWords.length; k++) {
        const textoSync = normalizar(syncWords[jSync + k].word);
        if (textoDOM === textoSync) {
          mapeamento[i] = jSync + k;
          jSync = jSync + k + 1;
          casados++;
          break;
        }
      }
    }
  }

  const totalPalavras = palavrasDOM.length;
  const percentual = (casados / totalPalavras * 100).toFixed(1);
  console.log(`Casamento: ${casados}/${totalPalavras} palavras (${percentual}%)`);

  construirMapaReverso();
}

function construirMapaReverso() {
  mapaReverso = {};
  for (let i = 0; i < mapeamento.length; i++) {
    if (mapeamento[i] >= 0) {
      mapaReverso[mapeamento[i]] = i;
    }
  }
}

// ==============================
// Busca binária pelo tempo atual
// ==============================

/**
 * Dado um tempo em segundos, retorna o índice da palavra
 * no DOM que está sendo narrada. Retorna -1 se nenhuma palavra corresponde.
 */
function buscarPalavraPorTempo(tempo) {
  if (!palavrasSync || palavrasSync.length === 0) return -1;

  let lo = 0, hi = palavrasSync.length - 1;
  let idxSync = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (palavrasSync[mid].start <= tempo) {
      idxSync = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (idxSync >= 0 && tempo <= palavrasSync[idxSync].end) {
    const idxDOM = mapaReverso[idxSync];
    return idxDOM !== undefined ? idxDOM : -1;
  }

  return -1;
}

// ==============================
// Destaque e rolagem
// ==============================

function atualizarDestaque(novoIdx) {
  if (novoIdx === indiceAtivo) return;

  // Remover destaque anterior
  if (indiceAtivo >= 0 && indiceAtivo < palavrasDOM.length) {
    palavrasDOM[indiceAtivo].classList.remove('palavra-ativa');
    palavrasDOM[indiceAtivo].classList.add('palavra-lida');
  }

  // Marcar palavras anteriores como lidas (caso tenha pulado)
  if (novoIdx > indiceAtivo) {
    const inicio = Math.max(0, indiceAtivo + 1);
    for (let i = inicio; i < novoIdx && i < palavrasDOM.length; i++) {
      palavrasDOM[i].classList.remove('palavra-ativa');
      palavrasDOM[i].classList.add('palavra-lida');
    }
  }

  // Se voltou no tempo, remover "lida" das palavras futuras
  if (novoIdx < indiceAtivo) {
    for (let i = Math.max(0, novoIdx); i <= indiceAtivo && i < palavrasDOM.length; i++) {
      palavrasDOM[i].classList.remove('palavra-lida', 'palavra-ativa');
    }
  }

  indiceAtivo = novoIdx;

  if (indiceAtivo >= 0 && indiceAtivo < palavrasDOM.length) {
    palavrasDOM[indiceAtivo].classList.remove('palavra-lida');
    palavrasDOM[indiceAtivo].classList.add('palavra-ativa');

    // Rolagem automática
    if (autoScroll && !scrollManual) {
      rolarParaPalavra(palavrasDOM[indiceAtivo]);
    }
  }
}

/** Rolagem ultra fluida que ajusta a tela suavemente por linha, sem trepidação */
let ultimaLinhaTop = -1;
let emRolagem = false;

function rolarParaPalavra(el) {
  if (emRolagem) return;

  const rect = el.getBoundingClientRect();
  const alturaJanela = window.innerHeight;

  // Disparar rolagem apenas se a palavra ativa estiver abaixo de 50% da tela ou acima de 18%
  if (rect.top > alturaJanela * 0.50 || rect.top < alturaJanela * 0.18) {
    // Verificar se mudou de linha (diferença de posição vertical > 15px)
    if (Math.abs(rect.top - ultimaLinhaTop) > 15) {
      ultimaLinhaTop = rect.top;
      emRolagem = true;

      const destino = window.scrollY + (rect.top - alturaJanela * 0.35);

      window.scrollTo({
        top: destino,
        behavior: 'smooth'
      });

      // Aguardar o término do scroll suave para permitir a próxima linha
      setTimeout(() => {
        emRolagem = false;
      }, 450);
    }
  }
}

// ==============================
// Loop de sincronização (requestAnimationFrame)
// ==============================

function loopSync() {
  if (audio.paused) return;

  const tempo = audio.currentTime;

  // Atualizar barra de progresso
  if (duracaoTotal > 0) {
    barraProgresso.value = (tempo / duracaoTotal) * 1000;
    atualizarEstiloBarra();
  }

  // Atualizar tempo exibido
  elTempoAtual.textContent = formatarTempo(tempo);

  // Encontrar palavra ativa
  const novoIdx = buscarPalavraPorTempo(tempo);
  atualizarDestaque(novoIdx);

  // Salvar posição periodicamente
  if (Math.random() < 0.016) {
    salvarPosicao(tempo);
  }

  animFrameId = requestAnimationFrame(loopSync);
}

// ==============================
// Controles do Player
// ==============================

function tocarPausar() {
  if (audio.paused) {
    audio.play().catch(e => console.warn('Autoplay bloqueado:', e));
  } else {
    audio.pause();
  }
}

function atualizarIconePlay() {
  if (audio.paused) {
    iconePlay.classList.remove('oculto');
    iconePause.classList.add('oculto');
  } else {
    iconePlay.classList.add('oculto');
    iconePause.classList.remove('oculto');
  }
}

function alterarVelocidade() {
  idxVelocidade = (idxVelocidade + 1) % VELOCIDADES.length;
  const vel = VELOCIDADES[idxVelocidade];
  audio.playbackRate = vel;
  btnVelocidade.textContent = vel === 1 ? '1×' : `${vel}×`;
}

function alternarSync() {
  autoScroll = !autoScroll;
  scrollManual = false;
  btnSync.classList.toggle('ativo', autoScroll);
  btnVoltar.hidden = true;
}

function voltarParaLeitura() {
  autoScroll = true;
  scrollManual = false;
  btnSync.classList.add('ativo');
  btnVoltar.hidden = true;

  if (indiceAtivo >= 0 && indiceAtivo < palavrasDOM.length) {
    rolarParaPalavra(palavrasDOM[indiceAtivo]);
  }
}

// ==============================
// Detecção de scroll manual
// ==============================
let scrollTimeout = null;
let ignorarScroll = false;

function aoRolar() {
  if (ignorarScroll) return;
  if (!autoScroll) return;

  if (!audio.paused) {
    scrollManual = true;
    btnVoltar.hidden = false;
  }
}

function iniciarScrollAutomatico() {
  ignorarScroll = true;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => { ignorarScroll = false; }, 600);
}

const scrollToOriginal = window.scrollTo.bind(window);
window.scrollTo = function(opts) {
  iniciarScrollAutomatico();
  scrollToOriginal(opts);
};

// ==============================
// Clicar em uma palavra para ir até ela
// ==============================

function aoClicarPalavra(e) {
  const span = e.target.closest('.palavra');
  if (!span) return;

  const idx = parseInt(span.dataset.idx, 10);
  const idxSync = mapeamento[idx];

  if (idxSync >= 0) {
    audio.currentTime = palavrasSync[idxSync].start;

    resetarDestaques(idx);

    if (audio.paused) {
      audio.play().catch(() => {});
    }
  }
}

function resetarDestaques(atualIdx) {
  for (let i = 0; i < palavrasDOM.length; i++) {
    palavrasDOM[i].classList.remove('palavra-ativa', 'palavra-lida');
    if (i < atualIdx) {
      palavrasDOM[i].classList.add('palavra-lida');
    }
  }
  indiceAtivo = -1;
}

// ==============================
// Atalhos de teclado
// ==============================

function aoTeclar(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      tocarPausar();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      recalcularDestaques();
      break;
    case 'ArrowRight':
      e.preventDefault();
      audio.currentTime = Math.min(duracaoTotal, audio.currentTime + 5);
      break;
  }
}

function recalcularDestaques() {
  const tempo = audio.currentTime;

  for (let i = 0; i < palavrasDOM.length; i++) {
    const idxSync = mapeamento[i];
    if (idxSync >= 0 && palavrasSync[idxSync].start > tempo) {
      palavrasDOM[i].classList.remove('palavra-lida', 'palavra-ativa');
    }
  }
  indiceAtivo = -1;
}

// ==============================
// Barra de progresso (seek)
// ==============================

function aoMoverBarra() {
  const pct = barraProgresso.value / 1000;
  const novoTempo = pct * duracaoTotal;
  audio.currentTime = novoTempo;
  elTempoAtual.textContent = formatarTempo(novoTempo);
  recalcularDestaques();
}

// ==============================
// LocalStorage — posição de leitura
// ==============================

function salvarPosicao(tempo) {
  try {
    localStorage.setItem(CHAVE_POSICAO, JSON.stringify({
      tempo,
      timestamp: Date.now()
    }));
  } catch (e) { /* silencioso */ }
}

function restaurarPosicao() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_POSICAO));
    if (dados && typeof dados.tempo === 'number' && dados.tempo > 1) {
      audio.currentTime = dados.tempo;
      console.log(`Posição restaurada: ${formatarTempo(dados.tempo)}`);
    }
  } catch (e) { /* silencioso */ }
}

// ==============================
// Eventos de áudio
// ==============================

function aoIniciarAudio() {
  atualizarIconePlay();
  animFrameId = requestAnimationFrame(loopSync);
}

function aoPausarAudio() {
  atualizarIconePlay();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  salvarPosicao(audio.currentTime);
}

function aoTerminarAudio() {
  atualizarIconePlay();
  indiceAtivo = -1;
  salvarPosicao(0);
}

function aoCarregarMetadados() {
  duracaoTotal = audio.duration;
  elTempoTotal.textContent = formatarTempo(duracaoTotal);
  restaurarPosicao();
}

// ==============================
// Atualizar fundo da barra de progresso
// ==============================
function atualizarEstiloBarra() {
  const pct = (barraProgresso.value / barraProgresso.max) * 100;
  barraProgresso.style.background = `linear-gradient(to right, var(--cor-barra-preenchida) ${pct}%, var(--cor-barra) ${pct}%)`;
}

// ==============================
// Inicialização
// ==============================

async function iniciar() {
  const dados = await carregarDados();
  if (!dados) return;

  const { textoRaw, syncData } = dados;

  // Configurar áudio
  audio.src = syncData.audio || 'Geografia.mp3';
  duracaoTotal = syncData.duration || 0;
  elTempoTotal.textContent = formatarTempo(duracaoTotal);

  // Montar texto no DOM (excluindo linhas de intro no DOM)
  montarTexto(textoRaw);

  // Casar palavras
  casarPalavras(syncData.words);

  // Eventos do áudio
  audio.addEventListener('play', aoIniciarAudio);
  audio.addEventListener('pause', aoPausarAudio);
  audio.addEventListener('ended', aoTerminarAudio);
  audio.addEventListener('loadedmetadata', aoCarregarMetadados);

  // Controles
  btnPlay.addEventListener('click', tocarPausar);
  btnVelocidade.addEventListener('click', alterarVelocidade);
  btnSync.addEventListener('click', alternarSync);
  btnVoltar.addEventListener('click', voltarParaLeitura);

  // Barra de progresso
  barraProgresso.addEventListener('input', aoMoverBarra);
  barraProgresso.addEventListener('input', atualizarEstiloBarra);

  // Clique nas palavras
  elConteudo.addEventListener('click', aoClicarPalavra);

  // Scroll manual
  window.addEventListener('scroll', aoRolar, { passive: true });

  // Teclado
  document.addEventListener('keydown', aoTeclar);

  // Atualizar estilo inicial da barra
  atualizarEstiloBarra();

  console.log('Audiobook inicializado com sucesso.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
