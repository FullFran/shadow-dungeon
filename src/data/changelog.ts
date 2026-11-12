/**
 * The patch notes, the single source (issue #10): the in-game "Novedades"
 * screen (src/app/patch-notes.ts) and the GitHub Release text
 * (tools/release-notes.mjs) both read this list. Newest release first; the
 * first entry is always the package.json version (tests/data/changelog.test.ts),
 * so a release cannot ship without its notes. List only what is implemented
 * and deployed, in the player's words (docs/release.md).
 *
 * Plain data with erasable types only: Node runs tools/release-notes.mjs on
 * this file without a build step.
 */

/** A line of the notes in both languages. */
export interface ChangelogItem {
  es: string;
  en: string;
  /** Key of a drawn icon (src/ui/icons/achievements-news-icons.ts) for this row; the section's icon when absent. */
  icon?: string;
  /** A screenshot under src/assets/news/ (bundled, src/adapters/bundled-art.ts) (e.g. "news/title-hub.webp"), shown as a small thumbnail. */
  image?: string;
}

/** The sections of a release, in the order the screen and the release show them. */
export const CHANGELOG_SECTIONS = ['new', 'improved', 'fixed', 'multiplayer', 'balance', 'known'] as const;
export type ChangelogSection = (typeof CHANGELOG_SECTIONS)[number];

export interface Release {
  /** Semver, as in package.json. */
  version: string;
  /** YYYY-MM-DD of the deploy. */
  date: string;
  sections: Partial<Record<ChangelogSection, readonly ChangelogItem[]>>;
}

