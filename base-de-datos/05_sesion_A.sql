-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 05: SESIÓN A (Ejecutar en una primera conexión independiente en DBeaver)
-- Sincronizar cada paso con 06_sesion_B.sql siguiendo el orden numerado [A1, B1...].
-- ============================================================================

-- [PASO A0] Verificar que Sesión A tiene un PID distinto al de Sesión B:
SELECT pg_backend_pid() AS pid_sesion_a;
SET lock_timeout = '8s';

-- ============================================================================
-- RETO 7.1 (P09): Lectura no repetible (READ COMMITTED vs REPEATABLE READ)
-- ============================================================================
-- [A1] En READ COMMITTED: iniciar transacción y consultar lugares_disponibles del viaje 2
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT id, lugares_disponibles FROM viajes WHERE id = 2;
-- --> AHORA ejecutar [B1] en Sesión B (modifica y hace COMMIT).
-- [A2] Volver a leer el mismo registro dentro de la misma transacción:
--      En READ COMMITTED se verá el nuevo valor (lectura no repetible).
SELECT id, lugares_disponibles FROM viajes WHERE id = 2;
COMMIT;

-- [A3] Repetir bajo REPEATABLE READ:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT id, lugares_disponibles FROM viajes WHERE id = 2;
-- --> AHORA ejecutar [B2] en Sesión B (modifica y hace COMMIT).
-- [A4] Volver a leer: en REPEATABLE READ se mantiene la instantánea inicial (mismo valor).
SELECT id, lugares_disponibles FROM viajes WHERE id = 2;
COMMIT;

-- ============================================================================
-- RETO 7.2 (P09): Lectura fantasma (READ COMMITTED vs REPEATABLE READ)
-- ============================================================================
-- [A5] En READ COMMITTED, contar reservaciones activas del viaje 4:
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT COUNT(*) AS reservas_viaje_4 FROM reservaciones WHERE id_viaje = 4 AND estado = 'activa';
-- --> AHORA ejecutar [B3] en Sesión B (inserta pasajero 10 en viaje 4 y hace COMMIT).
-- [A6] Contar nuevamente: en READ COMMITTED aparece la nueva fila (fantasma).
SELECT COUNT(*) AS reservas_viaje_4 FROM reservaciones WHERE id_viaje = 4 AND estado = 'activa';
COMMIT;

-- [A7] Repetir en REPEATABLE READ:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) AS reservas_viaje_4 FROM reservaciones WHERE id_viaje = 4 AND estado = 'activa';
-- --> AHORA ejecutar [B4] en Sesión B (inserta pasajero 6 en viaje 4 y hace COMMIT).
-- [A8] Contar nuevamente: PostgreSQL REPEATABLE READ evita lecturas fantasma (mismo conteo).
SELECT COUNT(*) AS reservas_viaje_4 FROM reservaciones WHERE id_viaje = 4 AND estado = 'activa';
COMMIT;

-- ============================================================================
-- RETO 7.3 (P09): Actualización perdida y su corrección con bloqueo / atómico
-- ============================================================================
-- [A9] Demostración del problema:
--      A lee lugares_disponibles = 2 del viaje 2; B también lee 2 ([B5]).
BEGIN;
SELECT lugares_disponibles FROM viajes WHERE id = 2;
-- --> Esperar a que B ejecute [B5] (lee 2 y escribe lugares_disponibles = 1 con COMMIT).
-- [A10] A calcula 2 - 1 = 1 y sobrescribe sin verificar el cambio de B (se pierde 1 descuento):
UPDATE viajes SET lugares_disponibles = 1 WHERE id = 2;
COMMIT;

-- [A11] Corrección segura usando SELECT ... FOR UPDATE (bloqueo pesimista):
BEGIN;
SELECT id, lugares_disponibles FROM viajes WHERE id = 2 FOR UPDATE;
-- --> AHORA ejecutar [B6] en Sesión B: B esperará a que A confirme.
UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1
WHERE id = 2 AND lugares_disponibles > 0;
COMMIT;

