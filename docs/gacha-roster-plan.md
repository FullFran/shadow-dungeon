# Plantel del gacha: plan de la primera temporada

Plan, no decisión cerrada. Escrito el 2026-10-26. Parte de la propuesta de `docs/gacha-and-bots-research.md` (Parte A: moneda, tasas, pity, spark, repetidos y el plantel candidato de 16) y la convierte en un plantel jugable de **21 Pokémon** con su kit, su repertorio aprendible y su "build de competitivo", más el plan de banners, el uso de las esquirlas y una lista de tareas.

Etiquetas, las mismas que en la investigación:

- **[V]** comprobado hoy en la fuente enlazada, en el repositorio o con un script ejecutado.
- **[C]** dato de comunidad sin documento oficial.
- **[U]** de memoria, sin comprobar en esta sesión.
- **[I]** inferencia o propuesta de diseño mía.

Fuentes consultadas el 2026-10-26 (scripts y descargas en un directorio temporal, nada al repositorio):

- Sprites: `tracker.json` de PMDCollab SpriteCollab (rama `master`) y el `AnimData.xml` de cada especie o forma, más la existencia del `AnimData.xml` de la hoja shiny (`<dex>/<forma>/0001/`). URL base: <https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/>.
- Repertorios y habilidades: PokeAPI, `https://pokeapi.co/api/v2/pokemon/<especie>`, con el grupo de versiones más reciente en el que está la especie (Escarlata/Púrpura si existe; si no, Espada/Escudo). Los nombres en castellano de movimientos y habilidades salen de `https://pokeapi.co/api/v2/move/<id>` y `/ability/<id>`.
- Builds: las páginas del Smogon Dex (`https://www.smogon.com/dex/<gen>/pokemon/<especie>/`), leyendo el JSON de `strategies` que llevan dentro. Se toma la generación más reciente que tenga sets.
- Repositorio: `src/data/species.ts`, `src/data/moves.ts`, `src/data/slots.ts`, `src/data/sprite-meta.json`, `tools/fetch-sprites.mjs`, `docs/gdd.md` (§3, §4, §5, §9), `docs/species-candidates.md`, `docs/backend-accounts-plan.md` §2.5.

**No comprobado**: el `credits.txt` de cada hoja (la licencia por hoja; igual que en `species-candidates.md`), y el contenido del documento de repertorios de los iniciales que está escribiendo otro trabajador. Este plan sigue el mismo modelo (repertorio canónico adaptado al tiempo real, NPC tutor, builds de tipo competitivo), pero cuando ese documento exista manda él y aquí se ajustan nombres y costes.

---

## 0. Resumen

- **[I]** 21 Pokémon: **6 de 3★, 7 de 2★ y 8 de 1★**. Ninguno es enemigo ni jefe hoy, ninguno es evolución de un inicial y todos tienen las 6 animaciones básicas propias (sin alias `CopyOf`) y hoja shiny.
- **[I]** La rareza mide **novedad y complejidad, no poder**. Un 3★ no pega más que un 1★: todos comparten el presupuesto de daño y de seguridad de los iniciales (90–120 PV, velocidad 0,9–1,12). Lo que da un 3★ es un kit más raro (marcas retardadas, curar al grupo, desaparecer) y un momento de clip al salir.
- **[V]** Con las reglas de la investigación (3★ al 4 %, pity suave desde la 31 y garantía en la 40, 2★ garantizado cada 10, protección contra repetidos, spark a 60 sellos) y este plantel de 21, la simulación da: primer 3★ en la tirada 17 de mediana (peor caso 40); un 3★ concreto en 60 (con el spark) o en **43 de mediana si está destacado**; la colección completa en **94 de mediana**, 120 en el percentil 90 y 152 en el peor caso de 20 000 semillas.
- **[I]** Primera temporada: siete semanas con un 3★ y un 2★ destacados, con nombre y tema; la última la vota el chat.
- **[I]** Los repetidos dan esquirlas, que compran **atajos** (desbloquear antes un movimiento que también se gana jugando) y **cosméticos** (shiny, tintes). Nunca poder, y nunca un movimiento que solo se pueda tener con repetidos.
- **[I]** Una tirada puede dar la **variante shiny**, que es una **skin** que se pone y se quita cuando quieras, por Pokémon, y que los demás ven en el cooperativo. Probabilidad del 2,5 % por tirada, con garantía a las 80 tiradas sin shiny, y también se compra con esquirlas (§5.1). **[V]** Los 21 tienen hoja shiny con las 6 animaciones básicas propias.
- **[I]** El plan deja sitio para una capa de progresión por Pokémon que llegará después: evolucionar con Pokémonedas y una mazmorra de desafío, y vitaminas y mentas hechas con materiales de ese desafío (§5.2).
- **[I]** Siete mecánicas nuevas de combate hacen falta para todo el plantel (curar, aura para aliados, marca retardada, borrar balas, ralentizar, zona persistente y varios proyectiles). La primera tanda de especies se puede hacer con lo que el motor ya tiene.

Correcciones a la investigación que salieron al comprobar **[V]**:

| Lo que decía | Lo que hay |
|---|---|
| Lycanroc Crepuscular con Danza Dragón | No la aprende (PokeAPI, Escarlata/Púrpura). Se cambia por Danza Espada (MT) y Aullido (nivel) |
| Absol con Viento Cortante | No está en su repertorio de Espada/Escudo. La media luna pasa a ser Psicocorte (MT) |
| "Dardos Dracos" de Dragapult | El nombre en castellano es **Dracoflechas** |
| Snorunt con Neblina | No la aprende en Escarlata/Púrpura. Se quita |
| Shuppet y Marowak de Alola en el plantel | Su `Shoot` es copia de `Charge` y de `Strike` (alias `CopyOf` en `AnimData.xml`). Marowak además es la evolución de Cubone, un inicial. Fuera los dos |
| Murkrow con +10 % de Pokémonedas | Se cambia por Bromista: no toca la economía (era la pregunta abierta 6 de la investigación) |

---

## 1. Reglas comunes del plantel

### 1.1 Presupuesto (igual que los iniciales)

- **[V]** Hoy: Zorua 90 PV y velocidad 1,12; Litwick 95 y 0,95; Cubone 115 y 0,92; Mimikyu 100 y 1 (`src/data/species.ts`). Radio del cuerpo 10 px para los cuatro. Las potencias de los movimientos son las oficiales y los tiempos son de sensación (`src/data/moves.ts`). El daño ya aplica STAB y tabla de tipos (`src/core/damage.ts`).
- **[I]** Todos los del gacha: PV entre 85 y 120, velocidad entre 0,9 y 1,12, **radio 10** (el área de impacto no depende del dibujo). Las cifras de cada ficha son una primera propuesta; las fija el arnés con `--slots` y cada especie (GDD §9).
- **[I]** Potencias oficiales, pero con tope: los movimientos de área y los muy fuertes (Estallido 150, Metaláser 140, Última Baza 140) se igualan con estamina, enfriamiento y arranque, no bajando la potencia. Explosión se descarta: 250 de potencia y caer a propósito no encajan con un cooperativo sin revivir gratis.

### 1.2 Cómo se adapta un movimiento canónico a una ranura (la misma regla para todos)

**[I]** Para que el chat reconozca el movimiento y el kit se lea igual en los 25 Pokémon:

| En el juego original | Aquí | Ranura típica |
|---|---|---|
| Físico de contacto | Arco delante (`arc`) o embestida (`dash`) | Rápida o fuerte |
| Especial a un objetivo | Proyectil (`projectile`); onda que atraviesa (`wave`) si es un rayo | Rápida o fuerte |
| Ataque a varios objetivos (Avalancha, Onda Ígnea, Chispazo, Terremoto, Vozarrón) | Anillo (`arc` de 360°) o cono | Área |
| Cambio de estadísticas propio (Danza Espada, Paz Mental) | Mejora propia (`self` + `buff`) | Potenciación |
| Estado sobre el enemigo (Fuego Fatuo, Onda Trueno, Hipnosis) | Control en área: aturde, frena o marca | Área |
| Prioridad (Ataque Rápido, Golpe Bajo, Roca Veloz) | Arranque muy corto | Rápida |
| Con retroceso (Envite Ígneo, Voltio Cruel, Pájaro Osado) | Cuesta un poco de vida propia | Fuerte |
| Dos turnos (Rayo Solar, Rayo Meteórico) | Carga larga | Fuerte |
| No falla (Golpe Aéreo, Meteoros) | Proyectil que gira un poco hacia el objetivo | Rápida o fuerte |
| Daño fijo (Tinieblas) | Daño fijo, sin tipos | Fuerte |
| Quemadura, parálisis, sueño | **No hay estados** (GDD §4). Pasan a aturdimiento, ralentización o marca | — |

### 1.3 Origen de los movimientos y cómo se desbloquean

**[I]** Cada movimiento lleva su origen canónico, que decide cómo se consigue:

- **Nv** (por nivel en el juego original): viene con el Pokémon o se gana jugando con él (por ejemplo, despejar 5, 15 y 30 plantas con esa especie).
- **MT**, **H** (movimiento huevo) y **Tu** (tutor): los enseña el **NPC tutor** que está diseñando el otro trabajador, pagando en Pokémonedas, o antes de tiempo con esquirlas (§5).
- El kit por defecto siempre es completo y jugable. Nada de lo aprendible es más fuerte: son **otras formas** con el mismo presupuesto.

### 1.4 Mecánicas nuevas que pide el plantel

**[V]** Hoy el motor sabe hacer arco, embestida, proyectil (con bumerán u onda), mejoras propias (`power`, `haste`, `guard`, `kindle`), bonos al golpear (`attacking`, `staggered`, `afterMiss`), varios golpes en un mismo movimiento (`multiHit`) y carga en tres niveles (`src/data/moves.ts`).

**[I]** Lo que falta, y quién lo necesita en su kit **por defecto** (en el repertorio hay más):

