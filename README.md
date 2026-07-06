# ⚡ Postman / cURL → k6 / Cypress / Playwright Converter

> Convierte colecciones de Postman o comandos cURL (Bash) en scripts listos para pruebas de carga (k6) o automatización funcional (Cypress y Playwright), **sin escribir una sola línea de código** y **100% en el navegador**.

![Demo](https://img.shields.io/badge/version-1.1.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![HTML](https://img.shields.io/badge/stack-HTML%20%2B%20Vanilla%20JS-orange?style=flat-square)
![k6](https://img.shields.io/badge/target-k6%20%7C%20Cypress%20%7C%20Playwright-7d64ff?style=flat-square)

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
| 🖥️ **Soporte cURL** | Pega comandos cURL (Bash) completos y conviértelos directamente a k6, Cypress o Playwright |
| 🔍 **Selección de requests** | Elige cuáles requests incluir en el script generado |
| 📁 **Soporte de carpetas** | Respeta la jerarquía de folders de la colección, con colapso/expansión |
| 🚀 **Tres modos de carga (k6)** | Simple, Stages (ramp-up/down) y Ramping VUs con executor avanzado |
| 🎯 **Thresholds configurables (k6)** | Define SLOs sobre `http_req_duration`, `http_req_failed`, `http_req_waiting` e `iterations` |
| 🔐 **Conversión de autenticación** | Soporta Bearer Token, Basic Auth (con codificación UTF-8 segura) y API Key |
| 📦 **Cuerpos de request** | Convierte `raw` (JSON/XML/text), `urlencoded`, `form-data` y `GraphQL` |
| 🔄 **Variables y Dinámicas** | Mapea `{{var}}` a constantes y traduce variables dinámicas globales (`{{$guid}}` $\rightarrow$ `crypto.randomUUID()`, `{{$timestamp}}` $\rightarrow$ `Date.now()`, `{{$randomInt}}`) |
| 🌐 **Base URL automática** | Detecta o permite sobreescribir la URL base de la colección |
| ⏱️ **Sleep configurable** | Agrega pausa entre requests para simular think time |
| 🌲 **Cypress (JS/TS)** | Genera archivos `.cy.js`/`.cy.ts` con comandos personalizados de autenticación y estructura describe/it |
| 🎭 **Playwright (JS/TS)** | Genera scripts `.spec.js`/`.spec.ts` estructurados para pruebas de API de Playwright |
| 💾 **Persistencia y Temas (UX)** | Guarda la preferencia de framework y se adapta automáticamente al tema claro/oscuro del sistema |
| 🛡️ **Seguridad (CSP)** | Ejecución 100% local. Inyección de Content Security Policy estricta (`connect-src 'none'`) para impedir exfiltración |
| 📋 **Copia / Descargas** | Copia, descarga como 1 script consolidado o exporta la estructura de proyecto completa en `.zip` |

---

## 🏗️ Arquitectura del proyecto

```
postman-to-k6/
├── index.html           # UI de 4 pasos (Wizard SPA) con directiva CSP
├── style.css            # Sistema de diseño con variables CSS y soporte responsive y claro/oscuro
├── curl-parser.js       # Lógica de parsing de comandos cURL
├── converter.js         # PARSER: Procesa JSON y genera el Intermediate Object (IOI)
├── generators/          # Capa de generación de código (generators)
│   ├── k6-generator.js        # Lógica de generación para k6
│   ├── cypress-generator.js   # Lógica de generación para Cypress (JS/TS)
│   └── playwright-generator.js# Lógica de generación para Playwright (JS/TS)
└── app.js               # Orquestación de UI, eventos, persistencia y estado
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

### Paso 1 — Importar colección / cURL

Tienes dos opciones:

**Opción A: Colección Postman**
Exporta tu colección desde Postman:
1. Abre Postman → selecciona tu colección
2. Click en `···` → **Export**
3. Elige formato **Collection v2.1** (recomendado) o v2.0
4. Guarda el archivo `.json`

Luego, en la herramienta:
- **Arrastra** el archivo `.json` sobre la zona de drop, o
- **Haz click** en "Seleccionar archivo", o
- **Pega** el JSON directamente en el textarea.

**Opción B: cURL (Bash)**
Selecciona la pestaña "cURL (Bash)" y pega tu comando completo (ideal para peticiones extraídas desde las DevTools del navegador, Swagger u OpenAPI). La herramienta soporta comandos multilínea (separados por `\`) y extraerá de forma automática el método HTTP, encabezados (headers), carga útil (payload/body), parámetros de búsqueda (query params) y mecanismos de autenticación a partir de los flags del comando proporcionado.

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

#### Módulos del proyecto k6
Permite alinear el script generado con una arquitectura de proyecto k6 existente:
- **`setup()` + Autenticación:** Genera la función `setup` importando un helper local (`import { getAuthToken }`) para obtener dinámicamente un token y pasarlo a las peticiones con interpolación JS real (`Bearer ${data.token}`).
- **`handleSummary()` + Reporte HTML:** Inyecta de manera automática la lógica para generar reportes en consola e HTML usando `k6-reporter` y `k6-summary`.

#### Pausa entre requests
Tiempo en segundos entre cada request dentro de la función default (simula el _think time_ de un usuario real). Valor `0` = sin pausa.

### Paso 4 — Script generado

- **Preview** del script con syntax highlighting
- Contador de líneas
- Botón **"Copiar código"** → copia al portapapeles
- Botones de **Descarga**:
  - **"Descargar .js"**: Descarga un archivo monolítico con todas las requests seleccionadas (ej. `mi-api-test.js`).
  - **"📦 1 archivo por request"**: Exporta un archivo `.zip` que contiene un script k6 separado, independiente y con su propia estructura completa por cada request de la colección.
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

### Mapeo de comandos cURL (Bash)

El intérprete nativo de cURL analiza exhaustivamente el comando proporcionado y lo mapea de forma semántica a la configuración de k6. A continuación se detallan los flags soportados y su comportamiento:

| Flag cURL soportado | Acción o mapeo generado en k6 |
|---|---|
| **URL Posicional** o `--url` | Extrae la URL base y desglosa los query parameters. |
| `-X` / `--request` | Define el método HTTP (`GET`, `POST`, `PUT`, `DELETE`, etc.). Si se omite, deduce `GET` por defecto, o `POST` si existe un payload de datos. |
| `-H` / `--header` | Mapea e inyecta los encabezados de la petición dentro del objeto `params.headers`. |
| `-d` / `--data` / `--data-raw` / `--data-binary` | Define el cuerpo de la petición. Detecta automáticamente si el contenido es JSON (inyectando `Content-Type` de ser necesario). |
| `--data-urlencode` | Define el cuerpo como `application/x-www-form-urlencoded` y estructura los datos adecuadamente. |
| `--json` | Asigna el cuerpo de la petición y fuerza el encabezado `Content-Type: application/json`. |
| `-u` / `--user` | Codifica automáticamente las credenciales en Base64 generando el encabezado `Authorization: Basic <user:pass>`. |
| `-b` / `--cookie` | Asigna las cookies especificadas mediante el encabezado `Cookie`. |
| `-A` / `--user-agent` | Establece la identidad del cliente inyectando el encabezado `User-Agent`. |

> **Nota para equipos de QA:** Los flags informativos, de conexión o formato (como `-L`, `--location`, `--compressed`, `-k`, `--insecure`, `-s`, `-v`) son asimilados correctamente por el parser para evitar errores de sintaxis, pero se omiten en la exportación, dado que k6 gestiona la compresión, redirecciones y certificados localmente durante su ejecución nativa.

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

## 🧪 Conversión de tests Postman → checks k6, Cypress y Playwright

El sistema incorpora un **Motor Semántico de Aserciones** en el parser (`converter.js`) que analiza los scripts de test de Postman y extrae las validaciones a un modelo de datos independiente. Los generadores de k6, Cypress y Playwright consumen este modelo para crear código nativo:

| Postman test (Origen) | k6 check generado | Cypress generado | Playwright generado |
|---|---|---|---|
| `pm.response.to.have.status(200)` | `(r) => r.status === 200` | `expect(response.status).to.eq(200)` | `expect(response.status()).toBe(200)` |
| `pm.expect(pm.response.responseTime).to.be.below(500)` | `(r) => r.timings.duration < 500` | `expect(response.duration).to.be.below(500)` | `// Check response time: expect below 500ms` |
| `pm.response.to.be.json` | `(r) => r.headers['Content-Type'].includes('json')` | `expect(response.headers['content-type']).to.include('json')` | `expect(response.headers()['content-type']).toContain('json')` |

Los checks de k6 se agrupan por request y alimentan una métrica `Rate` personalizada (`errorRate`):

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

Las variables `{{varName}}` de Postman se convierten de forma automática dependiendo del framework seleccionado:

* **k6:** Se exportan como constantes parametrizadas a través del entorno de ejecución:
  ```js
  const APIKEY = __ENV.APIKEY || '';
  ```
  Ejecución: `k6 run -e APIKEY=mi-token load-test.js`
* **Cypress:** Se mapean como variables de entorno de Cypress:
  ```js
  Cypress.env('apiKey')
  ```
  Ejecución: `CYPRESS_apiKey=mi-token npx cypress run`
* **Playwright:** Se mapean a variables de entorno del sistema de Node.js:
  ```js
  process.env.APIKEY || ''
  ```
  Ejecución: `APIKEY=mi-token npx playwright test`

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

### `curl-parser.js` (~300 líneas)
Parser dedicado que convierte un comando cURL (Bash) crudo en el objeto de request normalizado que el generador puede entender. Maneja división de tokens, strings multilínea con escapes, y flags cortas/largas.

### `converter.js` (~580 líneas)
Motor de conversión (Parser) que procesa colecciones JSON de Postman y comandos cURL, traduciéndolos al Intermediate Object Interface (IOI) estandarizado. Contiene aserciones y detectores de variables.

### `generators/` (Capa de Generación)
Módulos dedicados que consumen el IOI y emiten código de pruebas en sintaxis nativa:
- **`k6-generator.js`:** Genera scripts modularizados de k6 con VU's, stages, thresholds y exporta a InfluxDB/Grafana.
- **`cypress-generator.js`:** Genera scripts Cypress de pruebas de API funcionales en JS o TS, estructurados en bloques describe/it.
- **`playwright-generator.js`:** Genera suites de pruebas de API de Playwright en JS o TS, importando test/expect y estructurado para integración continua.

### `app.js` (~485 líneas)
Orquestación de la UI:

```
State:
├── collection      { name, requests, variables, folderCount }
├── currentMode     'simple' | 'stages' | 'ramping'
├── inputMode       'postman' | 'curl'
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
