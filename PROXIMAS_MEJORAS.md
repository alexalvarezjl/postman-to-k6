# 🚀 Próximas Mejoras y Hoja de Ruta

Este documento detalla las mejoras técnicas identificadas para fortalecer la seguridad, el rendimiento y la robustez de la **Plataforma de Generación Políglota Postman Converter**.

---

## 🏛️ Arquitectura y Escalabilidad

- [ ] **Soporte de Playwright:** Siguiendo el mismo patrón de `generators/playwright-generator.js`, podrías añadir soporte para este framework en menos de una hora gracias al Intermediate Object Interface (IOI) que definimos.
- [ ] **Manejo de Archivos en Form-Data:** Implementar la lógica para que Cypress o k6 puedan simular la subida de archivos si el Intermediate Object detecta campos de tipo `file`.
- [ ] **Evolución del IOI:** Refinar el objeto intermedio para incluir metadatos de configuración de entorno y scripts de pre-solicitud.
- [ ] **Mapeo de Aserciones Complejas:** Mejorar el traductor de `pm.expect` para manejar comparaciones profundas de objetos JSON, reduciendo la necesidad de revisión manual.

---

## 🛠️ Robustez y Funcionalidad

- [ ] **Pre-request Scripts Avanzados:** Implementar la conversión de lógica de pre-solicitud hacia la función `setup()` en k6 y comandos personalizados en Cypress.
- [ ] **Variables Dinámicas Globales:** Mapear variables dinámicas de Postman (ej: `{{$guid}}`, `{{$timestamp}}`) a sus equivalentes nativos en todos los frameworks soportados.
- [ ] **Soporte UTF-8 en Auth:** Corregir la limitación de `btoa` en credenciales de Basic Auth para soportar caracteres especiales (Unicode/UTF-8).
- [ ] **Validación de Esquema Postman:** Implementar una validación estricta del JSON de entrada usando el esquema oficial de Postman Collection v2.x.

---

## 🛡️ Seguridad

- [ ] **Implementar Content Security Policy (CSP):** Añadir un meta tag CSP en `index.html` para restringir la carga de scripts externos y prevenir exfiltración de datos.
- [ ] **Sanitización Robusta:** Migrar del uso de `innerHTML` a `createElement` / `textContent` en la manipulación dinámica del DOM en `app.js` para eliminar riesgos de XSS residuales.
- [ ] **Gestión de Dependencias:** Descarga local de `JSZip` y evaluación de versiones fijas (hashes/SRI) para módulos externos de k6.

---

## 🚀 Rendimiento

- [ ] **Web Workers:** Mover la lógica pesada de análisis (Parser) y generación (Generators) a un Web Worker para mantener la UI fluida con colecciones grandes.
- [ ] **Virtual Scrolling:** Implementar una lista virtual para la selección de requests en el Paso 2, evitando degradación con cientos de elementos.
- [ ] **Optimización de Memoria:** Asegurar que `URL.revokeObjectURL` se ejecute siempre para prevenir fugas de memoria en sesiones largas.

---

## 🎨 UI / UX

- [ ] **Local Storage Persistence:** Guardar la preferencia de framework del usuario en el navegador para que, al recargar, la SPA recuerde si prefiere k6 o Cypress.
- [ ] **Dark Mode Sync:** Sincronizar el tema con las preferencias del sistema del usuario.
- [ ] **Editor de Código en Vivo:** Permitir ediciones manuales rápidas en el script generado antes de la descarga definitiva.
- [ ] **Drag & Drop de Carpetas:** Permitir arrastrar carpetas enteras de archivos `.json` para procesamiento masivo.
