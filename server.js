import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const TOKEN_PATH = path.join(__dirname, "token.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function byId(collection, idField, id) {
  return collection.find((item) => item[idField] === id) || null;
}

async function getHydratedTasks() {
  const [tasks, contacts, companies, notionContext] = await Promise.all([
    readJson("tasks.json"),
    readJson("contacts.json"),
    readJson("companies.json"),
    readJson("notionContext.json")
  ]);

  return tasks.map((task) => {
    const contact = byId(contacts, "contact_id", task.contact_id);
    const company = byId(companies, "company_id", task.company_id);
    const notion_context = byId(notionContext, "notion_context_id", task.notion_context_id);

    return {
      ...task,
      contact,
      company,
      notion_context,
      source_status: notion_context ? "Notion page linked" : "No context linked"
    };
  });
}

function isUnclearValue(value) {
  const text = String(value || "").trim().toLowerCase();
  return !text || ["unknown", "unclear", "n/a", "na", "none", "not captured"].includes(text);
}

function hasLowSpecificityMarker(value) {
  const text = String(value || "").toLowerCase();
  return [
    "no specific",
    "specific workflow pain was captured",
    "general brochure",
    "brochure",
    "unknown",
    "unclear",
    "low fit",
    "close out",
    "no current fit"
  ].some((marker) => text.includes(marker));
}

function isGenericConferenceReviewTask(payload) {
  const subject = String(payload?.task_subject || "").toLowerCase();
  const note = String(payload?.task_note || "").toLowerCase();
  return subject.includes("conference contact review")
    || note.includes("create a deal if there is real demo intent")
    || note.includes("close out if there is no current fit");
}

function draftReadiness(payload) {
  const contextNote = payload?.notion_context?.context_note || "";
  const technicalPain = payload?.notion_context?.technical_pain || "";
  const useCase = payload?.contact?.primary_use_case || "";
  const buyerRole = payload?.contact?.buyer_role || "";
  const conferenceLeadStatus = payload?.contact?.conference_lead_status || "";
  const ownerReviewed = payload?.contact?.owner_reviewed || "";
  const reasons = [];

  if (!payload?.contact) reasons.push("No associated contact is available.");
  if (!payload?.contact?.email) reasons.push("No contact email is available.");
  if (isUnclearValue(useCase)) reasons.push("Primary use case is unknown.");
  if (isUnclearValue(buyerRole)) reasons.push("Buyer role is unknown.");
  if (contextNote.trim().length < 25) reasons.push("Context note is missing or too short.");
  if (hasLowSpecificityMarker(contextNote) || hasLowSpecificityMarker(technicalPain)) reasons.push("No specific scientific workflow pain was captured.");
  if (isGenericConferenceReviewTask(payload)) reasons.push("This is a conference contact review task, not a follow-up drafting task.");
  if (String(conferenceLeadStatus).toLowerCase() === "captured" && String(ownerReviewed).toLowerCase() !== "yes") {
    reasons.push("Contact has not been owner reviewed yet.");
  }

  let score = 20;
  if (contextNote.trim().length >= 80 && !hasLowSpecificityMarker(contextNote)) score += 20;
  if (technicalPain && !hasLowSpecificityMarker(technicalPain)) score += 20;
  if (!isUnclearValue(useCase)) score += 20;
  if (!isUnclearValue(buyerRole)) score += 10;
  if (String(ownerReviewed).toLowerCase() === "yes") score += 5;
  if (payload?.deal_id) score += 5;
  if (hasLowSpecificityMarker(contextNote) || hasLowSpecificityMarker(technicalPain)) score -= 50;
  if (isGenericConferenceReviewTask(payload)) score -= 40;
  if (isUnclearValue(useCase)) score -= 15;
  if (isUnclearValue(buyerRole)) score -= 15;

  return {
    score: Math.max(0, Math.min(100, score)),
    blocked: reasons.length > 0,
    reasons
  };
}

