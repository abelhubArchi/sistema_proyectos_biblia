const express = require("express");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const buscador = require("./src/buscador");

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(morgan("dev"));

// Almacenar la última búsqueda para mostrar en pantalla
let ultimaBusqueda = {
    texto: '',
    resultados: [],
    tipo: null,
    timestamp: null
};

app.listen(3000, () => {
    console.log("✅ Servidor iniciado en http://localhost:3000");
    console.log("🔍 Controlador: http://localhost:3000");
    console.log("📺 Pantalla: http://localhost:3000/pantalla");
});

// Página principal (Controlador)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Página de pantalla (Display para el salón)
app.get("/pantalla", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pantalla.html"));
});

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

// API: Obtener índice de libros (para referencia)
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
