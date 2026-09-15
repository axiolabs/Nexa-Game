function seedSVG(text, color1, color2) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' + color1 + '"/>' +
    '<stop offset="100%" stop-color="' + color2 + '"/>' +
    '</linearGradient></defs>' +
    '<rect width="640" height="360" fill="url(#g)"/>' +
    '<circle cx="480" cy="90" r="60" fill="rgba(255,255,255,0.18)"/>' +
    '<circle cx="120" cy="300" r="90" fill="rgba(255,255,255,0.12)"/>' +
    '<rect x="200" y="150" width="240" height="60" rx="12" fill="rgba(0,0,0,0.45)"/>' +
    '<text x="320" y="190" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">' + text + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function createSeedSeries() {
  if (Store.getSeries().length > 0) return;
  var base = [
    {
      nombre: 'Rick y Morty',
      categoria: 'Animada',
      imagenes: [
        { data: seedSVG('Portal', '#1b8a5a', '#0e3d2a'), dificultad: 1 },
        { data: seedSVG('Nave', '#4a1b8a', '#1b0e3d'), dificultad: 2 },
        { data: seedSVG('R ojos', '#67c95a', '#0e3d0e'), dificultad: 3 },
        { data: seedSVG('Cita', '#388a6a', '#123547'), dificultad: 4 },
        { data: seedSVG('Casa', '#8a5a1b', '#3d2a0e'), dificultad: 5 }
      ]
    },
    {
      nombre: 'One Piece',
      categoria: 'Anime',
      imagenes: [
        { data: seedSVG('Sombrero', '#d44032', '#6e1512'), dificultad: 1 },
        { data: seedSVG('Quilla', '#2e6e42', '#12391c'), dificultad: 2 },
        { data: seedSVG('Barco', '#2e4a8a', '#121e39'), dificultad: 3 },
        { data: seedSVG('Birrete', '#c9a227', '#6e5a12'), dificultad: 4 },
        { data: seedSVG('Orejas', '#5a1b8a', '#2a0e3d'), dificultad: 5 }
      ]
    },
    {
      nombre: 'The Last of Us',
      categoria: 'Videojuego',
      imagenes: [
        { data: seedSVG('Hongo', '#7a9c5a', '#2a3d1b'), dificultad: 1 },
        { data: seedSVG('Cuarzo', '#5a8a9c', '#1b2a3d'), dificultad: 2 },
        { data: seedSVG('Maseta', '#6a4a2e', '#2e2412'), dificultad: 3 },
        { data: seedSVG('Guitarra', '#8a6a3d', '#3d2a12'), dificultad: 4 },
        { data: seedSVG('Elfo', '#4a6a8a', '#12242e'), dificultad: 5 }
      ]
    },
    {
      nombre: 'Breaking Bad',
      categoria: 'Live-action',
      imagenes: [
        { data: seedSVG('RV', '#c9c9c9', '#4a4a3d'), dificultad: 1 },
        { data: seedSVG('Verdes', '#6a8a5a', '#2e3d24'), dificultad: 2 },
        { data: seedSVG('Lentes', '#3d3d3d', '#121212'), dificultad: 3 },
        { data: seedSVG('Pollo', '#d4a24d', '#5a3d12'), dificultad: 4 },
        { data: seedSVG('Sombrero', '#8a8a5a', '#3d3d24'), dificultad: 5 }
      ]
    }
  ];
  var series = base.map(function (s) {
    return {
      id: Store.uid(),
      nombre: s.nombre,
      categoria: s.categoria,
      imagenes: s.imagenes.map(function (im, k) {
        return { data: im.data, dificultad: im.dificultad, posicion: k + 1 };
      })
    };
  });
  Store.saveSeries(series);
}