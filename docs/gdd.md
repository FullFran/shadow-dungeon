# Documento de diseño: Mazmorra Sombría (título provisional)

Borrador v0.3, 25 de octubre de 2026. Todo número marcado como *(provisional)* es un punto de partida para ajustar jugando, no una decisión.

## 1. Qué quiero hacer

Un fan game de Pokémon, gratis y sin ánimo de lucro, pensado para que Rocío (rociplays) lo juegue en directo con hasta tres personas de su chat. Partidas cortas con la estructura de Mundo Misterioso (plantas, escaleras, mazmorras roguelike) y un combate en tiempo real que se sienta souls: pocos enemigos que se leen, golpes que se avisan antes de llegar, una rueda con invulnerabilidad y jefes que se aprenden a base de morir.

Este primer juego es pequeño a propósito. La idea es que deje hechas las bases (combate, generación de mazmorras, cooperativo, modelo de datos) para un juego bastante más complejo más adelante (sección 15).

### Pilares

1. Que pueda jugarlo cualquiera del chat. Tres teclas de acción y el ratón, y en una planta ya lo has pillado.
2. Sensación souls, no duración souls. Leer el aviso, rodar, castigar el hueco, y que una partida entera quepa en un trozo del directo.
3. Momentos para el directo. Esquivas perfectas, rescates, plantas con prisa, jefes que caen por los pelos (cosas a las que el chat reacciona).
4. Cada Pokémon se juega distinto. Cada uno tiene sus dos ataques propios (es la lección de PokéSurvivor, donde los Pokémon se diferencian sobre todo por estadísticas y muchos acaban jugándose igual).
5. Primero para una persona, el cooperativo encima. Equilibrado para jugar sola y escalando bien hasta cuatro.

### Lo que no va a ser

- Nada de horda tipo Vampire Survivors.
- Nada de combate por turnos.
- Nada de días ni ciclo de día y noche (lo de Nightreign lo miré y lo descarté).
- Nada de monetización, de ningún tipo.

## 2. Restricciones

| Restricción | Qué implica |
|---|---|
| Es un fan game con propiedad intelectual de Nintendo y The Pokémon Company | Gratis, sin anuncios, sin donaciones dentro del juego y con un aviso visible de proyecto fan sin ánimo de lucro. Esto baja el riesgo, no lo elimina. |
| Sprites de [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab), licencia CC BY-NC 4.0 | Uso no comercial y crédito a cada artista. Cada carpeta trae su `credits.txt` y de ahí se genera un `CREDITS.md` (el `tools/fetch_credits.py` de PokéSurvivor ya lo hace y sirve de referencia). |
| Sprites cenitales en 8 direcciones | La cámara va desde arriba. En el set de PokéSurvivor los 966 Pokémon tienen Idle, Walk, Attack, Shoot, Charge, Hurt y Faint, con la duración de cada fotograma (en 1/60 s) en su AnimData. |
| Se juega en directo | Tiene que leerse bien en un stream comprimido: avisos grandes, impactos con mucho contraste y una interfaz clara. |
| Idioma | El juego va en español. El inglés va como opción (sección 13). |

## 3. Estructura de una partida

Una partida es una mazmorra que bajas planta a planta. Sin días y sin reloj global.

| Planta | Qué hay *(provisional)* |
|---|---|
| 1 a 3 | Plantas normales |
| 4 | Jefe |
| 5 a 7 | Plantas normales; empiezan a salir plantas con prisa |
| 8 | Jefe |
| 9 a 11 | Plantas normales; las plantas con prisa salen más |
| 12 | Jefe final (un legendario que se enseña antes de empezar) |

- Duración objetivo: unos 25 a 30 minutos *(provisional)*.
- Antes de entrar, el grupo ve el jefe final y su tipo, así que elegir equipo ya es una decisión de estrategia.
- Los niveles se reinician en cada partida. Las Pokémonedas se quedan (sección 11).

### Plantas normales

- Salas y pasillos generados al azar, al estilo Mundo Misterioso, con escaleras a la siguiente planta.
- 3 + n enemigos por sala, siendo n el número de jugadores *(provisional)*.
- Sin reloj. Solo un aviso suave si el grupo se queda muchísimo tiempo (la idea del viento de Mundo Misterioso), para cortar el quedarse farmeando, nunca para castigar a quien juega normal.

### Plantas con prisa

