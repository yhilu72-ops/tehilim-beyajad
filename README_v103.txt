# Tehilim BeYajad v103 correcciones

Correcciones aplicadas:
1. Pantalla inicial ahora es solo logo limpio; después pasa a login.
2. El contador total de lectores ya no aparece en la primera pantalla; queda en el menú principal.
3. Botones de Tehilim personal reforzados para entrar a “continuar” y “escoger capítulo”.
4. Selección de capítulos dentro de sala reforzada con delegación de eventos y render robusto.
5. En aportaciones, la carta del Kolel se colocó inmediatamente después de la información del Kolel y su mail.
6. Pantalla “Escoge tipo de sala” rehecha: un solo buscador y categorías sin descripciones duplicadas.
7. Eliminar kabalot ahora oculta/borrra de forma optimista aunque Supabase no permita borrar por RLS.
8. Sidur, Perek Shira, Shir Hashirim y Tikun Klali apuntan a archivos locales en /texts.

Pendiente honesto:
- Completar los textos completos y autorizados/licenciados dentro de /texts/*.json.
