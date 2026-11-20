# Guía: corrida real con Kiro (para grabar el video y la evidencia)

Objetivo: que Kiro haga de verdad el diagnóstico, el plan y el arreglo, y guardar eso como la repetición (replay) de la demo.
Tiempo estimado: 45 a 60 minutos. Hazlo con la pantalla grabando.

Regla de oro: **anota solo lo que mediste**. Nada de números inventados.

## 0. Preparar (una sola vez)

En una terminal, dentro de la carpeta del proyecto:

```
npm install
npm run build
npm link
npm run fixtures
node dist/cli.js scan --dir fixtures/gastos-app --clock 2026-11-20T00:00:00Z
node dist/cli.js init --dir fixtures/gastos-app
```

`npm link` hace que el comando `levantate` exista en tu máquina. Kiro lo usa para el servidor MCP y el hook.

Abre la carpeta `fixtures/gastos-app` **como espacio de trabajo en Kiro IDE**. Ahí están los agentes, las reglas, el hook y el MCP que instaló `init`.

Anota: fecha, versión de Kiro, modelo elegido, y los créditos que muestra Kiro antes de empezar.

## 1. Comprobar que Kiro ve todo

- Agentes: deben aparecer `lazaro`, `forense`, `arquitecto`, `obrero`, `verificador`.
- MCP: en el panel de MCP debe aparecer `lazarus-git` con 4 herramientas. **Haz una captura.**
- Hook: en el panel de Hooks debe aparecer `Lazarus verify after task`. **Captura.**

Si algo no aparece, anota el error exacto. Eso también es evidencia y cuenta para el texto de Kiro.

## 2. Entrevista (agente `lazaro`)

Escribe en el chat: `Quiero revivir este repo. Usa #phase-interview.`

Responde las 5 preguntas en un solo mensaje. Ejemplo:

1. Era un registro de gastos simple.
2. Guardaba montos en centavos y mostraba el total.
3. Dejé de trabajar cuando Node 12 quedó viejo y no arrancó más.
4. Un hito pequeño: que el total salga bien.
5. Quiero una primera reparación aprobada.

Debe elegir el modo Resurrection. **Captura.**

## 3. Diagnóstico (agente `forense`, luego `lazaro`)

1. En la terminal: `node dist/cli.js context --phase diagnosis --dir fixtures/gastos-app`
   (anota los bytes que imprime; quedan guardados en `.lazarus/usage.json`).
2. En Kiro: `Usa #phase-diagnosis. Escribe .lazarus/diagnosis.json.` Que use las herramientas de `lazarus-git`.
3. Valida: `node dist/cli.js validate --dir fixtures/gastos-app`
4. Si hay errores, pega los errores en Kiro con `#phase-correction`. **Cuenta cada pasada de corrección.** Máximo 1 por artefacto.

## 4. Plan (agente `arquitecto`)

1. En Kiro: `Usa #phase-plan.` Debe escribir `.kiro/specs/revival/task-1.draft.json` (solo nombres de archivos, sin huellas).
2. Para la tarea 1 debe permitir editar solo `src/legacy-entry.js`. La prueba `check/expense-total.mjs` y los datos `data/sample.json` van como archivos bloqueados.
3. Elige la opción **simple + propiedades** (la prueba `check/expense-property.mjs` existe).
4. Ata el plan: `node dist/cli.js plan bind --dir fixtures/gastos-app`
5. Aprueba la tarea 1 en el chat.

## 5. Antes del arreglo

`node dist/cli.js verify baseline --dir fixtures/gastos-app`

Debe decir que vio el fallo esperado (`util.isString is not a function`). **Captura.**

## 6. El arreglo (agente `obrero`)

En Kiro: `Usa #phase-task. Aplica solo la tarea 1.` Debe editar solo `src/legacy-entry.js`.

Cuando termine, el hook `Lazarus verify after task` debería correr solo. **Captura de que se disparó, o anota que no.**
Si no se disparó, corre a mano: `node dist/cli.js verify after --dir fixtures/gastos-app`

Debe decir `verified` y `property passed`.

## 7. Guardar la sesión como replay

```
node dist/cli.js record --dir fixtures/gastos-app --surface kiro-ide --model "<modelo que viste>" --passes <pasadas de corrección> --note "corrida real"
```

Esto valida todo otra vez y guarda diagnóstico, plan y el cambio real en `replay/gastos-app/recorded/`.
Prueba la demo: `npm run smoke`. El paso 3 debe decir **"recorded from a real Kiro session"**.

Haz commit de la carpeta `replay/gastos-app/recorded/`.

## 8. Comparar con Kiro solo (la línea base)

Regenera el fixture limpio: `npm run fixtures`. Abre una conversación nueva con el agente por defecto de Kiro (sin los agentes de Lázaro) y pega este mensaje:

```
Este repo no arranca en Node 24. Haz que `node check/expense-total.mjs` imprima PASS.
No edites la carpeta check ni data. Cuando termines, dime qué cambiaste.
```

Anota para cada condición: minutos hasta el primer hito verificado, pasos de ayuda, intentos fallidos y créditos si Kiro los muestra.
Mismo modelo, mismo límite de tiempo (por ejemplo 20 min). Repite en el orden contrario si puedes.

Guarda los resultados en `docs/evidence/` con la plantilla `OBSERVATION-TEMPLATE.md`.

## 9. Qué anotar en `docs/KIRO-USAGE.md`

Para cada tema, una frase con lo que **sí viste**:

- IDE, CLI, Web o Crew: cuál usaste y cómo difirió.
- Agentes propios: cuál ayudó más y por qué.
- Hooks: ¿se disparó? ¿cuándo?
- Spec contra "vibe": tiempo o pasos de cada una.
- Steering: qué regla cambió más las respuestas.
- MCP: qué dio `lazarus-git` que no habría dado leer archivos (por ejemplo, la rama `feature/pdf-export`).
- Propiedades: qué encontró.
- Powers: cuál usaste (si no usaste, escribe "no usado").
