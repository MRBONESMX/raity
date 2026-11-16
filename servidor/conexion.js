const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const cadenaConexion = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
let pool;

if (cadenaConexion) {
    const esLocal = cadenaConexion.indexOf('localhost') !== -1 || cadenaConexion.indexOf('127.0.0.1') !== -1;
    pool = new Pool({
        connectionString: cadenaConexion,
        ssl: esLocal ? false : { rejectUnauthorized: false },
        idleTimeoutMillis: 30000
    });
} else {
    pool = new Pool({
        host: process.env.BD_HOST || 'localhost',
        port: process.env.BD_PUERTO || 5432,
        user: process.env.BD_USUARIO || 'postgres',
        password: process.env.BD_CONTRASENA || 'postgres',
        database: process.env.BD_NOMBRE || 'raity'
    });
}

module.exports = pool;
