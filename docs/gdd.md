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
- 3 + n enemigos por sala, siendo n el número de jugadores *(provisional; en el MVP la cuenta sube con la profundidad: de 1 a 2 por sala en la planta 1 y medio más por planta, como mucho 4, tanto en la Cripta como en el Bosque)*.
- Los enemigos duermen hasta que entras en su sala o te ven de cerca; una vez despiertos ya no paran.
- Las escaleras se pueden usar en cuanto las encuentras, sin limpiar la planta (como en Mundo Misterioso).
- La vida se arrastra de una planta a otra y cada planta nueva cura un 25 % de la vida máxima *(provisional)*. El Disfraz se recupera en cada planta.
- Cada partida tiene una semilla (al azar, o fija con `?seed=` en la dirección) y se enseña al final, así que una partida buena se puede repetir.
- Cada planta empieza con una tarjeta (el nombre de la mazmorra y "Planta 2") que aparece y se va en un par de segundos sin parar el juego; la planta 1 enseña en su lugar el título de la mazmorra (ver "Mazmorras").
- Minimapa arriba a la derecha, como en Mundo Misterioso: se descubre lo que ves (la sala entera al entrar, los pasillos a tu alrededor), las escaleras salen cuando las has visto y los enemigos solo si están en pantalla. Tab lo muestra u oculta.
- Los enemigos despiertos te persiguen rodeando paredes (siguen el camino andando hacia ti cuando no te ven).
- Sin reloj. Solo un aviso suave si el grupo se queda muchísimo tiempo (la idea del viento de Mundo Misterioso), para cortar el quedarse farmeando, nunca para castigar a quien juega normal.

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

**Niveles.** Cada enemigo derrotado da experiencia según la especie (Poochyena 10, Gastly 12, Duskull 13, Golett 22, Pawniard 7, Sableye 50, Aegislash 60) y la profundidad (un 50 % más por cada planta por debajo de la primera). Empiezas en el nivel 1 y el tope es el 10 (hacen falta 25, 60, 110, 175... puntos en total). Cada nivel da 8 PS máximos más (que se curan al momento) y un 5 % más de daño. Al subir sale "¡Mimikyu subió al nivel N!" con una fanfarria corta; arriba a la izquierda están el nivel y la barra de experiencia. En cooperativo, como en Mundo Misterioso, cada jugador en pie gana la experiencia de cada enemigo derrotado, lo haya derrotado quien lo haya derrotado (también el derrumbe). Quien está debilitado no gana nada, para que subir de nivel no lo levante.

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
- Cada guardián tiene una escena corta antes del combate (la puerta sellada, su mirada y sus palabras, y al final su figura con su nombre y su apodo, al estilo de Touhou) y otra al caer (sus últimas palabras y una pista de lo que hay más hondo). Unos 16 y 13 segundos *(provisional)*, con el motor del prólogo y saltables igual (mantener Esc o Intro, o "Saltar"). Completas la primera vez en ese navegador; después solo la tarjeta del nombre (unos 2,5 segundos). En solitario la partida se para mientras salen; en partida compartida no se para nada y solo aparece la tarjeta del nombre sobre el juego. Aegislash es "El Rey de las Espadas" y Decidueye "El Arquero de la Niebla".
- Cómo escalan con el número de jugadores: sección 8.

### Prólogo y trasfondo *(provisional)*

El juego se abre con un prólogo de algo más de un minuto, al estilo de la apertura de Dark Souls (narración lenta en texto, cuadros quietos que salen de la oscuridad, mucha calma) pero dibujado con el pixel art de Mundo Misterioso. Se puede saltar, sale solo la primera vez que se pulsa Jugar y se puede volver a ver desde el menú principal (entrada Prólogo).

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
| Gastly | Flota sobre todo y lanza una bola lenta |
| Duskull | Lento, atraviesa las paredes para seguirte y lanza un fuego fatuo que se curva hacia ti durante un par de segundos (desde la planta 2) |
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

Las primeras plantas son más suaves que el final de la Cripta (de 1 a 2 enemigos por sala en la planta 1, medio más por planta, como mucho 4) y se endurecen al bajar.

| Enemigo | Cómo juega |
|---|---|
| Phantump | Atraviesa los árboles; se acerca despacio, avisa y agarra, y al agarrar recupera vida |
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

