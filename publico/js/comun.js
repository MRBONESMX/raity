const mapasActivos = {};
const cacheRutasCalles = {};
const promesasRutasEnCurso = {};
const capasRecogidaPorMapa = {};
const CLAVE_CACHE_CALLES = 'raity_rutas_calles_v1';
const CLAVE_PERMISO_GPS_RAITY = 'raity_permiso_gps_aceptado';
const UMBRAL_FUERA_DE_RUTA_METROS = 80;
let colaSolicitudesRuta = Promise.resolve();

async function verificarSesion() {
    try {
        const respuesta = await fetch('/api/usuarios/sesion');
        if (!respuesta.ok) {
            window.location.href = '/index.html';
            return null;
        }
        const datos = await respuesta.json();
        return datos.usuario;
    } catch (error) {
        const usuarioGuardado = localStorage.getItem('raity_usuario');
        if (usuarioGuardado) {
            return JSON.parse(usuarioGuardado);
        }
        window.location.href = '/index.html';
        return null;
    }
}

function obtenerIniciales(nombreCompleto) {
    if (!nombreCompleto) {
        return 'U';
    }
    const partes = nombreCompleto.trim().split(' ');
    if (partes.length >= 2) {
        return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }
    return nombreCompleto.substring(0, 2).toUpperCase();
}

function iconoAlertaSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="8" x2="12" y2="12"/>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
        '</svg>';
}

function iconoExitoSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<polyline points="8 12 11 15 16 9"/>' +
        '</svg>';
}

function mostrarMensaje(idContenedor, texto, tipo) {
    const caja = document.getElementById(idContenedor);
    if (!caja) {
        return;
    }

    const esExito = tipo === 'exito' || caja.classList.contains('aviso-exito');
    caja.setAttribute('role', 'alert');
    caja.setAttribute('aria-live', 'polite');

    const icono = esExito ? iconoExitoSvg() : iconoAlertaSvg();
    caja.innerHTML = '';
    caja.insertAdjacentHTML('beforeend', icono);

    const spanTexto = document.createElement('span');
    spanTexto.textContent = texto;
    caja.appendChild(spanTexto);
    caja.classList.add('visible');
}

function ocultarMensaje(idContenedor) {
    if (!idContenedor) {
        return;
    }
    const caja = document.getElementById(idContenedor);
    if (!caja) {
        return;
    }
    caja.innerHTML = '';
    caja.classList.remove('visible');
}

function marcarErrorCampo(idCampo, mensajeError) {
    const campo = document.getElementById(idCampo);
    if (!campo) {
        return;
    }
    campo.classList.add('campo-error');
    campo.setAttribute('aria-invalid', 'true');

    if (mensajeError) {
        const idError = 'error-' + idCampo;
        let parrafoError = document.getElementById(idError);
        if (!parrafoError) {
            parrafoError = document.createElement('p');
            parrafoError.id = idError;
            parrafoError.className = 'texto-error-campo';
            parrafoError.setAttribute('role', 'alert');
            campo.insertAdjacentElement('afterend', parrafoError);
        }
        parrafoError.textContent = 'Aviso: ' + mensajeError;
        campo.setAttribute('aria-describedby', idError);
    }
}

function limpiarErroresCampos(idsCampos, idContenedorAviso) {
    if (idContenedorAviso) {
        ocultarMensaje(idContenedorAviso);
    }
    for (let i = 0; i < idsCampos.length; i++) {
        const idCampo = idsCampos[i];
        const campo = document.getElementById(idCampo);
        if (campo) {
            campo.classList.remove('campo-error');
            campo.removeAttribute('aria-invalid');
            campo.removeAttribute('aria-describedby');
        }
        const parrafoError = document.getElementById('error-' + idCampo);
        if (parrafoError) {
            parrafoError.remove();
        }
    }
}

function cambiarEstadoBoton(boton, estaCargando, textoCargando) {
    if (!boton) {
        return;
    }
    if (estaCargando) {
        if (!boton.dataset.textoOriginal) {
            boton.dataset.textoOriginal = boton.textContent;
        }
        boton.textContent = textoCargando;
        boton.disabled = true;
    } else {
        if (boton.dataset.textoOriginal) {
            boton.textContent = boton.dataset.textoOriginal;
        }
        boton.disabled = false;
    }
}

function cerrarModalActivo(modal) {
    if (modal) {
        modal.classList.remove('visible');
    }
}

