const fs = require('fs');
const path = require('path');

// Mapa de abreviaturas de libros
// Mapa de abreviaturas de libros
const abreviaturasLibros = {
  'gn': 'genesis', 'gen': 'genesis',
  'ex': 'exodo', 'ex': 'exodo',
  'lv': 'levitico', 'lev': 'levitico',
  'nm': 'numeros', 'num': 'numeros',
  'dt': 'deuteronomio', 'deu': 'deuteronomio',
  'jos': 'josue',
  'jc': 'jueces', 'jue': 'jueces',
  'rt': 'rut',
  '1sm': '1_samuel', '1s': '1_samuel',
  '2sm': '2_samuel', '2s': '2_samuel',
  '1r': '1_reyes',
  '2r': '2_reyes',
  '1cr': '1_cronicas',
  '2cr': '2_cronicas',
  '1 s': '1_samuel', '2 s': '2_samuel',
  '1 sam': '1_samuel', '1sam': '1_samuel',
  '2 sam': '2_samuel', '2sam': '2_samuel',
  '1 r': '1_reyes', '2 r': '2_reyes',
  '1 rey': '1_reyes', '1rey': '1_reyes',
  '2 rey': '2_reyes', '2rey': '2_reyes',
  '1 cr': '1_cronicas', '2 cr': '2_cronicas',
  '1 cro': '1_cronicas', '1cro': '1_cronicas',
  '2 cro': '2_cronicas', '2cro': '2_cronicas',
  'esd': 'esdras',
  'neh': 'nehemias',
  'est': 'ester',
  'job': 'job',
  'sal': 'salmos',
  'pr': 'proverbios', 'prov': 'proverbios',
  'ec': 'eclesiastes', 'ecl': 'eclesiastes',
  'ct': 'cantares', 'cant': 'cantares',
  'is': 'isaias', 'isa': 'isaias',
  'jer': 'jeremias',
  'lam': 'lamentaciones',
  'ez': 'ezequiel', 'eze': 'ezequiel',
  'dn': 'daniel', 'dan': 'daniel',
  'os': 'oseas',
  'jl': 'joel', 'joe': 'joel',
  'am': 'amos',
  'abd': 'abdias',
  'jon': 'jonas',
  'mi': 'miqueas', 'miq': 'miqueas',
  'nah': 'nahum',
  'hab': 'habacuc',
  'sof': 'sofonias',
  'ag': 'hageo',
  'zac': 'zacarias',
  'mal': 'malaquias',
  'mt': 'mateo', 'mat': 'mateo',
  'mc': 'marcos', 'mar': 'marcos',
  'lc': 'lucas', 'luc': 'lucas',
  'jn': 'juan', 'jua': 'juan', 'juan': 'juan',
  'hch': 'hechos',
  'ro': 'romanos', 'rom': 'romanos',
  '1co': '1_corintios',
  '2co': '2_corintios',
  '1 co': '1_corintios', '2 co': '2_corintios',
  '1 cor': '1_corintios', '1cor': '1_corintios',
  '2 cor': '2_corintios', '2cor': '2_corintios',
  'gl': 'galatas', 'gal': 'galatas',
  'ef': 'efesios',
  'flp': 'filipenses', 'fil': 'filipenses',
  'col': 'colosenses',
  '1ts': '1_tesalonicenses',
  '2ts': '2_tesalonicenses',
  '1 ts': '1_tesalonicenses', '2 ts': '2_tesalonicenses',
  '1 tes': '1_tesalonicenses', '1tes': '1_tesalonicenses',
  '2 tes': '2_tesalonicenses', '2tes': '2_tesalonicenses',
  '1tm': '1_timoteo', '1ti': '1_timoteo',
  '2tm': '2_timoteo', '2ti': '2_timoteo',
  '1 tm': '1_timoteo', '2 tm': '2_timoteo',
  '1 ti': '1_timoteo', '2 ti': '2_timoteo',
  '1 tim': '1_timoteo', '1tim': '1_timoteo',
  '2 tim': '2_timoteo', '2tim': '2_timoteo',
  'tit': 'tito',
  'flm': 'filemon',
  'heb': 'hebreos',
  'stg': 'santiago', 'sant': 'santiago',
  '1p': '1_pedro',
  '2p': '2_pedro',
  '1 p': '1_pedro', '2 p': '2_pedro',
  '1 ped': '1_pedro', '1ped': '1_pedro',
  '2 ped': '2_pedro', '2ped': '2_pedro',
  '1jn': '1_juan',
  '2jn': '2_juan',
  '3jn': '3_juan',
  '1 jn': '1_juan', '2 jn': '2_juan', '3 jn': '3_juan',
  '1 jua': '1_juan', '1jua': '1_juan',
  '2 jua': '2_juan', '2jua': '2_juan',
  '3 jua': '3_juan', '3jua': '3_juan',
  'jud': 'judas',
  'ap': 'apocalipsis', 'apo': 'apocalipsis', 'apoc': 'apocalipsis',

  // ── Variantes con número separado y sufijos (1ra, 2da, 3er, etc.) ──
  '1 samuel': '1_samuel',     '1er samuel': '1_samuel',  '1ro samuel': '1_samuel',
  '2 samuel': '2_samuel',     '2do samuel': '2_samuel',  '2da samuel': '2_samuel',
  '1 reyes': '1_reyes',       '1er reyes': '1_reyes',    '1ro reyes': '1_reyes',
  '2 reyes': '2_reyes',       '2do reyes': '2_reyes',    '2da reyes': '2_reyes',
  '1 cronicas': '1_cronicas', '1er cronicas': '1_cronicas', '1ra cronicas': '1_cronicas',
  '2 cronicas': '2_cronicas', '2do cronicas': '2_cronicas', '2da cronicas': '2_cronicas',
  '1 corintios': '1_corintios', '1er corintios': '1_corintios', '1ra corintios': '1_corintios',
  '2 corintios': '2_corintios', '2do corintios': '2_corintios', '2da corintios': '2_corintios',
  '1 tesalonicenses': '1_tesalonicenses', '1er tesalonicenses': '1_tesalonicenses',
  '2 tesalonicenses': '2_tesalonicenses', '2do tesalonicenses': '2_tesalonicenses',
  '1 timoteo': '1_timoteo',   '1er timoteo': '1_timoteo',
  '2 timoteo': '2_timoteo',   '2do timoteo': '2_timoteo',
  '1 pedro': '1_pedro',       '1er pedro': '1_pedro',    '1ra pedro': '1_pedro',
  '2 pedro': '2_pedro',       '2do pedro': '2_pedro',    '2da pedro': '2_pedro',
  '1 juan': '1_juan',         '1er juan': '1_juan',      '1ra juan': '1_juan',
  '2 juan': '2_juan',         '2do juan': '2_juan',      '2da juan': '2_juan',
  '3 juan': '3_juan',         '3er juan': '3_juan',      '3ra juan': '3_juan',
  // Variantes con "de"
  '1 de samuel': '1_samuel',   '2 de samuel': '2_samuel',
  '1 de reyes': '1_reyes',     '2 de reyes': '2_reyes',
  '1 de cronicas': '1_cronicas','2 de cronicas': '2_cronicas',
  '1ra de cronicas': '1_cronicas','2da de cronicas': '2_cronicas',
  '1 de corintios': '1_corintios','2 de corintios': '2_corintios',
  '1ra de corintios': '1_corintios','2da de corintios': '2_corintios',
  '1 de tesalonicenses': '1_tesalonicenses','2 de tesalonicenses': '2_tesalonicenses',
  '1 de timoteo': '1_timoteo', '2 de timoteo': '2_timoteo',
  '1ra de timoteo': '1_timoteo','2da de timoteo': '2_timoteo',
  '1 de pedro': '1_pedro',     '2 de pedro': '2_pedro',
  '1ra de pedro': '1_pedro',   '2da de pedro': '2_pedro',
  '1er de pedro': '1_pedro',   '2do de pedro': '2_pedro',
  '1 de juan': '1_juan',       '2 de juan': '2_juan',       '3 de juan': '3_juan',
  '1ra de juan': '1_juan',     '2da de juan': '2_juan',     '3ra de juan': '3_juan',
  '1er de juan': '1_juan',     '2do de juan': '2_juan',     '3er de juan': '3_juan',

  // ── Plurales de Timoteo y Juan (Timoteos / Juanes) ──
  '1 timoteos': '1_timoteo',   '1er timoteos': '1_timoteo',  '1ra timoteos': '1_timoteo',  '1ro timoteos': '1_timoteo',
  '2 timoteos': '2_timoteo',   '2do timoteos': '2_timoteo',  '2da timoteos': '2_timoteo',
  '1 de timoteos': '1_timoteo','2 de timoteos': '2_timoteo',
  '1ra de timoteos': '1_timoteo','2da de timoteos': '2_timoteo',
  '1 juanes': '1_juan',        '1er juanes': '1_juan',       '1ra juanes': '1_juan',       '1ro juanes': '1_juan',
  '2 juanes': '2_juan',        '2do juanes': '2_juan',       '2da juanes': '2_juan',
  '3 juanes': '3_juan',        '3er juanes': '3_juan',       '3ra juanes': '3_juan',       '3ro juanes': '3_juan',
  '1 de juanes': '1_juan',     '2 de juanes': '2_juan',      '3 de juanes': '3_juan',
  '1ra de juanes': '1_juan',   '2da de juanes': '2_juan',    '3ra de juanes': '3_juan',
  '1er de juanes': '1_juan',   '2do de juanes': '2_juan',    '3er de juanes': '3_juan',

  // ── Nombres de libros escritos completos (primera, segunda, tercera de...) ──
  'primera de samuel': '1_samuel',      'primera samuel': '1_samuel',
  'segunda de samuel': '2_samuel',      'segunda samuel': '2_samuel',
  'primera de reyes': '1_reyes',        'primera reyes': '1_reyes',
  'segunda de reyes': '2_reyes',        'segunda reyes': '2_reyes',
  'primera de cronicas': '1_cronicas',  'primera cronicas': '1_cronicas',
  'segunda de cronicas': '2_cronicas',  'segunda cronicas': '2_cronicas',
  'primera de corintios': '1_corintios','primera corintios': '1_corintios',
  'segunda de corintios': '2_corintios','segunda corintios': '2_corintios',
  'primera de tesalonicenses': '1_tesalonicenses', 'primera tesalonicenses': '1_tesalonicenses',
  'segunda de tesalonicenses': '2_tesalonicenses', 'segunda tesalonicenses': '2_tesalonicenses',
  'primera de timoteo': '1_timoteo',    'primera timoteo': '1_timoteo',
  'primera de timoteos': '1_timoteo',   'primera timoteos': '1_timoteo',
  'segunda de timoteo': '2_timoteo',    'segunda timoteo': '2_timoteo',
  'segunda de timoteos': '2_timoteo',   'segunda timoteos': '2_timoteo',
  'primera de pedro': '1_pedro',        'primera pedro': '1_pedro',
  'segunda de pedro': '2_pedro',        'segunda pedro': '2_pedro',
  'primera de juan': '1_juan',          'primera juan': '1_juan',
  'primera de juanes': '1_juan',        'primera juanes': '1_juan',
  'segunda de juan': '2_juan',          'segunda juan': '2_juan',
  'segunda de juanes': '2_juan',        'segunda juanes': '2_juan',
  'tercera de juan': '3_juan',          'tercera juan': '3_juan',
  'tercera de juanes': '3_juan',        'tercera juanes': '3_juan',
};
// Cache para índice de libros
let indexCache = null;
let bibliaCache = {};

