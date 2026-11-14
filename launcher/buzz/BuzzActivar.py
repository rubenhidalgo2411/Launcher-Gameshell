# -*- coding: utf-8 -*-
"""
BuzzActivar - Activa los mandos Buzz! inalámbricos (el "pincho" USB de PS2/PS3) en Windows.

POR QUÉ HACE FALTA
  Windows reconoce el pincho nada más enchufarlo, pero el pincho no empieza a "hablar" con los
  mandos hasta que el ordenador le manda un informe HID de salida (el de las luces). La PS2/PS3
  lo hace sola; en un PC hay que hacerlo a mano (por ejemplo con SimpleHIDWrite). Este programa
  lo automatiza.

QUÉ HACE
  1. Busca el pincho cada segundo: da igual si lo enchufas antes o después de abrir el programa.
  2. Cuando aparece, le envía el informe de activación y enciende las luces rojas de los mandos.
  3. Reenvía el informe cada pocos segundos para que los mandos se enlacen aunque los enciendas
     más tarde.
  4. Muestra qué botón pulsas en cada mando, para comprobar que todo llega al PC.
  5. Si desenchufas el pincho, lo detecta y vuelve a esperar.

USO
  py BuzzActivar.py                         modo normal
  py BuzzActivar.py --lista                 enseña todos los dispositivos HID (para depurar)
  py BuzzActivar.py --crudo                 además muestra los bytes en bruto de cada pulsación
  py BuzzActivar.py --sin-luces             no enciende las luces rojas
  py BuzzActivar.py --sin-sonido            sin pitidos
  py BuzzActivar.py --vid 054C --pid 1000   fuerza un dispositivo concreto
"""

import argparse
import sys
import time
from datetime import datetime

try:
    import hid          # paquete "hidapi" de PyPI
except ImportError:
    hid = None

try:
    import winsound     # solo existe en Windows
except ImportError:
    winsound = None

# VID:PID conocidos (Sony). Además se detecta cualquier HID cuyo nombre contenga "buzz":
# el receptor inalámbrico se anuncia como "...Wbuzz...".
IDS_CONOCIDOS = {
    (0x054C, 0x1000): "receptor inalámbrico Buzz!",
    (0x054C, 0x0002): "mandos Buzz! con cable",
}

# Los 4 mandos ocupan 5 bits cada uno (20 bits seguidos) a partir del byte 2 del informe.
# Este es el orden de los 5 bits dentro de cada mando.
COLORES = ("ROJO (buzzer)", "AMARILLO", "VERDE", "NARANJA", "AZUL")

INTERVALO_BUSQUEDA = 1.0       # segundos entre búsquedas del pincho
REFRESCO_CON_LUCES = 2.0       # segundos entre reenvíos del informe
REFRESCO_SIN_LUCES = 10.0
MAX_LECTURAS_POR_VUELTA = 64

SONIDO = True


# ----------------------------------------------------------------------------- utilidades
def log(texto):
    print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), texto), flush=True)


