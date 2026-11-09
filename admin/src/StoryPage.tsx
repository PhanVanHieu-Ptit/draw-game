import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { request } from "./services/api";
import { useAuth } from "./auth/Auth";
import {
  NODE_TYPES,
  EXPRESSIONS,
  validateStory,
  localize,
  createSession,
  advance,
} from "../../shared/story/engine.js";

type Edge = { to: string; labelKey?: string };
type Node = {
  id: string;
  chapter: number;
  type: string;
  textKey?: string;
  who?: string;
  expression?: string;
  once?: boolean;
  position: { x: number; y: number };
  edges: Edge[];
  [key: string]: unknown;
};
type Story = {
  schemaVersion: number;
  chapters: { id: number; titleKey: string }[];
  nodes: Node[];
  entries: Record<string, string>;
  locales: Record<string, Record<string, string>>;
  documents: Record<string, unknown>;
  endings: Record<string, { rule: string; entry: string }>;
};
type Envelope = {
  revision: number;
  draft: Story;
  releases: { id: string; createdAt: string; story: Story }[];
};
type Session = ReturnType<typeof createSession>;
export function StoryPage() {
  const { can } = useAuth();
  const writable = can("content:write");
  const [data, setData] = useState<Envelope>();
  const [story, setStory] = useState<Story>();
  const [chapter, setChapter] = useState(1);
  const [selected, setSelected] = useState("");
  const [nodeJSON, setNodeJSON] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [locale, setLocale] = useState("vi");
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState<string>();
  const [session, setSession] = useState<Session>();
  const [previewStory, setPreviewStory] = useState<Story>();
  const [stateJSON, setStateJSON] = useState(
    '{"flags":{},"promises":[],"memories":[],"rewards":[]}',
  );
  const [documentJSON, setDocumentJSON] = useState("");
  const [entriesJSON, setEntriesJSON] = useState("");
  function accept(value: Envelope) {
    setData(value);
    setStory(value.draft);
    setDirty(false);
    setDocumentJSON(JSON.stringify(value.draft.documents, null, 2));
    setEntriesJSON(JSON.stringify(value.draft.entries, null, 2));
  }
  async function load() {
    setBusy(true);
    try {
      accept(await request<Envelope>("/content/story"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const stop = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);
  const node = story?.nodes.find((n) => n.id === selected);
  useEffect(() => {
    document
      .getElementById(`story-node-${selected}`)
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected]);
  useEffect(
    () => setNodeJSON(node ? JSON.stringify(node, null, 2) : ""),
    [node],
  );
  function edit(next: Story) {
    setStory(next);
    setDirty(true);
  }
  function updateNode(next: Node) {
    if (story)
      edit({
        ...story,
        nodes: story.nodes.map((n) => (n.id === selected ? next : n)),
      });
  }
  function attempt(action: () => void) {
    try {
      action();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function persist(publish = false) {
    if (!story || !data) return;
    setBusy(true);
    setError("");
    try {
      let latest = data;
      if (dirty)
        latest = await request<Envelope>("/content/story/draft", {
          method: "POST",
          body: JSON.stringify({ revision: data.revision, story }),
        });
      if (publish) {
        accept(latest);
        latest = await request<Envelope>("/content/story/publish", {
          method: "POST",
          body: JSON.stringify({ revision: latest.revision }),
        });
      }
      accept(latest);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function preview(id: string, source = story) {
    if (source)
      attempt(() => {
        const state = JSON.parse(stateJSON);
        if (
          !state.flags ||
          !["promises", "memories", "rewards"].every((k) =>
            Array.isArray(state[k]),
          )
        )
          throw new Error("Preview requires flags and collection arrays.");
        setPreviewStory(structuredClone(source));
        setSession(createSession(source, id, state));
      });
  }
  if (!story || !data)
    return (
      <Card>
        <Button loading={busy} onClick={() => void load()}>
          Load story
        </Button>
        {error && <Alert type="error" message={error} />}
      </Card>
    );
  const issues = validateStory(story);
  const visible = story.nodes.filter((n) => n.chapter === chapter);
  const current = previewStory?.nodes.find((n) => n.id === session?.nodeId);
  const width = Math.max(1000, ...visible.map((n) => n.position?.x + 240 || 0));
  const height = Math.max(600, ...visible.map((n) => n.position?.y + 120 || 0));
  const keys = Object.keys(story.locales.vi).filter((k) =>
    k.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Typography.Title level={2}>Story & Dialogue</Typography.Title>
      <Space wrap>
        <Tag>{dirty ? "Unsaved draft" : `Draft revision ${data.revision}`}</Tag>
        <Tag>{data.releases.length} published versions</Tag>
        <Button disabled={!writable || busy} onClick={() => void persist()}>
          Save draft
        </Button>
        <Button
          type="primary"
          disabled={
            !writable || busy || issues.some((i) => i.severity === "error")
          }
          onClick={() => void persist(true)}
        >
          Publish version
        </Button>
        <Select
          aria-label="Preview language"
          value={locale}
          onChange={setLocale}
          options={[
            { value: "vi", label: "Vietnamese" },
            { value: "en", label: "English" },
          ]}
        />
      </Space>
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError("")}
        />
      )}
      <Tabs
        items={[
          {
            key: "graph",
            label: "Chapter graph",
            children: (
              <>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Select
                    aria-label="Chapter"
                    style={{ width: 320 }}
                    value={chapter}
                    onChange={(v) => {
                      setChapter(v);
                      setSelected("");
                    }}
                    options={story.chapters.map((c) => ({
                      value: c.id,
                      label: `${c.id}. ${localize(story, c.titleKey, locale)}`,
                    }))}
                  />
                  <Button
                    disabled={!writable}
                    onClick={() => {
                      const id =
                          Math.max(...story.chapters.map((c) => c.id)) + 1,
                        titleKey = `chapters.${id}.title`;
                      edit({
                        ...story,
                        chapters: [...story.chapters, { id, titleKey }],
                        locales: {
                          ...story.locales,
                          vi: { ...story.locales.vi, [titleKey]: "" },
                        },
                      });
                      setChapter(id);
                      setSelected("");
                    }}
                  >
                    Add chapter
                  </Button>
                  <Select<string>
                    aria-label="Add node type"
                    placeholder="Add node"
                    style={{ width: 160 }}
                    disabled={!writable}
                    value={undefined}
                    options={NODE_TYPES.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(type) => {
                      const id = `node.${crypto.randomUUID()}`;
                      edit({
                        ...story,
                        nodes: [
                          ...story.nodes,
                          {
                            id,
                            chapter,
                            type,
                            position: { x: 30, y: 40 },
                            edges: [],
                          },
                        ],
                      });
                      setSelected(id);
                    }}
                  />
                  <Select<string>
                    aria-label="Story entry"
                    placeholder="Jump to entry"
                    style={{ width: 300 }}
                    value={undefined}
                    options={Object.entries(story.entries).map(
                      ([label, value]) => ({ label, value }),
                    )}
                    onChange={(id) => {
                      const n = story.nodes.find((n) => n.id === id);
                      if (n) {
                        setChapter(n.chapter);
                        setSelected(id);
                      }
                    }}
                  />
                </Space>
                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={16}>
                    <div className="story-viewport">
                      <div className="story-canvas" style={{ width, height }}>
                        <svg
                          width={width}
                          height={height}
                          aria-label="Story connections"
                          style={{
                            position: "absolute",
                            pointerEvents: "none",
                          }}
                        >
                          <defs>
                            <marker
                              id="story-arrow"
                              markerWidth="10"
                              markerHeight="10"
                              refX="8"
                              refY="3"
                              orient="auto"
                            >
                              <path d="M0,0 L0,6 L9,3 z" fill="#9b7af5" />
                            </marker>
                          </defs>
                          {visible.flatMap((n) =>
                            n.edges.map((e, i) => {
                              const dest = visible.find((v) => v.id === e.to);
                              return dest ? (
                                <path
                                  key={`${n.id}.${i}`}
                                  d={`M${n.position.x + 210},${n.position.y + 40} C${n.position.x + 250},${n.position.y + 40} ${dest.position.x - 40},${dest.position.y + 40} ${dest.position.x},${dest.position.y + 40}`}
                                  fill="none"
                                  stroke="#9b7af5"
                                  strokeWidth="2"
                                  markerEnd="url(#story-arrow)"
                                />
                              ) : null;
                            }),
                          )}
                        </svg>
                        {visible.map((n) => (
                          <button
                            key={n.id}
                            id={`story-node-${n.id}`}
                            className={`story-node ${selected === n.id ? "selected" : ""}`}
                            style={{ left: n.position.x, top: n.position.y }}
                            onClick={() => setSelected(n.id)}
                            onPointerDown={(e) => {
                              if (!writable) return;
                              const x = e.clientX,
                                y = e.clientY,
                                position = { ...n.position };
                              e.currentTarget.setPointerCapture(e.pointerId);
                              const button = e.currentTarget;
                              button.onpointermove = (move) => {
                                button.style.transform = `translate(${move.clientX - x}px,${move.clientY - y}px)`;
                              };
                              button.onpointerup = (up) => {
                                button.onpointerup = null;
                                button.onpointermove = null;
                                button.style.transform = "";
                                const dx = up.clientX - x,
                                  dy = up.clientY - y;
                                if (Math.abs(dx) + Math.abs(dy) > 4)
                                  edit({
                                    ...story,
                                    nodes: story.nodes.map((v) =>
                                      v.id === n.id
                                        ? {
                                            ...v,
                                            position: {
                                              x: Math.max(0, position.x + dx),
                                              y: Math.max(0, position.y + dy),
                                            },
                                          }
                                        : v,
                                    ),
                                  });
                              };
                            }}
                          >
                            <strong>
                              {n.type} · {n.who || n.id}
                            </strong>
                            <span>
                              {n.textKey
                                ? localize(story, n.textKey, locale)
                                : n.id}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Col>
                  <Col xs={24} xl={8}>
                    <Card title="Node inspector">
                      {node ? (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Typography.Text code>{node.id}</Typography.Text>
                          <Select
                            aria-label="Node type"
                            value={node.type}
                            disabled={!writable}
                            style={{ width: "100%" }}
                            options={NODE_TYPES.map((value) => ({
                              value,
                              label: value,
                            }))}
                            onChange={(type) => updateNode({ ...node, type })}
                          />
                          <Button onClick={() => preview(node.id)}>
                            Preview from this node
                          </Button>
                          <Input
                            aria-label="Speaker"
                            placeholder="Speaker ID"
                            value={node.who || ""}
                            disabled={!writable}
                            onChange={(e) =>
                              updateNode({ ...node, who: e.target.value })
                            }
                          />
                          <Select
                            aria-label="Character expression"
                            placeholder="Expression"
                            value={node.expression}
                            disabled={!writable}
                            allowClear
                            style={{ width: "100%" }}
                            options={EXPRESSIONS.map((value) => ({
                              value,
                              label: value,
                            }))}
                            onChange={(expression) =>
                              updateNode({ ...node, expression })
                            }
                          />
                          <Input
                            aria-label="Node localization key"
                            placeholder="Localization key"
                            disabled={!writable}
                            value={node.textKey || ""}
                            onChange={(e) =>
                              updateNode({ ...node, textKey: e.target.value })
                            }
                          />
                          <Typography.Text>
                            Connect nodes; Condition branches are ordered true,
                            false.
                          </Typography.Text>
                          <Select
                            aria-label="Connection target"
                            showSearch
                            optionFilterProp="label"
                            style={{ width: "100%" }}
                            value={target}
                            onChange={setTarget}
                            options={story.nodes
                              .filter((n) => n.id !== node.id)
                              .map((n) => ({ value: n.id, label: n.id }))}
                          />
                          <Button
                            disabled={!writable || !target}
                            onClick={() => {
                              updateNode({
                                ...node,
                                edges: [...node.edges, { to: target! }],
                              });
                              setTarget(undefined);
                            }}
                          >
                            Connect
                          </Button>
                          {node.edges.map((e, i) => (
                            <Space key={i} wrap>
                              <Typography.Text>
                                {i}: {e.to}
                              </Typography.Text>
                              {node.type === "Choice" && (
                                <Input
                                  aria-label={`Choice ${i} label key`}
                                  placeholder="Choice label key"
                                  value={e.labelKey || ""}
                                  disabled={!writable}
                                  onChange={(event) =>
                                    updateNode({
                                      ...node,
                                      edges: node.edges.map((edge, j) =>
                                        j === i
                                          ? {
                                              ...edge,
                                              labelKey: event.target.value,
                                            }
                                          : edge,
                                      ),
                                    })
                                  }
                                />
                              )}
                              <Button
                                disabled={!writable}
                                onClick={() =>
                                  updateNode({
                                    ...node,
                                    edges: node.edges.filter((_, j) => j !== i),
                                  })
                                }
                              >
                                Disconnect
                              </Button>
                            </Space>
                          ))}
                          <Typography.Text>
                            Advanced node fields (condition, effect, battleId,
                            memoryId, once)
                          </Typography.Text>
                          <Input.TextArea
                            aria-label="Node JSON"
                            rows={12}
                            value={nodeJSON}
                            onChange={(e) => setNodeJSON(e.target.value)}
                            readOnly={!writable}
                          />
                          <Button
                            disabled={!writable}
                            onClick={() =>
                              attempt(() => {
                                const next = JSON.parse(nodeJSON);
                                if (
                                  next.id !== node.id ||
                                  !Array.isArray(next.edges) ||
                                  !NODE_TYPES.includes(next.type) ||
                                  !Number.isFinite(next.position?.x) ||
                                  !Number.isFinite(next.position?.y)
                                )
                                  throw new Error(
                                    "Keep the node ID, valid type, position, and edges.",
                                  );
                                updateNode(next);
                              })
                            }
                          >
                            Apply node fields
                          </Button>
                          <Button
                            danger
                            disabled={!writable}
                            onClick={() => {
                              edit({
                                ...story,
                                nodes: story.nodes.filter(
                                  (n) => n.id !== node.id,
                                ),
                              });
                              setSelected("");
                            }}
                          >
                            Delete node
                          </Button>
                        </Space>
                      ) : (
                        <Typography.Text>
                          Select a node. Drag nodes to arrange the graph.
                        </Typography.Text>
                      )}
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: "locales",
            label: "Localization",
            children: (
              <>
                <Alert
                  type="info"
                  message="Existing English translations are preserved. Missing English text falls back to Vietnamese; no translations were invented."
                />
                <Space style={{ margin: "16px 0" }}>
                  <Input
                    aria-label="Filter localization keys"
                    placeholder="Filter localization keys"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <Button
                    disabled={!writable}
                    onClick={() => {
                      const key = `custom.${crypto.randomUUID()}`;
                      edit({
                        ...story,
                        locales: {
                          ...story.locales,
                          vi: { ...story.locales.vi, [key]: "" },
                        },
                      });
                      setFilter(key);
                    }}
                  >
                    Add key
                  </Button>
                </Space>
                <Table
                  rowKey="key"
                  pagination={{ pageSize: 15 }}
                  dataSource={keys.map((key) => ({ key }))}
                  columns={[
                    { title: "Key", dataIndex: "key" },
                    {
                      title: "Vietnamese",
                      render: (_, r) => (
                        <Input.TextArea
                          aria-label={`${r.key} Vietnamese`}
                          value={story.locales.vi[r.key]}
                          readOnly={!writable}
                          onChange={(e) =>
                            edit({
                              ...story,
                              locales: {
                                ...story.locales,
                                vi: {
                                  ...story.locales.vi,
                                  [r.key]: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      ),
                    },
                    {
                      title: "English",
                      render: (_, r) => (
                        <Input.TextArea
                          aria-label={`${r.key} English`}
                          placeholder="Translation pending"
                          value={story.locales.en[r.key] || ""}
                          readOnly={!writable}
                          onChange={(e) =>
                            edit({
                              ...story,
                              locales: {
                                ...story.locales,
                                en: {
                                  ...story.locales.en,
                                  [r.key]: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "documents",
            label: "Chapters, memories & entries",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Typography.Text>
                  Chapter presentation, ending slides, memory fragments and
                  promise descriptions reference the localization catalog.
                  Existing gameplay pledge checks remain authoritative.
                </Typography.Text>
                <Input.TextArea
                  aria-label="Story documents"
                  rows={20}
                  value={documentJSON}
                  readOnly={!writable}
                  onChange={(e) => setDocumentJSON(e.target.value)}
                />
                <Input.TextArea
                  aria-label="Story entry points"
                  rows={10}
                  value={entriesJSON}
                  readOnly={!writable}
                  onChange={(e) => setEntriesJSON(e.target.value)}
                />
                <Button
                  disabled={!writable}
                  onClick={() =>
                    attempt(() => {
                      const documents = JSON.parse(documentJSON),
                        entries = JSON.parse(entriesJSON);
                      if (
                        !documents ||
                        Array.isArray(documents) ||
                        !entries ||
                        Array.isArray(entries) ||
                        !Object.values(entries).every(
                          (v) => typeof v === "string",
                        )
                      )
                        throw new Error(
                          "Documents and entries must be objects.",
                        );
                      edit({ ...story, documents, entries });
                    })
                  }
                >
                  Apply documents and entries
                </Button>
                <Typography.Text>Preview initial state</Typography.Text>
                <Input.TextArea
                  aria-label="Preview state"
                  rows={4}
                  value={stateJSON}
                  onChange={(e) => setStateJSON(e.target.value)}
                />
              </Space>
            ),
          },
          {
            key: "validation",
            label: `Validation (${issues.filter((i) => i.severity === "error").length} errors)`,
            children: (
              <Table
                rowKey={(_, i) => String(i)}
                pagination={{ pageSize: 20 }}
                dataSource={issues}
                columns={[
                  { title: "Severity", dataIndex: "severity" },
                  { title: "Issue", dataIndex: "message" },
                  {
                    title: "Node",
                    render: (_, i) =>
                      i.nodeId ? (
                        <Button
                          onClick={() => {
                            const n = story.nodes.find(
                              (n) => n.id === i.nodeId,
                            );
                            if (n) {
                              setChapter(n.chapter);
                              setSelected(n.id);
                            }
                          }}
                        >
                          {i.nodeId}
                        </Button>
                      ) : null,
                  },
                ]}
              />
            ),
          },
          {
            key: "versions",
            label: "Published versions",
            children: (
              <Table
                rowKey="id"
                dataSource={[...data.releases].reverse()}
                columns={[
                  { title: "Version", dataIndex: "id" },
                  { title: "Published at", dataIndex: "createdAt" },
                  {
                    title: "Actions",
                    render: (_, release) => (
                      <Space>
                        <Button
                          onClick={() =>
                            preview(
                              Object.values(release.story.entries)[0],
                              release.story,
                            )
                          }
                        >
                          Preview version
                        </Button>
                        <Button
                          disabled={!writable}
                          onClick={() => {
                            edit(structuredClone(release.story));
                            setDocumentJSON(
                              JSON.stringify(release.story.documents, null, 2),
                            );
                            setEntriesJSON(
                              JSON.stringify(release.story.entries, null, 2),
                            );
                          }}
                        >
                          Copy to draft
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />
      <Modal
        title={`Story preview · ${locale}`}
        open={!!session}
        onCancel={() => setSession(undefined)}
        footer={null}
        width={700}
      >
        {session && previewStory && current && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Tag>
              {current.type} · {current.who} · {current.expression}
            </Tag>
            <Typography.Text code>{current.id}</Typography.Text>
            <Typography.Paragraph>
              {current.textKey
                ? localize(previewStory, current.textKey, locale)
                : current.type}
            </Typography.Paragraph>
            {session.done ? (
              <Alert type="success" message="End of path" />
            ) : current.type === "Choice" ? (
              current.edges.map((e, i) => (
                <Button
                  key={i}
                  onClick={() =>
                    attempt(() => setSession(advance(previewStory, session, i)))
                  }
                >
                  {localize(previewStory, e.labelKey, locale)}
                </Button>
              ))
            ) : (
              <Button
                onClick={() =>
                  attempt(() => setSession(advance(previewStory, session)))
                }
              >
                {current.type === "Battle"
                  ? "Simulate battle complete"
                  : "Continue"}
              </Button>
            )}
            <Button onClick={() => preview(current.id, previewStory)}>
              Restart here
            </Button>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(session.state, null, 2)}
            </pre>
            <Typography.Text>
              Visited: {session.history.join(" → ") || "None"}
            </Typography.Text>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
