const fs = require('fs');
const path = require('path');

// Mapa de abreviaturas de libros
const abreviaturasLibros = {
  // Libros con número - variantes escritas completas
  '1 samuel': '1_samuel',     '1er samuel': '1_samuel',   '1ro samuel': '1_samuel',   '1 de samuel': '1_samuel',
  '2 samuel': '2_samuel',     '2do samuel': '2_samuel',   '2da samuel': '2_samuel',   '2 de samuel': '2_samuel',
  '1 reyes': '1_reyes',       '1er reyes': '1_reyes',     '1ro reyes': '1_reyes',     '1 de reyes': '1_reyes',
  '2 reyes': '2_reyes',       '2do reyes': '2_reyes',     '2da reyes': '2_reyes',     '2 de reyes': '2_reyes',
  '1 cronicas': '1_cronicas', '1er cronicas': '1_cronicas','1ra cronicas': '1_cronicas','1 de cronicas': '1_cronicas',
  '2 cronicas': '2_cronicas', '2do cronicas': '2_cronicas','2da cronicas': '2_cronicas','2 de cronicas': '2_cronicas',
  '1 corintios': '1_corintios','1er corintios': '1_corintios','1ra corintios': '1_corintios','1 de corintios': '1_corintios',
  '2 corintios': '2_corintios','2do corintios': '2_corintios','2da corintios': '2_corintios','2 de corintios': '2_corintios',
  '1 tesalonicenses': '1_tesalonicenses', '1ra tesalonicenses': '1_tesalonicenses', '1 de tesalonicenses': '1_tesalonicenses',
  '2 tesalonicenses': '2_tesalonicenses', '2da tesalonicenses': '2_tesalonicenses', '2 de tesalonicenses': '2_tesalonicenses',
  '1 timoteo': '1_timoteo',   '1er timoteo': '1_timoteo', '1ra timoteo': '1_timoteo', '1 de timoteo': '1_timoteo',
  '2 timoteo': '2_timoteo',   '2do timoteo': '2_timoteo', '2da timoteo': '2_timoteo', '2 de timoteo': '2_timoteo',
  '1 pedro': '1_pedro',       '1er pedro': '1_pedro',     '1ra pedro': '1_pedro',     '1 de pedro': '1_pedro',
  '2 pedro': '2_pedro',       '2do pedro': '2_pedro',     '2da pedro': '2_pedro',     '2 de pedro': '2_pedro',
  '1 juan': '1_juan',         '1er juan': '1_juan',       '1ra juan': '1_juan',       '1 de juan': '1_juan',
  '2 juan': '2_juan',         '2do juan': '2_juan',       '2da juan': '2_juan',       '2 de juan': '2_juan',
  '3 juan': '3_juan',         '3er juan': '3_juan',       '3ra juan': '3_juan',       '3 de juan': '3_juan',
};

// Función para parsear formato "LIBRO CAPÍTULO:VERSÍCULO"
function parsearCitaBiblica(texto) {
  const regex = /^((?:\d+\s*(?:ra|da|do|er|ro|de)?\s*)?[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)\s+(\d+):(\d+)?$/i;
  const match = texto.trim().match(regex);
  if (!match) return null;
  let libroInput = match[1].toLowerCase().trim().replace(/\s+/g, ' ');
  const capitulo = parseInt(match[2]);
  const versiculo = match[3] ? parseInt(match[3]) : null;
  let libro = abreviaturasLibros[libroInput] || libroInput;
  return { libro, capitulo, versiculo };
}

// Función para obtener un versículo específico
function obtenerVersiculo(libro, capitulo, versiculo) {
  const filePath = `./dist/biblia/${libro}.json`;
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Validar índices (0-based en JSON)
    if (capitulo < 1 || capitulo > data.length) {
      return null;
    }
    
    const capituloData = data[capitulo - 1];
    if (versiculo < 1 || versiculo > capituloData.length) {
      return null;
    }
    
    return {
      libro,
      capitulo,
      versiculo,
      texto: capituloData[versiculo - 1]
    };
  } catch (error) {
    return null;
  }
}

// Función para buscar por rango de versículos (ej: "apo 21:4-7")
function buscarRangoVersiculos(libro, capitulo, vInicio, vFin) {
  const filePath = `./dist/biblia/${libro}.json`;
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (capitulo < 1 || capitulo > data.length) {
      return [];
    }
    
    const capituloData = data[capitulo - 1];
    const resultados = [];
    
    for (let v = vInicio; v <= vFin && v <= capituloData.length; v++) {
      resultados.push({
        libro,
        capitulo,
        versiculo: v,
        texto: capituloData[v - 1]
      });
    }
    
    return resultados;
  } catch (error) {
    return [];
  }
}

// Función para buscar versículos en un libro específico
function buscarVersiculos(libro, texto) {
  const filePath = `./dist/biblia/${libro}.json`;
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const resultados = [];
    
    data.forEach((capitulo, numCapitulo) => {
      capitulo.forEach((versiculo, numVerse) => {
        if (versiculo.toLowerCase().includes(texto.toLowerCase())) {
          resultados.push({
            libro,
            capitulo: numCapitulo + 1,
            versiculo: numVerse + 1,
            texto: versiculo
          });
        }
      });
    });
    
    return resultados;
  } catch (error) {
    console.error(`❌ Error al buscar en ${libro}:`, error.message);
    return [];
  }
}

