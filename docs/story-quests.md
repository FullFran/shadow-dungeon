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

El último jefe es una especie propia (`mimikyu-wound`, «Mimikyu Sin Disfraz»): la hoja del Pokémon con el filtro de corrupción del Eco del Eclipse y dibujada 1,7 veces más grande. Lucha con cartas de hechizo en el motor de siempre (`src/data/wound-cards.ts`), hechas con patrones que ya usan los guardianes (abanicos apuntados, anillos con hueco, espirales, una marca que estalla, una cortina con su calle libre, disparos desde las esquinas) y vestidas con los movimientos del Pokémon. Por nivel gana cartas, densidad y velocidad: dos cartas en Fácil, tres en Normal, cinco con una de supervivencia en Difícil, y seis con su última palabra en Pesadilla.

**Se puede ganar, demostrado**: `tests/sim/wound-prove.test.ts` busca en vivo, con el mismo demostrador de `npm run prove`, un camino sin golpes para cada carta de cada herida en cada nivel desde tres salidas distintas, con ventanas de castigo y el margen de daño del nivel, y el bot resuelve el combate entero en Pesadilla con tres semillas. Una herida nueva entra en la prueba solo por estar en los datos.

### Un camino por capítulo *(dueño, 26-10-2026: «los tres capítulos no pueden sentirse iguales»; «pon más jefes, que estos están muy quemados»)*

Desde Cubone, Litwick y Zorua, cada capítulo recorre **su propio camino**: siete plantas con el aspecto, la decoración y la música de otra mazmorra, y dos jefes intermedios propios. El camino del I es el reto mismo (también en Fácil, sin historia); en Difícil y Pesadilla el reto recorre el del II o el del III (`roadFor` en `src/data/dungeons.ts`; `challenge-<línea>-2` y `-3`, que al acabar cuentan como el reto: registros, misiones, logros y repetir). Todos los pares calculan el mismo camino a partir de la mazmorra y el nivel del anfitrión.

Los jefes intermedios son casi siempre **sombras nuevas**, Pokémon que encajan con el canon de la línea y con el capítulo, hechas jefe con el kit de `src/data/story/kit.ts`: la hoja del Pokémon (las que faltaban, bajadas con `tools/fetch-sprites.mjs` con sus animaciones propias), sus tipos (una sombra no vuela: un jefe con alas cambia Volador por Fantasma, para que la línea siempre pueda alcanzarlo), su sala con salida y tres cartas de firma. Un jefe viejo repite solo cuando la historia lo pide (Lanturn, «la otra luz» de Litwick; Nihilego, lo que bebe la luz; Decidueye, el único que vio pasar la manada de Zorua).

**Touhou por dentro.** Las cartas se llaman a la manera de Touhou, Signo Movimiento «Nombre», y cada jefe tiene su firma con patrones que ya se usan y están demostrados: abanicos apuntados, anillos con hueco, espirales que florecen, una marca que cae donde estabas, la cortina que camina, anillos cuyos huecos giran como las fases de una luna, dos muros que se cierran con una fila libre, torretas, y un abanico de medias lunas seguido de una hoja que barre alrededor del jefe (`blades`, el corte de medianoche de Aegislash). Una sombra juega 2 cartas en Fácil y Normal, 3 y la de **supervivencia** en Difícil, y además su **última palabra** en Pesadilla. La herida crece de capítulo en capítulo: 2 cartas en Fácil, 3 en el I (una forma menor, dibujada 1,35 veces), 5 en el II con su cuarta carta y la de supervivencia (1,55 veces) y 6 en el III con su última palabra (1,8 veces). La vida de cada jefe por nivel (`hpScale`) está ajustada para que toda carta cumpla su margen de muerte; un jefe puede repartirla entre sus cartas con pesos (`weights`: una carta con pocas aperturas se queda un trozo menor) y elegir la forma de su última palabra (`last`: la que gira, la apuntada o su marca) cuando el demostrador no encuentra aperturas cuerpo a cuerpo en la de siempre. `tests/sim/story-prove-<línea>.test.ts` demuestra cada carta de cada sombra en cada nivel desde tres salidas y el bot resuelve los combates de Pesadilla; la herida, en `tests/sim/wound-prove.test.ts`.

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

