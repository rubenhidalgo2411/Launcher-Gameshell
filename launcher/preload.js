const { contextBridge, ipcRenderer } = require('electron');
const call = c => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  games: call('games'), add: call('add'), remove: call('remove'), auto: call('auto'), launch: call('launch'),
  folderNew: call('folder:new'), moveTo: call('move:to'), order: call('order'),
  power: call('power'), desktop: call('desktop'),
  cfg: call('cfg'), bypass: call('bypass'), unbypass: call('unbypass'), locked: call('locked'), check: call('check'), setpw: call('setpw'), setmin: call('setmin'),
  hide: call('hide'), icon: call('icono'), iconOff: call('icono:quitar'), winkey: call('winkey'),
  ui: call('ui'), uiSet: call('ui:set'), fondos: call('fondos'), fondoAdd: call('fondo:add'), fondoClear: call('fondo:clear'), fondoDel: call('fondo:del'), sounds: call('sonidos'),
  soundData: call('sonido:datos'), soundOwn: call('sonido:propios'), soundImport: call('sonido:importar'), soundDrop: call('sonido:quitar'),
  rename: call('rename'), hero: call('cartel'), heroOff: call('cartel:quitar'), purge: call('purge'),
  webStats: call('web:stats'), webUpdate: call('web:update'), onWebCount: f => ipcRenderer.on('web:count', (_, d) => f(d)),
  padState: call('pad:state'), onPad: f => ipcRenderer.on('pad', (_, on) => f(!!on)),
  onHome: f => ipcRenderer.on('home', () => f())
});
