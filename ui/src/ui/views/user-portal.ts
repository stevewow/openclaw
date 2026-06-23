import { html, nothing, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { t } from "../../i18n/index.ts";
import {
  getChatAttachmentPreviewUrl,
  registerChatAttachmentPayload,
  releaseChatAttachmentPayload,
} from "../chat/attachment-payload-store.ts";
import {
  CHAT_ATTACHMENT_ACCEPT,
  isSupportedChatAttachmentFile,
} from "../chat/attachment-support.ts";
import { buildChatItems } from "../chat/build-chat-items.ts";
import { renderChatQueue } from "../chat/chat-queue.ts";
import { DeletedMessages } from "../chat/deleted-messages.ts";
import { renderContextNotice } from "../chat/context-notice.ts";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat/grouped-render.ts";
import { getOrCreateSessionCacheValue } from "../chat/session-cache.ts";
import { renderSideResult } from "../chat/side-result-render.ts";
import {
  CATEGORY_LABELS,
  getHiddenCommandCount,
  getSlashCommandCompletions,
  SLASH_COMMANDS,
  type SlashCommandCategory,
  type SlashCommandDef,
} from "../chat/slash-commands.ts";
import { renderCompactionIndicator, renderFallbackIndicator } from "../chat/status-indicators.ts";
import { syncToolCardExpansionState, getExpandedToolCards } from "../chat/tool-expansion-state.ts";
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import type { ThemeMode } from "../theme.ts";
import type { ChatAttachment } from "../ui-types.ts";
import { agentLogoUrl, resolveChatAvatarRenderUrl, resolveAssistantTextAvatar } from "./agents-utils.ts";
import { exportChatMarkdown } from "../chat/export.ts";
import type { ChatProps } from "./chat.ts";

export type UserPortalProps = ChatProps & {
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
};

// ── Ephemeral (render-turn) view state ──────────────────────────────────────

interface PortalEphemeralState {
  slashMenuOpen: boolean;
  slashMenuItems: SlashCommandDef[];
  slashMenuIndex: number;
  slashMenuMode: "command" | "args";
  slashMenuCommand: SlashCommandDef | null;
  slashMenuArgItems: string[];
  slashMenuExpanded: boolean;
}

function createPortalState(): PortalEphemeralState {
  return {
    slashMenuOpen: false,
    slashMenuItems: [],
    slashMenuIndex: 0,
    slashMenuMode: "command",
    slashMenuCommand: null,
    slashMenuArgItems: [],
    slashMenuExpanded: false,
  };
}

const pvs = createPortalState();

export function resetUserPortalState() {
  Object.assign(pvs, createPortalState());
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PORTAL_SLASH_MENU_ID = "portal-slash-menu-listbox";
const PORTAL_SLASH_ACTIVE_ID = "portal-slash-active";

function adjustHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

function generateAttachId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function attachmentFromFile(file: File, dataUrl: string): ChatAttachment {
  const attachment = {
    id: generateAttachId(),
    mimeType: file.type || "application/octet-stream",
    fileName: file.name || undefined,
    sizeBytes: file.size,
  };
  return registerChatAttachmentPayload({ attachment, dataUrl, file });
}

function isImage(att: ChatAttachment): boolean {
  return att.mimeType.startsWith("image/");
}

function handlePortalPaste(e: ClipboardEvent, props: UserPortalProps) {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) return;
  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) imageItems.push(items[i]);
  }
  if (imageItems.length === 0) return;
  e.preventDefault();
  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) continue;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const att = attachmentFromFile(file, reader.result as string);
      props.onAttachmentsChange?.([...(props.attachments ?? []), att]);
    });
    reader.readAsDataURL(file);
  }
}

function handlePortalFileSelect(e: Event, props: UserPortalProps) {
  const input = e.target as HTMLInputElement;
  if (!input.files || !props.onAttachmentsChange) return;
  const current = props.attachments ?? [];
  const additions: ChatAttachment[] = [];
  let pending = 0;
  for (const file of input.files) {
    if (!isSupportedChatAttachmentFile(file)) continue;
    pending++;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      additions.push(attachmentFromFile(file, reader.result as string));
      if (--pending === 0) props.onAttachmentsChange?.([...current, ...additions]);
    });
    reader.readAsDataURL(file);
  }
  input.value = "";
}

