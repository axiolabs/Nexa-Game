var Admin = (function () {

  function $(id) { return document.getElementById(id); }

  function readImages(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function approxStorageUsed() {
    var total = 0;
    var series = Store.getSeries();
    series.forEach(function (s) {
      s.imagenes.forEach(function (im) {
        if ((im.data || '').indexOf('data:') === 0) total += im.data.length * 0.75;
      });
    });
    return total;
  }

  /* ---------------- Auth ---------------- */

  function checkAuth() {
    if (Store.isAdminAuthed()) {
      $('admin-area').style.display = '';
      $('btn-logout').style.display = '';
    } else {
      $('login-area').style.display = '';
    }
  }

  function doLogin() {
    var pw = $('login-pw').value;
    if (pw === Store.getAdminPassword()) {
      Store.setAdminAuthed(true);
      $('login-area').style.display = 'none';
      $('admin-area').style.display = '';
      $('btn-logout').style.display = '';
      $('login-msg').textContent = '';
      initAdmin();
    } else {
      $('login-msg').textContent = '❌ Contraseña incorrecta';
    }
  }

  function doLogout() {
    Store.setAdminAuthed(false);
    $('admin-area').style.display = 'none';
    $('btn-logout').style.display = 'none';
    $('login-area').style.display = '';
    $('login-pw').value = '';
    $('login-msg').textContent = '';
  }

  function changePassword() {
    var npw = $('new-pw').value;
    if (!npw || npw.length < 4) {
      $('pw-msg').textContent = 'La contraseña debe tener al menos 4 caracteres.';
      return;
    }
    Store.setAdminPassword(npw);
    $('new-pw').value = '';
    $('pw-msg').textContent = '✅ Contraseña cambiada';
    $('pw-msg').style.color = 'var(--good)';
  }

  /* ---------------- Config ---------------- */

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function loadConfigForm() {
    var c = Store.getConfig();
    $('cfg-rondas').value = c.rondasPorPartida;
    $('cfg-paso').value = c.segundosPasoBlur;
    $('cfg-contra').value = c.segundosContrarreloj;
    $('cfg-vidas').value = c.vidasSupervivencia;
    $('cfg-maxrank').value = c.maxRanking;
  }

  function saveConfigForm() {
    Store.saveConfig({
      rondasPorPartida: clamp(parseInt($('cfg-rondas').value, 10), 1, 30),
      segundosPasoBlur: clamp(parseFloat($('cfg-paso').value), 0.5, 15),
      segundosContrarreloj: clamp(parseInt($('cfg-contra').value, 10), 5, 120),
      vidasSupervivencia: clamp(parseInt($('cfg-vidas').value, 10), 1, 10),
      maxRanking: clamp(parseInt($('cfg-maxrank').value, 10), 3, 50)
    });
    var msg = $('card-config').querySelector('.flash');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'flash';
      $('card-config').appendChild(msg);
    }
    msg.textContent = '✅ Configuración guardada';
    setTimeout(function () { msg.textContent = ''; }, 2000);
  }

  /* ---------------- Series ---------------- */

  function addSerie() {
    var nombre = $('serie-nombre').value.trim();
    if (!nombre) { $('serie-nombre').focus(); return; }
    var serie = {
      id: Store.uid(),
      nombre: nombre,
      categoria: $('serie-categoria').value,
      imagenes: []
    };
    var series = Store.getSeries();
    series.push(serie);
    Store.saveSeries(series);
    $('serie-nombre').value = '';
    renderSeries();
  }

  function deleteSerie(id) {
    if (!confirm('¿Eliminar esta serie y todas sus imágenes?')) return;
    var series = Store.getSeries().filter(function (s) { return s.id !== id; });
    Store.saveSeries(series);
    renderSeries();
  }

  function uploadImageToCloudinary(file) {
    var c = Store.getCloudinary();
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', c.preset);
    return fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(c.cloudName) + '/image/upload', {
      method: 'POST',
      body: fd
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        if (!r.ok || !data || !data.secure_url) {
          throw new Error(data && data.error && data.error.message ? data.error.message : ('HTTP ' + r.status));
        }
        return data.secure_url;
      });
    });
  }

  async function addImage(serieId, files) {
    var series = Store.getSeries();
    var idx = series.findIndex(function (s) { return s.id === serieId; });
    if (idx === -1) return;
    var ok = 0;
    var cloud = Store.getCloudinary();
    for (var i = 0; i < files.length; i++) {
      var data;
      if (cloud) {
        try {
          data = await uploadImageToCloudinary(files[i]);
          if (!data) continue;
        } catch (e) {
          alert('❌ No se pudo subir "' + files[i].name + '" a Cloudinary: ' + (e.message || e));
          continue;
        }
      } else {
        data = await readImages(files[i]);
        if (data.length > 800 * 1024) {
          alert('La imagen "' + files[i].name + '" es muy pesada (' + Math.round(data.length / 1024) + 'KB). Usa imágenes de menos de 800KB o configura Cloudinary arriba.');
          continue;
        }
      }
      if (series[idx].imagenes.length >= 5) break;
      var d = Math.min(series[idx].imagenes.length + 1, 5);
      series[idx].imagenes.push({ data: data, dificultad: d, posicion: series[idx].imagenes.length + 1 });
      ok++;
    }
    Store.saveSeries(series);
    renderSeries();
    if (ok > 0) alert('✅ ' + ok + ' imagen(es) agregada(s) a "' + series[idx].nombre + '"');
  }

  function removeImage(serieId, imgIdx) {
    if (!confirm('¿Quitar esta imagen?')) return;
    var series = Store.getSeries();
    var idx = series.findIndex(function (s) { return s.id === serieId; });
    if (idx === -1) return;
    series[idx].imagenes.splice(imgIdx, 1);
    series[idx].imagenes.forEach(function (im, k) { im.posicion = k + 1; });
    Store.saveSeries(series);
    renderSeries();
  }

  /* ---------------- Render ---------------- */

  function renderSeries() {
    var series = Store.getSeries();
    var list = $('series-list');
    list.innerHTML = '';

    if (series.length === 0) {
      list.innerHTML = '<p class="hint">No hay series aún. Crea una arriba y agrégale imágenes.</p>';
      updateSpaceWarning();
      return;
    }

    series.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'serie-item';

      var head = document.createElement('div');
      head.className = 'serie-head';
      var headInfo = document.createElement('div');
      var spanName = document.createElement('span');
      spanName.className = 'name';
      spanName.textContent = s.nombre;
      var spanCat = document.createElement('span');
      spanCat.className = 'badge';
      spanCat.textContent = s.categoria;
      headInfo.appendChild(spanName);
      headInfo.appendChild(spanCat);
      head.appendChild(headInfo);

      var actions = document.createElement('div');
      actions.className = 'serie-actions';
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = '🗑 Eliminar';
      delBtn.addEventListener('click', function () { deleteSerie(s.id); });
      actions.appendChild(delBtn);
      head.appendChild(actions);

      var count = s.imagenes.length;
      var notes = document.createElement('div');
      if (count < 3) {
        var min = document.createElement('p');
        min.className = 'hint';
        min.style.color = 'var(--warn)';
        min.innerHTML = '⚠ Esta serie tiene <b>' + count + '</b> imagen(es). Para el modo <b>Galería</b> necesita al menos 3.';
        notes.appendChild(min);
      }
      if (count > 0) {
        var gal = s.imagenes.slice().sort(function (a, b) { return a.dificultad - b.dificultad; })
          .map(function (im) { return '#' + (im.posicion || 0) + '(dif ' + im.dificultad + ')'; }).join(' → ');
        var order = document.createElement('p');
        order.className = 'hint';
        order.textContent = 'Orden de revelado en Galería: ' + gal;
        notes.appendChild(order);
      }

      var grid = document.createElement('div');
      grid.className = 'img-list';
      s.imagenes.forEach(function (im, i) {
        var card = document.createElement('div');
        card.className = 'img-card';

        var thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.style.backgroundImage = 'url(' + im.data + ')';

        var posRow = document.createElement('div');
        posRow.className = 'row';
        var posBadge = document.createElement('span');
        posBadge.className = 'pos-badge';
        posBadge.textContent = 'Imagen ' + (i + 1) + '/5';
        posRow.appendChild(posBadge);

        var diffLabel = document.createElement('div');
        diffLabel.className = 'diff-label';
        diffLabel.innerHTML = '<span>Difícil (1)</span><span>Fácil (5)</span>';

        var diffRow = document.createElement('div');
        diffRow.className = 'row';
        var range = document.createElement('input');
        range.type = 'range';
        range.min = 1;
        range.max = 5;
        range.step = 1;
        range.value = Math.min(im.dificultad, 5);
        range.className = 'dif-range';
        range.addEventListener('input', function () {
          var v = parseInt(range.value, 10);
          range.parentElement.querySelector('.val').textContent = v;
          updateImageDifficulty(s.id, i, v);
        });
        var val = document.createElement('span');
        val.className = 'val';
        val.textContent = range.value;
        diffRow.appendChild(range);
        diffRow.appendChild(val);

        var rmBtn = document.createElement('button');
        rmBtn.className = 'btn btn-danger btn-sm';
        rmBtn.textContent = 'Quitar imagen';
        rmBtn.addEventListener('click', function () { removeImage(s.id, i); });

        card.appendChild(thumb);
        card.appendChild(posRow);
        card.appendChild(diffLabel);
        card.appendChild(diffRow);
        card.appendChild(rmBtn);
        grid.appendChild(card);
      });

      var addRow = document.createElement('div');
      addRow.className = 'add-img-row';
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.disabled = count >= 5;
      input.addEventListener('change', function () {
        if (input.files.length) addImage(s.id, input.files);
      });
      var addLabel = document.createElement('span');
      addLabel.className = 'btn btn-sm';
      addLabel.textContent = '📁 Agregar imágenes (' + count + '/5)';
      addLabel.addEventListener('click', function () { if (!input.disabled) input.click(); });
      addRow.appendChild(addLabel);
      addRow.appendChild(input);

      item.appendChild(head);
      item.appendChild(notes);
      item.appendChild(grid);
      item.appendChild(addRow);
      list.appendChild(item);
    });

    updateSpaceWarning();
  }

  function updateImageDifficulty(serieId, imgIdx, value) {
    var series = Store.getSeries();
    var idx = series.findIndex(function (s) { return s.id === serieId; });
    if (idx === -1 || !series[idx].imagenes[imgIdx]) return;
    series[idx].imagenes[imgIdx].dificultad = value;
    Store.saveSeries(series);
  }

  function updateSpaceWarning() {
    var usedBytes = approxStorageUsed();
    var MAX = 5 * 1024 * 1024;
    var el = $('space-warning');
    var pct = Math.round((usedBytes / MAX) * 100);
    if (pct > 60) {
      el.className = 'space-warn';
      el.textContent = '⚠ Almacenamiento usado: ~' + Math.round(usedBytes / 1024) + 'KB de 5MB (' + pct + '%). Las imágenes se guardan en el navegador; si se llena, borra series o usa imágenes más pequeñas.';
    } else {
      el.innerHTML = 'Uso aproximado: ' + Math.round(usedBytes / 1024) + 'KB de 5MB de almacenamiento local.';
      el.classList.remove('space-warn');
    }
  }

  /* ---------------- Cloudinary ---------------- */

  function cdMsg(text, isErr) {
    var el = $('cd-msg');
    el.textContent = text;
    el.style.color = isErr ? 'var(--bad)' : 'var(--good)';
  }

  function loadCloudinaryStatus() {
    var el = $('cloudinary-status');
    var c = Store.getCloudinary();
    if (c) {
      el.innerHTML = '✅ Configurado: <code>' + c.cloudName + '</code> · preset <code>' + c.preset + '</code>. Las imágenes nuevas se subirán a Cloudinary como URLs públicas.';
      $('cd-cloud').value = c.cloudName;
      $('cd-preset').value = c.preset;
    } else {
      el.textContent = 'No configurado. Las imágenes se guardan en el navegador (base64). Para imágenes sin límite de espacio, configura Cloudinary.';
    }
  }

  function saveCloudinary() {
    var cloud = $('cd-cloud').value.trim();
    var preset = $('cd-preset').value.trim();
    if (!cloud || !preset) { cdMsg('❌ Ingresa el Cloud Name y el Upload Preset.', true); return; }
    Store.setCloudinary({ cloudName: cloud, preset: preset });
    cdMsg('✅ Configuración de Cloudinary guardada.');
    loadCloudinaryStatus();
  }

  function clearCloudinary() {
    Store.clearCloudinary();
    $('cd-cloud').value = '';
    $('cd-preset').value = '';
    cdMsg('🗑 Configuración de Cloudinary eliminada.');
    loadCloudinaryStatus();
  }

  function testCloudinary() {
    if (!Store.getCloudinary()) { cdMsg('❌ Guarda la configuración primero.', true); return; }
    cdMsg('Probando subida...');
    var svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#00ff00"/></svg>'], { type: 'image/svg+xml' });
    var file = new File([svg], 'test.svg', { type: 'image/svg+xml' });
    uploadImageToCloudinary(file)
      .then(function (url) {
        cdMsg('✅ Subida de prueba OK: ' + url);
      })
      .catch(function (e) {
        cdMsg('❌ Falló la subida de prueba: ' + (e.message || e), true);
      });
  }

  /* ---------------- Anuncios ---------------- */

  var announcements = { announcements: [] };

  function fetchAnnouncements() {
    if (Store.useCloud()) {
      return Store.pullAnnouncements()
        .then(function (list) {
          announcements = { announcements: (list || []).slice() };
          renderAnnouncements();
        })
        .catch(function () { fetchLocalAnnouncements(); });
    }
    return fetchLocalAnnouncements();
  }

  function fetchLocalAnnouncements() {
    return fetch('data/announcements.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) {
          announcements = { announcements: (data.announcements || []).slice() };
          renderAnnouncements();
        }
      })
      .catch(function () {
        announcements = { announcements: [] };
        renderAnnouncements();
      });
  }

  function renderAnnouncements() {
    var list = $('ann-list');
    var arr = announcements.announcements || [];
    if (arr.length === 0) {
      list.innerHTML = '<p class="hint">No hay anuncios. Crea el primero arriba.</p>';
      return;
    }
    list.innerHTML = '';
    arr.forEach(function (ann, i) {
      var item = document.createElement('div');
      item.className = 'serie-item';
      var head = document.createElement('div');
      head.className = 'serie-head';
      head.innerHTML = '<div><span class="name"></span> <span class="badge"></span></div>';
      head.querySelector('.name').textContent = ann.titulo || '(sin título)';
      head.querySelector('.badge').textContent = ann.fecha || '';
      var msg = document.createElement('p');
      msg.className = 'hint';
      msg.textContent = ann.mensaje || '';
      var actions = document.createElement('div');
      actions.className = 'serie-actions';
      var del = document.createElement('button');
      del.className = 'btn btn-danger btn-sm';
      del.textContent = '🗑 Quitar';
      del.addEventListener('click', function () {
        announcements.announcements.splice(i, 1);
        pushAnnouncementsAndRender();
      });
      actions.appendChild(del);
      head.appendChild(actions);
      item.appendChild(head);
      item.appendChild(msg);
      list.appendChild(item);
    });
  }

  function pushAnnouncementsAndRender() {
    renderAnnouncements();
    if (Store.useCloud()) {
      Store.pushAnnouncements(announcements.announcements || [])
        .then(function () { sbMsg('📢 Anuncios sincronizados con la nube.'); })
        .catch(function (e) { sbMsg('⚠ No se pudo sincronizar anuncios: ' + (e.message || e), true); });
    }
  }

  function addAnnouncement() {
    var titulo = $('ann-title').value.trim();
    var mensaje = $('ann-msg').value.trim();
    if (!titulo) { $('ann-title').focus(); return; }
    announcements.announcements.push({
      titulo: titulo,
      mensaje: mensaje,
      fecha: $('ann-date').value || new Date().toISOString().slice(0, 10)
    });
    $('ann-title').value = '';
    $('ann-msg').value = '';
    pushAnnouncementsAndRender();
  }

  function exportAnnouncements() {
    var data = JSON.stringify({ announcements: announcements.announcements || [] }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'announcements.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function loadAnnouncementsFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.announcements)) throw new Error('invalid');
        announcements = { announcements: data.announcements };
        renderAnnouncements();
        alert('✅ Anuncios cargados. Puedes editarlos y exportarlos de nuevo.');
      } catch (e) {
        alert('❌ El archivo no tiene el formato esperado.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Supabase ---------------- */

  function sbMsg(text, isErr) {
    var el = $('sb-msg');
    el.textContent = text;
    el.style.color = isErr ? 'var(--bad)' : 'var(--good)';
  }

  function loadSupabaseStatus() {
    var el = $('supabase-status');
    if (Supabase.isConfigured()) {
      var creds = Supabase.getCreds();
      el.innerHTML = '✅ Conectado: <code>' + (creds.url || '').replace(/^https?:\/\//, '') + '</code>' +
        (creds.serviceKey ? ' · modo admin activo' : ' · ⚠ sin Service Key (no se pueden guardar cambios)');
      $('sb-url').value = creds.url || '';
      $('sb-anon').value = creds.anonKey || '';
      $('sb-service').value = creds.serviceKey || '';
    } else {
      el.textContent = 'No conectado. Los datos son locales por ahora.';
    }
  }

  function connectSupabase() {
    var url = $('sb-url').value.trim();
    var anon = $('sb-anon').value.trim();
    var service = $('sb-service').value.trim();
    if (!url || !anon) { sbMsg('❌ Ingresa la Project URL y la Anonymous Key.', true); return; }
    Supabase.setCreds({ url: url, anonKey: anon, serviceKey: service || '' });
    btnSbBusy(true);
    Supabase.testConnection('anon')
      .then(function () {
        sbMsg('✅ Conexión OK. Descargando datos compartidos...');
        return Store.syncFromCloud();
      })
      .then(function () {
        return fetchAnnouncements();
      })
      .then(function () {
        sbMsg('✅ Conectado y datos sincronizados.');
        btnSbBusy(false);
        loadSupabaseStatus();
        renderSeries();
      })
      .catch(function (e) {
        sbMsg('❌ No se pudo conectar: ' + (e.message || e), true);
        btnSbBusy(false);
      });
  }

  function btnSbBusy(b) {
    $('btn-sb-connect').disabled = b;
    $('btn-sb-test').disabled = b;
    $('btn-sb-seed').disabled = b;
  }

  function disconnectSupabase() {
    if (!confirm('¿Desconectar Supabase? Volverás a modo local.')) return;
    Supabase.clearCreds();
    sbMsg('');
    loadSupabaseStatus();
    renderSeries();
  }

  function testSupabase() {
    var url = $('sb-url').value.trim();
    var anon = $('sb-anon').value.trim();
    var service = $('sb-service').value.trim();
    Supabase.setCreds({ url: url, anonKey: anon, serviceKey: service || '' });
    btnSbBusy(true);
    var p;
    if (service) {
      p = Supabase.testConnection('admin').then(function () { return 'admin'; });
    } else {
      p = Supabase.testConnection('anon').then(function () { return 'anon'; });
    }
    p.then(function (m) {
      sbMsg('✅ Conexión válida (' + m + ').');
      btnSbBusy(false);
      loadSupabaseStatus();
    }).catch(function (e) {
      sbMsg('❌ Falló: ' + (e.message || e), true);
      btnSbBusy(false);
    });
  }

  function seedToCloud() {
    if (!Supabase.isConfigured()) { sbMsg('❌ Conecta Supabase primero.', true); return; }
    if (!confirm('¿Subir las series demostración (SVG) a la nube? Los datos actuales de la nube se mantendrán.')) return;
    btnSbBusy(true);
    sbMsg('Subiendo series demo a la nube...');
    var local = Store.getSeries();
    Supabase.saveSeries(JSON.parse(JSON.stringify(local))).then(function () {
      return Store.syncFromCloud();
    }).then(function () {
      sbMsg('✅ Datos demo subidos y sincronizados.');
      btnSbBusy(false);
      renderSeries();
    }).catch(function (e) {
      sbMsg('❌ Error al subir: ' + (e.message || e), true);
      btnSbBusy(false);
    });
  }

  /* ---------------- Init ---------------- */

  function initAdmin() {
    loadConfigForm();
    renderSeries();
    $('btn-add-ann').addEventListener('click', addAnnouncement);
    $('btn-export-ann').addEventListener('click', exportAnnouncements);
    $('btn-load-ann').addEventListener('click', function () { $('ann-file-input').click(); });
    $('ann-file-input').addEventListener('change', function () {
      if (this.files.length) loadAnnouncementsFile(this.files[0]);
    });
    fetchAnnouncements();
    loadSupabaseStatus();
    loadCloudinaryStatus();
    $('btn-sb-connect').addEventListener('click', connectSupabase);
    $('btn-sb-disconnect').addEventListener('click', disconnectSupabase);
    $('btn-sb-test').addEventListener('click', testSupabase);
    $('btn-sb-seed').addEventListener('click', seedToCloud);
    $('btn-cd-save').addEventListener('click', saveCloudinary);
    $('btn-cd-clear').addEventListener('click', clearCloudinary);
    $('btn-cd-test').addEventListener('click', testCloudinary);
  }

  function init() {
    createSeedSeries();
    $('btn-login').addEventListener('click', doLogin);
    $('login-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('btn-logout').addEventListener('click', doLogout);
    $('btn-change-pw').addEventListener('click', changePassword);
    $('new-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') changePassword(); });
    $('btn-save-config').addEventListener('click', saveConfigForm);
    $('btn-add-serie').addEventListener('click', addSerie);
    $('serie-nombre').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSerie(); });
    checkAuth();
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', Admin.init);