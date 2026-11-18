-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 06: SESIÓN B (Ejecutar en una segunda conexión independiente en DBeaver)
-- Sincronizar cada paso con 05_sesion_A.sql siguiendo el orden numerado.
-- ============================================================================

-- [PASO B0] Verificar que Sesión B tiene un PID distinto al de Sesión A:
SELECT pg_backend_pid() AS pid_sesion_b;
SET lock_timeout = '8s';

-- ============================================================================
-- RETO 7.1 (P09): Lectura no repetible
-- ============================================================================
-- [B1] (Después de [A1]) Modificar lugares_disponibles del viaje 2 y confirmar:
BEGIN;
UPDATE viajes SET lugares_disponibles = 1 WHERE id = 2;
COMMIT;
-- --> Volver a Sesión A para ejecutar [A2].

-- [B2] (Después de [A3]) Restaurar lugares_disponibles = 2 y confirmar:
BEGIN;
UPDATE viajes SET lugares_disponibles = 2 WHERE id = 2;
COMMIT;
-- --> Volver a Sesión A para ejecutar [A4].

-- ============================================================================
-- RETO 7.2 (P09): Lectura fantasma
-- ============================================================================
-- [B3] (Después de [A5]) Insertar una reservación válida en el viaje 4 y confirmar:
BEGIN;
INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (4, 10, 'activa');
COMMIT;
-- --> Volver a Sesión A para ejecutar [A6].

-- [B4] (Después de [A7]) Insertar otra reservación válida en el viaje 4 y confirmar:
BEGIN;
INSERT INTO reservaciones (id_viaje, id_pasajero, estado) VALUES (4, 6, 'activa');
COMMIT;
-- --> Volver a Sesión A para ejecutar [A8].

-- ============================================================================
-- RETO 7.3 (P09): Actualización perdida y corrección
-- ============================================================================
-- [B5] (Después de [A9]) B lee lugares_disponibles = 2 y descuenta 1:
BEGIN;
SELECT lugares_disponibles FROM viajes WHERE id = 2;
UPDATE viajes SET lugares_disponibles = 1 WHERE id = 2;
COMMIT;
-- --> Volver a Sesión A para [A10] (se evidencia que A sobrescribe el trabajo de B).

-- [B6] (Después de [A11]) B intenta tomar el bloqueo con FOR UPDATE (esperará a A):
BEGIN;
SELECT id, lugares_disponibles FROM viajes WHERE id = 2 FOR UPDATE;
UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1
WHERE id = 2 AND lugares_disponibles > 0;
COMMIT;

-- ============================================================================
-- RETO 7.4: Lectura sucia
-- ============================================================================
-- [B7] Modificar viaje 9 SIN confirmar (dejar transacción abierta):
BEGIN;
UPDATE viajes SET lugares_disponibles = 0 WHERE id = 9;
-- --> AHORA ejecutar [A12] en Sesión A para verificar que A no ve el valor 0.

-- [B8] Revertir el cambio no confirmado de B:
ROLLBACK;

-- ============================================================================
-- RETO 8.1 (P10): Bloqueo de fila
-- ============================================================================
-- [B9] (Después de [A13]) Intentar modificar viaje 2 mientras A lo tiene bloqueado:
--      B quedará en espera hasta que A ejecute COMMIT en [A14].
BEGIN;
UPDATE viajes SET hora_salida = '7:10 AM' WHERE id = 2;
COMMIT;

-- ============================================================================
-- RETO 8.2 y 8.3 (P11): Deadlock controlado y prevención
-- ============================================================================
-- [B10] (Después de [A15]) B bloquea viaje 5 primero:
BEGIN;
SELECT id FROM viajes WHERE id = 5 FOR UPDATE;
-- --> Volver a Sesión A para ejecutar [A16].

-- [B11] (Después de [A16]) B solicita viaje 2 (retenido por A) -> se dispara DEADLOCK:
SELECT id FROM viajes WHERE id = 2 FOR UPDATE;
ROLLBACK;

-- [B12] (Después de [A17]) Prevención del deadlock respetando el orden ascendente (2 -> 5):
BEGIN;
SELECT id FROM viajes WHERE id = 2 FOR UPDATE;
SELECT id FROM viajes WHERE id = 5 FOR UPDATE;
COMMIT;

-- ============================================================================
-- RETO 9.1 (P12): SERIALIZABLE
-- ============================================================================
-- [B13] (Después de [A18]) B lee y actualiza viaje 9 en SERIALIZABLE y confirma:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT id, lugares_disponibles FROM viajes WHERE id = 9;
UPDATE viajes SET lugares_disponibles = lugares_disponibles - 1 WHERE id = 9 AND lugares_disponibles > 0;
COMMIT;
-- --> Volver a Sesión A para ejecutar [A19].

-- ============================================================================
-- RETO 9.3 (P12): Ordenamiento por marcas de tiempo
-- ============================================================================
-- [B14] (Después de [A20]) Transacción con marca TS=120 realiza escritura válida:
SELECT * FROM fn_aplicar_operacion_marca_tiempo('lugares_viaje_2', 120, 'WRITE', 1);
-- --> Volver a Sesión A para ejecutar [A21] (intento rechazado con TS=115).