| Mecánica nueva | Qué hace | Kits por defecto que la usan |
|---|---|---|
| M1 Curar | Recupera un porcentaje de vida, a ti o a un aliado | Umbreon, Cresselia, Solrock, Chimecho |
| M2 Aura para aliados | La mejora alcanza a los aliados que estén cerca | Rockruff, Eevee, Cresselia, Chimecho |
| M3 Marca retardada | Marca el suelo o un enemigo, que estalla al cabo de un rato | Absol (aprendible), Lunatone, Misdreavus |
| M4 Borrar balas | Desvanece las balas enemigas en un radio, como la bomba de Touhou | Yamask |
| M5 Ralentizar | El enemigo anda y ataca más despacio durante un rato | Snorunt, Sneasel, Dragapult |
| M6 Zona persistente | Deja suelo que hace daño a los enemigos | Typhlosion de Hisui (aprendible), Charcadet |
| M7 Varios proyectiles | Dos o más proyectiles en una sola activación | Dragapult |

Las M1, M2 y M4 tocan la equidad del cooperativo: curar y borrar balas son las que más cambian una pelea. Deben pasar por el arnés y por las reglas de §9 (aviso mínimo, tope del 35 %). Borrar balas **no** borra los ataques de zona (`pierceRoll`): eso rompería la regla 5 de la dificultad.

**Sin mecánicas nuevas** (solo con lo que ya hay): Lycanroc, Honedge, Banette, Murkrow, Axew, Shinx. Son la primera tanda natural (§8, T3).

---

## 2. El plantel (21)

### 2.1 Vista general

| ★ | Pokémon | Tipo | Papel | Pasiva | Sprite [V] | Idle [V] | Cómo se consigue |
|---|---|---|---|---|---|---|---|
| 3★ | Absol `0359` | Siniestro | Escaramuzador (duelista) | Afortunado | Fase 2, shiny 2 | 40×48 | Gacha, spark |
| 3★ | Umbreon `0197` | Siniestro | Guardia con apoyo | Sincronía | Fase 2, shiny 2 | 24×48 | Gacha, spark |
| 3★ | Lycanroc Crepuscular `0745/0002` | Roca | Escaramuzador | Garra Dura | Fase 2, shiny 2 | 48×56 | Gacha, spark |
| 3★ | Typhlosion de Hisui `0157/0001` | Fuego/Fantasma | A distancia, área | Mar Llamas | Fase 2, shiny 2 | 32×56 | Gacha, spark |
| 3★ | Dragapult `0887` | Dragón/Fantasma | A distancia, móvil | Allanamiento | Fase 1, shiny 1 | **48×72** | Gacha, spark |
| 3★ | Cresselia `0488` | Psíquico | Apoyo | Luna Creciente | Fase 2, shiny 2 | 48×64 | Gacha, spark |
| 2★ | Honedge `0679` | Acero/Fantasma | Guardia | Indefenso | Fase 2, shiny 2 | 32×56 | Gacha, spark, **tablón** |
| 2★ | Misdreavus `0200` | Fantasma | Controladora a distancia | Levitación | Fase 2, shiny 2 | 24×48 | Gacha, spark |
| 2★ | Banette `0354` | Fantasma | Truquista cuerpo a cuerpo | Cacheo | Fase 1, shiny 1 | 24×56 | Gacha, spark |
| 2★ | Sneasel `0215` | Siniestro/Hielo | Escaramuzador de combos | Hurto | Fase 2, shiny 0* | 32×56 | Gacha, spark |
| 2★ | Murkrow `0198` | Siniestro/Volador | Hostigador | Bromista | Fase 2, shiny 2 | 32×40 | Gacha, spark, **tablón** |
| 2★ | Lunatone `0337` | Roca/Psíquico | Controlador a distancia | Levitación + Eclipse | Fase 1, shiny 1 | 24×48 | Gacha, spark |
| 2★ | Solrock `0338` | Roca/Psíquico | Bruto | Levitación + Eclipse | Fase 1, shiny 1 | 32×48 | Gacha, spark |
| 1★ | Eevee `0133` | Normal | Todoterreno, apoyo ligero | Adaptable | Fase 2, shiny 2 | 24×32 | Gacha, spark |
| 1★ | Rockruff `0744` | Roca | Cuerpo a cuerpo sencillo | Impasible | Fase 2, shiny 2 | 32×48 | Gacha, spark |
| 1★ | Snorunt `0361` | Hielo | Controlador | Fuerza Mental | Fase 2, shiny 0* | 24×40 | Gacha, spark, **tablón** |
| 1★ | Charcadet `0935` | Fuego | Bruto aprendiz | Cuerpo Llama | Fase 2, shiny 2 | 24×48 | Gacha, spark |
| 1★ | Shinx `0403` | Eléctrico | Escaramuzador que entra y sale | Intimidación | Fase 2, shiny 2 | 40×48 | Gacha, spark |
| 1★ | Axew `0610` | Dragón | Cuerpo a cuerpo | Rompemoldes | Fase 2, shiny 2 | 32×40 | Gacha, spark |
| 1★ | Chimecho `0358` | Psíquico | Apoyo | Deseo Cura | Fase 1, shiny 1 | 24×48 | Gacha, spark |
| 1★ | Yamask `0562` | Fantasma | Controlador | Momia | Fase 1, shiny 1 | 24×56 | Gacha, spark |

\* **[V]** La hoja shiny de Sneasel y de Snorunt existe y tiene las 6 animaciones básicas propias (ver §5.1), pero el tracker la marca fase 0: falta mirarla a ojo antes de darla como skin.

**Cómo se comprobó [V]**: en los 21, `Idle`, `Walk`, `Attack`, `Shoot`, `Charge` y `Hurt` están en `AnimData.xml` como hojas propias, no como `CopyOf`. La "fase" es `sprite_complete` del tracker (2 = completo con extras, 1 = el juego estándar). Ojo con el tracker: los valores de `sprite_files` son el estado de bloqueo de cada hoja, no si existe, y la hoja shiny de la forma base cuelga de `subgroups["0000"].subgroups["0001"]`. Por eso se comprobó cada hoja contra `AnimData.xml`.

**Reparto [I]**:

- Papeles: 7 cuerpo a cuerpo rápidos (Absol, Lycanroc, Sneasel, Banette, Rockruff, Shinx, Axew), 4 a distancia (Typhlosion, Dragapult, Murkrow, Lunatone), 4 guardias o brutos (Umbreon, Honedge, Solrock, Charcadet), 4 controladores (Misdreavus, Snorunt, Yamask y, en parte, Lunatone), 3 apoyos (Cresselia, Chimecho, Eevee, más el Deseo de Umbreon). Hay al menos un apoyo en cada rareza, para que un grupo del chat lo tenga pronto.
- Tipos: Fantasma 6, Siniestro 4, Roca 4, Psíquico 4, Fuego 3, Dragón 2, Hielo 2, y Acero, Volador, Normal y Eléctrico. **Faltan** Agua, Planta, Lucha, Veneno, Hada, Tierra y Bicho como tipo propio (sí aparecen como movimientos de cobertura).
- Tema: la luna y el sol (Umbreon, Cresselia, Lunatone, Solrock, Lycanroc Crepuscular), el presagio y la desgracia (Absol, Murkrow), los fantasmas y las llamas que guían (Typhlosion de Hisui, Misdreavus, Banette, Yamask, Charcadet) y la historia ya escrita (Honedge con el Rey de las Espadas, Eevee como puerta de Umbreon).

**Descartados [V salvo que se diga]**: Shuppet y Marowak de Alola (`Shoot` es alias); Clefairy (no tiene `Shoot`); Natu y Sandygast (`Shoot` es copia de `Charge`); Zoroark, Lampent, Chandelure y Marowak (evolución de un inicial: se guardan para la sección "Evoluciones" del jugador si llega); Darkrai (legendario, 40×80, mejor como jefe del eclipse **[I]**). **Banquillo** con hoja completa: Espeon (fase 1), Froslass, Spiritomb, Mismagius (su `SpAttack` es alias), Sinistea, Rotom, Dreepy, Hatenna, Munna, Xatu, Mawile, Greavard y Morpeko (todos fase 1).

### 2.2 Legibilidad del sprite

**[V]** Los fotogramas de Idle de los iniciales miden de 24×32 (Zorua, Litwick) a 32×48 (Mimikyu); los enemigos llegan a 48×96 (Dhelmise). El tamaño del fotograma incluye margen: no es el tamaño del cuerpo.

**[I]** Reglas para que se lea en un directo comprimido (GDD §10):

1. El área de impacto es siempre el radio 10, se dibuje lo que se dibuje. En el menú de equipo y en el modo de práctica, un aro tenue enseña ese círculo.
2. Las balas enemigas se pintan **encima** de los jugadores. Si un sprite grande tapa una bala, el sprite se vuelve medio transparente mientras la tenga encima.
3. A vigilar con capturas a 720p: **Dragapult** (48×72, el más alto del plantel), **Cresselia** (48×64) y **Lycanroc** (48×56, Attack de 72×80). Si tapan demasiado, se dibujan al 85 %.
4. Los pequeños (Eevee 24×32, Snorunt 24×40) se pierden entre enemigos de su tamaño. Usan el mismo aro de color del jugador que los demás, sin excepciones.
5. Cuatro fantasmas oscuros juntos (Misdreavus, Banette, Yamask, Typhlosion de Hisui) se confunden con los enemigos de la Cripta. El color de jugador (aro y nombre) es obligatorio, y el shiny de cada uno se elige pensando en el contraste.

### 2.3 Fichas

Formato de cada ficha:

- **Cifras [I]**: PV y velocidad propuestos.
- **Pasiva [I]**: inspirada en una habilidad canónica (PokeAPI, **[V]** que la especie la tiene), adaptada al tiempo real. Si no sale de una habilidad, se dice.
- **Kit por defecto [I]**: rápida · fuerte · potenciación · área, con la forma. "(existe)" = lo que el motor ya sabe hacer; "(M*n*)" = mecánica nueva de §1.4.
- **Repertorio [V en el origen, I en la adaptación]**: movimientos que la especie aprende en el grupo de versiones indicado, con su origen y la ranura que ocuparía.
- **Build competitiva**: el set de Smogon **[V]** (formato, nombre del set y movimientos tal como los da la página) y cómo se lleva a cuatro ranuras **[I]**. Un set de cuatro movimientos de combate no cabe tal cual en cuatro ranuras de tipos distintos: se busca el mismo **plan** (preparar y barrer, ir y volver, desgastar), no los mismos cuatro nombres.

