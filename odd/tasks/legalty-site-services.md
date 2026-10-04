# LEGALTY public site — real services catalog (COP) + MercadoPago readiness

Feature doc (ODD). Scope: the public static site (`index.html`, `services.html`, `assets/js`, `api/`). Does NOT touch the client portal (`portal/`).

## Objective
Replace the four placeholder services (`invertir`, `planificacion-financiera`, `patrimonio`, `jubilacion`, all unpriced) with the firm's real services and prices in **COP**, per the client's audio transcript (2026-10-03). Prepare the payable catalog for MercadoPago, including a low-cost `Llamada test` service used to verify the checkout end-to-end.

## Source of truth
- Client audio transcript, 2026-10-03. Currency confirmed by client: **pesos colombianos (COP)**.
- Short numbers in the audio are **thousands** (a 30-min call cannot be $50 COP).

## Payable catalog (fixed price)
Client catalog `assets/js/catalog.js` and server catalog `api/create-preference.js` MUST stay identical (ids, titles, prices).

| id | title | price (COP) |
|---|---|---|
| llamada-30min | Llamada telefónica 30 min | 50000 |
| llamada-45min | Llamada telefónica 45 min | 100000 |
| concepto-1hora | Concepto / consulta 1 hora | 150000 |
| derecho-peticion | Derecho de petición | 250000 |
| tutela | Tutela | 1000000 |
| llamada-test | Llamada test | 5000 |

## A convenir (not payable online — `price: null`)
- `concepto-complejidad` — Concepto jurídico (según complejidad)
- `contrato` — Contrato (según complejidad)

## Non-priced practice areas (services.html editorial)
**Jurídico:** consultas y conceptos; contratos; tutelas y tutelas contra providencias judiciales; derechos de petición; sucesiones; compraventas e hipotecas y su cancelación; prendas; mandatos y representación; procesos civiles (ordinarios, ejecutivos, prescripciones, adquisición de dominio, acciones reivindicatorias); procesos laborales; familia (divorcios, asignación de apoyo, privación de patria potestad, ejecutivos de alimentos, violencia intrafamiliar); penales (receptación, extorsión, hurto, homicidio, fraude procesal, porte de armas); litigio estratégico procesal; poderes (especiales, generales, exterior por consulado/cancillería/apostilla).

**Financiero:** leasing; valoración de portafolios, empresas y activos; análisis financiero y recomendaciones; fiducia y fiducia de inversión colectiva; gobierno corporativo; proyectos y presupuestos; gestión de costos y gastos; matemática financiera e ingeniería económica; compras de carteras; análisis de planes de pago, histórico y tasas.

## Route decision
**Direct inline.** Only `services.html` is genuinely non-trivial (content); `catalog.js`, `api/create-preference.js`, `tests/contracts.test.cjs` and `tests/browser.cjs` are mechanical data/test edits, fully understood from exploration. No research and no unresolved design remain, so the writer-delegation trigger (2+ *non-trivial* files) does not fire; delegating would only re-serialize content already fixed. Recorded here so the skipped delegation is observable.

## Acceptance / checks
- Root `npm test` (`tests/*.test.cjs`) green after updating the catalog contract.
- `services.html` shows the practice areas and the payable catalog with COP prices, the `Llamada test` service, and the two "a convenir" items.
- Client and server catalogs in sync.

## Rollback
Single work unit: revert changes to `assets/js/catalog.js`, `api/create-preference.js`, `services.html`, `tests/contracts.test.cjs`, `tests/browser.cjs`, and this entry. No data or external services involved.
