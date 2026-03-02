const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();

// Body limits
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Create uploads folder if not exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Multer setup
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 }
});


// ======================================================
// 1️⃣ MERGE ROUTE (Scene Creation)
// video + voice + background music + sfx
// ======================================================

app.post("/merge", upload.any(), async (req, res) => {

  try {

    const videoFile = req.files.find(f => f.fieldname === "video");
    const voiceFile = req.files.find(f => f.fieldname === "audio");

    if (!videoFile || !voiceFile) {
      return res.status(400).send("Fields must be named 'video' and 'audio'");
    }

    const outputPath = path.join("uploads", `scene-${Date.now()}.mp4`);

    ffmpeg()
      .input(videoFile.path)              // 0 - video
      .input(voiceFile.path)              // 1 - voice
      .input("background.mp3")           // 2 - music
      .input("whoosh.mp3")               // 3 - sfx

      .complexFilter([
        "[2:a]volume=0.2[music];",
        "[3:a]volume=0.6[sfx];",
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

        const stream = fs.createReadStream(outputPath);
        stream.pipe(res);

        stream.on("close", () => {
          try {
            fs.unlinkSync(videoFile.path);
            fs.unlinkSync(voiceFile.path);
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


// ======================================================
// 2️⃣ CONCAT ROUTE (Cinematic Final Merge)
// Adds slide transition between clips
// ======================================================

app.post("/concat", upload.array("videos"), async (req, res) => {

  try {

    if (!req.files || req.files.length < 2) {
      return res.status(400).send("At least 2 videos required");
    }

    const files = req.files;
    const outputPath = path.join("uploads", `final-${Date.now()}.mp4`);

    const command = ffmpeg();

    files.forEach(file => {
      command.input(file.path);
    });

    // Build xfade transitions
    const filterParts = [];
    files.forEach((file, index) => {
      filterParts.push(`[${index}:v:0]setpts=PTS-STARTPTS[v${index}]`);
    });

    let lastVideo = "v0";
    let offset = 4; // adjust if scenes longer

    for (let i = 1; i < files.length; i++) {
      filterParts.push(
        `[${lastVideo}][v${i}]xfade=transition=slideleft:duration=0.4:offset=${offset}[v${i}out]`
      );
      lastVideo = `v${i}out`;
      offset += 4;
    }

    command
      .complexFilter(filterParts)
      .outputOptions([
        `-map [${lastVideo}]`,
        "-c:v libx264",
        "-c:a aac"
      ])
      .save(outputPath)

      .on("end", () => {

        res.setHeader("Content-Type", "video/mp4");

        const stream = fs.createReadStream(outputPath);
        stream.pipe(res);

        stream.on("close", () => {
          try {
            files.forEach(f => fs.unlinkSync(f.path));
            fs.unlinkSync(outputPath);
          } catch (err) {
            console.error("Cleanup error:", err);
          }
        });

      })

      .on("error", (err) => {
        console.error("Concat error:", err);
        res.status(500).send("Concat failed");
      });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Server error");
  }

});


// ======================================================
// Health Check
// ======================================================

app.get("/", (req, res) => {
  res.send("Video Merge API is running");
});


const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
