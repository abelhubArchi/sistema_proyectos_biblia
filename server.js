const express = require("express");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const buscador = require("./src/buscador");
const himnos = require("./src/himnos");

// ── Resolver ruta de assets de forma robusta (desarrollo y EXE pkg) ───
// En pkg, __dirname apunta al snapshot virtual (solo lectura).
// Necesitamos una carpeta ESCRIBIBLE junto al .exe o al proyecto.
function resolverRutaAssets() {
    // Opción 1: junto al ejecutable en disco
    const execDir = path.dirname(process.execPath);
    const assetsPorExe = path.join(execDir, 'assets');

    // Opción 2: dentro de public/assets desde __dirname (desarrollo)
    const assetsDesarrollo = path.join(__dirname, 'public', 'assets');

    // En modo EXE de pkg, process.pkg existe
    if (process.pkg) {
        // Crear la carpeta si no existe
        if (!fs.existsSync(assetsPorExe)) {
            try { 
                fs.mkdirSync(assetsPorExe, { recursive: true }); 
                
                // Copiar fondos embebidos a la nueva carpeta
                const assetsEmbebidos = path.join(__dirname, 'public', 'assets');
                if (fs.existsSync(assetsEmbebidos)) {
                    const archivos = fs.readdirSync(assetsEmbebidos);
                    archivos.forEach(archivo => {
                        const srcPath = path.join(assetsEmbebidos, archivo);
                        const destPath = path.join(assetsPorExe, archivo);
                        if (fs.statSync(srcPath).isFile()) {
                            fs.copyFileSync(srcPath, destPath);
                        }
                    });
                    console.log(`✅ Se copiaron ${archivos.length} fondos por defecto a la carpeta assets externa.`);
                }
            } catch (e) { 
                console.error("❌ Error al crear carpeta de assets externa:", e); 
            }
        }
        return assetsPorExe;
    }

    // En desarrollo normal
    return assetsDesarrollo;
}

const ASSETS_DIR = resolverRutaAssets();
console.log('📁 Carpeta de assets:', ASSETS_DIR);

// ── Módulos adicionales (sistema de red y QR) ──────────────────────
// Se cargan de forma segura: si no existen, el servidor sigue funcionando normalmente
let networkManager = null;
let qrGenerator = null;
let appConfig = null;

try { networkManager = require("./network-manager"); } catch (e) { /* opcional */ }
try { qrGenerator = require("./qr-generator"); } catch (e) { /* opcional */ }
try {
    // En EXE de pkg, buscar config junto al ejecutable primero
    const cfgPath = process.pkg
        ? path.join(path.dirname(process.execPath), "config.json")
        : path.join(__dirname, "config.json");
    if (fs.existsSync(cfgPath)) {
        appConfig = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    }
} catch (e) { /* opcional */ }

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Tracking de dispositivos conectados ──────────────────────────
let dispositivosConectados = 0;

// ── Exportar io para uso en launcher.js ─────────────────────────
function getIO() { return io; }
module.exports = { getIO };

// Función para dividir de forma inteligente la letra en estrofas lógicas
function dividirEnEstrofas(letraCompleta) {
    if (!letraCompleta) return [];
    const lines = letraCompleta.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const estrofas = [];
    let currentEstrofa = [];
    let inChorus = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const prevLine = i > 0 ? lines[i - 1] : null;

        let shouldStartNew = false;

        if (i > 0) {
            // 1. Si la línea es un indicador de coro
            if (/^coro:?/i.test(line)) {
                shouldStartNew = true;
                inChorus = true;
            }
            // 2. Si la línea empieza con un número de estrofa
            else if (/^\d+[\s.)-]/.test(line)) {
                shouldStartNew = true;
                inChorus = false;
            }
            // 3. Si la línea empieza con delimitador de repetición "//" o "///"
            else if (/^\/\/+/.test(line)) {
                shouldStartNew = true;
                inChorus = false;
            }
            // 4. Si la línea anterior terminaba con "//" o "///"
            else if (prevLine && /\/\/+[.,;:?!'"\s]*$/.test(prevLine)) {
                shouldStartNew = true;
                inChorus = false;
            }
            // 5. Si estábamos en un coro y la línea actual empieza con una letra mayúscula y la anterior termina en punto,
            // esto indica que el coro terminó y empieza otra estrofa
            else if (inChorus && currentEstrofa.length >= 2 && prevLine && /[.!?]$/.test(prevLine) && /^[A-ZÁÉÍÓÚÑ]/.test(line)) {
                shouldStartNew = true;
                inChorus = false;
            }
            // 6. Para estrofas normales, si ya tiene al menos 4 líneas y la siguiente línea empieza con mayúscula,
            // la dividimos para que no queden bloques demasiado largos en la proyección
            else if (!inChorus && currentEstrofa.length >= 4 && /^[A-ZÁÉÍÓÚÑ]/.test(line)) {
                shouldStartNew = true;
            }
        }

        if (shouldStartNew && currentEstrofa.length > 0) {
            estrofas.push(currentEstrofa.join('\n'));
            currentEstrofa = [];
        }

        currentEstrofa.push(line);
    }

    if (currentEstrofa.length > 0) {
        estrofas.push(currentEstrofa.join('\n'));
    }

    return estrofas.map((texto, idx) => ({
        numero: idx + 1,
        texto: texto
    }));
}

