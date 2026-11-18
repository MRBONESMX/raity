-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 03: Triggers (Regla de Negocio + Auditoría), Procedimientos Almacenados
--            y Pruebas de Casos Exitosos y Rechazados (Reto 3 y Caso P04)
-- Ejecutar después de 01_estructura.sql y 02_datos.sql.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_auditoria_calificaciones ON calificaciones;
DROP TRIGGER IF EXISTS trg_auditoria_reservaciones ON reservaciones;
DROP TRIGGER IF EXISTS trg_auditoria_viajes ON viajes;
DROP TRIGGER IF EXISTS trg_validar_reservacion_raity ON reservaciones;

-- ----------------------------------------------------------------------------
-- 1. Trigger de regla de negocio (protege capacidad, Raity Violeta, duplicidad
--    y consistencia de fuera_de_ruta incluso bajo concurrencia)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. Trigger de auditoría automática hacia bitacora_auditoria
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Procedimientos almacenados y función de marcas de tiempo
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- 4. PRUEBAS DEL RETO 3 (Caso exitoso y casos rechazados - P04)
-- ============================================================================

-- 4A. CASO EXITOSO: Reservar asiento en viaje 5 (pasajero 10 = Daniela, Mujer)
--     y actualizar su punto de recogida GPS fuera de ruta (145 m > 80 m)
CALL sp_reservar_asiento_con_recogida(
    5, 10,
    24.132500, -110.320000,
    24.132500, -110.320000,
    15
);

CALL sp_actualizar_punto_recogida_gps(
    5, 10,
    24.133800, -110.320000,
    24.132500, -110.320000,
    145
);

-- Verificar resultado en reservaciones, viajes y bitacora_auditoria:
SELECT id, id_viaje, id_pasajero, latitud_recogida, longitud_recogida, distancia_ruta_metros, fuera_de_ruta
FROM reservaciones
WHERE id_viaje = 5 AND id_pasajero = 10;

-- 4B. CASO RECHAZADO POR TRIGGER (P04): Hombre (id=9) intenta reservar Raity Violeta (viaje 3)
DO $$
BEGIN
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado)
    VALUES (3, 9, 'activa');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA P04-A RECHAZADA POR TRIGGER (%): %', SQLSTATE, SQLERRM;
END $$;

-- 4C. CASO RECHAZADO POR PROCEDIMIENTO (P04): Pasajero intenta reservar en viaje terminado (viaje 10)
DO $$
BEGIN
    CALL sp_reservar_asiento_con_recogida(10, 12);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA P04-B RECHAZADA POR PROCEDIMIENTO (%): %', SQLSTATE, SQLERRM;
END $$;

-- 4D. CASO RECHAZADO POR TRIGGER DE CAPACIDAD (P04): Intentar insertar más pasajeros que lugares_totales
DO $$
BEGIN
    -- El viaje 8 tiene lugares_totales = 3; insertamos 2 más para llenar y luego un 4to inválido
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (8, 4, 'activa');
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (8, 6, 'activa');
    -- Este 4to pasajero excede lugares_totales = 3 y debe ser rechazado por trg_validar_reservacion_raity:
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (8, 12, 'activa');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA P04-C RECHAZADA POR TRIGGER DE CAPACIDAD (%): %', SQLSTATE, SQLERRM;
END $$;

-- Consultar últimos eventos generados automáticamente en bitácora:
SELECT id, fecha_hora, tabla_afectada, operacion, id_registro, detalle_evento
FROM bitacora_auditoria
ORDER BY id DESC
LIMIT 10;
