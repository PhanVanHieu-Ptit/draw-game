import seed from "../../shared/story/seed.json" with { type: "json" };
import { validateStory } from "../../shared/story/engine.js";
import { randomUUID } from "node:crypto";
export async function storyRoute({
  path,
  method,
  body,
  send,
  store,
  mutate,
  current,
  permits,
  now,
}) {
  if (path === "/api/story-content/published" && method === "GET") {
    const release = store().story?.releases.at(-1);
    send(release ? 200 : 404, release || { message: "No published story." });
    return true;
  }
  if (!path.startsWith("/api/content/story")) return false;
  if (!current) {
    send(401, { message: "Authentication required." });
    return true;
  }
  if (!permits(current, `content:${method === "GET" ? "read" : "write"}`)) {
    send(403, { message: "Permission denied." });
    return true;
  }
  const initial = () => ({
    revision: 0,
    draft: structuredClone(seed),
    releases: [],
  });
  if (path === "/api/content/story" && method === "GET") {
    const value = store().story || initial();
    send(200, { ...value, issues: validateStory(value.draft) });
    return true;
  }
  if (
    method === "POST" &&
    ["/api/content/story/draft", "/api/content/story/publish"].includes(path)
  ) {
    const input = await body();
    if (!Number.isInteger(input.revision)) {
      send(400, { message: "Revision required." });
      return true;
    }
    let result;
    await mutate((s) => {
      s.story ||= initial();
      if (input.revision !== s.story.revision)
        throw Object.assign(new Error("Story changed. Reload before saving."), {
          status: 409,
        });
      const publish = path.endsWith("/publish");
      const story = publish ? s.story.draft : input.story;
      const issues = validateStory(story);
      if (
        issues.some((i) =>
          ["schema", "node", "duplicate", "position"].includes(i.code),
        ) ||
        (publish && issues.some((i) => i.severity === "error"))
      )
        throw Object.assign(
          new Error(
            publish
              ? "Fix validation errors before publishing."
              : "Invalid story schema.",
          ),
          { status: 422 },
        );
      if (publish) {
        const release = {
          id: randomUUID(),
          status: "published",
          createdAt: new Date(now()).toISOString(),
          story: structuredClone(story),
        };
        s.story.releases.push(release);
      } else s.story.draft = structuredClone(story);
      s.story.revision++;
      s.audit.push({
        id: randomUUID(),
        action: publish ? "story.publish" : "story.save",
        actor: current.email,
        target: String(s.story.revision),
        createdAt: new Date(now()).toISOString(),
      });
      result = { ...s.story, issues };
    });
    send(200, result);
    return true;
  }
  send(404, { message: "Story endpoint not found." });
  return true;
}
