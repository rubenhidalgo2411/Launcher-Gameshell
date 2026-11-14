# GameShell — launcher único

Un solo launcher (carpeta `launcher/`) que reúne **todo** lo de `actualizado` (la base) y de `actualizacion`, más lo nuevo de la 2.1: la **intro de arranque de la PS2**, **5 estilos y 8 fondos nuevos**, **volumen de los sonidos**, **eliminar/restaurar** estilos, fondos e intros desde el propio launcher y la opción de **exigir el mando** en la pantalla del botón PS (que ahora se llama **Precarga Post Intro**).
Ya no hay dos launchers que cambiar con W×4: todo se elige en **Opciones → Apariencia**.

## Novedades de esta actualización

| Qué | Dónde / cómo |
|---|---|
| **Los Buzz! ya no mandan en el launcher** | Con el pincho de los Buzz! enchufado, Windows lo cuenta como un mando más y el launcher cogía «el primer mando que hubiera»: ese era el Buzz y **tu mando dejaba de ir**. Ahora los Buzz se **ignoran del todo en el launcher** (se reconocen por el nombre o por su VID:PID de Sony, 054C:1000 y 054C:0002): manda siempre tu mando. Dentro de los juegos no cambia nada. |
| **BuzzActivar integrado** | El BuzzActivar de siempre (`launcher/buzz/BuzzActivar.py`, **sin tocar**) se arranca **solo, en segundo plano y sin ventana** cuando el launcher ya ha terminado de arrancar, y se para al cerrarlo; ya no hay que abrirlo aparte. **Opciones → Mandos Buzz**: activar, estado, pitido, reiniciar, instalar hidapi. Ver *Mandos Buzz!*. |
| **Añadir scripts, no solo .exe** | **Añadir juego** admite `.exe`, `.bat`, `.cmd`, `.ps1`, `.py`, `.pyw`, `.vbs`, `.jar`, accesos directos (`.lnk`, `.url`) y cualquier otro archivo (se abre como con doble clic). Ver *Añadir programas y scripts*. |
| **FPS: permiso de Windows más fiable** | Fallaba con «Windows no dejó añadirte al grupo». Ahora prueba **tres caminos** (`net localgroup` con el nombre del grupo sacado de su SID —en español es «Usuarios del registro de rendimiento»—, los comandos de PowerShell por SID, y ADSI) y deja un **informe con el motivo exacto** en `gameshell.log` si ninguno funciona. La fila avisa de «añadido · falta cerrar sesión». |
| **FPS: tamaños 50 % y 75 %** | **Tamaño** va de 50 % a 300 %: 50 · 75 · 100 · 125 · 150 · 200 · 250 · 300 (`←/→`; desde 100 %, `←` baja a 75 % y 50 %), y la ayuda del menú los enseña todos. Con 50 % y 75 % solo se encoge el número: la ventana transparente que lo lleva ya no se hace más pequeña que la de 100 %, por si Windows la recortara. |
| **Tipo de letra independiente del estilo** | **Apariencia → Tipo de letra**: la letra se elige aparte y vale con cualquier estilo (*La del estilo* = como siempre). Hay **6 de Windows** (Segoe UI, Bahnschrift, Consolas, Georgia, Impact, Trebuchet MS), **18 incluidas** (en `assets/fuentes`; licencias en `LICENCIAS.txt`) y las que **añadas tú** con *＋ Añadir tipo de letra…* (`.ttf`, `.otf`, `.woff`, `.woff2`: se copian a `%APPDATA%\gameshell\fuentes`). Cada tarjeta se ve con su propia letra y se puede **eliminar y restaurar** como los estilos y los fondos (la que importaste se borra de verdad; tu archivo original no se toca). |
| **Ampliación tipo Dock de macOS** (opcional) | **Apariencia → Ampliación al pasar el ratón**: *No* (por defecto) · *Suave* · *Media* · *Fuerte*. Al mover el ratón por la fila, los iconos cercanos crecen y los vecinos se apartan sin pisarse; crecen hacia arriba para no tapar el nombre. Con un menú, el selector inferior o una intro delante se retira sola. |
| **Brasas: color** | **Apariencia → Brasas · color** (sale con el estilo *o* el fondo Brasas): Fuego (el de siempre), Carmesí, Oro, Lima, Esmeralda, Turquesa, Hielo, Azul, Violeta, Magenta, Rosa y Plata. Cambia las chispas, el resplandor, el marco del icono y los textos. |
| **Brasas: altura de los iconos** | **Apariencia → Brasas · altura de los iconos** (solo con el *estilo* Brasas): de −30 % a +30 % del alto de la pantalla, de 5 en 5. Mueve juntos los iconos, el nombre y la frase. |
| **Intro para jugar, a tu gusto** | **Apariencia → Intro para jugar**: *Mismo del estilo* · *Texto «Intro para jugar»* · *Botón «Jugar»* (el de «···» del PS5) · *Pastilla blanca ▶* (la del PS5 de actualización) · *Nada*. Vale con cualquier estilo (se coloca bajo el nombre). |
| **Barras: «Nada» y eliminar** | En **Barra inferior** y **Barra superior** hay una tarjeta **Nada** (no se ve ninguna barra) y todas las barras se pueden **eliminar y restaurar** igual que los estilos (*Mismo del estilo* y *Nada* no). |
| **Probar todos los sonidos** | **Sonidos de los menús**: `□` / `T` oye el timbre marcado entero (los **6 sonidos**: mover, elegir, volver, abrir, tecla y error), `←/→` los oye **de uno en uno** y el **▶** de cada fila lo hace con el ratón. **Sonido de la intro**: `□` / `T` / **▶** la oyen entera sin elegirla. Probar nunca cambia lo elegido; `Intro/✕` elige. |
| **Contador de FPS** | **Opciones → Contador de FPS**: un número **arriba a la derecha dentro de los juegos**, con **tamaño** a elegir (50 % – 300 %) y la opción *Mostrar en los juegos* para que **se encienda solo** con cada juego, sin darle a nada. `Ctrl+Mayús+F` lo oculta / muestra (y lo arranca si no estaba). Ver su sección. |
| **Resolución de pantalla** | **Opciones → Resolución de pantalla**: eliges resolución y frecuencia entre las que admite tu pantalla y *Aplicar*, sin salir a Windows. Pregunta «¿Mantener esta resolución?» y, si no confirmas en 15 s, **vuelve sola** a la anterior. |
| **Teclado sin «retroceso»** | Al pulsar dos veces seguidas →/← deprisa ya no se ve el parpadeo hacia atrás: el fondo grande / cartel de los estilos PS5 cambia por capas que se funden y, si la selección sigue moviéndose, espera a que se asiente. |
| **Quitado** | La opción **Tecla Windows** (Opciones) y el aviso **▲ / ▼ «hay más filas»** del título de los menús largos. |

