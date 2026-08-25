const state = {
  tasks: [],
  selectedTask: null,
  histories: {},
  currentDraftIdByTask: {},
  config: null,
  metrics: null,
  dueSortDirection: "asc",
  taskPage: 1,
  taskPageSize: 25,
  taskTotal: 0,
  taskTotalPages: 1
};

const DATA_MAPPING_TABS = [
  {
    id: "taskInput",
    label: "Task inputs",
    rows: [
      ["Task", "Task ID", "task_id", "HubSpot task object ID", "Used to select and update the original follow-up task."],
      ["Task", "Task subject", "task_subject", "hs_task_subject", "Readable task title shown in the queue and note preview."],
      ["Task", "Task note", "task_note", "hs_task_body", "Source task context used by the draft assistant."],
      ["Task", "Due date", "due_date_iso", "hs_timestamp", "Used for the due-date sort and overdue display."],
      ["Task", "Task owner", "task_owner", "hubspot_owner_id", "Used to assign the original and next follow-up tasks."],
      ["Task", "Task status", "task_status", "hs_task_status", "Used by the task sync filter and HubSpot update flow."],
      ["Task", "Task type", "task_type", "HubSpot task type or queue category", "Used to limit the queue to follow-up, email, call or TODO actions."],
      ["Task", "Associated deal", "deal_id", "Associated deal ID", "Used to identify follow-ups without deals and mixed-state leads."]
    ]
  },
  {
    id: "contactCompany",
    label: "Contact and company",
    rows: [
      ["Contact", "Name", "contact.name", "firstname and lastname", "Personalises the draft and CRM note."],
      ["Contact", "Email", "contact.email", "email", "Recipient for Gmail draft creation or app send."],
      ["Contact", "Job title", "contact.job_title", "jobtitle", "Shown as Contact role in the input package and used for buyer-language context."],
      ["Contact", "Lead source", "contact.lead_source", "lead_source", "Used to identify conference leads for Task 1 workflow and Task 3 reporting."],
      ["Contact", "Conference name", "contact.conference_name", "conference_name", "Source/event context and conference reporting."],
      ["Contact", "Conference lead status", "contact.conference_lead_status", "conference_lead_status", "Lifecycle state for Captured, Qualified for Review, Follow Up Open and Demo Requested."],
      ["Contact", "Primary use case", "contact.primary_use_case", "primary_use_case", "Use-case routing and reporting field."],
      ["Contact", "Buyer role", "contact.buyer_role", "buyer_role", "Qualification category such as Technical evaluator, User or Unknown."],
      ["Contact", "Owner reviewed", "contact.owner_reviewed", "owner_reviewed", "Used to decide whether a conference contact is ready for follow-up or needs review."],
      ["Contact", "No deal follow-up flag", "contact.no_deal_follow_up_flag", "no_deal_follow_up_flag", "Flags open follow-up tasks with no associated deal."],
      ["Contact", "Close out reason", "contact.close_out_reason", "close_out_reason", "Required when a conference contact is closed as Not a Fit."],
      ["Company", "Company name", "company.company", "Associated company name", "Displayed in the queue and written into the note preview."],
      ["Company", "Application area", "company.application_area", "application_area", "Used for market signal and Task 3 reporting."]
    ]
  },
  {
    id: "context",
    label: "Context source",
    rows: [
      ["Context", "Context note", "notion_context.context_note", "Notion page, HubSpot note or logged email", "Main source for the specific problem."],
      ["Context", "Technical pain", "notion_context.technical_pain", "Structured note field or extracted summary", "Used by the mapper and email writer."],
      ["Context", "Recommended next step", "notion_context.recommended_next_step", "Structured note field or owner note", "Suggested call to action for the follow-up draft."],
      ["Context", "Source page title", "notion_context.page_title", "Notion title, HubSpot note title or logged email subject", "Human-readable traceability for the CRM note."]
    ]
  },
  {
    id: "mapperOutput",
    label: "Mapper output",
    rows: [
      ["Mapper", "Use case", "mapped.use_case", "App-derived from contact.primary_use_case and context", "Normalised scientific use case used to select the draft angle."],
      ["Mapper", "Contact role", "mapped.contact_role", "Pulled from contact.job_title", "Job title from HubSpot. The app should not invent this field."],
      ["Mapper", "Buyer role", "mapped.buyer_role", "Pulled from contact.buyer_role", "Normalised HubSpot buyer-role property such as Technical evaluator, User or Unknown."],
      ["Mapper", "Likely workflow", "mapped.likely_workflow", "App-derived from use case and context note", "Readable workflow description used by the draft writer."],
      ["Mapper", "Specific problem", "mapped.specific_problem", "App-derived from notion_context.technical_pain", "Scientific workflow pain that must be referenced in the draft."],
      ["Mapper", "Technical terms to use", "mapped.technical_terms_to_use", "App-derived from use-case lookup and context", "Small controlled vocabulary for the draft."],
      ["Mapper", "Terms to avoid", "mapped.terms_to_avoid", "App guardrail", "Blocked words or phrases that should not appear in the email."],
      ["Mapper", "Missing context", "mapped.missing_context", "App readiness check", "Explains why a weak task is blocked before drafting."],
      ["Mapper", "Recommended next step", "mapped.recommended_next_step", "App-derived from context and owner note", "Suggested CTA used by the draft and HubSpot review step."],
      ["Mapper", "Routing confidence", "mapped.routing_confidence", "Deterministic backend readiness score", "Calculated by the app. The LLM cannot set or change this value."],
      ["Mapper", "Draft readiness status", "mapped.draft_readiness_status", "Deterministic backend readiness check", "Draftable or blocked. Used to enable or disable draft, Gmail and HubSpot actions."]
    ]
  },
  {
    id: "writeback",
    label: "HubSpot",
    rows: [
      ["Task", "Task title", "crmRecommendation.task_title", "hs_task_subject", "Existing task title pulled into the review form and editable before update."],
      ["Task", "Updated HubSpot task status", "crmRecommendation.task_status", "hs_task_status", "Use NOT_STARTED while only drafted. Use COMPLETED after the follow-up is sent."],
      ["Task", "Task body", "crmRecommendation.task_body", "hs_task_body", "Existing task body with a dated owner comment appended to the end."],
      ["Task", "Due date", "crmRecommendation.due_date", "hs_timestamp", "Existing task due date pulled into the review form and editable before update."],
      ["Contact", "Last meaningful follow-up date", "crmRecommendation.last_meaningful_follow_up_date", "last_meaningful_follow_up_date", "Custom contact date property. Only update after a prospect-facing follow-up is sent, a call is completed, or a meeting happens."],
      ["Note", "Contact timeline note", "crmRecommendation.contact_note", "HubSpot note object body", "Stores the reviewed draft, source task, source context and delivery outcome."],
      ["Security", "Live email send gate", "config.gmail_send_enabled", "ALLOW_LIVE_EMAIL_SEND", "Backend .env safety switch. If false, the app records a simulated send instead of sending live email."],
      ["Task", "Next follow-up task ID", "crmRecommendation.next_task_id", "HubSpot task object ID", "Generated and stored when a next follow-up task is created. Later edits update the same task instead of creating duplicates."],
      ["Task", "Next follow-up task title", "crmRecommendation.next_task_title", "hs_task_subject", "Only shown and written if Create next follow-up task is Yes."],
      ["Task", "Next follow-up task body", "crmRecommendation.next_task_body", "hs_task_body", "Optional. Only written if Create next follow-up task is Yes and the user enters text."],
      ["Task", "Next follow-up task due date", "crmRecommendation.next_task_due_date", "hs_timestamp", "Only shown and written if Create next follow-up task is Yes."],
      ["Task", "Next follow-up task owner", "crmRecommendation.next_task_owner", "hubspot_owner_id", "Only shown and written if Create next follow-up task is Yes."],
      ["Task", "Next follow-up task lifecycle", "crmRecommendation.next_task_lifecycle", "Simulated task action", "Shows whether the next follow-up task was created, updated, kept, or cancelled in demo mode."]
    ]
  }
];

