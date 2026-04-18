# ⚡ Postman → k6 Converter

> Convierte colecciones de Postman en scripts de k6 listos para ejecutar pruebas de carga y performance, **sin escribir una sola línea de código** y **100% en el navegador**.

![Demo](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![HTML](https://img.shields.io/badge/stack-HTML%20%2B%20Vanilla%20JS-orange?style=flat-square)
![k6](https://img.shields.io/badge/target-k6%20script-7d64ff?style=flat-square)

---

## 📋 Tabla de contenidos

- [¿Qué es esto?](#-qué-es-esto)
- [Características](#-características)
- [Arquitectura del proyecto](#-arquitectura-del-proyecto)
- [Cómo usar](#-cómo-usar)
  - [Paso 1 — Importar colección](#paso-1--importar-colección)
  - [Paso 2 — Revisar requests](#paso-2--revisar-requests)
  - [Paso 3 — Configurar k6](#paso-3--configurar-k6)
  - [Paso 4 — Script generado](#paso-4--script-generado)
- [Modos de carga disponibles](#-modos-de-carga-disponibles)
- [Thresholds (SLOs)](#-thresholds-slos)
- [Qué convierte exactamente](#-qué-convierte-exactamente)
- [Conversión de autenticación](#-conversión-de-autenticación)
- [Conversión de tests Postman → checks k6](#-conversión-de-tests-postman--checks-k6)
- [Variables de entorno Postman](#-variables-de-entorno-postman)
- [Ejecutar el script generado](#-ejecutar-el-script-generado)
- [Estructura de archivos](#-estructura-de-archivos)
- [Detalles técnicos](#-detalles-técnicos)
- [Limitaciones conocidas](#-limitaciones-conocidas)
- [Contribuir](#-contribuir)

---

## 🚀 ¿Qué es esto?

**Postman → k6 Converter** es una herramienta web de una sola página (SPA) que automatiza la migración de colecciones de Postman a scripts de k6 para pruebas de carga. Está diseñada para equipos que ya documentan sus APIs en Postman y quieren reutilizar ese trabajo para generar suites de performance testing sin reescribir manualmente cada request.

No requiere servidor, backend ni instalación. Abre el `index.html` en cualquier navegador moderno y listo.

---

## ✨ Características

| Característica | Descripción |
|---|---|
| 🗂️ **Importación flexible** | Arrastra y suelta el JSON o pégalo directamente en el editor |
| ✅ **Soporte v2.0 y v2.1** | Compatible con ambas versiones del formato de colección de Postman |
| 🔍 **Selección de requests** | Elige cuáles requests incluir en el script generado |
| 📁 **Soporte de carpetas** | Respeta la jerarquía de folders de la colección, con colapso/expansión |
| 🚀 **Tres modos de carga** | Simple, Stages (ramp-up/down) y Ramping VUs con executor avanzado |
| 🎯 **Thresholds configurables** | Define SLOs sobre `http_req_duration`, `http_req_failed`, `http_req_waiting` e `iterations` |
| 🔐 **Conversión de autenticación** | Soporta Bearer Token, Basic Auth y API Key |
| 📦 **Cuerpos de request** | Convierte `raw` (JSON/XML/text), `urlencoded`, `form-data` y `GraphQL` |
| 🔄 **Variables Postman** | Detecta `{{variables}}` y las exporta como constantes JS |
| 🌐 **Base URL automática** | Detecta o permite sobreescribir la URL base de la colección |
| ⏱️ **Sleep configurable** | Agrega pausa entre requests para simular comportamiento real de usuarios |
| 🎨 **Syntax highlighting** | Resaltado de sintaxis JavaScript/k6 en el preview del script |
| 📋 **Copiar / Descargar** | Copia al portapapeles o descarga el archivo `.js` directamente |
| 🔒 **100% local** | Ningún dato sale de tu navegador. Todo se procesa en el cliente |

---

## 🏗️ Arquitectura del proyecto

```
postman-to-k6/
├── index.html      # Estructura HTML + UI de 4 pasos
├── style.css       # Sistema de diseño completo (dark mode, tokens CSS)
├── converter.js    # Lógica de parsing y generación de código k6
└── app.js          # Orquestación UI, eventos, estado y renderizado
```

### Separación de responsabilidades

```
┌─────────────────────────────────────────────────────┐
│                     index.html                      │
│          Estructura semántica + 4 step cards        │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   ┌──────▼──────┐           ┌──────▼──────┐
   │ converter.js │           │   app.js    │
   │             │           │             │
   │ ─ Parser    │           │ ─ Estado    │
   │ ─ Generator │           │ ─ Eventos   │
   │ ─ Highlighter│          │ ─ Render    │
   │             │           │ ─ Config    │
   └─────────────┘           └─────────────┘
          ▲
          │  window.PostmanConverter (API pública)
          └──── extractRequests()
               generateK6Script()
               highlightK6()
               detectBaseUrl()
```

---

## 🎯 Cómo usar

### Paso 1 — Importar colección

Exporta tu colección desde Postman:
1. Abre Postman → selecciona tu colección
2. Click en `···` → **Export**
3. Elige formato **Collection v2.1** (recomendado) o v2.0
4. Guarda el archivo `.json`

Luego, en la herramienta:
- **Arrastra** el archivo `.json` sobre la zona de drop, o
- **Haz click** en "Seleccionar archivo", o
- **Pega** el JSON directamente en el textarea

El textarea valida el JSON en tiempo real e indica si es válido o no.

### Paso 2 — Revisar requests

Después de hacer click en **"Analizar colección"**, verás:
- Todas las requests detectadas, agrupadas por carpeta
- Un badge de color por método HTTP (GET, POST, PUT, PATCH, DELETE…)
- La URL de cada request
- Un checkbox para incluir/excluir cada request del script final
- Botones **"Seleccionar todo"** / **"Deseleccionar todo"**
- Un resumen con total de requests, seleccionadas y carpetas

### Paso 3 — Configurar k6

Configura los parámetros de la prueba de carga:

#### Modo de prueba
Ver sección [Modos de carga disponibles](#-modos-de-carga-disponibles).

#### Thresholds
Ver sección [Thresholds (SLOs)](#-thresholds-slos).

#### Base URL (override)
Si ingresas una URL aquí (ej. `https://staging.miapi.com`), esta reemplaza la URL base detectada automáticamente de la colección. Útil para apuntar a distintos entornos.

#### Pausa entre requests
Tiempo en segundos entre cada request dentro de la función default (simula el _think time_ de un usuario real). Valor `0` = sin pausa.

### Paso 4 — Script generado

- **Preview** del script con syntax highlighting
- Contador de líneas
- Botón **"Copiar"** → copia al portapapeles
- Botón **"Descargar .js"** → descarga el archivo con el nombre de la colección (ej. `mi-api-test.js`)
- Instrucciones de ejecución con los comandos exactos

---

## ⚙️ Modos de carga disponibles

### 🚀 Simple
Configuración básica con número fijo de VUs y duración total.

```js
export const options = {
  vus: 10,
  duration: '30s',
};
```

**Parámetros:**
- **Virtual Users (VUs)**: número de usuarios concurrentes (1–10000)
- **Duración**: tiempo total de la prueba en segundos

---

### 📈 Stages (Ramp-up / Ramp-down)
Permite definir múltiples etapas con duración y objetivo de VUs independientes. Ideal para modelar curvas de carga realistas.

```js
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up
    { duration: '60s', target: 50 },   // Steady state
    { duration: '30s', target: 0  },   // Ramp down
  ],
};
```

**Parámetros por stage:**
- **Duración** (seg): tiempo que dura la etapa
- **Target** (VUs): número de VUs al final de la etapa

Puedes agregar stages adicionales con el botón **"+ Agregar stage"**.

---

### ⚙️ Ramping VUs
Usa el executor `ramping-vus` de k6 para un control más granular del escalado. Genera automáticamente una curva de ramp-up → steady → ramp-down.

```js
export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '60s', target: 100 },
        { duration: '0s',  target: 100 },
        { duration: '60s', target: 0   },
      ],
    },
  },
};
```

**Parámetros:**
- **VUs iniciales**: punto de partida (típicamente 0)
- **VUs pico**: objetivo máximo de VUs
- **Duración total**: el tiempo total se divide automáticamente en ramp-up / steady / ramp-down

---

## 🎯 Thresholds (SLOs)

Define criterios de aceptación que harán fallar la prueba si no se cumplen:

| Threshold | Condición por defecto | Descripción |
|---|---|---|
| `http_req_duration` | `p(95) < 500ms` | El percentil 95 de latencia debe ser menor a X ms |
| `http_req_failed` | `rate < 1%` | La tasa de errores HTTP debe ser menor a X% |
| `http_req_waiting` | `p(99) < 1000ms` | El TTFB en percentil 99 debe ser menor a X ms |
| `iterations` | `count > 100` | El número total de iteraciones debe superar X |

Cada threshold puede activarse/desactivarse con su checkbox y su valor numérico es editable.

---

## 🔄 Qué convierte exactamente

### Métodos HTTP
Todos los métodos estándar: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.

### Headers
Los headers habilitados de la colección se exportan como objeto `params`:
```js
const params_abc123 = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};
```

### Cuerpos de request

| Tipo Postman | Generado en k6 |
|---|---|
| `raw` (JSON) | `JSON.stringify({...})` formateado |
| `raw` (XML/text) | Template literal `` `...` `` |
| `urlencoded` | Array `.join('&')` con `encodeURIComponent` |
| `form-data` | Objeto JS (campos de texto únicamente, sin archivos) |
| `GraphQL` | `JSON.stringify({ query, variables })` |

### Query parameters
Los query params se preservan como parte de la URL usando template literals:
```js
`${BASE_URL}/users?page=${encodeURIComponent('1')}&limit=${encodeURIComponent('20')}`
```

---

## 🔐 Conversión de autenticación

| Tipo Postman | Conversión |
|---|---|
| **Bearer Token** | `Authorization: Bearer <token>` |
| **Basic Auth** | `Authorization: Basic <base64(user:pass)>` |
| **API Key** (header) | Header personalizado con key/value de la colección |

Si la autenticación usa variables Postman (`{{bearerToken}}`), estas se convierten en referencias JS (`${BEARERTOKEN}`).

---

## 🧪 Conversión de tests Postman → checks k6

El parser analiza los scripts de test de Postman y convierte las aserciones más comunes a `check()` de k6:

| Postman test | k6 check generado |
|---|---|
| `pm.response.to.have.status(200)` | `(r) => r.status === 200` |
| `pm.expect(pm.response.responseTime).to.be.below(500)` | `(r) => r.timings.duration < 500` |
| `pm.response.to.be.json` | `(r) => r.headers['Content-Type'].includes('json')` |

Los checks se agrupan por request y alimentan una métrica `Rate` personalizada (`errorRate`):

```js
const errorRate = new Rate('errors');

// En la función default:
const ok_abc123 = check(res_abc123, {
  'status is 200': (r) => r.status === 200,
  'response time < 500ms': (r) => r.timings.duration < 500,
});
errorRate.add(!ok_abc123);
```

---

## 🌐 Variables de entorno Postman

Las variables `{{varName}}` de Postman se convierten en constantes JavaScript que pueden sobreescribirse con variables de entorno en tiempo de ejecución:

```js
// Colección original usa {{baseUrl}} y {{apiKey}}
const BASE_URL = 'https://api.miapp.com';
const APIKEY = __ENV.APIKEY || '';
```

Al ejecutar k6 puedes inyectar valores:
```bash
k6 run -e APIKEY=mi-token-secreto load-test.js
```

---

## ▶️ Ejecutar el script generado

### Instalación de k6

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (con Chocolatey)
choco install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

### Ejecución básica

```bash
k6 run load-test.js
```

### Con variables de entorno

```bash
k6 run -e API_KEY=mi-token -e BASE_URL=https://staging.api.com load-test.js
```

### Con salida a InfluxDB + Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

### Con salida a CSV

```bash
k6 run --out csv=results.csv load-test.js
```

---

## 📂 Estructura de archivos

### `index.html`
- Estructura HTML semántica de 4 pasos (step cards)
- Formularios de configuración: modo simple, stages, ramping VUs
- Thresholds configurables con checkboxes
- Preview del código generado con toolbar
- Instrucciones de ejecución inline
- Sección "¿Cómo funciona?" y footer

### `style.css` (~730 líneas)
Sistema de diseño completo con:
- **Tokens CSS** (`--accent`, `--bg`, `--text-muted`, etc.)
- **Dark mode** con fondo `#0a0c14`
- **Glassmorphism** en header y cards (`backdrop-filter: blur`)
- **Background blobs** animados con `@keyframes float`
- **Badges de método HTTP** con colores semánticos (GET=verde, POST=azul, DELETE=rojo…)
- **Syntax highlighting** CSS (`.kw`, `.fn`, `.str`, `.num`, `.cmt`)
- **Responsive** con breakpoint en 640px
- **Micro-animaciones**: `fadeInUp`, `fadeInDown`, `slideInRight`, `pulse`
- **Toast notifications** animadas

### `converter.js` (~580 líneas)
Motor de conversión con API pública en `window.PostmanConverter`:

```
PostmanConverter
├── extractRequests(items, folderPath)   → { folders, requests }
├── generateK6Script(collection, config) → string (script k6)
├── highlightK6(code)                    → string (HTML con spans)
└── detectBaseUrl(requests)              → string
```

**Funciones internas:**
- `normalizeRequest(item, folder)` — Normaliza un item de Postman al modelo interno
- `extractK6Checks(script, checks)` — Convierte tests Postman a checks k6
- `generateOptions(config)` — Genera el bloque `options` según el modo
- `generateRequestBlock(req, baseUrl, config)` — Genera el bloque de código para una request
- `buildUrlExpression(req, baseUrl)` — Construye la expresión de URL con template literals
- `resolvePostmanVar(str)` — Reemplaza `{{var}}` por `${VAR}`
- `sanitizeVarName(name)` — Convierte nombres a identificadores JS válidos
- `extractVariables(requests, collectionVars)` — Detecta todas las variables usadas
- `groupByFolder(requests)` — Agrupa requests por carpeta

### `app.js` (~485 líneas)
Orquestación de la UI:

```
State:
├── collection      { name, requests, variables, folderCount }
├── currentMode     'simple' | 'stages' | 'ramping'
├── generatedScript string
└── scriptFilename  string

Módulos:
├── Step management  (activateStep, clases CSS done/active/locked)
├── File / Drag-drop (FileReader API, dragover/drop events)
├── JSON validation  (live parsing en textarea)
├── Parse collection (validación Postman, extracción, renderizado)
├── Render requests  (HTML dinámico, checkboxes, folders colapsables)
├── Mode tabs        (Simple / Stages / Ramping VUs)
├── Stages builder   (add/remove stages dinámicamente)
├── Config reader    (readConfig, readThresholds)
├── Generate         (llama a PostmanConverter, renderiza output)
├── Copy & Download  (Clipboard API, Blob + URL.createObjectURL)
└── Utils            (escHtml, groupByFolder, scrollToEl, showToast)
```

---

## ⚠️ Limitaciones conocidas

| Limitación | Detalle |
|---|---|
| **Archivos en form-data** | Los campos de tipo `file` en form-data se omiten (k6 los manejaría de forma diferente) |
| **Pre-request scripts** | Los scripts de Postman que se ejecutan antes de la request no se convierten |
| **Tests complejos** | Solo se convierten aserciones de status, tiempo de respuesta y tipo de contenido. Tests JS arbitrarios se ignoran |
| **OAuth 2.0 / Digest** | Solo se soportan Bearer, Basic Auth y API Key |
| **Colecciones anidadas profundas** | Funciona correctamente, pero la representación en el script será comentada como ruta completa `Carpeta / Subcarpeta` |
| **Variables dinámicas** | `{{$randomInt}}`, `{{$timestamp}}` y similares se tratan como variables literales |
| **WebSocket / gRPC** | Solo se soportan requests HTTP/HTTPS |

---

## 🤝 Contribuir

El proyecto es 100% vanilla JS + HTML + CSS, sin dependencias ni build steps.

```bash
# Clonar y abrir directamente
git clone <repo-url>
cd postman-to-k6
open index.html   # macOS
xdg-open index.html  # Linux
```

### Áreas de mejora sugeridas

- [ ] Soporte para OAuth 2.0
- [ ] Soporte para variables de entorno de Postman (archivos `.env`)
- [ ] Conversión de más aserciones de test
- [ ] Generación de script con múltiples scenarios en paralelo
- [ ] Export a formato de configuración k6 Cloud
- [ ] Soporte para `k6/experimental/websockets`
- [ ] Preview en vivo (editar el script antes de descargar)

---

## 📄 Licencia

MIT — Úsalo libremente en proyectos personales y comerciales.

---

<div align="center">
  <p>Conversión 100% local · Ningún dato sale de tu navegador · Hecho con ❤️</p>
  <p>
    <a href="https://k6.io/docs/">Documentación k6</a> ·
    <a href="https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/">Exportar colecciones Postman</a>
  </p>
</div>
