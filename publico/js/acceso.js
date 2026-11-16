document.addEventListener('DOMContentLoaded', async function () {
    const tabIniciar = document.getElementById('tab-iniciar');
    const tabRegistro = document.getElementById('tab-registro');
    const formularioIniciar = document.getElementById('formulario-iniciar');
    const formularioRegistro = document.getElementById('formulario-registro');
    const botonIniciar = document.getElementById('boton-iniciar-sesion');
    const botonRegistrarse = document.getElementById('boton-registrarse');
    const modalTerminos = document.getElementById('modal-terminos');
    const enlaceTerminos = document.getElementById('enlace-terminos');
    const botonCerrarTerminos = document.getElementById('boton-cerrar-terminos');

    const camposInicio = ['acceso-identificador', 'acceso-contrasena'];
    const camposRegistro = [
        'registro-nombre',
        'registro-correo',
        'registro-control',
        'registro-genero',
        'registro-contrasena',
        'registro-confirmar',
        'registro-terminos'
    ];

    try {
        const respuestaSesion = await fetch('/api/usuarios/sesion');
        if (respuestaSesion.ok) {
            window.location.href = '/explorar.html';
            return;
        }
    } catch (error) {
        console.log('No se pudo comprobar sesión previa.');
    }

    activarRespaldoFormulario('formulario-registro', 'raity_respaldo_registro');

    const identificadorRecordado = localStorage.getItem('raity_recordar_identificador');
    if (identificadorRecordado) {
        document.getElementById('acceso-identificador').value = identificadorRecordado;
        document.getElementById('acceso-recordarme').checked = true;
    }

    tabIniciar.addEventListener('click', function () {
        tabIniciar.classList.add('activa');
        tabIniciar.setAttribute('aria-selected', 'true');
        tabRegistro.classList.remove('activa');
        tabRegistro.setAttribute('aria-selected', 'false');
        formularioIniciar.classList.remove('formulario-oculto');
        formularioRegistro.classList.add('formulario-oculto');
        limpiarErroresCampos(camposInicio, 'aviso-acceso');
    });

    tabRegistro.addEventListener('click', function () {
        tabRegistro.classList.add('activa');
        tabRegistro.setAttribute('aria-selected', 'true');
        tabIniciar.classList.remove('activa');
        tabIniciar.setAttribute('aria-selected', 'false');
        formularioRegistro.classList.remove('formulario-oculto');
        formularioIniciar.classList.add('formulario-oculto');
        limpiarErroresCampos(camposRegistro, 'aviso-acceso');
    });

    enlaceTerminos.addEventListener('click', function () {
        modalTerminos.classList.add('visible');
        botonCerrarTerminos.focus();
    });

    botonCerrarTerminos.addEventListener('click', function () {
        modalTerminos.classList.remove('visible');
        enlaceTerminos.focus();
    });

    modalTerminos.addEventListener('click', function (evento) {
        if (evento.target === modalTerminos) {
            modalTerminos.classList.remove('visible');
            enlaceTerminos.focus();
        }
    });

    formularioIniciar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(camposInicio, 'aviso-acceso');

        const identificador = document.getElementById('acceso-identificador').value.trim();
        const contrasena = document.getElementById('acceso-contrasena').value;
        const recordarme = document.getElementById('acceso-recordarme').checked;

        let primerError = null;
        if (!identificador) {
            marcarErrorCampo('acceso-identificador', 'Ingresa tu correo institucional o número de control.');
            primerError = 'acceso-identificador';
        }
        if (!contrasena) {
            marcarErrorCampo('acceso-contrasena', 'Ingresa tu contraseña para continuar.');
            if (!primerError) {
                primerError = 'acceso-contrasena';
            }
        }

        if (primerError) {
            mostrarMensaje('aviso-acceso', 'Revisa los campos marcados antes de iniciar sesión.');
            document.getElementById(primerError).focus();
            return;
        }

        cambiarEstadoBoton(botonIniciar, true, 'Iniciando sesión...');

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
                marcarErrorCampo('acceso-identificador', 'Verifica que tu correo o matrícula estén bien escritos.');
                marcarErrorCampo('acceso-contrasena', 'Verifica que tu contraseña sea correcta.');
                mostrarMensaje('aviso-acceso', datos.mensaje);
                cambiarEstadoBoton(botonIniciar, false);
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
            mostrarMensaje('aviso-acceso', 'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.');
            cambiarEstadoBoton(botonIniciar, false);
        }
    });

    formularioRegistro.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limpiarErroresCampos(camposRegistro, 'aviso-acceso');

        const nombreCompleto = document.getElementById('registro-nombre').value.trim();
        const correoInstitucional = document.getElementById('registro-correo').value.trim();
        const numeroControl = document.getElementById('registro-control').value.trim();
        const genero = document.getElementById('registro-genero').value;
        const contrasena = document.getElementById('registro-contrasena').value;
        const confirmarContrasena = document.getElementById('registro-confirmar').value;
        const aceptoTerminos = document.getElementById('registro-terminos').checked;

        let primerCampoError = null;
        function registrarError(idCampo, mensaje) {
            marcarErrorCampo(idCampo, mensaje);
            if (!primerCampoError) {
                primerCampoError = idCampo;
            }
        }

        if (!nombreCompleto) {
            registrarError('registro-nombre', 'Escribe tu nombre completo.');
        }

        if (!correoInstitucional) {
            registrarError('registro-correo', 'Escribe tu correo institucional de la UABCS.');
        } else if (!correoInstitucional.toLowerCase().endsWith('@alu.uabcs.mx')) {
            registrarError('registro-correo', 'El correo debe terminar en @alu.uabcs.mx.');
        }

        if (!numeroControl) {
            registrarError('registro-control', 'Escribe tu número de control.');
        } else if (!/^[0-9]+$/.test(numeroControl)) {
            registrarError('registro-control', 'Usa solo números en tu matrícula escolar.');
        }

        if (!genero) {
            registrarError('registro-genero', 'Selecciona una opción de género.');
        }

        if (!contrasena) {
            registrarError('registro-contrasena', 'Escribe una contraseña.');
        } else if (contrasena.length < 6) {
            registrarError('registro-contrasena', 'La contraseña debe tener al menos 6 caracteres.');
        }

        if (!confirmarContrasena) {
            registrarError('registro-confirmar', 'Confirma tu contraseña.');
        } else if (contrasena && contrasena !== confirmarContrasena) {
            registrarError('registro-confirmar', 'Las contraseñas no coinciden.');
        }

        if (!aceptoTerminos) {
            registrarError('registro-terminos', 'Acepta los Términos y Condiciones para continuar.');
        }

        if (primerCampoError) {
            mostrarMensaje('aviso-acceso', 'Corrige los campos señalados para completar tu registro.');
            document.getElementById(primerCampoError).focus();
            return;
        }

        cambiarEstadoBoton(botonRegistrarse, true, 'Creando cuenta...');

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
                cambiarEstadoBoton(botonRegistrarse, false);
                return;
            }

            limpiarRespaldoFormulario('raity_respaldo_registro');
            localStorage.setItem('raity_usuario', JSON.stringify(datos.usuario));
            window.location.href = '/explorar.html';
        } catch (error) {
            mostrarMensaje('aviso-acceso', 'No se pudo conectar con el servidor. Tus datos se conservaron en pantalla.');
            cambiarEstadoBoton(botonRegistrarse, false);
        }
    });
});
