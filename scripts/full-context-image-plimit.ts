import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import cliProgress from "cli-progress";
import fs from "fs";
import pLimit from "p-limit";
import { getFullImageContextPrompt } from "../util";

const inputFilePath = "/Users/lugman/Downloads/longmemeval_s_cleaned.json";

const imageFolder = "./context-images-150dpi";

const outputFilePath =
  "./gemini-2.5-flash-dynamic-thinking-full-image-context.json";

const dataset = JSON.parse(
  fs.readFileSync(inputFilePath, "utf-8")
) as Question[];

const model = google("gemini-2.5-flash");
const modelOptions = { google: { thinkingConfig: { thinkingBudget: -1 } } };

const limit = pLimit(12);

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

console.log(
  `Generating with full context as text for ${dataset.length} entries\n`
);

bar.start(dataset.length, results.length);

const promises = dataset
  .filter((d) => !completedIds.includes(d.question_id))
  .map((entry) =>
    limit(async () => {
      try {
        const files = fs.readdirSync(`${imageFolder}/${entry.question_id}`);

        const { text: answer, usage } = await generateText({
          model: model,
          providerOptions: modelOptions,
          maxRetries: 2,
          messages: [
            {
              role: "user",
              content: [
                ...files.map(
                  (f) =>
                    ({
                      type: "image",
                      image: fs.readFileSync(
                        `${imageFolder}/${entry.question_id}/${f}`,
                        {
                          encoding: "base64",
                        }
                      ),
                    } as any)
                ),
                {
                  type: "text",
                  text: getFullImageContextPrompt(entry),
                },
              ],
            },
          ],
        });

        results.push({
          question_id: entry.question_id,
          hypothesis: answer,
          usage,
        });
        fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
        bar.update(results.length);
      } catch (error) {
        console.error(
          `Error generating text for ${entry.question_id}: ${error}`
        );
      }
    })
  );

Promise.all(promises).then(() => {
  bar.stop();
});
