#!/usr/bin/env node
// One-time import of the ClickUp "Feedback Responses" form into the Hub.
//
// Runs against the admin database directly with node:sqlite rather than through
// the app, so it works inside the deployed container where the bundle is not
// importable. The ClickUp coupling lives here and nowhere in the product.
//
//   node scripts/import-clickup-feedback.mjs --db <path> [--token <tok>] \
//     [--tasks <cached.json>] [--attachments <dir>] [--dry-run]
//
// Idempotent: rows are keyed by their ClickUp task id, so a second run updates
// what it already imported instead of filing duplicates.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const LIST_ID = "901308357623"; // Feedback space → Form folder → Feedback Responses

// Custom-field ids from the live form. Fields ClickUp defines but nobody ever
// filled in (the duplicate "Feedback Source" checkbox, "Appointment Address",
// the "Your Name" user picker) are deliberately absent.
const FIELD = {
  body: "f0c4546f-7bce-47d4-a31d-d8a1ec394555",
  source: "e0012da9-e5b3-41a3-b9a6-2e5e1f9746ff",
  categories: "adc4a8b5-2d26-4be6-abdf-0f2b814f12c0",
  submittedBy: "350120cc-acb6-4380-b419-ffffaa1486fd",
  appointmentLink: "25b38127-fb02-407d-8d5b-ade9282ee030",
  listingAddress: "e0ae3154-ecf6-46c2-b8be-b89526f41848",
  selectedServices: "4f89b44b-9612-476a-802b-e55d03f3d186",
  requestedAt: "f8e79f09-d432-4e98-b7ad-5858cdc79b76",
  firstAvailableAt: "b3e11ecc-cf17-4ed1-9f2d-73827d84c33d",
  attachments: "6798ea21-c2d1-43a0-84da-36d21ddba814",
};

const STATUS_BY_CLICKUP = new Map([
  ["to review", "to_review"],
  ["photographers", "photographers"],
  ["appointment availability", "appointment_availability"],
  ["billing", "billing"],
  ["complete", "complete"],
]);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

async function fetchTasks(token) {
  const out = [];
  for (let page = 0; page < 100; page++) {
    const url =
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task` +
      `?archived=false&include_closed=true&subtasks=true&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
      throw new Error(`ClickUp ${res.status}: ${await res.text()}`);
    }
    const body = await res.json();
    const tasks = body.tasks ?? [];
    out.push(...tasks);
    if (body.last_page || tasks.length === 0) {
      break;
    }
  }
  return out;
}

function field(task, id) {
  return (task.custom_fields ?? []).find((f) => f.id === id) ?? null;
}

/** Label ids → their text. Used by both the multi-select and dropdown fields. */
function labels(task, id) {
  const f = field(task, id);
  if (!f || !Array.isArray(f.value) || f.value.length === 0) {
    return [];
  }
  const opts = new Map((f.type_config?.options ?? []).map((o) => [o.id, o.label ?? o.name]));
  return f.value.map((v) => opts.get(v) ?? String(v)).filter(Boolean);
}

/**
 * ClickUp reports a dropdown's value as either the option id or its
 * orderindex depending on how the field was written, so match on both.
 */
function dropdown(task, id) {
  const f = field(task, id);
  if (!f || f.value === null || f.value === undefined || f.value === "") {
    return null;
  }
  for (const o of f.type_config?.options ?? []) {
    if (o.id === f.value || o.orderindex === f.value) {
      return o.name ?? null;
    }
  }
  return null;
}