let activeMappingTabId = DATA_MAPPING_TABS[0].id;

const $ = (id) => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pill(text, type = "neutral") {
  return `<span class="pill ${type}">${escapeHtml(text)}</span>`;
}

function normaliseConfidenceValue(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

function confidencePillType(percent) {
  if (percent >= 80) return "good";
  if (percent >= 50) return "warn";
  return "bad";
}

function formatConfidence(value) {
  return `${normaliseConfidenceValue(value)}%`;
}

function badgeClass(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("request") || text.includes("created") || text.includes("approved") || text.includes("linked") || text.includes("submitted")) return "good";
  if (text.includes("need") || text.includes("overdue") || text.includes("fallback") || text.includes("pending") || text.includes("draft")) return "warn";
  if (text.includes("blocked") || text.includes("missing") || text.includes("failed")) return "bad";
  return "neutral";
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ownerFirstName(owner = "Owner") {
  const first = String(owner || "Owner").trim().split(/\s+/)[0];
  return first || "Owner";
}

function formatCrmDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function appendTaskBodyComment(existingBody = "", comment = "") {
  const base = String(existingBody || "").trim();
  const line = String(comment || "").trim();
  if (!line) return base;
  return base ? `${base}

${line}` : line;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return "No date";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function sortedTasksForQueue() {
  return [...state.tasks];
}

function renderTaskPagination() {
  const status = $("taskPageStatus");
  const prev = $("prevPageBtn");
  const next = $("nextPageBtn");
  if (!status || !prev || !next) return;

  const totalPages = Math.max(1, state.taskTotalPages || 1);
  const total = state.taskTotal || state.tasks.length;
  const start = total ? ((state.taskPage - 1) * state.taskPageSize) + 1 : 0;
  const end = total ? Math.min(total, start + state.tasks.length - 1) : 0;
  status.textContent = total
    ? `Page ${state.taskPage} of ${totalPages} Â· Showing ${start}-${end} of ${total}`
    : "No tasks found";
  prev.disabled = state.taskPage <= 1;
  next.disabled = state.taskPage >= totalPages;
}

function renderDueCell(task) {
  const status = task.due_status || task.due_date || "No status";
  const statusClass = status.toLowerCase().includes("overdue") ? "overdue" : "due-today";
  return `<span class="due-date-label">${escapeHtml(formatDateLabel(task.due_date_iso))}</span><span class="due-status-line ${statusClass}">${escapeHtml(status)}</span>`;
}

function addBusinessDays(startDate, days) {
  const date = new Date(startDate);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.remove("active"));
  $(viewId).classList.add("active");
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add("active");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${url} failed`);
  return data;
}

async function loadConfig() {
  try {
    state.config = await fetchJson("/api/config/status");
    const openaiText = state.config.openai_configured ? "Live" : "Fallback";
    const gmailText = state.config.gmail_mode === "live" ? "Live" : "Simulated";
    const appModeText = state.config.gmail_mode === "live" && state.config.openai_configured ? "Live assisted" : "Demo safe";

    setConnectionText("hubspotStatus", "Simulated", "simulated");
    setConnectionText("notionStatus", "Simulated", "simulated");
    setConnectionText("openaiStatus", openaiText, state.config.openai_configured ? "live" : "missing");
    setConnectionText("gmailStatus", gmailText, state.config.gmail_mode === "live" ? "live" : "simulated");
    setConnectionText("appMode", appModeText, appModeText === "Live assisted" ? "live" : "simulated");

    renderSetupConfig();
    updateHubspotButtonLabel();
    updateGmailSendButtonLabel();
  } catch (_error) {
    setConnectionText("hubspotStatus", "Unknown", "missing");
    setConnectionText("notionStatus", "Unknown", "missing");
    setConnectionText("openaiStatus", "Unknown", "missing");
    setConnectionText("gmailStatus", "Unknown", "missing");
    setConnectionText("appMode", "Offline", "missing");
    renderSetupConfig();
    updateHubspotButtonLabel();
    updateGmailSendButtonLabel();
  }
}

function setConnectionText(id, text, stateName = "simulated") {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.classList.remove("is-live", "is-simulated", "is-missing");
  element.classList.add(`is-${stateName}`);
}

function setConnectionCard(id, stateName = "simulated") {
  const card = $(id);
  if (!card) return;
  card.classList.remove("is-live", "is-simulated", "is-missing");
  card.classList.add(`is-${stateName}`);
}

function hubspotIsLive() {
  return state.config?.hubspot_mode === "live";
}

function hubspotUpdateButtonLabel() {
  return hubspotIsLive() ? "Save update to HubSpot" : "Save simulated HubSpot update";
}

function hubspotSavedStatusLabel(mode = hubspotIsLive() ? "live" : "simulated") {
  return mode === "live" ? "HubSpot update saved" : "Simulated HubSpot update saved";
}

function hubspotSavedMessage(entry) {
  const savedMode = entry?.crmSubmittedMode || (hubspotIsLive() ? "live" : "simulated");
  if (savedMode === "live") {
    return `Saved to HubSpot at ${escapeHtml(entry.crmSubmittedAt)}.`;
  }
  return `Saved in demo mode at ${escapeHtml(entry.crmSubmittedAt)}. No live HubSpot record was changed.`;
}

function updateHubspotButtonLabel() {
  const button = $("submitHubspotBtn");
  if (button) button.textContent = hubspotUpdateButtonLabel();
}

function gmailSendIsLive() {
  return state.config?.gmail_send_mode === "live";
}

function gmailSendButtonLabel() {
  return "Send Email to Contact";
}

function updateGmailSendButtonLabel() {
  const button = $("sendEmailBtn");
  if (button) button.textContent = gmailSendButtonLabel();
}

function renderCredentialRows(config = state.config || {}) {
  const rows = [
    ["OpenAI", "OPENAI_API_KEY", config.openai_configured ? "Configured" : "Not configured", config.openai_configured ? "good" : "bad"],
    ["OpenAI", "OPENAI_MODEL", config.openai_model || "gpt-4.1-mini", "neutral"],
    ["Gmail", "GOOGLE_CLIENT_ID", config.gmail_configured ? "Configured" : "Not configured", config.gmail_configured ? "good" : "bad"],
    ["Gmail", "GOOGLE_CLIENT_SECRET", config.gmail_configured ? "Configured" : "Not configured", config.gmail_configured ? "good" : "bad"],
    ["Gmail", "GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback", "neutral"],
    ["Gmail", "token.json", config.gmail_authorized ? "Authorised" : "Not authorised", config.gmail_authorized ? "good" : "warn"],
    ["Gmail", "ALLOW_LIVE_EMAIL_SEND", config.gmail_send_enabled ? "Enabled" : "Disabled", config.gmail_send_enabled ? "good" : "warn"]
  ];
  const target = $("credentialRows");
  if (!target) return;
  target.innerHTML = rows.map(([connection, variable, status, type]) => `
    <tr>
      <td><strong>${escapeHtml(connection)}</strong></td>
      <td><code>${escapeHtml(variable)}</code></td>
      <td>${pill(status, type)}</td>
    </tr>`).join("");
}

function renderMappingRows() {
  const tabsTarget = $("mappingTabs");
  const rowsTarget = $("mappingRows");
  if (!tabsTarget || !rowsTarget) return;

  const activeTab = DATA_MAPPING_TABS.find((tab) => tab.id === activeMappingTabId) || DATA_MAPPING_TABS[0];
  activeMappingTabId = activeTab.id;

  tabsTarget.innerHTML = DATA_MAPPING_TABS.map((tab) => `
    <button type="button" class="mapping-tab ${tab.id === activeMappingTabId ? "active" : ""}" data-mapping-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>
  `).join("");

  rowsTarget.innerHTML = activeTab.rows.map(([object, label, demoField, productionField, purpose], index) => `
    <div class="mapping-row">
      <div class="mapping-label">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(object)}</span>
      </div>
      <div>
        <label for="demoField${activeTab.id}${index}">App field</label>
        <input id="demoField${activeTab.id}${index}" type="text" value="${escapeHtml(demoField)}" />
      </div>
      <div>
        <label for="prodField${activeTab.id}${index}">Production source</label>
        <input id="prodField${activeTab.id}${index}" type="text" value="${escapeHtml(productionField)}" />
      </div>
      <p class="mapping-purpose">${escapeHtml(purpose || "")}</p>
    </div>`).join("");

  tabsTarget.querySelectorAll("[data-mapping-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMappingTabId = button.dataset.mappingTab;
      renderMappingRows();
    });
  });
}

function renderSetupConfig() {
  const config = state.config || {};
  setConnectionText("setupHubspotStatus", "Simulated task sync", "simulated");
  setConnectionText("setupNotionStatus", "Simulated context", "simulated");
  setConnectionText("setupOpenaiStatus", config.openai_configured ? "Live generation ready" : "Fallback mode", config.openai_configured ? "live" : "missing");
  setConnectionText("setupGmailStatus", config.gmail_mode === "live" ? "Live Gmail drafts ready" : "Simulated drafts", config.gmail_mode === "live" ? "live" : "simulated");
  setConnectionCard("setupOpenaiCard", config.openai_configured ? "live" : "missing");
  setConnectionCard("setupGmailCard", config.gmail_mode === "live" ? "live" : "simulated");
  const openaiMeta = $("setupOpenaiMeta");
  if (openaiMeta) openaiMeta.textContent = config.openai_configured ? `${config.openai_model || "gpt-4.1-mini"} via backend .env` : "Add OPENAI_API_KEY to .env";
  const gmailMeta = $("setupGmailMeta");
  if (gmailMeta) {
    if (config.gmail_authorized && config.gmail_send_enabled) {
      gmailMeta.textContent = "OAuth token found. Gmail draft creation and live sending are enabled.";
    } else if (config.gmail_authorized) {
      gmailMeta.textContent = "OAuth token found. Gmail draft creation can run live.";
    } else if (config.gmail_configured) {
      gmailMeta.textContent = "OAuth credentials found. Connect Gmail to create real drafts.";
    } else {
      gmailMeta.textContent = "Add Google OAuth credentials to .env before connecting Gmail.";
    }
  }
  const gmailSendStatus = $("setupGmailSendStatus");
  const gmailSendMeta = $("setupGmailSendMeta");
  if (gmailSendStatus) {
    gmailSendStatus.textContent = config.gmail_send_enabled ? "Live sending enabled" : "Live sending disabled";
    gmailSendStatus.className = config.gmail_send_enabled ? "status-good" : "status-warn";
  }
  if (gmailSendMeta) {
    gmailSendMeta.innerHTML = config.gmail_send_enabled
      ? "Safety switch is on. Live sends still require Gmail OAuth and user confirmation."
      : "Safety switch is off. Set <code>ALLOW_LIVE_EMAIL_SEND=true</code> in .env to allow live sends.";
  }
  const googleAuthBtn = $("googleAuthBtn");
  if (googleAuthBtn) {
    googleAuthBtn.disabled = !config.gmail_configured;
    googleAuthBtn.textContent = config.gmail_authorized ? "Reconnect Gmail" : "Connect Gmail";
    googleAuthBtn.title = config.gmail_configured ? "Open Google OAuth authorisation" : "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to .env first";
  }
  renderCredentialRows(config);
  renderMappingRows();
}

async function loadTasks(page = state.taskPage) {
  state.taskPage = Math.max(1, Number(page) || 1);
  $("tasksTableBody").innerHTML = `<tr><td colspan="7" class="empty-state">Syncing open and overdue follow-up tasks...</td></tr>`;
  try {
    const params = new URLSearchParams({
      page: String(state.taskPage),
      pageSize: String(state.taskPageSize),
      sortDir: state.dueSortDirection
    });
    const data = await fetchJson(`/api/tasks?${params.toString()}`);
    state.tasks = data.tasks || [];
    state.taskPage = data.pagination?.page || state.taskPage;
    state.taskPageSize = data.pagination?.pageSize || state.taskPageSize;
    state.taskTotal = data.pagination?.total || state.tasks.length;
    state.taskTotalPages = data.pagination?.totalPages || 1;
    renderTasks();
    renderTaskPagination();
  } catch (error) {
    $("tasksTableBody").innerHTML = `<tr><td colspan="7" class="empty-state">Could not load tasks: ${escapeHtml(error.message)}</td></tr>`;
    renderTaskPagination();
  }
}

function taskHistory(taskId) {
  if (!state.histories[taskId]) state.histories[taskId] = [];
  return state.histories[taskId];
}

function currentDraft() {
  if (!state.selectedTask) return null;
  const history = taskHistory(state.selectedTask.task_id);
  const currentId = state.currentDraftIdByTask[state.selectedTask.task_id];
  return history.find((entry) => entry.id === currentId) || history[0] || null;
}

function renderTasks() {
  if (!state.tasks.length) {
    $("tasksTableBody").innerHTML = `<tr><td colspan="7" class="empty-state">No task records found.</td></tr>`;
    return;
  }

  const queueTasks = sortedTasksForQueue();
  $("tasksTableBody").innerHTML = queueTasks.map((task) => {
    const selected = state.selectedTask?.task_id === task.task_id ? "selected" : "";
    const contextStatus = task.source_status || "No context";
    const versions = taskHistory(task.task_id).length;
    const draftStatus = versions ? `${versions} draft${versions === 1 ? "" : "s"}` : "No drafts";
    return `
      <tr class="task-row ${selected}" data-row-task-id="${escapeHtml(task.task_id)}" tabindex="0" aria-label="Open ${escapeHtml(task.task_subject)}">
        <td class="due-cell">${renderDueCell(task)}</td>
        <td class="task-cell"><strong class="primary-line">${escapeHtml(task.task_subject)}</strong><span class="secondary-line muted-state">${escapeHtml(task.task_note)}</span></td>
        <td class="contact-cell"><strong>${escapeHtml(task.contact?.name || "Unknown")}</strong></td>
        <td class="role-cell" title="${escapeHtml(task.contact?.job_title || "Unknown role")}">${escapeHtml(task.contact?.job_title || "Unknown role")}</td>
        <td class="company-cell"><strong class="primary-line">${escapeHtml(task.company?.company || "Unknown")}</strong><span class="secondary-line muted-state">${escapeHtml(task.company?.application_area || "")}</span></td>
        <td class="context-cell"><span class="context-title">${escapeHtml(task.notion_context?.page_title || "No linked page")}</span><span class="context-link-status">${escapeHtml(contextStatus)}</span></td>
        <td class="status-cell">${pill(draftStatus, badgeClass(draftStatus))}</td>
      </tr>`;
  }).join("");

  document.querySelectorAll("[data-row-task-id]").forEach((row) => {
    row.addEventListener("click", () => selectTask(row.dataset.rowTaskId));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTask(row.dataset.rowTaskId);
      }
    });
  });
}

function selectTask(taskId) {
  state.selectedTask = state.tasks.find((task) => task.task_id === taskId) || null;
  renderTasks();
  renderSelectedTask();
  setView("draftView");
}

function renderDefinitionList(containerId, rows) {
  $(containerId).classList.remove("muted-state");
  $(containerId).innerHTML = rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`).join("");
}


