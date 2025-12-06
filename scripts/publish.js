#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

const PACKAGE_PATH = path.join(__dirname, "../packages/nest-crud/package.json");
const PACKAGE_DIR = path.dirname(PACKAGE_PATH);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function closeReadline() {
  rl.close();
}

// Get current version from package.json
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  return packageJson.version;
}

// Calculate new version
function calculateVersion(currentVersion, versionType) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (versionType) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      return versionType; // Custom version
  }
}

// Select version type interactively
async function selectVersionType(currentVersion) {
  const [major, minor, patch] = currentVersion.split(".").map(Number);
  const patchVersion = `${major}.${minor}.${patch + 1}`;
  const minorVersion = `${major}.${minor + 1}.0`;
  const majorVersion = `${major + 1}.0.0`;

  console.log(`\n📝 Select version bump type:\n`);
  console.log(`   1) Patch  ${currentVersion} → ${patchVersion}  (Bug fixes, small changes)`);
  console.log(`   2) Minor  ${currentVersion} → ${minorVersion}  (New features, backward compatible)`);
  console.log(`   3) Major  ${currentVersion} → ${majorVersion}  (Breaking changes)\n`);

  const selection = await question("❓ Enter your choice (1-3): ");

  let versionType;
  switch (selection.trim()) {
    case "1":
      versionType = "patch";
      break;
    case "2":
      versionType = "minor";
      break;
    case "3":
      versionType = "major";
      break;
    default:
      console.error("❌ Invalid selection. Please choose 1, 2, or 3.");
      process.exit(1);
  }

  console.log(`\n✅ Selected: ${versionType.toUpperCase()}\n`);
  return versionType;
}

// Build package
function buildPackage() {
  console.log("🔨 Building package...\n");
  try {
    execSync("pnpm build", { cwd: PACKAGE_DIR, stdio: "inherit" });
    console.log("\n✅ Build completed successfully\n");
  } catch (error) {
    console.error("❌ Build failed");
    process.exit(1);
  }
}

// Update version in package.json
function updateVersion(versionType) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  const oldVersion = packageJson.version;
  const newVersion = calculateVersion(oldVersion, versionType);

  console.log("📦 Updating package version...\n");
  packageJson.version = newVersion;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(packageJson, null, 2) + "\n");

  console.log(`✅ Updated @ackplus/nest-crud from ${oldVersion} to ${newVersion}\n`);
  return { oldVersion, newVersion };
}

// Ensure NPM authentication
async function ensureNpmAuth() {
  try {
    execSync("npm whoami", { stdio: "ignore" });
    return true;
  } catch (error) {
    console.error("❌ Not authenticated with npm");
    console.error("   Run: npm login\n");
    return false;
  }
}

// Publish package
async function publishPackage() {
  try {
    console.log("📦 Publishing to npm...\n");
    execSync("npm publish --access public", { 
      cwd: PACKAGE_DIR,
      stdio: "inherit" 
    });
    console.log("\n✅ Published successfully!\n");
    return true;
  } catch (error) {
    console.error("❌ Publish failed\n");
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting publish process...\n");

    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}\n`);

    // Select version type
    const versionType = await selectVersionType(currentVersion);
    const newVersion = calculateVersion(currentVersion, versionType);

    // Show summary and confirm
    console.log(`📋 Summary:`);
    console.log(`   Current: ${currentVersion}`);
    console.log(`   New:     ${newVersion}`);
    console.log(`   Type:    ${versionType}\n`);

    const confirm = await question("❓ Proceed with publish? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log("❌ Cancelled\n");
      closeReadline();
      return;
    }

    // Build
    buildPackage();

    // Update version
    const versionInfo = updateVersion(versionType);

    // Ensure npm auth
    const isAuthenticated = await ensureNpmAuth();
    if (!isAuthenticated) {
      console.log("⚠️  Skipping publish (not authenticated)\n");
      closeReadline();
      return;
    }

    // Publish
    const success = await publishPackage();

    if (success) {
      console.log("🎉 Package published successfully!\n");
      console.log(`📦 https://www.npmjs.com/package/@ackplus/nest-crud/v/${versionInfo.newVersion}`);
      console.log(`\n📥 Install with:`);
      console.log(`   npm install @ackplus/nest-crud@${versionInfo.newVersion}`);
      console.log(`   pnpm add @ackplus/nest-crud@${versionInfo.newVersion}\n`);
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    closeReadline();
  }
}

main();
