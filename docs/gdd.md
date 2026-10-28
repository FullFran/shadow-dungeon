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
- Nada de días ni ciclo de día y noche como mecánica (lo de Nightreign lo miré y lo descarté). En el mundo (decisión del dueño, 27-10-2026): desde el Eclipse el sol no ha vuelto a salir; el tiempo pasa (frío y menos frío: los inviernos se cuentan por el hielo, no por la luz), la luna sigue saliendo y el sol no.
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
- Cada sala gasta un presupuesto de amenaza en papeles de enemigo, de 0 a 3 enemigos por sala, y el número no cambia con el número de jugadores ni con el nivel de dificultad (ver "Encuentros con sentido").
- Los enemigos duermen hasta que entras en su sala o te ven de cerca; una vez despiertos ya no paran.
- Las escaleras se pueden usar en cuanto las encuentras, sin limpiar la planta (como en Mundo Misterioso). Al pisarlas sale «¿Bajar?» (con teclado, cursor o un toque): jugando sola, «Bajar» pasa a la siguiente planta; «Quedarme» deja seguir explorando y la pregunta vuelve al salir y volver a pisarlas. En la salida de una sala de jefe ya limpia sale «¿Seguir adelante?» con las mismas opciones.
- Niebla antes de cada jefe (estilo Dark Souls): toda sala de jefe (el jefe intermedio y el guardián de cada mazmorra principal y de cada mazmorra de desafío; no los ecos ni los heraldos de la Sima, ni las pruebas del santuario) empieza en una antesala corta bajo la arena, sin enemigos ni balas, ante un muro de niebla. El jefe todavía no está en la sala. Al tocar la niebla sale «¿Atravesar la niebla?»: jugando sola, «Atravesar» te lleva a la entrada de la arena, la niebla se cierra a tu espalda y empieza el combate (con su cinemática, si el guardián la tiene). En cooperativo es la misma regla que en las escaleras (§7, «Bajar juntos»). La arena y el combate son los mismos de siempre; «Reiniciar planta» vuelve a la antesala.
- Hoguera del jefe intermedio (estilo Dark Souls): al vencer al jefe intermedio de una mazmorra principal se enciende una hoguera en el centro de su sala («Hoguera encendida») y cada jugador guarda su estado de ese momento (PS, objetos, nivel y las Pokémonedas que llevaba; quien estaba caído se levanta con la cura de planta). Si más adelante cae todo el grupo, sale «¿Volver a la hoguera?»: «Volver a la hoguera» os devuelve allí con ese estado y las plantas siguientes se generan de nuevo desde la semilla (son las mismas); «Rendirse», o no quedar vueltas, acaba en derrota con su recorte. Vueltas por partida según el nivel (*provisional*): Fácil sin límite, Normal 3, Difícil 1, Pesadilla ninguna. No hay hoguera en la Sima, en el santuario ni en las mazmorras de desafío (no tienen jefe intermedio). En cooperativo decide el anfitrión; los invitados ven «El anfitrión decide si volvéis a la hoguera» y cada uno vuelve con su propio estado (quien entró después de encenderla vuelve a la planta de la hoguera tal como estaba).
- La vida se arrastra de una planta a otra y cada planta nueva cura un 25 % de la vida máxima *(provisional)*. El Disfraz se recupera en cada planta.
- Cada partida tiene una semilla (al azar, o fija con `?seed=` en la dirección) y se enseña al final, así que una partida buena se puede repetir.
- Cada planta empieza con una tarjeta (el nombre de la mazmorra y "Planta 2") que aparece y se va en un par de segundos sin parar el juego; la planta 1 enseña en su lugar el título de la mazmorra (ver "Mazmorras").
- Minimapa arriba a la derecha, como en Mundo Misterioso: se descubre lo que ves (la sala entera al entrar, los pasillos a tu alrededor), las escaleras salen cuando las has visto y los enemigos solo si están en pantalla. Tab lo muestra u oculta.
- Los enemigos despiertos te persiguen rodeando paredes (siguen el camino andando hacia ti cuando no te ven).
- Los que flotan o vuelan (Gastly, Duskull, Drifloon, Zubat, Koffing, sus evoluciones…) pasan por encima de obstáculos bajos, charcas y escombro, pero las paredes los paran como a todos: siempre están en un sitio donde puedes alcanzarlos, y solo lanzan sus ataques desde suelo que te ve. Decisión del 26-10-2026 (prueba de juego): meterse en la roca y disparar desde dentro, donde nada les pega, estaba roto.
- **Fantasmas y paredes (idea para más adelante, no activada).** El guiño de que un fantasma atraviese una pared podría volver así: una fase corta y avisada a través de una pared fina (un tile), saliendo solo a suelo alcanzable y sin atacar nunca desde dentro de la roca. El punto donde engancharía es `pathDirection` (`src/core/brain.ts`); hoy ninguna especie cruza paredes.
- Sin reloj. Solo un aviso suave si el grupo se queda muchísimo tiempo (la idea del viento de Mundo Misterioso), para cortar el quedarse farmeando, nunca para castigar a quien juega normal.

### Encuentros con sentido

Decisión del 25-10-2026: muchos enemigos hacían pesado matarlos, así que se saltaban y se llegaba a los jefes con poco nivel. La experiencia tiene que seguir saliendo de matar, y a veces matar tiene que ser obligatorio. Dirección: **menos enemigos, pero que importen** (docs/souls-difficulty-research.md P1-P3). Todos los números están en `src/data/encounters.ts` y en las tablas de cada mazmorra, y son *provisionales*.

**Papeles.** Cada especie que aparece en plantas generadas tiene un papel con un coste de amenaza: **bruto** (cuerpo a cuerpo lento que aguanta, 3: Golett, Pumpkaboo grande, Shroomish, Krabby, Tentacool, Wooper, Croagunk), **hostigador** (rápido, entra y sale, 2: Poochyena, Pawniard, Phantump, Hoothoot, Impidimp, Ekans, Salandit), **tirador** (a distancia, 3: Gastly, Duskull, Spinarak, Drifloon, Remoraid, Shellos, Corphish, Clauncher, Skrelp, Litleo, Slugma), **enjambre** (débil y en grupo, 1 por unidad: Pumpkaboo pequeño, Zubat, Venipede, Stunky), **controlador** (niega espacio, 4: Foongus, Chinchou, Koffing, Grimer, Houndour) y **apoyo** (mejora a los demás, 4; ninguna especie lo hace aún: lo hace el líder con su grito).

**Presupuesto por sala.** Cada sala menos la de entrada recibe un presupuesto (base de la mazmorra + un tanto por planta + 0 o 1 al azar) y compra papeles de la tabla de la mazmorra hasta que no le llega para ninguno: como mucho 3 enemigos, 2 papeles distintos en Fácil y Normal y 3 desde Difícil (el nivel nunca añade enemigos). Un papel ya comprado pesa menos, así que lo normal es una combinación legible (un bruto delante de un tirador, un controlador con un hostigador) y no una fila de lo mismo. Algunas salas quedan vacías (un respiro; un 15-30 % según la planta). La primera línea (brutos, hostigadores, enjambres) se pone en la mitad de la sala más cercana a la entrada y la segunda (tiradores, controladores) en la parte del fondo.

**Mismo botín por planta.** Hay entre un 35 % y un 45 % menos de enemigos por planta en todas las mazmorras, y cada uno vale más: la experiencia se multiplica por papel (bruto ×1,2, hostigador ×1,45, tirador ×1,3, enjambre ×1,85, controlador y apoyo ×1,25; los guardianes y jefes intermedios no cambian) y cada enemigo paga 1,65 Pokémonedas de base en vez de 1. Quien mata lo que hay gana más o menos la misma experiencia por planta que antes (medido con 150 semillas en Fácil; la planta 1 da algo menos y las hondas algo más).

| Mazmorra | Enemigos por planta antes → ahora | Experiencia por planta antes → ahora |
|---|---|---|
| Cripta | 9,1 → 5,6 | 236 → 237 |
| Bosque Brumoso | 10,9 → 6,8 | 306 → 315 |
| Cuevas Inundadas | 11,6 → 7,4 | 459 → 431 |
| Pantano Tóxico | 10,9 → 6,7 | 438 → 416 |
| Sima (plantas 1-24) | 9,5 → 5,9 | 924 → 879 |

**Líderes.** Algunos grupos de dos o más siguen a un líder: el enemigo de más amenaza del grupo, con corona dorada y un aro dorado a sus pies, un 60 % más de vida y el doble de experiencia. Su movimiento propio es el **grito de mando**: despierto y con algún seguidor vivo, se carga casi un segundo (el aro crece) y cura un 15 % de la vida a los seguidores cercanos, que pueden volver a atacar al momento; lo repite cada 7,5 s. Mientras el líder sigue en pie sus seguidores van un 10 % más rápidos. Si cae, el grupo se rompe según el papel de cada uno: los brutos, enjambres y apoyos **se tambalean** 1,5 s (estrellitas), los hostigadores y tiradores **se desaniman** y van más lentos 6 s (una gota azul) y los controladores solo pierden el ritmo del líder. No hay líderes en la planta 1 y salen más cuanto más hondo (en la Cripta de un 30 % de los grupos en la planta 2 a un 60 %).

**Muertes obligatorias (a veces).** Como mucho una por planta, nunca en la planta 1 ni en las plantas con prisa (el reloj o el peligro ya empujan), nunca en una sala fija ni en una planta de la Sima con cazador. Se decide con la semilla y pesos por mazmorra y profundidad (entre un 30 % y un 50 % de las plantas que pueden tenerla):

- **Sello de la escalera**: la escalera está sellada (un sello rojo encima, roja en el minimapa) hasta que cae el enemigo marcado, el líder de la planta si lo hay o si no un élite o el de más amenaza. Lleva un rombo rojo sobre la cabeza y el minimapa lo enseña siempre, esté donde esté.
- **Puerta cerrada**: las entradas de la sala de la escalera tienen barrotes. La llave la lleva el enemigo marcado (una llave sobre la cabeza), que siempre está fuera de esa sala y se puede alcanzar desde la entrada; al caer, como sea y donde sea (un golpe, un peligro del suelo, un derrumbe, su propia explosión), el grupo consigue la llave al momento y las puertas se abren: no hay llave que recoger del suelo (una llave caída en un charco tóxico o sobre una pared dejaba el piso sin salida). La pantalla lo dice ("¡Has conseguido la llave! La puerta se abre.") y en el minimapa las entradas parpadean en dorado un momento.
- **Sala de oleadas** (solo la Sima): la escalera no se abre hasta superar la sala de oleadas de la planta.

Una línea en pantalla dice qué cierra la escalera mientras dura. El enemigo marcado da un 50 % más de experiencia. **Seguridad**: si el enemigo marcado, vivo, queda fuera del alcance de todos los jugadores durante 60 s seguidos (atrapado fuera del mapa o tras una pared), el sello se rompe solo y no da la recompensa. En cooperativo manda el anfitrión: todos colocan el mismo sello desde la semilla y la instantánea del anfitrión dice cuándo se abre y cuándo se abren las puertas (una instantánea antigua con una llave en el suelo cuenta como abierta). El sello de la escalera funciona igual: el enemigo marcado cae donde sea, aunque esté fuera de la vista o dentro de un peligro, y la escalera se abre en ese paso.

Esa seguridad convive con la red de seguridad contra enemigos fuera del mapa (`core/bounds.ts`): la red devuelve cada paso a cualquier enemigo, ande o flote, a una casilla alcanzable, así que los 60 s del sello solo llegan a contar para lo que la red no puede mover (un portador caído donde no hay suelo, uno fuera del mapa). La sala de la escalera cerrada con llave no cuenta como "fuera de alcance" para la red: sus enemigos esperan dentro. La sala de oleadas de la Sima tiene su propia salida de 60 s sin daño a la oleada, y al acabar así también abre su sello.

**Sonidos.** Efectos cortos sintetizados como el resto (sección del sonido): el grito de mando suena como un cuerno de dos toques (la carga solo se ve, el aro crece), la caída de un líder como una corona que tintinea y tres notas que bajan, abrirse un sello o una puerta como un cerrojo, piedra que roza y un acorde claro (la llave ya no cae: se consigue con la caída de su portador y suena la puerta).

### Plantas con prisa

Plantas que salen de vez en cuando y te obligan a encontrar las escaleras rápido. Se anuncian al entrar. Salen según unos pesos que dependen de la profundidad (casi nunca al principio y más cuanto más bajas), igual que Pokelike reparte sus tipos de nodo según la fase del mapa.

| Planta | Qué pasa | Por qué funciona |
|---|---|---|
| Derrumbe | El techo cae desde un extremo hacia las escaleras | Te obliga a avanzar; no puedes volver a por el botín |
| Inundación | El agua sube y frena a quien no sea de tipo Agua | El tipo de tu Pokémon decide quién va delante; sale en las Cuevas Inundadas |
| Gas tóxico | Una nube avanza desde la entrada y quita vida poco a poco (nunca la última) | Aprieta sin matar de golpe; sale en el Pantano Tóxico |
| Niebla | La niebla se cierra y cada vez ves menos (el minimapa solo recuerda lo que has visto de cerca) | Hay que encontrar las escaleras antes de quedarse a ciegas; sale en el Bosque Brumoso |
| Cazador | Un Pokémon que no se puede matar te persigue por la planta | El que más juego da en directo: correr, esconderse, que un compañero lo distraiga. *Me encanta, pero no entra en el MVP; queda para después.* |

Superar rápido una planta con prisa da premio (más Pokémonedas o un recluta mejor), así que la prisa también es una oportunidad.

**El derrumbe en el MVP** *(valores provisionales)*:

- En la Cripta sale en las plantas generadas con un 25 % de probabilidad en la planta 2, un 35 % en la 4 y un 45 % en la 5; nunca en la 1 ni en las salas de jefe. Se decide con la semilla de la partida, así que la misma semilla repite los mismos derrumbes.
- Al entrar sale la tarjeta de la planta con el aviso "¡La planta se derrumba!" y un estruendo.
- Tras 5 segundos de gracia, el frente avanza desde la entrada a 1,5 casillas por segundo siguiendo la distancia andando (no en línea recta), así que siempre llega a las escaleras lo último. Llega como pronto 1,8 veces más tarde de lo que tardarías andando derecho a ellas (con estos valores, unas 2,9 veces); lo comprueban los tests con cientos de semillas.
- Pisar escombro quita un 6 % de la vida máxima cada medio segundo y te empuja hacia el suelo que sigue en pie. La invulnerabilidad de la rueda se salta un golpe, pero el Disfraz no lo para: el suelo no es un ataque.
- Los enemigos que andan y se quedan en el escombro caen; Gastly flota y sigue.
- Cerca del frente hay un rumor grave que sube de volumen y la pantalla tiembla un poco; el suelo a punto de caer se agrieta.
- Escapar enseña en la tarjeta de la planta siguiente cuánto has tardado ("Escapaste del derrumbe en 0:42"). Todavía no da Pokémonedas, solo la línea.

### Progresión dentro de la partida

Todo lo de esta sección se pierde al acabar la partida; lo permanente es la sección 11. Valores *provisionales*.

**Niveles.** Cada enemigo derrotado da experiencia según la especie (Poochyena 10, Gastly 12, Duskull 13, Golett 22, Pawniard 7, Sableye 50, Aegislash 60), su papel (ver "Encuentros con sentido": un líder el doble, el enemigo de un sello un 50 % más) y la profundidad (un 50 % más por cada planta por debajo de la primera). Empiezas en el nivel 1 y el tope es el 10 (hacen falta 25, 60, 110, 175... puntos en total). Cada nivel da 8 PS máximos más (que se curan al momento) y un 5 % más de daño. Al subir sale "¡Mimikyu subió al nivel N!" con una fanfarria corta; arriba a la izquierda están el nivel y la barra de experiencia. En cooperativo, como en Mundo Misterioso, cada jugador en pie gana la experiencia de cada enemigo derrotado, lo haya derrotado quien lo haya derrotado (también el derrumbe). Quien está debilitado no gana nada, para que subir de nivel no lo levante.

**Objetos equipados.** Al entrar en cada planta a partir de la segunda (la del jefe incluida), cada jugador elige uno de tres objetos. Salen según su rareza (común 6, poco común 3, rara 1 por objeto), sin repetirse en la misma oferta, y la oferta depende de la semilla de la partida, la planta y el jugador. Se acumulan durante la partida hasta un tope por objeto; uno que ya está en su tope no vuelve a salir. Se eligen con un clic en la carta o con 1, 2 o 3. En solitario el juego se para mientras eliges; en partida compartida no se para nada (las cartas salen abajo, puedes seguir andando y rodando, y el clic en una carta no ataca). Si bajas sin elegir, la oferta de la planta nueva sustituye a la anterior. Los objetos salen en el HUD y, con su descripción, en el menú de Esc.

| Objeto | Rareza | Efecto | Tope |
|---|---|---|---|
| Cinta Elegida | Rara | Un 30 % más de daño, pero los movimientos y rodar gastan un 30 % más de estamina | 1 |
| Restos | Poco común | Recuperas un 1 % de la vida máxima por segundo | 2 |
| Garra Rápida | Poco común | Los movimientos arrancan y se recuperan un 15 % antes | 2 |
| Baya Zidra | Común | Al bajar de la mitad de la vida curas un 25 % de golpe, una vez por planta | 2 |
| Periscopio | Común | Un 10 % de golpes críticos (daño ×1,5) | 3 |
| Banda Focus | Rara | Aguantas con 1 PS un ataque que te debilitaría, una vez por planta (el derrumbe no es un ataque) | 1 |
| Campana Concha | Poco común | Curas un 12 % del daño de tus golpes directos, hasta un 1 % de la vida máxima por segundo (se guarda hasta 3 s de cura). Las zonas, los saltos de cadena, los fragmentos, los rebotes, las quemaduras y los estallidos de marca no curan | 2 |
| Cinta Fuerte | Común | Un 20 % más de daño con el movimiento fuerte | 3 |
| Cinta Experto | Común | Un 20 % más de daño con los golpes supereficaces | 2 |
| Polvo Brillo | Poco común | La esquiva perfecta tiene 40 ms más de margen | 2 |
| Lupa | Común | Los golpes alcanzan un 15 % más y los proyectiles son un 15 % más grandes | 2 |
| Casco Dentado | Poco común | Quien te alcanza cuerpo a cuerpo recibe 8 de daño | 3 |

Por tope se entiende cuántas copias puedes llevar; cada copia suma su efecto. Lo que curan los objetos con el tiempo (Restos y Campana Concha) tiene un techo común: un 2 % de la vida máxima por segundo; con dos Restos la Campana ya no cura más. Así una build que pega mucho no puede curarse más rápido de lo que un jefe la daña (ver "Builds degeneradas" en el arnés de balance).

**Bayas Aranja.** En las plantas generadas, cada sala menos la de entrada tiene un 35 % de llevar una Baya Aranja en el suelo (se decide con la semilla, así que la misma semilla pone las mismas bayas). Pasar por encima cura 20 PS. El minimapa enseña las bayas que has visto. En partida compartida manda el anfitrión: quien la pisa la pide, el anfitrión se la da al primero que la pidió y las instantáneas dicen qué bayas quedan.

### Jefes

- Patrones que se aprenden y avisos claros (la animación Charge sirve como carga del golpe).
- Débiles a tipos concretos; el final se conoce de antemano.
- Cada guardián tiene una escena corta antes del combate (la puerta sellada, su mirada y sus palabras, y al final su figura con su nombre y su apodo, al estilo de Touhou) y otra al caer (sus últimas palabras y una pista de lo que hay más hondo). Unos 16 y 13 segundos *(provisional)*, con el motor del prólogo y saltables igual (mantener Esc o Intro, o "Saltar"). Completas la primera vez en ese navegador; después solo la tarjeta del nombre (unos 2,5 segundos). En solitario la partida se para mientras salen; en partida compartida no se para nada y solo aparece la tarjeta del nombre sobre el juego. Aegislash es "El Rey de las Espadas" y Decidueye "El Arquero de la Niebla".
- Cómo escalan con el número de jugadores: sección 8.

### Guardianes con cartas de hechizo (Normal y superiores)

Desde Normal, Aegislash y Decidueye pelean como un jefe de Touhou (`src/data/cards.ts`, `src/core/cards.ts`; datos en `src/data/aegislash-cards.ts` y `src/data/decidueye-cards.ts`). En Fácil siguen como siempre (el duelo de posturas de Aegislash y las cartas de Decidueye), y sus ecos de la Sima también.

**Ecos de la Sima con cartas** (`ECHO_CARDS`): desde Normal, un eco juega las cartas de su nivel según la profundidad. En el primer estrato (plantas 5 y 15) solo juega las de la fase 1. Desde la 25 se suman las de la fase 2, y desde la 35 (o al volver a encontrarse con ese guardián) también la de supervivencia y la última. Tiene solo la vida de las cartas que juega, al 60 % de la vida del guardián sin crecer con la profundidad, y sus tiempos duran un 80 %. Así, en el peor caso, un eco del primer estrato dura unos 64 s si se agotan todos sus tiempos, y uno completo de Pesadilla unos 4 min (la Sima da 60 s por eco).

**Presentación** («Touhou por dentro, souls/Mystery Dungeon por fuera»): las marcas de la barra se leen como las fases de un jefe de souls. Las ya pasadas se apagan, y la de la carta en juego es dorada y late durante el «tu turno». La declaración es un momento: la pantalla se oscurece un poco, el nombre de la carta sale grande y serio en el centro con su línea Touhou («Signo X «…»») pequeña encima, y suena un golpe grave. Una captura dice «¡Técnica dominada!» con su recompensa y una floritura. El tiempo de la carta es un anillo discreto junto a la barra, no un contador. En el «tu turno», el jefe respira con un halo suave y suena un soplo bajo. No hay puntuación ni roce.

- **Cartas:** el combate es una lista de cartas con nombre. Cada carta tiene su tramo de la barra de vida (las marcas de la barra) y su tiempo (los segundos a la derecha de la barra). La carta acaba al vaciar su tramo (rota) o al agotarse el tiempo (se pierde el resto del tramo, sin premio; si es la última, el jefe cae). Los golpes nunca bajan al jefe por debajo del final del tramo en juego.
- **Declaración:** entre carta y carta el jefe anuncia la siguiente (su nombre en pantalla). Mientras la anuncia no ataca ni recibe daño, y desaparecen todas sus balas. La primera carta de la fase 2 se anuncia durante más tiempo (el Rey desenvaina, el Arquero entra en la niebla).
- **Carta de supervivencia:** desde Difícil, una por jefe y sin tramo de vida. El jefe no recibe daño y solo hay que aguantar 15 o 16 segundos.
- **Captura:** quien pasa una carta (rota o aguantada) sin recibir ningún golpe la captura. Recupera un 12 % de su vida máxima y gana 8 Pokémonedas al final (en la línea del guardián). Cuenta por jugador y cada uno en su equipo, no por grupo.
- **Escudo:** las cartas de Escudo de Aegislash bloquean los golpes de frente, como su postura (hay que flanquearlo), salvo mientras se recupera.
- **Lo que cambia un nivel en la misma carta:** densidad, velocidad, capas o puntería, nunca densidad y velocidad por encima de ×1,3 a la vez. Pesadilla añade una o dos cartas y una última carta desesperada al final de la vida. Los golpes de las cartas pegan ×1,12 en Difícil y ×1,22 en Pesadilla (encima de la tabla), con el tope de un golpe del 35 % de la vida de referencia.
- **Equidad (comprobada con tests):** hay un camino libre en cada carta, comprobado con una simulación. Quedarse quieto nunca sirve toda la carta, y tampoco junto a ningún pilar o árbol. Los avisos duran como mínimo 400 ms en los ataques de zona y 280 ms en el resto, una vez escalados. Como mucho hay dos amenazas apuntadas a la vez sobre un jugador, y las balas tienen tope.

**Aegislash, el Rey de las Espadas** (los pilares siguen parando las balas):

- **Normal:** Escudo Real «Muralla Cerrada» (dos muros de escudos se cierran desde los lados con una sola fila libre y luego abanicos apuntados; protege su frente). Filo Real «Abanico de Medianoche» (abanicos cuyos huecos se alternan, el giro de medianoche de zona, anillos de hojas y el Tajo Real: marca tu sitio, la marca se queda quieta medio segundo y cae allí cortando). Juramento «Espadas Flotantes» (fase 2: espadas en las cuatro esquinas que disparan apuntadas de dos en dos y una espiral de espadas). Edicto del Eclipse «Desfile de las Cien Espadas» (una cortina de espadas cuyo hueco serpentea, una oleada desde arriba y la siguiente desde abajo; de zona).
- **Difícil:** las mismas cartas con más densidad, velocidad o una capa estática, y la de supervivencia Juramento Eterno «Corona de Espadas» (dos espirales que giran en sentidos contrarios y muros que se cierran).
- **Pesadilla:** capas apuntadas encima, Juicio del Rey «Las Cien Espadas Vuelven» y, en el último 12 %, Última Palabra «Rey sin Reino».

**Decidueye, el Arquero de la Niebla** (los árboles siguen parando las flechas):

- **Normal:** Signo Sombra «Andanada del Arquero» (abanicos de flechas apuntados y luego sus clones desde las cuatro esquinas, de dos en dos, sobre anillos de hojas). Signo Hoja «Abanico del Claro» (abanicos de hojas con huecos que cambian y el picado sobre una marca que se fija; de zona). Signo Pluma «Plumas en Espiral» (fase 2: espiral de plumas y fuego cruzado de los clones). Signo Niebla «Lluvia del Arquero» (lluvia con un carril seco que se mueve, desde arriba y desde abajo; de zona).
- **Difícil:** más densas o rápidas, la espiral gana otra en sentido contrario, y llega la de supervivencia Signo Bosque «Bosque de Flechas».
- **Pesadilla:** capas apuntadas de los clones, Signo Sombra «Costura de Sombras» y, en el último 12 %, Última Flecha «Noche sin Luna».

**Los demás jefes con cartas (cartas «alojadas», `src/data/hosted-cards.ts`):** desde Normal, Sableye, Trevenant, Lanturn, Dhelmise, Salazzle y Nihilego también pelean con cartas, sin cambiar sus patrones. Cada carta nombra algunos de sus movimientos de siempre (el Destello de Sableye, el kelp de Dhelmise...), y su propio motor los juega igual que antes, con los trucos de su nivel. La carta pone el tramo de vida, el tiempo, la declaración y la captura. Al jefe nunca le despierta la vida por su cuenta: su fase 2 es una carta de fase 2 (declaración larga). El séquito de Salazzle se va con cada carta, así que en una declaración no queda ninguna amenaza. En Fácil siguen como estaban.

| Jefe | Normal | Difícil (+ supervivencia) | Pesadilla (+ última carta) |
|---|---|---|---|
| Sableye | Destello del Ladrón, Gemas Robadas | + Bóveda sin Fondo (12 s) | + Última Gema «El Ladrón de Sombras» (15 %) |
| Trevenant | Raíz Hambrienta, Bosque que Llora, Viajeros Perdidos | + Mil Ramas (14 s) | + Última Raíz «El Bosque no Olvida» (15 %) |
| Lanturn | Fondo Callado, Señuelo | + Luz que no Llega (12 s) | + Último Farol «Mar de Faroles» (15 %) |
| Dhelmise | Resaca, Laberinto de Látigos, Corriente del Pecio (fase 2), Juramentos Hundidos | + La Marea no Perdona (15 s) | + Vórtice sin Orilla, Último Juramento «Pecio sin Nombre» (5 %) |
| Salazzle | Danza de la Salamandra, Humo Dulce, Neblina de la Reina | + Humo de la Corte (12 s) | + Último Baile «Cortejo de la Reina» (15 %) |
| Nihilego | Nervios Ajenos, Joya Rota, Agujero Ultra (fase 2), Marea de Neurotoxina | + El Cielo se Abre (15 s) | + Aguacero, Última Grieta «La que Cayó del Cielo» (15 %) |

En partida de tres o más, el movimiento de área de grupo (sección 8) entra una vez más en cada vuelta de cada carta.

En el servidor de desarrollo, `?card=N` empieza el combate en la carta N (para capturas); también un heraldo de la Sima.

### El Santuario de los Juramentos *(provisional)*

Un altar en el Refugio del Ocaso (y la fila Santuario del menú del pueblo): «Donde los guardianes vuelven a jurar». Inspirado en los Reflejos de Fuerza y los Desafíos de *Sekiro*. Código: `src/core/shrine.ts` (puro), `src/data/shrine.ts`, `src/town/shrine-records.ts`, `src/app/shrine.ts`.

