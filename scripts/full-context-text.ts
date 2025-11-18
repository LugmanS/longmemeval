import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import cliProgress from "cli-progress";
import fs from "fs";
import pLimit from "p-limit";
import { getFullContextPrompt } from "../util";

const inputFilePath = process.argv[2];
if (!inputFilePath) {
  console.error("Input file path is required.");
  process.exit(1);
}

const outputFilePath = process.argv[3];
if (!outputFilePath) {
  console.error("Output file path is required.");
  process.exit(1);
}

const dataset = JSON.parse(
  fs.readFileSync(inputFilePath, "utf-8")
) as Question[];

const model = google("gemini-2.5-flash");
const modelOptions = { google: { thinkingConfig: { thinkingBudget: -1 } } };

const limit = pLimit(20);
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const results: { question_id: string; hypothesis: string }[] = [];

const promises = dataset.map((entry) =>
  limit(async () => {
    const prompt = getFullContextPrompt(entry);
    const { text: answer } = await generateText({
      model: model,
      prompt: prompt,
      providerOptions: modelOptions,
    });

    results.push({
      question_id: entry.question_id,
      hypothesis: answer,
    });
    bar.update(results.length);
    fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
  })
);

bar.start(dataset.length, 0);

await Promise.all(promises);

bar.stop();
