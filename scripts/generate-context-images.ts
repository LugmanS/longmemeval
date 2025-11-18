import puppeteer from "puppeteer";
import fs from "fs";
import pLimit from "p-limit";

async function generateImage(
  sessionIndex: number,
  sessionDate: string,
  content: string,
  path: string
) {
  const browser = await puppeteer.launch({
    headless: true,
  });
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
    deviceScaleFactor: 300 / 96,
  });

  await page.setContent(html);

  await page.screenshot({
    path: `${path}.png`,
    type: "png",
    fullPage: true,
  });
  await browser.close();
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Input file path is required.");
  process.exit(1);
}

const imagesBasePath = "./context-images";
fs.mkdirSync(imagesBasePath, { recursive: true });

const limit = pLimit(20);

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
      console.log(j, chunkCharCount, chunkContent.length);

      if (chunkCharCount >= 5500) {
        chunks.push({
          questionId: d.question_id,
          sessionId: sessionId || "",
          sessionIndex: i + 1,
          sessionDate: sessionDate || "",
          chunkContent,
          questionChunkIndex: ++chunkCount,
        });
        console.log("new chunk");
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

fs.writeFileSync(`chunks.json`, JSON.stringify(chunks, null, 2));

const promises = chunks.map((chunk) =>
  limit(async () => {
    const content = chunk.chunkContent
      .map(
        (m) =>
          `<p style="margin-bottom: 16px;"><span style="color:red;font-weight:600;text-transform:capitalize;">${m.role}:</span> ${m.content}</p>`
      )
      .join(" ");
    const imagePath = `${imagesBasePath}/${chunk.questionId}`;
    fs.mkdirSync(imagePath, { recursive: true });

    const path = `${imagePath}/${chunk.questionChunkIndex}`;
    await generateImage(chunk.sessionIndex, chunk.sessionDate, content, path);
  })
);

await Promise.all(promises);