function readableGenerationStatus(entry = {}) {
  if (entry.blocked || entry.mode === "blocked") {
    return {
      label: "Generation status",
      value: pill("Blocked to protect quality", "bad"),
      explanation: entry.warning || entry.qualityCheck?.reason || "Draft was not generated because the task context was not strong enough."
    };
  }
  if (entry.mode === "live_openai") {
    return { label: "Generation status", value: pill("Live OpenAI", "good"), explanation: "" };
  }
  if (entry.mode === "failed") {
    return { label: "Generation status", value: pill("Generation failed", "bad"), explanation: entry.warning || "The draft call failed." };
  }
  return { label: "Generation status", value: pill("Fallback demo output", "warn"), explanation: entry.warning || "Used saved demo output because live generation was not available." };
}

function deliveryState(entry = {}) {
  if (entry.emailSent?.status) return "sent";
  if (entry.gmailDraft?.status) return "draft_created";
  return "draft_prepared";
}

function deliveryLabel(entry = {}) {
  const stateName = deliveryState(entry);
  if (stateName === "sent") return entry.emailSent?.status || "Email sent";
  if (stateName === "draft_created") return entry.gmailDraft?.status || "Gmail draft created";
  return "Draft prepared";
}

function deliveryModeLabel(entry = {}) {
  const stateName = deliveryState(entry);
  if (stateName === "sent") {
    return entry.emailSent?.mode === "live_gmail_send" ? "Sent from app" : "Simulated send recorded";
  }
  if (stateName === "draft_created") {
    return entry.gmailDraft?.mode === "live_gmail" ? "Gmail draft created" : "Simulated Gmail draft";
  }
  return "Draft prepared for review";
}

