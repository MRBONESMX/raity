if ('serviceWorker' in navigator) {
    window.addEventListener('load', async function () {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
        } catch (error) {
            console.log('No se pudo registrar el service worker:', error);
        }
    });
}
