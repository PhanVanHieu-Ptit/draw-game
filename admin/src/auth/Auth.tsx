import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Alert, Button, Card, Form, Input, Result, Spin } from "antd";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ApiError, request } from "../services/api";
export type Role =
  "Super Admin" | "Game Designer" | "Content Editor" | "Analyst" | "Support";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
};
const Context = createContext<{
  user: User | null;
  can: (p: string) => boolean;
  login: (v: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}>(null!);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function restore() {
    setLoading(true);
    setError("");
    try {
      setUser((await request<{ user: User }>("/auth/me")).user);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void restore();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  if (loading)
    return (
      <div className="center">
        <Spin size="large" tip="Checking session…">
          <div style={{ padding: 40 }} />
        </Spin>
      </div>
    );
  if (error)
    return (
      <div className="center">
        <Result
          status="error"
          title="Admin API unavailable"
          subTitle={error}
          extra={
            <Button onClick={() => void restore()}>Retry connection</Button>
          }
        />
      </div>
    );
  return (
    <Context.Provider
      value={{
        user,
        can: (p) => !!user?.permissions.includes(p),
        login: async (v) =>
          setUser(
            (
              await request<{ user: User }>("/auth/login", {
                method: "POST",
                body: JSON.stringify(v),
              })
            ).user,
          ),
        logout: async () => {
          await request("/auth/logout", { method: "POST" });
          setUser(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function Protected({ permission }: { permission?: string }) {
  const { user, can } = useAuth();
  const location = useLocation();
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (permission && !can(permission))
    return (
      <Result
        status="403"
        title="Access restricted"
        subTitle="Your role does not have access to this module."
      />
    );
  return <Outlet />;
}
export function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const from = location.state?.from;
  const destination =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    from !== "/login"
      ? from
      : "/";
  if (user) return <Navigate to={destination} replace />;
  return (
    <div className="center">
      <Card className="login-card">
        <div className="eyebrow">ARCANE PAWS / ADMINISTRATION</div>
        <h1>Welcome back, keeper.</h1>
        <p className="muted">
          Sign in to the Control Center with your server-provisioned account.
        </p>
        {error && <Alert type="error" showIcon message={error} />}
        <Form
          layout="vertical"
          onFinish={async (v) => {
            setBusy(true);
            setError("");
            try {
              await login(v);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={busy} block>
            Enter Control Center
          </Button>
        </Form>
      </Card>
    </div>
  );
}