// Resolver la ruta base de la biblia de forma robusta:
// - En desarrollo: __dirname = src/ → ../dist/biblia
// - En EXE pkg:    __dirname = snapshot → ../dist/biblia también funciona
// - Fallback extra: junto al ejecutable en disco
function resolverRutaBiblia() {
  // Primera opción: relativa al código fuente (src/buscador.js → dist/biblia)
  const ruta1 = path.join(__dirname, '..', 'dist', 'biblia');
  if (fs.existsSync(path.join(ruta1, '_index.json'))) return ruta1;

  // Segunda opción: junto al ejecutable en disco (para EXE fuera de snapshot)
  const execDir = path.dirname(process.execPath);
  const ruta2 = path.join(execDir, 'dist', 'biblia');
  if (fs.existsSync(path.join(ruta2, '_index.json'))) return ruta2;

  // Tercera opción: directorio de trabajo actual
  const ruta3 = path.join(process.cwd(), 'dist', 'biblia');
  if (fs.existsSync(path.join(ruta3, '_index.json'))) return ruta3;

  // Cuarta opción: junto al EXE sin subcarpeta dist
  const ruta4 = path.join(execDir, 'biblia');
  if (fs.existsSync(path.join(ruta4, '_index.json'))) return ruta4;

  return ruta1; // fallback
}

