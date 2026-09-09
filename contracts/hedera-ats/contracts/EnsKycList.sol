// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IExternalKycList} from "@hashgraph/asset-tokenization-contracts/contracts/facets/layer_1/externalKycList/IExternalKycList.sol";
import {IKyc} from "@hashgraph/asset-tokenization-contracts/contracts/facets/kyc/IKyc.sol";

/**
 * The Hedera-side answer to "is this wallet KYC approved right now", taken from ENS.
 *
 * Receivables Flow decides KYC on Sepolia, where the decision lives on the party's ENS name as
 * `rf.kyc.wallet` plus the name's own expiry. The token that enforces it lives on Hedera, and a
 * contract on one chain cannot read state on the other. This holds the same two facts on Hedera
 * so ATS can consult them inside a transfer, which is what makes the ENS decision the thing that
 * actually allows or refuses a trade rather than a description of who ought to be allowed.
 *
 * ATS calls `getKycStatus` on every registered external list while validating both the sender and
 * the recipient of a transfer, so a party this contract refuses cannot sell any more than it can
 * buy — and the refusal is the security's own, raised before any balance moves.
 *
 * The expiry is stored rather than a yes-or-no. Recomputing the answer against Hedera's clock on
 * every call means an approval that runs out stops granting at the moment it lapses, with no
 * transaction from us: the one thing a mirror normally gets wrong is being stale, and an expiry
 * cannot be. Only a rejection made before the expiry needs a call, because only that is new.
 */
contract EnsKycList is IExternalKycList {
    /** One party's KYC, as it stands on its ENS name. */
    struct Approval {
        /** Unix seconds the name expires. Zero means never approved, or approval taken back. */
        uint64 expiresAt;
        /** The ENS name the approval came from, so a reader on HashScan can see who granted it. */
        string name;
    }

    /**
     * The only account that may publish or withdraw.
     *
     * Immutable rather than transferable: this contract exists to carry one registry's decisions,
     * and a list whose publisher could change is a list whose past entries mean nothing.
     */
    address public immutable publisher;

    mapping(address => Approval) private approvals;

    event Published(address indexed wallet, uint64 expiresAt, string name);
    event Withdrawn(address indexed wallet);

    error NotPublisher();

    constructor(address publisher_) {
        publisher = publisher_;
    }

    modifier onlyPublisher() {
        if (msg.sender != publisher) revert NotPublisher();
        _;
    }

    /**
     * Records what a party's ENS name currently says about its KYC.
     *
     * Overwrites rather than accumulates, so publishing the same facts twice changes nothing and
     * a renewed name is republished the same way it was published the first time.
     *
     * @param wallet - The wallet named by the `rf.kyc.wallet` record
     * @param expiresAt - Unix seconds the ENS name expires
     * @param name - The ENS name the approval came from
     */
    function publish(address wallet, uint64 expiresAt, string calldata name) external onlyPublisher {
        approvals[wallet] = Approval({expiresAt: expiresAt, name: name});
        emit Published(wallet, expiresAt, name);
    }

    /**
     * Takes a party's approval back before its expiry.
     *
     * This is the only change that needs a transaction. A lapse does not, because the expiry is
     * already here and the clock reaches it on its own.
     */
    function withdraw(address wallet) external onlyPublisher {
        delete approvals[wallet];
        emit Withdrawn(wallet);
    }

    /**
     * Reports whether a wallet is KYC approved at this block, as ATS asks during a transfer.
     *
     * Strictly ahead of the timestamp, never at the expiry itself: the ENS name has stopped
     * resolving by the second it names, so granting at that second would be the two chains
     * disagreeing by one second about the same fact.
     */
    function getKycStatus(address account) external view override returns (IKyc.KycStatus) {
        return
            approvals[account].expiresAt > block.timestamp
                ? IKyc.KycStatus.GRANTED
                : IKyc.KycStatus.NOT_GRANTED;
    }

    /** Reads a party's stored expiry and the name it came from. */
    function approvalOf(address wallet) external view returns (Approval memory) {
        return approvals[wallet];
    }
}
