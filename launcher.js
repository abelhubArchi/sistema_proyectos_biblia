/**
 * launcher.js
 * ──────────────────────────────────────────────────────────────────
 * Punto de entrada principal del sistema de proyección para iglesias.
 *
 * Secuencia de inicio:
 *   1. Cargar configuración desde config.json
 *   2. Detectar red disponible
 *   3. Si no hay red → intentar crear hotspot Wi-Fi
 *   4. Iniciar servidor Express + Socket.IO
 *   5. Generar códigos QR
 *   6. Abrir navegador predeterminado en el panel de estado
 *   7. Monitorear cambios de red
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");
const networkManager = require("./network-manager");
const qrGenerator = require("./qr-generator");

// ── Cargar configuración ───────────────────────────────────────────
// En EXE de pkg, __dirname es solo lectura; guardar config junto al ejecutable
const configPath = process.pkg
  ? path.join(path.dirname(process.execPath), "config.json")
  : path.join(__dirname, "config.json");
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  console.log(" Configuración cargada correctamente.");
} catch (e) {
  console.log("  No se encontró config.json, usando valores por defecto.");
  config = {
    hotspot: { ssid: "IGLESIA_VIDA_NUEVA", password: "VidaNueva2026" },
    servidor: { puerto: 3000, abrirNavegador: true },
    iglesia: { nombre: "Iglesia Vida Nueva", lema: "Una Iglesia Para Un Mundo Dividido" }
  };
  // Guardar config por defecto
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (we) { /* ignore write error */ }
}


// ── Función auxiliar para imprimir banner ───────────────────────────
function imprimirBanner(info) {
  const linea = "═".repeat(66);
  const sublnea = "─".repeat(66);

  console.log("\n" + linea);
  console.log("    SISTEMA DE PROYECCIÓN — " + config.iglesia.nombre.toUpperCase());
  console.log(linea);
  console.log("");
  console.log("   Estado de Red:");
  console.log("     Tipo:       " + info.tipo.toUpperCase());
  console.log("     Red:        " + (info.nombre || "N/A"));
  console.log("     IP Local:   " + info.ip);
  console.log("     SO:         " + info.sistemaOperativo);

  if (info.hotspotActivo) {
    console.log("");
    console.log("   Punto de Acceso:");
    console.log("     SSID:       " + info.hotspotSSID);
    console.log("     Contraseña: " + config.hotspot.password);
  }

  console.log("");
  console.log("  " + sublnea);
  console.log("   URLs Disponibles:");
  console.log("     Panel de Estado:         http://" + info.ip + ":" + config.servidor.puerto + "/panel");
  console.log("     Control de Versículos:   http://" + info.ip + ":" + config.servidor.puerto + "/");
  console.log("     Pantalla de Versículos:  http://" + info.ip + ":" + config.servidor.puerto + "/pantalla");
  console.log("     Control de Cánticos:     http://" + info.ip + ":" + config.servidor.puerto + "/canticosadmin");
  console.log("     Pantalla de Cánticos:    http://" + info.ip + ":" + config.servidor.puerto + "/canticospantalla");
  console.log("  " + sublnea);
  console.log("");
  console.log("   Escanea los códigos QR desde el panel para conectar celulares.");
  console.log("   Presiona Ctrl+C para detener el servidor.");
  console.log("");
  console.log(linea + "\n");
}

