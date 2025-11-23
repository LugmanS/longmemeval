import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import pLimit from "p-limit";
import cliProgress from "cli-progress";

async function generateImage(
  browser: Browser,
  sessionIndex: number,
  sessionDate: string,
  content: string,
  path: string
) {
  const page = await browser.newPage();

  const html = `<html>
  <head>
    <style>
      *{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            background: #fff;
        }
        .header {
            border-bottom: 1px solid gray;
            padding: 16px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 18px;
        }
    </style>
  </head>
  <body>
    <div class="header">
        <p>Session ${sessionIndex}</p>
        <p>Session Date: ${sessionDate}</p>
    </div>
    <div style="padding: 16px 40px;">
        ${content}
    </div>
  </body>
</html>`;

  await page.setViewport({
    width: 794,
    height: 1123,
    deviceScaleFactor: 150 / 96,
  });

  await page.setContent(html);

  await page.screenshot({
    path: `${path}.png`,
    type: "png",
    fullPage: true,
  });

  await page.close();
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Input file path is required.");
  process.exit(1);
}

const imagesBasePath = "./context-images-150dpi";
fs.mkdirSync(imagesBasePath, { recursive: true });

const limit = pLimit(100);

const dataset = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as Question[];

const chunks: {
  questionId: string;
  sessionId: string;
  sessionDate: string;
  sessionIndex: number;
  chunkContent: Message[];
  questionChunkIndex: number;
}[] = [];

dataset.forEach((d) => {
  let chunkCount = 0;
  d.haystack_sessions.forEach((s, i) => {
    const sessionId = d.haystack_session_ids[i];
    const sessionDate = d.haystack_dates[i];

    let chunkCharCount = 0;
    let chunkContent: Message[] = [];

    s.forEach((m, j) => {
      chunkCharCount += m.content.length;

      if (chunkCharCount >= 5500) {
        chunks.push({
          questionId: d.question_id,
          sessionId: sessionId || "",
          sessionIndex: i + 1,
          sessionDate: sessionDate || "",
          chunkContent,
          questionChunkIndex: ++chunkCount,
        });
        chunkContent = [{ ...m }];
        chunkCharCount = m.content.length;
        return;
      }

      chunkContent.push(m);
    });

    if (chunkContent.length > 0) {
      chunks.push({
        questionId: d.question_id,
        sessionId: sessionId || "",
        sessionDate: sessionDate || "",
        sessionIndex: i + 1,
        chunkContent,
        questionChunkIndex: ++chunkCount,
      });
    }
  });
});

const browser = await puppeteer.launch({
  headless: true,
});

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

let completed = 0;

const filteredItems = chunks.filter(
  (item) =>
    !fs.existsSync(
      `${imagesBasePath}/${item.questionId}/${item.questionChunkIndex}.png`
    )
);

console.log(
  `Generating ${filteredItems.length} images, chunks: ${chunks.length}`
);

bar.start(filteredItems.length, 0);

const promises = filteredItems.map((chunk) =>
  limit(async () => {
    const imagePath = `${imagesBasePath}/${chunk.questionId}`;
    try {
      const content = chunk.chunkContent
        .map(
          (m) =>
            `<p style="margin-bottom: 16px;"><span style="color:red;font-weight:600;text-transform:capitalize;">${m.role}:</span> ${m.content}</p>`
        )
        .join(" ");
      fs.mkdirSync(imagePath, { recursive: true });

      const path = `${imagePath}/${chunk.questionChunkIndex}`;
      await generateImage(
        browser,
        chunk.sessionIndex,
        chunk.sessionDate,
        content,
        path
      );
      bar.update(++completed);
    } catch (e) {
      console.log(
        `Error generating image for ${imagePath}/${chunk.questionChunkIndex}:`,
        e
      );
    }
  })
);

await Promise.all(promises);

await browser.close();
bar.stop();