// ==================== MULTER — Subir Fondos ====================
const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Usar ASSETS_DIR que es siempre escribible
        if (!fs.existsSync(ASSETS_DIR)) {
            fs.mkdirSync(ASSETS_DIR, { recursive: true });
        }
        cb(null, ASSETS_DIR);
    },
    filename: (req, file, cb) => {
        // Mantener nombre original; si ya existe, agregar timestamp
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const destPath = path.join(ASSETS_DIR, base + ext);
        const finalName = fs.existsSync(destPath) ? `${base}_${Date.now()}${ext}` : `${base}${ext}`;
        cb(null, finalName);
    }
});
const uploadFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG, GIF o WebP'), false);
};
const upload = multer({ storage: uploadStorage, fileFilter: uploadFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ==================== CONVERSIÓN HIMNARIO CALA ====================
// Regla: dentro de cada himno, cada sección tipo "coro" es marcada como tipo "coro".
// El coro se canta después de cada estrofa; se intercala en la lista.
function convertirCala(rawCala) {
    const himnos = rawCala.himnario ? rawCala.himnario.himnos : (Array.isArray(rawCala) ? rawCala : []);
    const resultado = [];

    himnos.forEach(himno => {
        if (!himno || !himno.secciones) return;
        // Construir estrofas intercalando coro tras cada estrofa
        const secciones = himno.secciones;
        // Separar estrofas y coros
        const soloEstrofas = secciones.filter(s => s.tipo === 'estrofa');
        const coros = secciones.filter(s => s.tipo === 'coro');
        const coroTexto = coros.length > 0
            ? coros[0].lineas.filter(l => l !== '').join('\n')
            : null;

        // Intercalar: coro solo después de las primeras 4 estrofas, luego normal
        const estrofasFinales = [];
        let idx = 1;
        soloEstrofas.forEach((est, i) => {
            const texto = est.lineas.filter(l => l !== '').join('\n');
            estrofasFinales.push({ numero: idx++, texto, tipo: 'estrofa' });
            // Solo intercalar coro después de las primeras 4 estrofas
            if (coroTexto && i < 4) {
                estrofasFinales.push({ numero: idx++, texto: coroTexto, tipo: 'coro' });
            }
        });
        // Si no hay estrofas normales pero sí coro, incluir el coro solo
        if (soloEstrofas.length === 0 && coroTexto) {
            estrofasFinales.push({ numero: 1, texto: coroTexto, tipo: 'coro' });
        }

        resultado.push({
            numero: himno.numero,
            titulo: himno.titulo,
            tono: himno.tono || '',
            idioma: himno.idioma || 'es',
            fuente: 'cala',
            cantidadEstrofas: estrofasFinales.length,
            estrofas: estrofasFinales,
            letraCompleta: estrofasFinales.map(e => e.texto).join('\n')
        });
    });
    return resultado;
}

// ==================== CONVERSIÓN HIMNARIO IGLESIA DE DIOS ====================
function convertirIglesiaDeDios(rawArray) {
    const resultado = [];
    rawArray.forEach(himno => {
        if (!himno || !himno.secciones) return;
        const estrofasFinales = [];
        let idx = 1;
        himno.secciones.forEach(sec => {
            const texto = sec.lineas.filter(l => l !== '').join('\n');
            estrofasFinales.push({
                numero: idx++,
                texto,
                tipo: sec.tipo  // 'estrofa' o 'coro'
            });
        });
        resultado.push({
            numero: himno.numero,
            titulo: himno.titulo,
            tono: himno.tono || '',
            idioma: himno.idioma || 'es',
            fuente: 'iglesiadedios',
            cantidadEstrofas: estrofasFinales.length,
            estrofas: estrofasFinales,
            letraCompleta: estrofasFinales.map(e => e.texto).join('\n')
        });
    });
    return resultado;
}

// Cargar cancionero.json en memoria (ahora llamado "Coros")
let cancionero = [];
try {
    const cancioneroPath = path.join(__dirname, "src", "himnarios", "cancionero.json");
    const rawData = JSON.parse(fs.readFileSync(cancioneroPath, "utf-8"));

    // Asegurar que las estrofas se dividan correctamente de forma dinámica
    cancionero = rawData.map(cantico => {
        cantico.fuente = 'coros';
        if (cantico.letraCompleta) {
            cantico.estrofas = dividirEnEstrofas(cantico.letraCompleta);
        } else if (cantico.diapositivas && cantico.diapositivas.length > 0) {
            cantico.estrofas = cantico.diapositivas.map((texto, idx) => ({
                numero: idx + 1,
                texto: texto
            }));
        }
        return cantico;
    });

    console.log(`📚 Cargados ${cancionero.length} cánticos (Coros) correctamente.`);
} catch (error) {
    console.error("❌ Error al cargar cancionero.json:", error);
}

// Cargar Himnario Cala
let himarioCala = [];
try {
    const calaPath = path.join(__dirname, "src", "himnarios", "himnarioCala.json");
    const rawCala = JSON.parse(fs.readFileSync(calaPath, "utf-8"));
    himarioCala = convertirCala(rawCala);
    console.log(`📖 Cargados ${himarioCala.length} himnos del Himnario Cala.`);
} catch (error) {
    console.error("❌ Error al cargar himnarioCala.json:", error);
}

// Cargar Himnario Iglesia de Dios
let himnarioIglesiaDeDios = [];
try {
    const iddPath = path.join(__dirname, "src", "himnarios", "himnosIglesiaDeDios.json");
    const rawIDD = JSON.parse(fs.readFileSync(iddPath, "utf-8"));
    himnarioIglesiaDeDios = convertirIglesiaDeDios(Array.isArray(rawIDD) ? rawIDD : []);
    console.log(`⛪ Cargados ${himnarioIglesiaDeDios.length} himnos del Himnario Iglesia de Dios.`);
} catch (error) {
    console.error("❌ Error al cargar himnosIglesiaDeDios.json:", error);
}

// ==================== LÍNEAS PERSONALIZADAS ====================
// Archivo para persistir ediciones de líneas por cántico
// En EXE de pkg, usar una ruta escribible junto al ejecutable
const lineasOverridePath = process.pkg
    ? path.join(path.dirname(process.execPath), "lineas-override.json")
    : path.join(__dirname, "src", "himnarios", "lineas-override.json");
let lineasOverride = {};

try {
    if (fs.existsSync(lineasOverridePath)) {
        lineasOverride = JSON.parse(fs.readFileSync(lineasOverridePath, "utf-8"));
        console.log(`✏️  Cargadas ediciones de líneas para ${Object.keys(lineasOverride).length} cántico(s).`);
    }
} catch (e) {
    console.error("❌ Error al cargar lineas-override.json:", e);
    lineasOverride = {};
}

function guardarLineasOverride() {
    fs.writeFile(lineasOverridePath, JSON.stringify(lineasOverride, null, 2), "utf-8", (err) => {
        if (err) console.error("❌ Error al guardar lineas-override.json:", err);
    });
}

// ==================== COROS PERSONALIZADOS ====================
const corosOverridePath = process.pkg
    ? path.join(path.dirname(process.execPath), "coros-override.json")
    : path.join(__dirname, "src", "himnarios", "coros-override.json");
let corosOverride = {};

try {
    if (fs.existsSync(corosOverridePath)) {
        corosOverride = JSON.parse(fs.readFileSync(corosOverridePath, "utf-8"));
        console.log(`🎶  Cargados coros personalizados para ${Object.keys(corosOverride).length} cántico(s).`);
    }
} catch (e) {
    console.error("❌ Error al cargar coros-override.json:", e);
    corosOverride = {};
}

function guardarCorosOverride() {
    fs.writeFile(corosOverridePath, JSON.stringify(corosOverride, null, 2), "utf-8", (err) => {
        if (err) console.error("❌ Error al guardar coros-override.json:", err);
    });
}

// Función para dividir un cántico en líneas individuales (para el modo por líneas)
function dividirEnLineas(cantico) {
    const key = cantico.titulo;
    // Si hay override guardado, usarlo
    if (lineasOverride[key]) {
        return lineasOverride[key];
    }
    // Generar desde la letra completa
    const texto = cantico.letraCompleta || (cantico.estrofas || []).map(e => e.texto).join('\n');
    return texto
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map((l, i) => ({ id: i + 1, texto: l, seleccionada: true }));
}

// Helper para normalizar texto (quitar tildes y mayúsculas)
function normalizarTexto(texto) {
    return texto
        ? texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : "";
}

// Servir la carpeta de assets externos PRIMERO (escribible, junto al exe o en public/assets)
// Esto tiene prioridad sobre los assets embebidos en el EXE
app.use("/assets", express.static(ASSETS_DIR));

// En EXE de pkg, servir los assets embebidos bajo /assets/embedded
if (process.pkg) {
    const assetsEmbebidos = path.join(__dirname, 'public', 'assets');
    app.use("/assets/embedded", express.static(assetsEmbebidos));
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(morgan("dev"));


// ==================== CONFIGURACIÓN DE IP LOCAL ====================

// Obtener IP local — usa network-manager si está disponible, sino fallback propio
function obtenerIPLocal() {
    // Si fue invocado desde launcher.js, usar la IP que él detectó
    if (process.env.CHURCH_IP && process.env.CHURCH_IP !== 'localhost') {
        return process.env.CHURCH_IP;
    }
    // Si network-manager está disponible, usarlo
    if (networkManager) {
        return networkManager.obtenerIPLocal();
    }
    // Fallback propio (comportamiento original)
    const interfaces = os.networkInterfaces();
    for (const nombre of Object.keys(interfaces)) {
        for (const iface of interfaces[nombre]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const ipLocal = obtenerIPLocal();
const puerto = process.env.CHURCH_PORT ? parseInt(process.env.CHURCH_PORT) : 3000;

// ==================== VARIABLES GLOBALES ====================

// Almacenar la última búsqueda para mostrar en pantalla
let ultimaBusqueda = {
    texto: '',
    resultados: [],
    tipo: null,
    timestamp: null
};

// ==================== INICIO DEL SERVIDOR ====================

server.listen(puerto, () => {
    console.log("\n" + "=".repeat(70));
    console.log("✅ SERVIDOR INICIADO CORRECTAMENTE");
    console.log("=".repeat(70));
    console.log("\n  ACCESO LOCAL:");
    console.log(`   • http://localhost:${puerto}`);
    console.log(`   • http://127.0.0.1:${puerto}`);
    console.log(`   • http://${ipLocal}:${puerto}`);
    console.log("\ URLS DISPONIBLES:");
    console.log(`    Controlador (Búsqueda): http://${ipLocal}:${puerto}`);
    console.log(`    Pantalla (Display): http://${ipLocal}:${puerto}/pantalla`);
    console.log(`    App Completa (Biblia+Himnos): http://${ipLocal}:${puerto}/app`);
    console.log(`    Admin Cánticos: http://${ipLocal}:${puerto}/canticosadmin`);
    console.log(`    Pantalla Cánticos: http://${ipLocal}:${puerto}/canticospantalla`);
    console.log("\n ACCESO REMOTO (desde celular en mismo WiFi):");
    console.log(`   • http://${ipLocal}:${puerto}`);
    console.log("\n  INFORMACIÓN DEL SISTEMA:");
    console.log(`   • IP Local: ${ipLocal}`);
    console.log(`   • Puerto: ${puerto}`);
    console.log(`   • Node.js: ${process.version}`);
    console.log("\n" + "=".repeat(70) + "\n");
});

// ==================== SOCKET.IO CONFIGURACIÓN ====================
let ultimoCanticoProyectado = null;
let fondoActual = "/fondo_defecto.PNG";

// Navegación de versículos (anterior/siguiente)
let ultimoVersiculo = null;

io.on("connection", (socket) => {
    // Actualizar contador de dispositivos
    dispositivosConectados++;
    io.emit("dispositivos-actualizados", { total: dispositivosConectados });

    // Si ya hay un cántico proyectado en esta sesión, lo enviamos al cliente recién conectado
    if (ultimoCanticoProyectado) {
        socket.emit("cambio-estrofa", ultimoCanticoProyectado);
    }

    // Enviar el fondo actual
    socket.emit("cambiar-fondo", fondoActual);

    // Enviar el último versículo proyectado si existe
    if (ultimoVersiculo) {
        socket.emit("proyectar-versiculo", ultimoVersiculo);
    }

    socket.on("cambio-estrofa", (data) => {
        ultimoCanticoProyectado = data;
        io.emit("cambio-estrofa", data);
    });

    socket.on("cambiar-pantalla", (targetUrl) => {
        io.emit("cambiar-pantalla", targetUrl);
    });

    socket.on("cambiar-fondo", (url) => {
        fondoActual = url;
        io.emit("cambiar-fondo", url);
    });

    // Evento para proyectar un versículo específico desde el control
    socket.on("proyectar-versiculo", (data) => {
        ultimoVersiculo = data;
        io.emit("proyectar-versiculo", data);
    });

    // Evento para navegar versículos (anterior/siguiente)
    socket.on("navegar-versiculo", (direccion) => {
        io.emit("navegar-versiculo", direccion);
    });

    // Evento para limpiar la pantalla (quitar versículo o terminar canto)
    socket.on("limpiar-pantalla", (data) => {
        if (data && data.tipo === 'versiculo') {
            ultimoVersiculo = null;
            ultimaBusqueda = { texto: '', resultados: [], tipo: null, timestamp: null };
        } else if (data && data.tipo === 'cantico') {
            ultimoCanticoProyectado = null;
        }
        // Resetear fondo al por defecto
        fondoActual = "/fondo_defecto.PNG";
        io.emit("cambiar-fondo", fondoActual);
        io.emit("limpiar-pantalla", data);
    });

    socket.on("disconnect", () => {
        dispositivosConectados = Math.max(0, dispositivosConectados - 1);
        io.emit("dispositivos-actualizados", { total: dispositivosConectados });
    });
});

// ==================== RUTAS HTML ====================

// Panel de estado del sistema
app.get("/panel", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "panel.html"));
});

// Página principal (Controlador)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// App completa (Versículos + Himnos)
app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "app.html"));
});

