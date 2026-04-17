const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const BINARY = path.resolve(__dirname, process.platform === "win32" ? "main.exe" : "main");

app.use(cors());

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.endsWith(".txt")) {
      return cb(new Error("Only .txt files are accepted"));
    }
    cb(null, true);
  },
});

function deleteTempFiles(files) {
  files.forEach((f) => fs.unlink(f.path, () => {}));
}

function parseOutput(stdout) {
  const parts = stdout.trim().split(/\s+/);
  if (parts.length < 2) throw new Error("Unexpected output from binary");
  const similarity = parseFloat(parts[0]);
  const flag = parts[1] === "1";
  if (isNaN(similarity)) throw new Error("Could not parse similarity value");
  return { similarity, flag };
}

function combinations(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}

function runBinary(binaryPath, path1, path2) {
  return new Promise((resolve, reject) => {
    execFile(binaryPath, [path1, path2], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(parseOutput(stdout));
    });
  });
}

async function withConcurrency(tasks, limit) {
  const results = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const chunk = tasks.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((t) => t()));
    results.push(...chunkResults);
  }
  return results;
}

app.post("/check-plagiarism", upload.fields([{ name: "file1", maxCount: 1 }, { name: "file2", maxCount: 1 }]), (req, res) => {
  const file1 = req.files?.file1?.[0];
  const file2 = req.files?.file2?.[0];

  if (!file1 || !file2) return res.status(400).json({ error: "Both files are required" });
  if (file1.size === 0 || file2.size === 0) {
    deleteTempFiles([file1, file2]);
    return res.status(400).json({ error: "Files must not be empty" });
  }

  const binaryPath = BINARY;

  execFile(binaryPath, [file1.path, file2.path], (error, stdout, stderr) => {
    deleteTempFiles([file1, file2]);
    if (error) return res.status(500).json({ error: "Binary execution failed", detail: stderr || error.message });
    try {
      res.json(parseOutput(stdout));
    } catch (e) {
      res.status(500).json({ error: "Failed to parse binary output", detail: e.message });
    }
  });
});

app.post("/check-plagiarism-batch", upload.array("files", 50), async (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    files?.forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(400).json({ error: "Upload at least 2 .txt files" });
  }

  const emptyFile = files.find((f) => f.size === 0);
  if (emptyFile) {
    deleteTempFiles(files);
    return res.status(400).json({ error: `"${emptyFile.originalname}" is empty` });
  }

  const binaryPath = BINARY;
  const pairs = combinations(files);

  try {
    const tasks = pairs.map(([f1, f2]) => async () => {
      const result = await runBinary(binaryPath, f1.path, f2.path);
      return { file1: f1.originalname, file2: f2.originalname, ...result };
    });

    const results = await withConcurrency(tasks, 4);
    const mean = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    res.json({ pairs: results, mean });
  } catch (err) {
    res.status(500).json({ error: "Binary execution failed", detail: err.message });
  } finally {
    deleteTempFiles(files);
  }
});

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large (max 5MB)" });
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