function pedirConfirmacion(titulo, mensaje, textoBotonConfirmar, accionConfirmar, esDestructivo) {
    let fondoModal = document.getElementById('modal-confirmacion-raity');

    if (!fondoModal) {
        fondoModal = document.createElement('div');
        fondoModal.id = 'modal-confirmacion-raity';
        fondoModal.className = 'modal-fondo';
        fondoModal.setAttribute('role', 'dialog');
        fondoModal.setAttribute('aria-modal', 'true');
        fondoModal.setAttribute('aria-labelledby', 'titulo-modal-confirmacion');
        fondoModal.innerHTML =
            '<div class="modal-caja">' +
            '<h3 id="titulo-modal-confirmacion" class="modal-titulo"></h3>' +
            '<p id="texto-modal-confirmacion" class="modal-texto"></p>' +
            '<div class="fila-botones-modal">' +
            '<button type="button" id="boton-cancelar-confirmacion" class="boton boton-secundario">Cancelar</button>' +
            '<button type="button" id="boton-aceptar-confirmacion" class="boton boton-rojo">Confirmar</button>' +
            '</div>' +
            '</div>';
        document.body.appendChild(fondoModal);

        fondoModal.addEventListener('click', function (evento) {
            if (evento.target === fondoModal) {
                cerrarModalActivo(fondoModal);
            }
        });
    }

    const tituloModal = document.getElementById('titulo-modal-confirmacion');
    const textoModal = document.getElementById('texto-modal-confirmacion');
    const botonCancelar = document.getElementById('boton-cancelar-confirmacion');
    const botonAceptar = document.getElementById('boton-aceptar-confirmacion');

    tituloModal.textContent = titulo;
    textoModal.textContent = mensaje;
    botonAceptar.textContent = textoBotonConfirmar;
    botonAceptar.className = esDestructivo === false ? 'boton boton-principal' : 'boton boton-rojo';

    botonCancelar.onclick = function () {
        cerrarModalActivo(fondoModal);
    };

    botonAceptar.onclick = async function () {
        cerrarModalActivo(fondoModal);
        if (typeof accionConfirmar === 'function') {
            await accionConfirmar();
        }
    };

    fondoModal.classList.add('visible');
    botonCancelar.focus();
}

function mostrarAvisoProximamente(nombreFuncion) {
    let fondoModal = document.getElementById('modal-proximamente');

    if (!fondoModal) {
        fondoModal = document.createElement('div');
        fondoModal.id = 'modal-proximamente';
        fondoModal.className = 'modal-fondo';
        fondoModal.setAttribute('role', 'dialog');
        fondoModal.setAttribute('aria-modal', 'true');
        fondoModal.setAttribute('aria-labelledby', 'titulo-modal-proximamente');
        fondoModal.innerHTML =
            '<div class="modal-caja">' +
            '<h3 id="titulo-modal-proximamente" class="modal-titulo">Próximamente</h3>' +
            '<p id="texto-modal-proximamente" class="modal-texto"></p>' +
            '<button type="button" id="boton-cerrar-proximamente" class="boton boton-principal">Entendido</button>' +
            '</div>';
        document.body.appendChild(fondoModal);

        const botonCerrar = document.getElementById('boton-cerrar-proximamente');
        botonCerrar.addEventListener('click', function () {
            cerrarModalActivo(fondoModal);
        });
    }

    const parrafoTexto = document.getElementById('texto-modal-proximamente');
    parrafoTexto.textContent =
        'La función "' + nombreFuncion + '" estará disponible en la próxima actualización de Raity.';
    fondoModal.classList.add('visible');
    document.getElementById('boton-cerrar-proximamente').focus();
}

function generarCaminoVialLaPaz(latOrigen, lonOrigen, latDestino, lonDestino) {
    const origenLat = Number(latOrigen);
    const origenLon = Number(lonOrigen);
    const destinoLat = Number(latDestino);
    const destinoLon = Number(lonDestino);

    const difLat = Math.abs(destinoLat - origenLat);
    const difLon = Math.abs(destinoLon - origenLon);
    if (difLat < 0.001 && difLon < 0.001) {
        return [
            [origenLat, origenLon],
            [destinoLat, destinoLon]
        ];
    }

    // Corredor vial principal de La Paz (Blvd. Forjadores / Blvd. Pino Payas / Las Garzas)
    const lonCorredorForjadores = -110.3148;
    const latEntronqueUabcs = 24.1045;
    const puntos = [[origenLat, origenLon]];

    if (origenLon < -110.322 && destinoLon > -110.320) {
        puntos.push([origenLat, lonCorredorForjadores]);
        puntos.push([latEntronqueUabcs, lonCorredorForjadores]);
    } else if (origenLon > -110.305 && destinoLon < -110.312) {
        puntos.push([origenLat, -110.3120]);
        puntos.push([latEntronqueUabcs, -110.3145]);
    } else {
        const latMedio = Number(((origenLat + destinoLat) / 2).toFixed(6));
        puntos.push([latMedio, origenLon]);
        puntos.push([latMedio, destinoLon]);
    }

    puntos.push([destinoLat, destinoLon]);
    return puntos;
}