function estimateRoutingConfidence(payload) {
  return draftReadiness(payload).score;
}

function normaliseMappedOutput(mapped = {}, payload = {}, routingConfidence = estimateRoutingConfidence(payload)) {
  return {
    ...mapped,
    use_case: mapped.use_case || payload?.contact?.primary_use_case || "Unclear",
    contact_role: mapped.contact_role || payload?.contact?.job_title || mapped.buyer_persona || "Unknown",
    buyer_role: mapped.buyer_role || payload?.contact?.buyer_role || "Unknown",
    // Backwards-compatible alias used by older validation scripts/history entries.
    buyer_persona: mapped.buyer_persona || mapped.contact_role || payload?.contact?.job_title || "Unknown",
    likely_workflow: mapped.likely_workflow || mapped.use_case || payload?.contact?.primary_use_case || "Unclear",
    specific_problem: mapped.specific_problem || payload?.notion_context?.technical_pain || "Missing context",
    terms_to_avoid: mapped.terms_to_avoid || "unlock, transform, seamless, cutting edge, game changing",
    recommended_next_step: mapped.recommended_next_step || payload?.notion_context?.recommended_next_step || "Offer a short workflow comparison.",
    // Routing confidence is a deterministic readiness score owned by the backend.
    // The LLM may map wording, but it must not decide whether a task is draftable.
    routing_confidence: routingConfidence
  };
}

function fallbackForTask(payload) {
  const firstName = payload?.contact?.first_name || payload?.contact?.name?.split(" ").pop() || "there";
  const conference = payload?.contact?.conference_name || "the conference";
  const useCase = payload?.contact?.primary_use_case || "the workflow";
  const technicalPain = payload?.notion_context?.technical_pain || "the current workflow delay";

  return {
    mode: "fallback",
    mapped: normaliseMappedOutput({
      use_case: useCase,
      contact_role: payload?.contact?.job_title || "Unknown",
      buyer_role: payload?.contact?.buyer_role || "Unknown",
      buyer_persona: payload?.contact?.job_title || "Scientific buyer",
      likely_workflow: useCase,
      specific_problem: technicalPain,
      technical_terms_to_use: "workflow, measurement delay",
      missing_context: payload?.notion_context?.context_note ? "" : "Latest context note is missing.",
      recommended_next_step: payload?.notion_context?.recommended_next_step || "Offer a short workflow comparison."
    }, payload),
    draft: `Hi ${firstName},\n\nGood speaking at ${conference}.\n\nYou mentioned ${technicalPain.charAt(0).toLowerCase() + technicalPain.slice(1)} That seems like the right place to look at whether Amperia could help.\n\nI would not want to assume fit without seeing your current workflow, but the ${useCase} use case sounds relevant.\n\nWould it be useful to book 30 minutes next week and compare where the current measurement delay sits?`,
    quality_check: {
      approved: true,
      reason: "Fallback draft is specific, short and avoids unsupported claims.",
      specific_fix: "None",
      rewritten_email: ""
    }
  };
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  const cleaned = text.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (_innerError) {
        return null;
      }
    }
  }
  return null;
}

