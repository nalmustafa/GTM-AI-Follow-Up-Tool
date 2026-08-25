# GTM AI Task Follow Up Tool

Local interview prototype for the GTM Follow Up GTM Engineer Stage 2 task.

## What it demonstrates

* Open and overdue HubSpot-style task queue.
* Server-side task pagination and due-date sorting.
* Simulated HubSpot task, contact, company and deal data.
* Simulated Notion context per task.
* Real OpenAI draft generation when `OPENAI\_API\_KEY` is configured.
* Safe fallback draft generation when OpenAI is not configured.
* Editable email draft review.
* Gmail draft creation and optional gated send flow.
* Simulated HubSpot task update flow with editable task title, status, body, due date and last meaningful follow-up date.
* Optional next follow-up task creation with persistent simulated next-task ID.
* Setup page showing credential status and production field mapping.

## Run locally

```bash
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm start
```

Open:

```text
http://localhost:3000
```

## Live credentials

Create a `.env` file from `.env.example` and add credentials as needed.

Important variables:

```text
OPENAI\_API\_KEY=
OPENAI\_MODEL=gpt-4.1-mini
GOOGLE\_CLIENT\_ID=
GOOGLE\_CLIENT\_SECRET=
GOOGLE\_REDIRECT\_URI=http://localhost:3000/auth/google/callback
ALLOW\_LIVE\_EMAIL\_SEND=false
```

Live email sending stays disabled unless `ALLOW\_LIVE\_EMAIL\_SEND=true` is set.

## Task queue behaviour

The queue no longer requires a separate manual drafting trigger field in HubSpot.

The simulated production filter is:

```text
Open or overdue HubSpot follow-up tasks with an associated contact.
```

The user chooses which task to draft from inside the app by clicking **Generate AI draft**.

## Packaging notes

The zip excludes:

* `.env`
* `token.json`
* `node\_modules`
* `package-lock.json`



### v0.23 notes

The task queue now shows all four bundled sample tasks on the first page while retaining paginated API support for larger HubSpot task queues. The Task column has been widened to make task notes easier to read.



## v0.27 notes

This build was rebuilt from the stable v0.23 package. It fixes the due-today filtering issue, keeps 25 tasks per page, keeps the task queue inside a fixed-height vertical scroll container, and restores the blocked workflow for low-context conference contact review tasks.

The app intentionally blocks draft generation when the task is a generic conference contact review, the primary use case is unknown, the buyer role is unknown, no specific scientific workflow pain was captured, or the contact has not been owner reviewed.



## v0.29 notes

This build keeps v0.27 as the base and fixes routing-confidence instability. Routing confidence is now calculated deterministically by the backend readiness logic and is no longer taken from the LLM response.

That means regenerating the same task can produce slightly different email wording, but the routing confidence should stay the same unless the underlying task, contact, company or context data changes.

Expected seeded-task behaviour:

* `task\_001` Follow up after ESACT: draftable, 100% routing confidence.
* `task\_002` Follow up on clone screening discussion: draftable, 100% routing confidence.
* `task\_003` Ask about expression workflow: draftable, 95% routing confidence.
* `task\_004` Conference contact review: blocked, 0% routing confidence.



## v0.29 update

This version keeps the v0.28 task routing, blocked workflow, pagination, Gmail and HubSpot review logic unchanged.

The only UI change is in the Draft Assistant Input package:

* Structured values are now labelled rather than shown as one combined line.
* The widget now shows both a context summary and the full source context note used for the draft.

## v0.30 update

This version keeps the v0.29 task data, routing confidence, blocked workflow, Gmail controls and HubSpot review/update flow unchanged.

The only changes are scoped task-table layout refinements:

* The task queue table container is taller so it uses more of the available Tasks page space.
* The task table has a fixed vertical scroll area and no horizontal scroll.
* The Task column is wider.
* The Role column is narrower.
* The small task-note text and company subtext now use the same size as the Role column text.
* The Drafts column keeps right padding so the pill is not pressed against the table edge.



## v0.31 alignment note

v0.31 aligns the prototype vocabulary with the Task 1 and Task 3 slide-plan variables. The Setup > Production mapping section now includes the Task 1 lifecycle/reporting fields that connect the HubSpot clean-up, the AI drafting workflow and the funnel metrics:

* `lead\_source`
* `conference\_name`
* `conference\_lead\_status`
* `primary\_use\_case`
* `buyer\_role`
* `owner\_reviewed`
* `no\_deal\_follow\_up\_flag`
* `close\_out\_reason`
* `application\_area`
* `last\_meaningful\_follow\_up\_date`

No drafting, blocking, Gmail or HubSpot review flow logic was intentionally changed in this release.

## v0.32 mapper alignment note

v0.32 keeps HubSpot as the source of truth for structured commercial fields and separates them from app-derived mapper outputs:

* `contact.job\_title` is displayed as Contact role and mapped to `mapped.contact\_role`.
* `contact.buyer\_role` is displayed as Buyer role and mapped to `mapped.buyer\_role`.
* `mapped.buyer\_persona` remains only as a backwards-compatible alias for older draft history entries.
* Setup > Production mapping now includes a dedicated Mapper output tab showing which fields are HubSpot-sourced and which are app-derived readiness/drafting outputs.

No task sync, routing-confidence, blocked workflow, Gmail or HubSpot review flow logic was intentionally changed.

## v0.33 mapper and task-table spacing note

v0.33 is based on v0.32 and keeps the production mapper alignment intact:

* Contact role is shown separately from Buyer role.
* Contact role is copied from `contact.job\_title` / `mapped.contact\_role`.
* Buyer role is copied from `contact.buyer\_role` / `mapped.buyer\_role`.
* Setup > Production mapping keeps the dedicated Mapper output tab.

The only layout refinement in this release is in the task queue:

* Removed the extra visual gap between the task title and task note.
* Removed the extra visual gap between company name and application area.
* Kept table width, pagination, vertical scroll and blocked workflow unchanged.

