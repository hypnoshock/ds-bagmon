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
import {BeastShop} from "../src/BeastShop.sol";
import {HQ} from "../src/HQ.sol";

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

// BUILDING_KIND_EXTENSION_ID=10578442820450629844 GAME_ADDRESS=0x1D8e3A7Dc250633C192AC1bC9D141E1f95C419AB FORCE_HQ_DEPLOY=false forge script script/Deploy.sol --broadcast --verify --rpc-url "http://localhost:8545"

contract Deployer is Script {
    function setUp() public {}

    function run() public {
        uint256 playerDeploymentKey = vm.envOr(
            "PLAYER_DEPLOYMENT_KEY", uint256(0x24941b1db84a65ded87773081c700c22f50fe26c8f9d471dc480207d96610ffd)
        );

        address gameAddr = vm.envOr("GAME_ADDRESS", address(0x1D8e3A7Dc250633C192AC1bC9D141E1f95C419AB));
        Game ds = Game(gameAddr);

        bool forceHQDeploy = vm.envOr("FORCE_HQ_DEPLOY", false);

        uint64 extensionID = uint64(vm.envUint("BUILDING_KIND_EXTENSION_ID"));

        // connect as the player...
        vm.startBroadcast(playerDeploymentKey);

        // deploy
        bytes24 beastItem = registerBeast(ds, extensionID + 1); // extensionID must match the shop's
        (bytes24 bagBeastHQ, HQ bagBeastHQImpl, bytes24 bbStateItem) = registerHQ(ds, extensionID, forceHQDeploy);
        bagBeastHQImpl.init(ds, bbStateItem, beastItem);

        // Shop
        (bytes24 beastShopKind, BeastShop beastShopImpl) = registerBeastShop(ds, extensionID + 1, beastItem);
        beastShopImpl.init(bagBeastHQImpl);

        // dump deployed ids
        console2.log("beastItem:", uint192(beastItem));
        console2.log("beastShopKind:", uint192(beastShopKind));
        console2.log("bagBeastHQKind:", uint192(bagBeastHQ));
        console2.log("bagBeastHQImpl:", address(bagBeastHQImpl));
        console2.log("bbStateItem:", uint192(bbStateItem));

        vm.stopBroadcast();
    }

    // register a new item id
    function registerBeast(Game ds, uint64 extensionID) public returns (bytes24 itemKind) {
        return ItemUtils.register(
            ds,
            ItemConfig({
                id: extensionID,
                name: "Bag Beast Beast",
                icon: "28-75", // "26-147",
                greenGoo: 10, //In combat, Green Goo increases life
                blueGoo: 10, //In combat, Blue Goo increases defense
                redGoo: 0, //In combat, Red Goo increases attack
                stackable: false,
                implementation: address(0),
                plugin: ""
            })
        );
    }

    function registerHQ(Game ds, uint64 extensionID, bool forceRedeploy)
        public
        returns (bytes24 buildingKind, HQ implementation, bytes24 bbStateItem)
    {
        State state = ds.getState();
        buildingKind = Node.BuildingKind(extensionID);
        implementation = HQ(state.getImplementation(buildingKind));

        ItemConfig memory stateItemCfg = ItemConfig({
            id: extensionID,
            name: "",
            icon: "26-147",
            greenGoo: 10, //In combat, Green Goo increases life
            blueGoo: 10, //In combat, Blue Goo increases defense
            redGoo: 0, //In combat, Red Goo increases attack
            stackable: false,
            implementation: address(0),
            plugin: ""
        });

        if (address(implementation) == address(0) || forceRedeploy) {
            console2.log("Deploy::Resetting state");
            bbStateItem = ItemUtils.register(ds, stateItemCfg);
            implementation = new HQ();
        } else {
            uint32[3] memory outputItemAtoms =
                [uint32(stateItemCfg.greenGoo), uint32(stateItemCfg.blueGoo), uint32(stateItemCfg.redGoo)];
            bbStateItem = Node.Item(uint32(extensionID), outputItemAtoms, stateItemCfg.stackable);
        }

        console2.log("Deploy::Registering HQ and state item");

        // find the base item ids we will use as inputs for our hammer factory
        bytes24 none = 0x0;
        bytes24 glassGreenGoo = ItemUtils.GlassGreenGoo();
        bytes24 beakerBlueGoo = ItemUtils.BeakerBlueGoo();
        bytes24 flaskRedGoo = ItemUtils.FlaskRedGoo();

        // register a new building kind
        buildingKind = BuildingUtils.register(
            ds,
            BuildingConfig({
                id: extensionID,
                name: "BagBeasts - HQ",
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
                    Output({quantity: 1, item: bbStateItem}) // this is the output that can be crafted given the inputs
                ],
                implementation: address(implementation),
                plugin: string.concat(vm.readFile("src/HQ.js"), vm.readFile("src/Helper.js"))
            })
        );
    }

    // register a new
    function registerBeastShop(Game ds, uint64 extensionID, bytes24 hammer)
        public
        returns (bytes24 buildingKind, BeastShop implementation)
    {
        // find the base item ids we will use as inputs for our hammer factory
        bytes24 none = 0x0;
        bytes24 glassGreenGoo = ItemUtils.GlassGreenGoo();
        bytes24 beakerBlueGoo = ItemUtils.BeakerBlueGoo();
        bytes24 flaskRedGoo = ItemUtils.FlaskRedGoo();

        // register a new building kind
        implementation = new BeastShop();
        buildingKind = BuildingUtils.register(
            ds,
            BuildingConfig({
                id: extensionID,
                name: "BagBeasts - Beast Shop",
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
                plugin: string.concat(vm.readFile("src/BeastShop.js"), vm.readFile("src/Helper.js"))
            })
        );
    }
}
