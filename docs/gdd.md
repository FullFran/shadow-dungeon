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
- Los niveles, los objetos equipados y las bayas son de la partida y se pierden al acabar (ver "Progresión dentro de la partida"). Las Pokémonedas se quedan (sección 11).

### Plantas normales

- Salas y pasillos generados al azar, al estilo Mundo Misterioso, con escaleras a la siguiente planta.
- 3 + n enemigos por sala, siendo n el número de jugadores *(provisional; en el MVP la cuenta sube con la profundidad, de 1 a 2 por sala en la planta 1 y uno más por planta)*.
- Los enemigos duermen hasta que entras en su sala o te ven de cerca; una vez despiertos ya no paran.
- Las escaleras se pueden usar en cuanto las encuentras, sin limpiar la planta (como en Mundo Misterioso).
- La vida se arrastra de una planta a otra y cada planta nueva cura un 25 % de la vida máxima *(provisional)*. El Disfraz se recupera en cada planta.
- Cada partida tiene una semilla (al azar, o fija con `?seed=` en la dirección) y se enseña al final, así que una partida buena se puede repetir.
- Cada planta empieza con una tarjeta ("Mazmorra Sombría", "Planta 2") que aparece y se va en un par de segundos sin parar el juego.
- Minimapa arriba a la derecha, como en Mundo Misterioso: se descubre lo que ves (la sala entera al entrar, los pasillos a tu alrededor), las escaleras salen cuando las has visto y los enemigos solo si están en pantalla. Tab lo muestra u oculta.
- Los enemigos despiertos te persiguen rodeando paredes (siguen el camino andando hacia ti cuando no te ven).
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

**El derrumbe en el MVP** *(valores provisionales)*:

- Sale en las plantas generadas con un 25 % de probabilidad en la planta 2 y un 40 % en la 3; nunca en la 1 ni en las de jefe. Se decide con la semilla de la partida, así que la misma semilla repite los mismos derrumbes.
- Al entrar sale la tarjeta de la planta con el aviso "¡La planta se derrumba!" y un estruendo.
- Tras 5 segundos de gracia, el frente avanza desde la entrada a 1,5 casillas por segundo siguiendo la distancia andando (no en línea recta), así que siempre llega a las escaleras lo último. Llega como pronto 1,8 veces más tarde de lo que tardarías andando derecho a ellas (con estos valores, unas 2,9 veces); lo comprueban los tests con cientos de semillas.
- Pisar escombro quita un 6 % de la vida máxima cada medio segundo y te empuja hacia el suelo que sigue en pie. La invulnerabilidad de la rueda se salta un golpe, pero el Disfraz no lo para: el suelo no es un ataque.
- Los enemigos que andan y se quedan en el escombro caen; Gastly flota y sigue.
- Cerca del frente hay un rumor grave que sube de volumen y la pantalla tiembla un poco; el suelo a punto de caer se agrieta.
- Escapar enseña en la tarjeta de la planta siguiente cuánto has tardado ("Escapaste del derrumbe en 0:42"). Todavía no da Pokémonedas, solo la línea.

### Progresión dentro de la partida

Todo lo de esta sección se pierde al acabar la partida; lo permanente es la sección 11. Valores *provisionales*.

**Niveles.** Cada enemigo derrotado da experiencia según la especie (Poochyena 10, Gastly 12, Aegislash 60) y la profundidad (un 50 % más por cada planta por debajo de la primera). Empiezas en el nivel 1 y el tope es el 10 (hacen falta 25, 60, 110, 175... puntos en total). Cada nivel da 8 PS máximos más (que se curan al momento) y un 5 % más de daño. Al subir sale "¡Mimikyu subió al nivel N!" con una fanfarria corta; arriba a la izquierda están el nivel y la barra de experiencia. En cooperativo, como en Mundo Misterioso, cada jugador en pie gana la experiencia de cada enemigo derrotado, lo haya derrotado quien lo haya derrotado (también el derrumbe). Quien está debilitado no gana nada, para que subir de nivel no lo levante.

**Objetos equipados.** Al entrar en cada planta a partir de la segunda (la del jefe incluida), cada jugador elige uno de tres objetos. Salen según su rareza (común 6, poco común 3, rara 1 por objeto), sin repetirse en la misma oferta, y la oferta depende de la semilla de la partida, la planta y el jugador. Se acumulan durante la partida hasta un tope por objeto; uno que ya está en su tope no vuelve a salir. Se eligen con un clic en la carta o con 1, 2 o 3. En solitario el juego se para mientras eliges; en partida compartida no se para nada (las cartas salen abajo, puedes seguir andando y rodando, y el clic en una carta no ataca). Si bajas sin elegir, la oferta de la planta nueva sustituye a la anterior. Los objetos salen en el HUD y, con su descripción, en el menú de Esc.

