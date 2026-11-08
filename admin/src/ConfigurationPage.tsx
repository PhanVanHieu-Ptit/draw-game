import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  defaults,
  fields,
  validateConfig,
  previewConfig,
} from "../../shared/game-configuration.js";
import { request } from "./services/api";
import { useAuth } from "./auth/Auth";

type Values = Record<string, Record<string, number | string | boolean>>;
type Version = { id: string; createdAt: string; values: Values };
type State = {
  revision: number;
  published: Version | null;
  draft: { values: Values; status: string } | null;
  versions: Version[];
};
const labels: Record<string, string> = {
  global: "Global settings",
  difficulty: "Difficulty profiles",
  gestures: "Gesture thresholds",
  combat: "Combat and damage",
  combo: "Combo and scoring",
  spells: "Spell cooldowns",
  modes: "Game modes",
  visuals: "Effects and performance",
  accessibility: "Accessibility",
  flags: "Feature flags",
};
export function ConfigurationPage() {
  const { can } = useAuth();
  const [environment, setEnvironment] = useState("development");
  const [state, setState] = useState<State | null>(null);
  const [values, setValues] = useState<Values>(structuredClone(defaults));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [rollback, setRollback] = useState<string>();
  const baseline = state?.draft?.values || state?.published?.values || defaults;
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const errors = validateConfig(values);
  const load = async (env = environment) => {
    setBusy(true);
    setError("");
    try {
      const next = await request<State>(`/configuration/environments/${env}`);
      setState(next);
      setValues(
        structuredClone(
          next.draft?.values || next.published?.values || defaults,
        ),
      );
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
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const linkHandler = (event: MouseEvent) => {
      if (
        dirty &&
        (event.target as HTMLElement).closest("a") &&
        !window.confirm("Discard unsaved configuration changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", linkHandler, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", linkHandler, true);
    };
  }, [dirty]);
  const act = async (action: string) => {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      const next = await request<State>(
        `/configuration/environments/${environment}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            revision: state.revision,
            values,
            versionId: rollback,
          }),
        },
      );
      setState(next);
      setValues(
        structuredClone(
          next.draft?.values || next.published?.values || defaults,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const comparison = Object.entries(values).flatMap(([group, entries]) =>
    Object.entries(entries).map(([key, draft]) => ({
      key: `${group}.${key}`,
      published: String(
        state?.published?.values[group]?.[key] ?? "Not published",
      ),
      draft: String(draft),
    })),
  );
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <h1>Game Configuration</h1>
      <Space wrap>
        <Select
          disabled={busy}
          aria-label="Environment"
          value={environment}
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
          loading={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes?"))
              void load();
          }}
        >
          Reload
        </Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} />}
      {dirty && <Alert type="warning" message="Unsaved changes" />}
      {!state?.published && (
        <Alert
          type="info"
          message="No published configuration. Game clients use local defaults."
        />
      )}
      {errors.length > 0 && <Alert type="error" message={errors.join("; ")} />}
      <Tabs
        items={Object.entries(fields).map(([group, entries]) => ({
          key: group,
          label: labels[group],
          children: (
            <Card title={labels[group]}>
              <Row gutter={[24, 24]}>
                {Object.entries(entries).map(([key, spec]) => (
                  <Col xs={24} md={12} key={key}>
                    <label htmlFor={`${group}-${key}`}>{key}</label>
                    <div>
                      Published:{" "}
                      {String(
                        state?.published?.values[group]?.[key] ??
                          "Not published",
                      )}
                    </div>
                    <div>
                      Draft:{" "}
                      {String(
                        state?.draft?.values[group]?.[key] ?? "Not saved",
                      )}
                    </div>
                    {typeof spec === "boolean" ? (
                      <Switch
                        id={`${group}-${key}`}
                        aria-label={key}
                        checked={Boolean(values[group][key])}
                        disabled={!state || !can("configuration:write")}
                        onChange={(v) =>
                          setValues((old) => ({
                            ...old,
                            [group]: { ...old[group], [key]: v },
                          }))
                        }
                      />
                    ) : Array.isArray(spec) && typeof spec[0] === "string" ? (
                      <Select
                        id={`${group}-${key}`}
                        aria-label={key}
                        value={String(values[group][key])}
                        options={spec.map((v) => ({ value: String(v) }))}
                        disabled={!state || !can("configuration:write")}
                        onChange={(v) =>
                          setValues((old) => ({
                            ...old,
                            [group]: { ...old[group], [key]: v },
                          }))
                        }
                      />
                    ) : (
                      <InputNumber
                        id={`${group}-${key}`}
                        aria-label={key}
                        value={Number(values[group][key])}
                        disabled={!state || !can("configuration:write")}
                        onChange={(v) =>
                          setValues((old) => ({
                            ...old,
                            [group]: { ...old[group], [key]: v as number },
                          }))
                        }
                      />
                    )}
                  </Col>
                ))}
              </Row>
            </Card>
          ),
        }))}
      />
      <Space wrap>
        <Button
          disabled={!state}
          onClick={() =>
            setValues(structuredClone(state?.published?.values || defaults))
          }
        >
          Reset to published
        </Button>
        <Button onClick={() => setPreview(true)}>Preview</Button>
        {can("configuration:write") && (
          <>
            <Button
              disabled={!state || !!errors.length || busy}
              onClick={() => void act("save")}
            >
              Save draft
            </Button>
            <Button
              disabled={dirty || state?.draft?.status !== "draft" || busy}
              onClick={() => void act("validate")}
            >
              Validate
            </Button>
          </>
        )}
        {can("configuration:review") && (
          <Button
            disabled={dirty || state?.draft?.status !== "validated" || busy}
            onClick={() => void act("review")}
          >
            Mark reviewed
          </Button>
        )}
        {can("configuration:publish") && (
          <Button
            type="primary"
            disabled={dirty || state?.draft?.status !== "reviewed" || busy}
            onClick={() =>
              Modal.confirm({
                title: `Publish to ${environment}?`,
                content: "New runs will use these values.",
                onOk: () => act("publish"),
              })
            }
          >
            Publish
          </Button>
        )}
      </Space>
      <Card title="Configuration comparison">
        <Table
          size="small"
          dataSource={comparison}
          columns={[
            { title: "Setting", dataIndex: "key" },
            { title: "Published", dataIndex: "published" },
            { title: "Working values", dataIndex: "draft" },
          ]}
        />
      </Card>
      <Card title="Published history and rollback">
        <Space wrap>
          <Select
            aria-label="Rollback version"
            placeholder="Select a version"
            style={{ minWidth: 280 }}
            options={state?.versions.map((v) => ({
              value: v.id,
              label: `${v.createdAt} · ${v.id.slice(0, 8)}`,
            }))}
            onChange={setRollback}
            value={rollback}
          />
          {can("configuration:publish") && (
            <Button
              disabled={!rollback || busy || dirty}
              onClick={() =>
                Modal.confirm({
                  title: `Rollback ${environment}?`,
                  content:
                    "Creates a new publication from the selected version and clears the draft.",
                  onOk: () => act("rollback"),
                })
              }
            >
              Rollback
            </Button>
          )}
        </Space>
      </Card>
      <Modal
        title="Rules preview"
        open={preview}
        onCancel={() => setPreview(false)}
        footer={null}
      >
        <pre>{JSON.stringify(previewConfig(values), null, 2)}</pre>
      </Modal>
    </Space>
  );
}
