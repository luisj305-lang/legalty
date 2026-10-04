/* ==========================================================================
   LEGALTY — Services catalog (single source of truth)
   --------------------------------------------------------------------------
   Client-side catalog for the Servicios page and checkout.js. Each `id` MUST
   match the `data-service-id` values in services.html and the mirrored server
   catalog in api/create-preference.js (keep ids, titles and prices identical).

   `price` is an integer amount in Colombian pesos (COP). `null` means the
   service is quoted by complexity and is not payable online ("a convenir");
   checkout.js blocks checkout for a null price.

   Declared with `const` at top-level so it is shared across scripts loaded on
   the same page (catalog.js MUST load before checkout.js).
   ========================================================================== */
const SERVICES = [
  { id: 'llamada-30min', title: 'Llamada telefónica 30 min', price: 50000 },
  { id: 'llamada-45min', title: 'Llamada telefónica 45 min', price: 100000 },
  { id: 'concepto-1hora', title: 'Concepto / consulta 1 hora', price: 150000 },
  { id: 'derecho-peticion', title: 'Derecho de petición', price: 250000 },
  { id: 'tutela', title: 'Tutela', price: 1000000 },
  { id: 'llamada-test', title: 'Llamada test', price: 5000 },
  { id: 'concepto-complejidad', title: 'Concepto jurídico (según complejidad)', price: null },
  { id: 'contrato', title: 'Contrato (según complejidad)', price: null }
];
