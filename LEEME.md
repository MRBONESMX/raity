# Raity - Guía de instalación y ejecución

Raity es una aplicación web progresiva (PWA) para coordinar viajes compartidos entre estudiantes de la Universidad Autónoma de Baja California Sur (UABCS) en La Paz, B.C.S.

## Requisitos previos

1. **Node.js** (versión 18 o superior).
2. **PostgreSQL** (versión 14 o superior) con `psql` o pgAdmin.

## Pasos para instalar y ejecutar

### 1. Crear la base de datos y las tablas

Abre una terminal o `psql` con el usuario `postgres` y crea la base de datos:

```sql
CREATE DATABASE raity;
```

Después ejecuta los scripts incluidos en la carpeta `base-de-datos/` (en este orden):

```bash
psql -U postgres -d raity -f base-de-datos/crear-tablas.sql
psql -U postgres -d raity -f base-de-datos/datos-de-prueba.sql
```

### Scripts del Proyecto Final Integrador de Base de Datos II (orden de ejecución)

Si deseas ejecutar o demostrar los entregables completos de **Base de Datos II** en **PostgreSQL + DBeaver** desde una base de datos de pruebas vacía:

1. `base-de-datos/01_estructura.sql`: Crea dominios (`dominio_correo_uabcs`, `dominio_calificacion`), tablas de negocio, `bitacora_auditoria`, `control_marcas_tiempo`, restricciones e índices.
2. `base-de-datos/02_datos.sql`: Inserta los datos válidos de prueba (89 registros incluyendo puntos de recogida GPS).
3. `base-de-datos/03_triggers_procedimientos.sql`: Instala los triggers de regla de negocio y auditoría, los procedimientos almacenados y ejecuta casos válidos y rechazados (P04).
4. `base-de-datos/04_transacciones.sql`: Ejecuta pruebas de `COMMIT` (P05), `ROLLBACK` (P06), `SAVEPOINT` (P07), consulta de bitácora, copia sombra y comandos de respaldo lógico con `pg_dump` / `pg_restore` (P08).
5. `base-de-datos/05_sesion_A.sql` y `base-de-datos/06_sesion_B.sql`: Guiones sincronizados para abrir **dos conexiones independientes** en DBeaver (verificando PIDs distintos con `SELECT pg_backend_pid();`) y ejecutar paso a paso en el orden `[A0, B0, A1, B1, A2, A3, B2...]` las pruebas de lecturas concurrentes, actualización perdida (P09), bloqueo `SELECT ... FOR UPDATE` (P10), deadlock provocado y prevenido (P11), `SERIALIZABLE` y marcas de tiempo (P12).
6. `base-de-datos/07_validaciones.sql`: Ejecuta las 3 consultas de calidad de datos y los 5 rechazos por `UNIQUE` (P01), `CHECK`/dominio (P02), `FOREIGN KEY` (P03), regla de negocio/trigger (P04) y `NOT NULL`/estado inválido.

### 2. Configurar variables de entorno

En la carpeta `servidor/`, revisa el archivo `.env` (o copia `.env.ejemplo` a `.env`) y ajusta tu contraseña y datos de PostgreSQL:

```env
PUERTO=3000
BD_HOST=localhost
BD_PUERTO=5432
BD_USUARIO=postgres
BD_CONTRASENA=tu_contrasena
BD_NOMBRE=raity
SECRETO_SESION=secreto_escolar_raity_uabcs
```

### 3. Instalar dependencias del servidor

Desde la carpeta `servidor/`, instala los paquetes de Node.js:

```bash
cd servidor
npm install
```

### 4. Arrancar el servidor

```bash
npm start
```

Abre tu navegador en `http://localhost:3000`.

## Usuarios de prueba

Todos los usuarios incluidos en `base-de-datos/datos-de-prueba.sql` tienen la misma contraseña para facilitar las pruebas: `123456`.

| Nombre | Correo institucional | Número de control | Género | Rol de ejemplo | Contraseña |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Marco López | `alumno_12@alu.uabcs.mx` | `1900123` | Hombre | Conductor (Nissan March) con viaje en curso, viaje programado e historial | `123456` |
| Paco Ramírez | `paco_15@alu.uabcs.mx` | `1900124` | Hombre | Conductor (Toyota Corolla) | `123456` |
| Valeria Cota | `valeria_18@alu.uabcs.mx` | `1900125` | Mujer | Conductora (Honda Civic) con Raity Violeta | `123456` |
| Sofía Avilés | `sofia_20@alu.uabcs.mx` | `1900126` | Mujer | Conductora (Kia Rio) con Raity Violeta | `123456` |
| Mateo Rochín | `mateo_21@alu.uabcs.mx` | `1900127` | Hombre | Conductor (Chevrolet Aveo) | `123456` |
| Lucía Trasviña | `lucia_22@alu.uabcs.mx` | `1900128` | Mujer | Conductora (Mazda 3) | `123456` |
| Fernando Verdugo | `fernando_23@alu.uabcs.mx` | `1900129` | Hombre | Conductor (Volkswagen Jetta) | `123456` |
| Camila Geraldo | `camila_25@alu.uabcs.mx` | `1900130` | Mujer | Conductora (Suzuki Swift) con Raity Violeta | `123456` |
| Alejandro Ceseña | `alejandro_14@alu.uabcs.mx` | `1900131` | Hombre | Pasajero | `123456` |
| Daniela Armenta | `daniela_16@alu.uabcs.mx` | `1900132` | Mujer | Pasajera (acceso a Raity Violeta) | `123456` |
| Jorge Meza | `jorge_17@alu.uabcs.mx` | `1900133` | Hombre | Pasajero | `123456` |
| Elena Murillo | `elena_19@alu.uabcs.mx` | `1900134` | Mujer | Pasajera (acceso a Raity Violeta) | `123456` |
