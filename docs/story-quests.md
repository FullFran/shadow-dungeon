# Sendas: las misiones de historia de cada Pokémon

*(provisional; diseño del 26-10-2026, piloto: Mimikyu)*

## Por qué

Tras jugar el desafío de Mimikyu, el dueño: «no estuvo tan épica. Deberían tener lore del Pokémon, con sus traumitas, historias y demás, y a lo mejor alguna cinemática, y que se sienta cercano, que le cojas cariño al bicho, como en Genshin pero con fórmula souls». Y después: «más largas, con dos o tres jefes por capítulo, y que el jefe final sea la versión ultra mega poderosa del propio Pokémon», con libertad creativa para buscar inspiración en la Pokédex, el anime y las películas.

Una **Senda** convierte la mazmorra reto de cada línea en una historia en tres capítulos. El reto ya existía (`CHALLENGES` en `src/data/dungeons.ts`, materiales por nivel); la Senda lo alarga, le pone jefes con sentido, voz, recuerdos y un final.

## Tono

- **Souls**: melancólico, indirecto. Las cosas se cuentan por los objetos y los sitios, con pocas palabras, y nada se explica dos veces. Lo que hay debajo del trapo no se describe nunca.
- **Cercanía de Genshin**: el Pokémon habla contigo. Tiene manías, vergüenza, calor y a veces gracia. Las mejores líneas son pequeñas: un botón, una canción a medias, una vela que te pide que sujetes.
- Castellano peninsular, frases cortas, sin rayas: la voz del Pokémon va entre comillas latinas o tras su nombre. Cada línea tiene su versión inglesa.
- Juego de fans: los motivos del canon (la Pokédex, el anime, las películas) son solo inspiración. Nunca se copia ni se parafrasea de cerca un texto oficial; se adaptan a este mundo: el Eclipse Carmesí, los juramentos de los guardianes, las sombras de los que volvieron de las mazmorras, y tu propia sombra, la que bajó contigo cuando la voz preguntó si la oías.

## Estructura

Tres capítulos, uno por nivel de material, para que la historia culmine con la evolución final (o el despertar de Mimikyu), que pide materiales de Pesadilla:

| Capítulo | Nivel | Se abre |
|---|---|---|
| I | Normal | siempre (con la línea en tu colección) |
| II | Difícil | al cerrar el I |
| III | Pesadilla | al cerrar el II |

En Fácil el reto se juega sin capítulo (no paga materiales). Si se entra en Difícil sin haber cerrado el I, se juega igual pero sin historia; la ventana de desafíos dice cuántos capítulos van cerrados. Un capítulo cerrado se puede volver a jugar.

### El camino: siete plantas y tres jefes

Una Senda tiene siete plantas (`sendaPlan` en `src/data/dungeons.ts`), el mismo camino en los tres capítulos:

1. Planta generada (la voz al llegar).
2. Planta generada (un fragmento de memoria).
3. **Primer jefe intermedio**, un jefe del juego que encaja con la historia, tras su muro de niebla; al caer enciende la hoguera (las reglas de siempre).
4. Planta generada (la voz a mitad de camino).
5. Planta generada (otro fragmento).
6. **Segundo jefe intermedio**, tras su niebla, con su hoguera.
7. **La herida**: el propio Pokémon, enorme y corrompido, su herida hecha carne. Es el jefe final de los tres capítulos: una versión menor cierra el I y el II, y la entera el III.

### La herida

El último jefe es una especie propia (`mimikyu-wound`, «Mimikyu Sin Disfraz»): la hoja del Pokémon con el filtro de corrupción del Eco del Eclipse y dibujada 1,7 veces más grande. Lucha con cartas de hechizo en el motor de siempre (el kit de `src/data/story/kit.ts`, como toda herida), hechas con patrones que ya usan los guardianes (abanicos apuntados, anillos con hueco, espirales, una marca que estalla, una cortina con su calle libre, disparos desde las esquinas) y vestidas con los movimientos del Pokémon. Por nivel gana cartas, densidad y velocidad: dos cartas en Fácil, tres en Normal, cinco con una de supervivencia en Difícil, y seis con su última palabra en Pesadilla.