const BIBLIA_DIR = resolverRutaBiblia();

// Cargar índice de libros
function cargarIndice() {
  if (indexCache) return indexCache;
  
  try {
    const data = fs.readFileSync(path.join(BIBLIA_DIR, '_index.json'), 'utf-8');
    indexCache = JSON.parse(data);
    return indexCache;
  } catch (error) {
    console.error('Error al cargar índice de Biblia. Ruta intentada:', BIBLIA_DIR, error.message);
    return [];
  }
}

// Cargar un libro (con cache)
function cargarLibro(libro) {
  if (bibliaCache[libro]) return bibliaCache[libro];
  
  try {
    const data = fs.readFileSync(path.join(BIBLIA_DIR, `${libro}.json`), 'utf-8');
    bibliaCache[libro] = JSON.parse(data);
    return bibliaCache[libro];
  } catch (error) {
    return null;
  }
}

// Obtener nombre legible del libro
function obtenerNombreLibro(libro) {
  const indice = cargarIndice();
  const libroData = indice.find(l => l.key === libro);
  return libroData ? libroData.shortTitle : libro;
}

// Obtener versículo específico
function obtenerVersiculo(libro, capitulo, versiculo) {
  const data = cargarLibro(libro);
  if (!data) return null;
  
  if (capitulo < 1 || capitulo > data.length) return null;
  const capituloData = data[capitulo - 1];
  if (versiculo < 1 || versiculo > capituloData.length) return null;
  
  return {
    libro,
    libroNombre: obtenerNombreLibro(libro),
    capitulo,
    versiculo,
    texto: capituloData[versiculo - 1]
  };
}