---

#### Absol · 3★ · Siniestro · escaramuzador (duelista)

- **Cifras**: 90 PV, velocidad 1,08.
- **Pasiva: Afortunado** (Super Luck). Los movimientos de "crítico alto" (Tajo Umbrío, Psicocorte, Cuchillada) tienen +20 % de probabilidad de crítico, y una esquiva perfecta deja el siguiente golpe en crítico seguro. La investigación proponía **Presagio** (ver cada aviso 0,2 s antes): lo descarto porque cambia la lectura de los ataques y un aviso más largo para uno solo rompe la idea de que todos juegan la misma pelea.
- **Kit por defecto**: Tajo Umbrío (arco de 120°, crítico alto; existe) · Psicocorte (media luna que vuela, cargable; existe) · Danza Espada (existe) · Pulso Umbrío (anillo; existe).
- **Repertorio** (Espada/Escudo, <https://pokeapi.co/api/v2/pokemon/absol>): Ataque Rápido (Nv; rápida, embestida corta) · Golpe Bajo (Nv; rápida, embestida, más daño si el enemigo está avisando) · Cuchillada (Nv; rápida) · Desarme (Nv; fuerte, arco; contra un élite le quita el afijo 5 s, M nueva menor) · A Bocajarro (MT; fuerte, arco; después recibes un 20 % más de daño durante 3 s) · Carantoña (MT; fuerte, cobertura Hada) · Cola Férrea (MT; fuerte) · Foco Energía (Nv; potenciación, +críticos) · Detección (Nv; potenciación: 0,3 s de esquiva perfecta garantizada, enfriamiento largo) · Alarido (MT; área, cono) · Premonición (Nv/MT; área, M3: marca el suelo, estalla a 1,5 s).
- **Build**: Smogon, National Dex RU, set *Swords Dance*: Swords Dance / Knock Off / Close Combat / Sucker Punch (con Play Rough o Iron Tail de alternativa), Magic Bounce y Absolita <https://www.smogon.com/dex/sv/pokemon/absol/>. Aquí: **Golpe Bajo · Desarme · Danza Espada · Premonición**, y A Bocajarro en la fuerte para quien quiera arriesgar. Preparas, castigas cada aviso con Golpe Bajo y dejas una Premonición donde va a estar el jefe.

#### Umbreon · 3★ · Siniestro · guardia con apoyo

- **Cifras**: 120 PV, velocidad 0,92.
- **Pasiva: Sincronía** (Synchronize). Cuando una esquiva perfecta absorbe un golpe, el atacante queda aturdido 0,5 s. En el original devuelve el estado que te ponen; aquí "devuelve" la esquiva.
- **Kit por defecto**: Mordisco (arco corto; existe) · Juego Sucio (embestida, más daño si el enemigo ataca; existe, el de Zorua) · Luz Lunar (potenciación: te cura un 20 %; M1) · Pulso Umbrío (anillo; existe).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/umbreon>): Ataque Rápido (Nv; rápida) · Buena Baza (Nv; rápida, más daño si el objetivo ya está aturdido) · Meteoros (Nv/MT; fuerte, proyectil que gira hacia el objetivo) · Bola Sombra (MT; fuerte) · Triturar (MT; fuerte) · Deseo (Nv en Eevee; potenciación, M1: a los 2 s cura un 25 % a quien esté en el sitio, tú o un aliado) · Protección (MT; potenciación, `guard` a 0 durante 0,4 s) · Refuerzo (Nv; potenciación, M2) · Rayo Confuso (Nv; área, cono que aturde) · Alarido (Nv; área) · Chirrido (Nv; área: los enemigos del anillo reciben un 25 % más de daño 4 s).
- **Build**: Smogon, OU, set *Defensive*: Foul Play / Wish / Protect / Thunder Wave o Toxic, Inner Focus, Restos <https://www.smogon.com/dex/sv/pokemon/umbreon/>. Aquí: **Mordisco · Juego Sucio · Deseo · Rayo Confuso**. Aguantas delante, castigas con Juego Sucio y el Deseo cae sobre el aliado que más lo necesita.

#### Lycanroc Crepuscular · 3★ · Roca · escaramuzador

- **Cifras**: 95 PV, velocidad 1,1.
- **Pasiva: Garra Dura** (Tough Claws, su única habilidad). Los movimientos de contacto (arco y embestida) hacen ×1,2.
- **Kit por defecto**: Roca Veloz (embestida con arranque mínimo; existe) · Roca Afilada (arco ancho, cargable, crítico alto; existe) · Aullido (potenciación `power` 2 golpes; existe; en M2 alcanza a los aliados) · Avalancha (cono; existe).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/lycanroc-dusk>): Ataque Rápido (Nv) · Mordisco (Nv) · Colmillo Ígneo, Colmillo Rayo y Psicocolmillo (MT; rápidas de cobertura) · Golpe Bajo (Nv; rápida) · Triturar (Nv; fuerte) · A Bocajarro (MT; fuerte) · Pataleta (MT; fuerte, doble si fallaste; existe) · Contraataque (Nv; potenciación: si te golpean en 0,4 s, devuelves el doble; M nueva menor) · Danza Espada (MT) · Tumba Rocas (Nv; área, M5) · Trampa Rocas (Nv; área, M6: piedras en el suelo).
- **Build**: Smogon, RU, set *Swords Dance*: Swords Dance / Close Combat / Stone Edge / Accelerock o Sucker Punch, Tough Claws, Vidasfera <https://www.smogon.com/dex/sv/pokemon/lycanroc-dusk/>. Aquí: **Roca Veloz · Roca Afilada · Danza Espada · Avalancha**, con A Bocajarro de alternativa en la fuerte. El kit por defecto ya es casi la build: es el 3★ más fácil de entender.

#### Typhlosion de Hisui · 3★ · Fuego/Fantasma · a distancia y área

- **Cifras**: 95 PV, velocidad 1.
- **Pasiva: Mar Llamas** (Blaze). Por debajo del 33 % de vida, los movimientos de Fuego hacen ×1,3. La alternativa es Cacheo (Frisk, la oculta), que ya lleva Banette.
- **Kit por defecto**: Ascuas (proyectil rápido; existe) · Marcha Espectral (proyectil, doble contra aturdidos; existe, como Infortunio) · Paz Mental (potenciación `power` para 3 golpes especiales; existe) · Estallido (anillo grande, **más daño cuanto más vida tienes**; M nueva menor: el poder depende de la vida).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/typhlosion-hisui>): Ataque Rápido (Nv) · Rueda Fuego (Nv; rápida, embestida) · Nitrocarga (Nv; rápida, embestida, sube la velocidad) · Bola Sombra (MT; fuerte) · Infortunio (MT; fuerte) · Sofoco (Nv/MT; fuerte muy potente, luego tus especiales bajan un 30 % durante 4 s) · Onda Certera (MT; fuerte, carga larga) · Fuego Fatuo (MT; potenciación, el `kindle` de Litwick) · Lanzallamas (Nv/MT; área, onda en línea; existe) · Onda Ígnea (MT; área, cono; existe) · Humareda (Nv; área, M6: anillo que deja el suelo ardiendo) · Giro Fuego (MT; área, M6).
- **Build**: Smogon, NU, set *All-out Attacker*: Eruption / Flamethrower / Shadow Ball / Focus Blast, Frisk, Botas Gruesas <https://www.smogon.com/dex/sv/pokemon/typhlosion-hisui/>. Aquí: **Ascuas · Bola Sombra · Paz Mental · Estallido**, con Lanzallamas en el área para quien juegue con poca vida. La tensión de Estallido (pega más si no te han tocado) encaja con un souls: jugar limpio paga.

#### Dragapult · 3★ · Dragón/Fantasma · a distancia y móvil

- **Cifras**: 90 PV, velocidad 1,12 (el tope).
- **Pasiva: Allanamiento** (Infiltrator). Tus golpes ignoran la mitad de la reducción de daño de escudos y guardias (el Escudo de Aegislash, las mejoras defensivas de los jefes). Es la mitad, no todo, para que rodear a Aegislash siga valiendo la pena. Cuerpo Maldito (la oculta) se descarta: necesita un enfriamiento por ataque en cada enemigo.
- **Kit por defecto**: Dracoflechas (dos proyectiles que salen a la vez y se abren un poco; M7) · Golpe Fantasma (desaparece 0,5 s y golpea donde apuntaste; no da invulnerabilidad contra ataques de zona; M nueva menor) · Danza Dragón (potenciación: `haste` más `power` para 2 golpes; combinación nueva de lo que existe) · Dragoaliento (cono que frena; M5).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/dragapult>): Impresionar (Nv; rápida) · Doble Golpe (Nv; rápida, dos golpes; existe) · Ida y Vuelta (Nv/MT; rápida: embestida que te devuelve a tu sitio) · Garra Dragón (MT; rápida) · Infortunio (Nv/MT; fuerte) · Cometa Draco (MT; fuerte enorme, luego tus especiales bajan 4 s) · Pulso Dragón (MT; fuerte) · Bola Sombra (MT; fuerte) · Agilidad (Nv/MT; potenciación `haste`) · Fuego Fatuo (MT; área: aturde 0,6 s en un cono) · Onda Trueno (MT; área) · Vasto Impacto (MT; área: los enemigos pegan un 20 % menos 5 s) · Lanzallamas (MT; área, cobertura).
- **Build**: Smogon, OU, set *Boots Pivot*: Dragon Darts o Draco Meteor / Hex / Will-O-Wisp o Thunder Wave / U-turn, Infiltrator <https://www.smogon.com/dex/sv/pokemon/dragapult/>. Aquí: **Ida y Vuelta · Infortunio · Agilidad · Fuego Fatuo**. Entras, aturdes, Infortunio pega doble y sales. Es el kit más técnico del plantel.

#### Cresselia · 3★ · Psíquico · apoyo