## Novedades de la 2.1

| Qué | Dónde / cómo |
|---|---|
| **Sin parpadeos al arrancar** | Entre Windows y la intro solo se ve **negro**, y la **Precarga Post Intro** se pone *debajo* de la intro: al desvanecerse esta sale directamente ella, ya no se ve el menú del launcher en medio. |
| **Fondos animados de cualquier estilo** | **Apariencia → Fondo**: ahora, además de tus fotos, están los **19 fondos animados** de todos los estilos. Así puedes tener, por ejemplo, la colocación de **Cosmos** con el fondo de **Brasas**. *Del estilo* sigue siendo cada estilo con su fondo de siempre. |
| **Cosmos sin planeta** | Fondo nuevo, el mismo de Cosmos pero sin el planeta de abajo a la derecha (el original sigue estando). |
| **Tamaño de iconos** | **Apariencia → Tamaño de iconos** (50 % – 160 %). Se ve en directo mientras deslizas; cada estilo crece desde el lado que toca al título para que nunca se pisen. |
| **Texto de arriba a la izquierda** | **Apariencia → Texto de arriba a la izquierda**: cambia «Juegos» (y «Web», en la barra PS5) por otra palabra o déjalo vacío. |
| **Foto de la derecha (PS5)** | En **Opciones de un juego → Foto de la derecha (estilos PS5)…**: la foto grande que sale a la derecha en los estilos PS5 puede ser otra distinta al logo del .exe (y *Quitar la foto de la derecha* devuelve la del .exe). |
| **Renombrar los .exe** | **Opciones de un juego → Cambiar nombre…** (el archivo no se toca). *Volver al nombre original* lo deshace. |
| **Clic derecho = Opciones** | Clic derecho con el ratón sobre un icono = `Supr` / `START` (sus opciones). |
| **Botón Share del mando** | Abre **Apariencia** directamente (en el DualSense es el botón *Create*; en un mando de Xbox, *View*). Desde el navegador también. |
| **Intro: □ prueba, ✕ elige** | En **Apariencia → Intro**: `□` (o `T`) **prueba** la intro marcada sin elegirla; `Intro/✕` solo la **elige** (ya no la lanza). Lo mismo en la lista de fotos de la intro. |
| **Precarga Post Intro** | Es lo que antes se llamaba «Pantalla del botón PS» (ver su sección). Ahora puedes **elegir otra foto** y **pasa sola al encender el mando**. |
| **Eliminar definitivamente** | En **Restaurar lo eliminado**: `Supr` / `△` sobre un elemento (o *Eliminar todo definitivamente*) lo borra del todo. |
| **Modo Juego a prueba de atajos** | Con contraseña puesta, **Modo Juego** (y abrir un juego) cierra el escritorio de Windows que hubiera quedado abierto, y si al minimizar un juego se asoma el escritorio, el launcher vuelve al frente al instante. |
| **Navegador** | Teclado en pantalla, bloqueador de anuncios, YouTube sin anuncios, SponsorBlock y avisos de cookies (ver su sección). |

## Instalar o actualizar

1. Descomprime esta carpeta donde quieras (puede ser encima de la anterior).
2. Ejecuta **`instalar-shell.bat`** (también si ya lo tenías instalado: cambia el arranque a este launcher único).
3. Cierra sesión y vuelve a entrar.

Tus juegos, contraseña, logos, fotos importadas y ajustes se conservan (están en `%APPDATA%\gameshell`).
Si venías de `actualizacion`, sus ajustes (estilo, intro, fondo, sonido, volumen, nombre) se aprovechan la primera vez.
Para volver al escritorio normal: `quitar-shell.bat`. Autologin: `autologin-activar.bat` / `autologin-quitar.bat` (sin cambios).

## Dónde está cada cosa

**Opciones** = `Supr` (teclado), `START` o `△` (mando), el icono ⚙ o `···`, o **clic derecho** sobre un icono (abre las de ese programa).

