const serverless = require('serverless-http');
const { aplicacion, inicializarBaseDeDatos } = require('../../servidor/servidor');

const manejadorExpress = serverless(aplicacion, {
    binary: ['image/*']
});

exports.handler = async function (evento, contexto) {
    await inicializarBaseDeDatos();

    const prefijo = '/.netlify/functions/api';
    if (evento.path && evento.path.indexOf(prefijo) === 0) {
        evento.path = evento.path.slice(prefijo.length) || '/';
    }
    if (evento.rawUrl && evento.rawUrl.indexOf(prefijo) !== -1) {
        evento.rawUrl = evento.rawUrl.replace(prefijo, '');
    }

    return manejadorExpress(evento, contexto);
};
