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

CREATE DOMAIN dominio_correo_uabcs AS VARCHAR(120)
    CHECK (VALUE LIKE '%@alu.uabcs.mx');

CREATE DOMAIN dominio_calificacion AS INTEGER
    CHECK (VALUE >= 1 AND VALUE <= 5);

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

CREATE INDEX idx_reservaciones_viaje_estado ON reservaciones (id_viaje, estado);
CREATE INDEX idx_viajes_estado_lugares ON viajes (estado, lugares_disponibles);
CREATE INDEX idx_bitacora_tabla_fecha ON bitacora_auditoria (tabla_afectada, fecha_hora DESC);

CREATE OR REPLACE FUNCTION fn_validar_reservacion_raity()
RETURNS TRIGGER AS $$
DECLARE
    v_viaje RECORD;
    v_pasajero RECORD;
    v_reservas_activas INTEGER;
BEGIN
    SELECT id, id_conductor, es_violeta, estado, lugares_totales
    INTO v_viaje
    FROM viajes
    WHERE id = NEW.id_viaje
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El viaje % no existe.', NEW.id_viaje;
    END IF;

    IF NEW.id_pasajero = v_viaje.id_conductor THEN
        RAISE EXCEPTION 'Regla de negocio violada: el conductor no puede reservar asiento en su propio viaje.';
    END IF;

    SELECT id, genero, activo
    INTO v_pasajero
    FROM usuarios
    WHERE id = NEW.id_pasajero;

    IF NOT FOUND OR NOT v_pasajero.activo THEN
        RAISE EXCEPTION 'El pasajero % no existe o no está activo.', NEW.id_pasajero;
    END IF;

    IF v_viaje.es_violeta AND v_pasajero.genero <> 'Mujer' THEN
        RAISE EXCEPTION 'Regla Raity Violeta: este viaje es exclusivo para estudiantes mujeres.';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.estado = 'activa' THEN
        IF EXISTS (
            SELECT 1
            FROM reservaciones
            WHERE id_viaje = NEW.id_viaje
              AND id_pasajero = NEW.id_pasajero
              AND estado = 'activa'
        ) THEN
            RAISE EXCEPTION 'El pasajero ya cuenta con una reservación activa en el viaje %.', NEW.id_viaje;
        END IF;

        SELECT COUNT(*)
        INTO v_reservas_activas
        FROM reservaciones
        WHERE id_viaje = NEW.id_viaje
          AND estado = 'activa';

        IF v_reservas_activas >= v_viaje.lugares_totales THEN
            RAISE EXCEPTION 'Capacidad máxima alcanzada: el viaje % ya tiene sus % asientos ocupados.', NEW.id_viaje, v_viaje.lugares_totales;
        END IF;
    END IF;

    IF NEW.distancia_ruta_metros IS NOT NULL THEN
        NEW.fuera_de_ruta := (NEW.distancia_ruta_metros > 80);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_reservacion_raity
    BEFORE INSERT OR UPDATE ON reservaciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_reservacion_raity();

CREATE OR REPLACE FUNCTION fn_registrar_auditoria_raity()
RETURNS TRIGGER AS $$
DECLARE
    v_id_registro INTEGER;
    v_detalle TEXT;