- **Plantas sin fin**: todas generadas, salvo una de cada cinco. En las 10, 20, 30... espera el jefe propio de la Sima, el **Eco del Eclipse** (abajo); en las 5, 15, 25... un **eco del guardián**: Aegislash, Trevenant, Decidueye, Dhelmise y Nihilego por turnos, en su sala, más fuertes según la profundidad. Solo sale su nombre ("Eco del guardián · Planta 5"), sin cinemática; al caer se abre el camino arriba de la sala. El eco de Aegislash pelea en la sala del trono de la Cripta, con sus cuatro pilares, pero solo con la primera fase: nunca desenvaina (el eco es más corto, pega más con la profundidad y el reloj corre); igual Decidueye, Dhelmise (en el pecio) y Nihilego (en la grieta), que nunca despiertan su segunda fase como ecos.
- **Enemigos**: una sola lista (especie, planta mínima, peso y, si hace falta, cuánto cambia el peso por planta) con los de la Cripta (también los nuevos de la Cripta renovada: Duskull y Pawniard en pareja desde la 2, Golett desde la 3; Sableye se queda en su cámara), el Bosque, el plantel experimental, las Cuevas Inundadas (Krabby desde la 6, Remoraid desde la 7, Shellos desde la 8) y el Pantano Tóxico (Venipede en pareja desde la 9, Salandit desde la 10, Skrelp desde la 11; Lanturn y Salazzle se quedan en su mazmorra); los enemigos nuevos entran en la Sima con añadir una línea. **Más duros, no más**: nunca más de 3 enemigos por sala (un grupo cuenta dentro de los 3); con la profundidad pesan más los duros (Golett, Pumpkaboo grande, Grimer, Slugma, Houndour, Clauncher, Croagunk, que además salen una o dos plantas antes) y menos los flojos (Poochyena, Zubat, Pumpkaboo pequeño, hasta un cuarto de su peso, nunca cero). Desde la planta 1 la vida sube un 5 % y el daño un 3,5 % por planta (como mucho ×3 y ×2,5); los ecos tienen el 60 % de esa vida.
- **Élites** (un solo sistema con los de los niveles de dificultad, §9): cada enemigo puede salir élite con la mayor de dos probabilidades, la del nivel (0, 10, 20 o 30 %) y la de la profundidad (desde la 6, un 6 % y un punto y medio más por planta, como mucho un 40 %). Se elige con la semilla de la planta, así que todos los jugadores ven los mismos. Un élite de la Sima tiene un 35 % más de vida (encima de la de su rasgo), brilla del color de su rasgo y lleva uno de los seis de la tabla común: **robusto** (vida ×1,5), **frenético** (esperas al 65 %), **rápido** (actúa un 30 % más deprisa), **ráfaga** (solo los que disparan: dos tiros más a los lados de cada uno), **acorazado** (el primer golpe no le hace nada) o **furia** (un 50 % más deprisa por debajo del 40 % de vida). Desde la 21, un 30 % de los élites golpean "a posición": la voltereta no les salva (`pierceRoll`, la regla de §9, con su borde blanco y violeta, su "!" y su aviso). *Decisión de integración*: la mayor y no la suma, para que la Pesadilla ponga élites desde la planta 1 sin que en lo hondo casi todo brille.
- **Escuadras** (desde la 4): una sala con dos o más enemigos puede cambiarlos por una escuadra que mezcla papeles, un 15 % y un punto y medio más por planta, como mucho un 50 %, nunca con más enemigos de los que tenía: Golett con Duskull, Pawniard con Gastly y otro Pawniard, Croagunk con Spinarak, Pumpkaboo grande con Hoothoot y Litleo, Grimer con Houndour y Chinchou, Clauncher con Pawniard y Koffing, Krabby con Remoraid (12), Shellos con Krabby y Tentacool (16), Salandit con Skrelp (18), Venipede con Skrelp y Salandit (22). Plantas con prisa de todas las mazmorras: derrumbe desde la 2 y Niebla desde la 3, un 8 % cada una y un punto más por planta, como mucho un 22 %.
- **Reloj**: empieza en 8:00 y baja con el tiempo de juego (solo se para con la partida en pausa jugando solo: menú o elección de objeto; en compartida nunca se para). Bajar de planta suma 40 s, 2 s menos por planta y nunca menos de 15 s; vencer un eco suma 60 s más. A las 0:00 el eclipse se traga la planta y la partida acaba como marca, no como derrota (sin el recorte de las Pokémonedas). En pantalla, grande arriba en el centro; por debajo de 30 s se pone rojo, late y suena un tic cada segundo; cuando suma tiempo sale "+40 s".
- **Modo puro**: se empieza a nivel 1, sin objetos y sin las mejoras permanentes de la tienda, para que las marcas se puedan comparar (lo dice la tarjeta de entrada). Lo que se encuentra dentro (niveles, objetos, bayas) funciona como siempre.
- **Marca**: la planta más honda y, a igualdad, el tiempo que quedaba. Las diez mejores del dispositivo se guardan aparte de los récords y salen en el tablón del pueblo y en la pantalla final, con el modo, la fecha y la semilla.
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
- **Eco del Eclipse** (plantas 10, 20, 30...): el jefe propio de la Sima, la sombra corrompida de Mimikyu (sus hojas de sprite completas, en negro y rojo, con un halo). Flota arriba de una sala abierta y juega cartas de bullet hell con nombre: «Anillo sin Cierre» (anillos con un hueco que gira un poco en cada oleada), «Espiral del Último Rayo» (tres brazos), «Tres Refugios bajo el Sol Negro» (la sala arde salvo tres refugios; la voltereta no salva), «Lluvia de Luz Roja» (muros de luz que caen con un hueco que nunca salta más de lo que se puede andar), «Dos Sombras, Un Eco» (dos espirales en sentidos opuestos) y «El Anillo se Cierra» (un anillo que se cierra con un hueco; la voltereta no salva). Dos cartas en la 10 y una más cada diez plantas (una más desde difícil, como truco de `src/data/sima-tricks.ts` leído por `behaviourFor`), hasta las seis. Siempre hay paso; nunca más de 110 tiros suyos a la vez (`maxShots`, bajo el tope global de 160). Los refugios y el anillo son ataques a posición con su aviso de §9 (borde doble en los refugios y en el anillo, "!" sobre el Eco). Solo sale su nombre ("Planta 10 · La sombra que bajó contigo"), sin cinemática; al caer suma 60 s y abre el camino arriba.
- **Ritmo**: cada planta empieza con 3 s de respiro en los que el reloj no corre. El tiempo ganado sale grande bajo el reloj, en verde, con el motivo debajo ("por bajar", "eco vencido", "cristal del tiempo"...).
- **Cooperativo** (sucesos): el anfitrión lleva el suceso de la planta y el pacto y los manda con su instantánea; cada invitado los coloca con la misma semilla y cierra o abre las puertas de la sala de oleadas en su propio mapa. El mercader es de cada jugador.
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
| Zubat (Veneno/Volador) | En grupos de tres; vuela por encima de las paredes haciendo eses y se lanza en picado | Rodar o apartarse cuando cae; se queda abierto si falla | 1 |
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
### El mundo *(provisional)*