- **Reflejos.** Volver a luchar contra un jefe ya vencido (los ocho: Sableye, Aegislash, Trevenant, Decidueye, Lanturn, Dhelmise, Salazzle, Nihilego), en su propia sala y planta, en cualquier nivel de dificultad. Se lucha al nivel esperado de esa planta (`expectedLevel`, el mismo que fija el tope de un golpe), sin objetos ni mejoras de la tienda: el combate es el de verdad, no uno inflado. Los heraldos ya vistos se pueden repetir por su semilla (en la planta 22 de la Sima, sin reloj).
- **Desafíos.** Jefes seguidos: «Guardianes» (Aegislash → Decidueye → Dhelmise → Nihilego) y «Todos los juramentos» (los ocho en orden de mazmorra). Los PS pasan de un combate al siguiente (como parte de los PS máximos, al nivel del siguiente jefe) más un respiro del 30 %, tras una pausa de 2,5 s que anuncia el siguiente juramento. Se abren cuando todos sus jefes han caído.
- **Equipo.** Tras elegir jefe o desafío (y nivel) se abre el mismo selector de una partida: primero el Pokémon, luego sus cuatro movimientos, con «Comenzar el juramento» para empezar. Atrás vuelve de los movimientos al Pokémon y de ahí al santuario, en la misma fila y nivel. Usa los mismos ajustes guardados que una partida (`species` y `loadout`): lo último elegido se recuerda en los dos sitios, sin un segundo equipo que mantener. Código de la ruta: `src/app/shrine-route.ts` (puro).
- **Qué abre cada jefe.** Sale de los récords de siempre, sin migración: un guardián, al limpiar su mazmorra; un jefe intermedio, también cuando una partida pasó de su planta (su salida solo se abre al vencerlo).
- **Récords.** Por jefe y por desafío, en cada nivel: victorias, mejor tiempo (tiempo de juego, sin pausas), más cartas capturadas y «Sin rasguños» si alguna vez se ganó sin recibir un golpe (ni romper el Disfraz). Junto al mejor tiempo se guarda el Pokémon con el que se hizo (campo opcional `species`: los récords anteriores se leen igual, sin él) y la ventana lo enseña con su sprite y su nombre. Una prueba nunca cuenta como partida: no toca los récords de mazmorra. El tablón del pueblo añade una línea con los reflejos abiertos y los desafíos superados.
- **Pokémonedas.** Los reflejos no pagan nada. Cada desafío paga una vez por nivel la primera vez que se supera (150 y 300, por el multiplicador del nivel). Así no hay granja.
- **En una sala en línea.** El anfitrión usa el altar del pueblo de la sala para elegir reflejo o desafío y nivel (el nivel es el de la sala); los invitados ven su elección en el altar, sin poder cambiarla, y cada uno elige allí su Pokémon y sus ataques («Listo»: su especie llega al anfitrión con un `hello` repetido). El anfitrión empieza el juramento para todos con el `start` de siempre y un campo aditivo `trial` (tipo, jefe o desafío, nivel); la elección viaja antes en `lobby`. Los jefes se escalan por grupo como en una partida (`party` del roster al empezar), los PS de un desafío pasan por jugador, se reanima como en una partida, y la planta que viaja por la red es el número de sala (1, 2, 3…), así que un invitado nunca carga la siguiente sala por su cuenta: sigue al anfitrión (`progressSharedTrial`). Al acabar, todos vuelven al pueblo de la sala. Cada jugador guarda sus récords en local, aparte («En grupo», el campo opcional `group`) si la sala tenía dos o más; en grupo no se cobra la recompensa de un desafío. Un par de versión antigua (su `hello` no lleva `shrine: 1`) no puede jugar: el anfitrión ve «Versión antigua» y no puede empezar, y si llega tarde a un juramento en marcha se le dice que la sala está llena. El reinicio de planta no existe dentro del santuario.
- Desarrollo: `?screen=shrine` (con `&view=reflections|gauntlets|heralds`); `&trialSkip=1` empieza la prueba con el primer jefe ya vencido (capturas de la pausa y del siguiente).

### Prólogo y trasfondo *(provisional)*

El juego se abre con un prólogo de algo más de un minuto, al estilo de la apertura de Dark Souls (narración lenta en texto, cuadros quietos que salen de la oscuridad, mucha calma) pero dibujado con el pixel art de Mundo Misterioso. Se puede saltar, sale solo la primera vez que se pulsa Jugar y se puede volver a ver desde Opciones (entrada Prólogo).

Lo que cuenta:

1. Hubo una edad de luz en la que los Pokémon vivían bajo un sol que no conocía la sombra.
2. Algo despertó bajo la tierra con hambre de luz y se la fue bebiendo al sol hasta dejarlo hueco.
3. Llegó el Eclipse Carmesí: un anillo rojo sobre negro, quieto desde entonces (es la imagen del juego y el fondo de los menús).
4. Con él se abrieron las Mazmorras Sombrías. Los Pokémon que entran y vuelven ya no son ellos, solo su sombra (por eso los enemigos son versiones sombrías).
5. Cada mazmorra tiene su guardián, atado a un juramento que ya nadie recuerda, y más hondo que todas ellas algo sigue devorando la luz (se ven varios guardianes sin rostro, cada uno ante su puerta sellada; Aegislash es solo uno de ellos).
6. Negro, y una voz: "…¿Me oyes? ¿Puedes oírme?" (un guiño a Mundo Misterioso). De ahí se pasa al test de personalidad.

**Trasfondo de la Cripta del Rey de las Espadas** (primera mazmorra; subtítulo "Donde el acero aún espera órdenes"): "En lo más hondo de la cripta, el Rey de las Espadas guarda una puerta sellada. Nadie sabe si protege al mundo de lo que hay detrás, o a lo que hay detrás del mundo." Está en `src/data/dungeon-lore.ts` (con sus claves en `es` y `en`); la primera línea sale en la lista de mazmorras.

Lo que hay bajo la tierra es Necrozma, el jefe final, pero el prólogo no lo enseña ni lo nombra: solo una luz que se hunde en la oscuridad y el destello de un cristal. Todo este trasfondo es un primer borrador y puede cambiar.

### Mazmorras *(provisional)*

Cada mazmorra es un conjunto de datos (`src/data/dungeons.ts`): su nombre y su leyenda, sus plantas (generadas, o una sala fija para un jefe intermedio o para el guardián), los enemigos de sus plantas según la profundidad, sus plantas con prisa y sus pesos, su música, los colores de sus casillas y qué la abre. La primera está abierta desde el principio; cada una de las siguientes se abre al vencer al guardián de la anterior en ese dispositivo. Tras elegir el equipo, si hay más de una abierta, sale la lista de mazmorras (con su subtítulo, la primera línea de su leyenda y la mejor planta); la salida del pueblo también las lista. En partida compartida manda la mazmorra del anfitrión. Al entrar, la planta 1 enseña el nombre de la mazmorra con su subtítulo, al estilo de los títulos de fase de Touhou, y en una esquina el tema que suena ("♪ título"), que vuelve a salir cada vez que cambia la música.

**Cripta del Rey de las Espadas** (primera mazmorra, remasterizada; subtítulo "Donde el acero aún espera órdenes"). Es la puerta de entrada: la planta 1 es suave (la misma que antes, solo Poochyena y Gastly, de 1 a 2 por sala), pero se endurece al bajar. Cada planta tiene una línea corta en su tarjeta, al estilo de Touhou (en la planta 1 sale bajo el título): "Los pasillos huelen a cera y a hierro viejo.", "Aquí descansan los que juraron. Algunos no descansan.", "El tesoro del rey. Algo brilla, y no es oro.", "Las espadas caídas aún se alzan cuando pasas.", "El aire tiembla. Más abajo, el acero espera.", "La sala del trono. Arrodíllate, o desenvaina." Piedra fría, velas en las paredes, losas de tumbas en el suelo, braseros en los pilares del trono y montones de oro en la cámara del tesoro, todo dibujado en el código.

| Planta | Qué hay *(provisional)* |
|---|---|
| 1 y 2 | Plantas normales; desde la 2 puede salir un derrumbe |
| 3 | Jefe intermedio: Sableye en la cámara del tesoro (al caer se abre el camino) |
| 4 y 5 | Plantas normales; más derrumbes |
| 6 | Guardián: Aegislash en la sala del trono |

| Enemigo | Cómo juega |
|---|---|
| Poochyena | Acecha, avisa y embiste en línea recta; si la esquivas se queda vendido |
| Gastly | Flota sobre obstáculos (nunca dentro de las paredes) y lanza una bola lenta |
| Duskull | Lento, flota rodeando las paredes para seguirte y lanza un fuego fatuo que se curva hacia ti durante un par de segundos (desde la planta 2) |
| Pawniard | Sale en parejas; rápido y frágil, corta dos veces: tras el primer tajo apunta de nuevo y vuelve a lanzarse, así que rodar hacia él se paga (desde la planta 2) |
| Golett | Tanque lento al que casi no se le mueve; avisa un segundo y golpea el suelo delante de sí con la puntería fijada al empezar el aviso: rodéalo (desde la planta 4) |

**Sableye, el ladrón de gemas** (jefe intermedio). Dos cartas de hechizo en orden fijo, con su nombre en pantalla:

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Gema «Destello del Ladrón» | Se desvanece, reaparece a tu lado con un destello (dos tercios de segundo de aviso) y cruza en un tajo recto; tres veces, cada una un tercio de vuelta más allá | Apartarse de la línea cuando brilla |
| Signo Joya «Lluvia de Gemas Robadas» | Salta al centro de la cámara, avisa casi un segundo y lanza tres anillos de gemas; cada anillo deja los huecos en otro sitio | Buscar el hueco nuevo o rodar a través |

Si un tajo te alcanza, te roba el último objeto equipado (uno cada vez; sin objetos no roba nada). No lo pierdes: vuelve en cuanto golpeas a Sableye, si cae, al salir de la sala o a los 9 segundos. En partida compartida cada jugador lo vive en su lado (no viaja nada nuevo por la red). Paga como Trevenant (25 Pokémonedas).

**Aegislash, el Rey de las Espadas** (guardián). La sala del trono tiene cuatro pilares con braseros que paran cualquier disparo: sirven de cobertura. Primera fase como siempre (Escudo, que para los golpes de frente y hay que rodear, y Filo, con su combo de tres golpes). A la mitad de la vida, "El Rey desenvaina": un segundo y medio largo en el que ni para ni ataca (la ocasión), y desde ahí cambia de forma más rápido y, tras cada Filo, juega una carta de hechizo, siempre avisada y seguida de un hueco para castigar:

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Filo Real «Corte de Medianoche» | Marca un círculo a su alrededor durante algo más de un segundo, gira y lanza un anillo de doce espadas | Salir del círculo y apartarse de las espadas; después se queda abierto |
| Escudo Real «Muralla de los Juramentos» | Planta el escudo (para los golpes por todos los lados) y dispara tres abanicos de espadas hacia ti | Esconderse tras un pilar o rodar; luego baja el escudo |
| Edicto del Eclipse «Desfile de las Cien Espadas» | Marca una franja oscura en un extremo de la sala con un hueco brillante (el carril más lejos de ti) y suelta un muro de espadas de sombra que barre toda la sala | Ponerse en el hueco o detrás de un pilar, que para las espadas de su columna |

La escena antes y después del combate no cambia. Música: Aegislash y Sableye usan el tema de batalla de 16 bits.

**Bosque Brumoso** (segunda mazmorra; subtítulo "Donde la niebla es el aliento de los perdidos"). Se abre al vencer a Aegislash. Leyenda: "Quien se pierde en la niebla no vuelve: echa raíces, y escucha. En el claro más hondo, un arquero sin rostro vela una puerta que nadie ha visto abrirse."

| Planta | Qué hay *(provisional)* |
|---|---|
| 1 a 3 | Plantas normales; desde la 2 puede salir Niebla |
| 4 | Jefe intermedio: Trevenant en su hondonada (al caer se abre el camino) |
| 5 a 7 | Plantas normales; Niebla más a menudo y algún derrumbe |
| 8 | Guardián: Decidueye |

Las primeras plantas son más suaves que el final de la Cripta (un presupuesto de amenaza por sala que crece con la planta, ver "Encuentros con sentido") y se endurecen al bajar.

| Enemigo | Cómo juega |
|---|---|
| Phantump | Flota sobre raíces y troncos, no dentro de las paredes; se acerca despacio, avisa y agarra, y al agarrar recupera vida |
| Pumpkaboo pequeño | Sale en grupos de tres; rápido, frágil, embestidas cortas |
| Pumpkaboo enorme | Tanque lento; avisa mucho y golpea el suelo a su alrededor (sal del círculo o rueda) |
| Foongus | No se mueve; si te acercas suelta una nube de esporas que se queda un rato en el sitio |
| Spinarak | Anda a distancia y lanza tres hilos en abanico |
| Hoothoot | Vuela por encima de los árboles, da vueltas y se lanza en picado (a partir de la planta 2) |
| Impidimp | El bromista: amaga una embestida (la misma línea, pero parpadea), se aparta de lado sin hacer daño y embiste de verdad desde el costado. Sale desde la planta 3 con dos Pumpkaboo pequeños |
| Shroomish | Marca en el suelo dónde va a caer (le sigue hasta un cuarto de segundo antes de saltar), salta y golpea al aterrizar. Sale en parejas con un Foongus |
| Drifloon | Flota hacia ti y suelta un anillo de ocho fuegos fatuos lentos; cada vez gira el anillo medio hueco, así que el hueco de antes ya no vale. Desde la planta 2 |

Los grupos mixtos (Impidimp con sus calabazas, Shroomish con un Foongus) ocupan las casillas siguientes de la sala como un grupo normal, sin tirada extra.

**Ambiente** (dibujado en código): raíces que cuelgan de las paredes iluminadas, setas que brillan junto a las paredes, troncos caídos, a veces un pequeño santuario de piedra con su farol, luciérnagas en cada sala y dos capas de bruma que pasan despacio. Las salas fijas tienen raíces cruzando el claro, setas en los bordes y árboles viejos en sus obstáculos. Cada planta tiene su frase en la tarjeta (estilo Touhou), de "La niebla aún es joven; los árboles todavía recuerdan nombres." a "El claro más hondo. Una cuerda tensa espera en la oscuridad."

**La luz errante** (evento del bosque): en algo más de un tercio de las plantas normales desde la 2, una luz pálida aparece y flota unas casillas por delante de ti camino de un escondite con tres Bayas Aranja, en la sala lateral más alejada de la entrada (nunca la de la entrada ni la de las escaleras si hay otra). Se anuncia en el registro ("Una luz errante parpadea entre los árboles...") y desaparece cuando el escondite está vacío. Sale de la semilla de la planta, así que en partida compartida todos ven el mismo.

**Trevenant** (jefe intermedio): se acerca despacio, carga el golpe un segundo y golpea el suelo a su alrededor lanzando un anillo de hojas (si tarda más de 3,5 segundos en llegar, golpea igual); después juega su siguiente carta y vuelve a golpear. Cartas en orden, con su nombre en pantalla; todas dejan un camino libre y avisan al menos medio segundo:

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Raíz «Senderos de la Raíz Hambrienta» | Parte la hondonada en carriles de 100 px; marca uno de cada dos (siempre el tuyo) durante 1,1 s y brotan raíces medio segundo; cuando se hunden marca los otros (0,7 s) | Cambiar de carril. **Rodar no protege** (`pierceRoll`): hay que estar en otro sitio |
| Signo Hoja «Espiral del Bosque que Llora» | Cuatro brazos de hojas que giran saliendo de él, 14 ráfagas | Entre dos hojas de un brazo cabe el cuerpo de sobra lejos del árbol |
| Maldición «Anillo de los Viajeros Perdidos» | Marca un anillo a tu alrededor con un hueco hacia el lado contrario al árbol (se fija 0,3 s antes) y el anillo se cierra hacia el centro; dos veces | Salir por el hueco iluminado |

Lo que el invitado necesita para dibujarlo viaja en los campos de siempre (la carta y la oleada, el carril y el hueco en la dirección del ataque, el centro del anillo en su punto de mira).

**Decidueye, el Arquero de la Niebla** (guardián). Tres cartas de hechizo en orden fijo; el nombre de cada una sale en pantalla al empezar:

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Sombra «Matorral que Cose Sombras» | Apunta casi un segundo y suelta cinco flechas, una cada medio segundo, cada una a donde estás en ese momento | No pararse |
| Signo Niebla «Réquiem de Hojas Afiladas» | Se desvanece, reaparece en el borde del claro más lejano a ti y lanza tres abanicos de hojas; cada abanico deja los huecos en otro sitio | Buscar el hueco nuevo o rodar a través |
| Signo Búho «Picado de la Luna Hueca» | Te sigue con la mirada, fija la puntería en el último tercio del aviso y cruza el claro en picado | Apartarse de lado cuando la línea se fija; después se queda mucho tiempo abierto |

**Fase 2** (a la mitad de la vida, una vez, nunca a mitad de un golpe y nunca en un eco de la Sima): "El Arquero se desvanece en la niebla", se desvanece 1,6 s sin atacar (la apertura) y vuelve arriba del claro con un orden más denso: Lluvia, Abanico, Plumas, Picado, Costura.

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Lluvia «Aguacero de Flechas del Ocaso» | Parte el claro en 8 carriles y llueven flechas en todos menos uno; el carril libre es el de al lado del tuyo y se mueve un carril en cada oleada (tres) | Pasar al carril libre, o ponerse bajo un árbol. **Rodar no protege** (`pierceRoll`). Aviso de 1,2 s y luego 0,8 s, cuando ya han caído las flechas anteriores |
| Signo Pluma «Espiral de Plumas Sombrías» | Se desvanece, reaparece en el centro y suelta cinco brazos de plumas en espiral | Moverse entre las plumas de un brazo |
| Signo Sombra «Costura de Sombras Gemelas» | Dos clones de sombra en las esquinas del lado contrario y él mismo apuntan al mismo punto (se fija 0,3 s antes) y lanzan una línea de flechas cada uno; tres veces | Salir del punto cuando las líneas se fijan |

**El claro** tiene cuatro árboles viejos cuyos troncos paran flechas, hojas y plumas, como los pilares de la Cripta. Para que el juego vaya fluido nunca hay más de 160 proyectiles enemigos a la vez (si se llega, el patrón sale más ligero, nunca más difícil).

Antes del combate: "La niebla te ha traído hasta el claro. Aquí acaban los caminos. Velo esta puerta desde que el sol se apagó. Nadie la cruza mientras me quede una flecha." Al caer: "Mi juramento era una cuerda tensa. Al fin descansa. Bajo las raíces algo sigue bebiendo la luz. Lo oigo respirar en la niebla."

**Niebla** (planta con prisa del bosque; valores *provisionales*): al llegar ves 7 casillas a tu alrededor; tras 3 segundos la niebla se cierra poco a poco hasta 2,5 casillas en 50 segundos. Fuera de ese círculo todo es niebla, el minimapa solo apunta lo que has tenido dentro y no enseña enemigos fuera de él. Cuando se ha cerrado del todo, el frío quita un 3 % de la vida máxima cada segundo y medio, sin bajar nunca de 1 PS (aprieta, no mata). Se anuncia en la tarjeta con "¡La niebla se cierra!".

**Música del bosque**: "Cathedral in the forest" (congusbongus, CC0) en las plantas; en Niebla, el mismo tema apagado con un filtro paso bajo; Trevenant usa el tema de batalla de Aegislash y Decidueye "Boss Battle #2 [Symphonic Metal]" (nene, CC0), que ya estaba en el juego y gustaba.

**Cuevas Inundadas** (tercera mazmorra; subtítulo "Donde la campana ahogada aún llama a los suyos"). Se abre al vencer a Decidueye; su boca es una escalera hundida al final del embarcadero de la Aldea del Lago Negro. Leyenda: "Bajo el Lago Negro duerme un santuario hundido; su campana suena en cada eclipse. Dicen que un ancla sin barco vela el fondo, atada a un juramento que nadie recuerda." Una línea por planta, al estilo de Touhou: "El agua gotea de un cielo de piedra. Cada gota suena a campana lejana.", "Los cristales guardan la última luz que cayó aquí. Algo se la está bebiendo.", "En las charcas flotan cabos de barco. Ningún barco llegó nunca tan hondo.", "El agua te llega a los tobillos. Más abajo, algo tira de ella.", "Una gruta de luz azul. Ese farol no está ahí para guiarte.", "Pasado el farol, solo queda la luz que tú traes.", "Las paredes rezuman sal. Aquí juraron marineros que nunca volvieron.", "La campana suena más cerca, y no hay corriente que la mueva.", "El agua está tibia, como si algo enorme respirara debajo.", "El pecio. Un ancla vela a una tripulación que se hundió con su juramento." Piedra azul y mojada, cristales que laten en las paredes, gotas que caen y dejan ondas, charcas poco hondas con el borde más oscuro donde tocan la roca, todo dibujado en el código.

| Planta | Qué hay *(provisional)* |
|---|---|
| 1 a 4 | Plantas normales; desde la 2 puede salir Inundación |
| 5 | Jefe intermedio: Lanturn en su gruta (al caer se abre el camino) |
| 6 a 9 | Plantas normales; más Inundación y algún derrumbe |
| 10 | Guardián: Dhelmise en el pecio |

Agua poco honda: más o menos la mitad de las salas (nunca la de entrada) tienen una charca; pisarla frena al 70 % a quien ande y no sea de tipo Agua (los que vuelan o flotan pasan por encima). Las charcas salen de la semilla de la planta, igual en todos los jugadores.

| Enemigo | Cómo juega |
|---|---|
| Krabby | Se acerca de lado, como un cangrejo, avisa y embiste con la pinza; en difícil y pesadilla encadena una segunda pinza apuntada otra vez |
| Remoraid | Guarda la distancia, fija un carril y dispara una ráfaga de tres chorros por él (cinco en difícil y pesadilla): apártate de lado |
| Shellos | Lento; lanza barro a donde estás (el círculo te sigue y se queda quieto mientras vuela) y deja un charco; en difícil y pesadilla el golpe salpica un anillo de gotas |
| Zubat, Tentacool, Corphish, Chinchou, Wooper, Clauncher | Los del plantel experimental, ahora con mazmorra propia (Zubat en grupos de tres) |

**Inundación** (planta con prisa de las cuevas; valores *provisionales*): tras 4 segundos el agua sube durante 45 segundos; quien no es de tipo Agua anda cada vez más lento, hasta un 45 % más lento con el agua arriba, y desde entonces el frío quita un 2 % de la vida máxima cada 2 segundos, sin bajar nunca de 1 PS. Los de tipo Agua no notan nada. Se anuncia con "¡El agua sube!"; en esas plantas la música suena como desde debajo del agua.

**Lanturn, el farol del abismo** (jefe intermedio). Jefe de cortina de balas: tres cartas de hechizo en orden, cada una con su nombre en pantalla, avisada y seguida de un hueco para castigar. Cuatro rocas con cristales paran sus disparos.

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Burbuja «Anillos del Fondo Callado» | Cuatro anillos de burbujas; cada uno deja un hueco, el primero hacia ti y los siguientes girando | Seguir el hueco |
| Signo Farol «Espiral del Señuelo» | Su farol escupe chispas en una espiral de dos brazos que gira | Moverse en el hueco entre brazos |
| Signo Abismo «Descarga del Pez Linterna» | Marca un círculo grande a su alrededor más de un segundo y descarga | Salir del círculo andando: rodar no te salva |

**Dhelmise, el Ancla de los Juramentos Hundidos** (guardián). Pelea en el pecio: la proa y la popa del casco y dos rocas paran burbujas y algas en su columna. En difícil cada jefe añade un truco (un brazo más en la espiral); en pesadilla, una carta más (Lanturn: Signo Hondura «Mar de Faroles»; Dhelmise, en la segunda fase: Signo Naufragio «Vórtice sin Orilla»).

| Carta | Qué hace | Cómo se esquiva |
|---|---|---|
| Signo Ancla «Resaca de la Campana Ahogada» | Avisa un segundo y barre tres cuartos de vuelta con el ancla | Salir de su alcance o ponerte en el cuarto de atrás; rodar no te salva |
| Signo Marea «Remolino de los Ahogados» | Un remolino de burbujas en espiral de dos brazos | El hueco entre brazos |
| Signo Alga «Laberinto de Látigos» | Tres muros de algas cruzan la sala desde el extremo lejano, con un carril libre que se mueve a cada muro | Ponerse en el carril libre (o tras el casco) |
| ¡El ancla despierta! | A la mitad de la vida, una vez y nunca a mitad de carta: un segundo y medio sin atacar (la ocasión) | Pegarle |
| Signo Fantasma «Corriente que Sube del Pecio» | Se hunde; una marca te sigue y se queda quieta al final; sale bajo ella, golpea y lanza un anillo con un hueco | Salir de la marca cuando se fija; rodar no te salva |
| Signo Campana «Tañido de los Juramentos Hundidos» | Cinco anillos de burbujas con hueco que gira | Seguir el hueco |

En la segunda fase juega Corriente, Algas, Campana y Ancla, y descansa menos. Ninguna carta suelta más balas de las que caben (90 Lanturn, 110 Dhelmise): si la sala está llena, la bala sobra y el hueco solo crece. Los ataques de posición (la descarga, el ancla y la corriente) son de zona (`pierceRoll`, sección 9): rodar no los esquiva, se avisan con el doble borde blanco y violeta, el «!» y su sonido (la corriente marca el círculo donde va a salir), y valen igual para quien juega como invitado. Además de esos topes de cada jefe, ninguna sala pasa nunca de 160 balas enemigas (`ENEMY_SHOT_CAP`).

Antes del combate: "La campana te ha traído hasta el pecio. Aquí el agua no deja volver. Juré guardar a los que se hundieron conmigo. Nadie recuerda ya el juramento, pero el ancla sí." Al caer: "La cadena se suelta. Por fin puedo bajar con ellos. Más hondo que el fondo, algo se traga la luz. La campana sonaba para avisaros."

**Música de las cuevas**: "Underwater" (Cleyton Kauffman, CC0) en las plantas, con un filtro paso bajo en Inundación; Lanturn usa el tema de batalla de 16 bits y Dhelmise "Fairy Boss Battles" (MintoDog, CC0). Lanturn paga como los otros jefes intermedios (25 Pokémonedas).

**Sima del Eclipse** (mazmorra sin fondo y contrarreloj, al estilo de la Isla Cero de Mystery Dungeon; subtítulo "Donde la luz cae y nunca toca fondo"). Abierta desde el principio: es la que más se va a jugar en directo. Datos en `src/data/endless.ts`, reglas en `src/core/endless.ts`; todos los valores son *provisionales*.

