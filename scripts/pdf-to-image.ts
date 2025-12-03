import { fromPath } from "pdf2pic";
import fs from "fs";

const inputPath = "./context-pdfs-max-700";
const baseOutputPath = "./context-images-max-700";

const files = fs.readdirSync(inputPath);

let count = 0;

for (const file of files) {
  const id = file.split(".")[0];
  fs.mkdirSync(`${baseOutputPath}/${id}`, { recursive: true });

  const options = {
    density: 150,
    saveFilename: "page",
    savePath: `${baseOutputPath}/${id}`,
    format: "png",
    width: 1240,
    height: 1754,
  };

  const convert = fromPath(`${inputPath}/${file}`, options);
  await convert.bulk(-1, { responseType: "image" });

  count++;
  console.log(`Converted ${count} of ${files.length}`);
}