Fuera de las mazmorras hay un mundo pequeño que se recorre andando, siempre al anochecer del eclipse y sin combate (`src/data/world.ts`). Son mapas unidos por sus bordes: al salir por uno, un fundido corto lleva al siguiente y su nombre aparece arriba.

- **Refugio del Ocaso**: el pueblo de siempre (Mimikyu, Poochyena, Gastly y el tablón). Un poste junto al camino del este abre la lista de mazmorras abiertas, para no tener que andar (atajo pensado para los directos).
- **Camino de las Ruinas**: tumbas y columnas rotas; la boca de la **Cripta del Rey de las Espadas** es una casa de piedra hundida al norte del camino. Una estatua sin rostro y un poste del camino.
- **Paso del Mirador**: una grieta parte el paso y solo queda un puente. Desde aquí el eclipse se ve enorme (estatua del mirador, atalaya). Al sur, en la linde, junto a un tronco hueco, entra el **Bosque Brumoso**; al norte sube el camino al cráter.
- **Cráter del Eclipse**: ceniza y roca alrededor de un pozo justo debajo del eclipse. En su borde está la boca de la **Sima del Eclipse**, abierta desde el principio; una estatua quemada mira al fondo.
- **Aldea del Lago Negro**: el segundo pueblo, de pescadores, junto a un lago que ya no refleja el cielo. Cubone pesca en el embarcadero, Litwick guarda la llama que guía a los perdidos y cuenta una cosa cada vez, y Phantump, junto a un puesto vacío, ve lo que vendrá (el gacha sigue «Próximamente»). Un ídolo de rana recibe ofrendas.
- **Ciénaga del Cielo Roto**: al este del lago, donde cayó la primera luz del eclipse. Charcas negras, árboles muertos, un cristal caído que zumba (dice más al caer los guardianes) y, entre dos columnas rotas, la boca del **Pantano Tóxico**. Un Croagunk ermitaño vive junto al camino; Skrelp y Venipede pasean por la orilla.

