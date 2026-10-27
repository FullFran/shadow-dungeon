// Builds docs/lore/lore-graph.json; then run tools/lore/embed-graph.mjs and tools/lore-graph-check.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const es = JSON.parse(readFileSync(`${ROOT}/src/i18n/es.json`, 'utf8'));
const t = (k) => { if (!(k in es)) throw new Error('missing key ' + k); return es[k]; };
const I = (k) => { t(k); return `i18n:${k}`; };

const nodes = [];
const edges = [];
const ids = new Set();
function N(id, label, type, summary, sources, status = 'canon') {
  if (ids.has(id)) throw new Error('dup ' + id);
  ids.add(id);
  nodes.push({ id, label, type, status, summary, sources });
}
function E(from, to, relation, sources) { edges.push({ from, to, relation, sources }); }

// --- Concepts, events, factions -------------------------------------------
N('edad-de-luz', 'La edad de la luz', 'suceso', 'Un tiempo en que el sol no conocía la sombra y a los Pokémon nada les faltaba.', [I('prologue.light.1'), I('prologue.light.2')]);
N('hambre', 'Lo que bebe la luz', 'concepto', 'Algo despertó bajo la tierra con hambre de luz y bebió el sol hasta dejarlo hueco; sigue devorando la luz más hondo que todas las mazmorras. Nunca se nombra en el juego.', [I('prologue.hunger.1'), I('prologue.dimming.1'), I('prologue.guardians.2'), I('town.story.4')]);
N('eclipse', 'Eclipse Carmesí', 'suceso', 'Un anillo rojo sobre la nada que no se ha movido desde que llegó. El mundo está siempre al anochecer del eclipse.', [I('prologue.eclipse.1'), I('prologue.eclipse.2'), 'docs/gdd.md:512']);
N('noche-sin-fin', 'La noche que no acaba', 'concepto', 'Desde el Eclipse el sol no ha vuelto a salir. El tiempo pasa igual: frío y menos frío, y los inviernos se cuentan por el hielo, no por la luz. La luna sigue saliendo; el sol no. El Refugio del Ocaso se quedó en el último anochecer (decisión del dueño, 27-10-2026; C6).', [I('story.shinx.1.fragment.1.text'), I('story.cubone.1.before.1'), I('sima.plea.hermit.1'), 'docs/gdd.md:23', 'docs/gdd.md:512']);
N('noche-del-eclipse', 'La noche del Eclipse', 'suceso', 'La noche en que se apagó el sol: se abren las mazmorras, cae la primera gota roja, nace Shinx, se pierden la manada de Zorua, la madre de Cubone y los mayores de Axew.', [I('story.zorua.2.before.1'), I('story.cubone.2.before.1'), I('story.axew.2.before.1'), I('story.shinx.1.before.1'), I('world.npc.hermit.2')]);
N('mazmorras', 'Mazmorras Sombrías', 'concepto', 'Bocas de piedra que se abrieron con el Eclipse. Quien entra y vuelve ya no es él: solo su sombra.', [I('prologue.dungeons.1'), I('prologue.dungeons.2'), I('prologue.shadows.2')]);
N('sombras', 'Las sombras', 'faccion', 'Los que entraron en las mazmorras y volvieron sin ser ellos; por eso los enemigos son versiones sombrías. Una sombra es lo que queda cuando tu sombra ya no te necesita: despacio, bajada a bajada; de golpe, la noche del Eclipse, a los que estaban en la plaza (decisión del dueño, 27-10-2026; C4).', [I('prologue.shadows.2'), I('town.story.2'), 'docs/gdd.md:225', I('story.mimikyu.3.before.1'), 'docs/gdd.md:422']);
N('guardianes', 'Los guardianes', 'faccion', 'Cada mazmorra tiene un guardián atado a un juramento que ya nadie recuerda; el Rey de las Espadas es el primero.', [I('prologue.guardians.1'), I('town.story.3'), I('guardian.aegislash.pre.1')]);
N('juramentos', 'Los juramentos', 'concepto', 'Lo que ata a cada guardián. Al caer el guardián se rompe y queda en el Santuario, donde vuelve a cumplirse.', [I('prologue.guardians.1'), I('guardian.aegislash.post.1'), I('shrine.text')]);
N('voz', 'La voz', 'personaje', '«…¿Me oyes? ¿Puedes oírme?». Abre el test de personalidad y vuelve cuando te pierdes en la Sima. Nunca se dice quién es.', [I('prologue.voice.1'), I('quiz.intro.1'), I('quiz.intro.2'), I('sima.scene.lost.4'), 'docs/sima-redesign.md:92']);
N('caminantes', 'Caminantes de la Sima', 'faccion', 'Gente que contestó a la voz y despertó dentro de un Pokémon con sus recuerdos y sus heridas, y con una sombra que no los suelta. Todo Pokémon jugable es uno.', [I('lore.reborn.name'), I('sima.scene.lost.8'), I('sima.scene.lost.9'), 'docs/gdd.md:422', 'docs/sima-redesign.md:11']);
N('reencarnacion', 'Renacer como Pokémon', 'concepto', 'Despertar en un mundo que no es el tuyo, dentro de un Pokémon elegido por tus respuestas (la premisa de Mundo Misterioso).', [I('quiz.intro.2'), I('quiz.result.species'), 'src/data/quiz.ts:18']);
N('sombra-propia', 'Tu sombra', 'concepto', 'La sombra que baja contigo y no te suelta. Mientras bajas, tira de ti hacia el fondo; cuando te pierdes te sube, solo porque necesita un cuerpo vivo al que volver: no te salva, te guarda. Cada bajada se bebe un poco más de ti. A quien baja sin una, la Sima se lo queda.', [I('sima.scene.lost.5'), I('sima.scene.lost.10'), I('sima.scene.lost.13'), I('sima.plea.oracle.2'), I('screen.eclipse.text'), 'docs/gdd.md:422']);
N('lucidez', 'Lucidez', 'concepto', 'El reloj de la Sima: cuánto aguantas siendo tú. Bajar y vencer ecos la devuelven; a las 0:00 te pierdes.', [I('endless.entry.clock'), I('endless.score.time'), 'docs/gdd.md:425', 'docs/gdd.md:387']);
N('perderse', 'Perderse', 'suceso', 'Llegar a 0:00 de Lucidez: tu sombra te sube al borde del cráter porque aún le haces falta. Es una marca, no una derrota.', [I('screen.eclipse.title'), I('screen.eclipse.text'), 'docs/sima-redesign.md:8']);
N('figuraciones', 'Figuraciones', 'concepto', 'Con menos de 60 s de Lucidez, siluetas de alguien que no está en el borde de la vista. Nunca dañan.', ['docs/gdd.md:433', I('menu.figurations')]);
N('memoria', 'La memoria del jugador', 'concepto', 'Lo mecánico sale de la semilla; lo narrativo, de tu memoria: lo que no conoces sale sin nombre ni cara.', ['docs/sima-redesign.md:31', 'docs/gdd.md:421', 'src/app/sima-lore.ts:11']);
N('otro-cielo', 'El otro cielo', 'concepto', 'La Sima no baja hacia el fondo de la tierra sino hacia el eclipse: allí abajo está el otro cielo, de donde dice venir Nihilego.', [I('sima.scene.lost.11'), I('sima.scene.lost.12'), I('guardian.nihilego.pre.2'), I('world.lore.crystal.2')]);
N('arriba-abajo', 'Arriba y abajo se tocan', 'concepto', 'Diseño: el «otro cielo» de Nihilego y el «bajo la tierra» del prólogo son el mismo sitio visto desde los dos lados; nunca se dice así.', ['docs/sima-redesign.md:96'], 'diseño');
N('herida', 'La herida', 'concepto', 'El último jefe de cada Senda: el propio Pokémon, enorme y corrompido, su herida hecha carne. Una versión menor cierra el I y el II, la entera el III.', ['docs/story-quests.md:40', 'docs/story-quests.md:44']);
N('sombra-senda', 'Sombras de las Sendas', 'faccion', 'Los jefes intermedios de las Sendas: Pokémon que encajan con la historia de cada línea, hechos sombra. Una sombra no vuela.', ['docs/story-quests.md:52']);
N('suplicas', 'Las súplicas', 'suceso', 'Antes de la primera bajada, los vecinos suben al borde del cráter y te piden por favor que busques a alguien que no volvió.', ['src/data/sima-plea.ts:22', I('gallery.sima.plea'), 'docs/gdd.md:432']);
N('la-boca', 'La boca', 'suceso', 'Primera entrada a la Sima: «Baja todo lo que puedas. Acuérdate de ellos. …Y acuérdate de ti.»', [I('sima.scene.mouth.1'), I('sima.scene.mouth.4'), I('sima.scene.mouth.5')]);
N('punto-de-quiebre', 'Punto de quiebre', 'suceso', 'La primera vez que te pierdes: todo se apaga, tu sombra tira de ti y despiertas en el borde con Phantump, que explica qué son los Caminantes.', [I('gallery.sima.lost'), I('sima.scene.lost.1'), I('sima.scene.lost.7')]);
N('el-regreso', 'El regreso', 'suceso', 'Al acabar cada partida de la Sima despiertas arriba; «Lo que viste no se cuenta. Se guarda.»', [I('sima.scene.return.1'), I('sima.scene.return.4')]);
N('primera-gota', 'La primera gota de luz roja', 'suceso', 'La noche que el sol se apagó cayó una gota de luz roja en la ciénaga; el agua la bebió y se volvió veneno.', [I('world.npc.hermit.2'), I('dungeon.swamp.lore.1')]);
N('reto-diario', 'El turno de esta noche', 'concepto', 'El reto diario: la misma semilla para todo el pueblo. «Esta noche ha bajado todo el pueblo por la misma.»', [I('endless.entry.daily'), I('sima.scene.return.3')]);