- **Plantas sin fin**: todas generadas, salvo una de cada cinco y, desde la 22, las acabadas en 2 (los **Heraldos del Eclipse**, abajo). En las 10, 20, 30... espera el jefe propio de la Sima, el **Eco del Eclipse** (abajo); en las 5, 15, 25... un **eco del guardián**: Aegislash, Trevenant, Decidueye, Dhelmise y Nihilego por turnos, en su sala (Trevenant es jefe intermedio, pero la Sima lo recuerda como guardián: en la Sima, «guardián» es todo jefe atado a un juramento, y el Santuario cuenta los ocho como juramentos, `shrine.count`, «Todos los juramentos»; el título estricto «Guardián de {dungeon}» del Santuario sigue siendo solo de los cuatro), más fuertes según la profundidad (desde la 35, una de cada dos es una herida de Senda: «El lore de la Sima», abajo). Solo sale su nombre ("Eco del guardián · Planta 5", o «Guardián sin rostro» si aún no lo has vencido), sin cinemática; al caer se abre el camino arriba de la sala. El eco de Aegislash pelea en la sala del trono de la Cripta, con sus cuatro pilares, pero solo con la primera fase: nunca desenvaina (el eco es más corto, pega más con la profundidad y el reloj corre); igual Decidueye, Dhelmise (en el pecio) y Nihilego (en la grieta), que nunca despiertan su segunda fase como ecos.
- **Enemigos**: una sola lista (especie, planta mínima, peso y, si hace falta, cuánto cambia el peso por planta) con los de la Cripta (también los nuevos de la Cripta renovada: Duskull y Pawniard en pareja desde la 2, Golett desde la 3; Sableye se queda en su cámara), el Bosque, el plantel experimental, las Cuevas Inundadas (Krabby desde la 6, Remoraid desde la 7, Shellos desde la 8) y el Pantano Tóxico (Venipede en pareja desde la 9, Salandit desde la 10, Skrelp desde la 11; Lanturn y Salazzle se quedan en su mazmorra); los enemigos nuevos entran en la Sima con añadir una línea. **Más duros, no más**: nunca más de 3 enemigos por sala (un grupo cuenta dentro de los 3); con la profundidad pesan más los duros (Golett, Pumpkaboo grande, Grimer, Slugma, Houndour, Clauncher, Croagunk, que además salen una o dos plantas antes) y menos los flojos (Poochyena, Zubat, Pumpkaboo pequeño, hasta un cuarto de su peso, nunca cero). Desde la planta 1 la vida sube un 5 % y el daño un 3,5 % por planta (como mucho ×3 y ×2,5); los ecos tienen el 60 % de esa vida.
- **Élites** (un solo sistema con los de los niveles de dificultad, §9): cada enemigo puede salir élite con la mayor de dos probabilidades, la del nivel (0, 10, 20 o 30 %) y la de la profundidad (desde la 6, un 6 % y un punto y medio más por planta, como mucho un 40 %). Se elige con la semilla de la planta, así que todos los jugadores ven los mismos. Un élite de la Sima tiene un 35 % más de vida (encima de la de su rasgo), brilla del color de su rasgo y lleva uno de los seis de la tabla común: **robusto** (vida ×1,5), **frenético** (esperas al 65 %), **rápido** (actúa un 30 % más deprisa), **ráfaga** (solo los que disparan: dos tiros más a los lados de cada uno), **acorazado** (el primer golpe no le hace nada) o **furia** (un 50 % más deprisa por debajo del 40 % de vida). Desde la 21, un 30 % de los élites golpean "a posición": la voltereta no les salva (`pierceRoll`, la regla de §9, con su borde blanco y violeta, su "!" y su aviso). *Decisión de integración*: la mayor y no la suma, para que la Pesadilla ponga élites desde la planta 1 sin que en lo hondo casi todo brille.
- **Escuadras** (desde la 4): una sala con dos o más enemigos puede cambiarlos por una escuadra que mezcla papeles, un 15 % y un punto y medio más por planta, como mucho un 50 %, nunca con más enemigos de los que tenía: Golett con Duskull, Pawniard con Gastly y otro Pawniard, Croagunk con Spinarak, Pumpkaboo grande con Hoothoot y Litleo, Grimer con Houndour y Chinchou, Clauncher con Pawniard y Koffing, Krabby con Remoraid (12), Shellos con Krabby y Tentacool (16), Salandit con Skrelp (18), Venipede con Skrelp y Salandit (22). Plantas con prisa de todas las mazmorras: derrumbe desde la 2 y Niebla desde la 3, un 8 % cada una y un punto más por planta, como mucho un 22 %.
- **Reloj**: empieza en 8:00 y baja con el tiempo de juego (solo se para con la partida en pausa jugando solo: menú, elección de objeto o una cinemática; en compartida nunca se para). Bajar de planta suma 40 s, 2 s menos por planta y nunca menos de 15 s; vencer un eco suma 60 s más. A las 0:00 el eclipse se traga la planta y la partida acaba como marca, no como derrota (sin el recorte de las Pokémonedas). En pantalla, grande arriba en el centro; por debajo de 30 s se pone rojo, late y suena un tic cada segundo; cuando suma tiempo sale "+40 s".
- **Modo puro**: se empieza a nivel 1, sin objetos y sin las mejoras permanentes de la tienda, para que las marcas se puedan comparar (lo dice la tarjeta de entrada); los movimientos aprendidos y sus Mejoras sí cuentan, y cada marca guarda su equipo. Lo que se encuentra dentro (niveles, objetos, bayas) funciona como siempre.
- **Marca**: la planta más honda y, a igualdad, el tiempo que quedaba. Las diez mejores del dispositivo se guardan aparte de los récords y salen en el tablón del pueblo y en la pantalla final, con el modo, la fecha y la semilla.
- **Ranking global** (`odd/tasks/sima-global-ranking.md`, `src/town/global-ranking.ts`): bajo las marcas del dispositivo, el tablón del pueblo enseña «Sima del Eclipse, ranking global (Normal):» del nivel elegido ahora, con la mejor marca de cada cuenta en ese nivel (la planta más honda y, a igualdad, el tiempo que quedaba), las seis primeras de dos en dos; tu apodo sale con «(tú)» y, si no estás entre las seis, tu fila va al final. Cada nivel tiene su propio ranking; cuentan el reto diario y el libre, y las marcas sin nivel (de antes de los niveles) son de Fácil. Sale de las partidas en la nube que ya existen (`GET /api/sd/ranking/sima?tier=`, `server/README.md`), sin subir nada nuevo: no está verificado (es un ranking entre amigos; el verificado con repeticiones sigue en `docs/backend-accounts-plan.md`). Solo aparecen las cuentas con perfil público (su apodo); los invitados no aparecen y, como sin cuenta el juego no hace ninguna petición, un invitado ve «inicia sesión en «Cuenta» para verlo y aparecer en él». Nunca bloquea el pueblo: lee lo que hay ya (se pide al abrir el pueblo y se guarda 60 s), así que sale «cargando…» o «no se puede consultar ahora» si aún no llegó o no hay red, y «aún no hay marcas» si nadie tiene. En cooperativo cada jugador guarda su propia marca al acabar la Sima (también los invitados de la sala), así que cada cuenta del grupo aparece con la suya; el tablón de la sala enseña el nivel del anfitrión.
- **Modos**: "Reto diario" usa una semilla sacada de la fecha UTC, así todo el chat juega el mismo mapa ese día; "Libre" usa una semilla al azar. La tarjeta de entrada enseña la semilla del día.
- **Pokémonedas**: las reglas de siempre por la mitad (la línea "Tarifa de la sima ×0.5"), para que no sea la mejor forma de farmear.
- **Música**: rota los temas de planta por tramos de cinco (Cripta, Bosque); cada eco lleva el tema de su guardián.
- **Estratos** (cada 10 plantas, en `src/data/sima.ts`): la Sima cambia de aspecto al bajar. Plantas 1 a 10, "Estrato I · Ecos de la Cripta" (los colores, velas y lápidas de la Cripta); 11 a 20, "Estrato II · Raíces del Bosque Hundido" (los colores y la decoración del Bosque); 21 a 30, "Estrato III · La Campana Ahogada" (los de las Cuevas Inundadas); 31 a 40, "Estrato IV · El Cielo Envenenado" (los del Pantano Tóxico); de la 41 en adelante, "Estrato V · El Abismo bajo el Anillo": las salas son islas de roca flotando sobre la nada, con su cara de abajo a la vista, bordes rojos y una lluvia de luz roja que cae sin tocar fondo. Detrás de todo, donde antes había negro, cuelga el eclipse (un disco negro con corona roja que crece con la profundidad) con torres hundidas y rocas a lo lejos, en dos capas que se mueven a distinta velocidad. El primer piso de cada estrato abre con su tarjeta (nombre y subtítulo, al estilo Touhou) y vuelve a enseñar el "♪" del tema; cada planta lleva en su tarjeta una línea del estrato, por turnos.
- **Sucesos** (`SIMA_EVENTS`): como mucho uno por planta, desde la 2, un 35 % y un punto más por planta, como mucho un 60 %, multiplicado por la frecuencia de encuentros del nivel (×1,2 normal, ×1,5 difícil, ×2 pesadilla, como mucho siempre; `encounterChance`); nunca en ecos ni en plantas con prisa ni en la sala de salida. Cada uno sale desde su planta mínima, con su peso:
  - **Cristal del tiempo** (desde la 2): +20 s si lo tocas antes de 40 s; luego se apaga. Un arco alrededor enseña lo que le queda.
  - **Cámara del tesoro** (3): dos guardianes con un 50 % más de vida; con ellos fuera, el cofre se abre y ofrece elegir uno de tres objetos.
  - **Eco mercader** (3): vende con las Pokémonedas de la expedición una Baya Aranja (8 P, cura el 40 %, dos por visita) o un objeto (20 P); lo gastado no se cobra al salir.
  - **Altar del Eclipse** (4): un pacto al estilo Hades, un don por un precio durante esta planta y las dos siguientes: Filo del Eclipse (+30 % de daño, enemigos un 20 % más rápidos), Sangre de Luna (curación completa y +10 % de daño, enemigos pegan un 30 % más), Arena Detenida (+30 s, enemigos un 10 % más rápidos y un 15 % más fuertes). Se puede rechazar. En pesadilla el precio pesa la mitad más. En compartida decide el anfitrión (el pacto ata a todo el grupo).
  - **Emboscada** (4): al cruzar a la sala el suelo se agrieta (0,9 s de aviso con "!") y salen tres enemigos ya despiertos.
  - **Nido del Eclipse** (5): un nido con vida que, mientras hay alguien cerca, brilla 1,2 s y saca un enemigo flojo cada 5 s (como mucho 3 vivos; no dan experiencia ni monedas) hasta que lo rompes.
  - **Casa de monstruos** (6): una sala con cinco dormidos más que despiertan todos a la vez al entrar.
  - **Sala de oleadas** (7): al entrar se cierran las puertas; tres oleadas (2, 3 y 3; en pesadilla una cuarta de 3, `encounterWaves`) con 1,5 s entre ellas y un contador; al acabar se abren, dan +15 s y un objeto a elegir.
  - **Sabueso del Eclipse** (9): a los 7 s de empezar la planta (antes desde difícil) sale de la sala de entrada un perseguidor imposible de vencer; anda más despacio que tú (100 frente a 140) y avisa sus embestidas casi un segundo antes. La salida es la escalera.
  En el minimapa sale un rombo del color del suceso en cuanto lo has visto; los que no son sorpresa se anuncian al llegar a la planta. La pantalla final enumera los sucesos de la partida (los cuatro últimos y cuántos hubo antes).
- **Eco del Eclipse** (plantas 10, 20, 30...): el jefe propio de la Sima, una sombra corrompida **de ti** (decisión del 26-10-2026: «una versión corrompida de ti, no solo de Mimikyu»). Lleva las hojas de sprite de la especie con la que juegas, en su forma actual, en negro y rojo y con un halo, y se llama «Eco de Zorua». En cooperativo los ecos se turnan entre los Pokémon del grupo: el primer encuentro copia al jugador p1, el siguiente al p2 y así (por orden de id, con la lista de jugadores del anfitrión, así que todos ven el mismo). Al aparecer deja una frase en el registro («El eclipse te devuelve una sombra con la forma de Zorua. Hueca y roja.»), una de tres por turnos. Solo cambia el aspecto y el nombre: sus cartas son las mismas copie a quien copie (`echoMimic` en `src/core/eclipse-echo.ts`; la simulación nunca lo lee, y un test lo comprueba con todas las especies jugables). Flota arriba de una sala abierta y juega cartas de bullet hell con nombre: «Anillo sin Cierre» (anillos con un hueco que gira un poco en cada oleada), «Espiral del Último Rayo» (tres brazos), «Tres Refugios bajo el Sol Negro» (la sala arde salvo tres refugios; la voltereta no salva), «Lluvia de Luz Roja» (muros de luz que caen con un hueco que nunca salta más de lo que se puede andar), «Dos Sombras, Un Eco» (dos espirales en sentidos opuestos) y «El Anillo se Cierra» (un anillo que se cierra con un hueco; la voltereta no salva). Dos cartas en la 10 y una más cada diez plantas (una más desde difícil, como truco de `src/data/sima-tricks.ts` leído por `behaviourFor`), hasta las seis. Siempre hay paso; nunca más de 110 tiros suyos a la vez (`maxShots`, bajo el tope global de 160). Los refugios y el anillo son ataques a posición con su aviso de §9 (borde doble en los refugios y en el anillo, "!" sobre el Eco). Solo sale su nombre ("Planta 10 · La sombra que bajó contigo"), sin cinemática; al caer suma 60 s y abre el camino arriba.
- **El Eco crece en cada encuentro** (`src/core/eclipse-escalation.ts`): además de la carta nueva de cada encuentro (una familia de patrones más), sus andanadas se hacen más densas (+6 % por encuentro, como mucho ×1,3, el tope de la regla de equidad; los anillos guardan el mismo hueco en grados y los muros el mismo carril; la velocidad y el tope de tiros no cambian), pasa de carta a carta más deprisa (el descanso −7 % y la apertura −4 % por encuentro, con suelos del 60 % y el 75 %) y su nombre cuenta los encuentros: «Eco de Zorua · III». El primer encuentro es el Eco tal cual.
- **Heraldos del Eclipse** (jefes procedurales; plantas 22, 32, 42..., desde el Estrato III: los dos primeros estratos se quedan con los ecos hechos a mano; `src/core/herald/`): cada planta acabada en 2 desde la 22 es un piso de jefe con un heraldo generado de la semilla de la partida y la planta (el reto diario da a todos el mismo heraldo y la misma cinemática). Pelea en el Abismo, la sala abierta del Eco con cuatro pilares bajos que paran tiros. Estructura de Touhou sobre el marco común de cartas (`src/core/cards.ts`, que también pueden usar los jefes hechos a mano):
  - **Cartas**: 3 hasta la planta 40, 4 hasta la 70 y luego 5 (pesadilla, una más; como mucho 5). Cada carta tiene su tramo de vida (tramos iguales, la barra los marca) y su temporizador (unas cinco tandas, entre 22 y 48 s). Vaciar el tramo pasa a la siguiente; si se acaba el tiempo, la carta termina sin premio y la vida baja al suelo del tramo (en la última, el heraldo se desvanece). Al cambiar de carta se borran sus tiros. Desde la carta del medio despierta (una apertura corta) y juega las versiones de fase 2 según su regla: prisa (menos descanso), espejo (espirales y ondas con su reflejo), capa (una espiral ligera más) o parpadeo (pasa a teletransportarse).
  - **Dentro de una carta** repite una tanda: va a su siguiente ancla según su forma de moverse (quieto, a la deriva entre dos anclas, teletransporte con destello o embestida entre tres o cuatro), avisa (la marca es donde estaba el jugador al empezar el aviso), ataca y deja una apertura hasta que sus tiros han salido de la sala.
  - **Gramática de patrones** (`src/core/herald/patterns.ts`), 1 a 3 capas compatibles por carta (los campos, muros, anillo que se cierra y refugios, solo con una compañera estática ligera): ráfaga apuntada o que sigue al jugador, anillo con hueco (estático o apuntado, el hueco gira), espiral de 1 a 4 brazos (con espejo), onda senoidal, muros con carril seguro (desde arriba o abajo, o desde un lado), anillo que se cierra con hueco hacia el jugador, dispersión de ángulos sembrados (aleatoria pero acotada y igual en todos los clientes), orbes lentos que persiguen (pocos), láseres como carriles rápidos con línea de aviso, refugios en una sala que arde (posicional: la voltereta no salva) e invocación de esbirros flojos. Perillas: densidad, velocidad, brazos, tamaño de hueco, giro y puntería.
  - **Equidad demostrada** (`src/core/herald/fairness.ts`): ninguna carta se juega sin pasar la prueba; si falla, se descarta y se saca otra (muestreo por rechazo; si una casilla sigue fallando, una espiral sencilla también probada). Reglas: aviso ≥ 400 ms si la carta pide elegir (hueco, carril, refugio, láser) y ≥ 280 ms si no, después de la escala del nivel y del suelo del juego (`effectiveTelegraphMs`, la misma regla que usa el reloj de los enemigos; los refugios cuentan como aviso posicional); línea de láser ≥ 400 ms; como mucho 2 amenazas apuntadas al jugador por carta y 3 capas; densidad y velocidad nunca las dos por encima de ×1,3 y su producto ≤ 1,95; orbes a ≤ 60 % de la velocidad del jugador, como mucho 3; ráfagas que siguen al jugador que un paso lateral esquiva; el pico de tiros en el aire bajo su tope (130, bajo el global de 160), para que el tope nunca decida el patrón. Y por simulación: la tanda entera se juega en una rejilla de 8 px, desde cada ancla y desde 9 posiciones de salida (las capas apuntadas se reapuntan a cada una), andando una casilla por paso a la velocidad real del jugador (sin voltereta, que solo ayuda); cada tiro marca su cápsula barrida inflada por el radio del jugador, y los refugios ardiendo marcan todo lo de fuera; la carta solo vale si desde cada salida queda siempre una casilla a la que llegar. Los tests vuelven a probar todas las cartas de 240 semillas en cada ejecución (2520 semillas en una auditoría larga, `HERALD_AUDIT_SEEDS`), con controles negativos que la prueba sí rechaza.
  - **Quién es**: lleva las hojas de sprite de una especie dramática de las que ya están en `public/sprites` y tienen todas las animaciones que usa (Idle, Walk, Attack, Shoot, Charge, Hurt) sin sustituta (leído de `sprite-meta.json`; los iniciales nunca), dibujada al doble si su hoja es pequeña, con un halo del color de su tipo; sus tiros son de su tipo. Su nombre es propio, de sílabas originales («Vaelorion»), con epíteto y epígrafe en español e inglés de listas de palabras propias («la Viuda de los Relojes Perdidos», «Lo que la luz no alcanza, lo hereda»), y sus cartas «Signo Tema «Nombre»» («Signo Abisal «Vórtice Hundido»»). Nunca se copian nombres, arte ni música de Touhou: solo la geometría de las balas sirve de inspiración.
  - **Cinemática de entrada** (`src/ui/herald-intro.ts`, `src/adapters/herald-scenes.ts`, en el motor de las cinemáticas de guardián): 4 a 6 s compuestos de su definición y su semilla. La sala oscura aparece bajo el eclipse que late, la silueta llega según cómo se mueve (baja del cielo, sale del suelo o aparece con un destello), la cámara se acerca y el suelo tiembla al aterrizar sobre un golpe de timbal generado; luego el gran título en el color de su tipo: nombre, epíteto y epígrafe. Entera la primera vez que el dispositivo ve esa semilla (el bestiario); después, 2 s de título. Se salta manteniendo Esc o Enter (o el dedo en pantalla). Jugando solo pausa; en compartida nunca: solo sale la tarjeta del nombre sobre la partida.
  - **Un solo marco de cartas** (integración con los guardianes de cartas de §9): el heraldo juega sus capas probadas, pero con las reglas comunes de `src/data/cards.ts`: tramos iguales de `hpShare` (los golpes no bajan del suelo del tramo mientras la carta sigue), el anuncio entre cartas (0,7 s invulnerable, sin tiros; el resultado de la carta anterior va con él), los mismos eventos (`bossStance`, `spellCardEnd`, `cardCaptured`) y el mismo juez de captura (`updateCapture`, cada cliente para su jugador).
  - **Captura**: la misma regla y el mismo premio que los guardianes: superar una carta (rota) sin recibir golpes (un golpe a Disfraz también cuenta) devuelve un 12 % de la vida máxima y paga 8 Pokémonedas a cada jugador que no fue golpeado (en la línea del guardián); agotar el tiempo no paga, tampoco en la última carta. El HUD enseña su nombre y la carta en juego («2/4») sobre la barra con las muescas de los tramos y, al anfitrión o jugando solo, los segundos que le quedan a la derecha; el nombre de la carta sale en el cartel al empezarla y el registro avisa de cada captura y cada carta agotada. `?card=N` también vale para un heraldo (con `?boss=`).
  - **Cooperativo**: el anfitrión manda; cada cliente regenera el heraldo con la misma semilla y en la instantánea solo viajan los campos de jefe de siempre (la carta en `stance`, la tanda, la marca y el progreso). Los refugios ardiendo se comprueban en el cliente de cada jugador.
  - **Bestiario**: los heraldos vistos se guardan en el dispositivo; el tablón del pueblo enseña cuántos («Heraldos del Eclipse vistos: 7»).
  - **Desarrollo**: `?boss=<semilla>` (con `&floor=32` opcional) pelea contra ese heraldo en un piso de heraldo.
- **Ritmo**: cada planta empieza con 3 s de respiro en los que el reloj no corre. El tiempo ganado sale grande bajo el reloj, en verde, con el motivo debajo ("por bajar", "eco vencido", "cristal del tiempo"...).
- **Cooperativo** (sucesos): el anfitrión lleva el suceso de la planta y el pacto y los manda con su instantánea; cada invitado los coloca con la misma semilla y cierra o abre las puertas de la sala de oleadas en su propio mapa. El mercader es de cada jugador.
- **El lore de la Sima** (`docs/sima-redesign.md`, decisiones del dueño del 26-10-2026). La regla: **lo mecánico sale de la semilla; lo narrativo sale de tu memoria**. Qué jefe, qué sala y qué suceso dependen solo de la semilla (el reto diario es el mismo para todos, y un test lo comprueba con dos memorias distintas); qué nombre ves, qué línea lees y qué cinemática se abre dependen de lo que has vivido en este dispositivo.
  - **Los Caminantes de la Sima** (nombre en `lore.reborn.name`, «Caminantes de la Sima» / "Sima Walkers"; singular `lore.reborn.one`; en los textos, `{called}` y `{calledOne}`): todo Pokémon jugable es una persona que renació como Pokémon (la premisa de Mundo Misterioso). Contestó a la voz del prólogo, despertó dentro de un Pokémon con sus recuerdos y sus heridas y con una sombra que no lo suelta. **La sombra** (decisión del dueño, 27-10-2026): mientras baja, su sombra tira de él hacia abajo; cuando se pierde, lo sube, solo porque necesita un cuerpo vivo al que volver: no lo salva, lo guarda. En cada bajada se bebe un poco más de él (el Eco del Eclipse es la parte ya bebida, y por eso hay que vencerlo). La Caminante de Croagunk, que volvió once veces y a la duodécima solo subió su sombra, es el final de ese camino: la sombra ya no la necesitaba. No eres el único; hay Caminantes a los que su sombra ya no necesitó. **Cómo se vuelve uno sombra** (decisión del dueño, 27-10-2026): una sombra es lo que queda cuando tu sombra ya no te necesita. Normalmente pasa despacio (cada bajada se bebe un poco más de ti: el prólogo, la Caminante de Croagunk); la noche del Eclipse pasó de golpe a los que estaban en la plaza (Senda de Mimikyu), y por eso esa noche es la herida de todo el pueblo.
  - **Las Sendas son heridas de otros** (decisión del dueño, 27-10-2026), casi siempre de los vecinos, no el pasado del propio Caminante: el Cubone pescador de la Aldea del Lago Negro es el Cubone de la Senda, y lo mismo Litwick, que guarda la llama en la aldea, y Mimikyu, el del puesto de la suerte. Las otras cinco tienen vecino desde el 27-10-2026: Abra duerme en un rincón del Refugio; Axew entrena solo en su linde; Zorua es un niño callado en la plaza de la aldea; Piplup, junto al agujero del embarcadero; Shinx, en el borde del cráter (`src/data/world.ts`). Para bajar con ellos, la Sima te hace llevar su forma: abajo solo se entra con la forma de la herida a la que acompañas. Por eso una Senda solo se juega con su línea, y por eso el texto dice «baja contigo». Si el test te hizo Cubone, eres otro Cubone, un Caminante. Al cerrar el primer capítulo de su Senda el vecino te reconoce y dice otras líneas (`src/town/residents.ts`, lee el `story` de la partida, el mismo que la galería; solo y en sala); Zorua no se quita el disfraz hasta cerrar el III. El vínculo es con él. Qué cuesta llevar la forma de otro es un misterio (`docs/lore/lore.md`, sección 8).
  - **Por qué bajas**: a por los que no volvieron. Todo lo que no volvió de las mazmorras acaba cayendo por la grieta; en el Lago Negro todos tienen un nombre que no volvió. La Sima sigue abierta desde el principio. En la Sima, abajo es hacia el eclipse: el anillo rojo pasa de estar encima a estar debajo de las islas del Estrato V.
  - **Lucidez**: el reloj se llama así en el HUD («LUCIDEZ» encima del tiempo), en la tarjeta de entrada y en la pantalla final; las cantidades no cambian. A las 0:00 **te pierdes**: tu sombra te sube hasta el borde del cráter, porque aún le haces falta (la pantalla final «Te has perdido», con las mismas recompensas y la misma marca que antes).
  - **Estratos como etapas de la caída**: los subtítulos son ahora la etapa (I «Lo que conoces», II «Lo que temes», III «Lo que nombras», IV «Lo que no es tuyo», V «Lo que queda de ti»), y una de las líneas de cada estrato la dice.
  - **Memoria** (`src/app/sima-lore.ts`): un eco de guardián que aún no has vencido sale como **Guardián sin rostro** («Tu cabeza no tiene con qué darle cara»), en silueta, también en la barra de jefe y en el registro; vencido, con su nombre. Una sombra de Senda cuyo capítulo no has cerrado es **Sombra de alguien**; una herida de una Senda sin ningún capítulo cerrado, **Una herida que no es tuya**; reconocidas, salen con su nombre, su epíteto de la Senda y una línea en el registro («Es Dusknoir. Cubone ya lo dejó atrás. Este no lo sabe.»). La pelea es la misma. Cada jugador de una partida compartida lee su propia memoria.
  - **Heridas** (`src/core/sima-story.ts`): en las plantas 35, 55, 75... (`ENDLESS.wounds`) una herida de Senda ocupa el sitio del eco de guardián, en su propia sala, con los 60 s del eco y el camino arriba. El turno de los guardianes se salta esas plantas, así que los cinco siguen saliendo (Dhelmise en la 45, Nihilego en la 65). Salen de una bolsa por semilla (`SIMA_WOUNDS`: la de Mimikyu y las de `STORY_BOSSES`), una de cada antes de repetir.
  - **Sombra extraviada**: desde la 12, una planta generada (nunca de eco ni de heraldo) puede ser, con un 7 % por planta y por semilla, la sala de una sombra de Senda tras su muro de niebla, con una escalera en la antesala: es **optativa**, se puede bajar sin entrar. Vencerla da +20 s («sombra vencida») y un objeto a elegir. *Desviación de la propuesta*: la sombra no está en una sala de una planta generada sino en su propia sala (las cartas de las Sendas se dibujan sobre su arena), y la planta es la antesala; así el muro de niebla ya viaja por la red como en cualquier jefe. Bolsa por semilla sobre `SIMA_SHADOWS` (todas las sombras de `STORY_BOSSES`; nunca dos con la misma hoja en el mismo turno: Bisharp está en dos Sendas).
  - **Fuerza de los jefes de Senda en la Sima** (`SIMA_STORY.hp`): juegan la pelea entera de su nivel con el 60 % de la vida de su Senda, sin crecer con la profundidad; solo su daño crece. Por eso la prueba en su primera planta (12 las sombras, 35 las heridas) vale para todas las demás (`tests/sim/story-prove-sima.test.ts`, todas las cartas de los cuatro niveles desde tres salidas).
  - **Cinemáticas** (`src/data/sima-scenes.ts`, dibujadas en `src/adapters/sima-scenes.ts`, en el reproductor del prólogo): la boca (antes de la primera bajada), los umbrales de los estratos II a V, tu sombra (el primer Eco del Eclipse), el primer nombre (antes de la cinemática del primer heraldo), la sombra de alguien (dos versiones: sin nombre y reconocida), el punto de quiebre (la primera vez que te pierdes: caes, todo se apaga, tu sombra tira de ti y despiertas en el borde del cráter con Phantump, que explica qué son los Caminantes de la Sima y que la Sima baja hacia el eclipse) y el regreso (al acabar cualquier otra partida: entero la primera vez, después dos cuadros). Solo jugando sola, una vez por dispositivo (clave propia `mazmorra-sombria.simaScenes`, fuera de la partida guardada: no son progreso y no viajan con la economía ni con la nube), se saltan como el prólogo y el reloj está parado mientras tanto. En compartida se escribe su línea en el registro.
  - **Las súplicas** (`src/data/sima-plea.ts`, `src/town/plea.ts`): la primera vez que entras al pueblo jugando sola sin haberlas visto en este dispositivo (también con partidas de antes de que existieran, aunque ya hayas bajado a la Sima; propietario, 2026-10-27: «que si no se las pierden»), o al ir a la Sima si aún no han salido, el pueblo sube al borde del cráter y, al estilo de Mundo Misterioso, cada vecino se acerca, habla con su retrato en el cuadro de diálogo y te pide por favor que busques a alguien: Gastly (una manada de zorros que cruzó la niebla), Cubone (su madre), Litwick (el niño que llevó de la mano), Poochyena (su hermana Mightyena), Mimikyu (el que empujaba el columpio), Croagunk (una Caminante que volvió once veces) y, el último, Phantump. Esc lo salta entero, y cuenta como vista. Si salieron al llegar al pueblo, te quedas en el borde del cráter; si salieron camino de la Sima, después vienen la tarjeta de entrada y la boca. En una sala no salen: esperan a la siguiente visita a solas.
  - **Figuraciones** (`src/adapters/figurations.ts`): con menos de 60 s de lucidez, de vez en cuando aparece en el borde de la vista la silueta de alguien que no está (una sombra de Senda o tu propia forma), quieta o andando hacia ti, y se deshace al acercarte o a los 2 s. Más a menudo cuanto menos lucidez. Solo se dibuja: nunca dispara, no tiene colisión ni la ve la IA, no viaja por la red ni toca la semilla (un test juega la misma semilla con y sin ellas y compara el mundo). Ajuste de accesibilidad «Figuraciones (Sima)»: Sí, Reducidas (la mitad de a menudo, más tenues y quietas) o No; con «reducir movimiento» del sistema, «Sí» pasa a Reducidas.
- **Cooperativo**: el anfitrión elige el modo al entrar desde el pueblo de la sala (en la boca del cráter o en el poste: «Entrar · Reto diario» o «Entrar · Libre»; su semilla viaja en `start`); el reloj es suyo y lo manda cada segundo y en cada cambio de planta, los invitados lo enseñan y acaban cuando el suyo llega a 0. Cada jugador guarda su marca.
- **Al acabar**: como todas las partidas, la pantalla final lleva de vuelta al pueblo (jugando solo, al Refugio; en una sala, al pueblo de la sala con todo el grupo).

**Pantano Tóxico** (cuarta mazmorra; subtítulo "Donde la luz del eclipse goteó de otro cielo"). Se abre al vencer al guardián de las Cuevas Inundadas. Leyenda: "Aquí cayó la primera gota de la luz roja. El agua la bebió, y se volvió veneno. En el corazón del pantano, algo que no es de este mundo flota sobre una grieta del cielo." Es el primer aviso claro de que el eclipse vino de fuera.

- **Plantas** (provisional): diez. 1 a 4 generadas, 5 la guarida de Salazzle (jefa intermedia, con salida), 6 a 9 generadas, 10 la grieta de Nihilego. Cada planta tiene su línea (la de la planta 1 sale bajo el título): "El agua no refleja el cielo. Refleja otro.", "Las burbujas revientan con un olor dulce. No respires hondo.", "Los árboles murieron de pie, mirando hacia arriba.", "Las esporas brillan como estrellas que se han equivocado de cielo.", "Huele a humo dulce. La reina del pantano ya sabe que has llegado.", "Más allá de la guarida, el lodo susurra en una lengua sin palabras.", "Algo late bajo el fango, despacio, como un corazón ajeno.", "Las piedras están frías y lisas, como cristal caído de lo alto.", "El aire zumba. La herida del cielo está cerca.", "Bajo la herida del cielo, algo te espera, y no tiene rostro."
- **Ambiente** (dibujado en código): lodo que burbujea, árboles muertos sobre las paredes, juncos, esporas que brillan y suben, una neblina tóxica baja y, en las arenas, agujas de cristal caídas del cielo (tapan los disparos) y raíces muertas.
- **Charcas tóxicas**: en las salas (nunca en la de salida ni junto a la escalera) y en las dos arenas. Meterse en una envenena: 2 % de la vida cada 0,7 s mientras dura (3,2 s desde el último contacto). Nunca quita la última vida. Rodar por encima no envenena, ni rozar el borde: premian rodar, no andar. Salen de la semilla de la planta, así que en cooperativo todos ven las mismas.
- **Planta con prisa, Gas tóxico**: de la planta 2 en adelante (25 a 45 %); el derrumbe sale menos (8 a 12 % desde la 3). A los 4 s una nube sale de la entrada y avanza por los pasillos a 1 casilla por segundo (llega a la escalera como pronto al triple de lo que se tarda andando). Dentro quita un 3 % cada 0,8 s; rodar no sirve (está en el aire); nunca quita la última vida. Suena la persecución del derrumbe.
- **Enemigos**: los de veneno del plantel (Stunky en parejas, Ekans, Tentacool, Koffing, Grimer y Croagunk desde la 4) y tres nuevos:

| Enemigo (tipo) | Cómo juega | Cómo se esquiva | En difícil o más |
|---|---|---|---|
| Venipede (Bicho/Veneno) | En grupos de tres; se enrosca (la línea deja de seguirte al final del aviso) y rueda muy rápido; rebota una vez en la primera pared y luego se queda mareado | Apartarse de la línea fijada y contar con el rebote; pegarle mientras está mareado | Rebota una vez más |
| Salandit (Veneno/Fuego) | Da vueltas rápido a tu alrededor y cruza a toda velocidad por una línea fijada, dejando bocanadas de humo tóxico detrás | Apartarse de lado y no rodar a lo largo de su estela | Se gira y vuelve a cruzar |
| Skrelp (Veneno/Agua) | Se queda lejos y apunta una línea fina de tinta que se fija un momento antes de escupir una bala rápida; luego salta hacia atrás | Moverse de lado cuando la línea se vuelve sólida | Escupe un abanico de tres |

