const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'src', 'himnarios', 'Songs');
const OUTPUT_DIR = path.join(__dirname, 'output');
const JSON_DIR = path.join(OUTPUT_DIR, 'json');

// Crear directorios si no existen
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });

let stats = {
  totalCanciones: 0,
  totalCoros: 0,
  totalEstrofas: 0,
  errores: 0,
  fechaMigracion: new Date().toISOString().split('T')[0]
};

const allSongs = [];

// Decodificar entidades XML
function decodeXML(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Extraer valor de etiqueta XML simple
function getTagValue(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXML(match[1].trim()) : null;
}

// Analizar título para sacar el número
function parseTitle(rawTitle) {
  if (!rawTitle) return { numero: null, titulo: "Sin Título" };
  const match = rawTitle.match(/^#(\d+)\s+(.+)/);
  if (match) {
    return { numero: parseInt(match[1], 10), titulo: match[2].trim() };
  }
  return { numero: null, titulo: rawTitle.trim() };
}

// Mapear etiqueta de OpenSong al formato interno
function parseSectionTag(tag) {
  const upper = tag.toUpperCase();
  const vMatch = upper.match(/^V(\d+)$/);
  
  if (vMatch) return { tipo: 'estrofa', numero: parseInt(vMatch[1], 10) };
  
  switch (upper) {
    case 'C':
    case 'CH':
    case 'CORO':
      return { tipo: 'coro' };
    case 'B':
    case 'BRIDGE':
      return { tipo: 'puente' };
    case 'P':
    case 'PC':
      return { tipo: 'pre-coro' };
    case 'I':
    case 'INTRO':
      return { tipo: 'introducción' };
    case 'O':
    case 'OUTRO':
      return { tipo: 'salida' };
    case 'T':
    case 'TRANS':
      return { tipo: 'transición' };
    default:
      return { tipo: 'personalizado', nombre: upper };
  }
}

// Analizar y estructurar la letra
function parseLyrics(rawLyrics) {
  if (!rawLyrics) return [];
  
  const lineas = rawLyrics.split('\n');
  const secciones = [];
  let currentSection = null;

  for (let i = 0; i < lineas.length; i++) {
    // Eliminar espacios vacíos innecesarios al inicio y fin
    let linea = lineas[i].trim();
    
    // Buscar etiquetas como [V1], [C], etc.
    const tagMatch = linea.match(/^\[([^\]]+)\]$/);
    if (tagMatch) {
      if (currentSection && currentSection.lineas.length > 0) {
        secciones.push(currentSection);
      }
      const tagInfo = parseSectionTag(tagMatch[1]);
      currentSection = { ...tagInfo, lineas: [] };
    } else {
      // Si no hay sección activa, crear una estrofa por defecto
      if (!currentSection) {
        // Ignorar líneas vacías al principio
        if (linea === '') continue;
        currentSection = { tipo: 'estrofa', numero: 1, lineas: [] };
      }
      // Agregar línea, manteniendo saltos pero eliminando consecutivos vacíos múltiples
      if (linea !== '' || (currentSection.lineas.length > 0 && currentSection.lineas[currentSection.lineas.length - 1] !== '')) {
        currentSection.lineas.push(linea);
      }
    }
  }

  if (currentSection && currentSection.lineas.length > 0) {
    // Limpiar última línea vacía si existe
    if (currentSection.lineas[currentSection.lineas.length - 1] === '') {
      currentSection.lineas.pop();
    }
    if (currentSection.lineas.length > 0) {
      secciones.push(currentSection);
    }
  }

  // Contar estadísticas
  secciones.forEach(sec => {
    if (sec.tipo === 'coro') stats.totalCoros++;
    else if (sec.tipo === 'estrofa') stats.totalEstrofas++;
  });

  return secciones;
}

function processFile(filePath) {
  try {
    console.log('Procesando:', filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Validar si parece XML de OpenSong
    if (!content.includes('<song>') && !content.includes('<?xml')) {
      return null;
    }

    const relativePath = path.relative(SONGS_DIR, filePath);
    const carpeta = relativePath.split(path.sep)[0] || "Otras";

    let titleRaw = getTagValue(content, 'title');
    if (!titleRaw || titleRaw.trim() === '') {
      titleRaw = path.basename(filePath, path.extname(filePath));
    }
    const { numero, titulo } = parseTitle(titleRaw);
    const autor = getTagValue(content, 'author');
    const copyright = getTagValue(content, 'copyright');
    const tono = getTagValue(content, 'key');
    const tempo = getTagValue(content, 'tempo');
    const compas = getTagValue(content, 'time_sig');
    const ccli = getTagValue(content, 'ccli');
    const lyricsRaw = getTagValue(content, 'lyrics');

    const secciones = parseLyrics(lyricsRaw);

    const songData = {
      numero,
      titulo,
      carpeta,
      tono: tono || null,
      compas: compas || null,
      autor: autor || null,
      compositor: autor || null, // Se puede ajustar si OpenSong tiene otro campo
      copyright: copyright || null,
      ccli: ccli || null,
      tempo: tempo || null,
      referencias_biblicas: [],
      secciones
    };

    return songData;
  } catch (error) {
    console.error(`Error procesando archivo ${filePath}:`, error.message);
    stats.errores++;
    return null;
  }
}

// Leer directorio de forma recursiva
function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      const ext = path.extname(filepath).toLowerCase();
      // Ignorar archivos que sabemos no son OpenSong XML
      if (!['.html', '.css', '.json', '.js', '.md'].includes(ext)) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walkSync(SONGS_DIR);
console.log(`Encontrados ${files.length} archivos para analizar...`);

let contador = 1;
for (const file of files) {
  if (contador % 100 === 0) console.log(`Procesando archivo ${contador}...`);
  const songData = processFile(file);
  if (songData) {
    // Generar archivo individual
    const safeTitle = (songData.titulo || `cancion_${contador}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `cancion_${contador}_${safeTitle}.json`;
    fs.writeFileSync(path.join(JSON_DIR, filename), JSON.stringify(songData, null, 2), 'utf-8');
    
    // Agregar al array principal
    // Para simplificar la inyección en `canticosadmin.html`, 
    // mapearemos las secciones a 'estrofas' estándar también
    const estrofasMapeadas = [];
    songData.secciones.forEach((sec) => {
      estrofasMapeadas.push({
        numero: sec.numero || 1,
        texto: sec.lineas.join('\n'),
        tipo: sec.tipo === 'coro' ? 'coro' : 'estrofa'
      });
    });

    const songAppFormat = {
      numero: songData.numero,
      titulo: songData.titulo,
      carpeta: songData.carpeta,
      tono: songData.tono,
      idioma: 'es',
      fuente: 'opensong',
      cantidadEstrofas: estrofasMapeadas.length,
      estrofas: estrofasMapeadas,
      letraCompleta: estrofasMapeadas.map(e => e.texto).join('\n'),
      // Mantenemos también la estructura original para futuros usos
      opensongData: songData 
    };

    allSongs.push(songAppFormat);
    stats.totalCanciones++;
    contador++;
  }
}

// Escribir archivo consolidado en output y también donde lo requiere el server (src/himnarios/opensong.json)
fs.writeFileSync(path.join(OUTPUT_DIR, 'songs.json'), JSON.stringify(allSongs, null, 2), 'utf-8');
fs.writeFileSync(path.join(__dirname, 'src', 'himnarios', 'opensong.json'), JSON.stringify(allSongs, null, 2), 'utf-8');

// Escribir estadísticas
fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2), 'utf-8');

console.log('Procesamiento completado con éxito.');
console.log('Estadísticas:', stats);