function leerCacheRutasLocal() {
    try {
        const texto = localStorage.getItem(CLAVE_CACHE_CALLES);
        return texto ? JSON.parse(texto) : {};
    } catch (error) {
        return {};
    }
}

function guardarCacheRutasLocal(clave, puntos) {
    try {
        const cache = leerCacheRutasLocal();
        const llaves = Object.keys(cache);
        if (llaves.length > 40) {
            delete cache[llaves[0]];
        }
        cache[clave] = puntos;
        localStorage.setItem(CLAVE_CACHE_CALLES, JSON.stringify(cache));
    } catch (error) {
        console.log('No se pudo guardar la ruta en caché local.');
    }
}

function esperarMs(milisegundos) {
    return new Promise(function (resolver) {
        setTimeout(resolver, milisegundos);
    });
}

async function obtenerGeometriaCalle(latOrigen, lonOrigen, latDestino, lonDestino) {
    const origenLat = Number(latOrigen);
    const origenLon = Number(lonOrigen);
    const destinoLat = Number(latDestino);
    const destinoLon = Number(lonDestino);

    const clave =
        origenLat.toFixed(4) + ',' + origenLon.toFixed(4) +
        '->' +
        destinoLat.toFixed(4) + ',' + destinoLon.toFixed(4);

    if (cacheRutasCalles[clave]) {
        return cacheRutasCalles[clave];
    }

    const cacheLocal = leerCacheRutasLocal();
    if (cacheLocal[clave] && cacheLocal[clave].length >= 2) {
        cacheRutasCalles[clave] = cacheLocal[clave];
        return cacheLocal[clave];
    }

    if (promesasRutasEnCurso[clave]) {
        return promesasRutasEnCurso[clave];
    }

    const promesa = colaSolicitudesRuta.then(async function () {
        await esperarMs(120);
        const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const temporizador = controlador ? setTimeout(function () {
            controlador.abort();
        }, 5000) : null;

        try {
            const urlOsrm =
                'https://router.project-osrm.org/route/v1/driving/' +
                origenLon + ',' + origenLat + ';' + destinoLon + ',' + destinoLat +
                '?overview=full&geometries=geojson';

            const respuesta = await fetch(urlOsrm, controlador ? { signal: controlador.signal } : {});
            if (temporizador) {
                clearTimeout(temporizador);
            }
            if (respuesta.ok) {
                const datos = await respuesta.json();
                if (datos.routes && datos.routes.length > 0 && datos.routes[0].geometry && datos.routes[0].geometry.coordinates) {
                    const coordenadas = datos.routes[0].geometry.coordinates;
                    const puntos = [];
                    for (let i = 0; i < coordenadas.length; i++) {
                        puntos.push([coordenadas[i][1], coordenadas[i][0]]);
                    }
                    if (puntos.length >= 2) {
                        cacheRutasCalles[clave] = puntos;
                        guardarCacheRutasLocal(clave, puntos);
                        return puntos;
                    }
                }
            }
        } catch (error) {
            if (temporizador) {
                clearTimeout(temporizador);
            }
            console.log('Usando trazado vial alterno para La Paz.');
        } finally {
            delete promesasRutasEnCurso[clave];
        }

        const respaldo = generarCaminoVialLaPaz(origenLat, origenLon, destinoLat, destinoLon);
        cacheRutasCalles[clave] = respaldo;
        return respaldo;
    });

    colaSolicitudesRuta = promesa.catch(function () {});
    promesasRutasEnCurso[clave] = promesa;
    return promesa;
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const radioTierra = 6371000;
    const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
    const radLat1 = (Number(lat1) * Math.PI) / 180;
    const radLat2 = (Number(lat2) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radioTierra * c;
}

function proyectarPuntoEnSegmento(latP, lonP, latA, lonA, latB, lonB) {
    const pLat = Number(latP);
    const pLon = Number(lonP);
    const aLat = Number(latA);
    const aLon = Number(lonA);
    const bLat = Number(latB);
    const bLon = Number(lonB);

    const factorCos = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
    const ax = aLon * factorCos;
    const ay = aLat;
    const bx = bLon * factorCos;
    const by = bLat;
    const px = pLon * factorCos;
    const py = pLat;

    const dx = bx - ax;
    const dy = by - ay;
    const longitudCuadrada = dx * dx + dy * dy;

    let t = 0;
    if (longitudCuadrada > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / longitudCuadrada;
        if (t < 0) {
            t = 0;
        } else if (t > 1) {
            t = 1;
        }
    }

    return {
        punto: [aLat + t * (bLat - aLat), aLon + t * (bLon - aLon)],
        t: t
    };
}

function calcularPuntoRecogidaEnRuta(latPasajero, lonPasajero, puntosRuta) {
    if (!Array.isArray(puntosRuta) || puntosRuta.length < 2) {
        const lat = Number(latPasajero);
        const lon = Number(lonPasajero);
        return {
            latitud_pasajero: Number(lat.toFixed(6)),
            longitud_pasajero: Number(lon.toFixed(6)),
            latitud_recogida: Number(lat.toFixed(6)),
            longitud_recogida: Number(lon.toFixed(6)),
            distancia_ruta_metros: 0,
            fuera_de_ruta: false,
            indice_segmento: 0,
            fraccion_segmento: 0
        };
    }

    let mejorPunto = [Number(puntosRuta[0][0]), Number(puntosRuta[0][1])];
    let menorDistancia = Infinity;
    let mejorIndice = 0;
    let mejorT = 0;

    for (let i = 0; i < puntosRuta.length - 1; i++) {
        const puntoA = puntosRuta[i];
        const puntoB = puntosRuta[i + 1];
        const proyeccion = proyectarPuntoEnSegmento(
            latPasajero,
            lonPasajero,
            puntoA[0],
            puntoA[1],
            puntoB[0],
            puntoB[1]
        );
        const distancia = calcularDistanciaMetros(
            latPasajero,
            lonPasajero,
            proyeccion.punto[0],
            proyeccion.punto[1]
        );
        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            mejorPunto = proyeccion.punto;
            mejorIndice = i;
            mejorT = proyeccion.t;
        }
    }

    const distanciaMetros = Math.round(menorDistancia);
    return {
        latitud_pasajero: Number(Number(latPasajero).toFixed(6)),
        longitud_pasajero: Number(Number(lonPasajero).toFixed(6)),
        latitud_recogida: Number(mejorPunto[0].toFixed(6)),
        longitud_recogida: Number(mejorPunto[1].toFixed(6)),
        distancia_ruta_metros: distanciaMetros,
        fuera_de_ruta: distanciaMetros > UMBRAL_FUERA_DE_RUTA_METROS,
        indice_segmento: mejorIndice,
        fraccion_segmento: mejorT
    };
}