Plantas que salen de vez en cuando y te obligan a encontrar las escaleras rápido. Se anuncian al entrar. Salen según unos pesos que dependen de la profundidad (casi nunca al principio y más cuanto más bajas), igual que Pokelike reparte sus tipos de nodo según la fase del mapa.

| Planta | Qué pasa | Por qué funciona |
|---|---|---|
| Derrumbe | El techo cae desde un extremo hacia las escaleras | Te obliga a avanzar; no puedes volver a por el botín |
| Inundación | El agua sube y frena a quien no sea de tipo Agua | El tipo de tu Pokémon decide quién va delante |
| Gas tóxico | Una nube avanza desde la entrada y quita vida poco a poco | Aprieta sin matar de golpe |
| Cazador | Un Pokémon que no se puede matar te persigue por la planta | El que más juego da en directo: correr, esconderse, que un compañero lo distraiga. *Me encanta, pero no entra en el MVP; queda para después.* |

Superar rápido una planta con prisa da premio (más Pokémonedas o un recluta mejor), así que la prisa también es una oportunidad.

### Jefes

- Patrones que se aprenden y avisos claros (la animación Charge sirve como carga del golpe).
- Débiles a tipos concretos; el final se conoce de antemano.
- Cómo escalan con el número de jugadores: sección 8.

## 4. Combate

### Controles (teclado y ratón)

| Tecla | Qué hace |
|---|---|
| WASD | Moverte |
| Espacio | Rueda con invulnerabilidad; gasta estamina |
| Clic izquierdo (o Q) | Ataque ligero: rápido, se recupera enseguida y castiga huecos pequeños (Placaje, Arañazo) |
| Clic derecho (o E) | Movimiento fuerte de su tipo: arranque lento, gasta estamina y si lo mantienes carga (Ascuas, Pistola Agua) |
| Ratón | Apuntar. Sin objetivo fijado, el clic ataca hacia el cursor y Q o E hacia donde miras (la última dirección de WASD; mientras cargas con E giras con WASD). Con objetivo fijado, todo va al objetivo. Si pulsas a la vez el clic y su tecla, manda el clic |
| Shift o clic central | Fijar objetivo: una pulsación fija y otra lo suelta (mantener Shift resultó incómodo en la primera prueba) |
| Clic izquierdo sobre un enemigo | Lo fija (o cambia a él si ya tenías otro), además de atacar. Se puede desactivar en ajustes |
| Rueda del ratón | Con objetivo fijado, cambiar al siguiente |

Es el esquema de Hades y Death's Door (ataque al clic izquierdo, especial al derecho, esquiva al Espacio), así que le resulta natural a cualquiera que haya jugado algo parecido. Todas las teclas se pueden cambiar.

La profundidad sale de cargar y de elegir el momento con esas pocas teclas, no de añadir más botones (es lo que hace Furi).

### Estamina

- Una sola barra para la rueda y para E.
- Sirve para que rodar no acabe siendo la forma más rápida de moverse (un problema conocido de los souls vistos desde arriba).
- Se recupera rápido cuando no la gastas.

### Esquiva perfecta

Si ruedas a través de un golpe en el último instante, el tiempo se ralentiza más o menos medio segundo y tu siguiente golpe hace más daño. Se aprende en dos intentos, cuesta dominarla y cada vez que sale es un clip. *(Provisional; la idea viene de Bayonetta y Furi.)*

### Apuntar y fijar

| Modo | Cómo funciona |
|---|---|
| Libre (por defecto) | Q y E salen hacia el cursor |
| Fijar | Fija al enemigo más cercano al cursor (no al más cercano a ti), así fijas a quien estás mirando |
| Cambiar de objetivo (rueda) | Rueda arriba: el siguiente enemigo en sentido horario alrededor de ti, contando desde el fijado; rueda abajo: el siguiente en sentido antihorario. Solo cuentan los enemigos en pantalla y a alcance |
| Cambiar de objetivo (apuntando) | Haces clic izquierdo sobre otro enemigo (como en LoL); el enemigo bajo el cursor se marca con un aro tenue. Un clic en el suelo no cambia nada. También vale soltar con Shift y volver a fijar apuntando a otro |
| Con objetivo fijado | Los ataques van al objetivo y la rueda sigue las WASD, así que puedes rodear al jefe sin perderlo |
| Se suelta solo | Si el objetivo muere, salta al siguiente más cercano al cursor; si se aleja demasiado o sale de pantalla, se suelta |