**Se puede ganar, demostrado**: `tests/sim/wound-prove.test.ts` busca en vivo, con el mismo demostrador de `npm run prove`, un camino sin golpes para cada carta de cada herida en cada nivel desde tres salidas distintas, con ventanas de castigo y el margen de daño del nivel, y el bot resuelve el combate entero en Pesadilla con tres semillas. Una herida nueva entra en la prueba solo por estar en los datos.

### Un camino por capítulo *(dueño, 26-10-2026: «los tres capítulos no pueden sentirse iguales»; «pon más jefes, que estos están muy quemados»)*

Desde Cubone, Litwick y Zorua, y después también en Mimikyu, cada capítulo recorre **su propio camino**: siete plantas con el aspecto, la decoración y la música de otra mazmorra, y dos jefes intermedios propios. El camino del I es el reto mismo (también en Fácil, sin historia); en Difícil y Pesadilla el reto recorre el del II o el del III (`roadFor` en `src/data/dungeons.ts`; `challenge-<línea>-2` y `-3`, que al acabar cuentan como el reto: registros, misiones, logros y repetir). Todos los pares calculan el mismo camino a partir de la mazmorra y el nivel del anfitrión.

Los jefes intermedios son casi siempre **sombras nuevas**, Pokémon que encajan con el canon de la línea y con el capítulo, hechas jefe con el kit de `src/data/story/kit.ts`: la hoja del Pokémon (las que faltaban, bajadas con `tools/fetch-sprites.mjs` con sus animaciones propias), sus tipos (una sombra no vuela: un jefe con alas cambia Volador por Fantasma, para que la línea siempre pueda alcanzarlo), su sala con salida y tres cartas de firma. Un jefe viejo repite solo cuando la historia lo pide (Lanturn, «la otra luz» de Litwick; Nihilego, lo que bebe la luz; Decidueye, el único que vio pasar la manada de Zorua).

**Touhou por dentro.** Las cartas se llaman a la manera de Touhou, Signo Movimiento «Nombre», y cada jefe tiene su firma con patrones que ya se usan y están demostrados: abanicos apuntados, anillos con hueco, espirales que florecen, una marca que cae donde estabas, la cortina que camina, anillos cuyos huecos giran como las fases de una luna, dos muros que se cierran con una fila libre, y torretas. Una sombra juega 2 cartas en Fácil y Normal, 3 y la de **supervivencia** en Difícil, y además su **última palabra** en Pesadilla. La herida crece de capítulo en capítulo: 2 cartas en Fácil, 3 en el I (una forma menor, dibujada 1,35 veces), 5 en el II con su cuarta carta y la de supervivencia (1,55 veces) y 6 en el III con su última palabra (1,8 veces). La vida de cada jefe por nivel (`hpScale`) está ajustada para que toda carta cumpla su margen de muerte. `tests/sim/story-prove-<línea>.test.ts` demuestra cada carta de cada sombra en cada nivel desde tres salidas y el bot resuelve los combates de Pesadilla; la herida, en `tests/sim/wound-prove.test.ts`.

### Lo que los retos mandan tiene que poder hacerte daño

Prueba del dueño (26-10-2026): en el reto de Litwick, Absorbe Fuego se tragaba todo lo que hacían los enemigos de fuego, y el reto era trivial. Regla, en `tests/core/challenge.test.ts`, para todos los retos: como mucho un 10 % del peso de aparición puede ser incapaz de dañar alguna forma de la línea (por tipo, o por su pasiva: Absorbe Fuego), en cada nivel; y todo jefe tiene al menos un ataque que la daña. Los ataques de cada especie se leen de sus datos (`attackTypesOf` en `src/core/challenge.ts`). Arreglados: Litwick (fuera Duskull y Dusclops; entran Phantump, Golett y Haunter) y Piplup (fuera Salandit, cuyo veneno no toca a Empoleon; entra Krabby). Dar a los enemigos más de un ataque es otra tarea, futura.

