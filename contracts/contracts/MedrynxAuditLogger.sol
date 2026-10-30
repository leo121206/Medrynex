// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MedrynxAuditLogger
 * @notice Immutable append-only audit logger for Medrynx EHR platform.
 * @dev Records indexed on-chain events for consents, emergency overrides, disputes, and tombstoning.
 */
contract MedrynxAuditLogger {
    address public owner;
    mapping(address => bool) public authorizedCallers;

    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // Core Medrynx Audit Events
    event ConsentGranted(
        bytes32 indexed grantId,
        address indexed patient,
        address indexed doctor,
        uint8 category,
        uint256 validTo,
        string purpose
    );

    event ConsentRevoked(
        bytes32 indexed grantId,
        address indexed patient,
        uint256 timestamp
    );

    event EmergencyDeclared(
        bytes32 indexed sessionId,
        address indexed patient,
        address indexed doctor,
        uint8 tier,
        uint256 expiresAt,
        string reason
    );

    event EmergencyReconciled(
        bytes32 indexed sessionId,
        address indexed patient,
        uint256 timestamp
    );

    event EmergencyDisputed(
        bytes32 indexed sessionId,
        address indexed patient,
        bytes32 indexed disputeReasonHash,
        string details,
        uint256 timestamp
    );

    event RecordTombstoned(
        bytes32 indexed recordHash,
        address indexed patient,
        uint256 timestamp
    );

    error OnlyOwner();
    error NotAuthorizedCaller();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner) {
            revert NotAuthorizedCaller();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedCallers[msg.sender] = true;
    }

    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "Invalid caller address");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }

    function logConsentGranted(
        bytes32 grantId,
        address patient,
        address doctor,
        uint8 category,
        uint256 validTo,
        string calldata purpose
    ) external onlyAuthorized {
        emit ConsentGranted(grantId, patient, doctor, category, validTo, purpose);
    }

    function logConsentRevoked(
        bytes32 grantId,
        address patient
    ) external onlyAuthorized {
        emit ConsentRevoked(grantId, patient, block.timestamp);
    }

    function logEmergencyDeclared(
        bytes32 sessionId,
        address patient,
        address doctor,
        uint8 tier,
        uint256 expiresAt,
        string calldata reason
    ) external onlyAuthorized {
        emit EmergencyDeclared(sessionId, patient, doctor, tier, expiresAt, reason);
    }

    function logEmergencyReconciled(
        bytes32 sessionId,
        address patient
    ) external onlyAuthorized {
        emit EmergencyReconciled(sessionId, patient, block.timestamp);
    }

    function logEmergencyDisputed(
        bytes32 sessionId,
        address patient,
        bytes32 disputeReasonHash,
        string calldata details
    ) external onlyAuthorized {
        emit EmergencyDisputed(sessionId, patient, disputeReasonHash, details, block.timestamp);
    }

    function logRecordTombstoned(
        bytes32 recordHash,
        address patient
    ) external onlyAuthorized {
        emit RecordTombstoned(recordHash, patient, block.timestamp);
    }
}
