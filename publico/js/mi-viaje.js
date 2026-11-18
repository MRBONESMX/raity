document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const idViaje = parametros.get('id');
    const debeSolicitarGpsInicial = parametros.get('solicitar_gps') === '1';
    let yaSolicitoGpsAutomatico = false;

    if (!idViaje) {
        window.location.href = '/mis-viajes.html';
        return;
    }

    const textoCargando = document.getElementById('mi-viaje-cargando');
    const resumenViaje = document.getElementById('resumen-viaje');
    const seccionPuntoRecogida = document.getElementById('seccion-punto-recogida');
    const conteoPasajeros = document.getElementById('conteo-pasajeros');
    const listaPasajeros = document.getElementById('lista-pasajeros');
    const accionesViaje = document.getElementById('acciones-mi-viaje');

    function etiquetaEstadoViaje(estado) {
        if (estado === 'en_curso') {
            return 'En curso';
        }
        if (estado === 'terminado') {
            return 'Terminado';
        }
        if (estado === 'cancelado') {
            return 'Cancelado';
        }
        return 'Programado';
    }

    function extraerPuntosRecogida(pasajeros) {
        const puntos = [];
        for (let i = 0; i < pasajeros.length; i++) {
            const p = pasajeros[i];
            if (
                p.latitud_recogida !== null &&
                p.latitud_recogida !== undefined &&
                p.longitud_recogida !== null &&
                p.longitud_recogida !== undefined
            ) {
                puntos.push(p);
            }
        }
        return puntos;
    }

    function buscarPasajeroActual(pasajeros) {
        for (let i = 0; i < pasajeros.length; i++) {
            if (pasajeros[i].id_usuario === usuario.id) {
                return pasajeros[i];
            }
        }
        return null;
    }

    function enlazarBotonesVerMapa(contenedor) {
        if (!contenedor) {
            return;
        }
        const botonesVer = contenedor.querySelectorAll('button[data-ver-recogida-usuario]');
        for (let i = 0; i < botonesVer.length; i++) {
            botonesVer[i].addEventListener('click', function () {
                const idObjetivo = this.getAttribute('data-ver-recogida-usuario');
                const mapaElemento = document.getElementById('mapa-mi-viaje');
                if (mapaElemento && typeof mapaElemento.scrollIntoView === 'function') {
                    mapaElemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                enfocarPuntoRecogidaEnMapa('mapa-mi-viaje', idObjetivo);
            });
        }
    }

    function actualizarEstadoBotonGps(boton, cargando, textoTemporal, textoFinal) {
        if (!boton) {
            return;
        }
        const span = boton.querySelector('span');
        if (cargando) {
            if (span && !boton.dataset.textoOriginal) {
                boton.dataset.textoOriginal = span.textContent;
            }
            if (span) {
                span.textContent = textoTemporal;
            } else {
                boton.textContent = textoTemporal;
            }
            boton.disabled = true;
        } else {
            const textoRestaurado = textoFinal || boton.dataset.textoOriginal || 'Compartir mi ubicación actual (GPS)';
            if (span) {
                span.textContent = textoRestaurado;
            } else {
                boton.textContent = textoRestaurado;
            }
            boton.disabled = false;
        }
    }

    async function compartirUbicacionGpsPasajero(viaje, boton) {
        ocultarMensaje('aviso-mi-viaje');
        ocultarMensaje('exito-mi-viaje');
        actualizarEstadoBotonGps(boton, true, 'Solicitando permiso de GPS...');

        try {
            const posicionGps = await solicitarPermisoYUbicacionGps();
            actualizarEstadoBotonGps(boton, true, 'Calculando punto en ruta...');

            let puntosCalle = await obtenerGeometriaCalle(
                viaje.latitud_origen,
                viaje.longitud_origen,
                viaje.latitud_destino,
                viaje.longitud_destino
            );

            if (!puntosCalle || puntosCalle.length < 2) {
                puntosCalle = generarCaminoVialLaPaz(
                    viaje.latitud_origen,
                    viaje.longitud_origen,
                    viaje.latitud_destino,
                    viaje.longitud_destino
                );
            }

            // Verifica proyección local inmediata sobre la ruta establecida
            calcularPuntoRecogidaEnRuta(posicionGps.latitud, posicionGps.longitud, puntosCalle);

            actualizarEstadoBotonGps(boton, true, 'Guardando punto de recogida...');

            const respuesta = await fetch('/api/viajes/' + idViaje + '/punto-recogida', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitud_pasajero: posicionGps.latitud,
                    longitud_pasajero: posicionGps.longitud,
                    puntos_ruta: puntosCalle
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-mi-viaje', datos.mensaje || 'No se pudo registrar tu punto de recogida.');
                actualizarEstadoBotonGps(boton, false);
                return;
            }

            await cargarDetalleViaje();

            if (datos.reservacion && datos.reservacion.fuera_de_ruta) {
                mostrarMensaje('aviso-fuera-ruta', datos.mensaje, 'advertencia');
            } else {
                ocultarMensaje('aviso-fuera-ruta');
                mostrarMensaje(
                    'exito-mi-viaje',
                    '¡Punto de recogida agregado sobre la ruta! El mapa se actualizó con el lugar exacto donde pasarán por ti.',
                    'exito'
                );
            }

            setTimeout(function () {
                enfocarPuntoRecogidaEnMapa('mapa-mi-viaje', usuario.id);
            }, 250);
        } catch (error) {
            mostrarMensaje(
                'aviso-mi-viaje',
                error && error.message ? error.message : 'No se pudo compartir tu ubicación GPS.'
            );
            actualizarEstadoBotonGps(boton, false);
        }
    }

    function renderizarSeccionPuntoRecogida(viaje, pasajeros, puntosRecogida, esConductor, idReservacionPropia) {
        if (!seccionPuntoRecogida) {
            return;
        }

        const viajeActivo = viaje.estado === 'programado' || viaje.estado === 'en_curso';
        const miPasajero = buscarPasajeroActual(pasajeros);

        if (esConductor) {
            seccionPuntoRecogida.classList.remove('formulario-oculto');
            let htmlConductor =
                '<div class="cabecera-usuario">' +
                '<h2 class="subtitulo-pagina">Puntos de recogida en ruta</h2>' +
                '<span class="insignia insignia-amarilla">' +
                puntosRecogida.length +
                ' marcado(s)</span>' +
                '</div>';

            if (puntosRecogida.length === 0) {
                htmlConductor +=
                    '<p class="texto-ayuda">Ningún pasajero ha compartido su ubicación GPS todavía. Cuando lo hagan, su punto de recogida aparecerá automáticamente sobre tu ruta establecida (sin desvíos).</p>';
            } else {
                htmlConductor +=
                    '<p class="texto-ayuda margen-abajo">La ruta muestra los lugares exactos sobre tu trayecto donde recogerás a cada pasajero sin salir de tu camino.</p>';
                for (let i = 0; i < puntosRecogida.length; i++) {
                    const p = puntosRecogida[i];
                    const estadoPunto = p.fuera_de_ruta
                        ? '<span class="insignia insignia-amarilla">Debe acercarse a la ruta (' +
                          p.distancia_ruta_metros +
                          ' m)</span>'
                        : '<span class="insignia insignia-verde">Sobre la ruta</span>';
                    htmlConductor +=
                        '<div class="fila-punto-recogida">' +
                        '<div class="info-pasajero-columna">' +
                        '<span class="nombre-conductor">' +
                        p.nombre_completo +
                        '</span>' +
                        '<span class="detalle-recogida-pasajero">Recogida en ruta: ' +
                        Number(p.latitud_recogida).toFixed(5) +
                        ', ' +
                        Number(p.longitud_recogida).toFixed(5) +
                        '</span>' +
                        estadoPunto +
                        '</div>' +
                        '<button type="button" class="boton-ver-recogida" data-ver-recogida-usuario="' +
                        p.id_usuario +
                        '">Ver en mapa</button>' +
                        '</div>';
                }
            }

            seccionPuntoRecogida.innerHTML = htmlConductor;
            enlazarBotonesVerMapa(seccionPuntoRecogida);
            ocultarMensaje('aviso-fuera-ruta');
            return;
        }

        if (idReservacionPropia && viajeActivo) {
            seccionPuntoRecogida.classList.remove('formulario-oculto');
            const tienePunto =
                miPasajero &&
                miPasajero.latitud_recogida !== null &&
                miPasajero.latitud_recogida !== undefined;

            let htmlPasajero =
                '<div class="cabecera-usuario">' +
                '<h2 class="subtitulo-pagina">Tu punto de recogida (GPS)</h2>' +
                (tienePunto
                    ? miPasajero.fuera_de_ruta
                        ? '<span class="insignia insignia-amarilla">Fuera de ruta</span>'
                        : '<span class="insignia insignia-verde">En ruta</span>'
                    : '<span class="insignia insignia-gris">Pendiente</span>') +
                '</div>' +
                '<p class="texto-ayuda margen-abajo">Comparte la ubicación GPS de tu celular para agregar automáticamente tu punto de recogida sobre la ruta establecida del conductor (sin desvíos).</p>';

            if (tienePunto) {
                htmlPasajero +=
                    '<div class="resumen-seleccion">' +
                    '<p><strong>Lugar exacto de recogida sobre la ruta:</strong> ' +
                    Number(miPasajero.latitud_recogida).toFixed(5) +
                    ', ' +
                    Number(miPasajero.longitud_recogida).toFixed(5) +
                    '</p>' +
                    '<p class="texto-ayuda">Distancia desde tu ubicación GPS a la ruta: ' +
                    miPasajero.distancia_ruta_metros +
                    ' m</p>' +
                    '<div class="margen-arriba">' +
                    '<button type="button" class="boton-ver-recogida" data-ver-recogida-usuario="' +
                    usuario.id +
                    '">Ver mi punto en el mapa</button>' +
                    '</div>' +
                    '</div>';

                if (miPasajero.fuera_de_ruta) {
                    mostrarMensaje(
                        'aviso-fuera-ruta',
                        'Tu ubicación está fuera de la ruta establecida del conductor (a ' +
                            miPasajero.distancia_ruta_metros +
                            ' m). Debes acercarte al punto de recogida marcado sobre la ruta para poder ser recogido, ya que el conductor no realiza desvíos.',
                        'advertencia'
                    );
                } else {
                    ocultarMensaje('aviso-fuera-ruta');
                }
            } else {
                ocultarMensaje('aviso-fuera-ruta');
            }

            const textoBotonGps = tienePunto
                ? 'Actualizar mi ubicación GPS'
                : 'Compartir mi ubicación actual (GPS)';

            htmlPasajero +=
                '<button type="button" id="boton-compartir-gps" class="boton boton-principal">' +
                iconoGpsSvg() +
                '<span>' +
                textoBotonGps +
                '</span>' +
                '</button>';

            seccionPuntoRecogida.innerHTML = htmlPasajero;
            enlazarBotonesVerMapa(seccionPuntoRecogida);

            const botonGps = document.getElementById('boton-compartir-gps');
            if (botonGps) {
                botonGps.addEventListener('click', function () {
                    compartirUbicacionGpsPasajero(viaje, botonGps);
                });
            }
            return;
        }

        ocultarMensaje('aviso-fuera-ruta');
        if (puntosRecogida.length > 0) {
            seccionPuntoRecogida.classList.remove('formulario-oculto');
            let htmlResumen =
                '<div class="cabecera-usuario">' +
                '<h2 class="subtitulo-pagina">Puntos de recogida registrados</h2>' +
                '<span class="insignia insignia-amarilla">' +
                puntosRecogida.length +
                '</span>' +
                '</div>';
            for (let i = 0; i < puntosRecogida.length; i++) {
                const p = puntosRecogida[i];
                htmlResumen +=
                    '<div class="fila-punto-recogida">' +
                    '<div class="info-pasajero-columna">' +
                    '<span class="nombre-conductor">' +
                    p.nombre_completo +
                    '</span>' +
                    '<span class="detalle-recogida-pasajero">Recogida en ruta: ' +
                    Number(p.latitud_recogida).toFixed(5) +
                    ', ' +
                    Number(p.longitud_recogida).toFixed(5) +
                    '</span>' +
                    '</div>' +
                    '<button type="button" class="boton-ver-recogida" data-ver-recogida-usuario="' +
                    p.id_usuario +
                    '">Ver en mapa</button>' +
                    '</div>';
            }
            seccionPuntoRecogida.innerHTML = htmlResumen;
            enlazarBotonesVerMapa(seccionPuntoRecogida);
        } else {
            seccionPuntoRecogida.classList.add('formulario-oculto');
            seccionPuntoRecogida.innerHTML = '';
        }
    }

    async function cargarDetalleViaje() {
        ocultarMensaje('aviso-mi-viaje');
        try {
            const respuesta = await fetch('/api/viajes/' + idViaje);
            const datos = await respuesta.json();
            textoCargando.classList.add('formulario-oculto');

            if (!respuesta.ok) {
                mostrarMensaje('aviso-mi-viaje', datos.mensaje);
                return;
            }

            const viaje = datos.viaje;
            const pasajeros = datos.pasajeros || [];
            const puntosRecogida = extraerPuntosRecogida(pasajeros);
            const esConductor = datos.es_conductor;
            const idReservacionPropia = datos.id_reservacion_propia;

            if (viaje.es_violeta) {
                resumenViaje.classList.add('tarjeta-violeta');
            } else {
                resumenViaje.classList.remove('tarjeta-violeta');
            }

            const claseEstado = viaje.estado === 'cancelado' ? 'insignia insignia-gris' : 'insignia insignia-verde';
            const insigniaVioleta = viaje.es_violeta
                ? '<span class="insignia insignia-violeta">' + iconoCorazonVioletaSvg() + ' Raity Violeta</span>'
                : '';

            let detalleRecogidaResumen = '';
            if (puntosRecogida.length === 1) {
                detalleRecogidaResumen =
                    '<p class="detalle-linea">' +
                    iconoGpsSvg() +
                    '<span>Recogida exacta sobre la ruta: ' +
                    Number(puntosRecogida[0].latitud_recogida).toFixed(5) +
                    ', ' +
                    Number(puntosRecogida[0].longitud_recogida).toFixed(5) +
                    '</span></p>';
            } else if (puntosRecogida.length > 1) {
                detalleRecogidaResumen =
                    '<p class="detalle-linea">' +
                    iconoGpsSvg() +
                    '<span>Ruta actualizada con ' +
                    puntosRecogida.length +
                    ' puntos exactos de recogida sobre el trayecto</span></p>';
            }

            resumenViaje.innerHTML =
                '<div class="cabecera-usuario">' +
                '<p class="ruta-viaje">' + viaje.origen + ' -> ' + viaje.destino + '</p>' +
                '<span class="' + claseEstado + '">' + etiquetaEstadoViaje(viaje.estado) + '</span>' +
                '</div>' +
                '<p class="detalle-linea">' + iconoAutoSvg() + '<span>' + viaje.vehiculo_matricula + ' - ' + viaje.vehiculo_modelo + ' - ' + viaje.vehiculo_color + '</span></p>' +
                '<div class="cabecera-usuario">' +
                '<span class="detalle-linea">' + iconoRelojSvg() + '<span>Comienza a las ' + viaje.hora_salida + '</span></span>' +
                insigniaVioleta +
                '</div>' +
                detalleRecogidaResumen +
                '<p class="texto-ayuda">Conductor: ' + viaje.conductor_nombre + ' (' + Number(viaje.conductor_calificacion).toFixed(1) + ')</p>';

            dibujarRutaEnMapa(
                'mapa-mi-viaje',
                viaje.latitud_origen,
                viaje.longitud_origen,
                viaje.latitud_destino,
                viaje.longitud_destino,
                {
                    textoOrigen: viaje.origen,
                    textoDestino: viaje.destino,
                    esVioleta: viaje.es_violeta,
                    puntosRecogida: puntosRecogida
                }
            );

            renderizarSeccionPuntoRecogida(viaje, pasajeros, puntosRecogida, esConductor, idReservacionPropia);

            conteoPasajeros.textContent = pasajeros.length + '/' + viaje.lugares_totales;

            if (pasajeros.length === 0) {
                listaPasajeros.innerHTML = '<p class="texto-ayuda">Aún no hay pasajeros unidos a este viaje.</p>';
            } else {
                listaPasajeros.innerHTML = '';
                for (let i = 0; i < pasajeros.length; i++) {
                    const pasajero = pasajeros[i];
                    let botonEliminar = '';
                    if (esConductor && (viaje.estado === 'programado' || viaje.estado === 'en_curso')) {
                        botonEliminar =
                            '<button type="button" class="boton-chico-rojo" data-id-reservacion="' +
                            pasajero.id_reservacion +
                            '" data-nombre-pasajero="' + pasajero.nombre_completo + '">Eliminar pasajero</button>';
                    }

                    const tieneRecogida =
                        pasajero.latitud_recogida !== null &&
                        pasajero.latitud_recogida !== undefined;
                    let detalleRecogidaHtml =
                        '<span class="detalle-recogida-pasajero">Sin punto de recogida GPS compartido aún</span>';
                    let botonVerRecogida = '';

                    if (tieneRecogida) {
                        const etiquetaUbicacion = pasajero.fuera_de_ruta
                            ? '<span class="insignia insignia-amarilla">Acercarse a ruta (' +
                              pasajero.distancia_ruta_metros +
                              ' m)</span>'
                            : '<span class="insignia insignia-verde">Recogida en ruta</span>';
                        detalleRecogidaHtml =
                            '<span class="detalle-recogida-pasajero">Punto en ruta: ' +
                            Number(pasajero.latitud_recogida).toFixed(5) +
                            ', ' +
                            Number(pasajero.longitud_recogida).toFixed(5) +
                            '</span>' +
                            etiquetaUbicacion;
                        botonVerRecogida =
                            '<button type="button" class="boton-ver-recogida" data-ver-recogida-usuario="' +
                            pasajero.id_usuario +
                            '">Ver punto en mapa</button>';
                    }

                    listaPasajeros.innerHTML +=
                        '<div class="fila-pasajero">' +
                        '<div class="info-usuario-fila">' +
                        '<span class="avatar-iniciales">' + obtenerIniciales(pasajero.nombre_completo) + '</span>' +
                        '<div class="info-pasajero-columna">' +
                        '<div>' +
                        '<span class="nombre-conductor">' + pasajero.nombre_completo + '</span>' +
                        '<span class="calificacion-linea">' + iconoEstrellaSvg() + ' ' + Number(pasajero.calificacion).toFixed(1) + '</span>' +
                        '</div>' +
                        detalleRecogidaHtml +
                        '</div>' +
                        '</div>' +
                        '<div class="acciones-pasajero">' +
                        botonVerRecogida +
                        botonEliminar +
                        '</div>' +
                        '</div>';
                }

                enlazarBotonesVerMapa(listaPasajeros);

                const botonesEliminar = listaPasajeros.querySelectorAll('button[data-id-reservacion]');
                for (let i = 0; i < botonesEliminar.length; i++) {
                    botonesEliminar[i].addEventListener('click', function () {
                        const botonActual = this;
                        const idReservacion = this.getAttribute('data-id-reservacion');
                        const nombrePasajero = this.getAttribute('data-nombre-pasajero') || 'este pasajero';
                        pedirConfirmacion(
                            'Eliminar pasajero',
                            '¿Seguro que deseas eliminar a ' + nombrePasajero + ' de este viaje? Su asiento volverá a estar disponible.',
                            'Sí, eliminar',
                            async function () {
                                await cancelarReservacion(idReservacion, true, botonActual);
                            }
                        );
                    });
                }
            }

            accionesViaje.innerHTML = '';
            if (esConductor) {
                if (viaje.estado === 'programado') {
                    accionesViaje.innerHTML +=
                        '<button type="button" id="boton-iniciar-viaje" class="boton boton-verde">Iniciar viaje</button>';
                } else if (viaje.estado === 'en_curso') {
                    accionesViaje.innerHTML +=
                        '<button type="button" id="boton-terminar-viaje" class="boton boton-verde">Terminar viaje</button>';
                }

                if (viaje.estado === 'programado' || viaje.estado === 'en_curso') {
                    accionesViaje.innerHTML +=
                        '<button type="button" id="boton-cancelar-viaje" class="boton boton-rojo">Cancelar viaje</button>';
                }
            } else if (idReservacionPropia && (viaje.estado === 'programado' || viaje.estado === 'en_curso')) {
                accionesViaje.innerHTML =
                    '<button type="button" id="boton-salir-viaje" class="boton boton-rojo">Salir del viaje</button>';
            }

            const botonIniciar = document.getElementById('boton-iniciar-viaje');
            if (botonIniciar) {
                botonIniciar.addEventListener('click', function () {
                    cambiarEstadoViaje('iniciar', false, botonIniciar, 'Iniciando viaje...');
                });
            }

            const botonTerminar = document.getElementById('boton-terminar-viaje');
            if (botonTerminar) {
                botonTerminar.addEventListener('click', function () {
                    pedirConfirmacion(
                        'Terminar viaje',
                        '¿Confirmas que el recorrido ya concluyó? El viaje pasará a tu historial.',
                        'Sí, terminar viaje',
                        async function () {
                            await cambiarEstadoViaje('terminar', true, botonTerminar, 'Terminando viaje...');
                        },
                        false
                    );
                });
            }

            const botonCancelar = document.getElementById('boton-cancelar-viaje');
            if (botonCancelar) {
                botonCancelar.addEventListener('click', function () {
                    pedirConfirmacion(
                        'Cancelar viaje',
                        '¿Estás seguro de cancelar este viaje? Se avisará a los pasajeros y sus reservaciones se liberarán.',
                        'Sí, cancelar viaje',
                        async function () {
                            await cambiarEstadoViaje('cancelar', true, botonCancelar, 'Cancelando viaje...');
                        }
                    );
                });
            }

            const botonSalir = document.getElementById('boton-salir-viaje');
            if (botonSalir) {
                botonSalir.addEventListener('click', function () {
                    pedirConfirmacion(
                        'Salir del viaje',
                        '¿Seguro que quieres cancelar tu asiento en este viaje?',
                        'Sí, salir del viaje',
                        async function () {
                            await cancelarReservacion(idReservacionPropia, false, botonSalir);
                        }
                    );
                });
            }

            if (
                debeSolicitarGpsInicial &&
                !yaSolicitoGpsAutomatico &&
                !esConductor &&
                idReservacionPropia &&
                (viaje.estado === 'programado' || viaje.estado === 'en_curso')
            ) {
                const miPasajeroActual = buscarPasajeroActual(pasajeros);
                const yaTienePunto =
                    miPasajeroActual &&
                    miPasajeroActual.latitud_recogida !== null &&
                    miPasajeroActual.latitud_recogida !== undefined;
                yaSolicitoGpsAutomatico = true;

                if (window.history && typeof window.history.replaceState === 'function') {
                    window.history.replaceState({}, '', '/mi-viaje.html?id=' + encodeURIComponent(idViaje));
                }

                if (!yaTienePunto) {
                    const botonGpsInicial = document.getElementById('boton-compartir-gps');
                    await compartirUbicacionGpsPasajero(viaje, botonGpsInicial);
                }
            }
        } catch (error) {
            textoCargando.classList.add('formulario-oculto');
            mostrarMensaje('aviso-mi-viaje', 'Error de conexión al cargar los detalles del viaje.');
        }
    }

    async function cambiarEstadoViaje(accion, redirigir, botonAccion, textoCargandoBoton) {
        ocultarMensaje('aviso-mi-viaje');
        ocultarMensaje('exito-mi-viaje');
        cambiarEstadoBoton(botonAccion, true, textoCargandoBoton);

        try {
            const respuesta = await fetch('/api/viajes/' + idViaje + '/' + accion, {
                method: 'PUT'
            });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-mi-viaje', datos.mensaje);
                cambiarEstadoBoton(botonAccion, false);
                return;
            }

            if (redirigir) {
                window.location.href = '/mis-viajes.html';
            } else {
                mostrarMensaje('exito-mi-viaje', datos.mensaje, 'exito');
                await cargarDetalleViaje();
            }
        } catch (error) {
            mostrarMensaje('aviso-mi-viaje', 'No se pudo actualizar el estado del viaje.');
            cambiarEstadoBoton(botonAccion, false);
        }
    }

    async function cancelarReservacion(idReservacion, esEliminacionConductor, botonAccion) {
        ocultarMensaje('aviso-mi-viaje');
        ocultarMensaje('exito-mi-viaje');
        cambiarEstadoBoton(botonAccion, true, 'Procesando...');

        try {
            const respuesta = await fetch('/api/reservaciones/' + idReservacion, {
                method: 'DELETE'
            });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-mi-viaje', datos.mensaje);
                cambiarEstadoBoton(botonAccion, false);
                return;
            }

            if (esEliminacionConductor) {
                mostrarMensaje('exito-mi-viaje', datos.mensaje, 'exito');
                await cargarDetalleViaje();
            } else {
                window.location.href = '/mis-viajes.html';
            }
        } catch (error) {
            mostrarMensaje('aviso-mi-viaje', 'Error de conexión al cancelar la reservación.');
            cambiarEstadoBoton(botonAccion, false);
        }
    }

    await cargarDetalleViaje();
});