Para añadir una Senda: un fichero `src/data/story/<línea>.ts` con su estructura, sus jefes (kit) y sus tres caminos, su entrada en `STORY_QUESTS` y en `src/data/story/bosses.ts`, el reto con `senda()` en `src/data/dungeons.ts`, sus cuadros nuevos en `src/adapters/story/` y sus textos. Las pruebas de herida, sombras, caminos y alcance se aplican solas. (El piloto, Mimikyu, usa aún `sendaPlan` y `src/data/wound-cards.ts`.)

## Las ocho Sendas

### Mimikyu: La Senda del Disfraz *(piloto, completa)*

Inspiración: el ser solitario que se esconde bajo un trapo con la forma del Pokémon que todos quieren, para que lo quieran a él; que de noche, ante un espejo, se cose el cuello roto; cuya cara verdadera hace daño a quien la ve; que no olvida a quien le hizo daño. Aquí: antes del Eclipse se cosió el trapo para ir a la plaza; un golpe de viento lo levantó y un pequeño miró. Cuando llegó el Eclipse, todos se hicieron sombra; Mimikyu ya lo era.

Jefes: Sableye (los ojos de gema que miran), Aegislash (su juramento es que ante él nadie esconde nada; aquí es jefe intermedio, en un trono con salida) y Mimikyu Sin Disfraz, lo que Mimikyu sería si eligiera el rencor: un brazo negro demasiado largo que se acuerda de cada nombre.

- **I. El trapo** (Normal): miedo a que lo vean. Baja contigo «por los materiales»; lo dice dos veces. Fragmentos: el botón de ojo que nunca encontraba su sitio, la aguja doblada de coser de noche. Final: el cuello del disfraz se rompe, lo cose ante un espejo roto, y se da cuenta de que te diste la vuelta antes de que te lo pidiera.
- **II. La plaza** (Difícil): querer que lo quieran. La plaza con sol y columpio, los abrazos al trapo, el viento. Fragmentos: la cinta roja que nadie ató a su columpio, el dibujo de tiza con un pequeño amarillo borrado de tanto tocarlo. La herida es «el viento que levanta el trapo». Final: el que miró no enfermó por lo que vio, sino de miedo; Mimikyu te ata la cinta a la bolsa.
- **III. Lo que hay debajo** (Pesadilla): dejarse ver. Le cae bien tu sombra. Fragmentos: el retal del primer disfraz, más gastado por dentro que por fuera; la lista bordada de los que miraron, sin tachar ninguno («No sé hacerles daño. No quiero aprender.»). Final: el disfraz cae y Mimikyu no lo recoge; lo que viste no se cuenta, se guarda. En el lago, Phantump nota que algo ha despertado sin que nadie se lo pida.

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

### Abra: La Senda del Sueño *(completa)*

Inspiración: duerme casi todo el día y huye teletransportándose; la leyenda del niño que no controlaba su poder y despertó convertido en otra cosa; la cuchara doblada que concentra la mente; los dolores de cabeza que deforman lo que hay alrededor; los que comen sueños (Drowzee, Munna). Aquí: una semana antes del Eclipse lo soñó (un anillo rojo bebiéndose el sol, la plaza en silencio) y se teletransportó lejos en vez de avisar. Duerme para no verlo.

