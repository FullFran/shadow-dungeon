# Gacha sin dinero y bots que esquivan danmaku

Nota de investigación y propuesta, no decisión cerrada. Escrita el 2026-10-26. Responde a la pregunta abierta 3 de la GDD (§14: "cómo es el gacha") y al límite conocido del arnés de balance (§9: los bots no saben esquivar patrones de balas, así que la tasa de victorias en los niveles altos no mide nada).

Etiquetas, las mismas que en `docs/souls-difficulty-research.md`:

- **[V]** comprobado en la fuente enlazada (o en el repositorio, o con un script ejecutado) en la fecha indicada.
- **[C]** dato de comunidad o de prensa, sin documento oficial; coherente entre varias fuentes.
- **[U]** de memoria o sin comprobar en esta sesión.
- **[I]** inferencia o propuesta de diseño mía.

Todas las URL se consultaron el 2026-10-26 salvo que se diga otra cosa. Varias wikis de juegos devolvieron error (Genshin en Fandom: HTTP 402; wiki.gg: 404), así que algunos números de gacha comerciales quedan en [C].

---

# Parte A. Un gacha que no te quiere sacar nada

## A0. De dónde partimos (repositorio)

- **[V]** GDD §5: los Pokémon se consiguen con un gacha; las tiradas se pagan solo con lo que ganas jugando, "nunca con dinero real, ni ahora ni después". No hay reclutamiento en la mazmorra.
- **[V]** GDD §11: las Pokémonedas se ganan por planta, enemigo, guardián y minuto (2 P por minuto), multiplicadas por la dificultad (×1 a ×2,2). Una victoria completa en la Cripta en Fácil da unas 165 P. Si caes te quedas el 75 %. Comprar todas las mejoras permanentes cuesta unas 5000 P (unas 30 victorias).
- **[V]** GDD §4 "El kit de cada Pokémon": cuatro ranuras (rápida, fuerte, potenciación, área) más una pasiva; "conseguir uno nuevo en el gacha cambia cómo juegas". Desbloquear movimientos del repertorio "puede ser una mejora que se compra" (por decidir).
- **[V]** `docs/legal-risk-notes.md`, recomendación 1: cero dinero en ningún sitio, ni donaciones ni funciones de pago, tampoco "solo para suscriptores". Esto es también la defensa principal frente a Nintendo (PokéRogue declara "zero monetization" a propósito).
- **[V]** El guardado es local (`mazmorra-sombria.save`, con `migrate()` y `sanitize()`); las Pokémonedas no viajan por la red ni en la partida compartida.
- **[V]** La GDD (§3, "El mundo") pone el puesto del gacha ("Próximamente") en la Aldea del Lago Negro, con **Phantump** al lado de un puesto vacío. El encargo habla de un puesto de **Mimikyu**. Queda como pregunta abierta (ver al final).

## A1. Qué hacen los gachas comerciales

### Tasas y pity

