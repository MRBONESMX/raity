const NOMBRE_CACHE = 'raity-cache-v3';

const ARCHIVOS_CACHE = [
    '/',
    '/index.html',
    '/explorar.html',
    '/buscar.html',
    '/publicar.html',
    '/mis-viajes.html',
    '/mi-viaje.html',
    '/perfil.html',
    '/registro-vehiculo.html',
    '/registro-ruta.html',
    '/eliminar-vehiculo-ruta.html',
    '/css/estilos.css',
    '/js/comun.js',
    '/js/registrar-sw.js',
    '/js/acceso.js',
    '/js/explorar.js',
    '/js/buscar.js',
    '/js/publicar.js',
    '/js/mis-viajes.js',
    '/js/mi-viaje.js',
    '/js/perfil.js',
    '/js/registro-vehiculo.js',
    '/js/registro-ruta.js',
    '/js/eliminar-vehiculo-ruta.js',
    '/imagenes/logo_raity.jpg',
    '/imagenes/icono-192.png',
    '/imagenes/icono-512.png'
];

self.addEventListener('install', function (evento) {
    evento.waitUntil(
        caches.open(NOMBRE_CACHE).then(function (cache) {
            return cache.addAll(ARCHIVOS_CACHE);
        })
    );
});

self.addEventListener('activate', function (evento) {
    evento.waitUntil(
        caches.keys().then(function (nombres) {
            const promesas = [];
            for (let i = 0; i < nombres.length; i++) {
                if (nombres[i] !== NOMBRE_CACHE) {
                    promesas.push(caches.delete(nombres[i]));
                }
            }
            return Promise.all(promesas);
        })
    );
});

self.addEventListener('fetch', function (evento) {
    if (evento.request.method !== 'GET') {
        return;
    }

    const url = evento.request.url;
    if (url.indexOf('/api/') !== -1) {
        evento.respondWith(
            fetch(evento.request).catch(function () {
                return new Response(
                    JSON.stringify({ mensaje: 'Sin conexión a internet.' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    evento.respondWith(
        fetch(evento.request)
            .then(function (respuestaRed) {
                return respuestaRed;
            })
            .catch(function () {
                return caches.match(evento.request);
            })
    );
});