Al pisar la boca de una mazmorra sale una ventana «¿Entrar en …?». Si aún está sellada, una línea dice qué guardián hay que vencer; si no existe todavía, que algo allí abajo no ha terminado de despertar. Las estatuas, el poste y el ídolo dicen una línea más al vencer al guardián de cada mazmorra (récords de este dispositivo). Por el mundo pasean Pokémon inofensivos (Pumpkaboo, Hoothoot, Foongus, Spinarak) con los sprites que ya tiene el juego. Cada mapa tiene su luz (más roja en el cráter, más fría en el lago), niebla, hojas que caen, pájaros que cruzan el cielo y agua con reflejos rojos. Suena el mismo tema del título (Lonely Village) en todo el mundo.

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

### Controles táctiles (móvil y tableta)

Se activan solos al primer toque (ajuste «Controles táctiles»: Automático, Sí, No). Todo se traduce a la misma entrada que el teclado, así que el combate no cambia:

| Control | Qué hace |
|---|---|
| Joystick (mitad izquierda, aparece donde pones el pulgar) | Moverte, analógico y con zona muerta |
| Rodar | Rueda (como Espacio) |
| Rápido / Fuerte | Los dos movimientos; Fuerte se mantiene para cargar y se suelta para lanzar |
| Fijar | Un toque fija al enemigo que tienes delante o lo suelta; deslizar a izquierda o derecha sobre él cambia de objetivo (como la rueda) |
| Tocar un enemigo | Lo fija si el fijado por clic está activado (no ataca) |
| Pausa / Mapa | El menú de Esc y el minimapa |

Sin objetivo fijado los movimientos van hacia donde miras, como Q y E; con «Apuntado automático» (activado por defecto) van al enemigo más cercano dentro de un cono delante de ti. «Vibración» da un pulso corto al recibir un golpe y en la esquiva perfecta. En los menús todo se toca y un botón «Atrás» hace de Esc; en el pueblo hay joystick y un botón «Hablar». En la tienda, un toque sobre una mejora muestra su efecto y un segundo toque la compra, para que un toque perdido no gaste Pokémonedas.

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
Iniciales (aprobados el 2026-10-25; se eligen en la pantalla de equipo antes de la partida, junto a Mimikyu):

| Pokémon | Estilo | Rápida | Fuerte | Pasiva |
|---|---|---|---|---|
| Zorua (Siniestro) | Cuerpo a cuerpo rápido, poca vida | Golpes Furia (cinco arañazos, Normal), Finta (atraviesa al enemigo y se gira) | Pulso Noche (onda alrededor), Juego Sucio (embestida; más daño si el enemigo está atacando) | Ilusión: los enemigos dormidos solo te notan si los tocas; el primer golpe es crítico; vuelve en cada piso |
| Litwick (Fantasma/Fuego) | A distancia, frágil | Ascuas (llama rápida), Impresionar (susto a bocajarro que aturde) | Infortunio (daño doble a un enemigo aturdido), Infierno (bola lenta y fuerte) | Absorbe Fuego: los golpes de Fuego curan un poco y potencian el siguiente movimiento fuerte; además, cada 4 golpes de Fuego propios avivan la llama y potencian el siguiente movimiento fuerte |
| Cubone (Tierra) | Aguante, lento, mucha vida | Hueso Palo (golpe que aturde), Ataque Óseo (tres golpes avanzando) | Huesomerang (va y vuelve hacia Cubone, que lo atrapa; golpea dos veces), Pataleta (pisotón; doble si el golpe anterior falló) | Armadura Batalla: mientras cargas o preparas un movimiento fuerte, los golpes de frente hacen la mitad |

