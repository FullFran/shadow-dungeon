# La Sima del Eclipse: una vuelta al lore

*(propuesta para el dueño, 26-10-2026; implementada en la rama `feat/sima-lore` con las decisiones de abajo; el resumen vivo está en `docs/gdd.md`, «El lore de la Sima»)*

## Decisiones del dueño (26-10-2026)

1. **Razón: A**, a por los que no volvieron. Vuelves porque contestaste a la voz y tu sombra tira de ti hacia arriba.
2. **«Lucidez» en el HUD** («Lucidity» en inglés); las cantidades no cambian (el equilibrio, más adelante). A las 0:00 «te pierdes» y tu sombra te sube al borde del cráter (el mismo final por tiempo, con las mismas recompensas).
3. **Sendas sin cerrar: sin nombre** («Sombra de alguien», «Una herida que no es tuya»); cerradas, con nombre y una línea de reconocimiento. La memoria solo cambia nombres y textos, nunca qué jefe o qué suceso se genera (test: misma semilla y distinto progreso dan las mismas plantas).
4. **La Sima sigue abierta desde el principio**, y la narración tiene que ser fuerte: una secuencia de súplicas al estilo de Mundo Misterioso en el pueblo antes de la primera bajada, y una escena clave la primera vez que te pierdes (caes, se apaga todo, tu sombra te sube y despiertas en el borde con Phantump, que explica el resto). Más el resto de cinemáticas de la sección 5. Solo jugando sola, una vez por dispositivo, se saltan, con el reloj parado; en compartida, una línea en el registro.
5. **Los Caminantes de la Sima** (nombre elegido por el dueño, guiño a los Vigilantes del Abismo de Dark Souls 3; clave `lore.reborn.name`): no eres el único que vuelve. Todo Pokémon jugable es una persona que renació como Pokémon (la premisa de Mundo Misterioso), y cada uno contestó a la voz. Un Caminante despierta dentro de un Pokémon con sus recuerdos y sus heridas: por eso las Sendas son el pasado del propio Pokémon.
6. **Figuraciones: sí** (solo presentación, nunca tocan la simulación; ajuste de accesibilidad y respeto a «reducir movimiento»).

## Lo implementado y lo que cambió por el camino

- Textos (sección 5, tabla final), lucidez, estratos como etapas, cinemáticas 5.1 a 5.7, súplicas, guardián sin rostro, heridas, Sombra extraviada y Figuraciones: hechos. Detalle en `docs/gdd.md` y en `odd/tasks/sima-lore.md`.
- **Sombra extraviada**: en vez de una sala dentro de una planta generada, la planta entera es la antesala de la sala de la sombra, con su muro de niebla y una escalera al lado (sigue siendo optativa). Motivo: las cartas de las Sendas se dibujan sobre su propia arena (sus torretas y muros usan las medidas de la sala), y así el muro de niebla ya viaja por la red como el de cualquier jefe. Probabilidad: un 7 % por planta desde la 12, por semilla, nunca en planta de eco ni de heraldo.
- **Heridas**: el turno de los guardianes se salta las plantas de herida (35, 55, 75...), así que los cinco guardianes siguen saliendo: Dhelmise pasa a la 45 y Nihilego a la 65 (sus pruebas de eco, también).
- **Fuerza en la Sima**: un jefe de Senda juega la pelea entera de su nivel con el 60 % de la vida de su Senda, sin crecer con la profundidad (solo crece su daño), para que la prueba en su primera planta valga para todas.
- **Vistas guardadas por dispositivo**, con su clave propia fuera de la partida guardada (como el prólogo y las cinemáticas de guardián): no son progreso, no van con la economía ni con la nube. No hay campo nuevo en `SaveData`.
- Pendiente: volver a ver las cinemáticas de la Sima desde el menú, junto al Prólogo (propuesto en la sección 5; no pedido en las decisiones); las cifras de reloj y premios, para el equilibrio.

---

*Texto original de la propuesta:*

Palabras del dueño: «Creo que tenemos que meter estos jefes [las sombras y las heridas de las Sendas] en la Sima del Eclipse, pero no sé cómo. A la Sima hay que darle una vuelta para que tenga sentido y hacerle un lore, con cinemáticas. Se me ocurre que sean ilusiones: Pokémon que entraron y se volvieron sombras, y paranoias que se monta tu cabeza resistiéndose a volverse loca por el eclipse. Y tiene que haber una razón por la que entramos ahí, no sé.»

Este documento propone esa vuelta. La regla que lo atraviesa todo:

> **Lo mecánico sale de la semilla; lo narrativo sale de tu memoria.** Qué jefe, qué carta y qué sala dependen solo de la semilla (el reto diario sigue siendo igual para todos). Qué nombre ves, qué línea lees y qué cinemática se abre dependen de lo que tú has vivido (Sendas cerradas, guardianes vencidos, cinemáticas vistas).