function text(task, id) {
  const f = field(task, id);
  const v = f?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function dateMs(task, id) {
  const f = field(task, id);
  const v = f?.value;
  if (v === null || v === undefined || v === "") {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The location field is an object; only its formatted address is worth keeping. */
function location(task, id) {
  const v = field(task, id)?.value;
  if (!v || typeof v !== "object") {
    return null;
  }
  return typeof v.formatted_address === "string" ? v.formatted_address : null;
}

function attachmentsOf(task) {
  const v = field(task, FIELD.attachments)?.value;
  return Array.isArray(v) ? v : [];
}

async function downloadAttachment(file, dir, token) {
  const ext = file.extension ? `.${file.extension}` : path.extname(file.title ?? "") || "";
  const stored = `${crypto.randomUUID()}${ext}`;
  // The attachment host serves these directly; the API token is sent anyway so
  // a workspace that tightens access later still imports.
  const res = await fetch(file.url, { headers: { Authorization: token } });
  if (!res.ok) {
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(dir, stored), buf);
  return { stored, bytes: buf.length };
}

async function main() {
  const dbPath = arg("db");
  if (!dbPath) {
    throw new Error("--db <path to admin.db> is required");
  }
  const dryRun = has("dry-run");
  const token = arg("token", process.env.CLICKUP_API_TOKEN ?? "");
  const cached = arg("tasks");
  const attachmentsDir = arg("attachments");

  const tasks = cached
    ? JSON.parse(fs.readFileSync(cached, "utf8"))
    : await fetchTasks(
        token ||
          (() => {
            throw new Error("--token or CLICKUP_API_TOKEN required");
          })(),
      );

  // Subtasks are follow-up work someone added under a submission, not form
  // entries of their own.
  const submissions = tasks.filter((t) => !t.parent);
  console.log(`ClickUp tasks: ${tasks.length} (${submissions.length} form submissions)`);

  if (attachmentsDir && !dryRun) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  const existing = new Map(
    db
      .prepare("SELECT id, clickup_id FROM admin_feedback WHERE clickup_id IS NOT NULL")
      .all()
      .map((r) => [r.clickup_id, r.id]),
  );
  let maxRef = 0;
  for (const r of db.prepare("SELECT reference FROM admin_feedback").all()) {
    const m = /^FB-(\d+)$/.exec(r.reference ?? "");
    if (m) {
      maxRef = Math.max(maxRef, Number(m[1]));
    }
  }

  const stats = { inserted: 0, updated: 0, files: 0, filesFailed: 0, noBody: 0 };

  // Oldest first, so the FB-#### series runs in the order the team submitted.
  submissions.sort((a, b) => Number(a.date_created) - Number(b.date_created));

  for (const t of submissions) {
    const body = text(t, FIELD.body) ?? "";
    if (!body) {
      stats.noBody += 1;
    }
    const row = {
      source: JSON.stringify(labels(t, FIELD.source)),
      categories: JSON.stringify(labels(t, FIELD.categories)),
      body,
      submitted_by: dropdown(t, FIELD.submittedBy),
      submitted_by_name: null,
      appointment_link: text(t, FIELD.appointmentLink),
      listing_address: location(t, FIELD.listingAddress),
      selected_services: JSON.stringify(labels(t, FIELD.selectedServices)),
      requested_at: dateMs(t, FIELD.requestedAt),
      first_available_at: dateMs(t, FIELD.firstAvailableAt),
      status: STATUS_BY_CLICKUP.get((t.status?.status ?? "").toLowerCase()) ?? "to_review",
      created_at: Number(t.date_created),
      updated_at: Number(t.date_updated ?? t.date_created),
    };

    let id = existing.get(t.id);
    if (dryRun) {
      if (id) {
        stats.updated += 1;
      } else {
        stats.inserted += 1;
      }
      stats.files += attachmentsOf(t).length;
      continue;
    }

    if (id) {
      db.prepare(
        `UPDATE admin_feedback SET source=?, categories=?, body=?, submitted_by=?,
           submitted_by_name=?, appointment_link=?, listing_address=?, selected_services=?,
           requested_at=?, first_available_at=?, status=?, created_at=?, updated_at=?
         WHERE id=?`,
      ).run(
        row.source,
        row.categories,
        row.body,
        row.submitted_by,
        row.submitted_by_name,
        row.appointment_link,
        row.listing_address,
        row.selected_services,
        row.requested_at,
        row.first_available_at,
        row.status,
        row.created_at,
        row.updated_at,
        id,
      );
      db.prepare("DELETE FROM admin_feedback_attachments WHERE feedback_id=?").run(id);
      stats.updated += 1;
    } else {
      id = crypto.randomUUID();
      maxRef += 1;
      db.prepare(
        `INSERT INTO admin_feedback (id, reference, source, categories, body, submitted_by,
           submitted_by_name, appointment_link, listing_address, selected_services, requested_at,
           first_available_at, status, clickup_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        `FB-${String(maxRef).padStart(4, "0")}`,
        row.source,
        row.categories,
        row.body,
        row.submitted_by,
        row.submitted_by_name,
        row.appointment_link,
        row.listing_address,
        row.selected_services,
        row.requested_at,
        row.first_available_at,
        row.status,
        t.id,
        row.created_at,
        row.updated_at,
      );
      stats.inserted += 1;
    }

    for (const file of attachmentsOf(t)) {
      let stored = null;
      let bytes = typeof file.size === "number" ? file.size : null;
      if (attachmentsDir) {
        const got = await downloadAttachment(file, attachmentsDir, token);
        if (got) {
          stored = got.stored;
          bytes = got.bytes;
          stats.files += 1;
        } else {
          // Keep the row: the source URL is still a record of what was attached.
          stats.filesFailed += 1;
        }
      }
      db.prepare(
        `INSERT INTO admin_feedback_attachments
           (id, feedback_id, filename, mime_type, byte_size, stored_path, source_url, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).run(
        crypto.randomUUID(),
        id,
        file.title ?? "attachment",
        file.mimetype ?? null,
        bytes,
        stored,
        file.url ?? null,
        Number(file.date ?? t.date_created),
      );
    }
  }

  // Hand the running app a counter past everything imported, or the first
  // form submission after the import would reuse an imported reference.
  if (!dryRun) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS admin_feedback_seq (id INTEGER PRIMARY KEY CHECK(id = 1), next_number INTEGER NOT NULL)",
    );
    db.prepare(
      `INSERT INTO admin_feedback_seq (id, next_number) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET next_number = max(next_number, excluded.next_number)`,
    ).run(maxRef + 1);
    console.log(`next reference will be FB-${String(maxRef + 1).padStart(4, "0")}`);
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}inserted ${stats.inserted}, updated ${stats.updated}, ` +
      `attachments saved ${stats.files}, failed ${stats.filesFailed}, empty bodies ${stats.noBody}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
