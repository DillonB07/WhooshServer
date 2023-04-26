import path from "path"
import fs from "fs";
import { DOMParser } from "xmldom";
import {getDocsetInfo} from "./xmlUtils"

export type docsetItemType = {
    name: string;
    version: string;
};

export function getDashIndexFilePath(infoPlist: string): string | undefined {
    const plist = new DOMParser().parseFromString(infoPlist, "application/xml");
    const dict = plist.getElementsByTagName("dict")[0];
    const keys = dict?.getElementsByTagName("key");
    if (!keys || keys.length === 0) return;
    for (let i = 0; i < keys.length; i++) {
        if (keys[i]?.textContent === "dashIndexFilePath") {
            const value = keys[i]?.nextSibling?.lastChild?.nodeValue;
            return value || undefined;
        }
    }
    return undefined;
}

function getDocsetVersionFromPlist(infoPlist: string): string | undefined {
    const plist = new DOMParser().parseFromString(infoPlist, 'application/xml');
    const dict = plist.getElementsByTagName('dict')[0]
    const keys = dict?.getElementsByTagName('key');
    if (!keys || keys.length === 0) return;
    for (let i = 0; i < keys.length; i ++) {
        if (keys[i]?.textContent == "version") {
            const value = keys[i]?.nextSibling?.textContent;
            return value || undefined
        }
    }
    return undefined
}

export async function getAllLocalDocsets(): Promise<docsetItemType[] | undefined> {
    // Get all docsets in the docsets folder
    const docsets = await fs.promises.readdir("./docsets");

    let docsetList = [];
    for (const docset of docsets) {
        // Get the docset name from folder name
        const docsetName = docset.split(".")[0];
        // Open info.plist inside docset to get filepath for docs
        const infoPlist = await fs.promises.readFile(
            `./docsets/${docset}/Contents/Info.plist`,
            "utf8"
        );
        const version = getDocsetVersionFromPlist(infoPlist);

        if (version == undefined || docsetName == undefined) {
            return
        }

        docsetList.push({ name: docsetName, version })
    }
    return docsetList;
}

export async function getAllDocsets(): Promise<docsetItemType[]> {
    let docsetList: docsetItemType[] = []
    const xmlFolder = './feeds'
    const files = fs.readdirSync(xmlFolder)

    for (const file of files) {
      if (file.endsWith('.xml')) {
          // Parse the XML file
          const data = await getDocsetInfo(path.join(xmlFolder, file))
          docsetList.push(data)
      }
    }
    return docsetList
}