| Menú | Qué hay |
|---|---|
| **Opciones → Apariencia** (o el botón **Share** del mando) | Estilo · Fondo · Añadir foto de fondo… · Barra inferior · Barra superior · **Tipo de letra** · **Intro para jugar** · **Tamaño de iconos** · **Ampliación al pasar el ratón** · **Brasas · color / altura** (solo con Brasas) · **Texto de arriba a la izquierda** · Intro · **Precarga Post Intro** (con *Exigir el mando*) · Sonidos · **Restaurar lo eliminado** (solo sale si has eliminado algo) |
| **Opciones** | **Navegador** · **Resolución de pantalla** · **Contador de FPS** · **Mandos Buzz** · **Modo Juego** · (lo de cada juego: abrir al iniciar, **cambiar nombre**, cambiar logo, **foto de la derecha (PS5)**, quitar…) |
| **Esc / ○ → Sistema** | Suspender · Reiniciar · Apagar · Cerrar sesión · Escritorio de Windows · Ajustes del launcher (contraseña, nombre) |

### Listas largas (intros, fotos…)
Las listas se **compactan solas** para que quepan enteras en pantalla (también en portátiles de 1366×768). Si aun así alguna no cabe, se desplaza con las flechas (la fila marcada siempre se ve). Para moverte rápido: `Inicio` / `Fin` (primera / última fila), `RePág` / `AvPág` (de 5 en 5; en el mando, `L1` / `R1`) o la rueda del ratón. Si cambias de intro y quieres volver a la de la PS2: **Apariencia → Intro → «PS2 · Arranque»** es la primera fila (`Inicio` te lleva).

### Estilo, Fondo y barras: el selector inferior
Al entrar en **Estilo**, **Fondo**, **Barra inferior**, **Barra superior**, **Tipo de letra**, **Intro para jugar**, **Tamaño de iconos**, **Ampliación** (y, con Brasas, **Brasas · color** y **Brasas · altura**) el menú baja a una bandeja pegada abajo y **lo de arriba se ve casi entero mientras deslizas**:
`←/→` desliza (se ve en directo) · `Intro/✕` elige · `Esc/○` cancela (vuelve a como estaba) · `↑/↓` (o `L1/R1`) cambia de apartado sin salir.
**Estilo** es la *colocación* (dónde van los iconos, el título, las barras…) y **Fondo** es lo que se ve *detrás*: son cosas independientes. En **Fondo** están primero *Del estilo* y los **19 fondos animados** (cada tarjeta con su miniatura; la etiqueta dice de qué estilo viene) y luego tus fotos. Se pueden eliminar y restaurar igual que las fotos.
En **Fondo**, al final está **＋ Añadir foto de fondo…** (elige una o varias fotos de tu PC; se copian tal cual, sin perder calidad) y **Quitar mis fotos importadas**.
`Supr` / `△` / `START` (o clic derecho) sobre una tarjeta de **Estilo**, **Fondo**, **Barra** o **Tipo de letra** la **elimina** (ver abajo). `Inicio` / `Fin` / `RePág` / `AvPág` saltan por las tarjetas.

### Eliminar y restaurar estilos, fondos, barras, letras e intros
- En el selector inferior (**Estilo**, **Fondo**, **Barra inferior**, **Barra superior** y **Tipo de letra**) pulsa `Supr`, `△` o `START` sobre una tarjeta (o clic derecho). En **Apariencia → Intro** (y en la lista de fotos de la intro «Foto») lo mismo sobre la fila.
- Siempre **pregunta antes** y el cursor empieza en *Cancelar*.
- Lo que **trae el launcher** (estilos, intros y fondos incluidos) **no se borra del disco**: se oculta de las listas y se recupera en **Apariencia → Restaurar lo eliminado** (uno a uno o *Restaurar todo*). Así no hay accidentes sin vuelta atrás.
- Las **fotos que importaste tú** sí se **borran de verdad** (solo la copia que guarda el launcher en `%APPDATA%\gameshell\fondos`; tu archivo original no se toca).
- **Eliminar definitivamente**: en **Restaurar lo eliminado**, `Supr` / `△` / `START` sobre un elemento lo **borra del todo** (también pregunta antes) y ya no sale en ningún sitio; *Eliminar todo definitivamente* lo hace con toda la lista. Las fotos de Fondo se borran del disco; de un estilo se borran sus imágenes de muestra; y como el estilo, el fondo animado o la intro en sí viven en el código, quedan anotados como eliminados para siempre. **No se puede deshacer.**
- Si eliminas lo que estaba en uso, pasa solo al de al lado. Siempre queda al menos un estilo; *Sin intro*, *Mismo del estilo* y *Nada* no se pueden eliminar. Las **letras que importaste** se borran de verdad (la copia de `%APPDATA%\gameshell\fuentes`); las de Windows y las incluidas se ocultan y se restauran. Los tamaños de iconos, la ampliación, el color y la altura de Brasas y *Intro para jugar* no se eliminan: se cambian.

