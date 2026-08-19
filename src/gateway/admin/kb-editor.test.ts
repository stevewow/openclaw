import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ADMIN_UI_HTML } from "./admin-ui-html.js";
import { videoEmbedUrl } from "./kb-public-html.js";
import { KB_COMPONENT_JS } from "./kb-ui.js";

/**
 * The rich-text editor from kb-editor-ui.ts, exercised through the real SPA
 * markup the way kb-ui.test.ts does.
 *
 * Staff type into a contenteditable surface but the store still holds markdown,
 * so the conversion is the whole contract: anything the editor can produce must
 * survive a save, and anything already in the store must survive being opened.
 */

function mountEditor() {
  const dom = new JSDOM(ADMIN_UI_HTML, { runScripts: "outside-only" });
  const win = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    eval: (code: string) => unknown;
  };
  const alerts: string[] = [];
  win.esc = (v: string | number | null | undefined) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
  win.alert = (m: string) => {
    alerts.push(m);
  };
  win.api = () => Promise.resolve({ ok: true, data: {} });
  win.eval(KB_COMPONENT_JS);

  const doc = win.document;
  return {
    doc,
    alerts,
    /** markdown -> what the writer sees */
    toHtml(md: string): string {
      return String(win.eval(`kbMdToHtml(${JSON.stringify(md)})`));
    },
    /** what the writer sees -> what gets stored */
    toMd(html: string): string {
      const el = doc.getElementById("kb-article-body") as HTMLElement;
      el.innerHTML = html;
      return String(win.eval("kbReadEditor()"));
    },
    /** the full open-then-save trip a staffer makes without touching anything */
    roundTrip(md: string): string {
      win.eval(`kbLoadEditor(${JSON.stringify(md)})`);
      return String(win.eval("kbReadEditor()"));
    },
    setVideo(value: string): string {
      const input = doc.getElementById("kb-article-video") as HTMLInputElement;
      input.value = value;
      win.eval("renderKbVideoPreview()");
      return (doc.getElementById("kb-video-preview") as HTMLElement).innerHTML;
    },
    embed(url: string): string | null {
      return win.eval(`kbVideoEmbedUrl(${JSON.stringify(url)})`) as string | null;
    },
  };
}

