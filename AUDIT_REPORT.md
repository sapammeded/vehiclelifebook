# Vehicle Lifebook — Production Audit & Upgrade Report

Audit date: 2026-09-29  
Repository: `sapammeded/vehiclelifebook`  
Scope: frontend, GitHub Pages pipeline, Supabase production schema/RLS/RPCs, Storage, OEM intelligence, activity/media lifecycle.

## Executive result

The application is a working mobile-first single-page Vehicle Lifebook with Supabase Auth, vehicle/event history, media evidence, license/entitlement controls and an OEM evidence layer.

The audit found that the core safety/security model is already substantially hardened, but several production gaps remained. This audit pass fixed the storage-accounting weakness and improved the dashboard's storage visibility without rewriting the application.

## Verified architecture

- `index.html` remains the main UI/application shell.
- `js/automotive-core.js` contains the automotive domain core.
- `js/global-automotive-intelligence.js` contains the vehicle-agnostic OEM/evidence mission layer.
- Supabase owns Auth, RLS, vehicle/event/detail/media data, entitlement/license logic, OEM evidence and the storage metadata model.
- GitHub Pages validates JavaScript before deployment and does not deploy pull-request builds.

## Findings and status

### P0 — Frontend parse failure
**Status: FIXED**

The previous nested-template-literal issue was corrected. The repository contains a JavaScript validation gate that parses every inline and local JavaScript file before Pages deployment.

### P1 — Entitlement limits only enforced in frontend
**Status: FIXED**

Vehicle and event limits are enforced server-side through Supabase. The effective entitlement fails closed to DEMO when a PRO license is expired/revoked/invalid.

### P1 — Cross-user data access
**Status: FIXED / VERIFIED**

RLS policies constrain vehicles, events, media and typed event-detail tables to the authenticated owner/event creator. Event creation also verifies vehicle ownership server-side.

### P1 — Storage quota trusted client-supplied file size
**Status: FIXED IN THIS AUDIT**

The previous media quota trigger summed `vehicle_media.file_size`, which was supplied by the client. That value was not an authoritative measurement of the actual Storage object.

New migration:
`20260929184000_media_quota_authoritative_storage_v2.sql`

The quota guard now:
1. requires an authenticated owner;
2. verifies the Storage object exists in `vehicle-evidence`;
3. verifies the object owner;
4. reads the authoritative Storage `metadata->>'size'`;
5. overwrites `vehicle_media.file_size` with the actual size;
6. counts the user's actual Storage objects toward quota, including orphaned objects;
7. applies the same quota to DEMO/PRO/OWNER;
8. locks the user's profile row during the quota decision.

An index on `vehicle_media(uploaded_by)` was also added.

### P2 — Storage visibility
**Status: IMPROVED IN THIS AUDIT**

The dashboard now shows:
- used storage;
- quota;
- remaining storage;
- percentage used;
- warning state at 80% and 90%.

The UI wording correctly treats photo count as unlimited per activity only within the account's storage quota.

### P2 — Activity lifecycle
**Status: IMPLEMENTED**

Existing activities can be:
- edited;
- deleted;
- searched;
- assigned multiple photos;
- have individual photos deleted;
- receive additional photos later.

Deleting an activity removes its Storage objects first and then deletes the event so database history and Storage metadata do not intentionally diverge.

### P2 — Typed activity detail forms
**Status: PARTIAL / NEXT**

The database already supports dedicated detail tables for fuel, service/items, damage, part, inspection and expense. The current basic activity UI persists the core timeline fields and the server RPC supports structured detail payloads, but the current UI does not yet expose every typed detail field for full create/edit workflows.

This is the next major UX/data-quality upgrade.

### P2 — Automotive intelligence
**Status: PARTIAL / ACTIVE FOUNDATION**

The repository has:
- vehicle-agnostic mission classification;
- OEM-first evidence rules;
- explicit FACT/VERIFIED/CORROBORATED/CANDIDATE/UNKNOWN/CONFLICT states in the prompt contract;
- OEM part applicability/interchange query support;
- deterministic compatibility gates;
- Supabase evidence/source/measurement/calculation/validation tables.

The AI layer is still an evidence/reasoning orchestration foundation, not a fully autonomous OEM knowledge corpus for every vehicle on the market. Unknown technical data must remain UNKNOWN until sourced.

### P2 — Frontend monolith
**Status: OPEN**

The app is still heavily concentrated in `index.html`. Incremental extraction into modules is recommended, but a full rewrite should not be performed because the current application is functional.

### P2 — Heavy initial dependencies
**Status: OPEN**

XLSX, PDF, DOCX and AutoTable libraries are loaded up front. Lazy loading should be introduced when the app grows further to improve low-end Android startup performance.

### P2 — Storage orphan cleanup
**Status: OPEN**

The quota now counts orphaned Storage objects, which prevents quota bypass. A future owner/admin maintenance workflow should identify and safely remove orphaned objects through the Storage API.

### Security Advisor warnings
**Status: REVIEWED**

Supabase reports four SECURITY DEFINER functions callable by authenticated users:
- `activate_license`
- `ensure_vehicle_profile`
- `get_my_entitlement`
- `owner_grant_license`

These are intentional RPC entry points. `owner_grant_license` checks `vehicle_profiles.plan='owner'` before issuing a license. They should continue to be reviewed whenever their implementation changes.

Supabase also reports leaked-password protection disabled. This is an Auth platform configuration item, not a frontend secret/code defect.

## Production acceptance checklist

- [x] RLS enabled on application tables.
- [x] Frontend contains no service-role key.
- [x] Server-side vehicle/event entitlement limits.
- [x] Case-insensitive owner plate uniqueness.
- [x] Activity edit/delete.
- [x] Multi-photo activity evidence.
- [x] Individual photo deletion/addition.
- [x] Storage quota enforcement.
- [x] Storage quota now based on actual Storage object size.
- [x] Dashboard storage usage visibility.
- [x] GitHub Pages JavaScript syntax gate.
- [x] Pull-request deployment is blocked.
- [ ] Full typed detail create/edit UX.
- [ ] Automated browser/device integration tests.
- [ ] Lazy loading of heavy export libraries.
- [ ] Storage orphan maintenance workflow.
- [ ] Full OEM source corpus coverage by make/model/market.

## Next engineering order

1. Complete typed activity detail create/edit.
2. Add deterministic calculation records and validation UI.
3. Connect OEM retrieval results directly to saved evidence records.
4. Add structured vehicle configuration/component/modification UI.
5. Add diagnostic case → measurement → test → validation workflow.
6. Add automated browser smoke tests.
7. Modularize the frontend incrementally.
8. Add production observability and storage maintenance.

## Important limitation

A GitHub source audit can verify repository code and connected Supabase schema/RPC configuration. It cannot prove real-device Android behavior, every OEM specification, or a live Pages deployment unless the corresponding runtime/test evidence is observed.