// Página de pantalla (Display para el salón)
app.get("/pantalla", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pantalla.html"));
});

// Ruta del administrador de cánticos
app.get("/canticosadmin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "canticosadmin.html"));
});

// Ruta de la pantalla de proyección de cánticos
app.get("/canticospantalla", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "canticospantalla.html"));
});

// Endpoint para obtener los fondos dinámicamente desde el directorio de assets
app.get("/api/fondos", (req, res) => {
    // Leer fondos del directorio escribible (ASSETS_DIR)
    const leerFondosDir = (dir) => {
        if (!fs.existsSync(dir)) return [];
        try {
            const files = fs.readdirSync(dir);
            const extensionesValidas = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".jfif", ".mp4"];
            return files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return extensionesValidas.includes(ext) && file.toLowerCase() !== "logo.png";
                })
                .map(file => ({
                    url: `assets/${file}`,
                    nombre: file.replace(/\.[^.]+$/, ''),
                    tipo: [".mp4"].includes(path.extname(file).toLowerCase()) ? 'video' :
                        [".gif"].includes(path.extname(file).toLowerCase()) ? 'gif' : 'imagen'
                }));
        } catch (e) {
            console.error("Error al leer directorio de fondos:", e);
            return [];
        }
    };

    let fondos = leerFondosDir(ASSETS_DIR);

    // Si estamos en EXE, también intentar leer desde public/assets embebido (de solo lectura)
    if (process.pkg) {
        try {
            const assetsEmbebidos = path.join(__dirname, 'public', 'assets');
            const archivosEmbebidos = fs.readdirSync(assetsEmbebidos);
            const extensionesValidas = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".jfif", ".mp4"];
            const fondosEmbebidos = archivosEmbebidos
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return extensionesValidas.includes(ext) && file.toLowerCase() !== "logo.png";
                })
                .map(file => ({
                    url: `assets/embedded/${file}`,
                    nombre: file.replace(/\.[^.]+$/, '') + ' (embebido)',
                    tipo: [".mp4"].includes(path.extname(file).toLowerCase()) ? 'video' :
                        [".gif"].includes(path.extname(file).toLowerCase()) ? 'gif' : 'imagen'
                }));
            // Combinar, evitando duplicados por nombre
            const nombresExistentes = new Set(fondos.map(f => f.nombre));
            fondosEmbebidos.forEach(f => {
                if (!nombresExistentes.has(f.nombre)) fondos.push(f);
            });
        } catch (e) { /* ignorar si no hay assets embebidos */ }
    }

    res.json(fondos);
});

