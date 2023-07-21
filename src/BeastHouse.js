import ds from "downstream";

export default function update({ selected, world }) {
  const { tiles, mobileUnit } = selected || {};
  const selectedTile = tiles && tiles.length === 1 ? tiles[0] : undefined;
  const selectedBuilding = selectedTile?.building;
  const selectedMobileUnit = mobileUnit;

  const hq = getHQ(world);
  const stateItem = hq ? hq.kind.outputs[0]?.item : null;
  const beasts = stateItem ? decodeState(stateItem) : [];

  const playersBeasts = selectedMobileUnit
    ? beasts.filter(
        (beast) =>
          selectedMobileUnit.bags.find(
            (itemSlot) => itemSlot.bag.id == beast.bag
          ) != undefined
      )
    : [];

  const houseBeasts = beasts.filter(
    (beast) =>
      selectedBuilding.bags.find((itemSlot) => itemSlot.bag.id == beast.bag) !=
      undefined
  );

  const put = () => {
    if (playersBeasts.length == 0) return;

    const beastDestSlot = 2; // TODO: Make selectable

    ds.dispatch(
      {
        name: "TRANSFER_BAG",
        args: [
          playersBeasts[0].bag,
          selectedMobileUnit.id,
          selectedBuilding.id,
          beastDestSlot,
        ],
      },
      {
        name: "BUILDING_USE",
        args: [
          selectedBuilding.id,
          selectedMobileUnit.id,
          ds.encodeCall("function PUT(bytes24 bagBeast)", [
            playersBeasts[0].bag,
          ]),
        ],
      }
    );
  };

  const collect = () => {
    if (houseBeasts.length == 0) return;

    // const beastEquipSlot = 2; // TODO: Make selectable
    ds.dispatch({
      name: "BUILDING_USE",
      args: [
        selectedBuilding.id,
        selectedMobileUnit.id,
        ds.encodeCall("function COLLECT(bytes24 bagBeast)", [
          houseBeasts[0].bag,
        ]),
      ],
    });
  };

  const getMainHtml = () => {
    if (!hq) {
      return `<p>Oh no the Bag Beast HQ has been destroyed. It must be rebuilt for us to keep record of who has which beasts!</p>`;
    } else {
      let html = "";
      // html += `<p>Housed beasts: ${houseBeasts.length}</p>`;
      if (houseBeasts.length > 0) {
        html += `<p>Beast number: ${houseBeasts[0].beastNum}</p>`;
        html += `<p>Beast is ${getAliveMinutes(
          houseBeasts[0],
          world.block
        )} minutes old</p>`;
        html += `<p>Beast was las fed ${getLastFedMinutes(
          houseBeasts[0],
          world.block
        )} minutes ago</p>`;
        html += `<div width="100%" style="display: flex; justify-content: center; align-items: center;">
        
        <img class="beast" data-bag-id="${houseBeasts[0].bag.slice(
          -6
        )}" width="150px" src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI3LjUuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMiIgYmFzZVByb2ZpbGU9InRpbnkiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIKCSB5PSIwcHgiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBvdmVyZmxvdz0idmlzaWJsZSIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxnIGlkPSJiZyI+Cgo8c3R5bGU+CkBrZXlmcmFtZXMgbW91dGhTbGVlcCB7CgkwJSwKCTUwJSwKCTEwMCUgewoJCW9wYWNpdHk6IDE7Cgl9CgoJMjUlLAoJNzUlIHsKCQlvcGFjaXR5OiAwOwoJfQp9CgojbW91dGggewogIGFuaW1hdGlvbjogbW91dGhTbGVlcCAxMHMgZWFzZSAwcyBpbmZpbml0ZSBub3JtYWwgZm9yd2FyZHM7Cn0KPC9zdHlsZT4KCgk8cGF0aCBmaWxsPSIjMjdBQUUxIiBzdHJva2U9IiMyNjIyNjIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgZD0iTTczLjMxLDUyLjQ0YzAsOS4wMy0wLjg4LDE0Ljc3LTUuMzksMjAuNzIKCQlDNjMuMzUsNzkuMiw1Ny4wMSw4Mi45Myw1MCw4Mi45M2MtNy41NiwwLTE0LjM1LTQuMzUtMTguOTctMTEuMjVjLTMuODgtNS43OS01LjIyLTExLjc2LTUuMjItMjAuMDdjMC04LjgsMy41OS0xNS4zNSw4LjEzLTIxLjYzCgkJYzQuNTctNi4zMiw4Ljg3LTEyLjkzLDE2LjA1LTEyLjkzYzcuMzEsMCwxMS4wNiw2LjQzLDE1LjY2LDEyLjkzQzY5LjgyLDM1Ljg2LDczLjMxLDQzLjgsNzMuMzEsNTIuNDR6Ii8+CjwvZz4KPGcgaWQ9ImV5ZXMiPgoJPGxpbmUgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjYyMjYyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHgxPSIzNS4wOSIgeTE9IjQ1Ljc3IiB4Mj0iNDMuMzgiIHkyPSI0NS43NyIvPgoJPGxpbmUgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjYyMjYyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHgxPSI1Ni45NiIgeTE9IjQ1Ljc3IiB4Mj0iNjUuMjYiIHkyPSI0NS43NyIvPgo8L2c+CjxnIGlkPSJtb3V0aCI+Cgk8ZWxsaXBzZSBmaWxsPSJub25lIiBzdHJva2U9IiMyNjIyNjIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgY3g9IjQ5LjYxIiBjeT0iNjkuNDMiIHJ4PSI0LjIzIiByeT0iMS4wNiIvPgo8L2c+Cjwvc3ZnPgo="/>
        
        </div>`;
      }

      return html;
    }
  };

  return {
    version: 1,
    components: [
      {
        type: "building",
        id: "BagBeasts-beast-house",
        title: "Bag Beast House",
        summary: `House your beasts here`,
        content: [
          {
            id: "default",
            type: "inline",
            html: `
            ${getMainHtml()}
            `,
            buttons: [
              {
                text: "put",
                type: "action",
                action: put,
                disabled: playersBeasts.length == 0,
              },
              {
                text: "collect",
                type: "action",
                action: collect,
                disabled: !(
                  houseBeasts.length > 0 &&
                  houseBeasts[0].housedBy == selectedMobileUnit?.id
                ),
              },
            ],
          },
        ],
      },
    ],
  };
}
