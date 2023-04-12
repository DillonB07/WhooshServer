import express from "express";

const app = express();

app.set("view engine", "ejs");

app.get("/abc", (req, res) => {
  res.render("index", { title: "Hello World" });
});

app.listen(3000);