function insertarPuntoEnPolilineaRuta(puntosRuta, puntoRecogida) {
    if (!Array.isArray(puntosRuta) || puntosRuta.length < 2 || !puntoRecogida) {
        return {
            puntosCompletos: puntosRuta || [],
            tramoHastaRecogida: [],
            puntoProyectado: null,
            indiceSegmento: 0,
            fraccionSegmento: 0
        };
    }

    const latObj = Array.isArray(puntoRecogida) ? puntoRecogida[0] : puntoRecogida.latitud_recogida;
    const lonObj = Array.isArray(puntoRecogida) ? puntoRecogida[1] : puntoRecogida.longitud_recogida;
    const calculo = calcularPuntoRecogidaEnRuta(latObj, lonObj, puntosRuta);
    const coordenadaExacta = [calculo.latitud_recogida, calculo.longitud_recogida];
    const indice = calculo.indice_segmento;

    const puntosCompletos = [];
    const tramoHastaRecogida = [];

    for (let i = 0; i <= indice; i++) {
        const pt = [Number(puntosRuta[i][0]), Number(puntosRuta[i][1])];
        puntosCompletos.push(pt);
        tramoHastaRecogida.push(pt);
    }

    const ultimoAntes = puntosCompletos[puntosCompletos.length - 1];
    if (
        !ultimoAntes ||
        Math.abs(ultimoAntes[0] - coordenadaExacta[0]) > 0.000001 ||
        Math.abs(ultimoAntes[1] - coordenadaExacta[1]) > 0.000001
    ) {
        puntosCompletos.push(coordenadaExacta);
        tramoHastaRecogida.push(coordenadaExacta);
    }

    for (let i = indice + 1; i < puntosRuta.length; i++) {
        const pt = [Number(puntosRuta[i][0]), Number(puntosRuta[i][1])];
        if (
            i === indice + 1 &&
            Math.abs(pt[0] - coordenadaExacta[0]) <= 0.000001 &&
            Math.abs(pt[1] - coordenadaExacta[1]) <= 0.000001
        ) {
            continue;
        }
        puntosCompletos.push(pt);
    }

    return {
        puntosCompletos: puntosCompletos,
        tramoHastaRecogida: tramoHastaRecogida,
        puntoProyectado: coordenadaExacta,
        indiceSegmento: indice,
        fraccionSegmento: calculo.fraccion_segmento
    };
}

