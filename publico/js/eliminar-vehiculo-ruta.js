document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const selectVehiculo = document.getElementById('eliminar-select-vehiculo');
    const selectRuta = document.getElementById('eliminar-select-ruta');
    const botonEliminarVehiculo = document.getElementById('boton-eliminar-vehiculo');
    const botonEliminarRuta = document.getElementById('boton-eliminar-ruta');
    const mapaContenedor = document.getElementById('mapa-eliminar-ruta');

    let rutasDisponibles = [];

    function dibujarRutaSeleccionada() {
        const idRuta = Number(selectRuta.value);
        for (let i = 0; i < rutasDisponibles.length; i++) {
            const ruta = rutasDisponibles[i];
            if (ruta.id === idRuta) {
                dibujarRutaEnMapa(
                    'mapa-eliminar-ruta',
                    ruta.latitud_origen,
                    ruta.longitud_origen,
                    ruta.latitud_destino,
                    ruta.longitud_destino,
                    {
                        conControles: false,
                        interactivo: false
                    }
                );
                break;
            }
        }
    }

    async function cargarListas() {
        try {
            const respuestaVehiculos = await fetch('/api/vehiculos');
            const datosVehiculos = await respuestaVehiculos.json();
            const vehiculos = datosVehiculos.vehiculos || [];

            selectVehiculo.innerHTML = '';
            if (vehiculos.length === 0) {
                selectVehiculo.innerHTML = '<option value="">No tienes vehículos registrados</option>';
                botonEliminarVehiculo.disabled = true;
            } else {
                botonEliminarVehiculo.disabled = false;
                for (let i = 0; i < vehiculos.length; i++) {
                    const vehiculo = vehiculos[i];
                    const opcion = document.createElement('option');
                    opcion.value = vehiculo.id;
                    opcion.textContent = vehiculo.modelo + ' | ' + vehiculo.matricula + ' | ' + vehiculo.color;
                    selectVehiculo.appendChild(opcion);
                }
            }

            const respuestaRutas = await fetch('/api/rutas-guardadas');
            const datosRutas = await respuestaRutas.json();
            rutasDisponibles = datosRutas.rutas || [];

            selectRuta.innerHTML = '';
            if (rutasDisponibles.length === 0) {
                selectRuta.innerHTML = '<option value="">No tienes rutas guardadas</option>';
                botonEliminarRuta.disabled = true;
                mapaContenedor.classList.add('formulario-oculto');
            } else {
                botonEliminarRuta.disabled = false;
                mapaContenedor.classList.remove('formulario-oculto');
                for (let i = 0; i < rutasDisponibles.length; i++) {
                    const ruta = rutasDisponibles[i];
                    const opcion = document.createElement('option');
                    opcion.value = ruta.id;
                    opcion.textContent = ruta.nombre;
                    selectRuta.appendChild(opcion);
                }
                dibujarRutaSeleccionada();
            }
        } catch (error) {
            mostrarMensaje('aviso-eliminar', 'Error al cargar vehículos y rutas.');
        }
    }

    selectRuta.addEventListener('change', dibujarRutaSeleccionada);

    botonEliminarVehiculo.addEventListener('click', async function () {
        ocultarMensaje('aviso-eliminar');
        ocultarMensaje('exito-eliminar');
        const idVehiculo = selectVehiculo.value;
        if (!idVehiculo) {
            return;
        }

        try {
            const respuesta = await fetch('/api/vehiculos/' + idVehiculo, { method: 'DELETE' });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-eliminar', datos.mensaje);
                return;
            }

            mostrarMensaje('exito-eliminar', datos.mensaje);
            await cargarListas();
        } catch (error) {
            mostrarMensaje('aviso-eliminar', 'Error de conexión al eliminar el vehículo.');
        }
    });

    botonEliminarRuta.addEventListener('click', async function () {
        ocultarMensaje('aviso-eliminar');
        ocultarMensaje('exito-eliminar');
        const idRuta = selectRuta.value;
        if (!idRuta) {
            return;
        }

        try {
            const respuesta = await fetch('/api/rutas-guardadas/' + idRuta, { method: 'DELETE' });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-eliminar', datos.mensaje);
                return;
            }

            mostrarMensaje('exito-eliminar', datos.mensaje);
            await cargarListas();
        } catch (error) {
            mostrarMensaje('aviso-eliminar', 'Error de conexión al eliminar la ruta.');
        }
    });

    await cargarListas();
});
