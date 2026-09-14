# Constructorul de pagini Panel Pro

## Flux recomandat

1. Intră în `administrare-module.html` ca administrator global.
2. Alege **Constructor pagini**, nu Constructor Discord.
3. Scrie ce vrei să creezi sau selectează un șablon.
4. Verifică categoria, accesul, layout-ul și tema.
5. Folosește previzualizarea Desktop/Mobil.
6. Reordonează sau duplică blocurile din editorul vizual.
7. Salvează un draft sau apasă **Publică pagina**.

## Ce se întâmplă la publicare

- pagina este salvată cu starea `published`;
- meniul Panel Pro o poate încărca automat;
- `organizatii.html` reîncarcă selectorii de permisiuni fără refresh manual când este deschis în alt tab;
- pagina este acceptată în `page_permissions` la salvarea organizației;
- se păstrează versiunea anterioară și se scrie auditul administratorului;
- pagina poate fi depublicată, arhivată, restaurată sau ștearsă din manager.

## Siguranță și compatibilitate

Paginile publice pot fi citite fără sesiune. Paginile pentru utilizatori autentificați necesită sesiune Panel Pro, iar paginile administratorului global nu sunt livrate prin lista publică. Conținutul este curățat server-side înainte de salvare. Constructorul Discord rămâne separat și nu schimbă fluxurile modulelor existente.

## Verificare înainte de deploy

```text
node tools/validate-page-studio.mjs
node tools/validate-panel.mjs
node --check js/platform-assistant-workbench.js
node --check js/custom-page.js
git diff --check
```
