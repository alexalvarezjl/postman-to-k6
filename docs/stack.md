# Stack Tecnológico

## Core de la Aplicación
*   **Lenguaje**: JavaScript (ES6+) para toda la lógica de parsing y generación[cite: 7].
*   **UI**: HTML5 y CSS3 con diseño "Glassmorphism", optimizado para una experiencia de usuario fluida[cite: 7].
*   **Privacidad**: Ejecución 100% local; los datos de las colecciones nunca salen del navegador (Privacy by Design)[cite: 7].

## Inteligencia Artificial y Agentes
*   **Metodología**: SDD (Schema Driven Development) mediante OpenSpec.
*   **Modelos**: Uso preferencial de **Gemini Pro** y **Claude** para tareas complejas de refactorización y lógica de aserciones[cite: 7].
*   **Gestión de Skills**: Centralizada en `.agent/skills/` para facilitar la compatibilidad entre agentes.

### Directorio de Habilidades (Skills)
*   **Estratégicas**: `openspec-propose`, `openspec-explore`, `openspec-apply-change`, `openspec-archive-change`.
*   **Técnicas**: `cypress-author`, `k6-docs`, `writing-plans`.

## Herramientas de Automatización
*   **Motor k6**: Especializado en pruebas de carga con soporte nativo para reportes en consola y HTML[cite: 2, 7].
*   **Motor Cypress**: Para automatización funcional, gestión de estados y validaciones E2E[cite: 3, 7].