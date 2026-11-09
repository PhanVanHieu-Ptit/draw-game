import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Input,
  InputNumber,
  Modal,
  Select,
  Slider,
  Space,
  Tabs,
  Tag,
} from "antd";
import {
  contentSchema,
  contentDefaults,
  createContentValue,
  validateContent,
  contentTimeline,
} from "../../shared/gameplay-content.js";
import { Enemy } from "../../src/entities/Enemy.js";
import { request } from "./services/api";
import { useAuth } from "./auth/Auth";

type Schema = {
  type: string;
  fields?: Record<string, Schema>;
  item?: Schema;
  options?: string[];
  collection?: string;
  min?: number;
  max?: number;
  integer?: boolean;
};
import type {
  Content,
  EnemyDefinition,
} from "../../shared/gameplay-content.types";
type State = {
  revision: number;
  draft: { values: Content; status: string } | null;
  published: { values: Content } | null;
  versions: { id: string; createdAt: string }[];
};
// Schema-driven controls are shared by all three editors, including nested phases and groups.
function Fields({
  schema,
  value,
  onChange,
  content,
  path,
}: {
  schema: Schema;
  value: any;
  onChange: (v: any) => void;
  content: Content;
  path: string;
}) {
  if (schema.type === "object")
    return (
      <div className="gameplay-fields">
        {Object.entries(schema.fields!).map(([key, s]) => (
          <div key={key}>
            <label>{key}</label>
            <Fields
              schema={s}
              value={value[key]}
              onChange={(v) => onChange({ ...value, [key]: v })}
              content={content}
              path={`${path}.${key}`}
            />
          </div>
        ))}
      </div>
    );
  if (schema.type === "array")
    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        {value.map((v: any, i: number) => (
          <Card
            size="small"
            key={i}
            title={`${v.name || v.id || path.split(".").at(-1)} ${i + 1}`}
            extra={
              <Space>
                <Button
                  onClick={() => {
                    const copy = structuredClone(v);
                    if (copy && typeof copy === "object" && "id" in copy)
                      copy.id = `${copy.id}-${crypto.randomUUID().slice(0, 8)}`;
                    onChange([
                      ...value.slice(0, i + 1),
                      copy,
                      ...value.slice(i + 1),
                    ]);
                  }}
                >
                  Duplicate
                </Button>
                <Button
                  danger
                  onClick={() =>
                    onChange(value.filter((_: any, j: number) => j !== i))
                  }
                >
                  Remove
                </Button>
              </Space>
            }
          >
            <Fields
              schema={schema.item!}
              value={v}
              onChange={(next) =>
                onChange(
                  value.map((old: any, j: number) => (j === i ? next : old)),
                )
              }
              content={content}
              path={`${path}.${i}`}
            />
          </Card>
        ))}
        <Button
          onClick={() => {
            const next = createContentValue(schema.item);
            if (next && typeof next === "object" && "id" in next)
              next.id = `${next.id}-${crypto.randomUUID().slice(0, 8)}`;
            onChange([...value, next]);
          }}
        >
          Add {path.split(".").at(-1)}
        </Button>
      </Space>
    );
  if (schema.type === "number")
    return (
      <InputNumber
        aria-label={path}
        min={schema.min}
        max={schema.max}
        precision={schema.integer ? 0 : undefined}
        value={value}
        onChange={onChange}
      />
    );
  if (schema.type === "choice" || schema.type === "reference")
    return (
      <Select
        aria-label={path}
        style={{ minWidth: 180 }}
        value={value}
        onChange={onChange}
        options={
          schema.type === "choice"
            ? schema.options!.map((v) => ({ value: v, label: v }))
            : [
                { value: "", label: "None" },
                ...(content[schema.collection as keyof Content] || []).map(
                  (v) => ({ value: v.id, label: `${v.name} (${v.id})` }),
                ),
              ]
        }
      />
    );
  return (
    <Input
      aria-label={path}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function RuntimePreview({
  definition,
}: {
  definition: EnemyDefinition | undefined;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!definition || !canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return;
    const enemy = new Enemy({
      type: definition.archetype,
      x: 240,
      y: 170,
      symbolQueue: definition.gestures,
      canvasWidth: 480,
      canvasHeight: 320,
    });
    ctx.clearRect(0, 0, 480, 320);
    enemy.render(ctx);
  }, [definition]);
  return (
    <canvas
      ref={canvas}
      width={480}
      height={320}
      style={{ maxWidth: "100%", background: "#151326" }}
      aria-label="Game runtime enemy appearance"
    />
  );
}
export function GameplayPage() {
  const { can } = useAuth();
  const [environment, setEnvironment] = useState("development");
  const [state, setState] = useState<State | null>(null),
    [values, setValues] = useState<Content>(
      structuredClone(contentDefaults) as Content,
    );
  const [past, setPast] = useState<Content[]>([]),
    [future, setFuture] = useState<Content[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [rollback, setRollback] = useState<string>();
  const errors = validateContent(values);
  const dirty =
    JSON.stringify(values) !==
    JSON.stringify(
      state?.draft?.values || state?.published?.values || contentDefaults,
    );
  const update = (next: Content) => {
    setPast((p) => [...p.slice(-49), values]);
    setFuture([]);
    setValues(next);
  };
  const load = async () => {
    setBusy(true);
    try {
      const s = await request<State>(`/gameplay/environments/${environment}`);
      setState(s);
      setValues(
        structuredClone(
          s.draft?.values || s.published?.values || contentDefaults,
        ) as Content,
      );
      setPast([]);
      setFuture([]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setState(null);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [environment]);
  useEffect(() => {
    const linkHandler = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as HTMLElement).closest("a") &&
        !window.confirm("Discard unsaved content changes?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", linkHandler, true);
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", linkHandler, true);
    };
  }, [dirty]);
  const duration = Math.max(
    1,
    ...values.waves.map((w) => w.start + w.duration),
  );
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setTime((t) => {
          if (t >= duration) {
            setPlaying(false);
            return duration;
          }
          return Math.min(duration, t + 0.1);
        }),
      100,
    );
    return () => clearInterval(timer);
  }, [playing, duration]);
  const act = async (action: string) => {
    if (!state) return;
    setBusy(true);
    try {
      const s = await request<State>(
        `/gameplay/environments/${environment}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            revision: state.revision,
            values,
            versionId: rollback,
          }),
        },
      );
      setState(s);
      setValues(
        structuredClone(
          s.draft?.values || s.published?.values || contentDefaults,
        ) as Content,
      );
      setPast([]);
      setFuture([]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const events: {
    time: number;
    waveId: string;
    enemyId: string;
    direction: string;
  }[] = errors.length ? [] : contentTimeline(values);
  const current = events.filter((e) => e.time <= time).at(-1);
  const definition =
    [...values.enemies, ...values.bosses].find(
      (e) => e.id === current?.enemyId,
    ) ||
    values.enemies[0] ||
    values.bosses[0];
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <h1>Gameplay content studio</h1>
      <Space wrap>
        <Select
          aria-label="Content environment"
          value={environment}
          disabled={busy}
          options={["development", "staging", "production"].map((value) => ({
            value,
          }))}
          onChange={(env) => {
            if (!dirty || window.confirm("Discard unsaved changes?")) {
              setState(null);
              setEnvironment(env);
            }
          }}
        />
        <Tag>Revision {state?.revision ?? "—"}</Tag>
        <Tag>{state?.draft?.status || "No draft"}</Tag>
        <Button
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes?"))
              void load();
          }}
        >
          Reload
        </Button>
        <Button
          disabled={!past.length || busy}
          onClick={() => {
            setFuture((f) => [values, ...f]);
            setValues(past.at(-1)!);
            setPast((p) => p.slice(0, -1));
          }}
        >
          Undo
        </Button>
        <Button
          disabled={!future.length || busy}
          onClick={() => {
            setPast((p) => [...p, values]);
            setValues(future[0]);
            setFuture((f) => f.slice(1));
          }}
        >
          Redo
        </Button>
        <Button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [JSON.stringify({ schemaVersion: 1, values }, null, 2)],
                { type: "application/json" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `gameplay-${environment}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </Button>
        {can("configuration:write") && (
          <label>
            Import JSON{" "}
            <input
              aria-label="Import gameplay JSON"
              type="file"
              accept=".json,application/json"
              disabled={!state || busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 1000000) throw Error("Import exceeds 1 MB");
                  const data = JSON.parse(await file.text());
                  if (data.schemaVersion !== 1)
                    throw Error("Unsupported schema version");
                  const issues = validateContent(data.values);
                  if (issues.length) throw Error(issues.join("; "));
                  update(data.values);
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
        )}
      </Space>
      {error && <Alert type="error" message={error} />}{" "}
      {dirty && <Alert type="warning" message="Unsaved content changes" />}
      {!!errors.length && (
        <Alert
          type="error"
          message="Content validation"
          description={errors.join("; ")}
        />
      )}
      <fieldset
        disabled={!state || busy || !can("configuration:write")}
        style={{ border: 0, padding: 0 }}
      >
        <Tabs
          items={(["enemies", "bosses", "waves"] as const).map((key) => ({
            key,
            label: `${key[0].toUpperCase() + key.slice(1)} editor`,
            children: (
              <Fields
                schema={(contentSchema as unknown as Schema).fields![key]}
                value={values[key]}
                onChange={(v) => update({ ...values, [key]: v })}
                content={values}
                path={key}
              />
            ),
          }))}
        />
      </fieldset>
      <Card title="Wave timeline · seconds">
        <div
          style={{
            position: "relative",
            minHeight: Math.max(60, values.waves.length * 44),
          }}
        >
          {values.waves.map((w, i) => (
            <Button
              key={i}
              style={{
                position: "absolute",
                top: i * 44,
                left: `${(w.start / duration) * 85}%`,
                width: `${Math.max(5, (w.duration / duration) * 85)}%`,
                overflow: "hidden",
              }}
              onClick={() => setTime(w.start)}
            >
              {w.name} · {w.start}s
            </Button>
          ))}
        </div>
        <Slider
          aria-label="Preview time"
          min={0}
          max={duration}
          step={0.1}
          value={time}
          onChange={setTime}
        />
        <Button
          disabled={!!errors.length}
          onClick={() => {
            if (time >= duration) setTime(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play sequence"}
        </Button>{" "}
        <Tag>{time.toFixed(1)}s</Tag>
        <p>
          Spawn schedule preview with the existing game renderer. Combat, custom
          phase execution, and asset playback are not simulated. Publication
          stores a content release; game delivery must consume this contract
          before releases affect live runs.
        </p>
        <RuntimePreview definition={definition} />
        <Collapse
          items={[
            {
              key: "events",
              label: `Spawn events (${events.length})`,
              children: (
                <ol>
                  {events
                    .filter((e) => e.time <= time)
                    .slice(-100)
                    .map((e, i) => (
                      <li key={i}>
                        {e.time.toFixed(2)}s · {e.waveId} · {e.enemyId} ·{" "}
                        {e.direction}
                      </li>
                    ))}
                </ol>
              ),
            },
          ]}
        />
      </Card>
      <Space wrap>
        {can("configuration:write") && (
          <>
            <Button
              disabled={!state || busy || !!errors.length}
              onClick={() => void act("save")}
            >
              Save draft
            </Button>
            <Button
              disabled={busy || dirty || state?.draft?.status !== "draft"}
              onClick={() => void act("validate")}
            >
              Validate
            </Button>
          </>
        )}
        {can("configuration:review") && (
          <Button
            disabled={busy || dirty || state?.draft?.status !== "validated"}
            onClick={() => void act("review")}
          >
            Mark reviewed
          </Button>
        )}
        {can("configuration:publish") && (
          <Button
            type="primary"
            disabled={busy || dirty || state?.draft?.status !== "reviewed"}
            onClick={() =>
              Modal.confirm({
                title: `Publish gameplay to ${environment}?`,
                onOk: () => act("publish"),
              })
            }
          >
            Publish
          </Button>
        )}
      </Space>
      <Card title="Publication history">
        <Select
          placeholder="Select release"
          value={rollback}
          onChange={setRollback}
          style={{ minWidth: 280 }}
          options={state?.versions.map((v) => ({
            value: v.id,
            label: `${v.createdAt} · ${v.id.slice(0, 8)}`,
          }))}
        />
        {can("configuration:publish") && (
          <Button
            disabled={!rollback || dirty || busy}
            onClick={() =>
              Modal.confirm({
                title: "Rollback gameplay release?",
                onOk: () => act("rollback"),
              })
            }
          >
            Rollback
          </Button>
        )}
      </Card>
    </Space>
  );
}
