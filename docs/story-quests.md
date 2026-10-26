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

Para añadir una Senda: una entrada en `STORY_QUESTS`, sus textos, el `sendaPlan` de su reto (dos jefes intermedios y su sala de herida), su especie de herida con sus cartas y su sala en `src/data/rooms.ts`. La prueba de la herida y la de alcance se aplican solas.

## Las ocho Sendas

### Mimikyu: La Senda del Disfraz *(piloto, completa)*

Inspiración: el ser solitario que se esconde bajo un trapo con la forma del Pokémon que todos quieren, para que lo quieran a él; que de noche, ante un espejo, se cose el cuello roto; cuya cara verdadera hace daño a quien la ve; que no olvida a quien le hizo daño. Aquí: antes del Eclipse se cosió el trapo para ir a la plaza; un golpe de viento lo levantó y un pequeño miró. Cuando llegó el Eclipse, todos se hicieron sombra; Mimikyu ya lo era.

Jefes: Sableye (los ojos de gema que miran), Aegislash (su juramento es que ante él nadie esconde nada; aquí es jefe intermedio, en un trono con salida) y Mimikyu Sin Disfraz, lo que Mimikyu sería si eligiera el rencor: un brazo negro demasiado largo que se acuerda de cada nombre.

- **I. El trapo** (Normal): miedo a que lo vean. Baja contigo «por los materiales»; lo dice dos veces. Fragmentos: el botón de ojo que nunca encontraba su sitio, la aguja doblada de coser de noche. Final: el cuello del disfraz se rompe, lo cose ante un espejo roto, y se da cuenta de que te diste la vuelta antes de que te lo pidiera.
- **II. La plaza** (Difícil): querer que lo quieran. La plaza con sol y columpio, los abrazos al trapo, el viento. Fragmentos: la cinta roja que nadie ató a su columpio, el dibujo de tiza con un pequeño amarillo borrado de tanto tocarlo. La herida es «el viento que levanta el trapo». Final: el que miró no enfermó por lo que vio, sino de miedo; Mimikyu te ata la cinta a la bolsa.
- **III. Lo que hay debajo** (Pesadilla): dejarse ver. Le cae bien tu sombra. Fragmentos: el retal del primer disfraz, más gastado por dentro que por fuera; la lista bordada de los que miraron, sin tachar ninguno («No sé hacerles daño. No quiero aprender.»). Final: el disfraz cae y Mimikyu no lo recoge; lo que viste no se cuenta, se guarda. En el lago, Phantump nota que algo ha despertado sin que nadie se lo pida.

El texto completo está en `src/i18n/es.json` (`story.mimikyu.*`).

### Cubone: La Senda del Hueso

Inspiración: el pequeño que lleva el cráneo de su madre y llora dentro de él, de modo que el llanto suena como una canción triste; la luna llena que le recuerda su cara; la torre de los muertos donde un espíritu protector por fin descansa al ser abrazado; la danza del hueso en llamas entre túmulos. Aquí: tras el Eclipse, su madre bajó a las mazmorras a buscar luz para el lago y volvió como sombra. Cubone pesca en el embarcadero del Lago Negro y no mira el agua, porque el agua ya no refleja nada.

Jefes sugeridos: Trevenant (el árbol que guarda a los muertos), Dhelmise (lo que se hunde y no vuelve) y **Cubone Sin Luna**, un hueso enorme con una llama que no se apaga: el duelo que no se suelta.

- **I. El casco**: Cubone llora de noche dentro del hueso para que no se oiga. Cuadros: el embarcadero, el lago sin cielo, la luna roja en las cuencas del cráneo. Fragmentos: una espina de pez tallada como juguete; una piedra lisa con la forma de una mano grande. Final: te deja sujetar su caña un rato.
- **II. La que volvió**: entre las sombras hay una con la forma de su madre. Cubone duda. Fragmentos: una nana grabada en un hueso pequeño; un nudo de pesca que solo ella sabía hacer. Final: no era ella; Cubone no sabe si eso le alivia.
- **III. Lo que se lleva puesto**: en una torre sin techo, el hueso deja de ser una máscara para llorar y pasa a ser un nombre que se lleva. Abraza a la sombra, y la sombra descansa. Phantump: el hueso ya no esconde lágrimas, lleva un nombre. Evolución a Marowak.

### Litwick: La Senda de la Llama

Inspiración: la vela que se ofrece de guía a los perdidos y se alimenta de su vida; los niños llevados de la mano hacia el otro lado; las mansiones donde arden lámparas y no vive nadie; la llama de los funerales que no se apaga. Aquí: en el pueblo guarda la llama que guía a los perdidos. Nadie le pregunta de qué come. Teme ser lo mismo que se bebió el sol.

Jefes sugeridos: Lanturn (otra luz que atrae a los que se pierden), Dhelmise (el ancla de los que siguieron una luz hasta el fondo) y **Litwick Sin Mecha**, una lámpara colgante enorme, llena de llamas que no son suyas.

- **I. La vela que guía**: te pide que no te acerques demasiado. Fragmentos: un cabo de vela con marcas de dientes pequeños; un guante de niño, sin pareja. Final: confiesa que tiene hambre cuando estás triste.
- **II. Lo que cuesta una luz**: la tripulación del pecio siguió una luz como la suya. Fragmentos: un farol apagado por dentro; un registro de nombres que termina a mitad. Final: Litwick apaga su llama un momento para que veas que aún te ve.
- **III. Arder sin quemar**: aprende a dar luz de su propia cera. Evolución a Chandelure; Phantump: ahora alumbra sin cobrar.

### Zorua: La Senda del Reflejo

Inspiración: el zorro que, de miedo, toma la forma de un niño callado y no la suelta cuando está solo; las ilusiones que protegen a los suyos; los paisajes falsos; el camino del bosque que siempre vuelve al mismo sitio; el rencor como una niebla blanca. Aquí: cuando llegó el Eclipse, su manada cruzó el Bosque Brumoso y lo dejó atrás; Zorua lleva la cara de los que se fueron para no estar solo.

Jefes sugeridos: Trevenant (el bosque que no deja salir), Decidueye (el arquero que nunca falla ve a través de las ilusiones) y **Zorua de Niebla Blanca**, el rencor del abandono hecho zorro.

- **I. La forma prestada**: se te aparece con tu propia cara para hacerte reír. Fragmentos: una pluma clavada en un tronco a la altura de un Zorua; un reflejo en un charco que no coincide. Final: te pregunta si te importa que a veces sea otro.
- **II. El bosque que no contesta**: llama a los suyos con voces que no son la suya; el camino vuelve siempre al mismo árbol. Final: una flecha le roza y no rompe la ilusión; la rompe él, para que lo veas.
- **III. Sin máscara**: confía en que te quedes aunque sea solo él. Evolución a Zoroark; Phantump: ya no se disfraza de los que se fueron.

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

- El texto, los jefes intermedios y la herida (especie, cartas, sala) de las otras siete Sendas (Cubone, Litwick, Zorua, Abra, Piplup, Shinx, Axew), según estos esquemas. Mientras no estén en `STORY_QUESTS`, sus retos se juegan como hasta ahora (cuatro plantas).
- Fondos propios por Senda (el piloto usa los genéricos).
- Cinemáticas en cooperativo (ahora: solo voz, fragmentos y jefes).
- Más de un ataque para los enemigos (otra tarea, futura).