---

## 1. Lo que hay hoy

### Cómo funciona

| Pieza | Qué hace | Dónde |
|---|---|---|
| Plantas sin fin | Todas generadas; abierta desde el principio («es la que más se va a jugar en directo») | `docs/gdd.md:381-383` |
| Reloj | 8:00, +40 s por bajar (menos con la profundidad, mínimo 15 s), +60 s por eco; a las 0:00 «el eclipse se traga la planta» y la partida acaba como marca, no como derrota | `docs/gdd.md:388`, `src/data/endless.ts:183`, `src/core/endless.ts:51-59` |
| Pausa del reloj | Solo jugando sola, con menú, elección de objeto o cinemática; en compartida nunca | `src/core/endless.ts:66-67` |
| Estratos | Cada 10 plantas: Cripta (1), Bosque (11), Cuevas (21), Pantano (31), Abismo (41+), con tarjeta y una línea de lore por planta | `src/data/sima.ts:54-61`, `src/core/sima.ts:24-32` |
| Ecos del guardián | Plantas 5, 15, 25...: Aegislash, Trevenant, Decidueye, Dhelmise, Nihilego por turnos, solo su primera fase, sin cinemática | `src/data/endless.ts:161-168`, `docs/gdd.md:383` |
| Eco del Eclipse | Plantas 10, 20, 30...: tú, corrompido (tu especie en negro y rojo), crece en cada encuentro, sin cinemática | `src/data/endless.ts:172`, `src/core/eclipse-echo.ts:22-33`, `docs/gdd.md:405-406` |
| Heraldos | Plantas 22, 32, 42...: jefes procedurales con nombre inventado, epíteto y epígrafe, con cinemática de entrada generada | `src/data/endless.ts:174`, `docs/gdd.md:407-418` |
| Sucesos | Cristal del tiempo, cámara, mercader, altar de pactos, emboscada, nido, casa de monstruos, oleadas, Sabueso imbatible | `src/data/sima.ts:190-224` |
| Plantas con prisa | Derrumbe y Niebla, como en las demás mazmorras | `src/data/endless.ts:179-182` |
| Reto diario | Semilla sacada de la fecha UTC, la misma para todo el mundo; tablón de las diez mejores marcas | `src/core/endless.ts:69-90`, `docs/gdd.md:390-391` |

### Lo que cuenta hoy

- Mazmorra: «Bajo el anillo rojo se abrió una grieta sin fondo. Lo que baja por ella vuelve como eco.» y «Allí abajo los guardianes caídos se levantan otra vez, y el eclipse se traga cada planta que tarda.» (`src/i18n/es.json:443-444`).
- Estratos: cuatro líneas sueltas por estrato. Algunas ya apuntan a algo: «Algo baja contigo. No hace ruido. Solo te imita.» (`es.json:809`), «Aquí el agua sube por las paredes, hacia el eclipse.» (`es.json:927`), «El agua no refleja este cielo. Refleja el otro.» (`es.json:933`), «Los árboles muertos crecen hacia abajo, hacia el eclipse.» (`es.json:935`).
- Eco del Eclipse: «La sombra que bajó contigo» (`es.json:879`), y tres líneas de registro (`es.json:881-883`).
- El mundo: la estatua quemada del cráter («La sima no tiene fondo. Solo más eclipse», `es.json:671`).
- Las Sendas ya dan por hecho «tu propia sombra, la que bajó contigo cuando la voz preguntó si la oías» (`docs/story-quests.md`, «Tono»).

### Lo que no cuadra

1. **No hay razón para bajar.** La Sima está abierta desde el principio por una razón de directo, no del mundo. Nadie te pide que bajes y nadie te espera abajo.
2. **Los ecos de guardianes destripan.** Puedes pelear contra el eco de Nihilego en la planta 25 sin haber pisado el Pantano. Su juramento, su sala y su música llegan antes que su historia.
3. **Los heraldos no son nadie.** «Vaelorion, la Viuda de los Relojes Perdidos» es precioso, pero ¿qué es un heraldo? Ni el prólogo ni la Sima lo dicen.
4. **El reloj no significa nada.** «El eclipse se traga la planta» y acabas en el tablón, no muerta. ¿Qué te pasó? ¿Quién te sacó?
5. **Arriba y abajo se contradicen.** El prólogo pone el hambre «bajo la tierra» (`es.json:405-407`, y Necrozma en `docs/gdd.md:231`); Nihilego dice que viene «de un cielo sin sol» y que algo bebe la luz «más allá de vuestro cielo» (`es.json:803-805`). La Sima baja, y a la vez enseña un eclipse colgando detrás y un «cielo envenenado».
6. **Los estratos son un catálogo.** Cada uno toma prestado el aspecto de otra mazmorra, pero no hay un hilo: no se baja *hacia* nada.
7. **Las sombras de las Sendas no están.** `docs/story-quests.md` («Pendiente») lo dice: «Las sombras nuevas no están aún en el Santuario de los Juramentos ni en la Sima».