function gmailHistoryStatus(entry = {}) {
  if (entry.gmailDraft?.status) {
    if (entry.gmailDraft.mode === "live_gmail") return "Saved to Gmail Drafts";
    if (entry.gmailDraft.mode === "failed") return "Gmail draft failed";
    return "Simulated draft saved";
  }
  if (entry.blocked || entry.mode === "blocked") return "Draft blocked";
  return "Draft generated in app";
}

function sentHistoryStatus(entry = {}) {
  if (entry.emailSent?.status) {
    if (entry.emailSent.mode === "live_gmail_send") return "Email sent to contact";
    if (entry.emailSent.mode === "failed") return "Email send failed";
    return "Simulated email sent";
  }
  if (entry.blocked || entry.mode === "blocked") return "Not sent";
  return "Not sent yet";
}

function buildHumanReadableContactNote(task, draftEntry = null) {
  const contact = task.contact || {};
  const company = task.company || {};
  const notion = task.notion_context || {};
  const mapped = draftEntry?.mapped || {};
  const generatedAt = draftEntry?.createdAtLabel || formatTime();
  const recipient = draftEntry?.to || contact.email || "Recipient not set";
  const subject = draftEntry?.subject || `Follow up from ${contact.conference_name || "the conference"}`;
  const delivery = deliveryState(draftEntry || {});
  const draftVersion = draftEntry?.version ? `Draft ${draftEntry.version}` : "Draft not generated yet";
  const confidence = mapped.routing_confidence !== undefined && mapped.routing_confidence !== null ? formatConfidence(mapped.routing_confidence) : "Not available";
  const gmailDraftId = draftEntry?.gmailDraft?.id || "Not created";
  const sentId = draftEntry?.emailSent?.id || "Not sent";

  const outcome = delivery === "sent"
    ? `${draftEntry?.emailSent?.status || "Email sent"}. The follow-up can now be marked as complete after review.`
    : delivery === "draft_created"
      ? `${draftEntry?.gmailDraft?.status || "Gmail draft created"}. The task should stay open until the email is actually sent.`
      : "Draft prepared in the app. No Gmail draft has been created and no email has been sent.";

  const recommendation = delivery === "sent"
    ? "Mark the original follow-up task as complete, update Last Meaningful Follow Up Date, and create the next follow-up task if required."
    : "Keep the original follow-up task open. Review the draft, create or send the email when ready, then update the task once the follow-up has actually been sent.";

  return [
    delivery === "sent" ? "Follow-up email sent" : "Reviewed follow-up draft prepared",
    "",
    `Contact: ${contact.name || "Unknown contact"}`,
    `Company: ${company.company || "Unknown company"}`,
    `Recipient: ${recipient}`,
    `Email subject: ${subject}`,
    `Conference: ${contact.conference_name || "Unknown conference"}`,
    "",
    "Source task:",
    task.task_subject || "Unknown task",
    "",
    "Source context:",
    notion.page_title || "Linked context note",
    "",
    "Problem referenced:",
    mapped.specific_problem || notion.technical_pain || "No specific problem captured.",
    "",
    "Delivery outcome:",
    outcome,
    "",
    "CRM recommendation:",
    recommendation,
    "",
    "Prepared at:",
    generatedAt,
    "",
    "System references:",
    `Task ID: ${task.task_id}`,
    `Draft version: ${draftVersion}`,
    `Gmail draft ID: ${gmailDraftId}`,
    `Sent message ID: ${sentId}`,
    `Routing confidence: ${confidence}`
  ].join("\n");
}

function taskBodyAppendLine(task, draftEntry = null) {
  const delivery = deliveryState(draftEntry || {});
  const owner = ownerFirstName(task.task_owner || "Owner");
  const stamp = formatCrmDate();
  const contactName = task.contact?.name || "the contact";
  const problem = draftEntry?.mapped?.specific_problem || task.notion_context?.technical_pain || "the conference follow-up context";

  if (delivery === "sent") {
    return `${stamp}, ${owner}: Follow-up email sent to ${contactName}. Comment appended after review. Context referenced: ${problem}.`;
  }
  if (delivery === "draft_created") {
    return `${stamp}, ${owner}: Gmail draft prepared for ${contactName}. No email was sent. Task remains open until the draft is reviewed and sent.`;
  }
  if (draftEntry?.blocked || draftEntry?.mode === "blocked") {
    return `${stamp}, ${owner}: Draft not generated because the context was not strong enough. Task remains open for owner review.`;
  }
  return `${stamp}, ${owner}: Follow-up draft prepared for ${contactName}. No email was sent. Task remains open until reviewed.`;
}
function nextTaskBodyDefault(_task, _draftEntry = null) {
  return "";
}

function nextTaskRecordForEntry(entry = {}) {
  return entry.nextTaskRecord || null;
}

function nextTaskRecordIsActive(entry = {}) {
  const record = nextTaskRecordForEntry(entry);
  return Boolean(record && record.lifecycle !== "cancelled");
}

function generateNextTaskId(task, entry = {}) {
  const version = entry.version || 1;
  const base = String(task?.task_id || "task").replace(/[^a-zA-Z0-9_]/g, "_");
  return `${base}_next_${version}`;
}

function nextTaskLifecycleLabel(entry = {}, recommendation = {}) {
  if (recommendation.create_next_task !== "Yes") {
    return entry.nextTaskRecord ? "cancelled" : "not_created";
  }
  if (entry.nextTaskRecord?.lifecycle === "active") return "updated";
  if (entry.nextTaskRecord?.lifecycle === "cancelled") return "reopened";
  return "created";
}

function nextTaskLifecycleText(lifecycle = "not_created") {
  const map = {
    created: "Next task created",
    updated: "Existing next task updated",
    reopened: "Next task reopened and updated",
    cancelled: "Existing next task cancelled",
    not_created: "No next task created"
  };
  return map[lifecycle] || lifecycle;
}

