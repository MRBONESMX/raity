document.addEventListener('DOMContentLoaded', async function () {
    const tabIniciar = document.getElementById('tab-iniciar');
    const tabRegistro = document.getElementById('tab-registro');
    const formularioIniciar = document.getElementById('formulario-iniciar');
    const formularioRegistro = document.getElementById('formulario-registro');
    const modalTerminos = document.getElementById('modal-terminos');
    const enlaceTerminos = document.getElementById('enlace-terminos');
    const botonCerrarTerminos = document.getElementById('boton-cerrar-terminos');

    try {
        const respuestaSesion = await fetch('/api/usuarios/sesion');
        if (respuestaSesion.ok) {
            window.location.href = '/explorar.html';
            return;
        }
    } catch (error) {
        console.log('Sin conexión para comprobar sesión.');
    }

    const identificadorRecordado = localStorage.getItem('raity_recordar_identificador');
    if (identificadorRecordado) {
        document.getElementById('acceso-identificador').value = identificadorRecordado;
        document.getElementById('acceso-recordarme').checked = true;
    }

    function limpiarErrores(idsCampos) {
        ocultarMensaje('aviso-acceso');
        for (let i = 0; i < idsCampos.length; i++) {
            const campo = document.getElementById(idsCampos[i]);
            if (campo) {
                campo.classList.remove('campo-error');
            }
        }
    }

    function marcarError(idCampo) {
        const campo = document.getElementById(idCampo);
        if (campo) {
            campo.classList.add('campo-error');
        }
    }

    tabIniciar.addEventListener('click', function () {
        tabIniciar.classList.add('activa');
        tabRegistro.classList.remove('activa');
        formularioIniciar.classList.remove('formulario-oculto');
        formularioRegistro.classList.add('formulario-oculto');
        limpiarErrores(['acceso-identificador', 'acceso-contrasena']);
    });

    tabRegistro.addEventListener('click', function () {
        tabRegistro.classList.add('activa');
        tabIniciar.classList.remove('activa');
        formularioRegistro.classList.remove('formulario-oculto');
        formularioIniciar.classList.add('formulario-oculto');
        limpiarErrores([
            'registro-nombre',
            'registro-correo',
            'registro-control',
            'registro-genero',
            'registro-contrasena',
            'registro-confirmar'
        ]);
    });

    enlaceTerminos.addEventListener('click', function (evento) {
        evento.preventDefault();
        modalTerminos.classList.add('visible');
    });

    botonCerrarTerminos.addEventListener('click', function () {
        modalTerminos.classList.remove('visible');
    });

    formularioIniciar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErrores(['acceso-identificador', 'acceso-contrasena']);

        const identificador = document.getElementById('acceso-identificador').value.trim();
        const contrasena = document.getElementById('acceso-contrasena').value;
        const recordarme = document.getElementById('acceso-recordarme').checked;

        if (!identificador || !contrasena) {
            marcarError('acceso-identificador');
            marcarError('acceso-contrasena');
            mostrarMensaje('aviso-acceso', 'Error de verificación. Correo o contraseña incorrectos.');
            return;
        }

        try {
            const respuesta = await fetch('/api/usuarios/iniciar-sesion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identificador: identificador,
                    contrasena: contrasena,
                    recordarme: recordarme
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                marcarError('acceso-identificador');
                marcarError('acceso-contrasena');
                mostrarMensaje('aviso-acceso', datos.mensaje);
                return;
            }

            if (recordarme) {
                localStorage.setItem('raity_recordar_identificador', identificador);
            } else {
                localStorage.removeItem('raity_recordar_identificador');
            }

            localStorage.setItem('raity_usuario', JSON.stringify(datos.usuario));
            window.location.href = '/explorar.html';
        } catch (error) {
            mostrarMensaje('aviso-acceso', 'No se pudo conectar con el servidor.');
        }
    });

    formularioRegistro.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        const camposRegistro = [
            'registro-nombre',
            'registro-correo',
            'registro-control',
            'registro-genero',
            'registro-contrasena',
            'registro-confirmar'
        ];
        limpiarErrores(camposRegistro);

        const nombreCompleto = document.getElementById('registro-nombre').value.trim();
        const correoInstitucional = document.getElementById('registro-correo').value.trim();
        const numeroControl = document.getElementById('registro-control').value.trim();
        const genero = document.getElementById('registro-genero').value;
        const contrasena = document.getElementById('registro-contrasena').value;
        const confirmarContrasena = document.getElementById('registro-confirmar').value;
        const aceptoTerminos = document.getElementById('registro-terminos').checked;

        let faltanCampos = false;
        for (let i = 0; i < camposRegistro.length; i++) {
            const valorCampo = document.getElementById(camposRegistro[i]).value.trim();
            if (!valorCampo) {
                marcarError(camposRegistro[i]);
                faltanCampos = true;
            }
        }

        if (faltanCampos) {
            mostrarMensaje('aviso-acceso', 'Por favor, rellena todos los campos para continuar.');
            return;
        }

        if (!correoInstitucional.toLowerCase().endsWith('@alu.uabcs.mx')) {
            marcarError('registro-correo');
            mostrarMensaje('aviso-acceso', 'El correo institucional debe terminar en @alu.uabcs.mx.');
            return;
        }

        if (contrasena !== confirmarContrasena) {
            marcarError('registro-contrasena');
            marcarError('registro-confirmar');
            mostrarMensaje('aviso-acceso', 'Las contraseñas no coinciden.');
            return;
        }

        if (!aceptoTerminos) {
            mostrarMensaje('aviso-acceso', 'Debes aceptar los Términos y Condiciones.');
            return;
        }

        try {
            const respuesta = await fetch('/api/usuarios/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre_completo: nombreCompleto,
                    correo_institucional: correoInstitucional,
                    numero_control: numeroControl,
                    genero: genero,
                    contrasena: contrasena,
                    confirmar_contrasena: confirmarContrasena,
                    acepto_terminos: aceptoTerminos
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                mostrarMensaje('aviso-acceso', datos.mensaje);
                return;
            }

            localStorage.setItem('raity_usuario', JSON.stringify(datos.usuario));
            window.location.href = '/explorar.html';
        } catch (error) {
            mostrarMensaje('aviso-acceso', 'No se pudo conectar con el servidor.');
        }
    });
});