| Objeto | Rareza | Efecto | Tope |
|---|---|---|---|
| Cinta Elegida | Rara | Un 30 % más de daño, pero los movimientos y rodar gastan un 30 % más de estamina | 1 |
| Restos | Poco común | Recuperas un 1 % de la vida máxima por segundo | 3 |
| Garra Rápida | Poco común | Los movimientos arrancan y se recuperan un 15 % antes | 2 |
| Baya Zidra | Común | Al bajar de la mitad de la vida curas un 25 % de golpe, una vez por planta | 2 |
| Periscopio | Común | Un 10 % de golpes críticos (daño ×1,5) | 3 |
| Banda Focus | Rara | Aguantas con 1 PS un ataque que te debilitaría, una vez por planta (el derrumbe no es un ataque) | 1 |
| Campana Concha | Poco común | Curas un 12 % del daño que haces | 2 |
| Cinta Fuerte | Común | Un 20 % más de daño con el movimiento fuerte | 3 |
| Cinta Experto | Común | Un 20 % más de daño con los golpes supereficaces | 2 |
| Polvo Brillo | Poco común | La esquiva perfecta tiene 40 ms más de margen | 2 |
| Lupa | Común | Los golpes alcanzan un 15 % más y los proyectiles son un 15 % más grandes | 2 |
| Casco Dentado | Poco común | Quien te alcanza cuerpo a cuerpo recibe 8 de daño | 3 |

Por tope se entiende cuántas copias puedes llevar; cada copia suma su efecto.

**Bayas Aranja.** En las plantas generadas, cada sala menos la de entrada tiene un 35 % de llevar una Baya Aranja en el suelo (se decide con la semilla, así que la misma semilla pone las mismas bayas). Pasar por encima cura 20 PS. El minimapa enseña las bayas que has visto. En partida compartida manda el anfitrión: quien la pisa la pide, el anfitrión se la da al primero que la pidió y las instantáneas dicen qué bayas quedan.

### Jefes

- Patrones que se aprenden y avisos claros (la animación Charge sirve como carga del golpe).
- Débiles a tipos concretos; el final se conoce de antemano.
- Cómo escalan con el número de jugadores: sección 8.

### Prólogo y trasfondo *(provisional)*

El juego se abre con un prólogo de algo más de un minuto, al estilo de la apertura de Dark Souls (narración lenta en texto, cuadros quietos que salen de la oscuridad, mucha calma) pero dibujado con el pixel art de Mundo Misterioso. Se puede saltar, sale solo la primera vez que se pulsa Jugar y se puede volver a ver desde el menú principal (entrada Prólogo).

Lo que cuenta:

1. Hubo una edad de luz en la que los Pokémon vivían bajo un sol que no conocía la sombra.
2. Algo despertó bajo la tierra con hambre de luz y se la fue bebiendo al sol hasta dejarlo hueco.
3. Llegó el Eclipse Carmesí: un anillo rojo sobre negro, quieto desde entonces (es la imagen del juego y el fondo de los menús).
4. Con él se abrieron las Mazmorras Sombrías. Los Pokémon que entran y vuelven ya no son ellos, solo su sombra (por eso los enemigos son versiones sombrías).
5. En lo más hondo de la primera cripta, Aegislash (el Rey de las Espadas) guarda una puerta sellada, y nadie sabe si protege al mundo de lo que hay detrás o al revés.
6. Negro, y una voz: "…¿Me oyes? ¿Puedes oírme?" (un guiño a Mundo Misterioso). De ahí se pasa al test de personalidad.

Lo que hay bajo la tierra es Necrozma, el jefe final, pero el prólogo no lo enseña ni lo nombra: solo una luz que se hunde en la oscuridad y el destello de un cristal. Todo este trasfondo es un primer borrador y puede cambiar.

## 4. Combate

### Controles (teclado y ratón)

| Tecla | Qué hace |
|---|---|
| WASD | Moverte |
| Espacio | Rueda con invulnerabilidad; gasta estamina |
| Clic izquierdo (o Q) | Ataque ligero: rápido, se recupera enseguida y castiga huecos pequeños (Placaje, Arañazo) |
| Clic derecho (o E) | Movimiento fuerte de su tipo: arranque lento, gasta estamina y si lo mantienes carga (Ascuas, Pistola Agua) |
| Ratón | Apuntar. Sin objetivo fijado, el clic ataca hacia el cursor y Q o E hacia donde miras (la última dirección de WASD; mientras cargas con E giras con WASD). Con objetivo fijado, todo va al objetivo. Si pulsas a la vez el clic y su tecla, manda el clic |
| Shift o clic central | Fijar objetivo: una pulsación fija y otra lo suelta (mantener Shift resultó incómodo en la primera prueba). El tipo de fijado se elige en ajustes |
| Clic izquierdo sobre un enemigo | Lo fija (o cambia a él si ya tenías otro), además de atacar. Se puede desactivar en ajustes |
| Rueda del ratón | Con objetivo fijado, cambiar al siguiente |
| Tab | Mostrar u ocultar el minimapa |
| Esc | Menú: continuar, ajustes rápidos, reiniciar la planta (vuelve a como entraste) y salir al menú principal |

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

