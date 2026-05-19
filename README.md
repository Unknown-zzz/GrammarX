# Grammar X — English Grammar Games

4 minijuegos de gramática inglesa con modo multijugador tipo Kahoot.

---

## Minijuegos

| # | Nombre | Gramática | Mecánica |
|---|--------|-----------|----------|
| G1 | ⏰ Time Machine | Past Simple | Ordena las palabras para reconstruir la oración |
| G2 | ⚔️ Duel Mode | Comparatives & Superlatives | Elige la forma comparativa/superlativa correcta (4 opciones) |
| G3 | 🔍 Evidence File | Present Perfect | Lee el pasaje y responde la pregunta de comprensión |
| G4 | 🔮 Crystal Ball | Future Tense | Elige will / going to / won't / present continuous |

---

## Estructura del proyecto

```
AppIngles/
├── index.html          ← entrada HTML
├── index.jsx           ← app React completa (todos los minijuegos)
├── src/
│   └── main.jsx        ← monta el componente en #root
├── vite.config.js
├── package.json
├── Code.gs             ← Google Apps Script (backend / leaderboard)
└── README.md
```

---

## Requisitos

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- Cuenta de Google con Google Sheets

---

## 1 · Ejecutar en local

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:3000
```

Para producción:
```bash
npm run build    # genera dist/
npm run preview  # sirve dist/ localmente
```

---

## 2 · Configurar el Google Apps Script

### 2.1 Crear la hoja

1. Ir a [sheets.google.com](https://sheets.google.com) → crear hoja nueva → nombrarla **Grammar X**

### 2.2 Abrir el editor de scripts

1. En la hoja: **Extensiones → Apps Script**
2. Borrar todo el código por defecto
3. Pegar el contenido de [`Code.gs`](./Code.gs)
4. Guardar (`Ctrl+S`)

### 2.3 Desplegar como Web App

1. Click en **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
4. Click **Implementar** → copiar la URL generada

> La URL tiene esta forma:  
> `https://script.google.com/macros/s/AKfyc.../exec`

### 2.4 Actualizar la URL en el código

Abrir `index.jsx`, línea 5, y reemplazar el valor de `API`:

```js
const API = 'PEGA_TU_URL_AQUI';
```

Guardar — Vite recarga automáticamente.

---

## 3 · Hojas que crea el script automáticamente

| Hoja | Contenido |
|------|-----------|
| `Sessions` | Salas creadas por el host |
| `Players` | Jugadores por sala |
| `Scores_PastSimple` | Puntajes G1 |
| `Scores_Comparatives` | Puntajes G2 |
| `Scores_PresentPerfect` | Puntajes G3 |
| `Scores_Future` | Puntajes G4 |

El leaderboard "🌟 Total" suma las 4 hojas por jugador.

---

## 4 · Flujo de juego (Kahoot-style)

```
PROFESOR (Host)                    ALUMNOS (Player)
─────────────────                  ────────────────
1. Abrir la app                    1. Abrir la app
2. Elegir "Host"                   2. Elegir "Jugador"
3. Ingresar nombre → Crear sala    3. Ingresar nombre
4. Proyectar el CÓDIGO en pantalla 4. Escribir el código → Entrar
5. Elegir el minijuego             5. Esperar en lobby
6. Ver jugadores conectados        
7. Presionar ▶ INICIAR             → Todos empiezan simultáneamente
8. Ver resultados en el podio      → Ver resultados en el podio
```

---

## 5 · Despliegue en producción (opcional)

### Vercel (recomendado — gratis)
```bash
npm i -g vercel
vercel
```

### Netlify
```bash
npm run build
# Arrastra la carpeta dist/ a netlify.com/drop
```

### GitHub Pages
```bash
# En vite.config.js agregar: base: '/nombre-repo/'
npm run build
# Subir dist/ a la rama gh-pages
```

---

## 6 · Comandos rápidos

```bash
npm run dev      # desarrollo local → localhost:3000
npm run build    # compilar para producción → dist/
npm run preview  # previsualizar build
```