- **Cifras**: 115 PV, velocidad 0,95.
- **Pasiva: Luna Creciente** (no es una habilidad: su única habilidad es Levitación, que ya llevan otros tres). Cada vez que curas a un aliado, tu siguiente movimiento fuerte hace ×1,25. El apoyo también juega.
- **Kit por defecto**: Confusión (proyectil corto; existe) · Fuerza Lunar (proyectil grande, cargable; existe) · Luz Lunar (potenciación: te cura un 15 % a ti y un 10 % a los aliados cercanos; M1 y M2) · Plegaria Lunar (anillo que cura un 15 % a los aliados que toca; M1).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/cresselia>): Cuchillada (Nv; rápida) · Psicocorte (Nv; rápida, arco) · Psicorrayo (Nv/MT; fuerte, onda) · Psíquico (Nv/MT; fuerte) · Rayo Hielo y Rayo (MT; fuertes de cobertura) · Poder Reserva (MT; fuerte, más daño por cada mejora activa) · Paz Mental (MT; potenciación) · Premonición (Nv/MT; área, M3) · Rayo Aurora (Nv; área, onda que frena) · Espacio Raro (MT; área: durante 3 s las balas enemigas en el círculo van a la mitad; M5, a vigilar) · **Danza Lunar** (Nv; área: revive al instante a un aliado caído a tu lado y tú te quedas a 1 PV; un solo uso por planta).
- **Build**: Smogon, OU, set *Offensive Stored Power*: Calm Mind / Stored Power / Moonblast / Lunar Blessing, Levitate, Restos <https://www.smogon.com/dex/sv/pokemon/cresselia/>. Aquí: **Confusión · Poder Reserva · Paz Mental · Plegaria Lunar**. Para el directo, **Danza Lunar** es el momento del clip: alguien se sacrifica por el que acaba de caer.

#### Honedge · 2★ · Acero/Fantasma · guardia

- **Cifras**: 110 PV, velocidad 0,9.
- **Pasiva: Indefenso** (No Guard, su única habilidad). Tus fuertes no se pueden bloquear (atraviesan el Escudo de Aegislash), pero no tienes esquiva perfecta: la voltereta sigue dando invulnerabilidad, sin cámara lenta ni bonus. Un cambio de estilo claro.
- **Kit por defecto**: Sombra Vil (embestida corta; existe, el de Mimikyu) · Cabeza de Hierro (arco, cargable; existe) · Danza Espada (existe) · Giro Vil (anillo; existe).
- **Repertorio** (Espada/Escudo, <https://pokeapi.co/api/v2/pokemon/honedge>): Corte Furia (Nv; rápida, sube un 20 % con cada golpe seguido al mismo enemigo; M nueva menor) · Golpe Aéreo (Nv; rápida, embestida que se ajusta un poco al objetivo) · Cuchillada y Tajo Umbrío (Nv) · Garra Umbría (MT; rápida) · Espada Santa (Nv; fuerte, ignora las mejoras defensivas del enemigo) · Represalia (Nv/MT; fuerte, doble si un aliado cayó en esta sala) · Defensa Férrea (Nv/MT; potenciación `guard`) · Aligerar (Nv; potenciación `haste`) · Vasta Guardia (H; potenciación: escudo delante que para balas 1 s; M nueva) · Avalancha (MT; área, cono) · Metaláser (Tu; área, onda en línea muy fuerte que te quita un 25 % de vida).
- **Build**: Smogon, Little Cup de Sol/Luna, set *Offensive*: Shadow Sneak / Iron Head / Sacred Sword o Rock Slide / Pursuit o Swords Dance, No Guard, Mineral Evolutivo <https://www.smogon.com/dex/sm/pokemon/honedge/>. No hay set de Escarlata/Púrpura **[V]** (no está en esa generación en PokeAPI). Aquí: **Sombra Vil · Espada Santa · Danza Espada · Avalancha**.
- **Tablón**: "Vence al Rey de las Espadas en Difícil" (engancha con su historia).

#### Misdreavus · 2★ · Fantasma · controladora a distancia

- **Cifras**: 90 PV, velocidad 1,02.
- **Pasiva: Levitación** (Levitate, su única habilidad). Flotas sobre charcos, lodo y trampas del suelo que **no** sean ataques de zona (`pierceRoll`): esos te afectan igual, para no saltarse la regla 5 de la dificultad.
- **Kit por defecto**: Impresionar (susto a bocajarro que aturde; existe, el de Litwick) · Infortunio (doble contra aturdidos; existe) · Divide Dolor (potenciación: recuperas un 12 % y el enemigo fijado pierde lo mismo; M1) · Canto Mortal (área, M3: marca a los enemigos del anillo, que reciben un golpe fuerte a los 3 s).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/misdreavus>): Confusión (Nv; rápida, proyectil) · Sombra Vil (H; rápida) · Bola Sombra (Nv/MT; fuerte) · Psicorrayo (Nv/MT; fuerte, onda) · Joya de Luz (Nv/MT; fuerte, cobertura Roca) · Rayo (MT; fuerte) · Maquinación (MT; potenciación, la de Zorua) · Paz Mental (MT) · Rayo Confuso (Nv/MT; área) · Fuego Fatuo (MT; área, aturde) · Brillo Mágico (MT; área, anillo) · Viento Hielo (MT; área, M5).
- **Build**: Smogon, ZU de Sol/Luna, set *Utility*: Foul Play o Hex / Will-O-Wisp / Taunt / Pain Split, Levitate, Mineral Evolutivo <https://www.smogon.com/dex/sm/pokemon/misdreavus/>. En Escarlata/Púrpura su página no tiene sets **[V]**. Aquí: **Impresionar · Infortunio · Divide Dolor · Fuego Fatuo**. Es la más "Touhou": aturdir y castigar desde lejos.

#### Banette · 2★ · Fantasma · truquista cuerpo a cuerpo

- **Cifras**: 95 PV, velocidad 1.
- **Pasiva: Cacheo** (Frisk). Ves encima de cada enemigo el objeto que soltará. Información pura, sin poder; queda bien en directo ("ese lleva la llave").
- **Kit por defecto**: Garra Umbría (arco; existe) · Desarme (arco fuerte, cargable; existe sin el efecto de afijo) · Danza Espada (MT; existe) · Maldición (área: pierdes un 20 % de vida y los enemigos del anillo reciben daño cada segundo durante 5 s; M6 en versión "sobre el enemigo").
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/banette>): Sombra Vil (Nv; rápida) · Golpe Bajo (Nv; rápida) · Golpe Mordaza (MT; rápida) · Tinieblas (Nv; fuerte, proyectil de daño fijo) · Bola Sombra (Nv/MT; fuerte) · Golpe Fantasma (Nv/MT; fuerte, como el de Dragapult) · Poltergeist (MT; fuerte, más daño si el enemigo lleva objeto, que ves gracias a Cacheo) · Lanzamugre (MT; fuerte, cobertura Veneno) · Infortunio (Nv/MT; fuerte) · Fuego Fatuo (Nv/MT; área) · Chirrido (Nv; área).
- **Build**: Smogon, PU de Sol/Luna, set *Offensive*: Shadow Claw / Knock Off o Gunk Shot / Will-O-Wisp / Sucker Punch o Shadow Sneak, Insomnia, Vidasfera <https://www.smogon.com/dex/sm/pokemon/banette/>. Aquí: **Golpe Bajo · Desarme · Danza Espada · Fuego Fatuo**. Primo temático de Mimikyu (el muñeco abandonado).

#### Sneasel · 2★ · Siniestro/Hielo · escaramuzador de combos

- **Cifras**: 85 PV, velocidad 1,12.
- **Pasiva: Hurto** (Pickpocket, la oculta). El primer enemigo que tumbas en cada sala suelta una baya. Toca un poco los objetos, no las Pokémonedas; a medir en el arnés.
- **Kit por defecto**: Esquirla Helada (embestida con arranque mínimo; existe) · Triple Axel (tres golpes en arco que suben de fuerza; existe con `multiHit`, falta que suba) · Afilagarras (potenciación: `power` 2 golpes y +críticos; existe) · Viento Hielo (cono que frena; M5).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/sneasel>): Arañazo y Ataque Rápido (Nv) · Golpes Furia (Nv; rápida, cinco golpes; existe, el de Zorua) · Garra Metal y Cuchillada (Nv/MT) · Puño Hielo (MT; rápida) · Carámbano (MT; rápida, varios proyectiles pequeños; M7) · Desarme (MT; fuerte) · Patada Baja (MT; fuerte, más daño cuanto más grande es el enemigo) · Danza Espada (MT) · Agilidad (Nv/MT) · Alud (MT; área, doble si te golpearon justo antes) · Ventisca (MT; área, anillo grande).
- **Build**: Smogon, PU, set *Swords Dance*: Swords Dance / Triple Axel / Knock Off / Ice Shard, Inner Focus, Botas Gruesas <https://www.smogon.com/dex/sv/pokemon/sneasel/>. Aquí: **Esquirla Helada · Triple Axel · Danza Espada · Viento Hielo**, y Desarme en la fuerte contra élites.

#### Murkrow · 2★ · Siniestro/Volador · hostigador

- **Cifras**: 85 PV, velocidad 1,08.
- **Pasiva: Bromista** (Prankster, la oculta). Tus potenciaciones salen sin arranque y se enfrían un 20 % antes. Sustituye al "+10 % de Pokémonedas" de la investigación (Afortunado), para no tocar la economía.
- **Kit por defecto**: Picotazo (arco corto; existe) · Ataque Ala (embestida larga, cargable; existe) · Maquinación (existe) · Tajo Aéreo (abanico de tres proyectiles; existe como tres proyectiles si M7 está, si no, cono).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/murkrow>): Impresionar y Tornado (Nv; rápidas, proyectil) · Golpe Bajo (Nv; rápida) · Tinieblas (Nv; fuerte) · Juego Sucio (Nv; fuerte) · Pájaro Osado (H/MT; fuerte, embestida con retroceso) · Vendaval (MT; fuerte, proyectil grande y lento) · Ida y Vuelta (MT; rápida) · Viento Afín (MT; potenciación, M2: el grupo anda un 20 % más rápido 6 s) · Danza Pluma (H/MT; área, los enemigos pegan un 25 % menos) · Pulso Umbrío y Onda Ígnea (MT; área) · **Niebla** (Nv; área, M4, enfriamiento de 25 s).
- **Build**: Smogon, NFE, set *Nasty Plot*: Nasty Plot / Hurricane / Dark Pulse / Heat Wave, Super Luck, Mineral Evolutivo <https://www.smogon.com/dex/sv/pokemon/murkrow/>. Aquí: **Tornado · Vendaval · Maquinación · Pulso Umbrío**.
- **Tablón**: "Llega a la planta 20 de la Sima" (de la investigación).

