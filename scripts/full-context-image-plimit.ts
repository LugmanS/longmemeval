import { GoogleGenAI } from "@google/genai";
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

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const config = { thinkingConfig: { thinkingBudget: -1 } };

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

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config,
          contents: [
            {
              role: "user",
              parts: [
                ...files.map((f) => ({
                  inlineData: {
                    data: fs.readFileSync(
                      `${imageFolder}/${entry.question_id}/${f}`,
                      {
                        encoding: "base64",
                      }
                    ),
                    mimeType: "image/png",
                  },
                })),
                { text: getFullImageContextPrompt(entry) },
              ],
            },
          ],
        });

        if (
          !response.candidates ||
          !response.candidates[0] ||
          !response.candidates[0].content ||
          !response.candidates[0].content.parts
        ) {
          console.error(
            `Error with response for document ${entry.question_id}:`,
            response
          );
          return;
        }

        const rawOutput = response.candidates[0]?.content?.parts[0]?.text;
        if (!rawOutput) {
          console.error(
            `Error with response for document ${entry.question_id}:`,
            response
          );
          return;
        }

        results.push({
          question_id: entry.question_id,
          hypothesis: rawOutput,
          usage: response.usageMetadata,
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
