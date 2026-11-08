import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as AntApp,
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Drawer,
  Layout,
  Menu,
  Result,
  Space,
  Switch,
  Tag,
  theme,
} from "antd";
import {
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  ControlOutlined,
  DashboardOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  BrowserRouter,
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, Login, Protected, useAuth } from "./auth/Auth";
import { Dashboard, ModulePage, modules } from "./pages";
import { useNotifications } from "./components/shared";
import "antd/dist/reset.css";
import "./styles.css";
const icons = [
  DashboardOutlined,
  ControlOutlined,
  ThunderboltOutlined,
  BookOutlined,
  AppstoreOutlined,
  UserOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
];
function Shell({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  const { user, can, logout } = useAuth(),
    location = useLocation(),
    notice = useNotifications();
  const [drawer, setDrawer] = useState(false);
  const current = modules.find((m) => m.path === location.pathname);
  const navigation = (
    <>
      <div className="brand">
        <span className="brand-mark">✦</span>
        <div>
          ARCANE PAWS<small>ADMIN CONTROL CENTER</small>
        </div>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <Menu
        theme={dark ? "dark" : "light"}
        mode="inline"
        selectedKeys={[location.pathname]}
        onClick={() => setDrawer(false)}
        items={modules
          .filter((m) => can(`${m.key}:read`))
          .map((m) => ({
            key: m.path,
            icon: React.createElement(icons[modules.indexOf(m)]),
            label: <Link to={m.path}>{m.label}</Link>,
          }))}
      />
      <div className="sidebar-footer">
        <Tag color="purple">ADMIN FOUNDATION</Tag>
        <p>Every action, accounted for.</p>
      </div>
    </>
  );
  return (
    <Layout className="app-layout">
      <Layout.Sider
        width={252}
        className="desktop-sidebar"
        theme={dark ? "dark" : "light"}
      >
        {navigation}
      </Layout.Sider>
      <Drawer
        title="Navigation"
        placement="left"
        open={drawer}
        onClose={() => setDrawer(false)}
        styles={{ body: { padding: 0 } }}
      >
        {navigation}
      </Drawer>
      <Layout>
        <Layout.Header className="topbar">
          <Space>
            <Button
              className="mobile-menu"
              icon={<MenuOutlined />}
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            />
            <Breadcrumb
              items={[
                { title: <Link to="/">Workspace</Link> },
                ...(current && current.path !== "/"
                  ? [{ title: current.label }]
                  : []),
              ]}
            />
          </Space>
          <Space wrap>
            <Switch
              checked={dark}
              onChange={toggle}
              checkedChildren="Dark"
              unCheckedChildren="Light"
              aria-label="Dark mode"
            />
            <Avatar size="small" icon={<UserOutlined />} />
            <span className="user-role">{user?.role}</span>
            <Button onClick={() => void logout().catch(notice.error)}>
              Sign out
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content className="content">
          <Outlet />
        </Layout.Content>
        <Layout.Footer className="footer">
          Arcane Paws <span>Control Center · API-backed administration</span>
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}
function Root() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("arcane-admin-theme") !== "light",
  );
  const toggle = () =>
    setDark((v) => {
      localStorage.setItem("arcane-admin-theme", v ? "light" : "dark");
      return !v;
    });
  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#9b7af5",
          borderRadius: 10,
          fontFamily: "Inter, system-ui, sans-serif",
          ...(dark
            ? {
                colorBgBase: "#111022",
                colorBgContainer: "#1b192e",
                colorBorderSecondary: "#302d45",
              }
            : {}),
        },
        components: {
          Layout: {
            headerBg: dark ? "#151326" : "#ffffff",
            siderBg: dark ? "#151326" : "#ffffff",
          },
          Menu: { darkItemBg: "#151326", darkItemSelectedBg: "#382d59" },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Protected />}>
                <Route element={<Shell dark={dark} toggle={toggle} />}>
                  {modules.map((m) => (
                    <Route
                      key={m.key}
                      element={<Protected permission={`${m.key}:read`} />}
                    >
                      <Route
                        path={m.path}
                        element={
                          m.key === "dashboard" ? (
                            <Dashboard />
                          ) : (
                            <ModulePage key={m.key} module={m} />
                          )
                        }
                      />
                    </Route>
                  ))}
                  <Route
                    path="*"
                    element={
                      <Result
                        status="404"
                        title="Page not found"
                        extra={<Link to="/">Return to dashboard</Link>}
                      />
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
