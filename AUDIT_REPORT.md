# Vehicle Lifebook — Audit & Upgrade Report

Audit basis: repository source on `main`, Supabase production schema/functions, and the supplied AI Audit & Upgrade Command Pack.

## 1. Source inventory

Actual repository currently contains:
- `index.html`: the application entry point and almost all frontend logic/UI.
- `README.md`: production documentation.
- `.github/workflows/pages.yml`: GitHub Pages deployment.
- `scripts/validate-index.mjs`: deployment-time JavaScript/security validation.
- No separate frontend modules, backend source tree, Edge Functions, tests, or committed migration files were found in the repository.

Supabase is the actual backend and contains the vehicle/event/detail/media/audit/profile/license domains plus views and RPCs.

## 2. P0/P1 findings fixed

### P0 — Fatal frontend parse failure
The previous `renderApp()` used nested template literals inside a larger template literal. That made the browser fail parsing the inline JavaScript before `boot()` could run, producing a blank page.

Status: FIXED.
Validation: full inline script passed `new Function(...)` syntax validation.

### P1 — Package limits were only a frontend guard
Vehicle/event limits were previously checked in JavaScript, which is not an authorization boundary.

Status: FIXED in PostgreSQL.
- DEMO: 1 vehicle / 20 events.
- PRO: active, non-expired license limits.
- OWNER: effectively unrestricted.
- Expired/revoked PRO fails closed to DEMO limits.
- Vehicle owner and event creator are verified server-side.
- Concurrent inserts lock the user's profile row before counting.
- Case-insensitive per-owner plate uniqueness was added.
- Useful indexes were added for event counting/timeline access.

### P1 — Deployment could publish broken JavaScript
GitHub Pages previously deployed without a syntax gate.

Status: FIXED.
The workflow now validates inline JavaScript and rejects potential service-role secrets before deployment.

### P2 — Missing welcome video asset had no graceful fallback
The source references `assets/welcome.mp4`, but that asset was not present in the repository inventory.

Status: FIXED at UX level.
A failed video load now falls back to a branded visual instead of leaving a broken media area.

## 3. Current architecture findings

The application is functional as a small mobile-first single-file app, but the frontend is currently a monolith.

Important architectural debt:
- UI, state, Supabase access, entitlement logic, voice parsing, export, expert prompt construction, owner console and modal code live in one HTML file.
- There are duplicated owner-license UI paths/functions.
- Automotive Expert is currently a prompt-generation feature, not a real model/tool execution pipeline.
- No deterministic calculation engine is present.
- No evidence/knowledge retrieval engine is present.
- No structured diagnostic engine is present.
- No explicit validation-history model for AI conclusions is present.
- Vehicle schema already contains useful identity fields, but a full digital-twin/component/configuration model is not yet implemented.
- Media/detail database domains exist, but the current UI does not expose their full capability.

## 4. Automotive intelligence gap

The prompt core is strong as an instruction set, but the source does not yet prove the existence of:
- OEM/manual evidence retrieval.
- source citations attached to technical claims.
- structured diagnostic decision trees.
- deterministic engineering calculators.
- compatibility verification against actual parts/specifications.
- calculation/test/validation records linked to vehicle history.
- confidence/evidence state per technical fact.

These must be treated as missing, not assumed to exist.

## 5. Data foundation

The existing Supabase model is a strong starting point:
vehicles → vehicle_events → typed detail tables, plus media and event audit.

The next data-model layer should add structured:
- vehicle configuration/current state
- component relationships
- modifications
- evidence records
- measurements/tests
- diagnostic cases
- calculations
- validation results

These should be added incrementally through repeatable migrations; existing history must not be rewritten destructively.

## 6. Security

Positive:
- RLS is enabled on the application tables.
- Service-role key is not present in the frontend.
- License/profile access is constrained.
- SECURITY DEFINER RPC exposure was hardened.
- Package limits are now enforced server-side.

Remaining:
- SECURITY DEFINER functions should continue to be reviewed whenever changed.
- File/media upload policy and storage bucket rules require a separate storage-specific audit because repository source alone does not expose bucket configuration.
- Supabase leaked-password protection remains a Free-plan platform limitation and is not a source-code defect.

## 7. UX/mobile

Current app is responsive and mobile-first, with voice fallback and modal workflows.

Remaining improvements:
- split the monolithic UI into modules without changing behavior;
- add explicit loading/error/offline states;
- improve media/photo workflows;
- add structured detail forms for fuel/service/damage/parts/inspection;
- preserve touch-friendly controls and low-end Android performance.

## 8. Performance

The largest current maintainability/performance risks are:
- one large HTML/JavaScript bundle;
- several CDN dependencies loaded up front;
- XLSX/PDF libraries loaded even when export is unused;
- the large automotive prompt stored in the initial page;
- no lazy module loading.

A future modular build should lazy-load heavy export and expert functionality.

## 9. Owner upgrade order

1. Keep the current stabilization and server-side security fixes.
2. Establish structured vehicle digital-twin/configuration data.
3. Add evidence + source tracking.
4. Add deterministic calculation engine.
5. Add diagnostic workflow with evidence/test/validation states.
6. Turn Automotive Expert into a context/evidence/reasoning pipeline.
7. Add modification/performance engineering workflows.
8. Add validation and safety gates.
9. Modularize the frontend and optimize mobile performance.
10. Production hardening, observability and broader automated tests.

## 10. Acceptance tests

- Unauthenticated user cannot reach protected vehicle data.
- DEMO cannot create vehicle #2.
- DEMO cannot create event #21.
- Expired/revoked PRO is treated as DEMO.
- Valid PRO uses its license limits.
- OWNER remains unrestricted.
- Cross-user vehicle/event creation is rejected.
- Duplicate plate for the same owner is rejected case-insensitively.
- Existing vehicle history remains unchanged by entitlement changes.
- Broken welcome media does not break the login screen.
- A JavaScript syntax error cannot be deployed by the Pages workflow.
- Frontend contains no service-role secret.
- Existing voice preview still requires confirmation before persistence.

## 11. UNKNOWN / requires additional platform evidence

- Exact Supabase Storage bucket policies.
- Production Auth provider configuration beyond what is visible through the connected project.
- Real-device performance measurements on the user's Android handset.
- Actual OEM technical source corpus for each vehicle model.
- Any future AI provider/tool integration not currently present in repository source.

No unsupported assumptions were used for these items.
