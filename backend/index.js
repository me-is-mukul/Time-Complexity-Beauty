const { execFile } = require("child_process");

execFile("./main", ["file1.txt", "file2.txt"], (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }

  const [percent, flag] = stdout.trim().split(" ");
  console.log(`Similarity: ${percent}%`);
  console.log(`Flag: ${flag}`);
  
});