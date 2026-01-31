# Análisis de Estructura del Proyecto - Game Blocks

**Fecha**: 2026-01-31  
**Objetivo**: Evaluar la estructura actual del código e identificar necesidad de refactorización

---

## Resumen Ejecutivo

El proyecto tiene una arquitectura base razonable con separación en `core/` (funcionalidades compartidas) y `apps/` (juegos específicos). Sin embargo, hay **problemas significativos de duplicación de código** y **archivos demasiado grandes** que dificultan el mantenimiento.

**Veredicto: Sí es necesario un refactor.**

---

## Estructura Actual

```
app/src/
├── main.ts                    # Punto de entrada (449 líneas)
├── counter.ts                 # ❌ Sin usar (residual de Vite)
├── style.css                  # Estilos globales
├── apps/
│   ├── maze/
│   │   ├── mazeApp.ts        # Juego laberinto (716 líneas)
│   │   ├── levels.ts         # Niveles del laberinto
│   │   └── animation.ts      # Animaciones
│   ├── practice/
│   │   ├── practiceApp.ts    # Juego práctica (475 líneas)
│   │   └── levels.ts         # Niveles de práctica
│   ├── registry.ts           # Registro de apps
│   └── types.ts              # Tipos compartidos de apps
└── core/
    ├── compiler/
    │   ├── ast.ts            # Definición del AST
    │   ├── compile.ts        # Compilador bloques → AST
    │   └── validate.ts       # Validación de programas
    ├── editor/
    │   ├── workspace.ts      # Gestión del workspace Blockly
    │   ├── serialization.ts  # Serialización XML
    │   └── blockHighlight.ts # Highlight de bloques
    ├── runtime/
    │   └── runtime.ts        # Ejecución de programas
    └── storage/
        └── projectStore.ts   # Persistencia en localStorage
```

---

## Problemas Identificados

### 1. Duplicación masiva entre `mazeApp.ts` y `practiceApp.ts` (CRÍTICO)

Estos dos archivos son **~90% idénticos**:

| Elemento Duplicado | Líneas |
|--------------------|--------|
| Tipos (`MazeState`, `MazeUI`, `AnimationState`) | ~30 |
| Constantes (`CELL`, `PADDING`, `DIR_ORDER`, `DIR_DELTAS`) | ~15 |
| Helpers (`turnLeft`, `turnRight`, `isBlocked`, `inBounds`, `updateStatusText`) | ~35 |
| UI (`ensureUI`, `updateProgressBar`) | ~90 |
| Renderizado (`drawMaze`) | ~150 |
| Adapter (`applyOp`, `reset`) | ~100 |
| **Total duplicado** | **~420** |

**Las únicas diferencias reales son:**
- Array de niveles
- Color del tema (`#4C97FF` vs `#9B59B6`)
- Color de las paredes

### 2. `main.ts` demasiado grande (449 líneas)

Responsabilidades mezcladas:
- Template HTML inline (33 líneas)
- Gestión del workspace Blockly
- Event handlers de UI
- Efectos visuales (confetti, shake, success) (~130 líneas)
- Lógica de progresión de niveles (~40 líneas)

### 3. Archivo sin usar: `counter.ts`

Código residual del template inicial de Vite. Debe eliminarse.

### 4. Variables globales en apps

```typescript
// mazeApp.ts y practiceApp.ts
let ui: MazeUI | null = null;
let animationState: AnimationState = null;
```

Esto puede causar bugs con múltiples instancias.

### 5. Patrón anti-pattern: contexto en el DOM

```typescript
(rootEl as any).__renderContext = ctx;
```

Este patrón es frágil y difícil de debuggear.

### 6. Uso excesivo de `any`

Múltiples lugares con `any` que podrían tener tipos más específicos.

---

## Recomendaciones de Refactor

### Prioridad Alta

#### 1. Crear módulo base para juegos tipo laberinto