### Cada capítulo tiene

1. **Cinemática de antes** (2 a 5 cuadros) en el reproductor del prólogo: cuadros quietos con el sprite del Pokémon en una pose (quieto, herido, caído, y el disfraz roto de Mimikyu) y fondos sencillos (el trapo, una vela, la plaza de antes del Eclipse, el anillo rojo, la oscuridad, Phantump en el lago). Una línea por cuadro. Se salta como el prólogo. Solo en solitario.
2. **Voz interior** en el registro: al llegar, a mitad (planta 4) y la primera vez que los PS bajan del 35 %.
3. **Fragmentos de memoria** (plantas 2 y 5): un recuerdo que brilla en la sala más lejana de la entrada. Al pisarlo se abre una tarjeta con su nombre y un párrafo, como la descripción de un objeto en un souls. En solitario la partida se para mientras se lee.
4. **Los tres jefes** dicen su epíteto en la tarjeta de nombre y una o dos líneas al cruzar la niebla, y otra al caer.
5. **Cinemática de después** de la victoria, antes de los resultados.
6. **Vínculo** (0 a 3): una línea nueva del Pokémon por capítulo cerrado, en la ventana de Phantump junto a su fila. Al cerrar el III, Phantump añade la suya, que lleva al despertar o a la evolución final.

### Datos

`STORY_QUESTS` en `src/data/story-quests.ts` guarda solo la estructura (cuadros y poses, plantas con fragmento, líneas por jefe); los textos son claves `story.<línea>.<capítulo>.*` en `es.json` y `en.json`. El progreso es el campo opcional `story` de la partida (capítulos cerrados por línea), saneado. Las reglas (qué capítulo toca, qué se abre, dónde cae un fragmento) viven en `src/core/story.ts`, puras. `tests/data/story-quests.test.ts` comprueba que toda Senda de la tabla está completa en los dos idiomas, sin rayas, con sus jefes y fragmentos en plantas válidas, así que llenar las otras siete queda vigilado.

Para añadir una Senda: un fichero `src/data/story/<línea>.ts` con su estructura, sus jefes (kit) y sus tres caminos, su entrada en `STORY_QUESTS` y en `src/data/story/bosses.ts`, el reto con `senda()` en `src/data/dungeons.ts`, sus cuadros nuevos en `src/adapters/story/` y sus textos. Las pruebas de herida, sombras, caminos y alcance se aplican solas; la de sus sombras necesita su fragmento `tests/sim/story-prove-<línea>.test.ts`.

## Las ocho Sendas

### Mimikyu: La Senda del Disfraz *(piloto, completa)*

Inspiración: el ser solitario que se esconde bajo un trapo con la forma del Pokémon que todos quieren, para que lo quieran a él; que de noche, ante un espejo, se cose el cuello roto; cuya cara verdadera hace daño a quien la ve (un sabio, un entrenador tras un golpe de viento); que vive donde no da el sol; que no olvida a quien le hizo daño. Aquí: antes del Eclipse se cosió el trapo para ir a la plaza; un golpe de viento lo levantó y un pequeño miró. Cuando llegó el Eclipse, todos se hicieron sombra; Mimikyu ya lo era.

Herida: **Mimikyu Sin Disfraz**, lo que Mimikyu sería si eligiera el rencor: un brazo negro demasiado largo que se acuerda de cada nombre (Fantasma y Hada, la hoja del disfraz roto). Desde esta versión usa el kit como las demás (`src/data/story/mimikyu.ts`). Cartas: Signo Garra Umbría «Costura Rota», Signo Golpe Fantasma «Nadie Mira», Signo Bola Sombra «Lo que Hay Debajo» (su fase 2), Signo Carantoña «Abrazo que Duele»; supervivencia Signo Disfraz Roto «No Me Mires»; última palabra «Ya Me Has Visto». Crece por capítulo: tres cartas en el I, cinco con la supervivencia en el II, seis con la última palabra en el III.