Mover el ratón con un objetivo fijado no cambia de objetivo. En Elden Ring con ratón hay quejas justo por eso (cambios de objetivo sin querer), así que el cambio solo ocurre con un gesto explícito: la rueda, un clic sobre un enemigo o volver a fijar. Dos detalles para la rueda: el orden es por ángulo alrededor del jugador (así arriba y abajo son predecibles) y los eventos se acumulan hasta un umbral, porque un touchpad dispara muchos eventos pequeños y, si no, salta varios enemigos de golpe.

### Que se sienta bien

Microparón al golpear, vibración de pantalla en los golpes fuertes, números de daño grandes y un sonido distinto según la fuerza del golpe. Un combate simple que se siente genial gana a uno profundo que se siente blando.

### El kit de cada Pokémon

- Cada Pokémon tiene su propio Q y su propio E. Conseguir uno nuevo en el gacha cambia cómo juegas.
- Cada Pokémon tiene un repertorio de movimientos y lleva equipados dos: uno en la ranura rápida (clic izquierdo) y otro en la fuerte (clic derecho). Cada movimiento pertenece a una de las dos ranuras, para que la rápida siempre se sienta rápida y la fuerte siempre tenga su arranque.
- Los movimientos se cambian desde el menú, entre partidas, nunca en mitad del combate.
- Desbloquear movimientos del repertorio puede ser una de las mejoras que se compran con Pokémonedas (por decidir).
- Más adelante: una tercera ranura de potenciación (por ejemplo Danza Espada) con su propia tecla, y quizá llegar a cuatro ranuras como en Pokémon competitivo. El número de ranuras va en los datos, no metido a mano en el código, para poder añadirlas sin rehacer nada.

Repertorio de Mimikyu en el M0:

| Ranura | Movimiento | Cómo se juega |
|---|---|---|
| Rápida | Garra Umbría | Zarpazo corto delante de ti |
| Rápida | Sombra Vil | Pequeño avance con golpe; sirve para cerrar distancia |
| Fuerte | Carantoña | Golpe cuerpo a cuerpo fuerte, se carga |
| Fuerte | Bola Sombra | Proyectil lento a distancia; cargado, más grande y más rápido |
- La efectividad de tipos se aplica a E (y a las debilidades de los jefes).
- Los kits son datos: un movimiento es una entrada de tabla con daño, arranque, fotogramas activos, recuperación, coste de estamina, forma del golpe y niveles de carga.

### Contenido del primer prototipo (M0)

| Rol | Pokémon | Kit / comportamiento |
|---|---|---|
| Jugable | Mimikyu (Fantasma/Hada) | Por defecto, clic izquierdo: Garra Umbría (rápido); clic derecho: Carantoña (lento, se carga). Repertorio completo más arriba. Pasiva Disfraz: el primer golpe que recibes en cada sala no te hace daño y el disfraz se rompe (se ve) |
| Enemigo cuerpo a cuerpo | Poochyena (Siniestro) | Te acecha, avisa con Charge y se lanza en línea recta; si esquivas, se queda vendido un momento |
| Enemigo a distancia | Gastly (Veneno/Fantasma) | Flota sobre obstáculos, mantiene la distancia y lanza una bola lenta que se lee bien |
| Jefe | Aegislash (Acero/Fantasma) | Dos fases como en su cambio de forma: Escudo (bloquea de frente, hay que rodearlo) y Filo (combos agresivos con huecos claros) |

Por qué estos: Garra Umbría es eficaz contra los dos fantasmas (Gastly y Aegislash) y Carantoña lo es contra Poochyena, así que el tipo importa desde el primer minuto. Disfraz es una regla souls de manual (un error gratis) y queda muy bien en directo. Los cuatro tienen las 7 animaciones en el set de PokéSurvivor; en SpriteCollab Aegislash tiene una segunda forma (carpeta `0681/0001`, que debería ser la forma Filo; falta comprobarlo a ojo) y hay más animaciones que esas 7 (por ejemplo Double y Hop).

## 5. Conseguir Pokémon: gacha

