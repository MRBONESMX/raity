document.addEventListener('DOMContentLoaded', async function () {
    const usuarioSesion = await verificarSesion();
    if (!usuarioSesion) {
        return;
    }

    const bloqueSinVehiculo = document.getElementById('bloque-sin-vehiculo');
    const bloqueConductor = document.getElementById('bloque-conductor');
    const selectVehiculos = document.getElementById('select-perfil-vehiculos');
    const selectRutas = document.getElementById('select-perfil-rutas');
    const mapaPerfilRuta = document.getElementById('mapa-perfil-ruta');
    const textoSinRutas = document.getElementById('texto-sin-rutas');
    const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

    let rutasGuardadas = [];

    function actualizarMapaPerfil() {
        const idRuta = Number(selectRutas.value);
        for (let i = 0; i < rutasGuardadas.length; i++) {
            const ruta = rutasGuardadas[i];
            if (ruta.id === idRuta) {
                dibujarRutaEnMapa(
                    'mapa-perfil-ruta',
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

    try {
        const respuesta = await fetch('/api/usuarios/perfil');
        if (!respuesta.ok) {
            mostrarMensaje('aviso-perfil', 'No se pudo cargar tu perfil.');
            return;
        }

        const datos = await respuesta.json();
        const usuario = datos.usuario;
        const vehiculos = datos.vehiculos || [];
        rutasGuardadas = datos.rutas_guardadas || [];

        document.getElementById('perfil-iniciales').textContent = obtenerIniciales(usuario.nombre_completo);
        document.getElementById('perfil-nombre').textContent = usuario.nombre_completo;
        document.getElementById('perfil-calificacion').innerHTML =
            iconoEstrellaSvg() + ' ' + Number(datos.calificacion).toFixed(1);
        document.getElementById('perfil-correo').textContent = usuario.correo_institucional;
        document.getElementById('perfil-control').textContent = 'No. Control: ' + usuario.numero_control;
        document.getElementById('perfil-viajes').textContent = datos.viajes_realizados;
        document.getElementById('perfil-co2').textContent = datos.co2_ahorrado + ' kg';

        if (vehiculos.length === 0) {
            bloqueSinVehiculo.classList.remove('formulario-oculto');
        } else {
            bloqueConductor.classList.remove('formulario-oculto');

            for (let i = 0; i < vehiculos.length; i++) {
                const vehiculo = vehiculos[i];
                const opcion = document.createElement('option');
                opcion.value = vehiculo.id;
                opcion.textContent = vehiculo.modelo + ' | ' + vehiculo.matricula + ' | ' + vehiculo.color;
                selectVehiculos.appendChild(opcion);
            }

            if (rutasGuardadas.length === 0) {
                selectRutas.innerHTML = '<option value="">Sin rutas guardadas</option>';
                textoSinRutas.classList.remove('formulario-oculto');
            } else {
                for (let i = 0; i < rutasGuardadas.length; i++) {
                    const ruta = rutasGuardadas[i];
                    const opcion = document.createElement('option');
                    opcion.value = ruta.id;
                    opcion.textContent = ruta.nombre;
                    selectRutas.appendChild(opcion);
                }
                mapaPerfilRuta.classList.remove('formulario-oculto');
                actualizarMapaPerfil();
            }
        }
    } catch (error) {
        mostrarMensaje('aviso-perfil', 'Error de conexión al cargar el perfil.');
    }

    selectRutas.addEventListener('change', actualizarMapaPerfil);

    botonCerrarSesion.addEventListener('click', function () {
        pedirConfirmacion(
            'Cerrar sesión',
            '¿Estás seguro de que quieres cerrar sesión en este dispositivo?',
            'Sí, cerrar sesión',
            async function () {
                cambiarEstadoBoton(botonCerrarSesion, true, 'Cerrando sesión...');
                try {
                    await fetch('/api/usuarios/cerrar-sesion', { method: 'POST' });
                } catch (error) {
                    console.log('Error al cerrar sesión en servidor.');
                }
                localStorage.removeItem('raity_usuario');
                window.location.href = '/index.html';
            }
        );
    });
});