function handlePortalDrop(e: DragEvent, props: UserPortalProps) {
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (!files || !props.onAttachmentsChange) return;
  const current = props.attachments ?? [];
  const additions: ChatAttachment[] = [];
  let pending = 0;
  for (const file of files) {
    if (!isSupportedChatAttachmentFile(file)) continue;
    pending++;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      additions.push(attachmentFromFile(file, reader.result as string));
      if (--pending === 0) props.onAttachmentsChange?.([...current, ...additions]);
    });
    reader.readAsDataURL(file);
  }
}

function tokenEstimate(draft: string): string | null {
  if (draft.length < 100) return null;
  return `~${Math.ceil(draft.length / 4)} tokens`;
}

// ── Slash menu logic ──────────────────────────────────────────────────────────

function resetSlashState() {
  pvs.slashMenuMode = "command";
  pvs.slashMenuCommand = null;
  pvs.slashMenuArgItems = [];
  pvs.slashMenuItems = [];
  pvs.slashMenuExpanded = false;
}

function updateSlashMenu(value: string, requestUpdate: () => void) {
  const argMatch = value.match(/^\/(\S+)\s(.*)$/);
  if (argMatch) {
    const cmdName = argMatch[1].toLowerCase();
    const argFilter = argMatch[2].toLowerCase();
    const cmd = SLASH_COMMANDS.find((c: SlashCommandDef) => c.name === cmdName);
    if (cmd?.argOptions?.length) {
      const filtered = argFilter
        ? cmd.argOptions.filter((opt: string) => opt.toLowerCase().startsWith(argFilter))
        : cmd.argOptions;
      if (filtered.length > 0) {
        pvs.slashMenuMode = "args";
        pvs.slashMenuCommand = cmd;
        pvs.slashMenuArgItems = filtered;
        pvs.slashMenuOpen = true;
        pvs.slashMenuIndex = 0;
        pvs.slashMenuItems = [];
        requestUpdate();
        return;
      }
    }
    pvs.slashMenuOpen = false;
    resetSlashState();
    requestUpdate();
    return;
  }
  const match = value.match(/^\/(\S*)$/);
  if (match) {
    const items = getSlashCommandCompletions(match[1], { showAll: pvs.slashMenuExpanded });
    pvs.slashMenuItems = items;
    pvs.slashMenuOpen = items.length > 0;
    pvs.slashMenuIndex = 0;
    pvs.slashMenuMode = "command";
    pvs.slashMenuCommand = null;
    pvs.slashMenuArgItems = [];
  } else {
    pvs.slashMenuOpen = false;
    resetSlashState();
  }
  requestUpdate();
}

function selectSlashCmd(
  cmd: SlashCommandDef,
  props: UserPortalProps,
  requestUpdate: () => void,
) {
  if (cmd.argOptions?.length) {
    props.onDraftChange(`/${cmd.name} `);
    pvs.slashMenuMode = "args";
    pvs.slashMenuCommand = cmd;
    pvs.slashMenuArgItems = cmd.argOptions;
    pvs.slashMenuOpen = true;
    pvs.slashMenuIndex = 0;
    pvs.slashMenuItems = [];
    requestUpdate();
    return;
  }
  pvs.slashMenuOpen = false;
  resetSlashState();
  if (cmd.executeLocal && !cmd.args) {
    props.onDraftChange(`/${cmd.name}`);
    requestUpdate();
    props.onSend();
  } else {
    props.onDraftChange(`/${cmd.name} `);
    requestUpdate();
  }
}

function tabCompleteSlashCmd(
  cmd: SlashCommandDef,
  props: UserPortalProps,
  requestUpdate: () => void,
) {
  if (cmd.argOptions?.length) {
    props.onDraftChange(`/${cmd.name} `);
    pvs.slashMenuMode = "args";
    pvs.slashMenuCommand = cmd;
    pvs.slashMenuArgItems = cmd.argOptions;
    pvs.slashMenuOpen = true;
    pvs.slashMenuIndex = 0;
    pvs.slashMenuItems = [];
    requestUpdate();
    return;
  }
  pvs.slashMenuOpen = false;
  resetSlashState();
  props.onDraftChange(cmd.args ? `/${cmd.name} ` : `/${cmd.name}`);
  requestUpdate();
}

