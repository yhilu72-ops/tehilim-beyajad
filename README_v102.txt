# Tehilim BeYajad v102 - Solo ayuda inteligente

## Qué incluye
- `index.html`: app principal.
- `assets/kolel-logo.jpg`: logo del Kolel.
- `assets/carta-kolel-firmada.jpg`: carta firmada.
- `texts/tehilim.json`: estructura local para Tehilim.
- `manifest.json`: manifiesto PWA básico.

## Cambio importante
Se eliminó:
- Crear sala con IA
- Gabai IA
- Edge Function ai-gabai
- Cualquier dependencia de OpenAI

Se conservó:
- Contador total de lectores activos en toda la app
- Ayuda inteligente privada dentro de la sala
- Carta firmada del Kolel dentro de aportaciones
- Tehilim desde archivo local `texts/tehilim.json`

## Subir a hosting
Sube TODO el contenido de esta carpeta, no solo `index.html`, porque la app usa:
- assets/
- texts/
- manifest.json

## Tehilim local
La app está preparada para leer de `texts/tehilim.json`.
Antes de publicación final pública, completar los capítulos faltantes con una fuente permitida/licenciada.