function pedirPermisoGpsDispositivo() {
    return new Promise(function (resolver) {
        let fondoModal = document.getElementById('modal-permiso-gps-raity');

        if (!fondoModal) {
            fondoModal = document.createElement('div');
            fondoModal.id = 'modal-permiso-gps-raity';
            fondoModal.className = 'modal-fondo';
            fondoModal.setAttribute('role', 'dialog');
            fondoModal.setAttribute('aria-modal', 'true');
            fondoModal.setAttribute('aria-labelledby', 'titulo-modal-gps');
            fondoModal.innerHTML =
                '<div class="modal-caja">' +
                '<h3 id="titulo-modal-gps" class="modal-titulo">Permiso para acceder al GPS</h3>' +
                '<p id="texto-modal-gps" class="modal-texto">' +
                'Raity necesita permiso para acceder a la ubicación GPS de tu celular y marcar automáticamente tu punto de recogida sobre la ruta del conductor.' +
                '</p>' +
                '<div class="fila-botones-modal">' +
                '<button type="button" id="boton-denegar-gps" class="boton boton-secundario">Ahora no</button>' +
                '<button type="button" id="boton-permitir-gps" class="boton boton-principal">Permitir GPS</button>' +
                '</div>' +
                '</div>';
            document.body.appendChild(fondoModal);
        }

        const botonDenegar = document.getElementById('boton-denegar-gps');
        const botonPermitir = document.getElementById('boton-permitir-gps');
        let resuelto = false;

        function finalizar(aceptado) {
            if (resuelto) {
                return;
            }
            resuelto = true;
            cerrarModalActivo(fondoModal);
            resolver(aceptado);
        }

        botonDenegar.onclick = function () {
            finalizar(false);
        };

        botonPermitir.onclick = function () {
            try {
                sessionStorage.setItem(CLAVE_PERMISO_GPS_RAITY, '1');
            } catch (error) {
                console.log('No se pudo recordar la autorización de GPS en sesión.');
            }
            finalizar(true);
        };

        fondoModal.onclick = function (evento) {
            if (evento.target === fondoModal) {
                finalizar(false);
            }
        };

        fondoModal.classList.add('visible');
        botonPermitir.focus();
    });
}

async function solicitarPermisoYUbicacionGps(opciones) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Tu navegador o celular no es compatible con la geolocalización GPS.');
    }

    const config = opciones || {};
    let yaAutorizadoEnNavegador = false;

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
            const estadoPermiso = await navigator.permissions.query({ name: 'geolocation' });
            if (estadoPermiso && estadoPermiso.state === 'granted') {
                yaAutorizadoEnNavegador = true;
            }
        } catch (error) {
            yaAutorizadoEnNavegador = false;
        }
    }

    const aceptadoEnSesion = sessionStorage.getItem(CLAVE_PERMISO_GPS_RAITY) === '1';
    if (!config.omitirDialogoPrevia && !yaAutorizadoEnNavegador && !aceptadoEnSesion) {
        const acepto = await pedirPermisoGpsDispositivo();
        if (!acepto) {
            const errorUsuario = new Error(
                'No otorgaste permiso para acceder al GPS. Permite el acceso cuando estés listo para marcar tu punto de recogida.'
            );
            errorUsuario.codigo = 'PERMISO_DENEGADO_USUARIO';
            throw errorUsuario;
        }
    }

    return new Promise(function (resolver, rechazar) {
        navigator.geolocation.getCurrentPosition(
            function (posicion) {
                try {
                    sessionStorage.setItem(CLAVE_PERMISO_GPS_RAITY, '1');
                } catch (error) {
                    console.log('No se pudo guardar el estado del permiso GPS.');
                }
                resolver({
                    latitud: Number(posicion.coords.latitude.toFixed(6)),
                    longitud: Number(posicion.coords.longitude.toFixed(6)),
                    precision: posicion.coords.accuracy ? Math.round(posicion.coords.accuracy) : null
                });
            },
            function (errorGeo) {
                let mensajeError = 'No se pudo obtener tu ubicación actual mediante GPS.';
                if (errorGeo && errorGeo.code === 1) {
                    mensajeError =
                        'Permiso de ubicación GPS denegado. Activa el permiso de ubicación en tu celular o navegador e intenta de nuevo.';
                } else if (errorGeo && errorGeo.code === 2) {
                    mensajeError =
                        'No se pudo detectar la señal GPS de tu dispositivo. Verifica que tu ubicación esté activada.';
                } else if (errorGeo && errorGeo.code === 3) {
                    mensajeError =
                        'Tiempo de espera agotado al leer el GPS. Intenta nuevamente en un lugar abierto.';
                }
                const err = new Error(mensajeError);
                err.codigo = errorGeo && errorGeo.code === 1 ? 'PERMISO_DENEGADO' : 'ERROR_GPS';
                rechazar(err);
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0
            }
        );
    });
}

