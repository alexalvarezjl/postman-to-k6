# Estrategia de Despliegue

## Naturaleza del Artefacto
El proyecto se distribuye como una **Single Page Application (SPA)** estática. Esto elimina la necesidad de gestionar bases de datos o lógica de servidor, simplificando el mantenimiento[cite: 6].

## Pipeline de Entrega Continua
1.  **Validación de Esquema**: Todo despliegue comienza con la validación del `config.yaml` de OpenSpec para asegurar que los agentes tengan el contexto correcto[cite: 6].
2.  **Distribución**: Carga de archivos core (`index.html`, `app.js`, `converter.js`, `style.css`) en servidores de contenido estático como GitHub Pages o S3[cite: 6].
3.  **Habilitación de Agentes**: Los archivos de la carpeta `.agent/` deben estar disponibles para que los modelos de IA puedan consultar las skills durante la asistencia en vivo[cite: 7].

## Seguridad
*   **Content Security Policy (CSP)**: Se implementa para restringir la carga de recursos externos y proteger la integridad de las colecciones de Postman importadas[cite: 6].
*   **Zero Data Retention**: Al ser una herramienta local, se garantiza que no hay almacenamiento persistente de datos sensibles en servidores externos[cite: 6, 7].