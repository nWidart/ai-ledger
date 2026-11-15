import { describe, expect, it } from "vitest";
import { resumeCommand } from "./resume";

describe("resumeCommand", () => {
  it("resumes a Claude Code session", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc" })).toBe("claude --resume abc");
  });
  it("resumes a Codex session", () => {
    expect(resumeCommand({ source: "codex", session_id: "def", cwd: null })).toBe("codex resume def");
  });
  it("changes to the working directory first, quoted", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc", cwd: "/Users/me/my app" })).toBe("cd '/Users/me/my app' && claude --resume abc");
  });
  it("escapes a single quote in the directory", () => {
    expect(resumeCommand({ source: "codex", session_id: "def", cwd: "/tmp/it's" })).toBe("cd '/tmp/it'\\''s' && codex resume def");
  });
  it("skips the cd for an empty directory", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc", cwd: "" })).toBe("claude --resume abc");
  });
});
