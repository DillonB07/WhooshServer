import express from "express";
import type { Request, Response } from "express";
import {
    getAllLocalDocsets,
    getAllDocsets,
    getDashIndexFilePath,
} from "./helpers/parseDocset";
import { downloadDocset } from "./helpers/xmlUtils";
import path from "path";
import fs from "fs";
import cheerio from "cheerio";

const app = express();
const XML_DIR = path.join(__dirname, "..", "feeds");
const DOCS_DIR = path.join(__dirname, "..", "docsets");

app.set("view engine", "ejs");

app.get("/docs/:libname", async (req: Request, res: Response) => {
    const libname = req.params["libname"];
    if (!libname) {
        res.status(400).send("Missing library name");
        return;
    }

    const libnameEncoded = encodeURIComponent(libname.toLowerCase());
    const docsets = fs.readdirSync(DOCS_DIR);

    const docsetFileName = docsets.find((docset) => {
        const docsetLower = docset.toLowerCase();
        return (
            docsetLower.includes(libnameEncoded) && docsetLower.endsWith(".docset")
        );
    });

    if (!docsetFileName) {
        const xmls = fs.readdirSync(XML_DIR);
        const xmlFileName = xmls.find((xml) => {
            const xmlLower = xml.toLowerCase();
            return xmlLower.includes(libnameEncoded) && xmlLower.endsWith(".xml");
        });
        if (xmlFileName) {
            console.log("Downloading");
            await downloadDocset(path.join(XML_DIR, xmlFileName));
            return res.status(200).send("Docset downloaded");
        }
        return res.status(404).send("Could not find docset");
    }
    const infoPlist = await fs.promises.readFile(
        path.join(DOCS_DIR, docsetFileName, "Contents/Info.plist"),
        "utf8"
    );

    const docsetPath = getDashIndexFilePath(infoPlist);
    if (docsetPath == undefined) {
        return res
            .status(500)
            .json({ success: false, error: "Internal Server Error" });
    }

    const indexPath = path.join(
        DOCS_DIR,
        docsetFileName,
        "Contents/Resources/Documents",
        docsetPath
    );
    const fileContent = await fs.promises.readFile(indexPath, "utf-8");

    // Add base element to support the structure of the project
    const $ = cheerio.load(fileContent);
    $("head").prepend(`<base href="/files${path.dirname(indexPath)}/docs">`);

    return res.send($.html());
});

app.get("/files/*", async (req: Request, res: Response) => {
    if (!req.params[0]) {
        return res.status(500).send("Internal Server Error");
    }
    try {
        const filePath = path.resolve(`/${req.params[0]}`);

        // Check if the file path is valid
        if (
            !filePath.startsWith(path.join(__dirname, "..", "docsets")) ||
            filePath.includes("..")
        ) {
            return res.status(400).send("Invalid file path");
        }
        const fileContent = await fs.promises.readFile(filePath, "utf-8");

        if (filePath.endsWith(".html")) {
            // Add base element to support the structure of the project
            const $ = cheerio.load(fileContent);
            const baseUrl = `/files${path.join("/", path.dirname(filePath))}/docs`;
            $("head").prepend(`<base href="${baseUrl}">`);

            return res.send($.html());
        } else {
            return res.sendFile(filePath);
        }
    } catch (err) {
        // console.error(err);

        return res.status(500).send("Internal Server Error");
    }
});

app.get("/api/downloaded-docs", async (_req: Request, res: Response) => {
    try {
        const docs = await getAllLocalDocsets();
        res.status(200).json({ success: true, docs });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get("/api/all-docs", async (_req: Request, res: Response) => {
    try {
        const docs = await getAllDocsets();
        res.status(200).json({ success: true, docs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.get('/api/download/:libname', async (req: Request, res: Response) => {
    const libname = req.params['libname']
    if (!libname) {
        return res.status(400).send("Missing library name");
    }

    const libnameEncoded = encodeURIComponent(libname.toLowerCase());
    const docsets = fs.readdirSync(DOCS_DIR);

    const docsetFileName = docsets.find((docset) => {
        const docsetLower = docset.toLowerCase();
        return (
            docsetLower.includes(libnameEncoded) && docsetLower.endsWith(".docset")
        );
    });

    if (docsetFileName) {
        return res.status(417).send('Docset already exists')
    }

    const xmls = fs.readdirSync(XML_DIR);
    const xmlFileName = xmls.find((xml) => {
        const xmlLower = xml.toLowerCase();
        return xmlLower.includes(libnameEncoded) && xmlLower.endsWith(".xml");
    });
    if (!xmlFileName) {
        return res.status(404).send("Could not find docset");
    }
    console.log("Downloading");
    const downloadRes = await downloadDocset(path.join(XML_DIR, xmlFileName));
    return res.status(200).send(`Docset downloaded: ${downloadRes}`);

})


app.listen(3000);
console.log("Running on port 3000");
