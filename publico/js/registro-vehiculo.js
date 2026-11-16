document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const formulario = document.getElementById('formulario-vehiculo');
    const inputCredencial = document.getElementById('vehiculo-credencial');
    const inputFotoVehiculo = document.getElementById('vehiculo-foto');
    const areaCredencial = document.getElementById('area-credencial');
    const areaFotoVehiculo = document.getElementById('area-foto-vehiculo');
    const textoCredencial = document.getElementById('nombre-credencial');
    const textoFotoVehiculo = document.getElementById('nombre-foto-vehiculo');
    const botonRegistrar = document.getElementById('boton-registrar-vehiculo');

    const camposValidar = ['vehiculo-modelo', 'vehiculo-matricula', 'vehiculo-color'];

    activarRespaldoFormulario('formulario-vehiculo', 'raity_respaldo_vehiculo');

    inputCredencial.addEventListener('change', function () {
        areaCredencial.classList.remove('campo-error');
        if (this.files && this.files.length > 0) {
            textoCredencial.textContent = 'Archivo seleccionado: ' + this.files[0].name;
        }
    });

    inputFotoVehiculo.addEventListener('change', function () {
        areaFotoVehiculo.classList.remove('campo-error');
        if (this.files && this.files.length > 0) {
            textoFotoVehiculo.textContent = 'Archivo seleccionado: ' + this.files[0].name;
        }
    });

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(camposValidar, 'aviso-registro-vehiculo');
        areaCredencial.classList.remove('campo-error');
        areaFotoVehiculo.classList.remove('campo-error');

        const modelo = document.getElementById('vehiculo-modelo').value.trim();
        const matricula = document.getElementById('vehiculo-matricula').value.trim();
        const color = document.getElementById('vehiculo-color').value.trim();
        const numeroAsientos = document.getElementById('vehiculo-asientos').value;

        let primerError = null;
        if (!modelo) {
            marcarErrorCampo('vehiculo-modelo', 'Escribe la marca y modelo de tu vehículo.');
            primerError = 'vehiculo-modelo';
        }
        if (!matricula) {
            marcarErrorCampo('vehiculo-matricula', 'Escribe la matrícula o placa del vehículo.');
            if (!primerError) {
                primerError = 'vehiculo-matricula';
            }
        }
        if (!color) {
            marcarErrorCampo('vehiculo-color', 'Escribe el color del vehículo.');
            if (!primerError) {
                primerError = 'vehiculo-color';
            }
        }

        const tieneCredencial = inputCredencial.files && inputCredencial.files.length > 0;
        const tieneFotoVehiculo = inputFotoVehiculo.files && inputFotoVehiculo.files.length > 0;

        if (!tieneCredencial) {
            areaCredencial.classList.add('campo-error');
        }
        if (!tieneFotoVehiculo) {
            areaFotoVehiculo.classList.add('campo-error');
        }

        if (primerError || !tieneCredencial || !tieneFotoVehiculo) {
            if (!tieneCredencial || !tieneFotoVehiculo) {
                mostrarMensaje(
                    'aviso-registro-vehiculo',
                    'Completa los datos faltantes y sube las dos fotos solicitadas (credencial y vehículo).'
                );
            } else {
                mostrarMensaje('aviso-registro-vehiculo', 'Revisa los campos marcados antes de continuar.');
            }
            if (primerError) {
                document.getElementById(primerError).focus();
            } else if (!tieneCredencial) {
                inputCredencial.focus();
            } else {
                inputFotoVehiculo.focus();
            }
            return;
        }

        const tamanoMaximo = 5 * 1024 * 1024;
        if (inputCredencial.files[0].size > tamanoMaximo || inputFotoVehiculo.files[0].size > tamanoMaximo) {
            mostrarMensaje('aviso-registro-vehiculo', 'Cada imagen debe pesar máximo 5 MB.');
            return;
        }

        const datosFormulario = new FormData();
        datosFormulario.append('modelo', modelo);
        datosFormulario.append('matricula', matricula);
        datosFormulario.append('color', color);
        datosFormulario.append('numero_asientos', numeroAsientos);
        datosFormulario.append('foto_credencial', inputCredencial.files[0]);
        datosFormulario.append('foto_vehiculo', inputFotoVehiculo.files[0]);

        cambiarEstadoBoton(botonRegistrar, true, 'Guardando vehículo...');

        try {
            const respuesta = await fetch('/api/vehiculos', {
                method: 'POST',
                body: datosFormulario
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-registro-vehiculo', datos.mensaje);
                cambiarEstadoBoton(botonRegistrar, false);
                return;
            }

            limpiarRespaldoFormulario('raity_respaldo_vehiculo');
            window.location.href = '/perfil.html';
        } catch (error) {
            mostrarMensaje('aviso-registro-vehiculo', 'Error de conexión al registrar el vehículo. Tus datos siguen en pantalla.');
            cambiarEstadoBoton(botonRegistrar, false);
        }
    });
});