| Juego | Tasa base de la rareza máxima | Pity (garantía) | Fuente |
|---|---|---|---|
| Genshin Impact (personajes) | 0,6 % por tirada | Garantía en la 90; "soft pity" desde la 74 (la tasa sube unos 6 puntos por tirada a partir de la 73). El 5★ es el destacado al 50 % y, si pierdes, el siguiente está garantizado; desde la versión 5.0 un sistema llamado "Capturing Radiance" corrige rachas de pérdidas (las guías no se ponen de acuerdo en si queda en 50/50 o 55/45). | [C] [Sportskeeda](https://www.sportskeeda.com/esports/genshin-impact-pity-soft-pity-systems-explained), [LaPS4](https://www.laps4.com/preguntas-y-respuestas/que-es-genshin-soft-pity), [Sportskeeda, armas](https://www.sportskeeda.com/esports/genshin-impact-standard-banner-weapons-banner-pity-explained). El soft pity **no está publicado por HoYoverse**: lo dedujo la comunidad a partir de registros de tiradas. |
| Genshin (armas) | (no comprobado) | Garantía en la 80; soft pity hacia la 63–65 | [C] mismas fuentes |
| Honkai: Star Rail | 0,6 % [U] (no salió en las fuentes) | Garantía en la 90 para personajes; conos de luz en la 80 con 75/25 a favor del destacado | [C] [Siliconera](https://www.siliconera.com/heres-how-to-calculate-pity-in-honkai-star-rail/), [PC Invasion](https://www.pcinvasion.com/?p=380310) |
| Arknights | 6★: 2 %; 5★: 8 %; 4★: 50 %; 3★: 40 % | Tras 50 tiradas sin 6★ la tasa sube 2 puntos por tirada (4 % en la 51 … 100 % en la 99). Tasa efectiva ≈ 3 % (1 de cada 33). Al menos un 5★ en cada tanda de 10 (según la wiki; la "Newbie Pool" garantiza 6★ y 5★ en sus 10 primeras). | [V] [Arknights wiki.gg: Headhunting](https://arknights.wiki.gg/wiki/Headhunting) |
| Pokémon Masters EX | Destacado de "EX Master Fair": 1 %; otros 5★ destacados 2 %; resto de 5★ 12 % | Sin pity de tasa: es un sistema de canje (ver "spark") | [V] [Serebii](https://serebii.net/pokemonmasters/syncpairscout.shtml), [Bulbagarden](https://www.bulbagarden.net/threads/hilda-iron-leaves-make-their-pokemon-masters-ex-debut-in-new-ex-master-fair-scout.309185/latest) |

### Spark (canje: "elige el que quieras tras N tiradas")

- **[V]** Arknights, banners limitados desde *Cremation Last Wish*: cada tirada da un "Headhunting Data Contract"; 300 contratos compran el 6★ destacado (200 en algunos antiguos) y 75 el 5★. Los contratos que sobran se convierten en otra moneda al cerrar el banner ([wiki.gg](https://arknights.wiki.gg/wiki/Headhunting)).
- **[V]** Pokémon Masters EX: cada tirada da 3 puntos de búsqueda; con 400 puntos eliges la pareja que quieras del banner. Una tirada cuesta 300 gemas, así que el spark son unas 133 tiradas ([Serebii](https://serebii.net/pokemonmasters/syncpairscout.shtml)).
- **[U]** Granblue Fantasy popularizó el término "spark" (300 tiradas = elegir). No lo comprobé en esta sesión.

### Rutas gratis (Pokémon Unite)

- **[C]** Pokémon Unite regala licencias por nivel de entrenador (Slowbro en el nivel 2, Venusaur en el 5), por regalos de bienvenida de 14 días (Ninetales de Alola, Cinderace, Greninja), por retos de principiante (Crustle) y por misiones de evento (Zeraora por 32 victorias en el lanzamiento). Las Aeos Coins, que se ganan jugando, son "la única moneda gratis que compra licencias" ([Gfinity](https://www.gfinityesports.com/article/pokmon-unite-how-to-unlock-all-characters-and-license-costs), [ONE Esports](https://www.oneesports.gg/gaming/8-free-pokemon-to-claim-in-pokemon-unite)). Las fuentes son de 2021–2022.
- **[I]** Lo útil para nosotros: Unite no tira dados para dar personajes, los **vende por moneda ganada a precio fijo**. Es la alternativa honesta al gacha y conviene tenerla al lado (ver A2.4).

### Repetidos

- **[U]** Genshin: el repetido sube una "constelación" (hasta C6) y da Starglitter, que se canjea en la tienda. Star Rail: "eidolons", igual. Arknights: "potencial" (hasta 6) y tokens. Hearthstone: protección contra repetidos de legendarias desde 2017 (no te sale una legendaria repetida mientras te falte alguna de esa rareza). Ninguno de estos datos lo comprobé hoy (las wikis bloquearon).
- **[I]** El patrón de la industria convierte el repetido en poder: la copia 7 del mismo personaje sigue valiendo, y eso es lo que alarga el gasto. Para nosotros el repetido debe valer **poco y cosmético**, nunca poder que separe a quien juega mucho de quien juega poco en una partida compartida.

### Diseño depredador y regulación (lo que evitar aunque sea gratis)

- **[V]** **Bélgica**: desde 2018 la Comisión del Juego trata las cajas botín de pago como juego de azar, lo que exige una licencia que nadie puede obtener. Xiao (2023, *Collabra: Psychology*, "Breaking Ban") encontró que el 82 % de los 100 juegos iOS con más ingresos en Bélgica seguían teniendo cajas botín: la prohibición no se hace cumplir ([ITU Copenhagen](https://pure.itu.dk/en/publications/opening-the-compliance-and-enforcement-loot-box-a-retrospective-o/), [PCGamesN](https://www.pcgamesn.com/belgium-loot-box-laws-study), [PCI RR](https://rr.peercommunityin.org/articles/rec?id=264)). Las fuentes discrepan sobre si la muestra es de mayo de 2021 o 2022.
- **[V]** **España**: la consulta pública de 2022 del Ministerio de Consumo sobre "mecanismos aleatorios de recompensa" barajaba no regular, corregular o tratarlos como juego bajo la Ley 13/2011 ([Consumo, 2022](https://portal-cec.consumo.gob.es/en/comunicacion/noticias/2022/espana-quiere-regular-las-loot-boxes-de-los-videojuegos-para-evitar-el)). En junio de 2024 el Gobierno aprobó el anteproyecto de **Ley Orgánica de protección de los menores en entornos digitales**, que prohíbe a los menores el acceso a los mecanismos aleatorios de recompensa ([DSCA, nota de prensa](https://www.dsca.gob.es/es/comunicacion/notas-prensa/ministerio-consumo-prohibe-acceso-menores-cajas-botin-videojuegos-evitar), [Noticias Jurídicas](https://noticias.juridicas.com/actualidad/noticias/20086-el-gobierno-aprueba-un-proyecto-de-ley-para-la-proteccion-de-menores-en-entornos-digitales/)). En el Congreso figura como proyecto 121/000052 (documentación de abril de 2025, [Congreso](https://www.congreso.es/webpublica/documentacion/docs_trabajo/leg15/121_000052/121_000052_estudios.pdf)). **No comprobé** si ya está aprobada ni el texto final, ni si su definición cubre recompensas aleatorias que no se pueden comprar.
- **[V]** **UE**: la red CPC (autoridades de consumo, coordinadas por la Comisión) publicó en marzo de 2025 unos "principios clave" no vinculantes sobre monedas virtuales en juegos: precio claro en dinero real, no ocultar costes ni obligar a comprar moneda, respetar a los vulnerables, sobre todo a los niños. Vino junto a una acción contra *Star Stable Online* por, entre otras cosas, "ofertas por tiempo limitado" como táctica de presión ([Forbrukertilsynet](https://www.forbrukertilsynet.no/eng-articles/national-consumer-authorities-and-commission-take-action-on-harmful-practices-in-the-gaming-industry), [CMS](https://cms.law/en/gbr/legal-updates/level-up-compliance-video-games-industry-in-the-spotlight-again-for-consumer-law-compliance), [Linklaters](https://techinsights.linklaters.com/post/102k6t4/game-changer-eu-introduces-consumer-protection-guidance-for-in-game-virtual-curr)).
- **[C]** La **Digital Fairness Act** sigue siendo propuesta: consulta en julio de 2025, prevista para el cuarto trimestre de 2026; la comisión de consumo del Parlamento aprobó a finales de 2025 un informe no vinculante que pide prohibir cajas botín y monedas de pago en juegos a los que acceden menores ([Freshfields](https://technologyquotient.freshfields.com/post/102ltio/the-eus-proposed-digital-fairness-act-a-game-developers-guide-to-potential-imp), [EU Perspectives](https://euperspectives.eu/2025/11/developers-push-back-the-digital-fairness-act/)).
- **[V]** **PEGI**: desde abril de 2020 añade el aviso "Incluye objetos aleatorios de pago" encima del descriptor de compras en el juego (que existe desde 2018). "De pago" = se compra con dinero real **o** con una moneda que se compra con dinero real ([PEGI](https://pegi.info/bg/node/67)). Un gacha pagado solo con moneda ganada no entra en esa definición.
- **[V]** **Investigación**: Zendle y Cairns (2018, *PLOS ONE*, 7422 jugadores) encontraron una relación entre lo que se gasta en cajas botín y la gravedad del juego problemático (η² = 0,054), sin poder decir qué causa qué ([White Rose](https://eprints.whiterose.ac.uk/139116/1/journal.pone.0206767.pdf)). Todo lo que se mide ahí es **gasto de dinero**; no encontré estudios sobre gachas sin dinero.

**[I] Lo que esto significa para nosotros.** Sin apuesta con valor económico no hay juego de azar en el sentido belga ni "objeto aleatorio de pago" en el sentido de PEGI. No es asesoramiento legal, pero la línea es clara y coincide con la que ya protege frente a Nintendo: **ninguna moneda del juego se puede comprar, ni directa ni indirectamente** (tampoco con Bits de Twitch, ni con nada que alguien pague). Lo que sí conviene evitar aunque no haya dinero, porque es lo que las autoridades señalan como presión y lo que hace que un juego "te tire" en vez de divertirte:

1. Ofertas o banners que desaparecen para siempre (FOMO), cuentas atrás grandes.
2. Moneda opaca o en varias capas (gemas que compran tickets que compran tiradas).
3. Tasas ocultas o pity que no se enseña (el soft pity de Genshin lo tuvo que descubrir la comunidad).
4. Animaciones de "casi" (near miss): una cápsula dorada que se apaga en el último segundo.
5. Repetidos que dan poder, y poder que separa a los jugadores de una misma partida.
6. Recompensas diarias que castigan faltar un día (rachas que se rompen).

## A2. Propuesta: el gacha del eclipse

### A2.1 Moneda y precio

- **[I]** Una sola moneda: **Pokémonedas**. Nada de una segunda moneda para tirar; como mucho un "ticket" que regalan los hitos y que vale exactamente una tirada (GDD §5 ya lo prevé).
- **[I]** Precio fijo: **100 P por tirada**, sin descuento por tanda de 10 (el descuento por volumen empuja a tirar más de lo que quieres). La tanda de 10 existe solo para ahorrar animación: cuesta 1000 P.
- **[I]** Ritmo: con 165 P por victoria en Fácil (y hasta ×2,2 en Pesadilla), una tirada sale por algo más de media victoria fácil, o un tercio de una victoria en Pesadilla. Las derrotas pagan el 75 %, así que perder también acerca a la siguiente tirada.
- **[I]** Equilibrio con la tienda de mejoras: tirar y mejorarse compiten por las mismas Pokémonedas. Propongo **no** separarlas: es la decisión interesante (¿más vida o un Pokémon nuevo?), y el pity garantiza que tirar nunca es tirar el dinero.
- **[I]** Hitos que regalan tickets (nunca diarios): primera victoria en cada mazmorra, primera victoria en cada nivel de dificultad, cada 10 plantas nuevas de récord en la Sima, primera captura de cada carta de guardián. Son cosas que haces una vez y que no caducan.

### A2.2 Banners

- **[I]** **Banner permanente "Luna nueva"**: todos los Pokémon del gacha, siempre.
- **[I]** **Banner rotatorio "Eclipse"**: dos Pokémon destacados (uno de 3★ y uno de 2★) con la tasa de su rareza duplicada. Rota cada semana con una semilla de la fecha (como el reto diario de la Sima), así que todo el mundo, chat incluido, ve el mismo. **Nada es exclusivo**: todo lo que sale en el Eclipse está también en el permanente. Lo que ganas al rotar es variedad, no urgencia. Sin cuenta atrás en grande: una línea pequeña "cambia el lunes".
- **[I]** Los sellos del spark y el contador de pity son **del jugador, no del banner**: se conservan al cambiar de banner y no caducan nunca (al revés que los contratos de Arknights).

### A2.3 Rarezas, tasas, pity y spark

**[I]** Tres rarezas, 16 Pokémon (lista en A3): 5 de 1★, 6 de 2★, 5 de 3★. Cada tirada da un Pokémon.

| Rareza | Tasa por tirada | Reglas |
|---|---|---|
| 3★ | 4 % | Pity suave desde la tirada 31 sin 3★ (+6 puntos por tirada) y garantía en la 40 |
| 2★ | 20 % | Al menos un 2★ o más en cada tanda de 10 |
| 1★ | 76 % | |

- **Protección contra repetidos** dentro de cada rareza: mientras te falte algún Pokémon de una rareza, lo que te sale de esa rareza es uno que no tienes.
- **Spark**: cada tirada da un **Sello lunar**; con **60 sellos eliges el Pokémon que quieras** (de cualquier rareza) y el contador vuelve a cero.
- **Todo visible**: la tasa de cada rareza y de cada Pokémon, el pity actual ("3★ garantizado en 12 tiradas") y los sellos ("47/60") se ven siempre en el puesto, sin buscar en un menú.

**[V] Simulado** con un script (Python, 4000–20 000 semillas, estas reglas exactas; script en un directorio temporal, no en el repo):

| Pregunta | Mediana | Percentil 90 | Peor caso |
|---|---|---|---|
| Tiradas hasta el primer 3★ | 17 | — | 40 (pity) |
| Tiradas hasta un 3★ concreto (eligiéndolo con el spark) | 53 | 60 | **60** (spark) |
| Tiradas hasta completar los 16 | 75 | 107 | 120 |

**[I]** A 100 P por tirada, el peor caso de un Pokémon concreto son 6000 P (unas 36 victorias fáciles o 17 en Pesadilla) y la colección entera unas 7500 P de mediana (unas 45 victorias fáciles). Es del orden de comprar todas las mejoras (5000 P): un objetivo largo pero con final. Si parece mucho, el botón es el precio (80 P baja todo un 20 %), no las tasas.

### A2.4 La ruta sin azar

**[I]** Al lado del gacha, un **tablón de encargos** (estilo Mundo Misterioso) que da Pokémon concretos por hitos, sin dados: por ejemplo Snorunt por capturar las cuatro cartas de Aegislash, Murkrow por llegar a la planta 20 de la Sima. Dos o tres Pokémon del plantel salen solo así (y también del gacha). Quien no quiera tirar nunca puede completar una parte, y el resto la cubre el spark, que es una compra a precio fijo disfrazada (60 tiradas).

### A2.5 Repetidos

**[I]** Un repetido da **Esquirlas de eclipse** (1★: 5, 2★: 15, 3★: 40). Las esquirlas compran, en el puesto:

1. **Movimientos del repertorio** del Pokémon (la GDD lo deja "por decidir"): el segundo movimiento de cada ranura viene bloqueado y se desbloquea con esquirlas. Son alternativas, no mejoras: el mismo presupuesto de daño, otra forma de jugar.
2. **Colores alternativos**: la hoja shiny de SpriteCollab cuando existe (la tienen los 16 propuestos, ver A3), y tintes de paleta.
3. **Variantes cosméticas** que ya hay en SpriteCollab: Mimikyu "Busted" (`0778/0001`, fase 1, las 6 animaciones básicas) para el disfraz roto, Zorua de Hisui (`0570/0001`, fase 2).
4. **Nunca** estadísticas. Nada de "+5 % de daño por copia". En una partida compartida todos los Pokémon tienen que pesar lo mismo.

### A2.6 Lo que hace gracia en el directo

- **[I]** Animación de tirada corta (unos 2 s, saltable) en el puesto: el eclipse se abre y cae una esfera; el color del borde dice la rareza **desde el principio** (no hay amago de "casi dorado": nada de near miss).
- **[I]** Un 3★ para el tiempo: cámara lenta, la corona roja del eclipse y el grito del Pokémon. Es el momento de clip.
- **[I]** El cartel del resultado se lee en un stream comprimido (GDD §10): nombre grande, rareza en texto además de color.
- **[I]** En el pueblo compartido, los demás ven tu tirada encima de tu cabeza. Con la integración de chat (`docs/twitch-chat-integration.md`) el chat puede votar el banner o el Pokémon del spark, **nunca** pagar ni disparar tiradas con Bits o con nada de pago. Los puntos de canal de Twitch son gratis, pero mejor tampoco: no hacen falta y confunden la línea "nada que se pague".

### A2.7 Reglas de oro (comprobables con tests)

**[I]** Igual que las reglas de equidad del combate (P5), estas deberían vivir en tests:

1. Ninguna ruta del código convierte dinero, Bits ni nada externo en Pokémonedas o tiradas.
2. La tasa mostrada es la que usa el código (un test lee la tabla de la interfaz y la de la lógica de la misma fuente de datos).
3. Con cualquier semilla, un Pokémon concreto llega en ≤ 60 tiradas (spark) y un 3★ en ≤ 40.
4. El pity y los sellos no se pierden al cambiar de banner ni con el tiempo.
5. Ningún repetido cambia una estadística de combate.

## A3. Plantel candidato (16 + variantes)

**Cómo se comprobó [V]**: se descargó `tracker.json` de PMDCollab SpriteCollab (rama `master`, 2026-10-26, a un directorio temporal, nada al repo) y se miró, para cada especie o forma, la fase del sprite, que estén las 6 animaciones básicas que pide `tools/fetch-sprites.mjs` (Idle, Walk, Attack, Shoot, Charge, Hurt), los extras (Strike, SpAttack) y si existe la hoja shiny. Además se leyó el `AnimData.xml` de los 16 para ver los alias `CopyOf` (el problema 1 de `docs/species-candidates.md`: el tracker cuenta un alias como hoja) y el tamaño de los fotogramas. No se leyó el `credits.txt` de cada uno, así que **la licencia por hoja no está comprobada** (igual que en `species-candidates.md`).

Se dejaron fuera los que ya son enemigos en `src/data/sprite-meta.json` (Gengar, Haunter, Gastly, Houndour, Duskull, Sableye, Pawniard, Drifloon, Phantump, Pumpkaboo, Impidimp…), para que tu Pokémon no se confunda con lo que te ataca. También Riolu y Espurr: **les falta Shoot**.

Fase: 2 = completo con extras (Faint, DeepBreath…), 1 = el juego de animaciones estándar.

### 3★ (5)

| Pokémon (tipo) | Sprite | Papel | Kit en una línea (rápida · fuerte · potenciación · área · pasiva) |
|---|---|---|---|
| **Absol** (Siniestro) `0359` | Fase 2, básicas completas, sin Strike (tiene Swing, SpAttack); shiny fase 2; Idle 40×48 | Duelista de castigo | Tajo Umbrío (arco ancho, crítico alto) · Viento Cortante (carga y lanza una media luna) · Danza Espada · Premonición (marca el suelo y estalla a 1,5 s) · **Presagio**: ves cada aviso 0,2 s antes |
| **Umbreon** (Siniestro) `0197` | Fase 2, completas, Strike; shiny fase 2; 24×48 | Aguante y contraataque | Mordisco · Juego Sucio (más daño si el enemigo ataca) · Luz Lunar (cura el 20 %) · Pulso Umbrío (anillo) · **Sincronía**: una esquiva perfecta deja al atacante aturdido 0,5 s |
| **Lycanroc Crepuscular** (Roca) `0745/0002` | Fase 2, completas, Strike; shiny fase 2; 48×56 | Cuerpo a cuerpo rápido | Colmillo · Roca Afilada (embestida) · Danza Dragón (andas y atacas más rápido) · Avalancha (cono) · **Garra Dura**: tras rodar, el siguiente golpe va primero (sin arranque) |
| **Typhlosion de Hisui** (Fuego/Fantasma) `0157/0001` | Fase 2, completas, Strike; shiny fase 2; 32×56 | A distancia, zona | Ascuas · Infortunio (doble contra aturdidos, como Litwick) · Fuego Fatuo · Llama Embrujada (anillo de llamas que deja suelo ardiendo) · **Mar Llamas**: con poca vida, el Fuego pega más |
| **Dragapult** (Dragón/Fantasma) `0887` | Fase 1, completas, Strike; shiny fase 1; **48×72, el más grande**: revisar que se lea | A distancia, móvil | Dardos Dracos (dos proyectiles que vuelven) · Golpe Fantasma (desaparece y golpea 0,6 s después) · Danza Dragón · Dracoaliento (cono que frena) · **Cuerpo Maldito**: el enemigo que te golpea pierde su siguiente ataque fuerte |

### 2★ (6)

| Pokémon (tipo) | Sprite | Papel | Kit |
|---|---|---|---|
| **Honedge** (Acero/Fantasma) `0679` | Fase 2, completas, sin Strike (Swing, SpAttack); shiny 2; 32×56 | Guardia | Corte Furia (sube con golpes seguidos) · Espada Santa (ignora escudos) · Danza Espada · Golpe Umbrío (cono) · **Indefenso**: tus fuertes no se bloquean, pero no tienes esquiva perfecta. Engancha con la historia de Aegislash |
| **Misdreavus** (Fantasma) `0200` | Fase 2, completas, Strike, SpAttack; shiny 2; 24×48 | Lanzadora, muy Touhou | Impresionar · Bola Sombra (como la de Mimikyu) · Maquinación · Canto Mortal (marca enemigos, estallan a 3 s) · **Levitación**: flota sobre charcos, agua y trampas |
| **Marowak de Alola** (Fuego/Fantasma) `0105/0001` | Fase 1, completas; **Shoot es copia de Strike**; shiny 1; 32×48 | Bruto con hueso de fuego | Hueso Palo · Huesomerang ardiente · Danza Llama · Hueso Sombrío (anillo) · **Cuerpo Llama**. Es el Cubone que creció: momento de historia |
| **Banette** (Fantasma) `0354` | Fase 1, completas, Strike, SpAttack; shiny 1; 24×56 | Truquista | Sombra Vil · Golpe Bajo (más daño si el enemigo prepara un ataque) · Rencor · Maldición en área · **Cacheo**: ve el objeto que soltará cada enemigo. Primo temático de Mimikyu (muñeco abandonado) |
| **Sneasel** (Siniestro/Hielo) `0215` | Fase 2, completas, sin Strike ni SpAttack; shiny existe pero marcada fase 0 en el tracker; 32×56 | Cuerpo a cuerpo de combos | Arañazo · Viento Hielo (frena) · Afilagarras · Alud en cono · **Robo**: el primer enemigo que tumbas en cada sala suelta una baya |
| **Murkrow** (Siniestro/Volador) `0198` | Fase 2, completas, Strike; shiny 2; 32×40 | Hostigador volador | Picotazo · Ataque Ala (pasada) · Maquinación · Tajo Aéreo en abanico · **Afortunado**: +10 % de Pokémonedas por enemigo (toca la economía: ver pregunta abierta 6) |

### 1★ (5)

| Pokémon (tipo) | Sprite | Papel | Kit |
|---|---|---|---|
| **Eevee** (Normal) `0133` | Fase 2, completas, Strike; shiny 2; 24×32 | Todoterreno | Placaje · Derribo · Refuerzo · Rapidez en anillo · **Adaptable**. Puerta a las eeveeluciones (Umbreon) en la historia |
| **Rockruff** (Roca) `0744` | Fase 2, completas, Strike; shiny 2; 32×48 | Cuerpo a cuerpo simple | Mordisco · Lanzarrocas · Aullido · Pisotón · **Vista Lince**: no te afecta la niebla del Bosque |
| **Shuppet** (Fantasma) `0353` | Fase 2, completas; **Shoot es copia de Charge**; shiny 2; 24×48 | Lanzador sencillo | Tinieblas · Bola Sombra pequeña · Rencor · Viento Aciago · **Cacheo** (versión simple) |
| **Snorunt** (Hielo) `0361` | Fase 2, completas, Strike; shiny existe, marcada fase 0; 24×40 | Control | Nieve Polvo · Canto Helado (rueda y gana fuerza) · Neblina (ralentiza balas cercanas) · Viento Hielo · **Gélido**: frenas a quien te toca |
| **Charcadet** (Fuego) `0935` | Fase 2, completas, Strike; shiny 2; 24×48 | Bruto aprendiz | Ascuas · Golpe Calor · Danza Llama · Rueda Fuego · **Absorbe Fuego** (comparte con Litwick: lo distingue el cuerpo a cuerpo) |

**Banquillo comprobado [V]** (fase 1, las 6 básicas): Froslass, Spiritomb, Mismagius, Lampent y Chandelure (pero son la línea de Litwick; chocan con la sección "Evoluciones"), Dreepy, Drakloak, Sinistea, Yamask, Greavard, Rotom, Sandygast, Espeon; Shinx y Axew (fase 2). Sin sprite: Gimmighoul (fase 0).

**Encaje con el tema [I]**: hay seis fantasmas, cinco siniestros, dos fuegos fantasmales y tres con historia ya escrita (Marowak de Alola con Cubone, Honedge con el Rey Espada, Umbreon y Absol con la luna y el desastre). Los tipos nuevos (Roca, Hielo, Dragón, Volador) abren contenido que las mazmorras actuales no castigan ni premian todavía.

**Ojo [I]**: los kits de arriba son conceptos de una línea, no números. Cada uno tiene que pasar por las mismas reglas que los iniciales (presupuesto de daño, coste de estamina) y por el arnés con `--slots` y cada especie (hoy "el barrido solo juega con Mimikyu", GDD §9).

## A4. Autoridad del servidor

- **[V]** Hoy todo es local: saldo, compras y récords viven en `mazmorra-sombria.save`, saneado al leer. Las Pokémonedas no viajan por la red.
- **[I]** Mientras no haya cuentas: el gacha corre **en el cliente**, con su RNG propio sembrado y guardado en el save (pity, sellos y semilla). Hacer trampas solo te engaña a ti, porque no hay nada que ganar ni que vender. No merece la pena blindarlo; basta con `sanitize()` (un save manipulado no rompe el juego).
- **[I]** Cuando haya cuentas, el servidor tiene que ser el dueño de:
  1. **El saldo** (libro de movimientos: cada ingreso con su partida, cada gasto con su tirada).
  2. **La tirada**: el RNG corre en el servidor; el cliente manda "quiero tirar" con un id de petición (idempotente: reintentar no cobra dos veces) y recibe el resultado.
  3. **Pity, sellos y colección.**
- **[I]** El límite honesto: mientras la **partida** no se valide en el servidor, el servidor no sabe si las Pokémonedas que le dices que ganaste son reales. Tirar en el servidor solo evita que se manipule la tirada, no que se inventen monedas. Opciones baratas: un techo plausible de P por minuto (la tabla de §11 da el máximo), y, para la Sima o el reto diario, reenviar semilla + entradas y que el servidor repita la partida con el núcleo determinista (es lo que ya hace el arnés). Esto último es caro; solo vale para marcas públicas.
- **[I]** Invitado sin conexión: sigue funcionando todo en local, para siempre. Al crear cuenta, una importación única de la colección y el saldo del invitado (como es gratis, no hay que desconfiar mucho; sí poner el techo plausible). Lo que no se hace es mezclar después: o juegas como invitado o con cuenta.
- **[I]** En partida compartida cada jugador lleva su propio Pokémon; el anfitrión no necesita comprobar que "lo tienes". Si algún día importa (marcas públicas), lo comprueba el servidor, no el anfitrión.

---

# Parte B. Bots que esquivan danmaku

## B0. De dónde partimos (repositorio)

- **[V]** `src/sim/bots.ts`: el bot "perfecto" rueda cada aviso normal y cada bala dentro de su invulnerabilidad, sale andando del suelo `pierceRoll` y ataca entre avisos. Decide con reglas sobre la observación del tick, sin mirar el futuro. Ninguno modela patrones de muchas balas: por eso el perfecto gana Pesadilla un 0 % (`odd/tasks/balance-harness.md`, "First findings").
- **[V]** `src/data/tuning.ts`: la voltereta dura 380 ms, la invulnerabilidad va de 30 a 300 ms desde que empieza, cuesta 25 de estamina y recorre 110 px; la esquiva perfecta es un golpe absorbido en los 120 ms primeros de la invulnerabilidad.
- **[V]** El núcleo es puro: `step(state, input, dtMs)` devuelve un estado nuevo (`src/core/step.ts`), y el runner guarda `before` y `after` a la vez (`recorder.record(before, after)`), lo que solo funciona si `step` no muta lo que recibe. Así que **"clonar" el mundo no cuesta nada**: basta con llamar a `step` sobre el mismo estado con entradas distintas. El tick es de 1000/60 ms.
- **[V] Medido** hoy (script fuera del repo, empaquetado con el esbuild del proyecto, jugador quieto en la arena del guardián): **4–9 µs por `step`** en Cripta, Bosque y Sima, en Fácil y Pesadilla. Es una cota baja: con el jugador quieto mueren pronto y hay menos que simular que en una pelea real. Calculo con 10–20 µs.
- **[V]** Otro trabajador está escribiendo un "bot resolvedor" con información perfecta para pruebas de que un patrón se puede ganar. Esta parte propone algo distinto: un bot **experto** con la información de un humano, cuya tasa de victorias sí signifique algo.

## B1. Enfoques conocidos

### Esquiva geométrica

- **[V] Obstáculos de velocidad** (Fiorini y Shiller, 1998): el conjunto de velocidades relativas que acaban en choque; cada paso eliges una velocidad fuera de él ([survey arXiv 2606.02677](https://arxiv.org/pdf/2606.02677)). **twinject**, el jugador automático de Touhou más conocido, usa un "Constrained Velocity Obstacle Algorithm": un predictor lineal de obstáculos de velocidad que "mira lejos" con límites y elige paso a paso; lee el estado del juego inyectando una DLL, no la pantalla ([GitHub Netdex/twinject](https://github.com/Netdex/twinject/blob/master/README.md)).
- **[V] Ventana dinámica** (Fox, Burgard y Thrun, 1997, *IEEE Robotics & Automation Magazine* 4(1):23–33): busca solo entre las velocidades alcanzables en un intervalo corto y elige la que maximiza avance, velocidad y distancia al obstáculo más cercano en la trayectoria ([CMU RI](https://www.ri.cmu.edu/publications/the-dynamic-window-approach-to-collision-avoidance), [Wikipedia](https://en.wikipedia.org/wiki/Dynamic_window_approach)).
- **[U] Campos de potencial** (Khatib, 1986): las balas empujan, el objetivo atrae. Barato, pero cae en mínimos locales: en un anillo con un hueco, la suma de empujes te deja quieto en el centro.
- **[I] Para nosotros**: buenos para balas sueltas y rectas, malos para lo que define nuestras cartas (zonas que se fijan, brazos que giran, refugios que hay que elegir). No saben de la voltereta, que es un "atravesar durante 270 ms", ni de la estamina.

### Búsqueda sobre la simulación determinista

- **[V] A\* en espacio-tiempo** (Silver, 2005, AIIDE, "Cooperative Pathfinding"): buscar en (posición, tiempo) para esquivar lo que se mueve; la versión con **ventana** (WHCA\*) limita la profundidad a una ventana dinámica y replanifica, y fue la más robusta ([AAAI](https://ojs.aaai.org/index.php/AIIDE/article/view/18726)).
- **[V] MCTS para pruebas automáticas con "personas"** (Holmgård, Green, Liapis y Togelius, *IEEE Transactions on Games*, 2019): agentes MCTS con criterios de selección evolucionados que imitan estilos de jugador para probar contenido ([arXiv 1802.06881](https://ar5iv.arxiv.org/html/1802.06881); precursor en [AIIDE 2015](https://ojs.aaai.org/index.php/AIIDE/article/view/12849)).
- **[I] Para nosotros**: es lo natural, porque el núcleo ya es determinista y puro. Mirar 300–600 ms adelante con unas decenas de secuencias de entradas cuesta poco (B2.3) y entiende sola la voltereta, la estamina, los refugios y los huecos entre brazos, porque los simula de verdad.

### Aprendizaje por refuerzo

- **[V]** Fujimoto (2024, Universidad de Kioto, Game Programming Workshop del IPSJ): un agente Rainbow que juega un danmaku solo con los píxeles; la parte que más ayudó fue el DQN categórico, para aprender a esquivar "de forma global". Señala que, sin el estado interno, es difícil prever las situaciones inevitables ([IPSJ](https://ipsj.ixsq.nii.ac.jp/records/240726)).
- **[V]** Un estudio en ACM (2024, DOI 10.1145/3650215.3650381) usa DQN con rayos como entrada; buen rendimiento pero "varios retos" para completar juegos comerciales ([unpaywall](https://unpaywall.org/10.1145%2F3650215.3650381)).
- **[C]** Un proyecto aficionado entrenó con Q-learning en un juego propio de balas al azar y lo conectó a Touhou con twinject: llega al jefe de fase en *Imperishable Night*, con muchos errores y sobreajuste ([Lemmy](https://lemmy.world/post/16099991)).
- **[I] Coste y beneficio**: el aprendizaje por refuerzo cuesta horas de entrenamiento, hay que reentrenar cada vez que cambia una carta (y el arnés existe precisamente para cambiar cartas), no es determinista entre versiones y nadie puede explicar por qué falla. Para balancear, lo que queremos es lo contrario: barato, repetible y explicable. **No lo recomiendo ahora.**

### Ruido humano

- **[V]** Reacción visual simple: 231 ms de media (213 ms corrigiendo el retraso del equipo), N = 1469 (Woods et al., 2015, ya citado en `docs/souls-difficulty-research.md` §4). La reacción de elección es más lenta (60–300 ms más; ley de Hick). El bot "medio" ya usa 230 + 100 ms.
- **[U]** Las correcciones de movimiento de una persona van a ritmo de unos 100–200 ms (no replanificamos cada fotograma), y los jugadores de danmaku distinguen esquivar con microajustes y recolocarse por la pantalla (`souls-difficulty-research.md` §3.3, también [U] allí).

## B2. Propuesta: el bot "experto"

### B2.1 Qué es

**[I]** Un quinto perfil, `expert`, que planifica en vez de reaccionar. Cada 100 ms (6 ticks):

1. Toma la observación de hace **230 ms** (el mismo retraso de percepción que ya tiene el bot medio; su propio cuerpo lo siente al momento).
2. Construye un **mundo de planificación** a partir de esa observación (B2.2).
3. Prueba unas **36–60 secuencias de entradas** de 450 ms (27 ticks): 8 direcciones y quedarse quieto, combinadas con "no rodar", "rodar ya", "rodar a +100 ms", "rodar a +200 ms", más dos o tres secuencias de "salir hacia el refugio o el hueco más cercano" que propone una heurística. Las que comparten principio se simulan una vez (árbol).
4. Puntúa cada secuencia: −1000 por golpe recibido (−400 si es una esquiva perfecta, que no es golpe), −vida perdida, −estamina por debajo de 25 al final (no poder rodar después), −distancia a la pared y a los enemigos, + daño hecho si la secuencia ataca en una ventana abierta.
5. Ejecuta los primeros 100 ms de la mejor y vuelve a empezar (horizonte que se desplaza, como WHCA\*).

**Ataque "en tu turno" [I]**: la observación ya dice cuándo un enemigo está en recuperación tras su golpe (el "rato abierto" del contrato souls de la GDD). Solo se prueban secuencias de ataque cuando el enemigo objetivo está en esa ventana o lejos de su arranque, y el ataque tiene que acabar su recuperación antes del siguiente aviso que se ve. Así el bot no muere por avaricia, que es la forma más humana de morir y la que el ruido de B2.4 vuelve a introducir a propósito.

**La voltereta [I]**: no hace falta una regla especial. Como se simula el núcleo de verdad, la secuencia "rodar a +100 ms" a través de una bala sale sin golpe si la bala cae dentro de 30–300 ms de invulnerabilidad, y con golpe si no. El bot aprende solo a rodar tarde (esquiva perfecta) y a no rodar sin estamina.

### B2.2 Que no haga trampa: el mundo de planificación

**[I]** Este es el punto delicado. El núcleo determinista sabe el futuro: qué enemigo va a atacar, hacia dónde y cuándo, antes de que haya aviso. Un bot que simule el mundo verdadero 450 ms adelante ve ataques que una persona aún no puede ver, y entonces su tasa de victorias vuelve a no significar nada (por arriba, esta vez). Tres capas:

1. **Partir de lo que se ve**: el mundo de planificación sale de la observación con retraso (`observe.ts` ya calcula lo que hay en la cámara de 512 × 320), no del mundo actual.
2. **Congelar lo que no se ha anunciado**: en la copia, a los enemigos que no han empezado su aviso se les impide empezarlo dentro del horizonte (por ejemplo, alargando su enfriamiento en la copia). Las balas que ya vuelan y los avisos ya empezados siguen igual: eso sí lo ve una persona. Hace falta un gancho en `src/sim` (no en el núcleo) que haga esa transformación sobre `WorldState`, como el `inject` de los tests. Qué campo tocar depende de la máquina de estados de cada enemigo: está en las preguntas abiertas.
3. **Lo desconocido como riesgo**: como no sabe lo que viene, el bot paga un coste por estar cerca de un enemigo que podría atacar, por estar en una esquina y por quedarse sin estamina. Es lo que hace una persona.

**Argumento a favor de un horizonte corto [I]**: la regla de equidad del arnés dice que cada golpe se anuncia al menos 280 ms antes (400 ms los de zona). Un golpe que llega dentro de 280 ms ya tenía su aviso en pantalla cuando el bot miró. Con la capa 2, el bot puede mirar 450–600 ms sin ver ningún golpe que no se haya anunciado: lo que gana con el horizonte largo es planificar la salida (no rodar hacia la siguiente bala), no adivinar.

**Diferencia con el resolvedor [I]**: el resolvedor del otro trabajador puede usar el mundo verdadero (información perfecta). Es una prueba de **existencia**: "este patrón se puede ganar". El experto es una prueba de **plausibilidad**: "alguien que ve lo que tú ves y reacciona como tú lo gana tantas veces". Lo que se aprende de la diferencia entre los dos es cuánta precisión pide un patrón.

### B2.3 Coste de CPU

**[I]** Con 10–20 µs por `step` (B0):

| Configuración | Steps por replanificación | Coste por replanificación | Coste por segundo de juego (10 replanificaciones) |
|---|---|---|---|
| 36 secuencias × 27 ticks | ~970 | 10–20 ms | 0,1–0,2 s |
| 60 secuencias × 36 ticks (600 ms) | ~2 200 | 22–44 ms | 0,2–0,4 s |
| Lo mismo como árbol (prefijos compartidos, ~½) | ~1 100 | 11–22 ms | 0,1–0,2 s |

- Una pelea de jefe de 90 s cuesta 9–36 s de CPU. Una arena de cada guardián y jefe intermedio (unas 15) × 4 niveles × 3 semillas = 180 peleas ≈ 30 min a 2 h en un núcleo; con `worker_threads` en 8 núcleos, 4–15 min. Es para `npm run balance -- --expert`, no para la CI.
- Para la CI: un caso por mazmorra en Difícil y Pesadilla, 1 semilla, horizonte de 450 ms (≈ 10 peleas, 1–3 min). Si no cabe en los 60 s, se queda fuera de la CI y corre en el barrido completo.
- Ahorros si hace falta: simular solo las balas y los avisos en la copia (no la navegación ni la IA de enemigos congelados), cortar la secuencia en cuanto recibe un golpe, y replanificar más a menudo solo cuando hay una amenaza en pantalla (fuera de combate, el bot de siempre).

### B2.4 Que se parezca a una persona

**[I]** Para que su tasa de victorias diga algo:

| Parámetro | Valor inicial | Por qué |
|---|---|---|
| Retraso de percepción | 230 ms | Woods 2015 [V]; el del bot medio |
| Tiempo de elección | +100 ms la primera vez que aparece un patrón nuevo | Ley de Hick [V]; una vez "leído", ya no |
| Cadencia de replanificación | 100 ms (6 ticks) | Las personas no corrigen cada fotograma [U] |
| Ruido de ejecución | ±40 ms en el momento de rodar, ±0,08 rad al apuntar | Los del bot medio |
| Error de juicio | 5 % de las replanificaciones eligen la segunda mejor | Más bajo que el 15 % del medio: es un experto |
| Horizonte | 450 ms (probar 300 y 600) | Mira un poco más allá del aviso mínimo |
| Avaricia | 10 % de las ventanas, alarga el ataque un golpe | Así muere la gente que juega bien |

Con estos parámetros hay que **calibrar con personas** (B2.5), no fiarse de los números de arriba.

### B2.5 Cómo validarlo

**[I]**

1. **Grabar partidas humanas.** El núcleo es determinista: semilla + entradas por tick reproducen la partida entera. Basta con guardar eso (unos KB) desde el juego real, con permiso, por ejemplo con una opción en el menú "grabar para el balance".
2. **Métricas comparables.** Pasar las grabaciones por el mismo `FloorRecorder` del arnés: daño por planta, golpes normales frente a golpes de zona, tiempo de jefe, y dos nuevas: cuánto antes de la bala se rueda (distribución) y cuántas esquivas perfectas hay por voltereta.
3. **Calibrar.** Ajustar ruido y error del experto hasta que sus distribuciones se parezcan a las del cuartil alto de las personas (prueba de Kolmogorov-Smirnov sobre el adelanto de la voltereta, por ejemplo). Medio y novato, contra la mediana y el cuartil bajo.
4. **Comprobar en las dos direcciones.** Una carta que el experto gana a menudo y las personas buenas casi nunca indica que el experto ve demasiado (revisar la capa 2 de B2.2). Al revés, el bot es demasiado tonto en ese patrón (revisar las secuencias candidatas).
5. **Prueba de que puede fallar** (como el patrón imposible plantado de hoy): una carta de balas sin hueco tiene que matar al experto, y un patrón con un hueco claro que el bot perfecto de reglas no sabe usar (un anillo con una abertura) tiene que superarlo. Si el experto también pasara el imposible, está viendo el futuro.
6. **Bandas nuevas** cuando esté calibrado: "el experto gana Difícil ≥ X %" y "el experto gana Pesadilla ≥ Y %" en lugar de "el perfecto gana Pesadilla ≥ 80 %", que hoy no mide nada.

### B2.6 Dónde vive en el código

**[I]** Todo en `src/sim/` (la regla de arquitectura ya prohíbe que el núcleo importe `sim`): `src/sim/expert.ts` (planificador), `src/sim/plan-world.ts` (la copia con lo no anunciado congelado), un perfil más en `BOT_PROFILES` y un indicador `--expert` en `tools/balance.ts`. El núcleo no cambia; si algún gancho hace falta, que sea neutro y que el digest dorado siga pasando, como el `pierceRoll` del T2.

---

## Hechos frente a inferencias (resumen)

| Comprobado [V] | Inferido o propuesto [I] |
|---|---|
| Tasas y pity de Arknights (wiki), spark de Arknights (300) y Masters EX (400 puntos, 3 por tirada) | Precio de 100 P, tasas 76/20/4, pity 40, spark 60 |
| PEGI define "de pago" como comprable con dinero o con moneda comprable | Que un gacha sin moneda comprable quede fuera de las normas de juego (no es asesoramiento legal) |
| Bélgica 2018 y Xiao 2023; anteproyecto español de junio de 2024; principios CPC de marzo de 2025 | Las seis cosas a evitar aunque no haya dinero |
| Simulación de nuestro gacha: un Pokémon concreto ≤ 60 tiradas, colección mediana 75 | Que 7500 P de mediana sea un ritmo agradable |
| Los 16 candidatos tienen las 6 animaciones básicas y hoja shiny en el tracker de SpriteCollab; alias `CopyOf` leídos | Los kits y los papeles |
| `step` es puro; 4–9 µs por paso medidos en arenas | 10–20 µs en peleas reales; 0,1–0,4 s de CPU por segundo de juego |
| twinject usa obstáculos de velocidad; Fujimoto 2024 y DQN con rayos | Que el aprendizaje por refuerzo no compense aquí |

Lo que **no** se pudo comprobar: la tasa base de Star Rail, el detalle de Capturing Radiance, la protección contra repetidos de Hearthstone, los sistemas de repetidos de Genshin y Arknights, el estado final de la ley española, la licencia por hoja de los 16 sprites, y el artículo "Towards an AI playing Touhou from pixels" (CoG 2021), que solo apareció en una lista de referencias.

## Preguntas abiertas para ti

1. **¿Quién lleva el puesto?** La GDD pone a Phantump junto a un puesto vacío en la Aldea del Lago Negro; el encargo habla de un Mimikyu. ¿Cambio de idea o son dos cosas (Mimikyu atiende, Phantump "ve lo que vendrá")?
2. **¿Tiradas y mejoras con la misma moneda?** Propongo que sí (es la decisión interesante). La otra opción es una moneda aparte solo para tiradas.
3. **¿Se puede no tirar nunca?** Propongo el tablón de encargos con 2–3 Pokémon fijos y el spark. ¿O el gacha es la única puerta, como dice §5?
4. **¿Precio de 100 P?** Hace la colección completa del orden de las mejoras (unas 45 victorias fáciles de mediana). ¿Más rápido o más lento?
5. **Movimientos del repertorio con esquirlas de repetidos**: ¿sí, o se compran con Pokémonedas como dice §4?
6. **Pasivas que tocan la economía** (Murkrow "Afortunado"): ¿se permiten o todas las pasivas son solo de combate?
7. **Tipos nuevos** (Roca, Hielo, Dragón, Volador): ¿se aceptan sin mazmorras que los usen, o el plantel se queda en Fantasma, Siniestro y Fuego?
8. **El bot experto**: ¿se puede añadir el gancho de la capa 2 (congelar avisos no empezados en la copia), y qué campo de la IA de los enemigos es el bueno para hacerlo? Lo sabe quien escribió `core/difficulty.ts` (`tickAiAt`).
9. **Grabar partidas de personas para calibrar**: ¿te parece bien una opción "grabar para el balance" (semilla + entradas, local, que se exporta a mano)?
10. **Cuentas**: ¿hay planes reales de cuentas y servidor? Si no, A4 se queda en "gacha en el cliente", y no hace falta nada más.
