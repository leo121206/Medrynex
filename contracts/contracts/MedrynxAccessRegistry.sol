// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MedrynxAuditLogger.sol";

/**
 * @title MedrynxAccessRegistry
 * @notice Enforces scope-bound dynamic consent for EHR access control.
 * @dev Permissions are bound to RecordCategory, Clinical Purpose, and Temporal Duration.
 */
contract MedrynxAccessRegistry {
    enum RecordCategory {
        Laboratory,    // 0
        Medication,    // 1
        Imaging,       // 2
        Clinical,      // 3
        Vaccination,   // 4
        Genomic,       // 5
        Cardiology     // 6
    }

    enum ConsentState {
        Active,
        Revoked,
        Expired
    }

    struct AccessGrant {
        bytes32 grantId;
        address patient;
        address doctor;
        RecordCategory category;
        uint64 validFrom;
        uint64 validTo;
        ConsentState state;
        string purpose;
    }

    MedrynxAuditLogger public immutable auditLogger;
    address public owner;

    // grantId => AccessGrant
    mapping(bytes32 => AccessGrant) public grants;

    // patient => doctor => category => latest grantId
    mapping(address => mapping(address => mapping(uint8 => bytes32))) public activeGrantLookup;

    // patient => grantId list
    mapping(address => bytes32[]) private patientGrants;

    // recordHash => isTombstoned (GDPR Right to Erasure / Crypto-shredded)
    mapping(bytes32 => bool) public tombstonedRecords;

    // Custom errors for gas efficiency
    error OnlyPatientCanGrant();
    error OnlyGrantPatientCanRevoke();
    error InvalidDoctorAddress();
    error InvalidDuration();
    error InvalidCategory();
    error GrantNotFound();
    error GrantAlreadyRevoked();
    error ScopeExceeded(uint8 requested, uint8 granted);
    error AccessExpired(uint256 currentTime, uint256 validTo);
    error RecordIsTombstoned();

    event ScopeBoundConsentGranted(
        bytes32 indexed grantId,
        address indexed patient,
        address indexed doctor,
        uint8 category,
        uint256 validTo
    );
    event ConsentRevoked(bytes32 indexed grantId, address indexed patient, uint256 timestamp);
    event RecordTombstoned(bytes32 indexed recordHash, address indexed patient, uint256 timestamp);

    constructor(address _auditLoggerAddress) {
        require(_auditLoggerAddress != address(0), "Invalid audit logger address");
        auditLogger = MedrynxAuditLogger(_auditLoggerAddress);
        owner = msg.sender;
    }

    /**
     * @notice Grants scope-bound dynamic consent to a clinician.
     * @param doctor Address of the verified doctor.
     * @param category Record category allowed under this grant.
     * @param purpose Declared clinical rationale.
     * @param durationSeconds Active temporal window in seconds.
     */
    function grantScopeBoundConsent(
        address doctor,
        uint8 category,
        string calldata purpose,
        uint256 durationSeconds
    ) external returns (bytes32 grantId) {
        if (doctor == address(0) || doctor == msg.sender) revert InvalidDoctorAddress();
        if (durationSeconds == 0 || durationSeconds > 365 days) revert InvalidDuration();
        if (category > uint8(RecordCategory.Cardiology)) revert InvalidCategory();

        uint64 validFrom = uint64(block.timestamp);
        uint64 validTo = uint64(block.timestamp + durationSeconds);

        grantId = keccak256(
            abi.encodePacked(
                msg.sender,
                doctor,
                category,
                validFrom,
                validTo,
                patientGrants[msg.sender].length
            )
        );

        grants[grantId] = AccessGrant({
            grantId: grantId,
            patient: msg.sender,
            doctor: doctor,
            category: RecordCategory(category),
            validFrom: validFrom,
            validTo: validTo,
            state: ConsentState.Active,
            purpose: purpose
        });

        activeGrantLookup[msg.sender][doctor][category] = grantId;
        patientGrants[msg.sender].push(grantId);

        emit ScopeBoundConsentGranted(grantId, msg.sender, doctor, category, validTo);

        // Emit on-chain audit trail via centralized logger
        auditLogger.logConsentGranted(grantId, msg.sender, doctor, category, validTo, purpose);
    }

    /**
     * @notice Batches multiple low-risk consent grants for a multidisciplinary care team.
     */
    function batchGrantConsents(
        address[] calldata doctors,
        uint8[] calldata categories,
        string[] calldata purposes,
        uint256 durationSeconds
    ) external returns (bytes32[] memory grantIds) {
        require(
            doctors.length == categories.length && categories.length == purposes.length,
            "Array length mismatch"
        );
        require(doctors.length > 0, "Empty batch");

        grantIds = new bytes32[](doctors.length);

        for (uint256 i = 0; i < doctors.length; i++) {
            if (doctors[i] == address(0) || doctors[i] == msg.sender) revert InvalidDoctorAddress();
            if (categories[i] > uint8(RecordCategory.Cardiology)) revert InvalidCategory();

            uint64 validFrom = uint64(block.timestamp);
            uint64 validTo = uint64(block.timestamp + durationSeconds);

            bytes32 gid = keccak256(
                abi.encodePacked(
                    msg.sender,
                    doctors[i],
                    categories[i],
                    validFrom,
                    validTo,
                    patientGrants[msg.sender].length
                )
            );

            grants[gid] = AccessGrant({
                grantId: gid,
                patient: msg.sender,
                doctor: doctors[i],
                category: RecordCategory(categories[i]),
                validFrom: validFrom,
                validTo: validTo,
                state: ConsentState.Active,
                purpose: purposes[i]
            });

            activeGrantLookup[msg.sender][doctors[i]][categories[i]] = gid;
            patientGrants[msg.sender].push(gid);
            grantIds[i] = gid;

            emit ScopeBoundConsentGranted(gid, msg.sender, doctors[i], categories[i], validTo);
            auditLogger.logConsentGranted(gid, msg.sender, doctors[i], categories[i], validTo, purposes[i]);
        }
    }

    /**
     * @notice Revokes an active consent grant immediately.
     * @param grantId The unique identifier of the grant.
     */
    function revokeConsent(bytes32 grantId) external {
        AccessGrant storage grant = grants[grantId];
        if (grant.patient == address(0)) revert GrantNotFound();
        if (grant.patient != msg.sender) revert OnlyGrantPatientCanRevoke();
        if (grant.state == ConsentState.Revoked) revert GrantAlreadyRevoked();

        grant.state = ConsentState.Revoked;

        // Note: activeGrantLookup retains reference so checkAccessPermission can report CONSENT_REVOKED

        emit ConsentRevoked(grantId, msg.sender, block.timestamp);
        auditLogger.logConsentRevoked(grantId, msg.sender);
    }

    /**
     * @notice Performs a sub-millisecond, zero-gas view check of access authorization.
     */
    function checkAccessPermission(
        address patient,
        address doctor,
        uint8 category
    ) external view returns (bool isPermitted, string memory reason) {
        bytes32 grantId = activeGrantLookup[patient][doctor][category];
        if (grantId == bytes32(0)) {
            return (false, "NO_ACTIVE_GRANT_FOR_CATEGORY");
        }

        AccessGrant memory grant = grants[grantId];

        if (grant.state == ConsentState.Revoked) {
            return (false, "CONSENT_REVOKED");
        }

        if (block.timestamp > grant.validTo) {
            return (false, "CONSENT_EXPIRED");
        }

        if (uint8(grant.category) != category) {
            return (false, "SCOPE_CATEGORY_MISMATCH");
        }

        return (true, "ACCESS_GRANTED_IN_SCOPE");
    }

    /**
     * @notice Immutably tombstones a deleted health record to reconcile GDPR erasure with ledger auditability.
     */
    function tombstoneRecord(bytes32 recordHash) external {
        tombstonedRecords[recordHash] = true;
        emit RecordTombstoned(recordHash, msg.sender, block.timestamp);
        auditLogger.logRecordTombstoned(recordHash, msg.sender);
    }

    function getPatientGrants(address patient) external view returns (bytes32[] memory) {
        return patientGrants[patient];
    }
}
