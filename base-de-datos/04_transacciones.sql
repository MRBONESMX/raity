-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 04: Transacciones (COMMIT / ROLLBACK), SAVEPOINT, Bitácoras,
--            Copia Sombra y Respaldo Lógico (Retos 4, 5 y 6 / Casos P05–P08)
-- Ejecutar después de 01_estructura.sql, 02_datos.sql y 03_triggers_procedimientos.sql.
-- ============================================================================

-- ============================================================================
-- RETO 4 (P05): Operación compuesta válida con BEGIN y COMMIT
-- Escenario: El pasajero 12 (Elena) reserva un asiento en el viaje 6 y
-- registra su punto de recogida GPS sobre la ruta (2 cambios relacionados:
-- descuento en viajes + inserción en reservaciones + registro en bitácora).
-- Estados observados: ACTIVA -> CONFIRMADA (COMMIT).
-- Propiedades ACID:
--   Atomicidad: ambos cambios se aplican juntos o ninguno.
--   Consistencia: lugares_disponibles queda en 2/4 y la reservación activa.
--   Aislamiento: otras sesiones no ven cambios hasta el COMMIT.
--   Durabilidad: una vez confirmado, persiste en WAL y disco.
-- ============================================================================

-- Estado ANTES de P05:
SELECT id, origen, destino, lugares_totales, lugares_disponibles, estado
FROM viajes WHERE id = 6;

BEGIN; -- Estado de transacción: ACTIVA
    UPDATE viajes
    SET lugares_disponibles = lugares_disponibles - 1
    WHERE id = 6 AND lugares_disponibles > 0;

    INSERT INTO reservaciones (
        id_viaje, id_pasajero,
        latitud_pasajero, longitud_pasajero,
        latitud_recogida, longitud_recogida,
        distancia_ruta_metros, fuera_de_ruta, estado
    )
    VALUES (
        6, 12,
        24.145200, -110.312500,
        24.145000, -110.312500,
        22, FALSE, 'activa'
    );
COMMIT; -- Estado de transacción: CONFIRMADA

-- Estado DESPUÉS de P05:
SELECT id, origen, destino, lugares_totales, lugares_disponibles, estado
FROM viajes WHERE id = 6;
SELECT id, id_viaje, id_pasajero, latitud_recogida, longitud_recogida, fuera_de_ruta, estado
FROM reservaciones WHERE id_viaje = 6;


-- ============================================================================
-- RETO 4 (P06): Operación compuesta fallida con ROLLBACK
-- Escenario: Se intenta descontar un asiento al viaje 7 (paso 1 válido) y
-- luego insertar una reservación con distancia negativa / pasajero duplicado
-- (paso 2 inválido). La transacción pasa a estado FALLIDA/ABORTADA y se
-- ejecuta ROLLBACK para comprobar que NO permanecen cambios parciales.
-- ============================================================================

-- Estado ANTES de P06:
SELECT id, lugares_disponibles FROM viajes WHERE id = 7;

BEGIN; -- Estado: ACTIVA
    UPDATE viajes
    SET lugares_disponibles = lugares_disponibles - 1
    WHERE id = 7 AND lugares_disponibles > 0;

    -- Paso 2 inválido: pasajero 11 ya tiene reservación activa en viaje 7
    -- (En DBeaver, al ejecutar la siguiente línea se produce error y estado ABORTADA):
    -- INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (7, 11, 'activa');
ROLLBACK; -- Estado: ABORTADA -> revertida por completo

-- Verificar en DBeaver (o bloque controlado) que lugares_disponibles NO cambió:
DO $$
BEGIN
    UPDATE viajes
    SET lugares_disponibles = lugares_disponibles - 1
    WHERE id = 7 AND lugares_disponibles > 0;

    -- Paso 2 con error intencional (viola regla de no duplicar reservación):
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado)
    VALUES (7, 11, 'activa');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PRUEBA P06 REVERTIDA CON ROLLBACK AUTOMÁTICO (%): %', SQLSTATE, SQLERRM;
END $$;

-- Estado DESPUÉS de P06 (debe seguir con lugares_disponibles = 2):
SELECT id, lugares_disponibles FROM viajes WHERE id = 7;


-- ============================================================================
-- RETO 5 (P07): Recuperación parcial con SAVEPOINT (Acciones A, B y C)
-- Escenario:
--   Acción A: Crear un nuevo viaje programado (viaje del conductor 2, ruta 10).
--   SAVEPOINT despues_de_A.
--   Acción B (fallida): Intentar insertar reservación de pasajero hombre (id 9)
--                       o cancelar un reporte con motivo vacío -> falla controlada.
--   ROLLBACK TO SAVEPOINT despues_de_A.
--   Acción B (válida): Insertar reservación válida del pasajero 12 en el viaje nuevo.
--   Acción C: Descontar 1 lugar disponible al viaje recién creado.
--   COMMIT: Se conserva A, B válida y C, sin perder A tras el fallo inicial en B.
-- ============================================================================

