const fs = require("fs-extra");
const path = require("path");
const { minify } = require("terser");

const args = process.argv.slice(2);
const isProduction = args.includes("--production");

const srcDir = "./";
const distDir = "./dist";

// Files to process
const jsFiles = [
  "background.js",
  "popup.js",
  "auth-manager.js",
  "auth-ui.js",
  "options.js",
  "supabase-client.js",
  "content-scripts/context.js",
  "core/api-service.js",
  "config/environment.js",
];

// Files to copy as-is
const staticFiles = [
  "manifest.json",
  "popup.html",
  "auth-callback.html",
  "auth-ui.html",
  "avatar.png",
  "styles.css",
];

async function processJavaScript(filePath) {
  try {
    const code = await fs.readFile(path.join(srcDir, filePath), "utf8");

    if (isProduction) {
      console.log(`⚡ Minifying ${filePath}...`);
      // Chrome Web Store approved minification
      const result = await minify(code, {
        compress: {
          drop_console: false, // Keep console for extension debugging
          drop_debugger: true,
          pure_funcs: ["console.debug"],
        },
        mangle: {
          reserved: ["chrome", "browser"], // Don't mangle Chrome extension APIs
        },
        format: {
          comments: false,
        },
      });
      return result.code || code;
    }

    return code; // Return unprocessed for development
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return await fs.readFile(path.join(srcDir, filePath), "utf8"); // Fallback to original
  }
}

async function build() {
  console.log("🏗️  Building HumanReplies Extension...");

  // Clean dist directory
  await fs.remove(distDir);
  await fs.ensureDir(distDir);

  // Process JavaScript files
  for (const file of jsFiles) {
    const processed = await processJavaScript(file);
    const outputPath = path.join(distDir, file);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, processed);
    console.log(`✅ Processed: ${file}`);
  }

  // Copy static files
  for (const file of staticFiles) {
    await fs.copy(path.join(srcDir, file), path.join(distDir, file));
    console.log(`📋 Copied: ${file}`);
  }

  // Update manifest version for production builds
  if (isProduction) {
    const manifestPath = path.join(distDir, "manifest.json");
    const manifest = await fs.readJson(manifestPath);
    // Generate valid Chrome extension version (max 4 dot-separated numbers, each ≤65536)
    const now = new Date();
    const buildNumber = Math.floor(now.getTime() / 60000) % 65536; // Minutes since epoch, mod 65536
    manifest.version = `1.0.0.${buildNumber}`;
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    console.log(`📦 Updated version to: ${manifest.version}`);
  }

  // Create ZIP for Chrome Web Store
  if (isProduction) {
    const { execSync } = require("child_process");
    try {
      execSync(`cd dist && zip -r ../humanreplies-extension.zip .`, {
        stdio: "inherit",
      });
      console.log("📦 Created production ZIP file");
    } catch (error) {
      console.log("⚠️  Could not create ZIP (install zip command)");
    }
  }

  console.log(`🎉 Build complete! Output in: ${distDir}`);
}

build().catch(console.error);