function selectSlashArg(
  arg: string,
  props: UserPortalProps,
  requestUpdate: () => void,
  execute: boolean,
) {
  const cmdName = pvs.slashMenuCommand?.name ?? "";
  pvs.slashMenuOpen = false;
  resetSlashState();
  props.onDraftChange(`/${cmdName} ${arg}`);
  requestUpdate();
  if (execute) props.onSend();
}

function isSlashVisible(): boolean {
  if (!pvs.slashMenuOpen) return false;
  if (pvs.slashMenuMode === "args") {
    return Boolean(pvs.slashMenuCommand && pvs.slashMenuArgItems.length > 0);
  }
  return pvs.slashMenuItems.length > 0;
}

function activeSlashId(): string | null {
  if (!isSlashVisible()) return null;
  if (pvs.slashMenuMode === "args") {
    const arg = pvs.slashMenuArgItems[pvs.slashMenuIndex];
    return arg ? `portal-slash-arg-${arg.replace(/[^a-z0-9_-]+/gi, "-")}` : null;
  }
  const cmd = pvs.slashMenuItems[pvs.slashMenuIndex];
  return cmd ? `portal-slash-cmd-${cmd.name}` : null;
}

function activeSlashLabel(): string {
  if (!isSlashVisible()) return "";
  if (pvs.slashMenuMode === "args") {
    const arg = pvs.slashMenuArgItems[pvs.slashMenuIndex];
    return arg ? `/${pvs.slashMenuCommand?.name} ${arg}` : "";
  }
  const cmd = pvs.slashMenuItems[pvs.slashMenuIndex];
  if (!cmd) return "";
  return `/${cmd.name}${cmd.args ? ` ${cmd.args}` : ""} ${cmd.description}`;
}

// ── Slash menu rendering ──────────────────────────────────────────────────────

function renderPortalSlashMenu(
  props: UserPortalProps,
  requestUpdate: () => void,
): TemplateResult | typeof nothing {
  if (!isSlashVisible()) return nothing;

  // Arg mode
  if (pvs.slashMenuMode === "args" && pvs.slashMenuCommand && pvs.slashMenuArgItems.length > 0) {
    return html`
      <div id=${PORTAL_SLASH_MENU_ID} class="slash-menu" role="listbox" aria-label="Arguments">
        <div class="slash-menu-group">
          <div class="slash-menu-group__label">${pvs.slashMenuCommand.name}</div>
          ${pvs.slashMenuArgItems.map(
            (arg, i) => html`
              <div
                id="portal-slash-arg-${arg.replace(/[^a-z0-9_-]+/gi, "-")}"
                class="slash-menu-item ${i === pvs.slashMenuIndex ? "slash-menu-item--active" : ""}"
                role="option"
                aria-selected=${i === pvs.slashMenuIndex}
                @click=${() => selectSlashArg(arg, props, requestUpdate, true)}
                @mouseenter=${() => {
                  pvs.slashMenuIndex = i;
                  requestUpdate();
                }}
              >
                <span class="slash-menu-name">${arg}</span>
                <span class="slash-menu-desc">/${pvs.slashMenuCommand?.name} ${arg}</span>
              </div>
            `,
          )}
        </div>
        <div class="slash-menu-footer">
          <kbd>↑↓</kbd> navigate <kbd>Tab</kbd> fill <kbd>Enter</kbd> run <kbd>Esc</kbd> close
        </div>
      </div>
    `;
  }

  if (pvs.slashMenuItems.length === 0) return nothing;

  // Group commands by category
  const grouped = new Map<SlashCommandCategory, Array<{ cmd: SlashCommandDef; globalIdx: number }>>();
  for (let i = 0; i < pvs.slashMenuItems.length; i++) {
    const cmd = pvs.slashMenuItems[i];
    const cat = cmd.category ?? "session";
    let list = grouped.get(cat);
    if (!list) { list = []; grouped.set(cat, list); }
    list.push({ cmd, globalIdx: i });
  }

  const hiddenCount = pvs.slashMenuExpanded ? 0 : getHiddenCommandCount();

  return html`
    <div id=${PORTAL_SLASH_MENU_ID} class="slash-menu" role="listbox" aria-label="Slash commands">
      ${[...grouped.entries()].map(([cat, entries]) => html`
        <div class="slash-menu-group">
          <div class="slash-menu-group__label">${CATEGORY_LABELS[cat]}</div>
          ${entries.map(({ cmd, globalIdx }) => html`
            <div
              id="portal-slash-cmd-${cmd.name}"
              class="slash-menu-item ${globalIdx === pvs.slashMenuIndex ? "slash-menu-item--active" : ""}"
              role="option"
              aria-selected=${globalIdx === pvs.slashMenuIndex}
              @click=${() => selectSlashCmd(cmd, props, requestUpdate)}
              @mouseenter=${() => { pvs.slashMenuIndex = globalIdx; requestUpdate(); }}
            >
              ${cmd.icon ? html`<span class="slash-menu-icon">${icons[cmd.icon]}</span>` : nothing}
              <span class="slash-menu-name">/${cmd.name}</span>
              ${cmd.args ? html`<span class="slash-menu-args">${cmd.args}</span>` : nothing}
              <span class="slash-menu-desc">${cmd.description}</span>
              ${cmd.argOptions?.length
                ? html`<span class="slash-menu-badge">${cmd.argOptions.length} options</span>`
                : cmd.executeLocal && !cmd.args
                  ? html`<span class="slash-menu-badge">instant</span>`
                  : nothing}
            </div>
          `)}
        </div>
      `)}
      ${hiddenCount > 0
        ? html`<button
            class="slash-menu-show-more"
            @click=${(e: Event) => {
              e.preventDefault();
              e.stopPropagation();
              pvs.slashMenuExpanded = true;
              updateSlashMenu(props.draft, requestUpdate);
            }}
          >
            Show ${hiddenCount} more command${hiddenCount !== 1 ? "s" : ""}
          </button>`
        : nothing}
      <div class="slash-menu-footer">
        <kbd>↑↓</kbd> navigate <kbd>Tab</kbd> fill <kbd>Enter</kbd> select <kbd>Esc</kbd> close
      </div>
    </div>
  `;
}