function buildPrompt(payload, lookup) {
  return `You are helping GTM Follow Up build a controlled AI follow up workflow for a GTM Engineer interview prototype.

Your task has three parts:
1. Map the selected HubSpot task and its associated contact, company and simulated Notion context to a scientific use case.
2. Draft a short follow up email in Kim's voice.
3. Quality check the email against the rules.

Return JSON only. Do not wrap the JSON in markdown.

HubSpot task:
Task ID: ${payload.task_id}
Task subject: ${payload.task_subject}
Task note: ${payload.task_note}
Due date: ${payload.due_date}
Task owner: ${payload.task_owner}

Associated contact:
Name: ${payload.contact?.name}
Email: ${payload.contact?.email}
Job title: ${payload.contact?.job_title}
Conference: ${payload.contact?.conference_name}
Primary use case: ${payload.contact?.primary_use_case}
Buyer role: ${payload.contact?.buyer_role}
Conference lead status: ${payload.contact?.conference_lead_status}

Associated company:
Company: ${payload.company?.company}
Company type: ${payload.company?.company_type}
Region: ${payload.company?.region}
Application area: ${payload.company?.application_area}
Existing relationship: ${payload.company?.existing_relationship}

Simulated Notion context:
Page title: ${payload.notion_context?.page_title}
Source type: ${payload.notion_context?.source_type}
Last updated: ${payload.notion_context?.last_updated}
Context note: ${payload.notion_context?.context_note}
Technical pain: ${payload.notion_context?.technical_pain}
Recommended next step: ${payload.notion_context?.recommended_next_step}

Use case lookup table:
${JSON.stringify(lookup, null, 2)}

Product context:
Amperia is a benchtop platform for rapid biologics quantification.
It can support workflows such as antibody titre measurement, AAV capsid quantification and His tagged protein measurement.
Do not make claims beyond this context.

Email writing rules:
Write in plain, credible language.
Use the language of the buyer.
Reference the specific scientific problem from the task or Notion context.
Use one or two technical terms only where they fit naturally.
Do not sound like marketing copy.
Do not use buzzwords.
Do not use em dashes.
Do not use phrases like at the intersection, unlock, transform, seamless, cutting edge, game changing, supercharge, leverage, ecosystem or delighted.
Do not use a generic opener such as I hope you are well.
Do not use a three part list.
Do not overpraise the company or the person.
Do not say the product can solve the problem unless the context proves it.
Do not invent details about their workflow.
Do not mention AI.
Keep the email under 110 words.
Use short sentences.
End with one clear next step.

Quality check rules:
Check whether the draft sounds generic, uses buzzwords, contains an em dash, uses a generic opener, overclaims, contains a three part list, mentions the specific scientific problem, uses buyer language, is under 110 words, ends with one clear next step, or mentions a benefit not supported by context or approved product language.

Return this exact JSON shape:
{
  "mapped": {
    "use_case": "",
    "contact_role": "",
    "buyer_role": "",
    "buyer_persona": "",
    "likely_workflow": "",
    "specific_problem": "",
    "technical_terms_to_use": "",
    "terms_to_avoid": "",
    "routing_confidence": 0,
    "missing_context": "",
    "recommended_next_step": ""
  },
  "draft": "",
  "quality_check": {
    "approved": true,
    "reason": "",
    "specific_fix": "",
    "rewritten_email": ""
  }
}`;
}

