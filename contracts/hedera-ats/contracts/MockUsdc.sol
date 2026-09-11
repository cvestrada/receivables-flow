// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * The dollar this demo settles in — a mock of USDC, and named as one.
 *
 * Everything else about day 60 is real — the receivable is on chain, the holders are on chain,
 * the split is read off their balances — and the money is the one thing that is not. The money
 * was meant to be Circle's USDC on Hedera testnet, whose faucet hands out twenty dollars per
 * address every two hours: a $50,000 repayment can never be funded from it, so the panel that
 * should be the payoff of the demo ends on "nothing was transferred". The only alternative was
 * an invoice worth $20, which makes the price, the score and the split beside it unbelievable.
 *
 * So the platform issues its own. It is a mock and is named as one on screen and in the
 * README; Circle's address stays recorded for anyone running against mainnet. Six decimals,
 * because that is what USDC uses and no figure in the split should change because the money did.
 *
 * Anyone may deposit it, deliberately. Its whole job is to be freely available to whoever is
 * running the demo, and an issuer role would be one more credential to hold, one more thing to
 * set wrong, and one more way for day 60 to end with nobody paid.
 */
contract MockUsdc {
    string public constant name = 'Mock USDC';
    string public constant symbol = 'mUSDC';

    /** The same denomination as the USDC it stands in for. */
    uint8 public constant decimals = 6;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * Deposits mock dollars into any account, for anyone who asks.
     *
     * Called a deposit rather than a mint because that is what it is for: an account funding
     * itself so it can pay what it owes. There is no issuer to ask, deliberately — a role here
     * would be one more credential to hold and one more way for day 60 to end with nobody paid.
     */
    function deposit(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * Spends an allowance, which is the leg the day-20 settlement pulls the payment through.
     *
     * An unlimited allowance is left alone rather than decremented, so a spender approved once
     * does not have to be approved again between settlements.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, 'MockUsdc: allowance too small');
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;

        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, 'MockUsdc: balance too small');
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
