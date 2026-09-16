var G = (function () {
  var screens = {};
  var state = {
    mode: null,
    diff: null,
    ronda: 0,
    rondas: 5,
    score: 0,
    aciertos: 0,
    fallos: 0,
    queue: [],
    current: null,
    revealedImgs: 0,
    maxRevealImgs: 5,
    imgIndex: null,
    blurStep: 0,
    timers: [],
    settled: false,
    lives: 3,
    streak: 0,
    hintShown: false,
    answer: null
  };

  var DIFF_RANGES = {
    facil: [4, 5],
    media: [2, 5],
    dificil: [1, 5]
  };

  var MODE_NAMES = {
    clasico: 'Clásico',
    galeria: 'Galería',
    contrarreloj: 'Contrarreloj',
    supervivencia: 'Supervivencia'
  };

  var MODE_STEP_POINTS = { clasico: [100, 80, 60, 40, 20, 10], galeria: [100, 80, 60, 40, 20] };

  var BLUR_STEPS = [24, 16, 10, 6, 3, 0]; // px de blur por paso

  /* ---------------- Utilidades ---------------- */

  function $(id) { return document.getElementById(id); }

  function uid() { return Math.random().toString(36).slice(2); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clearTimers() {
    state.timers.forEach(clearInterval);
    state.timers = [];
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.remove('active'); });
    screens[name].classList.add('active');
    window.scrollTo({ top: 0 });
  }

  /* ---------------- Inicialización ---------------- */

  function init() {
    createSeedSeries();
    screens.menu = $('screen-menu');
    screens.modos = $('screen-modos');
    screens.dificultad = $('screen-dificultad');
    screens.game = $('screen-game');
    screens.round = $('screen-round');
    screens.end = $('screen-end');
    screens.ranking = $('screen-ranking');

    $('hs-display').textContent = Store.getHighScore();
    $('menu-name').value = Store.getPlayerName();

    document.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () { handleAction(el.getAttribute('data-action')); });
    });
    document.querySelectorAll('.mode-card').forEach(function (el) {
      el.addEventListener('click', function () { startMode(el.getAttribute('data-mode')); });
    });
    document.querySelectorAll('.diff-card').forEach(function (el) {
      el.addEventListener('click', function () { startGame(el.getAttribute('data-diff')); });
    });

    $('menu-name').addEventListener('input', function () {
      Store.setPlayerName($('menu-name').value.trim());
    });

    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-round-next').addEventListener('click', nextRound);
    $('btn-focus').addEventListener('click', focusMore);
    $('btn-answer').addEventListener('click', answer);
    $('answer-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') answer();
    });

    $('lightbox-close').addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-bg').addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('lightbox').classList.contains('hidden')) closeLightbox();
    });

    var snap = Store.getSnapshot();
    if (snap && snap.queue && snap.queue.length) {
      $('btn-resume').classList.remove('hidden');
    }

    renderRanking();
    loadAnnouncements();
    showScreen('menu');

    // Si hay nube configurada, sincroniza rankings, series y config
    if (Store.useCloud()) {
      Store.syncFromCloud().then(function () {
        renderRanking();
        loadAnnouncements();
      }).catch(function () {});
    }
  }

  function loadAnnouncements() {
    if (Store.useCloud()) {
      Store.pullAnnouncements().then(function (list) {
        renderAnnouncements(list || []);
      }).catch(function () { loadLocalAnnouncements(); });
    } else {
      loadLocalAnnouncements();
    }
  }

  function loadLocalAnnouncements() {
    fetch('data/announcements.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        renderAnnouncements(data ? (data.announcements || []) : []);
      })
      .catch(function () {});
  }

  function renderAnnouncements(list) {
    var box = $('announcements-box');
    if (!list || list.length === 0) return;
    var read = '';
    try { read = localStorage.getItem('gts_ann_read') || ''; } catch (e) {}
    box.innerHTML = '';
    var nuevas = 0;
    list.forEach(function (ann) {
      var key = 'ann_' + (ann.titulo || '') + '_' + (ann.fecha || '');
      if (read.indexOf(key) !== -1) return;
      var card = document.createElement('div');
      card.className = 'ann-card';
      var cTitle = document.createElement('div');
      cTitle.className = 'ann-title';
      cTitle.textContent = '📢 ' + (ann.titulo || 'Anuncio');
      var cMsg = document.createElement('div');
      cMsg.className = 'ann-msg';
      cMsg.textContent = ann.mensaje || '';
      var cDate = document.createElement('div');
      cDate.className = 'ann-date';
      cDate.textContent = ann.fecha || '';
      var close = document.createElement('button');
      close.className = 'ann-close';
      close.textContent = '✕';
      close.addEventListener('click', function () {
        card.remove();
        try {
          localStorage.setItem('gts_ann_read', (localStorage.getItem('gts_ann_read') || '') + key + ',');
        } catch (e) {}
        if (!box.querySelector('.ann-card')) box.classList.add('hidden');
      });
      card.appendChild(close);
      card.appendChild(cTitle);
      card.appendChild(cMsg);
      card.appendChild(cDate);
      box.appendChild(card);
      nuevas++;
    });
    if (nuevas > 0) box.classList.remove('hidden');
  }

  function handleAction(action) {
    if (action === 'admin') { window.location.href = 'admin.html'; }
    else if (action === 'menu') {
      showScreen('menu');
      $('hs-display').textContent = Store.getHighScore();
      var snap = Store.getSnapshot();
      $('btn-resume').classList.toggle('hidden', !snap || !snap.queue || !snap.queue.length);
    }
    else if (action === 'modos') {
      if (!Store.getPlayerName()) {
        alert('Escribe tu nombre en el menú antes de jugar.');
        $('menu-name').focus();
        return;
      }
      showScreen('modos');
    }
    else if (action === 'ranking') { renderRanking(); showScreen('ranking'); }
  }

  /* ---------------- Preparar partida ---------------- */

  function startMode(mode) {
    state.mode = mode;
    showScreen('dificultad');
  }

  function buildQueue() {
    var range = DIFF_RANGES[state.diff];
    var series = Store.getSeries().filter(function (s) {
      return s.imagenes && s.imagenes.some(function (im) {
        return im.dificultad >= range[0] && im.dificultad <= range[1];
      });
    });
    var pool;
    if (state.mode === 'galeria') {
      pool = series.filter(function (s) {
        var fotos = s.imagenes.filter(function (im) {
          return im.dificultad >= range[0] && im.dificultad <= range[1];
        });
        return fotos.length >= 2;
      });
    } else {
      pool = series.slice();
    }
    if (pool.length < 1) return [];
    return shuffle(pool).slice(0, state.rondas);
  }

  function startGame(diff) {
    state.diff = diff;
    var cfg = Store.getConfig();
    state.rondas = cfg.rondasPorPartida || 5;
    state.score = 0;
    state.aciertos = 0;
    state.fallos = 0;
    state.ronda = 0;
    state.lives = cfg.vidasSupervivencia || 3;
    state.streak = 0;

    state.queue = buildQueue();
    if (state.queue.length === 0) {
      alert('No hay series suficientes con esa dificultad. Agrega más series en el Panel Admin o elige otra dificultad.');
      showScreen('modos');
      return;
    }
    state.rondas = state.queue.length;

    $('hud-puntos').textContent = '0';
    $('hud-lives').textContent = state.lives;
    $('hud-streak').textContent = 'x0';
    $('hud-lives-wrap').style.display = state.mode === 'supervivencia' ? '' : 'none';
    $('hud-streak-wrap').style.display = state.mode === 'supervivencia' ? '' : 'none';
    $('timer-wrap').style.display = state.mode === 'contrarreloj' ? '' : 'none';
    $('step-tags').style.display = state.mode === 'galeria' ? 'none' : '';
    $('gallery-grid').style.display = state.mode === 'galeria' ? '' : 'none';
    $('img-single-wrap').style.display = (state.mode === 'galeria') ? 'none' : '';
    $('blur-note').textContent = '';

    showScreen('game');
    loadRound();
  }

  /* ---------------- Ronda ---------------- */

  function loadRound() {
    clearTimers();
    state.settled = false;
    state.hintShown = false;
    state.blurStep = 0;
    state.streak = (state.mode === 'supervivencia' && state.streak !== null) ? state.streak : 0;

    var s = state.queue[state.ronda];
    state.current = s;
    state.answer = s.nombre;
    state.answerVariants = (s.variantes || []);

    // elegir lista de imágenes válidas para la ronda
    var range = DIFF_RANGES[state.diff];
    var fotos = s.imagenes.filter(function (im) {
      return im.dificultad >= range[0] && im.dificultad <= range[1];
    });

    if (state.mode === 'galeria') {
      // ordenar por dificultad ascendente: las más difíciles de adivinar salen primero
      fotos.sort(function (a, b) { return a.dificultad - b.dificultad; });
      var take = Math.min(fotos.length, 5);
      fotos = fotos.slice(0, take);
      state.maxRevealImgs = fotos.length;
      state.revealedImgs = 1;
      state.imgIndex = null;
      renderGallery(fotos);
      updateGalleryReveal();
    } else {
      if (fotos.length === 0) fotos = s.imagenes;
      state.imgIndex = Math.floor(Math.random() * fotos.length);
      state.revealedImgs = 1;
      renderSingle(fotos[state.imgIndex].data);
    }

    renderAnswerInput();
    renderHUD();
    startReveal();
    saveSnapshot();
  }

  function saveSnapshot() {
    Store.setSnapshot({
      mode: state.mode,
      diff: state.diff,
      ronda: state.ronda,
      rondas: state.rondas,
      score: state.score,
      aciertos: state.aciertos,
      fallos: state.fallos,
      lives: state.lives,
      streak: state.streak,
      queue: state.queue
    });
    $('btn-resume').classList.remove('hidden');
  }

  function resumeGame() {
    var snap = Store.getSnapshot();
    if (!snap || !snap.queue || !snap.queue.length) return;
    state.mode = snap.mode;
    state.diff = snap.diff;
    state.ronda = snap.ronda;
    state.rondas = snap.rondas;
    state.score = snap.score;
    state.aciertos = snap.aciertos;
    state.fallos = snap.fallos;
    state.lives = snap.lives;
    state.streak = snap.streak;
    state.queue = snap.queue;

    $('hud-lives-wrap').style.display = state.mode === 'supervivencia' ? '' : 'none';
    $('hud-streak-wrap').style.display = state.mode === 'supervivencia' ? '' : 'none';
    $('timer-wrap').style.display = state.mode === 'contrarreloj' ? '' : 'none';
    $('step-tags').style.display = state.mode === 'galeria' ? 'none' : '';
    $('gallery-grid').style.display = state.mode === 'galeria' ? '' : 'none';
    $('img-single-wrap').style.display = (state.mode === 'galeria') ? 'none' : '';

    showScreen('game');
    loadRound();
  }

  /* ---------------- Render imagen ---------------- */

  function renderSingle(data) {
    var el = $('img-single');
    el.style.backgroundImage = 'url("' + data + '")';
    el.classList.remove('hidden');
    applyBlur();
  }

  function applyBlur() {
    var el = $('img-single');
    var px = BLUR_STEPS[Math.min(state.blurStep, BLUR_STEPS.length - 1)];
    el.style.filter = 'blur(' + px + 'px)';
    // notas
    var note = '';
    if (px > 16) note = '🌫️ Muy borrosa…';
    else if (px > 6) note = '👀 Ya se ven siluetas…';
    else if (px > 0) note = '🔍 Casi la tienes…';
    else note = '✨ Imagen revelada';
    $('blur-note').textContent = note;
    $('btn-focus').disabled = state.blurStep >= BLUR_STEPS.length - 1;
    // pasos
    var totalSteps = BLUR_STEPS.length;
    var tags = $('step-tags');
    tags.innerHTML = '';
    for (var i = 0; i < totalSteps; i++) {
      var d = document.createElement('div');
      d.className = 'step' + (i < state.blurStep ? ' done' : '') + (i === state.blurStep ? ' current' : '');
      tags.appendChild(d);
    }
  }

  function renderGallery(fotos) {
    var grid = $('gallery-grid');
    grid.innerHTML = '';
    for (var i = 0; i < state.maxRevealImgs; i++) {
      var cell = document.createElement('div');
      cell.className = 'gallery-cell';
      cell.dataset.i = i;
      var img = fotos[i];
      if (img) {
        cell.style.backgroundImage = 'url("' + img.data + '")';
        cell.addEventListener('click', function () { openLightbox(this); });
        cell.style.cursor = 'zoom-in';
      } else {
        cell.classList.add('empty');
        cell.innerHTML = '<div class="pos-tag">?</div>';
      }
      grid.appendChild(cell);
    }
  }

  /* ---------------- Lightbox (ver imagen grande) ---------------- */

  function openLightbox(cell) {
    if (!cell.classList.contains('revealed')) return;
    $('lightbox-img').style.backgroundImage = cell.style.backgroundImage;
    $('lightbox').classList.remove('hidden');
  }

  function closeLightbox() {
    $('lightbox').classList.add('hidden');
    $('lightbox-img').style.backgroundImage = '';
  }

  function updateGalleryReveal() {
    var cells = document.querySelectorAll('.gallery-cell');
    var ftags = $('step-tags-gal');
    ftags.innerHTML = '';
    for (var i = 0; i < state.maxRevealImgs; i++) {
      cells[i].classList.toggle('revealed', i < state.revealedImgs);
      var d = document.createElement('div');
      d.className = 'step' + (i < state.revealedImgs ? ' done' : '') + (i === state.revealedImgs ? ' current' : '');
      ftags.appendChild(d);
    }
  }

  /* ---------------- Respuesta por texto ---------------- */

  function renderAnswerInput() {
    var input = $('answer-input');
    input.value = '';
    input.classList.remove('right', 'wrong');
    input.disabled = false;
    $('answer-input-row').classList.remove('hidden');
    $('msg-box').classList.add('hidden');
    $('answer-row').classList.add('hidden');
    $('btn-answer').disabled = false;
    // sugerencias de autocompletado con nombres y variantes de todas las series
    var dl = $('series-suggest');
    dl.innerHTML = '';
    var seen = {};
    Store.getSeries().forEach(function (s) {
      var names = [s.nombre].concat(s.variantes || []);
      names.forEach(function (n) {
        var key = normalize(n);
        if (seen[key]) return;
        seen[key] = true;
        var opt = document.createElement('option');
        opt.value = n;
        dl.appendChild(opt);
      });
    });
    if (state.mode !== 'galeria') input.focus();
  }

  /* ---------------- Revelación progresiva ---------------- */

  function startReveal() {
    if (state.mode === 'galeria') {
      updateGalleryReveal();
      // revelar la siguiente imagen cada intervalo, hasta la última
      var idx = 0;
      var t = setInterval(function () {
        idx++;
        state.revealedImgs = idx;
        updateGalleryReveal();
        if (idx >= state.maxRevealImgs) { clearInterval(t); }
      }, stepInterval());
      state.timers.push(t);
      if (state.mode === 'contrarreloj') startContraTimer();
    } else {
      // enfoque manual: el jugador presiona "Enfocar" para enfocar paso a paso
      applyBlur();
      if (state.mode === 'contrarreloj') startContraTimer();
    }
  }

  function focusMore() {
    if (state.settled) return;
    if (state.blurStep >= BLUR_STEPS.length - 1) return;
    state.blurStep++;
    applyBlur();
  }

  function stepInterval() {
    var cfg = Store.getConfig();
    var base = (cfg.segundosPasoBlur || 2.5) * 1000;
    var mult = state.diff === 'facil' ? 0.8 : state.diff === 'dificil' ? 1.3 : 1;
    return base * mult;
  }

  /* ---------------- Contrarreloj ---------------- */

  var contraId = null;
  var contraRemain = 0;
  function startContraTimer() {
    var cfg = Store.getConfig();
    var total = (cfg.segundosContrarreloj || 25);
    contraRemain = total;
    var fill = $('timer-fill');
    var seg = $('timer-seg');
    fill.style.width = '100%';
    seg.textContent = total + 's';
    var tick = function () {
      contraRemain -= 0.1;
      if (contraRemain <= 0) {
        contraRemain = 0;
        clearInterval(contraId); contraId = null;
        if (!state.settled) { state.settled = true; autoFail(); }
      }
      fill.style.width = (contraRemain / total * 100) + '%';
      seg.textContent = Math.ceil(contraRemain) + 's';
    };
    clearContraTimer();
    contraId = setInterval(tick, 100);
  }
  function clearContraTimer() {
    if (contraId) { clearInterval(contraId); contraId = null; }
  }

  /* ---------------- Respuestas ---------------- */

  function normalize(s) {
    return ('' + s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function answer() {
    if (state.settled) return;
    var input = $('answer-input');
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    state.settled = true;
    clearTimers();
    clearContraTimer();

    var correct = normalize(name) === normalize(state.answer) ||
      state.answerVariants.some(function (v) { return normalize(v) === normalize(name); });

    input.disabled = true;
    $('btn-answer').disabled = true;
    input.classList.add(correct ? 'right' : 'wrong');

    if (correct) {
      state.aciertos++;
      state.streak++;
      var points = computePoints();
      var mult = state.mode === 'supervivencia' ? state.streak : 1;
      points.total = points.base * mult;
      points.detail = mult > 1 ? (points.label + ' · racha x' + mult) : points.label;
      state.score += points.total;
      $('hud-puntos').textContent = state.score;
      $('hud-streak').textContent = 'x' + state.streak;
      showRoundResult(true, points, null);
    } else {
      state.fallos++;
      state.streak = 0;
      if (state.mode === 'supervivencia') {
        state.lives--;
        $('hud-lives').textContent = state.lives;
        if (state.lives <= 0) {
          endGame();
          return;
        }
      }
      showRoundResult(false, null, state.answer);
    }
  }

  function computePoints() {
    if (state.mode === 'clasico') {
      var idx = Math.min(state.blurStep, MODE_STEP_POINTS.clasico.length - 1);
      return { base: MODE_STEP_POINTS.clasico[idx], label: 'Imagen en paso ' + (state.blurStep + 1) };
    }
    if (state.mode === 'galeria') {
      var gIdx = Math.min(Math.max(state.revealedImgs - 1, 0), MODE_STEP_POINTS.galeria.length - 1);
      return { base: MODE_STEP_POINTS.galeria[gIdx], label: 'Adivinada con ' + state.revealedImgs + ' de ' + state.maxRevealImgs + ' imágenes' };
    }
    if (state.mode === 'contrarreloj') {
      var cfg = Store.getConfig();
      var total = cfg.segundosContrarreloj || 25;
      var remain = contraRemain;
      var frac = Math.max(remain, 0) / total;
      var base = Math.round(100 * frac) + 50;
      return { base: base, label: 'Bonus por tiempo restante (' + Math.ceil(remain) + 's)' };
    }
    return { base: 100, label: 'Acierto' };
  }

  function applyStreakBonus() {
    if (state.mode !== 'supervivencia') return;
    $('hud-streak').textContent = 'x' + state.streak;
  }

  function autoFail() {
    showRoundResult(false, null, state.answer);
  }

  /* ---------------- Resultado de ronda ---------------- */

  function showRoundResult(correct, points, answerName) {
    $('round-face').textContent = correct ? '🎉' : '😵';
    $('round-title').textContent = correct ? '¡Correcto!' : 'Era ' + answerName;
    $('round-series').textContent = state.current.nombre;
    $('round-total').textContent = state.score;
    if (correct) {
      $('round-points').textContent = '+' + points.total + ' pts';
      $('round-detail').textContent = points.detail;
    } else {
      $('round-points').textContent = '+0 pts';
      $('round-detail').textContent = 'La respuesta correcta era: ' + answerName;
    }
    $('btn-round-next').textContent = (state.ronda + 1 >= state.rondas) ? 'Ver resultado final →' : 'Siguiente →';
    showScreen('round');
  }

  function nextRound() {
    if (state.ronda + 1 >= state.rondas) {
      endGame();
    } else {
      state.ronda++;
      loadRound();
    }
  }

  function revealAnswer() {
    showRoundResult(false, null, state.answer);
  }

  /* ---------------- Fin ----------- ---------------- */

  function endGame() {
    clearTimers();
    clearContraTimer();
    Store.clearSnapshot();
    $('btn-resume').classList.add('hidden');
    $('end-score').textContent = state.score;

    // stats
    var ideal = state.aciertos * 100;
    var pct = ideal > 0 ? Math.min(100, Math.round((state.score / ideal) * 100)) : 0;
    $('end-stats').textContent =
      'Aciertos: ' + state.aciertos + ' · Fallos: ' + state.fallos + ' · Precisión: ' + Math.max(pct, 0) + '%';

    // registro
    var record = Store.getHighScore();
    var isRecord = state.score > record;
    if (isRecord) Store.setHighScore(state.score);
    $('end-record').textContent = isRecord ? '🎉 ¡NUEVO RÉCORD!' : 'Récord actual: ' + record + ' pts';
    $('hs-display').textContent = Math.max(record, state.score);

    // guardar en ranking automáticamente con el nombre del jugador
    var name = Store.getPlayerName();
    if (name) enterRanking(name);
    showScreen('end');
  }

  function enterRanking(name) {
    Store.addTop({
      nombre: name,
      modo: MODE_NAMES[state.mode],
      puntos: state.score,
      fecha: new Date().toLocaleDateString('es-ES')
    });
  }

  /* ---------------- Ranking ---------------- */

  function renderRanking() {
    var render = function (top) {
      var tbody = $('rank-body');
      tbody.innerHTML = '';
      $('rank-record').textContent = Store.getHighScore();
      $('rank-empty').style.display = top.length ? 'none' : 'block';
      var medals = ['🥇', '🥈', '🥉'];
      top.forEach(function (e, i) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.className = 'medal';
        td1.textContent = i < 3 ? medals[i] : (i + 1);
        var td2 = document.createElement('td');
        td2.textContent = e.nombre;
        var td3 = document.createElement('td');
        td3.textContent = e.modo;
        var td4 = document.createElement('td');
        td4.className = 'puntos';
        td4.textContent = e.puntos;
        var td5 = document.createElement('td');
        td5.textContent = e.fecha;
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);
        tbody.appendChild(tr);
      });
    };
    if (Store.useCloud()) {
      Store.refreshTop().then(function (top) { render(top); }).catch(function () { render(Store.getTop()); });
    } else {
      render(Store.getTop());
    }
  }

  /* ---------------- HUD ---------------- */

  function renderHUD() {
    $('hud-ronda').textContent = (state.ronda + 1) + '/' + state.rondas;
    $('hud-puntos').textContent = state.score;
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', G.init);