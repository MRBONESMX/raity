const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../conexion');

const enrutador = express.Router();
const DOMINIO_PERMITIDO = '@alu.uabcs.mx';

function verificarSesion(peticion, respuesta, siguiente) {
    if (!peticion.session || !peticion.session.usuario) {
        return respuesta.status(401).json({ mensaje: 'Debes iniciar sesión para continuar.' });
    }
    siguiente();
}

enrutador.post('/registro', async function (peticion, respuesta) {
    try {
        const nombreCompleto = peticion.body.nombre_completo;
        const correoInstitucional = peticion.body.correo_institucional;
        const numeroControl = peticion.body.numero_control;
        const genero = peticion.body.genero;
        const contrasena = peticion.body.contrasena;
        const confirmarContrasena = peticion.body.confirmar_contrasena;
        const aceptoTerminos = peticion.body.acepto_terminos;

        if (!nombreCompleto || !correoInstitucional || !numeroControl || !genero || !contrasena || !confirmarContrasena) {
            return respuesta.status(400).json({ mensaje: 'Por favor, rellena todos los campos para continuar.' });
        }

        const correoLimpio = correoInstitucional.trim().toLowerCase();
        const controlLimpio = numeroControl.trim();

        if (!correoLimpio.endsWith(DOMINIO_PERMITIDO)) {
            return respuesta.status(400).json({
                mensaje: 'El correo institucional debe terminar en ' + DOMINIO_PERMITIDO + '.'
            });
        }

        if (genero !== 'Mujer' && genero !== 'Hombre' && genero !== 'Prefiero no decir') {
            return respuesta.status(400).json({ mensaje: 'Selecciona un género válido.' });
        }

        if (contrasena !== confirmarContrasena) {
            return respuesta.status(400).json({ mensaje: 'Las contraseñas no coinciden.' });
        }

        if (contrasena.length < 6) {
            return respuesta.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        if (!aceptoTerminos) {
            return respuesta.status(400).json({ mensaje: 'Debes aceptar los Términos y Condiciones para registrarte.' });
        }

        const existente = await pool.query(
            'SELECT id FROM usuarios WHERE LOWER(correo_institucional) = $1 OR numero_control = $2',
            [correoLimpio, controlLimpio]
        );

        if (existente.rows.length > 0) {
            return respuesta.status(400).json({
                mensaje: 'Ya existe una cuenta registrada con ese correo o número de control.'
            });
        }

        const contrasenaCifrada = await bcrypt.hash(contrasena, 10);

        const insercion = await pool.query(
            'INSERT INTO usuarios (nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre_completo, correo_institucional, numero_control, genero',
            [nombreCompleto.trim(), correoLimpio, controlLimpio, contrasenaCifrada, genero]
        );

        const usuarioNuevo = insercion.rows[0];
        peticion.session.usuario = usuarioNuevo;

        respuesta.status(201).json({
            mensaje: 'Registro exitoso.',
            usuario: usuarioNuevo
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al crear la cuenta.' });
    }
});

enrutador.post('/iniciar-sesion', async function (peticion, respuesta) {
    try {
        const identificador = peticion.body.identificador;
        const contrasena = peticion.body.contrasena;
        const recordarme = peticion.body.recordarme;

        if (!identificador || !contrasena) {
            return respuesta.status(400).json({ mensaje: 'Error de verificación. Correo o contraseña incorrectos.' });
        }

        const datoAcceso = identificador.trim();

        const consulta = await pool.query(
            'SELECT id, nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero, activo FROM usuarios WHERE LOWER(correo_institucional) = LOWER($1) OR numero_control = $1',
            [datoAcceso]
        );

        if (consulta.rows.length === 0) {
            return respuesta.status(401).json({ mensaje: 'Error de verificación. Correo o contraseña incorrectos.' });
        }

        const usuarioEncontrado = consulta.rows[0];
        const contrasenaValida = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena_cifrada);

        if (!contrasenaValida) {
            return respuesta.status(401).json({ mensaje: 'Error de verificación. Correo o contraseña incorrectos.' });
        }

        if (recordarme === true || recordarme === 'true' || recordarme === 'on') {
            peticion.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
        } else {
            peticion.session.cookie.maxAge = 24 * 60 * 60 * 1000;
        }

        const datosSesion = {
            id: usuarioEncontrado.id,
            nombre_completo: usuarioEncontrado.nombre_completo,
            correo_institucional: usuarioEncontrado.correo_institucional,
            numero_control: usuarioEncontrado.numero_control,
            genero: usuarioEncontrado.genero
        };

        peticion.session.usuario = datosSesion;

        respuesta.json({
            mensaje: 'Sesión iniciada correctamente.',
            usuario: datosSesion
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al iniciar sesión.' });
    }
});

enrutador.post('/cerrar-sesion', function (peticion, respuesta) {
    peticion.session.destroy(function (error) {
        if (error) {
            return respuesta.status(500).json({ mensaje: 'No se pudo cerrar la sesión.' });
        }
        respuesta.json({ mensaje: 'Sesión cerrada correctamente.' });
    });
});

enrutador.get('/sesion', function (peticion, respuesta) {
    if (!peticion.session || !peticion.session.usuario) {
        return respuesta.status(401).json({ mensaje: 'No hay sesión activa.' });
    }
    respuesta.json({ usuario: peticion.session.usuario });
});

enrutador.get('/perfil', verificarSesion, async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;

        const consultaUsuario = await pool.query(
            'SELECT id, nombre_completo, correo_institucional, numero_control, genero, activo, fecha_registro FROM usuarios WHERE id = $1',
            [idUsuario]
        );

        if (consultaUsuario.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const consultaCalificacion = await pool.query(
            'SELECT COALESCE(ROUND(AVG(puntuacion), 1), 5.0) AS calificacion FROM calificaciones WHERE id_calificado = $1',
            [idUsuario]
        );

        const consultaViajes = await pool.query(
            "SELECT COUNT(DISTINCT viajes.id) AS total FROM viajes LEFT JOIN reservaciones ON reservaciones.id_viaje = viajes.id AND reservaciones.id_pasajero = $1 AND reservaciones.estado = 'activa' WHERE viajes.estado = 'terminado' AND (viajes.id_conductor = $1 OR reservaciones.id IS NOT NULL)",
            [idUsuario]
        );

        const consultaVehiculos = await pool.query(
            'SELECT id, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial FROM vehiculos WHERE id_usuario = $1 ORDER BY id DESC',
            [idUsuario]
        );

        const consultaRutas = await pool.query(
            'SELECT id, nombre, latitud_origen, longitud_origen, latitud_destino, longitud_destino FROM rutas_guardadas WHERE id_usuario = $1 ORDER BY id DESC',
            [idUsuario]
        );

        const viajesRealizados = Number(consultaViajes.rows[0].total);
        // Calculo estimado: cada viaje compartido ahorra alrededor de 1.2 kg de CO2
        const co2Ahorrado = Number((viajesRealizados * 1.2).toFixed(1));

        respuesta.json({
            usuario: consultaUsuario.rows[0],
            calificacion: Number(consultaCalificacion.rows[0].calificacion),
            viajes_realizados: viajesRealizados,
            co2_ahorrado: co2Ahorrado,
            vehiculos: consultaVehiculos.rows,
            rutas_guardadas: consultaRutas.rows
        });
    } catch (error) {
        console.error('Error al cargar el perfil:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al consultar el perfil.' });
    }
});

module.exports = {
    enrutador: enrutador,
    verificarSesion: verificarSesion
};
