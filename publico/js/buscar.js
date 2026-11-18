document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const campoBuscar = document.getElementById('campo-buscar');
    const listaViajes = document.getElementById('lista-viajes');
    const contadorViajes = document.getElementById('contador-viajes');
    const filtroVioleta = document.getElementById('filtro-violeta');
    const botonesFiltro = document.querySelectorAll('.chip-filtro');

    let temporizadorBusqueda = null;
    let filtroActivo = 'todos';
    let idsViajesActivos = {};

    if (usuario.genero === 'Mujer' && filtroVioleta) {
        filtroVioleta.classList.remove('formulario-oculto');
    }

    try {
        const respuestaActivos = await fetch('/api/viajes/mis-viajes');
        if (respuestaActivos.ok) {
            const datosActivos = await respuestaActivos.json();
            const listaActivos = datosActivos.viajes_actuales || [];
            for (let i = 0; i < listaActivos.length; i++) {
                idsViajesActivos[listaActivos[i].id] = true;
            }
        }
    } catch (errorSecundario) {
        console.log('No se pudieron comprobar reservaciones previas.');
    }

    async function reservarAsiento(idViaje, botonPresionado) {
        ocultarMensaje('aviso-buscar');
        cambiarEstadoBoton(botonPresionado, true, 'Reservando asiento...');

        try {
            const respuesta = await fetch('/api/reservaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_viaje: idViaje })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-buscar', datos.mensaje);
                cambiarEstadoBoton(botonPresionado, false);
                window.scrollTo(0, 0);
                return;
            }

            window.location.href = '/mi-viaje.html?id=' + idViaje + '&solicitar_gps=1';
        } catch (error) {
            mostrarMensaje('aviso-buscar', 'Error de conexión al intentar reservar. Verifica tu internet e intenta de nuevo.');
            cambiarEstadoBoton(botonPresionado, false);
        }
    }

    function aplicarFiltroRapido(viajes) {
        if (filtroActivo === 'todos') {
            return viajes;
        }
        const filtrados = [];
        for (let i = 0; i < viajes.length; i++) {
            const viaje = viajes[i];
            const textoDestino = (viaje.destino + ' ' + viaje.origen).toLowerCase();
            if (filtroActivo === 'uabcs') {
                if (
                    textoDestino.indexOf('uabcs') !== -1 ||
                    textoDestino.indexOf('pesquerías') !== -1 ||
                    textoDestino.indexOf('sistemas') !== -1 ||
                    textoDestino.indexOf('ingeniería') !== -1
                ) {
                    filtrados.push(viaje);
                }
            } else if (filtroActivo === 'santafe') {
                if (textoDestino.indexOf('santa fe') !== -1) {
                    filtrados.push(viaje);
                }
            } else if (filtroActivo === 'violeta') {
                if (viaje.es_violeta) {
                    filtrados.push(viaje);
                }
            }
        }
        return filtrados;
    }

    async function cargarViajes(textoBusqueda) {
        ocultarMensaje('aviso-buscar');
        contadorViajes.textContent = 'Cargando viajes disponibles...';

        let rutaConsulta = '/api/viajes';
        if (textoBusqueda && textoBusqueda.trim() !== '') {
            rutaConsulta = '/api/viajes?busqueda=' + encodeURIComponent(textoBusqueda.trim());
        }

        try {
            const respuesta = await fetch(rutaConsulta);
            if (!respuesta.ok) {
                contadorViajes.textContent = 'No se pudieron cargar los viajes.';
                mostrarMensaje('aviso-buscar', 'No se pudieron cargar los viajes disponibles.');
                return;
            }

            const datos = await respuesta.json();
            const viajes = aplicarFiltroRapido(datos.viajes || []);

            if (viajes.length === 1) {
                contadorViajes.textContent = 'Mostrando 1 viaje disponible.';
            } else {
                contadorViajes.textContent = 'Mostrando ' + viajes.length + ' viajes disponibles.';
            }

            listaViajes.innerHTML = '';

            if (viajes.length === 0) {
                listaViajes.innerHTML =
                    '<div class="tarjeta-blanca texto-centro">' +
                    '<p class="margen-abajo">No se encontraron viajes disponibles con ese criterio.</p>' +
                    '<button type="button" id="boton-limpiar-busqueda" class="boton boton-secundario">Ver todos los viajes</button>' +
                    '</div>';

                const botonLimpiar = document.getElementById('boton-limpiar-busqueda');
                botonLimpiar.addEventListener('click', function () {
                    campoBuscar.value = '';
                    filtroActivo = 'todos';
                    for (let j = 0; j < botonesFiltro.length; j++) {
                        const esTodos = botonesFiltro[j].getAttribute('data-filtro') === 'todos';
                        botonesFiltro[j].classList.toggle('activo', esTodos);
                        botonesFiltro[j].setAttribute('aria-pressed', esTodos ? 'true' : 'false');
                    }
                    cargarViajes('');
                });
                return;
            }

            for (let i = 0; i < viajes.length; i++) {
                const viaje = viajes[i];
                const esMio = viaje.id_conductor === usuario.id;
                const yaReservado = Boolean(idsViajesActivos[viaje.id]);
                const claseTarjeta = viaje.es_violeta ? 'tarjeta-viaje tarjeta-violeta' : 'tarjeta-viaje';

                let insigniaSuperior = '';
                if (viaje.es_violeta) {
                    insigniaSuperior = '<span class="insignia insignia-violeta">' + iconoCorazonVioletaSvg() + ' Raity Violeta</span>';
                } else if (esMio) {
                    insigniaSuperior = '<span class="insignia insignia-gris">Tu viaje publicado</span>';
                } else if (yaReservado) {
                    insigniaSuperior = '<span class="insignia insignia-verde">Asiento apartado</span>';
                }

                let accionTarjeta = '';
                if (esMio) {
                    accionTarjeta =
                        '<a href="/mi-viaje.html?id=' + viaje.id + '" class="boton boton-secundario">Administrar mi viaje</a>';
                } else if (yaReservado) {
                    accionTarjeta =
                        '<a href="/mi-viaje.html?id=' + viaje.id + '" class="boton boton-verde">Ver mi viaje reservado</a>';
                } else {
                    const claseBoton = viaje.es_violeta ? 'boton boton-violeta' : 'boton boton-principal';
                    const textoBoton = viaje.es_violeta ? 'Reservar Asiento (Solo Mujeres)' : 'Reservar Asiento';
                    accionTarjeta =
                        '<button type="button" class="' + claseBoton + '" data-id-viaje="' + viaje.id + '">' + textoBoton + '</button>';
                }

                const htmlTarjeta =
                    '<article class="' + claseTarjeta + '">' +
                    '<div>' +
                    '<div class="cabecera-usuario">' +
                    '<div class="info-usuario-fila">' +
                    '<span class="avatar-iniciales">' + obtenerIniciales(viaje.conductor_nombre) + '</span>' +
                    '<div>' +
                    '<span class="nombre-conductor">' + viaje.conductor_nombre + '</span>' +
                    '<span class="calificacion-linea">' + iconoEstrellaSvg() + ' ' + Number(viaje.conductor_calificacion).toFixed(1) + '</span>' +
                    '</div>' +
                    '</div>' +
                    insigniaSuperior +
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
                    '</div>' +
                    accionTarjeta +
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
                    reservarAsiento(idSeleccionado, this);
                });
            }
        } catch (error) {
            contadorViajes.textContent = 'Error de conexión al buscar viajes.';
            mostrarMensaje('aviso-buscar', 'Error de conexión al buscar viajes.');
        }
    }

    for (let i = 0; i < botonesFiltro.length; i++) {
        botonesFiltro[i].addEventListener('click', function () {
            filtroActivo = this.getAttribute('data-filtro');
            for (let j = 0; j < botonesFiltro.length; j++) {
                const estaActivo = botonesFiltro[j] === this;
                botonesFiltro[j].classList.toggle('activo', estaActivo);
                botonesFiltro[j].setAttribute('aria-pressed', estaActivo ? 'true' : 'false');
            }
            cargarViajes(campoBuscar.value);
        });
    }

    campoBuscar.addEventListener('input', function () {
        if (temporizadorBusqueda) {
            clearTimeout(temporizadorBusqueda);
        }
        temporizadorBusqueda = setTimeout(function () {
            cargarViajes(campoBuscar.value);
        }, 250);
    });

    const parametros = new URLSearchParams(window.location.search);
    const busquedaInicial = parametros.get('busqueda');
    if (busquedaInicial) {
        campoBuscar.value = busquedaInicial;
        cargarViajes(busquedaInicial);
    } else {
        cargarViajes('');
    }
});