// --- Sima figures ---------------------------------------------------------
N('eco-del-eclipse', 'Eco del Eclipse', 'personaje', 'Tu forma en negro y rojo, «La sombra que bajó contigo»: la parte de ti que el eclipse ya se ha bebido, lo que tu sombra ya se ha llevado de ti; por eso hay que vencerlo. Crece en cada encuentro (plantas 10, 20...).', [I('sima.echo.subtitle'), I('sima.scene.own-shadow.3'), I('sima.echo.line.1'), 'docs/gdd.md:405']);
N('ecos-guardian', 'Ecos de guardián', 'faccion', 'Lo que la Sima guarda de los guardianes (plantas 5, 15, 25...); en la Sima, «guardián» es todo jefe atado a un juramento, así que Trevenant, jefe intermedio, también sale en el turno. Si no has vencido al guardián, sale como Guardián sin rostro.', [I('endless.echo'), I('species.sima-faceless'), I('endless.echo.faceless'), 'docs/gdd.md:383']);
N('heraldos', 'Heraldos del Eclipse', 'faccion', 'Jefes generados con nombres que nadie ha dicho nunca: lo que tu cabeza inventa para lo que no entiende (plantas 22, 32...).', [I('species.sima-herald'), I('sima.scene.first-name.1'), I('sima.scene.stratum-caves.1'), 'docs/gdd.md:407']);
N('sombra-extraviada', 'Sombra de alguien', 'personaje', 'La sombra de una Senda en la Sima, optativa, tras su muro de niebla: «No es quien era. Es lo que el eclipse se quedó.»', [I('species.sima-someone'), I('sima.scene.someone.2'), I('sima.stray.log.known'), 'docs/gdd.md:429']);
N('herida-ajena', 'Una herida que no es tuya', 'personaje', 'La herida de una Senda en las plantas 35, 55, 75...: «La herida de {line}. {line} la cerró. Esta se quedó abajo.»', [I('species.sima-not-yours'), I('sima.wound.log.known'), 'docs/gdd.md:428']);
N('sabueso', 'Sabueso del Eclipse', 'personaje', 'Un perseguidor imposible de vencer: solo se huye hacia la escalera.', [I('sima.event.hunter'), I('sima.log.hunter.loosed')]);
N('eco-mercader', 'Eco mercader', 'personaje', 'Un mercader de la Sima. «El eco te ve marchar sin decir nada.»', [I('sima.event.merchant'), I('sima.merchant.leaveText')]);
N('altar', 'Altar del Eclipse', 'objeto', 'Pactos de don y precio: «El eclipse da y el eclipse quita.»', [I('sima.event.shrine'), I('sima.log.shrine.accepted')]);

// --- Design only ----------------------------------------------------------
N('necrozma', 'Necrozma', 'personaje', 'Diseño: lo que hay bajo la tierra y el jefe final; el prólogo no lo enseña ni lo nombra.', ['docs/gdd.md:231', 'docs/species-candidates.md:252'], 'diseño');
N('forma-de-la-herida', 'La forma de la herida', 'concepto', 'Abajo solo se entra con la forma de la herida a la que acompañas: en una Senda la Sima te hace llevar la forma del vecino con el que bajas (las Sendas son heridas de otros, no tu pasado). Por eso una Senda solo se juega con su línea. Qué cuesta llevar la forma de otro es un misterio (M13).', [I('challenges.text'), I('challenge.cubone.lore'), 'docs/gdd.md:423']);
N('sombras-amigos', 'Sombras de amigos', 'concepto', 'NO CANON AÚN: abajo puedes encontrar las sombras de tus amigos (por nombre de usuario o código) o Caminantes generados; liberar la sombra de un amigo le avisa. Con la regla de la sombra del 27-10-2026, son sombras que ya no necesitaban a su dueño.', ['docs/lore/lore.md:355'], 'diseño');

