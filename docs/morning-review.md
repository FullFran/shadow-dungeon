# Revisión de la mañana (26 de octubre de 2026)

Todo lo de esta noche está publicado en https://www.fullfran.com/shadow-dungeon/ (pulsa "Actualizar" cuando salga el aviso). `main` en `5bf5af1`, 2013 tests en verde.

## Qué se publicó anoche

| Qué | Dónde mirar |
|---|---|
| Todos los jefes con cartas de hechizo desde Normal (Sableye, Aegislash, Trevenant, Decidueye, Lanturn, Dhelmise, Salazzle, Nihilego, heraldos y ecos de la Sima). Fácil sigue con los combates de antes | `odd/tasks/boss-cards-all.md` |
| "Tu turno": ventana tras cada ataque en la que el jefe no lanza nada nuevo. Es una palanca de dificultad (1,6 / 1,3 / 1,0 / 0,8 s; nunca menos de 0,7 s) | `src/data/difficulty.ts`, GDD §9 |
| Presentación "souls por fuera, Touhou por dentro": anuncio de carta con oscurecido y nombre grande, «Signo…» en pequeño, «¡Técnica dominada!», anillo de tiempo, marcas de fase que laten en tu turno | capturas en `/tmp/boss-cards-all/` |
| Ecos de la Sima con las cartas de tu dificultad según profundidad (5 y 15: fase 1; desde 25: fase 2; desde 35 o al repetirlo: todo) | GDD, sección de la Sima |
| Prueba de que todo se puede pasar: `npm run prove` | GDD "Garantía de que todo se puede pasar" |
| Evoluciones: 20 enemigos evolucionados en la segunda mitad de cada mazmorra y en la Sima | GDD "Evoluciones" |
| Arreglo de la llave (se recoge sola al vencer al portador) | `odd/tasks/key-auto-pickup.md` |
| Heraldos procedurales y 4 ranuras de ataque | `odd/tasks/integrate-heralds-slots.md` |

## Resultado de la prueba

- 166 cartas (8 jefes + 5 ecos × Normal/Difícil/Pesadilla): **todas se pueden sobrevivir andando**, con 498 caminos guardados que se repiten en cada test.
- Invariantes de "se acaba ganando": cada carta tiene tiempo finito, el último tiempo agotado derriba al jefe, las de supervivencia no se pueden dañar, los anuncios no tienen amenazas.
- Daño: **123 de 146 cartas** cumplen las ventanas de castigo y el margen de tiempo. Las **23 que no** están en `src/sim/kill-gaps.ts`: sobre todo los ataques cuerpo a cuerpo contra las cartas de escudo de Aegislash, las ráfagas de Decidueye y los anillos de esquirlas de Nihilego (con ataque a distancia sí hay línea de tiro).
- Bot resolvedor: 24 de 24 combates de Pesadilla sin recibir golpe (78–262 s), aunque gana sobre todo por tiempo agotado.
- Cambios que forzó la prueba (se notan al jugar): Tajo Real 520→760 ms, Picado 520→700 ms, Corriente 400→760 ms, menos vida en algunos jefes (Lanturn ×0,5–0,58).

## Qué probar a mano

1. Aegislash y Decidueye en Normal y Pesadilla: ¿se nota el "tu turno"? ¿Las cartas se sienten Touhou y el anuncio se siente souls?
2. Dhelmise y Salazzle (tus favoritos) con cartas: ¿siguen igual de bien?
3. Un eco de la Sima en la planta 25 o 35 en Pesadilla.
4. Las evoluciones en las plantas finales de cada mazmorra.
5. Lanturn con menos vida: ¿demasiado corto?

## Decisiones pendientes (tuyas)

1. **Backend para cuentas y rankings**: recomendación PocketBase en tu VPS detrás del Traefik de Dokploy que ya tienes. Necesito tu autorización explícita (servidor, operación y credenciales) antes de tocar nada remoto. Plan completo y 10 preguntas en `docs/backend-accounts-plan.md`.
2. **Antitrampas**: para verificar rankings repitiendo la partida hay que preparar tres cosas antes (sacar la lógica de partida de `game.ts`, matemáticas deterministas entre navegadores, no grabar el encuadre). ¿Lo hacemos ya o empezamos con rankings sin verificar?
3. **Gacha** (`docs/gacha-and-bots-research.md`): ¿100 Pokémonedas por tirada? ¿Quién atiende el puesto, Mimikyu o Phantump? ¿Ruta para conseguir Pokémon sin tirar? Propuesta de 16 Pokémon candidatos.
4. **Equilibrio en Difícil de la Cripta y el Bosque**: los bots casi no los superan; tu partida decide.
5. **Las 23 cartas sin margen de daño para cuerpo a cuerpo**: ¿se aceptan (incentivan cambiar de ataque) o se abren más huecos?
6. **Grabar tus partidas** para calibrar un bot experto que esquive danmaku (así los porcentajes del simulador valen en Difícil y Pesadilla).

## Plan propuesto para hoy

1. Tus respuestas a las decisiones 1–3.
2. Si autorizas el VPS: montar PocketBase + cuentas (Twitch/Discord/Google) + rankings sin verificar del reto diario de la Sima.
3. En paralelo: preparar el antitrampas (RunDriver, matemáticas deterministas) y el gacha local.
4. Bot experto para el simulador.

Las diapositivas actualizadas están en `~/Descargas/mazmorra-sombria.pdf`.
