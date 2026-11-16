document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const pasoInstrucciones = document.getElementById('paso-instrucciones-ruta');
    const pasoMapa = document.getElementById('paso-mapa-ruta');
    const pasoExito = document.getElementById('paso-exito-ruta');
    const botonComenzar = document.getElementById('boton-comenzar-ruta');
    const botonLimpiar = document.getElementById('boton-limpiar-puntos');
    const botonGuardar = document.getElementById('boton-guardar-ruta');
    const textoEstadoPuntos = document.getElementById('texto-estado-puntos');

    let mapa = null;
    let puntoOrigen = null;
    let puntoDestino = null;
    let marcadorOrigen = null;
    let marcadorDestino = null;
    let lineaRuta = null;

    function limpiarMapa() {
        if (marcadorOrigen && mapa) {
            mapa.removeLayer(marcadorOrigen);
        }
        if (marcadorDestino && mapa) {
            mapa.removeLayer(marcadorDestino);
        }
        if (lineaRuta && mapa) {
            mapa.removeLayer(lineaRuta);
        }
        puntoOrigen = null;
        puntoDestino = null;
        marcadorOrigen = null;
        marcadorDestino = null;
        lineaRuta = null;
        textoEstadoPuntos.textContent = 'Toca en el mapa para marcar el punto de origen.';
    }

    botonComenzar.addEventListener('click', function () {
        pasoInstrucciones.classList.add('formulario-oculto');
        pasoMapa.classList.remove('formulario-oculto');

        mapa = L.map('mapa-grabar-ruta').setView([24.115, -110.32], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap'
        }).addTo(mapa);

        setTimeout(function () {
            mapa.invalidateSize();
        }, 100);

        mapa.on('click', function (evento) {
            const coordenadas = evento.latlng;

            if (!puntoOrigen) {
                puntoOrigen = coordenadas;
                marcadorOrigen = L.circleMarker([coordenadas.lat, coordenadas.lng], {
                    radius: 8,
                    color: '#07B5D5',
                    fillColor: '#07B5D5',
                    fillOpacity: 1
                }).addTo(mapa);
                textoEstadoPuntos.textContent = 'Origen marcado. Ahora toca en el mapa el punto de destino.';
                return;
            }

            if (!puntoDestino) {
                puntoDestino = coordenadas;
                marcadorDestino = L.circleMarker([coordenadas.lat, coordenadas.lng], {
                    radius: 8,
                    color: '#16A672',
                    fillColor: '#16A672',
                    fillOpacity: 1
                }).addTo(mapa);

                lineaRuta = L.polyline(
                    [
                        [puntoOrigen.lat, puntoOrigen.lng],
                        [puntoDestino.lat, puntoDestino.lng]
                    ],
                    { color: '#07B5D5', weight: 4 }
                ).addTo(mapa);

                textoEstadoPuntos.textContent = 'Ruta marcada. Escribe el nombre de la ruta y presiona Guardar ruta.';
            }
        });
    });

    botonLimpiar.addEventListener('click', function () {
        ocultarMensaje('aviso-registro-ruta');
        limpiarMapa();
    });

    botonGuardar.addEventListener('click', async function () {
        ocultarMensaje('aviso-registro-ruta');
        const nombre = document.getElementById('ruta-nombre').value.trim();

        if (!nombre) {
            mostrarMensaje('aviso-registro-ruta', 'Escribe un nombre para identificar tu ruta.');
            return;
        }

        if (!puntoOrigen || !puntoDestino) {
            mostrarMensaje('aviso-registro-ruta', 'Debes marcar tanto el origen como el destino en el mapa.');
            return;
        }

        try {
            const respuesta = await fetch('/api/rutas-guardadas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    latitud_origen: puntoOrigen.lat.toFixed(6),
                    longitud_origen: puntoOrigen.lng.toFixed(6),
                    latitud_destino: puntoDestino.lat.toFixed(6),
                    longitud_destino: puntoDestino.lng.toFixed(6)
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-registro-ruta', datos.mensaje);
                return;
            }

            pasoMapa.classList.add('formulario-oculto');
            pasoExito.classList.remove('formulario-oculto');
        } catch (error) {
            mostrarMensaje('aviso-registro-ruta', 'Error de conexión al guardar la ruta.');
        }
    });
});
