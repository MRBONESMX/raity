document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const saludoUsuario = document.getElementById('saludo-usuario');
    const botonNotificaciones = document.getElementById('boton-notificaciones');
    const chipViajesCercanos = document.getElementById('chip-viajes-cercanos');
    const tarjetaDestacada = document.getElementById('tarjeta-destacada');
    const botonCerrarDestacada = document.getElementById('boton-cerrar-destacada');
    const enlaceDestacadaVer = document.getElementById('enlace-destacada-ver');
    const modalAvisos = document.getElementById('modal-avisos-explorar');
    const textoModalAvisos = document.getElementById('texto-modal-avisos');
    const listaNotificaciones = document.getElementById('lista-notificaciones-explorar');
    const botonCerrarAvisos = document.getElementById('boton-cerrar-avisos');

    let totalDisponibles = 0;
    let totalMisActivos = 0;
    let listaViajesDisponibles = [];
    let listaViajesActivos = [];
    let lineaRutaActiva = null;
    let marcadorDestinoActivo = null;
    let numeroSolicitudRuta = 0;

    saludoUsuario.textContent = '¡Hola, ' + usuario.nombre_completo + '!';

    const mapaExplorar = L.map('mapa-explorar', { zoomControl: false }).setView([24.115, -110.32], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(mapaExplorar);

    function limpiarRutaActivaMapa() {
        if (lineaRutaActiva) {
            mapaExplorar.removeLayer(lineaRutaActiva);
            lineaRutaActiva = null;
        }
        if (marcadorDestinoActivo) {
            mapaExplorar.removeLayer(marcadorDestinoActivo);
            marcadorDestinoActivo = null;
        }
    }

    function trazarRutaViajeEnExplorar(viaje) {
        limpiarRutaActivaMapa();
        numeroSolicitudRuta += 1;
        const idSolicitud = numeroSolicitudRuta;

        const colorLinea = viaje.es_violeta ? '#6B21A8' : '#057A91';
        const puntosIniciales = generarCaminoVialLaPaz(
            viaje.latitud_origen,
            viaje.longitud_origen,
            viaje.latitud_destino,
            viaje.longitud_destino
        );

        lineaRutaActiva = L.polyline(puntosIniciales, {
            color: colorLinea,
            weight: 5,
            opacity: 0.9
        }).addTo(mapaExplorar);

        marcadorDestinoActivo = L.circleMarker(
            [Number(viaje.latitud_destino), Number(viaje.longitud_destino)],
            {
                radius: 8,
                color: '#FFFFFF',
                weight: 2,
                fillColor: '#0F7652',
                fillOpacity: 1
            }
        ).addTo(mapaExplorar);
        marcadorDestinoActivo.bindTooltip('Destino: ' + viaje.destino, {
            permanent: true,
            direction: 'top'
        });

        obtenerGeometriaCalle(
            viaje.latitud_origen,
            viaje.longitud_origen,
            viaje.latitud_destino,
            viaje.longitud_destino
        ).then(function (puntosCalle) {
            if (idSolicitud !== numeroSolicitudRuta || !lineaRutaActiva) {
                return;
            }
            if (puntosCalle && puntosCalle.length >= 2) {
                lineaRutaActiva.setLatLngs(puntosCalle);
            }
        });
    }

    function mostrarTarjetaDestacada(viaje) {
        document.getElementById('destacada-lugares').textContent =
            'Asientos disponibles: ' + viaje.lugares_disponibles;
        document.getElementById('destacada-ruta').textContent =
            viaje.origen + ' -> ' + viaje.destino;
        document.getElementById('destacada-hora').innerHTML =
            iconoRelojSvg() + '<span>Sale a las ' + viaje.hora_salida + '</span>';
        document.getElementById('destacada-iniciales').textContent =
            obtenerIniciales(viaje.conductor_nombre);
        document.getElementById('destacada-conductor').textContent =
            viaje.conductor_nombre;
        document.getElementById('destacada-calificacion').innerHTML =
            iconoEstrellaSvg() + ' ' + Number(viaje.conductor_calificacion).toFixed(1);

        if (viaje.es_violeta) {
            tarjetaDestacada.classList.add('tarjeta-violeta');
        } else {
            tarjetaDestacada.classList.remove('tarjeta-violeta');
        }

        if (viaje.id_conductor === usuario.id) {
            enlaceDestacadaVer.href = '/mi-viaje.html?id=' + viaje.id;
            enlaceDestacadaVer.textContent = 'Administrar mi viaje';
        } else {
            enlaceDestacadaVer.href = '/buscar.html?busqueda=' + encodeURIComponent(viaje.destino);
            enlaceDestacadaVer.textContent = 'Ver y reservar en Buscar';
        }

        tarjetaDestacada.classList.remove('formulario-oculto');
        trazarRutaViajeEnExplorar(viaje);
    }

    botonNotificaciones.addEventListener('click', function () {
        textoModalAvisos.textContent =
            'Tienes ' + totalMisActivos + ' viaje(s) activo(s) en tu cuenta y hay ' +
            totalDisponibles + ' viaje(s) disponible(s) publicados en La Paz.';

        if (listaNotificaciones) {
            listaNotificaciones.innerHTML = '';

            for (let i = 0; i < listaViajesActivos.length; i++) {
                const viajeActivo = listaViajesActivos[i];
                const tarjetaAviso = document.createElement('div');
                tarjetaAviso.className = 'resumen-seleccion';
                tarjetaAviso.textContent =
                    'Viaje activo: ' + viajeActivo.origen + ' -> ' + viajeActivo.destino +
                    ' a las ' + viajeActivo.hora_salida +
                    ' (Pasajeros unidos: ' + viajeActivo.pasajeros_unidos + '/' + viajeActivo.lugares_totales + ')';
                listaNotificaciones.appendChild(tarjetaAviso);
            }

            const limiteDisponibles = listaViajesDisponibles.length < 3 ? listaViajesDisponibles.length : 3;
            for (let i = 0; i < limiteDisponibles; i++) {
                const viajeDisp = listaViajesDisponibles[i];
                const tarjetaDisp = document.createElement('div');
                tarjetaDisp.className = 'resumen-seleccion';
                tarjetaDisp.textContent =
                    'Viaje disponible cerca de ti: ' + viajeDisp.origen + ' -> ' + viajeDisp.destino +
                    ' con ' + viajeDisp.conductor_nombre +
                    ' (Lugares: ' + viajeDisp.lugares_disponibles + ')';
                listaNotificaciones.appendChild(tarjetaDisp);
            }

            if (listaViajesActivos.length === 0 && listaViajesDisponibles.length === 0) {
                const avisoVacio = document.createElement('div');
                avisoVacio.className = 'resumen-seleccion';
                avisoVacio.textContent = 'No hay notificaciones nuevas de viajes por el momento.';
                listaNotificaciones.appendChild(avisoVacio);
            }

            const notaPush = document.createElement('p');
            notaPush.className = 'texto-ayuda';
            notaPush.textContent = 'Nota: Las notificaciones push en segundo plano estarán disponibles en "Próximamente".';
            listaNotificaciones.appendChild(notaPush);
        }

        modalAvisos.classList.add('visible');
        botonCerrarAvisos.focus();
    });

    botonCerrarAvisos.addEventListener('click', function () {
        modalAvisos.classList.remove('visible');
        botonNotificaciones.focus();
    });

    modalAvisos.addEventListener('click', function (evento) {
        if (evento.target === modalAvisos) {
            modalAvisos.classList.remove('visible');
            botonNotificaciones.focus();
        }
    });

    botonCerrarDestacada.addEventListener('click', function () {
        tarjetaDestacada.classList.add('formulario-oculto');
        limpiarRutaActivaMapa();
    });

    try {
        const respuesta = await fetch('/api/viajes');
        if (!respuesta.ok) {
            chipViajesCercanos.textContent = 'No se pudieron cargar los viajes';
            return;
        }

        const datos = await respuesta.json();
        const viajes = datos.viajes || [];
        listaViajesDisponibles = viajes;
        totalDisponibles = viajes.length;

        if (viajes.length === 1) {
            chipViajesCercanos.textContent = '1 viaje cerca de ti';
        } else {
            chipViajesCercanos.textContent = viajes.length + ' viajes cerca de ti';
        }

        for (let i = 0; i < viajes.length; i++) {
            const viaje = viajes[i];
            const colorMarcador = viaje.es_violeta ? '#6B21A8' : '#057A91';

            const marcador = L.circleMarker(
                [Number(viaje.latitud_origen), Number(viaje.longitud_origen)],
                {
                    radius: 10,
                    color: '#FFFFFF',
                    weight: 2,
                    fillColor: colorMarcador,
                    fillOpacity: 1
                }
            ).addTo(mapaExplorar);

            const contenidoPopup = document.createElement('div');
            const tituloPopup = document.createElement('strong');
            tituloPopup.textContent = viaje.origen + ' -> ' + viaje.destino;
            contenidoPopup.appendChild(tituloPopup);
            contenidoPopup.appendChild(document.createElement('br'));
            contenidoPopup.appendChild(document.createTextNode('Conductor: ' + viaje.conductor_nombre));
            contenidoPopup.appendChild(document.createElement('br'));
            contenidoPopup.appendChild(
                document.createTextNode('Salida: ' + viaje.hora_salida + ' (' + viaje.lugares_disponibles + ' lugares)')
            );
            marcador.bindPopup(contenidoPopup);

            marcador.on('click', function () {
                mostrarTarjetaDestacada(viaje);
            });
        }

        if (viajes.length > 0) {
            mostrarTarjetaDestacada(viajes[0]);
        }

        try {
            const respuestaMisViajes = await fetch('/api/viajes/mis-viajes');
            if (respuestaMisViajes.ok) {
                const datosMisViajes = await respuestaMisViajes.json();
                const activos = datosMisViajes.viajes_actuales || [];
                listaViajesActivos = activos;
                totalMisActivos = activos.length;
            }
        } catch (errorSecundario) {
            console.log('No se pudo consultar el resumen de viajes activos.');
        }
    } catch (error) {
        chipViajesCercanos.textContent = 'Error de conexión al cargar mapa';
    }
});