def evitar_congelacion_de_consola():
    """En la consola clásica de Windows, hacer clic dentro de la ventana (modo selección) congela
    el programa hasta pulsar Intro. Se desactiva esa 'edición rápida'."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        k32 = ctypes.windll.kernel32
        entrada = k32.GetStdHandle(-10)             # STD_INPUT_HANDLE
        modo = ctypes.c_uint32()
        if k32.GetConsoleMode(entrada, ctypes.byref(modo)):
            k32.SetConsoleMode(entrada, (modo.value & ~0x0040) | 0x0080)   # sin QUICK_EDIT
    except Exception:
        pass


def pitido(*notas):
    """notas = pares (frecuencia_Hz, duracion_ms). Solo suena en Windows."""
    if not SONIDO or winsound is None:
        return
    try:
        for frecuencia, duracion in notas:
            winsound.Beep(frecuencia, duracion)
    except Exception:
        pass


def es_buzz(info, vid=None, pid=None):
    """¿Es este dispositivo HID un receptor/mando Buzz?"""
    if vid is not None and pid is not None:
        return info["vendor_id"] == vid and info["product_id"] == pid
    nombre = (info.get("product_string") or "").lower()
    return (info["vendor_id"], info["product_id"]) in IDS_CONOCIDOS or "buzz" in nombre


def buscar(vid=None, pid=None):
    """Lista de dispositivos Buzz conectados, o None si Windows no pudo enumerar."""
    try:
        return [d for d in hid.enumerate() if es_buzz(d, vid, pid)]
    except Exception:
        return None


def trama_luces(encendidas):
    """
    Informe de salida de los Buzz: ID de informe (0) + [0x00, LED1, LED2, LED3, LED4, 0x00, 0x00].
    Se envían solo los 6 primeros bytes; hidapi rellena con ceros hasta el tamaño real del informe.
    """
    return [0x00, 0x00] + [0xFF if e else 0x00 for e in encendidas]


def escribir(dev, trama):
    """Envía un informe de salida. Devuelve True si Windows lo aceptó."""
    try:
        n = dev.write(bytes(trama))
    except Exception:
        return False
    return n is None or n >= 0


def decodificar(informe):
    """
    Informe de entrada -> lista de 4 números (uno por mando); el bit 0 de cada uno es el
    botón rojo, y los bits 1..4 son amarillo, verde, naranja y azul. None si no es válido.
    """
    datos = list(informe)
    if len(datos) < 5:
        return None
    bits = datos[2] | (datos[3] << 8) | (datos[4] << 16)
    return [(bits >> (5 * j)) & 0x1F for j in range(4)]


# ----------------------------------------------------------------------------- receptor
class Receptor:
    def __init__(self, info, con_luces, crudo):
        self.info = info
        self.path = info["path"]
        self.con_luces = con_luces
        self.crudo = crudo
        self.dev = None
        self.botones = [0, 0, 0, 0]
        self.vistos = set()
        self.proximo_refresco = 0.0
        self.avisado_escritura = False

    @property
    def nombre(self):
        i = self.info
        texto = i.get("product_string") or "dispositivo sin nombre"
        return "%s (%04X:%04X)" % (texto, i["vendor_id"], i["product_id"])

    def abrir(self):
        dev = hid.device()
        dev.open_path(self.path)
        dev.set_nonblocking(1)
        self.dev = dev

    def cerrar(self, apagar_luces=False):
        if self.dev is None:
            return
        if apagar_luces:
            self.enviar([False] * 4)
        try:
            self.dev.close()
        except Exception:
            pass
        self.dev = None

    def enviar(self, encendidas):
        # Si el informe de 6 bytes no cuela, se prueba con un solo byte a cero.
        return escribir(self.dev, trama_luces(encendidas)) or escribir(self.dev, [0x00])

    def activar(self):
        """Informe 'todo a cero' (despierta al receptor) y después las luces."""
        ok = self.enviar([False] * 4)
        time.sleep(0.4)
        ok = self.enviar([self.con_luces] * 4) or ok
        self.proximo_refresco = time.monotonic() + self._intervalo()
        return ok

    def _intervalo(self):
        return REFRESCO_CON_LUCES if self.con_luces else REFRESCO_SIN_LUCES

    def procesar(self, ahora):
        """Lee lo pendiente y reenvía el informe cada cierto tiempo. Lanza OSError si se desenchufa."""
        for _ in range(MAX_LECTURAS_POR_VUELTA):
            datos = self.dev.read(64)
            if not datos:
                break
            self._informe(datos)
        if ahora >= self.proximo_refresco:
            if not self.enviar([self.con_luces] * 4) and not self.avisado_escritura:
                self.avisado_escritura = True
                log("[!] Windows no acepta el informe de salida de este dispositivo.")
            self.proximo_refresco = ahora + self._intervalo()

    def _informe(self, datos):
        if self.crudo:
            log("bytes: " + " ".join("%02X" % b for b in datos))
        mascaras = decodificar(datos)
        if mascaras is None:
            return
        for j, mascara in enumerate(mascaras):
            nuevos = mascara & ~self.botones[j]
            if not nuevos:
                continue
            if j not in self.vistos:
                self.vistos.add(j)
                log("Mando %d detectado" % (j + 1))
            for b, color in enumerate(COLORES):
                if nuevos & (1 << b):
                    log("   Mando %d: %s" % (j + 1, color))
        self.botones = mascaras


# ----------------------------------------------------------------------------- programa
def listar():
    try:
        dispositivos = hid.enumerate()
    except Exception as e:
        print("No pude listar los dispositivos HID: %s" % e)
        return
    if not dispositivos:
        print("Windows no muestra ningún dispositivo HID.")
        return
    print("VID:PID   Nombre")
    for d in sorted(dispositivos, key=lambda x: (x["vendor_id"], x["product_id"])):
        marca = "    <== Buzz" if es_buzz(d) else ""
        print("%04X:%04X  %s | %s%s" % (d["vendor_id"], d["product_id"],
                                         d.get("manufacturer_string") or "?",
                                         d.get("product_string") or "?", marca))


def bucle(args):
    con_luces = not args.sin_luces
    activos = {}          # ruta -> Receptor
    fallidos = set()      # rutas que no se pudieron abrir (para avisar solo una vez)
    proxima_busqueda = 0.0
    esperando_avisado = False
    try:
        while True:
            ahora = time.monotonic()

            if ahora >= proxima_busqueda:
                proxima_busqueda = ahora + INTERVALO_BUSQUEDA
                lista = buscar(args.vid, args.pid)
                if lista is not None:
                    encontrados = {d["path"]: d for d in lista}

                    # Receptores nuevos
                    for ruta, info in encontrados.items():
                        if ruta in activos or ruta in fallidos:
                            continue
                        r = Receptor(info, con_luces, args.crudo)
                        try:
                            r.abrir()
                        except Exception as e:
                            fallidos.add(ruta)
                            log("[!] Veo %s pero no puedo abrirlo (%s). ¿Lo usa otro programa?"
                                % (r.nombre, e))
                            continue
                        activos[ruta] = r
                        log("Receptor detectado: %s" % r.nombre)
                        pitido((1000, 120), (1400, 120))
                        if r.activar():
                            log("Activado. Enciende los mandos; si no se enlazan, mantén pulsado "
                                "el botón Bind del pincho.")
                        else:
                            log("[!] No pude enviar el informe de activación (¿otro programa "
                                "tiene el receptor abierto?).")

                    # Receptores que ya no están
                    for ruta in list(activos):
                        if ruta not in encontrados:
                            activos.pop(ruta).cerrar()
                            log("Receptor desconectado.")
                            pitido((700, 200))
                    fallidos &= set(encontrados)

                    if activos or fallidos:
                        esperando_avisado = False
                    elif not esperando_avisado:
                        log("Esperando el receptor Buzz... enchúfalo cuando quieras.")
                        esperando_avisado = True

            for ruta, r in list(activos.items()):
                try:
                    r.procesar(ahora)
                except Exception:
                    activos.pop(ruta).cerrar()
                    log("Receptor desconectado (error de lectura).")
                    pitido((700, 200))

            time.sleep(0.01 if activos else 0.2)
    finally:
        for r in activos.values():
            r.cerrar(apagar_luces=True)


def leer_argumentos():
    def hexa(texto):
        return int(texto, 16)

    p = argparse.ArgumentParser(
        description="Activa los mandos Buzz! inalámbricos (pincho USB de PS2/PS3) en Windows.")
    p.add_argument("--lista", action="store_true", help="muestra todos los dispositivos HID y sale")
    p.add_argument("--crudo", action="store_true", help="muestra los bytes en bruto de cada informe")
    p.add_argument("--sin-luces", action="store_true", help="no enciende las luces rojas")
    p.add_argument("--sin-sonido", action="store_true", help="sin pitidos")
    p.add_argument("--vid", type=hexa, help="VID en hexadecimal (ej. 054C)")
    p.add_argument("--pid", type=hexa, help="PID en hexadecimal (ej. 1000)")
    args = p.parse_args()
    if (args.vid is None) != (args.pid is None):
        p.error("--vid y --pid hay que indicarlos juntos")
    return args


def main():
    global SONIDO
    try:
        sys.stdout.reconfigure(errors="replace")
    except Exception:
        pass
    args = leer_argumentos()
    SONIDO = not args.sin_sonido

    if hid is None or not hasattr(hid, "device"):
        print("Falta la librería 'hidapi'. Ejecuta 1_Instalar.bat")
        print("(o escribe:  py -m pip install hidapi). Si ya la tienes y sigue fallando,")
        print("puede que tengas instalado otro paquete llamado 'hid':  py -m pip uninstall hid")
        return 1

    if args.lista:
        listar()
        return 0

    evitar_congelacion_de_consola()
    log("BuzzActivar en marcha. Cierra esta ventana o pulsa Ctrl+C para salir.")
    try:
        bucle(args)
    except KeyboardInterrupt:
        log("Hasta luego.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
