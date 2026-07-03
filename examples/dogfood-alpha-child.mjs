import { createInterface } from "node:readline";

const FIXED_TIME = "2026-06-26T10:00:00.000Z";

createInterface({ input: process.stdin }).on("line", handleLine);

function handleLine(line) {
  if (!line.trim()) {
    return;
  }

  const event = JSON.parse(line);
  if (event.type === "abort") {
    process.exit(0);
  }
  if (event.type === "set_thinking_level") {
    writeJson({ type: "response", command: "set_thinking_level", success: true });
    return;
  }
  if (event.type !== "prompt") {
    return;
  }

  writeJson({ type: "response", command: "prompt", success: true });
  const envelope = envelopeForPrompt(String(event.message ?? ""));
  writeJson({
    type: "agent_end",
    messages: [{ role: "assistant", content: JSON.stringify(envelope) }],
  }, () => process.exit(0));
}

function envelopeForPrompt(prompt) {
  const agent = matchLine(prompt, "Agent") ?? "unknown";
  const contextMode = matchLine(prompt, "Context mode") ?? "summary";
  const files = fileHints(prompt);
  const task = taskText(prompt);
  const base = {
    id: "child_fixture_result",
    agent,
    runtime: "subprocess",
    contextMode,
    status: "completed",
    startedAt: FIXED_TIME,
    endedAt: FIXED_TIME,
    findings: [],
    artifacts: [],
    filesRead: files,
    filesChanged: [],
    commandsRun: ["node examples/dogfood-alpha-child.mjs"],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 0.86,
    nextActions: [],
  };

  if (agent === "scout") {
    return {
      ...base,
      summary: "Scout mapped the built-in agents, tool surface, subprocess backend, and existing mock demo coverage.",
      nextActions: ["Hand these files to reviewer and tester for the alpha dogfood pass."],
    };
  }

  if (agent === "reviewer") {
    return {
      ...base,
      summary: "Reviewer found no correctness blocker, but flagged the deterministic-only alpha limitation.",
      findings: [{
        severity: "low",
        title: "Dogfood is deterministic and does not prove production readiness",
        file: "README.md",
        evidence: "The current README says live model-result smoke testing is still required before claiming real Pi child execution support.",
        recommendation: "Keep the dogfood documentation explicit about fixture-only execution and leave live/manual readiness to #26.",
      }],
      nextActions: ["Do not claim production readiness from this scenario."],
    };
  }

  if (agent === "tester") {
    return {
      ...base,
      summary: "Tester identified output-shape drift as the main test risk for the dogfood scenario.",
      findings: [{
        severity: "low",
        title: "Dogfood JSON needs regression coverage",
        file: "tests/examples/mock-backend-demo.test.ts",
        evidence: "The scenario result is consumed as structured JSON and documents acceptance evidence.",
        recommendation: "Assert all four agent results, reviewer/tester findings, and the follow-up ledger in the example test.",
      }],
      nextActions: ["Run npm test after changes to verify the dogfood example output."],
    };
  }

  if (agent === "summarizer") {
    const inputs = parseTaskJson(task);
    const sourceResults = [inputs.scout, inputs.reviewer, inputs.tester].filter(Boolean);
    const findings = uniqueFindings(sourceResults.flatMap((result) => result.findings ?? []));
    const filesRead = [...new Set(sourceResults.flatMap((result) => result.filesRead ?? []))];
    return {
      ...base,
      summary: "Summarizer merged scout, reviewer, and tester outputs into one alpha dogfood result.",
      findings,
      filesRead,
      confidence: 0.9,
      nextActions: [
        "Document the deterministic result and limitation.",
        "Use #26 for live/manual alpha readiness follow-up.",
      ],
    };
  }

  return { ...base, summary: `No dogfood fixture output is defined for ${agent}.`, confidence: 0.3 };
}

function matchLine(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim();
}

function fileHints(prompt) {
  const start = prompt.indexOf("File hints:\n");
  const end = prompt.indexOf("\n\nOutput mode:", start);
  if (start === -1 || end === -1) {
    return [];
  }
  const body = prompt.slice(start + "File hints:\n".length, end).trim();
  return body && body !== "<none>" ? body.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function taskText(prompt) {
  const marker = "\n\nTask:\n";
  const start = prompt.indexOf(marker);
  return start === -1 ? "" : prompt.slice(start + marker.length).trim();
}

function parseTaskJson(task) {
  try {
    return JSON.parse(task);
  } catch {
    return {};
  }
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.file ?? ""}:${finding.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function writeJson(value, callback) {
  process.stdout.write(`${JSON.stringify(value)}\n`, callback);
}
