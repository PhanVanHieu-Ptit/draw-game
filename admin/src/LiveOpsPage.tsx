import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from "antd";
import * as L from "../../shared/live-ops/index.js";
import { getDailyChallenge } from "../../src/core/Challenge.js";
import { request } from "./services/api";
import { useAuth } from "./auth/Auth";
import { COMMON_ZONES, EventEditor } from "./liveops/EventEditor";
import type {
  EventContent,
  EventRecord,
  Flags,
  HistoryEntry,
  Kind,
  Status,
  Workspace,
} from "./liveops/types";

type MutationResponse = Workspace & {
  changed?: boolean;
  event?: EventRecord;
  created?: string[];
  skipped?: string[];
  shortfall?: number;
};

const KIND_LABEL: Record<Kind, string> = {
  daily: "Daily",
  weekly: "Weekly",
  seasonal: "Seasonal",
  random: "Random",
};
const STATUS_COLOR: Record<Status, string> = {
  draft: "default",
  scheduled: "blue",
  active: "green",
  completed: "cyan",
  cancelled: "red",
  archived: "default",
};
const ENVIRONMENTS = ["development", "staging", "production"];
const flagInfo = L.FLAG_DEFS as unknown as Record<string, { label: string; description: string }>;

type Display = "event" | "UTC" | "browser";