### Sonidos
- **Sonidos de los menús**: *Mismo del estilo* (como funcionaba) o el timbre de cualquier otro: Clásico, PS5, PS3, PS2, Neón, Aurora, Synthwave y los nuevos PS4, Cyberpunk, Cosmos, Brasas y Sakura. Al recorrer la lista suena cada uno; `□` / `T` los oye **todos** (mover, elegir, volver, abrir, tecla, error), `←/→` de uno en uno y **▶** con el ratón.
- **Sonido de la intro**: *La de cada intro* o cualquiera de los 9 (5 sintetizados de `actualizado` + 3 archivos `.wav` de `actualizacion` + el nuevo de **PS2 · Arranque**).
- **Volumen de los menús** y **Volumen de la intro**: dos reguladores independientes de 0 % a 100 %. `←/→` cambian de 5 en 5 y se oye al momento (los menús suenan con su sonido; la intro, con dos campanitas por el mismo camino que la intro); `Intro/✕` sube de 10 en 10; con el ratón, clic en la barra. **El 60 % es exactamente el nivel de siempre**; 100 % son unos +9 dB y 0 % es silencio. Se guardan al instante.
- Activar sonidos de menú · Activar sonido de la intro · Probar la intro. En la lista de **Sonido de la intro**, `□` / `T` / **▶** oyen el sonido entero sin elegirlo e `Intro/✕` lo elige.
- Puedes sustituir un wav poniendo `ps2`, `ps3`, `ps5` o `ps2boot` (`.wav/.mp3/.ogg`) en `%APPDATA%\gameshell\sonidos`, o desde **Sonido de la intro → Cambiar el sonido de «PS2 · Arranque»…** (elige el archivo y listo; *Volver al sonido incluido* lo deshace).

### Precarga Post Intro
Es la pantalla que sale **justo después de la intro** y espera a que se encienda el mando; en cuanto se conecta pasa al launcher. Se prepara *debajo* de la intro, así que al desvanecerse esta aparece directamente (sin enseñar el menú del launcher).
- **Pasa sola al encender el mando.** Windows ve el mando en cuanto se conecta (el navegador del launcher no lo ve hasta que se pulsa un botón); un pequeño vigía de Windows (`launcher/vigia.ps1`, PowerShell) se lo avisa al launcher: «✓ Mando conectado» y sigue, sin pulsar otra tecla. Si el mando ya estaba encendido no espera.
- Sigue valiendo cualquier tecla, clic o botón para saltarla (salvo con *Exigir el mando*).
- **Apariencia → Precarga Post Intro**: *Activada* · **Foto** (cualquiera de las de Fondo o una tuya con *Importar foto…*; por defecto *PS5 Bienvenida*, con el texto «Welcome back to PlayStation · Press the PS button…» ya escrito) · *Exigir el mando* · *Probar*. En la lista de fotos `Intro/✕` elige y `□` / `T` la ve sin elegirla. Con otra foto, debajo se avisa de qué hacer.
- **Exigir el mando** (apagado por defecto): con «Sí», la pantalla **no se salta con teclado ni ratón**; solo avanza cuando el mando responde. Activarlo también activa la pantalla. La vista previa nunca exige el mando.
- **Salida de emergencia** (por si el mando falla, se agota o no lo tienes a mano): `Esc` **ocho veces seguidas**. Recuerda que como shell de Windows siempre te queda `Ctrl+Mayús+Esc` (Administrador de tareas).
- Si el vigía no pudiera arrancar (PowerShell bloqueado, por ejemplo), todo sigue como antes: pulsa un botón del mando para que lo vea. En `gameshell.log` aparece «mando encendido / apagado» cuando funciona.

### Intro «PS2 · Arranque» (nueva, la que se estrena)
Recreación del arranque de la PlayStation 2: barras translúcidas en 3D que salen de la oscuridad alrededor de un resplandor azul, puntitos de luz de colores y el texto **«Sony Computer Entertainment»** en el centro (se puede cambiar en **Intro → Texto de «PS2 · Arranque»**, p. ej. por tu nombre). Dura unos 8 s; cualquier tecla la salta.
Es la intro por defecto: **la primera vez que abras esta versión se pone sola** (luego cambias a la que quieras en Apariencia → Intro).
**Sobre el sonido:** el sonido original de Sony es suyo y no se puede incluir, así que `assets/sonidos/ps2boot.wav` es una **recreación original** sintetizada (zumbido grave que crece, destellos de cristal cada vez más seguidos, soplido y golpe grave a los 4,6 s —justo cuando la imagen destella—, acorde abierto con reverb larga). Si tienes el audio original (p. ej. grabado de tu consola), cámbialo con **Sonido de la intro → Cambiar el sonido de «PS2 · Arranque»…**: dura lo que dure la intro; la imagen y el golpe están pensados para un sonido de ~8–9 s.

### Modo Juego y modos secretos
`R`×8 (modo sin contraseña) y `P`×8 (muestra apps ocultas) funcionan como antes. **Modo Juego** corta **los dos** a la vez, como si no hubieras puesto ninguno, hasta que los vuelvas a poner. El aviso es siempre el mismo («Modo Juego activado»), se hubiera cortado algo o no.
**El escritorio de Windows no se queda abierto.** Cuando hay contraseña puesta, **Modo Juego** cierra el escritorio de Windows (`explorer.exe`) que hubieras abierto en la sesión (p. ej. con el modo sin contraseña) y **corta también el plazo de «volver a pedirla»**; lo mismo se hace al abrir cualquier juego con el launcher bloqueado. Además, si con un juego abierto y el launcher bloqueado se asoma el escritorio (al minimizar el juego, con el menú Inicio, una ventana del Explorador…), el launcher **vuelve al frente al instante**. Solo se hace si el launcher es la **shell** de Windows (instalado con `instalar-shell.bat`); abierto de forma normal (`npm start`) nunca se toca el escritorio. Si tenías una copia de archivos en el Explorador, se interrumpe al activar el Modo Juego.

