import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigurationPage } from "./ConfigurationPage";
import { defaults } from "../../shared/game-configuration.js";
vi.mock("./auth/Auth", () => ({
  useAuth: () => ({
    can: (permission: string) => permission === "configuration:write",
  }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("shows published and draft values, warns on edits, resets, saves with revision and hides publication authority", async () => {
  const state = {
    revision: 7,
    published: { id: "v1", values: defaults },
    draft: null,
    versions: [],
  };
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify(state), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<ConfigurationPage />);
  const field = await screen.findByRole("spinbutton", { name: "maxWaves" });
  await waitFor(() => expect(field).toBeEnabled());
  expect(
    screen.queryByRole("button", { name: "Publish" }),
  ).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.clear(field);
  await user.type(field, "20");
  expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reset to published" }));
  expect(field).toHaveValue("10");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(calls[1][1].body as string)).toMatchObject({
    revision: 7,
    values: defaults,
  });
});
it("shows load errors and prevents saving without a loaded revision", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Storage unavailable" }), {
          status: 500,
        }),
    ),
  );
  render(<ConfigurationPage />);
  expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
});