La buena noticia: casi todo lo que hace falta ya existe. Faltan el porqué, un hilo y cinco o seis cinemáticas.

---

## 2. ¿Por qué bajamos a la Sima?

Tres respuestas posibles. Las tres usan las mismas piezas: el prólogo («Muchos entraron a buscar lo que se había perdido. Los que volvieron ya no eran ellos. Solo su sombra.», `es.json:404-405`), la voz del final, tu sombra y los guardianes.

### A. A por los que no volvieron *(recomendada)*

Las Mazmorras Sombrías devuelven sombras; la Sima ni eso. Todo el que entró en una mazmorra y no salió acabó cayendo, tarde o temprano, por la grieta del cráter, que es donde la luz cae. En el Lago Negro todo el mundo tiene un nombre que no volvió. Tú bajas porque puedes volver: la noche en que la voz preguntó si la oías, contestaste, y desde entonces algo baja contigo y tira de ti hacia arriba cuando te pierdes. No vas a salvar a nadie entero; vas a bajar lo más hondo que puedas y a subir con lo que recuerdes de ellos. **Gancho**: el cariño por los demás frente al miedo a perderte tú. **Ata con**: las sombras del prólogo (son ellos), tu sombra (por eso vuelves), los guardianes (sus juramentos rotos también cayeron: los ecos son lo que la Sima guarda de ellos) y las Sendas (las sombras y las heridas de los Pokémon que conoces están ahí abajo, pero no son ellos: son lo que dejaron). Necrozma no aparece: la Sima es la garganta por la que la luz baja hacia lo que hay bajo la tierra, y nadie ha llegado al final.

### B. La voz llama desde abajo

La voz del prólogo («…¿Me oyes?») no se calló. Cada noche suena un poco más hondo, desde la Sima. Bajas para encontrar quién habla. **Gancho**: el misterio y la tentación; la duda de si la voz es una amiga o el anzuelo de lo que bebe la luz. **Ata con**: el final del prólogo directamente, y con el giro de Mundo Misterioso. **Problema**: pide responder algún día quién habla, y eso empuja hacia Necrozma antes de tiempo; además la voz ya es tu compañera en el test de personalidad, y convertirla en sospechosa cambia el tono del juego entero.

### C. Velar la luz

Cuando cayeron los guardianes se rompieron sus juramentos, y alguien tiene que hacer su turno: bajar con una luz y sostenerla lo más hondo posible, para que el eclipse no suba esa noche. Cada partida es una vela. El reto diario es el turno de esa noche, el mismo para todo el pueblo. **Gancho**: el deber, el rito, la constancia (Bloodborne y su Sueño del Cazador, el Darkest Dungeon). **Ata con**: los juramentos de los guardianes (tú eres el que jura ahora) y con el reloj como vela. **Problema**: es más frío; explica muy bien el bucle pero no da a nadie a quien querer, y la idea del dueño (las sombras de otros y tu cabeza) encaja peor.

### Por qué A

A es la única en la que **las sombras de las Sendas tienen que estar ahí**: son exactamente lo que vas a buscar. Explica el reloj (cuánto aguantas siendo tú), el regreso (tu sombra te saca), los heraldos (lo que tu cabeza se inventa ahí abajo) y el Eco (lo que de ti ya se quedó). Y no gasta ningún misterio del juego principal. De B se puede quedar un detalle: la voz suena en la primera y en la última cinemática, y nunca se dice de quién es. De C, la palabra «turno» para el reto diario («el turno de esta noche»).

### Arriba y abajo: cómo encajar Nihilego y Necrozma

Propuesta para no contradecir nada: **en la Sima, hacia abajo es hacia el eclipse**. Las líneas que ya hay lo dicen sin decirlo (el agua sube hacia el eclipse, los árboles crecen hacia abajo). Al bajar, el anillo rojo pasa de estar encima a estar delante y luego debajo. El «otro cielo» de Nihilego y el «bajo la tierra» del prólogo son el mismo sitio visto desde los dos lados, y la Sima es donde se tocan. No se dice nunca así: se ve en el fondo del Estrato IV (un cielo reflejado en el agua) y del V (el eclipse debajo de las islas). Lo que hay al final no se enseña.

---

## 3. La idea del dueño: bajar es resistirse

La Sima no es un sitio, es una caída. Cuanto más bajas, más tira el eclipse de tu cabeza, y lo que ves ahí abajo es una mezcla de tres cosas.

