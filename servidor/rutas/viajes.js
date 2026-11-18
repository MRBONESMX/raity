const express = require('express');
const pool = require('../conexion');
const {
    validarCoordenada,
    calcularRecogidaSobreRuta,
    construirMensajeRecogida
} = require('./reservaciones');

const enrutador = express.Router();

enrutador.get('/', async function (peticion, respuesta) {
    try {
        const usuarioActual = peticion.session.usuario;
        const busqueda = peticion.query.busqueda ? peticion.query.busqueda.trim() : '';

        let textoSql = `
            SELECT
                viajes.id,
                viajes.id_conductor,
                viajes.origen,
                viajes.destino,
                viajes.fecha,
                viajes.hora_salida,
                viajes.lugares_totales,
                viajes.lugares_disponibles,
                viajes.es_violeta,
                viajes.estado,
                usuarios.nombre_completo AS conductor_nombre,
                vehiculos.modelo AS vehiculo_modelo,
                vehiculos.matricula AS vehiculo_matricula,
                vehiculos.color AS vehiculo_color,
                rutas_guardadas.latitud_origen,
                rutas_guardadas.longitud_origen,
                rutas_guardadas.latitud_destino,
                rutas_guardadas.longitud_destino,
                (
                    SELECT COALESCE(ROUND(AVG(calificaciones.puntuacion), 1), 5.0)
                    FROM calificaciones
                    WHERE calificaciones.id_calificado = viajes.id_conductor
                ) AS conductor_calificacion
            FROM viajes
            JOIN usuarios ON viajes.id_conductor = usuarios.id
            JOIN vehiculos ON viajes.id_vehiculo = vehiculos.id
            JOIN rutas_guardadas ON viajes.id_ruta = rutas_guardadas.id
            WHERE viajes.estado = 'programado' AND viajes.lugares_disponibles > 0
        `;

        const parametros = [];

        if (usuarioActual.genero !== 'Mujer') {
            textoSql += ' AND viajes.es_violeta = FALSE';
        }

        if (busqueda !== '') {
            parametros.push('%' + busqueda + '%');
            textoSql += ' AND (viajes.destino ILIKE $1 OR viajes.origen ILIKE $1 OR usuarios.nombre_completo ILIKE $1)';
        }

        textoSql += ' ORDER BY viajes.id DESC';

        const consulta = await pool.query(textoSql, parametros);
        respuesta.json({ viajes: consulta.rows });
    } catch (error) {
        console.error('Error al buscar viajes:', error);
        respuesta.status(500).json({ mensaje: 'Error al consultar los viajes disponibles.' });
    }
});

enrutador.get('/mis-viajes', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;

        const consultaActual = await pool.query(
            `
            SELECT DISTINCT
                viajes.id,
                viajes.id_conductor,
                viajes.origen,
                viajes.destino,
                viajes.fecha,
                viajes.hora_salida,
                viajes.lugares_totales,
                viajes.lugares_disponibles,
                viajes.es_violeta,
                viajes.estado,
                usuarios.nombre_completo AS conductor_nombre,
                (viajes.lugares_totales - viajes.lugares_disponibles) AS pasajeros_unidos
            FROM viajes
            JOIN usuarios ON viajes.id_conductor = usuarios.id
            LEFT JOIN reservaciones ON reservaciones.id_viaje = viajes.id AND reservaciones.id_pasajero = $1 AND reservaciones.estado = 'activa'
            WHERE viajes.estado IN ('programado', 'en_curso')
              AND (viajes.id_conductor = $1 OR reservaciones.id IS NOT NULL)
            ORDER BY viajes.id DESC
            `,
            [idUsuario]
        );

        const consultaHistorial = await pool.query(
            `
            SELECT DISTINCT
                viajes.id,
                viajes.id_conductor,
                viajes.origen,
                viajes.destino,
                viajes.fecha,
                viajes.hora_salida,
                viajes.es_violeta,
                viajes.estado,
                usuarios.nombre_completo AS conductor_nombre,
                EXISTS (
                    SELECT 1
                    FROM calificaciones
                    WHERE calificaciones.id_viaje = viajes.id
                      AND calificaciones.id_quien_califica = $1
                ) AS ya_calificado
            FROM viajes
            JOIN usuarios ON viajes.id_conductor = usuarios.id
            LEFT JOIN reservaciones ON reservaciones.id_viaje = viajes.id AND reservaciones.id_pasajero = $1 AND reservaciones.estado = 'activa'
            WHERE viajes.estado IN ('terminado', 'cancelado')
              AND (viajes.id_conductor = $1 OR reservaciones.id IS NOT NULL)
            ORDER BY viajes.id DESC
            `,
            [idUsuario]
        );

        const viajeActual = consultaActual.rows.length > 0 ? consultaActual.rows[0] : null;

        respuesta.json({
            viaje_actual: viajeActual,
            viajes_actuales: consultaActual.rows,
            historial: consultaHistorial.rows
        });
    } catch (error) {
        console.error('Error al consultar mis viajes:', error);
        respuesta.status(500).json({ mensaje: 'Error al consultar tus viajes.' });
    }
});