function applyNextTaskRecord(task, entry, recommendation) {
  if (!entry || !recommendation) return null;
  const existing = entry.nextTaskRecord || null;
  const wantsNextTask = recommendation.create_next_task === "Yes";

  if (wantsNextTask) {
    const lifecycle = nextTaskLifecycleLabel(entry, recommendation);
    const id = recommendation.next_task_id || existing?.id || generateNextTaskId(task, entry);
    const record = {
      id,
      lifecycle: lifecycle === "created" || lifecycle === "reopened" ? "active" : existing?.lifecycle === "active" ? "active" : "active",
      last_action: lifecycle,
      title: recommendation.next_task_title || "Follow up if no reply",
      body: recommendation.next_task_body || "",
      due_date: recommendation.next_task_due_date || addBusinessDays(new Date(), 3),
      owner: recommendation.next_task_owner || task.task_owner || "Kim",
      source_task_id: task.task_id,
      source_draft_id: entry.id,
      updated_at: new Date().toISOString()
    };
    entry.nextTaskRecord = record;
    recommendation.next_task_id = id;
    recommendation.next_task_lifecycle = lifecycle;
    return record;
  }

  if (existing) {
    existing.lifecycle = "cancelled";
    existing.last_action = "cancelled";
    existing.updated_at = new Date().toISOString();
    entry.nextTaskRecord = existing;
    recommendation.next_task_id = existing.id;
    recommendation.next_task_lifecycle = "cancelled";
    return existing;
  }

  recommendation.next_task_id = "";
  recommendation.next_task_lifecycle = "not_created";
  return null;
}


function defaultCrmRecommendation(task, draftEntry = null) {
  const delivery = deliveryState(draftEntry || {});
  const followUpSent = delivery === "sent";
  const appendedComment = taskBodyAppendLine(task, draftEntry);
  return {
    task_title: task.task_subject || "Follow-up task",
    task_status: followUpSent ? "COMPLETED" : "NOT_STARTED",
    task_body: appendTaskBodyComment(task.task_note || "", appendedComment),
    due_date: task.due_date_iso || todayIso(),
    contact_note: buildHumanReadableContactNote(task, draftEntry),
    last_meaningful_follow_up_date: followUpSent ? todayIso() : "",
    create_next_task: followUpSent ? "Yes" : "No",
    next_task_id: draftEntry?.nextTaskRecord?.id || "",
    next_task_lifecycle: draftEntry?.nextTaskRecord?.last_action || "not_created",
    next_task_title: followUpSent ? "Follow up if no reply" : "",
    next_task_body: "",
    next_task_due_date: followUpSent ? addBusinessDays(new Date(), 3) : "",
    next_task_owner: followUpSent ? (task.task_owner || "Kim") : ""
  };
}

function renderSelectedTask() {
  const task = state.selectedTask;
  if (!task) return;

  renderDefinitionList("taskDetail", [
    ["Task ID", `<code>${escapeHtml(task.task_id)}</code>`],
    ["Subject", escapeHtml(task.task_subject)],
    ["Task note", escapeHtml(task.task_note)],
    ["Due date", `${escapeHtml(formatDateLabel(task.due_date_iso))}<br><span class="muted-state">${escapeHtml(task.due_status || task.due_date)}</span>`],
    ["Owner", escapeHtml(task.task_owner)],
    ["Associated contact", escapeHtml(task.contact?.name || "Unknown")],
    ["Associated company", escapeHtml(task.company?.company || "Unknown")],
    ["Associated deal", task.deal_id ? `<code>${escapeHtml(task.deal_id)}</code>` : pill("No deal", "warn")]
  ]);

  renderDefinitionList("notionDetail", [
    ["Page title", escapeHtml(task.notion_context?.page_title || "No linked page")],
    ["Source type", escapeHtml(task.notion_context?.source_type || "Simulated Notion page")],
    ["Last updated", escapeHtml(task.notion_context?.last_updated || "Unknown")],
    ["Context note", escapeHtml(task.notion_context?.context_note || "No context note")],
    ["Technical pain", escapeHtml(task.notion_context?.technical_pain || "Missing")],
    ["Recommended next step", escapeHtml(task.notion_context?.recommended_next_step || "Missing")]
  ]);

  const contextSummary = task.notion_context?.technical_pain || "No context available";
  const sourceContextNote = task.notion_context?.context_note || "No source context note available.";

  $("inputSummary").classList.remove("muted-state");
  $("inputSummary").innerHTML = `
    <div class="input-package-grid">
      <span>Task</span><strong>${escapeHtml(task.task_subject)}</strong>
      <span>Contact</span><strong>${escapeHtml(task.contact?.name || "Unknown contact")}</strong>
      <span>Company</span><strong>${escapeHtml(task.company?.company || "Unknown company")}</strong>
      <span>Contact role</span><strong>${escapeHtml(task.contact?.job_title || "Unknown role")}</strong>
      <span>Buyer role</span><strong>${escapeHtml(task.contact?.buyer_role || "Unknown buyer role")}</strong>
      <span>Source</span><strong>${escapeHtml(task.contact?.conference_name || "Unknown source")}</strong>
      <span>Primary use case</span><strong>${escapeHtml(task.contact?.primary_use_case || "Unknown use case")}</strong>
    </div>
    <div class="context-block">
      <span class="context-label">Context summary</span>
      <p>${escapeHtml(contextSummary)}</p>
    </div>
    <div class="context-block source-note-block">
      <span class="context-label">Source context note</span>
      <p>${escapeHtml(sourceContextNote)}</p>
    </div>
  `;

  $("generateDraftBtn").disabled = false;
  renderCurrentDraftWorkspace();
}

function renderMapperOutput(mapped = {}, quality = {}, entryOrMode = "") {
  $("mapperOutput").className = "insight-list";
  const entry = typeof entryOrMode === "object" && entryOrMode !== null ? entryOrMode : { mode: entryOrMode, mapped, qualityCheck: quality };
  const confidence = normaliseConfidenceValue(mapped.routing_confidence ?? 0);
  const status = readableGenerationStatus(entry);
  const rows = [
    [status.label, status.value],
    ["Use case", escapeHtml(mapped.use_case || "Unknown")],
    ["Contact role", escapeHtml(mapped.contact_role || mapped.buyer_persona || "Unknown")],
    ["Buyer role", escapeHtml(mapped.buyer_role || "Unknown")],
    ["Likely workflow", escapeHtml(mapped.likely_workflow || mapped.use_case || "Unknown")],
    ["Specific problem", escapeHtml(mapped.specific_problem || "Missing")],
    ["Routing confidence", pill(formatConfidence(mapped.routing_confidence ?? 0), confidencePillType(confidence))],
    ["Next step", escapeHtml(mapped.recommended_next_step || "Missing")]
  ];
  const explanation = status.explanation ? `<div class="mapper-explanation">${escapeHtml(status.explanation)}</div>` : "";
  $("mapperOutput").innerHTML = rows.map(([label, value]) => `<div class="insight-item"><span>${label}</span><span>${value}</span></div>`).join("") + explanation;
}

function resetDraftFieldsForEmptyTask() {
  $("emailTo").value = state.selectedTask?.contact?.email || "";
  $("emailSubject").value = `Follow up from ${state.selectedTask?.contact?.conference_name || "the conference"}`;
  $("draftEditor").value = "";
  $("mapperOutput").className = "insight-list muted-state";
  $("mapperOutput").textContent = "Mapper output will appear after generation.";
  $("createDraftBtn").disabled = true;
  $("sendEmailBtn").disabled = true;
  $("submitHubspotBtn").disabled = true;
  $("crmRecommendationPanel").classList.add("is-empty");
}

function renderCurrentDraftWorkspace() {
  const task = state.selectedTask;
  if (!task) return;

  const entry = currentDraft();
  renderHistoryList();

  if (!entry) {
    resetDraftFieldsForEmptyTask();
    renderCrmRecommendation(null);
    return;
  }

  $("emailTo").value = entry.to || task.contact?.email || "";
  $("emailSubject").value = entry.subject || `Follow up from ${task.contact?.conference_name || "the conference"}`;
  $("draftEditor").value = entry.editedDraft || "";
  renderMapperOutput(entry.mapped, entry.qualityCheck, entry);

  if (entry.blocked) {
    $("createDraftBtn").disabled = true;
    $("sendEmailBtn").disabled = true;
  } else {
    $("createDraftBtn").disabled = false;
    $("sendEmailBtn").disabled = false;
  }

  renderCrmRecommendation(entry);
  updateGmailSendButtonLabel();
}

