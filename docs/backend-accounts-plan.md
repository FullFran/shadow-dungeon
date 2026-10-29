# Cuentas, rankings en línea y (después) gacha: plan de backend

Estado (actualizado 2026-10-29): **en parte construido y superado.** Este documento conserva la propuesta del 2026-10-26 y sus razones; lo que existe de verdad está en `server/` (ahora en `main`) y en `server/README.md`.

Diferencias con la propuesta:
- Hooks en Go, no JS `pb_hooks`.
- Cuentas con email y contraseña; OAuth está preparado pero apagado.
- Colecciones `profiles`, `saves` (con `rev` optimista) y `reports`. No hay `runs` ni `records`, ni verificador de partidas: el ranking de la Sima sale de los guardados y **no está verificado** (issue #13).
- Rutas propias: ranking, lore, credenciales TURN y reportes de fallos.
- Copias automáticas configurables hacia R2.

Lo que sigue es la propuesta original. Toda acción remota (VPS, DNS, consolas de Twitch/Discord/Google) necesita que el dueño autorice de forma explícita el destino, la operación y la credencial (sección 5).

Convenciones del documento:

- **[V]** hecho verificado contra una fuente primaria (URL y fecha de consulta) o contra el código del repo (ruta).
- **[I]** inferencia o estimación mía, sin medir. Hay que comprobarla antes de apoyarse en ella.

Este documento parte de `~/fullfran/game-analysis/notes/backend-options.md` (2026-10-25) y de `docs/gdd.md` §5, §7, §11 y §12.

---

## 0. Resumen

1. **Backend:** PocketBase v0.40.x en el VPS de Contabo, como binario fijado y detrás del **Traefik que ya existe** (no Caddy: Traefik ya ocupa los puertos 80 y 443). Al lado va un **verificador Node** que repite las partidas con el mismo core TypeScript. La lógica pequeña (gacha, libro de monedas, borrado de cuenta) vive en `pb_hooks` (JS). Si crece, se pasa a Go.
2. **Anti-trampas:** el core es determinista, así que el cliente sube semilla, build e inputs comprimidos, y el verificador recalcula la puntuación. Una partida de 30 min son unos 108 000 ticks, del orden de 1 s de CPU **[I]**. Ni los hooks JS de PocketBase (goja) ni el plan gratuito de Cloudflare Workers (10 ms de CPU) sirven para verificar. Hay dos requisitos previos en el cliente: **sacar de `src/app/game.ts` un "run driver" puro** y **quitar del core las funciones matemáticas aproximadas por cada implementación** (`Math.sin`, `cos`, `atan2`, `hypot`).
3. **Cooperativo:** no es reproducible con el diseño actual (los invitados reclaman golpes y el anfitrión los acepta; las instantáneas llegan cuando llegan). Al principio el cooperativo va a un **tablón aparte, "sin verificar"**.
4. **Cliente:** puertos `AccountService`, `ProfileRepository`, `RankingService` y `SaveSync` con adaptadores `local` y `pocketbase`, más una cola de subida que funciona sin conexión. El modo invitado se queda como está, y la cuenta es opcional.

---

## 1. Lista corta de backends, verificada otra vez

### 1.1 Hechos (consultados el 2026-10-26)

| Tema | Hecho | Fuente |
|---|---|---|
| Versión de PocketBase | Última v0.40.6 (23 oct), con la rama LTS v0.22.57 publicada el mismo día. Sigue siendo 0.x. La v0.40.6 dice que es "most likely the last release here on GitHub": las actualizaciones futuras saldrán de ganigeorgiev.com **[V]** | https://github.com/pocketbase/pocketbase/releases |
| Cambios recientes de PocketBase | v0.40.4: `app.ResetBootstrapState()` queda medio obsoleto en favor de `app.ClearBootstrap()`. v0.40.1: arregla regresiones por `encoding/json/v2` **[V]** | ídem |
| Proveedores OAuth2 de PocketBase | `tools/auth` contiene `twitch.go`, `discord.go`, `google.go`, `oidc.go` (30 proveedores en total) **[V]** | https://github.com/pocketbase/pocketbase/tree/master/tools/auth |
| Flujo OAuth2 de PocketBase | `authWithOAuth2({ provider })` abre una ventana emergente y recibe el resultado por una suscripción realtime de un solo uso. La URL de redirección es `https://<api>/api/oauth2-redirect`. También existe un flujo manual con `state` y `authWithOAuth2Code` **[V]** | https://pocketbase.io/docs/authentication/ |
| JS hooks de PocketBase | Usan goja, "embedded ES5 JavaScript engine… most of ES6", "not a Node.js or browser environment". Sin `setTimeout`. Cada manejador es un programa aislado. Para ESM hay que empaquetar antes a CommonJS **[V]** | https://pocketbase.io/docs/js-overview/ |
| Extender PocketBase en Go | Se usa como librería (`pocketbase.New()`, hooks, rutas en `OnServe`). Transacciones con `app.RunInTransaction(func(txApp core.App) error {...})`; dentro hay que usar `txApp` **[V]** | https://pocketbase.io/docs/go-overview/ , https://pocketbase.io/docs/go-records/ |
| PocketBase en producción | Proxy delante con la opción "User IP proxy headers" activada. Un volumen en `/pb/pb_data`. Backups integrados (local o S3, con bucket propio recomendado). Limitador de peticiones integrado desde v0.23. `PB_ENCRYPTION_KEY` con `--encryptionEnv`. SMTP real. `ulimit -n 4096` **[V]** | https://pocketbase.io/docs/going-to-production/ |
| Almacén de sesión del SDK JS | `LocalAuthStore` usa `localStorage` si existe y, si no, memoria **[V]** | https://github.com/pocketbase/js-sdk |
| Pausa de Supabase Free | Pausa los proyectos con poca actividad en 7 días y avisa por correo. Bastan "a few user requests to the database each day". Los planes de pago no se pausan. La ventana para restaurar sale como 90 días en una copia de la página y 1 año en otra **[V, contradictorio en la ventana]** | https://supabase.com/docs/guides/platform/free-project-pausing |
| Cloudflare Workers Free | 100 000 peticiones/día, **10 ms de CPU por petición** HTTP, 128 MB por isolate, 50 subpeticiones **[V]** | https://developers.cloudflare.com/workers/platform/limits/ |
| Cloudflare Workers de pago | Mínimo 5 USD/mes. 10 M peticiones y 30 M ms de CPU al mes incluidos. 30 s de CPU por invocación (configurable hasta 5 min). 15 min por Cron o consumidor de Queue **[V]** | https://developers.cloudflare.com/workers/platform/pricing/ |
| D1 Free | 10 bases de datos, **500 MB por base**, 5 GB por cuenta, 50 consultas por invocación, 5 M filas leídas y 100 000 escritas al día **[V]** | https://developers.cloudflare.com/d1/platform/limits/ , https://developers.cloudflare.com/d1/platform/pricing/ |
| VPS (inventario propio) | 6 vCPU, 11 GiB de RAM (3,7 GiB libres), 120 GB de disco libres. **Traefik v3.6.7 (Dokploy) ya ocupa 80/443** y enruta los demás subdominios de fullfran.com. Docker se salta ufw en los puertos publicados **[V]** | `~/fullfran/infrastructure/vps-infra/inventory/README.md` |

Corrección a la nota anterior: D1 Free no da "5 GB" por base de datos. Da 500 MB por base y 5 GB por cuenta.

### 1.2 Recomendación: PocketBase en el VPS (se mantiene la referencia)

Las pruebas nuevas no cambian la clasificación. Afinan dos cosas:

- **El verificador no cabe en ningún "gratis sin servidor".** Workers Free da 10 ms de CPU y una repetición cuesta del orden de 1 s **[I]**. Workers de pago sí cabe (30 s por invocación), pero eso convierte "gratis" en 5 USD/mes y obliga a reescribir la autenticación sin ayudas. El VPS ya está pagado, tiene CPU de sobra y no tiene cuotas.
- **Supabase** sigue perdiendo por la pausa a los 7 días: la comunidad pasa días sin jugar entre directos. Se arreglaría con un ping diario, que es justo el truco que no queremos mantener.

| | PocketBase + verificador Node (VPS) | Workers de pago + D1 | Supabase Free |
|---|---|---|---|
| Twitch, Discord y Google ya integrados | Sí [V] | No (hecho a mano) | Sí (nota anterior) |
| Verificación de repeticiones | Proceso Node sin límite de CPU | Cabe en 30 s de CPU [V] | Edge Functions; límites sin comprobar |
| Coste extra | 0 € | ≥ 5 USD/mes | 0 € (con pausa) |
| Operación | Media: actualizaciones, backups, vigilancia | Baja | Baja |
| Dependencia del proveedor | Baja (SQLite) | Alta | Baja (Postgres) |
| Riesgos | Pre-1.0. El canal de actualización se va de GitHub. Un solo punto de fallo | Autenticación propia. Lock-in | Pausa y restauración |

Contrapartidas que acepto con PocketBase: es pre-1.0, así que hay que fijar la versión exacta y leer el changelog antes de cada subida. Además, a partir de v0.40.6 las descargas salen de un host nuevo, así que la imagen se construye con una suma de comprobación fijada en el Dockerfile. La caída del VPS también tumba los rankings; el juego no se cae, porque es local-first.

**Hooks JS o Go:** se empieza con el binario oficial y `pb_hooks/*.pb.js` para la lógica pequeña (tirada de gacha en transacción, libro de monedas, borrado). Es TypeScript-adyacente y no pide toolchain de Go. Se pasa a Go (PocketBase como librería) si los hooks pasan de unos cientos de líneas o si hacen falta tests unitarios serios del lado del servidor. **[I]**

---

## 2. Modelo de datos (colecciones de PocketBase)

Identificadores en inglés. `users` es la colección de autenticación. Todo lo que no se puede escribir desde el cliente se marca *server-only*: la regla de create/update es `null`, así que solo lo escribe un superusuario (el verificador) o un hook.

### 2.1 `users` (auth) y `profiles`

| Campo | Tipo | Notas |
|---|---|---|
| `users.email` | email, **opcional** si se puede | Twitch solo da el email con el scope `user:read:email`. Se pide el mínimo (ver §4.4) |
| `users.verified` | bool | Lo gestiona PocketBase |
| `profiles.user` | relación → users, única | 1:1 |
| `profiles.nickname` | texto ≤ 16, sin caracteres de control ni invisibles | La misma regla que `src/net/nickname.ts`, validada otra vez en un hook |
| `profiles.avatarSpecies` | texto (id de especie) | Validado contra la lista de especies del build |
| `profiles.createdAt/updatedAt` | autodate | |

Reglas: cualquiera puede leer el perfil público (solo `nickname` y `avatarSpecies`). Cada uno escribe solo el suyo (`@request.auth.id = user`).

### 2.2 `runs` (una partida subida)

| Campo | Tipo | Notas |
|---|---|---|
| `user` | relación | El dueño, forzado a `@request.auth.id` |
| `clientRunId` | texto (UUID), único por usuario | Para no duplicar si se reintenta la subida |
| `build` | texto | Hash del build (`__BUILD__` = commit corto), ver §3.6 |
| `dungeon` | texto | Id de `src/data/dungeons.ts` |
| `tier` | select | `easy, normal, hard, nightmare` (las que use `src/data/difficulty.ts`) |
| `mode` | select | `adventure, sima_daily, sima_free` |
| `seed` | número (int32) | En `sima_daily` tiene que ser igual a `dailySeed(date)` |
| `date` | texto `YYYY-MM-DD` (UTC) | Día del reto diario |
| `species` | texto | |
| `partySize` | número 1–4 | |
| `claimed` | json | Lo que dice el cliente: `{floor, victory, clockMs, elapsedMs, coins, level}` |
| `replay` | file (≤ 512 KB) | El log de inputs comprimido (§3.2) |
| `status` | select, *server-only* | `pending, verified, rejected, unverifiable` |
| `verified` | json, *server-only* | Lo que recalculó el verificador (lo único que puntúa) |
| `rejectReason` | texto, *server-only* | `divergence@tick`, `bad_seed`, `unknown_build`, … |
| `verifierVersion` | texto, *server-only* | |

### 2.3 Tablones

Los tablones no se guardan como tablas aparte. Son **vistas o consultas** sobre `runs` con `status = verified`, más una tabla de "mejor marca" que mantiene el verificador para que leer salga barato:

| Colección | Clave única | Orden |
|---|---|---|
| `best_adventure` | `(user, dungeon, tier)` | Victoria antes que derrota, luego planta más alta, luego `elapsedMs` menor |
| `best_sima_daily` | `(user, date, tier)` | `floor` desc, luego `clockMs` desc (el mismo criterio que `compareScores` de `src/town/leaderboard.ts`) |
| `best_sima_free` | `(user, tier)` | ídem |
| `best_coop_unverified` | `(user, dungeon, tier, mode)` | Aparte y marcado (§3.5) |

Todas son *server-only* y de lectura pública. El cliente lee el top 50 más su propia posición.

### 2.4 Guardado compartido (`saves`) y libro de monedas

El guardado local (`SaveData` en `src/app/save.ts`: `coins` y `upgrades`) y los récords (`src/town/records.ts`) se pueden editar en el navegador. En cuanto el gacha exista, **las monedas y las compras tienen que ser del servidor**:

| Colección | Campos | Quién escribe |
|---|---|---|
| `wallets` | `user` (único), `coins`, `version` | Solo hooks |
| `coin_ledger` | `user`, `delta`, `reason` (`run:<id>`, `upgrade:<id>`, `gacha:<id>`, `import`), `balanceAfter` | Solo hooks, nunca se borra (sirve de auditoría) |
| `upgrades` | `user`, `levels` (json, mismo formato que `UpgradeLevels`) | Hook `POST /api/sd/upgrades/buy` en transacción |
| `records` | `user`, `records` (json con el formato `Records`) | Lo deriva el verificador de las partidas verificadas |

Ingreso de monedas: lo calcula el **verificador** a partir de la repetición (las reglas de §11, `coin-lines`/`tally`). No vale lo que dice el cliente. Una partida no verificable no da monedas en línea. **[I: decisión de diseño]**

**Migración del guardado de invitado:**

1. Al iniciar sesión por primera vez, el cliente ofrece "Traer tu progreso de este dispositivo".
2. Envía `SaveData` y `Records` a `POST /api/sd/import`. Solo se acepta una vez por cuenta (`wallets.imported = true`).
3. Como el guardado local se puede editar, el hook **lo sanea y le pone tope**: monedas ≤ un tope (p. ej. 2000, unas 12 victorias) y niveles de mejora tal cual (solo cuestan monedas). Lo que pase del tope se descarta y se avisa. **[I: el tope es una pregunta abierta]**
4. Después, la fuente de verdad del saldo con sesión iniciada es el servidor. Sin sesión, el juego sigue con su guardado local de siempre (un "perfil invitado" separado; no se fusionan otra vez).

### 2.5 Gacha (más adelante; del servidor)

| Colección | Campos |
|---|---|
| `gacha_banners` | `id`, `pool` (json: especie → peso), `pityHard`, `softPityFrom`, `cost`, `activeFrom/To` |
| `gacha_state` | `user`, `banner`, `pullsSinceTop`, `totalPulls` |
| `gacha_pulls` | `user`, `banner`, `result`, `pityBefore`, `rngProof` (opcional) |
| `collection` | `user`, `species`, `count`, `firstAt` |

La tirada es un hook `POST /api/sd/gacha/pull` que, **dentro de una sola transacción**, comprueba el saldo, lo descuenta en `coin_ledger`, sortea con `crypto` del servidor, actualiza la pity, inserta en `gacha_pulls` y `collection`, y devuelve el resultado. Nunca hay RNG en el cliente. Solo se paga con Pokémonedas (§5 del GDD: nunca dinero real).

---

## 3. Anti-trampas: verificar repeticiones

### 3.1 Qué hace falta para que una repetición sea fiel (estado del código)

- **Ya está [V]:** RNG con semilla y estado dentro del mundo (`src/core/rng.ts`, mulberry32 con `Math.imul`). Paso fijo de 60 Hz (`FIXED_DT_MS`, `src/core/timestep.ts`, `TUNING.ticksPerSecond = 60`). `step(state, input, dtMs)` es puro (`src/core/step.ts`). El reloj de la Sima corre en tiempo simulado (`tickRunClock`). Los items del mercader y las recompensas salen de `seed` y `floor` (`merchantItem`, `rewardOffer`). Y `src/sim/runner.ts` ya juega partidas enteras sin pantalla con `startRun`, `step`, `progressRun` y `chooseItem`.
- **Falta 1, el run driver [V: código; I: alcance]:** la orquestación de una partida vive en `src/app/game.ts` (918 líneas). Ahí se cuentan las monedas (`tallyStep`, `tallyFloor`), se entra de planta (`enterFloor`), se reintenta, se gestionan el santuario, el mercader y las decisiones de la Sima, y se decide `end(...)`. El verificador necesita **exactamente la misma lógica sin DOM**. Hay que sacar un `RunDriver` puro (p. ej. `src/core/run-driver.ts` o `src/replay/driver.ts`) que reciba `(state, tickInput, decisions)` y que usen tanto `game.ts` como el verificador. Es el trabajo más grande y el que da valor (también a `src/sim`).
- **Falta 2, matemáticas no deterministas entre motores [V: spec + código]:** ECMA-262 define `Math.sin`, `cos`, `atan2`, `hypot`, `exp` y `pow` como *implementation-approximated* (https://tc39.es/ecma262/#sec-function-properties-of-the-math-object). El core las usa en `src/core/geometry.ts`, `vec.ts`, `combat.ts`, `danmaku.ts`, `herald/patterns.ts`, `herald/fairness.ts` y otros. Una partida jugada en Safari (JavaScriptCore) o Firefox (SpiderMonkey) puede diferir en el último bit de una que se repite en Node (V8), y la divergencia se amplifica. **Remedio:** un módulo `src/core/detmath.ts` con `hypot` (vía `Math.sqrt`, que IEEE-754 obliga a redondear bien), `sin`, `cos` y `atan2` polinómicos propios, más un test de arquitectura que prohíba los `Math.*` aproximados en `src/core`. **[I: el riesgo es real según la spec; su frecuencia práctica no está medida]**
- **Falta 3, `PlayerInput.view` [V]:** el input lleva el rectángulo de cámara (`view`), y la cámara se calcula en la app. Hay dos opciones: registrarlo, que es caro porque cambia casi cada tick, o **derivarlo** en el driver a partir del tamaño del viewport (que se registra solo cuando cambia) y de la posición del jugador. Recomiendo derivarlo y mover el cálculo de la cámara al driver.
- **Falta 4, decisiones fuera de `step` [V]:** la elección de item, las decisiones de la Sima, el mercader y el santuario, "Reintentar planta" y la pausa (no avanza el reloj; no hace falta registrarla si no hay ticks). Todo esto va en el log como **eventos de decisión** con su índice de tick.

### 3.2 Formato del log (`replay v1`)

```
header: { format: 1, build, dungeon, tier, mode, seed, date, species, loadout, upgrades, partySize: 1 }
stream: sequence of (tickDelta: varint, mask: u8|u16, changed fields...)
  move: quantized to int8 (-127..127) per axis
  aim:  relative to player, int16 per axis (world px, rounded)
  roll/lock/click: bits in the mask
  slots/slotMouse: bitfields
  wheel: zigzag varint
  viewport: (w,h) u16 only when it changes
decisions: (tick: varint, kind: u8, payload: varint)
footer: { claimed, finalStateHash: u32 }  // the client's own hash, for debugging divergences
compression: deflate-raw (CompressionStream in the browser; zlib in Node)
```

Ojo: **la cuantización tiene que aplicarse también en el cliente antes de llamar a `step`.** Si no, el cliente juega con floats y el verificador con enteros, y divergen. El adaptador de input cuantiza; el core recibe ya cuantizado. **[I]**

**Tamaño de una partida de 30 min [I, estimación sin medir]:**

- 30 min × 60 Hz = **108 000 ticks**.
- Ratón: `aim` cambia en casi todos los ticks en los que se mueve el ratón. Si se mueve el 50 % del tiempo, son unos 54 000 ticks con cambio a unos 6 B cada uno (delta, máscara, aim), más unos 5 cambios por segundo de `move` y botones (unos 9 000 × 3 B). Total crudo: **unos 350 KB**. Con deflate, unas 2–4 veces menos: **unos 90–180 KB**.
- Teclado o táctil con auto-aim: unos 5–10 cambios por segundo, unos 30 KB crudos y **unos 10 KB** comprimidos.
- Tope de subida: 512 KB. Hay que medirlo con una partida real (tarea T2).

### 3.3 Coste de CPU

- Medido en local (dato del dueño): unos 150 000 ticks/s en modo headless.
- 108 000 ticks ≈ **0,7 s** en ese equipo. En una vCPU del VPS, quizá unos 1,5 s **[I]**. Repetir el driver completo (tally, plantas) añade poco **[I]**.
- 500 partidas al día × 1,5 s = unos 12 min de CPU al día en un núcleo. Sobra.
- Los hooks JS de PocketBase no sirven: goja es un intérprete (bastante más lento que V8 con JIT **[I]**), sus manejadores no son concurrentes ni pueden diferir trabajo **[V]**, y sus `Math.*` salen de la librería de Go, no de V8, así que la repetición divergiría aunque se empaquetase el core **[I]**. Si se resuelve la Falta 2, el último punto desaparece, pero sigue el bloqueo del servidor HTTP.

### 3.4 Arquitectura del verificador

```
client --(POST runs: header+replay)--> PocketBase (status=pending)
verifier (Node 22, same core bundle per build)
  -> polls/subscribes to runs?status=pending (service superuser token)
  -> loads drivers/<build>.mjs (immutable bundle of RunDriver+core for that build)
  -> replays, recomputes {floor, victory, clockMs, elapsedMs, coins, level}
  -> writes status + verified, upserts best_*, credits coin_ledger via hook route
```

- Funciona por **pull, no por webhook**: si el verificador se cae, las partidas esperan en `pending` y no se pierde nada. Sin colas externas.
- Corre con concurrencia 1–2 y un `worker_threads` por repetición con un tiempo máximo de 10 s. Todo lo que pase de ahí o lance una excepción queda como `unverifiable`.
- La puntuación que vale es la recalculada. Si no coincide con `claimed`, la partida es `rejected` y se registra el primer tick donde diverge (útil para encontrar no-determinismo de verdad, no solo trampas).

### 3.5 Cooperativo

Con el diseño de §12 (M1) no es reproducible **[V: GDD y código]**:

- Cada pestaña simula su propio Pokémon.
- Los golpes de los invitados son reclamaciones que el anfitrión acepta sin comprobar.
- El anfitrión mueve a los enemigos y manda instantáneas que llegan con lag variable (`net.session.beforeStep` mete el estado remoto en ticks que dependen de la red).
- Las bayas las decide el anfitrión, y el reloj de los invitados lo corrige `takeClock`.

Opciones:

1. **Recomendada para empezar:** el cooperativo sube igual, pero a `best_coop_unverified`, un tablón propio etiquetado "sin verificar". No da monedas en línea más allá de un tope plausible.
2. **Después:** repetición del anfitrión con su bandeja de entrada. El anfitrión registra sus inputs **y todos los mensajes de red que entran** en cada tick (estados y reclamaciones de los invitados). Con eso su simulación es determinista y reproducible. Demuestra que el anfitrión no hizo trampas con su propio cliente, pero acepta lo que reclamen los invitados. El tamaño crece unas 4 veces **[I]**.
3. Que el cooperativo sea determinista de verdad (lockstep o rollback) es otro motor de red. Queda fuera de este alcance.

### 3.6 Fijar la versión

- `build` = commit corto inyectado por Vite (`define: { __BUILD__ }`).
- Cada despliegue de Pages sube también `drivers/<build>.mjs` al verificador. Un artefacto de CI lo copia, siempre con autorización explícita para la operación remota.
- Una partida con un `build` que el verificador no conoce queda `unverifiable` hasta que exista su driver. No se rechaza.
- Los tablones muestran las marcas de cualquier build verificado. Si un cambio de balance invalida las comparaciones, se abre una "temporada" (campo `season` en los tablones `best_*`) en vez de borrar.

### 3.7 Comprobaciones de plausibilidad (red de seguridad y modo sin verificar)

- `sima_daily`: `seed == dailySeed(date)` y `date` dentro de ±1 día de la hora del servidor.
- `elapsedMs ≥ floor × tiempo mínimo por planta`. `clockMs ≤ reloj inicial + bonos máximos posibles`.
- `coins ≤` la cota de §11 para esa planta y ese nivel. `partySize ∈ 1..4`, especie conocida, mazmorra desbloqueable.
- Límite por usuario: N subidas por hora (limitador de PocketBase más un hook).
- Fuera de la verificación, todo pasa por estas comprobaciones y por una moderación manual (marcar o ocultar una marca).

---

## 4. Autenticación en una PWA estática

### 4.1 Flujo

- Origen del juego: `https://www.fullfran.com` (Pages con dominio propio). API: un subdominio servido por Traefik, p. ej. `https://sd-api.fullfran.com` (pregunta abierta: el nombre).
- **Ventana emergente (SDK, recomendada) [V]:** `pb.collection('users').authWithOAuth2({ provider: 'twitch' })`. La URL de redirección que se registra en Twitch, Discord y Google es `https://sd-api.fullfran.com/api/oauth2-redirect`.
- **Respaldo con redirección [V: el flujo existe]:** en una PWA instalada (sobre todo en iOS en modo standalone) las ventanas emergentes pueden fallar **[I]**. En ese caso se usa una página `/shadow-dungeon/auth/callback` con verificación de `state` y `authWithOAuth2Code`. Es la misma ruta en GitHub Pages, así que no hace falta servidor.
- Hay que excluir `/auth/callback` del caché del service worker, o servirlo con network-first. **[I]**

### 4.2 Guardar el token

`LocalAuthStore` usa `localStorage` **[V]**. Es aceptable aquí porque no hay HTML de terceros y la CSP es estricta. El riesgo es que un XSS robe el token. Mitigaciones:

- CSP en Pages (vía `<meta>`): `connect-src` solo `self`, la API y los relés de Trystero.
- Tokens con vida corta y `authRefresh` al abrir el juego.
- Ningún permiso peligroso en el token: no hay dinero real.

### 4.3 Modo invitado y vincular cuentas

- La cuenta es opcional. Sin sesión, todo sigue como hoy (guardado y tablones locales).
- Vincular: con la sesión iniciada, un "Vincular Discord" o "Vincular Google" llama a `authWithOAuth2` con el `authStore` válido. **[I: el SDK enlaza una identidad externa nueva al usuario autenticado y PocketBase guarda los enlaces en `_externalAuths`; comprobar en un PocketBase local antes de prometerlo]**
- Desvincular: lista de identidades enlazadas. Siempre tiene que quedar al menos una.

### 4.4 Privacidad (RGPD) mínima

- **Datos que se guardan:** id del proveedor, nickname, especie de avatar, partidas (semilla, inputs, resultados), monedas, mejoras y colección. **Sin email si se puede** (no se pide `user:read:email` en Twitch ni el scope `email` en Google cuando se pueda; con Discord solo `identify`). **[I: comprobar si PocketBase obliga a tener email en usuarios OAuth2; hay que dejar el campo opcional en la colección]**
- **Base legal:** ejecución del servicio que pide el usuario (cuentas y rankings). No hay publicidad ni analítica de terceros.
- **Página de privacidad** en `fullfran.com/shadow-dungeon/privacy` (ES/EN): quién es el responsable, qué datos, dónde (VPS de Contabo, Alemania, UE **[V: nota anterior]**), cuánto tiempo y cómo borrar.
- **Borrado:** botón "Borrar mi cuenta" que llama a `DELETE /api/sd/me`. Un hook borra en cascada perfil, partidas, carteras, gacha y enlaces externos. Los backups rotan en 30 días, y la página lo dice.
- **Retención de repeticiones:** se guardan 90 días o mientras sean la mejor marca; después se borra el fichero y se queda la fila. **[I]**
- Los relés de Nostr de Trystero ya ven IPs. Eso existe hoy y debería ir en la misma página.

### 4.5 Términos de Twitch para desarrolladores

- No he podido leer el texto vigente: https://legal.twitch.com/en/legal/developer-agreement/ solo devolvió la cabecera al consultarlo (2026-10-26). **[gap]**
- Un hilo del foro oficial cita una cláusula que prohíbe guardar copias de "Twitch Content" salvo autorización, derechos propios o caché de 24 h (https://discuss.dev.twitch.com/t/storage-of-data-from-twitch-api/63884). Es una cita en un foro, no el texto del acuerdo. **[I]**
- Implicación práctica **[I]**: guardar solo el id de usuario de Twitch (necesario para la sesión) y el nickname que elige el jugador, no el `display_name` ni el avatar de Twitch. No guardar chat. La integración del chat (`docs/twitch-chat-integration.md`) es aparte.
- Hay que leer el acuerdo completo antes de registrar la app en la consola (tarea T0).

---

## 5. Despliegue en el VPS (para autorizar mañana)

### 5.1 Encaje con lo que ya hay [V: inventario]

- **No se añade Caddy.** `dokploy-traefik` (Traefik v3.6.7) ya escucha en 80 y 443 y saca los certificados con ACME (`acme.json`). El servicio nuevo se enruta igual que `cobbleverse-api`: un compose manual con labels de Traefik en su red.
- **No se publica ningún puerto.** Docker se salta ufw, así que PocketBase y el verificador solo están en la red interna y los alcanza Traefik.
- Recursos: PocketBase más el verificador, unos 200–300 MB de RAM **[I]**, frente a 3,7 GiB libres.
- Backups: se suma `pb_data` (con `sqlite3 .backup`, no copiando el fichero en caliente) al plan de restic → R2 de `vps-infra` (T3/T4, ahora bloqueado porque R2 no está activado). Mientras tanto: backups integrados de PocketBase en local, más una copia que el PC del dueño descarga.

### 5.2 Compose propuesto (borrador; no aplicar sin autorización)

```yaml
# /home/fran/shadow-dungeon-api/docker-compose.yml  (proposed)
services:
  pocketbase:
    build: ./pocketbase          # Alpine + pinned v0.40.x zip + sha256 check
    command: ["serve", "--http=0.0.0.0:8090", "--origins=https://www.fullfran.com", "--encryptionEnv=PB_ENCRYPTION_KEY"]
    environment: [PB_ENCRYPTION_KEY]
    volumes: ["pb_data:/pb/pb_data", "./pb_hooks:/pb/pb_hooks:ro", "./pb_migrations:/pb/pb_migrations:ro"]
    ulimits: { nofile: 4096 }
    restart: unless-stopped
    networks: [dokploy-network, internal]
    labels:
      - traefik.enable=true
      - traefik.http.routers.sdapi.rule=Host(`sd-api.fullfran.com`)
      - traefik.http.routers.sdapi.entrypoints=websecure
      - traefik.http.routers.sdapi.tls.certresolver=letsencrypt   # use the resolver name already in traefik.yml
      - traefik.http.services.sdapi.loadbalancer.server.port=8090
  verifier:
    build: ./verifier            # node:22-alpine, drivers/<build>.mjs mounted read-only
    environment: [PB_URL=http://pocketbase:8090, PB_VERIFIER_TOKEN]
    volumes: ["./drivers:/app/drivers:ro"]
    restart: unless-stopped
    networks: [internal]
volumes: { pb_data: {} }
networks: { internal: {}, dokploy-network: { external: true } }
```

Hay que comprobar contra el propio binario el flag `--origins` de `pocketbase serve` (`pocketbase serve --help`), y el nombre del certresolver y de la red contra la configuración de Traefik que ya existe. **[I]**

### 5.3 Rate limiting, CORS y vigilancia

- **CORS:** solo `https://www.fullfran.com` (y `http://localhost:5173` solo en desarrollo, nunca en producción).
- **Rate limiting:** el limitador integrado de PocketBase **[V]** para `*:auth` (p. ej. 10 por minuto por IP), `runs:create` (p. ej. 30 por hora por usuario) y `/api/sd/gacha/pull` (p. ej. 60 por minuto). Más un middleware `ratelimit` de Traefik como segunda capa. Activar "User IP proxy headers" para que el limitador vea la IP real **[V]**.
- **Vigilancia:** `/api/health` mirado desde fuera (un uptime gratuito, o un timer en el PC del dueño). Logs de PocketBase con retención de 7 días. Alerta si las partidas `pending` pasan de 15 min.
- **Coste:** 0 € extra (VPS ya pagado). R2 es gratis hasta 10 GB **[I: no lo he consultado hoy]**. El dominio ya existe.

### 5.4 Lista de pasos (cada paso remoto requiere autorización explícita)

| # | Paso | Tipo | Autorización necesaria |
|---|---|---|---|
| D0 | Elegir el subdominio de la API | decisión | dueño |
| D1 | Crear la app en Twitch, Discord y Google con la URL de redirección `https://<sub>/api/oauth2-redirect` | consola de terceros | dueño, con su cuenta y por proveedor |
| D2 | Registro DNS `A/AAAA <sub>` → VPS | DNS | dueño (proveedor DNS y credencial) |
| D3 | Montar y probar todo **en local** (PocketBase, hooks, verificador, cliente contra `localhost`) | local | ninguna |
| D4 | Copiar el directorio del compose al VPS | remoto (Tailscale SSH) | dueño: host, usuario y operación |
| D5 | Crear los secretos (`PB_ENCRYPTION_KEY`, token del verificador, client secrets OAuth) con SOPS/age como en `vps-infra` | local y remoto | dueño |
| D6 | `docker compose up -d` y comprobar que Traefik enruta y saca el certificado | remoto | dueño |
| D7 | Crear el superusuario de PocketBase, importar las migraciones, configurar OAuth2, SMTP (opcional sin email), limitador y "proxy headers" | remoto (panel) | dueño |
| D8 | Backups integrados con cron, y comprobar que se puede restaurar en local | remoto y local | dueño |
| D9 | Publicar en Pages el build que apunta a la API (`VITE_API_URL`) | push | dueño (push y despliegue) |
| D10 | Vigilancia y alerta | remoto o PC | dueño |

---

## 6. Integración en el cliente (hexagonal)

### 6.1 Puertos (en `src/app/ports/` o junto a sus casos de uso)

```ts
interface AccountService {
  current(): Account | null;                      // null = guest
  signIn(provider: 'twitch' | 'discord' | 'google'): Promise<Account>;
  link(provider: ProviderId): Promise<void>;
  signOut(): void;
  deleteAccount(): Promise<void>;
  onChange(cb: (a: Account | null) => void): () => void;
}
interface ProfileRepository { get(): Promise<Profile>; save(p: ProfileEdit): Promise<Profile>; }
interface RankingService {
  submit(run: RunSubmission): Promise<SubmitReceipt>;           // enqueues; never throws on offline
  board(q: BoardQuery): Promise<BoardPage>;                     // adventure | sima_daily | sima_free | coop
  myRank(q: BoardQuery): Promise<RankEntry | null>;
}
interface SaveSync { load(): Promise<SaveData>; buyUpgrade(id: UpgradeId): Promise<SaveData>; importGuest(s: SaveData, r: Records): Promise<ImportResult>; }
```

**Adaptadores:**

- `local*`: lo que hay hoy (`save.ts`, `records.ts`, `leaderboard.ts`, sobre `KeyValueStore`).
- `pocketbase*`: el SDK `pocketbase`. Es la única dependencia nueva, y solo se carga con `import()` dinámico al iniciar sesión, para no engordar la carga del invitado.

`main.ts` elige el adaptador según `AccountService.current()`.

### 6.2 Cola de subidas que funciona sin conexión

- Al acabar una partida, el replay y el header van a una cola en IndexedDB (`outbox`, clave `clientRunId`), con try/catch como el resto del almacenamiento.
- Se vacía al iniciar el juego, al recuperar conexión (`online`) y después de cada partida. Backoff exponencial con tope en 1 h.
- El servidor deduplica por `(user, clientRunId)`.
- El tablón local sigue escribiéndose al momento. El en línea muestra "pendiente de verificar" hasta que llega el veredicto.
- Las partidas jugadas como invitado **no** se suben al iniciar sesión, salvo las de la importación única (decisión pendiente).

### 6.3 Interfaz

- **Ajustes y pantalla de jugar en línea:** "Iniciar sesión" con Twitch, Discord o Google, el nickname (el mismo campo que hoy) y la especie del avatar. "Vincular", "Cerrar sesión" y "Borrar cuenta".
- **Tablón del pueblo (`src/town/leaderboard.ts`, `records.ts`):** pestañas "Este dispositivo", "Global" (mazmorra × nivel), "Sima diaria" (hoy, ayer) y "Sima libre". "Cooperativo (sin verificar)" en una pestaña aparte.
- **Reto diario:** cartel que dice cuánto queda para el cambio de día UTC, con el top 10 y tu puesto.
- **Pantalla final:** "Subiendo…", "Verificada: puesto #12" o "No verificable: no cuenta para el ranking".

### 6.4 Tests (TDD donde se pueda)

- `RunDriver`: el test de oro graba una partida de bots con `src/sim` y comprueba que repetirla da el mismo hash de estado final y la misma puntuación.
- Test de arquitectura: el core no usa `Math.sin|cos|tan|atan2|hypot|exp|pow|log|random` ni `Date`.
- El codec del replay: ida y vuelta, y tamaño máximo.
- Hooks: tests de integración contra un PocketBase local (en Docker) con la gacha, la importación con tope y el borrado en cascada.

---

## 7. Tareas, estimaciones y riesgos

Las estimaciones son de un desarrollador con ayuda de agentes, en días de trabajo. Todas son **[I]**.

| Id | Tarea | Est. | Depende de |
|---|---|---|---|
| T0 | Leer el acuerdo de Twitch y la configuración de Traefik; decidir subdominio, tope de importación y retención | 0,5 | — |
| T1 | `detmath` en el core más el test de arquitectura; comprobar que el balance no cambia (`npm run balance`) | 1–2 | — |
| T2 | Sacar el `RunDriver` puro de `game.ts` (tally, plantas, decisiones, cámara) y usarlo en el juego y en `src/sim` | 3–5 | T1 |
| T3 | Grabar y repetir: codec `replay v1`, cuantización en el adaptador de input, test de oro, medir el tamaño real | 2 | T2 |
| T4 | PocketBase local: colecciones como migraciones, reglas, hooks (`import`, `upgrades/buy`, `me` delete) | 2 | T0 |
| T5 | Verificador Node: pull, worker con timeout, `best_*`, abono en el libro de monedas, bundles por build | 2 | T3, T4 |
| T6 | Cliente: puertos y adaptadores, login con ventana emergente y con redirección, cola IndexedDB | 3 | T4 |
| T7 | Interfaz: pestañas del tablón, reto diario, estados en la pantalla final, privacidad ES/EN | 2 | T6 |
| T8 | Despliegue D0–D10 (con autorización) | 1 | T4–T7 |
| T9 | Tablón del cooperativo sin verificar | 0,5 | T6 |
| T10 | (Más adelante) gacha: banners, pity y colección, hook en transacción, interfaz | 3–4 | T8 |

Total hasta tener rankings verificados: **unos 17–22 días**. La sesión de mañana puede acabar con T0, T1 y el principio de T4 en local. **[I]**

**Riesgos:**

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Sacar el `RunDriver` cambia sutilmente el comportamiento | Regresiones en el juego | Test de oro con `src/sim` antes y después, y un solo camino de código |
| Sigue habiendo no-determinismo oculto (orden de iteración, floats con `Math.*` que se escapan) | Partidas legítimas rechazadas | `finalStateHash` y tick de divergencia, empezar con partidas de bots, y un "modo sombra" en el que el resultado no puntúa pero se registra durante la primera semana |
| Las ventanas emergentes de OAuth fallan en una PWA instalada | No se puede entrar en el móvil | Página de callback con redirección |
| PocketBase pre-1.0 y canal de actualización nuevo | Rompe al actualizar | Versión fijada, sha256, changelog y prueba en local antes de cada subida |
| VPS caído | Sin rankings | El juego es local-first y la cola reintenta |
| Trampas con un cliente modificado que genera inputs "perfectos" (TAS) | Marcas imposibles pero válidas | Inevitable con verificación por repetición. Plausibilidad humana (APM, tiempos de reacción) más adelante y moderación manual |
| Términos de Twitch sin leer | Incumplir sin querer | T0 antes de D1 |

---

## 8. Preguntas abiertas para el dueño

1. ¿Qué subdominio para la API (`sd-api.fullfran.com`, `api.fullfran.com` u otro)?
2. ¿Qué proveedores el primer día: solo Twitch, o Twitch, Discord y Google?
3. ¿Hay que pedir email (recuperar la cuenta) o ninguno, por privacidad?
4. ¿Qué tope de Pokémonedas al importar el guardado de invitado (propuesta: 2000) y se importan los récords?
5. ¿Las monedas en línea solo vienen de partidas verificadas, o también de las del cooperativo sin verificar con un tope?
6. ¿Temporadas por build o un tablón eterno que acumule todos los builds verificados?
7. ¿Cuánto tiempo se guardan las repeticiones (propuesta: 90 días o mientras sean la mejor marca)?
8. ¿Hooks JS al principio y Go más adelante, o Go desde el primer día?
9. ¿Se aplaza el backup a R2 (T3 de `vps-infra`, bloqueado) y se usan backups locales más la copia que descarga el PC?
10. ¿El reto diario muestra solo el día UTC actual, o también el histórico?

---

## Fuentes (consultadas el 2026-10-26 salvo que se diga otra cosa)

- PocketBase, releases: https://github.com/pocketbase/pocketbase/releases
- PocketBase, proveedores: https://github.com/pocketbase/pocketbase/tree/master/tools/auth
- PocketBase, autenticación: https://pocketbase.io/docs/authentication/
- PocketBase, JS hooks: https://pocketbase.io/docs/js-overview/
- PocketBase, Go: https://pocketbase.io/docs/go-overview/ , https://pocketbase.io/docs/go-records/
- PocketBase, producción: https://pocketbase.io/docs/going-to-production/
- PocketBase JS SDK: https://github.com/pocketbase/js-sdk
- Supabase, pausa: https://supabase.com/docs/guides/platform/free-project-pausing
- Cloudflare Workers, límites: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers, precios: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1, límites: https://developers.cloudflare.com/d1/platform/limits/ ; precios: https://developers.cloudflare.com/d1/platform/pricing/
- ECMA-262, objeto Math (*implementation-approximated*): https://tc39.es/ecma262/#sec-function-properties-of-the-math-object
- Twitch Developer Services Agreement (no se pudo leer el texto): https://legal.twitch.com/en/legal/developer-agreement/
- Foro de Twitch, almacenamiento de datos (cita no oficial): https://discuss.dev.twitch.com/t/storage-of-data-from-twitch-api/63884
- Nota anterior (2026-10-25): `~/fullfran/game-analysis/notes/backend-options.md`
- Inventario del VPS: `~/fullfran/infrastructure/vps-infra/inventory/README.md`, backups: `~/fullfran/infrastructure/vps-infra/odd/tasks/vps-backups.md`
