// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Lexicon {
    string[] public words;
    
    event WordAdded(string word, address indexed by);

    function addWordToLexicon(string memory _word) public {
        words.push(_word);
        emit WordAdded(_word, msg.sender);
    }

    function getWordCount() public view returns (uint256) {
        return words.length;
    }
}
