/* ==========================================================================
   LEGALTY — Services catalog (single source of truth)
   --------------------------------------------------------------------------
   Defines the 4 firm services shown on the Servicios page. `id` MUST match the
   `data-service-id` values in services.html so checkout.js can resolve them:

     invertir                  → Invertir
     planificacion-financiera  → Planificación financiera
     patrimonio                → Patrimonio
     jubilacion                → Jubilación

   `price` is null until the firm supplies real pricing (PENDING). checkout.js
   treats a null/undefined price as "not payable yet" and blocks checkout.

   Declared with `const` at top-level so it is shared across scripts loaded on
   the same page (catalog.js MUST load before checkout.js).
   ========================================================================== */
const SERVICES = [
  { id: 'invertir', title: 'Invertir', price: null /* PENDING — set real price */ },
  { id: 'planificacion-financiera', title: 'Planificación financiera', price: null /* PENDING — set real price */ },
  { id: 'patrimonio', title: 'Patrimonio', price: null /* PENDING — set real price */ },
  { id: 'jubilacion', title: 'Jubilación', price: null /* PENDING — set real price */ }
];