- Los Pokémon se consiguen con un gacha, no reclutando durante la partida.
- Las tiradas se pagan solo con lo que ganas jugando (Pokémonedas o tickets). Nunca con dinero real, ni ahora ni después: es un fan game gratis.
- No hay reclutamiento dentro de la mazmorra. Un compañero controlado por la máquina obliga a escribir una IA de compañero, y eso es caro y fácil que salga mal. Además, los compañeros ya son las personas del chat que juegan contigo.
- Antes de entrar eliges con qué Pokémon de tu colección juegas.

## 6. Muerte y revivir

| Situación | Regla |
|---|---|
| Cae alguien en cooperativo | Queda en el suelo y un compañero vivo puede levantarlo (momento de directo) |
| Caes jugando sola | Objetos para revivirte tú misma por planta, según la dificultad (sección 9) |
| Cae todo el grupo | Depende de la dificultad (sección 9): hoguera o vuelta a la planta 1 |

## 7. Cooperativo

- De 1 a 4 jugadores en todo el juego, cada uno desde su navegador.
- Se entra igual que en PokéSurvivor (sala con código). Gran parte de su interfaz de menús y salas se puede aprovechar. Su código está bajo PolyForm Noncommercial 1.0.0 (antes de su commit `b297089`, MIT): se puede reutilizar sin ánimo de lucro manteniendo su aviso de licencia, y por cortesía conviene escribirle al autor.
- La dificultad la elige el anfitrión para todo el grupo.
- Botín y reclutas: un premio por jugador, para que nadie del chat sienta que ha ido de relleno.

## 8. Escalado según el número de jugadores (n de 1 a 4)

| Qué | Escalado *(provisional)* | Por qué |
|---|---|---|
| Vida del jefe | × (1 + 0,6 (n − 1)) | Sublineal, para que no se haga eterno |
| Comportamiento del jefe | Cambia de objetivo más a menudo y gana ataques de área a partir de n = 2 | Evita que lo flanqueen sin riesgo (con 4 jugadores, el jefe solo puede mirar a uno) |
| Aguante del jefe | Sube con n | Si no, entre cuatro lo tenéis aturdido todo el combate |
| Enemigos por sala | 3 + n | Más gente, más caos |
| Premios | Uno por jugador | |

Escalar solo la vida (lo que hace PokéSurvivor) en un souls se queda corto: el combate dura más pero es más fácil.

## 9. Dificultad

La elige el anfitrión. En un souls, la dificultad de verdad es el tiempo que tienes para reaccionar (cuánto dura el aviso). Subir la vida solo alarga los combates.

| | Fácil | Normal | Difícil | Pesadilla |
|---|---|---|---|---|
| Duración del aviso | ×1,4 | ×1 | ×0,8 | ×0,65 |
| Daño enemigo | ×0,6 | ×1 | ×1,5 | ×2 |
| Vida enemiga | ×0,8 | ×1 | ×1,3 | ×1,6 |
| Revividas en solitario por planta | 2 | 1 | 1 | 0 |
| Si cae todo el grupo | Hoguera cada 3 plantas | Hoguera cada 5 plantas | Vuelta a la planta 1 | Vuelta a la planta 1 y pierdes lo que llevas |
| Pokémonedas | ×0,5 | ×1 | ×2,5 | ×5 |

*(Todo provisional.)* Una regla que no es provisional: lo que pagas tiene que subir por minuto jugado, no solo por partida. Si no, la dificultad más fácil acaba siendo la mejor forma de farmear.

## 10. Directo

