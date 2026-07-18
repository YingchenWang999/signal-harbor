// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IEVMTransaction} from "./vendor/flare/IEVMTransaction.sol";
import {IEVMTransactionVerification} from "./vendor/flare/IEVMTransactionVerification.sol";
import {IXRPPayment} from "./vendor/flare/IXRPPayment.sol";
import {IXRPPaymentVerification} from "./vendor/flare/IXRPPaymentVerification.sol";
import {IFtsoReader} from "./interfaces/IFtsoReader.sol";

/// @title Signal Harbor
/// @notice Monitors bridged treasury positions with FTSOv2 prices and anchors
///         cross-chain provenance only after an FDC proof has been verified.
contract SignalHarbor {
    enum RiskLevel { Safe, Watch, Act }
    enum EvidenceKind { EvmTransaction, XrpPayment }

    bytes32 private constant EVM_TRANSACTION = bytes32("EVMTransaction");
    bytes32 private constant XRP_PAYMENT = bytes32("XRPPayment");

    struct Position {
        bytes21 feedId;
        bytes8 symbol;
        uint128 unitsWei;
        uint128 referencePriceWei;
        uint16 watchDeviationBps;
        uint16 actDeviationBps;
        uint32 maxPriceAge;
        bool enabled;
    }

    struct Assessment {
        uint256 priceWei;
        uint256 valueWei;
        uint256 downsideBps;
        uint64 priceTimestamp;
        RiskLevel level;
    }

    struct Evidence {
        EvidenceKind kind;
        bytes32 transactionId;
        bytes32 sourceId;
        uint64 sourceTimestamp;
        uint64 votingRound;
        uint256 amount;
    }

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidProof();
    error SourceNotAllowed();
    error RecipientNotAllowed();
    error EvidenceAlreadyRecorded();
    error ResponseAlreadyQueued();
    error UnknownPosition();

    event OwnershipTransferStarted(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SourcePermissionSet(bytes32 indexed sourceId, bool allowed);
    event EvmRecipientPermissionSet(address indexed recipient, bool allowed);
    event XrpRecipientPermissionSet(bytes32 indexed recipientHash, bool allowed);
    event PositionConfigured(
        bytes32 indexed positionId,
        bytes8 indexed symbol,
        bytes21 feedId,
        uint128 unitsWei
    );
    event CrossChainEvidenceRecorded(
        bytes32 indexed evidenceId,
        EvidenceKind indexed kind,
        bytes32 indexed transactionId,
        bytes32 sourceId,
        uint64 sourceTimestamp,
        uint64 votingRound,
        uint256 amount
    );
    event ResponseQueued(
        bytes32 indexed positionId,
        RiskLevel level,
        uint256 priceWei,
        uint256 downsideBps,
        bytes32 responseHash
    );

    address public owner;
    address public pendingOwner;
    IFtsoReader public immutable ftso;
    IEVMTransactionVerification public immutable evmVerification;
    IXRPPaymentVerification public immutable xrpVerification;

    mapping(bytes32 => Position) public positions;
    mapping(bytes32 => Evidence) public evidence;
    mapping(bytes32 => bool) public usedEvidenceKeys;
    mapping(bytes32 => bool) public usedResponseHashes;
    mapping(bytes32 => bool) public allowedSourceIds;
    mapping(address => bool) public allowedEvmRecipients;
    mapping(bytes32 => bool) public allowedXrpRecipientHashes;

    constructor(address ftsoAddress, address fdcVerificationAddress) {
        if (ftsoAddress == address(0) || fdcVerificationAddress == address(0)) {
            revert InvalidConfiguration();
        }
        owner = msg.sender;
        ftso = IFtsoReader(ftsoAddress);
        evmVerification = IEVMTransactionVerification(fdcVerificationAddress);
        xrpVerification = IXRPPaymentVerification(fdcVerificationAddress);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0) || nextOwner == owner) revert InvalidConfiguration();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function setAllowedSource(bytes32 sourceId, bool allowed) external onlyOwner {
        if (sourceId == bytes32(0)) revert InvalidConfiguration();
        allowedSourceIds[sourceId] = allowed;
        emit SourcePermissionSet(sourceId, allowed);
    }

    function setAllowedEvmRecipient(address recipient, bool allowed) external onlyOwner {
        if (recipient == address(0)) revert InvalidConfiguration();
        allowedEvmRecipients[recipient] = allowed;
        emit EvmRecipientPermissionSet(recipient, allowed);
    }

    function setAllowedXrpRecipientHash(bytes32 recipientHash, bool allowed) external onlyOwner {
        if (recipientHash == bytes32(0)) revert InvalidConfiguration();
        allowedXrpRecipientHashes[recipientHash] = allowed;
        emit XrpRecipientPermissionSet(recipientHash, allowed);
    }

    function configurePosition(bytes32 positionId, Position calldata position)
        external
        onlyOwner
    {
        if (
            positionId == bytes32(0) ||
            position.feedId == bytes21(0) ||
            position.symbol == bytes8(0) ||
            position.unitsWei == 0 ||
            position.referencePriceWei == 0 ||
            position.watchDeviationBps == 0 ||
            position.watchDeviationBps >= position.actDeviationBps ||
            position.actDeviationBps > 10_000 ||
            position.maxPriceAge < 30
        ) revert InvalidConfiguration();

        positions[positionId] = position;
        emit PositionConfigured(positionId, position.symbol, position.feedId, position.unitsWei);
    }

    /// @notice Records an allowed, successful EVM transfer after FDC verification.
    function recordEvmTransactionEvidence(IEVMTransaction.Proof calldata proof)
        external
        returns (bytes32 evidenceId)
    {
        if (
            proof.data.attestationType != EVM_TRANSACTION ||
            !evmVerification.verifyEVMTransaction(proof) ||
            proof.data.responseBody.status != 1
        ) revert InvalidProof();
        if (!allowedSourceIds[proof.data.sourceId]) revert SourceNotAllowed();
        if (!allowedEvmRecipients[proof.data.responseBody.receivingAddress]) {
            revert RecipientNotAllowed();
        }

        evidenceId = _recordEvidence(
            EvidenceKind.EvmTransaction,
            proof.data.requestBody.transactionHash,
            proof.data.sourceId,
            proof.data.responseBody.timestamp,
            proof.data.votingRound,
            proof.data.responseBody.value
        );
    }

    /// @notice Records a successful native XRP payment after FDC verification.
    /// @dev Proofs are bound to this contract and to an owner-approved XRPL receiver hash.
    function recordXrpPaymentEvidence(IXRPPayment.Proof calldata proof)
        external
        returns (bytes32 evidenceId)
    {
        if (
            proof.data.attestationType != XRP_PAYMENT ||
            proof.data.requestBody.proofOwner != address(this) ||
            !xrpVerification.verifyXRPPayment(proof) ||
            proof.data.responseBody.status != 0 ||
            proof.data.responseBody.receivedAmount <= 0
        ) revert InvalidProof();
        if (!allowedSourceIds[proof.data.sourceId]) revert SourceNotAllowed();
        if (!allowedXrpRecipientHashes[proof.data.responseBody.receivingAddressHash]) {
            revert RecipientNotAllowed();
        }

        evidenceId = _recordEvidence(
            EvidenceKind.XrpPayment,
            proof.data.requestBody.transactionId,
            proof.data.sourceId,
            proof.data.responseBody.blockTimestamp,
            proof.data.votingRound,
            uint256(proof.data.responseBody.receivedAmount)
        );
    }

    function _recordEvidence(
        EvidenceKind kind,
        bytes32 transactionId,
        bytes32 sourceId,
        uint64 sourceTimestamp,
        uint64 votingRound,
        uint256 amount
    ) private returns (bytes32 evidenceId) {
        if (
            transactionId == bytes32(0) ||
            sourceTimestamp == 0 ||
            sourceTimestamp > block.timestamp
        ) revert InvalidProof();
        bytes32 evidenceKey = keccak256(abi.encode(kind, sourceId, transactionId));
        if (usedEvidenceKeys[evidenceKey]) revert EvidenceAlreadyRecorded();

        evidenceId = keccak256(abi.encode(evidenceKey, votingRound));
        usedEvidenceKeys[evidenceKey] = true;
        evidence[evidenceId] = Evidence({
            kind: kind,
            transactionId: transactionId,
            sourceId: sourceId,
            sourceTimestamp: sourceTimestamp,
            votingRound: votingRound,
            amount: amount
        });

        emit CrossChainEvidenceRecorded(
            evidenceId,
            kind,
            transactionId,
            sourceId,
            sourceTimestamp,
            votingRound,
            amount
        );
    }

    function assess(bytes32 positionId) public view returns (Assessment memory result) {
        Position memory position = positions[positionId];
        if (!position.enabled) revert UnknownPosition();

        (result.priceWei, result.priceTimestamp) = ftso.getFeedByIdInWei(position.feedId);
        result.valueWei = (result.priceWei * position.unitsWei) / 1e18;

        if (result.priceWei < position.referencePriceWei) {
            result.downsideBps =
                ((uint256(position.referencePriceWei) - result.priceWei) * 10_000) /
                position.referencePriceWei;
        }

        bool invalidTimestamp =
            result.priceTimestamp == 0 || result.priceTimestamp > block.timestamp;
        bool stale = invalidTimestamp ||
            block.timestamp - result.priceTimestamp > position.maxPriceAge;
        if (result.priceWei == 0 || stale || result.downsideBps >= position.actDeviationBps) {
            result.level = RiskLevel.Act;
        } else if (result.downsideBps >= position.watchDeviationBps) {
            result.level = RiskLevel.Watch;
        } else {
            result.level = RiskLevel.Safe;
        }
    }

    /// @notice Emits a deterministic, auditable response commitment. Asset movement
    ///         stays behind the treasury's multisig instead of granting this demo custody.
    function queueResponse(bytes32 positionId, bytes32 responseHash)
        external
        onlyOwner
        returns (Assessment memory result)
    {
        if (responseHash == bytes32(0)) revert InvalidConfiguration();
        if (usedResponseHashes[responseHash]) revert ResponseAlreadyQueued();
        result = assess(positionId);
        if (result.level != RiskLevel.Act) revert InvalidConfiguration();

        usedResponseHashes[responseHash] = true;
        emit ResponseQueued(
            positionId,
            result.level,
            result.priceWei,
            result.downsideBps,
            responseHash
        );
    }
}
