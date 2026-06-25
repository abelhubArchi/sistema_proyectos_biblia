
    // Initializing Sockets and states
    var socket;
    try {
      socket = io();
    } catch (e) {
      console.warn("Socket.io no disponible", e);
      socket = { emit: function () { }, on: function () { } };
    }

    // Redirigir automáticamente la pantalla de proyección a cánticos
    socket.emit("cambiar-pantalla", "/canticospantalla");

    function irABuscador() {
      socket.emit("cambiar-pantalla", "/pantalla");
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    }

    function terminarCanto() {
      socket.emit("limpiar-pantalla", { tipo: 'cantico' });
      projectedSongTitle = "";
      projectedVerseIndex = -1;
      updateProjectedUI();
    }

    var songs = [];
    var activeSong = null;
    var selectedVerseIndex = 0;
    var projectedSongTitle = "";
    var projectedVerseIndex = -1;
    var fuenteActual = 'coros'; // 'coros' | 'cala' | 'iglesiadedios'
    let isMixMode = false;
    let currentMix = [];
    let carpetaActual = 'todas';

    // Cambiar fuente/himnario
    function cambiarFuente(fuente, carpeta = 'todas', btn = null) {
      fuenteActual = fuente;
      carpetaActual = carpeta;
      
      // Actualizar tabs visualmente
      document.querySelectorAll('.himnario-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      if (btn) {
        btn.classList.add('active');
      } else {
        // Fallback for direct calls
        const defaultBtn = document.querySelector(`.himnario-tab[data-carpeta="${carpeta}"]`) || document.querySelector('.himnario-tab');
        if (defaultBtn) defaultBtn.classList.add('active');
      }
      // Limpiar búsqueda
      document.getElementById('search-input').value = '';
      loadSongs();
    }

    // Sockets status updates
    socket.on('connect', () => {
      const statusBadge = document.getElementById('connection-status');
      const statusText = document.getElementById('connection-text');
      statusBadge.classList.remove('disconnected');
      statusText.textContent = "Conectado a Socket.IO";
    });

    socket.on('disconnect', () => {
      const statusBadge = document.getElementById('connection-status');
      const statusText = document.getElementById('connection-text');
      statusBadge.classList.add('disconnected');
      statusText.textContent = "Desconectado";
    });

    // Listen to changes from other clients to synchronize admin state if needed
    socket.on('cambio-estrofa', (data) => {
      projectedSongTitle = data.titulo;
      projectedVerseIndex = data.estrofaActual - 1;
      updateProjectedUI();
    });

    // Load initial songs list
    async function loadSongs(query = "") {
      try {
        const response = await fetch(`/api/canticos?fuente=${encodeURIComponent(fuenteActual)}&carpeta=${encodeURIComponent(carpetaActual)}&q=${encodeURIComponent(query)}`);
        songs = await response.json();
        renderSongList();
      } catch (err) {
        console.error("Error al cargar cánticos:", err);
      }
    }

    // Render song list in sidebar
    function renderSongList() {
      const listContainer = document.getElementById('song-list');
      if (songs.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted)">No se encontraron cánticos</div>';
        return;
      }

      listContainer.innerHTML = songs.map((song, index) => {
        const isActive = activeSong && activeSong.titulo === song.titulo;
        const totalEstrofas = song.estrofas ? song.estrofas.length : 0;
        const numBadge = song.numero ? `<span class="numero-badge">#${song.numero}</span>` : '';
        return `
          <div class="song-card ${isActive ? 'active' : ''}" onclick="selectSong(${index})">
            <div class="song-card-title">${numBadge}${song.titulo}</div>
            <div class="song-card-meta">
              <span class="tone-badge">${song.tono || 'Sin tono'}</span>
              <span>${totalEstrofas} ${totalEstrofas === 1 ? 'sección' : 'secciones'}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Handle search input with simple debounce
    var searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadSongs(e.target.value);
      }, 300);
    });

    // Select song
    function selectSong(index) {
      if (isMixMode) {
        currentMix.push(songs[index]);
        renderMixList();
        return;
      }
      activeSong = songs[index];
      iniciarControlCantico();
    }

    function toggleModoMix() {
      isMixMode = !isMixMode;
      const btn = document.getElementById('btn-toggle-mix');
      const panel = document.getElementById('mix-panel');
      if (isMixMode) {
        btn.style.background = 'var(--gold)';
        btn.style.color = 'var(--bg-dark)';
        panel.style.display = 'block';
        currentMix = [];
        renderMixList();
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--gold)';
        panel.style.display = 'none';
      }
    }

    function renderMixList() {
      const list = document.getElementById('mix-list');
      if (currentMix.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 4px;">Haz clic en los cánticos para añadirlos al Mix.</div>';
        return;
      }
      list.innerHTML = currentMix.map((song, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding: 6px 8px; border-radius:4px;">
          <span>${i+1}. ${song.titulo}</span>
          <button onclick="event.stopPropagation(); quitarDelMix(${i})" style="background:none; border:none; color:var(--danger); cursor:pointer;">❌</button>
        </div>
      `).join('');
    }

    function quitarDelMix(index) {
      currentMix.splice(index, 1);
      renderMixList();
    }

    function cargarMix() {
      if (currentMix.length === 0) return;
      
      // Construir un cántico virtual combinando estrofas
      let estrofasCombinadas = [];
      currentMix.forEach(song => {
        if (song.estrofas) {
          song.estrofas.forEach(est => {
            estrofasCombinadas.push({
              ...est,
              tituloOriginal: song.titulo // Para mostrar de qué canción viene
            });
          });
        }
      });

      activeSong = {
        titulo: "Mix: " + currentMix.map(s => s.titulo).join(" + "),
        tono: currentMix[0].tono || '',
        numero: null,
        fuente: 'mix',
        estrofas: estrofasCombinadas,
        letraCompleta: estrofasCombinadas.map(e => e.texto).join('\n')
      };
      
      toggleModoMix(); // Cerrar modo mix
      iniciarControlCantico();
    }

    function iniciarControlCantico() {
      selectedVerseIndex = 0;
      modoActual = 'estrofas';
      lineasCantico = [];

      renderSongList();

      document.body.classList.remove('view-list');
      document.body.classList.add('view-control');

      const controlArea = document.getElementById('control-area');
      controlArea.innerHTML = `
        <div class="song-header">
          <div class="song-title-group" style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div>
              <h1>${activeSong.titulo}</h1>
              <p>${activeSong.numero ? `#${activeSong.numero} · ` : ''}Tono: ${activeSong.tono || 'No especificado'} · Secciones: ${activeSong.estrofas.length}</p>
            </div>
            ${activeSong.fuente === 'opensong' ? `
              <button class="btn btn-secondary" onclick="abrirModalEditarCantico()">✏️ Editar Cántico</button>
            ` : ''}
          </div>
        </div>

        <div class="mode-tabs">
          <button class="mode-tab active" data-modo="estrofas" onclick="cambiarModo('estrofas')">Por Estrofas</button>
          <button class="mode-tab" data-modo="lineas" onclick="cambiarModo('lineas')">Por Líneas</button>
        </div>

        <div class="control-workspace">
          <div class="verses-list-container" id="verses-list">
          </div>

          <div class="preview-pane" id="preview-pane">
            <div class="preview-header">
              <span>Vista Previa (Proyector)</span>
              <span id="preview-live-badge" style="color: var(--danger); font-weight: 700; display: none;">⬤ En Vivo</span>
            </div>
            <div class="preview-screen">
              <div class="preview-song-title" id="preview-song-title">${activeSong.titulo}</div>
              <div class="preview-lyrics" id="preview-lyrics">${activeSong.estrofas[selectedVerseIndex].texto}</div>
              <div class="preview-indicator" id="preview-indicator">Sección ${selectedVerseIndex + 1} de ${activeSong.estrofas.length}</div>
            </div>
          </div>
        </div>

        <div class="control-actions">
          <div class="control-buttons-left">
            <button class="btn btn-secondary" onclick="prevVerse()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Anterior [←]
            </button>
            <button class="btn btn-secondary" onclick="nextVerse()">
              Siguiente [→]
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
          <button class="btn btn-live" onclick="projectActiveVerse()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            PROYECTAR [Enter]
          </button>
          <div class="shortcuts-help">
            <span>Atajos: <span class="key-badge">←</span> Anterior</span>
            <span><span class="key-badge">→</span> Siguiente</span>
            <span><span class="key-badge">Enter</span> Proyectar</span>
          </div>
        </div>
      `;
      renderEstrofasView();
      document.getElementById('verses-list').scrollTop = 0;
      cargarLineas(activeSong.titulo);

      // Proyectar solo el título automáticamente al seleccionar
      socket.emit("cambio-estrofa", {
        titulo: activeSong.titulo,
        soloTitulo: true,
        texto: '',
        tono: activeSong.tono || ''
      });
      projectedSongTitle = activeSong.titulo;
      projectedVerseIndex = -1; // Ninguna estrofa seleccionada en vivo
      updateProjectedUI();
    }

    // Select specific verse in workspace (without projecting)
    function selectVerse(index) {
      if (!activeSong) return;
      const isAlreadySelected = (selectedVerseIndex === index);
      selectedVerseIndex = index;

      // Update selected class in DOM list
      const cards = document.querySelectorAll('.verse-card');
      cards.forEach((c, idx) => {
        if (idx === index) {
          c.classList.add('selected');
        } else {
          c.classList.remove('selected');
        }
      });

      // Update lyrics in preview
      const previewLyrics = document.getElementById('preview-lyrics');
      const previewIndicator = document.getElementById('preview-indicator');
      if (previewLyrics) previewLyrics.innerHTML = activeSong.estrofas[index].texto.replace(/\n/g, '<br>');
      if (previewIndicator) {
        const est = activeSong.estrofas[index];
        const esCoro = est.tipo === 'coro';
        previewIndicator.textContent = esCoro ? '🎶 Coro' : `Sección ${index + 1} de ${activeSong.estrofas.length}`;
      }

      // Update preview border status if selected is the projected one
      const previewPane = document.getElementById('preview-pane');
      const liveBadge = document.getElementById('preview-live-badge');
      const isProjectedActive = projectedSongTitle === activeSong.titulo && projectedVerseIndex === index;

      if (previewPane && liveBadge) {
        if (isProjectedActive) {
          previewPane.classList.add('live-active');
          liveBadge.style.display = 'inline';
        } else {
          previewPane.classList.remove('live-active');
          liveBadge.style.display = 'none';
        }
      }

      // Si se hace tap/click por segunda vez en la misma estrofa, se proyecta inmediatamente
      // PROYECTA SOLO ESTA ESTROFA ignorando la selección múltiple (Doble tap/click)
      if (isAlreadySelected) {
        const estrofa = activeSong.estrofas[index];
        const payload = {
          titulo: activeSong.titulo,
          estrofaActual: index + 1,
          totalEstrofas: activeSong.estrofas.length,
          texto: estrofa.texto,
          esCoro: estrofa.tipo === 'coro',
          fuente: activeSong.fuente || 'coros',
          tono: activeSong.tono || ''
        };
        socket.emit("cambio-estrofa", payload);
        projectedSongTitle = activeSong.titulo;
        projectedVerseIndex = index;
        updateProjectedUI();
      }
    }

    // Project currently selected verse (original — sobrescrita por la nueva versión de arriba)
    function projectActiveVerse_UNUSED() {
      if (!activeSong) return;

      const payload = {
        titulo: activeSong.titulo,
        estrofaActual: selectedVerseIndex + 1,
        totalEstrofas: activeSong.estrofas.length,
        texto: activeSong.estrofas[selectedVerseIndex].texto
      };

      socket.emit("cambio-estrofa", payload);

      projectedSongTitle = activeSong.titulo;
      projectedVerseIndex = selectedVerseIndex;

      updateProjectedUI();
    }

    // Update the UI styling to show which verse is currently projected
    function updateProjectedUI() {
      if (!activeSong) return;

      const cards = document.querySelectorAll('.verse-card');
      cards.forEach((c, idx) => {
        const isProjected = (projectedSongTitle === activeSong.titulo && projectedVerseIndex === idx);
        if (isProjected) {
          c.classList.add('projected');
        } else {
          c.classList.remove('projected');
        }
      });

      // Update preview container class and live badge
      const previewPane = document.getElementById('preview-pane');
      const liveBadge = document.getElementById('preview-live-badge');
      if (previewPane && liveBadge) {
        const isProjectedActive = projectedSongTitle === activeSong.titulo && projectedVerseIndex === selectedVerseIndex;
        if (isProjectedActive) {
          previewPane.classList.add('live-active');
          liveBadge.style.display = 'inline';
        } else {
          previewPane.classList.remove('live-active');
          liveBadge.style.display = 'none';
        }
      }
    }

    // Navigation methods
    function nextVerse() {
      if (!activeSong) return;
      if (selectedVerseIndex < activeSong.estrofas.length - 1) {
        selectVerse(selectedVerseIndex + 1);
        scrollToSelectedVerse();
      }
    }

    function prevVerse() {
      if (!activeSong) return;
      if (selectedVerseIndex > 0) {
        selectVerse(selectedVerseIndex - 1);
        scrollToSelectedVerse();
      }
    }

    function scrollToSelectedVerse() {
      const selectedCard = document.getElementById(`verse-card-${selectedVerseIndex}`);
      if (selectedCard) {
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore key events when inside search input
      if (document.activeElement === document.getElementById('search-input')) {
        if (e.key === 'Enter') {
          // If hit enter inside search, blur it and select first match
          document.getElementById('search-input').blur();
          const firstCard = document.querySelector('.song-card');
          if (firstCard) {
            firstCard.click();
          }
        }
        return;
      }

      if (!activeSong) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextVerse();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevVerse();
          break;
        case 'Enter':
          e.preventDefault();
          projectActiveVerse();
          break;
      }
    });

    // ══════════════════════════════════════════════════════════════════
    // SISTEMA DE LÍNEAS
    // ══════════════════════════════════════════════════════════════════
    var modoActual = 'estrofas'; // 'estrofas' | 'lineas'
    var lineasCantico = [];      // Array de { id, texto, seleccionada }
    var tieneOverride = false;
    var saveTimeout = null;

    // Proyectar versículo activo (compatible con ambos modos)
    function projectActiveVerse() {
      if (!activeSong) return;

      if (modoActual === 'lineas') {
        const seleccionadas = lineasCantico.filter(l => l.seleccionada);
        if (seleccionadas.length === 0) {
          alert('No hay líneas seleccionadas para proyectar.');
          return;
        }
        const texto = seleccionadas.map(l => l.texto).join('\n');
        const payload = {
          titulo: activeSong.titulo,
          estrofaActual: 'Líneas',
          totalEstrofas: null,
          texto,
          tono: activeSong.tono || ''
        };
        socket.emit("cambio-estrofa", payload);
        projectedSongTitle = activeSong.titulo;
        projectedVerseIndex = -1;
        updateProjectedUI();
      } else {
        // Modo estrofas
        const indicesSeleccionados = activeSong.estrofas.map((e, i) => e.seleccionada ? i : -1).filter(i => i !== -1);
        
        if (indicesSeleccionados.length > 1) {
          const texto = indicesSeleccionados.map(i => activeSong.estrofas[i].texto).join('\n\n');
          const payload = {
            titulo: activeSong.titulo,
            estrofaActual: 'Múltiple',
            totalEstrofas: null,
            texto: texto,
            esCoro: false,
            fuente: activeSong.fuente || 'coros',
            tono: activeSong.tono || ''
          };
          socket.emit("cambio-estrofa", payload);
          projectedSongTitle = activeSong.titulo;
          projectedVerseIndex = indicesSeleccionados[0]; // Marcar la primera estrofa seleccionada como activa para el UI
          updateProjectedUI();
        } else {
          // Normal individual selection
          const idxAProyectar = indicesSeleccionados.length === 1 ? indicesSeleccionados[0] : selectedVerseIndex;
          const estrofa = activeSong.estrofas[idxAProyectar];
          const payload = {
            titulo: activeSong.titulo,
            estrofaActual: idxAProyectar + 1,
            totalEstrofas: activeSong.estrofas.length,
            texto: estrofa.texto,
            esCoro: estrofa.tipo === 'coro',
            fuente: activeSong.fuente || 'coros',
            tono: activeSong.tono || ''
          };
          socket.emit("cambio-estrofa", payload);
          projectedSongTitle = activeSong.titulo;
          projectedVerseIndex = idxAProyectar;
          updateProjectedUI();
          if (idxAProyectar !== selectedVerseIndex) selectVerse(idxAProyectar);
        }
      }
    }

    function cambiarModo(modo) {
      modoActual = modo;
      document.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.modo === modo);
      });
      if (modo === 'estrofas') {
        renderEstrofasView();
      } else {
        if (lineasCantico.length === 0) {
          cargarLineas(activeSong.titulo).then(() => renderLineasView());
        } else {
          renderLineasView();
        }
      }
    }

    async function cargarLineas(titulo) {
      try {
        const res = await fetch(`/api/canticos/${encodeURIComponent(titulo)}/lineas`);
        const data = await res.json();
        lineasCantico = data.lineas || [];
        tieneOverride = data.tieneOverride || false;
      } catch (e) {
        console.error('Error cargando líneas:', e);
        lineasCantico = [];
      }
    }

    async function guardarLineas() {
      if (!activeSong) return;
      try {
        await fetch(`/api/canticos/${encodeURIComponent(activeSong.titulo)}/lineas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineas: lineasCantico })
        });
        tieneOverride = true;
        mostrarSaveStatus();
      } catch (e) { console.error('Error guardando líneas:', e); }
    }

    function autoGuardar() {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(guardarLineas, 800);
    }

    function mostrarSaveStatus() {
      const el = document.getElementById('save-status-lines');
      if (!el) return;
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 2500);
    }

    async function restaurarLineas() {
      if (!activeSong) return;
      if (!confirm('¿Restaurar las líneas originales del cántico? Se perderán los cambios guardados.')) return;
      try {
        const res = await fetch(`/api/canticos/${encodeURIComponent(activeSong.titulo)}/lineas`, {
          method: 'DELETE'
        });
        const data = await res.json();
        lineasCantico = data.lineas || [];
        tieneOverride = false;
        renderLineasView();
      } catch (e) { console.error('Error restaurando:', e); }
    }

    async function toggleCoro(index) {
      if (!activeSong) return;
      const estrofa = activeSong.estrofas[index];
      estrofa.tipo = estrofa.tipo === 'coro' ? 'estrofa' : 'coro';
      renderEstrofasView();
      if (selectedVerseIndex === index) {
        selectVerse(index);
      }

      // Guardar permanentemente en el backend
      const corosIndices = activeSong.estrofas
        .map((est, idx) => est.tipo === 'coro' ? idx : -1)
        .filter(idx => idx !== -1);

      try {
        await fetch(`/api/canticos/${encodeURIComponent(activeSong.titulo)}/coros`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ corosIndices })
        });
        mostrarSaveStatus(); // opcional, muestra feedback visual si existe
      } catch (err) {
        console.error("Error guardando coros:", err);
      }
    }

    function toggleEstrofa(index, checked) {
      activeSong.estrofas[index].seleccionada = checked;
      // Actualizar vista previa
      const seleccionadas = activeSong.estrofas.filter(e => e.seleccionada);
      const previewLyrics = document.getElementById('preview-lyrics');
      const previewIndicator = document.getElementById('preview-indicator');
      if (seleccionadas.length > 1) {
         if (previewLyrics) previewLyrics.innerHTML = seleccionadas.map(e => e.texto.replace(/\n/g, '<br>')).join('<br><br>');
         if (previewIndicator) previewIndicator.textContent = `Múltiples secciones seleccionadas`;
      } else {
         selectVerse(selectedVerseIndex);
      }
    }

    function renderEstrofasView() {
      const versesListEl = document.getElementById('verses-list');
      if (!versesListEl || !activeSong) return;
      
      let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.78rem;color:var(--text-muted)">${activeSong.estrofas.length} secciones</span>
          ${activeSong.fuente !== 'mix' ? `<div class="save-status" id="save-status-estrofas">✓ Guardado permanentemente</div>` : ''}
        </div>
      </div>`;

      html += activeSong.estrofas.map((est, i) => {
        const esCoro = est.tipo === 'coro';
        const origenBadge = est.tituloOriginal ? `<span style="font-size:0.6rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:10px; color:var(--text-muted); margin-right:8px;">${est.tituloOriginal}</span>` : '';
        
        return `
          <div class="verse-card ${i === selectedVerseIndex ? 'selected' : ''} ${esCoro ? 'coro-card' : ''}" id="verse-card-${i}">
            <div class="verse-number">
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="line-check" ${est.seleccionada ? 'checked' : ''} onchange="toggleEstrofa(${i}, this.checked)" title="Seleccionar para proyección múltiple">
                <span onclick="selectVerse(${i})" style="cursor:pointer;">${esCoro ? '🎶 Coro' : `Estrofa ${i + 1}`}</span>
                ${origenBadge}
                ${activeSong.fuente !== 'mix' ? `<button class="btn btn-secondary" style="padding: 2px 6px; font-size: 0.65rem; height:auto;" onclick="event.stopPropagation(); toggleCoro(${i})">${esCoro ? 'Quitar Coro' : 'Marcar Coro'}</button>
                <button class="btn btn-secondary btn-edit-estrofa" style="padding: 2px 6px; font-size: 0.65rem; height:auto; color: var(--gold); border-color: rgba(226, 196, 117, 0.4);" onclick="event.stopPropagation(); editarEstrofa(${i})">✏️ Editar Texto</button>` : ''}
              </div>
              ${esCoro ? `<span class="coro-badge" onclick="selectVerse(${i})" style="cursor:pointer;">CORO</span>` : `<span class="live-indicator" onclick="selectVerse(${i})" style="cursor:pointer;">EN VIVO</span>`}
            </div>
            <div class="verse-content" id="estrofa-text-${i}" onclick="selectVerse(${i})">${est.texto}</div>
          </div>
        `;
      }).join('');
      versesListEl.innerHTML = html;
      updateProjectedUI();
    }

    function editarEstrofa(index) {
      const textEl = document.getElementById(`estrofa-text-${index}`);
      if (!textEl) return;
      const lineaOriginal = activeSong.estrofas[index].texto;
      const textarea = document.createElement('textarea');
      textarea.className = 'line-text-input';
      textarea.style.minHeight = '100px';
      textarea.style.resize = 'vertical';
      textarea.style.width = '100%';
      textarea.style.fontSize = '1.05rem';
      textarea.style.lineHeight = '1.5';
      textarea.value = lineaOriginal;
      
      // Detener propagación para evitar proyectar accidentalmente al hacer click en el textarea
      textarea.onclick = (e) => e.stopPropagation();
      textarea.ondblclick = (e) => e.stopPropagation();
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '8px';
      actionsDiv.style.marginTop = '8px';
      
      const btnSave = document.createElement('button');
      btnSave.className = 'btn btn-primary';
      btnSave.style.padding = '4px 12px';
      btnSave.style.fontSize = '0.8rem';
      btnSave.textContent = 'Guardar';
      btnSave.onclick = (e) => {
        e.stopPropagation();
        confirmar(textarea.value);
      };
      
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-secondary';
      btnCancel.style.padding = '4px 12px';
      btnCancel.style.fontSize = '0.8rem';
      btnCancel.textContent = 'Cancelar';
      btnCancel.onclick = (e) => {
        e.stopPropagation();
        restaurar();
      };
      
      actionsDiv.appendChild(btnSave);
      actionsDiv.appendChild(btnCancel);
      
      const container = document.createElement('div');
      container.appendChild(textarea);
      container.appendChild(actionsDiv);
      
      textEl.replaceWith(container);
      textarea.focus();

      const restaurar = () => {
         const div = document.createElement('div');
         div.className = 'verse-content';
         div.id = `estrofa-text-${index}`;
         div.textContent = lineaOriginal;
         container.replaceWith(div);
      };

      const confirmar = async (nuevoTexto) => {
        const textoReal = nuevoTexto.trim() || lineaOriginal;
        activeSong.estrofas[index].texto = textoReal;
        const div = document.createElement('div');
        div.className = 'verse-content';
        div.id = `estrofa-text-${index}`;
        div.textContent = textoReal;
        container.replaceWith(div);
        
        // Actualizar UI
        if (selectedVerseIndex === index) {
            selectVerse(index);
        }
        
        // Guardar permanentemente
        try {
            await fetch(`/api/canticos/${encodeURIComponent(activeSong.titulo)}/estrofas`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ estrofas: activeSong.estrofas })
            });
            const el = document.getElementById('save-status-estrofas');
            if (el) {
                el.classList.add('visible');
                setTimeout(() => el.classList.remove('visible'), 2500);
            }
        } catch (e) { console.error('Error guardando estrofas:', e); }
      };
    }


    function renderLineasView() {
      const versesListEl = document.getElementById('verses-list');
      if (!versesListEl || !activeSong) return;

      let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.78rem;color:var(--text-muted)">${lineasCantico.length} líneas</span>
          ${tieneOverride ? '<span class="override-badge">✏️ Editado</span>' : ''}
          <div class="save-status" id="save-status-lines">✓ Guardado</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${tieneOverride ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;height:auto;" onclick="restaurarLineas()">↺ Restaurar</button>` : ''}
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;height:auto;" onclick="seleccionarTodasLineas(true)">Sel. todas</button>
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;height:auto;" onclick="seleccionarTodasLineas(false)">Ninguna</button>
        </div>
      </div>`;

      html += lineasCantico.map((linea, i) => `
        <div class="line-card ${linea.seleccionada ? 'selected' : ''}" id="line-card-${i}">
          <input type="checkbox" class="line-check"
            ${linea.seleccionada ? 'checked' : ''}
            onchange="toggleLinea(${i}, this.checked)"
            title="Seleccionar línea">
          <span class="line-number-badge">Línea ${i + 1}</span>
          <span class="line-text" id="line-text-${i}" ondblclick="editarLinea(${i})">${linea.texto}</span>
          <div class="line-actions">
            <button class="btn-line-action" onclick="editarLinea(${i})" title="Editar">✏️</button>
            <button class="btn-line-action" onclick="agregarLineaAbajo(${i})" title="Agregar abajo">➕</button>
            <button class="btn-line-action danger" onclick="eliminarLinea(${i})" title="Eliminar">🗑️</button>
          </div>
        </div>
      `).join('');

      html += `<button class="btn-add-line" onclick="agregarLineaFinal()">➕ Agregar línea al final</button>`;

      versesListEl.innerHTML = html;
      actualizarVistaPrevia();
    }

    function toggleLinea(index, checked) {
      lineasCantico[index].seleccionada = checked;
      const card = document.getElementById(`line-card-${index}`);
      if (card) card.classList.toggle('selected', checked);
      actualizarVistaPrevia();
      autoGuardar();
    }

    function seleccionarTodasLineas(valor) {
      lineasCantico.forEach(l => l.seleccionada = valor);
      renderLineasView();
      autoGuardar();
    }

    function editarLinea(index) {
      const textEl = document.getElementById(`line-text-${index}`);
      if (!textEl) return;
      const lineaOriginal = lineasCantico[index].texto;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'line-text-input';
      input.value = lineaOriginal;
      textEl.replaceWith(input);
      input.focus();
      input.select();

      const confirmar = () => {
        const nuevoTexto = input.value.trim() || lineaOriginal;
        lineasCantico[index].texto = nuevoTexto;
        const span = document.createElement('span');
        span.className = 'line-text';
        span.id = `line-text-${index}`;
        span.textContent = nuevoTexto;
        span.ondblclick = () => editarLinea(index);
        input.replaceWith(span);
        actualizarVistaPrevia();
        autoGuardar();
      };

      input.addEventListener('blur', confirmar);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = lineaOriginal; input.blur(); }
        e.stopPropagation(); // No disparar atajos de teclado globales
      });
    }

    function agregarLineaAbajo(index) {
      const nuevaLinea = { id: Date.now(), texto: 'Nueva línea', seleccionada: true };
      lineasCantico.splice(index + 1, 0, nuevaLinea);
      renderLineasView();
      autoGuardar();
      setTimeout(() => editarLinea(index + 1), 50);
    }

    function agregarLineaFinal() {
      const nuevaLinea = { id: Date.now(), texto: 'Nueva línea', seleccionada: true };
      lineasCantico.push(nuevaLinea);
      renderLineasView();
      autoGuardar();
      setTimeout(() => editarLinea(lineasCantico.length - 1), 50);
    }

    function eliminarLinea(index) {
      if (lineasCantico.length <= 1) return;
      lineasCantico.splice(index, 1);
      renderLineasView();
      autoGuardar();
    }

    function actualizarVistaPrevia() {
      const previewLyrics = document.getElementById('preview-lyrics');
      const previewIndicator = document.getElementById('preview-indicator');
      if (!previewLyrics) return;

      if (modoActual === 'lineas') {
        const seleccionadas = lineasCantico.filter(l => l.seleccionada);
        previewLyrics.innerHTML = seleccionadas.map(l => l.texto).join('<br>');
        if (previewIndicator) {
          previewIndicator.textContent = `${seleccionadas.length} de ${lineasCantico.length} líneas seleccionadas`;
        }
      }
    }

    // Métodos para cambiar de vista en móvil
    function regresarALista() {
      document.body.classList.remove('view-control');
      document.body.classList.add('view-list');
    }

    // Métodos para control de fondos
    var fondosList = [];
    var fondoActualActivo = "assets/1.jpg";

    // Escuchar el fondo inicial o cambios de fondo de otros clientes
    try {
      var socket = io();
      socket.on("cambiar-fondo", (url) => {
        fondoActualActivo = url;
        actualizarFondoActivoUI();
      });
    } catch (e) { console.error("Socket error", e); }

    async function abrirFondoModal() {
      const modal = document.getElementById('fondo-modal');
      modal.classList.add('active');

      try {
        const response = await fetch('/api/fondos');
        fondosList = await response.json();
        renderFondosGrid();
      } catch (err) {
        console.error("Error al cargar los fondos:", err);
      }
    }

    function cerrarFondoModal() {
      const modal = document.getElementById('fondo-modal');
      modal.classList.remove('active');
    }

    function renderFondosGrid() {
      const grid = document.getElementById('fondos-grid');
      if (!grid) return;

      if (fondosList.length === 0) {
        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--text-muted)">No se encontraron fondos</div>';
        return;
      }

      grid.innerHTML = fondosList.map(fondo => {
        const url = fondo.url || fondo;
        const nombre = (fondo.nombre || url.split('/').pop().split('.').shift());
        const tipo = fondo.tipo || 'imagen';
        const isActivo = (url === fondoActualActivo || ('/' + url) === fondoActualActivo || url === ('/' + fondoActualActivo));
        return `
          <div class="fondo-item ${isActivo ? 'active' : ''}" style="background-image: url('/${url}')" onclick="seleccionarFondo('${url}')">
            <div class="fondo-name">${nombre}${tipo !== 'imagen' ? ' (' + tipo + ')' : ''}</div>
          </div>
        `;
      }).join('');
    }

    function seleccionarFondo(url) {
      fondoActualActivo = '/' + url;
      socket.emit("cambiar-fondo", '/' + url);
      actualizarFondoActivoUI();
      cerrarFondoModal();
    }

    function actualizarFondoActivoUI() {
      const items = document.querySelectorAll('.fondo-item');
      items.forEach(item => {
        const bgUrl = item.style.backgroundImage.replace(/url\(['"]\/?|['"]\)/g, '');
        const normActivo = fondoActualActivo.replace(/^\//, '');
        const normBgUrl = bgUrl.replace(/^\//, '');
        if (normBgUrl === normActivo) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('fondo-modal');
      if (e.target === modal) {
        cerrarFondoModal();
      }
    });

    // Función para subir un fondo desde archivo
    function triggerSubirFondo() {
      document.getElementById('subir-fondo-input').click();
    }

    async function subirFondoArchivo(input) {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('fondo', file);
      try {
        const res = await fetch('/api/subir-fondo', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.exito) {
          // Recargar lista de fondos y abrir modal
          await abrirFondoModal();
          // Auto seleccionar el fondo recién subido
          seleccionarFondo(data.url);
          alert(`✅ Fondo "${data.nombre}" subido exitosamente`);
        } else {
          alert('Error al subir el fondo: ' + (data.error || 'desconocido'));
        }
      } catch (e) {
        alert('Error de red al subir el fondo.');
        console.error(e);
      }
      // Reset input para permitir subir el mismo archivo otra vez
      input.value = '';
    }

    // =========================================================================
    // SNIPPET: PROYECTAR TEXTO SELECCIONADO (Fondo Azul)
    // =========================================================================
    const floatingBtn = document.createElement('button');
    floatingBtn.innerHTML = '📺 Proyectar Selección';
    floatingBtn.style.cssText = 'position: absolute; display: none; background: var(--accent); color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: bold; z-index: 9999; font-size: 14px; font-family: inherit; transition: all 0.2s;';
    floatingBtn.onmouseover = () => { floatingBtn.style.transform = 'scale(1.05)'; floatingBtn.style.background = 'var(--accent-hover)'; };
    floatingBtn.onmouseout = () => { floatingBtn.style.transform = 'scale(1)'; floatingBtn.style.background = 'var(--accent)'; };
    document.body.appendChild(floatingBtn);

    function handleSelection() {
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (text.length > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                floatingBtn.style.top = `${rect.top + window.scrollY - 55}px`;
                
                let left = rect.left + window.scrollX + (rect.width/2) - 80;
                if (left < 10) left = 10;
                
                floatingBtn.style.left = `${left}px`;
                floatingBtn.style.display = 'block';
            } else {
                floatingBtn.style.display = 'none';
            }
        }, 50);
    }

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    document.addEventListener('selectionchange', handleSelection);

    floatingBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Evitar deselección
    });

    floatingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = window.getSelection().toString().trim();
        if (text) {
            socket.emit("cambiar-pantalla", "/canticospantalla");
            socket.emit("cambio-estrofa", {
                titulo: "Selección",
                estrofaActual: "",
                totalEstrofas: "",
                texto: text,
                esCoro: false,
                fuente: "libre",
                tono: ""
            });
            
            const oldText = floatingBtn.innerHTML;
            floatingBtn.innerHTML = '✅ ¡Proyectado!';
            floatingBtn.style.background = 'var(--success)';
            setTimeout(() => {
                floatingBtn.innerHTML = oldText;
                floatingBtn.style.background = 'var(--accent)';
                floatingBtn.style.display = 'none';
                window.getSelection().removeAllRanges();
            }, 1500);
        }
    });

    // =========================================================================
    // LÓGICA PARA NUEVOS CÁNTICOS
    // =========================================================================
    function abrirModalNuevoCantico() {
      document.getElementById('nuevo-titulo').value = '';
      document.getElementById('nuevo-tono').value = '';
      document.getElementById('nuevo-letra').value = '';
      document.getElementById('nuevo-cantico-modal').style.display = 'flex';
    }

    function cerrarModalNuevoCantico() {
      document.getElementById('nuevo-cantico-modal').style.display = 'none';
    }

    async function guardarNuevoCantico() {
      const titulo = document.getElementById('nuevo-titulo').value.trim();
      const tono = document.getElementById('nuevo-tono').value.trim();
      const letraCompleta = document.getElementById('nuevo-letra').value.trim();

      if (!titulo || !letraCompleta) {
        alert('Por favor, ingresa el título y la letra del cántico.');
        return;
      }

      try {
        const response = await fetch('/api/canticos/nuevo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo, tono, letraCompleta })
        });
        
        const data = await response.json();
        if (data.exito) {
          cerrarModalNuevoCantico();
          alert('¡Cántico guardado correctamente!');
          
          // Refrescar y mostrar el canto recién agregado
          cambiarFuente('coros'); // Los nuevos van a coros
          document.getElementById('search-input').value = titulo;
          filterSongs(titulo);
        } else {
          alert('Error al guardar: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        console.error('Error:', err);
        alert('Error de conexión al intentar guardar.');
      }
    }

    // Cerrar modal si se hace clic fuera de él
    window.addEventListener('click', (e) => {
      const modalNuevo = document.getElementById('nuevo-cantico-modal');
      if (e.target === modalNuevo) {
        cerrarModalNuevoCantico();
      }
    });

    // Cargar carpetas dinámicamente
    async function cargarCarpetasOpenSong() {
      try {
        const response = await fetch('/api/carpetas-opensong');
        const carpetas = await response.json();
        
        const tabsContainer = document.getElementById('himnario-tabs');
        tabsContainer.innerHTML = ''; 
        
        // Botón "All"
        const allBtn = document.createElement('button');
        allBtn.className = 'himnario-tab active';
        allBtn.dataset.carpeta = 'todas';
        allBtn.textContent = '🌍 All (Todos)';
        allBtn.onclick = () => cambiarFuente('opensong', 'todas', allBtn);
        tabsContainer.appendChild(allBtn);
        
        // Botones por carpeta
        carpetas.forEach(carpeta => {
            if(carpeta === "Otras") return; // Omitir si quieres o mostrar
            const btn = document.createElement('button');
            btn.className = 'himnario-tab';
            btn.dataset.carpeta = carpeta;
            btn.textContent = '📁 ' + carpeta;
            btn.onclick = () => cambiarFuente('opensong', carpeta, btn);
            tabsContainer.appendChild(btn);
        });
        
        // Inicializar
        cambiarFuente('opensong', 'todas', allBtn);
      } catch (e) {
        console.error("Error al cargar carpetas:", e);
      }
    }

    // Editar cántico logic
    function abrirModalEditarCantico() {
        if(!activeSong) return;
        document.getElementById('edit-cantico-titulo').value = activeSong.titulo;
        document.getElementById('edit-cantico-letra').value = activeSong.estrofas.map(e => e.texto).join('\n\n');
        document.getElementById('editar-cantico-modal').style.display = 'flex';
    }

    function cerrarModalEditarCantico() {
        document.getElementById('editar-cantico-modal').style.display = 'none';
    }

    async function guardarEdicionCantico() {
        const nuevoTitulo = document.getElementById('edit-cantico-titulo').value.trim();
        const nuevaLetra = document.getElementById('edit-cantico-letra').value;
        
        if (!nuevoTitulo || !nuevaLetra) return alert("El título y la letra no pueden estar vacíos.");
        
        // Parsear letra en estrofas
        const parrafos = nuevaLetra.split(/\n\s*\n/);
        const nuevasEstrofas = parrafos.map((p, i) => {
            const texto = p.trim();
            // Intentar detectar si es coro u estrofa basado en el contenido o formato previo
            const tipo = texto.toLowerCase().startsWith('coro') ? 'coro' : 'estrofa';
            return {
                numero: i + 1,
                texto: texto,
                tipo: tipo
            };
        }).filter(e => e.texto.length > 0);

        const payload = {
            titulo: nuevoTitulo,
            estrofas: nuevasEstrofas
        };

        try {
            const res = await fetch('/api/canticos/' + encodeURIComponent(activeSong.titulo), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.exito) {
                // Actualizar activeSong en el frontend
                activeSong.titulo = data.cantico.titulo;
                activeSong.estrofas = data.cantico.estrofas;
                activeSong.letraCompleta = data.cantico.letraCompleta;
                activeSong.cantidadEstrofas = data.cantico.cantidadEstrofas;
                
                // Refrescar lista y UI
                loadSongs();
                iniciarControlCantico();
                cerrarModalEditarCantico();
            } else {
                alert("Error al guardar: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Hubo un error de conexión");
        }
    }

    // Initialize
    cargarCarpetasOpenSong();
  