// --- Places ---------------------------------------------------------------
N('refugio', 'Refugio del Ocaso', 'lugar', 'El pueblo de partida: el puesto de Mimikyu, la tienda de Poochyena, Gastly, Smeargle, el tablón y el Santuario; Abra duerme en un rincón y Axew entrena en la linde. Se llama así porque se quedó en el último anochecer.', [I('world.map.refugio'), 'docs/gdd.md:514', 'src/data/town.ts:223']);
N('ruinas', 'Camino de las Ruinas', 'lugar', 'Tumbas y columnas rotas; la Estatua sin rostro y la boca de la Cripta.', [I('world.map.ruinas'), 'docs/gdd.md:515', 'src/data/world.ts:163']);
N('mirador', 'Paso del Mirador', 'lugar', 'Una grieta y un solo puente; desde aquí el eclipse se ve enorme. Boca del Bosque Brumoso.', [I('world.map.mirador'), I('world.lore.view.1'), 'docs/gdd.md:516']);
N('crater', 'Cráter del Eclipse', 'lugar', 'Ceniza bajo el eclipse; en su borde, la boca de la Sima y la Estatua quemada. Aquí se hacen las súplicas y despiertas al perderte.', [I('world.map.crater'), 'docs/gdd.md:517', I('sima.scene.lost.6')]);
N('lago', 'Aldea del Lago Negro', 'lugar', 'Aldea de pescadores junto al lago que se heló entero la noche del Eclipse: el hielo es negro porque debajo ya no hay luz, y el pescador pesca por un agujero junto al embarcadero. «Refleja lo que hay debajo.»', [I('world.map.lago'), I('world.npc.keeper.1'), I('world.npc.fisher.1'), I('world.npc.fisher.2'), 'docs/gdd.md:518']);
N('cienaga', 'Ciénaga del Cielo Roto', 'lugar', 'Donde cayó la primera luz del eclipse; el cristal caído y la boca del Pantano.', [I('world.map.cienaga'), 'docs/gdd.md:519']);
N('santuario', 'Santuario de los Juramentos', 'lugar', '«Donde los guardianes vuelven a jurar»: los nombres de los guardianes vencidos brillan en el altar.', [I('shrine.title'), I('shrine.subtitle'), I('world.lore.shrine.1')]);
N('cripta', 'Cripta del Rey de las Espadas', 'lugar', '«Donde el acero aún espera órdenes»: el Rey guarda una puerta sellada.', [I('dungeon.crypt.name'), I('dungeon.crypt.lore.1'), I('dungeon.crypt.lore.2')]);
N('bosque', 'Bosque Brumoso', 'lugar', '«Donde la niebla es el aliento de los perdidos»: quien se pierde echa raíces y escucha.', [I('dungeon.forest.name'), I('dungeon.forest.lore.1'), I('dungeon.forest.lore.2')]);
N('cuevas', 'Cuevas Inundadas', 'lugar', '«Donde la campana ahogada aún llama a los suyos»: un santuario hundido bajo el Lago Negro.', [I('dungeon.caves.name'), I('dungeon.caves.lore.1'), I('dungeon.caves.lore.2')]);
N('pantano', 'Pantano Tóxico', 'lugar', '«Donde la luz del eclipse goteó de otro cielo»: algo que no es de este mundo flota sobre una grieta del cielo.', [I('dungeon.swamp.name'), I('dungeon.swamp.lore.1'), I('dungeon.swamp.lore.2')]);
N('sima', 'Sima del Eclipse', 'lugar', '«Donde la luz cae y nunca toca fondo»: todo lo que no volvió de las mazmorras acaba cayendo por aquí.', [I('dungeon.eclipse.name'), I('dungeon.eclipse.subtitle'), I('dungeon.eclipse.lore.1'), I('dungeon.eclipse.lore.2')]);
const bands = [
  ['estrato-1', 'crypt', 'Estrato I · Lo que conoces'],
  ['estrato-2', 'forest', 'Estrato II · Lo que temes'],
  ['estrato-3', 'caves', 'Estrato III · Lo que nombras'],
  ['estrato-4', 'swamp', 'Estrato IV · Lo que no es tuyo'],
  ['estrato-5', 'abyss', 'Estrato V · Lo que queda de ti'],
];
for (const [id, band] of bands) {
  N(id, t(`sima.band.${band}.name`), 'lugar', `${t(`sima.band.${band}.subtitle`)}. ${t(`sima.band.${band}.lore.2`)}`, [I(`sima.band.${band}.name`), I(`sima.band.${band}.subtitle`), I(`sima.band.${band}.lore.2`)]);
  E(id, 'sima', 'parte_de', [I(`sima.band.${band}.name`)]);
}
N('plaza', 'La plaza de antes del Eclipse', 'lugar', 'Una plaza con sol y un columpio donde Mimikyu iba cada tarde.', [I('story.mimikyu.2.before.1'), I('challenge.mimikyu.2.floor.1')]);
N('casa-grande', 'La casa grande', 'lugar', 'Al final de la aldea, con todas las lámparas encendidas y nadie dentro; las enciende Litwick cada noche.', [I('story.litwick.1.before.1'), I('story.litwick.2.before.4')]);
N('torre', 'La torre sin techo', 'lugar', 'Más allá de la cripta; suben a ella los que ya no tienen a quién esperar.', [I('story.cubone.3.before.1')]);
N('fuente', 'La fuente de la aldea', 'lugar', 'Donde un niño callado mira el agua y su reflejo es un zorro. El mapa no tiene fuente: el niño callado se sienta en las piedras de la plaza.', [I('story.zorua.1.before.1'), 'src/data/world.ts:362']);
N('niebla-blanca', 'La niebla blanca', 'lugar', 'Más allá del pantano, huele a rencor: ahí duermen los que esperaron demasiado.', [I('story.zorua.3.before.1')]);
N('lago-helado', 'El lago helado', 'lugar', 'El lago de Piplup, que es el Lago Negro: reflejaba el cielo; la noche del Eclipse se heló entero, negro. Desagua al mar, más allá: por ahí se fueron los demás, y el hielo dejó a Piplup aislado (decisión del dueño, 27-10-2026; C7, C9).', [I('story.piplup.2.before.1'), I('story.piplup.3.before.1'), I('story.piplup.3.boss.6.title'), I('story.piplup.3.after.3'), 'docs/gdd.md:518']);
N('barranca', 'La barranca', 'lugar', 'Donde los mayores bajaron la noche del Eclipse y Axew cayó; un árbol viejo lleno de marcas.', [I('story.axew.1.before.1'), I('story.axew.2.before.1')]);
N('tierras-sin-nombre', 'Tierras sin nombre', 'lugar', '«Más allá del lago hay tierras que aún no tienen nombre. Algún día el camino seguirá.»', [I('world.npc.oracle.2')]);

