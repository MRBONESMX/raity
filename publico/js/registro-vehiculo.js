document.addEventListener('DOMContentLoaded', async function () {
    const usuario = await verificarSesion();
    if (!usuario) {
        return;
    }

    const formulario = document.getElementById('formulario-vehiculo');
    const inputCredencial = document.getElementById('vehiculo-credencial');
    const inputFotoVehiculo = document.getElementById('vehiculo-foto');
    const textoCredencial = document.getElementById('nombre-credencial');
    const textoFotoVehiculo = document.getElementById('nombre-foto-vehiculo');

    inputCredencial.addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
            textoCredencial.textContent = 'Archivo seleccionado: ' + this.files[0].name;
        }
    });

    inputFotoVehiculo.addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
            textoFotoVehiculo.textContent = 'Archivo seleccionado: ' + this.files[0].name;
        }
    });

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        ocultarMensaje('aviso-registro-vehiculo');

        const modelo = document.getElementById('vehiculo-modelo').value.trim();
        const matricula = document.getElementById('vehiculo-matricula').value.trim();
        const color = document.getElementById('vehiculo-color').value.trim();
        const numeroAsientos = document.getElementById('vehiculo-asientos').value;

        if (!modelo || !matricula || !color) {
            mostrarMensaje('aviso-registro-vehiculo', 'Por favor, completa todos los datos del vehículo.');
            return;
        }

        if (!inputCredencial.files || inputCredencial.files.length === 0 || !inputFotoVehiculo.files || inputFotoVehiculo.files.length === 0) {
            mostrarMensaje('aviso-registro-vehiculo', 'Debes seleccionar la foto de tu credencial y la foto del vehículo.');
            return;
        }

        const datosFormulario = new FormData();
        datosFormulario.append('modelo', modelo);
        datosFormulario.append('matricula', matricula);
        datosFormulario.append('color', color);
        datosFormulario.append('numero_asientos', numeroAsientos);
        datosFormulario.append('foto_credencial', inputCredencial.files[0]);
        datosFormulario.append('foto_vehiculo', inputFotoVehiculo.files[0]);

        try {
            const respuesta = await fetch('/api/vehiculos', {
                method: 'POST',
                body: datosFormulario
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-registro-vehiculo', datos.mensaje);
                return;
            }

            window.location.href = '/perfil.html';
        } catch (error) {
            mostrarMensaje('aviso-registro-vehiculo', 'Error de conexión al registrar el vehículo.');
        }
    });
});
