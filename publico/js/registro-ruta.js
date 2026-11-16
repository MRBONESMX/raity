document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const pasoMapa = document.getElementById('paso-mapa-ruta');
    const pasoExito = document.getElementById('paso-exito-ruta');
    const campoNombreRuta = document.getElementById('ruta-nombre');
    const botonSalidaCentro = document.getElementById('boton-salida-centro');
    const botonDestinoUabcs = document.getElementById('boton-destino-uabcs');
    const botonLimpiar = document.getElementById('boton-limpiar-puntos');
    const botonGuardar = document.getElementById('boton-guardar-ruta');
    const textoEstadoPuntos = document.getElementById('texto-estado-puntos');

    let puntoOrigen = null;
    let puntoDestino = null;
    let marcadorOrigen = null;
    let marcadorDestino = null;
    let lineaRuta = null;

    const mapa = L.map('mapa-grabar-ruta').setView([24.115, -110.32], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(mapa);

    setTimeout(function () {
        mapa.invalidateSize();
    }, 100);

    function actualizarLineaYEstado() {
        if (lineaRuta) {
            mapa.removeLayer(lineaRuta);
            lineaRuta = null;
        }

        if (puntoOrigen && puntoDestino) {
            const origenActual = puntoOrigen;
            const destinoActual = puntoDestino;
            const puntosIniciales = generarCaminoVialLaPaz(
                origenActual.lat,
                origenActual.lng,
                destinoActual.lat,
                destinoActual.lng
            );

            lineaRuta = L.polyline(puntosIniciales, { color: '#057A91', weight: 4 }).addTo(mapa);
            const lineaActual = lineaRuta;
            mapa.fitBounds(lineaActual.getBounds(), { padding: [30, 30] });
            textoEstadoPuntos.textContent = 'Trazando el recorrido por las calles de La Paz...';

            obtenerGeometriaCalle(
                origenActual.lat,
                origenActual.lng,
                destinoActual.lat,
                destinoActual.lng
            ).then(function (puntosCalle) {
                if (lineaRuta === lineaActual && puntosCalle && puntosCalle.length >= 2) {
                    lineaActual.setLatLngs(puntosCalle);
                    mapa.fitBounds(lineaActual.getBounds(), { padding: [30, 30] });
                }
                if (puntoOrigen && puntoDestino) {
                    textoEstadoPuntos.textContent = 'Camino por calles trazado correctamente. Presiona Guardar ruta para finalizar.';
                }
            });
        } else if (puntoOrigen) {
            textoEstadoPuntos.textContent = 'Salida marcada. Ahora toca en el mapa o usa el botón para marcar el destino.';
        } else if (puntoDestino) {
            textoEstadoPuntos.textContent = 'Destino marcado. Ahora toca en el mapa o usa el botón para marcar la salida.';
        } else {
            textoEstadoPuntos.textContent = 'Toca en el mapa para marcar el punto de salida.';
        }
    }

    function colocarOrigen(coordenadas) {
        if (marcadorOrigen) {
            mapa.removeLayer(marcadorOrigen);
        }
        puntoOrigen = coordenadas;
        marcadorOrigen = L.circleMarker([coordenadas.lat, coordenadas.lng], {
            radius: 8,
            color: '#FFFFFF',
            weight: 2,
            fillColor: '#057A91',
            fillOpacity: 1
        }).addTo(mapa);
        marcadorOrigen.bindTooltip('Salida', { permanent: true, direction: 'top' });
        actualizarLineaYEstado();
    }

    function colocarDestino(coordenadas) {
        if (marcadorDestino) {
            mapa.removeLayer(marcadorDestino);
        }
        puntoDestino = coordenadas;
        marcadorDestino = L.circleMarker([coordenadas.lat, coordenadas.lng], {
            radius: 6,
            color: '#FFFFFF',
            weight: 2,
            fillColor: '#0F7652',
            fillOpacity: 1
        }).addTo(mapa);
        marcadorDestino.bindTooltip('Destino', { permanent: true, direction: 'top' });
        actualizarLineaYEstado();
    }

    function limpiarMapa() {
        if (marcadorOrigen) {
            mapa.removeLayer(marcadorOrigen);
        }
        if (marcadorDestino) {
            mapa.removeLayer(marcadorDestino);
        }
        if (lineaRuta) {
            mapa.removeLayer(lineaRuta);
        }
        puntoOrigen = null;
        puntoDestino = null;
        marcadorOrigen = null;
        marcadorDestino = null;
        lineaRuta = null;
        actualizarLineaYEstado();
    }

    mapa.on('click', function (evento) {
        ocultarMensaje('aviso-registro-ruta');
        const coordenadas = evento.latlng;
        if (!puntoOrigen) {
            colocarOrigen(coordenadas);
            return;
        }
        if (!puntoDestino) {
            colocarDestino(coordenadas);
        }
    });

    botonSalidaCentro.addEventListener('click', function () {
        ocultarMensaje('aviso-registro-ruta');
        colocarOrigen({ lat: 24.1422, lng: -110.3128 });
    });

    botonDestinoUabcs.addEventListener('click', function () {
        ocultarMensaje('aviso-registro-ruta');
        colocarDestino({ lat: 24.1027, lng: -110.3160 });
    });

    botonLimpiar.addEventListener('click', function () {
        ocultarMensaje('aviso-registro-ruta');
        limpiarMapa();
    });

    botonGuardar.addEventListener('click', async function () {
        limpiarErroresCampos(['ruta-nombre'], 'aviso-registro-ruta');
        const nombre = campoNombreRuta.value.trim();

        if (!nombre) {
            marcarErrorCampo('ruta-nombre', 'Escribe un nombre fácil de identificar para tu ruta.');
            mostrarMensaje('aviso-registro-ruta', 'Escribe el nombre de la ruta antes de guardarla.');
            campoNombreRuta.focus();
            return;
        }

        if (!puntoOrigen || !puntoDestino) {
            mostrarMensaje('aviso-registro-ruta', 'Debes marcar tanto el punto de salida como el de destino en el mapa.');
            return;
        }

        cambiarEstadoBoton(botonGuardar, true, 'Guardando ruta...');

        try {
            const respuesta = await fetch('/api/rutas-guardadas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    latitud_origen: Number(puntoOrigen.lat).toFixed(6),
                    longitud_origen: Number(puntoOrigen.lng).toFixed(6),
                    latitud_destino: Number(puntoDestino.lat).toFixed(6),
                    longitud_destino: Number(puntoDestino.lng).toFixed(6)
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-registro-ruta', datos.mensaje);
                cambiarEstadoBoton(botonGuardar, false);
                return;
            }

            pasoMapa.classList.add('formulario-oculto');
            pasoExito.classList.remove('formulario-oculto');
        } catch (error) {
            mostrarMensaje('aviso-registro-ruta', 'Error de conexión al guardar la ruta.');
            cambiarEstadoBoton(botonGuardar, false);
        }
    });
});