// --- World objects --------------------------------------------------------
N('estatua-sin-rostro', 'Estatua sin rostro', 'objeto', 'Un caballero de piedra: «El que juró la espada no la soltará jamás»; al caer el Rey, la inscripción cambia.', [I('world.lore.knight.1'), I('world.lore.knight.2')]);
N('estatua-quemada', 'Estatua quemada', 'objeto', 'Mira al fondo de la sima con las manos quemadas, como si hubiera intentado sujetar el sol. «La sima no tiene fondo. Solo más eclipse».', [I('world.lore.crater.1'), I('world.lore.crater.2'), I('world.lore.crater.3')]);
N('poste', 'Poste del camino', 'objeto', '«No bajes solo», tachado; debajo: «Volvió».', [I('world.lore.sign.1'), I('world.lore.sign.2')]);
N('idolo', 'Ídolo del lago', 'objeto', 'Un ídolo de rana con ofrendas para que el agua siga quieta; un instante refleja un sol que ya no existe.', [I('world.lore.idol.1'), I('world.lore.idol.3')]);
N('cristal-caido', 'Cristal caído', 'objeto', 'Dentro se ve un cielo que no es este; luego suena como una puerta que alguien empuja desde el otro lado.', [I('world.lore.crystal.1'), I('world.lore.crystal.2'), I('world.lore.crystal.3')]);

// --- Town people ----------------------------------------------------------
N('phantump', 'Phantump, la vidente', 'personaje', 'La vidente del Lago: evoluciona y despierta, cierra cada Senda con una línea y explica qué son los Caminantes. Te espera en el borde.', [I('town.name.oracle'), I('world.npc.oracle.evolve'), I('sima.plea.oracle.3'), I('sima.scene.lost.7')]);
N('gastly', 'Gastly, cuentacuentos', 'personaje', 'Cuenta el prólogo en el Refugio; reconoce a los Caminantes en los ojos y busca una manada de zorros perdida en la niebla.', [I('town.name.storyteller'), I('town.story.1'), I('sima.plea.storyteller.1'), I('sima.plea.storyteller.4')]);
N('poochyena', 'Poochyena, la tienda', 'personaje', 'Lleva la tienda desde que su hermana dejó de volver. «Desde el Eclipse Carmesí la fragua no prende sola.»', [I('town.name.shop'), I('town.shop.1'), I('sima.plea.shop.2')]);
N('croagunk', 'Croagunk, el ermitaño', 'personaje', 'Vive junto al camino de la ciénaga; vio a una Caminante volver once veces.', [I('town.name.hermit'), I('world.npc.hermit.1'), I('sima.plea.hermit.1')]);
N('smeargle', 'Smeargle, maestro de movimientos', 'personaje', '«Cada Pokémon guarda en su sangre los movimientos de su tierra. Yo sé pintarlos de nuevo.»', [I('town.name.tutor'), I('town.tutor.1')]);
N('hermana-mightyena', 'La hermana de Poochyena', 'personaje', 'Una Mightyena grande con una muesca en la oreja que bajaba a por género y dejó de volver.', [I('sima.plea.shop.1'), I('sima.plea.shop.2')]);
N('caminante-once', 'La Caminante que volvió once veces', 'personaje', 'Hace tres inviernos bajó, volvió once veces; la duodécima su sombra subió sola y sigue sentada en el borde. Es el final del camino: su sombra ya no la necesitaba.', [I('sima.plea.hermit.1'), I('sima.plea.hermit.2'), 'docs/gdd.md:422']);
N('columpio-alguien', 'El que empujaba el columpio', 'personaje', 'Alguien que empujaba el columpio de la plaza aunque nadie se subiera; bajó a buscar a sus amigos y no subió.', [I('sima.plea.gacha.1'), I('sima.plea.gacha.2')]);

// --- Guardians and mid-bosses ---------------------------------------------
const guardians = [
  ['aegislash', 'cripta', 'Soy el primero de los que guardan.'],
  ['decidueye', 'bosque', 'Velo esta puerta desde que el sol se apagó.'],
  ['dhelmise', 'cuevas', 'Juré guardar a los que se hundieron conmigo.'],
  ['nihilego', 'pantano', 'Vengo de un cielo sin sol.'],
];
for (const [sp, place, quote] of guardians) {
  N(sp, `${t(`species.${sp}`)}, ${t(`guardian.${sp}.title`)}`, 'personaje', `Guardián. «${quote}» ${t(`guardian.${sp}.post.2`)}`, [I(`guardian.${sp}.title`), I(`guardian.${sp}.pre.2`), I(`guardian.${sp}.post.2`), 'src/data/guardian-cinematics.ts:60']);
  E(sp, place, 'protege', [I(`guardian.${sp}.pre.1`)]);
  E(sp, 'guardianes', 'pertenece_a', [I(`guardian.${sp}.title`)]);
  E('ecos-guardian', sp, 'es_eco_de', ['docs/gdd.md:383']);
}
N('sableye', 'Sableye, el ladrón de gemas', 'personaje', 'Jefe intermedio de la Cripta, en la cámara del tesoro.', ['docs/gdd.md:242', 'docs/gdd.md:254']);
N('trevenant', 'Trevenant', 'personaje', 'Jefe intermedio del Bosque. En la Senda de Axew, las raíces que lo subieron a pulso: «no me atrapó. Me salvó».', ['docs/gdd.md:302', I('story.axew.2.boss.3.title'), I('story.axew.2.after.2')]);
N('lanturn', 'Lanturn, el farol del abismo', 'personaje', 'Jefe intermedio de las Cuevas: un farol que no está ahí para guiarte. En Litwick I, «la otra luz»; en Piplup II, el brillo que llamaba.', ['docs/gdd.md:356', I('dungeon.caves.floor.5'), I('story.litwick.1.boss.6.title'), I('story.piplup.2.boss.6.title')]);
N('salazzle', 'Salazzle, la reina de la ponzoña', 'personaje', 'Jefa intermedia del Pantano. «La reina del pantano ya sabe que has llegado.»', ['docs/gdd.md:451', I('dungeon.swamp.floor.5')]);
E('sableye', 'cripta', 'vive_en', ['docs/gdd.md:242']);
E('trevenant', 'bosque', 'vive_en', ['docs/gdd.md:302']);
E('lanturn', 'cuevas', 'vive_en', ['docs/gdd.md:356']);
E('salazzle', 'pantano', 'vive_en', ['docs/gdd.md:451']);
E('ecos-guardian', 'trevenant', 'es_eco_de', ['docs/gdd.md:383']);

