const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();

// IMPORTANT: Tell fluent-ffmpeg where ffmpeg is installed (Docker path)
ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");

// Increase body limits (important for video uploads)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Ensure uploads folder exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Multer config
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

app.post("/merge", upload.any(), async (req, res) => {

  try {

    if (!req.files || req.files.length < 2) {
      return res.status(400).send("Video and audio files are required");
    }

    // Find files by field name
    const videoFile = req.files.find(f => f.fieldname === "video");
    const audioFile = req.files.find(f => f.fieldname === "audio");

    if (!videoFile || !audioFile) {
      return res.status(400).send("Fields must be named 'video' and 'audio'");
    }

    const outputPath = path.join("uploads", `output-${Date.now()}.mp4`);

ffmpeg()
  .input(videoFile.path)            // 0: video
  .input(voiceFile.path)            // 1: voice
  .input("assets/background.mp3")   // 2: music
  .input("assets/whoosh.mp3")       // 3: sfx

  .complexFilter([
    // Lower music volume
    "[2:a]volume=0.2[music];",

    // Lower sfx slightly
    "[3:a]volume=0.5[sfx];",

    // Mix voice + music + sfx
    "[1:a][music][sfx]amix=inputs=3:dropout_transition=0[aout]"
  ])

  .outputOptions([
    "-map 0:v",
    "-map [aout]",
    "-c:v copy",
    "-c:a aac",
    "-shortest"
  ])
  .save(outputPath)
  .on("end", () => {

       res.setHeader("Content-Type", "video/mp4");
res.setHeader("Content-Disposition", "attachment; filename=merged.mp4");

const fileStream = fs.createReadStream(outputPath);
fileStream.pipe(res);

fileStream.on("close", () => {
  try {
    fs.unlinkSync(videoFile.path);
    fs.unlinkSync(audioFile.path);
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error("Cleanup error:", err);
  }
});

      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        res.status(500).send("Merge failed");
      });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Server error");
  }

});

// Health check route (optional but useful)
app.get("/", (req, res) => {
  res.send("Video Merge API is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
