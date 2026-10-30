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
    version: '0.9.4',
    date: '2026-10-30',
    sections: {
      new: [
        {
          es: '¿Olvidaste tu contraseña? En Cuenta ya puedes pedir un enlace por correo para elegir otra. Y con la sesión iniciada, «Cambiar contraseña» hace lo mismo.',
          en: 'Forgot your password? In Account you can now ask for an email link to choose a new one. And when logged in, "Change password" does the same.',
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
