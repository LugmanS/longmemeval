import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import cliProgress from "cli-progress";
import fs from "fs";
import pThrottle from "p-throttle";
import { getFullContextPrompt } from "../util";

const inputFilePath = process.argv[2];
if (!inputFilePath) {
  console.error("Input file path is required.");
  process.exit(1);
}

const outputFilePath =
  "./gemini-2.5-flash-dynamic-thinking-full-text-context.json";
if (!outputFilePath) {
  console.error("Output file path is required.");
  process.exit(1);
}

const dataset = JSON.parse(
  fs.readFileSync(inputFilePath, "utf-8")
) as Question[];

const model = google("gemini-2.5-flash");
const modelOptions = { google: { thinkingConfig: { thinkingBudget: -1 } } };

const throttle = pThrottle({
  limit: 4,
  interval: 1000 * 60,
});
const results: {
  question_id: string;
  hypothesis: string;
  usage: any;
}[] = [];

const completedIds: string[] = [];
if (fs.existsSync(outputFilePath)) {
  const existingResults = JSON.parse(
    fs.readFileSync(outputFilePath, "utf-8")
  ) as {
    question_id: string;
    hypothesis: string;
    usage: any;
  }[];
  for (const result of existingResults) {
    results.push(result);
    completedIds.push(result.question_id);
  }
}

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const throttled = throttle(async (entry) => {
  try {
    const prompt = getFullContextPrompt(entry);
    const { text: answer, usage } = await generateText({
      model: model,
      prompt: prompt,
      providerOptions: modelOptions,
      maxRetries: 2,
    });

    results.push({
      question_id: entry.question_id,
      hypothesis: answer,
      usage,
    });
    bar.update(results.length);
    fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(`Error generating text for ${entry.question_id}: ${error}`);
  }
});

console.log(
  `Generating with full context as text for ${dataset.length} entries\n`
);

bar.start(dataset.length, results.length);

for (const entry of dataset.filter(
  (d) => !completedIds.includes(d.question_id)
)) {
  (async () => {
    await throttled(entry);
  })();
}