describe("markdown to the editing surface", () => {
  it("renders the formatting the toolbar can produce", () => {
    const kb = mountEditor();
    expect(kb.toHtml("## Getting in")).toBe("<h2>Getting in</h2>");
    expect(kb.toHtml("### Smaller")).toBe("<h3>Smaller</h3>");
    expect(kb.toHtml("**bold**")).toBe("<p><strong>bold</strong></p>");
    expect(kb.toHtml("*soft*")).toBe("<p><em>soft</em></p>");
    expect(kb.toHtml("> mind this")).toBe("<blockquote>mind this</blockquote>");
  });

  it("builds numbered steps and bullets", () => {
    const kb = mountEditor();
    expect(kb.toHtml("1. First\n2. Second")).toBe("<ol><li>First</li><li>Second</li></ol>");
    expect(kb.toHtml("- One\n- Two")).toBe("<ul><li>One</li><li>Two</li></ul>");
  });

  it("collapses deeper heading levels into the two the toolbar offers", () => {
    // A round trip must not be able to invent a level nothing can edit.
    const kb = mountEditor();
    expect(kb.toHtml("# Top")).toBe("<h2>Top</h2>");
    expect(kb.toHtml("#### Deep")).toBe("<h3>Deep</h3>");
  });

  it("keeps a paragraph together across soft line breaks", () => {
    const kb = mountEditor();
    expect(kb.toHtml("one\ntwo\n\nthree")).toBe("<p>one two</p><p>three</p>");
  });

  it("renders links but refuses a javascript: href", () => {
    const kb = mountEditor();
    expect(kb.toHtml("[portal](https://wowvideotours.com)")).toBe(
      '<p><a href="https://wowvideotours.com">portal</a></p>',
    );
    // Stored markdown is not trusted input: it renders as text, never a link.
    const out = kb.toHtml("[tap me](javascript:alert(1))");
    expect(out).toBe("<p>tap me</p>");
    expect(out).not.toContain("javascript:");
  });

  it("escapes markup that lives in the stored text", () => {
    const kb = mountEditor();
    expect(kb.toHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });
});

describe("the editing surface back to markdown", () => {
  it("writes the formatting back as markdown", () => {
    const kb = mountEditor();
    expect(kb.toMd("<h2>Getting in</h2>")).toBe("## Getting in");
    expect(kb.toMd("<p><strong>bold</strong></p>")).toBe("**bold**");
    expect(kb.toMd("<p><em>soft</em></p>")).toBe("*soft*");
    expect(kb.toMd("<ol><li>First</li><li>Second</li></ol>")).toBe("1. First\n2. Second");
    expect(kb.toMd("<ul><li>One</li></ul>")).toBe("- One");
    expect(kb.toMd("<blockquote>mind this</blockquote>")).toBe("> mind this");
  });

  it("accepts the tags execCommand produces in place of the semantic ones", () => {
    // Browsers differ on b/strong and i/em; both must store the same markdown.
    const kb = mountEditor();
    expect(kb.toMd("<p><b>bold</b></p>")).toBe("**bold**");
    expect(kb.toMd("<p><i>soft</i></p>")).toBe("*soft*");
  });

  it("renumbers an ordered list rather than trusting the markup", () => {
    const kb = mountEditor();
    expect(kb.toMd("<ol><li>a</li><li>b</li><li>c</li></ol>")).toBe("1. a\n2. b\n3. c");
  });

  it("drops a tag neither side understands instead of storing it", () => {
    const kb = mountEditor();
    expect(kb.toMd('<p>plain <span style="color:red">red</span></p>')).toBe("plain red");
    expect(kb.toMd("<table><tr><td>cell</td></tr></table>")).toBe("cell");
  });

  it("escapes characters that would be read back as syntax", () => {
    const kb = mountEditor();
    // Typed literally, these must not become emphasis when the article renders.
    expect(kb.toMd("<p>2 * 3 * 4</p>")).toBe("2 \\* 3 \\* 4");
    expect(kb.toMd("<p>see [1]</p>")).toBe("see \\[1\\]");
  });

  it("keeps a link's address and refuses one that is not http", () => {
    const kb = mountEditor();
    expect(kb.toMd('<p><a href="https://wowvideotours.com">portal</a></p>')).toBe(
      "[portal](https://wowvideotours.com)",
    );
    expect(kb.toMd('<p><a href="javascript:alert(1)">tap</a></p>')).toBe("tap");
  });
});

describe("the open-and-save round trip", () => {
  it("returns an article unchanged when nobody edits it", () => {
    const kb = mountEditor();
    const md = [
      "## Option A",
      "",
      "Go to the portal and sign in.",
      "",
      "1. Click **Book Now**",
      "2. Enter your email",
      "",
      "### Two things",
      "",
      "- Bookmark the page",
      "- Use the same email",
      "",
      "> We answer within one business day.",
    ].join("\n");
    expect(kb.roundTrip(md)).toBe(md);
  });

  it("carries a link through both directions", () => {
    const kb = mountEditor();
    const md = "Start at [the portal](https://wowvideotours.com) and sign in.";
    expect(kb.roundTrip(md)).toBe(md);
  });

  it("leaves an article written as flat text as flat text", () => {
    // The body Steve wrote before this editor existed has no markdown in it.
    // Opening it must not silently restructure his words; it just stays prose
    // until someone formats it with the toolbar.
    const kb = mountEditor();
    expect(kb.roundTrip("Option A — Already have an account")).toBe(
      "Option A — Already have an account",
    );
  });

  it("survives an empty body", () => {
    const kb = mountEditor();
    expect(kb.roundTrip("")).toBe("");
  });
});

describe("the video preview", () => {
  it("shows a player for a youtube watch link", () => {
    const kb = mountEditor();
    const html = kb.setVideo("https://www.youtube.com/watch?v=wkETgVGM0fI");
    expect(html).toContain('src="https://www.youtube.com/embed/wkETgVGM0fI"');
    expect(html).toContain("kb-vid-frame");
  });

  it("carries the referrer policy the player needs, as the public page does", () => {
    // The Hub sends a no-referrer policy; without a referring origin YouTube
    // renders "Error 153 Video player configuration error" rather than the
    // video, so the preview showed the same failure the article page did.
    const kb = mountEditor();
    expect(kb.setVideo("https://www.youtube.com/watch?v=wkETgVGM0fI")).toContain(
      'referrerpolicy="strict-origin-when-cross-origin"',
    );
  });

  it("shows a player for short and vimeo links", () => {
    const kb = mountEditor();
    expect(kb.setVideo("https://youtu.be/wkETgVGM0fI")).toContain(
      "https://www.youtube.com/embed/wkETgVGM0fI",
    );
    expect(kb.setVideo("https://vimeo.com/123456")).toContain(
      "https://player.vimeo.com/video/123456",
    );
  });

  it("says a link will not become a player rather than showing nothing", () => {
    const kb = mountEditor();
    const html = kb.setVideo("https://example.com/some-video");
    expect(html).toContain("Watch the video");
    expect(html).not.toContain("<iframe");
  });

  it("calls out something that is not a web address", () => {
    const kb = mountEditor();
    const html = kb.setVideo("wkETgVGM0fI");
    expect(html).toContain("full https:// link");
    expect(html).not.toContain("<iframe");
  });

  it("never builds a frame from a javascript: link", () => {
    const kb = mountEditor();
    const html = kb.setVideo("javascript:alert(1)");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:alert");
  });

  it("clears the preview when the field is emptied", () => {
    const kb = mountEditor();
    kb.setVideo("https://youtu.be/wkETgVGM0fI");
    expect(kb.setVideo("")).toBe("");
  });

  it("agrees with the reader on every link shape", () => {
    // The preview promises a player; kb-public-html.ts is what actually builds
    // one. If these two ever disagree, staff publish against a false preview.
    const kb = mountEditor();
    const urls = [
      "https://www.youtube.com/watch?v=wkETgVGM0fI",
      "https://m.youtube.com/watch?v=wkETgVGM0fI",
      "https://youtube.com/watch?v=abc123",
      "https://www.youtube.com/watch?list=PL123",
      "https://youtu.be/wkETgVGM0fI",
      "https://youtu.be/",
      "https://vimeo.com/123456",
      "https://vimeo.com/channels/staffpicks",
      "https://example.com/video.mp4",
      "http://www.youtube.com/watch?v=abc123",
      "javascript:alert(1)",
      "not a url",
    ];
    for (const url of urls) {
      expect(kb.embed(url), url).toBe(videoEmbedUrl(url));
    }
  });
});
