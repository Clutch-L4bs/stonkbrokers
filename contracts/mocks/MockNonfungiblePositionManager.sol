// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "../uniswap/INonfungiblePositionManagerMinimal.sol";
import "./MockUniswapV3Pool.sol";

/// @notice Minimal NonfungiblePositionManager mock for launcher tests.
/// It:
/// - creates a dummy pool (token0/token1)
/// - pulls tokens on mint via transferFrom
/// - tracks ERC721 ownership for safeTransferFrom/ownerOf
/// - allows collect() to send any balances it holds to recipient
contract MockNonfungiblePositionManager is INonfungiblePositionManagerMinimal {
    using Address for address;

    uint256 private _nextTokenId = 1;

    mapping(uint256 => address) private _ownerOf;

    address public lastPool;

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24, /* fee */
        uint160 /* sqrtPriceX96 */
    ) external payable returns (address pool) {
        MockUniswapV3Pool p = new MockUniswapV3Pool(token0, token1);
        pool = address(p);
        lastPool = pool;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        // Pull tokens like the real PM.
        if (params.amount0Desired > 0) {
            require(IERC20(params.token0).transferFrom(msg.sender, address(this), params.amount0Desired), "t0 xfer");
        }
        if (params.amount1Desired > 0) {
            require(IERC20(params.token1).transferFrom(msg.sender, address(this), params.amount1Desired), "t1 xfer");
        }

        tokenId = _nextTokenId++;
        _ownerOf[tokenId] = params.recipient;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        liquidity = 1;
    }

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1) {
        require(_ownerOf[params.tokenId] != address(0), "no token");

        // Send everything we have of token0/token1. Caller seeds balances in tests.
        // NOTE: In the real PM, token0/token1 are read from position storage; for tests we can ignore.
        // The fee splitter calls collect with recipient=splitter, so this sends balances into splitter.
        // For simplicity, we treat msg.sender as trusted in tests.
        // (Amounts are limited by amount0Max/amount1Max.)
        // We infer token addresses from the most recent pool.
        require(lastPool != address(0), "no pool");
        address t0 = MockUniswapV3Pool(lastPool).token0();
        address t1 = MockUniswapV3Pool(lastPool).token1();

        uint256 b0 = IERC20(t0).balanceOf(address(this));
        uint256 b1 = IERC20(t1).balanceOf(address(this));
        amount0 = b0 > params.amount0Max ? params.amount0Max : b0;
        amount1 = b1 > params.amount1Max ? params.amount1Max : b1;

        if (amount0 > 0) require(IERC20(t0).transfer(params.recipient, amount0), "c0 xfer");
        if (amount1 > 0) require(IERC20(t1).transfer(params.recipient, amount1), "c1 xfer");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(_ownerOf[tokenId] == from, "not owner");
        require(msg.sender == from, "not auth");
        _ownerOf[tokenId] = to;

        if (to.code.length > 0) {
            bytes4 ret = IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, "");
            require(ret == IERC721Receiver.onERC721Received.selector, "bad receiver");
        }
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _ownerOf[tokenId];
        require(o != address(0), "no token");
        return o;
    }
}

