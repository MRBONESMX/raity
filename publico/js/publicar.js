document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const cajaRequisitos = document.getElementById('caja-requisitos-publicar');
    const textoRequisitos = document.getElementById('texto-requisitos-publicar');
    const enlaceRequisitos = document.getElementById('enlace-requisitos-publicar');
    const formularioPublicar = document.getElementById('formulario-publicar');
    const selectVehiculo = document.getElementById('publicar-vehiculo');
    const selectRuta = document.getElementById('publicar-ruta');
    const casillaVioleta = document.getElementById('publicar-violeta');
    const notaVioleta = document.getElementById('nota-raity-violeta');

    let rutasDisponibles = [];

    function mostrarMapaRutaSeleccionada() {
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

                const partes = ruta.nombre.split('->');
                if (partes.length === 2) {
                    document.getElementById('publicar-origen').value = partes[0].trim();
                    document.getElementById('publicar-destino').value = partes[1].trim();
                }
                break;
            }
        }
    }

    try {
        const respuestaVehiculos = await fetch('/api/vehiculos');
        const datosVehiculos = await respuestaVehiculos.json();
        const vehiculos = datosVehiculos.vehiculos || [];

        if (vehiculos.length === 0) {
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
            textoRequisitos.textContent = 'Ya tienes un vehículo registrado. Ahora guarda una ruta en el mapa para poder publicar.';
            enlaceRequisitos.href = '/registro-ruta.html';
            enlaceRequisitos.textContent = 'Registrar ruta';
            cajaRequisitos.classList.remove('formulario-oculto');
            return;
        }

        for (let i = 0; i < vehiculos.length; i++) {
            const vehiculo = vehiculos[i];
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

        formularioPublicar.classList.remove('formulario-oculto');
        mostrarMapaRutaSeleccionada();
    } catch (error) {
        mostrarMensaje('aviso-publicar', 'Error al cargar tus vehículos y rutas.');
    }

    selectRuta.addEventListener('change', mostrarMapaRutaSeleccionada);
    casillaVioleta.addEventListener('change', mostrarMapaRutaSeleccionada);

    formularioPublicar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        ocultarMensaje('aviso-publicar');

        const origen = document.getElementById('publicar-origen').value.trim();
        const destino = document.getElementById('publicar-destino').value.trim();
        const horaSalida = document.getElementById('publicar-hora').value.trim();
        const lugaresTotales = document.getElementById('publicar-asientos').value;
        const idVehiculo = selectVehiculo.value;
        const idRuta = selectRuta.value;
        const esVioleta = casillaVioleta.checked;

        if (!origen || !destino || !horaSalida) {
            mostrarMensaje('aviso-publicar', 'Por favor, completa origen, destino y hora de salida.');
            return;
        }

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
                return;
            }

            window.location.href = '/mi-viaje.html?id=' + datos.viaje.id;
        } catch (error) {
            mostrarMensaje('aviso-publicar', 'Error de conexión al publicar el viaje.');
        }
    });
});