### Navegador: teclado, anuncios, YouTube y SponsorBlock
**Opciones → Navegador** (o el escudo de la barra del navegador, o `□` con el mando dentro del navegador) tiene un interruptor para cada cosa; los cambios valen para las páginas que abras a partir de entonces (`↻` recarga la actual).
- **Teclado en pantalla**: al tocar un campo de texto, buscador o contraseña de cualquier web sale el mismo teclado de las contraseñas del launcher (la contraseña se ve oculta, con el ojo para verla). Al aceptar rellena el campo; en un buscador o una contraseña, además lo envía como un `Intro` («Buscar» / «Entrar»); en un campo normal (usuario, correo…) solo lo rellena. Con el teclado físico también se puede: escribes y `Intro` acepta, `Esc` cancela. No sale con `Tab` ni con campos que la página enfoca sola.
- **Bloquear anuncios y rastreadores** (lo que hacen uBlock Origin / AdBlock): el navegador de Electron no admite bien las extensiones de Chrome, así que el bloqueo va integrado. Entiende las listas de uBlock/AdBlock Plus: lleva una incorporada y **baja sola** EasyList, EasyPrivacy, uBlock filters y la lista de Peter Lowe (y las de avisos de cookies), que renueva cada 5 días; sin internet usa lo que tenga. **Actualizar las listas ahora** fuerza la descarga. El escudo de la barra cuenta lo bloqueado en la página.
- **YouTube sin anuncios**: salta o acelera los anuncios del vídeo y cierra los banners.
- **SponsorBlock**: salta las partes de patrocinio, autopromoción y «suscríbete» de los vídeos de YouTube (datos de `sponsor.ajay.app`; solo se envía el principio del hash del vídeo, como hace la extensión, para que el servidor no sepa cuál ves). Avisa en pantalla de lo que ha saltado.
- **Ocultar avisos de cookies**: oculta los carteles más comunes.
Limitaciones sinceras: no son las extensiones originales, sino un motor propio compatible con sus listas; no entiende los filtros más avanzados de uBlock (scripts, `:has-text`…). YouTube cambia a menudo sus defensas contra los bloqueadores: si algún día se cuela un anuncio, hay que ajustarlo.

### Tipos de letra
- **Apariencia → Tipo de letra** (o el apartado *Tipo de letra* del selector inferior). *La del estilo* deja la de cada estilo (todos usan Segoe UI salvo Cyberpunk, que usa Bahnschrift); cualquier otra se aplica a **todo el launcher** (menús, nombres, barras) con el estilo que tengas. Se ve en directo al deslizar y `Esc/○` cancela.
- **＋ Añadir tipo de letra…** (última tarjeta): eliges uno o varios archivos `.ttf`, `.otf`, `.woff` o `.woff2`; se copian a `%APPDATA%\gameshell\fuentes` (puedes dejar ahí los archivos a mano). Si una letra no trae acentos o la «ñ», saldrán con la de reserva (Segoe UI).
- Eliminar / restaurar: como con los estilos (`Supr` / `△` / `START`). Las 18 incluidas (solo alfabeto latino, con acentos y «ñ») están en `launcher/assets/fuentes` con sus licencias (`LICENCIAS.txt`: todas con la licencia libre SIL OFL 1.1).

### Ampliación tipo Dock (opcional)
**Apariencia → Ampliación al pasar el ratón**: *No · Suave · Media · Fuerte* (el icono bajo el puntero llega a ×1,22 · ×1,42 · ×1,68). Es una curva continua: el icono más cercano al puntero es el más grande, los de al lado un poco menos, y la fila se abre alrededor del puntero sin que nada se pise ni salte; la suavidad no depende de los fps. Se retira sola cuando el puntero sale de la fila o de la ventana, y mientras haya un menú, el teclado en pantalla, una intro o el selector inferior abierto (salvo en el propio apartado *Ampliación*, para que la pruebes ahí).

### Brasas: color y altura
- **Brasas · color**: 12 colores (el original se llama *Fuego*). Vale con el **estilo** Brasas y con el **fondo** Brasas puesto en cualquier otro estilo (cambia las chispas del fondo y, en el estilo, también el marco, el resplandor y los textos).
- **Brasas · altura de los iconos**: de −30 % a +30 % de la altura de la pantalla (arriba = positivo). Solo con el **estilo** Brasas, que es el que coloca los iconos; los demás estilos tienen su sitio fijo (para moverlos todos hay **Tamaño de iconos**).

### Intro para jugar
Es lo que se ve bajo el nombre del programa elegido: la frase «Intro para jugar», el botón «Jugar» del PS5, la pastilla blanca ▶ del PS5 de actualización, o nada (PS3 y PS4). Antes estaba atado al estilo; ahora **Apariencia → Intro para jugar** deja poner cualquiera con cualquier estilo (*Mismo del estilo* = como siempre). Con el estilo que no lo trae de fábrica se dibuja bajo el nombre.

