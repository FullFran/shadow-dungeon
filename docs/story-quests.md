# Sendas: las misiones de historia de cada Pokémon

*(provisional; diseño del 26-10-2026, piloto: Mimikyu)*

## Por qué

Tras jugar el desafío de Mimikyu, el dueño: «no estuvo tan épica. Deberían tener lore del Pokémon, con sus traumitas, historias y demás, y a lo mejor alguna cinemática, y que se sienta cercano, que le cojas cariño al bicho, como en Genshin pero con fórmula souls».

Una **Senda** convierte la mazmorra reto de cada línea en una historia en tres capítulos. El reto ya existe (`CHALLENGES` en `src/data/dungeons.ts`: tres plantas generadas y un jefe en la cuarta, materiales por nivel), así que la Senda no añade mazmorras: le pone voz, recuerdos y un final a lo que ya se juega.

## Tono

- **Souls**: melancólico, indirecto. Las cosas se cuentan por los objetos y los sitios, con pocas palabras, y nada se explica dos veces. Lo importante se insinúa; lo que se ve debajo del trapo no se describe nunca.
- **Cercanía de Genshin**: el Pokémon habla contigo. Tiene manías, calor, vergüenza y a veces gracia. Las mejores líneas son pequeñas: un botón, una canción a medias, una vela que te pide que sujetes.
- Castellano peninsular, frases cortas, sin rayas (ni para los diálogos: la voz del Pokémon va sin marca o entre comillas latinas). Cada línea tiene su traducción inglesa.
- Juego de fans: las heridas se inspiran en el canon pero se adaptan a este mundo (el Eclipse Carmesí, los juramentos de los guardianes, las sombras que vuelven de las mazmorras, la sombra que bajó contigo). Nada de texto oficial copiado.

## Estructura

Cada Senda tiene tres capítulos, uno por nivel de material, para que la historia culmine con la evolución final (o el despertar de Mimikyu), que pide materiales de Pesadilla:

| Capítulo | Nivel | Se abre |
|---|---|---|
| I | Normal | siempre (con la línea en tu colección) |
| II | Difícil | al cerrar el I |
| III | Pesadilla | al cerrar el II |

En Fácil el reto se juega sin Senda (no paga materiales). Si se entra en Difícil sin haber cerrado el I, el reto se juega igual, pero sin capítulo: la ventana de desafíos avisa de qué capítulo falta. Un capítulo cerrado se puede volver a jugar (su historia sale otra vez, y se puede saltar).

Cada capítulo tiene:

1. **Cinemática de antes** (2 a 5 cuadros): el motor de las cinemáticas de guardián y del prólogo (`src/app/prologue.ts`), cuadros quietos con el sprite del Pokémon en una pose (quieto, herido, caído, y en Mimikyu el disfraz roto) y fondos sencillos (el trapo, una vela, la plaza de antes del Eclipse, el anillo rojo). Una línea por cuadro. Se salta como el prólogo. Solo en solitario: una partida compartida nunca se para.
2. **Voz interior** durante la partida, en el registro de mensajes, en tres momentos: al llegar (planta 1), a mitad (al bajar a la planta 3) y la primera vez que los PS bajan del 35 %.
3. **Fragmentos de memoria**: un objeto que brilla en una planta (la 2 en el piloto), en la sala más lejana de la entrada. Al pisarlo se abre una tarjeta al estilo de las descripciones de objetos de los souls: un nombre y un párrafo corto que cuenta un trozo del pasado. En solitario la partida se para mientras se lee.
4. **El jefe como figura de la herida**: el jefe del reto (el mismo en los tres niveles) cambia de nombre en cada capítulo, y dice una o dos líneas antes y después. En una Senda, la cinemática de guardián se cambia por estas líneas y su tarjeta de nombre (no se duplica la historia del guardián).
5. **Cinemática de después** de la victoria, que cierra el capítulo, antes de la pantalla de resultados.
6. **Vínculo** (0 a 3, uno por capítulo cerrado): una línea nueva del Pokémon por capítulo, que se ve en la ventana de Phantump junto a su fila. Al cerrar el III, Phantump dice además una línea que reconoce el vínculo y lleva al despertar o la evolución final.

### Datos

Todo es de datos para que las otras siete Sendas se llenen solo con texto: `STORY_QUESTS` en `src/data/story-quests.ts` (por línea: tres capítulos con sus cuadros de antes y después, los fragmentos por planta y cuántas líneas tiene el jefe) y las claves `story.<línea>.<capítulo>.*` en `es.json` y `en.json`. Un test comprueba que toda Senda presente en la tabla está completa en los dos idiomas.

