const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

let poolReal = null;

function obtenerPool() {
    if (poolReal) {
        return poolReal;
    }

    const netlifyUrl =
        (typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.get('NETLIFY_DB_URL')) ||
        process.env.NETLIFY_DB_URL;

    if (netlifyUrl) {
        const { getDatabase } = require('@netlify/database');
        poolReal = getDatabase().pool;
        return poolReal;
    }

    const cadenaConexion = process.env.DATABASE_URL;
    if (cadenaConexion) {
        const esLocal = cadenaConexion.indexOf('localhost') !== -1 || cadenaConexion.indexOf('127.0.0.1') !== -1;
        poolReal = new Pool({
            connectionString: cadenaConexion,
            ssl: esLocal ? false : { rejectUnauthorized: false },
            idleTimeoutMillis: 30000
        });
        return poolReal;
    }

    poolReal = new Pool({
        host: process.env.BD_HOST || 'localhost',
        port: process.env.BD_PUERTO || 5432,
        user: process.env.BD_USUARIO || 'postgres',
        password: process.env.BD_CONTRASENA || 'postgres',
        database: process.env.BD_NOMBRE || 'raity'
    });
    return poolReal;
}

const pool = {
    query: function () {
        const activo = obtenerPool();
        return activo.query.apply(activo, arguments);
    },
    connect: function () {
        const activo = obtenerPool();
        return activo.connect.apply(activo, arguments);
    },
    on: function () {
        const activo = obtenerPool();
        return activo.on.apply(activo, arguments);
    }
};

module.exports = pool;