enrutador.get('/:id', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const generoUsuario = peticion.session.usuario.genero;
        const idViaje = parseInt(peticion.params.id, 10);

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        const consultaViaje = await pool.query(
            `
            SELECT
                viajes.*,
                usuarios.nombre_completo AS conductor_nombre,
                vehiculos.modelo AS vehiculo_modelo,
                vehiculos.matricula AS vehiculo_matricula,
                vehiculos.color AS vehiculo_color,
                rutas_guardadas.latitud_origen,
                rutas_guardadas.longitud_origen,
                rutas_guardadas.latitud_destino,
                rutas_guardadas.longitud_destino,
                (
                    SELECT COALESCE(ROUND(AVG(calificaciones.puntuacion), 1), 5.0)
                    FROM calificaciones
                    WHERE calificaciones.id_calificado = viajes.id_conductor
                ) AS conductor_calificacion
            FROM viajes
            JOIN usuarios ON viajes.id_conductor = usuarios.id
            JOIN vehiculos ON viajes.id_vehiculo = vehiculos.id
            JOIN rutas_guardadas ON viajes.id_ruta = rutas_guardadas.id
            WHERE viajes.id = $1
            `,
            [idViaje]
        );

        if (consultaViaje.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Viaje no encontrado.' });
        }

        const viaje = consultaViaje.rows[0];

        if (viaje.es_violeta && generoUsuario !== 'Mujer') {
            return respuesta.status(403).json({ mensaje: 'Este viaje es exclusivo de Raity Violeta.' });
        }

        const consultaPasajeros = await pool.query(
            `
            SELECT
                reservaciones.id AS id_reservacion,
                usuarios.id AS id_usuario,
                usuarios.nombre_completo,
                reservaciones.latitud_pasajero,
                reservaciones.longitud_pasajero,
                reservaciones.latitud_recogida,
                reservaciones.longitud_recogida,
                reservaciones.distancia_ruta_metros,
                reservaciones.fuera_de_ruta,
                (
                    SELECT COALESCE(ROUND(AVG(calificaciones.puntuacion), 1), 5.0)
                    FROM calificaciones
                    WHERE calificaciones.id_calificado = usuarios.id
                ) AS calificacion
            FROM reservaciones
            JOIN usuarios ON reservaciones.id_pasajero = usuarios.id
            WHERE reservaciones.id_viaje = $1 AND reservaciones.estado = 'activa'
            ORDER BY reservaciones.id ASC
            `,
            [idViaje]
        );

        let idReservacionPropia = null;
        for (let i = 0; i < consultaPasajeros.rows.length; i++) {
            if (consultaPasajeros.rows[i].id_usuario === idUsuario) {
                idReservacionPropia = consultaPasajeros.rows[i].id_reservacion;
            }
        }

        respuesta.json({
            viaje: viaje,
            pasajeros: consultaPasajeros.rows,
            es_conductor: viaje.id_conductor === idUsuario,
            id_reservacion_propia: idReservacionPropia
        });
    } catch (error) {
        console.error('Error al obtener detalle del viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error al consultar el detalle del viaje.' });
    }
});

