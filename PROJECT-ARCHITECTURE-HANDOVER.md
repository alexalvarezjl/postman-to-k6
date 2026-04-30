# Arquitectura y Contexto de Proyecto: Postman Converter Platform

## 1. Estado Actual del Sistema
El proyecto ha evolucionado de un conversor monolítico exclusivo para k6 a una **Plataforma de Generación Políglota**. La arquitectura actual se basa en el desacoplamiento total entre el análisis del origen (Postman/cURL) y la generación del destino (k6/Cypress).

Esta transición permite:
- **Mantenibilidad:** Errores en la generación de un framework no afectan al otro.
- **Escalabilidad:** Agregar un nuevo destino (ej. Playwright) solo requiere implementar un nuevo generador que consuma el objeto intermedio.
- **Consistencia:** Todas las transformaciones de variables y limpieza de URLs se realizan en un único punto centralizado.

---

## 2. El Contrato de Interfaz: Intermediate Object Interface (IOI)
El archivo `converter.js` (Parser) actúa como el "Cerebro", transformando cualquier entrada en este contrato de datos estandarizado. Cualquier generador futuro **DEBE** esperar este objeto:

```javascript
{
  id: string,              // ID único para referenciar variables en el script (ej: 'req_a1b2c3')
  name: string,            // Nombre de la petición original
  folder: string,          // Ruta de carpetas para organización (describe/groups)
  method: string,          // Método HTTP (GET, POST, PUT, etc.)
  url: string,             // URL base limpia (sin query string inline)
  queryParams: Array<{     // Parámetros de búsqueda extraídos
    key: string, 
    value: string 
  }>,
  headers: Array<{         // Cabeceras (incluye Auth normalizada)
    key: string, 
    value: string 
  }>,
  body: {                  // Cuerpo de la petición (null si no aplica)
    mode: 'raw' | 'urlencoded' | 'formdata',
    raw?: string,          // Contenido para modo raw
    language?: string,     // 'json', 'xml', 'text'
    urlencoded?: Array,
    formdata?: Array
  } | null,
  postmanScript: string,   // Código JS crudo de la pestaña "Tests" de Postman
  selected: boolean        // Estado de selección en la UI
}
```

---

## 3. Responsabilidades por Archivo

### `converter.js` (Parser & Normalizador)
- **Extracción:** Recorre recursivamente la colección de Postman.
- **Normalización:** Inyecta tipos de contenido (JSON) y extrae autenticación (Bearer/Basic) hacia las cabeceras.
- **Agnosticismo:** No conoce detalles de k6 o Cypress; solo produce el IOI.
- **Helper Methods:** Provee funciones compartidas para sanitizar nombres de variables y detectar la URL Base.

### `generators/k6-generator.js` (Performance & Load)
- **Lógica de Carga:** Transforma la configuración de la UI (VUs, Stages, Thresholds) en el objeto `export const options`.
- **Patrón Modular:** Soporta la inclusión de `setup()` y `handleSummary()` mediante importaciones externas.
- **Aserciones:** Mapea el script de Postman a la función `check()` de k6.

### `generators/cypress-generator.js` (E2E & Functional)
- **Estructura Modular:** Genera una suite completa (`cypress.config.js`, `commands.js`, y archivos `.cy.js`).
- **Comandos Custom:** Abstrae la autenticación en `cy.login()` para centralizar la gestión de tokens.
- **Contexto de Debug:** Inyecta comentarios con metadatos de Postman en cada bloque `it()`.

---

## 4. Lógica de Traducción de Aserciones
El sistema traduce el lenguaje de Postman (`pm.expect`) a los frameworks destino mediante el análisis del `postmanScript`:

| Origen (Postman) | k6 (Check) | Cypress (Chai Expect) |
| :--- | :--- | :--- |
| `status(200)` | `(r) => r.status === 200` | `expect(res.status).to.eq(200)` |
| `below(500)` (Time) | `(r) => r.timings.duration < 500` | `expect(res.duration).to.be.below(500)` |
| `to.be.json` | `(r) => r.headers['Content-Type'].includes('json')` | `expect(res.headers).to.include('application/json')` |

*Nota: Las aserciones complejas de objetos JSON requieren revisión manual y se marcan con comentarios de advertencia en el código generado.*

---

## 5. Pendientes y Escalabilidad

### Limitaciones Actuales
- **Pre-request Scripts:** Actualmente no se procesan. Se recomienda mover la lógica de pre-request a comandos personalizados (Cypress) o a la función `setup()` (k6).
- **Archivos Binary/Multipart:** Solo se exportan los metadatos de campos de texto en formdata; los archivos físicos no se incluyen por limitaciones del navegador.

### Cómo agregar un tercer framework (ej. Playwright)
1. **Crear Generador:** Crear `generators/playwright-generator.js`.
2. **Implementar Contrato:** Crear una función `generatePlaywrightScript(collection, config)` que itere sobre el IOI.
3. **Mapeo de Variables:** Traducir `{{var}}` a `process.env.VAR`.
4. **Registrar en UI:**
   - Agregar botón en el toggle global de `index.html`.
   - Actualizar el switch de orquestación en `app.js` (método `btnGenerate.click`).
   - Definir qué extensiones descargar (`.spec.ts`).

---
**Handover Document Finalizado**  
*Desarrollado con ❤️ para asegurar la evolución del ecosistema Postman → Automation.*