- **Salazzle, "la reina de la ponzoña"** (jefa intermedia, 25 Pokémonedas). Cartas por turnos, con su nombre en pantalla: *Signo Ponzoña «Danza de la Salamandra»* (tres embestidas por líneas que se fijan 0,25 s antes, dejando humo; cuatro en difícil), *Signo Llama Tóxica «Espiral de Humo Dulce»* (salta al centro y suelta cuatro brazos de llamas que giran despacio: se esquiva yendo con el hueco entre brazos) y *Signo Feromona «Neblina de la Reina»* (la neblina llena la guarida menos dos refugios marcados durante 1,7 s; rodar no salva, hay que estar dentro de un refugio). En pesadilla añade *Signo Séquito «Cortejo de la Reina»*: llama a dos Salandit (nunca más de dos vivos).
- **Nihilego, «La que cayó por la grieta del cielo»** (guardiana, Roca/Veneno, una Ultraente). Fase 1: *Signo Neurotoxina «Telaraña de Nervios Ajenos»* (la arena se parte en siete carriles; se marcan uno sí y uno no y los azotan tentáculos, luego los otros; tres oleadas en difícil), *Signo Espora «Espiral de Polen Ultraente»* (tres brazos de esporas que giran más despacio de lo que se anda cerca de ella) y *Signo Gema «Constelación de Joya Rota»* (anillos de esquirlas de roca, cada uno girado medio hueco; uno más en difícil). Con la mitad de la vida, una sola vez y entre cartas, *La Bestia Ultra despierta* (1,8 s sin atacar) y empieza la fase 2: *Signo Ultra «Agujero de Gusano Ultra»* (tres saltos: la boca se abre donde estás y tira de ti despacio, más lento que andar; sale por ella con un estallido de esquirlas y la boca muerde a quien siga dentro, rodar no salva), los carriles alternan filas y columnas, la espiral tiene cuatro brazos y cambia de sentido a mitad, y *Signo Toxina «Marea de Neurotoxina»* (la marea cubre la grieta menos tres refugios marcados durante 1,9 s; rodar no salva). En pesadilla añade *Signo Lluvia «Aguacero de Venoshock»* (círculos en damero, luego la otra mitad). Las cuatro agujas de cristal tapan esquirlas y esporas, no los tentáculos ni la marea. Nunca hay más de 140 proyectiles enemigos en el aire.
- **Golpes de posición**: la Neblina, la boca del agujero de gusano y la Marea llevan `pierceRoll` (las volteretas no protegen); su aviso deja tiempo de sobra para llegar a un refugio o salir andando (lo comprueba un test). Usan la regla común de la sección 9: doble borde blanco y violeta (en la Neblina y la Marea, alrededor de los refugios; en el agujero, alrededor de la boca), el «!» y su sonido, y valen igual para quien juega como invitado. Ninguna de las dos jefas deja más de 140 balas a la vez (su tope, por debajo del general de 160).
- **Diálogo de Nihilego**: antes, "El agua guarda silencio. Sobre la grieta, algo flota sin peso." y "Vengo de un cielo sin sol. Allí la luz se quebró, y su hambre os alcanzó."; después, "Me apago… Al otro lado aún quedan muchos, mirando por la grieta." y "La luz que os falta no se perdió. Algo la bebe, más allá de vuestro cielo." (lo que hay al otro lado no se nombra).
- **Música**: plantas, *Swamp Theme Loop* (beardalaxy, CC0, bucle de 15 s); Salazzle, el tema de batalla de 16 bits como los demás jefes intermedios; Nihilego, *Boss Battle #2* (nene, CC0), el mismo del Bosque.

### Plantel experimental *(provisional)*

Catorce enemigos nuevos para probar en la Sima del Eclipse antes de darles mazmorra propia (Cuevas Inundadas, Pantano Tóxico) o tirarlos. La lista vive en `EXPERIMENTAL_ENEMIES` (`src/data/enemies.ts`) con la planta mínima sugerida, el peso, el tamaño de grupo, las Pokémonedas sugeridas y la mazmorra futura. Todos salen ya en la Sima (`ENDLESS_POOL`, con la planta mínima y los grupos sugeridos y pesos más bajos, para que en cada planta sigan saliendo los de siempre en más o menos la mitad); ninguna otra mazmorra los saca todavía. Todos siguen el mismo contrato souls: un aviso que enseña dónde va a caer el golpe, un hueco para esquivar (el aviso, o su último trozo cuando fija la puntería) y un rato abierto después. Ningún golpe quita más del 35 % de la vida de un inicial ni avisa menos de 0,3 s (lo comprueba un test). Tipos nuevos: Agua, Eléctrico y Lucha.

| Enemigo (tipo) | Cómo juega | Cómo se esquiva | Planta mínima |
|---|---|---|---|
| Zubat (Veneno/Volador) | En grupos de tres; vuela haciendo eses (rodea las paredes) y se lanza en picado | Rodar o apartarse cuando cae; se queda abierto si falla | 1 |
| Stunky (Veneno/Siniestro) | En parejas; se da la vuelta y rocía un cono corto que deja una nube | Salir del cono durante el aviso | 1 |
| Ekans (Veneno) | Se enrosca y embiste muy lejos en línea recta; la línea deja de seguirte en el último tercio del aviso (se vuelve sólida) | Apartarse de lado cuando la línea se fija; si falla, se queda mucho rato abierto | 2 |
| Litleo (Fuego/Normal) | Guarda la distancia y lanza bolas de fuego rápidas | Moverse de lado o rodar | 2 |
| Tentacool (Agua/Veneno) | Flota despacio, azota a su alrededor y deja un charco de veneno | Salir del círculo; no pisar el charco | 2 |
| Corphish (Agua) | Cangrejo con caparazón: los golpes de frente rebotan (solo arañan); dispara un chorro de agua por un carril que fija antes de disparar | Rodearlo (gira despacio) o pegarle cuando se recupera, que abre el caparazón | 3 |
| Chinchou (Agua/Eléctrico) | Su farol brilla y suelta un anillo eléctrico que se abre hasta un radio marcado | Salir del círculo durante el brillo o rodar a través del anillo | 3 |
| Houndour (Siniestro/Fuego) | Lanzallamas en un cono que te sigue hasta que empieza a soplar | Salir del alcance o del cono durante el aviso | 3 |
| Koffing (Veneno) | Flota cerca y suelta nubes de gas; con poca vida se hincha (anillo grande, 1,5 s) y explota; el golpe no lo para | Alejarse del anillo o rematarlo antes; si explota, se acaba y no da experiencia ni Pokémonedas | 3 |
| Grimer (Veneno) | Tanque lento que deja un rastro de lodo y golpea el suelo | No seguir su rastro; salir del círculo | 4 |
| Wooper (Agua/Tierra) | Tanque lento; golpe de suelo grande que deja barro | Salir del círculo | 4 |
| Slugma (Fuego) | Lanza lava a donde estás: el círculo te sigue durante el aviso y se queda quieto mientras la lava vuela; deja un charco de lava | Salir del círculo marcado mientras vuela | 4 |
| Clauncher (Agua) | Francotirador: aviso largo y un chorro muy largo y estrecho; caparazón de frente | Apartarse cuando el carril se fija | 5 |
| Croagunk (Veneno/Lucha) | Se pone en guardia: si le pegas, para el golpe y contraataca rápido y fuerte (Lucha); si no, acaba con un Puya Nociva más lenta | No pegarle en guardia; esperar al Puya Nociva, esquivarlo y castigar | 5 |

Litwick absorbe los golpes de Fuego de Litleo, Houndour y Slugma (Absorbe Fuego). En el servidor de desarrollo, `?spawn=koffing,grimer` abre una sala de pruebas con esos enemigos despiertos delante del jugador (hasta 12; vale cualquier especie con comportamiento).

### Evoluciones *(provisional)*

Hasta ahora todo enemigo era una primera fase; bajar solo traía más de lo mismo. Veinte formas evolucionadas de enemigos que ya existen aparecen en la segunda mitad de las plantas generadas de su mazmorra y en la Sima desde las plantas tardías del estrato de esa mazmorra (Cripta 6-9, Bosque 16-18, Cuevas 26-28, Pantano 36-38). Cada una juega con la máquina de estados de su forma base, la misma seña, pero sube un escalón: un patrón más largo o más ancho, un movimiento más (un segundo golpe reapuntado, un anillo, un charco, un truco que la base guarda para Difícil y aquí sale desde Fácil) y más aplomo (le cuesta más trastabillar). Todo ataque nuevo respeta el contrato de siempre: aviso que enseña el golpe, ventana para esquivar, recuperación para castigar, y los suelos de aviso por nivel.

Cuestan una amenaza más que su línea (`SPECIES_THREAT` en `src/data/encounters.ts`): una sala profunda compra menos cuerpos y más duros, en lugar de sumar. Por ser la amenaza más alta de su sala, cuando el grupo tiene líder, el líder es la evolución (la regla de siempre, sin código nuevo). Seis llegan con un miembro de su línea al lado (Poochyena con Mightyena, Pawniard con Bisharp, Gastly con Gengar, Impidimp con Morgrem, dos Zubat con Golbat, Stunky con Skuntank). Datos: `src/data/evolutions.ts` (quién evoluciona de quién y su mazmorra) y `src/data/evolved-enemies.ts` (comportamientos).

| Evolución (de) | Mazmorra · plantas | Papel | Qué añade | Truco en Difícil+ |
|---|---|---|---|---|
| Mightyena (Poochyena) | Cripta 4-5 · Sima 6+ | Escaramuzador | Embestida más larga y un segundo mordisco reapuntado | Aullido de manada (como Poochyena) |
| Haunter (Gastly) | Cripta 4-5 · Sima 7+ | A distancia | Dos bolas por lanzamiento en todos los niveles | Abanico de tres |
| Gengar (Haunter) | Cripta 5 · Sima 9+ | A distancia | Un anillo de diez bolas (una a ti) y otra bola apuntada | — |
| Dusclops (Duskull) | Cripta 4-5 · Sima 7+ | A distancia | Dos fuegos fatuos que te persiguen desde los lados | Tres fuegos |
| Bisharp (Pawniard) | Cripta 4-5 · Sima 8+ | Escaramuzador | Los tres cortes desde Fácil | — |
| Breloom (Shroomish) | Bosque 5-7 · Sima 16+ | Bruto | Salto más largo; al caer suelta un anillo de esporas | — |
| Drifblim (Drifloon) | Bosque 5-7 · Sima 17+ | A distancia | Dos anillos de diez por lanzamiento, el segundo girado | Un tercer anillo |
| Morgrem (Impidimp) | Bosque 5-7 · Sima 18+ | Escaramuzador | Dos amagos antes de la embestida de verdad | — |
| Noctowl (Hoothoot) | Bosque 5-7 · Sima 16+ | Escaramuzador | Picado más largo y un segundo picado reapuntado | Un tercer picado |
| Ariados (Spinarak) | Bosque 5-7 · Sima 17+ | A distancia | Cinco hilos en abanico y uno más apuntado | — |
| Golbat (Zubat) | Cuevas 6-9 · Sima 26+ | Escaramuzador | Segundo picado en todos los niveles; drena al acertar | — |
| Kingler (Krabby) | Cuevas 6-9 · Sima 26+ | Bruto | Martillazo más fuerte y la segunda pinza siempre | Una tercera pinza |
| Octillery (Remoraid) | Cuevas 6-9 · Sima 27+ | A distancia | Ráfaga de cinco por el carril fijado | El primero, abanico de tres |
| Crawdaunt (Corphish) | Cuevas 6-9 · Sima 28+ | A distancia | Caparazón más ancho y el chorro dos veces | Tres chorros |
| Arbok (Ekans) | Pantano 6-9 · Sima 36+ | Escaramuzador | Embestida más larga; charco de veneno al final siempre | Segunda embestida |
| Skuntank (Stunky) | Pantano 6-9 · Sima 36+ | Bruto | Rociada más ancha y nube mayor; la cola te sigue desde Normal | — |
| Weezing (Koffing) | Pantano 6-9 · Sima 37+ | Controlador | Nubes más grandes; explosión más ancha con mecha más larga | — |
| Muk (Grimer) | Pantano 6-9 · Sima 37+ | Controlador | Golpe más ancho y un charco de lodo donde golpea | Anillo de lodo |
| Toxicroak (Croagunk) | Pantano 7-9 · Sima 38+ | Bruto | Contraataque más duro; Puya Nociva encadenada una vez | Una tercera Puya |
| Houndoom (Houndour) | Solo la Sima, 18+ | Controlador | Lanzallamas más largo que te sigue en todos los niveles; deja brasas | Gira más rápido |

Fuera por hojas incompletas en SpriteCollab: Golurk y Grimmsnarl (su "Shoot" es copia de otra hoja). Lanturn y Salazzle ya son jefes.
### El mundo *(provisional)*

Fuera de las mazmorras hay un mundo pequeño que se recorre andando, siempre en el último anochecer, el del Eclipse (el sol no ha vuelto a salir; la luna sí; de ahí el nombre del Refugio del Ocaso), y sin combate (`src/data/world.ts`). Son mapas unidos por sus bordes: al salir por uno, un fundido corto lleva al siguiente y su nombre aparece arriba.

- **Refugio del Ocaso**: el pueblo de siempre (Mimikyu, Poochyena, Gastly y el tablón). Abra duerme en un rincón, junto a la casa de piedra, bajo la manta que le dejó el pueblo, y casi nunca contesta; Axew entrena solo junto a un árbol en la linde del noreste. Un poste junto al camino del este abre la lista de mazmorras abiertas, para no tener que andar (atajo pensado para los directos).
- **Camino de las Ruinas**: tumbas y columnas rotas; la boca de la **Cripta del Rey de las Espadas** es una casa de piedra hundida al norte del camino. Una estatua sin rostro y un poste del camino.
- **Paso del Mirador**: una grieta parte el paso y solo queda un puente. Desde aquí el eclipse se ve enorme (estatua del mirador, atalaya). Al sur, en la linde, junto a un tronco hueco, entra el **Bosque Brumoso**; al norte sube el camino al cráter.
- **Cráter del Eclipse**: ceniza y roca alrededor de un pozo justo debajo del eclipse. En su borde está la boca de la **Sima del Eclipse**, abierta desde el principio; una estatua quemada mira al fondo. En el borde norte, Shinx mira hacia abajo, por donde bajan los Caminantes.
- **Aldea del Lago Negro**: el segundo pueblo, de pescadores, junto a un lago que ya no refleja el cielo. Es el lago de Piplup (decisión del dueño, 27-10-2026): la noche del Eclipse se heló entero, y el hielo es negro porque debajo ya no hay luz; el lago desagua al mar, más allá, y por el mar se fueron los demás: el hielo dejó a Piplup aislado. Cubone pesca por el agujero que mantiene abierto junto al embarcadero (el «agua negra»), y a su lado Piplup, junto al único agujero hasta el agua, rechaza lo que le ofrecen. En la plaza, sobre las piedras, un niño callado (Zorua disfrazado de Shroomish; al cerrar su Senda se ve Zoroark). El mapa aún dibuja el lago como agua. Litwick guarda la llama que guía a los perdidos y cuenta una cosa cada vez, y Phantump ve lo que vendrá y hace evolucionar a los Pokémon (el gacha ya existe: es el puesto de Mimikyu en el Refugio). Un ídolo de rana recibe ofrendas.
- **Ciénaga del Cielo Roto**: al este del lago, donde cayó la primera luz del eclipse. Charcas negras, árboles muertos, un cristal caído que zumba (dice más al caer los guardianes) y, entre dos columnas rotas, la boca del **Pantano Tóxico**. Un Croagunk ermitaño vive junto al camino; Skrelp y Venipede pasean por la orilla.

**Viaje rápido** (`src/town/travel.ts`): cada mapa tiene una piedra guía (un poste junto a la llegada). Al leerla se abre la ventana «Viajar» con los mapas ya visitados en este dispositivo (una marca local, no forma parte del perfil sincronizado) y lo que hay en cada uno («Phantump: evolucionar, despertar y desafíos», «Smeargle: tutor de movimientos», «Santuario de los Juramentos», las bocas de mazmorra...); al elegir uno, un fundido te deja junto a su piedra. La del Refugio sigue listando las mazmorras abiertas y añade la fila «Viajar». Hay un atajo directo a Phantump, que te deja a su lado. En una sala en línea cada jugador viaja por su cuenta: la presencia ya lleva el mapa, así que los demás te ven desaparecer de su mapa y aparecer en el nuevo. Solo existe en el mundo, nunca durante una partida.

**Menús: el pueblo es la interfaz** (propietario, 2026-10-26). El menú de título tiene solo tres entradas: **Jugar** (la primera vez, prólogo y test de personalidad como siempre; luego, al pueblo), **Jugar en línea** (crear sala o unirse con código, y al pueblo de la sala) y **Opciones** (Ajustes, Cuenta, Logros, Prólogo, Créditos e Instalar cuando se puede), con la lista y la descripción de cada fila al lado. En el pueblo, Esc (o el botón «Menú» en táctil, en la esquina que deja «Atrás») abre el menú del pueblo: Viajar, Mazmorras, Desafíos, Phantump, Tienda, Tutor, Gacha, Tablón, Logros, Galería, Santuario, Jugar en línea, Cuenta, Ajustes y Volver al inicio. Cada fila abre la misma ventana que el PNJ o el lugar, sin andar; andar hasta ellos sigue funcionando igual. Cuenta se abre como ventana sobre el pueblo, como las demás, así que el pueblo (y la sala) siguen debajo. **Galería** (propietario, 2026-10-27, «para los amantes del lore»; `src/app/lore-gallery.ts`): todas las cinemáticas del juego por grupos (Prólogo, Sima del Eclipse con las súplicas primero, cada Senda por capítulo con su «Antes» y su «Después», y los Guardianes), sacadas de los mismos datos que las reproducen, así que una Senda o escena nueva aparece sola. Solo se vuelven a ver las ya vistas; las demás salen como «???» y no hacen nada. Cuentan como vistas: el prólogo (o tener inicial elegido), las escenas de la Sima y de los guardianes vistas en este dispositivo (un guardián también si su mazmorra está superada en los récords), y los capítulos de Senda cerrados en la partida guardada (viajan con la nube). Volver a ver una escena no escribe nada: ni marcas de vista, ni partida, ni récords, ni Sendas. Las súplicas se repiten en el borde del cráter y te devuelven adonde estabas; en una sala no se pueden repetir (la fila lo explica). Los heraldos no están: se generan por semilla y no forman un catálogo fijo (pendiente). En una sala en línea el menú lista lo mismo salvo Jugar en línea (saldría de la sala) y cierra con las filas de la sala (copiar u ocultar el código, salir); Mazmorras y Desafíos siguen siendo cosa del anfitrión. El equipo de cada partida se elige al salir hacia una mazmorra, y su «Volver» lleva al pueblo. Código: `src/app/title-menu.ts`, `src/town/town-menu.ts`, `src/ui/menu-window.ts`.

Al pisar la boca de una mazmorra sale una ventana «¿Entrar en …?». Si aún está sellada, una línea dice qué guardián hay que vencer; si no existe todavía, que algo allí abajo no ha terminado de despertar. Las estatuas, el poste y el ídolo dicen una línea más al vencer al guardián de cada mazmorra (récords de este dispositivo). Por el mundo pasean Pokémon inofensivos (Pumpkaboo, Hoothoot, Foongus, Spinarak) con los sprites que ya tiene el juego. Cada mapa tiene su luz (más roja en el cráter, más fría en el lago), niebla, hojas que caen, pájaros que cruzan el cielo y agua con reflejos rojos. Suena el mismo tema del título (Lonely Village) en todo el mundo.

## 4. Combate

### Controles (teclado y ratón)

| Tecla | Qué hace |
|---|---|
| WASD o flechas | Moverte |
| Espacio | Rueda con invulnerabilidad; gasta estamina. Va hacia donde mantienes la dirección; sin dirección, hacia el objetivo fijado, si no hacia el cursor del ratón (si lo has movido después de andar) y si no hacia donde miras. Una dirección pulsada en la primera décima de segundo de la rueda aún la gira: pulsar Espacio un pelín antes que la tecla vale |
| Clic izquierdo (o Q) | Ataque ligero: rápido, se recupera enseguida y castiga huecos pequeños (Placaje, Arañazo) |
| Clic derecho (o E) | Movimiento fuerte de su tipo: arranque lento, gasta estamina y si lo mantienes carga (Ascuas, Pistola Agua) |
| R (o 1) | Potenciación: una mejora propia con enfriamiento largo y sin estamina (Danza Espada, Maquinación, Fuego Fatuo, Corpulencia) |
| F (o 2) | Movimiento de área: cono, anillo u onda en línea; arranque lento, estamina y enfriamiento (Brillo Mágico, Terremoto) |
| Ratón | Apuntar. Sin objetivo fijado, el clic ataca hacia el cursor y Q, E, R o F hacia donde miras (la última dirección de WASD; mientras cargas con E giras con WASD). Con objetivo fijado, todo va al objetivo. Si pulsas a la vez el clic y su tecla, manda el clic |
| Shift o clic central | Fijar objetivo: una pulsación fija y otra lo suelta (mantener Shift resultó incómodo en la primera prueba). El tipo de fijado se elige en ajustes |
| Clic izquierdo sobre un enemigo | Lo fija (o cambia a él si ya tenías otro), además de atacar. Se puede desactivar en ajustes |
| Rueda del ratón | Con objetivo fijado, cambiar al siguiente |
| Tab | Mostrar u ocultar el minimapa |
| Esc | Menú: continuar, ajustes rápidos, reiniciar la planta (vuelve a como entraste) y salir al menú principal |

Es el esquema de Hades y Death's Door (ataque al clic izquierdo, especial al derecho, esquiva al Espacio), así que le resulta natural a cualquiera que haya jugado algo parecido. Todas las teclas se pueden cambiar.

La profundidad sale de cargar y de elegir el momento con esas pocas teclas, no de añadir más botones (es lo que hace Furi). Las dos ranuras nuevas (R y F) no rompen eso: van con enfriamiento, así que no se pueden repetir y se guardan para el momento (el jefe, un grupo que te rodea).

Las cuatro ranuras (decidido el 2026-10-25):

| Ranura | Tecla | Botón táctil | Coste | Para qué |
|---|---|---|---|---|
| Rápida | Clic izquierdo / Q | Rápido | Nada | Castigar huecos pequeños |
| Fuerte | Clic derecho / E (mantener carga) | Fuerte | Estamina | El golpe gordo de su tipo |
| Potenciación | R / 1 | Potenc. | Enfriamiento 14–16 s, sin estamina | Prepararte antes de un jefe o un grupo |
| Área | F / 2 | Área | Estamina 30–40 y enfriamiento 6–10 s | Despejar a varios a la vez |

R y F están al lado de Q y E bajo la mano izquierda; 1 y 2 son la alternativa. No chocan con Shift, Espacio, E, Q, M, Tab, Esc ni F3 (1, 2 y 3 también eligen objeto, pero la elección de objeto pausa la entrada del juego). El ratón no cambia: el clic central sigue siendo fijar. Una partida guardada con dos movimientos se carga con los de potenciación y área por defecto de su Pokémon. El HUD muestra cuatro ventanas compactas (en una fila abajo a la derecha en el escritorio; en el móvil, en dos filas bajo la ventana de estado, arriba a la izquierda, para no quedar bajo los botones de acción) con los segundos de enfriamiento que quedan; mientras dura una potenciación su ventana brilla en el color del tipo y el Pokémon lleva un aura que parpadea al acabarse.

### Controles táctiles (móvil y tableta)

Se activan solos al primer toque (ajuste «Controles táctiles»: Automático, Sí, No). Todo se traduce a la misma entrada que el teclado, así que el combate no cambia:

| Control | Qué hace |
|---|---|
| Joystick (mitad izquierda, aparece donde pones el pulgar) | Moverte, analógico y con zona muerta |
| Rodar | Rueda (como Espacio): hacia donde empujas el joystick; sin joystick, hacia el objetivo fijado o hacia donde miras |
| Rápido / Fuerte | Los dos movimientos; Fuerte se mantiene para cargar y se suelta para lanzar |
| Potenc. / Área | La potenciación y el movimiento de área (botones de 52 px a la izquierda de Fuerte; se ocultan si la ranura está vacía) |
| Fijar | Un toque fija al enemigo que tienes delante o lo suelta; deslizar a izquierda o derecha sobre él cambia de objetivo (como la rueda) |
| Tocar un enemigo | Lo fija si el fijado por clic está activado (no ataca) |
| Pausa / Mapa | El menú de Esc y el minimapa |

Sin objetivo fijado los movimientos van hacia donde miras, como Q y E; con «Apuntado automático» (activado por defecto) van al enemigo más cercano dentro de un cono delante de ti. «Vibración» da un pulso corto al recibir un golpe y en la esquiva perfecta. En los menús todo se toca y un botón «Atrás» hace de Esc; en el pueblo hay joystick y un botón «Hablar». En la tienda, un toque sobre una mejora muestra su efecto y un segundo toque la compra, para que un toque perdido no gaste Pokémonedas.

### Estamina

- Una sola barra para la rueda, para E y para el movimiento de área (la potenciación no gasta: la frena su enfriamiento).
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
- Cada Pokémon tiene un repertorio de movimientos y lleva equipados cuatro: rápida (clic izquierdo), fuerte (clic derecho), potenciación (R) y área (F). Cada movimiento pertenece a una sola ranura, para que la rápida siempre se sienta rápida, la fuerte siempre tenga su arranque y las dos nuevas no se puedan repetir.
- Los movimientos se cambian desde el menú, entre partidas, nunca en mitad del combate.
- Cada inicial empieza con su kit original (siete movimientos, gratis) y aprende el resto de su repertorio canónico pagando Pokémonedas al maestro de movimientos (ver «Movimientos y maestro»).
- El número de ranuras va en los datos (`PLAYER_SLOT_LAYOUT`), no metido a mano en el código. Las ranuras de potenciación y área pueden quedar vacías si un Pokémon no tiene movimientos para ellas.

Repertorio de Mimikyu en el M0:

| Ranura | Movimiento | Cómo se juega |
|---|---|---|
| Rápida | Garra Umbría | Zarpazo corto delante de ti |
| Rápida | Sombra Vil | Pequeño avance con golpe; sirve para cerrar distancia |
| Fuerte | Carantoña | Golpe cuerpo a cuerpo fuerte, se carga |
| Fuerte | Bola Sombra | Proyectil lento a distancia; cargado, más grande y más rápido |
Iniciales (aprobados el 2026-10-25; se eligen en la pantalla de equipo antes de la partida, junto a Mimikyu):

| Pokémon | Estilo | Rápida | Fuerte | Pasiva |
|---|---|---|---|---|
| Zorua (Siniestro) | Cuerpo a cuerpo rápido, poca vida | Golpes Furia (cinco arañazos, Normal), Finta (atraviesa al enemigo y se gira) | Pulso Noche (onda alrededor), Juego Sucio (embestida; más daño si el enemigo está atacando) | Ilusión: los enemigos dormidos solo te notan si los tocas; el primer golpe es crítico; vuelve en cada piso |
| Litwick (Fantasma/Fuego) | A distancia, frágil | Ascuas (llama rápida), Impresionar (susto a bocajarro que aturde) | Infortunio (daño doble a un enemigo aturdido), Infierno (bola lenta y fuerte) | Absorbe Fuego: los golpes de Fuego curan un poco y potencian el siguiente movimiento fuerte; además, cada 4 golpes de Fuego propios avivan la llama y potencian el siguiente movimiento fuerte |
| Cubone (Tierra) | Aguante, lento, mucha vida | Hueso Palo (golpe que aturde), Ataque Óseo (tres golpes avanzando) | Huesomerang (va y vuelve hacia Cubone, que lo atrapa; golpea dos veces), Pataleta (pisotón; doble si el golpe anterior falló) | Armadura Batalla: mientras cargas o preparas un movimiento fuerte, los golpes de frente hacen la mitad |

Potenciación y área de los iniciales (la primera de cada área es la que viene equipada):

| Pokémon | Potenciación (sin estamina) | Área 1 | Área 2 |
|---|---|---|---|
| Mimikyu | Danza Espada: tus 3 próximos golpes hacen ×1,5 (9 s; enfriamiento 15 s) | Brillo Mágico (Hada, anillo; 80; 35 estamina; 8 s) | Golpe Umbrío (Fantasma, cono de 120°; 120 pero arranca en 520 ms; 40; 10 s) |
| Zorua | Maquinación: andas ×1,3 y +35 % de críticos (5 s; 14 s) | Pulso Umbrío (Siniestro, anillo; 80; 35; 8 s) | Alarido (Siniestro, cono muy abierto; 55; 30; 6 s) |
| Litwick | Fuego Fatuo: enciende Absorbe Fuego al instante; el siguiente fuerte sale potenciado (16 s) | Lanzallamas (Fuego, onda en línea que atraviesa a todos y no vuelve; 90; 35; 8 s) | Onda Ígnea (Fuego, cono de 130°; 95; 40; 9 s) |
| Cubone | Corpulencia: recibes ×0,6 de daño (6 s; 16 s; se aplica antes del tope de un golpe, que sigue siendo lo último) | Terremoto (Tierra, anillo grande; 100; arranca en 460 ms; 40; 10 s) | Terratemblor (Tierra, anillo pequeño y rápido; 60; 30; 6 s) |

Los de área no se cargan, tardan en salir y siempre dan la pausa y la sacudida fuertes al golpear. Pulso Noche se queda en la ranura fuerte de Zorua (pasarlo a área cambiaría su equipo por defecto; Pulso Umbrío cubre el anillo). Bomba Fango queda para más adelante (pide un proyectil que estalle al chocar).

Sin estados alterados completos: lo que en el juego original depende de la quemadura aquí depende del aturdimiento (los movimientos del maestro añaden quemadura y veneno como daño a lo largo del tiempo, nada más). Ningún enemigo actual ataca con Fuego, así que Absorbe Fuego también se carga con los golpes de Fuego del propio Litwick (cuatro golpes potencian el siguiente movimiento fuerte).
- La efectividad de tipos se aplica a E (y a las debilidades de los jefes). La pantalla de movimientos dice, para cada uno, su coste de estamina, su forma (arco corto, anillo 360°, proyectil lento...) y contra qué enemigos de la Cripta es eficaz o poco eficaz.
- Cada ataque, del jugador o enemigo, se pinta con el color de su tipo (una sola paleta); los avisos enemigos conservan el borde rojo. El último golpe de un movimiento de varios golpes y los movimientos marcados como pesados dan la pausa, la sacudida y el sonido fuertes.
- Los kits son datos: un movimiento es una entrada de tabla con daño, arranque, fotogramas activos, recuperación, coste de estamina, forma del golpe y niveles de carga.

### Movimientos y maestro *(provisional)*

