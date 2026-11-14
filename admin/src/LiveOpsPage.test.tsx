import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as renderPlain, screen, waitFor, within } from "@testing-library/react";
import { App } from "antd";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { LiveOpsPage } from "./LiveOpsPage";
import { request } from "./services/api";
import * as L from "../../shared/live-ops/index.js";

vi.mock("./services/api", () => ({ request: vi.fn() }));
const permission = { write: true, publish: true };
vi.mock("./auth/Auth", () => ({
  useAuth: () => ({
    can: (p: string) =>
      p === "liveops:read" ||
      (p === "liveops:write" && permission.write) ||
      (p === "liveops:publish" && permission.publish),
  }),
}));

// Confirmation dialogs come from antd's App context, exactly as in the running app
const render = (ui: ReactElement) => renderPlain(<App>{ui}</App>);

const SERVER_TIME = "2026-11-13T07:00:00Z";

type AnyRecord = Record<string, any>;
const content = (overrides: AnyRecord = {}) =>
  L.createEventContent("seasonal", {
    id: "frost-season",
    name: "Frost Season",
    timeZone: "Asia/Ho_Chi_Minh",
    schedule: { startLocal: "2026-11-20T00:00", endLocal: "2026-12-05T00:00" },
    ...overrides,
  });
function record(c: AnyRecord, status = "draft", version = 1): AnyRecord {
  const w = L.resolveEventWindow(c);
  return {
    id: c.id,
    kind: c.kind,
    status,
    effectiveStatus: status,
    version,
    content: c,
    startsAt: w.startsAt,
    endsAt: w.endsAt,
    challengeKey: w.challengeKey,
    createdAt: SERVER_TIME,
    createdBy: "admin@example.com",
    updatedAt: SERVER_TIME,
    updatedBy: "admin@example.com",
    versions: [{ version, savedAt: SERVER_TIME, author: "admin@example.com", changed: ["all"] }],
  };
}
const workspace = (events: AnyRecord[] = [], extra: AnyRecord = {}) => ({
  environment: "production",
  revision: 4,
  serverTime: SERVER_TIME,
  events,
  archivedCount: 0,
  flags: L.defaultFlags(),
  conflicts: [],
  history: [],
  limits: L.LIMITS,
  ...extra,
});

let current: AnyRecord;
const mocked = vi.mocked(request);
/** Answers like the server would: workspace reads, previews and mutations (the mutation result becomes the new workspace) */
function serve(initial: AnyRecord, handlers: Record<string, (body: AnyRecord) => AnyRecord | Promise<AnyRecord>> = {}) {
  current = initial;
  mocked.mockImplementation((async (path: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (path.endsWith("/preview")) return { ok: true, errors: [], conflicts: [], window: { startsAt: "2026-11-19T17:00:00Z", endsAt: "2026-12-04T17:00:00Z", challengeKey: "frost-season" } };
    for (const [suffix, handler] of Object.entries(handlers)) {
      if (path.endsWith(suffix)) {
        current = await handler(body);
        return current;
      }
    }
    return current;
  }) as typeof request);
}

beforeEach(() => {
  permission.write = true;
  permission.publish = true;
  mocked.mockReset();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

it("lists events with their status, window in the event's own time zone and rewards, and offers only the actions the status allows", async () => {
  serve(workspace([
    record(content()),
    record(content({ id: "blood-moon", kind: "random", name: "Blood Moon", timeZone: "UTC", schedule: { startLocal: "2026-11-13T06:00", endLocal: "2026-11-13T08:00" } }), "active"),
  ]));
  render(<LiveOpsPage />);
  const row = (await screen.findByText("Frost Season")).closest("tr")!;
  expect(within(row).getByText("draft")).toBeInTheDocument();
  expect(within(row).getByText(/2026-11-20 00:00 → 2026-12-05 00:00/)).toBeInTheDocument();
  expect(within(row).getByText("Asia/Ho_Chi_Minh")).toBeInTheDocument();
  for (const label of ["Edit", "Schedule", "Delete", "Cancel"]) expect(within(row).getByRole("button", { name: `${label} frost-season` })).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: /Unschedule|End now|Archive/ })).not.toBeInTheDocument();

  const active = screen.getByText("Blood Moon").closest("tr")!;
  expect(within(active).getByText("active")).toBeInTheDocument();
  expect(within(active).getByRole("button", { name: "End now blood-moon" })).toBeInTheDocument();
  expect(within(active).getByRole("button", { name: "View blood-moon" })).toBeInTheDocument();
  expect(within(active).queryByRole("button", { name: /Edit|Delete|Schedule/ })).not.toBeInTheDocument();
  expect(screen.getByText("Revision 4")).toBeInTheDocument();
  expect(screen.getByText(/Server time 2026-11-13 07:00 UTC/)).toBeInTheDocument();
});

