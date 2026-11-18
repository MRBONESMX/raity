-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 07: Consultas de Calidad (Reto 1.4) y Pruebas de Restricciones
--            (Reto 2 / Casos P01, P02, P03, P04 y NOT NULL)
-- Ejecutar después de 01_estructura.sql, 02_datos.sql y 03_triggers_procedimientos.sql.
-- ============================================================================

-- ============================================================================
-- RETO 1.4: Tres consultas de calidad de datos adaptadas a Raity
-- ============================================================================

-- Consulta de calidad 1: Detección de posibles duplicados de negocio
-- (correos repetidos, matrículas repetidas o reservaciones activas duplicadas)
SELECT 'reservaciones_duplicadas' AS tipo_revision, id_viaje::TEXT AS clave, id_pasajero::TEXT AS detalle, COUNT(*) AS repeticiones
FROM reservaciones
WHERE estado = 'activa'
GROUP BY id_viaje, id_pasajero
HAVING COUNT(*) > 1
UNION ALL
SELECT 'matriculas_duplicadas', matricula, '' , COUNT(*)
FROM vehiculos
GROUP BY matricula
HAVING COUNT(*) > 1;

-- Consulta de calidad 2: Valores faltantes relevantes (reservaciones activas
-- en viajes vigentes que aún no comparten su ubicación GPS de recogida)
SELECT r.id AS id_reservacion, v.id AS id_viaje, u.nombre_completo AS pasajero,
       v.origen || ' -> ' || v.destino AS ruta, v.estado AS estado_viaje
FROM reservaciones r
JOIN viajes v ON r.id_viaje = v.id
JOIN usuarios u ON r.id_pasajero = u.id
WHERE r.estado = 'activa'
  AND v.estado IN ('programado', 'en_curso')
  AND (r.latitud_recogida IS NULL OR r.longitud_recogida IS NULL);

-- Consulta de calidad 3: Inconsistencias de negocio
-- (desfase entre lugares_disponibles y reservaciones activas, o bandera fuera_de_ruta incoherente)
SELECT v.id AS id_viaje,
       v.lugares_totales,
       v.lugares_disponibles,
       COUNT(r.id) FILTER (WHERE r.estado = 'activa') AS reservas_activas_reales,
       (v.lugares_totales - COUNT(r.id) FILTER (WHERE r.estado = 'activa')) AS lugares_esperados
FROM viajes v
LEFT JOIN reservaciones r ON v.id = r.id_viaje
WHERE v.estado IN ('programado', 'en_curso')
GROUP BY v.id, v.lugares_totales, v.lugares_disponibles
HAVING v.lugares_disponibles <> (v.lugares_totales - COUNT(r.id) FILTER (WHERE r.estado = 'activa'));


-- ============================================================================
-- RETO 2: Cinco casos inválidos rechazados por restricciones (P01–P04 + NOT NULL)
-- ============================================================================

-- P01: Intento de duplicar dato único de negocio (UNIQUE en correo_institucional y matricula)
DO $$
BEGIN
    INSERT INTO usuarios (nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero)
    VALUES ('Intento Duplicado', 'alumno_12@alu.uabcs.mx', '9999999', 'hash_prueba', 'Hombre');
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'P01 RECHAZADO POR UNIQUE (%): %', SQLSTATE, SQLERRM;
END $$;

-- Comprobación posterior P01 (no se almacenó el registro duplicado):
SELECT id, nombre_completo, correo_institucional
FROM usuarios
WHERE numero_control = '9999999';


-- P02: Intento de introducir un valor fuera de las reglas de dominio / CHECK
-- (correo sin dominio @alu.uabcs.mx o calificación 9 fuera de 1..5 o lugares_totales = 7)
DO $$
BEGIN
    INSERT INTO usuarios (nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero)
    VALUES ('Correo Externo', 'externo@gmail.com', '8888881', 'hash_prueba', 'Hombre');
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'P02-A RECHAZADO POR DOMINIO (%): %', SQLSTATE, SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO calificaciones (id_viaje, id_quien_califica, id_calificado, puntuacion, comentario)
    VALUES (10, 12, 2, 9, 'Puntuación fuera de rango');
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'P02-B RECHAZADO POR CHECK/DOMINIO (%): %', SQLSTATE, SQLERRM;
END $$;

-- Comprobación posterior P02:
SELECT * FROM usuarios WHERE numero_control = '8888881';
SELECT * FROM calificaciones WHERE puntuacion > 5 OR puntuacion < 1;


-- P03: Intento de registrar referencia a elemento inexistente (FOREIGN KEY)
DO $$
BEGIN
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado)
    VALUES (99999, 9, 'activa');
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'P03 RECHAZADO POR FOREIGN KEY (%): %', SQLSTATE, SQLERRM;
END $$;

-- Comprobación posterior P03:
SELECT * FROM reservaciones WHERE id_viaje = 99999;


-- P04 (y regla d: operación prohibida): Conductor intenta reservar su propio viaje
-- o pasajero hombre intenta reservar viaje Raity Violeta (rechazado por trigger)
DO $$
BEGIN
    -- Marco López (id=1) es conductor del viaje 9 e intenta reservar en su propio viaje
    INSERT INTO reservaciones (id_viaje, id_pasajero, estado)
    VALUES (9, 1, 'activa');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'P04 RECHAZADO POR REGLA DE NEGOCIO / TRIGGER (%): %', SQLSTATE, SQLERRM;
END $$;

-- Comprobación posterior P04:
SELECT * FROM reservaciones WHERE id_viaje = 9 AND id_pasajero = 1;


-- Caso e (NOT NULL / estado no permitido):
DO $$
BEGIN
    INSERT INTO vehiculos (id_usuario, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial)
    VALUES (1, NULL, 'SINMODELO', 'Blanco', 4, '/subidas/v.jpg', '/subidas/c.jpg');
EXCEPTION
    WHEN not_null_violation THEN
        RAISE NOTICE 'CASO E-1 RECHAZADO POR NOT NULL (%): %', SQLSTATE, SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO viajes (id_conductor, id_vehiculo, id_ruta, origen, destino, hora_salida, lugares_totales, lugares_disponibles, estado)
    VALUES (1, 1, 1, 'Santa Fe', 'UABCS', '10:00 AM', 4, 4, 'estado_inventado');
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'CASO E-2 RECHAZADO POR ESTADO NO PERMITIDO (%): %', SQLSTATE, SQLERRM;
END $$;

-- Comprobación posterior Caso e:
SELECT * FROM vehiculos WHERE matricula = 'SINMODELO';
SELECT * FROM viajes WHERE estado = 'estado_inventado';
