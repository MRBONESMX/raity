document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const campoBuscar = document.getElementById('campo-buscar');
    const listaViajes = document.getElementById('lista-viajes');
    let temporizadorBusqueda = null;

    async function reservarAsiento(idViaje) {
        ocultarMensaje('aviso-buscar');
        try {
            const respuesta = await fetch('/api/reservaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_viaje: idViaje })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-buscar', datos.mensaje);
                window.scrollTo(0, 0);
                return;
            }

            window.location.href = '/mi-viaje.html?id=' + idViaje;
        } catch (error) {
            mostrarMensaje('aviso-buscar', 'Error de conexión al intentar reservar.');
        }
    }

    async function cargarViajes(textoBusqueda) {
        ocultarMensaje('aviso-buscar');
        let rutaConsulta = '/api/viajes';
        if (textoBusqueda && textoBusqueda.trim() !== '') {
            rutaConsulta = '/api/viajes?busqueda=' + encodeURIComponent(textoBusqueda.trim());
        }

        try {
            const respuesta = await fetch(rutaConsulta);
            if (!respuesta.ok) {
                mostrarMensaje('aviso-buscar', 'No se pudieron cargar los viajes disponibles.');
                return;
            }

            const datos = await respuesta.json();
            const viajes = datos.viajes;

            listaViajes.innerHTML = '';

            if (viajes.length === 0) {
                listaViajes.innerHTML =
                    '<div class="tarjeta-blanca texto-centro">' +
                    '<p>No se encontraron viajes disponibles.</p>' +
                    '</div>';
                return;
            }

            for (let i = 0; i < viajes.length; i++) {
                const viaje = viajes[i];
                const claseTarjeta = viaje.es_violeta ? 'tarjeta-viaje tarjeta-violeta' : 'tarjeta-viaje';
                const insigniaVioleta = viaje.es_violeta
                    ? '<span class="insignia insignia-violeta">' + iconoCorazonVioletaSvg() + ' Raity Violeta</span>'
                    : '';
                const claseBoton = viaje.es_violeta ? 'boton boton-violeta' : 'boton boton-principal';
                const textoBoton = viaje.es_violeta ? 'Reservar Asiento (Solo Mujeres)' : 'Reservar Asiento';

                const htmlTarjeta =
                    '<article class="' + claseTarjeta + '">' +
                    '<div class="cabecera-usuario">' +
                    '<div class="info-usuario-fila">' +
                    '<span class="avatar-iniciales">' + obtenerIniciales(viaje.conductor_nombre) + '</span>' +
                    '<div>' +
                    '<span class="nombre-conductor">' + viaje.conductor_nombre + '</span>' +
                    '<span class="calificacion-linea">' + iconoEstrellaSvg() + ' ' + Number(viaje.conductor_calificacion).toFixed(1) + '</span>' +
                    '</div>' +
                    '</div>' +
                    insigniaVioleta +
                    '</div>' +
                    '<p class="ruta-viaje">' + viaje.origen + ' -> ' + viaje.destino + '</p>' +
                    '<p class="detalle-linea">' + iconoAutoSvg() + '<span>' + viaje.vehiculo_matricula + ' - ' + viaje.vehiculo_modelo + ' - ' + viaje.vehiculo_color + '</span></p>' +
                    '<div class="fila-tiempo-lugares">' +
                    '<span class="detalle-linea">' + iconoRelojSvg() + '<span>Sale a las ' + viaje.hora_salida + '</span></span>' +
                    '<span class="insignia insignia-verde">Asientos disponibles: ' + viaje.lugares_disponibles + '</span>' +
                    '</div>' +
                    '<div class="caja-minimapa">' +
                    '<div id="minimapa-viaje-' + viaje.id + '" class="minimapa"></div>' +
                    '<span class="etiqueta-gps">Vista ruta GPS</span>' +
                    '</div>' +
                    '<button type="button" class="' + claseBoton + '" data-id-viaje="' + viaje.id + '">' + textoBoton + '</button>' +
                    '</article>';

                listaViajes.innerHTML += htmlTarjeta;
            }

            for (let i = 0; i < viajes.length; i++) {
                const viaje = viajes[i];
                dibujarRutaEnMapa(
                    'minimapa-viaje-' + viaje.id,
                    viaje.latitud_origen,
                    viaje.longitud_origen,
                    viaje.latitud_destino,
                    viaje.longitud_destino,
                    {
                        conControles: false,
                        interactivo: false,
                        esVioleta: viaje.es_violeta
                    }
                );
            }

            const botonesReservar = listaViajes.querySelectorAll('button[data-id-viaje]');
            for (let i = 0; i < botonesReservar.length; i++) {
                botonesReservar[i].addEventListener('click', function () {
                    const idSeleccionado = this.getAttribute('data-id-viaje');
                    reservarAsiento(idSeleccionado);
                });
            }
        } catch (error) {
            mostrarMensaje('aviso-buscar', 'Error de conexión al buscar viajes.');
        }
    }

    campoBuscar.addEventListener('input', function () {
        if (temporizadorBusqueda) {
            clearTimeout(temporizadorBusqueda);
        }
        temporizadorBusqueda = setTimeout(function () {
            cargarViajes(campoBuscar.value);
        }, 250);
    });

    cargarViajes('');
});