El progreso es un campo opcional de la partida guardada, `story` (capítulos cerrados por línea, 0 a 3), saneado como los demás. Las reglas (qué capítulo toca, qué se abre) viven en `src/core/story.ts`, puras.

## Las ocho Sendas

Cada una se ata a la historia grande: el Eclipse Carmesí que dejó hueco al sol, las sombras de los que volvieron de las mazmorras, los guardianes y sus juramentos olvidados, y tu propia sombra, la que bajó contigo cuando la voz te preguntó si la oías.

### Mimikyu: La Senda del Disfraz *(piloto, completa)*

Jefe: Aegislash, en el trono de la Cripta. Su juramento es que ante él nadie esconde nada: es la mirada que Mimikyu teme.

Herida: el disfraz. Antes del Eclipse, Mimikyu se cosió un trapo con la forma del Pokémon al que todos querían, para que lo quisieran a él. Una tarde se soltó una costura y alguien miró. Desde el Eclipse todos tienen algo debajo, una sombra; Mimikyu ya la tenía.

- **I. El trapo** (Normal): miedo a que lo vean. Baja contigo «por el material». Fragmento: el botón de ojo que nunca encontraba su sitio. El jefe: *El que todo lo ve*. Final: el disfraz se rompe por el cuello y tú no miras; Mimikyu se da cuenta.
- **II. La plaza** (Difícil): querer que lo quieran. La plaza con sol y el columpio, los pequeños que abrazaban el trapo, la costura suelta. Fragmento: la cinta roja que nadie ató a su columpio. El jefe: *El espejo del rey*. Final: el que miró no enfermó por lo que vio, sino de miedo; Mimikyu te ata la cinta a la bolsa.
- **III. Lo que hay debajo** (Pesadilla): dejarse ver. Cuando llegó el Eclipse, Mimikyu no se hizo sombra: ya lo era. Le cae bien tu sombra. Fragmento: el retal del primer disfraz, más gastado por dentro que por fuera. El jefe: *Lo que hay debajo*. Final: el disfraz cae y Mimikyu no lo recoge; lo que viste no se cuenta, se guarda. Phantump, en el lago, nota que algo ha despertado sin que nadie lo obligue.

El texto completo está en `src/i18n/es.json` (`story.mimikyu.*`).

### Cubone: La Senda del Hueso

Jefe: Nihilego, en la grieta del Pantano. Algo que se agarra y no suelta: el duelo.

Herida: el cráneo de su madre. Tras el Eclipse, su madre bajó a las mazmorras a buscar luz para el lago y no volvió. O volvió, pero como sombra. Cubone pesca en el embarcadero de la Aldea del Lago Negro y no mira el agua.

- **I. El casco**: Cubone llora de noche dentro del hueso para que no se oiga. Cuadros: el embarcadero, el lago sin cielo, el hueso brillando a la luz de la luna roja. Fragmento: una espina de pescado tallada, un juguete. Final: te deja llevar su caña un rato.
- **II. La que volvió**: entre las sombras de la mazmorra, una tiene su forma. Cubone duda en golpear. Fragmento: una nana grabada en un hueso pequeño. El jefe: *Lo que no suelta*. Final: no era ella; Cubone no sabe si eso le alivia.
- **III. Lo que se lleva puesto**: el hueso deja de ser una máscara para llorar y pasa a ser un nombre que se lleva. Final: Phantump: «Ya no llora bajo el hueso. Lo lleva como quien lleva un nombre.» Lleva a la evolución a Marowak.

### Litwick: La Senda de la Llama

Jefe: Dhelmise, en el pecio de las Cuevas Anegadas. Un ancla de los que se ahogaron siguiendo una luz.

Herida: su llama guía a los perdidos y se alimenta de ellos. En el pueblo guarda la llama que guía a los perdidos; nadie le pregunta de qué come.

- **I. La vela que guía**: Litwick te lleva por la cueva y te pide que no te acerques demasiado. Fragmento: un cabo de vela con marcas de dientes. Final: confiesa que tiene hambre cuando estás triste.
- **II. Lo que cuesta una luz**: la tripulación del pecio siguió una luz como la suya. El jefe: *El ancla de los que siguieron*. Fragmento: un farol de barco apagado por dentro. Final: Litwick teme ser lo mismo que se bebió el sol.
- **III. Arder sin quemar**: aprende a dar luz de su propia cera. Final y evolución a Chandelure; Phantump: «Ahora alumbra sin cobrar. Eso no lo hace cualquier llama.»

### Zorua: La Senda del Reflejo

Jefe: Decidueye, en la percha del Bosque Brumoso. El arquero que nunca falla ve a través de las ilusiones.

