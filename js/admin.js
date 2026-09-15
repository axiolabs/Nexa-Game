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
      s.imagenes.forEach(function (im) { total += im.data.length * 0.75; });
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

  async function addImage(serieId, files) {
    var series = Store.getSeries();
    var idx = series.findIndex(function (s) { return s.id === serieId; });
    if (idx === -1) return;
    var ok = 0;
    for (var i = 0; i < files.length; i++) {
      var data = await readImages(files[i]);
      if (data.length > 800 * 1024) {
        alert('La imagen "' + files[i].name + '" es muy pesada (' + Math.round(data.length / 1024) + 'KB). Usa imágenes de menos de 800KB.');
        continue;
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

  /* ---------------- Init ---------------- */

  function initAdmin() {
    loadConfigForm();
    renderSeries();
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