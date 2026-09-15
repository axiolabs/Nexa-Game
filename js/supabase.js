// Cliente REST de Supabase (sin SDK, usa fetch).
// Dos niveles de acceso:
//  - anon key  : lectura pública + registro de rankings (jugadores)
//  - service key: escrituras del admin (series, config, anuncios, storage)
var Supabase = (function () {

  // ---------- Credenciales ----------
  // Se guardan SOLO en el navegador del admin.
  function getCreds() {
    try {
      var raw = localStorage.getItem('gts_supabase');
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (c && c.url && c.anonKey) return c;
    } catch (e) {}
    return null;
  }

  function setCreds(creds) {
    try { localStorage.setItem('gts_supabase', JSON.stringify(creds)); } catch (e) {}
  }

  function clearCreds() {
    try { localStorage.removeItem('gts_supabase'); } catch (e) {}
  }

  function isConfigured() {
    return !!getCreds();
  }

  // key según modo: anon (público) o service (admin)
  function effectiveKey(mode) {
    var c = getCreds();
    if (mode === 'admin' && c.serviceKey) return c.serviceKey;
    return c.anonKey;
  }

  function request(method, path, body, mode, headersExtra) {
    var c = getCreds();
    if (!c) return Promise.reject(new Error('Supabase no configurado'));
    var api = c.url.replace(/\/$/, '');
    var key = effectiveKey(mode || 'anon');
    var headers = {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    };
    if (headersExtra) Object.assign(headers, headersExtra);
    return fetch(api + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') !== -1) return r.json().catch(function () { return null; });
      return r.text();
    });
  }

  // ===================== LECTURA PÚBLICA (anon) =====================

  function fetchSeries() {
    return request('GET', '/rest/v1/series?select=id,nombre,categoria,imagenes(id,ruta,dificultad,posicion)&order=creado_en.asc')
      .then(function (rows) {
        rows = rows || [];
        return rows.map(function (r) {
          return {
            id: r.id,
            nombre: r.nombre,
            categoria: r.categoria,
            imagenes: (r.imagenes || []).map(function (im) {
              return { data: im.ruta, dificultad: im.dificultad, posicion: im.posicion };
            })
          };
        });
      });
  }

  function fetchConfig() {
    return request('GET', '/rest/v1/config?select=clave,valor')
      .then(function (rows) {
        rows = rows || [];
        var cfg = {};
        rows.forEach(function (r) {
          if (r.clave === 'partida' && r.valor && typeof r.valor === 'object') {
            cfg = Object.assign({}, cfg, r.valor);
          }
        });
        return cfg;
      });
  }

  function fetchTop() {
    return request('GET', '/rest/v1/rankings?select=nombre,modo,puntos,fecha&order=puntos.desc&limit=50')
      .then(function (rows) { return rows || []; });
  }

  function fetchAnnouncements() {
    return request('GET', '/rest/v1/anuncios?select=titulo,mensaje,fecha&order=creado_en.asc')
      .then(function (rows) {
        return (rows || []).map(function (r) {
          return { titulo: r.titulo, mensaje: r.mensaje, fecha: r.fecha };
        });
      });
  }

  function insertRanking(entry) {
    return request('POST', '/rest/v1/rankings', {
      nombre: entry.nombre,
      modo: entry.modo,
      puntos: entry.puntos,
      fecha: entry.fecha
    }, 'anon');
  }

  // ===================== ESCRITURA ADMIN (service key) =====================

  function upsertConfig(cfg) {
    return request('POST', '/rest/v1/config?on_conflict=clave', {
      clave: 'partida',
      valor: cfg
    }, 'admin', { 'Prefer': 'resolution=merge-duplicates' });
  }

  function saveSeries(series) {
    var tasks = (series || []).map(upsertSerie);
    return Promise.all(tasks);
  }

  function upsertSerie(serie) {
    var payload = { id: serie.id, nombre: serie.nombre, categoria: serie.categoria };
    return syncImagesToCloud(serie).then(function (imagenes) {
      return request('POST', '/rest/v1/series?on_conflict=id', payload, 'admin', { 'Prefer': 'resolution=merge-duplicates' })
        .then(function () {
          return request('DELETE', '/rest/v1/imagenes?serie_id=eq.' + encodeURIComponent(serie.id), null, 'admin')
            .then(function () {
              var imgs = (imagenes || []).map(function (im, k) {
                return {
                  serie_id: serie.id,
                  ruta: im.data,
                  dificultad: im.dificultad || Math.min(k + 1, 5),
                  posicion: im.posicion || k + 1
                };
              });
              if (!imgs.length) return;
              return request('POST', '/rest/v1/imagenes', imgs, 'admin');
            });
        });
    });
  }

  function syncAnnouncements(list) {
    return request('DELETE', '/rest/v1/anuncios?id=neq.00000000-0000-0000-0000-000000000000', null, 'admin')
      .then(function () {
        var rows = (list || []).map(function (a) {
          return {
            titulo: a.titulo || '',
            mensaje: a.mensaje || '',
            fecha: a.fecha || new Date().toISOString().slice(0, 10)
          };
        });
        if (!rows.length) return;
        return request('POST', '/rest/v1/anuncios', rows, 'admin');
      });
  }

  // ------------------- Storage (imágenes) -------------------

  function uploadImage(dataUri, name) {
    var c = getCreds();
    if (!c) return Promise.reject(new Error('Supabase no configurado'));
    var api = c.url.replace(/\/$/, '');
    var byteString = atob(dataUri.split(',')[1]);
    var mime = (dataUri.match(/^data:([^;]+);/) || [])[1] || 'image/png';
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    var blob = new Blob([ab], { type: mime });

    var ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    var filename = slug(name) + '_' + Date.now() + '_' + Math.floor(Math.random() * 99999) + '.' + ext;
    var key = effectiveKey('admin');
    var headers = {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': mime
    };
    return fetch(api + '/storage/v1/object/imagenes/' + encodeURIComponent(filename), {
      method: 'POST',
      headers: headers,
      body: blob
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t); });
    }).then(function () {
      return api + '/storage/v1/object/public/imagenes/' + encodeURIComponent(filename);
    });
  }

  // Convierte las imágenes dataURI locales de una serie a URLs de la nube
  function syncImagesToCloud(serie) {
    var tasks = (serie.imagenes || []).map(function (im, k) {
      if ((im.data || '').indexOf('data:') === 0) {
        return uploadImage(im.data, slug(serie.nombre) + '_' + (k + 1));
      }
      return Promise.resolve(im.data);
    });
    return Promise.all(tasks).then(function (urls) {
      return (serie.imagenes || []).map(function (im, k) {
        return { data: urls[k], dificultad: im.dificultad, posicion: im.posicion || k + 1 };
      });
    });
  }

  function slug(s) {
    return (s || 'img').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) || 'img';
  }

  function testConnection(mode) {
    // en modo admin usa la service key si existe para validar escrituras
    return request('GET', '/rest/v1/config?select=clave&limit=1', null, mode || 'anon')
      .then(function () { return true; })
      .catch(function (e) { throw e; });
  }

  return {
    getCreds: getCreds,
    setCreds: setCreds,
    clearCreds: clearCreds,
    isConfigured: isConfigured,
    request: request,
    fetchSeries: fetchSeries,
    fetchConfig: fetchConfig,
    fetchTop: fetchTop,
    fetchAnnouncements: fetchAnnouncements,
    insertRanking: insertRanking,
    upsertConfig: upsertConfig,
    saveSeries: saveSeries,
    syncAnnouncements: syncAnnouncements,
    uploadImage: uploadImage,
    syncImagesToCloud: syncImagesToCloud,
    testConnection: testConnection
  };
})();