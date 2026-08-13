// Reading the ticket's description back into blocks, so the department email can
// lay it out instead of dumping it.
//
// `composeDescription` in ticket-intake-http.ts writes one string: a heading, an
// indented list of what the client picked (with quantities, line prices and any
// per-choice answers), the money summary, then the client's own words. That
// string is what the ticket stores and what the dashboard shows, and it is
// deliberately readable as plain text — but pasted into an HTML email as one
// pre-wrapped blob it becomes a wall, which is exactly the complaint this
// answers.
//
// So: parse, don't re-model. Structuring at render time means no schema change,
// no migration, and tickets written before this still render — every line an
// older or hand-written description contains is simply an unindented paragraph,
// which is the shape this falls back to. The parse only ever recognizes what our
// own emitter produces; anything it does not recognize passes through as prose
// rather than being coerced into a row.

/** The client's answer to one per-choice follow-up question. */
export type DescriptionAnswer = { label: string; value: string };

export type DescriptionBlock =
  /** The category's follow-up question, standing above the choices. */
  | { kind: "heading"; text: string }
  /** One thing the client picked, with its price and any follow-up answers. */
  | {
      kind: "item";
      label: string;
      price: string | null;
      /** The line cannot start until a quote is accepted. */
      quoteFirst: boolean;
      answers: DescriptionAnswer[];
    }
  /** A money line: "Estimated total: $225". */
  | { kind: "summary"; label: string; value: string | null }
  /** The standing instruction to quote first — a callout, not a total. */
  | { kind: "callout"; text: string }
  /** The client's own words, one paragraph at a time. */
  | { kind: "paragraph"; text: string };

const BULLET = "•";
/** Emitted by composeDescription on a line that must be quoted before starting. */
const QUOTE_FLAG = "[QUOTE FIRST]";

function isIndented(line: string): boolean {
  return /^\s+\S/.test(line);
}

function isItem(line: string): boolean {
  return isIndented(line) && line.trimStart().startsWith(BULLET);
}

/**
 * A follow-up answer sits deeper than the choice it belongs to. Six spaces is
 * what the emitter writes; anything indented past a bullet is treated as one so
 * the two cannot drift apart on whitespace alone.
 */
function isAnswer(line: string): boolean {
  return /^\s{4,}\S/.test(line) && !line.trimStart().startsWith(BULLET);
}

function splitOnce(text: string, separator: string): [string, string | null] {
  const at = text.indexOf(separator);
  if (at === -1) {
    return [text.trim(), null];
  }
  return [text.slice(0, at).trim(), text.slice(at + separator.length).trim() || null];
}

function parseItem(line: string): DescriptionBlock & { kind: "item" } {
  let text = line.trimStart().slice(BULLET.length).trim();
  const quoteFirst = text.includes(QUOTE_FLAG);
  if (quoteFirst) {
    text = text.replace(QUOTE_FLAG, "").trim();
  }
  // "Virtual staging ×3 — $150 ($50 each)" → the choice, then what it costs.
  const [label, price] = splitOnce(text, " — ");
  return { kind: "item", label, price, quoteFirst, answers: [] };
}

/**
 * The money lines and the quote instruction share an indent level, so they are
 * told apart by shape: a total reads "label: value", the instruction is wrapped
 * in the `**` the plain-text body uses to shout.
 */
function parseSummary(line: string): DescriptionBlock {
  const text = line.trim();
  if (text.startsWith("**") && text.endsWith("**")) {
    return { kind: "callout", text: text.replace(/^\*+\s*|\s*\*+$/g, "").trim() };
  }
  const [label, value] = splitOnce(text, ": ");
  return { kind: "summary", label, value };
}

/**
 * Blocks in the order they were written.
 *
 * A heading is only recognized as one when an indented line follows it —
 * otherwise a client who opened their message with a short line would have it
 * promoted to a section title.
 */
export function parseDescriptionBlocks(description: string | null): DescriptionBlock[] {
  const source = description?.replace(/\r\n/g, "\n") ?? "";
  if (!source.trim()) {
    return [];
  }
  const lines = source.split("\n");
  const blocks: DescriptionBlock[] = [];
  const paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join("\n").trim();
    paragraph.length = 0;
    if (text) {
      blocks.push({ kind: "paragraph", text });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (isItem(line)) {
      flushParagraph();
      blocks.push(parseItem(line));
      continue;
    }
    if (isAnswer(line)) {
      const previous = blocks[blocks.length - 1];
      const [label, value] = splitOnce(line.trim(), ": ");
      // An answer with nowhere to attach is still the client's content, so it
      // becomes prose rather than being dropped.
      if (previous?.kind === "item" && value !== null) {
        previous.answers.push({ label, value });
      } else {
        paragraph.push(line.trim());
      }
      continue;
    }
    if (isIndented(line)) {
      flushParagraph();
      blocks.push(parseSummary(line));
      continue;
    }
    // Unindented: a heading when it introduces the list, otherwise prose.
    if (paragraph.length === 0 && isIndented(lines[i + 1] ?? "")) {
      blocks.push({ kind: "heading", text: line.trim() });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/**
 * Split into the specifics the desk acts on and the client's own words.
 *
 * The two want different treatment in the email — the picks are a work order,
 * the prose is a quote — and separating them here keeps that decision out of the
 * HTML.
 */
export function partitionDescription(description: string | null): {
  structured: DescriptionBlock[];
  notes: string[];
} {
  const blocks = parseDescriptionBlocks(description);
  const structured = blocks.filter((b) => b.kind !== "paragraph");
  const notes = blocks.flatMap((b) => (b.kind === "paragraph" ? [b.text] : []));
  return { structured, notes };
}
