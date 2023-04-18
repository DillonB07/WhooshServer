import fs from "fs";
import { DOMParser } from "xmldom";


type docsetItem = {
	name: string;
	homePage: string;
};

function getDashIndexFilePath(infoPlist: string): string | undefined {
	const plist = new DOMParser().parseFromString(infoPlist, "application/xml");
	const dict = plist.getElementsByTagName("dict")[0];
	const keys = dict?.getElementsByTagName("key");
    if (!keys || keys.length === 0) return ;
	for (let i = 0; i < keys.length; i++) {
		if (keys[i]?.textContent === "dashIndexFilePath") {
			const value = keys[i]?.nextSibling?.lastChild?.nodeValue;
			return value || undefined;
		}
	}
	return undefined;
}

async function getAllDocsets(): Promise<docsetItem[] | undefined> {
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
		const dashIndexFilePath = getDashIndexFilePath(infoPlist);

        if (dashIndexFilePath == undefined || docsetName == undefined) {
            return 
        }
        
        docsetList.push({name: docsetName, homePage: dashIndexFilePath})
	}
	return docsetList;
}
