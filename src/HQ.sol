// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/console2.sol";
import {Game} from "cog/Game.sol";
import {Actions} from "@ds/actions/Actions.sol";
import {BuildingKind} from "@ds/ext/BuildingKind.sol";
import {console} from "forge-std/console.sol";
import {State} from "cog/State.sol";
import {Rel, Schema, Kind, Node} from "@ds/schema/Schema.sol";
import {Dispatcher} from "cog/Dispatcher.sol";
import "@ds/utils/Base64.sol";

using Schema for State;

enum BeastState {
    baby,
    adult,
    escaped
}

struct Beast {
    uint256 index;
    bytes24 bag;
    BeastState state;
    uint256 lastFedBlock;
    uint256 bornBlock;
    uint256 beastNum; // Not so important anymore as the bag is the ID
    bytes24 house;
}
// string name; // TODO: leaving out for the minute because decoding string annoying in frontend

contract HQ is BuildingKind {
    mapping(bytes24 => uint256) public bagToBeastIndex;
    // mapping(bytes24 => uint256) public houseToBeastIndex;

    Beast[] public beasts;
    bytes24 public ledger;
    uint256 public beastNum;
    bytes24 public beastItem;

    function init(Game ds, bytes24 _ledger, bytes24 _beastItem) public {
        if (ledger == bytes24(0)) {
            require(_ledger != bytes24(0), "HQ::Init: Cannot set ledger to null");

            console2.log("HQ::Init: Setting ledger: ", uint256(bytes32(_ledger)));
            ledger = _ledger;

            // Make a null entry for entry 0
            registerBeast(ds.getState(), bytes24(0));
        } else {
            console2.log("HQ::Init: Ledger already set");
        }

        require(_beastItem != bytes24(0), "HQ::Init: Cannot set beast item to null");
        beastItem = _beastItem;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata /*payload*/ ) public {}

    function registerBeast(State state, bytes24 mobileUnit) public {
        // Check the player doesn't already have an beast
        uint256 beastIndex = bagToBeastIndex[mobileUnit];
        if (beastIndex > 0) {
            Beast storage beast = beasts[beastIndex];
            require(
                beast.bag == bytes24(0) || beast.state == BeastState.escaped, "Player cannot own more than one beast"
            );
        }

        beasts.push(
            Beast({
                index: beasts.length,
                bag: mobileUnit, // owned directly by mobileUnit NOT player
                state: BeastState.baby,
                lastFedBlock: 0, // we don't start counting feed times until monster is first fed
                bornBlock: block.number,
                // name: "",
                beastNum: beastNum++,
                house: bytes24(0)
            })
        );
        bagToBeastIndex[mobileUnit] = beasts.length - 1;

        _broadcastState(state);
    }

    function putBeast(State state, bytes24 houseInstance, bytes24 mobileUnit) public {
        uint256 beastIndex = bagToBeastIndex[mobileUnit];
        require(beastIndex > 0, "Beast HQ: No beast registered to supplied mobile unit!");

        Beast storage beast = beasts[beastIndex];
        require(beast.house == bytes24(0), "Beast HQ: Beast already in a house");

        beast.house = houseInstance;
        _broadcastState(state);
    }

    // -- We might not actually ever delete entries
    //
    // function _deleteEntry(Beast storage entry) private {
    //     uint256 index = entry.index;
    //     require(beasts[index].bag == entry.bag, "Entry to be deleted doesn't match entry at index");

    //     // Delete by swapping the last entry with the entry we want to delete and then deleting the last entry
    //     beasts[index] = beasts[beasts.length - 1];
    //     beasts[index].index = index;
    //     beasts.pop();

    //     // Update mapping
    //     bagToBeastIndex[beasts[index].bag] = index;
    //     delete bagToBeastIndex[entry.bag];
    // }

    function _broadcastState(State state) private {
        require(ledger != bytes24(0), "Ledger not set, unable to broadcast state");

        // store the state in the name annotation of the ledger ... again, don't judge me (because Farm's did it first)
        state.annotate(ledger, "name", Base64.encode(abi.encode(beasts)));
    }
}
