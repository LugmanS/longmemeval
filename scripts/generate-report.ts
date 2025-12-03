import fs from "fs";

type EvalItem = {
  question_id: string;
  question_type: string;
  evaluation: "yes" | "no";
  answer_generation_usage: {
    promptTokenCount: number; // input tokens
    totalTokenCount: number; // input + output
    thoughtsTokenCount: number; // subset of output
  };
};

export function generateEvalReport(items: EvalItem[]) {
  const total = items.length;

  const valid = items.filter((i) => i.evaluation === "yes").length;
  const invalid = total - valid;
  const accuracy = total === 0 ? 0 : (valid / total) * 100;

  const round = (n: number) => Number(n.toFixed(2));

  // ---- GLOBAL TOKEN STATS ----
  const allInput = items.map((i) => i.answer_generation_usage.promptTokenCount);
  const allOutput = items.map(
    (i) =>
      i.answer_generation_usage.totalTokenCount -
      i.answer_generation_usage.promptTokenCount
  );
  const allThinking = items.map(
    (i) => i.answer_generation_usage.thoughtsTokenCount
  );

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : round(arr.reduce((a, b) => a + b, 0) / arr.length);

  // ---- QUESTION TYPE AGGREGATION ----
  const byType: Record<string, any> = {};

  for (const item of items) {
    const t = item.question_type;

    if (!byType[t]) {
      byType[t] = {
        total: 0,
        valid: 0,
        invalid: 0,
        avgThinkingTokens: 0,
      };
    }

    const input = item.answer_generation_usage.promptTokenCount;
    const output =
      item.answer_generation_usage.totalTokenCount -
      item.answer_generation_usage.promptTokenCount;
    const thinking = item.answer_generation_usage.thoughtsTokenCount;

    byType[t].total++;
    if (item.evaluation === "yes") byType[t].valid++;
    else byType[t].invalid++;

    // accumulate sums for averages
    byType[t].avgThinkingTokens += thinking;
  }

  // finalize averages
  for (const t of Object.keys(byType)) {
    const x = byType[t];
    x.accuracy = round((x.valid / x.total) * 100);
    x.avgThinkingTokens = round(x.avgThinkingTokens / x.total);
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
        total: round(allInput.reduce((a, b) => a + b, 0)),
      },
      output: {
        average: avg(allOutput),
        min: round(Math.min(...allOutput)),
        max: round(Math.max(...allOutput)),
        total: round(allOutput.reduce((a, b) => a + b, 0)),
      },
      thinking: {
        average: avg(allThinking),
        min: round(Math.min(...allThinking)),
        max: round(Math.max(...allThinking)),
      },
    },

    performance_by_question_type: byType,
  };
}

const inputPath =
  "/Users/lugman/Projects/madhiai-longmemeval/data/gemini-2.5-flash-dynamic-thinking-image-context-eval.json";
const outputPath =
  "gemini-2.5-flash-dynamic-thinking-image-context-1200-eval-report.json";

const input = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as EvalItem[];
const report = generateEvalReport(input);
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
