# tucarta

Calculadora de cartas natales de [sebabru.com/tucarta](https://sebabru.com/tucarta).

Usa [Swiss Ephemeris](https://www.astro.com/swisseph/) de Astrodienst, distribuida bajo la
licencia AGPL-3.0. Por eso este código también se publica bajo AGPL-3.0: ver `LICENSE`.

Los datos de lugares vienen de [GeoNames](https://www.geonames.org/) (CC-BY 4.0) y los husos
horarios de la [base IANA](https://www.iana.org/time-zones).

## Desarrollo

```
npm install
npm test        # tests contra cartas de referencia
npm run dev     # servidor local
npm run build   # genera dist/
```