enrutador.post('/', async function (peticion, respuesta) {
    try {
        const usuarioActual = peticion.session.usuario;
        const idRuta = parseInt(peticion.body.id_ruta, 10);
        const idVehiculoRecibido = peticion.body.id_vehiculo ? parseInt(peticion.body.id_vehiculo, 10) : null;
        const origen = peticion.body.origen;
        const destino = peticion.body.destino;
        const horaSalida = peticion.body.hora_salida;
        const lugaresTotales = parseInt(peticion.body.lugares_totales, 10);
        const esVioleta = peticion.body.es_violeta === true || peticion.body.es_violeta === 'true';

        if (!origen || !destino || !horaSalida || isNaN(lugaresTotales) || isNaN(idRuta)) {
            return respuesta.status(400).json({ mensaje: 'Por favor, completa todos los campos para publicar el raite.' });
        }

        if (lugaresTotales < 1 || lugaresTotales > 4) {
            return respuesta.status(400).json({ mensaje: 'Los asientos disponibles deben estar entre 1 y 4.' });
        }

        if (esVioleta && usuarioActual.genero !== 'Mujer') {
            return respuesta.status(403).json({
                mensaje: 'Solo las conductoras mujeres pueden publicar viajes en Raity Violeta.'
            });
        }

        const consultaVehiculos = await pool.query(
            'SELECT id FROM vehiculos WHERE id_usuario = $1 ORDER BY id ASC',
            [usuarioActual.id]
        );

        if (consultaVehiculos.rows.length === 0) {
            return respuesta.status(400).json({
                mensaje: 'Necesitas registrar al menos un vehículo antes de publicar un viaje.'
            });
        }

        let idVehiculoFinal = consultaVehiculos.rows[0].id;
        if (idVehiculoRecibido) {
            for (let i = 0; i < consultaVehiculos.rows.length; i++) {
                if (consultaVehiculos.rows[i].id === idVehiculoRecibido) {
                    idVehiculoFinal = idVehiculoRecibido;
                }
            }
        }

        const consultaRuta = await pool.query(
            'SELECT id FROM rutas_guardadas WHERE id = $1 AND id_usuario = $2',
            [idRuta, usuarioActual.id]
        );

        if (consultaRuta.rows.length === 0) {
            return respuesta.status(400).json({ mensaje: 'La ruta seleccionada no es válida.' });
        }

        const insercion = await pool.query(
            "INSERT INTO viajes (id_conductor, id_vehiculo, id_ruta, origen, destino, fecha, hora_salida, lugares_totales, lugares_disponibles, es_violeta, estado) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $7, $8, 'programado') RETURNING *",
            [usuarioActual.id, idVehiculoFinal, idRuta, origen.trim(), destino.trim(), horaSalida.trim(), lugaresTotales, esVioleta]
        );

        respuesta.status(201).json({
            mensaje: 'Viaje publicado correctamente.',
            viaje: insercion.rows[0]
        });
    } catch (error) {
        console.error('Error al publicar viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al publicar el viaje.' });
    }
});

enrutador.put('/:id/iniciar', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);

        const actualizacion = await pool.query(
            "UPDATE viajes SET estado = 'en_curso' WHERE id = $1 AND id_conductor = $2 AND estado = 'programado' RETURNING *",
            [idViaje, idUsuario]
        );

        if (actualizacion.rows.length === 0) {
            return respuesta.status(400).json({ mensaje: 'No se pudo iniciar este viaje.' });
        }

        respuesta.json({
            mensaje: 'El viaje ahora está en curso.',
            viaje: actualizacion.rows[0]
        });
    } catch (error) {
        console.error('Error al iniciar viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al iniciar el viaje.' });
    }
});