// ==================== API DE LÍNEAS POR CÁNTICO ====================

// Obtener líneas de un cántico (con overrides si existen)
app.get("/api/canticos/:titulo/lineas", (req, res) => {
    const titulo = decodeURIComponent(req.params.titulo);
    const cantico = cancionero.find(c => c.titulo === titulo);
    if (!cantico) {
        return res.status(404).json({ error: 'Cántico no encontrado' });
    }
    const lineas = dividirEnLineas(cantico);
    res.json({ titulo, lineas, tieneOverride: !!lineasOverride[titulo] });
});

// Guardar líneas personalizadas para un cántico
app.post("/api/canticos/:titulo/lineas", (req, res) => {
    const titulo = decodeURIComponent(req.params.titulo);
    const { lineas } = req.body;
    if (!Array.isArray(lineas)) {
        return res.status(400).json({ error: 'Se esperaba un array de líneas' });
    }
    lineasOverride[titulo] = lineas;
    guardarLineasOverride();
    res.json({ exito: true, titulo, totalLineas: lineas.length });
});

// Restaurar líneas originales (eliminar override)
app.delete("/api/canticos/:titulo/lineas", (req, res) => {
    const titulo = decodeURIComponent(req.params.titulo);
    if (lineasOverride[titulo]) {
        delete lineasOverride[titulo];
        guardarLineasOverride();
    }
    const cantico = cancionero.find(c => c.titulo === titulo);
    if (!cantico) {
        return res.status(404).json({ error: 'Cántico no encontrado' });
    }
    const lineas = dividirEnLineas(cantico);
    res.json({ exito: true, titulo, lineas });
});