-- ============================================================================
-- RETO 7.4: Lectura sucia (READ UNCOMMITTED en PostgreSQL)
-- ============================================================================
-- --> Primero ejecutar [B7] en Sesión B (actualiza viaje 9 sin hacer COMMIT).
-- [A12] A intenta leer bajo READ UNCOMMITTED:
BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT id, lugares_disponibles FROM viajes WHERE id = 9;
-- Resultado esperado: PostgreSQL NO muestra el cambio sin confirmar de B.
COMMIT;
-- --> Luego ejecutar [B8] (ROLLBACK en B).

-- ============================================================================
-- RETO 8.1 (P10): Bloqueo de fila mediante SELECT ... FOR UPDATE
-- ============================================================================
-- [A13] A bloquea la fila del viaje 2:
BEGIN;
SELECT id, origen, destino, lugares_disponibles
FROM viajes
WHERE id = 2
FOR UPDATE;
-- --> AHORA ejecutar [B9] en Sesión B: B quedará en espera sobre la fila del viaje 2.
-- [A14] Después de observar la espera en B, liberar el bloqueo en A:
UPDATE viajes SET hora_salida = '7:05 AM' WHERE id = 2;
COMMIT;

-- ============================================================================
-- RETO 8.2 y 8.3 (P11): Deadlock controlado y prevención por orden consistente
-- ============================================================================
-- [A15] Deadlock controlado: A bloquea viaje 2 primero:
BEGIN;
SELECT id FROM viajes WHERE id = 2 FOR UPDATE;
-- --> AHORA ejecutar [B10] en Sesión B (B bloquea viaje 5).
-- [A16] A solicita ahora el viaje 5 (retenido por B):
-- --> Luego B ejecuta [B11] (solicita viaje 2): PostgreSQL detecta DEADLOCK (40P01) y aborta una sesión.
SELECT id FROM viajes WHERE id = 5 FOR UPDATE;
ROLLBACK; -- Deshacer si A fue la transacción abortada o para limpiar la prueba.

-- [A17] Prevención del deadlock (orden ascendente consistente: primero id=2, luego id=5):
BEGIN;
SELECT id FROM viajes WHERE id = 2 FOR UPDATE;
SELECT id FROM viajes WHERE id = 5 FOR UPDATE;
-- --> AHORA ejecutar [B12] en Sesión B (pide id=2 y luego id=5): B espera en orden sin deadlock.
COMMIT;

-- ============================================================================
-- RETO 9.1 y 9.2 (P12): Operación concurrente bajo SERIALIZABLE
-- ============================================================================
-- [A18] A consulta e intenta actualizar en nivel SERIALIZABLE:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT id, lugares_disponibles FROM viajes WHERE id = 9;
-- --> AHORA ejecutar [B13] en Sesión B (también en SERIALIZABLE, lee y actualiza viaje 9 y hace COMMIT).
-- [A19] A intenta actualizar viaje 9: PostgreSQL puede lanzar ERROR 40001
--       "could not serialize access due to concurrent update" -> acción correctiva: reintentar.
UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1 WHERE id = 9 AND lugares_disponibles > 0;
COMMIT;

-- ============================================================================
-- RETO 9.3 (P12): Simulación de Timestamp Ordering (control_marcas_tiempo)
-- ============================================================================
-- [A20] Transacción con marca TS=110 realiza lectura válida sobre 'lugares_viaje_2':
SELECT * FROM fn_aplicar_operacion_marca_tiempo('lugares_viaje_2', 110, 'READ');
-- --> AHORA ejecutar [B14] en Sesión B (TS=120 realiza WRITE válido con nuevo valor = 1).
-- [A21] Transacción atrasada con marca TS=115 (< W-TS=120) intenta escribir y DEBE SER RECHAZADA:
DO $$
BEGIN
    PERFORM * FROM fn_aplicar_operacion_marca_tiempo('lugares_viaje_2', 115, 'WRITE', 0);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'P12 TIMESTAMP ORDERING RECHAZADO (%): %', SQLSTATE, SQLERRM;
END $$;

-- Verificar estado final de marcas de tiempo:
SELECT * FROM control_marcas_tiempo WHERE recurso = 'lugares_viaje_2';