enrutador.put('/:id/terminar', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);

        const actualizacion = await pool.query(
            "UPDATE viajes SET estado = 'terminado' WHERE id = $1 AND id_conductor = $2 AND estado = 'en_curso' RETURNING *",
            [idViaje, idUsuario]
        );

        if (actualizacion.rows.length === 0) {
            return respuesta.status(400).json({ mensaje: 'Solo se puede terminar un viaje que esté en curso.' });
        }

        respuesta.json({
            mensaje: 'Viaje terminado correctamente.',
            viaje: actualizacion.rows[0]
        });
    } catch (error) {
        console.error('Error al terminar viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al terminar el viaje.' });
    }
});

enrutador.put('/:id/cancelar', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);

        const actualizacion = await pool.query(
            "UPDATE viajes SET estado = 'cancelado' WHERE id = $1 AND id_conductor = $2 AND estado IN ('programado', 'en_curso') RETURNING *",
            [idViaje, idUsuario]
        );

        if (actualizacion.rows.length === 0) {
            return respuesta.status(400).json({ mensaje: 'No se pudo cancelar este viaje.' });
        }

        await pool.query(
            "UPDATE reservaciones SET estado = 'cancelada' WHERE id_viaje = $1 AND estado = 'activa'",
            [idViaje]
        );

        respuesta.json({
            mensaje: 'Viaje cancelado y reservaciones liberadas.',
            viaje: actualizacion.rows[0]
        });
    } catch (error) {
        console.error('Error al cancelar viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al cancelar el viaje.' });
    }
});

enrutador.put('/:id/punto-recogida', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        const coordPasajero = validarCoordenada(
            peticion.body.latitud_pasajero,
            peticion.body.longitud_pasajero
        );

        if (!coordPasajero) {
            return respuesta.status(400).json({
                mensaje: 'No se recibió una ubicación GPS válida del dispositivo.'
            });
        }

        const consultaViaje = await pool.query(
            `
            SELECT
                viajes.id,
                viajes.id_conductor,
                viajes.estado,
                rutas_guardadas.latitud_origen,
                rutas_guardadas.longitud_origen,
                rutas_guardadas.latitud_destino,
                rutas_guardadas.longitud_destino
            FROM viajes
            JOIN rutas_guardadas ON viajes.id_ruta = rutas_guardadas.id
            WHERE viajes.id = $1
            `,
            [idViaje]
        );

        if (consultaViaje.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Viaje no encontrado.' });
        }

        const viaje = consultaViaje.rows[0];
        if (viaje.estado !== 'programado' && viaje.estado !== 'en_curso') {
            return respuesta.status(400).json({
                mensaje: 'Solo puedes compartir tu ubicación en viajes programados o en curso.'
            });
        }

        const consultaReservacion = await pool.query(
            "SELECT id FROM reservaciones WHERE id_viaje = $1 AND id_pasajero = $2 AND estado = 'activa'",
            [idViaje, idUsuario]
        );

        if (consultaReservacion.rows.length === 0) {
            return respuesta.status(403).json({
                mensaje: 'Debes tener un asiento reservado en este viaje para fijar tu punto de recogida.'
            });
        }

        const idReservacion = consultaReservacion.rows[0].id;
        const datosRecogida = calcularRecogidaSobreRuta(
            coordPasajero.latitud,
            coordPasajero.longitud,
            viaje,
            peticion.body.puntos_ruta
        );

        const actualizacion = await pool.query(
            `
            UPDATE reservaciones
            SET
                latitud_pasajero = $1,
                longitud_pasajero = $2,
                latitud_recogida = $3,
                longitud_recogida = $4,
                distancia_ruta_metros = $5,
                fuera_de_ruta = $6
            WHERE id = $7
            RETURNING *
            `,
            [
                datosRecogida.latitud_pasajero,
                datosRecogida.longitud_pasajero,
                datosRecogida.latitud_recogida,
                datosRecogida.longitud_recogida,
                datosRecogida.distancia_ruta_metros,
                datosRecogida.fuera_de_ruta,
                idReservacion
            ]
        );

        respuesta.json({
            mensaje: construirMensajeRecogida(datosRecogida),
            reservacion: actualizacion.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar punto de recogida:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al registrar el punto de recogida.' });
    }
});

