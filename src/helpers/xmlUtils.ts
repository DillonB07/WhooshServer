import https from "https";
import fs from "fs";
import path from "path";
import { parseStringPromise } from "xml2js";
import type {docsetItemType} from './parseDocset'

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
        https
            .get(url, (response) => {
                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    console.log(`Downloaded ${docsetFilename}`);
                    resolve(docsetFilepath);
                });
            })
            .on("error", (err) => {
                fs.unlink(docsetFilepath, () => { });
                console.error(`Error downloading ${docsetFilename}: ${err}`);
                reject(err);
            });
    });
}

export async function downloadDocset(xmlFilePath: string): Promise<docsetType> {
    // Parse the XML file
    const xml = await fs.promises.readFile(xmlFilePath);
    try {
        const result = await parseStringPromise(xml);
        const root = result.entry;
        const docsetFile = await downloadFile(root.url[1], "./docsets");
        if (docsetFile) {
            // File downloaded successfully
            return {
                success: true,
                message: "Docset successfully downloaded",
                docsetPath: docsetFile,
            };
        } else {
            // File not downloaded
            return {
                success: false,
                message: "Docset not found",
                docsetPath: undefined,
            };
        }
    } catch (err) {
        // Error parsing XML or downloading file.
        return { success: false, message: "Invalid XML", docsetPath: undefined };
    }
}


export async function getDocsetInfo(xmlFilePath: string): Promise<docsetItemType> {
    const file = fs.readFileSync(xmlFilePath)
    const result = await parseStringPromise(file)
    
    const version = result.entry?.version?.toString()
    const name = path.basename(xmlFilePath, '.xml')
    return {name, version}
}

