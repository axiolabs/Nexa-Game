var Store = (function () {
  var DEFAULT_CONFIG = {
    rondasPorPartida: 5,
    segundosPasoBlur: 2.5,
    segundosContrarreloj: 25,
    vidasSupervivencia: 3,
    maxRanking: 10
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert('No se pudo guardar en el navegador. Es posible que el almacenamiento esté lleno.');
    }
  }

  function uid() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,

    getConfig: function () {
      var c = read('gts_config', null);
      return c ? Object.assign({}, DEFAULT_CONFIG, c) : Object.assign({}, DEFAULT_CONFIG);
    },
    saveConfig: function (patch) {
      var c = Store.getConfig();
      Object.assign(c, patch);
      write('gts_config', c);
    },

    getSeries: function () {
      var list = read('gts_series', []);
      list.forEach(function (s) {
        s.imagenes = s.imagenes || [];
        s.imagenes.forEach(function (im, k) {
          if (typeof im.posicion === 'undefined') im.posicion = k + 1;
          if (typeof im.dificultad === 'undefined') im.dificultad = Math.min(k + 1, 5);
        });
      });
      return list;
    },
    saveSeries: function (arr) {
      write('gts_series', arr);
    },

    getPlayerName: function () {
      return read('gts_player', '');
    },
    setPlayerName: function (name) {
      write('gts_player', name);
    },

    getAdminPassword: function () {
      return read('gts_admin_pw', 'admin123');
    },
    setAdminPassword: function (pw) {
      write('gts_admin_pw', pw);
    },
    isAdminAuthed: function () {
      try { return sessionStorage.getItem('gts_admin_auth') === '1'; } catch (e) { return false; }
    },
    setAdminAuthed: function (v) {
      try { sessionStorage.setItem('gts_admin_auth', v ? '1' : '0'); } catch (e) {}
    },

    getHighScore: function () {
      return read('gts_high', 0);
    },
    setHighScore: function (n) {
      if (n > Store.getHighScore()) write('gts_high', n);
    },

    getTop: function () {
      return read('gts_top', []);
    },
    addTop: function (entry) {
      var max = Store.getConfig().maxRanking || 10;
      var top = Store.getTop();
      top.push(entry);
      top.sort(function (a, b) { return b.puntos - a.puntos; });
      top = top.slice(0, max);
      write('gts_top', top);
      return top;
    },
    clearTop: function () {
      write('gts_top', []);
      write('gts_high', 0);
    },

    getSnapshot: function () {
      try { return JSON.parse(sessionStorage.getItem('gts_snapshot')) || null; } catch (e) { return null; }
    },
    setSnapshot: function (snap) {
      try { sessionStorage.setItem('gts_snapshot', JSON.stringify(snap)); } catch (e) {}
    },
    clearSnapshot: function () {
      try { sessionStorage.removeItem('gts_snapshot'); } catch (e) {}
    },

    uid: uid
  };
})();