BEGIN
    IF TG_TABLE_NAME = 'viajes' THEN
        v_id_registro := COALESCE(NEW.id, OLD.id);
        IF TG_OP = 'INSERT' THEN
            v_detalle := 'Viaje creado (' || NEW.origen || ' -> ' || NEW.destino || ', lugares: ' || NEW.lugares_disponibles || '/' || NEW.lugares_totales || ', estado: ' || NEW.estado || ')';
        ELSIF TG_OP = 'UPDATE' THEN
            v_detalle := 'Viaje actualizado (estado: ' || OLD.estado || ' -> ' || NEW.estado || ', lugares: ' || OLD.lugares_disponibles || ' -> ' || NEW.lugares_disponibles || ')';
        ELSE
            v_detalle := 'Viaje eliminado (' || OLD.origen || ' -> ' || OLD.destino || ')';
        END IF;
    ELSIF TG_TABLE_NAME = 'reservaciones' THEN
        v_id_registro := COALESCE(NEW.id, OLD.id);
        IF TG_OP = 'INSERT' THEN
            v_detalle := 'Reservación creada (viaje #' || NEW.id_viaje || ', pasajero #' || NEW.id_pasajero || ', estado: ' || NEW.estado || ')';
        ELSIF TG_OP = 'UPDATE' THEN
            v_detalle := 'Reservación actualizada (viaje #' || NEW.id_viaje || ', pasajero #' || NEW.id_pasajero || ', estado: ' || OLD.estado || ' -> ' || NEW.estado || COALESCE(', recogida GPS: ' || NEW.latitud_recogida || ',' || NEW.longitud_recogida || ' fuera_de_ruta=' || NEW.fuera_de_ruta, '') || ')';
        ELSE
            v_detalle := 'Reservación eliminada (viaje #' || OLD.id_viaje || ', pasajero #' || OLD.id_pasajero || ')';
        END IF;
    ELSIF TG_TABLE_NAME = 'calificaciones' THEN
        v_id_registro := COALESCE(NEW.id, OLD.id);
        IF TG_OP = 'INSERT' THEN
            v_detalle := 'Calificación registrada (viaje #' || NEW.id_viaje || ', puntuación: ' || NEW.puntuacion || ')';
        ELSIF TG_OP = 'UPDATE' THEN
            v_detalle := 'Calificación actualizada (viaje #' || NEW.id_viaje || ', puntuación: ' || OLD.puntuacion || ' -> ' || NEW.puntuacion || ')';
        ELSE
            v_detalle := 'Calificación eliminada (viaje #' || OLD.id_viaje || ')';
        END IF;
    ELSE
        v_id_registro := NULL;
        v_detalle := 'Operación ' || TG_OP || ' en ' || TG_TABLE_NAME;
    END IF;

    INSERT INTO bitacora_auditoria (tabla_afectada, operacion, id_registro, usuario_bd, pid_sesion, detalle_evento)
    VALUES (TG_TABLE_NAME, TG_OP, v_id_registro, CURRENT_USER, pg_backend_pid(), v_detalle);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_viajes
    AFTER INSERT OR UPDATE OR DELETE ON viajes
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_auditoria_raity();

CREATE TRIGGER trg_auditoria_reservaciones
    AFTER INSERT OR UPDATE OR DELETE ON reservaciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_auditoria_raity();

CREATE TRIGGER trg_auditoria_calificaciones
    AFTER INSERT OR UPDATE OR DELETE ON calificaciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_auditoria_raity();