Sin estados alterados todavía: lo que en el juego original depende de la quemadura aquí depende del aturdimiento. Ningún enemigo actual ataca con Fuego, así que Absorbe Fuego también se carga con los golpes de Fuego del propio Litwick (cuatro golpes potencian el siguiente movimiento fuerte).
- La efectividad de tipos se aplica a E (y a las debilidades de los jefes). La pantalla de movimientos dice, para cada uno, su coste de estamina, su forma (arco corto, anillo 360°, proyectil lento...) y contra qué enemigos de la Cripta es eficaz o poco eficaz.
- Cada ataque, del jugador o enemigo, se pinta con el color de su tipo (una sola paleta); los avisos enemigos conservan el borde rojo. El último golpe de un movimiento de varios golpes y los movimientos marcados como pesados dan la pausa, la sacudida y el sonido fuertes.
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
| Cae alguien en cooperativo | Queda en el suelo y un compañero en pie puede levantarlo (momento de directo): quedarse a su lado 3 s sin recibir daño; se levanta con el 30 % de la vida, una vez por jugador y planta. Si el que ayuda recibe un golpe o se aleja, la cuenta vuelve a empezar. En Pesadilla no hay levantar (`TierDef.coopRevive`) *(provisional)* |
| Caes jugando sola | Se acaba la partida; antes puedes «Reintentar planta» desde el menú, sin límite en Fácil y Normal, una vez por planta en Difícil y ninguna en Pesadilla (sección 9) |
| Cae todo el grupo | Se acaba la partida, en todos los niveles |

## 7. Cooperativo

- De 1 a 4 jugadores en todo el juego, cada uno desde su navegador.
- Se entra igual que en PokéSurvivor (sala con código). Gran parte de su interfaz de menús y salas se puede aprovechar. Su código está bajo PolyForm Noncommercial 1.0.0 (antes de su commit `b297089`, MIT): se puede reutilizar sin ánimo de lucro manteniendo su aviso de licencia, y por cortesía conviene escribirle al autor.
- La sala es el pueblo: al crearla o entrar, todos aparecen andando juntos por el mundo (§3, «El mundo»), cada uno con su apodo encima de la cabeza; en una esquina, el código de la sala (oculto si se ha pedido para el directo) y quién está. Solo el anfitrión lleva al grupo a una mazmorra, entrando por su boca o desde el poste del camino; al acabar la partida, «Volver al pueblo» devuelve a toda la sala al pueblo para la siguiente.
- Apodo: se elige en Ajustes o en la pantalla de jugar en línea; sin apodo se usa «Jugador-XYZ». Como mucho 16 caracteres, sin caracteres de control ni invisibles. Sale sobre cada jugador en el pueblo y en la mazmorra y en la pantalla final.
- La dificultad la elige el anfitrión para todo el grupo.
- Botín y reclutas: un premio por jugador, para que nadie del chat sienta que ha ido de relleno.
- Quien levanta a quién lo decide el propio jugador caído (igual que el daño, en el lado de la víctima): su pestaña ve a los compañeros, cuenta los 3 s y manda el progreso para que los demás vean el anillo verde.

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

Hay cuatro niveles: Fácil, Normal, Difícil y Pesadilla. Fácil es el equilibrio de siempre: mismos números, mismos tiempos, mismas plantas (lo único nuevo en todos los niveles son los dos ataques de zona de Aegislash y Sableye que se cuentan abajo). Jugando sola se elige en la pantalla de movimientos, encima de «Empezar», y se recuerda para la próxima. En una sala la elige el anfitrión para todo el grupo, en la ventana de la boca de la mazmorra o del poste del camino; los invitados la ven en la ventana de la sala y juegan la del anfitrión (viaja en el mensaje de inicio; un anfitrión antiguo que no la manda cuenta como Fácil).

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
7. **Más difícil paga más:** Pokémonedas multiplicadas (también por minuto jugado) y récords propios por nivel.

### La tabla

| | Fácil | Normal | Difícil | Pesadilla |
|---|---|---|---|---|
| Vida enemiga | ×1 | ×1,15 | ×1,3 | ×1,45 |
| Daño enemigo | ×1 | ×1,15 | ×1,3 | ×1,5 |
| Duración del aviso | ×1 | ×0,95 | ×0,9 | ×0,85 (con el mínimo de arriba) |
| Enemigos extra por sala | 0 | 0 | 0 | 0 |
| Esperas entre ataques (agresividad) | ×1 | ×0,9 | ×0,8 | ×0,7 |
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

