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
| Santiago D. | `sade_24@alu.uabcs.mx` | `2028120` | Hombre | Conductor (Nissan March) con viaje en curso | `123456` |
| Rodolfo M. | `rodolfo_24@alu.uabcs.mx` | `2028121` | Hombre | Conductor (Toyota Corolla) con viaje disponible | `123456` |
| Isbeth M. | `isbeth_24@alu.uabcs.mx` | `2028122` | Mujer | Conductora (Honda Civic) con Raity Violeta | `123456` |
| Mariana L. | `mariana_24@alu.uabcs.mx` | `2028123` | Mujer | Pasajera (puede ver y reservar Raity Violeta) | `123456` |
| Diego T. | `diego_24@alu.uabcs.mx` | `2028124` | Hombre | Pasajero | `123456` |
