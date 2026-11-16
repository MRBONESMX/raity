CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    correo_institucional VARCHAR(120) NOT NULL UNIQUE,
    numero_control VARCHAR(30) NOT NULL UNIQUE,
    contrasena_cifrada VARCHAR(255) NOT NULL,
    genero VARCHAR(30) NOT NULL CHECK (genero IN ('Mujer', 'Hombre', 'Prefiero no decir')),
    es_administrador BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehiculos (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modelo VARCHAR(100) NOT NULL,
    matricula VARCHAR(20) NOT NULL,
    color VARCHAR(50) NOT NULL,
    numero_asientos INTEGER NOT NULL CHECK (numero_asientos >= 1 AND numero_asientos <= 4),
    foto_vehiculo VARCHAR(255) NOT NULL,
    foto_credencial VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS rutas_guardadas (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    latitud_origen NUMERIC(9, 6) NOT NULL,
    longitud_origen NUMERIC(9, 6) NOT NULL,
    latitud_destino NUMERIC(9, 6) NOT NULL,
    longitud_destino NUMERIC(9, 6) NOT NULL
);

CREATE TABLE IF NOT EXISTS viajes (
    id SERIAL PRIMARY KEY,
    id_conductor INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_vehiculo INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    id_ruta INTEGER NOT NULL REFERENCES rutas_guardadas(id) ON DELETE CASCADE,
    origen VARCHAR(120) NOT NULL,
    destino VARCHAR(120) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_salida VARCHAR(20) NOT NULL,
    lugares_totales INTEGER NOT NULL CHECK (lugares_totales >= 1 AND lugares_totales <= 4),
    lugares_disponibles INTEGER NOT NULL CHECK (lugares_disponibles >= 0 AND lugares_disponibles <= lugares_totales),
    es_violeta BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(20) NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado', 'en_curso', 'terminado', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS reservaciones (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_pasajero INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_reservacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada'))
);

CREATE TABLE IF NOT EXISTS calificaciones (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_quien_califica INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_calificado INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    puntuacion INTEGER NOT NULL CHECK (puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT
);

CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_quien_reporta INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archivos_subidos (
    nombre VARCHAR(255) PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    datos BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