app.get("/api/tasks", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize || "10", 10) || 10));
    const sortDir = String(req.query.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const direction = sortDir === "desc" ? -1 : 1;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const allTasks = await getHydratedTasks();
    const relevantTasks = allTasks
      .filter((task) => {
        const status = String(task.hs_task_status || task.task_status || "").toUpperCase();
        const isOpen = status !== "COMPLETED" && status !== "COMPLETE" && status !== "CLOSED";
        const type = String(task.task_type || "").toLowerCase();
        const isFollowUp = type.includes("follow") || type.includes("email") || type.includes("todo") || type.includes("call");
        const dueTime = new Date(`${task.due_date_iso || "9999-12-31"}T00:00:00`).getTime();
        const dueNow = Number.isFinite(dueTime) ? dueTime <= today : true;
        return isOpen && isFollowUp && dueNow && Boolean(task.contact);
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.due_date_iso || "9999-12-31"}T12:00:00`).getTime();
        const bTime = new Date(`${b.due_date_iso || "9999-12-31"}T12:00:00`).getTime();
        return (aTime - bTime) * direction;
      });

    const total = relevantTasks.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const tasks = relevantTasks.slice(start, start + pageSize);

    res.json({
      tasks,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        sortDir
      },
      sync_filter: "Open or overdue follow-up tasks with an associated contact. No separate drafting trigger field is required."
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/metrics", async (_req, res) => {
  try {
    const metrics = await readJson("metrics.json");
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/config/status", async (_req, res) => {
  const gmailConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  let gmailAuthorized = false;
  try {
    await fs.access(TOKEN_PATH);
    gmailAuthorized = true;
  } catch (_error) {
    gmailAuthorized = false;
  }

  res.json({
    hubspot_mode: "simulated",
    notion_mode: "simulated",
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    openai_model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    gmail_configured: gmailConfigured,
    gmail_authorized: gmailAuthorized,
    gmail_mode: gmailConfigured && gmailAuthorized ? "live" : "simulated",
    gmail_send_enabled: process.env.ALLOW_LIVE_EMAIL_SEND === "true",
    gmail_send_mode: gmailConfigured && gmailAuthorized && process.env.ALLOW_LIVE_EMAIL_SEND === "true" ? "live" : "simulated"
  });
});

app.post("/api/generate-draft", async (req, res) => {
  try {
    const payload = req.body;
    const lookup = await readJson("useCaseLookup.json");

    const readiness = draftReadiness(payload);
    const routingConfidence = readiness.score;
    if (readiness.blocked || routingConfidence < 50) {
      const missingContext = readiness.reasons.length
        ? readiness.reasons.join(" ")
        : "Context is too thin to create a credible scientific follow up.";
      return res.json({
        success: true,
        blocked: true,
        mode: "blocked",
        warning: "Draft blocked because the task is not ready or context is incomplete.",
        mapped: {
          use_case: payload?.contact?.primary_use_case || "Unclear",
          contact_role: payload?.contact?.job_title || "Unknown",
          buyer_role: payload?.contact?.buyer_role || "Unknown",
          buyer_persona: payload?.contact?.job_title || "Unknown",
          likely_workflow: payload?.contact?.primary_use_case || "Unclear",
          specific_problem: payload?.notion_context?.technical_pain || "Missing context",
          technical_terms_to_use: "",
          terms_to_avoid: "unlock, transform, seamless, cutting edge, game changing",
          routing_confidence: routingConfidence,
          missing_context: missingContext,
          recommended_next_step: "Ask owner to add context or close out before drafting."
        },
        draft: "",
        quality_check: {
          approved: false,
          reason: "Blocked to avoid a generic or unsupported follow up draft.",
          specific_fix: "Add a clearer context note, use case and buyer role before generating, or close out the contact if there is no fit.",
          rewritten_email: ""
        }
      });
    }

    if (!openai) {
      const fallback = fallbackForTask(payload);
      return res.json({
        success: true,
        warning: "OPENAI_API_KEY is not configured. Returned fallback demo output.",
        ...fallback
      });
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: buildPrompt(payload, lookup),
      temperature: 0.3
    });

    const outputText = response.output_text || "";
    const parsed = extractJson(outputText);

    if (!parsed || !parsed.draft) {
      const fallback = fallbackForTask(payload);
      return res.json({
        success: true,
        warning: "Live OpenAI response was not valid JSON. Returned fallback demo output.",
        raw_output: outputText,
        ...fallback
      });
    }

    res.json({
      success: true,
      mode: "live_openai",
      ...parsed,
      mapped: normaliseMappedOutput(parsed.mapped || {}, payload, routingConfidence)
    });
  } catch (error) {
    console.error("OpenAI generation failed:", error);
    const fallback = fallbackForTask(req.body);
    res.json({
      success: true,
      warning: `OpenAI generation failed: ${error.message}. Returned fallback demo output.`,
      ...fallback
    });
  }
});

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return null;
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

async function getAuthorisedOAuthClient() {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return null;

  try {
    const token = JSON.parse(await fs.readFile(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  } catch (_error) {
    return null;
  }
}

app.get("/auth/google", (_req, res) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    return res.status(400).send("Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to .env.");
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send"
    ]
  });

  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    return res.status(400).send("Google OAuth is not configured.");
  }

  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send("Gmail authorization complete. You can close this tab and return to the app.");
  } catch (error) {
    res.status(500).send(`Google OAuth failed: ${error.message}`);
  }
});

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHeader(value = "") {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function buildMimeMessage({ to, subject, body }) {
  const lines = [
    `To: ${escapeHeader(to)}`,
    `Subject: ${escapeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body
  ];
  return lines.join("\r\n");
}

app.post("/api/create-gmail-draft", async (req, res) => {
  const { to, subject, body, task_id } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, error: "Recipient, subject and body are required." });
  }

  try {
    const auth = await getAuthorisedOAuthClient();
    if (!auth) {
      return res.json({
        success: true,
        mode: "simulated",
        message: "Gmail OAuth is not configured or authorised. Saved to simulated drafts instead.",
        draft: {
          id: `sim_draft_${Date.now()}`,
          to,
          subject,
          body,
          task_id,
          status: "Simulated draft saved"
        }
      });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const raw = base64UrlEncode(buildMimeMessage({ to, subject, body }));

    const result = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw }
      }
    });

    res.json({
      success: true,
      mode: "live_gmail",
      message: "Gmail draft created. Nothing has been sent.",
      draft: {
        id: result.data.id,
        message_id: result.data.message?.id,
        to,
        subject,
        task_id,
        status: "Gmail draft created"
      }
    });
  } catch (error) {
    console.error("Gmail draft creation failed:", error);
    res.json({
      success: true,
      mode: "simulated",
      message: `Gmail draft creation failed: ${error.message}. Saved to simulated drafts instead.`,
      draft: {
        id: `sim_draft_${Date.now()}`,
        to,
        subject,
        body,
        task_id,
        status: "Simulated draft saved"
      }
    });
  }
});