Herida: cuando llegó el Eclipse, su manada cruzó el bosque y lo dejó atrás. Zorua toma la forma de los que se fueron para no estar solo.

- **I. La forma prestada**: Zorua se te aparece con tu propia cara para hacerte reír. Fragmento: una pluma de Decidueye clavada en un tronco, a la altura de un Zorua. Final: te pregunta si te importa que a veces sea otro.
- **II. El bosque que no contesta**: llama a los suyos con voces que no son la suya. El jefe: *El ojo que no se engaña*. Final: una flecha le roza y no rompe la ilusión: la rompe él, para que lo veas.
- **III. Sin máscara**: confía en que te quedes aunque sea solo él. Evolución a Zoroark; Phantump: «Ya no se disfraza de los que se fueron. Se disfraza de él mismo, que es más difícil.»

### Abra: La Senda del Sueño

Jefe: Lanturn, en la gruta de las Cuevas. Su luz es el falso amanecer de un sueño.

Herida: duerme casi todo el día y huye teletransportándose. Soñó el Eclipse antes de que llegara, y huyó en vez de avisar.

- **I. Dormir**: Abra habla en sueños durante la partida. Fragmento: una almohada de musgo con la forma de su cabeza. Final: te pide que lo despiertes si grita.
- **II. Huir**: en la gruta, cada vez que algo asusta, Abra desaparece y vuelve. El jefe: *El amanecer que no llega*. Final: cuenta el sueño del Eclipse.
- **III. Quedarse**: no se teletransporta, aunque pueda. Evolución a Alakazam; Phantump: «Vio lo que vendría y esta vez no se fue. Eso pesa más que ver.»

### Piplup: La Senda del Lago Helado

Jefe: Sableye, en la cámara del tesoro de la Cripta. El brillo que se codicia.

Herida: el orgullo. Quiso demostrar que podía cruzar solo el lago helado y cayó por el hielo. Lo sacaron; no lo ha perdonado.

- **I. No necesito ayuda**: Piplup rechaza cada baya que le ofreces (en la voz interior). Fragmento: una medalla de hielo, derretida por un lado. Final: acepta una, sin mirarte.
- **II. El hielo fino**: el recuerdo del lago antes de que dejara de reflejar el cielo. El jefe: *El que guarda lo que brilla*. Final: admite que tuvo miedo.
- **III. Pedir la mano**: la pide. Evolución a Empoleon; Phantump: «El que pide ayuda a tiempo es el que llega a rey.»

### Shinx: La Senda de la Tormenta

Jefe: Salazzle, en la guarida del Pantano. La niebla que se come las chispas.

Herida: nació la noche del Eclipse, en una tormenta. Sus chispas son su única luz en un mundo sin sol, y le parecen muy pequeñas.

- **I. Chispa**: Shinx enciende chispas en la oscuridad para ti. Fragmento: una piedra quemada por un rayo, aún tibia. Final: una chispa tuya y una suya, juntas.
- **II. El trueno que asustó**: una vez asustó a su madre con su propio trueno. El jefe: *La que apaga*. Final: entiende que su luz también asusta, y que eso no la hace mala.
- **III. Ver en la oscuridad**: encuentra su propia luz, la que ve a través. Evolución a Luxray; Phantump: «No necesita sol. Ve igual. Ahora lo sabe.»

### Axew: La Senda del Colmillo

Jefe: Trevenant, en el claro hueco del Bosque. El árbol viejo cuyas raíces lo sujetaron al caer.

Herida: el colmillo mellado. Cayó por la barranca siguiendo a los mayores, que se fueron a luchar contra el Eclipse sin él.

- **I. El colmillo mellado**: Axew esconde el colmillo roto al hablar. Fragmento: la punta del colmillo, guardada en una hoja. Final: te la enseña.
- **II. La barranca**: el sitio exacto de la caída. El jefe: *Las raíces que sujetan*. Final: Trevenant no lo atrapó: lo salvó.
- **III. Crecer**: deja de querer alcanzar a los mayores y elige su camino. Evolución a Haxorus; Phantump: «El colmillo no volvió a crecer. Creció él.»

## Pendiente

- Llenar el texto de las otras siete Sendas (Cubone, Litwick, Zorua, Abra, Piplup, Shinx, Axew) siguiendo estos esquemas: solo datos y textos, sin código nuevo. Mientras no estén en `STORY_QUESTS`, sus retos se juegan como hasta ahora.
- Fondos propios por Senda (el piloto usa los genéricos: trapo, vela, plaza, eclipse, oscuridad, lago de Phantump).
- Cinemática en cooperativo (ahora: solo la voz interior, los fragmentos y las líneas del jefe).
