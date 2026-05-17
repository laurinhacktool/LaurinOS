// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract LauCoin is ERC20, ERC20Burnable, Ownable {
    // Initial supply when the contract is deployed. Adjust as needed.
    uint256 private constant INITIAL_SUPPLY = 100000000 * 10 ** 18; // 100 Million LauCoins

    constructor(address initialOwner) 
        ERC20("LauCoin", "LAU") 
        Ownable(initialOwner) 
    {
        // Mint the initial supply to the contract owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @dev Optionally mint new tokens, restricted to owner.
     * @param to Address receiving the newly minted tokens.
     * @param amount The number of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
