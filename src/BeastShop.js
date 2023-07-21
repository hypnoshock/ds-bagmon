import ds from "downstream";

const nullBytes24 = "0x000000000000000000000000000000000000000000000000";

export default function update({ selected, world }) {
  const { tiles, mobileUnit } = selected || {};
  const selectedTile = tiles && tiles.length === 1 ? tiles[0] : undefined;
  const selectedBuilding = selectedTile?.building;
  const selectedMobileUnit = mobileUnit;

  // fetch the expected inputs item kinds
  const requiredInputs = selectedBuilding?.kind?.inputs || [];
  const want0 = requiredInputs.find((inp) => inp.key == 0);
  const want1 = requiredInputs.find((inp) => inp.key == 1);

  // fetch what is currently in the input slots
  const inputSlots =
    selectedBuilding?.bags.find((b) => b.key == 0).bag?.slots || [];
  const got0 = inputSlots?.find((slot) => slot.key == 0);
  const got1 = inputSlots?.find((slot) => slot.key == 1);

  // fetch our output item details
  const expectedOutputs = selectedBuilding?.kind?.outputs || [];
  const out0 = expectedOutputs?.find((slot) => slot.key == 0);

  // To get the kind ID for the HQ I used https://www.rapidtables.com/convert/number/decimal-to-hex.html to convert the number logged out by the deploy script
  const hq = getHQ(world);
  const stateItem = hq ? hq.kind.outputs[0]?.item : null;
  const beasts = stateItem ? decodeState(stateItem) : [];
  const playersBeasts = beasts.filter(
    (beast) =>
      selectedMobileUnit.bags.find(
        (itemSlot) => itemSlot.bag.id == beast.bag
      ) != undefined
  );

  const BLOCK_TIME_SECS = 10;

  // try to detect if the input slots contain enough stuff to craft
  const canCraft =
    selectedMobileUnit &&
    want0 &&
    got0 &&
    want0.balance == got0.balance &&
    want1 &&
    got1 &&
    want1.balance == got1.balance &&
    playersBeasts.length == 0;

  const craft = () => {
    if (!selectedMobileUnit) {
      ds.log("no unit selected");
      return;
    }
    if (!selectedBuilding) {
      ds.log("no building selected");
      return;
    }

    const destEquipSlot = 2;
    const payload = ds.encodeCall("function USE(uint8 unitDestEquipSlot)", [
      destEquipSlot,
    ]);
    ds.dispatch(
      {
        name: "BUILDING_USE",
        args: [selectedBuilding.id, selectedMobileUnit.id, payload],
      },
      {
        name: "TRANSFER_ITEM_MOBILE_UNIT",
        args: [
          selectedMobileUnit.id,
          [selectedBuilding.id, selectedMobileUnit.id],
          [1, destEquipSlot],
          [0, 0],
          nullBytes24, // toBagId can be null providing there's a bag at destEquipSlot
          1,
        ],
      }
    );

    ds.log("BeastShop: buy beast");
  };

  const getAliveMinutes = (beast, currentBlock) => {
    return Math.floor(
      ((currentBlock - beast.bornBlock) * BLOCK_TIME_SECS) / 60
    );
  };

  const getLastFedMinutes = (beast, currentBlock) => {
    return Math.floor(
      ((currentBlock - beast.lastFedBlock) * BLOCK_TIME_SECS) / 60
    );
  };

  const getBeastState = (beast, currentBlock) => {
    if (beast.lastFedBlock > 0) {
      const lastFedMinutes = getLastFedMinutes(beast, currentBlock);
      if (lastFedMinutes > 3) {
        return "You beast has run away due to being too hungry!";
      } else if (lastFedMinutes > 1) {
        return "Your bag beast is hungry, you should feed it before it gets too hungry and runs away.";
      } else {
        return "You bag beast is content";
      }
    } else {
      // const aliveMinutes = getAliveMinutes(beast, currentBlock);
      return "You must build a house for your beast and attend to it";
    }
  };

  const getMainText = () => {
    if (!hq) {
      return `<p>Oh no the Bag Beast HQ has been destroyed. It must be rebuilt for us to keep record of who has which beasts!</p>`;
    } else {
      let html = "";
      html += `<p>Current block: ${world.block}</p>`;
      html += `<p>Beasts sold to date: ${beasts.length}</p>`;
      // html += beasts
      //   .map(
      //     (beast) =>
      //       `<p>idx: ${beast.index.slice(-2)}, bag: ${beast.bag.slice(-6)}</p>`
      //   )
      //   .join("");
      if (playersBeasts.length > 0) {
        html += `<p>You have beast number: ${playersBeasts[0].beastNum}</p>`;
        html += `<p>Minutes alive: ${getAliveMinutes(
          playersBeasts[0],
          world.block
        )}</p>`;
        html += `<p>${getBeastState(playersBeasts[0], world.block)}</p>`;

        if ((got0 && got0.balance > 0) || (got1 && got1.balance > 0)) {
          html += `</br><p>You can only care for one beast at a time, they are very demanding creatures. Please take back your payment</p>`;
        }
      }

      return html;
    }
  };

  return {
    version: 1,
    components: [
      {
        type: "building",
        id: "BagBeasts-beast-shop",
        title: "Bag Beasts Beast Shop",
        summary: `Buy Bag Beasts here! We hold a strict policy of only allowing one beast per person as they are very demanding creatures.`,
        content: [
          {
            id: "default",
            type: "inline",
            html: `
            ${getMainText()}
            `,
            buttons: [
              {
                text: "Buy Beast",
                type: "action",
                action: craft,
                disabled: !canCraft,
              },
            ],
          },
        ],
      },
    ],
  };
}
