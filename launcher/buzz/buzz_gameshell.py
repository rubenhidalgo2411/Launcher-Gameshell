# -*- coding: utf-8 -*-
"""
GameShell · BuzzActivar integrado.

Lo arranca el launcher (launcher/buzz.js) en segundo plano y lo para al cerrarse. Hace EXACTAMENTE lo mismo que BuzzActivar.py, que no se ha tocado
(se importa tal cual: busca el pincho, le manda el informe que lo despierta, enciende las luces y lo reenvía cada pocos segundos).
Este archivo solo añade lo que hace falta para vivir dentro de GameShell:

  - Avisa al launcher de lo que pasa con líneas que empiezan por «@»  (@RECEPTOR 1 / 0, @MANDO n, @AVISO …, @LISTO).
  - Se apaga solo cuando el launcher desaparece (se cierra o se cae) y cuando éste se lo pide (escribe «salir» por la entrada estándar);
    antes de salir apaga las luces de los mandos, como al cerrar BuzzActivar con Ctrl+C.
  - No se deja abrir dos veces a la vez.
  - No imprime cada pulsación de los mandos (en una partida serían cientos de líneas); con --crudo sí.

Opciones:  --padre PID  (el proceso del launcher; si desaparece, este programa se cierra)
           --pitido     (pitidos al detectar / perder el pincho; sin esto, silencio)
           --crudo      (además, los bytes en bruto y cada pulsación)
           --sin-luces  (no enciende las luces rojas)
Códigos de salida:  0 normal · 3 ya hay otra copia abierta · 4 falta la librería hidapi · 5 no se pudo cargar BuzzActivar.py
"""

import argparse
import os
import re
import signal
import sys
import threading
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

_candado = None      # el «mutex» de Windows: tiene que seguir referenciado mientras viva el programa


def aviso(texto):
    print("@" + texto, flush=True)


# ----------------------------------------------------------------------------- utilidades de proceso
def proceso_vivo(pid):
    """¿Sigue existiendo el proceso pid? En la duda (sin permiso para mirarlo), se dice que sí."""
    if pid <= 0:
        return True
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes
            k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            k32.OpenProcess.restype = wintypes.HANDLE
            k32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            k32.WaitForSingleObject.restype = wintypes.DWORD
            k32.CloseHandle.argtypes = [wintypes.HANDLE]
            h = k32.OpenProcess(0x00100000, False, pid)          # SYNCHRONIZE
            if not h:
                return ctypes.get_last_error() != 87             # 87 = no existe ese proceso
            try:
                return k32.WaitForSingleObject(h, 0) == 0x102    # WAIT_TIMEOUT = sigue en marcha
            finally:
                k32.CloseHandle(h)
        except Exception:
            return True
    try:
        os.kill(pid, 0)      # (en Linux/Mac esto solo comprueba; en Windows NO se usa: ahí mataría el proceso)
        return True
    except ProcessLookupError:
        return False
    except Exception:
        return True


def ser_unico():
    """True si es la única copia. Dos copias a la vez se pelearían por el pincho."""
    global _candado
    if sys.platform != "win32":
        return True
    try:
        import ctypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_wchar_p]
        k32.CreateMutexW.restype = ctypes.c_void_p
        _candado = k32.CreateMutexW(None, False, "Local\\GameShell.BuzzActivar")
        return ctypes.get_last_error() != 183                    # 183 = ya existía
    except Exception:
        return True


# ----------------------------------------------------------------------------- apagado ordenado
def parar():
    """Interrumpe el bucle principal: BuzzActivar apaga las luces de los mandos y sale. Si algo lo impidiera, a los 3 s se corta."""
    t = threading.Timer(3.0, lambda: os._exit(0))
    t.daemon = True
    t.start()
    try:
        import _thread
        _thread.interrupt_main()
    except Exception:
        os._exit(0)


def vigilar_padre(pid):
    while True:
        time.sleep(2.0)
        if not proceso_vivo(pid):
            parar()
            return


def escuchar_ordenes():
    """«salir» por la entrada estándar = apagar. Si la tubería se cierra (el launcher ya no está), también."""
    if sys.stdin is None:
        return                       # sin entrada estándar (p. ej. con pythonw): no hay nada que escuchar; el padre se sigue vigilando por su PID
    try:
        for linea in sys.stdin:
            if linea.strip().lower() == "salir":
                break
    except (OSError, ValueError):
        pass                         # tubería rota o cerrada = el launcher ya no está
    except Exception:
        return                       # cualquier otra cosa rara: no es motivo para apagarse
    parar()


# ----------------------------------------------------------------------------- avisos al launcher
def instalar_avisos(B, crudo):
    """Sustituye B.log: sigue imprimiendo lo de siempre (sin las pulsaciones, salvo --crudo) y además manda los avisos «@»."""
    original = B.log
    mando = re.compile(r"^Mando (\d+) detectado")

    def log(texto):
        t = str(texto)
        try:
            if t.startswith("Receptor detectado"):
                aviso("RECEPTOR 1")
            elif t.startswith("Receptor desconectado") or t.startswith("Esperando el receptor"):
                aviso("RECEPTOR 0")
            else:
                m = mando.match(t)
                if m:
                    aviso("MANDO " + m.group(1))
                elif t.startswith("[!]"):
                    aviso("AVISO " + t)
        except Exception:
            pass
        if crudo or not t.lstrip().startswith("Mando "):
            original(t)

    B.log = log


def main(argv=None):
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--padre", type=int, default=0)
    ap.add_argument("--pitido", action="store_true")
    ap.add_argument("--crudo", action="store_true")
    ap.add_argument("--sin-luces", action="store_true")
    a, _ = ap.parse_known_args(argv)

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    try:
        import BuzzActivar as B
    except Exception as e:
        aviso("ERR no se pudo cargar BuzzActivar.py: %s" % e)
        return 5
    if B.hid is None or not hasattr(B.hid, "device"):
        aviso("ERR hidapi")
        return 4
    if not ser_unico():
        aviso("OTRA")
        return 3

    B.SONIDO = bool(a.pitido)
    instalar_avisos(B, a.crudo)
    try:
        signal.signal(signal.SIGINT, signal.default_int_handler)  # que interrupt_main() produzca un KeyboardInterrupt
    except Exception:
        pass
    threading.Thread(target=escuchar_ordenes, daemon=True).start()
    if a.padre > 0:
        threading.Thread(target=vigilar_padre, args=(a.padre,), daemon=True).start()

    B.evitar_congelacion_de_consola()
    args = argparse.Namespace(lista=False, crudo=a.crudo, sin_luces=a.sin_luces, sin_sonido=not a.pitido, vid=None, pid=None)
    aviso("LISTO")
    try:
        B.bucle(args)
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
