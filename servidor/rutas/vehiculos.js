const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../conexion');

const enrutador = express.Router();

const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

async function guardarImagenSubida(archivo) {
    const nombreLimpio = archivo.originalname.split(' ').join('_');
    const nombreFinal = Date.now() + '-' + nombreLimpio;
    const tipoArchivo = archivo.mimetype || 'image/jpeg';

    if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.LAMBDA_TASK_ROOT && typeof Netlify === 'undefined') {
        const rutaCarpeta = path.join(__dirname, '..', 'subidas');
        if (!fs.existsSync(rutaCarpeta)) {
            fs.mkdirSync(rutaCarpeta, { recursive: true });
        }
        fs.writeFileSync(path.join(rutaCarpeta, nombreFinal), archivo.buffer);
    }

    await pool.query(
        'INSERT INTO archivos_subidos (nombre, tipo, datos) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO NOTHING',
        [nombreFinal, tipoArchivo, archivo.buffer]
    );

    return '/subidas/' + nombreFinal;
}

enrutador.get('/', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const consulta = await pool.query(
            'SELECT id, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial FROM vehiculos WHERE id_usuario = $1 ORDER BY id DESC',
            [idUsuario]
        );
        respuesta.json({ vehiculos: consulta.rows });
    } catch (error) {
        console.error('Error al obtener vehículos:', error);
        respuesta.status(500).json({ mensaje: 'Error al consultar vehículos.' });
    }
});

const camposImagenes = subida.fields([
    { name: 'foto_credencial', maxCount: 1 },
    { name: 'foto_vehiculo', maxCount: 1 }
]);

enrutador.post('/', camposImagenes, async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const modelo = peticion.body.modelo;
        const matricula = peticion.body.matricula;
        const color = peticion.body.color;
        const numeroAsientos = parseInt(peticion.body.numero_asientos, 10);

        if (!modelo || !matricula || !color || isNaN(numeroAsientos)) {
            return respuesta.status(400).json({ mensaje: 'Por favor, completa todos los datos del vehículo.' });
        }

        if (numeroAsientos < 1 || numeroAsientos > 4) {
            return respuesta.status(400).json({ mensaje: 'Los asientos disponibles deben estar entre 1 y 4.' });
        }

        if (!peticion.files || !peticion.files.foto_credencial || !peticion.files.foto_vehiculo) {
            return respuesta.status(400).json({
                mensaje: 'Debes subir la imagen de tu credencial vigente y la foto de tu vehículo.'
            });
        }

        const rutaCredencial = await guardarImagenSubida(peticion.files.foto_credencial[0]);
        const rutaVehiculo = await guardarImagenSubida(peticion.files.foto_vehiculo[0]);

        const insercion = await pool.query(
            'INSERT INTO vehiculos (id_usuario, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [idUsuario, modelo.trim(), matricula.trim().toUpperCase(), color.trim(), numeroAsientos, rutaVehiculo, rutaCredencial]
        );

        respuesta.status(201).json({
            mensaje: 'Vehículo registrado correctamente.',
            vehiculo: insercion.rows[0]
        });
    } catch (error) {
        console.error('Error al registrar vehículo:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al guardar el vehículo.' });
    }
});

enrutador.delete('/:id', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idVehiculo = parseInt(peticion.params.id, 10);

        if (isNaN(idVehiculo)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de vehículo no válido.' });
        }

        const viajesActivos = await pool.query(
            "SELECT id FROM viajes WHERE id_vehiculo = $1 AND estado IN ('programado', 'en_curso')",
            [idVehiculo]
        );

        if (viajesActivos.rows.length > 0) {
            return respuesta.status(400).json({
                mensaje: 'No puedes eliminar un vehículo que tiene un viaje programado o en curso.'
            });
        }

        const eliminacion = await pool.query(
            'DELETE FROM vehiculos WHERE id = $1 AND id_usuario = $2 RETURNING id',
            [idVehiculo, idUsuario]
        );

        if (eliminacion.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Vehículo no encontrado.' });
        }

        respuesta.json({ mensaje: 'Vehículo eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al eliminar el vehículo.' });
    }
});

module.exports = enrutador;
