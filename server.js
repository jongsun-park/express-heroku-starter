import express from "express";
import path from "path";
import xeroRouter from "./api/xero";

const app = express();
const port = process.env.PORT || 5000;

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// routers
app.use("/xero", xeroRouter);

// serve client's build
app.use(express.static(path.join(__dirname, "build")));
app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(5000, () => console.log(`Listening on port ${port}`));
