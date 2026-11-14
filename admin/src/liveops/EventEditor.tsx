import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
} from "antd";
import * as L from "../../../shared/live-ops/index.js";
import { request } from "../services/api";
import type { EventContent, Kind, Preview, Reward } from "./types";

// Time zones offered in the picker. Any IANA zone already stored on an event is added to the list.
export const COMMON_ZONES = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const RUNE_LABELS: Record<string, string> = {
  horizontal: "Horizontal —",
  vertical: "Vertical |",
  caret: "Caret ∧",
  v_shape: "V-shape ∨",
  lightning: "Lightning ⚡",
};
const KIND_LABEL: Record<string, string> = {
  daily: "Daily challenge",
  weekly: "Weekly challenge",
  seasonal: "Seasonal event",
  random: "Random event",
};
const METRIC_LABEL: Record<string, string> = {
  runs: "Runs played",
  bestScore: "Best score",
  bestWave: "Best wave / level",
  bestCombo: "Best combo",
};

type Props = {
  open: boolean;
  mode: "create" | "edit" | "view";
  environment: string;
  initial: EventContent;
  /** A complete blank event of a kind, with a schedule that makes sense today */
  blank: (kind: Kind) => EventContent;
  version?: number;
  canWrite: boolean;
  busy: boolean;
  error: string;
  onSave: (content: EventContent) => void;
  onClose: () => void;
};

/** Immutable set at a dotted path: set(content, "rules.enemy.noHearts", true) */
function setIn<T>(root: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: Record<string, unknown> = structuredClone(root) as Record<string, unknown>;
  let node = clone;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys[keys.length - 1]] = value;
  return clone as T;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="liveops-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="muted liveops-hint">{hint}</div>}
    </div>
  );
}

const display = (instant: string) => `${instant.slice(0, 16).replace("T", " ")} UTC`;

