export const modules = [
  "dashboard",
  "configuration",
  "gameplay",
  "content",
  "liveops",
  "players",
  "analytics",
  "system",
];
export const roles = {
  "Super Admin": [
    ...modules.flatMap((m) => [`${m}:read`, `${m}:write`]),
    "configuration:review",
    "configuration:publish",
    "liveops:publish",
  ],
  "Game Designer": [
    "dashboard:read",
    "configuration:read",
    "configuration:write",
    "gameplay:read",
    "gameplay:write",
  ],
  "Content Editor": [
    "dashboard:read",
    "content:read",
    "content:write",
    "liveops:read",
    "liveops:write",
  ],
  Analyst: ["dashboard:read", "analytics:read", "gameplay:read"],
  Support: ["dashboard:read", "players:read", "players:write"],
};
export const permits = (user, permission) =>
  Boolean(user && roles[user.role]?.includes(permission));
