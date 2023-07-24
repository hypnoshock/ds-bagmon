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

  const feed = () => {
    if (houseBeasts.length == 0) return;

    const beastDestSlot = 2; // TODO: Make selectable

    ds.dispatch({
      name: "BUILDING_USE",
      args: [
        selectedBuilding.id,
        selectedMobileUnit.id,
        ds.encodeCall("function FEED(bytes24 bagBeast)", [houseBeasts[0].bag]),
      ],
    });
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
    let html = "";
    if (!hq) {
      html += `<p>Oh no the Bag Beast HQ has been destroyed. It must be rebuilt for us to keep record of who has which beasts!</p>`;
    } else {
      // html += `<p>Housed beasts: ${houseBeasts.length}</p>`;
      if (houseBeasts.length > 0) {
        html += `
        <p>Beast number: ${houseBeasts[0].beastNum}</p>
        <p>Color: ${houseBeasts[0].beastColor}</p>
        <p>Beast is ${aliveMins} minutes old</p>
        <p>Beast was last fed ${lastFedMins} minutes ago</p>
        ${getBeastGfx(houseBeasts[0], aliveMins, lastFedMins)}
        `;
      }
    }
    return html;
  };

  const aliveMins =
    houseBeasts.length > 0 ? getAliveMinutes(houseBeasts[0], world.block) : 0;
  const lastFedMins =
    houseBeasts.length > 0 ? getLastFedMinutes(houseBeasts[0], world.block) : 0;

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
            ${getMainHtml() + pluginStyleOverride}
            `,
            buttons: [
              {
                text: "feed",
                type: "action",
                action: feed,
                disabled: houseBeasts.length == 0 || lastFedMins < HUNGER_MINS,
              },
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
const pluginStyleOverride = `
<style>
  .building-image {
    display: none !important;
  }
</style>
`;

const getBeastBtns = (bagBeast, aliveMins, lastFedMins) => {
  let buttonHtml = "";
  if (lastFedMins > 10) {
    `<button`;
  }

  return buttonHtml;
};

const getBeastStyleOverride = (bagBeast) => {
  const mainColor = BigInt(bagBeast.beastColor);
  const r = Number((mainColor >> 16n) & 255n);
  const g = Number((mainColor >> 8n) & 255n);
  const b = Number(mainColor & 255n);

  // const darkHSV = rgb2hsl(Number(r), Number(g), Number(b));
  // darkHSV[2] *= 0.2;
  // const darkRGB = hsl2rgb(darkHSV[0], darkHSV[1], darkHSV[2]);

  const color1 = `#000000`;
  const color2 = bagBeast.beastColor.replace("0x", "#");
  const color3 = `#a0a0a0`;

  return `
    <style>
      .cls-1{fill:${color1} !important;}
      .cls-2{fill:${color3} !important;}
      .cls-2,.cls-3,.cls-4 {
        stroke:${color1} !important;
      }
      .cls-3{
        fill:${color2} !important;
      }
    </style>`;
};

