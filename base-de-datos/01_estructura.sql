-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 01: Estructura DDL (Dominios, Tablas, Restricciones e Índices)
-- Ejecutar primero sobre una base de datos vacía (PostgreSQL 14+).
-- ============================================================================

DROP TRIGGER IF EXISTS trg_auditoria_calificaciones ON calificaciones;
DROP TRIGGER IF EXISTS trg_auditoria_reservaciones ON reservaciones;
DROP TRIGGER IF EXISTS trg_auditoria_viajes ON viajes;
DROP TRIGGER IF EXISTS trg_validar_reservacion_raity ON reservaciones;

DROP PROCEDURE IF EXISTS sp_reservar_asiento_con_recogida(INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER);
DROP PROCEDURE IF EXISTS sp_actualizar_punto_recogida_gps(INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS fn_aplicar_operacion_marca_tiempo(VARCHAR, BIGINT, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS fn_registrar_auditoria_raity();
DROP FUNCTION IF EXISTS fn_validar_reservacion_raity();

DROP TABLE IF EXISTS sesiones CASCADE;
DROP TABLE IF EXISTS archivos_subidos CASCADE;
DROP TABLE IF EXISTS control_marcas_tiempo CASCADE;
DROP TABLE IF EXISTS bitacora_auditoria CASCADE;
DROP TABLE IF EXISTS reportes CASCADE;
DROP TABLE IF EXISTS calificaciones CASCADE;
DROP TABLE IF EXISTS reservaciones CASCADE;
DROP TABLE IF EXISTS viajes CASCADE;
DROP TABLE IF EXISTS rutas_guardadas CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

DROP DOMAIN IF EXISTS dominio_calificacion;
DROP DOMAIN IF EXISTS dominio_correo_uabcs;

-- ----------------------------------------------------------------------------
-- 1. Dominios personalizados (Integridad de Dominio)
-- ----------------------------------------------------------------------------
CREATE DOMAIN dominio_correo_uabcs AS VARCHAR(120)
    CHECK (VALUE LIKE '%@alu.uabcs.mx');

CREATE DOMAIN dominio_calificacion AS INTEGER
    CHECK (VALUE >= 1 AND VALUE <= 5);

-- ----------------------------------------------------------------------------
-- 2. Tablas del negocio (7 tablas principales relacionadas)
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    correo_institucional dominio_correo_uabcs NOT NULL UNIQUE,
    numero_control VARCHAR(30) NOT NULL UNIQUE,
    contrasena_cifrada VARCHAR(255) NOT NULL,
    genero VARCHAR(30) NOT NULL CHECK (genero IN ('Mujer', 'Hombre', 'Prefiero no decir')),
    es_administrador BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modelo VARCHAR(100) NOT NULL,
    matricula VARCHAR(20) NOT NULL UNIQUE,
    color VARCHAR(50) NOT NULL,
    numero_asientos INTEGER NOT NULL CHECK (numero_asientos >= 1 AND numero_asientos <= 4),
    foto_vehiculo VARCHAR(255) NOT NULL,
    foto_credencial VARCHAR(255) NOT NULL
);

CREATE TABLE rutas_guardadas (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    latitud_origen NUMERIC(9, 6) NOT NULL CHECK (latitud_origen BETWEEN -90 AND 90),
    longitud_origen NUMERIC(9, 6) NOT NULL CHECK (longitud_origen BETWEEN -180 AND 180),
    latitud_destino NUMERIC(9, 6) NOT NULL CHECK (latitud_destino BETWEEN -90 AND 90),
    longitud_destino NUMERIC(9, 6) NOT NULL CHECK (longitud_destino BETWEEN -180 AND 180)
);

CREATE TABLE viajes (
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

CREATE TABLE reservaciones (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_pasajero INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    latitud_pasajero NUMERIC(9, 6) CHECK (latitud_pasajero IS NULL OR (latitud_pasajero BETWEEN -90 AND 90)),
    longitud_pasajero NUMERIC(9, 6) CHECK (longitud_pasajero IS NULL OR (longitud_pasajero BETWEEN -180 AND 180)),
    latitud_recogida NUMERIC(9, 6) CHECK (latitud_recogida IS NULL OR (latitud_recogida BETWEEN -90 AND 90)),
    longitud_recogida NUMERIC(9, 6) CHECK (longitud_recogida IS NULL OR (longitud_recogida BETWEEN -180 AND 180)),
    distancia_ruta_metros INTEGER CHECK (distancia_ruta_metros IS NULL OR distancia_ruta_metros >= 0),
    fuera_de_ruta BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_reservacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada'))
);

CREATE TABLE calificaciones (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_quien_califica INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_calificado INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    puntuacion dominio_calificacion NOT NULL,
    comentario TEXT,
    CONSTRAINT uq_calificacion_unica_viaje UNIQUE (id_viaje, id_quien_califica, id_calificado)
);

CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    id_viaje INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
    id_quien_reporta INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL CHECK (LENGTH(TRIM(motivo)) >= 3),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. Tabla de bitácora de auditoría y tablas de soporte técnico
-- ----------------------------------------------------------------------------
CREATE TABLE bitacora_auditoria (
    id SERIAL PRIMARY KEY,
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tabla_afectada VARCHAR(60) NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    id_registro INTEGER,
    usuario_bd VARCHAR(80) NOT NULL DEFAULT CURRENT_USER,
    pid_sesion INTEGER NOT NULL DEFAULT pg_backend_pid(),
    detalle_evento TEXT NOT NULL
);

CREATE TABLE control_marcas_tiempo (
    id SERIAL PRIMARY KEY,
    recurso VARCHAR(80) NOT NULL UNIQUE,
    valor_actual INTEGER NOT NULL DEFAULT 0,
    ultima_marca_lectura BIGINT NOT NULL DEFAULT 0,
    ultima_marca_escritura BIGINT NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE archivos_subidos (
    nombre VARCHAR(255) PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    datos BYTEA NOT NULL
);

CREATE TABLE sesiones (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. Índices de apoyo
-- ----------------------------------------------------------------------------
CREATE INDEX idx_reservaciones_viaje_estado ON reservaciones (id_viaje, estado);
CREATE INDEX idx_viajes_estado_lugares ON viajes (estado, lugares_disponibles);
CREATE INDEX idx_bitacora_tabla_fecha ON bitacora_auditoria (tabla_afectada, fecha_hora DESC);
