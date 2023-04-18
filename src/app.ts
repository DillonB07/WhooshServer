import express from "express";
import { getAllDocsets } from './helpers/parseDocset'

const app = express();

app.set("view engine", "ejs");

app.get("/api/downloaded-docs", async (_req, res) => {
    const docs = await getAllDocsets()
    res.status(docs ? 200 : 500).json({ success: docs ? true : false, docs });
});

app.listen(3000);
