INSERT INTO usuarios (id, nombre_completo, correo_institucional, numero_control, contrasena_cifrada, genero, es_administrador, activo) VALUES
(1, 'Santiago D.', 'sade_24@alu.uabcs.mx', '2028120', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(2, 'Rodolfo M.', 'rodolfo_24@alu.uabcs.mx', '2028121', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE),
(3, 'Isbeth M.', 'isbeth_24@alu.uabcs.mx', '2028122', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(4, 'Mariana L.', 'mariana_24@alu.uabcs.mx', '2028123', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Mujer', FALSE, TRUE),
(5, 'Diego T.', 'diego_24@alu.uabcs.mx', '2028124', '$2a$10$tGyB8qQ9WHSSJ31o8ItxGu7OjsH/FgyL/zabzyGken7dKJ2ClvphK', 'Hombre', FALSE, TRUE);

INSERT INTO vehiculos (id, id_usuario, modelo, matricula, color, numero_asientos, foto_vehiculo, foto_credencial) VALUES
(1, 1, 'Nissan March', 'BAM2428', 'Negro', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(2, 2, 'Toyota Corolla', 'TM15GF', 'Negro', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg'),
(3, 3, 'Honda Civic', 'DBB412B', 'Azul', 4, '/subidas/vehiculo-ejemplo.jpg', '/subidas/credencial-ejemplo.jpg');

INSERT INTO rutas_guardadas (id, id_usuario, nombre, latitud_origen, longitud_origen, latitud_destino, longitud_destino) VALUES
(1, 1, 'Santa Fe -> Ingeniería en Pesquerías', 24.119500, -110.335000, 24.102700, -110.316000),
(2, 2, 'Santa Fe -> Ingeniería en Pesquerías', 24.119500, -110.335000, 24.102700, -110.316000),
(3, 3, 'Agua Escondida -> Departamento de Sistemas', 24.095000, -110.328000, 24.103200, -110.315200),
(4, 1, 'Colina del Sol -> Macroplaza / UABCS', 24.152000, -110.305000, 24.102700, -110.316000);

INSERT INTO viajes (id, id_conductor, id_vehiculo, id_ruta, origen, destino, fecha, hora_salida, lugares_totales, lugares_disponibles, es_violeta, estado) VALUES
(1, 2, 2, 2, 'Santa Fe', 'Ingeniería en Pesquerías', CURRENT_DATE, '6:30 AM', 4, 2, FALSE, 'programado'),
(2, 3, 3, 3, 'Agua Escondida', 'Departamento de Sistemas', CURRENT_DATE, '6:30 AM', 4, 1, TRUE, 'programado'),
(3, 1, 1, 1, 'Santa Fe', 'Ingeniería en Pesquerías', CURRENT_DATE, '6:30 AM', 4, 2, FALSE, 'en_curso'),
(4, 2, 2, 2, 'Santa Fe', 'Ingeniería en Pesquerías', CURRENT_DATE - 1, '6:30 AM', 4, 2, FALSE, 'terminado'),
(5, 3, 3, 3, 'Agua Escondida', 'Departamento de Sistemas', CURRENT_DATE - 3, '6:30 AM', 4, 2, TRUE, 'terminado'),
(6, 1, 1, 4, 'Colina del Sol', 'Macroplaza / UABCS', CURRENT_DATE - 5, '7:00 AM', 4, 1, FALSE, 'terminado');

INSERT INTO reservaciones (id, id_viaje, id_pasajero, estado) VALUES
(1, 3, 4, 'activa'),
(2, 3, 5, 'activa'),
(3, 4, 1, 'activa'),
(4, 5, 4, 'activa'),
(5, 6, 5, 'activa');

INSERT INTO calificaciones (id_viaje, id_quien_califica, id_calificado, puntuacion, comentario) VALUES
(6, 5, 1, 5, 'Muy puntual y amable'),
(4, 1, 2, 5, 'Excelente viaje'),
(5, 4, 3, 5, 'Muy seguro el recorrido en Raity Violeta'),
(3, 1, 4, 5, 'Buena pasajera'),
(3, 2, 4, 5, 'Puntual en el punto de salida'),
(3, 3, 4, 5, 'Excelente compañera'),
(5, 3, 4, 5, 'Muy respetuosa'),
(6, 1, 4, 4, 'Todo bien'),
(3, 1, 5, 5, 'Buen compañero'),
(3, 2, 5, 5, 'Todo en orden'),
(3, 3, 5, 5, 'Puntual'),
(4, 2, 5, 5, 'Sin problemas'),
(6, 1, 5, 5, 'Muy bien'),
(4, 1, 5, 5, 'Recomendado'),
(5, 4, 5, 5, 'Amable'),
(6, 4, 5, 5, 'Correcto'),
(6, 2, 5, 5, 'Buen trato'),
(6, 3, 5, 4, 'Llego justo a tiempo');

SELECT setval(pg_get_serial_sequence('usuarios', 'id'), (SELECT COALESCE(MAX(id), 1) FROM usuarios));
SELECT setval(pg_get_serial_sequence('vehiculos', 'id'), (SELECT COALESCE(MAX(id), 1) FROM vehiculos));
SELECT setval(pg_get_serial_sequence('rutas_guardadas', 'id'), (SELECT COALESCE(MAX(id), 1) FROM rutas_guardadas));
SELECT setval(pg_get_serial_sequence('viajes', 'id'), (SELECT COALESCE(MAX(id), 1) FROM viajes));
SELECT setval(pg_get_serial_sequence('reservaciones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM reservaciones));
SELECT setval(pg_get_serial_sequence('calificaciones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM calificaciones));