enrutador.post('/:id/calificar', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);
        const puntuacion = parseInt(peticion.body.puntuacion, 10);
        const comentario = peticion.body.comentario ? String(peticion.body.comentario).trim() : '';

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        if (isNaN(puntuacion) || puntuacion < 1 || puntuacion > 5) {
            return respuesta.status(400).json({ mensaje: 'Selecciona una calificación válida entre 1 y 5 estrellas.' });
        }

        const consultaViaje = await pool.query(
            'SELECT id, id_conductor, estado FROM viajes WHERE id = $1',
            [idViaje]
        );

        if (consultaViaje.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Viaje no encontrado.' });
        }

        const viaje = consultaViaje.rows[0];
        if (viaje.id_conductor === idUsuario) {
            return respuesta.status(400).json({ mensaje: 'No puedes calificar tu propio viaje como conductor.' });
        }

        const consultaParticipacion = await pool.query(
            "SELECT id FROM reservaciones WHERE id_viaje = $1 AND id_pasajero = $2 AND estado = 'activa'",
            [idViaje, idUsuario]
        );

        if (consultaParticipacion.rows.length === 0) {
            return respuesta.status(403).json({ mensaje: 'Solo los pasajeros de este viaje pueden calificar al conductor.' });
        }

        const calificacionPrevia = await pool.query(
            'SELECT id FROM calificaciones WHERE id_viaje = $1 AND id_quien_califica = $2 AND id_calificado = $3',
            [idViaje, idUsuario, viaje.id_conductor]
        );

        if (calificacionPrevia.rows.length > 0) {
            return respuesta.status(400).json({ mensaje: 'Ya enviaste una calificación para este viaje.' });
        }

        await pool.query(
            'INSERT INTO calificaciones (id_viaje, id_quien_califica, id_calificado, puntuacion, comentario) VALUES ($1, $2, $3, $4, $5)',
            [idViaje, idUsuario, viaje.id_conductor, puntuacion, comentario]
        );

        respuesta.status(201).json({ mensaje: 'Calificación guardada correctamente.' });
    } catch (error) {
        console.error('Error al calificar viaje:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al guardar la calificación.' });
    }
});

enrutador.post('/:id/reportar', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idViaje = parseInt(peticion.params.id, 10);
        const motivo = peticion.body.motivo ? String(peticion.body.motivo).trim() : '';

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        if (motivo.length < 3) {
            return respuesta.status(400).json({ mensaje: 'Escribe o selecciona el motivo del reporte.' });
        }

        const consultaViaje = await pool.query(
            'SELECT id, id_conductor FROM viajes WHERE id = $1',
            [idViaje]
        );

        if (consultaViaje.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Viaje no encontrado.' });
        }

        const viaje = consultaViaje.rows[0];
        if (viaje.id_conductor !== idUsuario) {
            const consultaParticipacion = await pool.query(
                "SELECT id FROM reservaciones WHERE id_viaje = $1 AND id_pasajero = $2 AND estado = 'activa'",
                [idViaje, idUsuario]
            );
            if (consultaParticipacion.rows.length === 0) {
                return respuesta.status(403).json({ mensaje: 'Solo los participantes pueden reportar este viaje.' });
            }
        }

        await pool.query(
            'INSERT INTO reportes (id_viaje, id_quien_reporta, motivo) VALUES ($1, $2, $3)',
            [idViaje, idUsuario, motivo]
        );

        respuesta.status(201).json({
            mensaje: 'Reporte enviado correctamente. El equipo de Raity lo revisará.'
        });
    } catch (error) {
        console.error('Error al enviar reporte:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al enviar el reporte.' });
    }
});

module.exports = enrutador;
