# Validation notes for v0.30

Validated from the v0.29 stable base. This patch only changes the main Tasks table layout.

## Checks run

- `node --check server.js`
- `node --check public/app.js`
- `node qa/validate_v28_routing_logic.mjs`
- `python3 qa/playwright_validate_v30.py`

## v0.30 UI checks

- Confirmed the task queue still renders all 4 seeded tasks.
- Confirmed pagination still shows `Showing 1-4 of 4` with page size 25.
- Confirmed the task queue table container is fixed at 500px high.
- Confirmed there is no horizontal overflow on the task queue table.
- Confirmed the Task column is wider than before.
- Confirmed the Role column is narrower.
- Confirmed the Drafts pill retains right padding and is not pushed against the card edge.
- Confirmed `Ask about expression workflow` remains draftable with stable routing confidence.
- Confirmed `Conference contact review` remains blocked.
- Confirmed blocked tasks keep the draft editor empty and Gmail buttons disabled.

Screenshots:

- `qa/validated_v30_tasks_table.png`
- `qa/validated_v30_task_table_layout.png`

## v0.31 variable alignment validation

Changes were limited to vocabulary/mapping alignment and static metrics configuration:

- Added Task 1 lifecycle/reporting fields to the Setup > Production mapping section.
- Added `lead_source`, `no_deal_follow_up_flag` and `close_out_reason` to seeded contact records so Task 1 fields are represented in the prototype data.
- Added Buyer role to the Input package widget.
- Clarified mapper output label as Contact role / buyer profile while keeping the existing response schema.
- Aligned static Task 3 metrics with the slide plan: conference lead to demo request rate, time to first meaningful follow-up, next action coverage, demo to scientific evaluation rate and stage ageing.

Regression checks run:

```bash
node --check server.js
node --check public/app.js
node qa/validate_v28_routing_logic.mjs
python3 qa/playwright_validate_v31.py
```

Validation confirmed:

- Four seeded tasks still render.
- Page size remains 25.
- Ask about expression workflow remains draftable at 95%.
- Conference contact review remains blocked.
- Draft editor stays empty and Gmail buttons disabled for blocked task.
- Setup mapping shows Task status, Lead source, Conference lead status, No deal follow-up flag and Application area.
- Input package shows Buyer role.

## v0.32 mapper alignment validation

Changes were limited to mapper-output naming and Production mapping vocabulary:

- Split the visible mapper output into Contact role and Buyer role.
- Added a dedicated Setup > Production mapping tab for Mapper output fields.
- Kept `mapped.buyer_persona` as a backwards-compatible alias only.
- Updated server prompt and normalisation so the LLM may return `contact_role` and `buyer_role`, but routing confidence remains backend-owned.

Regression checks run:

```bash
node --check server.js
node --check public/app.js
node qa/validate_v28_routing_logic.mjs
python3 qa/playwright_validate_v32.py
```

Validation confirmed:

- Four seeded tasks still render.
- Page size remains 25.
- Ask about expression workflow remains draftable at 95%.
- Conference contact review remains blocked.
- Draft editor stays empty and Gmail buttons disabled for blocked task.
- Mapper output shows separate Contact role and Buyer role rows.
- Setup > Production mapping shows the Mapper output tab with Contact role, Buyer role, routing confidence and draft readiness status.

## v0.33 mapper alignment and spacing validation

Changes were limited to mapper-output alignment inherited from v0.32 plus task-table row spacing:

- Task title and task note render as adjacent block lines with no extra gap.
- Company name and application area render as adjacent block lines with no extra gap.
- Contact role and Buyer role remain split in the mapper output.
- Setup > Production mapping still shows the Mapper output tab.

Regression checks run:

```bash
node --check server.js
node --check public/app.js
node qa/validate_v28_routing_logic.mjs
python3 qa/playwright_validate_v33.py
```

Validation confirmed:

- Four seeded tasks still render.
- Page size remains 25.
- Task table has no horizontal scroll.
- Ask about expression workflow remains draftable at 95%.
- Conference contact review remains blocked.
- Draft editor stays empty and Gmail buttons disabled for blocked task.
- Mapper output shows separate Contact role and Buyer role rows.
- Production mapping shows Mapper output fields including Contact role, Buyer role, Routing confidence and Draft readiness status.

