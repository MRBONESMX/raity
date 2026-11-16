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

    saludoUsuario.textContent = '¡Hola, ' + usuario.nombre_completo + '!';

    botonNotificaciones.addEventListener('click', function () {
        mostrarAvisoProximamente('Notificaciones');
    });

    botonCerrarDestacada.addEventListener('click', function () {
        tarjetaDestacada.classList.add('formulario-oculto');
    });

    const mapaExplorar = L.map('mapa-explorar', { zoomControl: false }).setView([24.115, -110.32], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(mapaExplorar);

    try {
        const respuesta = await fetch('/api/viajes');
        if (!respuesta.ok) {
            chipViajesCercanos.textContent = 'No se pudieron cargar los viajes';
            return;
        }

        const datos = await respuesta.json();
        const viajes = datos.viajes;

        if (viajes.length === 1) {
            chipViajesCercanos.textContent = '1 viaje cerca de ti';
        } else {
            chipViajesCercanos.textContent = viajes.length + ' viajes cerca de ti';
        }

        for (let i = 0; i < viajes.length; i++) {
            const viaje = viajes[i];
            const colorMarcador = viaje.es_violeta ? '#A754F5' : '#07B5D5';

            const marcador = L.circleMarker(
                [Number(viaje.latitud_origen), Number(viaje.longitud_origen)],
                {
                    radius: 9,
                    color: '#FFFFFF',
                    weight: 2,
                    fillColor: colorMarcador,
                    fillOpacity: 1
                }
            ).addTo(mapaExplorar);

            marcador.bindPopup(
                '<strong>' + viaje.origen + ' -> ' + viaje.destino + '</strong><br>' +
                'Conductor: ' + viaje.conductor_nombre + '<br>' +
                'Salida: ' + viaje.hora_salida + ' (' + viaje.lugares_disponibles + ' lugares)'
            );
        }

        if (viajes.length > 0) {
            const destacado = viajes[0];
            document.getElementById('destacada-lugares').textContent =
                'Asientos disponibles: ' + destacado.lugares_disponibles;
            document.getElementById('destacada-ruta').textContent =
                destacado.origen + ' -> ' + destacado.destino;
            document.getElementById('destacada-iniciales').textContent =
                obtenerIniciales(destacado.conductor_nombre);
            document.getElementById('destacada-conductor').textContent =
                destacado.conductor_nombre;
            document.getElementById('destacada-calificacion').innerHTML =
                iconoEstrellaSvg() + ' ' + Number(destacado.conductor_calificacion).toFixed(1);

            if (destacado.es_violeta) {
                tarjetaDestacada.classList.add('tarjeta-violeta');
            }
            tarjetaDestacada.classList.remove('formulario-oculto');
        }
    } catch (error) {
        chipViajesCercanos.textContent = 'Error de conexión al cargar mapa';
    }
});
