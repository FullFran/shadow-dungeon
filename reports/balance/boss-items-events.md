# Objetos tras cada jefe y sucesos en todas las mazmorras: antes y después

Base `9db9254`, rama `feat/boss-items-events` (`odd/tasks/boss-items-events.md`). No se ha tocado ninguna estadística de jefe o enemigo ni ninguna regla de equidad. Todos los números de sucesos son provisionales.

## Objetos por partida (cuenta sobre los datos)

Media de 400 semillas, si se recoge todo lo que sale: un objeto por jefe que no sea el último, cofres, salas de oleadas y, en la columna de comprar, un objeto por mercader.

| Mazmorra | Nivel | Plantas | Jefes con elección | Cofres y oleadas | Mercaderes | Objetos sin comprar | Objetos comprando | Plantas con suceso | Plantas sin suceso |
|---|---|---|---|---|---|---|---|---|---|
| crypt-of-the-sword-king | easy | 6 | 1 | 1.47 | 0.23 | 2.46 | 2.69 | 2.10 | 65 % |
| crypt-of-the-sword-king | normal | 6 | 1 | 1.73 | 0.26 | 2.73 | 2.99 | 2.42 | 60 % |
| crypt-of-the-sword-king | hard | 6 | 1 | 1.93 | 0.29 | 2.92 | 3.21 | 2.64 | 56 % |
| crypt-of-the-sword-king | nightmare | 6 | 1 | 2.05 | 0.29 | 3.05 | 3.34 | 2.77 | 54 % |
| misty-forest | easy | 8 | 1 | 1.67 | 0.28 | 2.67 | 2.94 | 2.44 | 70 % |
| misty-forest | normal | 8 | 1 | 1.94 | 0.31 | 2.94 | 3.25 | 2.82 | 65 % |
| misty-forest | hard | 8 | 1 | 2.17 | 0.35 | 3.17 | 3.52 | 3.13 | 61 % |
| misty-forest | nightmare | 8 | 1 | 2.38 | 0.37 | 3.38 | 3.75 | 3.35 | 58 % |
| flooded-caves | easy | 10 | 1 | 1.88 | 0.53 | 2.88 | 3.40 | 3.27 | 67 % |
| flooded-caves | normal | 10 | 1 | 2.06 | 0.60 | 3.06 | 3.67 | 3.62 | 64 % |
| flooded-caves | hard | 10 | 1 | 2.08 | 0.61 | 3.08 | 3.69 | 3.64 | 64 % |
| flooded-caves | nightmare | 10 | 1 | 2.08 | 0.61 | 3.08 | 3.69 | 3.64 | 64 % |
| toxic-swamp | easy | 10 | 1 | 1.87 | 0.52 | 2.87 | 3.40 | 3.24 | 68 % |
| toxic-swamp | normal | 10 | 1 | 2.06 | 0.59 | 3.06 | 3.65 | 3.58 | 64 % |
| toxic-swamp | hard | 10 | 1 | 2.07 | 0.60 | 3.07 | 3.67 | 3.60 | 64 % |
| toxic-swamp | nightmare | 10 | 1 | 2.07 | 0.60 | 3.07 | 3.67 | 3.60 | 64 % |
| challenge-abra | easy | 7 | 2 | 0.86 | 0.29 | 2.86 | 3.15 | 1.57 | 78 % |
| challenge-abra | normal | 7 | 2 | 1.07 | 0.37 | 3.07 | 3.44 | 1.95 | 72 % |
| challenge-abra | hard | 7 | 2 | 1.24 | 0.41 | 3.24 | 3.66 | 2.23 | 68 % |
| challenge-abra | nightmare | 7 | 2 | 1.31 | 0.43 | 3.31 | 3.75 | 2.32 | 67 % |
| challenge-abra-2 | easy | 7 | 2 | 0.86 | 0.29 | 2.86 | 3.15 | 1.57 | 78 % |
| challenge-abra-2 | normal | 7 | 2 | 1.07 | 0.37 | 3.07 | 3.44 | 1.95 | 72 % |
| challenge-abra-2 | hard | 7 | 2 | 1.24 | 0.41 | 3.24 | 3.66 | 2.23 | 68 % |
| challenge-abra-2 | nightmare | 7 | 2 | 1.31 | 0.43 | 3.31 | 3.75 | 2.32 | 67 % |
| challenge-abra-3 | easy | 7 | 2 | 0.86 | 0.29 | 2.86 | 3.15 | 1.57 | 78 % |
| challenge-abra-3 | normal | 7 | 2 | 1.07 | 0.37 | 3.07 | 3.44 | 1.95 | 72 % |
| challenge-abra-3 | hard | 7 | 2 | 1.24 | 0.41 | 3.24 | 3.66 | 2.23 | 68 % |
| challenge-abra-3 | nightmare | 7 | 2 | 1.31 | 0.43 | 3.31 | 3.75 | 2.32 | 67 % |