// --- Lines, Sendas, chapters, bosses, fragments ---------------------------
// Story-quests doc lines: senda heading, wound paragraph, chapter bullets; roads line in its data file.
const LINES = {
  mimikyu: { doc: 77, wound: 81, ch: [85, 86, 87], roads: 55, evo: 'despierta' },
  cubone: { doc: 93, wound: 97, ch: [99, 100, 101], roads: 45, evo: 'evoluciona en Marowak' },
  litwick: { doc: 103, wound: 107, ch: [109, 110, 111], roads: 44, evo: 'evoluciona en Chandelure' },
  zorua: { doc: 113, wound: 117, ch: [119, 120, 121], roads: 45, evo: 'evoluciona en Zoroark' },
  abra: { doc: 125, wound: 129, ch: [131, 132, 133], roads: 43, evo: 'evoluciona en Alakazam' },
  piplup: { doc: 135, wound: 139, ch: [141, 142, 143], roads: 44, evo: 'evoluciona en Empoleon' },
  shinx: { doc: 145, wound: 149, ch: [151, 152, 153], roads: 44, evo: 'evoluciona en Luxray' },
  axew: { doc: 155, wound: 159, ch: [161, 162, 163], roads: 44, evo: 'evoluciona en Haxorus' },
};
const HURT = {
  mimikyu: 'Un pequeño miró bajo su trapo; el que miró no volvió a la plaza. Teme que lo vean.',
  cubone: 'Su madre bajó a las cuevas a por luz la noche del Eclipse; volvió su cráneo. Llora dentro del hueso.',
  litwick: 'Guió a un niño perdido a casa comiéndose un poco de su vida; el niño no dejó de tener frío. Teme ser un trocito de lo que bebe la luz.',
  zorua: 'Por miedo se hizo niño y su manada pasó a su lado sin reconocerlo.',
  abra: 'Soñó el Eclipse una semana antes y huyó sin avisar. Duerme para no verlo.',
  piplup: 'Cayó por el hielo y lo sacó la vieja Empoleon; nunca se comió su baya. Ella bajó tras el Eclipse y no subió.',
  shinx: 'Nació la noche del Eclipse; asustó a su madre con un trueno, y ella salió a buscar a los perdidos y no volvió.',
  axew: 'Siguió a los mayores por la barranca, cayó y se melló el colmillo; ellos no volvieron.',
};
const HOME = { mimikyu: 'refugio', cubone: 'lago', litwick: 'lago', abra: 'refugio', axew: 'refugio', zorua: 'lago', piplup: 'lago', shinx: 'crater' };
// The resident's name key on the dialog box (src/data/world.ts, src/data/town.ts).
const NAME = { mimikyu: 'gacha', cubone: 'fisher', litwick: 'keeper', abra: 'sleeper', axew: 'trainee', zorua: 'child', piplup: 'proud', shinx: 'watcher' };
const NPC_NOTE = {
  mimikyu: ' En el Refugio lleva el puesto de la suerte: la Senda del Disfraz es su herida.',
  cubone: ' En la Aldea del Lago Negro es el pescador: la Senda del Hueso es su herida.',
  litwick: ' En la Aldea es la «Guardiana de la llama», femenina (C5): la Senda de la Llama es su herida.',
  abra: ' En el Refugio duerme en un rincón, bajo la manta que le dejó el pueblo, y casi nunca contesta: la Senda del Sueño es su herida.',
  axew: ' En el Refugio entrena solo junto a un árbol de marcas bajas, en la linde: la Senda del Colmillo es su herida.',
  zorua: ' En la Aldea es un niño callado en la plaza, disfrazado de otro Pokémon pequeño hasta que cierra su Senda (entonces, Zoroark): la Senda del Reflejo es su herida.',
  piplup: ' En la Aldea vigila el único agujero hasta el agua, junto al pescador, y rechaza lo que le ofrecen: la Senda del Lago Helado es su herida.',
  shinx: ' En el borde del cráter mira por dónde bajan los Caminantes: la Senda de la Tormenta es su herida.',
};
const BASE = { crypt: 'cripta', forest: 'bosque', caves: 'cuevas', swamp: 'pantano' };
// [chapter road base, mid at floor 3, mid at floor 6] from src/data/story/*_ROADS.
const ROADS = {
  mimikyu: [['crypt', 'ditto', 'noctowl'], ['forest', 'jigglypuff', 'pikachu'], ['caves', 'polteageist', 'hatterene']],
  cubone: [['swamp', 'haunter', 'mandibuzz'], ['caves', 'dusclops', 'kangaskhan'], ['crypt', 'bisharp', 'dusknoir']],
  litwick: [['caves', 'drifblim', 'lanturn'], ['crypt', 'banette', 'mismagius'], ['swamp', 'muk', 'nihilego']],
  zorua: [['caves', 'kecleon', 'gengar'], ['forest', 'mightyena', 'decidueye'], ['swamp', 'houndoom', 'spiritomb']],
  abra: [['caves', 'munna', 'drowzee'], ['crypt', 'mr-mime', 'hypno'], ['swamp', 'musharna', 'nihilego']],
  piplup: [['crypt', 'glalie', 'weavile'], ['caves', 'mamoswine', 'lanturn'], ['forest', 'froslass', 'lapras']],
  shinx: [['swamp', 'ampharos', 'manectric'], ['caves', 'absol', 'electivire'], ['crypt', 'umbreon', 'nihilego']],
  axew: [['forest', 'druddigon', 'bisharp'], ['caves', 'trevenant', 'garchomp'], ['crypt', 'salamence', 'dragonite']],
};
const REUSED = new Set(['lanturn', 'nihilego', 'decidueye', 'trevenant']);
const SPECIES_LABEL = { 'mr-mime': 'Mr. Mime' };
const shadowLabel = (sp) => SPECIES_LABEL[sp] ?? sp[0].toUpperCase() + sp.slice(1);
const shadowSeen = new Map();

