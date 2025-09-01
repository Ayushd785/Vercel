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
  console.log("🚀 Executing script.js");
  console.log("📁 Project ID:", PROJECT_ID);
  console.log("🪣 Bucket:", "vercel-clone-ayush-0704");

  const outDirPath = path.join(__dirname, "output");

  if (!fs.existsSync(outDirPath)) {
    console.error("❌ Output directory does not exist:", outDirPath);
    return;
  }

  console.log("📦 Installing dependencies and building project...");
  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
  });

  p.stderr.on("data", function (data) {
    console.log("error", data.toString());
  });

  p.on("close", async function (code) {
    console.log(`🔨 Build process exited with code ${code}`);

    if (code !== 0) {
      console.error("❌ Build failed");
      return;
    }

    console.log("✅ Build complete");

    // Check for common build output directories
    let distFolderPath = path.join(outDirPath, "dist");

    if (!fs.existsSync(distFolderPath)) {
      // Try 'build' folder (common for Create React App)
      distFolderPath = path.join(outDirPath, "build");

      if (!fs.existsSync(distFolderPath)) {
        console.error("❌ Neither 'dist' nor 'build' folder exists");
        console.log("📁 Available directories:", fs.readdirSync(outDirPath));
        return;
      } else {
        console.log("📁 Found 'build' folder, using it as output directory");
      }
    } else {
      console.log("📁 Found 'dist' folder, using it as output directory");
    }

    console.log("✏️ Fixing HTML asset paths...");

    // Function to fix HTML and JS asset paths
    function fixAssetPaths(distPath) {
      // Fix HTML paths
      const indexHtmlPath = path.join(distPath, "index.html");

      if (fs.existsSync(indexHtmlPath)) {
        let htmlContent = fs.readFileSync(indexHtmlPath, "utf8");

        console.log(
          "📄 Original HTML snippet:",
          htmlContent.substring(0, 200) + "..."
        );

        // Convert absolute paths to relative paths
        htmlContent = htmlContent
          .replace(/href="\/([^"]+)"/g, 'href="./$1"') // Fix CSS and other href links
          .replace(/src="\/([^"]+)"/g, 'src="./$1"'); // Fix JS and other src links

        // Write the fixed HTML back
        fs.writeFileSync(indexHtmlPath, htmlContent);
        console.log("✅ Fixed paths in index.html");
      }

      // Fix JS files that might contain asset references
      const assetsDir = path.join(distPath, "assets");
      if (fs.existsSync(assetsDir)) {
        const jsFiles = fs
          .readdirSync(assetsDir)
          .filter((file) => file.endsWith(".js"));

        jsFiles.forEach((jsFile) => {
          const jsFilePath = path.join(assetsDir, jsFile);
          let jsContent = fs.readFileSync(jsFilePath, "utf8");

          // Fix asset paths in JavaScript files
          const originalContent = jsContent;
          jsContent = jsContent.replace(
            /["']\/([^"']+\.(svg|png|jpg|jpeg|gif|ico))["']/g,
            '"./$1"'
          );

          if (jsContent !== originalContent) {
            fs.writeFileSync(jsFilePath, jsContent);
            console.log(`✅ Fixed asset paths in ${jsFile}`);
          }
        });
      }
    }

    // Fix the HTML paths
    fixAssetPaths(distFolderPath);

    console.log("📤 Starting upload to S3...");

    // Recursive function to upload files
    async function uploadDirectory(dirPath, s3Prefix = "") {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeS3Path = path.posix.join(s3Prefix, item); // ✅ always forward slashes

        if (fs.lstatSync(fullPath).isDirectory()) {
          // If it's a directory, recursively upload its contents
          await uploadDirectory(fullPath, relativeS3Path);
        } else {
          // If it's a file, upload it to S3
          try {
            const fileStream = fs.createReadStream(fullPath);
            const contentType = mime.lookup(item) || "application/octet-stream";

            const command = new PutObjectCommand({
              Bucket: "vercel-clone-ayush-0704",
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
      console.log("🎉 All files uploaded successfully to S3!");
      console.log(
        `🌐 Preview URL: https://d167957v6g2q0.cloudfront.net/${PROJECT_ID}/`
      );
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
