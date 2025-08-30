const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

async function init() {
  console.log("Executing script.js");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString()); // Fixed toString()
  });

  p.stderr.on("data", function (data) {
    console.log("error", data.toString());
  });

  p.on("close", async function (code) {
    console.log(`Build process exited with code ${code}`);

    if (code !== 0) {
      console.error("Build failed");
      return;
    }

    console.log("Build complete");
    const distFolderPath = path.join(outDirPath, "dist");

    // Check if dist folder exists
    if (!fs.existsSync(distFolderPath)) {
      console.error("Dist folder does not exist at path:", distFolderPath);
      return;
    }

    console.log("Starting upload to S3...");

    // Recursive function to upload files
    async function uploadDirectory(dirPath, s3Prefix = "") {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeS3Path = path.join(s3Prefix, item);

        if (fs.lstatSync(fullPath).isDirectory()) {
          // If it's a directory, recursively upload its contents
          await uploadDirectory(fullPath, relativeS3Path);
        } else {
          // If it's a file, upload it to S3
          try {
            const fileStream = fs.createReadStream(fullPath);
            const contentType = mime.lookup(item) || "application/octet-stream";

            const command = new PutObjectCommand({
              Bucket: "vercel-ayush-clone",
              Key: `__outputs/${PROJECT_ID}/${relativeS3Path}`,
              Body: fileStream,
              ContentType: contentType,
            });

            await s3Client.send(command);
            console.log("✅ Uploaded:", relativeS3Path);
          } catch (uploadError) {
            console.error("❌ Failed to upload:", relativeS3Path, uploadError);
          }
        }
      }
    }

    try {
      await uploadDirectory(distFolderPath);
      console.log("🎉 All files uploaded successfully!");
    } catch (error) {
      console.error("💥 Upload process failed:", error);
    }
  });
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

init();
