import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import pLimit from "p-limit";
import cliProgress from "cli-progress";

async function generateImage(browser: Browser, content: string, path: string) {
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
            margin-bottom: 40px;
        }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;

  await page.setContent(html);

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "40px",
      bottom: "40px",
      left: "40px",
      right: "40px",
    },
  });
  fs.writeFileSync(path, pdf);
  await page.close();
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Input file path is required.");
  process.exit(1);
}

const imagesBasePath = "./context-pdfs-max-700";
fs.mkdirSync(imagesBasePath, { recursive: true });

const limit = pLimit(1);

const dataset = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as Question[];

const context: any = [];

dataset.forEach((d) => {
  let text = "";

  d.haystack_sessions.forEach((s, i) => {
    const sessionDate = d.haystack_dates[i];

    text += `<div class="header">
        <p>Session ${i + 1}</p>
        <p>Session Date: ${sessionDate}</p>
    </div>`;
    s.forEach((m) => {
      text += `<p style="margin-bottom: 16px; font-size: 20px; line-height: 28px;"><span style="color:red;font-weight:600;text-transform:capitalize;">${m.role}:</span> ${m.content}</p>`;
    });
  });

  context.push({
    questionId: d.question_id,
    question: d.question,
    questionDate: d.question_date,
    html: text,
  });
});

const browser = await puppeteer.launch({
  headless: true,
});

// fs.writeFileSync("./chunks.json", JSON.stringify(chunks, null, 2));

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
let completed = 0;

bar.start(context.length, 0);

for (const item of context) {
  try {
    await generateImage(
      browser,
      item.html,
      `${imagesBasePath}/${item.questionId}.pdf`
    );
  } catch (e) {
    console.log("Error generating pdf for:", item.questionId, e);
  }
  bar.update(++completed);
}

bar.stop();
