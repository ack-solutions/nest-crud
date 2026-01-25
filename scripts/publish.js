#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

// Package paths
const NEST_CRUD_PATH = path.join(__dirname, "../packages/nest-crud/package.json");
const NEST_CRUD_REQUEST_PATH = path.join(__dirname, "../packages/nest-crud-request/package.json");
const NEST_CRUD_DIR = path.dirname(NEST_CRUD_PATH);
const NEST_CRUD_REQUEST_DIR = path.dirname(NEST_CRUD_REQUEST_PATH);

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

// Get current version from nest-crud package.json (master version)
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(NEST_CRUD_PATH, "utf8"));
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

// Build packages
function buildPackages() {
  console.log("🔨 Building packages...\n");
  try {
    // Build nest-crud-request first (dependency)
    console.log("📦 Building @ackplus/nest-crud-request...");
    execSync("pnpm build", { cwd: NEST_CRUD_REQUEST_DIR, stdio: "inherit" });
    
    // Build nest-crud
    console.log("\n📦 Building @ackplus/nest-crud...");
    execSync("pnpm build", { cwd: NEST_CRUD_DIR, stdio: "inherit" });
    
    console.log("\n✅ All packages built successfully\n");
  } catch (error) {
    console.error("❌ Build failed");
    process.exit(1);
  }
}

// Update version in both package.json files
function updateVersions(versionType) {
  const newVersion = calculateVersion(getCurrentVersion(), versionType);

  console.log("📦 Updating package versions...\n");

  // Update nest-crud-request first (dependency)
  const nestCrudRequestJson = JSON.parse(fs.readFileSync(NEST_CRUD_REQUEST_PATH, "utf8"));
  const oldNestCrudRequestVersion = nestCrudRequestJson.version;
  nestCrudRequestJson.version = newVersion;
  fs.writeFileSync(NEST_CRUD_REQUEST_PATH, JSON.stringify(nestCrudRequestJson, null, 2) + "\n");
  console.log(`✅ Updated @ackplus/nest-crud-request from ${oldNestCrudRequestVersion} to ${newVersion}`);

  // Update nest-crud and replace workspace dependency
  const nestCrudJson = JSON.parse(fs.readFileSync(NEST_CRUD_PATH, "utf8"));
  const oldNestCrudVersion = nestCrudJson.version;
  nestCrudJson.version = newVersion;
  // Replace workspace dependency with actual version for publishing
  if (nestCrudJson.dependencies && nestCrudJson.dependencies["@ackplus/nest-crud-request"]) {
    nestCrudJson.dependencies["@ackplus/nest-crud-request"] = newVersion;
  }
  fs.writeFileSync(NEST_CRUD_PATH, JSON.stringify(nestCrudJson, null, 2) + "\n");
  console.log(`✅ Updated @ackplus/nest-crud from ${oldNestCrudVersion} to ${newVersion}`);
  console.log(`✅ Replaced workspace dependency with version ${newVersion}\n`);

  return { oldVersion: oldNestCrudVersion, newVersion };
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

// Get published version from npm
function getPublishedVersion(packageName) {
  try {
    const output = execSync(`npm view ${packageName} version`, { 
      encoding: "utf8",
      stdio: "pipe"
    });
    return output.trim();
  } catch (error) {
    // Package doesn't exist yet or not accessible
    return null;
  }
}

// Publish a single package
async function publishSinglePackage(packageName, packageDir, newVersion, tag = "latest") {
  try {
    console.log(`📦 Publishing ${packageName}@${newVersion} with tag "${tag}"...`);
    execSync(`npm publish --access public --tag ${tag}`, {
      cwd: packageDir,
      stdio: "inherit"
    });
    console.log(`✅ ${packageName}@${newVersion} published successfully with tag "${tag}"!\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to publish ${packageName}\n`);
    return false;
  }
}

// Compare version strings (e.g., "1.2.0" vs "1.1.23")
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  return 0;
}

