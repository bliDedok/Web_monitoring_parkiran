export const SLOT_POS = {
  A1: { left: 6.618, top: 27.129, width: 12.3,   height: 6.818 },
  A2: { left: 6.751, top: 36.554, width: 12.166, height: 6.618 },
  A3: { left: 6.685, top: 46.28,  width: 12.166, height: 6.718 },

  B1: { left: 33.69, top: 21.915, width: 6.417,  height: 14.038 },
  B2: { left: 46.056, top: 22.015, width: 7.152, height: 13.837 },
  B3: { left: 58.757, top: 21.915, width: 6.685, height: 13.937 },

  C1: { left: 33.556, top: 63.175, width: 6.551, height: 19.251 },
  C2: { left: 46.524, top: 63.075, width: 6.35,  height: 19.251 },
  C3: { left: 58.824, top: 63.175, width: 6.551, height: 19.151 },

  D1: { left: 80.482, top: 27.179, width: 12.701, height: 6.517 },
  D2: { left: 80.549, top: 36.404, width: 12.567, height: 6.618 },
  D3: { left: 80.549, top: 46.18,  width: 12.5,   height: 6.818 },
};

/**
 * "h" = horizontal (A & D) -> tampil ID saja
 * "v" = vertical (B & C)   -> tampil ID + status
 */
export const SLOT_ORI = {
  A1: "h", A2: "h", A3: "h",
  D1: "h", D2: "h", D3: "h",
  B1: "v", B2: "v", B3: "v",
  C1: "v", C2: "v", C3: "v",
};