### Contador de FPS
**Opciones → Contador de FPS.** Solo hace una cosa: poner **arriba a la derecha, dentro de los juegos**, cuántos FPS tiene el juego.
- **Mostrar en los juegos**: con «Sí» se **enciende solo** al abrir un juego desde GameShell, sin darle a nada. **Tamaño**: 50 · 75 · 100 · 125 · 150 · 200 · 250 · 300 % con `←/→` (al cambiarlo se ve un ejemplo «144»). **Probar**: lo enseña 4 s.
- **Ctrl+Mayús+F** (dentro del juego): oculta / muestra el número; si estaba apagado, lo arranca solo para esa partida.
- **Cómo mide**: con **PresentMon** (Intel, licencia MIT), que lee los eventos de «fotograma presentado» que Windows ya genera; no se mete dentro del juego (por eso no da problemas con antitrampas) y sirve para DirectX, OpenGL y Vulkan. **No viene incluido**: en **Contador de FPS → Medidor (PresentMon)** se **descarga** (necesita internet; baja el `PresentMon-*-x64.exe` oficial de GitHub a `%APPDATA%\gameshell\bin`). También puedes dejar tú el `.exe` en `launcher\bin` o en esa carpeta.
- **Permiso de Windows** (una sola vez): Windows solo deja leer esos eventos a administradores o al grupo «Usuarios del registro de rendimiento» (*Performance Log Users*). **Contador de FPS → Permiso de Windows** te mete en ese grupo: Windows pide confirmar como administrador (la ventana del **Sí / No**) y después hay que **cerrar sesión o reiniciar** para que lo aplique; hasta entonces la fila dice «añadido · falta cerrar sesión». Aunque tu usuario sea administrador, el launcher no corre «elevado», así que también lo necesitas (solo te lo ahorras si abres GameShell como administrador).
- **Si dice «Windows no dejó añadirte al grupo»**: el programa prueba tres caminos (`net localgroup`, los comandos de PowerShell por SID y ADSI) y apunta qué dijo cada uno en `gameshell.log` (líneas «FPS: permiso · …»; el informe entero queda en `%APPDATA%\gameshell\permiso-fps.txt`). A mano, en una ventana de PowerShell **como administrador**: `net localgroup "Usuarios del registro de rendimiento" TU_USUARIO /add` (en un Windows en inglés, `"Performance Log Users"`), y luego cerrar sesión y volver a entrar.
- **Limitaciones sinceras**: (1) en un juego en pantalla completa **exclusiva** de verdad Windows no deja dibujar nada encima y el número no se vería (casi todos los juegos de hoy usan «pantalla completa sin bordes», donde sí se ve); (2) con el launcher delante el número se oculta; (3) lo medido es lo que **presenta el juego** (como el contador de las herramientas de Intel/NVIDIA), no lo que muestra el monitor; (4) si un juego se lanza desde otro lanzador (Steam, Epic…) que se cierra enseguida, GameShell sigue midiendo hasta que vuelves al launcher.

### Añadir programas y scripts
**Añadir juego** (la ficha del final de la fila) abre el selector de archivos con **Programas y scripts** de entrada; también hay filtros de solo `.exe`, solo scripts, accesos directos y **Todos los archivos**. Cada tipo se abre así:

| Tipo | Se abre con |
|---|---|
| `.exe` | directamente (como siempre) |
| `.bat` `.cmd` | `cmd.exe`, con su ventana de consola (con *Abrirlo solo al iniciar*, oculta) |
| `.ps1` | PowerShell con `-ExecutionPolicy Bypass` (la política de scripts de Windows no lo bloquea) |
| `.py` | `py -3` (o `python`); si el script falla, la ventana **espera una tecla** para que puedas leer el error |
| `.pyw` | `pyw` / `pythonw` (sin consola) |
| `.vbs` `.vbe` `.wsf` | Windows Script Host (`wscript`) |
| `.jar` | `javaw -jar` (si hay Java instalado) |
| `.lnk` `.url` y cualquier otro | como con doble clic en el Explorador (lo que Windows tenga asociado): accesos directos, atajos de Steam o Epic (`.url`)… |

- Si falta el intérprete (por ejemplo, no hay Python), se abre con lo que Windows tenga asociado a ese tipo.
- El script se ejecuta **en su propia carpeta**, así que las rutas relativas de dentro funcionan igual que con doble clic.
- El launcher vuelve solo al frente cuando el script termina (si ha durado más de 15 s), igual que con un `.exe`. Con `.lnk`, `.url` y los demás «abrir con Windows» no hay proceso que seguir: vuelves cerrando el juego o con `Alt+Tab`.
- Con un script no se sabe qué `.exe` es «el juego», así que el contador de FPS mide la ventana que tenga el foco.
- **Abrirlo solo al iniciar** también vale para scripts (siempre se abren; no se puede saber si «ya estaban abiertos» como con un `.exe`).
- El icono es el que Windows da a ese tipo de archivo; se cambia con **Cambiar logo…** como los demás.