Las sombras no repiten especie con ninguna otra Senda (ni con las de la rama de los gacha) y los tipos de Mimikyu, Fantasma y Hada, alcanzan a todas al menos de forma neutra: Ditto se copia a Mimikyu (Fantasma y Hada), Jigglypuff cambia Normal por Fantasma, Noctowl sus alas por Fantasma, Pikachu es Eléctrico y Fantasma. Ninguna dispara Normal, Lucha ni Dragón, que no le harían nada.

- **I. El trapo** (Normal; camino de la Cripta, donde no da el sol): miedo a que lo vean. Baja contigo «por los materiales»; lo dice dos veces. Jefes: Ditto, *el que no tiene cara*, que se convierte en un Mimikyu perfecto, sin remiendos («a un charco no lo abraza nadie»), y Noctowl, *el sabio que no parpadea*, que ve en la oscuridad más negra (Mimikyu: «hubo un sabio que miró y no volvió a levantarse»). Fragmentos: el botón de ojo que nunca encontraba su sitio, la aguja doblada de coser de noche. Final: el cuello del disfraz se rompe, lo cose ante un espejo roto, y se da cuenta de que te diste la vuelta antes de que te lo pidiera.
- **II. La plaza** (Difícil; camino del Bosque, la senda comida por la hierba hasta la plaza vieja): querer que lo quieran. La plaza con sol y columpio, los abrazos al trapo, el viento. Jefes: Jigglypuff, *la canción que nadie esperó* (todos se dormían antes del final; Mimikyu se queda la última nota, la de la canción de la plaza), y Pikachu, *el que todos abrazan*, sentado en el columpio con las orejas y la sonrisa que Mimikyu se cosió, las de verdad. Fragmentos: la cinta roja que nadie ató a su columpio, el dibujo de tiza con un pequeño amarillo borrado de tanto tocarlo. La herida es «el viento que levanta el trapo». Final: el que miró no enfermó por lo que vio, sino de miedo; Mimikyu te ata la cinta a la bolsa.
- **III. Lo que hay debajo** (Pesadilla; camino de las Cuevas, lo más hondo): dejarse ver. Le cae bien tu sombra. Jefes: Polteageist, *la grieta que no se enseña*, una tetera que gira para que no se le vea la grieta y esconde debajo su sello («era de verdad, siempre lo fue»), y Hatterene, *la que no soporta lo que sientes* («sientes demasiado alto»; Mimikyu: «hoy no»). Fragmentos: el retal del primer disfraz, más gastado por dentro que por fuera; la lista bordada de los que miraron, sin tachar ninguno («No sé hacerles daño. No quiero aprender.»). Final: el disfraz cae y Mimikyu no lo recoge; lo que viste no se cuenta, se guarda. En el lago, Phantump nota que algo ha despertado sin que nadie se lo pida.

Antes (piloto de un solo camino) sus jefes eran Sableye y Aegislash en un trono con salida; los dos siguen en la Cripta, donde siempre estuvieron.

El texto completo está en `src/i18n/es.json` (`story.mimikyu.*`).

### Cubone: La Senda del Hueso *(completa)*

Inspiración: el pequeño que lleva el cráneo de su madre y llora dentro de él, de modo que el llanto suena como una canción; la luna llena que le recuerda su cara; la torre de los muertos donde un espíritu descansa al ser abrazado; el llanto que atrae a los carroñeros; la danza del hueso en llamas entre túmulos. Aquí: la noche del Eclipse su madre bajó a las cuevas a buscar luz para el lago y volvió su cráneo, en brazos de otros. Cubone pesca en el embarcadero del Lago Negro sin cebo y sin mirar el agua.

Herida: **Marowak Sin Lágrimas**, un Marowak de hueso y humo con un hueso que arde (Fuego y Fantasma), el duelo que dejó de llorar. Cartas: Signo Luna «Fases del Duelo», Signo Huesomerang «Lo que Vuelve», Signo Danza del Hueso «Fuego entre Túmulos», Signo Ataque Óseo «Nana Rota»; supervivencia Signo Cráneo Vacío «Que No Se Oiga»; última palabra «Luna Llena».