// ==================== API DE CÁNTICOS ====================

app.get("/api/canticos", (req, res) => {
    const query = req.query.q;
    const fuente = req.query.fuente || 'coros'; // 'coros' | 'cala' | 'iglesiadedios'

    let coleccion;
    if (fuente === 'cala') coleccion = himarioCala;
    else if (fuente === 'iglesiadedios') coleccion = himnarioIglesiaDeDios;
    else coleccion = cancionero;

    if (!query || query.trim() === '') {
        return res.json(coleccion);
    }
    const normalizedQuery = normalizarTexto(query);
    const resultados = coleccion.filter(cantico => {
        if (!cantico) return false;
        const tituloNorm = normalizarTexto(cantico.titulo || "");
        if (tituloNorm.includes(normalizedQuery)) return true;
        if (cantico.numero && String(cantico.numero).startsWith(query.trim())) return true;
        if (cantico.estrofas && Array.isArray(cantico.estrofas)) {
            return cantico.estrofas.some(est => normalizarTexto(est.texto || "").includes(normalizedQuery));
        }
        return false;
    }).map(cantico => {
        if (corosOverride[cantico.titulo]) {
            const canticoCopy = JSON.parse(JSON.stringify(cantico));
            if (canticoCopy.estrofas) {
                canticoCopy.estrofas.forEach((est, idx) => {
                    est.tipo = corosOverride[canticoCopy.titulo].includes(idx) ? 'coro' : 'estrofa';
                });
            }
            return canticoCopy;
        }
        return cantico;
    });
    res.json(resultados);
});