// Buscar por palabra clave
function buscarPorPalabra(palabra, libroFiltro = null) {
  const indice = cargarIndice();
  const resultados = [];
  
  const buscarEnLibro = (libro) => {
    const data = cargarLibro(libro.key);
    if (!data) return;
    
    data.forEach((capitulo, numCapitulo) => {
      capitulo.forEach((versiculo, numVerse) => {
        if (versiculo.toLowerCase().includes(palabra.toLowerCase())) {
          resultados.push({
            libro: libro.key,
            libroNombre: libro.shortTitle,
            capitulo: numCapitulo + 1,
            versiculo: numVerse + 1,
            texto: versiculo
          });
        }
      });
    });
  };
  
  if (libroFiltro) {
    const libro = indice.find(b => b.key === libroFiltro || b.shortTitle.toLowerCase() === libroFiltro.toLowerCase());
    if (libro) buscarEnLibro(libro);
  } else {
    indice.forEach(buscarEnLibro);
  }
  
  return resultados;
}

// Búsqueda inteligente (detecta si es cita bíblica o palabra)
function buscarInteligente(texto) {
  // Acepta: "2 de timoteos 1:1", "3ra juan 1:2", "1 cronicas 5:3-7", "jn 3:16", "primera de juan 1:1"
  const regex = /^((?:(?:\d+\s*(?:ra|do|da|er|ro)?|primera|segunda|tercera|primer|segundo|tercer)\s*(?:de\s+)?)?[a-záéíóúñ]+s?)\s+(\d+):(\d+)?(?:-(\d+))?$/i;

  const match = texto.trim().match(regex);
  
  if (match) {
    let libroInput = match[1].toLowerCase().trim();
    // Normalizar: quitar acentos y diacríticos
    libroInput = libroInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const capitulo = parseInt(match[2]);
    const vInicio = match[3] ? parseInt(match[3]) : null;
    const vFin = match[4] ? parseInt(match[4]) : null;
    
    let libro = abreviaturasLibros[libroInput] || abreviaturasLibros[libroInput.replace(/\s+/g, '')] || libroInput;
    
    if (!cargarLibro(libro)) {
      return {
        tipo: 'error',
        mensaje: `Libro no encontrado: ${libroInput}`
      };
    }
    
    if (vInicio && vFin && vInicio !== vFin) {
      // Rango de versículos
      const resultados = [];
      for (let v = vInicio; v <= vFin; v++) {
        const verso = obtenerVersiculo(libro, capitulo, v);
        if (verso) resultados.push(verso);
      }
      return { tipo: 'cita', resultados };
    } else if (vInicio) {
      // Versículo específico
      const verso = obtenerVersiculo(libro, capitulo, vInicio);
      return verso 
        ? { tipo: 'cita', resultados: [verso] }
        : { tipo: 'error', mensaje: `Versículo no encontrado: ${libroInput} ${capitulo}:${vInicio}` };
    }
  }
  
  // Es una búsqueda por palabra
  const resultados = buscarPorPalabra(texto);
  return {
    tipo: 'palabra',
    resultados: resultados.slice(0, 20) // Limitar a 20 resultados
  };
}

