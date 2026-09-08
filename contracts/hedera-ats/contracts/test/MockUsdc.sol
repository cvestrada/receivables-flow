// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * The smallest ERC-20 that can stand in for USDC in a settlement test.
 *
 * Only what `ReceivableDvp` touches is implemented. It exists so the payment leg can be made
 * to fail on demand — an approval that is too small, a balance that is not there — without
 * depending on a real stablecoin deployment.
 */
contract MockUsdc {
    string public constant name = 'Mock USDC';
    string public constant symbol = 'USDC';
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, 'allowance');
        require(balanceOf[from] >= amount, 'balance');

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }
}