**Nueva estructura:**
```
app/src/apps/maze-base/
├── types.ts          # MazeState, MazeUI, AnimationState
├── constants.ts      # CELL, PADDING, DIR_ORDER, DIR_DELTAS
├── helpers.ts        # turnLeft, turnRight, isBlocked, inBounds
├── renderer.ts       # ensureUI, updateProgressBar, drawMaze (parametrizado)
├── adapter.ts        # createMazeAdapter(config)
├── blocks.ts         # registerMazeLikeBlocks, MAZE_LIKE_TOOLBOX_XML
└── createMazeGame.ts # Factory function
```

**Resultado:**
```typescript
// mazeApp.ts (~50 líneas)
import { createMazeGame } from "../maze-base/createMazeGame";
import { levels } from "./levels";

export const mazeApp = createMazeGame({
  id: "maze",
  title: "Laberinto",
  levels: levels,
  theme: {
    primary: "#4C97FF",
    wall: "#8B7355",
    gridBg: "#FAFAFA",
    gridLine: "#E5E7EB"
  }
});
```

#### 2. Extraer efectos visuales de `main.ts`

**Nueva estructura:**
```
app/src/core/effects/
├── confetti.ts       # createConfettiOverlay
├── feedback.ts       # triggerWinEffect, triggerErrorEffect
├── messages.ts       # showSuccessMessage
└── index.ts          # re-exports
```

#### 3. Eliminar `counter.ts`

```bash
rm app/src/counter.ts
```

### Prioridad Media

#### 4. Mejorar tipado de Blockly

Crear declaración de tipos:
```typescript
// core/types/blockly.d.ts
interface BlocklyInstance {
  inject: (mount: HTMLElement, options: WorkspaceOptions) => Workspace;
  Xml: XmlApi;
  Blocks: Record<string, BlockDefinition>;
  Colours?: ColourScheme;
  Categories?: CategoryScheme;
}
```

#### 5. Separar template HTML de `main.ts`

Mover a un módulo de plantillas o directamente a `index.html`.

### Prioridad Baja

#### 6. Sistema de estado más robusto

Reemplazar `(rootEl as any).__renderContext` con WeakMap:
```typescript
const contextMap = new WeakMap<HTMLElement, AppRenderContext>();
```

#### 7. Mover lógica de progresión de niveles

La lógica de "avanzar al siguiente nivel" debería estar encapsulada en el adapter.

---

## Métricas de Impacto

| Archivo | Líneas Actuales | Post-Refactor |
|---------|-----------------|---------------|
| `main.ts` | 449 | ~200 |
| `mazeApp.ts` | 716 | ~60 |
| `practiceApp.ts` | 475 | ~60 |
| `maze-base/*` (nuevo) | 0 | ~450 |
| `effects/*` (nuevo) | 0 | ~130 |
| **Total** | **1,640** | **~900** |

**Reducción de ~45% en líneas totales** eliminando duplicación.

---

## Plan de Implementación

### Fase 1: Eliminar duplicación de juegos maze-like
1. Crear `apps/maze-base/` con código compartido
2. Refactorizar `mazeApp.ts` para usar `createMazeGame()`
3. Refactorizar `practiceApp.ts` para usar `createMazeGame()`
4. Verificar que ambos juegos funcionan correctamente

### Fase 2: Limpiar `main.ts`
1. Extraer efectos visuales a `core/effects/`
2. Mover lógica de progresión a los adapters
3. Considerar extraer template HTML

### Fase 3: Mejoras de calidad
1. Eliminar `counter.ts`
2. Mejorar tipado de Blockly
3. Reemplazar patrón de contexto en DOM

---

## Conclusión

El refactor es **altamente recomendado** por:

1. **Mantenibilidad**: Cambios en la lógica del laberinto requieren editar 2 archivos idénticos
2. **Escalabilidad**: Agregar un tercer juego requeriría copiar +500 líneas
3. **Legibilidad**: `main.ts` es difícil de navegar con responsabilidades mezcladas

El esfuerzo es **moderado** (~1-2 días de trabajo) y los beneficios son **significativos** para el desarrollo futuro.