function dibujarRutaEnMapa(idContenedor, latOrigen, lonOrigen, latDestino, lonDestino, opciones) {
    if (typeof L === 'undefined') {
        return null;
    }
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) {
        return null;
    }

    if (mapasActivos[idContenedor]) {
        mapasActivos[idContenedor].remove();
    }

    const configuracion = opciones || {};
    const origenLat = Number(latOrigen);
    const origenLon = Number(lonOrigen);
    const destinoLat = Number(latDestino);
    const destinoLon = Number(lonDestino);

    const mapa = L.map(idContenedor, {
        zoomControl: configuracion.conControles !== false,
        dragging: configuracion.interactivo !== false,
        scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap'
    }).addTo(mapa);

    const marcadorOrigen = L.circleMarker([origenLat, origenLon], {
        radius: 8,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#057A91',
        fillOpacity: 1
    }).addTo(mapa);

    const marcadorDestino = L.circleMarker([destinoLat, destinoLon], {
        radius: 6,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#0F7652',
        fillOpacity: 1
    }).addTo(mapa);

    marcadorOrigen.bindTooltip('Salida', { permanent: true, direction: 'top' });
    marcadorDestino.bindTooltip('Destino', { permanent: true, direction: 'top' });

    if (configuracion.textoOrigen) {
        marcadorOrigen.bindPopup('Origen: ' + configuracion.textoOrigen);
    }
    if (configuracion.textoDestino) {
        marcadorDestino.bindPopup('Destino: ' + configuracion.textoDestino);
    }

    const colorLinea = configuracion.esVioleta ? '#6B21A8' : '#057A91';
    const puntosIniciales = generarCaminoVialLaPaz(origenLat, origenLon, destinoLat, destinoLon);
    const lineaRuta = L.polyline(puntosIniciales, { color: colorLinea, weight: 4 }).addTo(mapa);
    const grupoRecogida = L.layerGroup().addTo(mapa);

    capasRecogidaPorMapa[idContenedor] = {
        mapa: mapa,
        marcadoresPorPasajero: {}
    };

    function renderizarPuntosRecogidaSobreRuta(puntosBase) {
        grupoRecogida.clearLayers();
        capasRecogidaPorMapa[idContenedor].marcadoresPorPasajero = {};

        const listaPuntos = Array.isArray(configuracion.puntosRecogida)
            ? configuracion.puntosRecogida
            : [];

        let polilineaConRecogidas = puntosBase.slice();

        for (let i = 0; i < listaPuntos.length; i++) {
            const item = listaPuntos[i];
            const latBase = item.latitud_pasajero !== undefined && item.latitud_pasajero !== null
                ? Number(item.latitud_pasajero)
                : Number(item.latitud_recogida);
            const lonBase = item.longitud_pasajero !== undefined && item.longitud_pasajero !== null
                ? Number(item.longitud_pasajero)
                : Number(item.longitud_recogida);

            if (!Number.isFinite(latBase) || !Number.isFinite(lonBase)) {
                continue;
            }

            // Proyecta siempre sobre la ruta establecida para no generar desvíos
            const calculoEnRuta = calcularPuntoRecogidaEnRuta(latBase, lonBase, puntosBase);
            const insercion = insertarPuntoEnPolilineaRuta(polilineaConRecogidas, [
                calculoEnRuta.latitud_recogida,
                calculoEnRuta.longitud_recogida
            ]);
            polilineaConRecogidas = insercion.puntosCompletos;

            if (insercion.tramoHastaRecogida && insercion.tramoHastaRecogida.length >= 2) {
                L.polyline(insercion.tramoHastaRecogida, {
                    color: '#D97706',
                    weight: 5,
                    opacity: 0.85,
                    dashArray: '8, 6'
                }).addTo(grupoRecogida);
            }

            const coordRecogida = [calculoEnRuta.latitud_recogida, calculoEnRuta.longitud_recogida];

            L.circleMarker(coordRecogida, {
                radius: 15,
                color: '#D97706',
                weight: 2,
                opacity: 0.45,
                fillColor: '#F59E0B',
                fillOpacity: 0.22,
                interactive: false
            }).addTo(grupoRecogida);

            const marcadorRecogida = L.circleMarker(coordRecogida, {
                radius: 9,
                color: '#FFFFFF',
                weight: 2.5,
                fillColor: '#D97706',
                fillOpacity: 1
            }).addTo(grupoRecogida);

            const nombrePasajero = item.nombre_completo || 'Pasajero';
            const etiquetaCorta =
                listaPuntos.length > 1
                    ? 'Recogida: ' + nombrePasajero.split(' ')[0]
                    : 'Punto de recogida';
            marcadorRecogida.bindTooltip(etiquetaCorta, { permanent: true, direction: 'top' });

            const popupDiv = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = 'Punto de recogida sobre la ruta';
            popupDiv.appendChild(titulo);
            popupDiv.appendChild(document.createElement('br'));
            popupDiv.appendChild(document.createTextNode('Pasajero: ' + nombrePasajero));
            popupDiv.appendChild(document.createElement('br'));
            popupDiv.appendChild(
                document.createTextNode(
                    'Ubicación en ruta: ' +
                    calculoEnRuta.latitud_recogida.toFixed(5) +
                    ', ' +
                    calculoEnRuta.longitud_recogida.toFixed(5)
                )
            );
            if (calculoEnRuta.distancia_ruta_metros !== null && calculoEnRuta.distancia_ruta_metros !== undefined) {
                popupDiv.appendChild(document.createElement('br'));
                popupDiv.appendChild(
                    document.createTextNode(
                        calculoEnRuta.fuera_de_ruta
                            ? 'Distancia del GPS a la ruta: ' + calculoEnRuta.distancia_ruta_metros + ' m (acercarse a la ruta)'
                            : 'Sobre la ruta (a ' + calculoEnRuta.distancia_ruta_metros + ' m)'
                    )
                );
            }
            marcadorRecogida.bindPopup(popupDiv);

            if (item.id_usuario !== undefined && item.id_usuario !== null) {
                capasRecogidaPorMapa[idContenedor].marcadoresPorPasajero[String(item.id_usuario)] = marcadorRecogida;
            }

            if (
                calculoEnRuta.fuera_de_ruta &&
                item.latitud_pasajero !== undefined &&
                item.latitud_pasajero !== null &&
                item.longitud_pasajero !== undefined &&
                item.longitud_pasajero !== null
            ) {
                const coordGps = [Number(item.latitud_pasajero), Number(item.longitud_pasajero)];
                L.polyline([coordGps, coordRecogida], {
                    color: '#B91C1C',
                    weight: 2.5,
                    dashArray: '5, 6',
                    opacity: 0.9
                }).addTo(grupoRecogida);

                const marcadorGps = L.circleMarker(coordGps, {
                    radius: 6,
                    color: '#FFFFFF',
                    weight: 2,
                    fillColor: '#B91C1C',
                    fillOpacity: 1
                }).addTo(grupoRecogida);
                marcadorGps.bindPopup(
                    'Ubicación GPS de ' +
                    nombrePasajero +
                    ' (a ' +
                    calculoEnRuta.distancia_ruta_metros +
                    ' m fuera de la ruta). Debe acercarse al punto de recogida.'
                );
            }
        }

        lineaRuta.setLatLngs(polilineaConRecogidas);
    }

    renderizarPuntosRecogidaSobreRuta(puntosIniciales);

    mapa.fitBounds(lineaRuta.getBounds(), { padding: [28, 28] });
    setTimeout(function () {
        if (mapasActivos[idContenedor] === mapa) {
            mapa.invalidateSize();
            mapa.fitBounds(lineaRuta.getBounds(), { padding: [28, 28] });
        }
    }, 100);
    mapasActivos[idContenedor] = mapa;

    obtenerGeometriaCalle(origenLat, origenLon, destinoLat, destinoLon).then(function (puntosCalle) {
        if (mapasActivos[idContenedor] === mapa && puntosCalle && puntosCalle.length >= 2) {
            renderizarPuntosRecogidaSobreRuta(puntosCalle);
            mapa.fitBounds(lineaRuta.getBounds(), { padding: [28, 28] });
        }
    });

    return mapa;
}

