const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Medrynx Smart Contract Ecosystem", function () {
  let auditLogger, accessRegistry, emergencyVault;
  let owner, patient, doctor1, doctor2, unauthorizedDoctor;

  // Categories enum matching contracts:
  // 0: Laboratory, 1: Medication, 2: Imaging, 3: Clinical, 4: Vaccination, 5: Genomic, 6: Cardiology
  const Category = {
    Laboratory: 0,
    Medication: 1,
    Imaging: 2,
    Clinical: 3,
    Vaccination: 4,
    Genomic: 5,
    Cardiology: 6,
  };

  beforeEach(async function () {
    [owner, patient, doctor1, doctor2, unauthorizedDoctor] = await ethers.getSigners();

    // 1. Deploy Audit Logger
    const AuditLogger = await ethers.getContractFactory("MedrynxAuditLogger");
    auditLogger = await AuditLogger.deploy();
    await auditLogger.waitForDeployment();

    // 2. Deploy Access Registry
    const AccessRegistry = await ethers.getContractFactory("MedrynxAccessRegistry");
    accessRegistry = await AccessRegistry.deploy(await auditLogger.getAddress());
    await accessRegistry.waitForDeployment();

    // 3. Deploy Emergency Vault
    const EmergencyVault = await ethers.getContractFactory("MedrynxEmergencyVault");
    emergencyVault = await EmergencyVault.deploy(await auditLogger.getAddress());
    await emergencyVault.waitForDeployment();

    // Authorize contracts to call AuditLogger
    await auditLogger.authorizeCaller(await accessRegistry.getAddress());
    await auditLogger.authorizeCaller(await emergencyVault.getAddress());
  });

  describe("Module 3 & RQ-1: Scope-Bound Dynamic Consent", function () {
    it("Should successfully grant scope-bound consent and enforce category boundaries", async function () {
      const duration = 7 * 24 * 3600; // 7 days
      const purpose = "Cardiology evaluation and follow-up";

      // Patient grants consent for Cardiology (6) only
      const tx = await accessRegistry
        .connect(patient)
        .grantScopeBoundConsent(doctor1.address, Category.Cardiology, purpose, duration);

      const receipt = await tx.wait();

      // Gas benchmarking check (RQ-1: must be <= 300,000 gas including cross-contract audit logging)
      expect(receipt.gasUsed).to.be.lessThan(300000n);

      // Check permission for granted category: Cardiology (6) -> Permitted
      const [isPermitted, reason] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Cardiology
      );
      expect(isPermitted).to.be.true;
      expect(reason).to.equal("ACCESS_GRANTED_IN_SCOPE");

      // Check permission for ungranted category: Imaging (2) -> Rejected (out of scope)
      const [isPermittedImaging, reasonImaging] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Imaging
      );
      expect(isPermittedImaging).to.be.false;
      expect(reasonImaging).to.equal("NO_ACTIVE_GRANT_FOR_CATEGORY");
    });

    it("Should reject access after the consent temporal window has expired", async function () {
      const duration = 3600; // 1 hour

      await accessRegistry
        .connect(patient)
        .grantScopeBoundConsent(doctor1.address, Category.Laboratory, "Routine blood count", duration);

      // Verify access is active initially
      let [isPermitted] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Laboratory
      );
      expect(isPermitted).to.be.true;

      // Advance blockchain time past duration (1 hour + 5 minutes)
      await time.increase(3600 + 300);

      // Check access permission now
      const [isPermittedAfterExpiry, reason] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Laboratory
      );
      expect(isPermittedAfterExpiry).to.be.false;
      expect(reason).to.equal("CONSENT_EXPIRED");
    });

    it("Should instantly revoke consent when patient initiates revocation", async function () {
      const duration = 24 * 3600;

      const tx = await accessRegistry
        .connect(patient)
        .grantScopeBoundConsent(doctor1.address, Category.Clinical, "Pre-op check", duration);
      const receipt = await tx.wait();

      // Fetch grant ID from patient's grants
      const grants = await accessRegistry.getPatientGrants(patient.address);
      const grantId = grants[0];

      // Patient revokes consent
      await accessRegistry.connect(patient).revokeConsent(grantId);

      // Access should now be denied
      const [isPermitted, reason] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Clinical
      );
      expect(isPermitted).to.be.false;
      expect(reason).to.equal("CONSENT_REVOKED");
    });

    it("Should support consent batching for multidisciplinary care teams (Module 5 & RQ-5)", async function () {
      const doctors = [doctor1.address, doctor2.address];
      const categories = [Category.Laboratory, Category.Imaging];
      const purposes = ["Metabolic Panel", "Chest X-Ray"];
      const duration = 14 * 24 * 3600;

      const tx = await accessRegistry
        .connect(patient)
        .batchGrantConsents(doctors, categories, purposes, duration);
      await tx.wait();

      // Verify Doctor 1 has Lab access
      const [doc1Permitted] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor1.address,
        Category.Laboratory
      );
      expect(doc1Permitted).to.be.true;

      // Verify Doctor 2 has Imaging access
      const [doc2Permitted] = await accessRegistry.checkAccessPermission(
        patient.address,
        doctor2.address,
        Category.Imaging
      );
      expect(doc2Permitted).to.be.true;
    });

    it("Should support GDPR-compliant record tombstoning", async function () {
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes("Encrypted_Record_CID_Qm123"));
      await accessRegistry.connect(patient).tombstoneRecord(recordHash);

      const isTombstoned = await accessRegistry.tombstonedRecords(recordHash);
      expect(isTombstoned).to.be.true;
    });
  });

  describe("Module 6 & 7: Tiered Break-Glass Emergency & Disputes (RQ-3 & RQ-4)", function () {
    it("Should enforce Tier 1 Partial Emergency access (Allergies & Medications only) with 15m time-lock", async function () {
      // Doctor 1 declares Tier 1 emergency
      const tx = await emergencyVault
        .connect(doctor1)
        .triggerEmergencyAccess(
          patient.address,
          1, // Tier 1 (Partial)
          "",
          "Severe anaphylactic shock at trauma bay"
        );
      await tx.wait();

      // Check access for Medication (1) -> Permitted
      const [medPermitted, tierMed] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Medication
      );
      expect(medPermitted).to.be.true;
      expect(tierMed).to.equal(1);

      // Check access for Laboratory/Blood (0) -> Permitted
      const [labPermitted] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Laboratory
      );
      expect(labPermitted).to.be.true;

      // Check access for Imaging (2) -> REJECTED (Tier 1 is vital records only!)
      const [imgPermitted] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Imaging
      );
      expect(imgPermitted).to.be.false;

      // Advance time past 15 minutes (15 mins + 30 seconds)
      await time.increase(15 * 60 + 30);

      // Access should now be auto-revoked
      const [expiredPermitted] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Medication
      );
      expect(expiredPermitted).to.be.false;
    });

    it("Should enforce Tier 2 Full Emergency access with code and 30m time-lock", async function () {
      // Tier 2 requires valid emergency code
      await expect(
        emergencyVault
          .connect(doctor1)
          .triggerEmergencyAccess(patient.address, 2, "", "Trauma code")
      ).to.be.revertedWithCustomError(emergencyVault, "EmergencyCodeRequiredForTier2");

      // Successful Tier 2 trigger
      await emergencyVault
        .connect(doctor1)
        .triggerEmergencyAccess(
          patient.address,
          2, // Tier 2 (Full)
          "EMG-CODE-RED-774",
          "Polytrauma ICU admission"
        );

      // Tier 2 permits Imaging (2), Cardiology (6), etc.
      const [imgPermitted, tier] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Imaging
      );
      expect(imgPermitted).to.be.true;
      expect(tier).to.equal(2);

      // Advance time past 30 minutes
      await time.increase(30 * 60 + 10);

      const [expiredPermitted] = await emergencyVault.checkEmergencyAccess(
        patient.address,
        doctor1.address,
        Category.Imaging
      );
      expect(expiredPermitted).to.be.false;
    });

    it("Should allow patient to formally reconcile or dispute emergency access on-chain", async function () {
      await emergencyVault
        .connect(doctor1)
        .triggerEmergencyAccess(patient.address, 1, "", "Hypoglycemic collapse");

      const sessions = await emergencyVault.getPatientEmergencySessions(patient.address);
      const sessionId = sessions[0];

      // Patient contests emergency access
      const disputeReasonHash = ethers.keccak256(ethers.toUtf8Bytes("Incorrect_emergency_claim"));
      const details = "I was fully conscious and visiting the outpatient clinic; no emergency existed.";

      await emergencyVault
        .connect(patient)
        .disputeEmergency(sessionId, disputeReasonHash, details);

      const session = await emergencyVault.emergencySessions(sessionId);
      expect(session.status).to.equal(2); // 2: Disputed
      expect(session.disputeReasonHash).to.equal(disputeReasonHash);
    });
  });
});