- **I. El casco** (Normal; camino del Pantano): llora de noche dentro del hueso para que no se oiga; baja contigo «porque ahí abajo no se ve la luna». Jefes: Haunter, *el que se ríe del llanto*, y Mandibuzz, *la que oye llorar* (las sombras no vuelan). Fragmentos: una espina tallada con forma de Magikarp; una piedra tibia por un lado. Final: no pesca para comer, pesca por si alguien sube del fondo; te deja sujetar la caña.
- **II. La que volvió** (Difícil; camino de las Cuevas): una sombra con la forma de su madre tararea entre túmulos. Jefes: Dusclops, *el que se lleva a los muertos dentro*, y Kangaskhan, *la madre del bolsillo vacío*, que quiere quedárselo. Fragmentos: el hueso de la nana de tres notas; el nudo de pesca que solo sabía hacer ella. La herida es «la sombra con su forma». Final: no era ella, era lo que Cubone guardaba de ella; la nana le sale entera por primera vez.
- **III. Lo que se lleva puesto** (Pesadilla; camino de la Cripta, la torre sin techo): sube a mirar la luna llena. Jefes: Bisharp, *el que guarda la escalera*, y Dusknoir, *el que guía a los muertos* («¿vienes a irte o a despedir?»). Fragmentos: dos huellas, la grande se acaba; medio hueso partido «para cuando no esté». Final: abraza al Marowak de humo y descansa; llora fuera del hueso, donde se oye; evoluciona a Marowak. Phantump: el hueso ya no esconde lágrimas, lleva un nombre.

### Litwick: La Senda de la Llama *(completa)*

Inspiración: la vela que se ofrece de guía a los perdidos y se alimenta de su vida; los niños llevados de la mano; las mansiones donde arden lámparas y no vive nadie; la lámpara de difuntos que no se apaga. Aquí: antes del Eclipse llevó de la mano a un niño perdido en las cuevas hasta su casa, comiendo un poco por el camino; el niño llegó con frío y no se le pasó nunca, y desde entonces Litwick enciende cada noche todas las lámparas de la casa grande vacía. Teme ser un trocito de lo que se bebió el sol.

Herida: **Chandelure de Llamas Ajenas**, un candelabro con todas las almas que pudo comerse (Fantasma y Fuego; sus llamas son almas, Fantasma, porque Absorbe Fuego se bebería el fuego de verdad). Cartas: Signo Fuego Fatuo «Sígueme», Signo Infortunio «La Mano del Niño», Signo Bola Sombra «Mil Nombres», Signo Maldición «Cera que Sube»; supervivencia Signo Sofoco «No Te Acerques»; última palabra «Apágame».

- **I. La vela que guía** (Normal; camino de las Cuevas): te pide que no te acerques demasiado. Jefes: Drifblim, *el que se lleva a los niños de la mano*, y Lanturn, *la otra luz*. Fragmentos: un cabo de vela mordido; un guante de niño sin pareja, con el índice chamuscado. Final: confiesa que tiene hambre cuando estás triste; se queda a un paso exacto toda la noche.
- **II. Lo que cuesta una luz** (Difícil; camino de la Cripta, la casa grande): la historia del niño. Jefes: Banette, *el juguete que nadie recogió* (la muñeca del niño), y Mismagius, *la que canta en el pasillo*, que quiere la casa encendida para siempre. Fragmentos: un farol apagado por dentro; el libro de visitas con un solo nombre. La herida tiene una llama con cara de niño, y Litwick la devuelve. Final: todas las lámparas se apagan; Litwick apaga su llama para que veas que aún te ve.
- **III. Arder sin quemar** (Pesadilla; camino del Pantano bajo el cielo rasgado): aprende a dar luz de su propia cera. Jefes: Muk, *el que se come lo que toca*, y Nihilego, *lo que bebe la luz*. Fragmentos: una gota de cera que cayó hacia abajo; una lámpara de difuntos que arde de su mecha. Final: evoluciona a Chandelure, «no te he quitado nada; puedes acercarte del todo». Phantump: ahora alumbra sin cobrar.