### Lo que hay ahí abajo

| Lo que ves | Qué es | Qué jefe o pieza es hoy |
|---|---|---|
| **Sombras ajenas** | Pokémon que bajaron y no volvieron. No son ellos: son su herida, lo que el eclipse se quedó. Las sombras y las heridas de las Sendas reaparecen aquí como el eco de las heridas de otros. | Nuevo (sección 4) |
| **Lo que tu cabeza se inventa** | Las paranoias. Tu mente, para no romperse, le pone nombre y forma a lo que no entiende. Por eso los heraldos tienen nombres que no existen, epítetos que suenan a pesadilla y epígrafes que parecen pensamientos intrusos («Lo que la luz no alcanza, lo hereda»). | Los heraldos, sin tocar su mecánica |
| **Lo que de ti ya se quedó** | El Eco del Eclipse: tu forma, hueca y roja. La parte de ti que el eclipse ya se ha bebido, que baja contigo desde la primera planta y crece en cada encuentro. | El Eco, tal cual |
| **Lo que te contaron** | Los ecos de los guardianes son lo que tú sabes de ellos. Si no has vencido al guardián, el eco es un **guardián sin rostro** (los del prólogo, cada uno ante su puerta) y no dice su nombre: tu cabeza no tiene con qué rellenarlo. Si lo has vencido, sale con su nombre. | Los ecos de guardián; solo cambia el nombre y la silueta en tu cliente |

El resto de sucesos se relee sin tocar una sola regla:

| Suceso o planta | Lectura nueva |
|---|---|
| Sabueso del Eclipse (imbatible, solo se huye) | La idea fija: no se vence, se deja atrás |
| Altar del Eclipse (pactos) | Negociar con lo que te está volviendo loca |
| Casa de monstruos, emboscada | La paranoia que tenía razón: estaban ahí desde el principio |
| Cristal del tiempo | Un recuerdo claro: te devuelve un poco de ti |
| Eco mercader | Alguien amable que no está |
| Nido del Eclipse | Un pensamiento que se repite hasta que lo rompes |
| Derrumbe | Lo que ya has bajado se cae detrás de ti: no hay vuelta atrás |
| Niebla | Lo de fuera se borra; lo de dentro, no |

### La cordura sin sistema nuevo: el reloj es la lucidez

No hace falta una barra de cordura: **el reloj ya lo es**. Solo cambian las palabras.

- El reloj es tu **lucidez**: cuánto aguantas siendo tú. El HUD sigue enseñando minutos y segundos; la tarjeta de entrada y el resultado lo llaman lucidez.
- Bajar te devuelve lucidez porque es un acto de voluntad (elegir seguir). Vencer un eco te devuelve más: has mirado a algo de frente. El cristal, un recuerdo claro.
- A las 0:00 ya no «se traga la planta»: **te pierdes**. La pantalla final pasa a ser el regreso (sección 5): tu sombra te saca y despiertas en el borde del cráter. Por eso es una marca y no una derrota, como hoy.
- Por debajo de 30 s el reloj ya late en rojo y hace tic: eso es la cabeza al borde. Se mantiene.
- Derrumbe y Niebla dicen lo mismo con el escenario.

### Una mecánica ligera opcional: Figuraciones

Si se quiere que la paranoia se *vea*, una sola pieza, solo de presentación:

- Con la lucidez por debajo de 60 s, de vez en cuando aparece en el borde de la vista la silueta de un enemigo que no existe (una especie de la planta, en negro), quieta o andando hacia ti, y se deshace al acercarte o al cabo de 2 s.
- **Nunca dispara, nunca daña, nunca bloquea, nunca es una bala.** En un bullet hell una bala falsa sería injusta; una silueta en la penumbra no.
- Es cosmética de cada cliente (no viaja por la red, no toca la semilla de la partida, se puede sacar de una semilla propia de presentación). Se puede apagar en ajustes de accesibilidad.
- **Paga** porque convierte el reloj en algo que se siente sin leer un número, y porque es barato (un sprite, una regla de aparición y un test que comprueba que no tiene colisión).

Si no paga en la prueba de juego, se quita sin tocar nada más.

### Los estratos como etapas de la caída

Los estratos ya existen con su aspecto. Se propone darles un sentido, contado en su cinemática y en sus líneas, sin cambiar sus nombres (que ya están en el juego) salvo que el dueño quiera.