- **Aegislash:** en todos los niveles, el muro de espadas de «Cien Espadas» es un ataque de zona (se pasa por el hueco, no rodando). En Difícil, el combo de la Espada gana un cuarto golpe: el Rey sostiene el filo en alto mucho más que el ritmo del combo (la finta) y luego da un tajo ancho; quien rueda al ritmo de los tres primeros rueda demasiado pronto. Después, la apertura de siempre. También en Difícil, la estocada en círculo de «Corte de Medianoche» pasa a ser de zona (sal del anillo). En Pesadilla, la fase 2 añade una carta: **Juicio del Rey «Las Cien Espadas vuelven»**, un muro desde un extremo de la sala y, tras un segundo aviso, otro desde el contrario con el hueco movido lejos de ti.
- **Sableye:** en todos los niveles, al soltar el primer anillo de gemas el suelo revienta a su alrededor (zona marcada durante todo el aviso; sal del círculo). En Difícil, un cuarto anillo; en Pesadilla, un cuarto Destello.
- **Pawniard:** en Difícil, un tercer corte tras un aviso más largo. **Poochyena:** en Difícil, si tiene compañeros cerca aúlla al verte (no hace daño: es una apertura) y la manada embiste enseguida. **Duskull:** en Difícil, dos fuegos fatuos que se abren y te cierran por los lados. **Gastly:** en Difícil, una segunda bola apuntada de nuevo. **Golett:** en Difícil, su golpe lanza cascotes lentos en todas direcciones.

**Plantel (Sima del Eclipse)**, en Difícil: Zubat repite la embestida, Ekans deja veneno donde acaba la suya, Corphish dispara un segundo chorro, Chinchou suelta un segundo anillo, Houndour gira la llamarada siguiéndote, Slugma lanza una segunda bola de lava y Croagunk encadena un segundo Puya Nociva.

**El Bosque según la dificultad** (ya en el juego): en Fácil y Normal no hay trucos (Normal solo cambia por la tabla de arriba: avisos, esperas, vida). En Difícil cada enemigo del bosque tiene un truco más: Phantump agarra dos veces, Pumpkaboo pequeño deja una llama donde acaba su embestida, Pumpkaboo enorme lanza un anillo de llamas al golpear, Foongus suelta además un anillo de esporas, Spinarak lanza cinco hilos, Hoothoot se lanza dos veces, Impidimp amaga dos veces, Shroomish suelta esporas al aterrizar y Drifloon suelta un segundo anillo girado. Trevenant añade la carta Signo Arboleda «Danza de las Mil Ramas» (dos espirales que giran en sentidos contrarios) y Decidueye juega la Costura ya en la primera fase y una Andanada más en la segunda. En Pesadilla, además, combos más largos: Trevenant tres oleadas de raíces, más ráfagas de espiral y tres anillos; Decidueye siete flechas, cuatro abanicos, cuatro oleadas de lluvia, más plumas y cuatro costuras.

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
- **Límites conocidos.** Las arenas aisladas empiezan con el inicial a nivel 1 y sin objetos (más duro que llegar jugando). Los bots solo usan el ataque rápido, conocen el plano de la planta (como el minimapa), no sufren la niebla y en las plantas urgentes van directos a la escalera. Un jefe que muere en segundos o un perfecto que muere pueden deberse al contenido o al bot: el informe lo señala, y hay que mirarlo antes de tocar números.

### Récords

Cada mazmorra guarda la mejor planta y las victorias por nivel; los récords de antes cuentan como Fácil. La Sima guarda su tablón de diez mejores marcas por nivel (las marcas antiguas, en Fácil). El tablón del pueblo enseña los del nivel elegido ahora, y la pantalla final dice en qué nivel se jugó.

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

Se compran en el puesto de Poochyena en el pueblo (o en "Tienda" del menú principal) y se aplican al empezar cada partida, a cualquier especie. Los saltos son pequeños a propósito: el juego tiene que seguir siendo difícil.

| Mejora | Efecto por nivel | Niveles y precios |
|---|---|---|
| Vitalidad | +4 PS máximos | 60, 120, 220, 360, 550 |
| Aliento | La estamina se recupera un 5 % más rápido | 80, 160, 300, 500 |
| Respiro | Al bajar de planta te curas un 3 % más de los PS máximos (sobre el 25 % de base) | 100, 220, 400 |
| Reflejos | +8 ms de ventana de esquiva perfecta (base 120 ms) | 120, 260, 480 |
| Estudio | +5 % de experiencia | 90, 180, 320, 520 |

Comprarlo todo cuesta unas 5000 Pokémonedas (unas 30 victorias). El gacha sigue pendiente ("Próximamente").

Guardado: el saldo y los niveles comprados viven en una sola clave local (`mazmorra-sombria.save`) con versión, `migrate()` y `sanitize()` (sección 12): un dato roto o manipulado se lee como un guardado vacío y nunca rompe el juego. Los ajustes y los récords del tablón siguen en sus claves de antes.

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
