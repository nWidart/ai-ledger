import { describe, expect, it } from "vitest";
import { resumeCommand } from "./resume";

describe("resumeCommand", () => {
  it("resumes a Claude Code session", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc" })).toBe("claude --resume abc");
  });
  it("resumes a Codex session", () => {
    expect(resumeCommand({ source: "codex", session_id: "def", cwd: null })).toBe("codex resume def");
  });
  it("resumes a Grok session in its directory", () => {
    expect(resumeCommand({ source: "grok", session_id: "ghi", cwd: "/Users/me/app" })).toBe("cd '/Users/me/app' && grok --resume ghi");
  });
  it("changes to the working directory first, quoted", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc", cwd: "/Users/me/my app" })).toBe("cd '/Users/me/my app' && claude --resume abc");
  });
  it("escapes a single quote in the directory", () => {
    expect(resumeCommand({ source: "codex", session_id: "def", cwd: "/tmp/it's" })).toBe("cd '/tmp/it'\\''s' && codex resume def");
  });
  it("leaves an id of plain characters unquoted for every agent", () => {
    const id = "019a2b3c-4d5e.7F_x";
    expect(resumeCommand({ source: "claude", session_id: id })).toBe(`claude --resume ${id}`);
    expect(resumeCommand({ source: "codex", session_id: id })).toBe(`codex resume ${id}`);
    expect(resumeCommand({ source: "grok", session_id: id })).toBe(`grok --resume ${id}`);
  });
  it("quotes an id with shell syntax as one argument", () => {
    expect(resumeCommand({ source: "grok", session_id: "a; rm -rf ~" })).toBe("grok --resume 'a; rm -rf ~'");
    expect(resumeCommand({ source: "claude", session_id: "$(x)" })).toBe("claude --resume '$(x)'");
    expect(resumeCommand({ source: "codex", session_id: "it's", cwd: "/a" })).toBe("cd '/a' && codex resume 'it'\\''s'");
  });
  it("quotes an empty id", () => {
    expect(resumeCommand({ source: "grok", session_id: "" })).toBe("grok --resume ''");
  });
  it("skips the cd for an empty directory", () => {
    expect(resumeCommand({ source: "claude", session_id: "abc", cwd: "" })).toBe("claude --resume abc");
  });
});
