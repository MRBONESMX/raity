const mapasActivos = {};

async function verificarSesion() {
    try {
        const respuesta = await fetch('/api/usuarios/sesion');
        if (!respuesta.ok) {
            window.location.href = '/index.html';
            return null;
        }
        const datos = await respuesta.json();
        return datos.usuario;
    } catch (error) {
        const usuarioGuardado = localStorage.getItem('raity_usuario');
        if (usuarioGuardado) {
            return JSON.parse(usuarioGuardado);
        }
        window.location.href = '/index.html';
        return null;
    }
}

function obtenerIniciales(nombreCompleto) {
    if (!nombreCompleto) {
        return 'U';
    }
    const partes = nombreCompleto.trim().split(' ');
    if (partes.length >= 2) {
        return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }
    return nombreCompleto.substring(0, 2).toUpperCase();
}

function mostrarMensaje(idContenedor, texto) {
    const caja = document.getElementById(idContenedor);
    if (!caja) {
        return;
    }
    caja.textContent = texto;
    caja.classList.add('visible');
}

function ocultarMensaje(idContenedor) {
    const caja = document.getElementById(idContenedor);
    if (!caja) {
        return;
    }
    caja.textContent = '';
    caja.classList.remove('visible');
}

function mostrarAvisoProximamente(nombreFuncion) {
    let fondoModal = document.getElementById('modal-proximamente');

    if (!fondoModal) {
        fondoModal = document.createElement('div');
        fondoModal.id = 'modal-proximamente';
        fondoModal.className = 'modal-fondo';
        fondoModal.innerHTML =
            '<div class="modal-caja">' +
            '<h3 class="modal-titulo">Próximamente</h3>' +
            '<p id="texto-modal-proximamente" class="modal-texto"></p>' +
            '<button type="button" id="boton-cerrar-proximamente" class="boton boton-principal">Entendido</button>' +
            '</div>';
        document.body.appendChild(fondoModal);

        const botonCerrar = document.getElementById('boton-cerrar-proximamente');
        botonCerrar.addEventListener('click', function () {
            fondoModal.classList.remove('visible');
        });
    }

    const parrafoTexto = document.getElementById('texto-modal-proximamente');
    parrafoTexto.textContent =
        'La función "' + nombreFuncion + '" estará disponible en la próxima actualización de Raity.';
    fondoModal.classList.add('visible');
}

function dibujarRutaEnMapa(idContenedor, latOrigen, lonOrigen, latDestino, lonDestino, opciones) {
    if (typeof L === 'undefined') {
        return null;
    }
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) {
        return null;
    }

    if (mapasActivos[idContenedor]) {
        mapasActivos[idContenedor].remove();
    }

    const configuracion = opciones || {};
    const origenLat = Number(latOrigen);
    const origenLon = Number(lonOrigen);
    const destinoLat = Number(latDestino);
    const destinoLon = Number(lonDestino);

    const mapa = L.map(idContenedor, {
        zoomControl: configuracion.conControles !== false,
        dragging: configuracion.interactivo !== false,
        scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(mapa);

    const marcadorOrigen = L.circleMarker([origenLat, origenLon], {
        radius: 7,
        color: '#07B5D5',
        fillColor: '#07B5D5',
        fillOpacity: 1
    }).addTo(mapa);

    const marcadorDestino = L.circleMarker([destinoLat, destinoLon], {
        radius: 7,
        color: '#16A672',
        fillColor: '#16A672',
        fillOpacity: 1
    }).addTo(mapa);

    if (configuracion.textoOrigen) {
        marcadorOrigen.bindPopup('Origen: ' + configuracion.textoOrigen);
    }
    if (configuracion.textoDestino) {
        marcadorDestino.bindPopup('Destino: ' + configuracion.textoDestino);
    }

    const colorLinea = configuracion.esVioleta ? '#A754F5' : '#07B5D5';
    const lineaRuta = L.polyline(
        [
            [origenLat, origenLon],
            [destinoLat, destinoLon]
        ],
        { color: colorLinea, weight: 4 }
    ).addTo(mapa);

    mapa.fitBounds(lineaRuta.getBounds(), { padding: [25, 25] });
    setTimeout(function () {
        mapa.invalidateSize();
        mapa.fitBounds(lineaRuta.getBounds(), { padding: [25, 25] });
    }, 100);
    mapasActivos[idContenedor] = mapa;
    return mapa;
}

function iconoEstrellaSvg() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="#E2AD00"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
}

function iconoCorazonVioletaSvg() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="#A754F5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
}

function iconoAutoSvg() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E7E7E" stroke-width="2"><path d="M5 11l2-5h10l2 5"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
}

function iconoRelojSvg() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E7E7E" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
}

function inicializarBarraConexion() {
    const barra = document.getElementById('barra-sin-conexion');
    if (!barra) {
        return;
    }

    function actualizarEstado() {
        if (navigator.onLine) {
            barra.classList.remove('visible');
        } else {
            barra.classList.add('visible');
        }
    }

    actualizarEstado();
    window.addEventListener('online', actualizarEstado);
    window.addEventListener('offline', actualizarEstado);
}

document.addEventListener('DOMContentLoaded', inicializarBarraConexion);
