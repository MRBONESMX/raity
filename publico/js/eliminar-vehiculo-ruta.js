document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const selectVehiculo = document.getElementById('eliminar-select-vehiculo');
    const selectRuta = document.getElementById('eliminar-select-ruta');
    const resumenVehiculo = document.getElementById('resumen-vehiculo-eliminar');
    const botonEliminarVehiculo = document.getElementById('boton-eliminar-vehiculo');
    const botonEliminarRuta = document.getElementById('boton-eliminar-ruta');
    const mapaContenedor = document.getElementById('mapa-eliminar-ruta');

    let vehiculosDisponibles = [];
    let rutasDisponibles = [];

    function actualizarResumenVehiculo() {
        const idVehiculo = Number(selectVehiculo.value);
        for (let i = 0; i < vehiculosDisponibles.length; i++) {
            const vehiculo = vehiculosDisponibles[i];
            if (vehiculo.id === idVehiculo) {
                resumenVehiculo.textContent =
                    'Vehículo seleccionado: ' + vehiculo.modelo +
                    ' | Matrícula: ' + vehiculo.matricula +
                    ' | Color: ' + vehiculo.color +
                    ' | Asientos: ' + vehiculo.numero_asientos;
                resumenVehiculo.classList.remove('formulario-oculto');
                return;
            }
        }
        resumenVehiculo.classList.add('formulario-oculto');
    }

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
            vehiculosDisponibles = datosVehiculos.vehiculos || [];

            selectVehiculo.innerHTML = '';
            if (vehiculosDisponibles.length === 0) {
                selectVehiculo.innerHTML = '<option value="">No tienes vehículos registrados</option>';
                botonEliminarVehiculo.disabled = true;
                resumenVehiculo.classList.add('formulario-oculto');
            } else {
                botonEliminarVehiculo.disabled = false;
                for (let i = 0; i < vehiculosDisponibles.length; i++) {
                    const vehiculo = vehiculosDisponibles[i];
                    const opcion = document.createElement('option');
                    opcion.value = vehiculo.id;
                    opcion.textContent = vehiculo.modelo + ' | ' + vehiculo.matricula + ' | ' + vehiculo.color;
                    selectVehiculo.appendChild(opcion);
                }
                actualizarResumenVehiculo();
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

    selectVehiculo.addEventListener('change', actualizarResumenVehiculo);
    selectRuta.addEventListener('change', dibujarRutaSeleccionada);

    botonEliminarVehiculo.addEventListener('click', function () {
        ocultarMensaje('aviso-eliminar');
        ocultarMensaje('exito-eliminar');
        const idVehiculo = selectVehiculo.value;
        if (!idVehiculo) {
            return;
        }
        const textoSeleccion = selectVehiculo.options[selectVehiculo.selectedIndex].textContent;

        pedirConfirmacion(
            'Eliminar vehículo',
            '¿Estás seguro de que deseas eliminar este vehículo (' + textoSeleccion + ')? Esta acción no se puede deshacer.',
            'Sí, eliminar vehículo',
            async function () {
                cambiarEstadoBoton(botonEliminarVehiculo, true, 'Eliminando...');
                try {
                    const respuesta = await fetch('/api/vehiculos/' + idVehiculo, { method: 'DELETE' });
                    const datos = await respuesta.json();
                    cambiarEstadoBoton(botonEliminarVehiculo, false);

                    if (!respuesta.ok) {
                        mostrarMensaje('aviso-eliminar', datos.mensaje);
                        return;
                    }

                    mostrarMensaje('exito-eliminar', datos.mensaje, 'exito');
                    await cargarListas();
                } catch (error) {
                    cambiarEstadoBoton(botonEliminarVehiculo, false);
                    mostrarMensaje('aviso-eliminar', 'Error de conexión al eliminar el vehículo.');
                }
            }
        );
    });

    botonEliminarRuta.addEventListener('click', function () {
        ocultarMensaje('aviso-eliminar');
        ocultarMensaje('exito-eliminar');
        const idRuta = selectRuta.value;
        if (!idRuta) {
            return;
        }
        const textoSeleccion = selectRuta.options[selectRuta.selectedIndex].textContent;

        pedirConfirmacion(
            'Eliminar ruta guardada',
            '¿Estás seguro de que deseas eliminar la ruta "' + textoSeleccion + '"? Esta acción no se puede deshacer.',
            'Sí, eliminar ruta',
            async function () {
                cambiarEstadoBoton(botonEliminarRuta, true, 'Eliminando...');
                try {
                    const respuesta = await fetch('/api/rutas-guardadas/' + idRuta, { method: 'DELETE' });
                    const datos = await respuesta.json();
                    cambiarEstadoBoton(botonEliminarRuta, false);

                    if (!respuesta.ok) {
                        mostrarMensaje('aviso-eliminar', datos.mensaje);
                        return;
                    }

                    mostrarMensaje('exito-eliminar', datos.mensaje, 'exito');
                    await cargarListas();
                } catch (error) {
                    cambiarEstadoBoton(botonEliminarRuta, false);
                    mostrarMensaje('aviso-eliminar', 'Error de conexión al eliminar la ruta.');
                }
            }
        );
    });

    await cargarListas();
});