Tipos de fijado (en ajustes y en el menú de Esc): pulsar para fijar o soltar (por defecto), mantener para fijar (fijado solo mientras mantienes Shift o el clic central), solo con clic (Shift y el clic central no hacen nada; un clic sobre un enemigo lo fija o cambia a él y un clic en el suelo lo suelta, además de atacar) y desactivado (nunca se fija; el clic apunta al cursor y Q o E hacia donde miras). La opción de fijar con clic vale para pulsar y mantener (con mantener, solo mientras lo mantienes); con solo con clic va incluida y con desactivado no hace nada.

Menú de Esc: en solitario pausa la partida. En el cooperativo no habrá pausa (el menú se abre mientras la partida sigue), pero el menú de Esc seguirá sirviendo para cambiar los ajustes rápidos.

Mover el ratón con un objetivo fijado no cambia de objetivo. En Elden Ring con ratón hay quejas justo por eso (cambios de objetivo sin querer), así que el cambio solo ocurre con un gesto explícito: la rueda, un clic sobre un enemigo o volver a fijar. Dos detalles para la rueda: el orden es por ángulo alrededor del jugador (así arriba y abajo son predecibles) y los eventos se acumulan hasta un umbral, porque un touchpad dispara muchos eventos pequeños y, si no, salta varios enemigos de golpe.

### Que se sienta bien

Microparón al golpear, vibración de pantalla en los golpes fuertes, números de daño grandes y un sonido distinto según la fuerza del golpe. Un combate simple que se siente genial gana a uno profundo que se siente blando.

El sonido del M0 es procedural (Web Audio, sin ficheros de audio): cada evento del núcleo tiene un efecto corto de estilo retro sintetizado en código (un chasquido propio cuando se rompe el disfraz, un golpe metálico cuando Aegislash bloquea, una campanita en la esquiva perfecta) y la música es un bucle chiptune original en la menor que se acelera en la sala del jefe. Hay volumen general, de música y de efectos, y la tecla M silencia.

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
| Jugable | Mimikyu (Fantasma/Hada) | Por defecto, clic izquierdo: Garra Umbría (rápido); clic derecho: Carantoña (lento, se carga). Repertorio completo más arriba. Pasiva Disfraz: el primer golpe que recibes en cada planta no te hace daño y el disfraz se rompe (se ve) |
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
  - Prototipo de red (M1, *provisional*): cada jugador simula su propio Pokémon sin esperar a nadie y envía su estado unas 20 veces por segundo. El anfitrión mueve a los enemigos y al jefe contra todos los jugadores (cada enemigo va a por el más cercano) y envía una instantánea unas 20 veces por segundo (unos 55 bytes por enemigo en JSON compacto: entre 115 y 760 bytes por instantánea en las plantas generadas). Los golpes de un invitado a un enemigo se resuelven en su pantalla y se mandan al anfitrión como reclamaciones, que este aplica una sola vez (en el prototipo se confía en ellas). Los golpes enemigos se comprueban solo contra el jugador de cada pantalla: si has rodado en tu pantalla, has esquivado. Los demás jugadores y, en los invitados, los enemigos se dibujan unos 100 ms en el pasado, interpolando entre instantáneas. Las escaleras las decide el anfitrión y se lleva a todos. Pendiente de la prueba con lag real.
  - Salas en línea (M1, *provisional*): "Crear sala" da un código de 5 caracteres sin letras que se confunden (ni 0/O ni 1/I/L), con botón de copiar y opción de ocultarlo en pantalla para quien hace directo; "Unirse" con el código (o con `?room=CÓDIGO` en la dirección). Máximo 4 jugadores (al quinto se le dice que la sala está llena). El anfitrión ve quién ha entrado y pulsa Empezar; todos juegan con su semilla. Los navegadores se encuentran por relés públicos de Nostr (Trystero) y luego hablan directamente por WebRTC, sin servidor TURN (dos jugadores detrás de NAT estrictos pueden no conectar). Con F3 se ven las estadísticas de red (ida y vuelta por jugador, instantáneas por segundo y su edad, bytes por segundo).
  - La cámara lenta de la esquiva perfecta, en partida compartida, es solo para quien esquiva (destello, sonido, tinte y el golpe reforzado): los enemigos son los mismos para todos y no se ralentizan para nadie. En solitario no cambia nada.
  - Las Bayas Aranja las decide el anfitrión, como los golpes: el invitado que pisa una la reclama, el anfitrión se la da una sola vez al primero que la pidió (y se lo dice) y sus instantáneas llevan las bayas que quedan. La experiencia la calcula cada jugador para sí mismo al ver caer cada enemigo (una vez por enemigo). Cada jugador elige sus propios objetos.
  - Si se va el anfitrión, la partida se acaba para los invitados con un aviso y el botón de volver al menú (no hay migración de anfitrión en el prototipo).
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
