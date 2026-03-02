const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const upload = multer({ dest: "uploads/" });

app.post("/merge", upload.fields([
  { name: "video", maxCount: 1 },
  { name: "audio", maxCount: 1 }
]), async (req, res) => {

  try {
    const videoPath = req.files.video[0].path;
    const audioPath = req.files.audio[0].path;
    const outputPath = `output-${Date.now()}.mp4`;

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v copy",
        "-c:a aac",
        "-shortest",
        "-preset ultrafast"
      ])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, () => {
          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          fs.unlinkSync(outputPath);
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).send("Merge failed");
      });

  } catch (err) {
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
