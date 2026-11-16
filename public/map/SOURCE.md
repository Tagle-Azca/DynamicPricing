# world.svg source

- Data: Natural Earth, Admin 0 Countries, 1:110m scale (`ne_110m_admin_0_countries.geojson`).
- URL: https://github.com/nvkelso/natural-earth-vector (file `geojson/ne_110m_admin_0_countries.geojson`); project site https://www.naturalearthdata.com/
- License: Public domain (Natural Earth terms of use: "All versions of Natural Earth raster + vector map data found on this website are in the public domain"). No attribution required.
- Conversion: custom one-off script. Equirectangular projection, viewBox `0 0 1000 395`, points closer than 0.5 units dropped, coordinates rounded to 0.1. One `<path>` per country with `data-region="<ISO 3166-1 alpha-2>"` and a `<title>` holding the English name.
- Removed: Antarctica and the shapes without an ISO alpha-2 code (N. Cyprus, Somaliland); latitudes below 58 S and above 84 N are cropped. Taiwan is coded `TW`, Kosovo `XK`.
- Sanitized: no script, style, class, `on*` attributes, foreignObject, or hrefs (checked by grep). The UI also strips these again after parsing (`public/js/map-svg.js`).
- Size: about 125 KB, 174 countries. Small territories absent at 1:110m scale cannot be clicked.