### Zorua: La Senda del Reflejo *(completa)*

Inspiración: el zorro que de miedo toma la forma de un niño callado y no la suelta cuando está solo; las ilusiones que protegen a los suyos; el camino que vuelve al mismo sitio; el rencor como una niebla blanca (Hisui). Aquí: la noche del Eclipse su manada cruzó el Bosque Brumoso por un camino que solo veían los suyos; Zorua se asustó, se hizo niño, y la manada pasó a su lado sin reconocerlo.

Herida: **Zoroark de Niebla Blanca**, el rencor del que se quedó atrás, con las caras de toda la manada (Fantasma). Cartas: Signo Tajo Umbrío «La Cara de Otro», Signo Juego Sucio «El que Se Quedó», Signo Pulso Noche «El Sendero que Vuelve», Signo Rencor Amargo «Niebla Blanca»; supervivencia Signo Ilusión «Nadie Se Fue»; última palabra «Soy Solo Yo».

- **I. La forma prestada** (Normal; camino de las Cuevas, agua quieta que devuelve caras): en la fuente de la aldea, el reflejo del niño callado es un zorro. Jefes: Kecleon, *el que también cambia de color*, y Gengar, *la sombra que te copia*. Fragmentos: una pluma que señala hacia donde no fue el camino; un charco con la cara de alguien grande. Final: «¿te importa que a veces sea otro?»; el niño de la fuente se ríe en voz alta.
- **II. El bosque que no contesta** (Difícil; camino del Bosque): el sendero vuelve al mismo árbol. Jefes: Mightyena, *el que guía la manada* («una manada no mira atrás»), y Decidueye, *el que vio pasar la manada*. Fragmentos: un mechón rojo en una zarza; la corteza llena de marcas, una por vuelta. Final: era Zorua quien volvía; fue el miedo, no fueron ellos; rompe él la ilusión para que lo veas.
- **III. Sin máscara** (Pesadilla; camino del Pantano, la niebla blanca): baja siendo solo él. Jefes: Houndoom, *el cazador de la niebla*, y Spiritomb, *ciento ocho rencores*. Fragmentos: la máscara de corteza del niño, gastada por dentro; una piedra del camino con una marca de garra que apunta a casa. Final: la manada de niebla se da la vuelta; su reflejo es grande y es el suyo; evoluciona a Zoroark. Phantump: se ha quedado con lo único que nunca le quitaron.

El texto completo está en `src/i18n/es.json` (`story.cubone.*`, `story.litwick.*`, `story.zorua.*`, `challenge.<línea>.*`).

### Abra: La Senda del Sueño

Inspiración: duerme casi todo el día y huye teletransportándose; la leyenda del niño que no controlaba su poder y despertó convertido en otra cosa; la cuchara doblada que concentra la mente; los dolores de cabeza que deforman lo que hay alrededor. Aquí: Abra soñó el Eclipse antes de que llegara y huyó en vez de avisar.

Jefes sugeridos: Lanturn (el falso amanecer del sueño), Nihilego (lo que entra en la cabeza) y **Abra Despierto**, el sueño que nunca dejó de tener, con mil cucharas doblándose a la vez.

- **I. Dormir**: Abra habla en sueños durante la partida. Fragmentos: una almohada de musgo con la forma de su cabeza; una cuchara de niño, doblada. Final: te pide que lo despiertes si grita.
- **II. Huir**: cada vez que algo asusta, desaparece y vuelve. Final: cuenta el sueño del Eclipse.
- **III. Quedarse**: no se teletransporta, aunque pueda. Evolución a Alakazam; Phantump: vio lo que vendría y esta vez no se fue.

### Piplup: La Senda del Lago Helado