#### Lunatone · 2★ · Roca/Psíquico · controlador a distancia

- **Cifras**: 105 PV, velocidad 0,95.
- **Pasiva: Levitación + Eclipse**. Levitación como Misdreavus. **Eclipse** (no es una habilidad, sale de la pareja canónica): con un Solrock aliado a 120 px o menos, los dos hacen ×1,15. En solitario solo queda Levitación, que ya es útil en el Pantano.
- **Kit por defecto**: Confusión (proyectil; existe) · Fuerza Lunar (proyectil grande, cargable; existe) · Masa Cósmica (potenciación `guard`; existe) · Premonición (área, M3: marca el suelo bajo el objetivo, estalla a 1,5 s).
- **Repertorio** (Espada/Escudo, <https://pokeapi.co/api/v2/pokemon/lunatone>): Lanzarrocas (Nv; rápida) · Psicocarga (Nv/MT; fuerte) · Psíquico (Nv/MT) · Joya de Luz (MT; fuerte) · Tierra Viva (MT; fuerte, cobertura Tierra) · Rayo Hielo (MT) · **Rayo Meteórico** (Tu; fuerte de carga larga que, al soltar, te da `power` para el siguiente) · Luz Lunar (Nv; potenciación, M1) · Pulimento (Nv; potenciación `haste`) · Paz Mental (MT) · Hipnosis (Nv; área, cono que aturde 1 s tras un aviso propio) · Avalancha (Nv/MT; área) · Trampa Rocas (MT; área, M6).
- **Build**: Smogon, ZU de Espada/Escudo, set *Meteor Beam*: Meteor Beam / Psyshock / Earth Power / Rock Polish o Stealth Rock, Levitate, Hierba Única <https://www.smogon.com/dex/ss/pokemon/lunatone/>. Aquí: **Confusión · Rayo Meteórico · Pulimento · Premonición**.

#### Solrock · 2★ · Roca/Psíquico · bruto

- **Cifras**: 115 PV, velocidad 0,92.
- **Pasiva: Levitación + Eclipse**, la misma de Lunatone.
- **Kit por defecto**: Cabezazo Zen (arco; existe) · Envite Ígneo (embestida cargable que te quita un 8 % de vida; existe salvo el retroceso) · Sol Matinal (potenciación: te cura un 20 %; M1) · Avalancha (cono; existe).
- **Repertorio** (Espada/Escudo, <https://pokeapi.co/api/v2/pokemon/solrock>): Placaje y Lanzarrocas (Nv) · Roca Afilada (Nv/MT; fuerte) · Cabeza de Hierro (MT; fuerte) · Pataleta (MT; fuerte; existe) · Rayo Solar (Nv/MT; fuerte de carga larga) · Masa Cósmica (Nv/MT) · Defensa Férrea (MT) · Danza Espada (MT) · Pulimento (Nv) · Fuego Fatuo (MT; área) · Terremoto y Terratemblor (MT; área; existen, los de Cubone) · Trampa Rocas (MT; área, M6).
- **Build**: Smogon, ZU de Espada/Escudo, set *Physical Wall*: Morning Sun / Stealth Rock / Will-O-Wisp / Rock Slide, Levitate, Casco Dentado <https://www.smogon.com/dex/ss/pokemon/solrock/>. Aquí: **Cabezazo Zen · Envite Ígneo · Sol Matinal · Fuego Fatuo** (y Trampa Rocas cuando exista M6).
- **Conflicto [V]**: `docs/species-candidates.md` propone a Lunatone y a Solrock como enemigos del "Observatorio Destrozado" (mazmorra sin hacer). Propongo que sean jugables y que el observatorio use a Bronzor, Elgyem y Beldum, que ya están en esa misma lista. Es una de las preguntas del final.

#### Eevee · 1★ · Normal · todoterreno con apoyo ligero

- **Cifras**: 95 PV, velocidad 1,02.
- **Pasiva: Adaptable** (Adaptability). Tu STAB es ×1,5 en vez del normal (`combat.stab`). Como solo tiene un tipo y casi todo su repertorio es Normal, compensa la falta de cobertura.
- **Kit por defecto**: Placaje (arco; existe) · Derribo (embestida cargable con poco retroceso; existe salvo el retroceso) · Refuerzo (potenciación `power` 2 golpes, que con M2 alcanza también al aliado más cercano) · Vozarrón (cono; existe).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/eevee>): Ataque Rápido (Nv) · Mordisco (Nv) · Meteoros (Nv/MT; fuerte) · Doble Filo (Nv/MT; fuerte con retroceso) · Bola Sombra (MT) · Poder Reserva (MT) · **Última Baza** (Nv; fuerte: solo se puede usar tras haber usado tus otros tres movimientos en la sala) · Excavar (MT; fuerte: te escondes 0,6 s y sales debajo del objetivo; no esquiva ataques de zona) · Deseo (H; potenciación, M1) · Paz Mental (MT) · Maldición (H; potenciación: `power` y `guard`, pero andas un 20 % más lento) · Ojitos Tiernos (Nv; área, los enemigos pegan un 20 % menos).
- **Build**: Smogon, Battle Spot Singles de Sol/Luna, set *Extreme Evoboost*: Last Resort / Baton Pass / Substitute o Protect / Stored Power, Anticipation, Eevium Z <https://www.smogon.com/dex/sm/pokemon/eevee/>. Es el único set que tiene **[V]**. Aquí: **Ataque Rápido · Última Baza · Paz Mental · Vozarrón**. Lo divertido es Última Baza: obliga a usar todo el kit.

#### Rockruff · 1★ · Roca · cuerpo a cuerpo sencillo

- **Cifras**: 100 PV, velocidad 1,05.
- **Pasiva: Impasible** (Steadfast, la oculta). Cuando te golpean, andas un 15 % más rápido durante 3 s, para salir del siguiente golpe. La investigación proponía Vista Lince (ignorar la niebla del Bosque): queda como alternativa, pero solo sirve en una mazmorra.
- **Kit por defecto**: Mordisco (arco; existe) · Lanzarrocas (proyectil cargable; existe) · Aullido (potenciación `power`; existe; con M2 alcanza al grupo) · Tumba Rocas (cono; existe sin el frenado; con M5, frena).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/rockruff>): Placaje (Nv) · Colmillo Ígneo, Colmillo Rayo y Psicocolmillo (MT; rápidas) · Triturar (Nv/MT; fuerte) · Roca Afilada (Nv/MT; fuerte) · Pataleta (MT; fuerte; existe) · Danza Espada (MT) · Doble Equipo (Nv; potenciación: deja un señuelo que atrae al siguiente ataque; M nueva) · Avalancha (Nv/MT; área) · Ataque Arena (Nv; área: cono que aturde 0,4 s) · Trampa Rocas (Nv/MT; área, M6).
- **Build**: Smogon, Little Cup de Sol/Luna, set *All-out Attacker*: Stone Edge / Stomping Tantrum / Zen Headbutt o Fire Fang / Sucker Punch, Vital Spirit, Vidasfera <https://www.smogon.com/dex/sm/pokemon/rockruff/>. Golpe Bajo y Cabezazo Zen no están en su repertorio de Escarlata/Púrpura **[V]**. Aquí: **Colmillo Ígneo · Roca Afilada · Danza Espada · Avalancha**, con Pataleta en la fuerte. Es el "Lycanroc pequeño": un 1★ que enseña el 3★.

#### Snorunt · 1★ · Hielo · controlador

- **Cifras**: 95 PV, velocidad 1.
- **Pasiva: Fuerza Mental** (Inner Focus). Mientras cargas un movimiento fuerte, no te tambaleas al recibir un golpe (el daño entra igual). La investigación proponía "Gélido: frenas a quien te toca", pero Gélido (Ice Body) cura con granizo y no tenemos clima.
- **Kit por defecto**: Nieve Polvo (proyectil corto; existe; con M5, frena) · Vaho Gélido (cono corto cargable, **siempre crítico**; existe con un cambio menor) · Protección (potenciación `guard` a 0 durante 0,4 s; existe) · Viento Hielo (cono que frena; M5).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/snorunt>): Impresionar (Nv) · Golpe Cabeza (Nv; rápida, arco que aturde) · Esquirla Helada (Nv; rápida) · Mordisco y Colmillo Hielo (Nv) · Carámbano (MT; rápida, M7) · Triturar (Nv/MT; fuerte) · Rayo Hielo (MT; fuerte, onda) · Bola Sombra e Infortunio (MT; fuertes de cobertura) · Meteorobola (Nv/MT; fuerte) · Ventisca (Nv/MT; área, anillo) · Alud (MT; área) · Púas (MT; área, M6).
- **Build**: Smogon, Little Cup de Sol/Luna, set *Scarf Spikes*: Spikes / Frost Breath / Shadow Ball / Hidden Power, Inner Focus, Pañuelo Elección <https://www.smogon.com/dex/sm/pokemon/snorunt/>. Aquí: **Nieve Polvo · Vaho Gélido · Protección · Púas**.
- **Tablón**: "Captura las cuatro cartas de Aegislash" (de la investigación).

#### Charcadet · 1★ · Fuego · bruto aprendiz

