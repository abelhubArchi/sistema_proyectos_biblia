/**
 * qr-generator.js
 * ──────────────────────────────────────────────────────────────────
 * Genera códigos QR como strings SVG para cada URL del sistema.
 * Los QR se regeneran cuando la IP cambia.
 * ──────────────────────────────────────────────────────────────────
 */

const QRCode = require("qrcode");

// Cache de QR generados
let qrCache = {};
let ultimaIPUsada = "";

// Definir las rutas del sistema
const RUTAS = {
  principal: { path: "/", nombre: "Control de Versículos", descripcion: "Buscar y proyectar versículos bíblicos" },
  pantalla: { path: "/pantalla", nombre: "Pantalla de Versículos", descripcion: "Pantalla de proyección para versículos" },
  canticosadmin: { path: "/canticosadmin", nombre: "Control de Cánticos", descripcion: "Administrar y proyectar cánticos" },
  canticospantalla: { path: "/canticospantalla", nombre: "Pantalla de Cánticos", descripcion: "Pantalla de proyección para cánticos" },
  panel: { path: "/panel", nombre: "Panel de Estado", descripcion: "Panel de administración del sistema" }
};

/**
 * Genera un QR como string SVG
 * @param {string} url - URL completa
 * @returns {Promise<string>} - SVG como string
 */
async function generarQRSVG(url) {
  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 256,
      margin: 2,
      color: {
        dark: "#ffffff",
        light: "#00000000" // transparente
      },
      errorCorrectionLevel: "M"
    });
    return svg;
  } catch (error) {
    console.error("Error al generar QR para", url, ":", error.message);
    return "";
  }
}

/**
 * Genera todos los QR codes para el sistema
 * @param {string} ip - IP local del servidor
 * @param {number} puerto - Puerto del servidor
 * @returns {Promise<object>} - Objeto con todos los QR SVG
 */
async function generarTodosLosQR(ip, puerto) {
  const baseUrl = `http://${ip}:${puerto}`;

  // Si la IP no cambió, devolver cache
  if (ip === ultimaIPUsada && Object.keys(qrCache).length > 0) {
    return { ...qrCache };
  }

  ultimaIPUsada = ip;
  const qrs = {};

  for (const [clave, ruta] of Object.entries(RUTAS)) {
    const url = `${baseUrl}${ruta.path}`;
    const svg = await generarQRSVG(url);
    qrs[clave] = {
      svg,
      url,
      nombre: ruta.nombre,
      descripcion: ruta.descripcion,
      path: ruta.path
    };
  }

  qrCache = { ...qrs };
  return qrs;
}

/**
 * Invalida el cache (forzar regeneración en el próximo llamado)
 */
function invalidarCache() {
  qrCache = {};
  ultimaIPUsada = "";
}

/**
 * Obtiene los QR del cache sin regenerar
 */
function obtenerQRCache() {
  return { ...qrCache };
}

module.exports = {
  generarTodosLosQR,
  generarQRSVG,
  invalidarCache,
  obtenerQRCache,
  RUTAS
};
