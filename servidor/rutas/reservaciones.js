const express = require('express');
const pool = require('../conexion');

const enrutador = express.Router();

enrutador.post('/', async function (peticion, respuesta) {
    try {
        const usuarioActual = peticion.session.usuario;
        const idViaje = parseInt(peticion.body.id_viaje, 10);

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        const consultaViaje = await pool.query(
            'SELECT id, id_conductor, es_violeta, estado FROM viajes WHERE id = $1',
            [idViaje]
        );

        if (consultaViaje.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'El viaje no existe.' });
        }

        const viaje = consultaViaje.rows[0];

        if (viaje.estado !== 'programado') {
            return respuesta.status(400).json({ mensaje: 'Este viaje ya no acepta reservaciones.' });
        }

        if (viaje.id_conductor === usuarioActual.id) {
            return respuesta.status(400).json({ mensaje: 'No puedes reservar un asiento en tu propio viaje.' });
        }

        if (viaje.es_violeta && usuarioActual.genero !== 'Mujer') {
            return respuesta.status(403).json({
                mensaje: 'Este viaje es exclusivo para estudiantes mujeres (Raity Violeta).'
            });
        }

        const reservacionExistente = await pool.query(
            "SELECT id FROM reservaciones WHERE id_viaje = $1 AND id_pasajero = $2 AND estado = 'activa'",
            [idViaje, usuarioActual.id]
        );

        if (reservacionExistente.rows.length > 0) {
            return respuesta.status(400).json({ mensaje: 'Ya tienes un asiento reservado en este viaje.' });
        }

        // Descuenta el asiento en una sola consulta segura para evitar sobreventa
        const actualizacionLugares = await pool.query(
            'UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1 WHERE id = $1 AND lugares_disponibles > 0 RETURNING id, lugares_disponibles',
            [idViaje]
        );

        if (actualizacionLugares.rowCount === 0) {
            return respuesta.status(400).json({ mensaje: 'Lo sentimos, ya no hay lugares disponibles en este viaje.' });
        }

        const insercion = await pool.query(
            "INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES ($1, $2, 'activa') RETURNING *",
            [idViaje, usuarioActual.id]
        );

        respuesta.status(201).json({
            mensaje: 'Asiento reservado correctamente.',
            reservacion: insercion.rows[0]
        });
    } catch (error) {
        console.error('Error al reservar asiento:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al realizar la reservación.' });
    }
});

enrutador.delete('/:id', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idReservacion = parseInt(peticion.params.id, 10);

        if (isNaN(idReservacion)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de reservación no válido.' });
        }

        const consulta = await pool.query(
            `
            SELECT reservaciones.id, reservaciones.id_viaje, reservaciones.id_pasajero, reservaciones.estado, viajes.id_conductor
            FROM reservaciones
            JOIN viajes ON reservaciones.id_viaje = viajes.id
            WHERE reservaciones.id = $1
            `,
            [idReservacion]
        );

        if (consulta.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Reservación no encontrada.' });
        }

        const reservacion = consulta.rows[0];

        if (reservacion.estado !== 'activa') {
            return respuesta.status(400).json({ mensaje: 'Esta reservación ya fue cancelada.' });
        }

        if (reservacion.id_pasajero !== idUsuario && reservacion.id_conductor !== idUsuario) {
            return respuesta.status(403).json({ mensaje: 'No tienes permiso para cancelar esta reservación.' });
        }

        await pool.query(
            "UPDATE reservaciones SET estado = 'cancelada' WHERE id = $1",
            [idReservacion]
        );

        await pool.query(
            'UPDATE viajes SET lugares_disponibles = lugares_disponibles + 1 WHERE id = $1 AND lugares_disponibles < lugares_totales',
            [reservacion.id_viaje]
        );

        respuesta.json({ mensaje: 'Reservación cancelada y asiento liberado.' });
    } catch (error) {
        console.error('Error al cancelar reservación:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al cancelar la reservación.' });
    }
});

module.exports = enrutador;