Cada línea (los cuatro iniciales y las cuatro del gacha, decisión del 26-10-2026) puede aprender los movimientos que aprende en los juegos originales cualquiera de sus formas (por nivel, MT/DT, tutor y huevo; aprendizajes de PokeAPI en `src/data/learnsets.ts`: todas las generaciones para los iniciales, la última con datos para las líneas del gacha), rediseñados para el combate en tiempo real. Se eligieron los que importan: todos los de daño relevantes y los de estado clave (Danza Espada, Maquinación, Paz Mental, Fuego Fatuo, Corpulencia, Maldición, Tambor...). Entre 23 y 28 por especie. Golpe Umbrío de Mimikyu y Corpulencia de Cubone no están en sus aprendizajes canónicos, pero se quedan porque ya eran parte del kit.

**Cómo se adaptan.** La potencia es la oficial; los tiempos se ajustan al presupuesto de su nivel de poder (abajo): lo más fuerte es más lento, gasta más estamina o PS, o retrocede. Los estados se simplifican:

| En los juegos | Aquí |
|---|---|
| Quemadura, veneno | Daño a lo largo del tiempo: una parte del golpe (40 % quemadura en 4 ticks, 50 % veneno en 5) se repite en el enemigo, sin pausa de golpe |
| Retroceso (Mazazo, Envite Ígneo, Doble Filo, Derribo) | Pierdes esa parte del daño que haces, nunca por debajo de 1 PS |
| Drenaje (Puño Drenaje, Gigadrenado, Beso Drenaje, Chupavidas) | Te curas esa parte del daño que haces de verdad (los rápidos drenan menos que en el original), hasta un 1 % de la vida máxima por segundo entre todos (se guardan hasta 3 s de cura: un golpe grande cura un 3 % de golpe). Sin ese tope, Juego Sucio +2 o Puño Drenaje curaban más rápido de lo que un jefe de Pesadilla hace daño |
| Retroceder, parálisis, congelación | Más aturdimiento al golpear |
| Prioridad (Golpe Bajo) | Arranque más corto |
| Índice crítico alto (Cuchillada, Tajo Umbrío) | +25 % de probabilidad de crítico |
| Potencia por peso (Hierba Lazo, Patada Baja), daño fijo (Tinieblas) | Una potencia fija |
| Bajar tus propias estadísticas (Sofoco) | Enfriamiento de 7 s en un movimiento fuerte |
| Paz Mental, Maldición, Tambor, Defensa Férrea... | Potenciaciones: daño y defensa durante unos segundos, o pagar PS por golpes mucho más fuertes |

Formas nuevas, todas genéricas: el **remolino** (Giro Fuego: una zona que se queda delante de ti y vuelve a golpear cada 600 ms) y el **disparo teledirigido** (Meteoros: se curva hacia el enemigo más cercano). Ideas tomadas de PokeSurvivor (solo mecánicas, nada de su código): sus zonas en el suelo y sus disparos teledirigidos, y su «evolución» de movimientos al nivel máximo, que aquí son las Mejoras.

**Niveles de poder.** Cada movimiento tiene un nivel, con un presupuesto de daño efectivo (daño por tiempo de uso, contando la mitad de una quemadura o un veneno y el crítico esperado) frente al mejor movimiento original de su ranura y su forma (`src/core/move-power.ts`; un test lo comprueba para todos):

| Nivel | Quién | Presupuesto | A cambio | Precio (rápido / fuerte / potenciación / área) | Mejoras |
|---|---|---|---|---|---|
| Básico | el kit original de cada línea | ×1,0 (es la referencia) | — | gratis (el de otro inicial, según su potencia) | 150 / 350 |
| Avanzado | casi todo lo que enseña Smeargle | hasta ×1,2 | por encima de ×1,0, un coste real | 120–300 / 220–560 / 350 / 300–650 (según la potencia) | 250 / 500 |
| Maestro | 17 movimientos, 2–4 por línea | hasta ×1,4 (los de daño, ×1,30–1,38) | dos costes: retroceso, PS, enfriamiento en un fuerte, mucha estamina (≥ 35 fuerte, ≥ 40 área) o una carga un 25 % más lenta que la más lenta del kit | 450 / 800 / 600 / 950 | 400 / 750 |

Los Maestro: Mazazo, Golpe Fantasma (tras la Cripta), Trueno (tras el Bosque Brumoso) y Maldición (Mimikyu); Bomba Lodo y Vozarrón (tras el Bosque) (Zorua); Llamarada, Envite Ígneo (tras la Cripta), Giro Fuego (tras el Bosque) y Maldición (Litwick); Doble Filo, Puño Certero (tras la Cripta), Rayo Hielo (tras el Bosque) y Tambor (Cubone). Así comprar sirve: un Maestro pega un 30–38 % más que lo mejor del kit, pero tarda más en salir o cuesta más, y no es mejor en todo (un Trueno de 660 ms de carga se esquiva peor que se lanza). Por encima de todo hay un techo duro: con los dos rangos y sus efectos, ningún movimiento pasa de ×1,9 la referencia (solo daño del jugador: el tope de un golpe enemigo y los telegrafiados no cambian).

**Precios** (Pokémonedas): Avanzado rápidos 120 / 200 / 300 (potencia < 60, < 75, más); fuertes 220 / 380 / 560 y de área 300 / 450 / 650 (< 80, < 100, más); potenciaciones 350. Maestro: tabla de arriba. El kit original es gratis.

**Mejoras (rangos).** Todo movimiento aprendido (no solo el kit) se puede mejorar dos veces («Garra Umbría +», «++»; estrellas ★☆ en la pantalla de equipo); el precio va por nivel (tabla de arriba). Cada rango da +10 % de daño (en potenciación, un 10 % menos de enfriamiento; los de área conservan el suyo) y además un efecto propio, diseñado por movimiento (`src/data/rank-effects.ts`), inspirado en las «evoluciones» de PokeSurvivor (solo la idea). Los efectos son genéricos y cualquier movimiento puede llevarlos:

| Efecto | Qué hace | Ejemplos |
|---|---|---|
| Crítico | +probabilidad de crítico | Garra Umbría +1, Golpe Bajo +2 |
| Tamaño | golpe o proyectil más grande | Bola Sombra +1, Brillo Mágico +1 |
| Quemar / envenenar | probabilidad de estado (o siempre) | Ascuas +1 (40 %), Infierno +1 (siempre) |
| Marca | el golpe deja una marca que estalla después (no se acumula) | Garra Umbría +2, Finta +2, Infortunio +2 |
| División | el proyectil se divide al impactar (los trozos no repiten en el mismo enemigo) | Bola Sombra +2 (3), Llamarada +2 (4) |
| Debilitar | el objetivo hace menos daño (cuerpo a cuerpo y disparos) unos segundos | Carantoña +2, Alarido +2 |
| Zona | en el impacto, a tu alrededor (réplica o aura) o en línea tras una onda; daña poco y en silencio | Ascuas +2 (brasas), Terremoto +2 (réplica), Lanzallamas +2 (rastro de fuego), Bomba Lodo +2 (charco) |
| Golpes | un golpe más en los de varios | Golpes Furia +2, Doble Patada +2 |
| Regreso | el bumerán vuelve a lanzarse | Huesomerang +2 (una vez más, al 50 %) |
| Cadena | el golpe salta al enemigo más cercano | Rayo +2, Trueno +2, Puño Trueno +2 |
| Superarmadura | menos daño recibido desde que empieza el movimiento (no hay aturdimiento del jugador contra el que armarse); al acabar descansa lo mismo que ha durado antes de poder volver, así que cubre como mucho la mitad del combate (antes un fuerte con superarmadura la renovaba en cada golpe y cubría el 90-99 %) | Danza Espada +2, Mazazo +2 |
| Invulnerable | i-frames en la fase activa (los ataques posicionales sí te dan) | Sombra Vil +2, Golpe Fantasma +2, Excavar +1 |
| Potenciación | más golpes, duración, crítico o defensa | Danza Espada +1, Maquinación +1/+2 |
| Drenaje, aturdir, perseguir, curar | más drenaje; más aturdimiento y empuje; el proyectil se curva; cura PS al lanzarse | Juego Sucio +2, Carantoña +1, Infortunio +1, Corpulencia +2 |

Así los movimientos de siempre siguen valiendo, y uno comprado crece con el jugador. Lo aprendido y las Mejoras cuentan en todas partes: también en el Santuario (Reflejos, Desafíos, pruebas en línea) y en el modo puro de la Sima, porque es un juego de farmeo y el progreso tiene que notarse (decisión del 26-10-2026). Las mejoras de Poochyena siguen fuera del Santuario y del modo puro. Una marca guarda el equipo con el que se hizo (movimientos, rangos y nivel de poder) junto al tiempo, en vez de igualar las estadísticas.

**El maestro.** Smeargle, «Maestro de movimientos», está en el Refugio, en el césped del oeste junto a la casa de piedra. Su ventana es como la tienda de Poochyena: arriba el saldo y el equipo recomendado; una fila elige el Pokémon (◀ ▶, empieza en el tuyo), otra filtra por ranura (Todos, Rápida, Fuerte, Potenciación, Área); luego los movimientos a la venta (precio, «Aprendido» o «Bloqueado»; los Avanzado y Maestro llevan su insignia de nivel) y las Mejoras de cada movimiento que ya sabes (nombre con «+», estrellas ★☆ y precio del siguiente rango). La línea de abajo explica la fila del cursor: en un movimiento a la venta, su nivel, qué mazmorra lo desbloquea, sus costes y lo que darán sus rangos +1 y +2; en una Mejora, lo que da el siguiente rango. Lo comprado se guarda en `mazmorra-sombria.save` (versión 2; un guardado de la versión 1 se lee sin nada aprendido). En la pantalla de equipo solo aparecen los movimientos aprendidos de cada ranura, con el mismo filtro, los nombres con sus «+», sus estrellas de rango y su insignia de nivel, y el equipo recomendado debajo; un movimiento no aprendido nunca llega a una partida (se cambia por el de por defecto de su ranura).

**Equipos recomendados** (siguen los sets competitivos de Smogon, exportados por data.pkmn.cc; fuentes en `src/data/learnsets.ts`):

| Pokémon | Rápida | Fuerte | Potenciación | Área | Referencia |
|---|---|---|---|---|---|
| Mimikyu | Sombra Vil | Carantoña | Danza Espada | Golpe Fantasma | Danza Espada / Carantoña / Garra Umbría / Sombra Vil (OU/UU Gen 9), Golpe Fantasma (BSS Gen 8) |
| Zorua | Desarme | Bomba Lodo | Maquinación | Pulso Umbrío | Maquinación / Pulso Umbrío / Bomba Lodo (Zoroark UU Gen 7), Desarme (Zorua LC Gen 7 y 9) |
| Litwick | Ascuas | Bola Sombra | Paz Mental | Lanzallamas | Paz Mental / Llamarada o Lanzallamas / Bola Sombra / Energibola (Lampent NFE, Chandelure NU Gen 9) |
| Cubone | Desarme | Huesomerang | Danza Espada | Terremoto | Danza Espada / Huesomerang / Terremoto / Desarme (Marowak ZU Gen 8; Cubone LC Gen 7) |
| Alakazam | Psicocorte | Bola Sombra | Maquinación | Brillo Mágico | Maquinación / Psíquico / Onda Certera / Bola Sombra (National Dex UU Gen 9), Brillo Mágico (Abra LC Gen 8) |
| Empoleon | Desarme | Foco Resplandor | Defensa Férrea | Surf | Foco Resplandor / Surf / Rayo Hielo / Hierba Lazo (BSS Gen 9), Desarme (RU Gen 9, defensivo) |
| Luxray | Colmillo Hielo | Voltio Cruel | Aullido | Alarido | Voltio Cruel / Triturar / Fachada (ZU Gen 8) |
| Haxorus | Garra Dragón | Enfado | Danza Dragón | Terremoto | Danza Dragón / Garra Dragón o Enfado / Terremoto (BSS Gen 9; Axew LC Gen 9) |

Zorua no aprende Lanzallamas ni Onda Certera (los aprende Zoroark): su cobertura es Bomba Lodo, Hierba Lazo y Envidia Ardiente. La alternativa de Litwick en la ranura fuerte es Llamarada o Energibola.

**Arnés:** `npm run balance -- --quick --slots --build=<especie>` juega con el equipo recomendado (`--species=<especie>` con el de por defecto; `--full=<especie> --ranks=2` con la inversión completa: `FULL_BUILD`, todo a rango +2). Antes y después en `reports/balance/movepools-builds.md` y `reports/balance/move-progression.md`: ningún equipo rompe una invariante de justicia. Con la inversión completa los bots matan a los jefes un 37 % (Mimikyu), 37 % (Zorua), 26 % (Litwick) y 30 % (Cubone) más rápido (mediana emparejada, `npx vite-node tools/move-progression-ttk.ts` → `reports/balance/move-progression-ttk.md`); las cartas siguen durando y hay que esquivarlas igual.

Las líneas del gacha comparten repertorio en todas sus formas; lo que trae una evolución (Tinieblas con Kadabra, Rayo Hielo con Empoleon...) llega gratis al evolucionar y Smeargle nunca lo vende. Movimientos nuevos para ellas: Psicocorte, Puño Hielo, Psicocarga, Reflejo, Psicorrayo, Premonición (Maestro, tras el Bosque), Acua Jet, Garra Metal, Foco Resplandor, Hidrobomba (Maestro, tras las Cuevas), Colmillo Rayo, Colmillo Hielo, Colmillo Ígneo, Triturar, Voltio Cruel (Maestro, tras el Pantano), Carga, Aullido, Chispazo, Electrotela, Enfado (Maestro, tras la Cripta) y Danza Dragón; cada una tiene además Doble Filo (o Puño Certero) como Maestro.

Repertorio completo por línea (la última forma; precio «inicial» = kit original, «con X» = lo trae esa evolución; est. = estamina; enfr. = enfriamiento):

#### Mimikyu

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Garra Umbría | Rápido | Básico | Fantasma | 70 | arco corto | inicial (150 / 350) | +15 % de crítico | deja una marca que estalla a los 1,2 s (35 % del golpe) |
| Sombra Vil | Rápido | Básico | Fantasma | 40 | embestida | inicial (150 / 350) | golpe un 25 % más grande | invulnerable mientras golpea |
| Impresionar | Rápido | Básico | Fantasma | 30 | arco corto, aturde mucho | 120 P (150 / 350) | aturde un 40 % más | el objetivo hace −25 % de daño durante 2,5 s |
| Cuchillada | Rápido | Avanzado | Normal | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | aturde un 30 % más |
| Tajo Umbrío | Rápido | Avanzado | Siniestro | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | deja una marca que estalla a los 1 s (30 % del golpe) |
| Tijera X | Rápido | Avanzado | Bicho | 80 | arco corto | 300 P (250 / 500) | +15 % de crítico | deja una marca que estalla a los 0,8 s (30 % del golpe) |
| Chupavidas | Rápido | Avanzado | Bicho | 80 | arco corto, drena 25 % | 300 P (250 / 500) | +10 % de drenaje | el objetivo hace −15 % de daño durante 3 s |
| Beso Drenaje | Rápido | Avanzado | Hada | 50 | arco corto, drena 40 % | 120 P (250 / 500) | +15 % de drenaje | el objetivo hace −30 % de daño durante 3 s |
| Carantoña | Fuerte | Básico | Hada | 90 | arco amplio, est. 30 | inicial (150 / 350) | aturde un 30 % más | el objetivo hace −30 % de daño durante 4 s |
| Bola Sombra | Fuerte | Básico | Fantasma | 80 | proyectil rápido, est. 30 | inicial (150 / 350) | golpe un 35 % más grande | se divide en 3 al impactar (35 % de poder cada uno) |
| Puño Drenaje | Fuerte | Avanzado | Lucha | 75 | arco amplio, drena 50 %, est. 30 | 220 P (250 / 500) | +15 % de drenaje | superarmadura: −25 % de daño recibido durante 2,5 s |
| Mazazo | Fuerte | Maestro | Planta | 120 | arco amplio, retroceso 33 %, est. 35 | 800 P, o gratis al despertar 1 (400 / 750) | aturde un 30 % más | superarmadura: −30 % de daño recibido durante 2 s |
| Gigadrenado | Fuerte | Avanzado | Planta | 75 | proyectil rápido, drena 50 %, est. 30 | 220 P (250 / 500) | persigue al enemigo más cercano | +20 % de drenaje |
| Rayo | Fuerte | Avanzado | Eléctrico | 90 | proyectil rápido, est. 30 | 380 P (250 / 500) | aturde un 40 % más | salta al enemigo más cercano (50 % del daño) |
| Derribo | Fuerte | Avanzado | Normal | 90 | embestida, retroceso 25 %, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | invulnerable mientras golpea |
| Infortunio | Fuerte | Básico | Fantasma | 65 | proyectil lento, ×2 si está aturdido, est. 30 | 220 P (150 / 350) | persigue al enemigo más cercano | deja una marca que estalla a los 1 s (40 % del golpe) |
| Danza Espada | Potenciación | Básico | Normal | — | sobre ti, 3 golpes ×1.5, 9 s, enfr. 15 s | inicial (150 / 350) | +1 golpe potenciado | superarmadura: −40 % de daño recibido durante 3 s |
| Afilagarras | Potenciación | Avanzado | Siniestro | — | sobre ti, velocidad ×1.1, +30 % crítico, 6 s, enfr. 13 s | 350 P (250 / 500) | +1 s de duración | +10 % de crítico |
| Maldición | Potenciación | Maestro | Fantasma | — | sobre ti, cuesta 15 % PS, 4 golpes ×1.6, 10 s, enfr. 16 s | 600 P (400 / 750) | +1 golpe potenciado | superarmadura: −30 % de daño recibido durante 3 s |
| Corpulencia | Potenciación | Básico | Lucha | — | sobre ti, daño recibido ×0.6, 6 s, enfr. 16 s | 350 P (150 / 350) | −10 % de daño recibido | cura un 10 % de los PS |
| Fuego Fatuo | Potenciación | Básico | Fuego | — | sobre ti, activa Absorbe Fuego, enfr. 16 s | 350 P (150 / 350) | superarmadura: −25 % de daño recibido durante 2,5 s | un aura a tu alrededor daña durante 2,4 s que quema |
| Brillo Mágico | Área | Básico | Hada | 80 | anillo 360°, enfr. 8 s, est. 35 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Golpe Umbrío | Área | Básico | Fantasma | 120 | cono amplio, enfr. 10 s, est. 40 | inicial (150 / 350) | invulnerable mientras golpea | deja una marca que estalla a los 0,9 s (30 % del golpe) |
| Golpe Fantasma | Área | Maestro | Fantasma | 90 | embestida, enfr. 5.6 s, est. 40 | 950 P, tras Cripta del Rey de las Espadas, o gratis al despertar 2 (400 / 750) | golpe un 20 % más grande | invulnerable mientras golpea |
| Envidia Ardiente | Área | Avanzado | Fuego | 70 | cono amplio, quema, enfr. 7 s, est. 30 | 300 P (250 / 500) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Pulso Umbrío | Área | Básico | Siniestro | 80 | anillo 360°, enfr. 8 s, est. 35 | 450 P (150 / 350) | aturde un 50 % más | deja una marca que estalla a los 0,8 s (25 % del golpe) |
| Trueno | Área | Maestro | Eléctrico | 110 | anillo 360°, enfr. 6.8 s, est. 45 | 950 P, tras Bosque Brumoso (400 / 750) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |

Build recomendado: Sombra Vil · Carantoña · Danza Espada · Golpe Fantasma.

#### Zorua → Zoroark

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Golpes Furia | Rápido | Básico | Normal | 25 | arco corto, ×5 | inicial (150 / 350) | +10 % de crítico | +1 golpe |
| Finta | Rápido | Básico | Siniestro | 60 | embestida | inicial (150 / 350) | +20 % de crítico | deja una marca que estalla a los 0,9 s (35 % del golpe) |
| Tajo Umbrío | Rápido | Avanzado | Siniestro | 70 | arco corto, +25 % crítico | con Zoroark (250 / 500) | +10 % de crítico | deja una marca que estalla a los 1 s (30 % del golpe) |
| Garra Umbría | Rápido | Básico | Fantasma | 70 | arco corto | 200 P (150 / 350) | +15 % de crítico | deja una marca que estalla a los 1,2 s (35 % del golpe) |
| Golpe Bajo | Rápido | Avanzado | Siniestro | 70 | embestida, ×1.5 si el enemigo ataca, prioridad | 200 P (250 / 500) | invulnerable mientras golpea | +30 % de crítico |
| Desarme | Rápido | Avanzado | Siniestro | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Ida y Vuelta | Rápido | Avanzado | Bicho | 70 | embestida | 200 P (250 / 500) | invulnerable mientras golpea | deja una marca que estalla a los 0,7 s (25 % del golpe) |
| Desahogo | Rápido | Avanzado | Siniestro | 75 | arco corto, ×1.5 si fallaste antes | 300 P (250 / 500) | aturde un 30 % más | +20 % de drenaje |
| Meteoros | Rápido | Avanzado | Normal | 60 | proyectil rápido, teledirigido | 200 P (250 / 500) | golpe un 30 % más grande | se divide en 2 al impactar (40 % de poder cada uno) |
| Pulso Noche | Fuerte | Básico | Siniestro | 85 | anillo 360°, est. 30 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Juego Sucio | Fuerte | Básico | Siniestro | 95 | embestida, ×1.5 si el enemigo ataca, est. 30 | inicial (150 / 350) | aturde un 30 % más | +25 % de drenaje |
| Bomba Lodo | Fuerte | Maestro | Veneno | 90 | proyectil rápido, envenena, est. 40 | 800 P (400 / 750) | golpe un 25 % más grande | deja una zona en el impacto durante 2,4 s que envenena |
| Bola Sombra | Fuerte | Básico | Fantasma | 80 | proyectil rápido, est. 30 | 380 P (150 / 350) | golpe un 35 % más grande | se divide en 3 al impactar (35 % de poder cada uno) |
| Paranormal | Fuerte | Avanzado | Psíquico | 80 | proyectil rápido, est. 30 | 380 P (250 / 500) | aturde un 30 % más | persigue al enemigo más cercano |
| Hierba Lazo | Fuerte | Avanzado | Planta | 80 | arco amplio, est. 30 | 380 P (250 / 500) | aturde un 40 % más | el objetivo hace −20 % de daño durante 3 s |
| Maquinación | Potenciación | Básico | Siniestro | — | sobre ti, velocidad ×1.3, +35 % crítico, 5 s, enfr. 14 s | inicial (150 / 350) | +1 s de duración | +10 % de crítico |
| Danza Espada | Potenciación | Básico | Normal | — | sobre ti, 3 golpes ×1.5, 9 s, enfr. 15 s | 350 P (150 / 350) | +1 golpe potenciado | superarmadura: −40 % de daño recibido durante 3 s |
| Paz Mental | Potenciación | Avanzado | Psíquico | — | sobre ti, daño ×1.25, recibido ×0.8, 7 s, enfr. 15 s | 350 P (250 / 500) | +2 s de duración | −10 % de daño recibido |
| Afilagarras | Potenciación | Avanzado | Siniestro | — | sobre ti, velocidad ×1.1, +30 % crítico, 6 s, enfr. 13 s | 350 P (250 / 500) | +1 s de duración | +10 % de crítico |
| Agilidad | Potenciación | Avanzado | Psíquico | — | sobre ti, velocidad ×1.5, +0 % crítico, 5 s, enfr. 12 s | 350 P (250 / 500) | +1,5 s de duración | +15 % de crítico |
| Pulso Umbrío | Área | Básico | Siniestro | 80 | anillo 360°, enfr. 8 s, est. 35 | inicial (150 / 350) | aturde un 50 % más | deja una marca que estalla a los 0,8 s (25 % del golpe) |
| Alarido | Área | Básico | Siniestro | 55 | cono amplio, enfr. 6 s, est. 30 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −30 % de daño durante 4 s |
| Vozarrón | Área | Maestro | Normal | 90 | anillo 360°, enfr. 5.6 s, est. 40 | 950 P, tras Bosque Brumoso (400 / 750) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Envidia Ardiente | Área | Avanzado | Fuego | 70 | cono amplio, quema, enfr. 7 s, est. 30 | 300 P (250 / 500) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |

Build recomendado: Desarme · Bomba Lodo · Maquinación · Pulso Umbrío.

#### Litwick → Lampent → Chandelure

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Ascuas | Rápido | Básico | Fuego | 50 | proyectil rápido | inicial (150 / 350) | 40 % de quemar | deja una zona en el impacto durante 1,8 s que quema |
| Impresionar | Rápido | Básico | Fantasma | 30 | arco corto, aturde mucho | inicial (150 / 350) | aturde un 40 % más | el objetivo hace −25 % de daño durante 2,5 s |
| Desahogo | Rápido | Avanzado | Siniestro | 75 | arco corto, ×1.5 si fallaste antes | con Lampent (250 / 500) | aturde un 30 % más | +20 % de drenaje |
| Tinieblas | Rápido | Avanzado | Fantasma | 50 | proyectil rápido | 120 P (250 / 500) | persigue al enemigo más cercano | deja una marca que estalla a los 1 s (30 % del golpe) |
| Polución | Rápido | Avanzado | Veneno | 30 | proyectil rápido, envenena | 120 P (250 / 500) | golpe un 30 % más grande | deja una zona en el impacto durante 1,6 s que envenena |
| Niebla Clara | Rápido | Avanzado | Veneno | 50 | proyectil rápido | 120 P (250 / 500) | golpe un 20 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Nitrocarga | Rápido | Avanzado | Fuego | 50 | embestida | 120 P (250 / 500) | superarmadura: −20 % de daño recibido durante 2 s | invulnerable mientras golpea |
| Infortunio | Fuerte | Básico | Fantasma | 65 | proyectil lento, ×2 si está aturdido, est. 30 | inicial (150 / 350) | persigue al enemigo más cercano | deja una marca que estalla a los 1 s (40 % del golpe) |
| Infierno | Fuerte | Básico | Fuego | 100 | proyectil lento, est. 35 | inicial (150 / 350) | siempre quema | deja una zona en el impacto durante 2,4 s que quema |
| Hiperrayo | Fuerte | Básico | Normal | 150 | onda en línea (atraviesa), est. 35 | con Chandelure (150 / 350) | golpe un 20 % más grande | aturde un 40 % más |
| Bola Sombra | Fuerte | Básico | Fantasma | 80 | proyectil rápido, est. 30 | 380 P (150 / 350) | golpe un 35 % más grande | se divide en 3 al impactar (35 % de poder cada uno) |
| Llamarada | Fuerte | Maestro | Fuego | 110 | proyectil lento, quema, est. 40 | 800 P (400 / 750) | golpe un 20 % más grande | se divide en 4 al impactar (30 % de poder cada uno) |
| Energibola | Fuerte | Avanzado | Planta | 90 | proyectil rápido, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | se divide en 3 al impactar (30 % de poder cada uno) |
| Sofoco | Fuerte | Avanzado | Fuego | 130 | proyectil rápido, enfr. 7 s, est. 40 | 560 P (250 / 500) | golpe un 20 % más grande | superarmadura: −30 % de daño recibido durante 2,5 s |
| Envite Ígneo | Fuerte | Maestro | Fuego | 120 | embestida, retroceso 33 %, quema, est. 35 | 800 P, tras Cripta del Rey de las Espadas (400 / 750) | superarmadura: −25 % de daño recibido durante 2 s | invulnerable mientras golpea |
| Poltergeist | Fuerte | Avanzado | Fantasma | 110 | arco amplio, est. 35 | 560 P (250 / 500) | aturde un 30 % más | deja una marca que estalla a los 1,2 s (30 % del golpe) |
| Psíquico | Fuerte | Avanzado | Psíquico | 90 | proyectil rápido, est. 30 | 380 P (250 / 500) | persigue al enemigo más cercano | el objetivo hace −20 % de daño durante 3 s |
| Rayo Solar | Fuerte | Avanzado | Planta | 120 | onda en línea (atraviesa), est. 35 | 560 P (250 / 500) | golpe un 20 % más grande | deja un rastro que daña durante 1,8 s |
| Cólera Ardiente | Fuerte | Avanzado | Fuego | 75 | anillo 360°, ×2 si fallaste antes, est. 30 | 220 P (250 / 500) | golpe un 15 % más grande | un aura a tu alrededor daña durante 1,8 s que quema |
| Fuego Fatuo | Potenciación | Básico | Fuego | — | sobre ti, activa Absorbe Fuego, enfr. 16 s | inicial (150 / 350) | superarmadura: −25 % de daño recibido durante 2,5 s | un aura a tu alrededor daña durante 2,4 s que quema |
| Paz Mental | Potenciación | Avanzado | Psíquico | — | sobre ti, daño ×1.25, recibido ×0.8, 7 s, enfr. 15 s | 350 P (250 / 500) | +2 s de duración | −10 % de daño recibido |
| Maldición | Potenciación | Maestro | Fantasma | — | sobre ti, cuesta 15 % PS, 4 golpes ×1.6, 10 s, enfr. 16 s | 600 P (400 / 750) | +1 golpe potenciado | superarmadura: −30 % de daño recibido durante 3 s |
| Armadura Ácida | Potenciación | Avanzado | Veneno | — | sobre ti, daño recibido ×0.5, 5 s, enfr. 16 s | 350 P (250 / 500) | +1,5 s de duración | cura un 8 % de los PS |
| Reducción | Potenciación | Avanzado | Normal | — | sobre ti, velocidad ×1.25, +10 % crítico, 4 s, enfr. 12 s | 350 P (250 / 500) | +10 % de velocidad | superarmadura: −30 % de daño recibido durante 2 s |
| Lanzallamas | Área | Básico | Fuego | 90 | onda en línea (atraviesa), enfr. 8 s, est. 35 | inicial (150 / 350) | 30 % de quemar | deja un rastro que daña durante 2 s que quema |
| Onda Ígnea | Área | Básico | Fuego | 95 | cono amplio, enfr. 9 s, est. 40 | inicial (150 / 350) | golpe un 15 % más grande | 50 % de quemar |
| Giro Fuego | Área | Maestro | Fuego | 30 | proyectil lento, zona que repite cada 600 ms, quema, enfr. 8.7 s, est. 40 | 950 P, tras Bosque Brumoso (400 / 750) | golpe un 20 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Pulso Umbrío | Área | Básico | Siniestro | 80 | anillo 360°, enfr. 8 s, est. 35 | 450 P (150 / 350) | aturde un 50 % más | deja una marca que estalla a los 0,8 s (25 % del golpe) |
| Envidia Ardiente | Área | Avanzado | Fuego | 70 | cono amplio, quema, enfr. 7 s, est. 30 | 300 P (250 / 500) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |

Build recomendado: Ascuas · Bola Sombra · Paz Mental · Lanzallamas.

#### Cubone → Marowak

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Hueso Palo | Rápido | Básico | Tierra | 65 | arco corto | inicial (150 / 350) | aturde un 30 % más | +25 % de crítico |
| Ataque Óseo | Rápido | Básico | Tierra | 30 | embestida, ×3 | inicial (150 / 350) | golpe un 20 % más grande | +1 golpe |
| Desarme | Rápido | Avanzado | Siniestro | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Puño Fuego | Rápido | Avanzado | Fuego | 75 | arco corto, quema | 300 P (250 / 500) | +10 % de crítico | deja una zona en el impacto durante 1,5 s que quema |
| Puño Trueno | Rápido | Avanzado | Eléctrico | 75 | arco corto | 300 P (250 / 500) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |
| Golpe Cabeza | Rápido | Avanzado | Normal | 70 | embestida, aturde mucho | 200 P (250 / 500) | aturde un 30 % más | superarmadura: −20 % de daño recibido durante 1,5 s |
| Patada Baja | Rápido | Avanzado | Lucha | 60 | arco corto | 200 P (250 / 500) | aturde un 40 % más | el objetivo hace −20 % de daño durante 2,5 s |
| Doble Patada | Rápido | Avanzado | Lucha | 30 | arco corto, ×2 | 120 P (250 / 500) | +10 % de crítico | +1 golpe |
| Bofetón Lodo | Rápido | Avanzado | Tierra | 20 | proyectil rápido, aturde mucho | 120 P (250 / 500) | aturde un 30 % más | el objetivo hace −30 % de daño durante 3 s |
| Huesomerang | Fuerte | Básico | Tierra | 50 | bumerán (vuelve a ti), est. 30 | inicial (150 / 350) | golpe un 25 % más grande | vuelve a lanzarse 1 vez más (50 % de poder) |
| Pataleta | Fuerte | Básico | Tierra | 75 | anillo 360°, ×2 si fallaste antes, est. 30 | inicial (150 / 350) | golpe un 15 % más grande | una réplica a tu alrededor a los 0,5 s |
| Llamarada | Fuerte | Maestro | Fuego | 110 | proyectil lento, quema, est. 40 | con Marowak (400 / 750) | golpe un 20 % más grande | se divide en 4 al impactar (30 % de poder cada uno) |
| Doble Filo | Fuerte | Maestro | Normal | 120 | embestida, retroceso 33 %, est. 35 | 800 P (400 / 750) | aturde un 20 % más | superarmadura: −30 % de daño recibido durante 2 s |
| Cabeza de Hierro | Fuerte | Avanzado | Acero | 80 | embestida, est. 30 | 380 P (250 / 500) | aturde un 30 % más | invulnerable mientras golpea |
| Tierra Viva | Fuerte | Avanzado | Tierra | 90 | onda en línea (atraviesa), est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | deja un rastro que daña durante 1,5 s |
| Demolición | Fuerte | Avanzado | Lucha | 75 | arco amplio, est. 30 | 220 P (250 / 500) | +15 % de crítico | el objetivo hace −25 % de daño durante 3 s |
| Arenas Ardientes | Fuerte | Avanzado | Tierra | 70 | proyectil rápido, quema, est. 35 | 220 P (250 / 500) | golpe un 20 % más grande | deja una zona en el impacto durante 1,8 s que quema |
| Excavar | Fuerte | Avanzado | Tierra | 80 | embestida, est. 30 | 380 P (250 / 500) | invulnerable mientras golpea | una réplica a tu alrededor a los 0,3 s |
| Puño Certero | Fuerte | Maestro | Lucha | 150 | arco amplio, est. 40 | 800 P, tras Cripta del Rey de las Espadas (400 / 750) | superarmadura: −30 % de daño recibido durante 1,5 s | aturde un 40 % más |
| Corpulencia | Potenciación | Básico | Lucha | — | sobre ti, daño recibido ×0.6, 6 s, enfr. 16 s | inicial (150 / 350) | −10 % de daño recibido | cura un 10 % de los PS |
| Danza Espada | Potenciación | Básico | Normal | — | sobre ti, 3 golpes ×1.5, 9 s, enfr. 15 s | 350 P (150 / 350) | +1 golpe potenciado | superarmadura: −40 % de daño recibido durante 3 s |
| Foco Energía | Potenciación | Avanzado | Normal | — | sobre ti, velocidad ×1, +50 % crítico, 6 s, enfr. 15 s | 350 P (250 / 500) | +1 s de duración | +10 % de crítico |
| Tambor | Potenciación | Maestro | Normal | — | sobre ti, cuesta 50 % PS, 3 golpes ×2, 10 s, enfr. 22 s | 600 P (400 / 750) | +1 golpe potenciado | cura un 15 % de los PS |
| Defensa Férrea | Potenciación | Avanzado | Acero | — | sobre ti, daño recibido ×0.5, 5 s, enfr. 16 s | 350 P (250 / 500) | +1,5 s de duración | cura un 8 % de los PS |
| Terremoto | Área | Básico | Tierra | 100 | anillo 360°, enfr. 10 s, est. 40 | inicial (150 / 350) | aturde un 25 % más | una réplica a tu alrededor a los 0,6 s |
| Terratemblor | Área | Básico | Tierra | 60 | anillo 360°, enfr. 6 s, est. 30 | inicial (150 / 350) | golpe un 15 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Avalancha | Área | Avanzado | Roca | 75 | cono amplio, enfr. 7 s, est. 35 | 300 P (250 / 500) | aturde un 30 % más | deja una zona en el impacto durante 0,2 s |
| Rayo Hielo | Área | Maestro | Hielo | 90 | onda en línea (atraviesa), enfr. 5.6 s, est. 40 | 950 P, tras Bosque Brumoso (400 / 750) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Lanzallamas | Área | Básico | Fuego | 90 | onda en línea (atraviesa), enfr. 8 s, est. 35 | 450 P (150 / 350) | 30 % de quemar | deja un rastro que daña durante 2 s que quema |

Build recomendado: Desarme · Huesomerang · Danza Espada · Terremoto.

#### Abra → Kadabra → Alakazam

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Meteoros | Rápido | Avanzado | Normal | 60 | proyectil rápido, teledirigido | inicial (250 / 500) | golpe un 30 % más grande | se divide en 2 al impactar (40 % de poder cada uno) |
| Tinieblas | Rápido | Avanzado | Fantasma | 50 | proyectil rápido | con Kadabra (250 / 500) | persigue al enemigo más cercano | deja una marca que estalla a los 1 s (30 % del golpe) |
| Psicocorte | Rápido | Avanzado | Psíquico | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | deja una marca que estalla a los 1 s (30 % del golpe) |
| Puño Fuego | Rápido | Avanzado | Fuego | 75 | arco corto, quema | 300 P (250 / 500) | +10 % de crítico | deja una zona en el impacto durante 1,5 s que quema |
| Puño Trueno | Rápido | Avanzado | Eléctrico | 75 | arco corto | 300 P (250 / 500) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |
| Puño Hielo | Rápido | Avanzado | Hielo | 75 | arco corto | 300 P (250 / 500) | aturde un 30 % más | el objetivo hace −20 % de daño durante 3 s |
| Desarme | Rápido | Avanzado | Siniestro | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Psíquico | Fuerte | Avanzado | Psíquico | 90 | proyectil rápido, est. 30 | inicial (250 / 500) | persigue al enemigo más cercano | el objetivo hace −20 % de daño durante 3 s |
| Bola Sombra | Fuerte | Básico | Fantasma | 80 | proyectil rápido, est. 30 | con Alakazam (150 / 350) | golpe un 35 % más grande | se divide en 3 al impactar (35 % de poder cada uno) |
| Psicocarga | Fuerte | Avanzado | Psíquico | 80 | proyectil rápido, est. 30 | 380 P (250 / 500) | persigue al enemigo más cercano | el objetivo hace −20 % de daño durante 3 s |
| Energibola | Fuerte | Avanzado | Planta | 90 | proyectil rápido, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | se divide en 3 al impactar (30 % de poder cada uno) |
| Hierba Lazo | Fuerte | Avanzado | Planta | 80 | arco amplio, est. 30 | 380 P (250 / 500) | aturde un 40 % más | el objetivo hace −20 % de daño durante 3 s |
| Puño Drenaje | Fuerte | Avanzado | Lucha | 75 | arco amplio, drena 50 %, est. 30 | 220 P (250 / 500) | +15 % de drenaje | superarmadura: −25 % de daño recibido durante 2,5 s |
| Puño Certero | Fuerte | Maestro | Lucha | 150 | arco amplio, est. 40 | 800 P, tras Cripta del Rey de las Espadas (400 / 750) | superarmadura: −30 % de daño recibido durante 1,5 s | aturde un 40 % más |
| Paz Mental | Potenciación | Avanzado | Psíquico | — | sobre ti, daño ×1.25, recibido ×0.8, 7 s, enfr. 15 s | inicial (250 / 500) | +2 s de duración | −10 % de daño recibido |
| Maquinación | Potenciación | Básico | Siniestro | — | sobre ti, velocidad ×1.3, +35 % crítico, 5 s, enfr. 14 s | 350 P (150 / 350) | +1 s de duración | +10 % de crítico |
| Reflejo | Potenciación | Avanzado | Psíquico | — | sobre ti, daño recibido ×0.5, 5 s, enfr. 16 s | 350 P (250 / 500) | +1,5 s de duración | cura un 8 % de los PS |
| Brillo Mágico | Área | Básico | Hada | 80 | anillo 360°, enfr. 8 s, est. 35 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Psicorrayo | Área | Avanzado | Psíquico | 65 | onda en línea (atraviesa), enfr. 6 s, est. 35 | 300 P (250 / 500) | golpe un 15 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Premonición | Área | Maestro | Psíquico | 120 | anillo 360°, enfr. 7.6 s, est. 45 | 950 P, tras Bosque Brumoso (400 / 750) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |

Build recomendado: Psicocorte · Bola Sombra · Maquinación · Brillo Mágico.

#### Piplup → Prinplup → Empoleon

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Pistola Agua | Rápido | Básico | Agua | 40 | proyectil rápido | inicial (150 / 350) | golpe un 30 % más grande | se divide en 2 al impactar (40 % de poder cada uno) |
| Acua Jet | Rápido | Avanzado | Agua | 40 | embestida, prioridad | 120 P (250 / 500) | invulnerable mientras golpea | +20 % de crítico |
| Garra Metal | Rápido | Avanzado | Acero | 50 | arco corto | 120 P (250 / 500) | +15 % de crítico | superarmadura: −20 % de daño recibido durante 1,5 s |
| Garra Umbría | Rápido | Básico | Fantasma | 70 | arco corto | 200 P (150 / 350) | +15 % de crítico | deja una marca que estalla a los 1,2 s (35 % del golpe) |
| Desarme | Rápido | Avanzado | Siniestro | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Rayo Burbuja | Fuerte | Básico | Agua | 65 | proyectil rápido, est. 30 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Demolición | Fuerte | Avanzado | Lucha | 75 | arco amplio, est. 30 | con Prinplup (250 / 500) | +15 % de crítico | el objetivo hace −25 % de daño durante 3 s |
| Foco Resplandor | Fuerte | Avanzado | Acero | 80 | proyectil rápido, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | se divide en 3 al impactar (30 % de poder cada uno) |
| Hierba Lazo | Fuerte | Avanzado | Planta | 80 | arco amplio, est. 30 | 380 P (250 / 500) | aturde un 40 % más | el objetivo hace −20 % de daño durante 3 s |
| Derribo | Fuerte | Avanzado | Normal | 90 | embestida, retroceso 25 %, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | invulnerable mientras golpea |
| Hidrobomba | Fuerte | Maestro | Agua | 110 | proyectil rápido, est. 40 | 800 P, tras Cuevas Inundadas (400 / 750) | golpe un 20 % más grande | aturde un 30 % más |
| Doble Filo | Fuerte | Maestro | Normal | 120 | embestida, retroceso 33 %, est. 35 | 800 P (400 / 750) | aturde un 20 % más | superarmadura: −30 % de daño recibido durante 2 s |
| Danza Espada | Potenciación | Básico | Normal | — | sobre ti, 3 golpes ×1.5, 9 s, enfr. 15 s | inicial (150 / 350) | +1 golpe potenciado | superarmadura: −40 % de daño recibido durante 3 s |
| Agilidad | Potenciación | Avanzado | Psíquico | — | sobre ti, velocidad ×1.5, +0 % crítico, 5 s, enfr. 12 s | 350 P (250 / 500) | +1,5 s de duración | +15 % de crítico |
| Defensa Férrea | Potenciación | Avanzado | Acero | — | sobre ti, daño recibido ×0.5, 5 s, enfr. 16 s | 350 P (250 / 500) | +1,5 s de duración | cura un 8 % de los PS |
| Surf | Área | Básico | Agua | 90 | anillo 360°, enfr. 7.6 s, est. 35 | inicial (150 / 350) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Rayo Hielo | Área | Maestro | Hielo | 90 | onda en línea (atraviesa), enfr. 5.6 s, est. 40 | con Empoleon (400 / 750) | golpe un 15 % más grande | el objetivo hace −25 % de daño durante 3 s |
| Avalancha | Área | Avanzado | Roca | 75 | cono amplio, enfr. 7 s, est. 35 | 300 P (250 / 500) | aturde un 30 % más | deja una zona en el impacto durante 0,2 s |
| Terratemblor | Área | Básico | Tierra | 60 | anillo 360°, enfr. 6 s, est. 30 | 300 P (150 / 350) | golpe un 15 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Terremoto | Área | Básico | Tierra | 100 | anillo 360°, enfr. 10 s, est. 40 | 650 P (150 / 350) | aturde un 25 % más | una réplica a tu alrededor a los 0,6 s |

Build recomendado: Desarme · Foco Resplandor · Defensa Férrea · Surf.

#### Shinx → Luxio → Luxray

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Chispa | Rápido | Básico | Eléctrico | 65 | embestida | inicial (150 / 350) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |
| Meteoros | Rápido | Avanzado | Normal | 60 | proyectil rápido, teledirigido | con Luxio (250 / 500) | golpe un 30 % más grande | se divide en 2 al impactar (40 % de poder cada uno) |
| Colmillo Rayo | Rápido | Avanzado | Eléctrico | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |
| Colmillo Hielo | Rápido | Avanzado | Hielo | 65 | arco corto | 200 P (250 / 500) | aturde un 30 % más | el objetivo hace −20 % de daño durante 3 s |
| Colmillo Ígneo | Rápido | Avanzado | Fuego | 65 | arco corto, quema | 200 P (250 / 500) | +10 % de crítico | 60 % de quemar |
| Tajo Umbrío | Rápido | Avanzado | Siniestro | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | deja una marca que estalla a los 1 s (30 % del golpe) |
| Doble Patada | Rápido | Avanzado | Lucha | 30 | arco corto, ×2 | 120 P (250 / 500) | +10 % de crítico | +1 golpe |
| Rayo | Fuerte | Avanzado | Eléctrico | 90 | proyectil rápido, est. 30 | inicial (250 / 500) | aturde un 40 % más | salta al enemigo más cercano (50 % del daño) |
| Triturar | Fuerte | Avanzado | Siniestro | 80 | arco amplio, est. 30 | 380 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Derribo | Fuerte | Avanzado | Normal | 90 | embestida, retroceso 25 %, est. 30 | 380 P (250 / 500) | golpe un 20 % más grande | invulnerable mientras golpea |
| Carantoña | Fuerte | Básico | Hada | 90 | arco amplio, est. 30 | 380 P (150 / 350) | aturde un 30 % más | el objetivo hace −30 % de daño durante 4 s |
| Voltio Cruel | Fuerte | Maestro | Eléctrico | 120 | embestida, retroceso 25 %, est. 35 | 800 P, tras Pantano Tóxico (400 / 750) | superarmadura: −25 % de daño recibido durante 2 s | invulnerable mientras golpea |
| Doble Filo | Fuerte | Maestro | Normal | 120 | embestida, retroceso 33 %, est. 35 | 800 P (400 / 750) | aturde un 20 % más | superarmadura: −30 % de daño recibido durante 2 s |
| Agilidad | Potenciación | Avanzado | Psíquico | — | sobre ti, velocidad ×1.5, +0 % crítico, 5 s, enfr. 12 s | inicial (250 / 500) | +1,5 s de duración | +15 % de crítico |
| Carga | Potenciación | Avanzado | Eléctrico | — | sobre ti, 2 golpes ×1.5, 8 s, enfr. 14 s | 350 P (250 / 500) | +1 golpe potenciado | +1 s de duración |
| Aullido | Potenciación | Avanzado | Normal | — | sobre ti, 3 golpes ×1.25, 8 s, enfr. 14 s | 350 P (250 / 500) | +1 golpe potenciado | superarmadura: −20 % de daño recibido durante 2 s |
| Alarido | Área | Básico | Siniestro | 55 | cono amplio, enfr. 6 s, est. 30 | inicial (150 / 350) | golpe un 20 % más grande | el objetivo hace −30 % de daño durante 4 s |
| Trueno | Área | Maestro | Eléctrico | 110 | anillo 360°, enfr. 6.8 s, est. 45 | con Luxray (400 / 750) | aturde un 30 % más | salta al enemigo más cercano (50 % del daño) |
| Chispazo | Área | Avanzado | Eléctrico | 80 | anillo 360°, enfr. 7 s, est. 35 | 450 P (250 / 500) | golpe un 15 % más grande | salta al enemigo más cercano (50 % del daño) |
| Electrotela | Área | Avanzado | Eléctrico | 55 | cono amplio, enfr. 6 s, est. 35 | 300 P (250 / 500) | golpe un 15 % más grande | el objetivo hace −30 % de daño durante 4 s |

Build recomendado: Colmillo Hielo · Voltio Cruel · Aullido · Alarido.

#### Axew → Fraxure → Haxorus

| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |
|---|---|---|---|---|---|---|---|---|
| Garra Dragón | Rápido | Básico | Dragón | 80 | arco corto | inicial (150 / 350) | +15 % de crítico | deja una marca que estalla a los 0,8 s (30 % del golpe) |
| Tijera X | Rápido | Avanzado | Bicho | 80 | arco corto | con Fraxure (250 / 500) | +15 % de crítico | deja una marca que estalla a los 0,8 s (30 % del golpe) |
| Cuchillada | Rápido | Avanzado | Normal | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | aturde un 30 % más |
| Tajo Umbrío | Rápido | Avanzado | Siniestro | 70 | arco corto, +25 % crítico | 200 P (250 / 500) | +10 % de crítico | deja una marca que estalla a los 1 s (30 % del golpe) |
| Garra Umbría | Rápido | Básico | Fantasma | 70 | arco corto | 200 P (150 / 350) | +15 % de crítico | deja una marca que estalla a los 1,2 s (35 % del golpe) |
| Patada Baja | Rápido | Avanzado | Lucha | 60 | arco corto | 200 P (250 / 500) | aturde un 40 % más | el objetivo hace −20 % de daño durante 2,5 s |
| Pulso Dragón | Fuerte | Básico | Dragón | 85 | proyectil rápido, est. 30 | inicial (150 / 350) | golpe un 20 % más grande | se divide en 3 al impactar (30 % de poder cada uno) |
| Demolición | Fuerte | Avanzado | Lucha | 75 | arco amplio, est. 30 | con Haxorus (250 / 500) | +15 % de crítico | el objetivo hace −25 % de daño durante 3 s |
| Triturar | Fuerte | Avanzado | Siniestro | 80 | arco amplio, est. 30 | 380 P (250 / 500) | aturde un 30 % más | el objetivo hace −25 % de daño durante 4 s |
| Cabeza de Hierro | Fuerte | Avanzado | Acero | 80 | embestida, est. 30 | 380 P (250 / 500) | aturde un 30 % más | invulnerable mientras golpea |
| Excavar | Fuerte | Avanzado | Tierra | 80 | embestida, est. 30 | 380 P (250 / 500) | invulnerable mientras golpea | una réplica a tu alrededor a los 0,3 s |
| Pataleta | Fuerte | Básico | Tierra | 75 | anillo 360°, ×2 si fallaste antes, est. 30 | 220 P (150 / 350) | golpe un 15 % más grande | una réplica a tu alrededor a los 0,5 s |
| Enfado | Fuerte | Maestro | Dragón | 120 | arco amplio, enfr. 0.78 s, est. 40 | 800 P, tras Cripta del Rey de las Espadas (400 / 750) | superarmadura: −30 % de daño recibido durante 2 s | aturde un 30 % más |
| Doble Filo | Fuerte | Maestro | Normal | 120 | embestida, retroceso 33 %, est. 35 | 800 P (400 / 750) | aturde un 20 % más | superarmadura: −30 % de daño recibido durante 2 s |
| Danza Espada | Potenciación | Básico | Normal | — | sobre ti, 3 golpes ×1.5, 9 s, enfr. 15 s | inicial (150 / 350) | +1 golpe potenciado | superarmadura: −40 % de daño recibido durante 3 s |
| Foco Energía | Potenciación | Avanzado | Normal | — | sobre ti, velocidad ×1, +50 % crítico, 6 s, enfr. 15 s | 350 P (250 / 500) | +1 s de duración | +10 % de crítico |
| Danza Dragón | Potenciación | Avanzado | Dragón | — | sobre ti, velocidad ×1.25, +15 % crítico, 6 s, enfr. 14 s | 350 P (250 / 500) | +1 s de duración | +10 % de crítico |
| Terremoto | Área | Básico | Tierra | 100 | anillo 360°, enfr. 10 s, est. 40 | inicial (150 / 350) | aturde un 25 % más | una réplica a tu alrededor a los 0,6 s |
| Avalancha | Área | Avanzado | Roca | 75 | cono amplio, enfr. 7 s, est. 35 | 300 P (250 / 500) | aturde un 30 % más | deja una zona en el impacto durante 0,2 s |
| Terratemblor | Área | Básico | Tierra | 60 | anillo 360°, enfr. 6 s, est. 30 | 300 P (150 / 350) | golpe un 15 % más grande | el objetivo hace −20 % de daño durante 3 s |
| Alarido | Área | Básico | Siniestro | 55 | cono amplio, enfr. 6 s, est. 30 | 300 P (150 / 350) | golpe un 20 % más grande | el objetivo hace −30 % de daño durante 4 s |

Build recomendado: Garra Dragón · Enfado · Danza Dragón · Terremoto.

**Pendiente:** Ida y Vuelta no te devuelve atrás; Nitrocarga no sube la velocidad; Golpe Fantasma solo te hace invulnerable con su rango +2 (y solo en el golpe, no mientras desapareces).

**En una sala en línea** (cuando el golpe es de un invitado): la quemadura o el veneno que prende en su tirada, la marca y el debilitar viajan en su reclamación de golpe; el anfitrión los aplica una sola vez, los hace correr y los manda en su instantánea, así que el invitado ve la marca y el debilitar, y un enemigo debilitado también le pega más flojo (sus disparos llevan el factor). Las zonas, las divisiones, las cadenas y los relanzamientos son golpes del propio invitado: los crea en su lado y reclama cada golpe como cualquier otro (cada pasada de una zona que dura, como Giro Fuego, es su propia reclamación). Sus i-frames y su superarmadura le protegen en su pantalla, donde se juzgan los golpes que recibe. El anfitrión dibuja las zonas de un invitado como sus proyectiles, no como un círculo en el suelo.

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

### Gacha, evoluciones y mazmorras reto *(provisional)*

Mimikyu atiende el puesto de la suerte en el pueblo (decisión del 26-10-2026: quiere hacer amigos). Su ventana enseña el saldo, el precio, las probabilidades y cuántas tiradas faltan para una rara segura. Cada tirada se guarda al momento.

- Una tirada cuesta 100 P y da la primera forma de una línea. Común (85 %): Piplup o Shinx. Rara (15 %): Abra o Axew.
- La rara es segura a la décima tirada desde la última rara (el contador se guarda).
- Si ya tienes esa línea (en cualquier forma), te devuelve 40 P.
- Lo que sale se puede jugar en todas partes, también en cooperativo. Los cuatro iniciales siguen siempre disponibles.
- **Shiny** (decisión del plan del gacha, §5.1 de `docs/gacha-roster-plan.md`): cada tirada tiene un 2,5 % de salir shiny, y es seguro a las 80 tiradas sin ninguno (un contador propio, que también se guarda). Un shiny desbloquea el **aspecto shiny de su línea**, aunque la línea ya fuera tuya (la devolución de 40 P se cobra igual). La revelación enseña la hoja shiny con un destello y «¡Shiny!».

#### Aspectos shiny

- Todas las especies jugables tienen su hoja shiny (de PMDCollab, carpeta `<dex>/<forma>/0001`), también el Mimikyu desenmascarado.
- El aspecto es de la línea: lo llevan todas sus formas, así que evolucionar no lo quita. Es solo de colores: no cambia ningún número ni movimiento (un test juega cada especie con y sin él y comprueba que la partida es idéntica).
- Las líneas del puesto lo consiguen tirando; las de los iniciales, que no salen en el puesto, ganando su reto en Pesadilla (sale de `CHALLENGES`, no hay lista a mano).
- Cada aspecto conseguido es un logro (familia «Shiny», 30 P).
- Se pone y se quita cuando quieras, por línea: en la elección de movimientos («Aspecto shiny: Sí/No») y en la ventana de Phantump («Shiny de Zorua»). Al conseguirlo se pone solo. Se guarda en la partida (`shinies`, `shinyWorn`, `shinyPity`; campos opcionales, sin cambiar la versión del guardado).
- En cooperativo viaja en el saludo, en la lista de jugadores y en el estado de cada jugador, así que los compañeros lo ven en la mazmorra y en el pueblo (versión del protocolo 4).

Las evoluciones no están en el puesto: las hace Phantump, la vidente del Lago, en su propia ventana (decisión del 26-10-2026). Evolucionan las líneas del gacha y también los iniciales (decisión del 26-10-2026): Zorua en Zoroark, Litwick en Lampent y luego Chandelure, Cubone en Marowak. Se paga con Pokémonedas y Esencias de su línea. Cada Esencia tiene el nivel de la dificultad con la que ganaste el reto (Normal, Difícil o Pesadilla; Fácil no da Esencias), y un nivel alto no sustituye a uno bajo (decisión del 26-10-2026). Así la última evolución es imposible sin ganar un reto en Pesadilla:

| Paso | Precio | Esencias | Bono de PS y daño |
| --- | --- | --- | --- |
| Primera a segunda forma | 400 P | 3 Normal y 2 Difícil | +6 % |
| A la forma final | 900 P | 3 Difícil y 2 Pesadilla | +12 % |

Una línea de un solo paso (Zorua, Cubone) va directa a la forma final, así que pide Esencias de Pesadilla. El bono tiene tope: 15 % jugando solo y 8 % en grupo. Cada forma nueva conserva el kit, la oferta del maestro, los movimientos comprados, las Mejoras y la habilidad, y aprende un movimiento: Kadabra Tinieblas, Alakazam Bola Sombra, Prinplup Demolición, Empoleon Rayo Hielo, Luxio Meteoros, Luxray Trueno, Fraxure Tijera X, Haxorus Demolición, Zoroark Tajo Umbrío, Lampent Desahogo, Chandelure Hiperrayo y Marowak Llamarada. Si evolucionas el Pokémon que llevas elegido, pasas a jugar con su forma nueva; un inicial evolucionado ocupa su sitio en la lista.

Mimikyu no evoluciona (no tiene evolución en los juegos): **despierta** (decisión del 26-10-2026). Sigue siendo Mimikyu, con el mismo sprite, pero sube dos pasos como una línea de tres formas, con los mismos precios, Esencias y bonos. El primer despertar le enseña Mazazo y el segundo Golpe Fantasma, gratis y sin esperar a la mazmorra que los abre en el maestro. Su paso se guarda en la partida (`awakened`). En la ventana de Phantump su fila dice «Mimikyu · Despertar 1/2».

Las Esencias se ganan en las mazmorras reto, una por línea. Cada reto es la prueba de su Pokémon, con nombre, presentación, una frase por planta y otra al ganar: siete plantas por el camino de su capítulo, con dos sombras y su herida como jefe final (las Sendas, abajo). Los enemigos se mezclan de varias mazmorras según la historia del reto, y casi todos (al menos el 70 % del peso) reciben daño neutro o mejor de los tipos de la línea; ninguno es inmune a todos y el jefe tampoco los resiste:

| Reto (Senda) | Camino del I (Fácil y Normal) | Camino del II (Difícil) | Camino del III (Pesadilla) | Jefe final (la herida) |
| --- | --- | --- | --- | --- |
| La Senda del Sueño (Abra) | Cuevas | Cripta | Pantano | Alakazam Desvelado |
| La Senda del Lago Helado (Piplup) | Cripta | Cuevas | Bosque | Empoleon de Hielo Negro |
| La Senda de la Tormenta (Shinx) | Pantano | Cuevas | Cripta | Luxray Sin Párpados |
| La Senda del Colmillo (Axew) | Bosque | Cuevas | Cripta | Haxorus de Colmillos Rotos |
| La Senda del Disfraz (Mimikyu) | Cripta | Bosque | Cuevas | Mimikyu Sin Disfraz |
| La Senda del Reflejo (Zorua) | Cuevas | Bosque | Pantano | Zoroark de Niebla Blanca |
| La Senda de la Llama (Litwick) | Cuevas | Cripta | Pantano | Chandelure de Llamas Ajenas |
| La Senda del Hueso (Cubone) | Pantano | Cuevas | Cripta | Marowak Sin Lágrimas |