Inspiración: demasiado orgulloso para aceptar comida de nadie; detesta que lo cuiden; saca pecho incluso al caerse. Aquí: quiso demostrar que cruzaba solo el lago helado y cayó por el hielo. Lo sacaron; no lo ha perdonado. Desde el Eclipse el lago ya no refleja el cielo.

Jefes sugeridos: Sableye (el brillo que se codicia), Lanturn (el agua oscura bajo el hielo) y **Piplup de Hielo Negro**, una corona de escarcha sobre un cuerpo que no deja que nadie lo toque.

- **I. No necesito ayuda**: rechaza cada baya que le ofreces. Fragmentos: una medalla de hielo derretida por un lado; una baya mordida y escondida. Final: acepta una, sin mirarte.
- **II. El hielo fino**: el recuerdo del lago cuando aún reflejaba el cielo. Final: admite que tuvo miedo.
- **III. Pedir la mano**: la pide. Evolución a Empoleon; Phantump: el que pide ayuda a tiempo es el que llega a rey.

### Shinx: La Senda de la Tormenta

Inspiración: los ojos dorados que ven a través de las paredes, para cazar y para buscar a los pequeños perdidos; el cansancio de ver demasiado, que lo hace dormir mucho; la manada al borde de la tormenta. Aquí: nació la noche del Eclipse, en una tormenta; sus chispas son su única luz en un mundo sin sol y le parecen muy pequeñas.

Jefes sugeridos: Lanturn (la luz que engaña), Salazzle (la niebla que se come las chispas) y **Shinx de la Tormenta Ciega**, ojos que lo ven todo y no pueden cerrarse.

- **I. Chispa**: enciende chispas en la oscuridad para ti. Fragmentos: una piedra quemada por un rayo, aún tibia; un mechón de pelo que chispea al tocarlo. Final: una chispa tuya y una suya, juntas.
- **II. El trueno que asustó**: una vez asustó a su madre con su propio trueno. Final: entiende que su luz también asusta, y que eso no la hace mala.
- **III. Ver en la oscuridad**: encuentra su propia luz, la que ve a través, y aprende a cerrar los ojos. Evolución a Luxray; Phantump: no necesita sol, ve igual.

### Axew: La Senda del Colmillo

Inspiración: colmillos que se rompen y vuelven a crecer más fuertes; las marcas en árboles y rocas; el regalo de un mayor para ayudar a crecer; la furia que se escapa sin control. Aquí: cayó por la barranca siguiendo a los mayores, que se fueron a luchar contra el Eclipse sin él, y se melló el colmillo.

Jefes sugeridos: Trevenant (el árbol viejo cuyas raíces lo sujetaron al caer), Decidueye y **Axew de Colmillo Roto**, la furia de no ser lo bastante grande.

- **I. El colmillo mellado**: esconde el colmillo roto al hablar. Fragmentos: la punta del colmillo, guardada en una hoja; marcas de garra en un árbol, demasiado altas para él. Final: te la enseña.
- **II. La barranca**: el sitio exacto de la caída. Final: Trevenant no lo atrapó, lo salvó.
- **III. Crecer**: deja de querer alcanzar a los mayores y elige su camino. Evolución a Haxorus; Phantump: el colmillo no volvió a crecer; creció él.

## Pendiente

- El texto, los jefes y la herida de Abra, Piplup, Shinx y Axew (en otra rama), según estos esquemas. Mientras no estén en `STORY_QUESTS`, sus retos se juegan como hasta ahora (cuatro plantas).
- Patrones nuevos de inspiración Touhou que el motor aún no tiene (cuchillos que se quedan quietos y luego caen, balas que se ven tarde, alas de fénix que renacen): las cartas actuales se hacen con los patrones demostrados; añadirlos pide su prueba de justicia en `src/sim/prove.ts`.
- Las sombras nuevas no están aún en el Santuario de los Juramentos ni en la Sima.
- Fondos propios por Senda (el piloto usa los genéricos).
- Cinemáticas en cooperativo (ahora: solo voz, fragmentos y jefes).
- Más de un ataque para los enemigos (otra tarea, futura).