// Predicción/autocompletado
function obtenerPredicciones(texto) {
  // Parsear la cita en tres partes: Libro, Capítulo (opcional), Versículo (opcional)
  // Acepta: "1 juan", "2 de timoteo", "jn", "jn 3", "jn 3:16", "primera de juan", etc.
  const regex = /^((?:(?:\d+\s*(?:ra|do|da|er|ro)?|primera|segunda|tercera|primer|segundo|tercer)\s*(?:de\s+)?)?[a-záéíóúñ\s]*)\s*(\d+)?(?:(?::| )(\d+)?)?$/i;
  const matchCita = texto.trim().match(regex);
  
  if (!matchCita) {
    // Búsqueda por palabra
    const resultados = buscarPorPalabra(texto);
    return resultados.slice(0, 10).map(r => ({
      tipo: 'palabra',
      display: `${r.libroNombre} - ${r.capitulo}:${r.versiculo}`,
      texto: r.texto.substring(0, 80) + '...'
    }));
  }
  
  let bookPart = matchCita[1].toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Si no han escrito nada en el nombre del libro, buscar por palabra
  if (bookPart === '') {
    return [];
  }
  
  // Mapear abreviaturas exactas primero
  let libroKey = abreviaturasLibros[bookPart] || abreviaturasLibros[bookPart.replace(/\s+/g, '')] || bookPart;
  
  // Obtener índice de libros
  const indice = cargarIndice();
  
  // Parsear número y parte de letras
  const numMatch = bookPart.match(/^(1|2|3|primera|segunda|tercera|primer|segundo|tercer|1ra|2da|3ra|1er|2do|3er|1ro)\b/i);
  let num = null;
  let letterPart = bookPart;
  
  if (numMatch) {
    const p = numMatch[0];
    if (['1', '1ra', '1er', '1ro', 'primera', 'primer'].includes(p)) num = '1';
    else if (['2', '2da', '2do', 'segunda', 'segundo'].includes(p)) num = '2';
    else if (['3', '3ra', '3er', '3ro', 'tercera', 'tercer'].includes(p)) num = '3';
    
    letterPart = bookPart.slice(numMatch[0].length).trim();
    // Quitar "de " si está al inicio de la parte de letras
    if (letterPart.startsWith('de ')) {
      letterPart = letterPart.slice(3).trim();
    }
  }
  
  // Filtrar los libros que coincidan
  const matches = indice.filter(book => {
    // Si se especificó número, comprobar que empiece por él
    if (num) {
      if (!book.key.startsWith(num + '_')) return false;
    } else {
      // Si no se especificó número, preferimos omitir los libros numerados para evitar ruido,
      // a menos que sea una abreviatura exacta en abreviaturasLibros (la cual ya se resolvió en libroKey)
      if (/^[123]_/.test(book.key) && book.key !== libroKey) return false;
    }
    
    // Si hay parte de letras, el key, shortTitle o abbr deben empezar con ella
    if (letterPart) {
      const cleanKey = book.key.replace(/^[123]_/, '');
      const cleanShort = book.shortTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[123]\s+/, '');
      const cleanAbbr = book.abbr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[123]\s+/, '');
      
      return cleanKey.startsWith(letterPart) || cleanShort.startsWith(letterPart) || cleanAbbr.startsWith(letterPart);
    }
    
    return true;
  });
  
  const predicciones = [];
  
  if (matches.length === 1) {
    // Coincidencia exacta o única: mostrar capítulos o versículos de este libro
    const bookInfo = matches[0];
    const capitulo = matchCita[2] ? parseInt(matchCita[2]) : null;
    const versiculo = matchCita[3] ? parseInt(matchCita[3]) : null;
    
    if (!capitulo) {
      // Mostrar capítulos disponibles
      for (let c = 1; c <= bookInfo.chapters && c <= 5; c++) {
        predicciones.push({
          tipo: 'cita',
          display: `${bookInfo.shortTitle} ${c}:1`,
          completo: `${bookInfo.abbr} ${c}:1`
        });
      }
    } else if (!versiculo) {
      // Mostrar versículos del capítulo
      const data = cargarLibro(bookInfo.key);
      if (data && capitulo <= data.length) {
        const capData = data[capitulo - 1];
        for (let v = 1; v <= Math.min(5, capData.length); v++) {
          predicciones.push({
            tipo: 'cita',
            display: `${bookInfo.shortTitle} ${capitulo}:${v}`,
            completo: `${bookInfo.abbr} ${capitulo}:${v}`,
            texto: capData[v - 1].substring(0, 60) + '...'
          });
        }
      }
    } else {
      // Mostrar versículo específico y siguientes
      const data = cargarLibro(bookInfo.key);
      if (data && capitulo <= data.length) {
        const capData = data[capitulo - 1];
        for (let v = versiculo; v <= Math.min(versiculo + 4, capData.length); v++) {
          predicciones.push({
            tipo: 'cita',
            display: `${bookInfo.shortTitle} ${capitulo}:${v}`,
            completo: `${bookInfo.abbr} ${capitulo}:${v}`,
            texto: capData[v - 1].substring(0, 60) + '...'
          });
        }
      }
    }
  } else if (matches.length > 1) {
    // Múltiples coincidencias (ej: al escribir "2" o "ju"): mostrar sugerencias de libros
    matches.slice(0, 10).forEach(book => {
      predicciones.push({
        tipo: 'cita',
        display: `${book.shortTitle} 1:1`,
        completo: `${book.abbr} 1:1`,
        texto: `Ir al libro de ${book.shortTitle}`
      });
    });
  }
  
  // Si no hubo coincidencia por prefijos, buscar por palabra
  if (predicciones.length === 0) {
    const resultados = buscarPorPalabra(texto);
    return resultados.slice(0, 10).map(r => ({
      tipo: 'palabra',
      display: `${r.libroNombre} - ${r.capitulo}:${r.versiculo}`,
      texto: r.texto.substring(0, 80) + '...'
    }));
  }
  
  return predicciones;
}