Datos: `*_ROADS` en `src/data/story/*.ts` (cada capítulo toma el aspecto de esa mazmorra y tiene sus dos sombras; ninguna Senda usa ya a los guardianes ni a los jefes intermedios como jefe final). Los retos no llenan la selección de mazmorra: una sola entrada **Desafíos** abre su propio menú (decisión del 26-10-2026), al que también se llega desde la salida del pueblo y desde la ventana de Phantump. El menú enseña cada reto con el retrato de la forma que tienes de su línea, su presentación, qué dificultad da qué Esencia, si tienes la línea y si tu Pokémon puede entrar; los que no se pueden jugar salen en gris («Juega con Kadabra.», «Aún no tienes esta línea.»). Elegido desde el pueblo, el equipo solo ofrece las formas de esa línea y empieza con la que tienes. Al ganar, la pantalla final cierra con la frase del reto. Un reto se abre cuando tienes cualquier forma de su línea (los de los iniciales, siempre) y **solo se puede jugar con una forma de esa línea**, también en cooperativo: el anfitrión no puede empezarlo si alguien lleva otro Pokémon (decisión del 26-10-2026). Ganarlo da 3 Esencias del nivel de su dificultad. En cooperativo cada jugador cobra en su propia partida guardada. Datos: `src/data/gacha.ts`, `src/data/player-evolutions.ts` y `CHALLENGES` en `src/data/dungeons.ts`.

#### Sendas (misiones de historia) *(provisional)*

Cada mazmorra reto es también la **Senda** de su línea: tres capítulos, uno por nivel de material (I en Normal, II en Difícil, III en Pesadilla; cada uno se abre al cerrar el anterior), con una cinemática antes y otra después, la voz del Pokémon durante la partida, dos fragmentos de memoria, y una línea de vínculo por capítulo en la ventana de Phantump. Una Senda tiene siete plantas y tres jefes: dos jefes intermedios con su niebla y su hoguera, y como jefe final **la herida**, el propio Pokémon enorme y corrompido (Mimikyu Sin Disfraz), con cartas de hechizo que se demuestran ganables en todos los niveles (`tests/sim/wound-prove.test.ts`, el demostrador de `npm run prove`). El III termina en el despertar o la evolución final. Tono souls con la cercanía de Genshin. Además, todo reto cumple una regla de alcance: como mucho un 10 % del peso de aparición puede ser incapaz de dañar la línea (por tipo o por pasiva, como Absorbe Fuego) y todo jefe la daña. Diseño completo y esquema de las ocho en `docs/story-quests.md`; la de Mimikyu (La Senda del Disfraz) es el piloto, y las ocho están completas, la suya incluida: Mimikyu (La Senda del Disfraz), Cubone (La Senda del Hueso), Litwick (La Senda de la Llama), Zorua (La Senda del Reflejo), Abra (La Senda del Sueño), Piplup (La Senda del Lago Helado), Shinx (La Senda de la Tormenta) y Axew (La Senda del Colmillo), con un camino propio por capítulo: cada capítulo toma el aspecto de otra mazmorra y tiene sus dos jefes intermedios, casi todos **sombras** nuevas de su historia (Ditto, Pikachu, Hatterene, Mandibuzz, Kangaskhan, Dusknoir, Banette, Mismagius, Kecleon, Spiritomb, Drowzee, Hypno, Musharna, Glalie, Froslass, Lapras, Absol, Umbreon, Druddigon, Garchomp, Dragonite...), con cartas «Signo» al estilo Touhou, de supervivencia en Difícil y última palabra en Pesadilla, todas demostradas en todos los niveles (`tests/sim/story-prove-<línea>.test.ts`); la herida crece de capítulo en capítulo. En Difícil y Pesadilla el reto recorre el camino de su capítulo (`roadFor`); en Fácil, el del I sin historia. Código: `src/data/story-quests.ts`, `src/core/story.ts`, `src/data/story/` (una Senda por fichero y el kit de jefes), `src/adapters/story-scenes.ts` y `src/adapters/story/`; progreso en el campo opcional `story` de la partida.

## 6. Muerte y revivir

| Situación | Regla |
|---|---|
| Cae alguien en cooperativo | Queda en el suelo y un compañero en pie puede levantarlo (momento de directo): quedarse a su lado 3 s sin recibir daño; se levanta con el 30 % de la vida, una vez por jugador y planta. Si el que ayuda recibe un golpe o se aleja, la cuenta vuelve a empezar. En Pesadilla no hay levantar (`TierDef.coopRevive`) *(provisional)* |
| Caes jugando sola | Se acaba la partida; antes puedes «Reintentar planta» desde el menú, sin límite en Fácil y Normal, una vez por planta en Difícil y ninguna en Pesadilla (sección 9) |
| Cae todo el grupo | Se acaba la partida, en todos los niveles |
| Se baja con alguien caído | Baja con el grupo (no se le espera) y se levanta en la planta nueva con la cura de cada planta (25 % de la vida máxima), la misma regla de §3 para todos |

## 7. Cooperativo

- De 1 a 4 jugadores en todo el juego, cada uno desde su navegador.
- Se entra igual que en PokéSurvivor (sala con código). Gran parte de su interfaz de menús y salas se puede aprovechar. Su código está bajo PolyForm Noncommercial 1.0.0 (antes de su commit `b297089`, MIT): se puede reutilizar sin ánimo de lucro manteniendo su aviso de licencia, y por cortesía conviene escribirle al autor.
- La sala es el pueblo: al crearla o entrar, todos aparecen andando juntos por el mundo (§3, «El mundo»), cada uno con su apodo encima de la cabeza; en una esquina, el código de la sala (oculto si se ha pedido para el directo) y quién está. Solo el anfitrión lleva al grupo a una mazmorra, entrando por su boca o desde el poste del camino; al acabar la partida, «Volver al pueblo» devuelve a toda la sala al pueblo para la siguiente.
- Apodo: se elige en Ajustes o en la pantalla de jugar en línea; sin apodo se usa «Jugador-XYZ». Como mucho 16 caracteres, sin caracteres de control ni invisibles. Sale sobre cada jugador en el pueblo y en la mazmorra y en la pantalla final.
- La dificultad la elige el anfitrión para todo el grupo.
- Botín y reclutas: un premio por jugador, para que nadie del chat sienta que ha ido de relleno.
- Quien levanta a quién lo decide el propio jugador caído (igual que el daño, en el lado de la víctima): su pestaña ve a los compañeros, cuenta los 3 s y manda el progreso para que los demás vean el anillo verde.
- Si el anfitrión se va a mitad de partida, cada invitado cobra lo que llevaba ganado como en una derrota (con su recorte) y vuelve al pueblo; la pantalla final dice por qué ha acabado. Si el anfitrión vuelve al pueblo antes de que la partida de un invitado haya terminado en su pantalla, esa partida acaba en ese momento con la misma regla. Cada jugador cobra una sola vez por partida.
- Entrar con la partida empezada: el anfitrión solo deja entrar a jugadores nuevos (o que vuelven tras desconectarse) al empezar una planta o al volver a la hoguera. Quien llama en mitad de una planta ve «Hay una partida en curso: entrarás al empezar la siguiente planta» y sigue en el pueblo de la sala hasta entonces; entra con la planta nueva.
- Mirar a un compañero: en cooperativo, mientras tu Pokémon está caído la cámara sigue a un compañero en pie (abajo, «Mirando a <nombre>»); Q o el botón «Cambiar» pasa al siguiente que siga en pie. Si el que miras cae, pasa sola al siguiente. Jugando sola no cambia nada.
- Bajar juntos: en cooperativo, «Bajar» en las escaleras (o en la salida de una sala limpia) te deja listo y abajo sale «Esperando a N»; si te apartas, dejas de estar listo. El anfitrión baja con todo el grupo cuando todos los que siguen en pie y están activos están listos. No se espera a los caídos (bajan con el grupo) ni a quien no está activo: sin tocar nada en 30 s, o con la pestaña oculta (deja de mandar su estado y a los 3 s cuenta como ausente). Cualquier jugador, no solo el anfitrión, puede llevar al grupo por la salida de una sala. En la Sima es igual (son escaleras); el santuario no tiene escaleras. La niebla antes de un jefe sigue la misma regla: el grupo la atraviesa junto cuando todos los activos en pie la tocan y confirman, y el jefe no actúa hasta entonces; el invitado cruza cuando la instantánea del anfitrión deja de traer la niebla.
- Misma versión: al entrar, cada jugador manda la versión del protocolo y una huella de su contenido (las listas de Pokémon, movimientos, objetos, salas y mazmorras). Si no coinciden, el anfitrión no lo deja pasar y los dos lo ven: el que entra lee «Versión distinta: recarga la página» y el anfitrión, que alguien lo ha intentado con otra versión. Lo que llega por la red con un nombre que esta versión no conoce (una especie, un movimiento, un tipo, una mazmorra) se descarta, nunca se usa a ciegas. Un cambio de reglas que la huella no ve sube la versión a mano: la 5 llegó con la tabla comprimida de los golpes del jugador y el suelo de carta (regla 9 de §9), porque el invitado calcula el daño de sus propios golpes y la instantánea lleva `held`.

## 8. Escalado según el número de jugadores (n de 1 a 4)

Tabla en `src/data/party-scaling.ts` (`partyScaling(n)`), sacada de la corrección multijugador de Elden Ring y de la forma sublineal de RoR2 (docs/souls-difficulty-research.md, P6 y apéndice A). *(provisional; el arnés de balance la mide)*

| Qué | 1 | 2 | 3 | 4 | Por qué |
|---|---|---|---|---|---|
| Vida de jefe, jefe intermedio y eco | ×1 | ×1,6 | ×2,1 | ×2,6 | Sublineal, para que no se haga eterno |
| Vida de los demás enemigos | ×1 | ×1,25 | ×1,4 | ×1,55 | Más gente, algo más de aguante |
| Daño del combate de jefe | ×1 | ×1 | ×1,1 | ×1,15 | Entre muchos se reparte el castigo |
| Aturdimiento y empuje que recibe el jefe | ×1 | ×0,6 | ×0,4 | ×0,3 | Si no, entre cuatro lo tenéis aturdido todo el combate |
| Enemigos por sala | igual | igual | igual | igual | Diseño antes que números: más enemigos no es más divertido |
| Premios | Uno por jugador | | | | |

- **Tamaño del grupo**: los jugadores presentes al entrar en la planta (los caídos cuentan; en la primera planta, los de la sala al empezar). Queda fijo toda la planta: si alguien se va o entra a mitad, no cambia nada hasta la siguiente. Cada pestaña lo calcula igual y el anfitrión lo manda en su instantánea; si un invitado contó otro número, se queda con el del anfitrión.
- **Comportamiento del jefe** (desde n = 2): mira a un jugador y, cuando ya le ha atacado, cambia al siguiente cada 6 s; si otro jugador le quita el 8 % de la vida por la espalda, se gira hacia él en el acto. Nunca cambia de objetivo a mitad de un aviso o de un ataque: el aviso es para quien lo recibe, y un jefe solo prepara un ataque a la vez (regla de equidad P5).
- **Cartas de área** (desde n = 3): Trevenant, Decidueye, Sableye, Dhelmise y Salazzle meten en su rotación una carta de área más que ya conocen (raíces, abanico, anillo de gemas, algas, bruma; `src/data/party-tricks.ts`). Aegislash, Lanturn, Nihilego y los ecos no ganan ninguna.
- Jugando sola nada cambia.

Escalar solo la vida (lo que hace PokéSurvivor) en un souls se queda corto: el combate dura más pero es más fácil.

## 9. Dificultad

Hay cuatro niveles: Fácil, Normal, Difícil y Pesadilla. Fácil es el equilibrio de siempre: mismos números, mismos tiempos, mismas plantas (lo único nuevo en todos los niveles son los dos ataques de zona de Aegislash y Sableye que se cuentan abajo). Jugando sola se elige en la pantalla de movimientos, encima de «Empezar», y se recuerda para la próxima. Quien juega por primera vez empieza en Normal (la experiencia pensada: «tu turno», cartas de hechizo); Fácil queda para quien la elija. En una sala la elige el anfitrión para todo el grupo, en la ventana de la boca de la mazmorra o del poste del camino; los invitados la ven en la ventana de la sala y juegan la del anfitrión (viaja en el mensaje de inicio; un anfitrión antiguo que no la manda cuenta como Fácil).

### Qué hace divertida y justa una dificultad alta

Antes de tocar números miré cómo lo resuelven otros juegos:

- **Dark Souls (NG+) y Elden Ring:** los ciclos siguientes suben vida y daño, pero lo que se recuerda son los enemigos nuevos en sitios nuevos (los mismos movimientos en otra situación). Cambiar la situación vale más que cambiar el número.
- **Hades (Calor, el Pacto del Castigo):** modificadores opcionales, con nombre y acumulables; muchos añaden comportamiento (Medidas Extremas da a los jefes ataques y fases nuevas) y no solo vida, y la recompensa sube con el Calor.
- **Touhou (rango, de Easy a Lunatic):** más balas y oleadas más rápidas, pero cada carta de hechizo conserva su forma legible y en los rangos altos aparecen cartas extra; esquivar siempre es posible.
- **Enter the Gungeon:** los enemigos Jammed se ven rojos de lejos y pegan más. Un élite tiene que leerse de un vistazo y tener un rasgo claro.
- **Elden Ring Nightreign (Profundidades):** cada nivel trae mezclas de enemigos más duras y jefes más agresivos, y paga más.
- **Hollow Knight (Radiante):** los mismos patrones con tiempos más justos, pero aún legibles; los Panteones encadenan jefes.

De ahí salen las reglas de este juego:

1. **El aviso nunca baja de un mínimo legible:** el nivel lo acorta como mucho al 85 % y nunca por debajo del 75 % de su duración. Después de todo lo que acelera a un enemigo (nivel, élite rápido, furia, la maldición de un pacto de la Sima), el aviso dura al menos 280 ms, y uno de zona (`pierceRoll`) al menos 400 ms; el mínimo se aplica el último, en un solo sitio (`effectiveTelegraphMs`). Si el aviso ya duraba menos tal como está escrito, se queda como estaba.
2. **Más patrones antes que más vida:** ataques nuevos, combos más largos, cartas de hechizo extra, una IA más agresiva (esperas más cortas) y élites. La vida sube como mucho un 45 %.
3. **Más enemigos no es más divertido** (lo dijo la jugadora al probarlo): ningún nivel añade enemigos por sala. La dificultad va en enemigos más duros, no en más.
4. **Todo ataque nuevo se avisa y deja castigar:** aviso de al menos 280 ms y una recuperación después.
5. **La voltereta no lo arregla todo:** los ataques de zona (`pierceRoll`: zonas en el suelo, muros que barren, carriles) atraviesan la invulnerabilidad de la voltereta y nunca cuentan como esquiva perfecta; hay que salir de su área andando o rodando hacia fuera, no a través. Se avisan distinto: un doble borde blanco y violeta que late sobre la zona, un «!» violeta sobre el enemigo y un sonido propio.
6. **Ningún golpe quita más del 35 % de la vida de referencia** (`MAX_HIT_SHARE`, `src/core/fairness.ts`): la vida máxima que tendría tu Pokémon al nivel esperado en esa planta (el que da la experiencia de despejar todas las plantas anteriores, sin objetos ni mejoras). El tope se aplica al daño final de cada golpe enemigo (contacto, disparo o zona), después de todos los multiplicadores (nivel, profundidad, grupo, élites, pactos), en el lado de la víctima, así que solitario, anfitrión e invitados coinciden. No es sobre tu vida real: si vas al nivel esperado, un golpe nunca te mata con la vida llena; si no has subido de nivel, sí puede quitarte toda la vida de un golpe; si vas por encima, recibes el mismo daño (una parte menor de tu vida). El derrumbe, el gas y la niebla quedan fuera: no matan por diseño.
7. **Ritmo por turnos:** Dark Souls es un juego de ritmo por turnos; este es un juego de ritmo danmaku por turnos, pero con turnos minúsculos. Tras cada combo, todo jefe con cartas (guardianes, jefes intermedios, heraldos y ecos) abre una ventana «tu turno»: se queda quieto, no empieza ninguna amenaza nueva y las balas que quedan se desvanecen en 0,35 s, así que se puede entrar a pegar sin miedo. El turno se abre tras cada movimiento: en las cartas de patrones, cada movimiento de la carta; en las alojadas, cada movimiento propio del jefe (que ya es un combo: tres destellos, cuatro anillos). Empieza en cuanto acaba el ataque y dura al menos lo que duraba la recuperación del movimiento. La duración está en la tabla de niveles (`TIERS.turnMs`, `TURN_FLOOR`): acortarla es una de las palancas principales de la dificultad. Un pacto de la Sima que acelera a los enemigos la alarga en su reloj, así que en tiempo real dura lo mismo. Tests en `tests/core/turn-windows.test.ts`.
8. **Más difícil paga más:** Pokémonedas multiplicadas (también por minuto jugado) y récords propios por nivel.
9. **La ventaja de tipo cuenta, pero no salta cartas** (decisión de la dueña, 2026-10-26; estudio en `reports/balance/type-chart-baseline.md`, resultado en `reports/balance/type-chart-after.md`, tarea `odd/tasks/type-balance.md`). Las balas de un jefe no dependen de tu tipo, así que la ventaja de tipo solo va en una dirección: con Chandelure (Fantasma/Fuego, ×2 en sus dos STAB, ×3 en total) los cuatro guardianes Fantasma caían en 34–59 s en Pesadilla, cuando la suma de sus temporizadores pasa de 4 min; el bot del estudio lo reproduce y además muestra que también los emparejamientos neutros se saltaban cartas. Dos reglas, juntas:
   - **Tabla de tipos comprimida para tus golpes** (`PLAYER_HIT_LEVELS`, `src/data/types.ts`): lo que pegas a un enemigo usa niveles en vez de multiplicar la tabla. Supereficaz ×1,6, supereficaz contra sus dos tipos ×2,2 (el tope; antes ×4), poco eficaz ×0,75, poco eficaz contra los dos ×0,5 (antes ×0,25); una eficaz y una resistida se anulan (×1); la inmunidad sigue suavizada a ×0,25; el STAB sigue en ×1,5. Los golpes de los enemigos a ti siguen con la tabla de siempre (×2, ×4, ×0,5, ×0,25): la equidad enemiga no cambia. Los números de daño (naranja, gris) y la ficha de movimientos («eficaz contra») leen esta tabla.
   - **Suelo de carta** (`CARD_FLOOR`, `src/data/cards.ts`): ninguna carta de hechizo se rompe antes del 35 % de su temporizador en Normal, Difícil y Pesadilla (Fácil, sin suelo). Hasta entonces el tramo guarda su último punto de vida: los golpes que lo vaciarían se absorben y sobre el jefe sale «¡Aguanta!» con el sonido de un bloqueo (los invitados también lo ven: viaja en la instantánea). Quien no vaciaría el tramo antes no lo nota nunca. El suelo nunca alarga una carta más allá de su temporizador; las cartas de supervivencia y la última carta conservan sus reglas (la última carta tampoco cae antes de su suelo). Vale para todos los jefes con cartas: guardianes, jefes intermedios, ecos de la Sima, heraldos y heridas de las Sendas.
   - **Por qué estos números:** de los candidatos simulados (×1,5/×2, ×1,6/×2,2, ×1,4/×1,8 con suelos de 0 a 60 %), el suelo del 35 % es el menor que deja todas las cartas por encima de un tercio de su tiempo, y con él un jugador humano (el bot con sus tiempos ×1,9, calibrado con la partida de la dueña contra Nihilego, 2:22,5, «no difícil pero más razonable», un 53 % de su duración diseñada) termina cerca de ese 53 %; con ventaja, un ~15 % antes. Suelos más altos borran la ventaja de tipo y alargan los combates neutros. ×1,6/×2,2 deja más ventaja que ×1,5/×2 con el mismo coste en la prueba.
   - **La prueba de muerte** usa la tabla del jugador: Zorua (Siniestro ×2 contra los guardianes Fantasma) quedaba por debajo de su margen en cinco combates, y se les bajó la vida para recuperarlo (Aegislash Normal ×0,8 y Difícil ×0,9, Decidueye Pesadilla ×0,95, Dhelmise Difícil ×0,84 y Pesadilla ×0,9). La lista de huecos conocidos no crece.

### La tabla

| | Fácil | Normal | Difícil | Pesadilla |
|---|---|---|---|---|
| Vida enemiga | ×1 | ×1,15 | ×1,3 | ×1,45 |
| Daño enemigo | ×1 | ×1,15 | ×1,3 | ×1,5 |
| Duración del aviso | ×1 | ×0,95 | ×0,9 | ×0,85 (con el mínimo de arriba) |
| Enemigos extra por sala | 0 | 0 | 0 | 0 |
| Esperas entre ataques (agresividad) | ×1 | ×0,9 | ×0,8 | ×0,7 |
| Ventana «tu turno» de los jefes con cartas (tras cada combo) | 1,6 s | 1,3 s | 1,0 s | 0,8 s (nunca bajo 0,7 s; última carta ≥ 0,6 s; ninguna en la de supervivencia) |
| Suelo de carta (una carta no se rompe antes de esta parte de su temporizador; regla 9) | sin suelo | 35 % | 35 % | 35 % |
| Élites (por enemigo de planta generada) | 0 | 10 % | 20 % | 30 % |
| Encuentros especiales (frecuencia, oleadas extra) | ×1, +0 | ×1,2, +0 | ×1,5, +0 | ×2, +1 |
| Voltereta (ventana invulnerable, estamina) | ×1, ×1 | ×1, ×1 | ×0,9, ×1,1 | ×0,8, ×1,2 |
| «Reintentar planta» jugando sola | sin límite | sin límite | 1 por planta | ninguno |
| Pokémonedas | ×1 | ×1,3 | ×1,7 | ×2,2 |
| Ataques nuevos | no | no | los de Difícil | los de Difícil y los de Pesadilla |

*(Todo provisional.)* Una regla que no es provisional: lo que pagas sube por minuto jugado, no solo por partida (el multiplicador se aplica también a la línea de minutos), así que el nivel fácil nunca es la mejor forma de farmear.

- **Élites:** un enemigo de planta generada puede salir élite (se decide con la semilla de la planta, así que todos los jugadores de la sala ven los mismos; el rasgo viaja además en la instantánea del anfitrión, en el mismo campo que los de la Sima). Brilla con el color de su rasgo y tiene uno solo. Una sola tabla de rasgos para todo el juego (`ELITE_TRAIT_DEFS`): en las mazmorras normales el nivel saca *robusto* (vida ×1,5, ámbar) o *frenético* (sus esperas duran un 65 %, rojo); la Sima saca de los seis (también rápido, ráfaga, acorazado y furia) con la mayor de su probabilidad por profundidad y la del nivel (§3).
- **Encuentros especiales:** nidos que no paran de sacar enemigos hasta romperlos, salas que se cierran por oleadas, emboscadas, plantas con cazador. Los define cada mazmorra como datos; el nivel solo multiplica su frecuencia y, en Pesadilla, añade una oleada. Los sucesos de la Sima (cámara, altar, casa de monstruos, emboscada, cristal, mercader, nido, oleadas, sabueso) ya lo leen así.
- **Si cae todo el grupo:** la partida termina en todos los niveles, como siempre.

### Ataques nuevos por nivel

**Cripta del Rey de las Espadas**

- **Aegislash:** desde Normal pelea con cartas de hechizo (sección 3, «Guardianes con cartas de hechizo»); lo que sigue es su duelo de posturas, que queda en Fácil y en sus ecos de la Sima. En todos los niveles, el muro de espadas de «Cien Espadas» es un ataque de zona (se pasa por el hueco, no rodando). En Difícil, el combo de la Espada gana un cuarto golpe: el Rey sostiene el filo en alto mucho más que el ritmo del combo (la finta) y luego da un tajo ancho; quien rueda al ritmo de los tres primeros rueda demasiado pronto. Después, la apertura de siempre. También en Difícil, la estocada en círculo de «Corte de Medianoche» pasa a ser de zona (sal del anillo). En Pesadilla, la fase 2 añade una carta: **Juicio del Rey «Las Cien Espadas vuelven»**, un muro desde un extremo de la sala y, tras un segundo aviso, otro desde el contrario con el hueco movido lejos de ti.
- **Sableye:** en todos los niveles, al soltar el primer anillo de gemas el suelo revienta a su alrededor (zona marcada durante todo el aviso; sal del círculo). En Difícil, un cuarto anillo; en Pesadilla, un cuarto Destello.
- **Pawniard:** en Difícil, un tercer corte tras un aviso más largo. **Poochyena:** en Difícil, si tiene compañeros cerca aúlla al verte (no hace daño: es una apertura) y la manada embiste enseguida. **Duskull:** en Difícil, dos fuegos fatuos que se abren y te cierran por los lados. **Gastly:** en Difícil, una segunda bola apuntada de nuevo. **Golett:** en Difícil, su golpe lanza cascotes lentos en todas direcciones.

**Plantel (Sima del Eclipse)**, en Difícil: Zubat repite la embestida, Ekans deja veneno donde acaba la suya, Corphish dispara un segundo chorro, Chinchou suelta un segundo anillo, Houndour gira la llamarada siguiéndote, Slugma lanza una segunda bola de lava y Croagunk encadena un segundo Puya Nociva.

**El Bosque según la dificultad** (ya en el juego): en Fácil y Normal no hay trucos (Normal solo cambia por la tabla de arriba: avisos, esperas, vida). En Difícil cada enemigo del bosque tiene un truco más: Phantump agarra dos veces, Pumpkaboo pequeño deja una llama donde acaba su embestida, Pumpkaboo enorme lanza un anillo de llamas al golpear, Foongus suelta además un anillo de esporas, Spinarak lanza cinco hilos, Hoothoot se lanza dos veces, Impidimp amaga dos veces, Shroomish suelta esporas al aterrizar y Drifloon suelta un segundo anillo girado. Trevenant añade la carta Signo Arboleda «Danza de las Mil Ramas» (dos espirales que giran en sentidos contrarios). Decidueye pelea con cartas de hechizo desde Normal (sección 3); sus trucos de siempre quedan para sus ecos de la Sima, donde juega la Costura ya en la primera fase y una Andanada más en la segunda. En Pesadilla, además, combos más largos: Trevenant tres oleadas de raíces, más ráfagas de espiral y tres anillos; Decidueye siete flechas, cuatro abanicos, cuatro oleadas de lluvia, más plumas y cuatro costuras.

**Las Cuevas según la dificultad** (ya en el juego): los trucos viven en `src/data/caves-tricks.ts` y entran por el mismo `behaviourFor` que los del Bosque (un único mecanismo, desde Difícil con `atLeast`). En Fácil y Normal no hay trucos (Normal solo cambia por la tabla: avisos, esperas, vida; los avisos de Lanturn y Dhelmise también se acortan con el nivel, nunca por debajo del suelo legible). En Difícil, Krabby da un segundo pellizco reapuntado, Remoraid dispara cinco chorros en vez de tres y Shellos salpica gotas al caer el barro; la espiral de Lanturn y el remolino de Dhelmise ganan un brazo. En Pesadilla, Lanturn añade Signo Hondura «Mar de Faroles» y Dhelmise Signo Naufragio «Vórtice sin Orilla» en su segunda fase.

**El Pantano según la dificultad** (ya en el juego): los trucos viven en `src/data/swamp-tricks.ts` y entran por el mismo `behaviourFor`. En Fácil y Normal no hay trucos (solo la tabla). En Difícil, Venipede rebota una vez más, Salandit se gira y vuelve a cruzar, Skrelp escupe un abanico de tres, Salazzle embiste cuatro veces y Nihilego da una tercera oleada de tentáculos y un cuarto anillo de esquirlas. En Pesadilla, Salazzle añade Signo Séquito «Cortejo de la Reina» (dos Salandit) y Nihilego cierra cada vuelta con Signo Lluvia «Aguacero de Venoshock».

### Arnés de balance (medir, no adivinar)

La dificultad se mide con bots que juegan solos (`src/sim`, `docs/souls-difficulty-research.md` P7). El núcleo es determinista, así que una semilla y un bot repiten siempre la misma partida.

- **Bots.** Ven solo la pantalla (512 × 320 alrededor del jugador: enemigos, avisos con su tiempo restante, zonas marcadas, balas) con un retraso de percepción, y producen un `PlayerInput` por tick. *Perfecto*: 0 ms, rueda cada aviso normal dentro de su invulnerabilidad, sale andando de las zonas `pierceRoll` y ataca en las ventanas. *Medio*: 230 ms (Woods 2015), +100 ms para elegir salida de una zona, ±40 ms de ruido y un 15 % de decisiones malas. *Novato*: 400 ms, ±90 ms, un 40 % de errores y volteretas de pánico. *Pegador*: no esquiva, solo ataca y rueda al azar (mide el golpe máximo).
- **Grupo.** El tamaño de grupo (1 a 4) pasa por una sola función (`src/sim/party.ts`): la planta se juega con el escalado cooperativo del juego (`data/party-scaling.ts`, §7) y la vida enemiga se reparte entre el bot y unos compañeros que pegan igual. Los enemigos solo atacan al bot (pesimista).
- **Métricas por planta y por arena.** Tiempo para matar (jefe y cada enemigo), daño recibido, muertes, golpe máximo sobre la vida de referencia (la del nivel esperado en la planta, no la del bot), golpes de zona frente a normales, aviso→ataque (normal y de zona), avisos a la vez, avisos que empiezan fuera de pantalla y golpes sin aviso (la amenaza llevaba menos de 280 ms en pantalla).
- **Bandas.** Las reglas de equidad **fallan** la CI: golpe ≤ 35 % de la vida de referencia, aviso ≥ 280 ms, aviso de zona ≥ 400 ms, ≤ 2 avisos a la vez (3 en Pesadilla), ≤ 1 amenaza fuera de pantalla a la vez y ningún golpe sin aviso. Las que el contenido actual incumple están anotadas con su motivo en `KNOWN_VIOLATIONS` (`src/sim/bands.ts`): salen como aviso, y cualquier otra nueva falla. Las bandas de rendimiento solo **avisan**: el medio gana Fácil ≥ 80 %, un jefe dura 45–150 s para el medio en solitario, el medio pierde por planta ≤ 25/35/50/65 % de la vida (de Fácil a Pesadilla), Pesadilla es más dura que Fácil, y el perfecto gana Pesadilla ≥ 80 % y nunca muere.
- **Prueba de que puede fallar.** Un test mete un patrón imposible (una ráfaga de zona sin aviso sobre el jugador cada 300 ms): el perfecto muere y la puerta falla.
- **Uso.** `npm test` corre el subconjunto de CI (todas las mazmorras, Fácil y Pesadilla, tres bots, en solitario, dos semillas; unos 12 s). `npm run balance` corre el barrido completo (5 mazmorras × 4 niveles × 4 bots × grupos de 1 a 4 × 3 semillas, más cada arena aislada; unos 5 min) y escribe `reports/balance/latest.md` (se guarda en el repositorio para comparar) y `latest.json`. Para reequilibrar: informe antes, cambiar los números, informe después, comparar los dos informes y anotar el antes y el después en el documento de la tarea. Al arreglar contenido, borrar su entrada de `KNOWN_VIOLATIONS` para que no vuelva.
- **Límites conocidos.** Las arenas aisladas empiezan con el inicial a nivel 1 y sin objetos (más duro que llegar jugando). Los bots solo usan el ataque rápido salvo con `npm run balance -- --slots`, donde el perfecto y el medio también usan la potenciación (ante un jefe o un grupo de 3) y el área (sobre 2 enemigos o un jefe a su alcance); el barrido solo juega con Mimikyu. Conocen el plano de la planta (como el minimapa), no sufren la niebla y en las plantas urgentes van directos a la escalera. Un jefe que muere en segundos o un perfecto que muere pueden deberse al contenido o al bot: el informe lo señala, y hay que mirarlo antes de tocar números.
- **Builds degeneradas** (`src/sim/tank.ts`, `npx vite-node tools/degenerate-builds.ts`, informe en `reports/balance/degenerate-builds-audit.md`). El *bot tanque* no rueda nunca: va derecho al jefe y usa el mejor movimiento que tenga listo, al nivel esperado, con la build que se prueba (inicial, movimientos al rango +2, objetos). Cada carta de los ocho jefes con cartas en Pesadilla se juega *congelada* (su reloj y la vida del jefe se reponen cada paso), así que solo acaba si el jugador cae; si sigue en pie a los 180 s, la build se cura más rápido de lo que la carta la daña: es inmortal en esa carta. Se cuentan además las cartas *volteadas* (inmortal en una carta que al kit por defecto sin rangos ni objetos lo mata en menos de 60 s), el tiempo con invulnerabilidad de rango, el tiempo con superarmadura y la cura por segundo. Los tests (`tests/sim/degenerate-builds.test.ts`) exigen que los casos que antes eran inmortales caigan en menos de 150 s, que la superarmadura cubra como mucho la mitad del combate y la invulnerabilidad de rango como mucho un 25 %. Topes que salieron de aquí: Campana Concha y Restos un 1 % de la vida por segundo por copia y entre los dos un 2 % (Restos tope 2), el drenaje un 1 % por segundo, la superarmadura descansa lo que dura y guardia × superarmadura nunca bajan de la mitad del golpe.