// ── Welcome state ─────────────────────────────────────────────────────────────

const WELCOME_SUGGESTION_KEYS = [
  "chat.welcome.suggestions.whatCanYouDo",
  "chat.welcome.suggestions.summarizeRecentSessions",
  "chat.welcome.suggestions.configureChannel",
  "chat.welcome.suggestions.checkSystemHealth",
] as const;

function renderPortalWelcome(props: UserPortalProps) {
  const name = props.assistantName || "Assistant";
  const avatarUrl = resolveChatAvatarRenderUrl(props.assistantAvatarUrl, {
    identity: { avatar: props.assistantAvatar ?? undefined, avatarUrl: props.assistantAvatarUrl ?? undefined },
  });
  const avatarText = avatarUrl ? null : resolveAssistantTextAvatar(props.assistantAvatar);
  const fallbackLogoUrl = agentLogoUrl(props.basePath ?? "");

  return html`
    <div class="user-portal__welcome">
      ${avatarUrl
        ? html`<img class="user-portal__welcome-avatar" src=${avatarUrl} alt=${name} />`
        : avatarText
          ? html`<div class="user-portal__welcome-avatar-initials" aria-label=${name}>${avatarText}</div>`
          : html`
              <div class="user-portal__welcome-avatar-logo">
                <img src=${fallbackLogoUrl} alt=${name} />
              </div>
            `}
      <h2 class="user-portal__welcome-title">How can I help you today?</h2>
      <p class="user-portal__welcome-subtitle">
        Ask ${name} anything — or choose a suggestion below.
      </p>
      <div class="user-portal__suggestions">
        ${WELCOME_SUGGESTION_KEYS.map((key) => {
          const text = t(key);
          return html`
            <button
              type="button"
              class="user-portal__suggestion"
              @click=${() => {
                props.onDraftChange(text);
                props.onSend();
              }}
            >
              ${text}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Attachment preview ────────────────────────────────────────────────────────

function renderPortalAttachments(props: UserPortalProps): TemplateResult | typeof nothing {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) return nothing;
  return html`
    <div class="user-portal__attachments">
      ${attachments.map((att) => html`
        <div class="chat-attachment-thumb ${isImage(att) ? "" : "chat-attachment-thumb--file"}">
          ${isImage(att) && getChatAttachmentPreviewUrl(att)
            ? html`<img src=${getChatAttachmentPreviewUrl(att)!} alt="Attachment preview" />`
            : html`
                <div class="chat-attachment-file" title=${att.fileName ?? "Attached file"}>
                  <span class="chat-attachment-file__icon">${icons.paperclip}</span>
                  <span class="chat-attachment-file__name">${att.fileName ?? "Attached file"}</span>
                </div>
              `}
          <button
            class="chat-attachment-remove"
            type="button"
            aria-label="Remove attachment"
            @click=${() => {
              const next = (props.attachments ?? []).filter((a) => a.id !== att.id);
              releaseChatAttachmentPayload(att.id);
              props.onAttachmentsChange?.(next);
            }}
          >&times;</button>
        </div>
      `)}
    </div>
  `;
}