const getBeastGfx = (bagBeast, aliveMins, lastFedMins) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132.74 129.97" class="${getHappiness(
    lastFedMins
  )} ${getIsEating(lastFedMins)}">
  <defs>
    <style>
      #openEyes,
      #closedEyes,
      #sadEyes,
      #happyMouth,
      #sadMouth,
      #closedMouth,
      #eatMouth {
        display: none;
      }

      <!-- HAPPY STATE -->
      .happy #closedEyes,
      .happy #openEyes,
      .happy #closedMouth,
      .happy #happyMouth {
        display: inherit;
      }

      .happy #closedEyes {
        animation: blink-inv 3s linear 0s infinite normal none;
      }

      .happy #openEyes {
        animation: blink 3s linear 0s infinite normal none;
      }

      .happy #closedMouth {
        animation: blink-inv 9s linear 0s infinite normal none;
      }

      .happy #happyMouth {
        animation: blink 9s linear 0s infinite normal none;
      }

      .happy #eyeLayer, .happy #mouthLayer {
        animation: happy-eyes-look 10s linear 0s infinite normal none;
      }

      <!-- SAD STATE -->
      .sad #closedEyes,
      .sad #sadEyes,
      .sad #closedMouth,
      .sad #sadMouth {
        display: inherit;
      }

      .sad #closedEyes {
        transform: translateY(5px);
        animation: blink-inv 6s linear 0s infinite normal none;
      }

      .sad #sadEyes {
        animation: blink 6s linear 0s infinite normal none;
      }

      .sad #closedMouth,
      .sad #sadMouth {
        transform: scale(70%) translateY(5px);
        transform-origin: center;
      }

      .sad #eyeLayer,
      .sad #mouthLayer {
        transform: translateY(15px);
      }

      .sad #closedMouth {
        animation: blink-inv 9s linear 0s infinite normal none;
      }

      .sad #sadMouth {
        animation: blink 9s linear 0s infinite normal none;
      }

      <!-- EATING -->

      .isEating #closedMouth,
      .isEating #happyMouth,
      .isEating #sadMouth{
        display: none !important;
      }

      .isEating #eatMouth {
        display: inherit;
        transform-origin: 50% 68%;
        animation: eating 0.7s linear 0s infinite normal none;
      }

      @keyframes eating {
        0% {
          transform: scale(1,1);
        }
        50% {
          transform: scale(0.8,0.1);
        }
        100% {
          transform: scale(1,1);
        }
      }

      @keyframes blink {
        0% {
          opacity:1;
        }
        39% {
          opacity:1;
        }
        40% {
          opacity:0;
        }
        44% {
          opacity:0;
        }
        45% {
          opacity:1;
        }
        100% {
          opacity:1;
        }
      }

      @keyframes blink-inv {
          
        0% {
          opacity:0;
        }
        39% {
          opacity:0;
        }
        40% {
          opacity:1;
        }
        44% {
          opacity:1;
        }
        45% {
          opacity:0;
        }
        100% {
          opacity:0;
        }
      }

      @keyframes happy-eyes-look {
          
        0% {
          transform:translateX(0px);
        }
        8% {
          transform:translateX(0px);
        }
        9% {
          transform:translateX(10px);
        }
        23% {
          transform:translateX(10px);
        }
        24% {
          transform:translateX(-10px);
        }
        36% {
          transform:translateX(-10px);
        }
        37% {
          transform:translateX(0px);
        }
        61% {
          transform:translateX(0px);
        }
        62% {
          transform:translate(-10px, -5px);
        }
        77% {
          transform:translate(-10px, -5px);
        }
        78% {
          transform:translate(0px, 0px);
        }
      }
    </style>
    <style>
      .cls-1 {
        fill: #006838;
      }

      .cls-2 {
        fill: #8dc63f;
      }

      .cls-2, .cls-3, .cls-4 {
        stroke: #006838;
        stroke-miterlimit: 10;
      }

      .cls-3 {
        fill: #39b54a;
      }

      .cls-4 {
        fill: none;
      }
    </style>
    ${getBeastStyleOverride(bagBeast)}
  </defs>
  <g id="handle">
    <path class="cls-3" d="m67.06.5C45.44.5,27.91,12.61,27.91,27.55c0,7.09,3.95,13.53,10.4,18.36-2.37-16.95,7.21-35.87,28.75-36.79,16.16,0,29.26,14.2,29.26,31.72,0,1.69-.12,3.34-.36,4.96,6.36-4.81,10.24-11.21,10.24-18.24C106.21,12.61,88.68.5,67.06.5Z"/>
  </g>
  <g id="background">
  <path id="body" class="cls-3" d="m132.24,80.77c0,22.15,0,34.22-6.2,40.8-7.42,7.89-22.54,7.46-51.51,7.89-3.32.05-5.69.03-8.16,0-34.48-.34-52.23.01-59.67-7.89C.5,114.99.5,102.92.5,80.77c0-26.89,29.49-48.69,65.87-48.69s65.87,21.8,65.87,48.69Z"/>
    <ellipse id="face" class="cls-2" cx="66.37" cy="80.77" rx="49.13" ry="39.38"/>
  </g>
  <g id="mouthLayer">
    <path id="happyMouth" class="cls-4" d="m75.32,88.78c2.06,4.21-4.66,8.45-10.41,8.45s-11.5-4.23-10.41-8.45h20.82Z"/>
    <line id="closedMouth" class="cls-4" x1="54.36" y1="93.01" x2="75.7" y2="93.01"/>
    <path id="sadMouth" class="cls-4" d="m75.32,97.24c2.06-4.21-4.66-8.45-10.41-8.45s-11.5,4.23-10.41,8.45h20.82Z"/>
    <ellipse id="eatMouth" class="cls-4" cx="65.03" cy="93.01" rx="5.06" ry="2.55"/>
  </g>
  <g id="eyeLayer">
    <g id="openEyes">
      <g id="open_eye">
        <path class="cls-1" d="m47.42,72.9l4.29-4.29c-.72-3.75-2.37-6.38-4.29-6.38-2.59,0-4.68,4.77-4.68,10.67s2.1,10.67,4.68,10.67c1.92,0,3.56-2.62,4.29-6.38l-4.29-4.29Z"/>
      </g>
      <g id="open_eye-2" data-name="open_eye">
        <path class="cls-1" d="m83.23,72.9l4.29-4.29c-.72-3.75-2.37-6.38-4.29-6.38-2.59,0-4.68,4.77-4.68,10.67s2.1,10.67,4.68,10.67c1.92,0,3.56-2.62,4.29-6.38l-4.29-4.29Z"/>
      </g>
    </g>
    <g id="closedEyes">
      <line class="cls-4" x1="42.74" y1="73.2" x2="52.1" y2="73.2"/>
      <line class="cls-4" x1="78.6" y1="73.2" x2="87.96" y2="73.2"/>
    </g>
    <g id="sadEyes">
      <path class="cls-1" d="m49.52,78.53l2.56-1.72c0-.13.01-.26.01-.39,0-2.09-.59-3.97-1.53-5.28l-7.71,3.71c-.07.51-.12,1.03-.12,1.57,0,3.95,2.1,7.15,4.68,7.15,1.77,0,3.31-1.5,4.1-3.7l-2-1.34Z"/>
      <path class="cls-1" d="m79.86,71.14c-.94,1.31-1.53,3.19-1.53,5.28,0,.13,0,.26.01.39l2.56,1.72-2,1.34c.8,2.21,2.33,3.7,4.1,3.7,2.59,0,4.68-3.2,4.68-7.15,0-.54-.04-1.07-.12-1.57l-7.71-3.71Z"/>
    </g>
  </g>
</svg>`;
};
