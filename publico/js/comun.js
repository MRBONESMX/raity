const mapasActivos = {};

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
    const lineaRuta = L.polyline(
        [
            [origenLat, origenLon],
            [destinoLat, destinoLon]
        ],
        { color: colorLinea, weight: 4 }
    ).addTo(mapa);

    mapa.fitBounds(lineaRuta.getBounds(), { padding: [28, 28] });
    setTimeout(function () {
        mapa.invalidateSize();
        mapa.fitBounds(lineaRuta.getBounds(), { padding: [28, 28] });
    }, 100);
    mapasActivos[idContenedor] = mapa;
    return mapa;
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