Herida: **Alakazam Desvelado**, lo que sería si no volviera a dormir: lo ve todo y no hace nada, con mil cucharas doblándose a la vez (Psíquico y Lucha). Cartas: Signo Kinético «Mil Cucharas», Signo Teletransporte «Nunca Estuve Aquí», Signo Premonición «Lo que Soñé», Signo Onda Certera «Despierta»; supervivencia Signo Paz Mental «Duérmete Ya»; última palabra «Te Vi Llegar». Las sombras de Abra son Fantasma: con su Psíquico, Abra apenas les haría nada.

- **I. Dormir** (Normal; camino de las Cuevas): baja contigo porque se lo pidió un sueño; habla dormido por el camino. Jefes: Munna, *la que come sueños bonitos*, y Drowzee, *el que come las pesadillas*, que le pide la más vieja («esa no se la doy a nadie»). Fragmentos: una almohada de musgo aún tibia, de alguien que se fue sin levantarse; una cuchara de niño doblada por el cuello, que nadie dobló con las manos. Final: duerme a tu lado sin desaparecer; en sueños dice algo que suena a «perdón».
- **II. Huir** (Difícil; camino de la Cripta): al evolucionar soñó que era un niño que doblaba cucharas y despertó con una en la mano; no sabe si fue él. Jefes: Mr. Mime, *el de las paredes que no se ven* (por una vez no puede irse, y no pasa nada malo), e Hypno, *el péndulo y el niño* («conocí a un niño que doblaba cucharas»). Fragmentos: el diario de sueños («anillo rojo, plaza vacía, siete días»; «no lo cuentes, no te creerán»); un zapato de niño con arena de un sitio lejano. Final: cuenta el sueño del Eclipse y por qué duerme; te da la cuchara para que la sujetes.
- **III. Quedarse** (Pesadilla; camino del Pantano, bajo el cielo roto): podría irse con un parpadeo y no se va. Jefes: Musharna, *el sueño que no acaba* («aquí nunca amanece»), y Nihilego, *lo que cayó del sueño*, que soñó siete noches seguidas. Fragmentos: la manta del pueblo, remendada por muchas manos; un reloj parado a la hora en que se apagó el sol, con las agujas dobladas hacia atrás. Final: la cuchara se rompe y no la recoge; evoluciona a Alakazam. Phantump: vio lo que venía y esta vez se quedó.

### Piplup: La Senda del Lago Helado *(completa)*

Inspiración: demasiado orgulloso para aceptar comida de nadie; detesta que lo cuiden; saca pecho incluso al caerse; la corona del emperador. Aquí: quiso cruzar solo el lago helado para que lo vieran, cayó por el hielo fino y lo sacó la vieja Empoleon del lago, que le dejó una baya al lado y se fue sin decir nada. Nunca se la comió. Tras el Eclipse el lago se heló negro; ella bajó a buscar el reflejo del cielo y no subió.

Herida: **Empoleon de Hielo Negro**, un rey de nada en un trono de hielo, con una corona de escarcha que le crece hacia dentro y nadie que lo toque (Hielo y Acero). Cartas: Signo Pico Taladro «Ni Una Baya», Signo Muro Helado «Celosía de Escarcha», Signo Hidrobomba «El Lago que No Refleja», Signo Ventisca «Corona de Escarcha»; supervivencia Signo Protección «No Me Toques»; última palabra «Ayúdame».