it("times can be shown in UTC instead", async () => {
  serve(workspace([record(content())]));
  render(<LiveOpsPage />);
  await screen.findByText("Frost Season");
  expect(screen.getByText(/2026-11-20 00:00 → 2026-12-05 00:00/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("combobox", { name: "Show times in" }));
  await userEvent.click(await screen.findByText("Times in UTC"));
  expect(await screen.findByText(/2026-11-19 17:00 → 2026-12-04 17:00/)).toBeInTheDocument();
});

it("hides publishing and editing controls from someone who may not use them", async () => {
  permission.write = false;
  permission.publish = false;
  serve(workspace([record(content()), record(content({ id: "other", name: "Other" }), "scheduled")]));
  render(<LiveOpsPage />);
  await screen.findByText("Frost Season");
  expect(screen.queryByRole("button", { name: "New event" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Generate/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^(Edit|Schedule|Delete|Cancel|Unschedule|Start now) / })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^View / }).length).toBe(2);
  await userEvent.click(screen.getByRole("tab", { name: "Feature flags" }));
  expect(screen.queryByRole("button", { name: "Publish flags" })).not.toBeInTheDocument();
});

it("a content editor can prepare drafts but is not offered Schedule", async () => {
  permission.publish = false;
  serve(workspace([record(content())]));
  render(<LiveOpsPage />);
  const row = (await screen.findByText("Frost Season")).closest("tr")!;
  expect(within(row).getByRole("button", { name: "Edit frost-season" })).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: "Schedule frost-season" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New event" })).toBeInTheDocument();
});

it("scheduling asks for confirmation and sends the loaded revision; the answer replaces the screen", async () => {
  const scheduled = record(content(), "scheduled");
  serve(workspace([record(content())]), {
    "/events/frost-season/schedule": () => workspace([scheduled], { revision: 5 }),
  });
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Schedule frost-season" }));
  // antd renders a confirm dialog's title in two places (a hidden header and the body)
  expect((await screen.findAllByText("Schedule “Frost Season”?")).length).toBeGreaterThan(0);
  expect(mocked.mock.calls.some(([p]) => String(p).endsWith("/schedule"))).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(screen.getByText("Revision 5")).toBeInTheDocument());
  const call = mocked.mock.calls.find(([p]) => String(p).endsWith("/events/frost-season/schedule"))!;
  expect(call[0]).toBe("/liveops/environments/production/events/frost-season/schedule");
  expect(JSON.parse(String(call[1]!.body))).toEqual({ revision: 4 });
  expect(await screen.findByText(/Frost Season: schedule done/)).toBeInTheDocument();
  const row = screen.getByText("Frost Season").closest("tr")!;
  expect(within(row).getByText("scheduled")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "Unschedule frost-season" })).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "Start now frost-season" })).toBeInTheDocument();
});

it("a calendar challenge cannot be started early: no Start now button", async () => {
  const day = L.createEventContent("daily", { id: "daily-2026-11-20", name: "Storm", timeZone: "UTC", schedule: { startLocal: "2026-11-20T00:00", endLocal: "2026-11-21T00:00" } });
  serve(workspace([record(day, "scheduled")]));
  render(<LiveOpsPage />);
  const row = (await screen.findByText("Storm")).closest("tr")!;
  expect(within(row).getByRole("button", { name: "Unschedule daily-2026-11-20" })).toBeInTheDocument();
  expect(within(row).queryByRole("button", { name: /Start now/ })).not.toBeInTheDocument();
});

it("shows the server's refusal with its reason and leaves the screen as it was", async () => {
  serve(workspace([record(content())]), {
    "/events/frost-season/schedule": () => {
      throw new Error("Schedule conflict: “A” and “B” are both seasonal events at the same time; only one seasonal event can run at once.");
    },
  });
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Schedule frost-season" }));
  await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(await screen.findByText(/Schedule conflict: .*only one seasonal event can run at once/)).toBeInTheDocument();
  expect(screen.getByText("Revision 4")).toBeInTheDocument();
  expect(within(screen.getByText("Frost Season").closest("tr")!).getByText("draft")).toBeInTheDocument();
});

