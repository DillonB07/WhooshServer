import fs from "fs";
import path from "path";
import tar from "tar";
import { parseStringPromise } from "xml2js";
import type { docsetItemType } from "./parseDocset";
import stream from "stream";

const DOCS_DIR = path.join(__dirname, "../../docsets/");

export type docsetType = {
  success: boolean;
  message: string;
  docsetPath: string | undefined;
};

async function downloadFile(
  url: string,
  folder: string
): Promise<string | undefined> {
  if (!url) return;

  if (!folder) return;

  let docsetFilename = url.split("/").pop() as string;
  let docsetFilepath = path.join(folder, docsetFilename);
  if (fs.existsSync(docsetFilepath)) {
    // Add unique suffix to filename if it already exists
    let i = 1;
    while (
      fs.existsSync(
        path.join(folder, `${path.parse(docsetFilename).name}_${i}.tgz`)
      )
    ) {
      i++;
    }
    docsetFilename = `${path.parse(docsetFilename).name}_${i}.tgz`;
    docsetFilepath = path.join(folder, docsetFilename);
  }
  return new Promise<string>((resolve, reject) => {
    const file = fs.createWriteStream(docsetFilepath);
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((response) => {
        if (response) {
          const s = new stream.PassThrough();
          s.end(Buffer.from(response));
          s.pipe(file);
          s.on("finish", () => {
            file.close();
            resolve(docsetFilename);
            console.log("Downloaded");
          });
        } else {
          fs.unlink(docsetFilepath, () => {});
          console.error(`Error downloading ${docsetFilepath}`);
        }
      })
      .catch((err) => {
        fs.unlink(docsetFilepath, () => {});
        console.error(`Error downloading ${docsetFilename}: ${err}`);
        reject(err);
      });
  });
}

export async function downloadDocset(xmlFilePath: string): Promise<docsetType> {
  // Parse the XML file
  const xml = await fs.promises.readFile(xmlFilePath);
  console.log("XML file read successfully");
  try {
    const result = await parseStringPromise(xml);
    const root = result.entry;
    const docsetFile = await downloadFile(root.url[1], DOCS_DIR);
    if (docsetFile) {
      // File downloaded successfully - extract docset
      const extractionDir = DOCS_DIR;
      if (!fs.existsSync(extractionDir)) {
        fs.mkdirSync(extractionDir);
      }
      await tar.extract({
        file: path.join(extractionDir, docsetFile),
        cwd: extractionDir,
      });
      await fs.promises.unlink(path.join(extractionDir, docsetFile));
      return {
        success: true,
        message: "Docset successfully downloaded and extracted",
        docsetPath: extractionDir,
      };
    } else {
      console.log("Oops, something went wrong");
      // File not downloaded
      return {
        success: false,
        message: "Docset not found",
        docsetPath: undefined,
      };
    }
  } catch (err) {
    // Error parsing XML or downloading file.
    console.error(err);
    return { success: false, message: "Invalid XML", docsetPath: undefined };
  }
}

export async function getDocsetInfo(
  xmlFilePath: string
): Promise<docsetItemType> {
  const file = fs.readFileSync(xmlFilePath);
  const result = await parseStringPromise(file);

  const version = result.entry?.version?.toString();
  const name = path.basename(xmlFilePath, ".xml");

  return { name, version };
}