for (const [line, info] of Object.entries(LINES)) {
  const name = t(`species.${line}`);
  const sendaId = `senda-${line}`;
  const docSrc = `docs/story-quests.md:${info.doc}`;
  N(line, name, 'personaje', `Línea jugable y Caminante. ${HURT[line]}${NPC_NOTE[line] ?? ''}`, [I(`species.${line}`), I(`challenge.${line}.lore`), docSrc, ...(HOME[line] ? ['docs/gdd.md:423'] : [])]);
  N(sendaId, t(`story.${line}.title`), 'senda', `${t(`challenge.${line}.subtitle`)}. ${HURT[line]} Al cerrar el III ${info.evo}. Phantump: ${t(`story.${line}.phantump`).replace(/^Phantump: /, '')}`, [I(`story.${line}.title`), I(`challenge.${line}.subtitle`), I(`story.${line}.phantump`), docSrc]);
  E(line, sendaId, 'protagoniza', [I(`story.${line}.title`)]);
  E(line, 'caminantes', 'pertenece_a', ['docs/gdd.md:422']);
  if (HOME[line]) E(line, HOME[line], 'vive_en', [I(`town.name.${NAME[line]}`)]);
  const woundId = `${line}-wound`;
  N(woundId, t(`species.${line}-wound`), 'personaje', `La herida de ${name}: el propio Pokémon, enorme y corrompido. Última palabra en Pesadilla.`, [I(`species.${line}-wound`), `docs/story-quests.md:${info.wound}`]);
  E(woundId, line, 'es_herida_de', [`docs/story-quests.md:${info.wound}`]);
  E(woundId, 'herida', 'es_un', [`docs/story-quests.md:${info.wound}`]);
  E('herida-ajena', woundId, 'puede_ser', ['docs/gdd.md:428']);
  for (let c = 1; c <= 3; c++) {
    const chId = `${sendaId}-${c}`;
    const [base, m3, m6] = ROADS[line][c - 1];
    N(chId, `${name} ${t(`story.${line}.${c}.title`)}`, 'senda', `${t(`story.${line}.${c}.before.1`)} Final: ${t(`story.${line}.${c}.after.1`)}`, [I(`story.${line}.${c}.title`), I(`story.${line}.${c}.before.1`), I(`story.${line}.${c}.after.1`), `docs/story-quests.md:${info.ch[c - 1]}`]);
    E(sendaId, chId, 'tiene_capitulo', [I(`story.${line}.${c}.title`)]);
    E(chId, BASE[base], 'recorre', [`src/data/story/${line}.ts:${info.roads + c - 1}`]);
    E(woundId, chId, 'aparece_en', [I(`story.${line}.${c}.boss.7.title`)]);
    for (const [floor, sp] of [[3, m3], [6, m6]]) {
      const titleKey = `story.${line}.${c}.boss.${floor}.title`;
      let nodeId = sp;
      if (!REUSED.has(sp) && !ids.has(sp)) {
        N(sp, shadowLabel(sp), 'personaje', `Sombra de Senda: «${t(titleKey)}». ${t(`story.${line}.${c}.boss.${floor}.pre.1`)}`, [I(titleKey), I(`story.${line}.${c}.boss.${floor}.pre.1`)]);
        E(sp, 'sombra-senda', 'pertenece_a', ['docs/story-quests.md:52']);
        E('sombra-extraviada', sp, 'puede_ser', ['docs/gdd.md:429']);
      } else if (!REUSED.has(sp)) {
        // A second Senda for the same shadow (Bisharp): add its epithet to the summary.
        const n = nodes.find((x) => x.id === sp);
        n.summary += ` También «${t(titleKey)}» en otra Senda.`;
        n.sources.push(I(titleKey));
      }
      shadowSeen.set(sp, true);
      E(nodeId, chId, 'aparece_en', [I(titleKey)]);
    }
    for (let f = 1; f <= 2; f++) {
      const fk = `story.${line}.${c}.fragment.${f}`;
      const fid = `frag-${line}-${c}-${f}`;
      N(fid, t(`${fk}.name`), 'objeto', t(`${fk}.text`), [I(`${fk}.name`), I(`${fk}.text`)]);
      E(fid, chId, 'aparece_en', [I(`${fk}.name`)]);
    }
  }
}

// Senda places and losses.
N('madre-cubone', 'La madre de Cubone', 'personaje', 'Bajó a las cuevas a buscar luz para el lago la noche del Eclipse; volvió su cráneo. Abajo, una sombra con su forma tararea.', [I('story.cubone.2.before.1'), I('story.cubone.2.before.3'), I('sima.plea.fisher.1')]);
N('nino-casa-grande', 'El niño de la casa grande', 'personaje', 'Se perdió en las cuevas; Litwick lo llevó a casa comiéndose un poco de él; tuvo frío siempre y vivió mucho, y ya de viejo bajó a la Sima a buscar calor (C8, resuelta).', [I('story.litwick.2.before.2'), I('story.litwick.2.after.2'), I('sima.plea.keeper.2')]);
N('manada-zorua', 'La manada de Zorua', 'faccion', 'Cruzó el Bosque Brumoso la noche del Eclipse por un camino que solo veían los suyos y pasó junto a Zorua sin reconocerlo.', [I('story.zorua.2.before.1'), I('story.zorua.2.before.2'), I('sima.plea.storyteller.4')]);
N('vieja-empoleon', 'La vieja Empoleon del lago', 'personaje', 'Sacó a Piplup del hielo y le dejó una baya. Tras el Eclipse bajó a buscar el reflejo del cielo y no subió.', [I('story.piplup.2.after.2'), I('story.piplup.3.before.1')]);
N('madre-shinx', 'La madre de Shinx', 'personaje', 'Una Luxray de la manada al borde de la tormenta; tras el Eclipse salió a buscar a todos los perdidos con los ojos abiertos y no volvió.', [I('story.shinx.2.before.2'), I('story.shinx.3.before.2')]);
N('mayores-axew', 'Los mayores de Axew', 'faccion', 'Bajaron por la barranca a luchar contra lo que se bebía el sol y no esperaron a Axew. Solo Dragonite encontró el camino de vuelta.', [I('story.axew.2.before.1'), I('story.axew.3.boss.6.pre.2')]);
N('pequeno-que-miro', 'El pequeño que miró', 'personaje', 'Miró debajo del trapo de Mimikyu y no volvió a la plaza; «no enfermó por lo que vio. Enfermó de miedo».', [I('story.mimikyu.2.before.3'), I('story.mimikyu.2.after.2')]);

