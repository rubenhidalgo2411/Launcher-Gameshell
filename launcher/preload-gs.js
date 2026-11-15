'use strict';
// GameShell · preload extra. main.js lo registra con session.registerPreloadScript, así tu preload.js no se toca.
// Añade a la ventana del launcher (solo a ella) window.gsx con lo nuevo: tipos de letra propios, contador de FPS, resolución de pantalla, mandos Buzz y actualizaciones.
const { contextBridge, ipcRenderer } = require('electron');
try {
  if (location.protocol === 'file:' && /\/index\.html$/i.test(location.pathname) && window === window.top) {
    const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
    contextBridge.exposeInMainWorld('gsx', {
      fonts: () => inv('fuentes'), fontData: id => inv('fuente:data', id), fontAdd: () => inv('fuente:add'), fontDel: id => inv('fuente:del', id),
      fpsState: () => inv('fps:state'), fpsDownload: () => inv('fps:download'), fpsPermission: () => inv('fps:permiso'),
      fpsTest: ms => inv('fps:test', ms), fpsFolder: () => inv('fps:carpeta'),
      screenList: () => inv('pantalla:lista'), screenSet: (w, h, hz) => inv('pantalla:cambiar', w, h, hz),
      screenKeep: () => inv('pantalla:mantener'), screenRevert: () => inv('pantalla:revertir'),
      onScreenEnd: f => ipcRenderer.on('pantalla:fin', (_, d) => f(d)),
      buzzState: () => inv('buzz:state'), buzzRestart: () => inv('buzz:restart'), buzzInstall: () => inv('buzz:install'),
      bootDone: () => ipcRenderer.send('boot:done'),                 // el launcher terminó de arrancar: main.js activa entonces los mandos Buzz
      log: t => inv('gs:log', String(t)),                             // anotar algo en gameshell.log (qué mandos ve el launcher)
      updState: () => inv('upd:state'), updCheck: () => inv('upd:check'), updInstall: () => inv('upd:install'),   // «Buscar actualizaciones» (actualizar.js)
      updShown: () => inv('upd:shown'), updConfirm: () => inv('upd:confirm'), updRevert: () => inv('upd:revert'), updSeen: () => inv('upd:seen'),
      onUpdProgress: f => ipcRenderer.on('upd:progress', (_, d) => f(d))
    });
  }
} catch (e) { /* sin esto el launcher funciona igual: solo faltan las opciones nuevas que lo necesitan */ }
