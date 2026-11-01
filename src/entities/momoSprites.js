/**
 * @file momoSprites.js
 * @description Authentic Google Doodle Halloween 2016 Momo the Cat animation frames.
 * Extracted directly from Google Doodle level1-png-sprite.png, level1-png1-sprite.png, and main-png-sprite.png.
 */

function makeAnim(frames, offsetX = 0, offsetY = 0) {
  const arr = [...frames];
  arr.offsetX = offsetX;
  arr.offsetY = offsetY;
  return arr;
}

export const MOMO_SPRITES = {
  "idle": makeAnim([
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 78,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 0,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 90,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 180,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 270,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 270,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 270,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 180,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 90,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 0,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 78,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 360,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 450,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 540,
    "y": 156,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 630,
    "y": 156,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 0,
    "y": 186,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 0,
    "y": 186,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 0,
    "y": 186,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 630,
    "y": 156,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 540,
    "y": 156,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 450,
    "y": 108,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 90,
    "y": 186,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  },
  {
    "sheet": "level1-png1-sprite.png",
    "x": 590,
    "y": 0,
    "w": 87,
    "h": 75
  }
], 0, 0),
  "ready": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 2894,
    "y": 504,
    "w": 113,
    "h": 79
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3010,
    "y": 504,
    "w": 113,
    "h": 79
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3126,
    "y": 504,
    "w": 113,
    "h": 79
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3242,
    "y": 504,
    "w": 113,
    "h": 79
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3358,
    "y": 504,
    "w": 113,
    "h": 79
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3474,
    "y": 504,
    "w": 113,
    "h": 79
  }
], 10, -3),
  "attack_vertical": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 2518,
    "y": 431,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2518,
    "y": 431,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 0,
    "y": 437,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 130,
    "y": 437,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 260,
    "y": 437,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 390,
    "y": 443,
    "w": 127,
    "h": 120
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 520,
    "y": 443,
    "w": 127,
    "h": 120
  }
], 12, -21),
  "attack_up": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 447,
    "y": 312,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 447,
    "y": 312,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 594,
    "y": 312,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 741,
    "y": 312,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 888,
    "y": 312,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1957,
    "y": 350,
    "w": 144,
    "h": 128
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2802,
    "y": 369,
    "w": 144,
    "h": 128
  }
], 0, -26.5),
  "attack_horizontal": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 1500,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1500,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1654,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2249,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2403,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2557,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2557,
    "y": 161,
    "w": 151,
    "h": 116
  }
], 0, -19),
  "attack_down": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 650,
    "y": 443,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 650,
    "y": 443,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 773,
    "y": 443,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 896,
    "y": 443,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2648,
    "y": 447,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1875,
    "y": 481,
    "w": 120,
    "h": 130
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2771,
    "y": 500,
    "w": 120,
    "h": 130
  }
], 0, -27),
  "attack_heart": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 2711,
    "y": 161,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2711,
    "y": 161,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 522,
    "y": 177,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 675,
    "y": 177,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 828,
    "y": 177,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 981,
    "y": 177,
    "w": 150,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 981,
    "y": 177,
    "w": 150,
    "h": 132
  }
], 6, -22),
  "attack_lightning": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 2949,
    "y": 369,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2949,
    "y": 369,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3091,
    "y": 369,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3233,
    "y": 369,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 3375,
    "y": 369,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1733,
    "y": 387,
    "w": 139,
    "h": 132
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1283,
    "y": 403,
    "w": 139,
    "h": 132
  }
], 0, -28),
  "hurt": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 2518,
    "y": 554,
    "w": 107,
    "h": 106
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1019,
    "y": 556,
    "w": 107,
    "h": 106
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 0,
    "y": 560,
    "w": 107,
    "h": 106
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 110,
    "y": 560,
    "w": 107,
    "h": 106
  }
], 0, -31),
  "victory": makeAnim([
  {
    "x": 875,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 1000,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 1125,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 1250,
    "y": 711,
    "w": 122,
    "h": 134
  },
  {
    "x": 500,
    "y": 713,
    "w": 122,
    "h": 134
  },
  {
    "x": 500,
    "y": 713,
    "w": 122,
    "h": 134
  },
  {
    "x": 500,
    "y": 713,
    "w": 122,
    "h": 134
  },
  {
    "x": 625,
    "y": 733,
    "w": 122,
    "h": 134
  },
  {
    "x": 625,
    "y": 733,
    "w": 122,
    "h": 134
  },
  {
    "x": 625,
    "y": 733,
    "w": 122,
    "h": 134
  },
  {
    "x": 625,
    "y": 733,
    "w": 122,
    "h": 134
  },
  {
    "x": 750,
    "y": 744,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 746,
    "w": 122,
    "h": 134
  },
  {
    "x": 0,
    "y": 841,
    "w": 122,
    "h": 134
  },
  {
    "x": 125,
    "y": 841,
    "w": 122,
    "h": 134
  },
  {
    "x": 250,
    "y": 841,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 0,
    "y": 841,
    "w": 122,
    "h": 134
  },
  {
    "x": 1000,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 1000,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 1000,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 1000,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 1125,
    "y": 848,
    "w": 122,
    "h": 134
  }
], 0, -12),
  "down": makeAnim([
  {
    "x": 1250,
    "y": 848,
    "w": 122,
    "h": 134
  },
  {
    "x": 500,
    "y": 850,
    "w": 122,
    "h": 134
  },
  {
    "x": 625,
    "y": 870,
    "w": 122,
    "h": 134
  },
  {
    "x": 750,
    "y": 881,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 375,
    "y": 883,
    "w": 122,
    "h": 134
  },
  {
    "x": 0,
    "y": 978,
    "w": 122,
    "h": 134
  },
  {
    "x": 125,
    "y": 978,
    "w": 122,
    "h": 134
  },
  {
    "x": 250,
    "y": 978,
    "w": 122,
    "h": 134
  },
  {
    "x": 875,
    "y": 985,
    "w": 122,
    "h": 134
  }
], 0, -12),
  "cast": makeAnim([
  {
    "sheet": "level1-png-sprite.png",
    "x": 1500,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1500,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 1654,
    "y": 143,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2249,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2403,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2557,
    "y": 161,
    "w": 151,
    "h": 116
  },
  {
    "sheet": "level1-png-sprite.png",
    "x": 2557,
    "y": 161,
    "w": 151,
    "h": 116
  }
], 0, -19)
};