function isExampleRecipient(to = "") {
  return String(to).split(",").some((address) => address.trim().toLowerCase().endsWith(".example"));
}

app.post("/api/send-email", async (req, res) => {
  const { to, subject, body, task_id } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, error: "Recipient, subject and body are required." });
  }

  try {
    const auth = await getAuthorisedOAuthClient();
    const liveSendEnabled = process.env.ALLOW_LIVE_EMAIL_SEND === "true";

    if (!auth || !liveSendEnabled || isExampleRecipient(to)) {
      const reason = !auth
        ? "Gmail OAuth is not configured or authorised."
        : !liveSendEnabled
          ? "Live sending is disabled. Set ALLOW_LIVE_EMAIL_SEND=true in .env to enable it."
          : "Example recipient domains are protected from live sending.";
      return res.json({
        success: true,
        mode: "simulated",
        message: `${reason} Simulated send recorded instead.`,
        sent: {
          id: `sim_sent_${Date.now()}`,
          to,
          subject,
          task_id,
          status: "Simulated email sent"
        }
      });
    }

    const gmail = google.gmail({ version: "v1", auth });
    const raw = base64UrlEncode(buildMimeMessage({ to, subject, body }));

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw }
    });

    res.json({
      success: true,
      mode: "live_gmail_send",
      message: "Email sent from the app.",
      sent: {
        id: result.data.id,
        thread_id: result.data.threadId,
        to,
        subject,
        task_id,
        status: "Email sent"
      }
    });
  } catch (error) {
    console.error("Gmail send failed:", error);
    res.json({
      success: true,
      mode: "simulated",
      message: `Gmail send failed: ${error.message}. Simulated send recorded instead.`,
      sent: {
        id: `sim_sent_${Date.now()}`,
        to,
        subject,
        task_id,
        status: "Simulated email sent"
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`GTM Follow Up Console running on http://localhost:${PORT}`);
});