// ── Inicio principal ───────────────────────────────────────────────
async function iniciar() {
  console.log("\n Iniciando Sistema de Proyección para Iglesias...\n");

  // ─── Paso 1: Detectar red ─────────────────────────────────────────
  console.log(" Detectando red disponible...");
  let infoRed = networkManager.detectarRed();

  let hotspotResultado = null;

  if (!networkManager.hayRedDisponible()) {
    console.log("  No se detectó ninguna red disponible.");
    console.log(" Intentando crear punto de acceso Wi-Fi...");

    hotspotResultado = networkManager.crearHotspot(
      config.hotspot.ssid,
      config.hotspot.password
    );

    if (hotspotResultado.exito) {
      console.log("IP: " + hotspotResultado.mensaje);
      infoRed = networkManager.detectarRed(); // Actualizar estado
    } else {
      console.log("Error: " + hotspotResultado.mensaje);
      if (hotspotResultado.instrucciones) {
        console.log("");
        hotspotResultado.instrucciones.forEach(linea => console.log("   " + linea));
        console.log("");
      }
      // Seguir adelante con localhost
      infoRed = networkManager.detectarRed();
    }
  } else {
    console.log(" Red detectada: " + infoRed.tipo.toUpperCase() + " — " + infoRed.nombre);
    console.log("   IP: " + infoRed.ip);
  }

  // ─── Paso 2: Exportar info de red al servidor ─────────────────────
  // Establecer variables de entorno para que server.js las use
  process.env.CHURCH_IP = infoRed.ip;
  process.env.CHURCH_PORT = String(config.servidor.puerto);
  process.env.CHURCH_LAUNCHER = "true";

  // ─── Paso 3: Iniciar servidor ─────────────────────────────────────
  console.log(" Iniciando servidor Express + Socket.IO...");

  // Importar y ejecutar server.js (se inicia con server.listen)
  const serverModule = require("./server");

  // ─── Paso 4: Generar códigos QR ──────────────────────────────────
  console.log(" Generando códigos QR...");
  try {
    await qrGenerator.generarTodosLosQR(infoRed.ip, config.servidor.puerto);
    console.log(" Códigos QR generados correctamente.");
  } catch (e) {
    console.error("  Error generando códigos QR:", e.message);
  }

  // ─── Paso 5: Imprimir banner ──────────────────────────────────────
  imprimirBanner(infoRed);

  // ─── Paso 6: Abrir navegador ──────────────────────────────────────
  if (config.servidor.abrirNavegador) {
    const panelUrl = `http://${infoRed.ip === "localhost" ? "localhost" : infoRed.ip}:${config.servidor.puerto}/panel`;
    console.log(" Abriendo panel en el navegador...");

    try {
      // Dynamic import for ESM 'open' package
      const open = (await import("open")).default;
      await open(panelUrl);
    } catch (e) {
      // Fallback: usar start de Windows
      try {
        const { exec } = require("child_process");
        exec(`start "" "${panelUrl}"`);
      } catch (e2) {
        console.log("  No se pudo abrir el navegador automáticamente.");
        console.log("   Abre manualmente: " + panelUrl);
      }
    }
  }

  // ─── Paso 7: Monitorear cambios de red ────────────────────────────
  networkManager.monitorearRed(async (nuevoEstado) => {
    console.log("\n ¡Cambio de red detectado!");
    console.log("   Nueva IP: " + nuevoEstado.ip);
    console.log("   Tipo: " + nuevoEstado.tipo);

    // Regenerar QR codes
    qrGenerator.invalidarCache();
    await qrGenerator.generarTodosLosQR(nuevoEstado.ip, config.servidor.puerto);

    // Notificar a todos los clientes via Socket.IO
    if (serverModule && serverModule.getIO) {
      const io = serverModule.getIO();
      if (io) {
        io.emit("info-red-actualizada", {
          ip: nuevoEstado.ip,
          tipo: nuevoEstado.tipo,
          nombre: nuevoEstado.nombre,
          puerto: config.servidor.puerto
        });
      }
    }

    imprimirBanner(nuevoEstado);
  });

  // ─── Limpieza al cerrar ───────────────────────────────────────────
  process.on("SIGINT", () => {
    console.log("\n\n Cerrando servidor...");
    networkManager.detenerMonitoreo();

    if (infoRed.hotspotActivo) {
      console.log(" Deteniendo punto de acceso...");
      networkManager.detenerHotspot();
    }

    console.log(" ¡Hasta pronto! — " + config.iglesia.nombre);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    networkManager.detenerMonitoreo();
    if (infoRed.hotspotActivo) {
      networkManager.detenerHotspot();
    }
    process.exit(0);
  });
}

// ── Ejecutar ───────────────────────────────────────────────────────
iniciar().catch(err => {
  console.error("❌ Error fatal al iniciar el sistema:", err);
  process.exit(1);
});