### Mandos Buzz!
**Opciones → Mandos Buzz.** Los Buzz! son solo para los juegos (PCSX2…): en el launcher no hacen nada.
- **En el launcher manda siempre tu mando.** El pincho de los Buzz! se ve en Windows como un mando de juego más; el launcher los reconoce (por el nombre «buzz» o por su VID:PID de Sony 054C:1000 / 054C:0002) y los **ignora**: no mueven el menú ni cuentan como «mando conectado». Tu DualShock / DualSense (que también son de Sony, pero con otros PID) siguen funcionando con normalidad. En `gameshell.log` queda una línea «mando visto: …» por cada mando que ve el launcher (y cuál ignora), por si algún día alguno se colara.
- **BuzzActivar va dentro.** Cuando el launcher termina de arrancar (después de la intro y de la Precarga Post Intro), GameShell arranca en segundo plano, sin ventana, `launcher/buzz/buzz_gameshell.py`: es `BuzzActivar.py` **sin tocar** (se importa tal cual) más tres cosas: avisa al launcher de si el pincho está conectado, se apaga ordenadamente (apaga las luces de los mandos) al cerrar el launcher —o solo, si el launcher se cae— y no se abre dos veces. Se hace desde el launcher porque, siendo la shell de Windows, la carpeta de *Inicio* no se ejecuta.
- **Hace falta lo mismo que con BuzzActivar suelto:** **Python 3** y la librería **hidapi**. Python tiene que verlo el usuario que abre GameShell (el «usuario de juegos», si usas uno): instálalo desde python.org marcando *Add python.exe to PATH* y, mejor, *Install for all users*. Si falta hidapi, **Instalar hidapi** (necesita internet) hace lo mismo que `1_Instalar.bat`.
- **Filas del menú:** *Activar los Buzz* (por defecto **Sí**) · *Estado* (pincho conectado · activo, enchufa el pincho · falta Python · falta hidapi · …; con `Intro` se vuelve a leer) · *Pitido al detectar el pincho* (por defecto Sí, como BuzzActivar) · *Reiniciar* (si no lo detecta) · *Instalar hidapi* (solo sale si falta).
- Si se cae sin que lo pidas, se reintenta solo (hasta 4 veces en un minuto; luego sale «se ha parado» y hay que pulsar *Reiniciar*). Si ya hay otra copia abierta del programa, lo da por bueno.
- Los `.bat` y el `LEEME.txt` originales siguen en `launcher/buzz/` (el diagnóstico `4_Diagnostico.bat` lista los dispositivos HID; con *Añadir juego* ya puedes ponerlo en el launcher). No hace falta abrir `2_Iniciar.bat` ni usar el autoarranque: lo hace el launcher, y dos copias a la vez se pelearían por el pincho.
- En `gameshell.log` salen las líneas «Buzz: …» (arranque, pincho conectado / desconectado, errores).

### Resolución de pantalla
**Opciones → Resolución de pantalla.** Muestra **solo los modos que Windows dice que admite tu pantalla principal**: eliges la resolución con `←/→` y, en la fila de abajo, la frecuencia (Hz); **Aplicar** la cambia **en caliente**. Después sale **«¿Mantener esta resolución?»** con una cuenta atrás de 15 s: *Mantener* la guarda (sigue al reiniciar); *Volver a la anterior* —que es la fila marcada por defecto— o no tocar nada la devuelve. Si el launcher se cierra con un cambio sin confirmar, también vuelve. Así, una resolución que tu tele o monitor no enseñe bien no te deja sin imagen.
Usa las funciones de Windows (`ChangeDisplaySettingsEx`) a través de PowerShell (`launcher/pantalla.ps1`); con varias pantallas cambia la principal.

### W×4
Pulsar `W` cuatro veces seguidas alterna entre **dos aspectos completos** (estilo + fondo + barras + timbre de menú): el que estés usando y el otro. La primera vez te lleva al de `actualizacion`; la siguiente, de vuelta al tuyo exacto. Es un atajo; si no lo quieres, ignóralo.

## Todo lo que incluye (nada se ha quitado)

**19 estilos** — 7 de `actualizado`: Clásico, PS5, PS3, PS2, Neón, Aurora, Synthwave · 7 de `actualizacion`: Clásico (actualización), PS5 (actualización), PS3 · Onda XMB, PS2 · Torres, Neón (actualización), Cristal, OLED minimal · **5 nuevos**: PS4 · Dinámico, Cyberpunk · Neo-Tokio, Cosmos, Brasas y Sakura (ver abajo).
Los de `actualizacion` mantienen su colocación exacta (comprobada icono a icono) y los mismos colores; Clásico es casi idéntico en los dos, pero cada uno lleva sus barras.

**5 barras inferiores** (+ *Nada*) — de `actualizado`: Clásica, PS5, PS3, PS2 (las que ponen `START`) · de `actualizacion`: Teclas y botones (`[Intro] (✕) OK …`).
**6 barras superiores** (+ *Nada*) — de `actualizado`: Con ajustes (⚙), PS5, PS3, PS2, Synthwave · de `actualizacion`: Reloj y apagar.
*Mismo del estilo* usa la que le tocaba a cada estilo en su launcher original; las puedes mezclar a tu gusto.

**13 intros** — de `actualizado`: Clásica, PS2, PS3, PS5, Neón, Foto · de `actualizacion`: PS2 · Torres, PS5 · Símbolos, PS3 · Onda, Foto de fondo, Solo el nombre · **nueva: PS2 · Arranque** · y Sin intro.

**19 fondos animados** (los de cada estilo; se pueden usar con cualquier estilo, ver *Estilo, Fondo y barras*) y **20 fondos de foto** (en `assets/fondos`, todos a 3840×2160) — los 12 de antes (6 de cada uno; cuatro están repetidos entre los dos zips y los dejé todos: *Símbolos blanco y negro* = *Símbolos*, *Símbolos neón multicolor* = *Neón azul*, *Símbolos neón y humo* = *Neón colores*, *Símbolos trazo de luz* = *Neón humo*) y **8 nuevos**: Aurora boreal, Nebulosa, Amanecer orbital, Seda iridiscente, Bokeh nocturno, Mármol líquido, Cumbres en la niebla y Atardecer en el mar.

## Estilos nuevos (etiqueta verde «nuevo» en el selector)
- **PS4 · Dinámico** — azul profundo con polvo de luz flotando; el icono elegido se queda a la izquierda, grande y con marco blanco que respira.
- **Cyberpunk · Neo-Tokio** — ciudad de noche con lluvia, carteles de neón y plantas iluminadas en tres capas de edificios; los iconos llevan marco de «mira» (cian; el elegido, amarillo) y el título lleva aberración cromática.
- **Cosmos** — nebulosa, estrellas que titilan y un planeta; los iconos orbitan en arco, girados según su posición.
- **Brasas** — oscuridad con chispas que suben de un fuego y se enfrían del amarillo al rojo; el icono elegido arde. Ahora con **12 colores** y la **altura de los iconos** a tu gusto (ver *Brasas*, más abajo).
- **Sakura** — atardecer con un cerezo en flor, luna y pétalos al viento.
Cada uno trae también su **timbre de menú** (se elige igual que los demás).