// Guardar coros personalizados para un cántico
app.post("/api/canticos/:titulo/coros", (req, res) => {
    const titulo = decodeURIComponent(req.params.titulo);
    const { corosIndices } = req.body;
    if (!Array.isArray(corosIndices)) {
        return res.status(400).json({ error: 'Se esperaba un array corosIndices' });
    }
    corosOverride[titulo] = corosIndices;
    guardarCorosOverride();
    res.json({ exito: true, titulo, corosIndices });
});

// ==================== SUBIR FONDO ====================
app.post("/api/subir-fondo", upload.single('fondo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    const url = `assets/${req.file.filename}`;
    const nombre = path.basename(req.file.filename, path.extname(req.file.filename));
    console.log(`🖼️  Fondo subido: ${req.file.filename}`);
    res.json({ exito: true, url, nombre, tipo: 'imagen' });
});

// ==================== API DE VERSÍCULOS ====================

// Búsqueda inteligente de versículos
app.post("/buscar", (req, res) => {
    const { busqueda } = req.body;

    if (!busqueda || busqueda.trim() === '') {
        return res.status(400).json({
            error: true,
            mensaje: 'Debes escribir algo para buscar'
        });
    }

    const resultado = buscador.buscarInteligente(busqueda);

    // Guardar la búsqueda para que pantalla.html la muestre
    ultimaBusqueda = {
        texto: busqueda.trim(),
        resultados: resultado.resultados || [],
        tipo: resultado.tipo,
        timestamp: new Date().toISOString()
    };

    res.json({
        exito: true,
        busqueda: busqueda.trim(),
        ...resultado
    });
});