- **Cifras**: 105 PV, velocidad 0,95.
- **Pasiva: Cuerpo Llama** (Flame Body, la oculta). Un enemigo que te golpea cuerpo a cuerpo recibe 10 de daño de Fuego. Absorbe Fuego (la otra) ya la tiene Litwick.
- **Kit por defecto**: Ascuas (proyectil rápido; existe) · Nitrocarga (embestida cargable; al acertar andas un 15 % más rápido 4 s; existe salvo el efecto) · Aguante (potenciación: durante 1,5 s no puedes bajar de 1 PV; enfriamiento 25 s; M nueva menor) · Humareda (anillo que deja el suelo ardiendo; M6).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/charcadet>): Impresionar (Nv; rápida) · Tinieblas (Nv/MT; fuerte) · Envite Ígneo (MT; fuerte con retroceso) · Llamarada (MT; fuerte) · Sofoco (MT; fuerte) · Fuego Fatuo (Nv/MT; potenciación, `kindle` de Litwick) · Mismo Destino (H; potenciación: si caes en los 3 s siguientes, quien te tumbó pierde un 25 % de su vida) · Niebla Clara (Nv; área: nube) · Giro Fuego (Nv/MT; área, M6) · Calcinación (Nv; área, cono) · Lanzallamas y Onda Ígnea (MT; área) · Rayo Confuso (MT; área).
- **Build**: **no hay set de Smogon en ninguna generación [V]** (Sol/Luna no existía; en Escarlata/Púrpura su página no tiene estrategias). Propuesta **[I]**, con el plan de sus evoluciones: **Ascuas · Nitrocarga · Aguante · Humareda**, un bruto que aguanta en la zona que él mismo quema.

#### Shinx · 1★ · Eléctrico · escaramuzador que entra y sale

- **Cifras**: 95 PV, velocidad 1,05.
- **Pasiva: Intimidación** (Intimidate). Al entrar en una sala, los enemigos a 150 px pegan un 15 % menos durante 5 s. No se acumula con otro Shinx del grupo.
- **Kit por defecto**: Chispa (embestida corta; existe) · Voltio Cruel (embestida cargable con retroceso del 8 %; existe salvo el retroceso) · Carga (potenciación: el siguiente movimiento Eléctrico ×2; existe como `power` de 1 golpe) · Chispazo (anillo; existe).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/shinx>): Placaje (Nv) · Impactrueno (Nv; rápida, proyectil) · Mordisco y Triturar (Nv) · Colmillo Ígneo y Colmillo Hielo (MT; rápidas de cobertura) · **Voltiocambio** (Nv/MT; rápida: proyectil que, si acierta, te deja rodar sin gastar estamina) · Rayo (MT; fuerte, proyectil) · Bola Voltio (MT; fuerte, más daño cuanto más rápido andas) · Onda Trueno (Nv/MT; área, cono que aturde 0,6 s) · Electrotela (MT; área, M5) · Rugido (Nv; área: empuja a los enemigos).
- **Build**: Smogon, Little Cup de Sol/Luna, set *Pivot*: Volt Switch / Wild Charge / Thief / Fire Fang o Ice Fang, Intimidate, Baya Zumo <https://www.smogon.com/dex/sm/pokemon/shinx/>. Aquí: **Voltiocambio · Voltio Cruel · Carga · Onda Trueno**.

#### Axew · 1★ · Dragón · cuerpo a cuerpo

- **Cifras**: 100 PV, velocidad 1.
- **Pasiva: Rompemoldes** (Mold Breaker). Tus golpes cuentan el doble para hacer trastabillar a élites y jefes (el aplomo). Distinta de Allanamiento (Dragapult atraviesa el bloqueo, Axew rompe el aplomo).
- **Kit por defecto**: Garra Dragón (arco; existe) · Enfado (tres tajos cargables seguidos; al acabar te tambaleas 0,4 s; existe con `multiHit` más un coste nuevo menor) · Danza Dragón (potenciación `haste` + `power`, como Dragapult) · Vasto Impacto (cono; los enemigos pegan un 20 % menos 5 s; existe salvo el efecto).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/axew>): Arañazo, Mordisco y Cuchillada (Nv) · Buena Baza (Nv; rápida) · **Escaramuza** (H; rápida: muy fuerte, pero solo el primer golpe de cada sala) · Ráfaga Escamas (MT; rápida, varios proyectiles; M7) · Triturar (Nv/MT) · Cabeza de Hierro (MT; fuerte) · Pulso Dragón (Nv/MT; fuerte, proyectil) · Cola Dragón (MT; fuerte, empuja lejos) · Pataleta (MT) · Danza Espada y Foco Energía (Nv/MT) · Terratemblor (MT; área).
- **Build**: Smogon, Little Cup, set *Dragon Dance*: Dragon Dance / Outrage / Stomping Tantrum o Iron Head / First Impression o Substitute, Unnerve, Mineral Evolutivo <https://www.smogon.com/dex/sv/pokemon/axew/>. Aquí: **Escaramuza · Enfado · Danza Dragón · Vasto Impacto**.

#### Chimecho · 1★ · Psíquico · apoyo