function renderHistoryList() {
  const task = state.selectedTask;
  if (!task) {
    $("historyList").innerHTML = `<div class="history-empty">Select a task to view draft history.</div>`;
    return;
  }

  const history = taskHistory(task.task_id);
  if (!history.length) {
    $("historyList").innerHTML = `<div class="history-empty">No drafts generated for this task yet.</div>`;
    return;
  }

  const currentId = state.currentDraftIdByTask[task.task_id];
  $("historyList").innerHTML = history.map((entry) => {
    const active = entry.id === currentId ? "active" : "";
    const gmailStatus = gmailHistoryStatus(entry);
    const deliveryStatus = sentHistoryStatus(entry);
    const crmStatus = entry.crmSubmitted ? hubspotSavedStatusLabel(entry.crmSubmittedMode) : "CRM update pending";
    const sourceMode = entry.mode === "live_openai" ? "Live OpenAI" : entry.mode === "blocked" ? "Blocked" : "Fallback";
    return `
      <button class="history-card ${active}" data-history-id="${escapeHtml(entry.id)}">
        <span class="history-card-title">Draft ${entry.version}</span>
        <span class="history-card-meta">${escapeHtml(entry.createdAtLabel)} Â· ${escapeHtml(sourceMode)}</span>
        <span class="history-card-chips">${pill(gmailStatus, badgeClass(gmailStatus))}${pill(deliveryStatus, badgeClass(deliveryStatus))}${pill(crmStatus, badgeClass(crmStatus))}</span>
      </button>`;
  }).join("");

  document.querySelectorAll("[data-history-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentDraftIdByTask[task.task_id] = button.dataset.historyId;
      renderCurrentDraftWorkspace();
    });
  });
}

function isCrmReadOnly(entry = {}) {
  return Boolean(entry.crmSubmitted && !entry.crmEditing);
}

function crmInputDisabledAttr(entry = {}) {
  return isCrmReadOnly(entry) ? "disabled" : "";
}

function applySimulatedTaskUpdate(task, recommendation, entry = null) {
  if (!task || !recommendation) return;
  task.task_subject = recommendation.task_title || task.task_subject;
  task.task_note = recommendation.task_body || task.task_note;
  task.due_date_iso = recommendation.due_date || task.due_date_iso;
  task.hs_task_status = recommendation.task_status || task.hs_task_status || "NOT_STARTED";
  task.last_meaningful_follow_up_date = recommendation.last_meaningful_follow_up_date || task.last_meaningful_follow_up_date || "";
  if (entry) applyNextTaskRecord(task, entry, recommendation);
  if (recommendation.task_status === "COMPLETED") {
    task.task_status = "Completed";
    task.due_status = "Completed";
  } else {
    task.task_status = "Open";
  }
}

function crmSavedSummary(entry, recommendation) {
  if (!entry?.crmSubmitted) return "";
  const modeLabel = entry.crmSubmittedMode === "live" ? "Saved to HubSpot" : "Saved in demo mode";
  const statusLabel = recommendation.task_status === "COMPLETED" ? "Marked complete" : "Kept open";
  const nextTaskLine = recommendation.next_task_id
    ? `${nextTaskLifecycleText(recommendation.next_task_lifecycle)}: ${recommendation.next_task_id}.`
    : nextTaskLifecycleText(recommendation.next_task_lifecycle || "not_created") + ".";
  return `<div class="submitted-note">
    <strong>${escapeHtml(modeLabel)}.</strong> ${escapeHtml(statusLabel)} at ${escapeHtml(entry.crmSubmittedAt)}.
    <br>${escapeHtml(nextTaskLine)}
    ${entry.crmSubmittedMode === "live" ? "" : "<br>No live HubSpot record was changed."}
  </div>`;
}

