document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const textoCargando = document.getElementById('publicar-cargando');
    const cajaRequisitos = document.getElementById('caja-requisitos-publicar');
    const textoRequisitos = document.getElementById('texto-requisitos-publicar');
    const enlaceRequisitos = document.getElementById('enlace-requisitos-publicar');
    const formularioPublicar = document.getElementById('formulario-publicar');
    const selectVehiculo = document.getElementById('publicar-vehiculo');
    const selectRuta = document.getElementById('publicar-ruta');
    const selectAsientos = document.getElementById('publicar-asientos');
    const casillaVioleta = document.getElementById('publicar-violeta');
    const notaVioleta = document.getElementById('nota-raity-violeta');
    const botonPublicar = document.getElementById('boton-publicar-viaje');

    const camposValidar = ['publicar-origen', 'publicar-destino', 'publicar-hora'];
    let vehiculosDisponibles = [];
    let rutasDisponibles = [];

    function extraerOrigenDestino(nombreRuta) {
        if (!nombreRuta) {
            return null;
        }
        const separadores = ['->', ' a ', ' - ', '-'];
        for (let i = 0; i < separadores.length; i++) {
            const partes = nombreRuta.split(separadores[i]);
            if (partes.length === 2 && partes[0].trim() && partes[1].trim()) {
                return {
                    origen: partes[0].trim(),
                    destino: partes[1].trim()
                };
            }
        }
        return null;
    }

    function actualizarAsientosVehiculo() {
        const idVehiculo = Number(selectVehiculo.value);
        for (let i = 0; i < vehiculosDisponibles.length; i++) {
            const vehiculo = vehiculosDisponibles[i];
            if (vehiculo.id === idVehiculo && vehiculo.numero_asientos >= 1 && vehiculo.numero_asientos <= 4) {
                selectAsientos.value = String(vehiculo.numero_asientos);
                break;
            }
        }
    }

    function mostrarMapaRutaSeleccionada(actualizarTextos) {
        const idRuta = Number(selectRuta.value);
        for (let i = 0; i < rutasDisponibles.length; i++) {
            const ruta = rutasDisponibles[i];
            if (ruta.id === idRuta) {
                dibujarRutaEnMapa(
                    'mapa-previa-publicar',
                    ruta.latitud_origen,
                    ruta.longitud_origen,
                    ruta.latitud_destino,
                    ruta.longitud_destino,
                    {
                        conControles: true,
                        interactivo: true,
                        esVioleta: casillaVioleta.checked
                    }
                );

                if (actualizarTextos) {
                    const partes = extraerOrigenDestino(ruta.nombre);
                    if (partes) {
                        document.getElementById('publicar-origen').value = partes.origen;
                        document.getElementById('publicar-destino').value = partes.destino;
                    }
                }
                break;
            }
        }
    }

    try {
        const respuestaVehiculos = await fetch('/api/vehiculos');
        const datosVehiculos = await respuestaVehiculos.json();
        vehiculosDisponibles = datosVehiculos.vehiculos || [];

        if (vehiculosDisponibles.length === 0) {
            textoCargando.classList.add('formulario-oculto');
            textoRequisitos.textContent = 'Para publicar un viaje primero debes registrar tu vehículo.';
            enlaceRequisitos.href = '/registro-vehiculo.html';
            enlaceRequisitos.textContent = 'Registrar vehículo';
            cajaRequisitos.classList.remove('formulario-oculto');
            return;
        }

        const respuestaRutas = await fetch('/api/rutas-guardadas');
        const datosRutas = await respuestaRutas.json();
        rutasDisponibles = datosRutas.rutas || [];

        if (rutasDisponibles.length === 0) {
            textoCargando.classList.add('formulario-oculto');
            textoRequisitos.textContent = 'Ya tienes un vehículo registrado. Ahora guarda una ruta en el mapa para poder publicar.';
            enlaceRequisitos.href = '/registro-ruta.html';
            enlaceRequisitos.textContent = 'Registrar ruta';
            cajaRequisitos.classList.remove('formulario-oculto');
            return;
        }

        for (let i = 0; i < vehiculosDisponibles.length; i++) {
            const vehiculo = vehiculosDisponibles[i];
            const opcion = document.createElement('option');
            opcion.value = vehiculo.id;
            opcion.textContent = vehiculo.modelo + ' - ' + vehiculo.matricula + ' (' + vehiculo.color + ')';
            selectVehiculo.appendChild(opcion);
        }

        for (let i = 0; i < rutasDisponibles.length; i++) {
            const ruta = rutasDisponibles[i];
            const opcion = document.createElement('option');
            opcion.value = ruta.id;
            opcion.textContent = ruta.nombre;
            selectRuta.appendChild(opcion);
        }

        if (usuario.genero !== 'Mujer') {
            casillaVioleta.disabled = true;
            notaVioleta.textContent = 'Solo las usuarias con género Mujer pueden publicar en la modalidad Raity Violeta.';
        }

        textoCargando.classList.add('formulario-oculto');
        formularioPublicar.classList.remove('formulario-oculto');

        actualizarAsientosVehiculo();
        mostrarMapaRutaSeleccionada(true);
        activarRespaldoFormulario('formulario-publicar', 'raity_respaldo_publicar');
        mostrarMapaRutaSeleccionada(false);
    } catch (error) {
        textoCargando.classList.add('formulario-oculto');
        mostrarMensaje('aviso-publicar', 'Error al cargar tus vehículos y rutas. Recarga la página para intentar de nuevo.');
    }

    selectVehiculo.addEventListener('change', actualizarAsientosVehiculo);
    selectRuta.addEventListener('change', function () {
        mostrarMapaRutaSeleccionada(true);
    });
    casillaVioleta.addEventListener('change', function () {
        mostrarMapaRutaSeleccionada(false);
    });

    formularioPublicar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(camposValidar, 'aviso-publicar');

        const origen = document.getElementById('publicar-origen').value.trim();
        const destino = document.getElementById('publicar-destino').value.trim();
        const horaSalida = document.getElementById('publicar-hora').value.trim();
        const lugaresTotales = selectAsientos.value;
        const idVehiculo = selectVehiculo.value;
        const idRuta = selectRuta.value;
        const esVioleta = casillaVioleta.checked;

        let primerError = null;
        if (!origen) {
            marcarErrorCampo('publicar-origen', 'Escribe el punto de salida del viaje.');
            primerError = 'publicar-origen';
        }
        if (!destino) {
            marcarErrorCampo('publicar-destino', 'Escribe el destino del viaje.');
            if (!primerError) {
                primerError = 'publicar-destino';
            }
        }
        if (!horaSalida) {
            marcarErrorCampo('publicar-hora', 'Selecciona una hora de salida.');
            if (!primerError) {
                primerError = 'publicar-hora';
            }
        }

        if (primerError) {
            mostrarMensaje('aviso-publicar', 'Completa los campos marcados antes de publicar tu viaje.');
            document.getElementById(primerError).focus();
            return;
        }

        cambiarEstadoBoton(botonPublicar, true, 'Publicando viaje...');

        try {
            const respuesta = await fetch('/api/viajes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_vehiculo: idVehiculo,
                    id_ruta: idRuta,
                    origen: origen,
                    destino: destino,
                    hora_salida: horaSalida,
                    lugares_totales: lugaresTotales,
                    es_violeta: esVioleta
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-publicar', datos.mensaje);
                cambiarEstadoBoton(botonPublicar, false);
                return;
            }

            limpiarRespaldoFormulario('raity_respaldo_publicar');
            window.location.href = '/mi-viaje.html?id=' + datos.viaje.id;
        } catch (error) {
            mostrarMensaje('aviso-publicar', 'Error de conexión al publicar el viaje. Tus datos siguen guardados en pantalla.');
            cambiarEstadoBoton(botonPublicar, false);
        }
    });
});