// Obtener la última búsqueda (para pantalla.html)
app.get("/api/ultima-busqueda", (req, res) => {
    res.json(ultimaBusqueda);
});

// Predicción/autocompletado (como Google)
app.post("/predicciones", (req, res) => {
    const { texto } = req.body;

    if (!texto || texto.trim() === '') {
        return res.json({ predicciones: [] });
    }

    const predicciones = buscador.obtenerPredicciones(texto);

    res.json({
        exito: true,
        predicciones: predicciones
    });
});

// Obtener versículo anterior
app.post("/api/versiculo-anterior", (req, res) => {
    const { libro, capitulo, versiculo } = req.body;

    if (!libro || !capitulo || !versiculo) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const verso = buscador.obtenerVersiculoAnterior(libro, capitulo, versiculo);
    const info = verso ? buscador.obtenerInfoNavegacion(verso.libro, verso.capitulo, verso.versiculo) : null;

    res.json({
        exito: !!verso,
        verso,
        navegacion: info
    });
});

// Obtener versículo siguiente
app.post("/api/versiculo-siguiente", (req, res) => {
    const { libro, capitulo, versiculo } = req.body;

    if (!libro || !capitulo || !versiculo) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const verso = buscador.obtenerVersiculoSiguiente(libro, capitulo, versiculo);
    const info = verso ? buscador.obtenerInfoNavegacion(verso.libro, verso.capitulo, verso.versiculo) : null;

    res.json({
        exito: !!verso,
        verso,
        navegacion: info
    });
});

// Obtener información de navegación de versículos
app.post("/api/info-navegacion", (req, res) => {
    const { libro, capitulo, versiculo } = req.body;

    if (!libro || !capitulo || !versiculo) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const info = buscador.obtenerInfoNavegacion(libro, capitulo, versiculo);
    res.json({
        exito: !!info,
        navegacion: info
    });
});

// ==================== API DE HIMNOS ====================

// Buscar himnos
app.post("/api/buscar-himnos", (req, res) => {
    const { busqueda } = req.body;

    if (!busqueda || busqueda.trim() === '') {
        return res.status(400).json({
            error: true,
            mensaje: 'Debes escribir algo para buscar'
        });
    }

    const resultados = himnos.buscarHimnos(busqueda);
    res.json({
        exito: true,
        resultados
    });
});

// Obtener estrofas de un himno
app.get("/api/himno/:himnario/:numero", (req, res) => {
    const { himnario, numero } = req.params;

    const resultado = himnos.obtenerEstrofas(himnario, numero);

    if (!resultado) {
        return res.status(404).json({
            error: true,
            mensaje: 'Himno no encontrado'
        });
    }

    res.json({
        exito: true,
        ...resultado
    });
});

// Obtener estrofa específica
app.get("/api/himno/:himnario/:numero/:indiceEstrofa", (req, res) => {
    const { himnario, numero, indiceEstrofa } = req.params;

    const resultado = himnos.obtenerEstrofa(himnario, numero, parseInt(indiceEstrofa));

    if (!resultado) {
        return res.status(404).json({
            error: true,
            mensaje: 'Estrofa no encontrada'
        });
    }

    res.json({
        exito: true,
        ...resultado
    });
});

