document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const contenedorActual = document.getElementById('contenedor-viaje-actual');
    const contenedorHistorial = document.getElementById('contenedor-historial');

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

    try {
        const respuesta = await fetch('/api/viajes/mis-viajes');
        if (!respuesta.ok) {
            mostrarMensaje('aviso-mis-viajes', 'No se pudo cargar la información de tus viajes.');
            return;
        }

        const datos = await respuesta.json();
        const viajesActuales = datos.viajes_actuales || (datos.viaje_actual ? [datos.viaje_actual] : []);
        const historial = datos.historial;

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
                '<button type="button" class="boton boton-contorno-rojo boton-reportar">Reportar</button>' +
                '<button type="button" class="boton boton-contorno-amarillo boton-calificar">Calificar Conductor</button>' +
                '</div>' +
                '</article>';
        }

        const botonesReportar = contenedorHistorial.querySelectorAll('.boton-reportar');
        for (let i = 0; i < botonesReportar.length; i++) {
            botonesReportar[i].addEventListener('click', function () {
                mostrarAvisoProximamente('Reportar viaje');
            });
        }

        const botonesCalificar = contenedorHistorial.querySelectorAll('.boton-calificar');
        for (let i = 0; i < botonesCalificar.length; i++) {
            botonesCalificar[i].addEventListener('click', function () {
                mostrarAvisoProximamente('Calificar Conductor');
            });
        }
    } catch (error) {
        mostrarMensaje('aviso-mis-viajes', 'Error de conexión al cargar tus viajes.');
    }
});
