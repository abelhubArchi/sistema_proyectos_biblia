const fs = require('fs');
const path = require('path');

// Cache para himnarios
let himnarios = {};

// Cargar todos los himnarios
function cargarHimnarios() {
  if (Object.keys(himnarios).length > 0) return himnarios;

  const dirPath = './src/himnarios';
  
  try {
    const archivos = fs.readdirSync(dirPath).filter(f => f.endsWith('.txt'));

    archivos.forEach(archivo => {
      const nombre = archivo.replace('.txt', '');
      try {
        const contenido = fs.readFileSync(path.join(dirPath, archivo), 'utf-8');
        // Dividir por doble salto de línea para obtener estrofas
        const estrofas = contenido
          .split('\n\n')
          .map(e => e.trim())
          .filter(e => e.length > 0);
        
        himnarios[nombre] = estrofas;
      } catch (error) {
        console.error(`Error al cargar himno ${archivo}:`, error);
      }
    });
  } catch (error) {
    console.error('Error al leer directorio de himnarios:', error);
  }

  return himnarios;
}

// Buscar himnos por número, nombre o letra
function buscarHimnos(texto) {
  cargarHimnarios();
  const resultados = [];
  const textoLower = texto.toLowerCase();

  Object.keys(himnarios).forEach(himnario => {
    const estrofas = himnarios[himnario];

    estrofas.forEach((estrofa, indice) => {
      if (estrofa.toLowerCase().includes(textoLower)) {
        // Extraer número del himno de la primera línea
        const lineas = estrofa.split('\n');
        const primera = lineas[0];
        const numMatch = primera.match(/^(\d+)/);
        const numero = numMatch ? numMatch[1] : `${indice}`;

        resultados.push({
          himnario,
          numero,
          indiceEstrofa: indice,
          preview: primera.substring(0, 60)
        });
      }
    });
  });

  // Eliminar duplicados por numero
  const unicos = {};
  resultados.forEach(r => {
    const key = `${r.himnario}-${r.numero}`;
    if (!unicos[key]) {
      unicos[key] = r;
    }
  });

  return Object.values(unicos).slice(0, 20);
}

// Obtener todas las estrofas de un himno
function obtenerEstrofas(himnario, numero) {
  cargarHimnarios();

  if (!himnarios[himnario]) return null;

  const estrofas = himnarios[himnario];
  const estrofasDelHimno = [];

  // Buscar todas las estrofas del himno con ese número
  estrofas.forEach(estrofa => {
    const lineas = estrofa.split('\n');
    const primera = lineas[0];
    const numMatch = primera.match(/^(\d+)/);
    const num = numMatch ? numMatch[1] : null;

    if (num === numero.toString()) {
      estrofasDelHimno.push(estrofa);
    }
  });

  if (estrofasDelHimno.length === 0) return null;

  return {
    himnario,
    numero,
    totalEstrofas: estrofasDelHimno.length,
    estrofas: estrofasDelHimno
  };
}

// Obtener estrofa específica
function obtenerEstrofa(himnario, numero, indiceEstrofa) {
  const datos = obtenerEstrofas(himnario, numero);

  if (!datos || indiceEstrofa < 0 || indiceEstrofa >= datos.estrofas.length) {
    return null;
  }

  return {
    ...datos,
    estrofaActual: indiceEstrofa,
    contenido: datos.estrofas[indiceEstrofa]
  };
}

module.exports = {
  buscarHimnos,
  obtenerEstrofas,
  obtenerEstrofa,
  cargarHimnarios
};