// ==================== API INFORMACIÓN ====================

// Obtener índice de libros
app.get("/api/libros", (req, res) => {
    const indice = buscador.cargarIndice();
    res.json({
        exito: true,
        total: indice.length,
        libros: indice.map(libro => ({
            nombre: libro.shortTitle,
            abreviatura: libro.abbr,
            capitulos: libro.chapters || 0,
            versiculos: libro.verses || 0
        }))
    });
});

// Obtener información del servidor
app.get("/api/info", (req, res) => {
    res.json({
        servidor: 'church-utils',
        version: '2.0.0',
        ipLocal: obtenerIPLocal(),
        puerto: puerto,
        urls: {
            panel: `http://${obtenerIPLocal()}:${puerto}/panel`,
            controlador: `http://${obtenerIPLocal()}:${puerto}`,
            pantalla: `http://${obtenerIPLocal()}:${puerto}/pantalla`,
            canticosadmin: `http://${obtenerIPLocal()}:${puerto}/canticosadmin`,
            canticospantalla: `http://${obtenerIPLocal()}:${puerto}/canticospantalla`
        }
    });
});

// ==================== API PANEL DE ESTADO ====================

// Estado completo del sistema
app.get("/api/estado", (req, res) => {
    const ipActual = obtenerIPLocal();
    let estadoRed = {
        tipo: 'desconocido',
        nombre: '',
        ip: ipActual,
        hotspotActivo: false,
        hotspotSSID: '',
        sistemaOperativo: os.release()
    };

    if (networkManager) {
        const nm = networkManager.detectarRed();
        estadoRed = { ...nm, ip: ipActual };
    }

    res.json({
        servidor: 'activo',
        version: '2.0.0',
        ip: ipActual,
        puerto: puerto,
        nodeVersion: process.version,
        red: estadoRed,
        dispositivosConectados,
        iglesia: appConfig ? appConfig.iglesia : { nombre: 'Iglesia Vida Nueva', lema: '' },
        hotspotInstrucciones: null
    });
});

// Códigos QR del sistema
app.get("/api/qr", async (req, res) => {
    const ipActual = obtenerIPLocal();
    if (!qrGenerator) {
        return res.json({});
    }
    try {
        const qrs = await qrGenerator.generarTodosLosQR(ipActual, puerto);
        res.json(qrs);
    } catch (e) {
        console.error('Error generando QR:', e);
        res.json({});
    }
});

// Leer configuración
app.get("/api/config", (req, res) => {
    if (appConfig) {
        return res.json(appConfig);
    }
    // Config por defecto si no existe
    res.json({
        hotspot: { ssid: 'IGLESIA_VIDA_NUEVA', password: 'VidaNueva2026' },
        servidor: { puerto: 3000, abrirNavegador: true },
        iglesia: { nombre: 'Iglesia Vida Nueva', lema: '' }
    });
});

// Guardar configuración
app.post("/api/config", (req, res) => {
    try {
        const cfgPath = path.join(__dirname, "config.json");
        const nueva = req.body;

        // Leer config actual para no perder campos no enviados
        let actual = appConfig || {};
        if (nueva.hotspot) actual.hotspot = { ...actual.hotspot, ...nueva.hotspot };
        if (nueva.iglesia) actual.iglesia = { ...actual.iglesia, ...nueva.iglesia };
        if (nueva.servidor) actual.servidor = { ...actual.servidor, ...nueva.servidor };

        fs.writeFileSync(cfgPath, JSON.stringify(actual, null, 2), 'utf-8');
        appConfig = actual;

        res.json({ exito: true });
    } catch (e) {
        console.error('Error guardando config:', e);
        res.status(500).json({ exito: false, error: e.message });
    }
});
// Monitor de RAM solo en modo desarrollo (no en modo launcher)
if (!process.env.CHURCH_LAUNCHER) {
    setInterval(() => {
        const memoria = process.memoryUsage();
        console.log("RAM:", {
            rss: Math.round(memoria.rss / 1024 / 1024) + " MB",
            heapUsed: Math.round(memoria.heapUsed / 1024 / 1024) + " MB",
            heapTotal: Math.round(memoria.heapTotal / 1024 / 1024) + " MB"
        });
    }, 30000);
}