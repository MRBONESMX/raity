document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const idViaje = parametros.get('id');

    if (!idViaje) {
        window.location.href = '/mis-viajes.html';
        return;
    }

    const textoCargando = document.getElementById('mi-viaje-cargando');
    const resumenViaje = document.getElementById('resumen-viaje');
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
                    esVioleta: viaje.es_violeta
                }
            );

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
                            '" data-nombre-pasajero="' + pasajero.nombre_completo + '">Retirar pasajero</button>';
                    }

                    listaPasajeros.innerHTML +=
                        '<div class="fila-pasajero">' +
                        '<div class="info-usuario-fila">' +
                        '<span class="avatar-iniciales">' + obtenerIniciales(pasajero.nombre_completo) + '</span>' +
                        '<div>' +
                        '<span class="nombre-conductor">' + pasajero.nombre_completo + '</span>' +
                        '<span class="calificacion-linea">' + iconoEstrellaSvg() + ' ' + Number(pasajero.calificacion).toFixed(1) + '</span>' +
                        '</div>' +
                        '</div>' +
                        botonEliminar +
                        '</div>';
                }

                const botonesEliminar = listaPasajeros.querySelectorAll('button[data-id-reservacion]');
                for (let i = 0; i < botonesEliminar.length; i++) {
                    botonesEliminar[i].addEventListener('click', function () {
                        const botonActual = this;
                        const idReservacion = this.getAttribute('data-id-reservacion');
                        const nombrePasajero = this.getAttribute('data-nombre-pasajero') || 'este pasajero';
                        pedirConfirmacion(
                            'Retirar pasajero',
                            '¿Seguro que deseas retirar a ' + nombrePasajero + ' de este viaje? Su asiento volverá a estar disponible.',
                            'Sí, retirar',
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