// ── Theme mode toggle ─────────────────────────────────────────────────────────

function renderThemeToggle(props: UserPortalProps): TemplateResult | typeof nothing {
  if (!props.onThemeModeChange) return nothing;
  const modes: Array<{ id: ThemeMode; icon: TemplateResult; label: string }> = [
    { id: "light", icon: icons.sun as TemplateResult, label: "Light" },
    { id: "dark", icon: icons.moon as TemplateResult, label: "Dark" },
    { id: "system", icon: icons.monitor as TemplateResult, label: "System" },
  ];
  return html`
    <div style="display:flex;align-items:center;gap:2px;">
      ${modes.map(({ id, icon, label }) => html`
        <button
          type="button"
          class="user-portal__icon-btn ${props.themeMode === id ? "user-portal__icon-btn--active" : ""}"
          title=${label}
          aria-label=${label}
          @click=${() => props.onThemeModeChange?.(id)}
          style="${props.themeMode === id ? "color:var(--text);background:var(--bg-hover);" : ""}"
        >
          ${icon}
        </button>
      `)}
    </div>
  `;
}

// ── Main render ───────────────────────────────────────────────────────────────

const deletedMessagesMap = new Map<string, DeletedMessages>();

function getDeletedMessages(sessionKey: string): DeletedMessages {
  return getOrCreateSessionCacheValue(
    deletedMessagesMap,
    sessionKey,
    () => new DeletedMessages(sessionKey),
  );
}