| Estrato | Plantas | Etapa | Qué pasa en la cabeza | Qué cambia en las líneas |
|---|---|---|---|---|
| I · Ecos de la Cripta | 1-10 | **Lo que conoces** | Todo se parece a sitios que has visto. Aún te fías de tus ojos. Planta 10: ves tu sombra por primera vez. | La cera, las velas, «algo baja contigo» |
| II · Raíces del Bosque Hundido | 11-20 | **Lo que temes** | Los caminos vuelven, la niebla respira, algo mira. Primeras sombras ajenas. | Raíces que buscan, miradas |
| III · La Campana Ahogada | 21-30 | **Lo que nombras** | La cabeza empieza a ponerle nombre a todo: aparecen los heraldos (22). La campana suena encima y debajo a la vez. | La campana avisa; los nombres |
| IV · El Cielo Envenenado | 31-40 | **Lo que no es tuyo** | Ya no ves tus miedos sino los de otros: aparecen las heridas de las Sendas. El agua refleja el otro cielo. | Reflejos, el otro cielo, voces ajenas |
| V · El Abismo bajo el Anillo | 41+ | **Lo que queda de ti** | Sin paredes, sin arriba. El eclipse está debajo. Solo te sostiene tu nombre. | Tu nombre, la luz que cae |

(Si el dueño prefiere las etapas del duelo, se pueden llamar negación, miedo, negociación, rencor y aceptación; las de arriba son menos de manual y encajan mejor con el tono souls.)

---

## 4. Las sombras y las heridas de las Sendas en la Sima

### El catálogo

Con las ocho Sendas (las cuatro de los iniciales en `main`, las cuatro del gacha en `feat/sendas-gacha`), hay:

| Línea | Sombras propias | Herida |
|---|---|---|
| Mimikyu | ninguna (Sableye y Aegislash son jefes del juego) | Mimikyu Sin Disfraz |
| Cubone | Haunter, Mandibuzz, Dusclops, Kangaskhan, Bisharp, Dusknoir | Marowak Sin Lágrimas |
| Litwick | Drifblim, Banette, Mismagius, Muk (Lanturn y Nihilego repiten) | Chandelure de Llamas Ajenas |
| Zorua | Kecleon, Gengar, Mightyena, Houndoom, Spiritomb (Decidueye repite) | Zoroark de Niebla Blanca |
| Abra | Munna, Drowzee, Mr. Mime, Hypno, Musharna | Alakazam Desvelado |
| Piplup | Glalie, Weavile, Mamoswine, Lanturn, Froslass, Lapras | Empoleon de Hielo Negro |
| Shinx | Ampharos, Manectric, Absol, Electivire, Umbreon | Luxray Sin Párpados |
| Axew | Druddigon, Bisharp, Garchomp, Salamence, Dragonite | Haxorus de Colmillos Rotos |

Unas 36 sombras y 8 heridas (fuentes: `src/data/story/{cubone,litwick,zorua}.ts`, `git show feat/sendas-gacha:src/data/story/{abra,axew,piplup,shinx}.ts`). Todas son ya jefes de cartas con sus peleas de Fácil a Pesadilla (`STORY_FIGHTS`, `src/data/story/bosses.ts:15-18`) y su prueba de justicia.

### Dónde salen

| Qué | Dónde | Frecuencia | Cómo |
|---|---|---|---|
| **Sombra extraviada** (una sombra de Senda) | Suceso nuevo, desde la planta 12 | Peso 1 entre los sucesos (como el Sabueso), así que una de cada 8 a 12 plantas con suceso | Una sala de la planta con su muro de niebla. **Optativa**: puedes ir a la escalera sin entrar. Si entras y la vences: +20 s de lucidez y un objeto a elegir. Cuesta tiempo, paga tiempo: una apuesta, como la sala de oleadas. |
| **Herida ajena** (una herida de Senda) | Las plantas de eco de guardián (acabadas en 5), desde la 35 | Una de cada dos: 35, 55, 75... herida; 45, 65, 85... guardián | Ocupa el sitio del eco de guardián, con su regla de eco (60 % de vida, más daño con la profundidad, +60 s al caer) y su sala propia de la Senda. |

Por qué así:

- Las sombras son jefes intermedios: como encuentro raro y optativo no cambian el ritmo de la Sima ni suman otro piso de jefe fijo (ya hay uno cada 5 plantas y, desde la 22, otro en las acabadas en 2).
- Las heridas son el clímax de cada Senda: merecen un sitio fijo y hondo, en el estrato de «lo que no es tuyo». Alternarlas con los guardianes mantiene a los cinco guardianes en rotación.
- Las dos van en bolsa: no se repite una sombra (ni un sprite: Bisharp está en dos Sendas) hasta que han salido todas, y lo mismo con las heridas.

### Qué sombras salen: la regla

Tres opciones:

