# 🚀 Próximas Mejoras y Hoja de Ruta

Este documento detalla las mejoras técnicas identificadas para fortalecer la seguridad, el rendimiento y la robustez del conversor **Postman → k6**.

---

## 🛡️ Seguridad

- [ ] **Implementar Content Security Policy (CSP):** Añadir un meta tag CSP en `index.html` para restringir la carga de scripts externos y prevenir exfiltración de datos.
- [ ] **Sanitización Robusta:** Migrar del uso de `innerHTML` a `createElement` / `textContent` en la manipulación dinámica del DOM en `app.js` para eliminar riesgos de XSS residuales.
- [ ] **Gestión de Dependencias:** Considerar la descarga local de `JSZip` en lugar de depender de un CDN externo para asegurar la disponibilidad y seguridad de la librería.
- [ ] **Revisión de Imports Externos:** Evaluar el uso de versiones fijas (hashes/SRI) para los módulos de k6 importados desde GitHub y `jslib`.

---

## 🚀 Rendimiento

- [ ] **Virtual Scrolling:** Implementar una lista virtual para la previsualización de requests en el Paso 2, evitando la degradación del rendimiento al cargar colecciones con cientos de elementos.
- [ ] **Web Workers:** Mover la lógica pesada de análisis de JSON y cURL (`converter.js` y `curl-parser.js`) a un Web Worker para mantener la interfaz de usuario fluida durante el procesamiento de archivos grandes.
- [ ] **Optimización de Memoria:** Asegurar que `URL.revokeObjectURL` se ejecute siempre, incluso tras errores de descarga, para prevenir fugas de memoria en sesiones largas.

---

## 🛠️ Robustez y Funcionalidad

- [ ] **Soporte UTF-8 en Auth:** Corregir la limitación de `btoa` en credenciales de Basic Auth para soportar caracteres especiales (Unicode/UTF-8).
- [ ] **Validación de Esquema Postman:** Implementar una validación más estricta del JSON de entrada usando el esquema oficial de Postman Collection v2.x.
- [ ] **Pre-request Scripts (Básico):** Investigar la posibilidad de convertir scripts sencillos de pre-solicitud (como asignación de variables dinámicas).
- [ ] **Variables Dinámicas k6:** Mapear variables dinámicas de Postman (ej: `{{$guid}}`, `{{$timestamp}}`) a sus equivalentes nativos de k6 o funciones personalizadas.

---

## 🎨 UI / UX

- [ ] **Dark Mode Sync:** Sincronizar el tema con las preferencias del sistema del usuario.
- [ ] **Editor de Código en Vivo:** Permitir pequeñas ediciones manuales en el script generado antes de la descarga definitiva.
- [ ] **Drag & Drop de Carpetas:** Permitir arrastrar carpetas enteras de archivos `.json`.
