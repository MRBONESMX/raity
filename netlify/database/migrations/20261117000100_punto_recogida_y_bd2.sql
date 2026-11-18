DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dominio_correo_uabcs') THEN
        CREATE DOMAIN dominio_correo_uabcs AS VARCHAR(120)
            CHECK (VALUE LIKE '%@alu.uabcs.mx');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dominio_calificacion') THEN
        CREATE DOMAIN dominio_calificacion AS INTEGER
            CHECK (VALUE >= 1 AND VALUE <= 5);
    END IF;
END $$;

ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS latitud_pasajero NUMERIC(9, 6);
ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS longitud_pasajero NUMERIC(9, 6);
ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS latitud_recogida NUMERIC(9, 6);
ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS longitud_recogida NUMERIC(9, 6);
ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS distancia_ruta_metros INTEGER;
ALTER TABLE reservaciones ADD COLUMN IF NOT EXISTS fuera_de_ruta BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id SERIAL PRIMARY KEY,
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tabla_afectada VARCHAR(60) NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    id_registro INTEGER,
    usuario_bd VARCHAR(80) NOT NULL DEFAULT CURRENT_USER,
    pid_sesion INTEGER NOT NULL DEFAULT pg_backend_pid(),
    detalle_evento TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_marcas_tiempo (
    id SERIAL PRIMARY KEY,
    recurso VARCHAR(80) NOT NULL UNIQUE,
    valor_actual INTEGER NOT NULL DEFAULT 0,
    ultima_marca_lectura BIGINT NOT NULL DEFAULT 0,
    ultima_marca_escritura BIGINT NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservaciones_viaje_estado ON reservaciones (id_viaje, estado);
CREATE INDEX IF NOT EXISTS idx_viajes_estado_lugares ON viajes (estado, lugares_disponibles);
CREATE INDEX IF NOT EXISTS idx_bitacora_tabla_fecha ON bitacora_auditoria (tabla_afectada, fecha_hora DESC);

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

DROP TRIGGER IF EXISTS trg_validar_reservacion_raity ON reservaciones;
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

DROP TRIGGER IF EXISTS trg_auditoria_viajes ON viajes;
CREATE TRIGGER trg_auditoria_viajes
    AFTER INSERT OR UPDATE OR DELETE ON viajes
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_auditoria_raity();

DROP TRIGGER IF EXISTS trg_auditoria_reservaciones ON reservaciones;
CREATE TRIGGER trg_auditoria_reservaciones
    AFTER INSERT OR UPDATE OR DELETE ON reservaciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_auditoria_raity();

DROP TRIGGER IF EXISTS trg_auditoria_calificaciones ON calificaciones;
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

UPDATE reservaciones
SET latitud_pasajero = 24.119500,
    longitud_pasajero = -110.324500,
    latitud_recogida = 24.119500,
    longitud_recogida = -110.324500,
    distancia_ruta_metros = 18,
    fuera_de_ruta = FALSE
WHERE id = 1 AND latitud_recogida IS NULL;

UPDATE reservaciones
SET latitud_pasajero = 24.122500,
    longitud_pasajero = -110.320000,
    latitud_recogida = 24.119500,
    longitud_recogida = -110.320000,
    distancia_ruta_metros = 334,
    fuera_de_ruta = TRUE
WHERE id = 2 AND latitud_recogida IS NULL;

UPDATE reservaciones
SET latitud_pasajero = 24.128200,
    longitud_pasajero = -110.305000,
    latitud_recogida = 24.128050,
    longitud_recogida = -110.305000,
    distancia_ruta_metros = 17,
    fuera_de_ruta = FALSE
WHERE id = 3 AND latitud_recogida IS NULL;

UPDATE reservaciones
SET latitud_pasajero = 24.132500,
    longitud_pasajero = -110.326500,
    latitud_recogida = 24.132500,
    longitud_recogida = -110.326500,
    distancia_ruta_metros = 22,
    fuera_de_ruta = FALSE
WHERE id = 5 AND latitud_recogida IS NULL;

UPDATE reservaciones
SET latitud_pasajero = 24.135000,
    longitud_pasajero = -110.321000,
    latitud_recogida = 24.132500,
    longitud_recogida = -110.321000,
    distancia_ruta_metros = 278,
    fuera_de_ruta = TRUE
WHERE id = 6 AND latitud_recogida IS NULL;

INSERT INTO control_marcas_tiempo (recurso, valor_actual, ultima_marca_lectura, ultima_marca_escritura)
VALUES
    ('lugares_viaje_2', 2, 100, 100),
    ('contador_reservas_uabcs', 23, 100, 100)
ON CONFLICT (recurso) DO NOTHING;
