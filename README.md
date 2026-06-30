# Prode Amigos del Campín — Mundial 2026

Aplicación web de pronósticos para el Mundial 2026, jugada entre un grupo de amigos. Permite cargar pronósticos para cada partido, ver una tabla de posiciones en vivo, comparar pronósticos con los demás jugadores y seguir resultados en tiempo real.

🔗 **App en producción:** https://prode-mundial2026-pied.vercel.app

## Stack técnico

- **Frontend:** React + Vite
- **Base de datos:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Avatares:** servidos como assets estáticos desde GitHub (`/public/avatars`)
- **Resultados en vivo:** [worldcup26.ir](https://worldcup26.ir) (API gratuita, sin key) vía proxy propio

## Estructura del repo

```
src/
  App.jsx        → componente principal (toda la lógica y UI)
  data.js        → fixture de fase de grupos (partidos 1–72) y fechas de knockout (KNOCKOUT_DATES, partidos 73–104)
  supabase.js    → cliente de Supabase

api/
  wc26.js        → proxy a worldcup26.ir (evita problemas de CORS)
  time.js        → devuelve la hora del servidor (anti-manipulación de reloj del cliente)
  sync.js        → proxy a football-data.org (legacy, solo para debug)
  flourish.js    → endpoint CSV para Flourish (no usado activamente)

public/
  avatars/       → imágenes de perfil de los jugadores (PNG, 128×128)
```

## Funcionalidades principales

### Pronósticos
- Cada jugador carga resultado exacto (goles local–visitante) para cada partido.
- El sistema autoguarda cada cambio con feedback visual: 🟡 dorado = sin pronóstico, 🔴 rojo = editado sin guardar, 🟢 verde = guardado en Supabase.
- Una vez que un partido **empieza**, el pronóstico queda bloqueado: ya no se puede editar ni se sobreescribe por ninguna razón.
- Si un jugador no carga pronóstico antes de que el partido arranque, se le asigna automáticamente su **resultado por defecto** (configurable por jugador).

### Sistema de puntos
| Acierto | Puntos |
|---|---|
| Ganador o empate | +3 |
| Goles exactos del local | +1 |
| Goles exactos del visitante | +1 |
| **Máximo por partido** | **5** |

Los penales no suman ni restan puntos — solo definen quién avanza de fase.

### Fixture completo
Fase de grupos (72 partidos) + fases eliminatorias: 16avos, 8vos, 4tos, semifinal, 3º y 4º puesto, final (32 partidos adicionales, IDs 73–104).

Los equipos clasificados a instancias eliminatorias se resuelven automáticamente a partir de los resultados de grupos (1°/2° de cada grupo) y de los ganadores de partidos anteriores. Los mejores terceros se asignan manualmente desde el panel admin cuando termina la fase de grupos.

### Resultados en vivo
- Sync automático cada 60 segundos contra worldcup26.ir.
- Actualiza marcador en vivo, estado (en juego / finalizado) y resultado de penales en instancias eliminatorias.
- Sync manual disponible desde el panel admin para forzar una actualización.

### Tabla de posiciones
- Ranking general con puntos acumulados, partidos jugados y cantidad de "plenos" (5/5 puntos).
- Historial de cada jugador: click en su nombre muestra todos sus pronósticos de partidos ya finalizados.

### Modal de partido
Click en cualquier partido (en vivo o finalizado) abre un modal con el pronóstico de **todos** los jugadores, ordenados por puntaje (real si terminó, parcial en vivo si está en juego). Los pronósticos por defecto se marcan como tales.

### Historial de selección
Click en la bandera o nombre de un equipo en el fixture de knockouts muestra su historial de partidos jugados en el torneo (resultado, rival, fase), ordenado del más reciente al más antiguo.

### Resúmenes de fecha
Modales con estadísticas curiosas de cada fecha de grupos completada: mejor y peor jugador de la fecha, mayores remontadas y caídas en la tabla general, plenos, ceros, goles imaginados vs. reales, empates, y "los contreras" (quién se jugó contra el consenso del grupo y acertó).

### Evolución de la tabla (Flourish)
Gráfico embebido que muestra cómo evolucionaron los puntos acumulados de cada jugador partido a partido a lo largo del torneo.

## Panel admin

Accesible con contraseña desde Configuración. Permite:
- Cerrar/reabrir inscripciones
- Sync manual de resultados
- Asignar terceros clasificados en 16avos (`knockout_overrides`)
- Poblar y descargar datos para Flourish
- Debuguear la integración con worldcup26.ir (buscar partidos por fecha o ID)
- Resetear contraseña de un jugador

## Notas de implementación

- **Seguridad de horarios:** la app calcula la hora "real" contra un endpoint propio (`/api/time`) para evitar que alguien adelante el reloj de su celular y edite un pronóstico después de que el partido arrancó.
- **Bloqueo de predicciones:** existe una única función (`isMatchLocked`) que determina si un partido ya empezó. Es la única fuente de verdad usada en todo el código para decidir si un pronóstico puede guardarse, editarse o borrarse.
- **Avatares:** se sirven desde GitHub en lugar de Supabase Storage para evitar exceder la cuota de egress gratuita de Supabase.