// Publish both packages
async function publishPackages(newVersion) {
  console.log("🚀 Publishing packages to npm...\n");

  // Check published versions
  const publishedNestCrudRequest = getPublishedVersion("@ackplus/nest-crud-request");
  const publishedNestCrud = getPublishedVersion("@ackplus/nest-crud");
  
  let tag = "latest";
  
  // If new version is lower than published, use beta tag
  if (publishedNestCrud && compareVersions(newVersion, publishedNestCrud) < 0) {
    console.log(`⚠️  Warning: Published version ${publishedNestCrud} is higher than ${newVersion}`);
    console.log(`   Publishing with "beta" tag instead of "latest"\n`);
    tag = "beta";
  }

  // Publish nest-crud-request first (dependency)
  const nestCrudRequestSuccess = await publishSinglePackage("@ackplus/nest-crud-request", NEST_CRUD_REQUEST_DIR, newVersion, tag);
  if (!nestCrudRequestSuccess) {
    return false;
  }

  // Publish nest-crud (depends on nest-crud-request)
  const nestCrudSuccess = await publishSinglePackage("@ackplus/nest-crud", NEST_CRUD_DIR, newVersion, tag);
  if (!nestCrudSuccess) {
    return false;
  }

  return { success: true, tag };
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting publish process for both packages...\n");

    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}\n`);

    // Select version type
    const versionType = await selectVersionType(currentVersion);
    const newVersion = calculateVersion(currentVersion, versionType);

    // Show summary and confirm
    console.log(`📋 Summary:`);
    console.log(`   Current version:  ${currentVersion}`);
    console.log(`   New version:      ${newVersion}`);
    console.log(`   Type:             ${versionType}`);
    console.log(`   Packages:         @ackplus/nest-crud`);
    console.log(`                     @ackplus/nest-crud-request\n`);
    console.log(`⚠️  Both packages will be published with the same version to avoid conflicts.\n`);

    const confirm = await question("❓ Proceed with publish? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log("❌ Cancelled\n");
      closeReadline();
      return;
    }

    // Build packages
    buildPackages();

    // Update versions
    const versionInfo = updateVersions(versionType);

    // Ensure npm auth
    const isAuthenticated = await ensureNpmAuth();
    if (!isAuthenticated) {
      console.log("⚠️  Skipping publish (not authenticated)\n");
      closeReadline();
      return;
    }

    // Publish packages
    const publishResult = await publishPackages(versionInfo.newVersion);

    if (publishResult && publishResult.success) {
      console.log("🎉 All packages published successfully!\n");
      const tagSuffix = publishResult.tag !== "latest" ? ` (tag: ${publishResult.tag})` : "";
      console.log(`📦 Package Links:`);
      console.log(`   https://www.npmjs.com/package/@ackplus/nest-crud/v/${versionInfo.newVersion}`);
      console.log(`   https://www.npmjs.com/package/@ackplus/nest-crud-request/v/${versionInfo.newVersion}`);
      console.log(`\n📥 Install with:`);
      if (publishResult.tag === "latest") {
        console.log(`   npm install @ackplus/nest-crud@${versionInfo.newVersion} @ackplus/nest-crud-request@${versionInfo.newVersion}`);
        console.log(`   pnpm add @ackplus/nest-crud@${versionInfo.newVersion} @ackplus/nest-crud-request@${versionInfo.newVersion}\n`);
      } else {
        console.log(`   npm install @ackplus/nest-crud@${versionInfo.newVersion} @ackplus/nest-crud-request@${versionInfo.newVersion} --tag ${publishResult.tag}`);
        console.log(`   pnpm add @ackplus/nest-crud@${versionInfo.newVersion} @ackplus/nest-crud-request@${versionInfo.newVersion} --tag ${publishResult.tag}\n`);
      }
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    closeReadline();
  }
}

main();