// --- Edges between the rest -----------------------------------------------
const e = (from, to, rel, ...src) => E(from, to, rel, src);
e('hambre', 'eclipse', 'causa', I('prologue.dimming.1'), I('prologue.eclipse.1'));
e('edad-de-luz', 'eclipse', 'precede', I('prologue.light.1'), I('prologue.eclipse.1'));
e('eclipse', 'noche-del-eclipse', 'causa', I('story.abra.3.fragment.2.text'));
e('eclipse', 'mazmorras', 'abre', I('prologue.dungeons.1'));
e('mazmorras', 'sombras', 'devuelve', I('prologue.shadows.2'));
e('guardianes', 'mazmorras', 'protege', I('prologue.guardians.1'));
e('guardianes', 'juramentos', 'atado_a', I('prologue.guardians.1'));
e('juramentos', 'santuario', 'se_guarda_en', I('shrine.text'));
e('voz', 'caminantes', 'despierta_a', I('sima.scene.lost.8'));
e('caminantes', 'reencarnacion', 'es', I('sima.scene.lost.9'));
e('caminantes', 'sombra-propia', 'tiene', I('sima.scene.lost.9'));
e('caminantes', 'sima', 'baja_a', I('sima.scene.mouth.3'));
e('sombra-propia', 'perderse', 'te_guarda_en', I('sima.scene.lost.10'), I('screen.eclipse.text'));
e('sombra-propia', 'sima', 'tira_hacia_el_fondo_de', I('sima.scene.lost.10'));
e('sombra-propia', 'eco-del-eclipse', 'se_muestra_como', I('sima.scene.own-shadow.2'), I('sima.scene.own-shadow.3'));
e('lucidez', 'perderse', 'causa', I('endless.entry.clock'));
e('sima', 'lucidez', 'mide', I('endless.entry.clock'));
e('perderse', 'crater', 'devuelve_a', I('screen.eclipse.text'));
e('perderse', 'punto-de-quiebre', 'abre', I('sima.scene.lost.1'));
e('lucidez', 'figuraciones', 'causa', 'docs/gdd.md:433');
e('memoria', 'ecos-guardian', 'nombra', 'src/app/sima-lore.ts:53');
e('memoria', 'sombra-extraviada', 'nombra', 'src/app/sima-lore.ts:86');
e('memoria', 'herida-ajena', 'nombra', 'src/app/sima-lore.ts:81');
e('sima', 'otro-cielo', 'baja_hacia', I('sima.scene.lost.11'), I('sima.scene.lost.12'));
e('nihilego', 'otro-cielo', 'viene_de', I('guardian.nihilego.pre.2'));
e('arriba-abajo', 'otro-cielo', 'explica', 'docs/sima-redesign.md:96');
e('arriba-abajo', 'hambre', 'explica', 'docs/sima-redesign.md:96');
e('eco-del-eclipse', 'sima', 'aparece_en', 'docs/gdd.md:405');
e('ecos-guardian', 'sima', 'aparece_en', 'docs/gdd.md:383');
e('heraldos', 'sima', 'aparece_en', 'docs/gdd.md:407');
e('heraldos', 'estrato-3', 'empiezan_en', I('sima.scene.stratum-caves.3'), 'docs/gdd.md:407');
e('sombra-extraviada', 'sima', 'aparece_en', 'docs/gdd.md:429');
e('herida-ajena', 'estrato-4', 'empieza_en', 'docs/gdd.md:428');
e('sabueso', 'sima', 'aparece_en', 'docs/gdd.md:403');
e('eco-mercader', 'sima', 'aparece_en', 'docs/gdd.md:397');
e('altar', 'sima', 'aparece_en', 'docs/gdd.md:398');
e('reto-diario', 'sima', 'se_juega_en', I('endless.entry.daily'));
e('sombra-senda', 'sombras', 'es_un', 'docs/story-quests.md:16');
e('sima', 'crater', 'se_abre_en', 'docs/gdd.md:517');
e('crater', 'mirador', 'conecta_con', I('world.npc.keeper.4'), 'docs/gdd.md:516');
e('refugio', 'ruinas', 'conecta_con', I('world.lore.sign.1'));
e('ruinas', 'mirador', 'conecta_con', I('world.lore.sign.1'));
e('mirador', 'lago', 'conecta_con', I('world.npc.keeper.3'));
e('lago', 'cienaga', 'conecta_con', 'src/data/world.ts:390');
e('cripta', 'ruinas', 'se_abre_en', 'docs/gdd.md:515');
e('bosque', 'mirador', 'se_abre_en', 'docs/gdd.md:516');
e('cuevas', 'lago', 'se_abre_en', 'docs/gdd.md:336');
e('pantano', 'cienaga', 'se_abre_en', 'docs/gdd.md:519');
e('santuario', 'refugio', 'esta_en', 'docs/gdd.md:205');
e('estatua-sin-rostro', 'ruinas', 'esta_en', 'src/data/world.ts:203');
e('poste', 'ruinas', 'esta_en', 'src/data/world.ts:204');
e('estatua-quemada', 'crater', 'esta_en', 'src/data/world.ts:300');
e('idolo', 'lago', 'esta_en', 'src/data/world.ts:380');
e('cristal-caido', 'cienaga', 'esta_en', 'src/data/world.ts:436');
e('casa-grande', 'lago', 'esta_en', I('story.litwick.1.before.1'));
e('tierras-sin-nombre', 'lago', 'mas_alla_de', I('world.npc.oracle.2'));
e('primera-gota', 'cienaga', 'ocurre_en', I('world.npc.hermit.2'));
e('primera-gota', 'noche-del-eclipse', 'ocurre_en', I('world.npc.hermit.2'));
e('nihilego', 'noche-del-eclipse', 'cae_en', I('story.shinx.3.boss.6.pre.2'));
e('cristal-caido', 'otro-cielo', 'muestra', I('world.lore.crystal.2'));
e('phantump', 'lago', 'vive_en', I('travel.at'), 'src/data/world.ts:372');
e('phantump', 'caminantes', 'explica', I('sima.scene.lost.7'));
e('phantump', 'crater', 'espera_en', I('sima.plea.oracle.3'));
e('gastly', 'refugio', 'vive_en', 'src/data/town.ts:226');
e('poochyena', 'refugio', 'vive_en', 'src/data/town.ts:225');
e('smeargle', 'refugio', 'vive_en', 'src/data/world.ts:147');
e('croagunk', 'cienaga', 'vive_en', 'src/data/world.ts:430');
e('gastly', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:23');
e('cubone', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:24');
e('litwick', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:25');
e('poochyena', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:26');
e('mimikyu', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:27');
e('croagunk', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:28');
e('phantump', 'suplicas', 'aparece_en', 'src/data/sima-plea.ts:29');
e('suplicas', 'crater', 'ocurre_en', 'src/data/sima-plea.ts:42');
e('suplicas', 'la-boca', 'precede', 'src/data/sima-scenes.ts:93');
e('la-boca', 'sima', 'abre', 'src/data/sima-scenes.ts:94');
e('el-regreso', 'crater', 'ocurre_en', I('sima.scene.return.1'));
e('punto-de-quiebre', 'crater', 'ocurre_en', I('sima.scene.lost.6'));
e('gastly', 'manada-zorua', 'busca', I('sima.plea.storyteller.4'));
e('cubone', 'madre-cubone', 'busca', I('sima.plea.fisher.1'));
e('litwick', 'nino-casa-grande', 'busca', I('sima.plea.keeper.3'));
e('poochyena', 'hermana-mightyena', 'busca', I('sima.plea.shop.3'));
e('mimikyu', 'columpio-alguien', 'busca', I('sima.plea.gacha.2'));
e('croagunk', 'caminante-once', 'recuerda_a', I('sima.plea.hermit.1'));
e('caminante-once', 'caminantes', 'pertenece_a', I('sima.plea.hermit.1'));
e('caminante-once', 'sima', 'se_perdio_en', I('sima.plea.hermit.2'));
e('columpio-alguien', 'plaza', 'vive_en', I('sima.plea.gacha.1'));
e('madre-cubone', 'cuevas', 'se_perdio_en', I('story.cubone.2.before.1'));
e('madre-cubone', 'noche-del-eclipse', 'ocurre_en', I('story.cubone.2.before.1'));
e('nino-casa-grande', 'casa-grande', 'vive_en', I('story.litwick.2.before.1'));
e('manada-zorua', 'bosque', 'cruza', I('story.zorua.2.before.1'));
e('manada-zorua', 'noche-del-eclipse', 'ocurre_en', I('story.zorua.2.before.1'));
e('decidueye', 'manada-zorua', 'vio_pasar', I('story.zorua.2.boss.6.pre.1'));
e('vieja-empoleon', 'lago-helado', 'se_perdio_en', I('story.piplup.3.before.1'));
e('madre-shinx', 'shinx', 'es_madre_de', I('story.shinx.3.before.2'));
e('mayores-axew', 'barranca', 'se_perdio_en', I('story.axew.2.before.1'));
e('mayores-axew', 'noche-del-eclipse', 'ocurre_en', I('story.axew.2.before.1'));
e('dragonite', 'mayores-axew', 'pertenece_a', I('story.axew.3.boss.6.pre.2'));
e('trevenant', 'axew', 'salva_a', I('story.axew.2.after.2'));
e('pequeno-que-miro', 'mimikyu', 'vio_a', I('story.mimikyu.2.before.3'));
e('pequeno-que-miro', 'plaza', 'vive_en', I('story.mimikyu.2.before.3'));
e('madre-cubone', 'cubone', 'es_madre_de', I('story.cubone.2.before.1'));
e('vieja-empoleon', 'piplup', 'salva_a', I('story.piplup.2.after.2'));
e('nino-casa-grande', 'litwick', 'guiado_por', I('story.litwick.2.before.3'));
e('manada-zorua', 'zorua', 'deja_atras_a', I('story.zorua.2.before.2'));
e('mayores-axew', 'axew', 'deja_atras_a', I('story.axew.1.after.3'));
e('senda-mimikyu-2', 'plaza', 'recuerda', I('story.mimikyu.2.before.1'));
e('senda-litwick-2', 'casa-grande', 'recuerda', I('story.litwick.2.voice.arrive'));
e('senda-cubone-3', 'torre', 'sube_a', I('story.cubone.3.before.1'));
e('senda-zorua-1', 'fuente', 'recuerda', I('story.zorua.1.before.1'));
e('senda-zorua-3', 'niebla-blanca', 'recorre', I('story.zorua.3.before.1'));
e('senda-piplup-2', 'lago-helado', 'recuerda', I('story.piplup.2.before.1'));
e('senda-axew-2', 'barranca', 'recuerda', I('story.axew.2.before.1'));
e('abra', 'eclipse', 'presiente', I('story.abra.2.after.1'));
e('shinx', 'noche-del-eclipse', 'nace_en', I('story.shinx.1.before.1'));
e('litwick', 'hambre', 'teme_ser', I('story.litwick.3.before.2'));
e('phantump', 'reencarnacion', 'explica', I('sima.scene.lost.9'));
e('estatua-quemada', 'eclipse', 'mira_a', I('world.lore.crater.1'));
e('estatua-sin-rostro', 'aegislash', 'recuerda', I('world.lore.knight.2'));
e('estrato-1', 'cripta', 'imita', 'docs/gdd.md:393');
e('estrato-2', 'bosque', 'imita', 'docs/gdd.md:393');
e('estrato-3', 'cuevas', 'imita', 'docs/gdd.md:393');
e('estrato-4', 'pantano', 'imita', 'docs/gdd.md:393');
e('estrato-5', 'otro-cielo', 'baja_hacia', I('sima.band.abyss.lore.2'));
e('hambre', 'necrozma', 'es', 'docs/gdd.md:231');
e('sombras-amigos', 'sima', 'aparece_en', 'docs/lore/lore.md:355');
e('sombras-amigos', 'sombra-propia', 'depende_de', 'docs/lore/lore.md:355');
e('caminante-once', 'sombra-propia', 'es_el_final_de', I('sima.plea.hermit.2'), I('sima.scene.lost.13'));
e('caminantes', 'forma-de-la-herida', 'lleva_en_las_sendas', 'docs/gdd.md:423');
e('eclipse', 'noche-sin-fin', 'deja', 'docs/gdd.md:23', I('story.shinx.1.fragment.1.text'));
e('noche-sin-fin', 'refugio', 'da_nombre_a', 'docs/gdd.md:512');
e('noche-sin-fin', 'madre-cubone', 'la_luna_aun_sale_por', I('story.cubone.1.before.1'));
e('sombra-propia', 'sombras', 'deja_al_no_necesitarte', 'docs/gdd.md:422');
e('noche-del-eclipse', 'plaza', 'vuelve_sombra_de_golpe_a', I('story.mimikyu.3.before.1'), 'docs/gdd.md:422');
e('lago-helado', 'lago', 'es', I('world.npc.keeper.1'), 'docs/gdd.md:518');
e('piplup', 'cubone', 'junto_a', 'src/data/world.ts:348');
e('zorua', 'fuente', 'se_sienta_en', 'src/data/world.ts:362', I('story.zorua.1.before.1'));
e('abra', 'frag-abra-3-1', 'duerme_bajo', I('town.resident.abra.2'));
e('shinx', 'caminantes', 'vigila_a', I('town.resident.shinx.1'));
e('axew', 'mayores-axew', 'entrena_sin', I('town.resident.axew.1'));
e('forma-de-la-herida', 'herida', 'acompaña_a', I('challenge.cubone.lore'), 'docs/gdd.md:423');

const out = { generated: '2026-10-27', note: 'Lore graph of Mazmorra Sombría. Sources: "path:line" (or "path:line-line") into the repo, or "i18n:<key>" into src/i18n/es.json. Check: node tools/lore-graph-check.mjs', nodes, edges };
writeFileSync(`${ROOT}/docs/lore/lore-graph.json`, JSON.stringify(out, null, 1) + '\n');
console.log(nodes.length, 'nodes', edges.length, 'edges');