/** Orders two "major.minor.patch" versions: positive when `a` is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const CHANGELOG: readonly Release[] = [
  {
    version: '0.15.0',
    date: '2026-11-12',
    sections: {
      new: [
        {
          es: 'La bolsa: antes de entrar eliges hasta tres objetos de un solo uso y los usas en plena partida con su tecla o su botón del mando. Se consiguen en el nuevo puesto de objetos, junto al de Mimikyu, con tiradas o a precio fijo.',
          en: 'The bag: before you go in, pick up to three single-use items and use them mid-run with their key or controller button. Get them at the new item stall next to Mimikyu\'s, by pulls or at a fixed price.',
          icon: 'download',
        },
        {
          es: 'Cinco Pokémon nuevos en la Cripta, sus Sendas y el estrato de la Cripta de la Sima: Honedge, Bronzor, Yamask, Murkrow y Klefki, cada uno con su forma de pelear.',
          en: 'Five new Pokémon in the Crypt, its Senda roads and the Sima\'s Crypt stratum: Honedge, Bronzor, Yamask, Murkrow and Klefki, each with its own way of fighting.',
          icon: 'ghost',
        },
        {
          es: 'Cartas de hechizo nuevas para los ocho jefes de mazmorra, con patrones nuevos (oleadas, cercos, láseres, balas que te siguen y familiares), y una carta más para cada jefe de Senda en Difícil y Pesadilla.',
          en: 'New spell cards for the eight dungeon bosses, with new patterns (waves, closing rings, lasers, homing shots and familiars), and one more card for every Senda boss on Hard and Nightmare.',
          icon: 'eclipse',
        },
        {
          es: 'Ataques peligrosos: los que rodar no esquiva llevan una gran marca roja y su propio sonido. Rueda hacia ellos justo a tiempo y contraatacas.',
          en: 'Perilous attacks: the ones a roll does not dodge wear a big red mark and their own sound. Roll into them just in time to strike back.',
          icon: 'warning',
        },
      ],
      improved: [
        {
          es: 'Las mazmorras se ven mejor: suelos con textura, paredes de roca y objetos de decoración en cada sala.',
          en: 'Dungeons look better: textured floors, rock walls and props in every room.',
          icon: 'sparkle',
        },
        {
          es: 'Cada tipo de bala enemiga tiene su dibujo, y lo que se ve es justo lo que golpea.',
          en: 'Every kind of enemy bullet has its own look, and what you see is exactly what hits.',
          icon: 'star',
        },
        {
          es: 'Un reloj de carta de hechizo que se lee de un vistazo, con sello de captura y aviso en los últimos segundos. La última carta de un jefe ya no se queda colgada: el golpe final lo derriba.',
          en: 'A spell card clock you read at a glance, with a capture seal and a warning in the last seconds. A boss\'s last card no longer hangs: the final hit brings it down.',
          icon: 'trophy',
        },
      ],
      balance: [
        {
          es: 'Las plantas crecen con la dificultad (Difícil y Pesadilla son más grandes) y las salas de oleadas tienen más sitio para moverse.',
          en: 'Floors grow with the difficulty (Hard and Nightmare are bigger) and wave rooms have more room to move.',
          icon: 'rise',
        },
        {
          es: 'Pesadilla es más dura: élites con todos sus rasgos, menos curación y cartas de jefe con más vida. A cambio paga ×2,5.',
          en: 'Nightmare is harder: elites with all their traits, less healing and boss cards with more HP. In return it pays ×2.5.',
          icon: 'shield',
        },
      ],
      fixed: [
        {
          es: 'La elección de objeto tras un jefe espera a que acabe el aviso de victoria y sus últimas palabras.',
          en: 'The item pick after a boss waits for the victory notice and its last lines.',
          icon: 'wrench',
        },
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-11-12',
    sections: {
      new: [
        {
          es: 'Puedes cambiar los controles de teclado y ratón en Ajustes > Controles: pulsa una casilla y luego la tecla o el botón que quieras. Si choca con otra acción te avisa, y «Restablecer» vuelve a los de siempre.',
          en: 'You can change the keyboard and mouse controls in Settings > Controls: click a box, then the key or button you want. It warns you if it clashes with another action, and "Reset" brings back the usual ones.',
          icon: 'wrench',
        },
        {
          es: 'Retratos al estilo Mundo Misterioso junto a quien habla: en el pueblo, en las cinemáticas, en las frases de los jefes y en las tuyas, con su expresión del momento.',
          en: 'Mystery Dungeon style portraits next to whoever speaks: in town, in cutscenes, in the bosses\' lines and in your own, with the expression of the moment.',
          icon: 'sparkle',
        },
        {
          es: 'Evolucionar ya no te quita ninguna forma: puedes seguir eligiendo las anteriores, y comparten los movimientos aprendidos y las Mejoras de su línea.',
          en: 'Evolving no longer takes a form away: you can still pick the earlier ones, and they share their line\'s learned moves and upgrades.',
          icon: 'rise',
        },
      ],
      improved: [
        {
          es: 'Los números de daño dicen más: eficaz en naranja con «!», poco eficaz más pequeño, «Inmune» cuando casi no le afecta, y los golpes con STAB brillan con el color de su tipo.',
          en: 'Damage numbers tell you more: super effective in orange with "!", not very effective smaller, "Immune" when it barely affects it, and same-type (STAB) hits glow in their type\'s colour.',
          icon: 'star',
        },
        {
          es: 'Los cambios de fase y la derrota de un jefe se ven bien: un cartel grande en el centro, un momento de cámara lenta jugando solo y un consejo la primera vez.',
          en: 'Boss phase changes and defeats are easy to see: a big notice in the middle, a moment of slow motion in solo play and a tip the first time.',
          icon: 'trophy',
        },
        {
          es: 'Las últimas frases de un jefe y la elección de recompensa ya no se cierran con el clic de ataque que llevabas: hay que pulsar con calma.',
          en: 'A boss\'s last lines and the reward pick no longer close with the attack click you were already making: press calmly to go on.',
        },
        {
          es: 'Las ayudas en pantalla hablan de botones del mando o de tocar, según con qué juegues, y con mando el botón A avanza los diálogos.',
          en: 'On-screen hints talk about pad buttons or tapping, depending on what you play with, and on a pad the A button moves dialogue on.',
        },
      ],
      balance: [
        {
          es: 'Como en los juegos principales, un Pokémon de tipo Fuego no se quema y uno de tipo Veneno o Acero no se envenena. Un compañero Veneno o Acero cruza las charcas del Pantano sin envenenarse.',
          en: 'As in the main games, a Fire-type Pokémon is never burned and a Poison or Steel type is never poisoned. A Poison or Steel partner wades through the Swamp\'s pools without being poisoned.',
          icon: 'shield',
        },
      ],
      multiplayer: [
        {
          es: 'Si caes, debajo de a quién miras pone si un compañero aún te puede reanimar en esta planta.',
          en: 'If you faint, under who you are watching it says whether a partner can still revive you on this floor.',
        },
        {
          es: 'Ya nadie se queda esperando tras caer todo el grupo: el anfitrión siempre recibe la pregunta de la hoguera, y si la partida acaba, los invitados se enteran.',
          en: 'Nobody is left waiting after the whole party falls: the host always gets the bonfire question, and if the run ends, the guests know.',
        },
        {
          es: 'Si el anfitrión cambia de pestaña, la partida sigue para los demás en lugar de congelarse.',
          en: 'If the host switches tabs, the run goes on for everyone else instead of freezing.',
        },
        {
          es: 'Un invitado que vuelve a la sala a mitad de partida entra siempre en la planta siguiente.',
          en: 'A guest who comes back to the room mid-run always gets in on the next floor.',
        },
      ],
    },
  },
  {
    version: '0.13.0',
    date: '2026-11-11',
    sections: {
      new: [
        {
          es: 'En el móvil el juego se juega en horizontal: si lo sujetas en vertical, un aviso a pantalla completa te pide girarlo.',
          en: 'On a phone the game is played in landscape: if you hold it upright, a full-screen notice asks you to turn it.',
          icon: 'eclipse',
        },
        {
          es: 'En el Santuario, los jefes que aún no has vencido aparecen como siluetas negras con un borde de brasa.',
          en: 'In the Shrine, the bosses you have not beaten yet show as black silhouettes rimmed in ember light.',
          icon: 'ghost',
        },
      ],
      improved: [
        {
          es: 'En el móvil casi nada necesita desplazarse con el dedo: las ventanas que no caben se pasan por páginas, con botones o deslizando (ajustes por pestañas, tienda, tutor, logros, galería, amigos, Santuario, Sima, gacha, evolución, desafíos, tablón, informes, créditos, pausa y pantallas finales).',
          en: 'On a phone almost nothing needs scrolling: windows that do not fit turn into pages, with buttons or a swipe (settings as tabs, shop, tutor, achievements, gallery, friends, Shrine, Sima, gacha, evolution, challenges, board, reports, credits, pause and end screens).',
          icon: 'sparkle',
        },
        {
          es: 'En el móvil el menú del pueblo agrupa sus botones en tres hojas y deja más sitio al mapa.',
          en: 'On a phone the town menu folds its buttons into three sheets and leaves more room for the map.',
          icon: 'paw',
        },
        {
          es: 'Las misiones del tablón se ven en filas con el título completo.',
          en: 'Board missions show as rows with their whole title.',
          icon: 'trophy',
        },
        {
          es: 'Los controles táctiles de la partida ya no se pisan entre sí ni con el minimapa.',
          en: 'The in-run touch controls no longer overlap each other or the minimap.',
        },
      ],
      fixed: [
        {
          es: 'Al jugar como invitado en una sala online, un charco de veneno o un proyectil de un anillo te golpeaba una y otra vez y te bajaba la vida de golpe. Ahora cada uno golpea una sola vez, como jugando solo.',
          en: 'Playing as a guest in an online room, a poison puddle or one projectile of a ring hit you over and over and drained your HP in a burst. Now each one hits once, as in solo.',
          icon: 'shield',
        },
        {
          es: 'Un Pokémon ya no aparece un instante como un cuadrado magenta al empezar a andar.',
          en: 'A Pokémon no longer shows as a magenta square for a moment when it starts walking.',
        },
      ],
    },
  },
  {
    version: '0.12.1',
    date: '2026-11-06',
    sections: {
      improved: [
        {
          es: 'Con el móvil en vertical, el pueblo y las mazmorras se ven como antes: la pantalla horizontal en pequeño, a lo ancho.',
          en: 'With the phone held upright, the town and the dungeons look as before: the landscape screen, small, across the width.',
          icon: 'eclipse',
        },
        {
          es: 'En el móvil los controles táctiles están activos desde la primera pantalla y los botones son más grandes, fáciles de pulsar con el dedo.',
          en: 'On a phone the touch controls are on from the first screen and the buttons are bigger, easy to tap with a finger.',
          icon: 'sparkle',
        },
      ],
      fixed: [
        {
          es: 'En el móvil ningún menú esconde botones: si algo no cabe, la ventana se desplaza con el dedo (bienvenida, portada, ajustes, tienda, tutor, santuario, logros, menú del pueblo y final de partida).',
          en: 'On a phone no menu hides its buttons: if something does not fit, the window scrolls with your finger (welcome, title, settings, shop, tutor, shrine, achievements, town menu and the end of a run).',
        },
        {
          es: 'En ordenador todo sigue exactamente igual.',
          en: 'On a computer everything stays exactly the same.',
        },
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-11-05',
    sections: {
      new: [
        {
          es: 'Ahora puedes entrar con Google o Discord. Si ya tenías cuenta no pierdes nada: entra con Google o Discord usando el mismo correo y aparecerá tu partida, o sigue con tu correo y contraseña de siempre. Si ya tienes la sesión iniciada, vincula Google o Discord desde Cuenta.',
          en: 'You can now sign in with Google or Discord. If you already had an account you lose nothing: sign in with Google or Discord using the same email and your game is there, or keep using your usual email and password. If you are already signed in, link Google or Discord from Account.',
          icon: 'shield',
        },
        {
          es: 'Primera partida nueva: eliges entre crear cuenta o jugar como invitado (con lo que gana y pierde cada opción), y después el prólogo, un cuestionario de una pregunta por pantalla y la revelación de tu caminante sobre un altar.',
          en: 'A new first game: choose between creating an account or playing as a guest (with what each option gives and costs), then the prologue, a one-question-per-screen questionnaire and the reveal of your walker on an altar.',
          icon: 'sparkle',
        },
        {
          es: 'Si recargas la página en una mazmorra, un desafío, la Sima, el Santuario o el pueblo, vuelves al mismo sitio con la pausa abierta. Una derrota no se deshace recargando.',
          en: 'If you reload the page in a dungeon, a challenge, the Sima, the Shrine or the town, you come back to the same spot with the pause open. Reloading does not undo a defeat.',
          icon: 'rise',
        },
        {
          es: 'El menú del pueblo es un mapa de pergamino: sellos en cada servicio con quién lo lleva, y las opciones agrupadas en Tu equipo, Progreso, Social y Sistema.',
          en: 'The town menu is a parchment map: a seal on each service with who runs it, and the options grouped into Your team, Progress, Social and System.',
          icon: 'paw',
        },
      ],
      improved: [
        {
          es: 'Tu compañero descansa en un altar de piedra tallada, y el perfil y la cuenta muestran su cara.',
          en: 'Your partner rests on a carved stone altar, and the profile and the account show its face.',
          icon: 'eclipse',
        },
        {
          es: 'El juego ocupa toda la ventana y los Pokémon se ven más grandes. Al acercarte a algo, un aviso dice qué puedes hacer (Hablar, Leer, Viajar, Comprar...) y con qué tecla.',
          en: 'The game fills the whole window and Pokémon look bigger. When you get close to something, a hint says what you can do (Talk, Read, Travel, Buy...) and with which key.',
        },
        {
          es: 'HUD de combate más limpio: el centro queda libre, la barra del jefe lleva su nombre y título, y sus ataques se anuncian arriba.',
          en: 'A cleaner combat HUD: the centre stays clear, the boss bar shows its name and title, and its attacks are announced at the top.',
        },
        {
          es: 'Pausa nueva con el plano de la planta, tu nivel y experiencia, y la opción de pantalla completa (también con F11 o Alt+Enter).',
          en: 'A new pause with the floor plan, your level and experience, and a fullscreen option (also with F11 or Alt+Enter).',
        },
        {
          es: 'Las victorias y derrotas son una ceremonia sobre la partida congelada, con tus datos en fichas y la diferencia con tu mejor marca.',
          en: 'Wins and defeats are a ceremony over the frozen game, with your stats on tiles and the difference from your best mark.',
          icon: 'trophy',
        },
        {
          es: 'Santuario, Tablón, Galería, Logros, Maestro y Amigos rediseñados. En el Tablón ya puedes abandonar una misión.',
          en: 'Shrine, Board, Gallery, Achievements, Master and Friends redesigned. On the Board you can now abandon a mission.',
        },
        {
          es: 'Para saltar una cinemática hay que mantener el botón pulsado un momento, para no saltarla sin querer.',
          en: 'To skip a cutscene you now hold the button for a moment, so you do not skip it by accident.',
        },
        {
          es: 'El juego arranca más rápido: solo descarga los sprites que necesita en cada momento.',
          en: 'The game starts faster: it only downloads the sprites it needs at each moment.',
          icon: 'download',
        },
      ],
      fixed: [
        {
          es: 'Ningún Pokémon sale recortado en ninguna ventana.',
          en: 'No Pokémon is cropped in any window.',
        },
        {
          es: 'Si falla la conexión o un recurso, el juego lo dice y deja reintentar en vez de quedarse en blanco.',
          en: 'If the connection or a resource fails, the game says so and lets you retry instead of going blank.',
          icon: 'wrench',
        },
      ],
      known: [
        {
          es: 'Las partidas en línea no se recuperan al recargar la página.',
          en: 'Online games are not restored when you reload the page.',
          icon: 'warning',
        },
      ],
    },
  },
  {
    version: '0.11.1',
    date: '2026-11-03',
    sections: {
      fixed: [
        {
          es: 'Cada Pokémon recuerda sus movimientos: si eliges otros ataques, cambias de Pokémon y vuelves, siguen los que tenías equipados.',
          en: 'Each Pokémon remembers its moves: if you pick other attacks, switch Pokémon and come back, the ones you had equipped are still there.',
        },
      ],
    },
  },
  {
    version: '0.11.0',
    date: '2026-11-02',
    sections: {
      new: [
        {
          es: 'Título renovado: tu compañero en un círculo rúnico, los servicios como iconos a los lados, «Jugar» y «Jugar en línea» abajo, y de fondo el Refugio del Ocaso en ruinas bajo el eclipse, con Mimikyu y Gastly.',
          en: 'Title redesigned: your partner in a rune circle, the services as icons on both sides, «Play» and «Play online» at the bottom, and behind them Dusk Haven in ruins under the eclipse, with Mimikyu and Gastly.',
          icon: 'eclipse',
          image: 'news/title-hub.webp',
        },
        {
          es: 'Logros más visuales: cada categoría tiene su icono y su barra de progreso, y cada logro es una casilla con su icono, su dificultad, su premio y la fecha en que lo conseguiste.',
          en: 'More visual achievements: each category has its icon and progress bar, and each achievement is a tile with its icon, difficulty, reward and the date you won it.',
          icon: 'trophy',
          image: 'news/achievements.webp',
        },
        {
          es: 'Novedades más fáciles de leer: una tarjeta por versión con la última desplegada, secciones con su icono y un titular en negrita en cada nota.',
          en: 'Easier-to-read news: one card per version with the latest unfolded, sections with their icon and a bold headline on each note.',
          icon: 'star',
        },
        {
          es: 'Tu Sombra tiene su escena antes y después del combate, y al llegar al pueblo por primera vez Gastly te enseña la tienda, el tutor, el tablón y el Santuario, y te deja ante la piedra guía con la Cripta lista.',
          en: 'Your Shadow has its scene before and after the fight, and the first time you reach the town Gastly shows you the shop, the tutor, the board and the shrine, and leaves you at the waystone with the Crypt ready.',
          icon: 'ghost',
        },
        {
          es: 'Ganar se nota: al caer el guardián cruza la pantalla un gran «VICTORIA», y la pantalla final de una victoria brilla en dorado.',
          en: 'Winning shows: when the guardian falls a large «VICTORY» crosses the screen, and a won run\'s end screen glows gold.',
          icon: 'trophy',
        },
        {
          es: 'En el título sale «Instalar juego» arriba a la derecha: en el móvil y en el ordenador te dice cómo tenerlo como una aplicación.',
          en: '«Install game» shows in the title\'s top right corner: on phones and computers it tells you how to keep it as an app.',
          icon: 'download',
        },
        {
          es: 'Si tu navegador permite instalar el juego, en el título sale «Instalar juego» arriba a la derecha.',
          en: 'If your browser can install the game, «Install game» shows in the title\'s top right corner.',
        },
        {
          es: 'Camino Hundido: tu primera partida es ahora una bajada corta hasta el pueblo que te enseña a jugar, y al final te espera Tu Sombra, que pelea con tus mismos movimientos. Al vencerla se abre el pueblo; la Cripta pasa a ser la primera mazmorra de verdad.',
          en: 'The Sunken Way: your first run is now a short descent to the town that teaches you how to play, and at its end Your Shadow waits, fighting with your own moves. Beat it and the town opens; the Crypt becomes the first real dungeon.',
        },
        {
          es: 'Carteles de piedra que te enseñan cada control la primera vez que lo necesitas, con las teclas del teclado, del táctil o del mando. Jugando a solas, la partida se para hasta que pulsas.',
          en: 'Stone signs teach each control the first time you need it, with keyboard, touch or gamepad keys. Playing alone, the run waits until you press.',
        },
        {
          es: 'El menú del pueblo (Esc) es ahora un plano de la zona en la que estás, con un punto que marca dónde estás: muévete entre los vecinos y lugares para abrir lo que ofrecen. Manteniendo Tab sale una rueda rápida con lo más usado.',
          en: 'The town menu (Esc) is now a map of the zone you are in, with a mark where you stand: move between its people and places to open what they offer. Holding Tab brings up a quick wheel with what you use most.',
        },
        {
          es: 'En el pueblo puedes correr: mantén Shift, o empuja el joystick hasta el borde.',
          en: 'You can run in the town: hold Shift, or push the joystick to its edge.',
        },
        {
          es: 'Las súplicas del borde de la Sima, rehechas: los vecinos te esperan reunidos, cada uno te da un nombre y al final contestas a Phantump.',
          en: 'The pleas on the Sima\'s rim, remade: the villagers wait gathered, each gives you one name, and at the end you answer Phantump.',
        },
      ],
      multiplayer: [
        {
          es: 'Un corte breve de conexión ya no te saca de la sala: la partida espera unos segundos con el aviso «Reconectando con el anfitrión…» y sigue al volver. Si la sala se pierde de verdad, se dice. Recargar la página en una sala llena ya no te deja fuera, y las salas se anuncian en más relés para encontrarse antes.',
          en: 'A short connection drop no longer throws you out of the room: the run waits a few seconds with «Reconnecting to the host…» and goes on when it is back. If the room is really lost, it says so. Reloading the page in a full room no longer leaves you out, and rooms are announced on more relays to find each other sooner.',
        },
      ],
      fixed: [
        {
          es: 'F1 ya no abre la ayuda del navegador en mitad de una partida, y si cambias de pestaña o de ventana jugando a solas la partida se pausa sola.',
          en: 'F1 no longer opens the browser\'s help mid-run, and switching tab or window while playing alone pauses the run.',
        },
        {
          es: 'El prólogo y las demás cinemáticas vuelven a avanzar solas: ya no se quedan esperando a que pulses sin avisar.',
          en: 'The prologue and the other cinematics move on by themselves again: they no longer sit waiting for a press without telling you.',
        },
        {
          es: 'Las ventanas cortas de los menús (Jugar en línea, el Santuario, el test de personalidad y otras) vuelven a salir centradas, y en el móvil «Jugar» ocupa toda la fila del título.',
          en: 'Short menu windows (Play online, the shrine, the personality test and others) are centred again, and on phones «Play» takes the title\'s whole row.',
        },
      ],
      improved: [
        {
          es: 'Título y Opciones nuevos: «Jugar» destaca y dice adónde te lleva, y las opciones van agrupadas con su icono. Los Ajustes van por pestañas y cada opción explica qué hace.',
          en: 'New title and Options: «Play» stands out and says where it leads, and the options are grouped with their icons. Settings come in tabs and each option says what it does.',
        },
        {
          es: 'Textos más legibles: las descripciones, los textos largos y las casillas donde escribes usan una letra pensada para leerse bien.',
          en: 'Easier to read: descriptions, long texts and the fields you type in use a typeface made to read well.',
        },
        {
          es: 'Cinemáticas: el texto avanza solo, como siempre; si quitas el botón Auto, cada panel espera a que pulses. Jugando a solas, las palabras de las Sendas paran la partida hasta que pulsas.',
          en: 'Cinematics: the text moves on by itself, as always; turn the Auto button off and each panel waits for your press. Playing alone, the Sendas\' spoken lines pause the run until you press.',
        },
        {
          es: 'En el móvil, el aviso legal ya no tapa los menús, y las pistas hablan de tocar en vez de teclas.',
          en: 'On phones the legal notice no longer covers the menus, and the hints talk about tapping instead of keys.',
        },
      ],
    },
  },
  {
    version: '0.10.3',
    date: '2026-11-02',
    sections: {
      multiplayer: [
        {
          es: 'Salir de la partida desde el menú en una sala online ya no te echa de la sala: vuelves al pueblo de la sala y entras con el grupo en la siguiente planta. Si sale el anfitrión, toda la sala vuelve al pueblo.',
          en: 'Quitting a run from the menu in an online room no longer throws you out of the room: you go back to the room\'s town and join the group again on the next floor. If the host quits, the whole room goes back to the town.',
        },
        {
          es: 'Si entras en una sala con la partida empezada, la ventana de la sala dice que esperas a la siguiente planta, en vez de «El anfitrión no responde».',
          en: 'Joining a room while its run is underway now says you are waiting for the next floor, instead of "The host is not responding".',
        },
      ],
    },
  },
  {
    version: '0.10.2',
    date: '2026-11-01',
    sections: {
      improved: [
        {
          es: 'Las Sendas abren sus dificultades en orden: empiezas en Normal, Difícil se abre al cerrar el capítulo I y Pesadilla al cerrar el II. Fácil sigue abierta para practicar, sin historia ni materiales. Si tienes elegida una dificultad aún cerrada, la Senda se juega en la más alta abierta. En las salas online sigue mandando la dificultad del anfitrión.',
          en: 'Sendas now open their difficulties in order: you start on Normal, Hard opens when you close chapter I and Nightmare when you close chapter II. Easy stays open for practice, with no story or materials. If you have a difficulty picked that is still shut, the Senda plays at the highest one open. In online rooms the host\'s difficulty still applies.',
        },
      ],
    },
  },
  {
    version: '0.10.1',
    date: '2026-11-01',
    sections: {
      improved: [
        {
          es: 'La ventana de desafíos avisa de cuándo salen las escenas de una Senda: jugando en solitario y nunca en Fácil.',
          en: 'The challenges window now tells you when a Senda shows its scenes: when you play solo, and never on Easy.',
        },
        {
          es: 'Los créditos ya incluyen los efectos visuales, las casillas del pueblo, los datos de movimientos y las librerías que usa el juego.',
          en: 'The credits now include the visual effects, the town tiles, the move data and the libraries the game uses.',
        },
      ],
      fixed: [
        {
          es: 'Galería: una escena de una Senda ya se puede volver a ver en cuanto la has visto, aunque aún no hayas ganado el capítulo. Las que viste antes de esta versión aparecerán cuando las vuelvas a ver o cierres su capítulo.',
          en: "Gallery: a Senda's scene can be watched again as soon as you have seen it, even before winning the chapter. Those you saw before this version appear once you see them again or close their chapter.",
        },
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-11-01',
    sections: {
      new: [
        {
          es: '¡Ataques y mundo mucho más bonitos! Todos los movimientos, los impactos, los ataques enemigos y los jefes tienen efectos nuevos, y también los cristales, la hoguera y los altares. Las escaleras siguen siendo las de siempre, por supuesto.',
          en: 'Much prettier attacks and world! Every move, hit, enemy attack and boss has new effects, and so do crystals, the bonfire and altars. The stairs stay the classic ones, of course.',
        },
        {
          es: 'Movimientos con personalidad: Golpe Umbrío, Golpe Fantasma y Excavar te hacen desaparecer mientras cargas, Danza Espada hace girar espadas a tu alrededor, Fuego Fatuo te rodea de llamitas, Rayo Solar reúne luz antes de disparar y Tierra Viva brota del suelo hacia el enemigo.',
          en: 'Moves with personality: Shadow Force, Phantom Force and Dig make you vanish while they wind up, Swords Dance whirls swords around you, Will-O-Wisp surrounds you with little flames, Solar Beam gathers light before firing and Earth Power bursts from the ground towards the enemy.',
        },
        {
          es: 'Los movimientos que drenan devuelven partículas de vida a quien los usa.',
          en: 'Draining moves send motes of life back to their user.',
        },
      ],
      improved: [
        {
          es: 'Los efectos se preparan en segundo plano sin descargar imágenes: el juego sigue siendo ligero. Si un efecto aún no está listo, verás su dibujo clásico un instante.',
          en: 'Effects are prepared in the background with no images to download, so the game stays light. If an effect is not ready yet, you will see its classic look for a moment.',
        },
      ],
      fixed: [
        {
          es: 'Golpes Furia, Ataque Óseo y otros movimientos de varios golpes ya no frenan la partida al encadenarlos: solo el último golpe detiene la acción.',
          en: 'Fury Swipes, Bone Rush and other multi-hit moves no longer slow the game down when chained: only the last hit stops the action.',
        },
      ],
      multiplayer: [
        {
          es: 'Partidas más fluidas: en cooperativo los golpes ya no paran el juego un instante, lo que hacía que los demás te vieran a saltos y que los enemigos fueran a tirones al pegar mucho seguido.',
          en: 'Smoother games: in co-op, hits no longer pause the game for a moment, which made others see you jump around and enemies stutter when hitting a lot in a row.',
        },
        {
          es: 'Ves los movimientos de tus compañeros con su efecto propio, también sus disparos.',
          en: 'You see your teammates\' moves with their own effects, their shots included.',
        },
      ],
      balance: [
        {
          es: 'Onda Ígnea ahora golpea a tu alrededor, como las demás ondas, en vez de en un cono delante de ti.',
          en: 'Heat Wave now hits all around you, like the other waves, instead of in a cone in front of you.',
        },
      ],
    },
  },
  {
    version: '0.9.8',
    date: '2026-10-30',
    sections: {
      new: [
        {
          es: 'Amigos: añade a tus amigos con su código (en el menú del pueblo y en Opciones), mira quién está conectado y entra en su sala con «Unirse». Necesitas una cuenta.',
          en: 'Friends: add your friends by their code (in the town menu and Options), see who is online and enter their room with "Join". You need an account.',
        },
        {
          es: 'Sucesos en todas las mazmorras: cofres con guardianes, mercader, altares, emboscadas, nidos, casas de monstruos y salas de oleadas.',
          en: 'Events in every dungeon: guarded chests, a merchant, altars, ambushes, nests, monster houses and wave rooms.',
        },
      ],
      improved: [
        {
          es: 'Ya no eliges objeto en cada planta: eliges tras cada jefe, y los demás se ganan en cofres y sucesos. Esto cambia mucho la dificultad, y seguiremos ajustándola: contadnos qué tal.',
          en: 'You no longer pick an item on every floor: you pick after each boss, and the rest are won from chests and events. This changes the difficulty a lot, and we will keep adjusting it: tell us how it feels.',
        },
        {
          es: 'Los códigos de sala se leen mejor: otra letra, y sin caracteres que se confunden. Un código creado antes de esta versión quizá no valga: crea la sala de nuevo.',
          en: 'Room codes are easier to read: another font, and no characters that look alike. A code made before this version may not work: create the room again.',
        },
      ],
      fixed: [
        {
          es: 'Cooperativo: al volver a la hoguera, el grupo podía quedarse bloqueado con un compañero que se veía muerto o congelado. ¡Gracias por el reporte SD-Q090F7!',
          en: 'Co-op: after going back to the bonfire, the group could get stuck with a teammate who looked dead or frozen. Thanks for report SD-Q090F7!',
        },
      ],
    },
  },
  {
    version: '0.9.7',
    date: '2026-10-30',
    sections: {
      fixed: [
        {
          es: 'Sima, en cooperativo: un Heraldo del Eclipse podía verse distinto según el jugador. Ahora todo el grupo ve al mismo.',
          en: 'Sima, in co-op: a Herald of the Eclipse could look different to each player. Now the whole group sees the same one.',
        },
        {
          es: 'En el móvil, el botón «Atrás» tapaba el título de muchas ventanas, y el logo no cabía en las pantallas más estrechas. ¡Gracias por el reporte SD-8AAYCK!',
          en: 'On phones, the "Back" button covered the title of many windows, and the logo did not fit the narrowest screens. Thanks for report SD-8AAYCK!',
        },
      ],
    },
  },
  {
    version: '0.9.6',
    date: '2026-10-30',
    sections: {
      new: [
        {
          es: 'Género de los Pokémon: en la pantalla de Pokémon eliges macho o hembra en las especies con dibujo propio, de momento Shinx, Luxio y Luxray. Es solo de aspecto, y en cooperativo lo ven los demás.',
          en: 'Pokémon gender: in the Pokémon screen you pick male or female for species with their own art, for now Shinx, Luxio and Luxray. It only changes the look, and others see it in co-op.',
        },
      ],
    },
  },
  {
    version: '0.9.5',
    date: '2026-10-30',
    sections: {
      improved: [
        {
          es: '«Controles del mando», en Opciones y en el menú del pueblo: qué hace cada botón de un mando de Xbox o PlayStation.',
          en: '"Controller buttons", in Options and the town menu: what each button does on an Xbox or PlayStation pad.',
        },
      ],
      fixed: [
        {
          es: 'Sima, en cooperativo: al cerrarse las puertas de una sala de oleadas, quien seguía fuera se quedaba sin poder entrar ni avanzar. Ahora todo el grupo aparece dentro. ¡Gracias por el reporte SD-OKCVHT!',
          en: 'Sima, in co-op: when a wave room\'s doors closed, anyone still outside could neither enter nor go on. Now the whole group appears inside. Thanks for report SD-OKCVHT!',
        },
      ],
    },
  },
  {
    version: '0.9.4',
    date: '2026-10-30',
    sections: {
      new: [
        {
          es: '¿Olvidaste tu contraseña? En Cuenta ya puedes pedir un enlace por correo para elegir otra. Y con la sesión iniciada, «Cambiar contraseña» hace lo mismo.',
          en: 'Forgot your password? In Account you can now ask for an email link to choose a new one. And when logged in, "Change password" does the same.',
        },
        {
          es: '«Cambiar Pokémon» en el menú del pueblo (Esc o el botón «Menú»): cambia de Pokémon y de movimientos sin salir, también en una sala en línea, y los demás ven el cambio.',
          en: '"Change Pokémon" in the town menu (Esc or the "Menu" button): switch Pokémon and moves without leaving, also in an online room, and the others see the change.',
        },
        {
          es: '¡Soporte para mando! Combate, pueblo, menús y cinemáticas, con stick analógico y apuntado con el stick derecho. La lista de botones está en Ajustes. Para escribir (código de sala, cuenta) aún hace falta teclado.',
          en: 'Controller support! Combat, town, menus and cinematics, with an analogue stick and right stick aiming. The button list is in Settings. Typing (room code, account) still needs a keyboard.',
        },
      ],
      fixed: [
        {
          es: 'En cooperativo se ven los ataques del compañero: sus golpes, sus áreas y la carga de sus movimientos fuertes, y sus disparos con el color de su tipo.',
          en: 'In co-op you now see your teammate\'s attacks: swings, areas and the charge of heavy moves, and shots in their type\'s colour.',
        },
        {
          es: 'Los Restos ya no curan esperando junto a una hoguera sin nada que combatir.',
          en: 'Leftovers no longer heal while you wait by a bonfire with nothing left to fight.',
        },
        {
          es: 'Al vencer a un jefe, su música termina y suena una fanfarria de victoria.',
          en: 'When you beat a boss, its music ends and a victory fanfare plays.',
        },
        {
          es: 'Quien entraba por primera vez por «Jugar en línea» se saltaba el prólogo y el test de personalidad y jugaba con el Pokémon por defecto. Ya pasa por ellos, como en «Jugar». Si te lo perdiste, lo tienes en Ajustes: «Repetir test».',
          en: 'Players whose first time was through "Play online" skipped the prologue and the personality test and played the default Pokémon. Now they go through them, as in "Play". If you missed it, it is in Settings: "Retake test".',
        },
      ],
    },
  },
  {
    version: '0.9.3',
    date: '2026-10-30',
    sections: {
      fixed: [
        {
          es: 'En táctil, los ataques fuertes que se cargan salían siempre en la misma dirección. Ahora van hacia donde arrastras el dedo. ¡Gracias a quien nos lo avisó con el reporte SD-AM7I1B! Este arreglo es gracias a ti.',
          en: 'On touch, charged heavy moves always fired in the same direction. Now they go where you drag your finger. Thanks to whoever told us with report SD-AM7I1B! This fix is thanks to you.',
        },
      ],
    },
  },
  {
    version: '0.9.2',
    date: '2026-10-29',
    sections: {
      improved: [
        {
          es: 'El menú de pausa (Esc) de una partida tiene «Reportar un problema» y «Copiar informe técnico», para avisar de un fallo sin salir de la mazmorra.',
          en: 'The in-run pause menu (Esc) has "Report a problem" and "Copy technical report", to report a bug without leaving the dungeon.',
        },
      ],
    },
  },
  {
    version: '0.9.1',
    date: '2026-10-29',
    sections: {
      improved: [
        {
          es: '«Reportar un problema» puede adjuntar un informe técnico de la sesión (errores recientes y estado de la conexión, nada personal) si dejas marcada la información técnica.',
          en: '"Report a problem" can attach a technical report of your session (recent errors and connection state, nothing personal) when technical info stays on.',
        },
      ],
      multiplayer: [
        {
          es: 'En una sala en línea, el menú (Esc) tiene «Copiar informe técnico» para pegarlo al pedir ayuda.',
          en: 'In an online room, the Esc menu has "Copy technical report" to paste when asking for help.',
        },
        {
          es: 'Si tu versión y la del anfitrión no coinciden, el aviso dice las dos y cómo actualizar: recarga la página y, si lo tienes instalado, ciérralo y vuelve a abrirlo.',
          en: 'When your version and the host\'s differ, the notice names both and how to update: reload the page and, if installed, close it and open it again.',
        },
      ],
      known: [
        {
          es: 'El modo cooperativo se sigue probando con jugadores. Si tienes problemas al conectar o jugar en grupo, repórtalo desde Opciones.',
          en: 'Co-op is still being tested with players. If you have trouble connecting or playing together, report it from Options.',
        },
      ],
    },
  },
  {
    version: '0.9.0',
    date: '2026-10-29',
    sections: {
      new: [
        {
          es: '«Novedades», en Opciones: lo que cambia en cada versión. Aparece sola una vez después de cada actualización.',
          en: '"What\'s new", in Options: what changes in each version. It opens once by itself after every update.',
        },
        {
          es: 'La versión del juego se ve en el título y en los créditos.',
          en: 'The game version shows on the title screen and in the credits.',
        },
        {
          es: '«Reportar un problema», en Opciones y en los Ajustes del pueblo: cuéntanos qué ha fallado sin necesidad de cuenta y recibe un número de referencia.',
          en: '"Report a problem", in Options and in the town Settings: tell us what went wrong, no account needed, and get a reference number.',
        },
        {
          es: 'El Tablón del pueblo muestra la clasificación global de la Sima. Para aparecer en ella, inicia sesión y elige un apodo en Ajustes.',
          en: 'The town notice board shows the global Sima ranking. To appear on it, sign in and pick a nickname in Settings.',
        },
        {
          es: 'Cada jefe de la Sima espera tras un muro de niebla, con una hoguera que se enciende al llegar. Tras la niebla el reloj se detiene. En solitario y en cooperativo.',
          en: 'Every Sima boss waits behind a fog wall, with a bonfire lit on arrival. The clock stands still behind the fog. Solo and co-op.',
        },
        {
          es: 'Las pruebas del Santuario de los Juramentos se abren tras un muro de niebla: el grupo se reúne y cruza a la vez.',
          en: 'The Sanctum of Oaths trials open behind a fog wall: the party gathers and crosses together.',
        },
        {
          es: 'Cada Senda tiene a su vecino en el mundo, y cada uno cuenta cosas nuevas al cerrar capítulos de su Senda.',
          en: 'Every Senda has its resident in the world, and each one says new things as chapters of their Senda close.',
        },
        {
          es: 'Galería en el menú del pueblo (Esc) para volver a ver las cinemáticas que ya has visto.',
          en: 'A gallery in the town menu (Esc) to watch again the cinematics you have already seen.',
        },
      ],
      improved: [
        {
          es: 'La música de jefe empieza después de cruzar la niebla y de la cinemática, en todas las mazmorras.',
          en: 'Boss music starts after crossing the fog and the cinematic, in every dungeon.',
        },
        {
          es: 'La cinemática de apertura de cada capítulo de una Senda se ve en cada intento y se puede saltar desde el primer momento.',
          en: "Each Senda chapter's opening cinematic plays on every attempt and can be skipped right away.",
        },
        {
          es: 'Las cinemáticas se ajustan a pantallas pequeñas, como un móvil en vertical.',
          en: 'Cinematics fit small screens, such as a phone held upright.',
        },
        {
          es: 'Las súplicas de los vecinos esperan a que hayas superado la Cripta del Rey de las Espadas.',
          en: "The villagers' pleas wait until you have cleared the Crypt of the Sword King.",
        },
      ],
      fixed: [
        {
          es: 'Si vuelves al juego con progreso, tu última especie se mantiene en su forma evolucionada.',
          en: 'When you come back with progress, your last species keeps its evolved form.',
        },
        {
          es: 'Al iniciar sesión en otro dispositivo con progreso ya no se repiten el prólogo ni el test de personalidad, y el test ya no cambia tu especie.',
          en: 'Signing in on another device with progress no longer replays the prologue and the personality test, and the test no longer changes your species.',
        },
        {
          es: 'La escena del punto de quiebre de la Sima se ve en la primera partida que acaba perdida o derrotada.',
          en: "The Sima's breaking point scene plays on the first run that ends lost or defeated.",
        },
        {
          es: 'Los avisos de logros ya no tapan las cinemáticas.',
          en: 'Achievement notices no longer cover the cinematics.',
        },
        {
          es: 'Ya se puede hablar con el pescador del muelle.',
          en: 'You can now talk to the fisher on the pier.',
        },
        {
          es: 'Correcciones en varios textos de la historia.',
          en: 'Fixes to several story texts.',
        },
      ],
      multiplayer: [
        {
          es: 'Si el anfitrión se va a mitad de partida, la pantalla final dice «Partida interrumpida» en lugar de que tu Pokémon se ha debilitado.',
          en: 'If the host leaves mid-run, the end screen says "Run cut short" instead of saying your Pokémon fainted.',
        },
        {
          es: 'Si a un invitado se le cae la conexión, ahora puede volver a entrar en la sala.',
          en: 'Guests whose connection dropped can now get back into the room.',
        },
        {
          es: 'Mientras el anfitrión te deja entrar, la sala dice «Conectando…» y, si no responde, te explica por qué puede estar pasando.',
          en: 'While the host lets you in, the room says "Connecting…", and if the host does not answer it explains why that may be.',
        },
        {
          es: 'Cuando dos jugadores no pueden conectarse directamente, la partida en cooperativo pasa por un servidor de retransmisión: así quienes juegan desde redes estrictas o con datos móviles deberían poder conectarse.',
          en: 'When two players cannot connect directly, co-op now goes through a relay server, so players behind strict networks or on mobile data should be able to connect.',
        },
      ],
      known: [
        {
          es: 'El modo cooperativo se está probando con jugadores. Si tienes problemas al conectar o jugar en grupo, avísanos.',
          en: 'Co-op is being tested with players. If you have trouble connecting or playing together, let us know.',
        },
      ],
    },
  },
];