/** 2026-11-19T17:00:00Z in a zone, as "2026-11-20 00:00" */
function show(instant: string, zone: string) {
  return L.wallClock(Date.parse(instant), zone).replace("T", " ");
}
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function LiveOpsPage() {
  const { can } = useAuth();
  const { modal } = App.useApp();
  const canWrite = can("liveops:write");
  const canPublish = can("liveops:publish");
  const [environment, setEnvironment] = useState("production");
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState<Display>("event");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ mode: "create" | "edit" | "view"; content: EventContent; record?: EventRecord; key: number } | null>(null);
  const [editorError, setEditorError] = useState("");
  const [flags, setFlags] = useState<Flags | null>(null);
  const [older, setOlder] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [generate, setGenerate] = useState<null | "daily" | "random">(null);
  const [gen, setGen] = useState<Record<string, unknown>>({});

  const base = `/liveops/environments/${environment}`;

  const apply = useCallback((next: Workspace) => {
    setWs(next);
    setFlags(structuredClone(next.flags));
    setOlder([]);
    setCursor(undefined);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      apply(await request<Workspace>(base));
    } catch (e) {
      setWs(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [base, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  /** One mutation: always carries the revision the screen was loaded with, so a stale screen gets a 409, not an overwrite */
  const send = async (path: string, body: Record<string, unknown>, success: (r: MutationResponse) => string): Promise<MutationResponse | null> => {
    if (!ws) return null;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await request<MutationResponse>(`${base}${path}`, {
        method: "POST",
        body: JSON.stringify({ revision: ws.revision, ...body }),
      });
      apply(response);
      setNotice(success(response));
      return response;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  // ---- blank events -------------------------------------------------------------------------------------------------
  const today = ws ? ws.serverTime.slice(0, 10) : "2026-01-01";
  const blank = (kind: Kind): EventContent => {
    const tomorrow = L.addDays(today, 1);
    if (kind === "daily") {
      return L.createEventContent("daily", {
        id: `daily-${tomorrow}`,
        schedule: { startLocal: `${tomorrow}T00:00`, endLocal: `${L.addDays(tomorrow, 1)}T00:00` },
      }) as unknown as EventContent;
    }
    if (kind === "weekly") {
      const monday = L.addDays(today, 8 - L.isoWeekday(today));
      return L.createEventContent("weekly", {
        id: `weekly-${L.isoWeekKey(monday).toLowerCase()}`,
        schedule: { startLocal: `${monday}T00:00`, endLocal: `${L.addDays(monday, 7)}T00:00` },
      }) as unknown as EventContent;
    }
    if (kind === "random") {
      return L.createEventContent("random", {
        schedule: { startLocal: `${tomorrow}T19:00`, endLocal: `${tomorrow}T20:00` },
      }) as unknown as EventContent;
    }
    return L.createEventContent("seasonal", {
      schedule: { startLocal: `${tomorrow}T00:00`, endLocal: `${L.addDays(tomorrow, 7)}T00:00` },
    }) as unknown as EventContent;
  };

  const openEditor = (mode: "create" | "edit" | "view", content: EventContent, record?: EventRecord) => {
    setEditorError("");
    setEditor({ mode, content, record, key: Date.now() });
  };

  const saveEvent = async (content: EventContent) => {
    if (!editor || !ws) return;
    setBusy(true);
    setEditorError("");
    try {
      const path = editor.mode === "create" ? "/events" : `/events/${content.id}/save`;
      const response = await request<MutationResponse>(`${base}${path}`, {
        method: "POST",
        body: JSON.stringify({ revision: ws.revision, content }),
      });
      apply(response);
      setNotice(
        editor.mode === "create"
          ? `Draft “${content.name}” created.`
          : response.changed === false
            ? "No changes to save."
            : `Draft saved as version ${response.event?.version}.`,
      );
      setEditor(null);
    } catch (e) {
      setEditorError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---- lifecycle actions --------------------------------------------------------------------------------------------
  const ASK: Record<string, { title: (n: string) => string; body: string; ok: string }> = {
    schedule: {
      title: (n) => `Schedule “${n}”?`,
      body: "Players will receive this event as soon as the game refreshes its schedule. The server checks for conflicts first.",
      ok: "Confirm",
    },
    unschedule: { title: (n) => `Unschedule “${n}”?`, body: "It disappears from the public schedule and becomes an editable draft again.", ok: "Confirm" },
    activate: { title: (n) => `Start “${n}” now?`, body: "The start time moves to this moment. Players see it live on their next refresh.", ok: "Confirm" },
    complete: { title: (n) => `End “${n}” now?`, body: "The end time moves to this moment.", ok: "Confirm" },
    cancel: { title: (n) => `Cancel “${n}”?`, body: "A cancelled event cannot be restored. Rewards for it can no longer be claimed.", ok: "Confirm" },
    archive: { title: (n) => `Archive “${n}”?`, body: "It leaves this list. History keeps the record.", ok: "Confirm" },
    delete: { title: (n) => `Delete draft “${n}”?`, body: "Only drafts can be deleted. This cannot be undone.", ok: "Confirm" },
  };
  const confirm = (record: EventRecord, action: string) =>
    modal.confirm({
      title: ASK[action].title(record.content.name),
      content: ASK[action].body,
      okText: ASK[action].ok,
      onOk: async () => {
        await send(`/events/${record.id}/${action}`, {}, (r) => (r.changed === false ? `Already ${action}d: nothing changed.` : `${record.content.name}: ${action} done.`));
      },
    });

  const actionsFor = (record: EventRecord) => {
    const status = record.effectiveStatus;
    const buttons: ReactElement[] = [];
    const add = (label: string, onClick: () => void, extra: { danger?: boolean } = {}) =>
      buttons.push(
        <Button key={label} size="small" disabled={busy} onClick={onClick} {...extra} aria-label={`${label} ${record.id}`}>
          {label}
        </Button>,
      );
    if (status === "draft") {
      if (canWrite) add("Edit", () => openEditor("edit", structuredClone(record.content), record));
      else add("View", () => openEditor("view", structuredClone(record.content), record));
      if (canPublish) add("Schedule", () => confirm(record, "schedule"));
      if (canWrite) add("Delete", () => confirm(record, "delete"), { danger: true });
    } else {
      add("View", () => openEditor("view", structuredClone(record.content), record));
    }
    if (canPublish) {
      if (status === "scheduled") {
        add("Unschedule", () => confirm(record, "unschedule"));
        if (!L.KIND_INFO[record.kind as Kind].calendar) add("Start now", () => confirm(record, "activate"));
      }
      if (status === "active") add("End now", () => confirm(record, "complete"));
      if (status === "draft" || status === "scheduled" || status === "active") add("Cancel", () => confirm(record, "cancel"), { danger: true });
      if (status === "completed" || status === "cancelled") add("Archive", () => confirm(record, "archive"));
    }
    return <Space wrap>{buttons}</Space>;
  };

  // ---- derived views ------------------------------------------------------------------------------------------------
  const zoneOf = (record: EventRecord) => (display === "event" ? record.content.timeZone : display === "UTC" ? "UTC" : browserZone());
  const conflicted = useMemo(() => new Set((ws?.conflicts || []).flatMap((c) => c.eventIds)), [ws]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (ws?.events || []).filter(
      (e) =>
        (kindFilter === "all" || e.kind === kindFilter) &&
        (statusFilter === "all" ? true : statusFilter === "open" ? !["completed", "cancelled"].includes(e.effectiveStatus) : e.effectiveStatus === statusFilter) &&
        (!needle || `${e.id} ${e.content.name}`.toLowerCase().includes(needle)),
    );
  }, [ws, kindFilter, statusFilter, search]);

  const flagsDirty = flags !== null && ws !== null && JSON.stringify(flags) !== JSON.stringify(ws.flags);
  const history = [...(ws?.history || []), ...older];

  const loadOlder = async () => {
    const last = history.length ? history[history.length - 1].seq : 0;
    try {
      const page = await request<{ entries: HistoryEntry[]; next: number | null }>(`${base}/history?before=${cursor ?? last}&limit=50`);
      setOlder((old) => [...old, ...page.entries]);
      setCursor(page.next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---- generate -----------------------------------------------------------------------------------------------------
  const openGenerate = (kind: "daily" | "random") => {
    const tomorrow = L.addDays(today, 1);
    setGen(
      kind === "daily"
        ? { startDate: tomorrow, days: 7, timeZone: "UTC" }
        : { seed: `${tomorrow}-random`, fromDate: tomorrow, days: 7, count: 3, durationMinutes: [30, 90], minGapMinutes: 120, hours: [18, 22], timeZone: "UTC" },
    );
    setGenerate(kind);
  };
  const submitGenerate = async () => {
    if (!generate) return;
    const result = await send("/generate", { kind: generate, params: gen }, (r) =>
      r.created?.length
        ? `Created ${r.created.length} draft(s)${r.skipped?.length ? `, skipped ${r.skipped.length} existing date(s)` : ""}${r.shortfall ? `; ${r.shortfall} could not be placed` : ""}.`
        : "Nothing new to create.",
    );
    if (result) setGenerate(null);
  };
  const setG = (key: string, value: unknown) => setGen((old) => ({ ...old, [key]: value }));

  // ---- challenge coverage (daily challenges use UTC-day keys by default) --------------------------------------------
  const coverage = useMemo(() => {
    if (!ws) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const key = L.addDays(today, i);
      const event = ws.events.find((e) => e.kind === "daily" && e.challengeKey === key && !["cancelled", "archived"].includes(e.effectiveStatus));
      return { key, event, builtin: getDailyChallenge(key).modifier.name as string };
    });
  }, [ws, today]);

  const columns = [
    {
      title: "Event",
      render: (_: unknown, r: EventRecord) => (
        <div>
          <b>{r.content.name}</b> {conflicted.has(r.id) && <Tag color="red">Conflict</Tag>}
          <div className="muted">{r.id}</div>
        </div>
      ),
    },
    { title: "Kind", dataIndex: "kind", render: (k: Kind) => <Tag>{KIND_LABEL[k]}</Tag> },
    {
      title: "Status",
      render: (_: unknown, r: EventRecord) => (
        <Tag color={STATUS_COLOR[r.effectiveStatus]} title={r.status !== r.effectiveStatus ? "Time has already moved this event on; the record is updated within seconds." : undefined}>
          {r.effectiveStatus}
        </Tag>
      ),
    },
    {
      title: display === "event" ? "Window (event time zone)" : display === "UTC" ? "Window (UTC)" : `Window (${browserZone()})`,
      render: (_: unknown, r: EventRecord) => (
        <span>
          {show(r.startsAt, zoneOf(r))} → {show(r.endsAt, zoneOf(r))}
          {display === "event" && <div className="muted">{r.content.timeZone}</div>}
        </span>
      ),
    },
    { title: "Version", dataIndex: "version", render: (v: number) => `v${v}` },
    { title: "Rewards", render: (_: unknown, r: EventRecord) => r.content.rewards.length },
    { title: "Actions", render: (_: unknown, r: EventRecord) => actionsFor(r) },
  ];

  const historyColumns = [
    { title: "Recorded (UTC)", dataIndex: "at", render: (v: string) => show(v, "UTC") },
    { title: "Event", dataIndex: "eventId", render: (v: string | null) => v || "—" },
    { title: "Action", dataIndex: "type", render: (v: string) => <Tag>{v}</Tag> },
    { title: "Version", dataIndex: "version", render: (v: number | null) => (v ? `v${v}` : "—") },
    { title: "By", dataIndex: "actor" },
    { title: "Note", dataIndex: "note", render: (v?: string) => v || "" },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <h1>Live Operations</h1>
      <Space wrap>
        <Select
          aria-label="Environment"
          value={environment}
          disabled={busy}
          options={ENVIRONMENTS.map((value) => ({ value }))}
          onChange={(value) => {
            setWs(null);
            setEnvironment(value);
          }}
        />
        <Tag>Revision {ws?.revision ?? "—"}</Tag>
        <Tag color="purple">Server time {ws ? show(ws.serverTime, "UTC") + " UTC" : "—"}</Tag>
        <Select<Display>
          aria-label="Show times in"
          value={display}
          options={[
            { value: "event", label: "Times in each event's zone" },
            { value: "UTC", label: "Times in UTC" },
            { value: "browser", label: "Times in my browser zone" },
          ]}
          onChange={setDisplay}
          style={{ minWidth: 220 }}
        />
        <Button loading={busy} onClick={() => void load()}>
          Reload
        </Button>
        {canWrite && (
          <>
            <Button type="primary" disabled={!ws || busy} onClick={() => openEditor("create", blank("seasonal"))}>
              New event
            </Button>
            <Button disabled={!ws || busy} onClick={() => openGenerate("daily")}>
              Generate daily drafts
            </Button>
            <Button disabled={!ws || busy} onClick={() => openGenerate("random")}>
              Generate random events
            </Button>
          </>
        )}
      </Space>
      {error && <Alert type="error" showIcon closable message={error} onClose={() => setError("")} />}
      {notice && <Alert type="success" showIcon closable message={notice} onClose={() => setNotice("")} />}
      {ws && ws.conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`${ws.conflicts.length} schedule conflict${ws.conflicts.length > 1 ? "s" : ""}`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {ws.conflicts.map((c) => (
                <li key={c.message}>{c.message}</li>
              ))}
            </ul>
          }
        />
      )}
      <Alert
        type="info"
        showIcon
        message="Server-authoritative schedule"
        description="The server decides what is live. Times are stored as UTC instants; wall-clock times are converted using the event's time zone. Players receive only scheduled, active and recently finished events, and the game falls back to its built-in daily challenge whenever it cannot reach the server."
      />

      <Tabs
        items={[
          {
            key: "schedule",
            label: "Schedule",
            children: (
              <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Input.Search
                    aria-label="Filter events"
                    placeholder="Filter by name or id…"
                    allowClear
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 260 }}
                  />
                  <Select
                    aria-label="Kind filter"
                    value={kindFilter}
                    onChange={setKindFilter}
                    style={{ width: 150 }}
                    options={[{ value: "all", label: "All kinds" }, ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))]}
                  />
                  <Select
                    aria-label="Status filter"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 170 }}
                    options={[
                      { value: "open", label: "Open (not finished)" },
                      { value: "all", label: "All statuses" },
                      ...L.EVENT_STATUSES.filter((s: string) => s !== "archived").map((value: string) => ({ value, label: value })),
                    ]}
                  />
                  {ws && ws.archivedCount > 0 && <span className="muted">{ws.archivedCount} archived (kept in history)</span>}
                </Space>
                <Table<EventRecord>
                  rowKey="id"
                  size="middle"
                  loading={busy && !ws}
                  dataSource={rows}
                  columns={columns}
                  scroll={{ x: 900 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  locale={{ emptyText: <Empty description="No events match" /> }}
                />
              </Card>
            ),
          },
          {
            key: "challenges",
            label: "Daily & weekly",
            children: (
              <Card title="Daily challenge coverage (next 14 days)">
                <p className="muted">
                  A day without a scheduled daily challenge uses the game&apos;s built-in rotation, so the game always has one. Create a draft to take
                  control of a day.
                </p>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={coverage}
                  columns={[
                    { title: "Day", dataIndex: "key" },
                    {
                      title: "Challenge",
                      render: (_: unknown, c: (typeof coverage)[number]) =>
                        c.event ? (
                          <span>
                            {c.event.content.name} <Tag color={STATUS_COLOR[c.event.effectiveStatus]}>{c.event.effectiveStatus}</Tag>
                            <Tag>{c.event.content.rules.difficulty}</Tag>
                            <Tag>board r{c.event.version}·s{c.event.content.rules.scoreVersion}</Tag>
                          </span>
                        ) : (
                          <span className="muted">
                            Built-in rotation: {c.builtin} <Tag>board r0·s1</Tag>
                          </span>
                        ),
                    },
                    {
                      title: "",
                      render: (_: unknown, c: (typeof coverage)[number]) =>
                        !c.event && canWrite ? (
                          <Button
                            size="small"
                            aria-label={`Create daily ${c.key}`}
                            disabled={busy}
                            onClick={() => {
                              const generated = L.generateDailyContents({ startDate: c.key, days: 1, timeZone: "UTC" }).contents[0] as unknown as EventContent;
                              openEditor("create", generated);
                            }}
                          >
                            Create draft
                          </Button>
                        ) : null,
                    },
                  ]}
                />
                {canWrite && (
                  <Space style={{ marginTop: 16 }}>
                    <Button disabled={!ws || busy} onClick={() => openEditor("create", blank("weekly"))}>
                      New weekly challenge
                    </Button>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: "flags",
            label: "Feature flags",
            children: (
              <Card title="Feature flags">
                <p className="muted">
                  Flags take effect for players on their next schedule refresh. Rollout is a stable percentage of installs: raising it never switches an
                  install off.
                </p>
                <Table
                  size="middle"
                  rowKey="key"
                  pagination={false}
                  dataSource={L.FLAG_KEYS.map((key: string) => ({ key }))}
                  columns={[
                    {
                      title: "Flag",
                      render: (_: unknown, row: { key: string }) => (
                        <div>
                          <b>{flagInfo[row.key].label}</b>
                          <div className="muted">
                            {row.key} — {flagInfo[row.key].description}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: "Enabled",
                      render: (_: unknown, row: { key: string }) => (
                        <Switch
                          aria-label={`${flagInfo[row.key].label} enabled`}
                          checked={flags?.[row.key]?.enabled ?? false}
                          disabled={!flags || !canPublish}
                          onChange={(enabled) => setFlags((old) => (old ? { ...old, [row.key]: { ...old[row.key], enabled } } : old))}
                        />
                      ),
                    },
                    {
                      title: "Rollout %",
                      render: (_: unknown, row: { key: string }) => (
                        <InputNumber
                          aria-label={`${flagInfo[row.key].label} rollout percent`}
                          min={0}
                          max={100}
                          precision={0}
                          value={flags?.[row.key]?.rolloutPercent ?? 100}
                          disabled={!flags || !canPublish}
                          onChange={(v) => setFlags((old) => (old ? { ...old, [row.key]: { ...old[row.key], rolloutPercent: v ?? 0 } } : old))}
                        />
                      ),
                    },
                  ]}
                />
                {flagsDirty && <Alert style={{ marginTop: 16 }} type="warning" message="Unsaved flag changes" />}
                {canPublish && (
                  <Space style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      disabled={!flagsDirty || busy}
                      onClick={() =>
                        modal.confirm({
                          title: `Publish flags to ${environment}?`,
                          content: "Players pick the new flags up on their next schedule refresh.",
                          okText: "Confirm",
                          onOk: async () => {
                            await send("/flags", { flags }, (r) => (r.changed === false ? "Flags unchanged." : "Feature flags published."));
                          },
                        })
                      }
                    >
                      Publish flags
                    </Button>
                    <Button disabled={!flagsDirty} onClick={() => ws && setFlags(structuredClone(ws.flags))}>
                      Reset
                    </Button>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: "history",
            label: "History",
            children: (
              <Card title="Event history">
                <Table<HistoryEntry>
                  rowKey="id"
                  size="small"
                  dataSource={history}
                  columns={historyColumns}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  locale={{ emptyText: <Empty description="No history yet" /> }}
                />
                {(cursor === undefined || cursor !== null) && history.length >= 100 && (
                  <Button style={{ marginTop: 12 }} onClick={() => void loadOlder()}>
                    Load older history
                  </Button>
                )}
              </Card>
            ),
          },
        ]}
      />

      {editor && (
        <EventEditor
          key={editor.key}
          open
          mode={editor.mode}
          environment={environment}
          initial={editor.content}
          blank={blank}
          version={editor.record?.version}
          canWrite={canWrite}
          busy={busy}
          error={editorError}
          onSave={(content) => void saveEvent(content)}
          onClose={() => setEditor(null)}
        />
      )}

      <Modal
        open={generate !== null}
        title={generate === "daily" ? "Generate daily drafts" : "Generate random events"}
        okText="Generate drafts"
        confirmLoading={busy}
        onOk={() => void submitGenerate()}
        onCancel={() => setGenerate(null)}
        destroyOnHidden
      >
        <p className="muted">
          {generate === "daily"
            ? "Creates one draft per day using the built-in rotation, so you start from the same twist players would get offline. Days that already have an event are skipped. Nothing is scheduled automatically."
            : "Scatters short events across the range using a seeded generator: the same seed always gives the same schedule. Events never overlap each other or existing ones. Nothing is scheduled automatically."}
        </p>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Radio.Group value={generate} onChange={(e) => openGenerate(e.target.value)} options={[{ value: "daily", label: "Daily" }, { value: "random", label: "Random" }]} />
          {generate === "daily" ? (
            <>
              <label htmlFor="gen-start">First day</label>
              <Input id="gen-start" type="date" value={String(gen.startDate || "")} onChange={(e) => setG("startDate", e.target.value)} />
              <label htmlFor="gen-days">Number of days (1–31)</label>
              <InputNumber id="gen-days" min={1} max={31} precision={0} value={gen.days as number} onChange={(v) => setG("days", v)} />
            </>
          ) : (
            <>
              <label htmlFor="gen-seed">Seed</label>
              <Input id="gen-seed" value={String(gen.seed || "")} onChange={(e) => setG("seed", e.target.value)} />
              <label htmlFor="gen-from">From</label>
              <Input id="gen-from" type="date" value={String(gen.fromDate || "")} onChange={(e) => setG("fromDate", e.target.value)} />
              <label htmlFor="gen-rdays">Days in the range (1–31)</label>
              <InputNumber id="gen-rdays" min={1} max={31} precision={0} value={gen.days as number} onChange={(v) => setG("days", v)} />
              <label htmlFor="gen-count">How many events (1–20)</label>
              <InputNumber id="gen-count" min={1} max={20} precision={0} value={gen.count as number} onChange={(v) => setG("count", v)} />
              <label htmlFor="gen-min">Shortest event (minutes, multiples of 5)</label>
              <InputNumber id="gen-min" min={5} step={5} precision={0} value={(gen.durationMinutes as number[])?.[0]} onChange={(v) => setG("durationMinutes", [v, (gen.durationMinutes as number[])?.[1]])} />
              <label htmlFor="gen-max">Longest event (minutes)</label>
              <InputNumber id="gen-max" min={5} step={5} precision={0} value={(gen.durationMinutes as number[])?.[1]} onChange={(v) => setG("durationMinutes", [(gen.durationMinutes as number[])?.[0], v])} />
              <label htmlFor="gen-gap">Minimum gap (minutes)</label>
              <InputNumber id="gen-gap" min={0} precision={0} value={gen.minGapMinutes as number} onChange={(v) => setG("minGapMinutes", v)} />
              <label htmlFor="gen-h1">Start hour from</label>
              <InputNumber id="gen-h1" min={0} max={23} precision={0} value={(gen.hours as number[])?.[0]} onChange={(v) => setG("hours", [v, (gen.hours as number[])?.[1]])} />
              <label htmlFor="gen-h2">Start hour before</label>
              <InputNumber id="gen-h2" min={1} max={24} precision={0} value={(gen.hours as number[])?.[1]} onChange={(v) => setG("hours", [(gen.hours as number[])?.[0], v])} />
            </>
          )}
          <label htmlFor="gen-zone">Time zone</label>
          <Select id="gen-zone" showSearch value={String(gen.timeZone || "UTC")} options={COMMON_ZONES.map((value) => ({ value }))} onChange={(v) => setG("timeZone", v)} />
        </Space>
      </Modal>
    </Space>
  );
}