it("highlights events that conflict and lists each conflict", async () => {
  serve(workspace(
    [record(content({ id: "a-season", name: "Season A" }), "scheduled"), record(content({ id: "b-season", name: "Season B" }), "scheduled")],
    { conflicts: [{ type: "overlap", severity: "error", eventIds: ["a-season", "b-season"], message: "“Season A” (a-season) and “Season B” (b-season) are both seasonal events at the same time." }] },
  ));
  render(<LiveOpsPage />);
  expect(await screen.findByText("1 schedule conflict")).toBeInTheDocument();
  expect(screen.getAllByText("Conflict").length).toBe(2);
});

it("creates a draft from the editor: validates locally, previews the UTC window, and posts content with the revision", async () => {
  const created = record(content({ id: "ember-festival", name: "Ember Festival" }));
  serve(workspace(), { "/events": () => ({ ...workspace([created], { revision: 5 }), event: created, changed: true }) });
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "New event" }));
  const dialog = await screen.findByRole("dialog");
  // an empty draft is not valid yet, and the editor says exactly why
  expect(within(dialog).getByText("Fix these before saving")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Create draft" })).toBeDisabled();
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Event ID" }), "ember-festival");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Ember Festival");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Create draft" })).toBeEnabled());
  expect(await within(dialog).findByText(/UTC window: 2026-11-19 17:00 UTC → 2026-12-04 17:00 UTC/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Create draft" }));
  await waitFor(() => expect(screen.getByText("Revision 5")).toBeInTheDocument());
  const call = mocked.mock.calls.find(([p, o]) => String(p).endsWith("/events") && o?.method === "POST")!;
  const body = JSON.parse(String(call[1]!.body));
  expect(body.revision).toBe(4);
  expect(body.content).toMatchObject({ id: "ember-festival", name: "Ember Festival", kind: "seasonal", timeZone: "UTC" });
  expect(L.validateEventContent(body.content)).toEqual([]);
  expect(await screen.findByText(/Draft “Ember Festival” created/)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("editing keeps the rules a preset fills in and lets the author tune a gesture pool", async () => {
  serve(workspace());
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "New event" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("combobox", { name: "Preset" }));
  await userEvent.click(await screen.findByText("Mùa Băng Giá"));
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Mùa Băng Giá");
  expect(within(dialog).getByRole("spinbutton", { name: "Enemy speed multiplier" })).toHaveValue("0.90");
  expect(within(dialog).getByRole("spinbutton", { name: "Score multiplier" })).toHaveValue("1.25");
  const weight = within(dialog).getByRole("spinbutton", { name: "Weight Lightning ⚡" });
  await userEvent.clear(weight);
  await userEvent.type(weight, "2");
  fireEvent.blur(weight);
  // two lightning entries = twice as likely; the other gestures stay out of the pool
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Event ID" }), "frost-season");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Create draft" })).toBeEnabled());
  await userEvent.click(within(dialog).getByRole("button", { name: "Create draft" }));
  const call = mocked.mock.calls.find(([p, o]) => String(p).endsWith("/events") && o?.method === "POST")!;
  expect(JSON.parse(String(call[1]!.body)).content.rules.enemy.runes).toEqual(["lightning", "lightning"]);
});