- **I. No necesito ayuda** (Normal; camino de la Cripta): rechaza cada baya. Jefes: Glalie, *la cara que no llora* («como yo; no me ha gustado nada verla»), y Weavile, *la que roba lo que brilla*, que le pide un «por favor» a cambio de la medalla. Fragmentos: una medalla de hielo derretida por un lado, «al más valiente del lago»; una baya mordida una vez y enterrada en la nieve. Final: se cae de pico, se levanta solo, y se come tu baya «porque estaba en el suelo».
- **II. El hielo fino** (Difícil; camino de las Cuevas): el lago que reflejaba el cielo, el invierno, el brillo de abajo. Jefes: Mamoswine, *el peso sobre el hielo* («pesa muchísimo y no se cae nunca; no es justo»), y la sombra de Lanturn, *el brillo que llamaba* desde el fondo. Fragmentos: una pluma de la corona de un Empoleon viejo; el trozo del primer hielo, con su grieta en estrella y un poco de cielo dentro. Final: cuenta quién lo sacó y por qué no se comió la baya; admite que tuvo miedo («no lo repitas»).
- **III. Pedir la mano** (Pesadilla; camino del Bosque, a orillas del lago): vigila el agujero en el hielo. Jefes: Froslass, *la que guarda a los ahogados* («no pidieron ayuda»), y Lapras, *el mar que lleva a los demás*. Fragmentos: la baya de la orilla, guardada y nunca comida; una corona de escarcha sin terminar para el Piplup más terco del mundo, el día que pidiera algo. Final: el hielo se rompe y esta vez pide la mano; sale Empoleon. En el lago se refleja, un instante, un trozo de cielo. Phantump: el que pide ayuda a tiempo es el que llega a rey.

### Shinx: La Senda de la Tormenta *(completa)*

Inspiración: los ojos dorados que ven a través de las paredes, para cazar y para buscar a los pequeños perdidos; el cansancio de ver demasiado; la manada al borde de la tormenta. Aquí: nació la noche del Eclipse, en mitad de una tormenta; sus chispas son su única luz y le parecen muy pequeñas. Una noche asustó a su madre con su propio trueno. Tras el Eclipse ella salió a buscar a todos los perdidos con los ojos abiertos día y noche, y no volvió.

Herida: **Luxray Sin Párpados**, unos ojos que lo ven todo y no pueden cerrarse (Eléctrico y Agua, la tormenta). Cartas: Signo Colmillo Rayo «Te Veo», Signo Voltio Cruel «A Través del Muro», Signo Rayo «Rejilla de la Tormenta», Signo Trueno «La Noche que Nací»; supervivencia Signo Destello «No Puedo Cerrarlos»; última palabra «Ciérralos Tú». Las sombras eléctricas de Shinx son Fantasma: sus chispas no les harían nada.

- **I. Chispa** (Normal; camino del Pantano en tormenta): te alumbra «lo que le salga». Jefes: Ampharos, *la luz del faro* («la suya es más grande; la mía se enciende cuando yo quiero»), y Manectric, *el que se ríe de las chispas* («se peina con electricidad; se nota»). Fragmentos: la piedra partida por un rayo donde alguien pequeño esperó un día que no llegó; un mechón de Luxray enganchado en una zarza. Final: tu llama y su chispa se tocan y se ve la cueva entera; se duerme apoyado en tu pierna.
- **II. El trueno que asustó** (Difícil; camino de las Cuevas): se traga los truenos («saben a pila»). Jefes: Absol, *el que avisa y al que culpan* («nos parecemos»), y Electivire, *el trueno que asusta*. Fragmentos: una huella grande que no se mueve junto a una pequeña que salta atrás; un círculo de hierba quemada con el centro verde. Final: suelta el trueno; no te apartas; su luz también asusta, y eso no la hace mala.
- **III. Ver en la oscuridad** (Pesadilla; camino de la Cripta a oscuras): ya ve a través de los muros. Jefes: Umbreon, *la luz sin sol*, y Nihilego, *la noche del nacimiento*. Fragmentos: el collar de la manada con una chispa dentro; una venda oscura que alguien no llegó a ponerse para poder dormir. Final: cierra los ojos porque quiere; evoluciona a Luxray, con luz propia; mira una sola vez hacia el pueblo y te ve. Phantump: no necesita sol, y sabe cuándo no mirar.

### Axew: La Senda del Colmillo *(completa)*

Inspiración: colmillos que se rompen y vuelven a crecer más fuertes; las marcas en árboles y rocas; los colmillos que servían de cuchillos de cocina; el regalo de un mayor; la furia que se escapa. Aquí: la noche del Eclipse los mayores bajaron por la barranca a luchar contra lo que se bebía el sol y no esperaron a Axew; los siguió por el borde mojado, cayó y se melló el colmillo. Despertó arriba, solo: las raíces de Trevenant lo habían subido a pulso y se habían roto.