### Garantía de que todo se puede pasar

La pregunta de la jugadora: «¿cómo demostramos que es posible pasárselos?». La respuesta tiene cuatro partes. Las cuatro se comprueban en la CI, sobre el motor de verdad (`src/core/step.ts`), no sobre un modelo aparte.

**1. Cada carta se puede sobrevivir andando.** Para cada carta de cada jefe con cartas (los ocho jefes y los ecos de la Sima), en Normal, Difícil y Pesadilla, y desde tres posiciones de salida, hay un *testigo*: una lista de movimientos, uno cada 100 ms (quieto o andar en una de 8 direcciones; sin voltereta y sin atacar), que atraviesa la carta entera hasta que se acaba su tiempo sin recibir un solo golpe. El testigo se juega en el motor real, con todo lo que tiene: balas apuntadas al jugador según se mueve de verdad, zonas de `pierceRoll`, barridos, marcas que siguen al jugador, el tirón del agujero de gusano, el séquito de Salazzle y la cobertura de cada sala. El motor es determinista, así que repetir el testigo es una demostración: si pasa una vez, pasa siempre.

- **Cómo se encuentra** (`src/sim/prove.ts`). Generaliza el barrido de celdas seguras de los heraldos (`core/herald/fairness.ts`) a patrones que dependen de dónde está el jugador. Primero una búsqueda en profundidad que prueba antes los movimientos más despejados (distancia a cada bala en el próximo 1,2 s y a las zonas marcadas) y retrocede al encontrar un callejón sin salida. Si no basta, una búsqueda en haz que guarda en cada fotograma los mejores estados, uno por celda de 16 px, para que las alternativas sigan repartidas por la sala. Encontrar es caro (unos minutos con `npm run prove`); comprobar es barato. Los testigos se guardan en `reports/proof/witnesses.json` y la CI los repite todos.
- **Puede fallar.** Un muro de balas sin hueco no tiene testigo; con hueco, sí. Quedarse quieto no sirve de testigo en una carta de verdad, y el testigo de un muro no vale para el otro (`tests/sim/prove-invariants.test.ts`).

**2. Si se sobrevive, se gana sin hacer daño (vivacidad).** El marco de cartas garantiza, con tests para cada jefe y nivel:

- cada carta tiene un tiempo finito y acaba cuando se agota;
- si se agota, la carta pierde su tramo de vida, y si era la última, el jefe cae;
- una carta de supervivencia no tiene tramo y el jefe no recibe daño durante ella;
- una declaración es una pausa invulnerable y sin amenazas: no hay balas, no hay golpes y el séquito se va.

Por tanto un combate dura como mucho la suma de sus tiempos y declaraciones, y sobrevivir cada carta basta para ganarlo con cero daño.

**3. Al jefe se le puede hacer daño (ventanas de castigo y tiempo para romper).** Sobrevivir solo demuestra que se puede ganar esperando. Así que, además, en cada «tu turno» que aparece en el testigo, una sonda sale del camino seguro, va derecha al jefe (por la espalda si guarda el frente, como las cartas de Escudo de Aegislash) y se queda a su lado hasta que el jefe empieza a preparar su siguiente ataque, la carta acaba o le llega un golpe (lo que pase antes). El motor vuelve a comprobarlo todo. Cuenta como ventana de castigo cada tramo de al menos 600 ms en el alcance del ataque rápido (34 px más allá del cuerpo, cuerpo a cuerpo) o con línea de tiro limpia (200 px, sin cobertura en medio, a distancia).

- **Estimación de muerte.** Jugador de referencia: el nivel esperado en esa planta y nivel de dificultad (`expectedLevel`; en los ecos, el de su planta de la Sima). Para cada inicial se toma el mejor de sus movimientos rápido y fuerte por defecto (daño por segundo con su ciclo completo y la eficacia de tipo contra el jefe, con la tabla comprimida de los golpes del jugador, regla 9 de §9), y solo cuentan sus ventanas: cuerpo a cuerpo para Mimikyu, Zorua y Cubone, línea de tiro para Litwick. Margen = daño en las ventanas ÷ vida del tramo, para el peor inicial. El objetivo es ≥ 1,5 en Fácil y Normal, ≥ 1,3 en Difícil y ≥ 1,1 en Pesadilla. Un emparejamiento con inmunidad de tipo (todos sus movimientos por defecto a ×0,25 o menos) se informa aparte y no cuenta.
- La estimación toma cada turno por separado: supone que después de castigar se puede volver a una línea segura. Eso lo demuestra la parte 4 de forma constructiva.

**4. Un bot que se lo pasa (prueba constructiva).** El bot resolutor juega el combate entero en Pesadilla desde la entrada de la sala, con información perfecta y Mimikyu al nivel esperado. Busca carta a carta un camino sin un solo golpe que además ataca con el movimiento rápido cuando el jefe está abierto y a su alcance. Sus combates (tres semillas por jefe) también se guardan y la CI los repite.

**Ritmo por turnos.** Las ventanas de castigo salen sobre todo de la regla 7 de §9: tras cada movimiento de un jefe con cartas, su «tu turno».

**Resultado** (`reports/proof/latest.md`, 2026-10-26): 166 cartas (los 8 jefes y los 5 ecos de la Sima en Normal, Difícil y Pesadilla), 498 testigos (3 salidas por carta). Las 166 cartas se sobreviven andando desde las tres salidas. El bot resolutor gana los 8 combates en Pesadilla con las tres semillas sin recibir un golpe, en 88 s (Sableye) a 268 s (Aegislash; con el suelo de carta y la tabla comprimida de la regla 9). El bot prioriza no recibir golpes: rompe entre 0 y 4 cartas por combate y deja que el tiempo acabe el resto, así que demuestra la vivacidad más que el daño. La parte de daño la cubre la estimación. Las ventanas de castigo y el margen se cumplen en 123 de las 146 cartas que se pueden dañar. Las otras 23 son huecos conocidos, cada uno con su motivo (`src/sim/kill-gaps.ts`): no se ocultan, y la CI falla si aparece uno nuevo o si uno deja de fallar.

**Lo que la prueba encontró y se arregló:**

- **Marcas imposibles de esquivar andando.** Tres ataques de zona que siguen al jugador solo se podían esquivar rodando. En Pesadilla, el Tajo Real de Aegislash dejaba de seguir 0,44 s antes de caer, y hacen falta 0,6 s para salir andando de un radio de 70 px. Arreglos: Tajo Real a 760 ms de fijación (aviso 1250 ms); Picado de Decidueye a 700 ms (aviso 1200 ms); Corriente del Pecio de Dhelmise a 760 ms en sus cartas (`markLockMs`; Fácil sigue igual).
- **Ventanas que no llegaban.** El «tu turno» empezaba después de la recuperación del jefe, cuando sus balas seguían en el aire. Ahora empieza en cuanto acaba el ataque: las balas se desvanecen ahí y el turno dura al menos lo que duraba la recuperación. Además hay un turno tras **cada** movimiento (antes, tras cada dos). En las cartas alojadas, el descanso propio del jefe (Salazzle, Nihilego) se respeta después del turno.
- **Tramos demasiado largos.** El reparto de vida entre cartas y la vida total de algunas peleas con cartas se ajustaron con la estimación (`hpShare`, `hpScale`):

  | Jefe | Cambio |
  |---|---|
  | Aegislash (Normal) | Muralla 9 %, Abanico 34,5 %, Espadas 21 %, Cien Espadas 35,5 % |
  | Sableye | vida ×0,94 / ×0,77 / ×0,98; Destello 53 % (Normal y Difícil) |
  | Lanturn | vida ×0,58 / ×0,5 / ×0,54 (sus anillos echan muy lejos a un inicial cuerpo a cuerpo) |
  | Dhelmise (Pesadilla) | Último Juramento 5 % y el resto repartido |
  | Salazzle | Neblina 25 % / 20 % / 22 %; vida ×0,98 en Difícil y Pesadilla |
  | Nihilego | Joya Rota 9 % / 28 % / 8 %; vida ×0,9 / ×0,97 |
  | Ecos de la Sima | vida = 60 % de la del guardián sin crecer con la profundidad (la profundidad hace sus golpes más fuertes, no su barra más larga) |

**Límites:**

- La parte 1 es un testigo por salida, no todas las salidas posibles. Tres salidas por sala (la de la sala y dos laterales) son el mismo criterio que usan los heraldos.
- La parte 3 es una estimación por turnos, no un combate completo, y ve el daño en solitario. Los emparejamientos con desventaja de tipo se informan aparte (por ejemplo, Cubone contra Decidueye).
- Los 23 huecos conocidos son sobre todo cartas de Escudo de Aegislash, las andanadas de Decidueye y los anillos de Joya Rota de Nihilego: un inicial cuerpo a cuerpo no llega al jefe dentro del turno. A distancia (Litwick) sí hay línea de tiro. Son la lista de trabajo para el próximo ajuste.
- Los heraldos tienen su propia prueba (`core/herald/fairness.ts`), aplicada antes de jugar cada carta generada. Las peleas de Fácil sin cartas y el juego en grupo quedan fuera de esta prueba.
- Un cambio en un patrón invalida sus testigos: la CI falla y hay que volver a correr `npm run prove`, que conserva los que siguen valiendo.

### Récords

Cada mazmorra guarda la mejor planta y las victorias por nivel; los récords de antes cuentan como Fácil. La Sima guarda su tablón de diez mejores marcas por nivel (las marcas antiguas, en Fácil). El tablón del pueblo enseña los del nivel elegido ahora, y la pantalla final dice en qué nivel se jugó. El Santuario de los Juramentos guarda los suyos aparte (mejor tiempo, capturas y «Sin rasguños» por jefe, desafío y nivel; ver §3).

## 10. Directo

- El cooperativo con el chat es la función principal. Los indies cooperativos están entre los más vistos en directo porque dejan que los streamers jueguen con otros y junten audiencias ([Stream Hatchet](https://streamhatchet.com/blog/indie-game-popularity-on-live-streaming/)).
- Momentos que se vean: la cámara lenta de la esquiva perfecta, los rescates, las plantas con prisa, los cambios de fase de los jefes.
- La Sima del Eclipse (sección 3) es la mazmorra pensada para el directo: contrarreloj, sin fondo y con un reto diario que el chat puede jugar con la misma semilla.
- Interfaz clara y con contraste, que se lea en un stream comprimido.

## 11. Progresión entre partidas

- Moneda: Pokémonedas, que ganas en cada partida multiplicadas por la dificultad.
- Con ellas compras mejoras permanentes y tiradas del gacha. Es un roguelike como las mazmorras de Mundo Misterioso: lo que llevas dentro se pierde, lo que compras fuera se queda.
- El MVP tiene una sola mazmorra. Las demás se diseñan después.

### Cómo se ganan *(provisional)*

Cada jugador suma lo suyo en su propio ordenador (también los invitados de una partida compartida; no viaja nada por la red). El HUD enseña lo ganado hasta ahora ("12 P") y la pantalla final lo desglosa junto al saldo nuevo.

| Qué | Pokémonedas |
|---|---|
| Planta superada | 6 × profundidad (la planta 3 da 18) |
| Enemigo derrotado | 1 × (1 + 0,5 (profundidad − 1)) |
| Huir de un derrumbe | 20 en menos de 30 s, 12 en menos de 60 s, si no 6 |
| Derrotar al guardián | 50 |
| Derrotar a un jefe intermedio (Sableye en la Cripta, Trevenant en el Bosque Brumoso, Lanturn en las Cuevas Inundadas) | 25, la mitad de un guardián; cuenta en la línea del guardián y se queda aunque caigas después |
| Minuto jugado | 2 por minuto completo (las pausas no cuentan) |
| Si caes | Te quedas el 75 % de lo ganado |
| Dificultad | Todo × la fila de la sección 9 (Fácil × 1, Normal × 1,3, Difícil × 1,7, Pesadilla × 2,2) |

Una victoria completa en la Cripta da unas 165 Pokémonedas; el Bosque Brumoso paga con las mismas reglas por planta, enemigo y minuto, así que sus ocho plantas pagan más. El pago sube con lo que juegas (plantas, enemigos y minutos), no solo por terminar la partida, como pide la sección 9. "Reintentar planta" vuelve al recuento con que entraste en ella (no se cobra dos veces) y salir desde el menú de pausa no paga nada.

### Mejoras permanentes *(provisional)*

Se compran en el puesto de Poochyena en el pueblo (o en "Tienda" del menú del pueblo) y se aplican al empezar cada partida, a cualquier especie. Los saltos son pequeños a propósito: el juego tiene que seguir siendo difícil.

| Mejora | Efecto por nivel | Niveles y precios |
|---|---|---|
| Vitalidad | +4 PS máximos | 60, 120, 220, 360, 550 |
| Aliento | La estamina se recupera un 5 % más rápido | 80, 160, 300, 500 |
| Respiro | Al bajar de planta te curas un 3 % más de los PS máximos (sobre el 25 % de base) | 100, 220, 400 |
| Reflejos | +8 ms de ventana de esquiva perfecta (base 120 ms) | 120, 260, 480 |
| Estudio | +5 % de experiencia | 90, 180, 320, 520 |

Comprarlo todo cuesta unas 5000 Pokémonedas (unas 30 victorias). El gacha ya existe: es el puesto de la suerte de Mimikyu en el Refugio (`town.gacha.1`; sección 5, «Conseguir Pokémon: gacha»). Las Pokémonedas también compran movimientos y Mejoras al maestro de movimientos (Smeargle, en el Refugio; sección 4, «Movimientos y maestro»).

Guardado: el saldo, los niveles comprados y, desde la versión 2, los movimientos aprendidos y las Mejoras viven en una sola clave local (`mazmorra-sombria.save`) con versión, `migrate()` y `sanitize()` (sección 12): un dato roto o manipulado se lee como un guardado vacío y nunca rompe el juego. Los ajustes y los récords del tablón siguen en sus claves de antes. La versión 4 añade los logros, las Pokémonedas ganadas en total y las misiones (un guardado de la versión 3 se lee sin ninguno). Los campos de la colección de la versión 3 (los iniciales evolucionados en `owned`, las Esencias de sus líneas y `awakened`) siguen igual en la 4.

### Logros *(provisional)*

Metas a largo plazo que se miran al terminar cada partida y al cambiar la colección (una tirada, una evolución, una misión cobrada), nunca durante el combate. Se generan de las listas de contenido, así que una mazmorra, una especie o una evolución nuevas traen sus logros sin tocar nada a mano:

| Familia | Uno por | Premio |
|---|---|---|
| Mazmorras superadas | Mazmorra principal o reto, y dificultad (ganar en una dificultad cuenta para las de debajo) | 0 / 20 / 40 / 80 P (Fácil a Pesadilla) |
| Guardianes sin un rasguño | Mazmorra con guardián: ganar sin recibir ningún golpe en la planta del guardián | 50 P |
| Profundidades de la Sima | Estrato de la Sima después del primero (plantas 11, 21, 31 y 41) | 30 P |
| Compañeros | Especie jugable: ganar cualquier mazmorra con ella | 0 |
| Evoluciones | Evolución de una línea (una forma posterior también la cuenta); cada despertar de Mimikyu (un paso posterior también cuenta los de antes) | 20 P |
| Puesto de Mimikyu | Primera tirada; todas las líneas del puesto | 0; 50 P |
| Shiny | Línea jugable: conseguir su aspecto shiny | 30 P |
| En equipo | Ganar una mazmorra en grupo | 30 P |
| Pokémonedas | 1000, 5000, 20 000 y 100 000 ganadas en total (gastar no resta) | 0 |
| Secretos | Ocultos hasta conseguirlos (caer en la primera planta) | 10 P |

Ningún logro da poder: solo unas pocas Pokémonedas. Al conseguirlos sale un aviso arriba de la pantalla; la ventana de logros (en Opciones, en el menú del pueblo y desde el tablón) enseña cada familia con su progreso. En cooperativo cada jugador mira sus logros con su propia partida y su propio guardado; las pruebas del Santuario no cuentan como partidas.

Logros retroactivos: al abrir el juego se conceden, una sola vez y sin avisos uno a uno, los logros que ya demuestra el progreso guardado de antes de que existieran: las mazmorras ganadas por dificultad (récords del tablón; un récord de antes de las dificultades cuenta como Fácil), la profundidad de la Sima (récords y clasificación de la Sima), la colección, las evoluciones, los despertares, los shiny y las Pokémonedas ganadas. Un guardado anterior a la versión 4 no tiene el total ganado: se rellena con un mínimo (el saldo más lo que costaron las mejoras, los movimientos del tutor y las Mejoras, cada uno a su precio más barato), y nunca baja. Sale un único aviso con el número de logros. Pagan su premio una vez, como cualquier logro (queda guardado y no se repite). Los que solo puede demostrar una partida (guardián sin un rasguño, ganar con cada especie, cooperativo y el secreto) siguen esperando a la siguiente partida.

### Misiones *(provisional)*

El tablón del pueblo, además de los récords, tiene encargos al estilo de los tablones de Mundo Misterioso. Cada día (a las 00:00 UTC) salen de 3 a 5 misiones, las mismas para todos los jugadores porque dependen solo de la fecha, y una semanal que cambia cada lunes. Se generan de las listas de contenido:

- Llegar a la planta N de una mazmorra principal (en la Sima, múltiplos de 5 hasta la 20).
- Superar una mazmorra (también las de reto).
- Derrotar N Pokémon de un tipo que aparezca en las mazmorras (en una o varias partidas).
- Llegar a la planta 2 o más abajo con una línea jugable.

Cada misión pide una dificultad mínima: solo cuentan las partidas en esa dificultad o más difíciles. Puedes llevar 3 a la vez (diarias y semanal juntas); al cumplirlas se cobran en el tablón. Premio: Pokémonedas según el tipo de misión y la dificultad y, a veces (siempre en la semanal), Esencias de una línea del puesto de una dificultad como mucho la de la misión y nunca de Pesadilla, para que la última evolución siga pidiendo superar su reto en Pesadilla. Las misiones de un día o una semana pasados desaparecen, cumplidas o no. En cooperativo cada jugador avanza sus propias misiones con su propia partida.

## 12. Notas técnicas

- Red: si todo lo decide el anfitrión, a los invitados les dan golpes "aunque habían rodado". Cada cliente tiene que resolver en su propio ordenador su rueda y sus ataques (predicción en el cliente), y el anfitrión reconcilia. Esto se diseña desde el primer prototipo; no se puede parchear después.
  - Prototipo de red (M1, *provisional*): cada jugador simula su propio Pokémon sin esperar a nadie y envía su estado unas 20 veces por segundo. El anfitrión mueve a los enemigos y al jefe contra todos los jugadores (cada enemigo va a por el más cercano) y envía una instantánea unas 20 veces por segundo (unos 55 bytes por enemigo en JSON compacto: entre 115 y 760 bytes por instantánea en las plantas generadas). Los golpes de un invitado a un enemigo se resuelven en su pantalla y se mandan al anfitrión como reclamaciones, que este aplica una sola vez (en el prototipo se confía en ellas). Los golpes enemigos se comprueban solo contra el jugador de cada pantalla: si has rodado en tu pantalla, has esquivado. Los demás jugadores y, en los invitados, los enemigos se dibujan unos 100 ms en el pasado, interpolando entre instantáneas. Las escaleras las decide el anfitrión cuando todo el grupo activo ha confirmado (§7, «Bajar juntos»): cada jugador manda con su estado si está listo y si está ausente. Pendiente de la prueba con lag real.
  - Salas en línea (M1, *provisional*): "Crear sala" da un código de 5 caracteres sin letras que se confunden (ni 0/O ni 1/I/L), con botón de copiar y opción de ocultarlo en pantalla para quien hace directo; "Unirse" con el código (o con `?room=CÓDIGO` en la dirección). Máximo 4 jugadores (al quinto se le dice que la sala está llena). El anfitrión ve quién ha entrado y pulsa Empezar; todos juegan con su semilla. Los navegadores se encuentran por relés públicos de Nostr (Trystero) y luego hablan directamente por WebRTC, sin servidor TURN (dos jugadores detrás de NAT estrictos pueden no conectar). Con F3 se ven las estadísticas de red (ida y vuelta por jugador, instantáneas por segundo y su edad, bytes por segundo).
  - También se entra desde el pueblo: el Pilar de las señales del Refugio (en la plaza del sur, `REFUGIO.beacon`) abre la misma ventana (crear sala con código, unirse por código, apodo; ocultar el código sigue en el menú de la sala). Ya en la sala se sigue en el pueblo como sala; al salir de ella se vuelve al Refugio, junto al pilar, en solitario. Dentro de una sala el pilar solo recuerda que el menú de la sala está en Esc.
  - La cámara lenta de la esquiva perfecta, en partida compartida, es solo para quien esquiva (destello, sonido, tinte y el golpe reforzado): los enemigos son los mismos para todos y no se ralentizan para nadie. En solitario no cambia nada.
  - Las Bayas Aranja las decide el anfitrión, como los golpes: el invitado que pisa una la reclama, el anfitrión se la da una sola vez al primero que la pidió (y se lo dice) y sus instantáneas llevan las bayas que quedan. La experiencia la calcula cada jugador para sí mismo al ver caer cada enemigo (una vez por enemigo). Cada jugador elige sus propios objetos.
  - Si se va el anfitrión, la partida se acaba para los invitados con un aviso y el botón de volver al menú (no hay migración de anfitrión en el prototipo).
- Contenido como datos: especies, movimientos (los kits de Q y E), enemigos, jefes, tipos de planta y tablas de dificultad en ficheros de datos, igual que hace PokéSurvivor con `js/data`.
- Guardado: una sola fachada de guardado con `migrate()` y `sanitize()` versionados (el patrón de `G.DB` de PokéSurvivor merece la pena).
- Cuentas y guardado en la nube (v1, `odd/tasks/accounts-client.md`): **opcionales**. Sin cuenta se juega exactamente igual que siempre y el juego no hace ninguna petición. Desde Opciones, el menú del pueblo o Ajustes, «Cuenta» permite crear una cuenta con correo y contraseña (mínimo 8 caracteres), iniciar y cerrar sesión, y borrar la cuenta (con confirmación; borra también su partida en la nube, la de este dispositivo se queda).
  - Servidor: PocketBase en `https://sd-api.fullfran.com` (`server/README.md`); el cliente usa `fetch` sin SDK (`src/adapters/account-api.ts`) y la dirección sale de `VITE_API_URL`. El ranking global de la Sima (§3) es público y de solo lectura: el servidor lo saca de las partidas en la nube y solo enseña apodo, Pokémon del perfil, planta, tiempo, Pokémon y nivel de la marca, modo y fecha (nunca correos ni la partida); solo lo pide quien tiene la sesión iniciada. La sesión (el token) se guarda en el navegador y se renueva al abrir el juego; si el almacenamiento falla, la sesión dura lo que la página.
  - Sincronización del perfil completo (v2, `odd/tasks/cloud-sync.md`): se sincroniza todo el progreso, no solo la partida: la fachada de guardado, los récords del tablón, los del santuario, la clasificación de la Sima y el bestiario de heraldos (`src/app/profile.ts`). Los ajustes, los avisos ya vistos (prólogo, cinemáticas) y el aviso de instalar siguen siendo de cada dispositivo. En la nube va un solo JSON: la partida tal cual arriba (el servidor exige `version` y `coins` arriba) y el resto en `profile` (`src/app/cloud-payload.ts`); si pasara de 60 KB se recortan primero los heraldos más antiguos.
  - Cada dispositivo recuerda la revisión de la nube que sincronizó por última vez (baseRev) y una huella de su perfil en ese momento, y de su economía aparte (`src/app/cloud-sync.ts`, tabla de decisiones probada caso a caso):
    - Solo se movió el dispositivo (la nube sigue en baseRev, o en otra revisión con el mismo contenido): se sube.
    - Solo se movió la nube, o el dispositivo solo cambió en lo que siempre se combina: se baja en silencio, combinado, y se avisa «Datos de la nube cargados» con «Deshacer» unos 30 s.
    - Navegador nuevo o sin progreso y nube con progreso: aviso «Encontramos tu progreso en la nube» con fecha, Pokémonedas, Pokémon, logros y mejores récords, y «Descargar» o «Empezar de cero». «Empezar de cero» es la opción segura: el dispositivo empieza limpio y no sube ni baja nada hasta que, en Cuenta, el jugador elige «Descargar la nube» o «Sobrescribir la nube» (con confirmación; antes se guarda copia local de la nube).
    - Las dos economías cambiaron, o es el primer encuentro de dos progresos distintos: dos tarjetas, «Este dispositivo» y «La nube», con fecha, Pokémonedas, Pokémon, logros y mejor récord; se elige una. También tras un 409: ya no gana la nube a ciegas.
    - Un dispositivo vacío nunca sube nada encima de progreso de la nube.
  - Qué se combina: la economía nunca (Pokémonedas, mejoras, movimientos y Mejoras, Pokémon, despertares, materiales, pity, Pokémonedas ganadas, misiones, variocolor y su pity vienen enteras del lado elegido; `SAVE_FIELD_RULES` en `src/app/profile-merge.ts` clasifica cada campo y el typecheck falla si falta uno). Lo demás se combina siempre, elija lo que elija: logros (unión, con la fecha más antigua), récords de mazmorra (máximo por mazmorra y nivel), récords del santuario (mejor tiempo con su Pokémon, más victorias y capturas, «Sin rasguños» si lo tiene cualquiera), clasificación de la Sima (las dos, sin repetir, diez por nivel) y bestiario (unión).
  - Logros sin doble premio: combinar no paga nada. Las recompensas ya cobradas van en las Pokémonedas del lado que se queda; un logro desbloqueado solo en el lado descartado queda marcado como conseguido sin volver a pagarse (su premio se quedó con esa economía). Al abrir el juego, el repaso retroactivo solo paga logros que ninguno de los dos lados tenía y que los récords combinados demuestran.
  - Copias de seguridad (`src/app/backups.ts`): antes de cada sustitución (local o en la nube) el perfil sustituido se guarda en el navegador; se conservan las 3 últimas con fecha y motivo. «Deshacer» sale unos 30 s; en Cuenta, «Copias de seguridad» permite restaurar una, «Descargar copia» (archivo JSON) e «Importar copia». Restaurar o importar trae la economía de la copia y mantiene combinado lo demás (nunca se pierden récords ni logros).
  - Varias pestañas (`src/app/sync-leader.ts`): solo una pestaña sube (Web Locks; sin ellos, un turno en localStorage que se renueva cada 2 s y caduca a los 6 s). Las demás guardan en local; la que sube ve sus cambios por el evento `storage` y las demás recargan su estado cuando cambia.
  - Datos de otra cuenta: el progreso local queda marcado con la cuenta a la que pertenece. Al cerrar sesión los datos se quedan («Sesión cerrada. Tus datos siguen en este dispositivo.») y, si entra otra cuenta en ese navegador, se pregunta: guardarlo como copia, usarlo en esta cuenta o descartarlo (con confirmación; queda igualmente en las copias). Nunca se mezcla solo. «Borrar datos de este dispositivo» (con confirmación) cierra sesión y borra el progreso local, el estado de sincronización y las copias; la nube no se toca.
  - Línea de estado en Cuenta: «Sincronizado hace X», «Hay cambios por subir», «Sin conexión: se subirá luego», «Conflicto resuelto», «Falta elegir qué progreso conservar». Una sesión de la v1 conserva su enlace: su revisión pasa a ser la baseRev.
  - Privacidad: el correo es privado (nadie más lo ve), solo sirve para entrar, y la cuenta se puede borrar cuando se quiera. No hay analíticas. Aún no hay correo saliente: ni recuperación de contraseña ni verificación («Si olvidas la contraseña, escríbenos»).
  - Pendiente: vincular Google, Twitch o Discord a una cuenta (OAuth2), recuperación de contraseña y verificación (necesitan SMTP), perfil público con apodo, y sincronizar ajustes (por decisión, de cada dispositivo).
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

Lo que podría venir después: más mazmorras y biomas, un mundo más grande que el de §3 (más pueblos y caminos), historia, reclutamiento y equipos más profundos, más tipos de planta y más jefes.

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
