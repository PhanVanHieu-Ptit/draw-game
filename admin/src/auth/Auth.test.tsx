import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, Login, Protected } from "./Auth";
import { ApiError, request } from "../services/api";
function reply(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
function view(permission = "dashboard:read") {
  return render(
    <MemoryRouter initialEntries={["/secure"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected permission={permission} />}>
            <Route path="/secure" element={<div>Protected content</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("authentication and protected routes", () => {
  it("redirects an unauthenticated visitor to login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({ message: "Authentication required" }, 401)),
    );
    view();
    expect(
      await screen.findByRole("button", { name: "Enter Control Center" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
  it("denies a route when the server-issued user lacks permission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        reply({ user: { role: "Analyst", permissions: ["dashboard:read"] } }),
      ),
    );
    view("system:read");
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
  it("restores a permitted session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        reply({ user: { role: "Analyst", permissions: ["dashboard:read"] } }),
      ),
    );
    view();
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });
  it("recovers after the session service fails", async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        reply({ message: "Service unavailable" }, 503),
      )
      .mockImplementationOnce(() =>
        reply({ user: { role: "Analyst", permissions: ["dashboard:read"] } }),
      );
    vi.stubGlobal("fetch", fetcher);
    view();
    await userEvent.click(
      await screen.findByRole("button", { name: "Retry connection" }),
    );
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });
  it("invalidates the UI session after an API 401", async () => {
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({ message: "Expired" }, 401)),
    );
    await expect(request("/configuration")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener("session-expired", expired);
  });
});
