/**
 * network-manager.js
 * ──────────────────────────────────────────────────────────────────
 * Módulo de gestión de red para el sistema de proyección de iglesias.
 *
 * Funcionalidades:
 *   • Detecta interfaces de red activas (Wi-Fi, Ethernet, Hotspot)
 *   • Obtiene la IP local de la interfaz activa
 *   • Crea un punto de acceso Wi-Fi vía netsh (Windows 7/10/11)
 *   • Monitorea cambios de red (polling)
 *   • Emite callbacks cuando la IP cambia
 * ──────────────────────────────────────────────────────────────────
 */

const os = require("os");
const { execSync, exec } = require("child_process");

// ── Estado interno ─────────────────────────────────────────────────
let estadoRed = {
  tipo: "desconocido",       // 'wifi' | 'ethernet' | 'hotspot' | 'desconocido'
  nombre: "",                // nombre de la red / SSID
  ip: "localhost",
  gateway: "",
  hotspotActivo: false,
  hotspotSSID: "",
  adaptadorSoportaHosted: null, // null = no verificado
  sistemaOperativo: "",
  error: null
};

let monitorInterval = null;
let ultimaIP = "";

// ── Detectar versión de Windows ────────────────────────────────────
function detectarSO() {
  const release = os.release(); // e.g. "10.0.19041"
  const major = parseInt(release.split(".")[0], 10);
  const build = parseInt(release.split(".")[2] || "0", 10);

  if (major >= 10 && build >= 22000) return "Windows 11";
  if (major >= 10) return "Windows 10";
  if (major === 6 && parseInt(release.split(".")[1], 10) === 1) return "Windows 7";
  return `Windows (${release})`;
}

// ── Obtener IP local (mejor interfaz disponible) ───────────────────
function obtenerIPLocal() {
  const interfaces = os.networkInterfaces();
  let mejorIP = null;
  let prioridadActual = -1;

  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (iface.family !== "IPv4" || iface.internal) continue;

      let prioridad = 0;
      const nombreLower = nombre.toLowerCase();

      // Prioridad: Hotspot/AP > Ethernet > Wi-Fi > Otros
      if (iface.address.startsWith("192.168.137.")) {
        prioridad = 4; // Hotspot de Windows (IP típica)
      } else if (nombreLower.includes("ethernet") || nombreLower.includes("local")) {
        prioridad = 3;
      } else if (nombreLower.includes("wi-fi") || nombreLower.includes("wifi") || nombreLower.includes("wlan")) {
        prioridad = 2;
      } else {
        prioridad = 1;
      }

      if (prioridad > prioridadActual) {
        prioridadActual = prioridad;
        mejorIP = iface.address;
      }
    }
  }

  return mejorIP || "localhost";
}

// ── Detectar tipo de red activa ────────────────────────────────────
function detectarTipoRed() {
  const interfaces = os.networkInterfaces();
  const ip = obtenerIPLocal();

  if (ip === "localhost") {
    return { tipo: "desconocido", nombre: "Sin red", ip };
  }

  // Buscar la interfaz que tiene esta IP
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (iface.address === ip) {
        const nombreLower = nombre.toLowerCase();

        if (ip.startsWith("192.168.137.")) {
          return { tipo: "hotspot", nombre: nombre, ip };
        }
        if (nombreLower.includes("ethernet") || nombreLower.includes("local area")) {
          return { tipo: "ethernet", nombre: nombre, ip };
        }
        if (nombreLower.includes("wi-fi") || nombreLower.includes("wifi") || nombreLower.includes("wlan")) {
          return { tipo: "wifi", nombre: nombre, ip };
        }
        return { tipo: "red", nombre: nombre, ip };
      }
    }
  }

  return { tipo: "desconocido", nombre: "Desconocido", ip };
}

// ── Obtener nombre de la red Wi-Fi conectada ───────────────────────
function obtenerNombreWiFi() {
  try {
    const resultado = execSync("netsh wlan show interfaces", {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true
    });

    const match = resultado.match(/\s+SSID\s+:\s+(.+)/);
    if (match) return match[1].trim();
  } catch (e) {
    // No hay adaptador Wi-Fi o comando no disponible
  }
  return "";
}

// ── Verificar si el adaptador soporta Hosted Network ───────────────
function verificarSoporteHostedNetwork() {
  try {
    const resultado = execSync("netsh wlan show drivers", {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true
    });

    // Buscar "Hosted network supported" o "Red hospedada admitida"
    const soportado =
      /hosted network supported\s*:\s*yes/i.test(resultado) ||
      /red hospedada admitida\s*:\s*s[ií]/i.test(resultado) ||
      /hosted network supported\s*:\s*s[ií]/i.test(resultado);

    return soportado;
  } catch (e) {
    return false;
  }
}