it("a reward is added and removed in the editor, and an invalid one blocks saving", async () => {
  serve(workspace());
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "New event" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Event ID" }), "reward-test");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Reward Test");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add reward" }));
  // a badge needs a name: the editor says so and refuses to save
  expect(await within(dialog).findByText(/rewards\[0\]\.label: a badge needs a name/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Create draft" })).toBeDisabled();
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Reward 1 label" }), "Frost Walker");
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Create draft" })).toBeEnabled());
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove reward 1" }));
  expect(within(dialog).queryByRole("textbox", { name: "Reward 1 label" })).not.toBeInTheDocument();
});

it("a scheduled event opens read-only: nothing can be typed and there is no save button", async () => {
  serve(workspace([record(content(), "scheduled", 3)]));
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "View frost-season" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Only a draft can be edited")).toBeInTheDocument();
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toBeDisabled();
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Frost Season");
  expect(within(dialog).queryByRole("button", { name: /Create draft|Save draft/ })).not.toBeInTheDocument();
  expect(within(dialog).getByText("Version 3")).toBeInTheDocument();
});

it("the daily tab shows which days run the built-in rotation and lets an author take a day over", async () => {
  const day = L.createEventContent("daily", { id: "daily-2026-11-14", name: "Custom Storm", timeZone: "UTC", schedule: { startLocal: "2026-11-14T00:00", endLocal: "2026-11-15T00:00" } });
  serve(workspace([record(day, "scheduled", 2)]));
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("tab", { name: "Daily & weekly" }));
  const custom = (await screen.findByText("2026-11-14")).closest("tr")!;
  expect(within(custom).getByText("Custom Storm")).toBeInTheDocument();
  expect(within(custom).getByText("board r2·s1")).toBeInTheDocument();
  const builtin = screen.getByText("2026-11-15").closest("tr")!;
  expect(within(builtin).getByText(/Built-in rotation:/)).toBeInTheDocument();
  expect(within(builtin).getByText("board r0·s1")).toBeInTheDocument();
  await userEvent.click(within(builtin).getByRole("button", { name: "Create daily 2026-11-15" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("textbox", { name: "Event ID" })).toHaveValue("daily-2026-11-15");
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue(
    (L.generateDailyContents({ startDate: "2026-11-15", days: 1 }).contents[0] as AnyRecord).name,
  );
});

it("feature flags are edited locally, flagged as unsaved, and published with the revision", async () => {
  const next = L.defaultFlags();
  next["liveops.seasonal"] = { enabled: false, rolloutPercent: 100 };
  serve(workspace(), { "/flags": (body) => workspace([], { revision: 5, flags: body.flags }) });
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("tab", { name: "Feature flags" }));
  expect(screen.getByRole("button", { name: "Publish flags" })).toBeDisabled();
  await userEvent.click(screen.getByRole("switch", { name: "Seasonal events enabled" }));
  expect(await screen.findByText("Unsaved flag changes")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Publish flags" }));
  await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(screen.getByText("Revision 5")).toBeInTheDocument());
  const call = mocked.mock.calls.find(([p]) => String(p).endsWith("/flags"))!;
  const body = JSON.parse(String(call[1]!.body));
  expect(body.revision).toBe(4);
  expect(body.flags).toEqual(next);
  expect(screen.queryByText("Unsaved flag changes")).not.toBeInTheDocument();
});

it("history lists what happened, newest first, with who and why", async () => {
  serve(workspace([], {
    history: [
      { seq: 3, id: "x#1#cancelled", at: "2026-11-13T06:00:00Z", recordedAt: SERVER_TIME, type: "cancelled", eventId: "blood-moon", version: 1, actor: "admin@example.com", note: "wrong modifier" },
      { seq: 2, id: "x#1#activated", at: "2026-11-13T05:00:00Z", recordedAt: SERVER_TIME, type: "activated", eventId: "blood-moon", version: 1, actor: "system", note: "time-driven" },
    ],
  }));
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("tab", { name: "History" }));
  const cancelled = (await screen.findByText("wrong modifier")).closest("tr")!;
  expect(within(cancelled).getByText("cancelled")).toBeInTheDocument();
  expect(within(cancelled).getByText("admin@example.com")).toBeInTheDocument();
  const auto = screen.getByText("time-driven").closest("tr")!;
  expect(within(auto).getByText("system")).toBeInTheDocument();
});

it("event text is rendered as text, never as markup", async () => {
  const nasty = '<img src=x onerror="window.__pwned = 1"> & co';
  serve(workspace([record(content({ name: nasty, description: nasty }))]));
  render(<LiveOpsPage />);
  expect(await screen.findByText(nasty)).toBeInTheDocument();
  expect(document.querySelector("img[src='x']")).toBeNull();
  expect((window as AnyRecord).__pwned).toBeUndefined();
});

it("shows a load error with the server's message and keeps the controls safe", async () => {
  mocked.mockRejectedValue(new Error("Storage unavailable"));
  render(<LiveOpsPage />);
  expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New event" })).toBeDisabled();
});

it("generating daily drafts posts the parameters and reports what was created", async () => {
  serve(workspace(), {
    "/generate": () => ({ ...workspace([record(L.generateDailyContents({ startDate: "2026-11-14", days: 1 }).contents[0])], { revision: 5 }), created: ["daily-2026-11-14"], skipped: [], shortfall: 0, changed: true }),
  });
  render(<LiveOpsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Generate daily drafts" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Generate drafts" }));
  await waitFor(() => expect(screen.getByText("Revision 5")).toBeInTheDocument());
  const call = mocked.mock.calls.find(([p]) => String(p).endsWith("/generate"))!;
  expect(JSON.parse(String(call[1]!.body))).toEqual({ revision: 4, kind: "daily", params: { startDate: "2026-11-14", days: 7, timeZone: "UTC" } });
  expect(await screen.findByText("Created 1 draft(s).")).toBeInTheDocument();
});
