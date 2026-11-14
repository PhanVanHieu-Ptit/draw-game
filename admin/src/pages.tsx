import { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
} from "antd";
import { api, type Audit, type Config } from "./services/api";
import {
  DataTable,
  ErrorState,
  FormModal,
  PageTitle,
  useConfirmation,
  useNotifications,
  useResource,
} from "./components/shared";
import { useAuth } from "./auth/Auth";
export const modules = [
  {
    key: "dashboard",
    path: "/",
    label: "Dashboard",
    description:
      "A clear view of your realm. Connected data, clearly identified.",
  },
  {
    key: "configuration",
    path: "/configuration",
    label: "Game Configuration",
    description: "Prepare configuration drafts for review.",
  },
  {
    key: "gameplay",
    path: "/gameplay",
    label: "Gameplay Management",
    description: "Manage gameplay rules and balancing integrations.",
  },
  {
    key: "content",
    path: "/content",
    label: "Content Management",
    description: "Organize characters, story content, and game assets.",
  },
  {
    key: "liveops",
    path: "/liveops",
    label: "Live Operations",
    description:
      "Schedule daily and weekly challenges, seasonal and random events, rewards, announcements and feature flags.",
  },
  {
    key: "players",
    path: "/players",
    label: "Player Management",
    description: "Connect player accounts and support operations.",
  },
  {
    key: "analytics",
    path: "/analytics",
    label: "Analytics",
    description: "Explore verified gameplay and engagement telemetry.",
  },
  {
    key: "system",
    path: "/system",
    label: "System Administration",
    description: "Review persisted administrative actions and access policy.",
  },
];
export function Dashboard() {
  const { data, loading, error, reload } = useResource(api.dashboard);
  return (
    <>
      <PageTitle
        {...modules[0]}
        title="Realm overview"
        action={
          <Button onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />
      <Alert
        showIcon
        type="info"
        message="Live API · game telemetry not connected"
        description="Unavailable metrics are shown as —. No sample analytics are displayed. Configuration counts reflect this admin store, not the running game."
      />
      {error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <>
          <Row gutter={[20, 20]} className="metrics">
            {[
              [
                "Active players",
                data?.metrics.activePlayers,
                "Telemetry required",
              ],
              [
                "Game sessions",
                data?.metrics.gameSessions,
                "Telemetry required",
              ],
              [
                "Published configuration",
                data?.metrics.publishedConfiguration,
                "Environments with a publication",
              ],
              [
                "Scheduled events",
                data?.metrics.scheduledEvents,
                "Scheduled or running events",
              ],
            ].map(([label, value, note]) => (
              <Col xs={24} sm={12} xl={6} key={String(label)}>
                <Card>
                  {loading ? (
                    <Skeleton active paragraph={{ rows: 1 }} />
                  ) : (
                    <Statistic
                      title={label}
                      value={typeof value === "number" ? value : "—"}
                    />
                  )}
                  <div className="metric-note">{note}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[20, 20]}>
            <Col xs={24} lg={15}>
              <Card
                title="Gameplay performance"
                extra={<Tag>Awaiting integration</Tag>}
              >
                {loading ? (
                  <Skeleton active />
                ) : (
                  <Empty description="Connect gameplay telemetry to view performance trends." />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={9}>
              <Card title="System health">
                {loading ? (
                  <Skeleton active />
                ) : (
                  <Descriptions
                    column={1}
                    items={[
                      {
                        key: "api",
                        label: "Admin API",
                        children: (
                          <Tag color="green">{data?.health.adminApi}</Tag>
                        ),
                      },
                      {
                        key: "telemetry",
                        label: "Game telemetry",
                        children: data?.health.gameTelemetry,
                      },
                      {
                        key: "storage",
                        label: "Storage",
                        children: data?.health.storage,
                      },
                    ]}
                  />
                )}
              </Card>
            </Col>
          </Row>
          <p className="muted">
            {data &&
              `API response received · ${new Date(data.updatedAt).toLocaleString()}`}
          </p>
        </>
      )}
    </>
  );
}
export function ModulePage({ module }: { module: (typeof modules)[number] }) {
  const loader = useCallback(
    () => api.list<Config & Audit>(module.key),
    [module.key],
  );
  const { data, loading, error, reload } = useResource(loader);
  const [search, setSearch] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const { can } = useAuth();
  const notice = useNotifications();
  const confirm = useConfirmation();
  const configuration = module.key === "configuration",
    system = module.key === "system";
  const rows =
    data?.items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageTitle
        title={module.label}
        description={module.description}
        action={
          <Space>
            <Button onClick={reload} loading={loading}>
              Refresh
            </Button>
            {configuration && can("configuration:write") && (
              <Button type="primary" onClick={() => setOpen(true)}>
                New configuration
              </Button>
            )}
          </Space>
        }
      />
      {configuration && (
        <Alert
          type="info"
          showIcon
          message="Draft workspace"
          description="Drafts persist in the admin backend. Publishing and game delivery are not connected; creating a draft does not change the game."
        />
      )}
      {system && (
        <Alert
          type="info"
          showIcon
          message="Server-enforced access"
          description="Roles are defined in server/policy.mjs. Account provisioning currently supports one server-provisioned account. Audit history shows configuration creation actions."
        />
      )}
      {data?.integration === "not_connected" && (
        <Alert
          type="warning"
          showIcon
          message="Integration not connected"
          description="This module is a foundation. No game records are available and operational actions are not enabled."
        />
      )}
      {error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <Card className="records">
          <DataTable
            search={search}
            onSearch={setSearch}
            loading={loading}
            dataSource={rows}
            columns={
              configuration
                ? [
                    { title: "Configuration", dataIndex: "name" },
                    { title: "Max waves", dataIndex: "maxWaves" },
                    {
                      title: "Status",
                      dataIndex: "status",
                      render: (v) => <Tag color="purple">{v}</Tag>,
                    },
                    {
                      title: "Updated",
                      dataIndex: "updatedAt",
                      render: (v) => new Date(v).toLocaleString(),
                    },
                  ]
                : system
                  ? [
                      { title: "Action", dataIndex: "action" },
                      { title: "Actor", dataIndex: "actor" },
                      { title: "Target", dataIndex: "target" },
                      {
                        title: "Time",
                        dataIndex: "createdAt",
                        render: (v) => new Date(v).toLocaleString(),
                      },
                    ]
                  : [
                      { title: "Name", dataIndex: "name" },
                      { title: "Status", dataIndex: "status" },
                    ]
            }
          />
        </Card>
      )}
      <FormModal
        open={open}
        title="Create configuration draft"
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ maxWaves: 10 }}
          onFinish={(values) => {
            confirm(
              "Save configuration draft?",
              "This creates an admin draft. It will not be published to the game.",
              async () => {
                setBusy(true);
                try {
                  await api.createConfig(values);
                  notice.success("Configuration draft created.");
                  setOpen(false);
                  form.resetFields();
                  reload();
                } catch (e) {
                  notice.error(e);
                } finally {
                  setBusy(false);
                }
              },
            );
          }}
        >
          <Form.Item
            name="name"
            label="Configuration name"
            rules={[{ required: true, whitespace: true, max: 80 }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="maxWaves"
            label="Maximum waves"
            rules={[{ required: true, type: "integer", min: 1, max: 1000 }]}
          >
            <InputNumber min={1} max={1000} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>
            Save draft
          </Button>
        </Form>
      </FormModal>
    </>
  );
}
