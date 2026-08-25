# GTM AI Task Follow Up Tool

Naseef Al-Mustafa - GTM Tools Portfolio Local prototype

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

* `.env.example`
* `token.json`
* `node\_modules`
* `package-lock.json`


* Removed the extra visual gap between the task title and task note.
* Removed the extra visual gap between company name and application area.
* Kept table width, pagination, vertical scroll and blocked workflow unchanged.