// ── Crear punto de acceso Wi-Fi ────────────────────────────────────
function crearHotspot(ssid, password) {
  const resultado = {
    exito: false,
    ip: "",
    mensaje: "",
    requiereAdmin: false,
    instrucciones: null
  };

  // Verificar soporte
  const soportado = verificarSoporteHostedNetwork();
  estadoRed.adaptadorSoportaHosted = soportado;

  if (!soportado) {
    resultado.mensaje = "El adaptador Wi-Fi no soporta la creación de redes hospedadas (Hosted Network).";
    resultado.instrucciones = [
      "Tu adaptador Wi-Fi no soporta la función 'Hosted Network'.",
      "",
      "Alternativas:",
      "1. En Windows 10/11: Ve a Configuración → Red → Zona con cobertura inalámbrica móvil y actívalo manualmente.",
      "2. Conecta todos los dispositivos a la misma red Wi-Fi del router.",
      "3. Usa un cable Ethernet para la PC y conecta los celulares al Wi-Fi del mismo router."
    ];
    return resultado;
  }

  try {
    // Configurar la red
    execSync(
      `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`,
      { encoding: "utf-8", timeout: 10000, windowsHide: true }
    );

    // Iniciar la red
    execSync("netsh wlan start hostednetwork", {
      encoding: "utf-8",
      timeout: 10000,
      windowsHide: true
    });

    // Esperar un momento para que la interfaz obtenga IP
    // La IP típica del hotspot de Windows es 192.168.137.1
    // Esperamos hasta 5 segundos
    let ipHotspot = "";
    for (let intento = 0; intento < 10; intento++) {
      const sleepMs = 500;
      const start = Date.now();
      while (Date.now() - start < sleepMs) { /* busy wait */ }

      const ip = obtenerIPLocal();
      if (ip.startsWith("192.168.137.")) {
        ipHotspot = ip;
        break;
      }
    }

    if (!ipHotspot) {
      ipHotspot = "192.168.137.1"; // IP por defecto del hotspot de Windows
    }

    resultado.exito = true;
    resultado.ip = ipHotspot;
    resultado.mensaje = `Punto de acceso "${ssid}" creado exitosamente.`;

    estadoRed.hotspotActivo = true;
    estadoRed.hotspotSSID = ssid;
    estadoRed.ip = ipHotspot;
    estadoRed.tipo = "hotspot";
    estadoRed.nombre = ssid;

    return resultado;

  } catch (e) {
    const errorMsg = (e.stderr || e.message || "").toString();

    if (errorMsg.includes("elevat") || errorMsg.includes("administrador") || errorMsg.includes("denied")) {
      resultado.requiereAdmin = true;
      resultado.mensaje = "Se requieren permisos de administrador para crear el punto de acceso.";
      resultado.instrucciones = [
        "Para crear el punto de acceso Wi-Fi automáticamente:",
        "",
        "1. Cierra esta aplicación.",
        "2. Haz clic derecho sobre el archivo .exe",
        "3. Selecciona 'Ejecutar como administrador'.",
        "4. La red se creará automáticamente.",
        "",
        "Alternativa sin administrador:",
        "• En Windows 10/11: Ve a Configuración → Red → Zona con cobertura inalámbrica móvil."
      ];
    } else {
      resultado.mensaje = "Error al crear el punto de acceso: " + errorMsg.substring(0, 200);
      resultado.instrucciones = [
        "No se pudo crear el punto de acceso Wi-Fi automáticamente.",
        "",
        "Alternativas:",
        "1. Ejecuta la aplicación como administrador.",
        "2. En Windows 10/11: Activa la 'Zona con cobertura inalámbrica móvil' manualmente.",
        "3. Conecta todos los dispositivos a la misma red Wi-Fi."
      ];
    }

    return resultado;
  }
}

// ── Detener punto de acceso ────────────────────────────────────────
function detenerHotspot() {
  try {
    execSync("netsh wlan stop hostednetwork", {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true
    });
    estadoRed.hotspotActivo = false;
    estadoRed.hotspotSSID = "";
    return { exito: true, mensaje: "Punto de acceso detenido." };
  } catch (e) {
    return { exito: false, mensaje: "Error al detener el hotspot: " + e.message };
  }
}

// ── Detectar estado completo de la red ─────────────────────────────
function detectarRed() {
  const tipoRed = detectarTipoRed();
  const ip = tipoRed.ip;
  const nombreWiFi = obtenerNombreWiFi();
  const soporte = verificarSoporteHostedNetwork();

  estadoRed = {
    tipo: tipoRed.tipo,
    nombre: tipoRed.tipo === "wifi" ? (nombreWiFi || tipoRed.nombre) : tipoRed.nombre,
    ip: ip,
    gateway: "",
    hotspotActivo: tipoRed.tipo === "hotspot",
    hotspotSSID: tipoRed.tipo === "hotspot" ? (nombreWiFi || "Hotspot") : "",
    adaptadorSoportaHosted: soporte,
    sistemaOperativo: detectarSO(),
    error: null
  };

  return { ...estadoRed };
}

// ── Monitorear cambios de red ──────────────────────────────────────
function monitorearRed(callback, intervaloMs = 10000) {
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  ultimaIP = obtenerIPLocal();

  monitorInterval = setInterval(() => {
    const nuevaIP = obtenerIPLocal();

    if (nuevaIP !== ultimaIP) {
      ultimaIP = nuevaIP;

      // Re-detectar estado completo
      const nuevoEstado = detectarRed();

      if (typeof callback === "function") {
        callback(nuevoEstado);
      }
    }
  }, intervaloMs);

  return monitorInterval;
}

// ── Detener monitoreo ──────────────────────────────────────────────
function detenerMonitoreo() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

// ── Obtener estado actual ──────────────────────────────────────────
function obtenerEstadoRed() {
  return { ...estadoRed };
}

// ── Verificar si hay alguna red disponible ─────────────────────────
function hayRedDisponible() {
  const ip = obtenerIPLocal();
  return ip !== "localhost";
}

// ── Exports ────────────────────────────────────────────────────────
module.exports = {
  detectarRed,
  crearHotspot,
  detenerHotspot,
  obtenerIPLocal,
  monitorearRed,
  detenerMonitoreo,
  obtenerEstadoRed,
  hayRedDisponible,
  detectarSO,
  verificarSoporteHostedNetwork,
  obtenerNombreWiFi
};
