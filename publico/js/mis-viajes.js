document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const textoCargando = document.getElementById('mis-viajes-cargando');
    const contenedorActual = document.getElementById('contenedor-viaje-actual');
    const contenedorHistorial = document.getElementById('contenedor-historial');

    const modalCalificar = document.getElementById('modal-calificar');
    const formularioCalificar = document.getElementById('formulario-calificar');
    const textoCalificarViaje = document.getElementById('texto-calificar-viaje');
    const selectPuntuacion = document.getElementById('calificar-puntuacion');
    const campoComentario = document.getElementById('calificar-comentario');
    const botonCancelarCalificacion = document.getElementById('boton-cancelar-calificacion');
    const botonGuardarCalificacion = document.getElementById('boton-guardar-calificacion');

    const modalReportar = document.getElementById('modal-reportar');
    const formularioReportar = document.getElementById('formulario-reportar');
    const textoReportarViaje = document.getElementById('texto-reportar-viaje');
    const selectMotivo = document.getElementById('reportar-motivo');
    const campoDetalleReporte = document.getElementById('reportar-detalle');
    const botonCancelarReporte = document.getElementById('boton-cancelar-reporte');
    const botonEnviarReporte = document.getElementById('boton-enviar-reporte');

    let idViajeSeleccionado = null;

    function formatearFechaCorta(fechaTexto) {
        if (!fechaTexto) {
            return '';
        }
        const soloFecha = String(fechaTexto).substring(0, 10);
        const partes = soloFecha.split('-');
        if (partes.length === 3) {
            return partes[2] + '/' + partes[1] + '/' + partes[0];
        }
        return soloFecha;
    }

    function abrirModalCalificar(idViaje, nombreConductor) {
        idViajeSeleccionado = idViaje;
        limpiarErroresCampos(['calificar-puntuacion', 'calificar-comentario'], 'aviso-calificar');
        selectPuntuacion.value = '5';
        campoComentario.value = '';
        textoCalificarViaje.textContent = '¿Cómo te fue en el viaje con ' + nombreConductor + '?';
        modalCalificar.classList.add('visible');
        selectPuntuacion.focus();
    }

    function abrirModalReportar(idViaje, rutaViaje) {
        idViajeSeleccionado = idViaje;
        limpiarErroresCampos(['reportar-motivo', 'reportar-detalle'], 'aviso-reportar');
        selectMotivo.value = '';
        campoDetalleReporte.value = '';
        textoReportarViaje.textContent = 'Viaje: ' + rutaViaje;
        modalReportar.classList.add('visible');
        selectMotivo.focus();
    }

    botonCancelarCalificacion.addEventListener('click', function () {
        modalCalificar.classList.remove('visible');
    });

    modalCalificar.addEventListener('click', function (evento) {
        if (evento.target === modalCalificar) {
            modalCalificar.classList.remove('visible');
        }
    });

    botonCancelarReporte.addEventListener('click', function () {
        modalReportar.classList.remove('visible');
    });

    modalReportar.addEventListener('click', function (evento) {
        if (evento.target === modalReportar) {
            modalReportar.classList.remove('visible');
        }
    });

    formularioCalificar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(['calificar-puntuacion', 'calificar-comentario'], 'aviso-calificar');
        ocultarMensaje('aviso-mis-viajes');
        ocultarMensaje('exito-mis-viajes');

        if (!idViajeSeleccionado) {
            return;
        }

        cambiarEstadoBoton(botonGuardarCalificacion, true, 'Guardando...');

        try {
            const respuesta = await fetch('/api/viajes/' + idViajeSeleccionado + '/calificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    puntuacion: selectPuntuacion.value,
                    comentario: campoComentario.value.trim()
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-calificar', datos.mensaje);
                cambiarEstadoBoton(botonGuardarCalificacion, false);
                return;
            }

            modalCalificar.classList.remove('visible');
            cambiarEstadoBoton(botonGuardarCalificacion, false);
            mostrarMensaje('exito-mis-viajes', datos.mensaje, 'exito');
            await cargarMisViajes();
        } catch (error) {
            mostrarMensaje('aviso-calificar', 'Error de conexión al guardar la calificación.');
            cambiarEstadoBoton(botonGuardarCalificacion, false);
        }
    });

    formularioReportar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(['reportar-motivo', 'reportar-detalle'], 'aviso-reportar');
        ocultarMensaje('aviso-mis-viajes');
        ocultarMensaje('exito-mis-viajes');

        const motivoPrincipal = selectMotivo.value;
        const detalle = campoDetalleReporte.value.trim();

        if (!motivoPrincipal) {
            marcarErrorCampo('reportar-motivo', 'Selecciona un motivo de reporte.');
            selectMotivo.focus();
            return;
        }

        if (motivoPrincipal === 'Otro motivo' && detalle.length < 3) {
            marcarErrorCampo('reportar-detalle', 'Describe brevemente qué sucedió.');
            campoDetalleReporte.focus();
            return;
        }

        const motivoCompleto = detalle ? motivoPrincipal + ': ' + detalle : motivoPrincipal;
        cambiarEstadoBoton(botonEnviarReporte, true, 'Enviando...');

        try {
            const respuesta = await fetch('/api/viajes/' + idViajeSeleccionado + '/reportar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: motivoCompleto })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-reportar', datos.mensaje);
                cambiarEstadoBoton(botonEnviarReporte, false);
                return;
            }

            modalReportar.classList.remove('visible');
            cambiarEstadoBoton(botonEnviarReporte, false);
            mostrarMensaje('exito-mis-viajes', datos.mensaje, 'exito');
            window.scrollTo(0, 0);
        } catch (error) {
            mostrarMensaje('aviso-reportar', 'Error de conexión al enviar el reporte.');
            cambiarEstadoBoton(botonEnviarReporte, false);
        }
    });

    async function cargarMisViajes() {
        try {
            const respuesta = await fetch('/api/viajes/mis-viajes');
            textoCargando.classList.add('formulario-oculto');

            if (!respuesta.ok) {
                mostrarMensaje('aviso-mis-viajes', 'No se pudo cargar la información de tus viajes.');
                return;
            }

            const datos = await respuesta.json();
            const viajesActuales = datos.viajes_actuales || (datos.viaje_actual ? [datos.viaje_actual] : []);
            const historial = datos.historial || [];

            if (viajesActuales.length === 0) {
                contenedorActual.innerHTML =
                    '<div class="tarjeta-blanca texto-centro">' +
                    '<p class="margen-abajo">No tienes ningún viaje activo en este momento.</p>' +
                    '<a href="/buscar.html" class="boton boton-principal">Buscar viajes disponibles</a>' +
                    '</div>';
            } else {
                contenedorActual.innerHTML = '';
                for (let i = 0; i < viajesActuales.length; i++) {
                    const viajeActual = viajesActuales[i];
                    const textoEstado = viajeActual.estado === 'en_curso' ? 'En curso' : 'Programado';
                    const claseTarjeta = viajeActual.es_violeta ? 'tarjeta-viaje tarjeta-violeta' : 'tarjeta-viaje';

                    contenedorActual.innerHTML +=
                        '<article class="' + claseTarjeta + '">' +
                        '<div class="cabecera-usuario">' +
                        '<span class="ruta-viaje">' + viajeActual.origen + ' -> ' + viajeActual.destino + '</span>' +
                        '<span class="insignia insignia-verde">' + textoEstado + '</span>' +
                        '</div>' +
                        '<p class="detalle-linea">Conductor: ' + viajeActual.conductor_nombre + '</p>' +
                        '<p class="detalle-linea">Pasajeros unidos: ' + viajeActual.pasajeros_unidos + '/' + viajeActual.lugares_totales + '</p>' +
                        '<a href="/mi-viaje.html?id=' + viajeActual.id + '" class="boton boton-principal margen-arriba">Ver detalle del viaje</a>' +
                        '</article>';
                }
            }

            if (historial.length === 0) {
                contenedorHistorial.innerHTML =
                    '<div class="tarjeta-blanca texto-centro">' +
                    '<p>Aún no tienes viajes anteriores en tu historial.</p>' +
                    '</div>';
                return;
            }

            contenedorHistorial.innerHTML = '';
            for (let i = 0; i < historial.length; i++) {
                const viaje = historial[i];
                const claseTarjeta = viaje.es_violeta ? 'tarjeta-viaje tarjeta-violeta' : 'tarjeta-viaje';
                const insigniaVioleta = viaje.es_violeta
                    ? '<span class="insignia insignia-violeta">' + iconoCorazonVioletaSvg() + ' Raity Violeta</span>'
                    : '';
                const etiquetaEstado = viaje.estado === 'cancelado'
                    ? '<span class="insignia insignia-gris">Cancelado</span>'
                    : '<span class="insignia insignia-verde">Terminado</span>';

                let botonCalificarHtml = '';
                if (viaje.id_conductor !== usuario.id && viaje.estado === 'terminado') {
                    if (viaje.ya_calificado) {
                        botonCalificarHtml = '<span class="insignia insignia-verde">Calificación enviada</span>';
                    } else {
                        botonCalificarHtml =
                            '<button type="button" class="boton boton-contorno-amarillo boton-calificar" data-id-viaje="' +
                            viaje.id + '" data-conductor="' + viaje.conductor_nombre + '">Calificar Conductor</button>';
                    }
                }

                contenedorHistorial.innerHTML +=
                    '<article class="' + claseTarjeta + '">' +
                    '<div class="cabecera-usuario">' +
                    '<span class="ruta-viaje">' + viaje.origen + ' -> ' + viaje.destino + '</span>' +
                    etiquetaEstado +
                    '</div>' +
                    '<p class="detalle-linea">' + formatearFechaCorta(viaje.fecha) + ' - ' + viaje.hora_salida + '</p>' +
                    '<div class="cabecera-usuario">' +
                    '<span class="detalle-linea">Conductor: ' + viaje.conductor_nombre + '</span>' +
                    insigniaVioleta +
                    '</div>' +
                    '<div class="acciones-historial">' +
                    '<button type="button" class="boton boton-contorno-rojo boton-reportar" data-id-viaje="' +
                    viaje.id + '" data-ruta="' + viaje.origen + ' -> ' + viaje.destino + '">Reportar</button>' +
                    botonCalificarHtml +
                    '</div>' +
                    '</article>';
            }

            const botonesReportar = contenedorHistorial.querySelectorAll('.boton-reportar');
            for (let i = 0; i < botonesReportar.length; i++) {
                botonesReportar[i].addEventListener('click', function () {
                    abrirModalReportar(
                        this.getAttribute('data-id-viaje'),
                        this.getAttribute('data-ruta')
                    );
                });
            }

            const botonesCalificar = contenedorHistorial.querySelectorAll('.boton-calificar');
            for (let i = 0; i < botonesCalificar.length; i++) {
                botonesCalificar[i].addEventListener('click', function () {
                    abrirModalCalificar(
                        this.getAttribute('data-id-viaje'),
                        this.getAttribute('data-conductor')
                    );
                });
            }
        } catch (error) {
            textoCargando.classList.add('formulario-oculto');
            mostrarMensaje('aviso-mis-viajes', 'Error de conexión al cargar tus viajes.');
        }
    }

    await cargarMisViajes();
});
