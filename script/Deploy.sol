// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {Game} from "@ds/Game.sol";
import {Actions} from "@ds/actions/Actions.sol";
import {Node, Schema, State} from "@ds/schema/Schema.sol";
import {ItemUtils, ItemConfig} from "@ds/utils/ItemUtils.sol";
import {BuildingUtils, BuildingConfig, Material, Input, Output} from "@ds/utils/BuildingUtils.sol";
import {Dispatcher} from "cog/Dispatcher.sol";
import {EggShop} from "../src/EggShop.sol";

using Schema for State;

// Generating a random number in nodejs
/*

function genRandomNumber(byteCount, radix) {
  return BigInt('0x' + crypto.randomBytes(byteCount).toString('hex')).toString(radix)
}
genRandomNumber(8, 10)

*/

// --rpc-url "http://localhost:8545"
// --rpc-url "https://network-ds-test.dev.playmint.com"

// BUILDING_KIND_EXTENSION_ID=10578442820450629844 GAME_ADDRESS=0x1D8e3A7Dc250633C192AC1bC9D141E1f95C419AB forge script script/Deploy.sol --broadcast --verify --rpc-url "http://localhost:8545"

contract Deployer is Script {
    function setUp() public {}

    function run() public {
        uint256 playerDeploymentKey = vm.envOr(
            "PLAYER_DEPLOYMENT_KEY", uint256(0x24941b1db84a65ded87773081c700c22f50fe26c8f9d471dc480207d96610ffd)
        );

        address gameAddr = vm.envOr("GAME_ADDRESS", address(0x1D8e3A7Dc250633C192AC1bC9D141E1f95C419AB));
        Game ds = Game(gameAddr);
        State s = ds.getState();
        Dispatcher d = ds.getDispatcher();

        uint64 extensionID = uint64(vm.envUint("BUILDING_KIND_EXTENSION_ID"));

        // connect as the player...
        vm.startBroadcast(playerDeploymentKey);

        // deploy
        bytes24 ledger = _getLedger(s, d);
        bytes24 hammerItem = registerEgg(ds, extensionID);
        (bytes24 eggShopKind, EggShop eggShopImpl) = registerEggShop(ds, extensionID, hammerItem);
        eggShopImpl.init(ds, ledger);

        // dump deployed ids
        console2.log("ItemKind", uint256(bytes32(hammerItem)));
        console2.log("BuildingKind", uint256(bytes32(eggShopKind)));

        vm.stopBroadcast();
    }

    // register a new item id
    function registerEgg(Game ds, uint64 extensionID) public returns (bytes24 itemKind) {
        return ItemUtils.register(
            ds,
            ItemConfig({
                id: extensionID,
                name: "Bag Beast Egg",
                icon: "26-147",
                greenGoo: 10, //In combat, Green Goo increases life
                blueGoo: 10, //In combat, Blue Goo increases defense
                redGoo: 0, //In combat, Red Goo increases attack
                stackable: false,
                implementation: address(0),
                plugin: ""
            })
        );
    }

    // register a new
    function registerEggShop(Game ds, uint64 extensionID, bytes24 hammer)
        public
        returns (bytes24 buildingKind, EggShop implementation)
    {
        // find the base item ids we will use as inputs for our hammer factory
        bytes24 none = 0x0;
        bytes24 glassGreenGoo = ItemUtils.GlassGreenGoo();
        bytes24 beakerBlueGoo = ItemUtils.BeakerBlueGoo();
        bytes24 flaskRedGoo = ItemUtils.FlaskRedGoo();

        // register a new building kind
        implementation = new EggShop();
        buildingKind = BuildingUtils.register(
            ds,
            BuildingConfig({
                id: extensionID,
                name: "BagBeasts - Egg Shop",
                materials: [
                    Material({quantity: 10, item: glassGreenGoo}), // these are what it costs to construct the factory
                    Material({quantity: 10, item: beakerBlueGoo}),
                    Material({quantity: 10, item: flaskRedGoo}),
                    Material({quantity: 0, item: none})
                ],
                inputs: [
                    Input({quantity: 10, item: glassGreenGoo}), // these are required inputs to get the output
                    Input({quantity: 10, item: beakerBlueGoo}),
                    Input({quantity: 0, item: none}),
                    Input({quantity: 0, item: none})
                ],
                outputs: [
                    Output({quantity: 1, item: hammer}) // this is the output that can be crafted given the inputs
                ],
                implementation: address(implementation),
                plugin: vm.readFile("src/EggShop.js")
            })
        );
    }

    function _getLedger(State state, Dispatcher dispatcher) private returns (bytes24 ledger) {
        // we are using a item's "name" annotation as a place to store data that can be read by a client plugin
        // this is a horrible hack and probably makes no sence to look at... don't judge me (because Farm's did it first), we need Books

        // Marked 4 bytes is the item ID
        //                 XXXXXXXX
        ledger = 0x6a7a67f0a1adafa300000001000000640000006400000064;
        if (state.getOwner(ledger) != 0) {
            console2.log("Previous ledger found");
            return ledger;
        } else {
            console2.log("Deploying new ledger");
            dispatcher.dispatch(abi.encodeCall(Actions.REGISTER_ITEM_KIND, (ledger, "ledger", "")));
            bytes24[4] memory materialItem;
            materialItem[0] = 0x6a7a67f0cca240f900000001000000020000000000000000; // green goo
            materialItem[1] = 0x6a7a67f0e0f51af400000001000000000000000200000000; // blue goo
            materialItem[2] = 0x6a7a67f0006f223600000001000000000000000000000002; // red goo
            uint64[4] memory materialQty;
            materialQty[0] = 25;
            materialQty[1] = 25;
            materialQty[2] = 25;
            // Last 8 bytes are the ID
            bytes24 buildingKind = 0xbe92755c0000000000000000000000005aaaaaea7afafa0a;
            dispatcher.dispatch(
                abi.encodeCall(
                    Actions.REGISTER_BUILDING_KIND,
                    (buildingKind, "BagBeasts - Egg Registry", materialItem, materialQty)
                )
            );
            bytes24[4] memory inputItem;
            inputItem[0] = 0x6a7a67f0cca240f900000001000000020000000000000000; // green goo
            inputItem[1] = 0x6a7a67f0e0f51af400000001000000000000000200000000; // blue goo
            inputItem[2] = 0x6a7a67f0006f223600000001000000000000000000000002; // red goo
            uint64[4] memory inputQty;
            inputQty[0] = 100;
            inputQty[1] = 100;
            inputQty[2] = 100;
            bytes24 outputItem = ledger;
            uint64 outputQty = 1;
            dispatcher.dispatch(
                abi.encodeCall(
                    Actions.REGISTER_CRAFT_RECIPE, (buildingKind, inputItem, inputQty, outputItem, outputQty)
                )
            );
            return ledger;
        }
    }
}