export function EventEditor({
  open,
  mode,
  environment,
  initial,
  blank,
  version,
  canWrite,
  busy,
  error,
  onSave,
  onClose,
}: Props) {
  const [content, setContent] = useState<EventContent>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dirty, setDirty] = useState(false);
  const readOnly = mode === "view" || !canWrite;
  const info = (L.KIND_INFO as unknown as Record<string, { calendar: string | null; modes: string[] | null; seeded: boolean; fixedDifficulty: boolean }>)[content.kind];
  const calendar = info.calendar;

  const errors = useMemo(() => L.validateEventContent(content) as string[], [content]);
  const zones = useMemo(
    () => Array.from(new Set([...COMMON_ZONES, content.timeZone])).map((value) => ({ value })),
    [content.timeZone],
  );

  // Ask the server what the schedule means (UTC window, DST problems, conflicts) once the content is well-formed
  useEffect(() => {
    if (!open || mode === "view" || errors.length > 0) {
      setPreview(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      request<Preview>(`/liveops/environments/${environment}/preview`, {
        method: "POST",
        body: JSON.stringify({ content }),
      })
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch(() => {
          if (active) setPreview(null);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, mode, environment, content, errors.length]);

  const change = (path: string, value: unknown) => {
    setContent((old) => setIn(old, path, value));
    setDirty(true);
  };
  const replace = (next: EventContent) => {
    setContent(next);
    setDirty(true);
  };

  const close = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this event?")) return;
    onClose();
  };

  // --- schedule helpers: calendar kinds are aligned for the editor, free kinds take two wall-clock times
  const setDay = (date: string) => {
    if (!L.isDateKey(date)) return;
    const previousAuto = `daily-${content.schedule.startLocal.slice(0, 10)}`;
    let next = setIn(content, "schedule", { startLocal: `${date}T00:00`, endLocal: `${L.addDays(date, 1)}T00:00` });
    if (!next.id || next.id === previousAuto) next = { ...next, id: `daily-${date}` };
    replace(next);
  };
  const setWeek = (date: string) => {
    if (!L.isDateKey(date)) return;
    const monday = L.addDays(date, -(L.isoWeekday(date) - 1));
    const previousAuto = `weekly-${L.isoWeekKey(content.schedule.startLocal.slice(0, 10) || monday).toLowerCase()}`;
    let next = setIn(content, "schedule", { startLocal: `${monday}T00:00`, endLocal: `${L.addDays(monday, 7)}T00:00` });
    if (!next.id || next.id === previousAuto) next = { ...next, id: `weekly-${L.isoWeekKey(monday).toLowerCase()}` };
    replace(next);
  };
  const copyBuiltin = () => {
    const date = content.schedule.startLocal.slice(0, 10);
    const generated = L.generateDailyContents({ startDate: date, days: 1, timeZone: content.timeZone }).contents[0] as unknown as EventContent | undefined;
    if (!generated) return;
    replace({ ...content, name: generated.name, description: generated.description, rules: generated.rules });
  };
  const applyPreset = (presetId: string) => {
    replace(
      L.presetContent(presetId, {
        id: content.id,
        timeZone: content.timeZone,
        schedule: content.schedule,
      }) as unknown as EventContent,
    );
  };

  // --- gesture pool: a weight per rune; the pool lists each rune that many times
  const weights: Record<string, number> = {};
  for (const rune of content.rules.enemy.runes) weights[rune] = (weights[rune] || 0) + 1;
  const setWeight = (rune: string, weight: number) => {
    const next = { ...weights, [rune]: Math.max(0, Math.floor(weight || 0)) };
    change(
      "rules.enemy.runes",
      (L.COMBAT_RUNES as string[]).flatMap((r) => Array(next[r] || 0).fill(r)),
    );
  };

  // --- rewards
  const cosmetics = L.grantableCosmetics() as string[];
  const setReward = (index: number, patch: Partial<Reward>) =>
    change(
      "rewards",
      content.rewards.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  const addReward = () =>
    change("rewards", [
      ...content.rewards,
      {
        id: `reward-${content.rewards.length + 1}`,
        type: "badge",
        ref: "⭐",
        label: "",
        condition: { metric: "runs", threshold: 1 },
      },
    ]);

  const challenge = Boolean(calendar);
  const allErrors = [...errors, ...(errors.length === 0 && preview ? preview.errors : [])];
  const conflicts = preview?.conflicts || [];

  return (
    <Drawer
      title={mode === "create" ? "New event" : mode === "edit" ? `Edit ${content.id}` : `${content.id} (read-only)`}
      open={open}
      width={760}
      onClose={close}
      destroyOnHidden
      extra={version ? <Tag>Version {version}</Tag> : null}
      footer={
        <Space>
          {!readOnly && (
            <Button
              type="primary"
              loading={busy}
              disabled={allErrors.length > 0}
              onClick={() => onSave(content)}
            >
              {mode === "create" ? "Create draft" : "Save draft"}
            </Button>
          )}
          <Button onClick={close}>{readOnly ? "Close" : "Cancel"}</Button>
        </Space>
      }
    >
      {mode === "view" && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Only a draft can be edited"
          description="Unschedule the event to change it. Every change creates a new rules version."
        />
      )}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {allErrors.length > 0 && !readOnly && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Fix these before saving"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {allErrors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          }
        />
      )}

      <Divider orientation="left">Basics</Divider>
      <div className="liveops-grid">
        <Field label="Kind" htmlFor="ev-kind">
          <Select
            id="ev-kind"
            aria-label="Kind"
            value={content.kind}
            disabled={readOnly || mode === "edit"}
            options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(kind) => {
              replace({ ...blank(kind), name: content.name, description: content.description, timeZone: content.timeZone });
            }}
          />
        </Field>
        <Field label="Event ID" htmlFor="ev-id" hint="Lowercase letters, digits and hyphens. Cannot change once created.">
          <Input
            id="ev-id"
            aria-label="Event ID"
            value={content.id}
            maxLength={48}
            disabled={readOnly || mode === "edit"}
            onChange={(e) => change("id", e.target.value)}
          />
        </Field>
      </div>
      {!challenge && !readOnly && (
        <Field label="Start from a preset" htmlFor="ev-preset">
          <Select
            id="ev-preset"
            aria-label="Preset"
            placeholder="Choose a preset to fill the rules"
            allowClear
            options={(L.EVENT_PRESETS as unknown as { id: string; kind: string; name: string }[])
              .filter((p) => p.kind === content.kind)
              .map((p) => ({ value: p.id, label: p.name }))}
            onChange={(value) => value && applyPreset(value)}
          />
        </Field>
      )}
      <Field label="Name" htmlFor="ev-name" hint="Shown to players. Plain text only.">
        <Input
          id="ev-name"
          aria-label="Name"
          value={content.name}
          maxLength={L.LIMITS.name}
          disabled={readOnly}
          onChange={(e) => change("name", e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="ev-description">
        <Input.TextArea
          id="ev-description"
          aria-label="Description"
          value={content.description}
          maxLength={L.LIMITS.description}
          rows={3}
          disabled={readOnly}
          onChange={(e) => change("description", e.target.value)}
        />
      </Field>

      <Divider orientation="left">Schedule</Divider>
      <Field
        label="Time zone"
        htmlFor="ev-zone"
        hint={
          challenge
            ? "The zone that defines where the day or week begins and ends."
            : "Times below are wall-clock times in this zone; the server converts them to UTC."
        }
      >
        <Select
          id="ev-zone"
          aria-label="Time zone"
          showSearch
          value={content.timeZone}
          options={zones}
          disabled={readOnly}
          onChange={(zone) => change("timeZone", zone)}
        />
      </Field>
      {calendar === "day" && (
        <Field label="Day" htmlFor="ev-day" hint="A daily challenge always covers one whole calendar day of the zone (23–25 hours when the clocks change).">
          <Input
            id="ev-day"
            aria-label="Day"
            type="date"
            value={content.schedule.startLocal.slice(0, 10)}
            disabled={readOnly}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
      )}
      {calendar === "week" && (
        <Field label="Week containing" htmlFor="ev-week" hint="A weekly challenge runs Monday 00:00 to the next Monday 00:00.">
          <Input
            id="ev-week"
            aria-label="Week containing"
            type="date"
            value={content.schedule.startLocal.slice(0, 10)}
            disabled={readOnly}
            onChange={(e) => setWeek(e.target.value)}
          />
        </Field>
      )}
      {!calendar && (
        <div className="liveops-grid">
          <Field label="Starts" htmlFor="ev-start">
            <Input
              id="ev-start"
              aria-label="Starts"
              type="datetime-local"
              value={content.schedule.startLocal}
              disabled={readOnly}
              onChange={(e) => change("schedule.startLocal", e.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="ev-end">
            <Input
              id="ev-end"
              aria-label="Ends"
              type="datetime-local"
              value={content.schedule.endLocal}
              disabled={readOnly}
              onChange={(e) => change("schedule.endLocal", e.target.value)}
            />
          </Field>
        </div>
      )}
      {preview?.window && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`UTC window: ${display(preview.window.startsAt)} → ${display(preview.window.endsAt)}`}
          description={
            challenge
              ? `Challenge key ${preview.window.challengeKey}. Seeds are derived from this key, so everyone gets the same ghosts.`
              : "Authoritative instants stored by the server."
          }
        />
      )}
      {conflicts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="This event would conflict when scheduled"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {conflicts.map((c) => (
                <li key={c.message}>{c.message}</li>
              ))}
            </ul>
          }
        />
      )}

      <Divider orientation="left">Eligibility</Divider>
      <Field
        label="Run types"
        hint={
          info.modes
            ? `A ${content.kind} challenge is always its own run type.`
            : "Enemy, spawn and score changes affect Endless runs. Story levels are authored, so a Story event may only change visuals and rewards."
        }
      >
        <Checkbox.Group
          aria-label="Run types"
          value={content.eligibility.modes}
          disabled={readOnly || Boolean(info.modes)}
          options={(info.modes ? info.modes : (L.OVERLAY_MODES as string[])).map((value) => ({ value, label: value }))}
          onChange={(values) => change("eligibility.modes", values)}
        />
      </Field>
      {!challenge && (
        <Field label="Difficulties" hint="Leave empty for all difficulties.">
          <Checkbox.Group
            aria-label="Difficulties"
            value={content.eligibility.difficulties}
            disabled={readOnly}
            options={(L.DIFFICULTY_IDS as string[]).map((value) => ({ value, label: value }))}
            onChange={(values) => change("eligibility.difficulties", values)}
          />
        </Field>
      )}
      <div className="liveops-grid">
        <Field label="Story levels cleared (minimum)" htmlFor="ev-story">
          <InputNumber
            id="ev-story"
            aria-label="Minimum story levels cleared"
            min={0}
            max={5}
            precision={0}
            value={content.eligibility.minStoryLevelsCleared}
            disabled={readOnly}
            onChange={(v) => change("eligibility.minStoryLevelsCleared", v ?? 0)}
          />
        </Field>
        <Field label="Assisted runs" hint="An assisted run (slow-motion assist, alternative input) never raises a best score, wave or combo.">
          <Switch
            aria-label="Allow assisted runs"
            checked={content.eligibility.allowAssisted}
            disabled={readOnly}
            onChange={(v) => change("eligibility.allowAssisted", v)}
          />
        </Field>
      </div>

      <Divider orientation="left">Rules</Divider>
      <div className="liveops-grid">
        <Field label="Difficulty" htmlFor="ev-difficulty" hint={info.fixedDifficulty ? "Fixed, so scores are comparable." : "An event never overrides the player's choice."}>
          <Select
            id="ev-difficulty"
            aria-label="Difficulty"
            value={content.rules.difficulty}
            disabled={readOnly || !info.fixedDifficulty}
            options={(info.fixedDifficulty ? (L.DIFFICULTY_IDS as string[]) : ["PLAYER"]).map((value) => ({ value }))}
            onChange={(v) => change("rules.difficulty", v)}
          />
        </Field>
        <Field label="Score version" htmlFor="ev-score-version" hint="1 = classic score. 2 also applies the score multiplier below. Scores of different versions are never compared.">
          <Select
            id="ev-score-version"
            aria-label="Score version"
            value={content.rules.scoreVersion}
            disabled={readOnly}
            options={(L.SCORE_VERSIONS as number[]).map((value) => ({ value, label: `Version ${value}` }))}
            onChange={(v) => {
              change("rules.scoreVersion", v);
              if (v < 2) change("rules.score.multiplier", 1);
            }}
          />
        </Field>
        <Field label="Score multiplier" htmlFor="ev-score-mult">
          <InputNumber
            id="ev-score-mult"
            aria-label="Score multiplier"
            min={1}
            max={3}
            step={0.05}
            value={content.rules.score.multiplier}
            disabled={readOnly || content.rules.scoreVersion < 2}
            onChange={(v) => change("rules.score.multiplier", v ?? 1)}
          />
        </Field>
        {info.seeded && (
          <Field label="Seed salt" htmlFor="ev-salt" hint="Empty = the standard seed for the date (the same ghosts as the built-in daily). A salt re-rolls the sequence.">
            <Input
              id="ev-salt"
              aria-label="Seed salt"
              value={content.rules.seedSalt}
              maxLength={L.LIMITS.seedSalt}
              disabled={readOnly}
              onChange={(e) => change("rules.seedSalt", e.target.value)}
            />
          </Field>
        )}
      </div>
      {content.kind === "daily" && !readOnly && (
        <Button size="small" onClick={copyBuiltin} style={{ marginBottom: 12 }}>
          Copy the built-in twist for this date
        </Button>
      )}
      <div className="liveops-grid">
        <Field label="Enemy speed ×" htmlFor="ev-speed">
          <InputNumber
            id="ev-speed"
            aria-label="Enemy speed multiplier"
            min={0.5}
            max={2}
            step={0.05}
            value={content.rules.enemy.speedMultiplier}
            disabled={readOnly}
            onChange={(v) => change("rules.enemy.speedMultiplier", v ?? 1)}
          />
        </Field>
        <Field label="Spawn interval ×" htmlFor="ev-interval" hint="Smaller = more ghosts at once.">
          <InputNumber
            id="ev-interval"
            aria-label="Spawn interval multiplier"
            min={0.5}
            max={2}
            step={0.05}
            value={content.rules.spawn.intervalMultiplier}
            disabled={readOnly}
            onChange={(v) => change("rules.spawn.intervalMultiplier", v ?? 1)}
          />
        </Field>
        <Field label="Surprise chance ×" htmlFor="ev-surprise" hint="Golden ghosts, meteor showers, blood moons.">
          <InputNumber
            id="ev-surprise"
            aria-label="Surprise multiplier"
            min={0}
            max={3}
            step={0.1}
            value={content.rules.spawn.surpriseMultiplier}
            disabled={readOnly}
            onChange={(v) => change("rules.spawn.surpriseMultiplier", v ?? 1)}
          />
        </Field>
        <Field label="Starting hearts" htmlFor="ev-hp" hint="0 = unchanged.">
          <InputNumber
            id="ev-hp"
            aria-label="Starting hearts"
            min={0}
            max={5}
            precision={0}
            value={content.rules.player.maxHp}
            disabled={readOnly}
            onChange={(v) => change("rules.player.maxHp", v ?? 0)}
          />
        </Field>
        <Field label="No healing ghosts">
          <Switch
            aria-label="No healing ghosts"
            checked={content.rules.enemy.noHearts}
            disabled={readOnly}
            onChange={(v) => change("rules.enemy.noHearts", v)}
          />
        </Field>
      </div>
      <Field
        label="Gesture pool"
        hint="Weight 0 everywhere = no restriction. Otherwise ghosts only carry the listed gestures; a weight of 2 makes a gesture twice as likely."
      >
        <Space wrap>
          {(L.COMBAT_RUNES as string[]).map((rune) => (
            <span key={rune}>
              {RUNE_LABELS[rune]}{" "}
              <InputNumber
                aria-label={`Weight ${RUNE_LABELS[rune]}`}
                min={0}
                max={4}
                precision={0}
                value={weights[rune] || 0}
                disabled={readOnly}
                onChange={(v) => setWeight(rune, v ?? 0)}
                style={{ width: 64 }}
              />
            </span>
          ))}
        </Space>
      </Field>
      <div className="liveops-grid">
        <Field label="Visual theme" htmlFor="ev-theme">
          <Select
            id="ev-theme"
            aria-label="Visual theme"
            value={content.rules.visual.theme}
            disabled={readOnly}
            options={(L.VISUAL_THEMES as string[]).map((value) => ({ value }))}
            onChange={(v) => change("rules.visual.theme", v)}
          />
        </Field>
        <Field label="Ambient effect" htmlFor="ev-ambient">
          <Select
            id="ev-ambient"
            aria-label="Ambient effect"
            value={content.rules.visual.ambient}
            disabled={readOnly}
            options={(L.AMBIENT_EFFECTS as string[]).map((value) => ({ value }))}
            onChange={(v) => change("rules.visual.ambient", v)}
          />
        </Field>
      </div>

      <Divider orientation="left">Rewards</Divider>
      <p className="muted">
        Cosmetics come from the game&apos;s wardrobe; the server rejects anything else. A reward is granted once, when the
        player&apos;s progress during the event reaches its threshold.
      </p>
      {content.rewards.map((reward, index) => (
        <div className="liveops-reward" key={index}>
          <Input
            aria-label={`Reward ${index + 1} ID`}
            value={reward.id}
            maxLength={L.LIMITS.rewardId}
            disabled={readOnly}
            onChange={(e) => setReward(index, { id: e.target.value })}
            style={{ width: 150 }}
          />
          <Select
            aria-label={`Reward ${index + 1} type`}
            value={reward.type}
            disabled={readOnly}
            style={{ width: 110 }}
            options={[{ value: "cosmetic" }, { value: "badge" }]}
            onChange={(type) => setReward(index, type === "cosmetic" ? { type, ref: cosmetics[0], label: "" } : { type, ref: "⭐", label: "" })}
          />
          {reward.type === "cosmetic" ? (
            <Select
              aria-label={`Reward ${index + 1} cosmetic`}
              value={reward.ref}
              disabled={readOnly}
              style={{ width: 170 }}
              options={cosmetics.map((value) => ({ value }))}
              onChange={(ref) => setReward(index, { ref })}
            />
          ) : (
            <>
              <Input
                aria-label={`Reward ${index + 1} icon`}
                value={reward.ref}
                maxLength={8}
                disabled={readOnly}
                style={{ width: 70 }}
                onChange={(e) => setReward(index, { ref: e.target.value })}
              />
              <Input
                aria-label={`Reward ${index + 1} label`}
                value={reward.label}
                maxLength={L.LIMITS.badgeLabel}
                disabled={readOnly}
                style={{ width: 170 }}
                placeholder="Badge name"
                onChange={(e) => setReward(index, { label: e.target.value })}
              />
            </>
          )}
          <Select
            aria-label={`Reward ${index + 1} metric`}
            value={reward.condition.metric}
            disabled={readOnly}
            style={{ width: 160 }}
            options={Object.entries(METRIC_LABEL).map(([value, label]) => ({ value, label }))}
            onChange={(metric) => setReward(index, { condition: { ...reward.condition, metric } })}
          />
          <InputNumber
            aria-label={`Reward ${index + 1} threshold`}
            min={1}
            precision={0}
            value={reward.condition.threshold}
            disabled={readOnly}
            onChange={(v) => setReward(index, { condition: { ...reward.condition, threshold: v ?? 1 } })}
          />
          {!readOnly && (
            <Button
              aria-label={`Remove reward ${index + 1}`}
              onClick={() => change("rewards", content.rewards.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      {!readOnly && content.rewards.length < L.LIMITS.rewards && (
        <Button onClick={addReward}>Add reward</Button>
      )}

      <Divider orientation="left">Announcement</Divider>
      <Field label="Show an announcement in the game">
        <Switch
          aria-label="Announcement enabled"
          checked={content.announcement.enabled}
          disabled={readOnly}
          onChange={(v) => change("announcement.enabled", v)}
        />
      </Field>
      {content.announcement.enabled && (
        <>
          <div className="liveops-grid">
            <Field label="Title" htmlFor="ev-ann-title">
              <Input
                id="ev-ann-title"
                aria-label="Announcement title"
                value={content.announcement.title}
                maxLength={L.LIMITS.announcementTitle}
                disabled={readOnly}
                onChange={(e) => change("announcement.title", e.target.value)}
              />
            </Field>
            <Field label="Tone" htmlFor="ev-ann-tone">
              <Select
                id="ev-ann-tone"
                aria-label="Announcement tone"
                value={content.announcement.tone}
                disabled={readOnly}
                options={(L.ANNOUNCEMENT_TONES as string[]).map((value) => ({ value }))}
                onChange={(v) => change("announcement.tone", v)}
              />
            </Field>
          </div>
          <Field label="Message" htmlFor="ev-ann-body">
            <Input.TextArea
              id="ev-ann-body"
              aria-label="Announcement message"
              value={content.announcement.body}
              maxLength={L.LIMITS.announcementBody}
              rows={2}
              disabled={readOnly}
              onChange={(e) => change("announcement.body", e.target.value)}
            />
          </Field>
          <Field label="Teaser lead time (hours)" htmlFor="ev-ann-lead" hint="Announce this long before the start. 0 = only while it is running.">
            <InputNumber
              id="ev-ann-lead"
              aria-label="Announcement lead hours"
              min={0}
              max={L.LIMITS.leadHours}
              precision={0}
              value={content.announcement.leadHours}
              disabled={readOnly}
              onChange={(v) => change("announcement.leadHours", v ?? 0)}
            />
          </Field>
        </>
      )}
    </Drawer>
  );
}
