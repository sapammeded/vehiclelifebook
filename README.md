# Vehicle Lifebook

Mobile-first vehicle intelligence and digital vehicle history app.

## Stack
- Single-file frontend: `index.html`
- Supabase Auth + PostgreSQL + RLS
- Server-side PostgreSQL entitlement enforcement
- Web Speech API for optional voice input
- GitHub Pages

## Production configuration
The production Supabase URL and publishable key are bundled in `index.html`.
The browser must never contain a service-role or other secret key.

## Run
Open the GitHub Pages deployment. Authentication is handled directly by Supabase.
There is no production setup screen.

## Architecture
The current UI is intentionally incremental and mobile-first. Frontend limits are UX guards; PostgreSQL enforces authorization and package limits.

Core domains include vehicles, events, service/fuel/damage/part/inspection/expense details, media, audit history, profiles and licenses.

## Development rules
- Preserve existing vehicle history.
- Use repeatable Supabase migrations for schema changes.
- Keep RLS enabled.
- Do not use an LLM for critical mathematics.
- Technical conclusions must distinguish evidence, inference and unknowns.
- Validate JavaScript syntax before deployment.