- El cooperativo con el chat es la función principal. Los indies cooperativos están entre los más vistos en directo porque dejan que los streamers jueguen con otros y junten audiencias ([Stream Hatchet](https://streamhatchet.com/blog/indie-game-popularity-on-live-streaming/)).
- Momentos que se vean: la cámara lenta de la esquiva perfecta, los rescates, las plantas con prisa, los cambios de fase de los jefes.
- Interfaz clara y con contraste, que se lea en un stream comprimido.

## 11. Progresión entre partidas

- Moneda: Pokémonedas, que ganas en cada partida multiplicadas por la dificultad.
- Con ellas compras mejoras permanentes y tiradas del gacha. Es un roguelike como las mazmorras de Mundo Misterioso: lo que llevas dentro se pierde, lo que compras fuera se queda.
- El MVP tiene una sola mazmorra. Las demás se diseñan después.

## 12. Notas técnicas

- Red: si todo lo decide el anfitrión, a los invitados les dan golpes "aunque habían rodado". Cada cliente tiene que resolver en su propio ordenador su rueda y sus ataques (predicción en el cliente), y el anfitrión reconcilia. Esto se diseña desde el primer prototipo; no se puede parchear después.
- Contenido como datos: especies, movimientos (los kits de Q y E), enemigos, jefes, tipos de planta y tablas de dificultad en ficheros de datos, igual que hace PokéSurvivor con `js/data`.
- Guardado: una sola fachada de guardado con `migrate()` y `sanitize()` versionados (el patrón de `G.DB` de PokéSurvivor merece la pena).
- Sprites: carga bajo demanda con un límite LRU (también de PokéSurvivor). Los tiempos de fotograma del AnimData sirven para sacar el arranque y los fotogramas activos de cada golpe.
- Generación de mazmorras: estudiar PMDO (Pokémon Mystery Dungeon: Origins, licencia MIT, motor RogueEssence) para salas, pasillos y escaleras.
- Lo que no copiar de la arquitectura de PokéSurvivor: un único espacio global con dependencia del orden de los scripts, la lógica de red repartida por el código de las entidades, objetos que lo hacen todo y no tener tests.
- Motor y stack: *sin decidir.*

## 13. Idioma

- Idioma principal: español (peninsular). Todo el texto del juego se escribe primero en español.
- El inglés va como opción, elegible desde el menú. Por defecto, el idioma del navegador si es inglés; si no, español.
- Ningún texto va escrito a mano en el código: todo sale de ficheros de idioma (`es`, `en`) con claves. Así añadir un tercer idioma más adelante es solo añadir un fichero.
- Los nombres de Pokémon, movimientos y tipos van en la versión oficial de cada idioma (Placaje y Tackle, Ascuas y Ember), sacados de PokeAPI, que los trae localizados.
- Un test que falle si a algún idioma le falta una clave que sí tiene el español.

## 14. Preguntas abiertas

1. Motor y stack (tiene que ser ligero, de navegador y desplegable en GitHub Pages).
2. Controles definitivos: ¿los ataques van al ratón o a Q y E, y con qué se fija el objetivo?
3. Qué mejoras permanentes hay y cómo es el gacha (ritmo de tiradas, rarezas, repetidos).

Cerradas en la v0.3: el cazador queda para después del MVP; los Pokémon se consiguen por gacha y no se recluta en la mazmorra; las Pokémonedas compran mejoras y tiradas; se entra a la sala como en PokéSurvivor.

## 15. Bases para un juego más grande

Este juego tiene que dejar piezas que se puedan reutilizar:

- El núcleo del combate (movimientos como datos: arranque, activo, recuperación, estamina, carga).
- El generador de mazmorras y el sistema de modificadores de planta (las plantas con prisa son modificadores).
- La capa de cooperativo, con predicción y reglas de escalado.
- La fachada de guardado con migraciones.
- El modelo de datos de especies, kits y tipos.
- El sistema de idiomas.

Lo que podría venir después: más mazmorras y biomas, un mundo o un pueblo base, historia, reclutamiento y equipos más profundos, más tipos de planta y más jefes.

## 16. Referencias

| De dónde | Qué me llevo |
|---|---|
| La saga Pokémon Mundo Misterioso | Plantas, escaleras, reclutar, rescatar, el viento de cada planta |
| Souls vistos desde arriba (Hyper Light Drifter, Death's Door, Tunic, Eldest Souls) | Avisos cenitales, rueda, jefes que se aprenden |
| PokéSouls: Episode Charmander ([itch.io](https://jab-lao.itch.io/pokesouls-episode-chamander)) | La chispa de todo esto: los movimientos de Pokémon como armas souls, bayas para curar, hogueras |
| Furi | Pocas teclas y profundidad a base de cargar |
| PokéSurvivor | Cooperativo de hasta 4 en el navegador, los sprites de SpriteCollab con sus créditos, la fachada de guardado |
| Inflation RPG | La dificultad como tabla de multiplicadores, números grandes que se ven |
| Pokelike | Pesos por fase para decidir qué tipo de planta o de nodo sale |
| Elden Ring Nightreign | Partidas cortas en cooperativo con el jefe final conocido de antemano (la estructura de días la descarté) |
| PMDO | Referencia de código abierto para generar mazmorras |

Los análisis de los que sale este documento están en `~/fullfran/game-analysis/` (carpeta `notes/` y `slides/game-analysis.pdf`).