CREATE OR REPLACE PROCEDURE sp_reservar_asiento_con_recogida(
    p_id_viaje INTEGER,
    p_id_pasajero INTEGER,
    p_lat_pasajero NUMERIC DEFAULT NULL,
    p_lon_pasajero NUMERIC DEFAULT NULL,
    p_lat_recogida NUMERIC DEFAULT NULL,
    p_lon_recogida NUMERIC DEFAULT NULL,
    p_distancia_metros INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_lugares_disponibles INTEGER;
    v_estado_viaje VARCHAR(20);
BEGIN
    SELECT estado, lugares_disponibles
    INTO v_estado_viaje, v_lugares_disponibles
    FROM viajes
    WHERE id = p_id_viaje
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El viaje % no existe.', p_id_viaje;
    END IF;

    IF v_estado_viaje <> 'programado' THEN
        RAISE EXCEPTION 'El viaje % tiene estado "%" y no acepta reservaciones.', p_id_viaje, v_estado_viaje;
    END IF;

    IF v_lugares_disponibles <= 0 THEN
        RAISE EXCEPTION 'No hay asientos disponibles en el viaje %.', p_id_viaje;
    END IF;

    UPDATE viajes
    SET lugares_disponibles = lugares_disponibles - 1
    WHERE id = p_id_viaje;

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
    VALUES (
        p_id_viaje,
        p_id_pasajero,
        p_lat_pasajero,
        p_lon_pasajero,
        p_lat_recogida,
        p_lon_recogida,
        p_distancia_metros,
        COALESCE(p_distancia_metros > 80, FALSE),
        'activa'
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_actualizar_punto_recogida_gps(
    p_id_viaje INTEGER,
    p_id_pasajero INTEGER,
    p_lat_pasajero NUMERIC,
    p_lon_pasajero NUMERIC,
    p_lat_recogida NUMERIC,
    p_lon_recogida NUMERIC,
    p_distancia_metros INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_reservacion INTEGER;
    v_estado_viaje VARCHAR(20);
BEGIN
    IF p_lat_pasajero < -90 OR p_lat_pasajero > 90 OR p_lon_pasajero < -180 OR p_lon_pasajero > 180 THEN
        RAISE EXCEPTION 'Coordenadas GPS del pasajero fuera de rango geográfico.';
    END IF;

    IF p_distancia_metros < 0 THEN
        RAISE EXCEPTION 'La distancia a la ruta no puede ser negativa.';
    END IF;

    SELECT estado INTO v_estado_viaje
    FROM viajes
    WHERE id = p_id_viaje;

    IF NOT FOUND OR v_estado_viaje NOT IN ('programado', 'en_curso') THEN
        RAISE EXCEPTION 'El viaje % no está disponible para actualizar punto de recogida.', p_id_viaje;
    END IF;

    SELECT id INTO v_id_reservacion
    FROM reservaciones
    WHERE id_viaje = p_id_viaje
      AND id_pasajero = p_id_pasajero
      AND estado = 'activa'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pasajero % no tiene reservación activa en el viaje %.', p_id_pasajero, p_id_viaje;
    END IF;

    UPDATE reservaciones
    SET latitud_pasajero = p_lat_pasajero,
        longitud_pasajero = p_lon_pasajero,
        latitud_recogida = p_lat_recogida,
        longitud_recogida = p_lon_recogida,
        distancia_ruta_metros = p_distancia_metros,
        fuera_de_ruta = (p_distancia_metros > 80)
    WHERE id = v_id_reservacion;
END;
$$;

CREATE OR REPLACE FUNCTION fn_aplicar_operacion_marca_tiempo(
    p_recurso VARCHAR,
    p_marca_tiempo BIGINT,
    p_tipo VARCHAR,
    p_nuevo_valor INTEGER DEFAULT NULL
)
RETURNS TABLE (
    recurso_resultado VARCHAR,
    valor_resultante INTEGER,
    r_ts BIGINT,
    w_ts BIGINT,
    decision TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reg RECORD;
BEGIN
    SELECT *
    INTO v_reg
    FROM control_marcas_tiempo
    WHERE recurso = p_recurso
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recurso "%" no registrado en control_marcas_tiempo.', p_recurso;
    END IF;

    IF UPPER(p_tipo) = 'READ' THEN
        IF p_marca_tiempo < v_reg.ultima_marca_escritura THEN
            RAISE EXCEPTION 'Operación READ rechazada (TS=% < W-TS=%): conflicto de ordenamiento por marcas de tiempo.', p_marca_tiempo, v_reg.ultima_marca_escritura;
        END IF;

        UPDATE control_marcas_tiempo
        SET ultima_marca_lectura = GREATEST(ultima_marca_lectura, p_marca_tiempo),
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id = v_reg.id
        RETURNING recurso, valor_actual, ultima_marca_lectura, ultima_marca_escritura
        INTO recurso_resultado, valor_resultante, r_ts, w_ts;

        decision := 'READ aceptada con TS=' || p_marca_tiempo;
        RETURN NEXT;
    ELSIF UPPER(p_tipo) = 'WRITE' THEN
        IF p_marca_tiempo < v_reg.ultima_marca_lectura OR p_marca_tiempo < v_reg.ultima_marca_escritura THEN
            RAISE EXCEPTION 'Operación WRITE rechazada (TS=% < R-TS=% o W-TS=%): debe abortarse y reiniciarse.', p_marca_tiempo, v_reg.ultima_marca_lectura, v_reg.ultima_marca_escritura;
        END IF;

        UPDATE control_marcas_tiempo
        SET valor_actual = COALESCE(p_nuevo_valor, valor_actual),
            ultima_marca_escritura = p_marca_tiempo,
            actualizado_en = CURRENT_TIMESTAMP
        WHERE id = v_reg.id
        RETURNING recurso, valor_actual, ultima_marca_lectura, ultima_marca_escritura
        INTO recurso_resultado, valor_resultante, r_ts, w_ts;

        decision := 'WRITE aceptada con TS=' || p_marca_tiempo;
        RETURN NEXT;
    ELSE
        RAISE EXCEPTION 'Tipo de operación no válido: %. Usa READ o WRITE.', p_tipo;
    END IF;
END;
$$;
