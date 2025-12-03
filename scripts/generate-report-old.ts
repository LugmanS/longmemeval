import fs from "fs";

type EvalItem = {
  question_id: string;
  question_type: string;
  evaluation: "yes" | "no";
  answer_generation_usage: {
    inputTokens: number; // input tokens
    outputTokens: number; // output tokens
    totalTokens: number; // input + output
    reasoningTokens: number; // subset of output
  };
};

export function generateEvalReport(items: EvalItem[]) {
  const total = items.length;

  const valid = items.filter((i) => i.evaluation === "yes").length;
  const invalid = total - valid;
  const accuracy = total ? (valid / total) * 100 : 0;

  const round = (n: number) => Number(n.toFixed(2));
  const avg = (arr: number[]) =>
    arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // ---- Collect global token arrays ----
  const allInput = items.map((i) => i.answer_generation_usage.inputTokens);
  const allOutput = items.map((i) => i.answer_generation_usage.outputTokens);
  const allReasoning = items.map(
    (i) => i.answer_generation_usage.reasoningTokens
  );

  // ---- Group by question type (holistic stats) ----
  const byType: Record<string, any> = {};

  for (const item of items) {
    const t = item.question_type;

    if (!byType[t]) {
      byType[t] = {
        total: 0,
        valid: 0,
        invalid: 0,
        avgReasoningTokens: 0,
      };
    }

    const input = item.answer_generation_usage.inputTokens;
    const output = item.answer_generation_usage.outputTokens;
    const reasoning = item.answer_generation_usage.reasoningTokens;

    byType[t].total++;
    if (item.evaluation === "yes") byType[t].valid++;
    else byType[t].invalid++;

    byType[t].avgReasoningTokens += reasoning;
  }

  // finalize averages per type
  for (const type of Object.keys(byType)) {
    const x = byType[type];

    x.accuracy = round((x.valid / x.total) * 100);
    x.avgReasoningTokens = round(x.avgReasoningTokens / x.total);
  }

  // ---- FINAL REPORT ----
  return {
    summary: {
      total,
      valid,
      invalid,
      accuracy_percentage: round(accuracy),
    },

    overall_token_usage: {
      input: {
        average: avg(allInput),
        min: round(Math.min(...allInput)),
        max: round(Math.max(...allInput)),
        total: allInput.reduce((a, b) => a + b, 0),
      },
      output: {
        average: avg(allOutput),
        min: round(Math.min(...allOutput)),
        max: round(Math.max(...allOutput)),
        total: allOutput.reduce((a, b) => a + b, 0),
      },
      reasoning_tokens: {
        average: avg(allReasoning),
        min: round(Math.min(...allReasoning)),
        max: round(Math.max(...allReasoning)),
      },
    },

    performance_by_question_type: byType,
  };
}

const inputPath =
  "/Users/lugman/Projects/madhiai-longmemeval/data/gemini-2.5-flash-dynamic-thinking-text-context-eval.json";
const outputPath =
  "gemini-2.5-flash-dynamic-thinking-text-context-eval-report.json";

const input = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as EvalItem[];
const report = generateEvalReport(input);
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