| Regla | Ventaja | Problema |
|---|---|---|
| Solo las de Sendas que has cerrado («recuerdos que llevas») | Muy personal | **Rompe el reto diario**: dos jugadores verían jefes distintos en la misma planta |
| Solo las de Sendas que no has cerrado | Te empuja a jugarlas | Igual de injusta para el diario, y castiga al que juega mucho |
| **Todas, por semilla; lo que cambia es cómo las ves** *(recomendada)* | El diario sigue igual para todos; nadie pelea una cosa distinta | Spoilers de Sendas no jugadas (se resuelve abajo) |

Con la recomendada, cada cliente decide **solo el texto**:

- **Senda cerrada** (ese capítulo o la línea entera): la sombra sale con su nombre y su epíteto, y una línea de reconocimiento en el registro: «Es Dusknoir, el que guía a los muertos. Cubone ya lo despidió. Este no lo sabe.» La herida, si cerraste el III: «La herida de Cubone. Él la cerró. Esta se quedó abajo.»
- **Senda sin cerrar**: la sombra sale como **«Sombra de alguien»** con su silueta en negro y sin epíteto; la herida como **«Una herida que no es tuya»**. Se pelea igual. Cuando más tarde cierres esa Senda, la primera vez que la vuelvas a ver en la Sima tendrá nombre.

Así se cumple la idea del dueño (las heridas de otros, los recuerdos que llevas) sin tocar la semilla.

**Pool por datos**: la bolsa se construye leyendo `STORY_BOSSES` (más la herida de Mimikyu), sin lista aparte. Cuando entren las Sendas del gacha, entran solas. Un test recorre cada jefe de cada Senda y comprueba que puede salir en la Sima (la regla de integración de `CLAUDE.md`).

**Cooperativo**: el anfitrión decide la sombra con la semilla y viaja como hoy cualquier jefe; cada cliente pone su nombre según su propia memoria.

---

## 5. Cinemáticas

Todas en el motor que ya hay: los cuadros quietos del prólogo (`CinematicPanel`, `src/data/prologue.ts:15-29`) con la forma de las Sendas (`StoryBeat`: escena y figura, una línea por cuadro, `src/data/story-quests.ts:40-54`). Reglas comunes:

- **Solo jugando sola.** En compartida la partida no se para nunca: sale la tarjeta de nombre y la línea al registro, como los heraldos (`docs/gdd.md:413`).
- **El reloj se para** (ya lo hace con `cinematic`, `src/core/endless.ts:66-67`) y además se suman los 3 s de respiro de la planta.
- **Una vez por dispositivo** (como el bestiario de heraldos); después, solo la tarjeta. Se pueden volver a ver desde el menú, junto al Prólogo.
- Se saltan como el prólogo. No tocan la semilla: el diario sigue igual.
- La figura del jugador es su especie actual; la de su eco, la misma con el filtro de corrupción que ya usa el Eco.

### 5.1 La boca *(primera entrada a la Sima, antes de la planta 1)*

1. El borde del cráter de noche. La estatua quemada mira al fondo. «En el Lago Negro todos tienen un nombre que no volvió.»
2. Una luz roja que cae por la grieta, despacio, sin tocar nada. «Las mazmorras devuelven sombras. La Sima ni eso.»
3. Tu Pokémon en el borde, pequeño. Detrás, en la ceniza, su sombra no va al mismo ritmo. «Tú contestaste a la voz. Por eso vuelves.»
4. Negro. «Baja todo lo que puedas. Acuérdate de ellos.»
5. Negro, la voz, muy baja. «…Y acuérdate de ti.»

### 5.2 Estratos *(la primera vez que llegas a la 11, la 21, la 31 y la 41; 3 cuadros cada una, antes de la tarjeta de siempre)*

**II · Lo que temes** (planta 11)
1. Raíces sin árbol que bajan del techo. «Aquí empieza a parecerte que algo te mira.»
2. Un sendero que vuelve al mismo tronco. «Puede que sea verdad. Puede que no.»
3. Tu Pokémon de espaldas; su sombra mira hacia ti. «No mires atrás para comprobarlo.»

**III · Lo que nombras** (planta 21)
1. Agua quieta y una campana bajo ella. «A lo que no se entiende, la cabeza le pone nombre.»
2. Una silueta enorme y sin cara al fondo; letras que se escriben solas y se borran. «Nombres que nadie ha dicho nunca.»
3. La campana suena. «Que tengan nombre no los hace de verdad. Tampoco los hace menos.»

**IV · Lo que no es tuyo** (planta 31)
1. Un pantano que refleja un cielo que no es este. «Aquí abajo ya no ves tus miedos.»
2. Siluetas de Pokémon en el agua, quietas, de espaldas. «Ves los de los que bajaron antes.»
3. Una de ellas se da la vuelta; no tiene cara. «No los salves. Recuérdalos.»