// Obtener versículo anterior
function obtenerVersiculoAnterior(libro, capitulo, versiculo) {
  let v = versiculo - 1;
  let c = capitulo;

  // Si llegamos a versículo 0, ir al capítulo anterior
  if (v < 1) {
    c = capitulo - 1;
    if (c < 1) return null; // No hay capítulo anterior

    const data = cargarLibro(libro);
    if (!data || c > data.length) return null;

    v = data[c - 1].length; // Último versículo del capítulo anterior
  }

  return obtenerVersiculo(libro, c, v);
}

// Obtener versículo siguiente
function obtenerVersiculoSiguiente(libro, capitulo, versiculo) {
  const data = cargarLibro(libro);
  if (!data) return null;

  if (capitulo < 1 || capitulo > data.length) return null;

  const capData = data[capitulo - 1];
  let v = versiculo + 1;
  let c = capitulo;

  // Si superamos el último versículo del capítulo, ir al siguiente
  if (v > capData.length) {
    c = capitulo + 1;
    v = 1;

    if (c > data.length) return null; // No hay capítulo siguiente

    return obtenerVersiculo(libro, c, v);
  }

  return obtenerVersiculo(libro, c, v);
}

// Obtener información de navegación (si hay anterior/siguiente)
function obtenerInfoNavegacion(libro, capitulo, versiculo) {
  const data = cargarLibro(libro);
  if (!data) return null;

  if (capitulo < 1 || capitulo > data.length) return null;

  const capData = data[capitulo - 1];
  if (versiculo < 1 || versiculo > capData.length) return null;

  return {
    tieneAnterior: !(capitulo === 1 && versiculo === 1),
    tieneSiguiente: !(capitulo === data.length && versiculo === capData.length),
    esUltimo: capitulo === data.length && versiculo === capData.length,
    esPrimero: capitulo === 1 && versiculo === 1
  };
}

module.exports = {
  buscarInteligente,
  obtenerPredicciones,
  buscarPorPalabra,
  obtenerVersiculo,
  obtenerVersiculoAnterior,
  obtenerVersiculoSiguiente,
  obtenerInfoNavegacion,
  cargarIndice,
  cargarLibro
};