function enfocarPuntoRecogidaEnMapa(idContenedor, idUsuario) {
    const registro = capasRecogidaPorMapa[idContenedor];
    if (!registro || !registro.mapa) {
        return false;
    }
    const marcador = registro.marcadoresPorPasajero[String(idUsuario)];
    if (!marcador) {
        return false;
    }
    registro.mapa.setView(marcador.getLatLng(), 16);
    marcador.openPopup();
    return true;
}

function activarRespaldoFormulario(idFormulario, claveAlmacenamiento) {
    const formulario = document.getElementById(idFormulario);
    if (!formulario) {
        return;
    }

    try {
        const guardado = sessionStorage.getItem(claveAlmacenamiento);
        if (guardado) {
            const datos = JSON.parse(guardado);
            const campos = formulario.querySelectorAll('input, select, textarea');
            for (let i = 0; i < campos.length; i++) {
                const campo = campos[i];
                if (!campo.id || campo.type === 'password' || campo.type === 'file') {
                    continue;
                }
                if (datos[campo.id] !== undefined) {
                    if (campo.type === 'checkbox') {
                        campo.checked = Boolean(datos[campo.id]);
                    } else if (campo.tagName !== 'SELECT' || campo.querySelector('option[value="' + datos[campo.id] + '"]')) {
                        campo.value = datos[campo.id];
                    }
                }
            }
        }
    } catch (error) {
        console.log('No se pudo restaurar el respaldo del formulario.');
    }

    formulario.addEventListener('input', function () {
        guardarEstadoFormulario(formulario, claveAlmacenamiento);
    });
    formulario.addEventListener('change', function () {
        guardarEstadoFormulario(formulario, claveAlmacenamiento);
    });
}