## Calidad en 4K
- **Vistas previas de los estilos** (`assets/estilos`): ahora son capturas del launcher real renderizadas a **3840×2160 (16:9)** (antes 480×270, por eso se veían borrosas). El selector carga la copia de 1280×720 (`assets/estilos/miniaturas`), que sigue siendo nítida en pantallas 4K y no obliga a decodificar 19 imágenes de 8 Mpx a la vez; las de 4K completas están en la carpeta para quien las quiera.
- **Miniaturas de los fondos**: de 640 a 960 px, y las fotos que importes también se guardan con miniatura de 960 px.
- **Efectos en vivo**: las torres de PS2 · Torres (y su intro) se dibujaban a la mitad de resolución y se veían suaves en 4K; ahora van a resolución completa (con un tope de 1920 px de ancho para que no pesen). Las ondas, que son borrosas por diseño, siguen a media resolución.

## Fondos a 4K
Los 12 de antes están reescalados a 3840×2160 (16:9): se quitaron los bloques de la compresión JPEG, se ampliaron con Lanczos, se afilaron sin halos y se añadió un grano finísimo contra las bandas (los negros se quedan en negro puro). `ps5-pro` era 21:9 y se recortó al centro (como ya hacía el launcher en pantalla).
Es un reescalado: **mejora mucho los bordes y los bloques, pero no puede inventar detalle que la imagen original no tiene**. La carpeta `fondos-originales` (copia de baja resolución de la que salieron) **se ha eliminado**: el launcher nunca la leía. Los 8 fondos nuevos se han generado directamente a 4K (no son reescalados). Para máxima nitidez con tus fotos, usa **Añadir foto de fondo…** con fotos que ya sean 4K: se guardan sin tocar.

## Lo único que se quitó (porque lo pediste)
- «Wi-Fi y ajustes de Windows» del menú Sistema.
- El teclado en pantalla de `actualizacion` (se usa el de `actualizado`, con su aspecto, funcionamiento y sonidos).
- `cambiar-launcher.cjs` (el cambio entre dos launchers; W×4 ahora alterna aspectos).
- **Tecla Windows** (Opciones) y el aviso «▲ / ▼ hay más filas» de los títulos de los menús.

## Revisión de errores
- **El instalador no dejaba Electron listo** (`instalar-shell.bat` / `shell.ps1`): con Electron 45 o más nuevo, `npm install` instala el paquete pero **ya no descarga `electron.exe`**, y el shell se quedaba sin programa (pantalla negra al iniciar sesión). `instalar-shell.bat` ahora comprueba que exista `node_modules\electron\dist\electron.exe` y, si falta, lo descarga solo (`node node_modules\electron\install.js`); `shell.ps1` avisa con un mensaje claro.
- **El «retroceso» del teclado** (ver *Novedades*): era una animación que se reiniciaba a medias con pulsaciones seguidas.
- En las listas largas ya no aparece el aviso de «hay más filas» y se quitó la tecla Windows, como pediste.
- Todo lo nuevo se ha **probado en Electron** (arranque, selectores, fuentes importadas, barras, intro para jugar en 7 estilos × 5 modos, sonidos, Dock, Brasas, contador de FPS con un medidor simulado y menús de resolución con una pantalla simulada). Lo que **solo se puede comprobar en un Windows real** y no se ha podido ejecutar aquí: el medidor PresentMon de verdad (arranque, descarga, permiso), que el número se vea sobre tu juego concreto, y el cambio real de resolución con tu pantalla. Si algo de eso falla, `gameshell.log` dice qué pasó («FPS: …», «resolución: …»).
- Lo de los **Buzz** y los **scripts** se probó con un Windows y un pincho **simulados** (arranque, avisos, reintentos, apagado, cómo se abre cada tipo de archivo, y que el launcher haga caso a tu mando aunque el Buzz ocupe la primera casilla). **Solo se puede comprobar en tu PC**: el pincho de verdad, que Python (`py` / `python`) lo vea la sesión del usuario que abre GameShell, y la ventana de administrador del permiso de FPS. Si algo falla, `gameshell.log` lo dice («Buzz: …», «FPS: permiso · …», «mando visto: …»).

## Datos (`%APPDATA%\gameshell`)
`ui.json` (apariencia, volúmenes, lo eliminado…) · `games.json` · `settings.json` (contraseña) · `fondos\` (tus fotos y sus miniaturas) · `fuentes\` (tus tipos de letra) · `bin\` (PresentMon, si lo descargas) · `iconos\` y `logos\` (logos de juegos: se leen los dos formatos) · `carteles\` (las fotos de la derecha de los estilos PS5) · `bloqueo\` (listas del bloqueador de anuncios) · `sonidos\` (opcional: `ps2`, `ps3`, `ps5`, `ps2boot`) · `permiso-fps.txt` y `fps-permiso.json` (informe del último permiso de FPS y cuándo se dio) · `gameshell.log`.
Si algo falla, mira `gameshell.log`. Para probar sin instalar: `npm install` y luego `npm start` (abre el launcher en ventana).
