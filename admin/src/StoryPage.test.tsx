import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoryPage } from "./StoryPage";
import seed from "../../shared/story/seed.json";
import { request } from "./services/api";
vi.mock("./services/api", () => ({ request: vi.fn() }));
const permission = { write: true };
vi.mock("./auth/Auth", () => ({
  useAuth: () => ({
    can: (p: string) => p.endsWith(":read") || permission.write,
  }),
}));
afterEach(cleanup);
beforeEach(() => {
  permission.write = true;
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue({
    revision: 0,
    draft: structuredClone(seed),
    releases: [],
  });
});
it("selects a graph node, previews from it, edits its expression and saves a revisioned draft", async () => {
  render(<StoryPage />);
  const nodes = await screen.findAllByRole("button", {
    name: /Dialogue · barnaby/,
  });
  fireEvent.click(nodes[0]);
  fireEvent.click(screen.getByText("Preview from this node"));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).getByText("chapter.1.intro.0")).toBeInTheDocument();
  fireEvent.click(within(modal).getByText("Continue"));
  expect(within(modal).getByText("chapter.1.intro.1")).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Close" }));
  const editor = screen.getByLabelText("Node JSON");
  const value = JSON.parse((editor as HTMLTextAreaElement).value);
  value.expression = "happy";
  fireEvent.change(editor, { target: { value: JSON.stringify(value) } });
  fireEvent.click(screen.getByText("Apply node fields"));
  fireEvent.click(screen.getByText("Save draft"));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  const [path, options] = vi.mocked(request).mock.calls[1];
  expect(path).toBe("/content/story/draft");
  const payload = JSON.parse(options!.body as string);
  expect(payload.revision).toBe(0);
  expect(payload.story.nodes[0].expression).toBe("happy");
  expect(payload.story.locales).toEqual(seed.locales);
});
it("read-only permissions disable content mutation and publishing", async () => {
  permission.write = false;
  render(<StoryPage />);
  await screen.findByText("Draft revision 0");
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Publish version" }),
  ).toBeDisabled();
});