function renderCrmRecommendation(entry) {
  const task = state.selectedTask;
  if (!task || !entry) {
    $("crmRecommendationPanel").classList.add("is-empty");
    $("crmRecommendationPanel").innerHTML = `<div class="history-empty">Generate a draft to prepare an editable task update recommendation.</div>`;
    return;
  }

  const recommendation = entry.crmRecommendation || defaultCrmRecommendation(task, entry);
  if (entry.nextTaskRecord?.id && !recommendation.next_task_id) {
    recommendation.next_task_id = entry.nextTaskRecord.id;
    recommendation.next_task_lifecycle = entry.nextTaskRecord.last_action || entry.nextTaskRecord.lifecycle || "updated";
  }
  entry.crmRecommendation = recommendation;
  const showNextTaskFields = recommendation.create_next_task === "Yes";
  const taskStatusOptions = [
    ["NOT_STARTED", "Keep task open"],
    ["COMPLETED", "Mark task complete"]
  ];
  const readOnly = isCrmReadOnly(entry);
  const disabled = crmInputDisabledAttr(entry);
  const followUpDisabled = recommendation.task_status === "COMPLETED" && !readOnly ? "" : "disabled";
  const lockedClass = readOnly ? " is-locked" : "";

  $("crmRecommendationPanel").classList.remove("is-empty");
  $("crmRecommendationPanel").innerHTML = `
    ${readOnly ? `<div class="submitted-note"><strong>HubSpot task update saved.</strong> The saved values below are locked to show what was submitted. Use Edit saved update if you need to adjust them.</div>` : ""}
    <div class="form-row compact-form-row${lockedClass}">
      <label for="crmTaskTitle">Task title</label>
      <input id="crmTaskTitle" type="text" value="${escapeHtml(recommendation.task_title)}" ${disabled} />
    </div>
    <div class="form-row compact-form-row${lockedClass}">
      <label for="crmTaskStatus">Updated HubSpot task status</label>
      <select id="crmTaskStatus" ${disabled}>
        ${taskStatusOptions.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === recommendation.task_status ? "selected" : ""}>${escapeHtml(label)} Â· hs_task_status = ${escapeHtml(value)}</option>`).join("")}
      </select>
    </div>
    <div class="form-row compact-form-row${lockedClass}">
      <label for="crmTaskBody">Task body</label>
      <textarea id="crmTaskBody" rows="6" ${disabled}>${escapeHtml(recommendation.task_body)}</textarea>
    </div>
    <div class="form-row compact-form-row two-field-row${lockedClass}">
      <div>
        <label for="crmTaskDueDate">Due date</label>
        <input id="crmTaskDueDate" type="date" value="${escapeHtml(recommendation.due_date)}" ${disabled} />
      </div>
      <div>
        <label for="crmFollowUpDate">Last meaningful follow-up date</label>
        <input id="crmFollowUpDate" type="date" value="${escapeHtml(recommendation.last_meaningful_follow_up_date)}" ${followUpDisabled} />
      </div>
    </div>
    <div class="form-row compact-form-row${lockedClass}">
      <label for="crmContactNote">HubSpot contact note</label>
      <textarea id="crmContactNote" rows="6" ${disabled}>${escapeHtml(recommendation.contact_note)}</textarea>
    </div>
    <div class="form-row compact-form-row${lockedClass}">
      <label for="crmCreateNextTask">Create next follow-up task?</label>
      <select id="crmCreateNextTask" ${disabled}>
        <option value="Yes" ${recommendation.create_next_task === "Yes" ? "selected" : ""}>Yes</option>
        <option value="No" ${recommendation.create_next_task === "No" ? "selected" : ""}>No</option>
      </select>
    </div>
    ${showNextTaskFields ? `
      <div class="next-task-fields${lockedClass}" id="nextTaskFields">
        ${recommendation.next_task_id ? `<div class="next-task-meta">${escapeHtml(nextTaskLifecycleText(recommendation.next_task_lifecycle))}: <code>${escapeHtml(recommendation.next_task_id)}</code></div>` : ""}
        <div class="form-row compact-form-row">
          <label for="crmNextTaskTitle">Next task title</label>
          <input id="crmNextTaskTitle" type="text" value="${escapeHtml(recommendation.next_task_title)}" ${disabled} />
        </div>
        <div class="form-row compact-form-row">
          <label for="crmNextTaskBody">Next task body</label>
          <textarea id="crmNextTaskBody" rows="4" placeholder="Optional: add context for the next follow-up task." ${disabled}>${escapeHtml(recommendation.next_task_body || "")}</textarea>
        </div>
        <div class="form-row compact-form-row two-field-row">
          <div>
            <label for="crmNextTaskDue">Next task due date</label>
            <input id="crmNextTaskDue" type="date" value="${escapeHtml(recommendation.next_task_due_date)}" ${disabled} />
          </div>
          <div>
            <label for="crmNextTaskOwner">Owner</label>
            <input id="crmNextTaskOwner" type="text" value="${escapeHtml(recommendation.next_task_owner)}" ${disabled} />
          </div>
        </div>
      </div>` : ""}
    ${entry.crmSubmitted ? crmSavedSummary(entry, recommendation) : ""}
    ${readOnly ? `<button id="editCrmUpdateBtn" type="button" class="button secondary full-width">Edit saved update</button>` : ""}
  `;
  bindCrmRecommendationInputs();
  updateHubspotButtonLabel();
  const submitButton = $("submitHubspotBtn");
  if (submitButton) {
    submitButton.disabled = readOnly;
    submitButton.textContent = readOnly ? "HubSpot update saved" : hubspotUpdateButtonLabel();
  }
  const editButton = $("editCrmUpdateBtn");
  if (editButton) {
    editButton.addEventListener("click", () => {
      entry.crmEditing = true;
      renderCrmRecommendation(entry);
    });
  }
}

function collectCrmRecommendation() {
  const task = state.selectedTask;
  const entry = currentDraft();
  if (!task || !entry) return null;

  const statusValue = $("crmTaskStatus")?.value || "NOT_STARTED";
  const createNextTask = $("crmCreateNextTask")?.value || "No";
  const existing = entry.crmRecommendation || defaultCrmRecommendation(task, entry);
  const recommendation = {
    task_title: $("crmTaskTitle")?.value || existing.task_title || task.task_subject || "Follow-up task",
    task_status: statusValue,
    task_body: $("crmTaskBody")?.value || existing.task_body || task.task_note || "",
    due_date: $("crmTaskDueDate")?.value || existing.due_date || task.due_date_iso || todayIso(),
    contact_note: $("crmContactNote")?.value || existing.contact_note || "Reviewed follow-up draft saved.",
    last_meaningful_follow_up_date: statusValue === "COMPLETED" ? ($("crmFollowUpDate")?.value || existing.last_meaningful_follow_up_date || todayIso()) : "",
    create_next_task: createNextTask,
    next_task_id: existing.next_task_id || entry.nextTaskRecord?.id || "",
    next_task_lifecycle: existing.next_task_lifecycle || entry.nextTaskRecord?.last_action || "not_created",
    next_task_title: createNextTask === "Yes" ? ($("crmNextTaskTitle")?.value || existing.next_task_title || "Follow up if no reply") : "",
    next_task_body: createNextTask === "Yes" ? ($("crmNextTaskBody")?.value || existing.next_task_body || "") : "",
    next_task_due_date: createNextTask === "Yes" ? ($("crmNextTaskDue")?.value || existing.next_task_due_date || addBusinessDays(new Date(), 3)) : "",
    next_task_owner: createNextTask === "Yes" ? ($("crmNextTaskOwner")?.value || existing.next_task_owner || task.task_owner || "Kim") : ""
  };

  entry.crmRecommendation = recommendation;
  return recommendation;
}

function bindCrmRecommendationInputs() {
  ["crmTaskTitle", "crmTaskStatus", "crmTaskBody", "crmTaskDueDate", "crmContactNote", "crmFollowUpDate", "crmNextTaskTitle", "crmNextTaskBody", "crmNextTaskDue", "crmNextTaskOwner"].forEach((id) => {
    const element = $(id);
    if (element) element.addEventListener("input", collectCrmRecommendation);
  });

  const createNextTaskSelect = $("crmCreateNextTask");
  if (createNextTaskSelect) {
    createNextTaskSelect.addEventListener("change", () => {
      const entry = currentDraft();
      collectCrmRecommendation();
      if (entry) renderCrmRecommendation(entry);
    });
  }

  const statusSelect = $("crmTaskStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      const entry = currentDraft();
      const recommendation = collectCrmRecommendation();
      if (entry && recommendation) {
        const completed = recommendation.task_status === "COMPLETED";
        if (completed && !recommendation.last_meaningful_follow_up_date) {
          recommendation.last_meaningful_follow_up_date = todayIso();
        }
        if (!completed) {
          recommendation.last_meaningful_follow_up_date = "";
          recommendation.create_next_task = "No";
          recommendation.next_task_title = "";
          recommendation.next_task_body = "";
          recommendation.next_task_due_date = "";
          recommendation.next_task_owner = "";
          recommendation.next_task_id = entry.nextTaskRecord?.id || recommendation.next_task_id || "";
          recommendation.next_task_lifecycle = entry.nextTaskRecord ? "cancelled" : "not_created";
        }
        renderCrmRecommendation(entry);
      }
    });
  }
}


async function generateDraft() {
  if (!state.selectedTask) return;

  $("generateDraftBtn").disabled = true;
  $("generateDraftBtn").textContent = "Generating...";

  try {
    const data = await fetchJson("/api/generate-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.selectedTask)
    });

    const task = state.selectedTask;
    const history = taskHistory(task.task_id);
    const isBlocked = Boolean(data.blocked);
    const draftText = isBlocked ? "" : (data.quality_check?.rewritten_email || data.draft || "");
    const entry = {
      id: `${task.task_id}_draft_${Date.now()}`,
      version: history.length + 1,
      taskId: task.task_id,
      createdAt: new Date().toISOString(),
      createdAtLabel: formatTime(),
      mode: data.mode || (isBlocked ? "blocked" : "fallback"),
      warning: data.warning || "",
      blocked: isBlocked,
      mapped: data.mapped || {},
      qualityCheck: data.quality_check || {},
      originalDraft: draftText,
      editedDraft: draftText,
      to: task.contact?.email || "",
      subject: `Follow up from ${task.contact?.conference_name || "the conference"}`,
      gmailDraft: null,
      emailSent: null,
      crmRecommendation: null,
      crmSubmitted: false,
      crmSubmittedAt: "",
      crmSubmittedMode: "",
      crmEditing: true
    };
    entry.crmRecommendation = defaultCrmRecommendation(task, entry);

    history.unshift(entry);
    state.currentDraftIdByTask[task.task_id] = entry.id;
    renderTasks();
    renderCurrentDraftWorkspace();
  } catch (error) {
    const task = state.selectedTask;
    const history = taskHistory(task.task_id);
    const entry = {
      id: `${task.task_id}_draft_${Date.now()}`,
      version: history.length + 1,
      taskId: task.task_id,
      createdAt: new Date().toISOString(),
      createdAtLabel: formatTime(),
      mode: "failed",
      warning: error.message,
      blocked: true,
      mapped: {
        use_case: task.contact?.primary_use_case || "Unknown",
        buyer_persona: task.contact?.job_title || "Unknown",
        specific_problem: task.notion_context?.technical_pain || "Missing",
        routing_confidence: 0,
        recommended_next_step: "Retry generation or add more context."
      },
      qualityCheck: {
        approved: false,
        reason: error.message
      },
      originalDraft: "",
      editedDraft: "",
      to: task.contact?.email || "",
      subject: `Follow up from ${task.contact?.conference_name || "the conference"}`,
      gmailDraft: null,
      emailSent: null,
      crmRecommendation: null,
      crmSubmitted: false,
      crmSubmittedAt: "",
      crmSubmittedMode: "",
      crmEditing: true
    };
    entry.crmRecommendation = defaultCrmRecommendation(task, entry);
    history.unshift(entry);
    state.currentDraftIdByTask[task.task_id] = entry.id;
    renderCurrentDraftWorkspace();
  } finally {
    $("generateDraftBtn").disabled = false;
    $("generateDraftBtn").textContent = "Generate AI draft";
  }
}

function syncCurrentDraftFromEditor() {
  const entry = currentDraft();
  if (!entry) return;
  entry.to = $("emailTo").value.trim();
  entry.subject = $("emailSubject").value.trim();
  entry.editedDraft = $("draftEditor").value.trim();
}

async function createGmailDraft() {
  const task = state.selectedTask;
  const entry = currentDraft();
  if (!task || !entry) return;

  syncCurrentDraftFromEditor();
  const to = entry.to;
  const subject = entry.subject;
  const body = entry.editedDraft;

  if (!to || !subject || !body) {
    entry.gmailDraft = { status: "Draft not created", id: "Missing recipient, subject or body" };
    renderHistoryList();
    return;
  }

  $("createDraftBtn").disabled = true;
  $("createDraftBtn").textContent = "Creating draft...";

  try {
    const data = await fetchJson("/api/create-gmail-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, task_id: task.task_id })
    });

    entry.gmailDraft = {
      mode: data.mode,
      id: data.draft?.id || "unknown",
      status: data.mode === "live_gmail" ? "Saved to Gmail Drafts" : "Simulated draft saved",
      message: data.message || "Draft saved.",
      to,
      subject
    };
    entry.crmRecommendation = defaultCrmRecommendation(task, entry);
    renderCurrentDraftWorkspace();
  } catch (error) {
    entry.gmailDraft = {
      mode: "failed",
      id: "Not created",
      status: "Gmail draft failed",
      message: error.message,
      to,
      subject
    };
    renderCurrentDraftWorkspace();
  } finally {
    $("createDraftBtn").disabled = false;
    $("createDraftBtn").textContent = "Send to my Drafts";
  }
}

async function sendEmailFromApp() {
  const task = state.selectedTask;
  const entry = currentDraft();
  if (!task || !entry) return;

  syncCurrentDraftFromEditor();
  const to = entry.to;
  const subject = entry.subject;
  const body = entry.editedDraft;

  if (!to || !subject || !body) {
    entry.emailSent = { status: "Email not sent", id: "Missing recipient, subject or body" };
    renderCurrentDraftWorkspace();
    return;
  }

  const confirmed = window.confirm(
    gmailSendIsLive()
      ? "Send this email from the app? This is a manual live send. The app will then recommend marking the HubSpot task complete and creating a follow-up task if needed."
      : "Record a simulated send for this task? No real email will be sent. The app will then show the post-send HubSpot task recommendation."
  );
  if (!confirmed) return;

  $("sendEmailBtn").disabled = true;
  $("sendEmailBtn").textContent = gmailSendIsLive() ? "Sending..." : "Recording...";

  try {
    const data = await fetchJson("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, task_id: task.task_id })
    });

    entry.emailSent = {
      mode: data.mode,
      id: data.sent?.id || "unknown",
      status: data.mode === "live_gmail_send" ? "Email sent to contact" : "Simulated email sent",
      message: data.message || "Send action recorded.",
      to,
      subject
    };
    entry.crmRecommendation = defaultCrmRecommendation(task, entry);
    renderCurrentDraftWorkspace();
  } catch (error) {
    entry.emailSent = {
      mode: "failed",
      id: "Not sent",
      status: "Email send failed",
      message: error.message,
      to,
      subject
    };
    entry.crmRecommendation = defaultCrmRecommendation(task, entry);
    renderCurrentDraftWorkspace();
  } finally {
    $("sendEmailBtn").disabled = false;
    updateGmailSendButtonLabel();
  }
}


function submitHubspotUpdatePreview() {
  const entry = currentDraft();
  const task = state.selectedTask;
  if (!entry || !task) return;
  syncCurrentDraftFromEditor();
  const recommendation = collectCrmRecommendation();
  if (!recommendation) return;
  entry.crmRecommendation = recommendation;
  entry.crmSubmitted = true;
  entry.crmEditing = false;
  entry.crmSubmittedAt = formatTime();
  entry.crmSubmittedMode = hubspotIsLive() ? "live" : "simulated";
  applySimulatedTaskUpdate(task, recommendation, entry);
  renderTasks();
  renderSelectedTask();
}

async function loadMetrics() {
  try {
    state.metrics = await fetchJson("/api/metrics");
    renderMetrics();
  } catch (error) {
    $("metricsCards").innerHTML = `<article class="card metric-card"><p>Could not load metrics: ${escapeHtml(error.message)}</p></article>`;
  }
}

function renderMetrics() {
  const metrics = state.metrics?.metrics || state.metrics?.cards || [];
  $("metricsCards").innerHTML = metrics.map((metric) => `
    <article class="card metric-card">
      <p class="eyebrow">${escapeHtml(metric.metric_type || metric.what_it_measures || "Leading indicator")}</p>
      <h4>${escapeHtml(metric.name || metric.metric)}</h4>
      <div class="metric-value">${escapeHtml(metric.sample_value || metric.value || "")}</div>
      <p>${escapeHtml(metric.why_now)}</p>
    </article>
  `).join("");

  const rows = [];
  if (state.metrics?.dashboards) {
    for (const view of state.metrics.dashboards) {
      for (const card of view.cards) {
        rows.push(`<tr><td><strong>${escapeHtml(view.owner)}</strong></td><td>${escapeHtml(card.name)}</td><td>${escapeHtml(card.filter)}</td><td>${escapeHtml(card.purpose)}</td></tr>`);
      }
    }
  } else {
    for (const card of state.metrics?.dashboard_rows || []) {
      rows.push(`<tr><td><strong>${escapeHtml(card.view)}</strong></td><td>${escapeHtml(card.card)}</td><td>${escapeHtml(card.filter)}</td><td>${escapeHtml(card.purpose)}</td></tr>`);
    }
  }
  $("dashboardRows").innerHTML = rows.join("");
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $("syncTasksBtn").addEventListener("click", () => {
    state.taskPage = 1;
    loadTasks(1);
  });
  $("dueSortBtn")?.addEventListener("click", () => {
    state.dueSortDirection = state.dueSortDirection === "asc" ? "desc" : "asc";
    state.taskPage = 1;
    $("dueSortBtn").textContent = state.dueSortDirection === "asc" ? "Due date â†‘" : "Due date â†“";
    loadTasks(1);
  });
  $("prevPageBtn")?.addEventListener("click", () => {
    if (state.taskPage > 1) loadTasks(state.taskPage - 1);
  });
  $("nextPageBtn")?.addEventListener("click", () => {
    if (state.taskPage < state.taskTotalPages) loadTasks(state.taskPage + 1);
  });
  $("demoModeBtn").addEventListener("click", async () => {
    state.selectedTask = null;
    state.histories = {};
    state.currentDraftIdByTask = {};
    state.taskPage = 1;
    await loadTasks(1);
    setView("tasksView");
    resetDraftFieldsForEmptyTask();
    renderHistoryList();
    renderCrmRecommendation(null);
  });
  $("generateDraftBtn").addEventListener("click", generateDraft);
  $("createDraftBtn").addEventListener("click", createGmailDraft);
  $("sendEmailBtn").addEventListener("click", sendEmailFromApp);
  $("submitHubspotBtn").addEventListener("click", submitHubspotUpdatePreview);
  $("googleAuthBtn")?.addEventListener("click", () => {
    window.open("/auth/google", "_blank", "noopener,noreferrer");
  });
  ["emailTo", "emailSubject", "draftEditor"].forEach((id) => {
    $(id).addEventListener("input", () => {
      syncCurrentDraftFromEditor();
      const entry = currentDraft();
      if (entry) renderHistoryList();
    });
  });
}

async function init() {
  bindEvents();
  await loadConfig();
  await loadMetrics();
  await loadTasks(1);
  renderHistoryList();
  renderCrmRecommendation(null);
}

init();