## Bots, antes y después

Una partida por semilla, 10 semillas, en solitario, con Mimikyu, sin Mejoras. `depth` cuenta como victoria en la Sima (10 plantas). El bot va a por el cofre, coge el primero de cada elección, no compra y no acepta pactos. Son pocas partidas: sirven para ver la dirección, no como cifra exacta.

| Mazmorra | Nivel | Bot | Victorias antes | Victorias ahora | Plantas antes | Plantas ahora | Objetos al acabar |
|---|---|---|---|---|---|---|---|
| crypt-of-the-sword-king | easy | perfect | 10/10 | 10/10 | 6.0 | 6.0 | 2.40 |
| crypt-of-the-sword-king | easy | average | 10/10 | 8/10 | 6.0 | 5.4 | 2.10 |
| crypt-of-the-sword-king | normal | perfect | 0/10 | 0/10 | 6.0 | 5.9 | 2.70 |
| crypt-of-the-sword-king | normal | average | 0/10 | 0/10 | 6.0 | 5.5 | 2.30 |
| crypt-of-the-sword-king | hard | perfect | 0/10 | 0/10 | 4.7 | 4.7 | 2.20 |
| crypt-of-the-sword-king | hard | average | 0/10 | 0/10 | 4.4 | 3.1 | 1.30 |
| crypt-of-the-sword-king | nightmare | perfect | 0/10 | 0/10 | 4.1 | 2.0 | 0.70 |
| crypt-of-the-sword-king | nightmare | average | 0/10 | 0/10 | 2.7 | 2.0 | 1.00 |
| misty-forest | easy | perfect | 10/10 | 10/10 | 8.0 | 8.0 | 2.70 |
| misty-forest | easy | average | 9/10 | 8/10 | 7.6 | 8.0 | 2.60 |
| misty-forest | normal | perfect | 0/10 | 0/10 | 4.9 | 4.8 | 1.60 |
| misty-forest | normal | average | 0/10 | 0/10 | 4.4 | 4.4 | 1.30 |
| misty-forest | hard | perfect | 0/10 | 0/10 | 4.0 | 3.6 | 1.30 |
| misty-forest | hard | average | 0/10 | 0/10 | 3.7 | 3.7 | 1.10 |
| misty-forest | nightmare | perfect | 0/10 | 0/10 | 3.8 | 3.2 | 1.40 |
| misty-forest | nightmare | average | 0/10 | 0/10 | 2.9 | 2.9 | 1.30 |
| flooded-caves | easy | perfect | 10/10 | 8/10 | 10.0 | 9.0 | 2.20 |
| flooded-caves | easy | average | 10/10 | 9/10 | 10.0 | 9.7 | 3.00 |
| flooded-caves | normal | perfect | 6/10 | 3/10 | 10.0 | 9.7 | 3.00 |
| flooded-caves | normal | average | 9/10 | 4/10 | 10.0 | 9.4 | 2.60 |
| flooded-caves | hard | perfect | 6/10 | 1/10 | 8.7 | 4.0 | 0.80 |
| flooded-caves | hard | average | 3/10 | 0/10 | 6.1 | 3.3 | 0.70 |
| flooded-caves | nightmare | perfect | 0/10 | 0/10 | 4.3 | 3.6 | 0.60 |
| flooded-caves | nightmare | average | 0/10 | 0/10 | 3.3 | 2.8 | 0.70 |
| toxic-swamp | easy | perfect | 6/10 | 5/10 | 8.0 | 7.7 | 2.40 |
| toxic-swamp | easy | average | 7/10 | 4/10 | 8.5 | 6.7 | 2.20 |
| toxic-swamp | normal | perfect | 8/10 | 5/10 | 10.0 | 9.0 | 3.00 |
| toxic-swamp | normal | average | 8/10 | 2/10 | 10.0 | 5.6 | 1.80 |
| toxic-swamp | hard | perfect | 2/10 | 0/10 | 6.3 | 4.8 | 1.50 |
| toxic-swamp | hard | average | 0/10 | 0/10 | 4.9 | 4.2 | 1.10 |
| toxic-swamp | nightmare | perfect | 0/10 | 0/10 | 4.0 | 2.6 | 0.20 |
| toxic-swamp | nightmare | average | 0/10 | 0/10 | 4.4 | 2.9 | 0.30 |
| eclipse-chasm | easy | perfect | 9/10 | 7/10 | 9.7 | 9.7 | 2.10 |
| eclipse-chasm | easy | average | 9/10 | 7/10 | 9.7 | 9.7 | 2.10 |
| eclipse-chasm | normal | perfect | 9/10 | 3/10 | 9.7 | 9.0 | 1.70 |
| eclipse-chasm | normal | average | 4/10 | 1/10 | 7.5 | 5.9 | 0.60 |
| eclipse-chasm | hard | perfect | 1/10 | 0/10 | 5.5 | 5.6 | 0.30 |
| eclipse-chasm | hard | average | 0/10 | 0/10 | 5.0 | 4.8 | 0.10 |
| eclipse-chasm | nightmare | perfect | 0/10 | 0/10 | 4.3 | 3.9 | 0.00 |
| eclipse-chasm | nightmare | average | 0/10 | 0/10 | 4.5 | 4.3 | 0.10 |
| challenge-abra | easy | perfect | 10/10 | 10/10 | 7.0 | 7.0 | 2.90 |
| challenge-abra | easy | average | 10/10 | 9/10 | 7.0 | 6.7 | 2.50 |
| challenge-abra | normal | perfect | 10/10 | 7/10 | 7.0 | 6.1 | 2.40 |
| challenge-abra | normal | average | 7/10 | 4/10 | 5.8 | 4.7 | 1.30 |
| challenge-abra | hard | perfect | 5/10 | 2/10 | 6.0 | 4.6 | 2.10 |
| challenge-abra | hard | average | 0/10 | 0/10 | 3.5 | 3.1 | 0.40 |
| challenge-abra | nightmare | perfect | 1/10 | 0/10 | 3.7 | 2.8 | 0.40 |
| challenge-abra | nightmare | average | 0/10 | 0/10 | 2.6 | 2.0 | 0.00 |

## Arnés de balance

- `npm run balance -- --quick` (lo que comprueba CI): antes 0 fallos, 39 avisos, 74 correctos; ahora 0 fallos, 43 avisos, 70 correctos, **con una violación conocida añadida** (`unseen-threats` en el Pantano, easy, F3, 2 a la vez).
- `npm run balance` (barrido completo): antes 1 fallo (`unseen-threats` Pantano normal, F6, 2 a la vez), 111 avisos, 208 correctos; ahora 1 fallo (`blind-hits` Cripta normal, 1, en Aegislash F6), 125 avisos, 194 correctos.
- `npm run prove`: 166 cartas y 24 de 24 combates del solver, igual antes y después (no juega con objetos de la partida).

## Second pass: more chests (owner's go-ahead, 2026-10-30)

Vault weight 6 to 12, and higher event chances per dungeon. Measured on 120 seeds, bosses plus chests and wave rooms, then with merchants: Crypt 2.7 to 3.2 (3.4), Caves 3.6 (4.0), Sendas 3.6 to 4.0 (4.3). Plain floors 54 to 67 %. The Crypt stays near 3 because it has only 6 floors. The bot win tables above were measured before this pass.

