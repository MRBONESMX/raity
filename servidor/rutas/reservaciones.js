const express = require('express');
const pool = require('../conexion');

const enrutador = express.Router();
const UMBRAL_FUERA_DE_RUTA_METROS = 80;

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371000;
    const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
    const radLat1 = (Number(lat1) * Math.PI) / 180;
    const radLat2 = (Number(lat2) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radioTierra * c;
}

function proyectarPuntoEnSegmento(latP, lonP, latA, lonA, latB, lonB) {
    const pLat = Number(latP);
    const pLon = Number(lonP);
    const aLat = Number(latA);
    const aLon = Number(lonA);
    const bLat = Number(latB);
    const bLon = Number(lonB);

    const factorCos = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
    const ax = aLon * factorCos;
    const ay = aLat;
    const bx = bLon * factorCos;
    const by = bLat;
    const px = pLon * factorCos;
    const py = pLat;

    const dx = bx - ax;
    const dy = by - ay;
    const longitudCuadrada = dx * dx + dy * dy;

    let t = 0;
    if (longitudCuadrada > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / longitudCuadrada;
        if (t < 0) {
            t = 0;
        } else if (t > 1) {
            t = 1;
        }
    }

    return [aLat + t * (bLat - aLat), aLon + t * (bLon - aLon)];
}

function generarCaminoVialLaPazServidor(latOrigen, lonOrigen, latDestino, lonDestino) {
    const origenLat = Number(latOrigen);
    const origenLon = Number(lonOrigen);
    const destinoLat = Number(latDestino);
    const destinoLon = Number(lonDestino);

    const difLat = Math.abs(destinoLat - origenLat);
    const difLon = Math.abs(destinoLon - origenLon);
    if (difLat < 0.001 && difLon < 0.001) {
        return [
            [origenLat, origenLon],
            [destinoLat, destinoLon]
        ];
    }

    const lonCorredorForjadores = -110.3148;
    const latEntronqueUabcs = 24.1045;
    const puntos = [[origenLat, origenLon]];

    if (origenLon < -110.322 && destinoLon > -110.320) {
        puntos.push([origenLat, lonCorredorForjadores]);
        puntos.push([latEntronqueUabcs, lonCorredorForjadores]);
    } else if (origenLon > -110.305 && destinoLon < -110.312) {
        puntos.push([origenLat, -110.3120]);
        puntos.push([latEntronqueUabcs, -110.3145]);
    } else {
        const latMedio = Number(((origenLat + destinoLat) / 2).toFixed(6));
        puntos.push([latMedio, origenLon]);
        puntos.push([latMedio, destinoLon]);
    }

    puntos.push([destinoLat, destinoLon]);
    return puntos;
}

function validarCoordenada(latValor, lonValor) {
    if (latValor === undefined || latValor === null || latValor === '' || lonValor === undefined || lonValor === null || lonValor === '') {
        return null;
    }
    const lat = Number(latValor);
    const lon = Number(lonValor);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }
    return {
        latitud: Number(lat.toFixed(6)),
        longitud: Number(lon.toFixed(6))
    };
}

function sanitizarPuntosRuta(puntosEntrada, ruta) {
    if (!Array.isArray(puntosEntrada) || puntosEntrada.length < 2 || puntosEntrada.length > 2500) {
        return null;
    }

    const puntosLimpios = [];
    for (let i = 0; i < puntosEntrada.length; i++) {
        const item = puntosEntrada[i];
        if (!Array.isArray(item) || item.length < 2) {
            return null;
        }
        const lat = Number(item[0]);
        const lon = Number(item[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return null;
        }
        puntosLimpios.push([lat, lon]);
    }

    const distInicio = calcularDistanciaMetros(
        puntosLimpios[0][0],
        puntosLimpios[0][1],
        ruta.latitud_origen,
        ruta.longitud_origen
    );
    const ultimo = puntosLimpios[puntosLimpios.length - 1];
    const distFin = calcularDistanciaMetros(
        ultimo[0],
        ultimo[1],
        ruta.latitud_destino,
        ruta.longitud_destino
    );

    if (distInicio > 1500 || distFin > 1500) {
        return null;
    }

    return puntosLimpios;
}

function calcularRecogidaSobreRuta(latPasajero, lonPasajero, ruta, puntosRutaOpcionales) {
    const puntosRuta =
        sanitizarPuntosRuta(puntosRutaOpcionales, ruta) ||
        generarCaminoVialLaPazServidor(
            ruta.latitud_origen,
            ruta.longitud_origen,
            ruta.latitud_destino,
            ruta.longitud_destino
        );

    let mejorPunto = [Number(ruta.latitud_origen), Number(ruta.longitud_origen)];
    let menorDistancia = Infinity;

    for (let i = 0; i < puntosRuta.length - 1; i++) {
        const puntoA = puntosRuta[i];
        const puntoB = puntosRuta[i + 1];
        const candidato = proyectarPuntoEnSegmento(
            latPasajero,
            lonPasajero,
            puntoA[0],
            puntoA[1],
            puntoB[0],
            puntoB[1]
        );
        const distancia = calcularDistanciaMetros(latPasajero, lonPasajero, candidato[0], candidato[1]);
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            mejorPunto = candidato;
        }
    }

    const distanciaMetros = Math.round(menorDistancia);
    const fueraDeRuta = distanciaMetros > UMBRAL_FUERA_DE_RUTA_METROS;

    return {
        latitud_pasajero: Number(Number(latPasajero).toFixed(6)),
        longitud_pasajero: Number(Number(lonPasajero).toFixed(6)),
        latitud_recogida: Number(mejorPunto[0].toFixed(6)),
        longitud_recogida: Number(mejorPunto[1].toFixed(6)),
        distancia_ruta_metros: distanciaMetros,
        fuera_de_ruta: fueraDeRuta
    };
}