BEGIN;
    -- Acción A: Publicar viaje nuevo de prueba
    INSERT INTO viajes (id_conductor, id_vehiculo, id_ruta, origen, destino, fecha, hora_salida, lugares_totales, lugares_disponibles, es_violeta, estado)
    VALUES (2, 2, 10, 'Indeco', 'Biblioteca Central UABCS', CURRENT_DATE, '9:15 PM', 4, 4, FALSE, 'programado');

    SAVEPOINT despues_de_A;

    -- En DBeaver, si ejecutas aquí una sentencia inválida como:
    -- INSERT INTO reportes (id_viaje, id_quien_reporta, motivo) VALUES ((SELECT MAX(id) FROM viajes), 12, 'x');
    -- PostgreSQL deja la transacción abortada hasta ejecutar:
    ROLLBACK TO SAVEPOINT despues_de_A;

    -- Repetimos Acción B de forma válida (reservación con punto de recogida GPS):
    INSERT INTO reservaciones (
        id_viaje, id_pasajero,
        latitud_pasajero, longitud_pasajero,
        latitud_recogida, longitud_recogida,
        distancia_ruta_metros, fuera_de_ruta, estado
    )
    VALUES (
        (SELECT MAX(id) FROM viajes), 12,
        24.118000, -110.305500,
        24.117550, -110.305750,
        56, FALSE, 'activa'
    );

    -- Acción C: Descontar el asiento reservado en el viaje creado en A
    UPDATE viajes
    SET lugares_disponibles = lugares_disponibles - 1
    WHERE id = (SELECT MAX(id) FROM viajes);
COMMIT;

-- Comprobar que se conservaron A (viaje), B válida (reservación) y C (lugares = 3/4):
SELECT id, origen, destino, hora_salida, lugares_disponibles, lugares_totales
FROM viajes
ORDER BY id DESC
LIMIT 1;


-- ============================================================================
-- RETO 6: Bitácoras, Error SQL controlado, Copia Sombra y Respaldo (P08)
-- ============================================================================

-- 6.1 Mostrar al menos 5 eventos reales generados automáticamente en bitácora:
SELECT id, fecha_hora, tabla_afectada, operacion, id_registro, usuario_bd, pid_sesion, detalle_evento
FROM bitacora_auditoria
ORDER BY id DESC
LIMIT 10;

-- 6.2 Simulación segura de un error SQL / de operación (sin dañar servidor ni archivos):
-- Ejemplo: división entre cero o violación de restricción capturada
DO $$
DECLARE
    v_promedio NUMERIC;
BEGIN
    v_promedio := 10 / 0;
EXCEPTION
    WHEN division_by_zero THEN
        RAISE NOTICE 'Error SQL controlado (SQLSTATE=%): %. No afecta la integridad en disco ni el WAL.', SQLSTATE, SQLERRM;
END $$;

-- 6.3 Simulación didáctica de Copia Sombra (Shadow Paging conceptual):
DROP TABLE IF EXISTS copia_sombra_viajes;
CREATE TABLE copia_sombra_viajes AS
SELECT * FROM viajes;

-- Alteramos temporalmente la tabla original dentro de demostración controlada:
UPDATE viajes SET hora_salida = 'HORA_ERRONEA_PRUEBA' WHERE id = 9;
SELECT id, hora_salida FROM viajes WHERE id = 9;

-- Comparamos contra la copia sombra y recuperamos el valor previo:
UPDATE viajes v
SET hora_salida = s.hora_salida
FROM copia_sombra_viajes s
WHERE v.id = s.id AND v.id = 9;

SELECT id, hora_salida FROM viajes WHERE id = 9;
DROP TABLE IF EXISTS copia_sombra_viajes;

-- 6.4 Comandos de respaldo lógico y restauración en otra base de pruebas (P08):
-- Ejecutar en terminal del sistema operativo (fuera de DBeaver o con herramienta pg_dump):
--   pg_dump -U postgres -d raity -F c -f respaldo_raity.dump
--   createdb -U postgres raity_pruebas_restauracion
--   pg_restore -U postgres -d raity_pruebas_restauracion respaldo_raity.dump
--
-- Consulta para comparar conteos clave entre base origen y base restaurada:
SELECT 'usuarios' AS tabla, COUNT(*) AS total FROM usuarios
UNION ALL SELECT 'vehiculos', COUNT(*) FROM vehiculos
UNION ALL SELECT 'rutas_guardadas', COUNT(*) FROM rutas_guardadas
UNION ALL SELECT 'viajes', COUNT(*) FROM viajes
UNION ALL SELECT 'reservaciones', COUNT(*) FROM reservaciones
UNION ALL SELECT 'calificaciones', COUNT(*) FROM calificaciones
UNION ALL SELECT 'bitacora_auditoria', COUNT(*) FROM bitacora_auditoria;
