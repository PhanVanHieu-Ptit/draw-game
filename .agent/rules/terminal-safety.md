---
trigger: always_on
---


# Terminal Command Safety Rules

## Objective

Allow the AI agent to execute safe, read-only
terminal commands without requesting approval.

Protect the operating system, project files,
credentials, and external resources.

## 1. Allowed Read-Only Commands

The following commands may be executed without
additional approval when they have no side effects:

### File inspection
- pwd
- ls
- ls -la
- find . -type f
- tree
- cat
- head
- tail
- less
- file
- stat
- wc

### Search
- grep
- rg
- rg --files

### Git inspection
- git status
- git diff
- git log
- git show
- git branch --list
- git remote -v

### Node.js / Frontend
- node --version
- npm --version
- pnpm --version
- npx --version
- tsc --version

### System inspection
- uname -a
- whoami
- date
- df -h
- free -h
- ps aux

## 2. Commands Requiring Approval

Always request explicit approval before:

- Installing or removing packages
- Creating, modifying, moving or deleting files
- Running build scripts or tests that write files
- Starting or stopping background services
- Changing Git branches or repository state
- Making network requests
- Modifying environment variables
- Executing scripts with unknown side effects

Examples:
- npm install
- pnpm add
- pnpm install
- npm run build
- git checkout
- git reset
- git clean
- chmod
- chown
- mv
- cp
- mkdir

## 3. Restricted Commands

Never execute the following without explicit
user authorization and safety review:

- rm -rf
- sudo
- su
- mkfs
- dd
- shutdown
- reboot
- systemctl stop
- git push --force
- git reset --hard
- git clean -fd
- curl | bash
- wget | bash

Do not execute commands that:
- Modify operating system configuration
- Delete directories recursively
- Expose credentials or private keys
- Disable security mechanisms
- Change firewall or network configuration

## 4. Execution Policy

Before executing a command:

1. Inspect the complete command and arguments.
2. Identify possible filesystem side effects.
3. Check for shell redirection and pipelines.
4. Reject unsafe command combinations.
5. Request approval when safety is uncertain.

Do not treat a command as safe solely because
its executable appears in the allowed list.

## 5. Project Scope

- Prefer operating inside the project directory.
- Avoid accessing sensitive system directories.
- Do not read .env files or private keys.
- Do not modify files outside the workspace.
- Never expose secrets in terminal output.

## 6. Default Behavior

- Read-only inspection: execute automatically
  when safe and permitted by the environment.
- File modifications: request approval.
- System modifications: request approval.
- Destructive operations: do not execute
  without explicit authorization.
- Unknown commands: request approval.

These rules do not override Antigravity's
built-in terminal permission controls.