- **Cifras**: 100 PV, velocidad 0,95.
- **Pasiva: Deseo Cura** (no es una habilidad, sale de su movimiento de nivel 1; su habilidad es Levitación). En cooperativo, al caer, el aliado más cercano recupera toda la vida. En solitario, una vez por partida, el golpe que te tumbaría te deja a 1 PV.
- **Kit por defecto**: Confusión (proyectil corto; existe) · Paranormal (onda que atraviesa, cargable; existe) · Paz Mental (existe) · Cascabel Cura (anillo que cura un 10 % a los aliados y un 5 % a ti; M1 y M2).
- **Repertorio** (Escarlata/Púrpura, <https://pokeapi.co/api/v2/pokemon/chimecho>): Impresionar (Nv) · Psicorrayo (MT; fuerte) · Psíquico y Psicocarga (MT; fuertes) · Poder Reserva (Nv/MT) · Pulso Cura (Nv; fuerte: proyectil que cura al primer aliado que toca, sin daño; M1) · Recuperación (H; potenciación, te cura un 25 %, enfriamiento largo) · Pantalla de Luz y Reflejo (MT; potenciación, M2: el grupo recibe un 20 % menos de daño 5 s) · Bostezo (Nv; área: el enemigo marcado queda aturdido 1,5 s **al cabo de 2 s**) · Brillo Mágico (MT; área) · Espacio Raro (MT; área, como Cresselia).
- **Build**: Smogon, PU de Sol/Luna, set *Supporter*: Healing Wish o Defog / Recover / Psychic / Thunder Wave o Taunt, Levitate <https://www.smogon.com/dex/sm/pokemon/chimecho/>. Aquí: **Confusión · Psíquico · Recuperación · Cascabel Cura**. Es el apoyo que casi seguro tiene alguien en el chat.

#### Yamask · 1★ · Fantasma · controlador

- **Cifras**: 105 PV, velocidad 0,9.
- **Pasiva: Momia** (Mummy, su única habilidad). El enemigo que te toca cuerpo a cuerpo queda marcado: tu siguiente golpe contra él es crítico.
- **Kit por defecto**: Impresionar (existe) · Tinieblas (proyectil de daño fijo, sin tipos; existe con un cambio menor) · Protección (existe) · **Niebla** (área, M4: borra las balas enemigas en un radio de 90 px; 40 de estamina y 25 s de enfriamiento).
- **Repertorio** (Espada/Escudo, <https://pokeapi.co/api/v2/pokemon/yamask>): Infortunio (Nv/MT; fuerte) · Bola Sombra (Nv/MT; fuerte) · Pulso Umbrío (Nv/MT; área) · **Poltergeist** (Tu; fuerte) · Fuego Fatuo (Nv/MT; área) · Anulación (Nv; área: el enemigo marcado no puede usar su siguiente ataque; M nueva) · Mal de Ojo (Nv; área: el enemigo marcado no puede huir de su sitio 3 s) · Maldición (Nv; área, como Banette) · Mismo Destino (Nv; potenciación) · Maquinación y Paz Mental (MT) · Defensa Férrea (MT) · Púas Tóxicas (MT; área, M6).
- **Build**: Smogon, Little Cup de Sol/Luna, set *Support*: Will-O-Wisp / Hex / Knock Off / Toxic Spikes, Mummy, Mineral Evolutivo <https://www.smogon.com/dex/sm/pokemon/yamask/>. Desarme no está en su repertorio de Espada/Escudo **[V]**. Aquí: **Impresionar · Infortunio · Niebla · Fuego Fatuo**. Es el 1★ que más clips puede dar: borra la mitad de una carta de hechizo en el momento justo.

---

## 3. Primera temporada de banners

**[I]** Las reglas de la investigación (A2.2) siguen igual: el banner permanente **"Luna nueva"** tiene a los 21, siempre. El rotatorio **"Eclipse"** destaca un 3★ y un 2★ y **no tiene nada exclusivo**. El pity y los sellos son del jugador, no del banner.

Una diferencia: para la primera temporada propongo una **lista fija de siete semanas**, con nombre y tema, en lugar de una semilla de la fecha. Así un streamer puede anunciar "la semana que viene, Dragapult" y el chat lo espera, sin cuenta atrás ni presión. Después de la séptima semana se vuelve a la semilla de la fecha de la investigación.

| Semana | Nombre | 3★ destacado | 2★ destacado | Por qué juntos |
|---|---|---|---|---|
| 1 | Presagio | Absol | Murkrow | Los dos traen la desgracia; cuerpo a cuerpo y hostigador |
| 2 | Luna llena | Umbreon | Misdreavus | Noche y fantasmas; guardia y controladora |
| 3 | Crepúsculo | Lycanroc Crepuscular | Sneasel | Dos cuerpo a cuerpo rápidos. Lycanroc no pide mecánicas nuevas: buena semana para estrenar |
| 4 | Llama errante | Typhlosion de Hisui | Banette | Los fuegos que guían a los perdidos (la llama de Litwick en el Lago Negro) |
| 5 | Eclipse total | Cresselia | Lunatone | La luna. Aquí se estrena la pasiva Eclipse |
| 6 | Corona solar | Dragapult | Solrock | El sol; con Lunatone de la semana anterior, el chat ya puede juntar la pareja |
| 7 | El Rey de las Espadas | El 3★ que vote el chat | Honedge | Cierre con la historia de la Cripta |

**[I]** Orden y riesgo técnico: las semanas 1 y 3 necesitan pocas mecánicas nuevas (Absol pide M3 solo en lo aprendible), y la 5 y la 6 son las que más piden (curas, aura, varios proyectiles). Si el motor no llega a tiempo, se cambian de sitio las semanas, no se recortan los kits.

### 3.1 Tasas por Pokémon (las que enseña el puesto)

**[I]** Con los números de la investigación: 3★ al 4 %, 2★ al 20 %, 1★ al 76 %. El destacado pesa el doble dentro de su rareza.

| | Sin destacado | En el Eclipse, el destacado | En el Eclipse, cada uno de los demás |
|---|---|---|---|
| Cada 3★ (6) | 0,67 % | 1,14 % | 0,57 % |
| Cada 2★ (7) | 2,86 % | 5 % | 2,5 % |
| Cada 1★ (8) | 9,5 % | — | 9,5 % |

La protección contra repetidos cambia la tasa real (mientras te falte alguno de una rareza, te sale uno que no tienes). El puesto lo dice en una línea, junto a la tabla: "Mientras te falten 3★, el 3★ que salga será uno nuevo".

### 3.2 Pity y spark, con este plantel

**[V] Simulado** (Python, 20 000 semillas, las reglas exactas de A2.3: 3★ al 4 %, +6 puntos por tirada desde la 31, garantía en la 40; 2★ al 20 % y al menos uno cada 10; protección contra repetidos; un sello por tirada y spark a 60; el spark se gasta primero en el objetivo y si no, en un 3★ que falte):

| Pregunta | Mediana | Percentil 90 | Peor caso |
|---|---|---|---|
| Tiradas hasta el primer 3★ | 17 | — | 40 (pity) |
| Tiradas hasta un 3★ concreto, sin destacar | 60 | 60 | 60 (spark) |
| Tiradas hasta un 3★ concreto, destacado | 43 | 60 | 60 (spark) |
| Tiradas hasta completar los 21 | 94 | 120 | 152 |
| Esquirlas al completar la colección | 495 | — | — |

**[I]** A 100 P por tirada, la colección completa cuesta unas 9400 P de mediana (unas 57 victorias en Fácil o 26 en Pesadilla, con las 165 P y el ×2,2 de la GDD §11). Es casi el doble de comprar todas las mejoras (5000 P). Si parece mucho, la palanca es el precio (80 P baja todo un 20 %), no las tasas, como ya decía la investigación. Sin destacado, el spark es quien trae casi siempre un 3★ concreto: es lo que se quiere, porque así nadie depende de la suerte para su favorito.

---

## 4. Cómo se consigue cada Pokémon

**[I]**

- **Gacha** (permanente y Eclipse): los 21.
- **Spark** (60 sellos lunares): cualquiera de los 21.
- **Tablón de encargos**, sin dados y una sola vez (también salen en el gacha):
  - Snorunt (1★): capturar las cuatro cartas de Aegislash.
  - Murkrow (2★): llegar a la planta 20 de la Sima.
  - Honedge (2★): vencer al Rey de las Espadas en Difícil.
  - Si te sale antes en el gacha, el encargo da 1 ticket de tirada en su lugar. Así nunca da un repetido.
- **Regalo de bienvenida**: al abrir el puesto por primera vez, 3 tickets (no un Pokémon a elegir: los iniciales ya son la elección gratis).
- **Hitos** (de la investigación, A2.1): tickets por primeras victorias y récords. Nunca diarios.

---

## 5. Repetidos y esquirlas

**[I]** Las cantidades de la investigación se quedan: un repetido da **5** esquirlas (1★), **15** (2★) o **40** (3★). La simulación da unas **495 esquirlas** de mediana al completar los 21.

Qué compran, en el puesto o en el tutor:

| Qué | Coste | Por qué |
|---|---|---|
| Aprender ya un movimiento **Nv** que aún no has ganado jugando | 10 | Es un atajo: jugando con el Pokémon también llega |
| Un movimiento **MT**, **H** o **Tu** en el tutor sin pagar Pokémonedas | 20 | El tutor también lo vende en P (precio a fijar en su documento) |
| Skin shiny de un Pokémon que tienes (1★, 2★ o 3★) | 60 / 90 / 120 | La otra vía al shiny, sin azar (§5.1) |
| Tinte de paleta (aro del jugador, nombre, estela) | 20 | Cosmético |
| Variantes que ya hay en SpriteCollab (Mimikyu "Busted", Zorua de Hisui) | 80 | De la investigación, A2.5 |
| **Canje**: 10 esquirlas → 1 sello lunar | 10 | Para que los repetidos sigan valiendo algo cuando ya lo tienes todo |

Reglas **[I]**:

1. **Ningún movimiento solo se consigue con repetidos.** Todo movimiento **Nv** se gana jugando con el Pokémon y todo **MT/H/Tu** se compra en el tutor con Pokémonedas. Las esquirlas solo adelantan. Si no, un repetido valdría poder, aunque sea "otra forma" de jugar.
2. Nunca estadísticas (A2.5, regla 5 de A2.7).
3. El canje a sellos tiene tope: como mucho 20 sellos por temporada salen de esquirlas, para que el spark siga siendo "60 tiradas" y no "40 tiradas y repetidos".
4. Las esquirlas no se compran con Pokémonedas: si se pudiera, serían otra moneda en capas, que es justo lo que la investigación quiere evitar (A1, punto 2).

### 5.1 Shiny: una skin que sale en la tirada

Decisión tuya: una tirada puede dar la variante shiny, y el shiny es una **skin cosmética** que se pone o se quita por Pokémon cuando quieras, en la pantalla de equipo o en la colección. Sin estadísticas.

**Hojas [V]** (comprobado hoy en `sprite/<dex>/<forma>/0001/`): los 21 tienen `AnimData.xml` de shiny con `Idle`, `Walk`, `Attack`, `Shoot`, `Charge` y `Hurt` propios (ninguno es `CopyOf`) y el `Idle-Anim.png` existe. Fase del shiny en el tracker: 2 en los de fase 2, 1 en los de fase 1, y **0 en Sneasel y Snorunt**. Esos dos tienen las hojas, pero hay que mirarlas a ojo; si están a medias, su shiny sale "Próximamente" en la colección y la tirada no lo da hasta que esté.

**Probabilidad [I]**:

- **2,5 % por tirada** (1 de cada 40), igual para todas las rarezas, y se tira aparte de la rareza: el shiny es del Pokémon que te haya salido.
- **Pity de shiny**: si llevas 80 tiradas sin shiny, la siguiente lo es. Como el pity de rareza, es del jugador, no del banner, no caduca y se ve en el puesto ("shiny garantizado en 23 tiradas").
- **Sin azar**: la skin de un Pokémon que tienes se compra con esquirlas (60 / 90 / 120 según la rareza, tabla de arriba).
- **[V] Simulado** (20 000 semillas, estas reglas): en las 94 tiradas de una colección completa salen 2 shinies de mediana (2,6 de media), y el primero llega en la tirada 28 de mediana.

**Qué pasa según lo que ya tengas [I]**:

| Te sale | Resultado |
|---|---|
| Shiny de un Pokémon que no tenías | El Pokémon y su skin shiny, que se pone sola |
| Shiny de uno que tienes sin skin | Desbloqueas la skin, y además las esquirlas de repetido de siempre |
| Shiny de uno que ya tiene la skin | Las esquirlas de repetido y 10 más |

La animación de tirada lo enseña con un destello propio **desde el principio**, igual que la rareza: nada de "casi shiny".

**Cómo se guarda [I]**: en el guardado, dentro de la colección, `collection[especie].skins` es la lista de skins que tienes (`['normal', 'shiny']`) y `collection[especie].skin` la que llevas puesta. El campo es una lista, no un booleano, para que quepan más adelante las variantes de §5 (Mimikyu "Busted", Zorua de Hisui) y los tintes sin cambiar el formato. `sanitize()` comprueba que la skin puesta esté entre las que tienes; si no, `normal`. Cuando haya cuentas, las skins forman parte de la colección del servidor (`collection` en `docs/backend-accounts-plan.md` §2.5, con un campo `skins`).

**En el cooperativo [I]**: cada jugador manda su especie **y su skin** al entrar en la sala o en el pueblo compartido, y los demás clientes dibujan esa hoja. El anfitrión no comprueba que la tengas (la investigación, A4: en partida compartida no hace falta), porque no da ventaja. Si alguien lleva una skin que el otro cliente no tiene descargada, se dibuja la normal hasta que llegue. Por eso las hojas shiny de los 21 van en el mismo paquete que las normales, no se piden aparte.

**Legibilidad [I]**: el shiny cambia los colores, no el aro ni el nombre del jugador. Algunos shinies son más oscuros que el normal (en este plantel, conviene mirar Umbreon, Banette y Yamask contra el fondo de la Cripta) y la regla del aro de color de §2.2 vale igual.

### 5.2 Sitio para la progresión por Pokémon (más adelante)

Decisión tuya, para después del gacha: cada Pokémon tendrá su propia progresión, con **evolución** pagada con Pokémonedas y una **mazmorra de desafío**, y **vitaminas y mentas** hechas con materiales que salen de ese desafío. Este plan no la diseña; solo deja el sitio **[I]**:

- **Guardado**: un bloque `progress[especie]` aparte de la colección (`stage` de evolución, `vitamins`, `nature`), vacío por ahora. La colección dice qué tienes; el progreso, qué has hecho con él. Así el gacha no tiene que cambiar cuando llegue.
- **Moneda**: los materiales del desafío son **otra cosa que se gana jugando**, no se compran con Pokémonedas ni con esquirlas, y no salen del gacha. Así no se crea una cadena de monedas (A1, punto 2) y el gacha no se vuelve la forma de subir de poder.
- **Evoluciones en el plantel**: varias especies tienen evolución que podría llegar por esta vía: Rockruff → Lycanroc (que aquí ya es un 3★ aparte), Eevee → Umbreon (ídem), Murkrow → Honchkrow, Misdreavus → Mismagius, Snorunt → Froslass, Shinx → Luxio, Axew → Fraxure, Yamask → Cofagrigus, Charcadet → Armarouge o Ceruledge, Honedge → Doublade **[U: los sprites de las evoluciones no están comprobados, salvo Honchkrow, Mismagius y Froslass, que salieron en esta sesión con las 6 básicas]**. Si un 1★ puede evolucionar a algo que también es un 3★ del gacha, hay que decidir qué pasa con ese 3★ (pregunta 10).
- **Choque con el cooperativo [I]**: la investigación (A2.5) dice que en una partida compartida todos los Pokémon tienen que pesar lo mismo, y las vitaminas y las mentas son poder por definición. Hay dos salidas: que el poder de la progresión cuente solo en solitario y en la mazmorra de desafío, o que tenga un techo bajo y que el escalado por jugadores (GDD §8) lo compense. Es la pregunta 11.
- **Skins y evolución**: la skin shiny de una especie vale para sus evoluciones (el shiny de Shinx es también el de Luxio), para que evolucionar nunca te quite algo que ya tenías.

---

## 6. Datos y código (propuesta)

**[I]**, siguiendo cómo está hecho hoy el repositorio:

- `src/data/species.ts`: los 21 en `SpeciesId` y `SPECIES` con `movepool`, `defaultLoadout`, `passive`, `maxHp`, `speedScale` y `radius: 10`. `PLAYABLE_SPECIES` pasa a ser "iniciales + lo que tengas en la colección": la lista de lo que **existe** se queda en los datos y lo que **tienes** sale del guardado.
- `src/data/moves.ts`: los `MoveId` nuevos con sus formas. Un campo `origin: 'level' | 'tm' | 'egg' | 'tutor'` por especie y movimiento, mejor en una tabla aparte (`src/data/learnsets.ts`, especie → [movimiento, origen, cómo se desbloquea]) que en `MoveDef`, porque un mismo movimiento cambia de origen según la especie.
- `src/data/gacha.ts`: rarezas, tasas, pity, spark, costes, lista de banners de la temporada, recompensas del tablón y precios de las esquirlas. Es la única fuente para la lógica **y** para la interfaz (regla 2 de A2.7).
- `src/core/gacha.ts`: una función pura `pull(state, rng) → { result, state }`, sin efectos, con tests para las cinco reglas de oro de A2.7 y la simulación de §3.2 como test de propiedad (cualquier semilla: un 3★ en ≤ 40 y un Pokémon concreto en ≤ 60).
- `src/app/save.ts`: `SaveData` sube de versión con `collection` (especie → copias, fecha, `skins` y `skin` puesta), `gacha` (pity de rareza, pity de shiny, sellos, semilla, sellos canjeados en la temporada), `shards`, `unlockedMoves`, `cosmetics` y un `progress` vacío reservado para §5.2; `migrate()` y `sanitize()` como siempre.
- `src/net`: el mensaje de entrada a la sala y al pueblo compartido lleva `skin` junto a la especie (§5.1).
- `tools/fetch-sprites.mjs`: los 21 en `TARGETS`, más la hoja shiny (`<dex>/<forma>/0001/`) como forma aparte, y `CREDITS.md` regenerado (leyendo de verdad los `credits.txt`, que este plan no comprobó).
- `src/sim`: el arnés con `--species` para los 21 y el informe de victorias por especie y nivel, antes de publicar cada tanda.

---

## 7. Interfaz

**[I]**

- **Puesto del gacha** en la Aldea del Lago Negro, junto a Phantump (GDD §3, "El mundo"). A la vista siempre: la tasa de cada rareza y de cada Pokémon, el pity ("3★ garantizado en 12 tiradas"), los sellos ("47/60"), el banner de la semana y una línea pequeña "cambia el lunes".
- **Animación** de 2 s, saltable, con el color de la rareza desde el principio (sin "casi"); el 3★ con cámara lenta y la corona roja del eclipse (A2.6).
- **Colección**: cuadrícula de los 21, con los que no tienes en silueta y su forma de conseguirlos ("Gacha · Tablón: planta 20 de la Sima").
- **Pantalla de equipo**: elegir Pokémon y sus cuatro ranuras, con lo aprendible en gris y cómo se desbloquea ("Jugando: 12/15 plantas · o 10 esquirlas"). Debe ser la misma pantalla que diseñe el otro trabajador para los iniciales.
- **Tutor**: lista de MT/H/Tu del Pokémon elegido con su precio en P y en esquirlas.
- **Directo**: el resultado de la tirada en grande, con la rareza en texto además del color, y encima de tu cabeza en el pueblo compartido.

---

## 8. Lista de tareas

**[I]** En orden. Cada una es una unidad de trabajo con sus tests; las estimaciones de tamaño son orientativas.

| ID | Tarea | Depende de | Notas |
|---|---|---|---|
| T1 | Leer y alinear este plan con el documento de repertorios de los iniciales (nombres de formas, desbloqueo, tutor) | El otro documento | Bloquea T4 y T7 |
| T2 | `src/core/gacha.ts` + `src/data/gacha.ts` + tests de las reglas de oro y de la simulación | — | Puro, sin interfaz |
| T3 | Primera tanda jugable **sin mecánicas nuevas**: Lycanroc, Honedge, Banette, Murkrow, Axew, Shinx (datos, sprites, kit por defecto) | T1 | Prueba el modelo de datos con 6 especies |
| T4 | Tabla de repertorios (`learnsets.ts`) y desbloqueo jugando | T1, T3 | |
| T5 | Guardado: colección, gacha, esquirlas, desbloqueos, con `migrate()` | T2 | |
| T6 | Puesto del gacha y colección en la Aldea del Lago Negro | T2, T5 | |
| T7 | Tutor (si no lo hace ya el otro trabajador) y precios en esquirlas | T1, T4, T5 | |
| T8 | Mecánicas M1 (curar) y M2 (aura); con ellas, Umbreon, Solrock, Eevee, Rockruff, Chimecho, Cresselia | T3 | Pasar por el arnés en cooperativo |
| T9 | Mecánicas M3 (marca retardada), M5 (ralentizar), M7 (varios proyectiles); con ellas, Lunatone, Misdreavus, Snorunt, Sneasel, Dragapult | T3 | |
| T10 | Mecánicas M4 (borrar balas) y M6 (zona persistente); con ellas, Yamask, Charcadet, Typhlosion de Hisui, Absol completo | T3 | M4 necesita su propio test de equidad |
| T11 | Tablón de encargos con las tres recompensas | T5 | |
| T12 | Arnés: barrido por especie y nivel, y ajuste de cifras | T3, T8–T10 | Antes de abrir cada semana |
| T13 | Lista de la temporada en `gacha.ts` y tasas destacadas | T2, T6 | |
| T14 | Skins shiny: hojas en el paquete, tirada shiny con su pity, poner y quitar en equipo y colección, skin en el mensaje de red del cooperativo | T2, T5, T6 | Mirar a ojo los shiny de Sneasel y Snorunt; test: ninguna skin cambia una estadística |
| T15 | Más adelante: el gacha en el servidor (`docs/backend-accounts-plan.md` §2.5) | Cuentas | Ver riesgo 6 |

---

## 9. Riesgos

1. **[I] Equilibrio en cooperativo.** Curar (M1), auras (M2) y borrar balas (M4) son lo que más cambia una pelea compartida. Si un grupo con Cresselia y Chimecho no puede perder, la dificultad deja de medir nada. Mitigación: topes por planta, enfriamientos largos y el arnés en cooperativo antes de publicar.
2. **[I] Borrar balas contra la regla 5.** Niebla no borra los ataques de zona y no cuenta como esquiva perfecta. Si se ve demasiado fuerte, mejor un radio menor que más enfriamiento.
3. **[I] Volumen de trabajo.** 21 especies con 8–15 movimientos cada una son unos 120 movimientos nuevos (`moves.ts` tiene 28 hoy). Muchos se comparten (Danza Espada, Bola Sombra, Avalancha…), pero cada uno pide forma, tiempos y prueba. Mitigación: publicar por tandas (T3, T8–T10), con el repertorio completo solo cuando la tanda está estable.
4. **[V] Sprites.** Sneasel y Snorunt tienen el shiny marcado fase 0. Diez del plantel están en fase 1 (sin Faint, DeepBreath y demás extras). La licencia por hoja no se miró.
5. **[I] Legibilidad.** Dragapult, Cresselia y Lycanroc pueden tapar balas en pantalla; cuatro fantasmas oscuros se confunden con la Cripta. Ver §2.2.
6. **[V] Contradicción con el plan de backend.** `docs/backend-accounts-plan.md` §2.5 guarda la pity por banner (`gacha_state.banner`, `pullsSinceTop`), y la investigación (A2.2) dice que la pity y los sellos son del jugador. Hay que elegir uno antes de T15; propongo la del jugador.
7. **[I] Economía.** Completar la colección cuesta casi el doble que todas las mejoras. Si a los jugadores no les llega, la palanca es el precio.
8. **[I] Fan game y legendarios.** Cresselia es legendaria. No cambia el riesgo legal de `docs/legal-risk-notes.md` (cero dinero), pero conviene saberlo.

---

## 10. Preguntas abiertas para ti

1. ¿Te vale un plantel de 21 (6/7/8), o prefieres quedarte en los 16 de la investigación para la primera temporada y dejar 5 para la segunda?
2. ¿Lunatone y Solrock jugables (y el Observatorio con Bronzor, Elgyem y Beldum), o se quedan para enemigos como dice `species-candidates.md`?
3. ¿Cresselia (legendaria) en el gacha, o la guardamos para el tablón o para un jefe?
4. ¿Banners con una lista fija de siete semanas al principio (§3), o la semilla de la fecha desde el primer día?
5. ¿Desbloquear movimientos jugando con el Pokémon (lo que propongo), o solo pagando en el tutor?
6. ¿El canje de esquirlas a sellos (10 → 1, con tope de 20 por temporada), o los repetidos solo cosméticos?
7. ¿Pity del jugador (la investigación) o por banner (el plan de backend)?
8. ¿El puesto lo lleva Phantump, como dice la GDD, o Mimikyu, como decía el encargo de la investigación?
9. ¿Shiny al 2,5 % con garantía a las 80 tiradas (§5.1), o prefieres una tasa más baja y que el shiny sea sobre todo cosa de esquirlas?
10. Si llega la evolución (§5.2), ¿Rockruff evoluciona al Lycanroc que también es un 3★ del gacha (y ese 3★ deja de estar en el gacha), o Lycanroc y Umbreon se quedan como entradas aparte?
11. ¿El poder de las vitaminas y las mentas cuenta en el cooperativo con techo, o solo en solitario y en la mazmorra de desafío?
