// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IHederaScheduleService} from './IHederaScheduleService.sol';

/** The part of ERC-20 both legs of a settlement need. ATS securities expose exactly this. */
interface IErc20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * Delivery versus payment for a receivable issued through Asset Tokenization Studio.
 *
 * ATS is a register: it records who holds a security and what the issuer owes at maturity,
 * and it deliberately knows nothing about what anyone paid. That leaves the purchase as a
 * second, unlinked transfer — the investor can pay and never receive units, or receive units
 * and never be paid. This contract closes that gap by moving both legs inside one
 * transaction, so either the money and the security both move or neither does.
 *
 * Custody is deliberately not taken. Both legs are pulled with `transferFrom` straight from
 * seller to buyer and buyer to seller, so no balance ever rests here: there is nothing to
 * strand if a settlement fails, and no refund path to get wrong.
 *
 * This contract must still be on the security's approved-holder list, because ATS refuses to
 * grant an allowance to an unlisted spender. Being listed is what lets the seller authorise
 * it; the pass-through is what stops it from ever needing to hold what it moves.
 */
contract ReceivableDvp {
    /** One receivable offered for sale on stated terms. */
    struct Offer {
        /** The business selling the receivable. Receives the payment. */
        address seller;
        /** The ATS security being sold. */
        address security;
        /** Units of that security on offer. One unit is one dollar of face value. */
        uint256 units;
        /** The token the buyer pays in, typically USDC. */
        address payment;
        /** Total the buyer pays, in the payment token's own decimals. */
        uint256 price;
        /** Days from the sale until the invoice is payable. */
        uint256 maturityDays;
        /** The second the repayment is booked for. Zero until the sale settles. */
        uint256 maturesAt;
        /** Where the booked repayment lives on the network. Zero until the sale settles. */
        address schedule;
        /** True once the booked call has run. */
        bool matured;
        /** False once settled or cancelled. An offer is never reopened. */
        bool open;
    }

    /** Hedera's schedule service, at the address it answers on for every network. */
    IHederaScheduleService private constant SCHEDULE_SERVICE =
        IHederaScheduleService(address(0x16b));

    /** Hedera's response code for a request the network accepted. */
    int64 private constant SUCCESS = 22;

    /**
     * Gas the booked call may spend when it runs.
     *
     * It only has to cover marking one receivable matured. The figure is set here rather than
     * passed in because a caller who set it too low would produce a booking that looks correct
     * for sixty days and then fails on the one day it matters.
     */
    uint256 private constant MATURITY_GAS = 200_000;

    mapping(uint256 => Offer) private offers;
    uint256 private nextId;

    event Offered(
        uint256 indexed id,
        address indexed seller,
        address indexed security,
        uint256 units,
        address payment,
        uint256 price
    );
    event Settled(uint256 indexed id, address indexed buyer, uint256 units, uint256 price);
    event PayoutBooked(uint256 indexed id, address indexed schedule, uint256 maturesAt);
    event Matured(uint256 indexed id, uint256 at);
    event Cancelled(uint256 indexed id);

    error NotOpen();
    error NotSeller();
    error NothingOffered();
    error PaymentLegFailed();
    error DeliveryLegFailed();
    error BookingRefused();
    error NotScheduled();
    error AlreadyMatured();

    /**
     * Offers `units` of a receivable for `price`, and returns the offer's id.
     *
     * The seller must approve this contract for `units` of `security` before anyone can
     * settle. Approval is not checked here on purpose: the seller may want the offer listed
     * before granting it, and a stale approval would make the check meaningless anyway.
     *
     * @param security - The ATS security being sold
     * @param units - Units of that security, one per dollar of face value
     * @param payment - Token the buyer pays in
     * @param price - Total the buyer pays, in that token's decimals
     * @param maturityDays - Days from the sale until the invoice is payable
     * @return id - Identifier the buyer settles against
     */
    function offer(
        address security,
        uint256 units,
        address payment,
        uint256 price,
        uint256 maturityDays
    ) external returns (uint256 id) {
        if (units == 0) revert NothingOffered();

        id = nextId++;
        offers[id] = Offer({
            seller: msg.sender,
            security: security,
            units: units,
            payment: payment,
            price: price,
            maturityDays: maturityDays,
            maturesAt: 0,
            schedule: address(0),
            matured: false,
            open: true
        });

        emit Offered(id, msg.sender, security, units, payment, price);
    }

    /**
     * Buys the offer: pays the seller and receives the units, or reverts having done neither.
     *
     * The caller must have approved this contract for `price` of the payment token. The offer
     * is closed before either transfer runs, so a token that calls back into this contract
     * cannot settle the same offer twice.
     *
     * Payment moves first. If the buyer is not on the security's approved-holder list, the
     * delivery leg reverts and takes the payment with it — the refusal a judge sees is the
     * security's own compliance rule, not a check written here.
     *
     * The repayment owed at maturity is booked before this returns, in the same transaction.
     * That is the point: there is no instant at which the receivable has changed hands and the
     * repayment is still only a promise someone has to remember to keep. If the network will
     * not take the booking, the sale itself is undone.
     *
     * @param id - The offer to settle
     */
    function settle(uint256 id) external {
        Offer storage sale = offers[id];
        if (!sale.open) revert NotOpen();
        sale.open = false;

        /*
         * Leg one — the money moves from the buyer to the business.
         */
        if (!IErc20(sale.payment).transferFrom(msg.sender, sale.seller, sale.price)) {
            revert PaymentLegFailed();
        }

        /*
         * Leg two — the receivable moves the other way. The security decides whether the buyer
         * may hold it, and a refusal here reverts the payment leg above along with it.
         */
        if (!IErc20(sale.security).transferFrom(sale.seller, msg.sender, sale.units)) {
            revert DeliveryLegFailed();
        }

        emit Settled(id, msg.sender, sale.units, sale.price);

        /*
         * Leg three — the network is asked to hold the repayment until maturity. Maturity runs
         * from this moment rather than from when the offer was listed, because the money was
         * only tied up once it actually changed hands.
         */
        uint256 maturesAt = block.timestamp + sale.maturityDays * 1 days;
        (int64 responseCode, address schedule) = SCHEDULE_SERVICE.scheduleCall(
            address(this),
            maturesAt,
            MATURITY_GAS,
            0,
            abi.encodeCall(this.mature, (id))
        );
        if (responseCode != SUCCESS) revert BookingRefused();

        sale.maturesAt = maturesAt;
        sale.schedule = schedule;

        emit PayoutBooked(id, schedule, maturesAt);
    }

    /**
     * Marks the receivable matured. Reached only by the booked call coming due.
     *
     * The network delivers a scheduled call as though the contract had made it itself, so the
     * ordinary case is a call from this address. The schedule service is accepted too, because
     * on a plain EVM — where tests run — that is the address the delivery comes from. Neither
     * is an account anyone controls, which is what keeps an investor from maturing their own
     * receivable the day after buying it.
     *
     * @param id - The settled offer whose repayment has come due
     */
    function mature(uint256 id) external {
        if (msg.sender != address(this) && msg.sender != address(SCHEDULE_SERVICE)) {
            revert NotScheduled();
        }

        Offer storage sale = offers[id];
        if (sale.schedule == address(0)) revert NotScheduled();
        if (sale.matured) revert AlreadyMatured();

        sale.matured = true;
        emit Matured(id, block.timestamp);
    }

    /** Withdraws an unsettled offer. Only the seller can, and only while it is still open. */
    function cancel(uint256 id) external {
        Offer storage sale = offers[id];
        if (!sale.open) revert NotOpen();
        if (sale.seller != msg.sender) revert NotSeller();

        sale.open = false;
        emit Cancelled(id);
    }

    /** Reads an offer's terms. */
    function offerOf(uint256 id) external view returns (Offer memory) {
        return offers[id];
    }
}
