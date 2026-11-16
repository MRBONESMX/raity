const express = require('express');
const session = require('express-session');
const conectarSesionesPg = require('connect-pg-simple');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const pool = require('./conexion');
const rutasUsuarios = require('./rutas/usuarios');
const rutasVehiculos = require('./rutas/vehiculos');
const rutasRutasGuardadas = require('./rutas/rutas-guardadas');
const rutasViajes = require('./rutas/viajes');
const rutasReservaciones = require('./rutas/reservaciones');

const aplicacion = express();
const puerto = process.env.PORT || process.env.PUERTO || 3000;
const esEntornoNube = Boolean(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    typeof Netlify !== 'undefined'
);
let baseInicializada = false;
let promesaInicializacion = null;

function resolverRutaSubidas(nombreArchivo) {
    const rutasPosibles = [
        path.join(__dirname, 'subidas', nombreArchivo),
        path.join(process.cwd(), 'servidor', 'subidas', nombreArchivo)
    ];
    for (let i = 0; i < rutasPosibles.length; i++) {
        if (fs.existsSync(rutasPosibles[i])) {
            return rutasPosibles[i];
        }
    }
    return null;
}

function resolverRutaSql(nombreArchivo) {
    const rutasPosibles = [
        path.join(__dirname, '..', 'base-de-datos', nombreArchivo),
        path.join(process.cwd(), 'base-de-datos', nombreArchivo)
    ];
    for (let i = 0; i < rutasPosibles.length; i++) {
        if (fs.existsSync(rutasPosibles[i])) {
            return rutasPosibles[i];
        }
    }
    return null;
}

aplicacion.set('trust proxy', 1);
aplicacion.use(express.json());
aplicacion.use(express.urlencoded({ extended: true }));

const AlmacenPg = conectarSesionesPg(session);
const almacenSesiones = new AlmacenPg({
    pool: pool,
    tableName: 'sesiones',
    createTableIfMissing: false,
    pruneSessionInterval: esEntornoNube ? false : 900
});

aplicacion.use(session({
    store: almacenSesiones,
    secret: process.env.SECRETO_SESION || 'secreto_escolar_raity_uabcs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto'
    }
}));

aplicacion.get('/subidas/:nombre', async function (peticion, respuesta) {
    try {
        const nombreSeguro = path.basename(peticion.params.nombre);
        const rutaArchivo = resolverRutaSubidas(nombreSeguro);
        if (rutaArchivo) {
            return respuesta.sendFile(rutaArchivo);
        }

        const consulta = await pool.query(
            'SELECT tipo, datos FROM archivos_subidos WHERE nombre = $1',
            [nombreSeguro]
        );
        if (consulta.rows.length === 0) {
            return respuesta.status(404).send('Archivo no encontrado.');
        }

        respuesta.set('Content-Type', consulta.rows[0].tipo);
        return respuesta.send(consulta.rows[0].datos);
    } catch (error) {
        console.error('Error al leer imagen subida:', error);
        return respuesta.status(500).send('Error al cargar la imagen.');
    }
});

if (!esEntornoNube) {
    aplicacion.use(express.static(path.join(__dirname, '..', 'publico')));
}

aplicacion.use('/api/usuarios', rutasUsuarios.enrutador);
aplicacion.use('/api/vehiculos', rutasUsuarios.verificarSesion, rutasVehiculos);
aplicacion.use('/api/rutas-guardadas', rutasUsuarios.verificarSesion, rutasRutasGuardadas);
aplicacion.use('/api/viajes', rutasUsuarios.verificarSesion, rutasViajes);
aplicacion.use('/api/reservaciones', rutasUsuarios.verificarSesion, rutasReservaciones);

async function inicializarBaseDeDatos() {
    if (baseInicializada) {
        return;
    }
    if (promesaInicializacion) {
        return promesaInicializacion;
    }

    promesaInicializacion = (async function () {
        try {
            const consulta = await pool.query("SELECT to_regclass('public.usuarios') AS tabla");
            if (!consulta.rows[0].tabla) {
                const rutaTablas = resolverRutaSql('crear-tablas.sql');
                const rutaDatos = resolverRutaSql('datos-de-prueba.sql');
                if (rutaTablas && rutaDatos) {
                    await pool.query(fs.readFileSync(rutaTablas, 'utf8'));
                    await pool.query(fs.readFileSync(rutaDatos, 'utf8'));
                    console.log('Tablas y datos de prueba creados automáticamente.');
                }
            } else {
                await pool.query(
                    'CREATE TABLE IF NOT EXISTS archivos_subidos (nombre VARCHAR(255) PRIMARY KEY, tipo VARCHAR(100) NOT NULL, datos BYTEA NOT NULL)'
                );
                await pool.query(
                    'CREATE TABLE IF NOT EXISTS sesiones (sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL)'
                );

                const consultaSemilla = await pool.query(
                    "SELECT id FROM usuarios WHERE correo_institucional = 'alumno_12@alu.uabcs.mx'"
                );
                if (consultaSemilla.rows.length === 0) {
                    const rutaDatos = resolverRutaSql('datos-de-prueba.sql');
                    if (rutaDatos) {
                        await pool.query(
                            'TRUNCATE TABLE sesiones, reportes, calificaciones, reservaciones, viajes, rutas_guardadas, vehiculos, usuarios RESTART IDENTITY CASCADE'
                        );
                        await pool.query(fs.readFileSync(rutaDatos, 'utf8'));
                        console.log('Datos de prueba de La Paz actualizados automáticamente.');
                    }
                }
            }
            baseInicializada = true;
        } catch (error) {
            console.error('No se pudo inicializar automáticamente la base de datos:', error.message);
        } finally {
            promesaInicializacion = null;
        }
    })();

    return promesaInicializacion;
}

async function iniciarServidor() {
    const rutaSubidas = path.join(__dirname, 'subidas');
    if (!fs.existsSync(rutaSubidas)) {
        fs.mkdirSync(rutaSubidas, { recursive: true });
    }
    await inicializarBaseDeDatos();
    aplicacion.listen(puerto, function () {
        console.log('Servidor de Raity escuchando en el puerto ' + puerto);
    });
}

if (require.main === module) {
    iniciarServidor();
}

module.exports = {
    aplicacion: aplicacion,
    inicializarBaseDeDatos: inicializarBaseDeDatos
};
