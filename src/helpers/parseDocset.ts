import path from "path";
import fs from "fs";
import { DOMParser } from "xmldom";
import { getDocsetInfo } from "./xmlUtils";
import cheerio from "cheerio";
import type { Request } from "express";
import { URL, URLSearchParams } from "url";

export type docsetItemType = {
  name: string;
  version: string | undefined;
  downloaded?: boolean;
};

const DOCS_DIR = path.join(__dirname, "../../docsets/");
const XML_DIR = path.join(__dirname, "../../feeds");

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

export function getDocsetVersionFromPlist(
  infoPlist: string
): string | undefined {
  const plist = new DOMParser().parseFromString(infoPlist, "application/xml");
  const dict = plist.getElementsByTagName("dict")[0];
  const keys = dict?.getElementsByTagName("key");
  if (!keys || keys.length === 0) return;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i]?.textContent == "version") {
      const value = keys[i]?.nextSibling?.textContent;
      return value || undefined;
    }
  }
  return undefined;
}

export async function getAllLocalDocsets(): Promise<docsetItemType[]> {
  // Get all docsets in the docsets folder
  const docsets = await fs.promises.readdir(DOCS_DIR);

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

    docsetList.push({
      name: docsetName ? docsetName : docset,
      version,
      downloaded: true,
    });
  }
  return docsetList;
}

export async function getAllDocsets(): Promise<docsetItemType[]> {
  let docsetList: docsetItemType[] = [];
  const files = fs.readdirSync(XML_DIR);
  const localDocsets = await getAllLocalDocsets();

  for (const file of files) {
    if (file.endsWith(".xml")) {
      // Parse the XML file
      const data = await getDocsetInfo(path.join(XML_DIR, file));
      const item = localDocsets.find(
        (docsetItem) => docsetItem.name === data.name
      );
      if (item) {
        // Item found locally so must be downloaded
        docsetList.push({ ...data, downloaded: true });
      } else {
        // Item not found locally so must not be downloaded
        docsetList.push({ ...data, downloaded: false });
      }
    }
  }
  return docsetList;
}

export async function injectDocset(
  indexPath: string,
  req: Request
): Promise<string> {
  const fileContent = await fs.promises.readFile(indexPath, "utf-8");

  const $ = cheerio.load(fileContent);
  // Add a base href to ensure relative URLs work correctly

  // Get the query parameters from the URL
  const queryParams = new URLSearchParams(req.url.split("?")[1]);

  // Select all links on the page and add the query parameters to their href attributes
  $("head").prepend(`<base href="/files${path.dirname(indexPath)}/docs">`);

  $("a").attr("href", function (_, href) {
    const url = new URL(String(href), `${req.protocol}://${req.get("host")}`);
    queryParams.forEach((val, key) => {
      url.searchParams.append(key, val);
    });
    return url.href.startsWith("/")
      ? url.href
      : url.href.replace(/^.*\/\/[^\/]+/, "");
  });

  // Add the script and style elements to the head of the page
  $("head").append(`
  <script>
    const parsedParams = new URLSearchParams(window.location.search.substring(1));

    for (let [key, value] of parsedParams.entries()) {
        if (key == 'color') {
            key = '--injected-color';
        }
        if (document.body) {
            document.body.style.setProperty(key, value);
        } else {
            document.documentElement.style.setProperty(key, value);
        }
    }
  </script>

  <style>
    @layer whoosh {
      body {
        background-color: inherit !important;
      }

      *:not(svg *, .gatsby-highlight .token, .dash-ignore-dark-mode) {
        color: var(--injected-color) !important;
      }
    }

    @layer whoosh;
  </style>
`);
  return $.html();
}