function construirMensajeRecogida(datosRecogida) {
    if (datosRecogida.fuera_de_ruta) {
        return (
            'Tu ubicación está fuera de la ruta establecida del conductor (a ' +
            datosRecogida.distancia_ruta_metros +
            ' m). Debes acercarte al punto de recogida marcado sobre la ruta para poder ser recogido.'
        );
    }
    return 'Punto de recogida fijado sobre la ruta establecida del conductor.';
}

enrutador.post('/', async function (peticion, respuesta) {
    try {
        const usuarioActual = peticion.session.usuario;
        const idViaje = parseInt(peticion.body.id_viaje, 10);

        if (isNaN(idViaje)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de viaje no válido.' });
        }

        const consultaViaje = await pool.query(
            `
            SELECT
                viajes.id,
                viajes.id_conductor,
                viajes.es_violeta,
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

        const coordPasajero = validarCoordenada(
            peticion.body.latitud_pasajero,
            peticion.body.longitud_pasajero
        );
        const datosRecogida = coordPasajero
            ? calcularRecogidaSobreRuta(
                  coordPasajero.latitud,
                  coordPasajero.longitud,
                  viaje,
                  peticion.body.puntos_ruta
              )
            : null;

        // Descuenta el asiento en una sola consulta segura para evitar sobreventa
        const actualizacionLugares = await pool.query(
            'UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1 WHERE id = $1 AND lugares_disponibles > 0 RETURNING id, lugares_disponibles',
            [idViaje]
        );

        if (actualizacionLugares.rowCount === 0) {
            return respuesta.status(400).json({ mensaje: 'Lo sentimos, ya no hay lugares disponibles en este viaje.' });
        }

        const insercion = await pool.query(
            `
            INSERT INTO reservaciones (
                id_viaje,
                id_pasajero,
                latitud_pasajero,
                longitud_pasajero,
                latitud_recogida,
                longitud_recogida,
                distancia_ruta_metros,
                fuera_de_ruta,
                estado
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activa')
            RETURNING *
            `,
            [
                idViaje,
                usuarioActual.id,
                datosRecogida ? datosRecogida.latitud_pasajero : null,
                datosRecogida ? datosRecogida.longitud_pasajero : null,
                datosRecogida ? datosRecogida.latitud_recogida : null,
                datosRecogida ? datosRecogida.longitud_recogida : null,
                datosRecogida ? datosRecogida.distancia_ruta_metros : null,
                datosRecogida ? datosRecogida.fuera_de_ruta : false
            ]
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

enrutador.put('/:id/ubicacion', async function (peticion, respuesta) {
    try {
        const idUsuario = peticion.session.usuario.id;
        const idReservacion = parseInt(peticion.params.id, 10);

        if (isNaN(idReservacion)) {
            return respuesta.status(400).json({ mensaje: 'Identificador de reservación no válido.' });
        }

        const coordPasajero = validarCoordenada(
            peticion.body.latitud_pasajero,
            peticion.body.longitud_pasajero
        );
        if (!coordPasajero) {
            return respuesta.status(400).json({ mensaje: 'Las coordenadas GPS del pasajero no son válidas.' });
        }

        const consulta = await pool.query(
            `
            SELECT
                reservaciones.id,
                reservaciones.id_pasajero,
                reservaciones.estado,
                viajes.estado AS estado_viaje,
                rutas_guardadas.latitud_origen,
                rutas_guardadas.longitud_origen,
                rutas_guardadas.latitud_destino,
                rutas_guardadas.longitud_destino
            FROM reservaciones
            JOIN viajes ON reservaciones.id_viaje = viajes.id
            JOIN rutas_guardadas ON viajes.id_ruta = rutas_guardadas.id
            WHERE reservaciones.id = $1
            `,
            [idReservacion]
        );

        if (consulta.rows.length === 0) {
            return respuesta.status(404).json({ mensaje: 'Reservación no encontrada.' });
        }

        const registro = consulta.rows[0];
        if (registro.id_pasajero !== idUsuario) {
            return respuesta.status(403).json({ mensaje: 'Solo el pasajero titular puede compartir su ubicación.' });
        }

        if (registro.estado !== 'activa' || (registro.estado_viaje !== 'programado' && registro.estado_viaje !== 'en_curso')) {
            return respuesta.status(400).json({ mensaje: 'No se puede actualizar el punto de recogida en este viaje.' });
        }

        const datosRecogida = calcularRecogidaSobreRuta(
            coordPasajero.latitud,
            coordPasajero.longitud,
            registro,
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
        console.error('Error al guardar ubicación del pasajero:', error);
        respuesta.status(500).json({ mensaje: 'Error interno al guardar el punto de recogida.' });
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

enrutador.UMBRAL_FUERA_DE_RUTA_METROS = UMBRAL_FUERA_DE_RUTA_METROS;
enrutador.validarCoordenada = validarCoordenada;
enrutador.calcularRecogidaSobreRuta = calcularRecogidaSobreRuta;
enrutador.construirMensajeRecogida = construirMensajeRecogida;

module.exports = enrutador;