**V · Lo que queda de ti** (planta 41)
1. Islas de piedra sobre la nada. «Ya no hay paredes. Ni arriba.»
2. El anillo rojo, debajo. La luz cae hacia él. «La luz no se perdió. Cae. Siempre ha caído.»
3. Tu Pokémon solo en una isla, su sombra pegada a sus pies. «Lo único que te sostiene es tu nombre. Dilo.»

### 5.3 Tu sombra *(el primer Eco del Eclipse, planta 10; hoy sale sin cinemática)*

1. La sala abierta, oscura. Tu Pokémon de pie. «Desde la primera planta, algo baja contigo.»
2. Su sombra se despega del suelo y se queda de pie, delante. «No te imita. Te espera.»
3. La sombra con tu forma, en negro y rojo, con su halo. «Es la parte de ti que el eclipse ya se ha bebido.»
4. Las dos, frente a frente. «No la odies. Gánale.»

### 5.4 El primer nombre *(primer heraldo, planta 22; antes de su cinemática generada, que no cambia)*

1. Negro. Un murmullo de sílabas. «Tu cabeza ha encontrado un nombre.»
2. La silueta del heraldo, sin color. «No lo has oído nunca. Lo dices como si lo supieras.»
3. Corte a su cinemática de siempre.

### 5.5 La sombra de alguien *(la primera Sombra extraviada; y otra versión la primera vez que ves la sombra de una Senda que has cerrado)*

Sin Senda cerrada:
1. Un muro de niebla en una sala lejana. «Detrás hay alguien que bajó y no volvió.»
2. Una silueta grande, en negro. «No es él. Es lo que el eclipse se quedó de él.»
3. «Puedes seguir de largo. Nadie te lo va a reprochar.»

Con la Senda cerrada (se cambia el cuadro 2 por su figura con nombre):
2. La sombra, reconocible. «Lo conoces. Lo viste caer al lado de alguien a quien quieres.»
3. «Aquí abajo no sabe que ya terminó.»

### 5.6 Punto de quiebre *(la primera vez que la lucidez llega a 0:00)*

Sustituye a la pantalla «El eclipse te ha alcanzado» (`es.json:446-447`) esa primera vez.

1. El HUD se apaga. Las paredes laten al ritmo del eclipse. «Ya no sabes cuánto llevas aquí.»
2. Tu Pokémon de rodillas; a su alrededor, siluetas que no estaban. «Todos te miran. Ninguno está.»
3. Negro. «Tu nombre. ¿Cuál era?»
4. Negro. La voz. «…¿Me oyes? ¿Puedes oírme?»
5. Una mano de sombra (la tuya) tira hacia arriba.

### 5.7 El regreso *(al acabar cualquier partida de la Sima; entero la primera vez, después 2 cuadros)*

1. El borde del cráter, al anochecer de siempre. Tu Pokémon tumbado en la ceniza. «Despiertas arriba. Tu sombra ha vuelto a ir detrás de ti.»
2. Tu Pokémon sentado, mirando a la grieta. «Planta {floor}. Hasta ahí llegaste a buscar.»
3. (Primera vez) La estatua quemada. «Mañana habrá otra grieta igual. Esta noche ha bajado todo el pueblo por la misma.» *(guiño al reto diario)*
4. (Primera vez) Negro. «Lo que viste no se cuenta. Se guarda.»

La pantalla de marca sigue igual detrás.

### Textos que cambian sin cinemática

| Clave | Ahora | Propuesta |
|---|---|---|
| `dungeon.eclipse.lore.1` | «Bajo el anillo rojo se abrió una grieta sin fondo. Lo que baja por ella vuelve como eco.» | «Todo lo que no volvió de las mazmorras acaba cayendo por aquí. Tú puedes volver. Por ahora.» |
| `dungeon.eclipse.lore.2` | «Allí abajo los guardianes caídos se levantan otra vez, y el eclipse se traga cada planta que tarda.» | «Allí abajo ves lo que otros perdieron y lo que tu cabeza se inventa. Cuanto más tardas, menos sabes cuál es cuál.» |
| `endless.entry.clock` | «Reloj: {time}...» | «Lucidez: {time}. Bajar te devuelve +{bonus} s (menos cuanto más hondo); vencer un eco, más. A las 0:00 te pierdes.» |
| `screen.eclipse.title` / `.text` | «El eclipse te ha alcanzado» / «Se acabó el tiempo...» | «Te has perdido» / «Tu sombra te ha subido hasta el borde. Tu marca queda en el tablón.» |
| `endless.echo` | «Eco del guardián · Planta {floor}» | Sin cambio si lo has vencido; «Guardián sin rostro · Planta {floor}» si no |
| Estratos (`sima.band.*.lore.*`) | Cuatro líneas sueltas | Una de las cuatro, al menos, dice su etapa (ejemplos en 5.2) |
| `endless.mode.daily` | «Reto diario» | Se queda; la tarjeta añade «El turno de esta noche» |

