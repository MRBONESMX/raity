-- ============================================================================
-- RAITY (UABCS) - PROYECTO FINAL INTEGRADOR DE BASE DE DATOS II
-- Script 02: Datos Válidos de Prueba (> 85 registros en tablas del negocio)
-- Ejecutar después de 01_estructura.sql.
-- ============================================================================

TRUNCATE TABLE
    bitacora_auditoria,
    control_marcas_tiempo,
    sesiones,
    reportes,
    calificaciones,
    reservaciones,
    viajes,
    rutas_guardadas,
    vehiculos,
    usuarios
RESTART IDENTITY CASCADE;

-- 12 estudiantes de la UABCS en La Paz (contraseña de prueba: 123456)
INSERT INTO usuarios (id, nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero, es_administrador, activo) VALUES
(1, 'Marco López', 'alumno_12@alu.uabcs.mx', '1900123', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(2, 'Paco Ramírez', 'paco_15@alu.uabcs.mx', '1900124', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(3, 'Valeria Cota', 'valeria_18@alu.uabcs.mx', '1900125', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(4, 'Sofía Avilés', 'sofia_20@alu.uabcs.mx', '1900126', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(5, 'Mateo Rochín', 'mateo_21@alu.uabcs.mx', '1900127', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(6, 'Lucía Trasviña', 'lucia_22@alu.uabcs.mx', '1900128', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(7, 'Fernando Verdugo', 'fernando_23@alu.uabcs.mx', '1900129', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(8, 'Camila Geraldo', 'camila_25@alu.uabcs.mx', '1900130', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(9, 'Alejandro Ceseña', 'alejandro_14@alu.uabcs.mx', '1900131', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(10, 'Daniela Armenta', 'daniela_16@alu.uabcs.mx', '1900132', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(11, 'Jorge Meza', 'jorge_17@alu.uabcs.mx', '1900133', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(12, 'Elena Murillo', 'elena_19@alu.uabcs.mx', '1900134', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE);

-- 8 vehículos registrados
INSERT INTO vehiculos (id, id_usuario, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial) VALUES
(1, 1, 'Nissan March', 'ABC1234', 'Negro', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(2, 2, 'Toyota Corolla', 'BCS4521', 'Blanco', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(3, 3, 'Honda Civic', 'LPZ8832', 'Azul', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(4, 4, 'Kia Rio', 'SUD3019', 'Gris', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(5, 5, 'Chevrolet Aveo', 'MAR7740', 'Rojo', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(6, 6, 'Mazda 3', 'DES9104', 'Plata', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(7, 7, 'Volkswagen Jetta', 'PAL6320', 'Azul Marino', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(8, 8, 'Suzuki Swift', 'COR5518', 'Blanco', 3, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg');

-- 10 rutas hacia distintos edificios de la UABCS en La Paz
INSERT INTO rutas_guardadas (id, id_usuario, nombre, latitud_origen, longitud_origen, latitud_destino, longitud_destino) VALUES
(1, 1, 'Santa Fe -> Ingeniería en Pesquerías UABCS', 24.119500, -110.335000, 24.101800, -110.317200),
(2, 2, 'Colina del Sol -> Biblioteca Central UABCS', 24.152000, -110.305000, 24.104100, -110.315500),
(3, 3, 'Fidepaz -> Sistemas Computacionales UABCS', 24.132500, -110.341000, 24.103400, -110.314800),
(4, 4, 'Agua Escondida -> Humanidades y Lenguas UABCS', 24.095000, -110.328000, 24.103800, -110.316800),
(5, 5, 'Las Garzas -> Ciencias Sociales UABCS', 24.138000, -110.326000, 24.102300, -110.314200),
(6, 6, 'Zona Centro Catedral -> Rectoría UABCS', 24.161000, -110.312500, 24.102700, -110.316000),
(7, 7, 'Camino Real -> Ciencias Agropecuarias UABCS', 24.072500, -110.311000, 24.100500, -110.316500),
(8, 8, 'Los Olivos -> Polideportivo UABCS', 24.149000, -110.308000, 24.101200, -110.313800),
(9, 1, 'Bellavista -> Sistemas Computacionales UABCS', 24.122000, -110.315500, 24.103400, -110.314800),
(10, 2, 'Indeco -> Biblioteca Central UABCS', 24.131000, -110.296000, 24.104100, -110.315500);

-- 14 viajes publicados (en curso, programados, terminados y cancelado)
INSERT INTO viajes (id, id_conductor, id_vehiculo, id_ruta, origen, destino, fecha, hora_salida, lugares_totales, lugares_disponibles, es_violeta, estado) VALUES
(1, 1, 1, 1, 'Santa Fe', 'Ingeniería en Pesquerías UABCS', CURRENT_DATE, '6:30 AM', 4, 2, FALSE, 'en_curso'),
(2, 2, 2, 2, 'Colina del Sol', 'Biblioteca Central UABCS', CURRENT_DATE, '7:00 AM', 4, 2, FALSE, 'programado'),
(3, 3, 3, 3, 'Fidepaz', 'Sistemas Computacionales UABCS', CURRENT_DATE, '8:30 AM', 4, 2, TRUE, 'programado'),
(4, 4, 4, 4, 'Agua Escondida', 'Humanidades y Lenguas UABCS', CURRENT_DATE, '10:30 AM', 4, 3, TRUE, 'programado'),
(5, 5, 5, 5, 'Las Garzas', 'Ciencias Sociales UABCS', CURRENT_DATE, '12:00 PM', 4, 2, FALSE, 'programado'),
(6, 6, 6, 6, 'Zona Centro Catedral', 'Rectoría UABCS', CURRENT_DATE, '1:30 PM', 4, 3, FALSE, 'programado'),
(7, 7, 7, 7, 'Camino Real', 'Ciencias Agropecuarias UABCS', CURRENT_DATE, '3:00 PM', 4, 2, FALSE, 'programado'),
(8, 8, 8, 8, 'Los Olivos', 'Polideportivo UABCS', CURRENT_DATE, '4:30 PM', 3, 2, TRUE, 'programado'),
(9, 1, 1, 9, 'Bellavista', 'Sistemas Computacionales UABCS', CURRENT_DATE, '6:00 PM', 4, 3, FALSE, 'programado'),
(10, 2, 2, 10, 'Indeco', 'Biblioteca Central UABCS', CURRENT_DATE - 1, '7:00 AM', 4, 2, FALSE, 'terminado'),
(11, 3, 3, 3, 'Fidepaz', 'Sistemas Computacionales UABCS', CURRENT_DATE - 2, '7:30 AM', 4, 2, TRUE, 'terminado'),
(12, 5, 5, 5, 'Las Garzas', 'Ciencias Sociales UABCS', CURRENT_DATE - 4, '8:30 AM', 4, 1, FALSE, 'terminado'),
(13, 1, 1, 9, 'Bellavista', 'Sistemas Computacionales UABCS', CURRENT_DATE - 6, '1:00 PM', 4, 2, FALSE, 'terminado'),
(14, 7, 7, 7, 'Camino Real', 'Ciencias Agropecuarias UABCS', CURRENT_DATE - 3, '3:00 PM', 4, 4, FALSE, 'cancelado');

-- 24 reservaciones (con puntos de recogida GPS sobre la ruta y fuera de ruta)
INSERT INTO reservaciones (id, id_viaje, id_pasajero, latitud_pasajero, longitud_pasajero, latitud_recogida, longitud_recogida, distancia_ruta_metros, fuera_de_ruta, estado) VALUES
(1, 1, 9, 24.119500, -110.324500, 24.119500, -110.324500, 18, FALSE, 'activa'),
(2, 1, 10, 24.122500, -110.320000, 24.119500, -110.320000, 334, TRUE, 'activa'),
(3, 2, 11, 24.128200, -110.305000, 24.128050, -110.305000, 17, FALSE, 'activa'),
(4, 2, 12, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(5, 3, 10, 24.132500, -110.326500, 24.132500, -110.326500, 22, FALSE, 'activa'),
(6, 3, 12, 24.135000, -110.321000, 24.132500, -110.321000, 278, TRUE, 'activa'),
(7, 4, 12, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(8, 5, 9, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(9, 5, 11, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(10, 6, 9, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(11, 7, 11, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(12, 7, 10, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(13, 8, 10, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(14, 9, 11, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(15, 10, 1, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(16, 10, 9, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(17, 11, 10, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(18, 11, 12, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(19, 12, 1, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(20, 12, 9, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(21, 12, 11, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(22, 13, 10, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(23, 13, 11, NULL, NULL, NULL, NULL, NULL, FALSE, 'activa'),
(24, 14, 9, NULL, NULL, NULL, NULL, NULL, FALSE, 'cancelada');

-- 16 calificaciones
INSERT INTO calificaciones (id_viaje, id_quien_califica, id_calificado, puntuacion, comentario) VALUES
(13, 10, 1, 5, 'Muy puntual saliendo de Bellavista'),
(13, 11, 1, 4, 'Buen viaje hacia Sistemas'),
(10, 2, 1, 5, 'Buen pasajero, aviso cuando iba llegando'),
(10, 9, 2, 5, 'Excelente ruta por Indeco hasta Biblioteca'),
(11, 10, 3, 5, 'Muy seguro el recorrido en Raity Violeta'),
(11, 12, 3, 5, 'Puntual y amable desde Fidepaz'),
(12, 1, 5, 4, 'Buen viaje, solo algo de trafico en Forjadores'),
(12, 9, 5, 5, 'Llegamos justo a tiempo a Sociales'),
(12, 11, 5, 5, 'Muy atento y responsable al volante'),
(1, 1, 9, 5, 'Pasajero puntual en Santa Fe'),
(12, 5, 9, 4, 'Buen trato durante el trayecto'),
(1, 1, 10, 5, 'Excelente compañera de viaje'),
(11, 3, 10, 5, 'Muy respetuosa en Raity Violeta'),
(12, 5, 11, 5, 'Llego antes de la hora acordada'),
(13, 1, 11, 4, 'Todo en orden en el recorrido'),
(11, 3, 12, 5, 'Muy amable durante todo el camino');

-- 3 reportes de ejemplo
INSERT INTO reportes (id_viaje, id_quien_reporta, motivo) VALUES
(12, 9, 'Retraso de 10 minutos por obra vial en Blvd. Forjadores'),
(14, 9, 'El conductor cancelo con anticipacion por revision mecanica'),
(10, 1, 'Punto de encuentro movido una cuadra por trafico en Indeco');

-- Recursos iniciales para la demostración de Timestamp Ordering
INSERT INTO control_marcas_tiempo (id, recurso, valor_actual, ultima_marca_lectura, ultima_marca_escritura) VALUES
(1, 'lugares_viaje_2', 2, 100, 100),
(2, 'contador_reservas_uabcs', 23, 100, 100);

SELECT setval(pg_get_serial_sequence('usuarios', 'id'), (SELECT COALESCE(MAX(id), 1) FROM usuarios));
SELECT setval(pg_get_serial_sequence('vehiculos', 'id'), (SELECT COALESCE(MAX(id), 1) FROM vehiculos));
SELECT setval(pg_get_serial_sequence('rutas_guardadas', 'id'), (SELECT COALESCE(MAX(id), 1) FROM rutas_guardadas));
SELECT setval(pg_get_serial_sequence('viajes', 'id'), (SELECT COALESCE(MAX(id), 1) FROM viajes));
SELECT setval(pg_get_serial_sequence('reservaciones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM reservaciones));
SELECT setval(pg_get_serial_sequence('calificaciones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM calificaciones));
SELECT setval(pg_get_serial_sequence('reportes', 'id'), (SELECT COALESCE(MAX(id), 1) FROM reportes));
SELECT setval(pg_get_serial_sequence('control_marcas_tiempo', 'id'), (SELECT COALESCE(MAX(id), 1) FROM control_marcas_tiempo));
SELECT setval(pg_get_serial_sequence('bitacora_auditoria', 'id'), (SELECT COALESCE(MAX(id), 1) FROM bitacora_auditoria));
