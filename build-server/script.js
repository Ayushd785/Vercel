const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

async function init() {
  console.log("Executing script.js");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toSting());
  });

  p.stdout.on("error", function (data) {
    console.log("error", data.toSting());
  });

  p.on("close", function () {
    console.log("build complete");
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    for(const filePath of distFolderContents){
        if(fs.lstatSync(filePath).isDirectory) continue;

        
    }
  });
}
