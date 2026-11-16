const express = require('express');
const pool = require('../conexion');

const enrutador = express.Router();

enrutador.get('/', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const consulta = await pool.query(
            'SELECT id, nombre, latitud_origen, longitud_origen, latitud_destino, longitud_destino FROM rutas_guardadas WHERE id_usuario = $1 ORDER BY id DESC',
            [idUsuario]
        );
        respuesta.json({ rutas: consulta.rows });
    } catch (error) {
        console.error('Error al obtener rutas guardadas:', error);
        respuesta.status(500).json({ mensaje: 'Error al consultar rutas guardadas.' });
    }
});

enrutador.post('/', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const nombre = peticion.body.nombre;
        const latitudOrigen = Number(peticion.body.latitud_origen);
        const longitudOrigen = Number(peticion.body.longitud_origen);
        const latitudDestino = Number(peticion.body.latitud_destino);
        const longitudDestino = Number(peticion.body.longitud_destino);

        if (!nombre || isNaN(latitudOrigen) || isNaN(longitudOrigen) || isNaN(latitudDestino) || isNaN(longitudDestino)) {
            return respuesta.status(400).json({
                mensaje: 'Debes escribir el nombre de la ruta y marcar el origen y destino en el mapa.'
            });
        }

        const insercion = await pool.query(
            'INSERT INTO rutas_guardadas (id_usuario, nombre, latitud_origen, longitud_origen, latitud_destino, longitud_destino) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [idUsuario, nombre.trim(), latitudOrigen, longitudOrigen, latitudDestino, longitudDestino]
        );

        respuesta.status(201).json({
            mensaje: 'Ruta guardada correctamente.',
            ruta: insercion.rows[0]
        });
    } catch (error) {
        console.error('Error al guardar la ruta:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al guardar la ruta.' });
    }
});

enrutador.delete('/:id', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idRuta = parseInt(peticion.params.id, 10);

        if (isNaN(idRuta)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de ruta no válido.' });
        }

        const viajesActivos = await pool.query(
            "SELECT id FROM viajes WHERE id_ruta = $1 AND estado IN ('programado', 'en_curso')",
            [idRuta]
        );

        if (viajesActivos.rows.length > 0) {
            return respuesta.status(400).json({
                mensaje: 'No puedes eliminar una ruta que está asignada a un viaje programado o en curso.'
            });
        }

        const eliminacion = await pool.query(
            'DELETE FROM rutas_guardadas WHERE id = $1 AND id_usuario = $2 RETURNING id',
            [idRuta, idUsuario]
        );

        if (eliminacion.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Ruta no encontrada.' });
        }

        respuesta.json({ mensaje: 'Ruta eliminada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar la ruta:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al eliminar la ruta.' });
    }
});

module.exports = enrutador;