// Función para buscar en TODOS los libros
function buscarEnTodos(texto) {
  const indexPath = './dist/biblia/_index.json';
  
  try {
    const books = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const todosResultados = [];
    
    books.forEach((book) => {
      const resultados = buscarVersiculos(book.key, texto);
      todosResultados.push(...resultados);
    });
    
    return todosResultados;
  } catch (error) {
    console.error('❌ Error al buscar en todos los libros:', error.message);
    return [];
  }
}

// Función para mostrar resultados de forma bonita
function mostrarResultados(resultados) {
  if (resultados.length === 0) {
    console.log('\n❌ No se encontraron resultados\n');
    return;
  }
  
  console.log(`\n✅ Se encontraron ${resultados.length} resultado(s)\n`);
  
  resultados.forEach((res) => {
    console.log(`📖 ${res.libro.toUpperCase()} ${res.capitulo}:${res.versiculo}`);
    console.log(`   "${res.texto}"\n`);
  });
}

// EJEMPLOS DE USO
console.log('🔍 BUSCADOR INTELIGENTE DE VERSÍCULOS\n');

// Obtener el texto a buscar desde la línea de comandos
const textoBuscar = process.argv[2];

if (!textoBuscar) {
  console.log('📝 USO:\n');
  console.log('  Versículo específico (con abreviatura):');
  console.log('    node buscar-versiculos.js "apo 21:4"\n');
  console.log('  Versículo específico (nombre completo):');
  console.log('    node buscar-versiculos.js "apocalipsis 21:4"\n');
  console.log('  Rango de versículos:');
  console.log('    node buscar-versiculos.js "juan 3:16-18"\n');
  console.log('  Buscar palabra en un libro:');
  console.log('    node buscar-versiculos.js "amor" juan\n');
  console.log('  Buscar palabra en todos los libros:');
  console.log('    node buscar-versiculos.js "fe"\n');
  console.log('📚 EJEMPLOS:\n');
  console.log('  node buscar-versiculos.js "apo 21:4"');
  console.log('  node buscar-versiculos.js "jn 3:16-18"');
  console.log('  node buscar-versiculos.js "mt 5:8"');
  console.log('  node buscar-versiculos.js "rom 12:2"\n');
  console.log('📖 ABREVIATURAS COMUNES:\n');
  console.log('  Génesis: gn, gen  |  Éxodo: ex  |  Mateo: mt, mat');
  console.log('  Marcos: mc, mar  |  Lucas: lc, luc  |  Juan: jn, jua');
  console.log('  Romanos: ro, rom  |  Apocalipsis: ap, apo, apoc\n');
  process.exit(0);
}

// Intentar parsear como cita bíblica (ej: "apo 21:4")
const regex = /^([a-záéíóú0-9]+)\s+(\d+):(\d+)?(?:-(\d+))?$/i;
const match = textoBuscar.match(regex);

if (match) {
  const libroInput = match[1].toLowerCase();
  const capitulo = parseInt(match[2]);
  const vInicio = match[3] ? parseInt(match[3]) : null;
  const vFin = match[4] ? parseInt(match[4]) : null;
  
  // Buscar el libro
  let libro = abreviaturasLibros[libroInput] || libroInput;
  
  // Validar que el archivo existe
  const filePath = `./dist/biblia/${libro}.json`;
  if (!fs.existsSync(filePath)) {
    console.log(`❌ No se encontró el libro: "${libroInput}"\n`);
    console.log(`💡 Intenta con una abreviatura válida o el nombre completo.\n`);
    process.exit(1);
  }
  
  console.log(`📖 ${libro.toUpperCase()} ${capitulo}:${vInicio || '?'}\n`);
  
  if (vInicio && vFin && vInicio !== vFin) {
    // Rango de versículos
    const resultados = buscarRangoVersiculos(libro, capitulo, vInicio, vFin);
    mostrarResultados(resultados);
  } else if (vInicio) {
    // Versículo específico
    const resultado = obtenerVersiculo(libro, capitulo, vInicio);
    if (resultado) {
      mostrarResultados([resultado]);
    } else {
      console.log(`❌ Versículo no encontrado: ${libro} ${capitulo}:${vInicio}\n`);
    }
  } else {
    console.log('❌ Debes especificar el número de versículo\n');
  }
} else {
  // Buscar por palabra clave
  const palabraYLibro = textoBuscar.split(' ');
  const palabra = palabraYLibro[0];
  const libroFiltro = palabraYLibro[1];
  
  if (libroFiltro) {
    console.log(`Buscando "${palabra}" en ${libroFiltro.toUpperCase()}...\n`);
    const resultados = buscarVersiculos(libroFiltro, palabra);
    mostrarResultados(resultados);
  } else {
    console.log(`Buscando "${palabra}" en TODOS los libros...\n`);
    const resultados = buscarEnTodos(palabra);
    mostrarResultados(resultados);
  }
}