Todas con su versión inglesa en `en.json`.

---

## 6. Plan, riesgos y preguntas

### Tareas

| # | Tarea | Tamaño | Datos o motor |
|---|---|---|---|
| T1 | Textos: mazmorra, lucidez, pantalla final, líneas de estrato, eco sin rostro (es y en) | S | Datos |
| T2 | Cinemáticas de la Sima: tipo `SimaScene`, cuadros en `src/adapters/sima-scenes.ts` con la figura del jugador y su eco, disparadores (primera entrada, estrato, primer Eco, primer heraldo, primera sombra, quiebre, regreso), «vistas» guardadas en el dispositivo, solo en solitario, reloj parado, entrada en el menú para volver a verlas (hecho: Galería del menú del pueblo, `odd/tasks/lore-gallery.md`) | M | Motor (pocas piezas nuevas: el reproductor y las poses ya existen) |
| T3 | Eco de guardián sin rostro si no lo has vencido (nombre y silueta, cosmético por cliente; la pelea no cambia) | S | Motor ligero, lee los récords de siempre |
| T4 | Suceso «Sombra extraviada»: tipo nuevo en `SIMA_EVENTS`, sala con muro de niebla, bolsa por semilla sobre `STORY_BOSSES`, pelea del nivel de la partida con la escala de eco, premio, nombre según memoria, cooperativo | M-L | Datos (peso, planta mínima, premio) y motor (el suceso y la sala) |
| T5 | Heridas en las plantas de eco desde la 35, alternas con los guardianes, con su sala | M | Datos (`ENDLESS.echoes` gana una regla de alternancia) y motor |
| T6 | Figuraciones (opcional) | S-M | Motor (presentación) y un ajuste de accesibilidad |
| T7 | GDD (`docs/gdd.md` §3), `docs/story-quests.md` («Pendiente»), lista de paridad: solo y cooperativo, es y en, pruebas, santuario | S | Docs |

Orden sugerido: T1 y T7 (se nota enseguida y no rompe nada), T2, T3, T4, T5, y T6 al final si se quiere.

### Riesgos

- **Justicia del diario.** Todo lo que cambia por memoria tiene que ser texto o silueta. Un test debe comprobar que la planta generada (jefes, sucesos, salas) es idéntica con dos memorias distintas.
- **Pruebas de los jefes.** Las cartas de las Sendas están demostradas por nivel (`tests/sim/story-prove-*.test.ts`, `wound-prove.test.ts`), pero no con la escala de profundidad de la Sima. La profundidad solo sube el daño (no cambia los patrones), así que «se puede sobrevivir» se mantiene; «se puede matar a tiempo» depende de la vida, y la regla de eco (60 %) ayuda. Hay que añadir la escala de la Sima a la prueba, como ya se hace con los ecos de guardián.
- **Ritmo y reloj.** Una sombra optativa cuesta tiempo; si paga poco, nadie entra, y si paga mucho, es obligatoria. Medir con el arnés de balance antes de fijar el premio.
- **Densidad de jefes.** Desde la 35 habría jefe en las acabadas en 0, 2 y 5. Ya pasa hoy con los ecos de guardián; las heridas solo cambian cuál.
- **Spoilers.** Resuelto con «Sombra de alguien» y «Una herida que no es tuya», pero la silueta de una herida ya dice mucho. Alternativa: que la herida de una Senda sin cerrar salga con la silueta de otra.
- **El gacha.** Las cuatro Sendas del gacha están en otra rama. La bolsa leída de `STORY_BOSSES` las coge solas al fusionar, pero hasta entonces el catálogo en `main` es de 15 sombras y 4 heridas.
- **Tono.** Cinco o seis cinemáticas en una mazmorra de directo pueden pesar. Por eso: una vez por dispositivo, cortas, y saltables.

### Preguntas para el dueño

1. **¿Cuál de las tres razones?** La recomendada es A (bajar a por los que no volvieron, y volver porque tu sombra tira de ti).
2. **¿El reloj se llama «lucidez» en el HUD, o solo en los textos?** El número no cambia; solo cómo se lee.
3. **Las Sendas sin cerrar en la Sima: ¿sombra sin nombre, o mejor que no salgan sus heridas hasta que hayas cerrado al menos una Senda?** (Lo segundo sigue siendo justo para el diario si la condición es solo de texto, pero no si quita jefes.)
4. **¿La Sima sigue abierta desde el principio?** Con la razón A tiene más fuerza abrirla tras vencer al primer guardián (ya hay una sombra que no volvió que buscar), pero el directo pedía tenerla desde el minuto uno.
5. **¿Figuraciones sí o no?** Es la única mecánica nueva; todo lo demás reutiliza lo que hay. *(Decidido: sí.)*