export function renderUserPortal(props: UserPortalProps) {
  const requestUpdate = props.onRequestUpdate ?? (() => {});
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);
  const canSend = props.connected && !isBusy;
  const compactBusy =
    props.compactionStatus?.phase === "active" || props.compactionStatus?.phase === "retrying";
  const activeSession = props.sessions?.sessions?.find((row) => row.key === props.sessionKey);
  const tokens = tokenEstimate(props.draft);
  const hasAttachments = (props.attachments?.length ?? 0) > 0;
  const deleted = getDeletedMessages(props.sessionKey);

  const placeholder = props.connected
    ? hasAttachments
      ? t("chat.composer.placeholderWithAttachments")
      : t("chat.composer.placeholder", { name: props.assistantName || "agent" })
    : t("chat.composer.placeholderDisconnected");

  const assistantIdentity = {
    name: props.assistantName,
    avatar: props.assistantAvatar,
  };

  const chatItems = buildChatItems({
    sessionKey: props.sessionKey,
    messages: props.messages,
    toolMessages: props.toolMessages,
    streamSegments: props.streamSegments,
    stream: props.stream,
    streamStartedAt: props.streamStartedAt,
    showToolCalls: props.showToolCalls,
    searchOpen: false,
    searchQuery: "",
  });

  syncToolCardExpansionState(props.sessionKey, chatItems, false);
  const expandedToolCards = getExpandedToolCards(props.sessionKey);
  const isEmpty = chatItems.length === 0 && !props.loading;

  const slashMenuVisible = isSlashVisible();
  const activeSlashMenuId = activeSlashId();
  const activeSlashMenuLabel = activeSlashLabel();
  const logoUrl = agentLogoUrl(props.basePath ?? "");

  const handleKeyDown = (e: KeyboardEvent) => {
    // Slash menu — arg mode navigation
    if (pvs.slashMenuOpen && pvs.slashMenuMode === "args" && pvs.slashMenuArgItems.length > 0) {
      const len = pvs.slashMenuArgItems.length;
      if (e.key === "ArrowDown") { e.preventDefault(); pvs.slashMenuIndex = (pvs.slashMenuIndex + 1) % len; requestUpdate(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); pvs.slashMenuIndex = (pvs.slashMenuIndex - 1 + len) % len; requestUpdate(); return; }
      if (e.key === "Tab") { e.preventDefault(); selectSlashArg(pvs.slashMenuArgItems[pvs.slashMenuIndex], props, requestUpdate, false); return; }
      if (e.key === "Enter") { e.preventDefault(); selectSlashArg(pvs.slashMenuArgItems[pvs.slashMenuIndex], props, requestUpdate, true); return; }
      if (e.key === "Escape") { e.preventDefault(); pvs.slashMenuOpen = false; resetSlashState(); requestUpdate(); return; }
    }
    // Slash menu — command mode navigation
    if (pvs.slashMenuOpen && pvs.slashMenuItems.length > 0) {
      const len = pvs.slashMenuItems.length;
      if (e.key === "ArrowDown") { e.preventDefault(); pvs.slashMenuIndex = (pvs.slashMenuIndex + 1) % len; requestUpdate(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); pvs.slashMenuIndex = (pvs.slashMenuIndex - 1 + len) % len; requestUpdate(); return; }
      if (e.key === "Tab") { e.preventDefault(); tabCompleteSlashCmd(pvs.slashMenuItems[pvs.slashMenuIndex], props, requestUpdate); return; }
      if (e.key === "Enter") { e.preventDefault(); selectSlashCmd(pvs.slashMenuItems[pvs.slashMenuIndex], props, requestUpdate); return; }
      if (e.key === "Escape") { e.preventDefault(); pvs.slashMenuOpen = false; resetSlashState(); requestUpdate(); return; }
    }
    // History navigation
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && props.onHistoryKeydown) {
      const target = e.target as HTMLTextAreaElement;
      const result = props.onHistoryKeydown({
        key: e.key,
        selectionStart: target.selectionStart,
        selectionEnd: target.selectionEnd,
        valueLength: target.value.length,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        isComposing: e.isComposing,
        keyCode: e.keyCode,
      });
      if (result.handled) {
        if (result.preventDefault) e.preventDefault();
        return;
      }
    }
    // Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.isComposing || e.keyCode === 229) return;
      if (!props.connected) return;
      e.preventDefault();
      if (canSend || props.draft.trim()) props.onSend();
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    adjustHeight(target);
    updateSlashMenu(target.value, requestUpdate);
    props.onDraftChange(target.value);
  };

  return html`
    <div
      class="user-portal"
      @drop=${(e: DragEvent) => handlePortalDrop(e, props)}
      @dragover=${(e: DragEvent) => e.preventDefault()}
    >
      <!-- Header -->
      <header class="user-portal__header">
        <div class="user-portal__header-start">
          <img class="user-portal__header-logo" src=${logoUrl} alt="OpenClaw" />
          <span class="user-portal__header-name">${props.assistantName || "OpenClaw"}</span>
        </div>
        <div class="user-portal__header-end">
          ${renderThemeToggle(props)}
          ${props.onNewSession
            ? html`
                <button
                  type="button"
                  class="user-portal__header-btn"
                  @click=${props.onNewSession}
                  title="New chat"
                  aria-label="New chat"
                >
                  ${icons.plus}
                  New chat
                </button>
              `
            : nothing}
        </div>
      </header>

      <!-- Thread -->
      <div class="user-portal__body" @scroll=${props.onChatScroll}>
        <div class="user-portal__thread">
          ${props.error
            ? html`
                <div class="user-portal__error" role="alert">
                  <span class="user-portal__error-text">${props.error}</span>
                  ${props.onDismissError
                    ? html`
                        <button
                          class="user-portal__error-dismiss"
                          type="button"
                          @click=${props.onDismissError}
                          aria-label="Dismiss"
                        >
                          ${icons.x}
                        </button>
                      `
                    : nothing}
                </div>
              `
            : nothing}

          ${isEmpty && !props.loading ? renderPortalWelcome(props) : nothing}

          ${props.loading && chatItems.length === 0
            ? html`
                <div class="user-portal__messages">
                  <div class="chat-loading-skeleton" aria-label="Loading chat">
                    <div class="chat-line assistant">
                      <div class="chat-msg">
                        <div class="chat-bubble">
                          <div class="skeleton skeleton-line skeleton-line--long" style="margin-bottom:8px"></div>
                          <div class="skeleton skeleton-line skeleton-line--medium" style="margin-bottom:8px"></div>
                          <div class="skeleton skeleton-line skeleton-line--short"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `
            : nothing}

          ${chatItems.length > 0 || props.loading
            ? html`
                <div class="user-portal__messages" role="log" aria-live="polite">
                  ${repeat(
                    chatItems,
                    (item) => item.key,
                    (item) => {
                      if (item.kind === "divider") {
                        return html`
                          <div class="chat-divider" data-ts=${String(item.timestamp)}>
                            <div class="chat-divider__rule" role="separator" aria-label=${item.label}>
                              <span class="chat-divider__line"></span>
                              <span class="chat-divider__label">${item.label}</span>
                              <span class="chat-divider__line"></span>
                            </div>
                          </div>
                        `;
                      }
                      if (item.kind === "reading-indicator") {
                        return renderReadingIndicatorGroup(
                          assistantIdentity,
                          props.basePath,
                          props.assistantAttachmentAuthToken ?? null,
                        );
                      }
                      if (item.kind === "stream") {
                        return renderStreamingGroup(
                          item.text,
                          item.startedAt,
                          props.onOpenSidebar,
                          assistantIdentity,
                          props.basePath,
                          props.assistantAttachmentAuthToken ?? null,
                        );
                      }
                      if (item.kind === "group") {
                        if (deleted.has(item.key)) return nothing;
                        return renderMessageGroup(item, {
                          onOpenSidebar: props.onOpenSidebar,
                          showReasoning: props.showThinking ?? false,
                          showToolCalls: props.showToolCalls,
                          autoExpandToolCalls: false,
                          isToolMessageExpanded: (id) => expandedToolCards.get(id) ?? false,
                          onToggleToolMessageExpanded: (id) => {
                            expandedToolCards.set(id, !expandedToolCards.get(id));
                            requestUpdate();
                          },
                          isToolExpanded: (id) => expandedToolCards.get(id) ?? false,
                          onToggleToolExpanded: (id) => {
                            expandedToolCards.set(id, !expandedToolCards.get(id));
                            requestUpdate();
                          },
                          onRequestUpdate: requestUpdate,
                          assistantName: props.assistantName,
                          assistantAvatar: assistantIdentity.avatar,
                          userName: props.userName ?? null,
                          userAvatar: props.userAvatar ?? null,
                          basePath: props.basePath,
                          localMediaPreviewRoots: props.localMediaPreviewRoots ?? [],
                          assistantAttachmentAuthToken: props.assistantAttachmentAuthToken ?? null,
                          canvasPluginSurfaceUrl: props.canvasPluginSurfaceUrl,
                          embedSandboxMode: props.embedSandboxMode ?? "scripts",
                          allowExternalEmbedUrls: props.allowExternalEmbedUrls ?? false,
                          contextWindow:
                            activeSession?.contextTokens ??
                            props.sessions?.defaults?.contextTokens ??
                            null,
                          onDelete: () => {
                            deleted.delete(item.key);
                            requestUpdate();
                          },
                        });
                      }
                      return nothing;
                    },
                  )}
                </div>
              `
            : nothing}

          ${renderSideResult(props.sideResult, props.onDismissSideResult)}
          ${renderFallbackIndicator(props.fallbackStatus)}
          ${renderCompactionIndicator(props.compactionStatus)}
          ${renderContextNotice(
            activeSession,
            props.sessions?.defaults?.contextTokens ?? null,
            {
              compactBusy,
              compactDisabled: !props.connected || isBusy || Boolean(props.canAbort),
              onCompact: props.onCompact,
            },
          )}
          ${renderChatQueue({
            queue: props.queue,
            canAbort: props.canAbort,
            onQueueSteer: props.onQueueSteer,
            onQueueRemove: props.onQueueRemove,
          })}
          ${props.showNewMessages
            ? html`
                <button
                  class="user-portal__new-messages"
                  type="button"
                  @click=${props.onScrollToBottom}
                >
                  ${icons.arrowDown}
                  New messages
                </button>
              `
            : nothing}
        </div>
      </div>

      <!-- Compose area -->
      <div class="user-portal__compose-wrap">
        <div class="user-portal__compose">
          <div class="user-portal__slash-menu-anchor">
            ${renderPortalSlashMenu(props, requestUpdate)}
          </div>

          <div class="user-portal__input-card">
            ${renderPortalAttachments(props)}

            <input
              type="file"
              accept=${CHAT_ATTACHMENT_ACCEPT}
              multiple
              class="user-portal__file-input"
              @change=${(e: Event) => handlePortalFileSelect(e, props)}
            />

            <div class="user-portal__combobox">
              <textarea
                class="user-portal__textarea"
                ${ref((el) => el && adjustHeight(el as HTMLTextAreaElement))}
                .value=${props.draft}
                dir=${detectTextDirection(props.draft)}
                ?disabled=${!props.connected}
                aria-autocomplete="list"
                aria-controls=${ifDefined(slashMenuVisible ? PORTAL_SLASH_MENU_ID : undefined)}
                aria-activedescendant=${ifDefined(activeSlashMenuId ?? undefined)}
                aria-describedby=${PORTAL_SLASH_ACTIVE_ID}
                @keydown=${handleKeyDown}
                @input=${handleInput}
                @paste=${(e: ClipboardEvent) => handlePortalPaste(e, props)}
                placeholder=${placeholder}
                rows="1"
              ></textarea>
              <span
                id=${PORTAL_SLASH_ACTIVE_ID}
                class="user-portal__sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >${activeSlashMenuLabel}</span>
            </div>

            <div class="user-portal__toolbar">
              <div class="user-portal__toolbar-left">
                <button
                  class="user-portal__tool-btn"
                  type="button"
                  title=${t("chat.composer.attachFile")}
                  aria-label=${t("chat.composer.attachFile")}
                  ?disabled=${!props.connected}
                  @click=${() => {
                    document
                      .querySelector<HTMLInputElement>(".user-portal__file-input")
                      ?.click();
                  }}
                >
                  ${icons.paperclip}
                </button>

                ${props.onToggleRealtimeTalk
                  ? html`
                      <button
                        class="user-portal__tool-btn ${props.realtimeTalkActive
                          ? "user-portal__tool-btn--danger"
                          : ""}"
                        type="button"
                        title=${props.realtimeTalkActive
                          ? t("chat.composer.stopTalk")
                          : t("chat.composer.startTalk")}
                        aria-label=${props.realtimeTalkActive
                          ? t("chat.composer.stopTalk")
                          : t("chat.composer.startTalk")}
                        ?disabled=${!props.connected}
                        @click=${props.onToggleRealtimeTalk}
                      >
                        ${props.realtimeTalkActive ? icons.volume2 : icons.radio}
                      </button>
                    `
                  : nothing}

                ${tokens
                  ? html`<span class="user-portal__token-count">${tokens}</span>`
                  : nothing}
              </div>

              <div class="user-portal__toolbar-right">
                ${!canAbort && props.messages.length > 0
                  ? html`
                      <button
                        class="user-portal__tool-btn"
                        type="button"
                        title="Export chat"
                        aria-label="Export chat"
                        @click=${() => exportChatMarkdown(props.messages, props.assistantName)}
                      >
                        ${icons.download}
                      </button>
                    `
                  : nothing}

                ${canAbort
                  ? html`
                      <button
                        class="user-portal__send-btn user-portal__send-btn--stop"
                        type="button"
                        title=${t("chat.runControls.stop")}
                        aria-label=${t("chat.runControls.stopGenerating")}
                        @click=${props.onAbort}
                      >
                        ${icons.stop}
                      </button>
                    `
                  : html`
                      <button
                        class="user-portal__send-btn"
                        type="button"
                        title=${t("chat.runControls.send")}
                        aria-label=${t("chat.runControls.sendMessage")}
                        ?disabled=${!props.connected || isBusy}
                        @click=${props.onSend}
                      >
                        ${icons.send}
                      </button>
                    `}
              </div>
            </div>
          </div>

          <p class="user-portal__footer-hint">
            ${props.assistantName || "OpenClaw"} can make mistakes. Review important info.
          </p>
        </div>
      </div>
    </div>
  `;
}
