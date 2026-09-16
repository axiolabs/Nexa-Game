var Store = (function () {
  var DEFAULT_DIFF = {
    rondasPorPartida: 5,
    segundosPasoBlur: 2.5,
    segundosContrarreloj: 25,
    vidasSupervivencia: 3
  };
  var DEFAULT_CONFIG = {
    maxRanking: 10,
    dificultades: {
      facil: Object.assign({}, DEFAULT_DIFF),
      media: Object.assign({}, DEFAULT_DIFF),
      dificil: Object.assign({}, DEFAULT_DIFF)
    }
  };

  // cache en memoria (fuente de verdad cuando se usa nube)
  var mem = {
    series: null,
    config: null,
    top: null
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
    // UUID v4 que Supabase acepta en columnas uuid
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function isCloud() { return Supabase.isConfigured(); }

  // Normaliza cualquier config (vieja plana o nueva por dificultad) al
  // formato interno: { maxRanking, dificultades: { facil, media, dificil } }.
  function normalizeConfig(c) {
    var base;
    if (c && c.dificultades) {
      base = c;
    } else {
      base = { maxRanking: c && c.maxRanking != null ? c.maxRanking : DEFAULT_CONFIG.maxRanking };
      base.dificultades = {};
      var src = c || {};
      ['facil', 'media', 'dificil'].forEach(function (d) {
        base.dificultades[d] = {
          rondasPorPartida: src.rondasPorPartida != null ? src.rondasPorPartida : DEFAULT_DIFF.rondasPorPartida,
          segundosPasoBlur: src.segundosPasoBlur != null ? src.segundosPasoBlur : DEFAULT_DIFF.segundosPasoBlur,
          segundosContrarreloj: src.segundosContrarreloj != null ? src.segundosContrarreloj : DEFAULT_DIFF.segundosContrarreloj,
          vidasSupervivencia: src.vidasSupervivencia != null ? src.vidasSupervivencia : DEFAULT_DIFF.vidasSupervivencia
        };
      });
    }
    var out = {
      maxRanking: base.maxRanking != null ? base.maxRanking : DEFAULT_CONFIG.maxRanking,
      dificultades: {}
    };
    ['facil', 'media', 'dificil'].forEach(function (d) {
      out.dificultades[d] = Object.assign({}, DEFAULT_DIFF, base.dificultades && base.dificultades[d]);
    });
    return out;
  }

  function normalize(s) {
    s.imagenes = s.imagenes || [];
    s.variantes = s.variantes || [];
    // IDs válidos para Supabase: regenera los de formato antiguo (ej: 'sabc123...')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.id || '')) {
      s.id = uid();
    }
    s.imagenes.forEach(function (im, k) {
      if (typeof im.posicion === 'undefined') im.posicion = k + 1;
      if (typeof im.dificultad === 'undefined') im.dificultad = Math.min(k + 1, 5);
    });
    return s;
  }

  function cloudinaryDefaults() {
    try {
      var raw = localStorage.getItem('gts_cloudinary');
      if (raw) {
        var c = JSON.parse(raw);
        if (c && c.cloudName && c.preset) return c;
      }
    } catch (e) {}
    // cuentas públicas por diseño (unsigned preset = no requiere secret)
    return { cloudName: 'ju6a1xcy', preset: 'gts_unsigned' };
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,

    getConfig: function () {
      // Normaliza la config interna: si llega una vieja config plana
      // (objeto directo con rondasPorPartida...), la reparte en dificultades.
      return normalizeConfig(read('gts_config', null));
    },

    getDiffConfig: function (diff) {
      var c = Store.getConfig();
      return c.dificultades && c.dificultades[diff]
        ? Object.assign({}, DEFAULT_DIFF, c.dificultades[diff])
        : Object.assign({}, DEFAULT_DIFF);
    },

    saveConfig: function (cfg) {
      var merged = Store.getConfig();
      if (cfg.dificultades) merged.dificultades = Object.assign(merged.dificultades, cfg.dificultades);
      if (cfg.maxRanking != null) merged.maxRanking = cfg.maxRanking;
      write('gts_config', merged);
      mem.config = merged;
      if (isCloud()) {
        Supabase.upsertConfig(JSON.parse(JSON.stringify(merged))).then(function () {}).catch(function () {});
      }
    },

    getSeries: function () {
      var list;
      if (isCloud() && mem.series) {
        list = JSON.parse(JSON.stringify(mem.series));
      } else {
        list = read('gts_series', []);
      }
      list.forEach(normalize);
      return list;
    },
    saveSeries: function (arr) {
      arr.forEach(normalize);
      write('gts_series', arr);
      mem.series = JSON.parse(JSON.stringify(arr));
      if (isCloud()) {
        Supabase.saveSeries(JSON.parse(JSON.stringify(arr))).then(function () {}).catch(function (e) { console.error('sync series:', e); });
      }
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
      if (isCloud() && mem.top) return mem.top;
      return read('gts_top', []);
    },
    addTop: function (entry) {
      var max = Store.getConfig().maxRanking || 10;
      var top = Store.getTop();
      top.push(entry);
      top.sort(function (a, b) { return b.puntos - a.puntos; });
      top = top.slice(0, max);
      if (isCloud()) {
        Supabase.insertRanking(entry).then(function () {}).catch(function () {});
      } else {
        write('gts_top', top);
      }
      mem.top = top;
      return top;
    },
    refreshTop: function () {
      if (!isCloud()) return Promise.resolve(Store.getTop());
      return Supabase.fetchTop().then(function (top) {
        mem.top = top || [];
        return mem.top;
      }).catch(function () { return Store.getTop(); });
    },
    clearTop: function () {
      write('gts_top', []);
      write('gts_high', 0);
      mem.top = [];
    },

    // ---------- Sincronización con la nube ----------

    useCloud: function () {
      return Supabase.isConfigured();
    },

    syncFromCloud: function () {
      if (!isCloud()) return Promise.resolve(false);
      var pSeries = Supabase.fetchSeries();
      var pConfig = Supabase.fetchConfig();
      var pTop = Supabase.fetchTop();
      return Promise.all([pSeries, pConfig, pTop]).then(function (res) {
        var series = res[0], cfg = res[1], top = res[2];
        mem.series = series.map(normalize);
        mem.top = top;
        // La nube es la fuente de verdad: se normaliza cualquier formato
        // (nuevo por dificultad o viejo plano) y se guarda en local.
        var merged = normalizeConfig(cfg);
        mem.config = merged;
        write('gts_config', merged);
        write('gts_series', JSON.parse(JSON.stringify(mem.series)));
        return true;
      }).catch(function (e) {
        console.warn('Sync cloud falló:', e);
        return false;
      });
    },

    pullSeries: function () {
      if (!isCloud()) return Promise.resolve([]);
      return Supabase.fetchSeries().then(function (series) {
        mem.series = series.map(normalize);
        write('gts_series', JSON.parse(JSON.stringify(mem.series)));
        return mem.series;
      });
    },

    pushAnnouncements: function (list) {
      if (!isCloud()) return Promise.resolve(false);
      return Supabase.syncAnnouncements(list);
    },

    pullAnnouncements: function () {
      if (!isCloud()) return Promise.resolve([]);
      return Supabase.fetchAnnouncements();
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

    // ---------- Cloudinary ----------

    getCloudinary: function () {
      return cloudinaryDefaults();
    },
    setCloudinary: function (creds) {
      try { localStorage.setItem('gts_cloudinary', JSON.stringify(creds)); } catch (e) {}
    },
    clearCloudinary: function () {
      try { localStorage.removeItem('gts_cloudinary'); } catch (e) {}
    },

    uid: uid
  };
})();