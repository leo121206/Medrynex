const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Medrynx Smart Contracts Deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy Audit Logger
  console.log("1️⃣ Deploying MedrynxAuditLogger...");
  const AuditLogger = await ethers.getContractFactory("MedrynxAuditLogger");
  const auditLogger = await AuditLogger.deploy();
  await auditLogger.waitForDeployment();
  const auditLoggerAddress = await auditLogger.getAddress();
  console.log(`   ✅ MedrynxAuditLogger deployed at: ${auditLoggerAddress}`);

  // 2. Deploy Access Registry
  console.log("2️⃣ Deploying MedrynxAccessRegistry...");
  const AccessRegistry = await ethers.getContractFactory("MedrynxAccessRegistry");
  const accessRegistry = await AccessRegistry.deploy(auditLoggerAddress);
  await accessRegistry.waitForDeployment();
  const accessRegistryAddress = await accessRegistry.getAddress();
  console.log(`   ✅ MedrynxAccessRegistry deployed at: ${accessRegistryAddress}`);

  // 3. Deploy Emergency Vault
  console.log("3️⃣ Deploying MedrynxEmergencyVault...");
  const EmergencyVault = await ethers.getContractFactory("MedrynxEmergencyVault");
  const emergencyVault = await EmergencyVault.deploy(auditLoggerAddress);
  await emergencyVault.waitForDeployment();
  const emergencyVaultAddress = await emergencyVault.getAddress();
  console.log(`   ✅ MedrynxEmergencyVault deployed at: ${emergencyVaultAddress}`);

  // 4. Authorize contracts with Audit Logger
  console.log("4️⃣ Authorizing contracts in AuditLogger...");
  let tx = await auditLogger.authorizeCaller(accessRegistryAddress);
  await tx.wait();
  tx = await auditLogger.authorizeCaller(emergencyVaultAddress);
  await tx.wait();
  console.log("   ✅ Authorization granted.");

  // Deployment data object
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      MedrynxAuditLogger: auditLoggerAddress,
      MedrynxAccessRegistry: accessRegistryAddress,
      MedrynxEmergencyVault: emergencyVaultAddress,
    },
  };

  // Ensure directories exist
  const contractsDeployDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(contractsDeployDir)) {
    fs.mkdirSync(contractsDeployDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(contractsDeployDir, "deployed_addresses.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`\n💾 Saved deployment record to: contracts/deployments/deployed_addresses.json`);

  // Export to backend/src/contracts for Phase 3
  const backendContractsDir = path.resolve(__dirname, "../../backend/src/contracts");
  const backendAbisDir = path.join(backendContractsDir, "abis");
  if (!fs.existsSync(backendAbisDir)) {
    fs.mkdirSync(backendAbisDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(backendContractsDir, "addresses.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  // Copy ABIs
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const contractNames = [
    "MedrynxAuditLogger.sol/MedrynxAuditLogger.json",
    "MedrynxAccessRegistry.sol/MedrynxAccessRegistry.json",
    "MedrynxEmergencyVault.sol/MedrynxEmergencyVault.json",
  ];

  for (const item of contractNames) {
    const artifactPath = path.join(artifactsDir, item);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const baseName = path.basename(item);
      fs.writeFileSync(
        path.join(backendAbisDir, baseName),
        JSON.stringify(artifact.abi, null, 2)
      );
      console.log(`   Exported ABI: ${baseName} -> backend/src/contracts/abis/`);
    }
  }

  console.log("\n🎉 Deployment completed successfully!");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
