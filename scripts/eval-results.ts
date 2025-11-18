import fs from "fs";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import pLimit from "p-limit";
import { getEvalPrompt } from "../util";

const referenceFile = process.argv[2];
if (!referenceFile) {
  console.error("Reference file path is required.");
  process.exit(1);
}

const responseFile = process.argv[3];
if (!responseFile) {
  console.error("Response file path is required.");
  process.exit(1);
}

const outputFilePath =
  "./gemini-2.5-flash-dynamic-thinking-text-context-eval.json";

const reference = JSON.parse(
  fs.readFileSync(referenceFile, "utf-8")
) as Question[];
const response = JSON.parse(
  fs.readFileSync(responseFile, "utf-8")
) as Hypothesis[];

const evalResults: any = [];
const completedIds: string[] = [];

if (fs.existsSync(outputFilePath)) {
  const existing = JSON.parse(
    fs.readFileSync(outputFilePath, "utf-8")
  ) as Hypothesis[];
  existing.forEach((h) => {
    evalResults.push(h);
    completedIds.push(h.question_id);
  });
}

const model = google("gemini-2.5-pro");
const modelOptions = { google: { thinkingConfig: { thinkingBudget: -1 } } };

const limit = pLimit(5);

const promises = response.map((h) =>
  limit(async () => {
    if (completedIds.includes(h.question_id)) return;
    const item = reference.find((q) => q.question_id === h.question_id);
    if (!item) {
      console.error(`Could not find item for ${h.question_id}`);
      return;
    }

    const prompt = getEvalPrompt(
      item.question_type,
      item.question,
      item.answer,
      h.hypothesis
    );
    if (!prompt) {
      console.error(`Could not generate prompt for ${h.question_id}`);
      return;
    }
    const { text: answer, usage } = await generateText({
      model,
      prompt,
      providerOptions: modelOptions,
      maxRetries: 2,
    });

    evalResults.push({
      question_id: h.question_id,
      question_type: item.question_type,
      answer: item.answer,
      hypothesis: h.hypothesis,
      evaluation: answer,
      answer_generation_usage: h.usage,
      evaluation_usage: usage,
    });

    fs.writeFileSync(outputFilePath, JSON.stringify(evalResults, null, 2));
  })
);

await Promise.all(promises);
