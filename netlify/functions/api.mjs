import http from 'node:http';
import servidorModulo from '../../servidor/servidor.js';

const aplicacion = servidorModulo.aplicacion;
const inicializarBaseDeDatos = servidorModulo.inicializarBaseDeDatos;

let promesaPuerto = null;

function obtenerPuertoInterno() {
    if (!promesaPuerto) {
        promesaPuerto = new Promise(function (resolver, rechazar) {
            const servidorHttp = http.createServer(aplicacion);
            servidorHttp.on('error', rechazar);
            servidorHttp.listen(0, '127.0.0.1', function () {
                const direccion = servidorHttp.address();
                resolver(direccion.port);
            });
        });
    }
    return promesaPuerto;
}

export default async function (peticion, contexto) {
    await inicializarBaseDeDatos();
    const puerto = await obtenerPuertoInterno();
    const urlEntrante = new URL(peticion.url);

    const encabezados = {};
    peticion.headers.forEach(function (valor, clave) {
        const claveMin = clave.toLowerCase();
        if (claveMin !== 'host' && claveMin !== 'connection' && claveMin !== 'accept-encoding' && claveMin !== 'content-length') {
            encabezados[clave] = valor;
        }
    });
    encabezados['x-forwarded-proto'] = 'https';
    encabezados['x-forwarded-host'] = urlEntrante.host;

    let cuerpoBuffer = null;
    if (peticion.method !== 'GET' && peticion.method !== 'HEAD') {
        const arregloBytes = await peticion.arrayBuffer();
        cuerpoBuffer = Buffer.from(arregloBytes);
        encabezados['content-length'] = String(cuerpoBuffer.length);
    }

    return new Promise(function (resolver, rechazar) {
        const peticionInterna = http.request(
            {
                hostname: '127.0.0.1',
                port: puerto,
                path: urlEntrante.pathname + urlEntrante.search,
                method: peticion.method,
                headers: encabezados
            },
            function (respuestaInterna) {
                const partes = [];
                respuestaInterna.on('data', function (trozo) {
                    partes.push(trozo);
                });
                respuestaInterna.on('end', function () {
                    const cuerpoFinal = Buffer.concat(partes);
                    const codigo = respuestaInterna.statusCode || 200;
                    const encabezadosSalida = new Headers();
                    const claves = Object.keys(respuestaInterna.headers);
                    for (let i = 0; i < claves.length; i++) {
                        const nombre = claves[i];
                        const valor = respuestaInterna.headers[nombre];
                        if (Array.isArray(valor)) {
                            for (let j = 0; j < valor.length; j++) {
                                encabezadosSalida.append(nombre, valor[j]);
                            }
                        } else if (valor !== undefined) {
                            encabezadosSalida.set(nombre, String(valor));
                        }
                    }

                    const cuerpoRespuesta = codigo === 204 || codigo === 304 ? null : cuerpoFinal;
                    resolver(
                        new Response(cuerpoRespuesta, {
                            status: codigo,
                            headers: encabezadosSalida
                        })
                    );
                });
            }
        );

        peticionInterna.on('error', rechazar);
        if (cuerpoBuffer && cuerpoBuffer.length > 0) {
            peticionInterna.write(cuerpoBuffer);
        }
        peticionInterna.end();
    });
}

export const config = {
    path: ['/api/*', '/subidas/*']
};