Herida: **Haxorus de Colmillos Rotos**, la rabia de no ser lo bastante grande: golpea la pared cada vez más arriba hasta romperse los colmillos, que le vuelven a crecer torcidos (Dragón). Cartas: Signo Tijera X «Colmillos en Media Luna», Signo Garra Dragón «Marcas Demasiado Altas», Signo Enfado «Rompe y Vuelve a Crecer», Signo Guillotina «La Barranca»; supervivencia Signo Furia Dragón «Todavía No»; última palabra «Espérame».

- **I. El colmillo mellado** (Normal; camino del Bosque): habla con la boca medio cerrada. Jefes: Druddigon, *el matón de la barranca*, con todos los colmillos enteros, y Bisharp, *el señor de las cuchillas* («vuelve a casa, pequeño»; «¡eso dijeron ellos!»), sombra sin su Acero. Fragmentos: la punta del colmillo envuelta en una hoja; tres marcas altísimas y cien pequeñas que no llegaron. Final: te enseña el colmillo mellado («¿es feo? No contestes. Sí, contesta»).
- **II. La barranca** (Difícil; camino de las Cuevas): el sitio de la caída. Jefes: Trevenant, *las raíces que no soltaron*, y Garchomp, *el tiburón de la barranca*, rápido como corrían los mayores. Fragmentos: una raíz partida por el esfuerzo, con escamas verdes; la piedra del borde con un arañazo muy corto. Final: Trevenant no lo atrapó, lo salvó; le devuelve la punta de su colmillo.
- **III. Crecer** (Pesadilla; camino de la Cripta, bajo los braseros): ha dejado de saltar. Jefes: Salamence, *el que quería alas* («duele, pero funciona»), y Dragonite, *el mayor que vuelve a casa*, el único que encontró el camino de vuelta. Fragmentos: el colmillo de un mayor con muescas de cocina; unas huellas grandes que se dan la vuelta a mirar al pequeño. Final: el colmillo crece hacia la luz y sale Haxorus; hace una marca baja «para el siguiente». Phantump: el colmillo no volvió a crecer igual; creció él.

El texto completo está en `src/i18n/es.json` (`story.abra.*`, `story.piplup.*`, `story.shinx.*`, `story.axew.*`, `challenge.<línea>.*`). Las sombras nuevas de estas cuatro líneas: Munna, Drowzee, Mr. Mime, Hypno, Musharna, Glalie, Weavile, Mamoswine, Lanturn (sombra), Froslass, Lapras, Ampharos, Manectric, Absol, Electivire, Umbreon, Druddigon, Bisharp (sombra), Garchomp, Salamence y Dragonite; repiten Nihilego (Abra III, Shinx III) y Trevenant (Axew II) porque la historia los pide, demostrados en esos caminos por `tests/sim/story-prove-reused.test.ts`.

## Pendiente

- Mimikyu aún recorre el mismo camino en sus tres capítulos con Sableye y Aegislash: pasarlo a caminos y sombras propios es decisión del dueño (su texto nombra a esos jefes).
- Patrones nuevos de inspiración Touhou que el motor aún no tiene (cuchillos que se quedan quietos y luego caen, balas que se ven tarde, alas de fénix que renacen): las cartas actuales se hacen con los patrones demostrados; añadirlos pide su prueba de justicia en `src/sim/prove.ts`.
- Las sombras nuevas no están aún en el Santuario de los Juramentos ni en la Sima.
- Fondos propios por Senda (el piloto usa los genéricos).
- Cinemáticas en cooperativo (ahora: solo voz, fragmentos y jefes).
- Más de un ataque para los enemigos (otra tarea, futura).