function guardarEstadoFormulario(formulario, claveAlmacenamiento) {
    try {
        const datos = {};
        const campos = formulario.querySelectorAll('input, select, textarea');
        for (let i = 0; i < campos.length; i++) {
            const campo = campos[i];
            if (!campo.id || campo.type === 'password' || campo.type === 'file') {
                continue;
            }
            datos[campo.id] = campo.type === 'checkbox' ? campo.checked : campo.value;
        }
        sessionStorage.setItem(claveAlmacenamiento, JSON.stringify(datos));
    } catch (error) {
        console.log('No se pudo guardar el respaldo del formulario.');
    }
}

function limpiarRespaldoFormulario(claveAlmacenamiento) {
    try {
        sessionStorage.removeItem(claveAlmacenamiento);
    } catch (error) {
        console.log('No se pudo limpiar el respaldo del formulario.');
    }
}

function iconoEstrellaSvg() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="#B58900" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
}

function iconoCorazonVioletaSvg() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="#6B21A8" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
}

function iconoAutoSvg() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" aria-hidden="true"><path d="M5 11l2-5h10l2 5"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
}

function iconoRelojSvg() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
}

function iconoGpsSvg() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10z"/><circle cx="12" cy="11" r="2.5"/></svg>';
}

function inicializarBarraConexion() {
    const barra = document.getElementById('barra-sin-conexion');
    if (barra) {
        barra.setAttribute('role', 'status');
        barra.setAttribute('aria-live', 'polite');

        function actualizarEstado() {
            if (navigator.onLine) {
                barra.classList.remove('visible');
            } else {
                barra.classList.add('visible');
            }
        }

        actualizarEstado();
        window.addEventListener('online', actualizarEstado);
        window.addEventListener('offline', actualizarEstado);
    }

    document.addEventListener('keydown', function (evento) {
        if (evento.key === 'Escape') {
            const modalesAbiertos = document.querySelectorAll('.modal-fondo.visible');
            for (let i = 0; i < modalesAbiertos.length; i++) {
                cerrarModalActivo(modalesAbiertos[i]);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarBarraConexion);
