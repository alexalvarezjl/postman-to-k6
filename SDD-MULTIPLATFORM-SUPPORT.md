# Software Design Document (SDD): Multiplatform Support (k6 & Cypress)

## 1. Objetivo
Transformar el conversor actual de una herramienta acoplada exclusivamente a **k6** hacia una arquitectura de generación de código políglota. El sistema permitirá al usuario elegir entre **k6 (Load Testing)** y **Cypress (Functional API Testing)**, reutilizando la lógica de análisis de colecciones de Postman y comandos cURL a través de un contrato de datos estandarizado.

## 2. Arquitectura Propuesta
El flujo de datos se desacopla mediante la introducción de un **Intermediate Object (IO)** que actúa como puente entre el parser y los generadores específicos.

```mermaid
graph TD
    A[Postman JSON / cURL Command] --> B[converter.js <br/><i>(The Brain / Parser)</i>]
    B --> C{Intermediate Object Interface}
    C --> D[generators/k6-generator.js <br/><i>(k6 Logic)</i>]
    C --> E[generators/cypress-generator.js <br/><i>(Cypress Logic)</i>]
    D --> F[Script k6 .js]
    E --> G[Script Cypress .cy.js]
```

## 3. Contrato de Interfaz (Intermediate Object)
El parser (`converter.js`) entregará un objeto con la siguiente estructura, garantizando que los generadores no necesiten conocer el formato original de Postman.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `string` | Identificador único generado (ej. `req_abc123`). |
| `name` | `string` | Nombre descriptivo de la petición en Postman. |
| `folder` | `string` | Ruta de carpetas (breadcrumb) para agrupar en `describe`. |
| `method` | `string` | Método HTTP en mayúsculas (GET, POST, etc.). |
| `url` | `string` | URL base sin la query string (inyectada por el parser). |
| `queryParams` | `Array<{k, v}>` | Lista de parámetros de búsqueda extraídos. |
| `headers` | `Array<{k, v}>` | Cabeceras (incluyendo Auth inyectada como header). |
| `body` | `Object \| null` | Objeto con `mode` (raw, urlencoded, formdata) y su contenido. |
| `postmanScript` | `string` | El código JavaScript crudo de la pestaña "Tests" de Postman. |
| `selected` | `boolean` | Indica si el usuario seleccionó esta petición en la UI. |

## 4. Estructura de Archivos
Tras la refactorización, el árbol de archivos se organizará de la siguiente manera para separar responsabilidades:

```text
postman-to-k6/
├── index.html           # UI & Importación de scripts
├── app.js               # Orquestador de UI y Estado
├── converter.js         # PARSER: Genera el Intermediate Object
├── curl-parser.js       # PARSER: Convierte cURL al Intermediate Object
├── generators/          # Lógica de Generación de Código
│   ├── k6-generator.js      # Específico para k6 (Options, Thresholds)
│   └── cypress-generator.js # Específico para Cypress (describe, it, cy.request)
└── style.css            # Estilos globales
```

## 5. Estrategia de Mapeo de Variables
El sistema detectará patrones `{{variable}}` en el JSON original y los transformará según el framework destino:

| Contexto | Origen (Postman) | Destino (k6) | Destino (Cypress) |
| :--- | :--- | :--- | :--- |
| **Variables** | `{{baseUrl}}` | `${BASEURL}` (vía `__ENV`) | `Cypress.env('baseUrl')` |
| **Auth** | `Bearer {{token}}` | `` `Bearer ${data.token}` `` | `` `Bearer ${Cypress.env('token')}` `` |
| **Aserciones** | `status(200)` | `check(res, { 'status is 200': ... })` | `expect(res.status).to.eq(200)` |
