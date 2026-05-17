// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AlfaSwap {
    using SafeERC20 for IERC20;

    IERC20 public lauCoin;
    // Fixed exchange rate for demonstration
    uint256 public rate = 1000; // 1 ALFA (ETH) = 1000 LAU

    event Swap(address indexed user, uint256 alfaAmount, uint256 lauAmount);

    constructor(address _lauCoin) {
        lauCoin = IERC20(_lauCoin);
    }

    // Accept native currency (referred to as ALFA in the UI)
    // and transfer equivalent LAU points back to the user
    function swapAlfaForLau() public payable {
        require(msg.value > 0, "Must send ALFA (ETH)");
        
        uint256 lauAmount = msg.value * rate;
        require(lauCoin.balanceOf(address(this)) >= lauAmount, "Not enough LAU in reserve");

        lauCoin.safeTransfer(msg.sender, lauAmount);
        
        emit Swap(msg.sender, msg.value, lauAmount);
    }

    // Allow owner to withdraw accumulated ALFA (ETH)
    function withdraw() public {
        // Admin withdrawal logic (omitted for brevity)
    }
}
