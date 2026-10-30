// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MedrynxAuditLogger.sol";

/**
 * @title MedrynxEmergencyVault
 * @notice Enforces Tiered Break-Glass Emergency Access Control with Time-Lock Auto-Revocation.
 * @dev Tier 1 (Partial, 15m) vs Tier 2 (Full, 30m). Enforces mandatory post-hoc reconciliation and dispute trails.
 */
contract MedrynxEmergencyVault {
    enum EmergencyTier {
        None,         // 0
        PartialTier1, // 1: 15-min access to critical vitals (Blood group, Allergies, Medications)
        FullTier2     // 2: 30-min access to full record set
    }

    enum SessionStatus {
        Active,      // 0
        Reconciled,  // 1: Acknowledged by patient
        Disputed     // 2: Contested by patient on-chain
    }

    struct EmergencySession {
        bytes32 sessionId;
        address patient;
        address doctor;
        EmergencyTier tier;
        uint64 startedAt;
        uint64 expiresAt;
        SessionStatus status;
        bytes32 disputeReasonHash;
        string emergencyCode;
        string reason;
    }

    uint256 public constant TIER1_DURATION = 15 minutes;
    uint256 public constant TIER2_DURATION = 30 minutes;

    MedrynxAuditLogger public immutable auditLogger;
    address public owner;

    // sessionId => EmergencySession
    mapping(bytes32 => EmergencySession) public emergencySessions;

    // patient => doctor => latest active sessionId
    mapping(address => mapping(address => bytes32)) public activeEmergencyLookup;

    // patient => sessionId array
    mapping(address => bytes32[]) private patientEmergencySessions;

    // Custom errors
    error InvalidPatient();
    error InvalidDoctor();
    error InvalidTier();
    error SessionNotFound();
    error SessionAlreadyReconciled();
    error SessionAlreadyDisputed();
    error OnlyPatientCanReconcileOrDispute();
    error EmergencyCodeRequiredForTier2();

    event EmergencyAccessTriggered(
        bytes32 indexed sessionId,
        address indexed patient,
        address indexed doctor,
        uint8 tier,
        uint256 expiresAt,
        string emergencyCode
    );

    event EmergencySessionReconciled(bytes32 indexed sessionId, address indexed patient, uint256 timestamp);
    event EmergencySessionDisputed(
        bytes32 indexed sessionId,
        address indexed patient,
        bytes32 indexed disputeReasonHash,
        string details,
        uint256 timestamp
    );

    constructor(address _auditLoggerAddress) {
        require(_auditLoggerAddress != address(0), "Invalid audit logger address");
        auditLogger = MedrynxAuditLogger(_auditLoggerAddress);
        owner = msg.sender;
    }

    /**
     * @notice Triggers break-glass emergency access for an incapacitated patient.
     * @param patient The patient whose data is needed.
     * @param tier EmergencyTier (1 for Partial, 2 for Full).
     * @param emergencyCode Mandatory accreditation code if Tier 2 (e.g. "EMG-TRAUMA-99").
     * @param reason Medical justification for overriding patient consent.
     */
    function triggerEmergencyAccess(
        address patient,
        uint8 tier,
        string calldata emergencyCode,
        string calldata reason
    ) external returns (bytes32 sessionId) {
        if (patient == address(0) || patient == msg.sender) revert InvalidPatient();
        if (tier == 0 || tier > 2) revert InvalidTier();
        if (tier == 2 && bytes(emergencyCode).length == 0) revert EmergencyCodeRequiredForTier2();

        uint64 duration = (tier == 1) ? uint64(TIER1_DURATION) : uint64(TIER2_DURATION);
        uint64 expiresAt = uint64(block.timestamp + duration);

        sessionId = keccak256(
            abi.encodePacked(
                patient,
                msg.sender,
                tier,
                block.timestamp,
                expiresAt,
                patientEmergencySessions[patient].length
            )
        );

        emergencySessions[sessionId] = EmergencySession({
            sessionId: sessionId,
            patient: patient,
            doctor: msg.sender,
            tier: EmergencyTier(tier),
            startedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            status: SessionStatus.Active,
            disputeReasonHash: bytes32(0),
            emergencyCode: emergencyCode,
            reason: reason
        });

        activeEmergencyLookup[patient][msg.sender] = sessionId;
        patientEmergencySessions[patient].push(sessionId);

        emit EmergencyAccessTriggered(sessionId, patient, msg.sender, tier, expiresAt, emergencyCode);
        auditLogger.logEmergencyDeclared(sessionId, patient, msg.sender, tier, expiresAt, reason);
    }

    /**
     * @notice Real-time zero-gas permission check for emergency data decryption.
     * @dev Enforces strict category scoping for Tier 1 (only Category 1: Medication, 0: Laboratory/Blood).
     */
    function checkEmergencyAccess(
        address patient,
        address doctor,
        uint8 category
    ) external view returns (bool isPermitted, uint8 tier, uint256 remainingSeconds) {
        bytes32 sessionId = activeEmergencyLookup[patient][doctor];
        if (sessionId == bytes32(0)) {
            return (false, 0, 0);
        }

        EmergencySession memory session = emergencySessions[sessionId];

        // Temporal auto-revocation time-lock check
        if (block.timestamp >= session.expiresAt) {
            return (false, uint8(session.tier), 0);
        }

        remainingSeconds = session.expiresAt - block.timestamp;

        // Tier 1 Partial Emergency: Only Medication (1) and Laboratory/Blood (0) permitted
        if (session.tier == EmergencyTier.PartialTier1) {
            if (category == 0 || category == 1) {
                return (true, 1, remainingSeconds);
            } else {
                return (false, 1, remainingSeconds); // Category out of bounds for partial emergency
            }
        }

        // Tier 2 Full Emergency: All standard categories permitted
        if (session.tier == EmergencyTier.FullTier2) {
            return (true, 2, remainingSeconds);
        }

        return (false, 0, 0);
    }

    /**
     * @notice Mandatory post-hoc reconciliation: Patient formally acknowledges emergency access.
     */
    function reconcileEmergency(bytes32 sessionId) external {
        EmergencySession storage session = emergencySessions[sessionId];
        if (session.patient == address(0)) revert SessionNotFound();
        if (session.patient != msg.sender) revert OnlyPatientCanReconcileOrDispute();
        if (session.status != SessionStatus.Active) revert SessionAlreadyReconciled();

        session.status = SessionStatus.Reconciled;

        emit EmergencySessionReconciled(sessionId, msg.sender, block.timestamp);
        auditLogger.logEmergencyReconciled(sessionId, msg.sender);
    }

    /**
     * @notice Formal on-chain dispute: Patient contests an illegitimate emergency override.
     */
    function disputeEmergency(
        bytes32 sessionId,
        bytes32 disputeReasonHash,
        string calldata details
    ) external {
        EmergencySession storage session = emergencySessions[sessionId];
        if (session.patient == address(0)) revert SessionNotFound();
        if (session.patient != msg.sender) revert OnlyPatientCanReconcileOrDispute();
        if (session.status == SessionStatus.Disputed) revert SessionAlreadyDisputed();

        session.status = SessionStatus.Disputed;
        session.disputeReasonHash = disputeReasonHash;

        emit EmergencySessionDisputed(sessionId, msg.sender, disputeReasonHash, details, block.timestamp);
        auditLogger.logEmergencyDisputed(sessionId, msg.sender, disputeReasonHash, details);
    }

    function getPatientEmergencySessions(address patient) external view returns (bytes32[] memory) {
        return patientEmergencySessions[patient];
    }
}
