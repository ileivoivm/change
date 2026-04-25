// Six-city config for M9 六都擴張.
// Each entry describes a directly-controlled municipality and its data sources.
//
// camera.position / camera.target: initial Three.js world coordinates.
//   ntpc values are calibrated; others are placeholders until Stage 3 renders them.
// worldSize: longer axis of the city GeoJSON in world units (passed to makeProjector).
// hud.mainLabel: short name shown in the voxel-count HUD (e.g. "新北 1234 方塊").
// hud.contextLabel: adjacent grey context layer name, or null if none.

export const CITY_CONFIGS = {
  ntpc: {
    key: 'ntpc',
    nameZh: '新北市',
    years: [1997, 2001, 2005, 2010, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 36,
    camera: {
      position: [-13.19, 98.58, 30.58],
      target:   [-12.71, -8.73, 12.83],
    },
    hud: { mainLabel: '新北', contextLabel: '台北' },
    // GeoJSON county names in twVillage.topo.json (pre-upgrade names)
    geoCountyNames: ['台北縣'],
  },

  tpe: {
    key: 'tpe',
    nameZh: '台北市',
    years: [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 28,
    camera: {
      position: [0, 80, 20],
      target:   [0, 0, 0],
    },
    hud: { mainLabel: '台北', contextLabel: '新北' },
    geoCountyNames: ['台北市'],
  },

  tyc: {
    key: 'tyc',
    nameZh: '桃園市',
    years: [1997, 2001, 2005, 2009, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 32,
    camera: {
      position: [0, 85, 22],
      target:   [0, 0, 0],
    },
    hud: { mainLabel: '桃園', contextLabel: null },
    geoCountyNames: ['桃園縣'],
  },

  txg: {
    key: 'txg',
    nameZh: '台中市',
    years: [2010, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 42,
    camera: {
      position: [0, 100, 26],
      target:   [0, 0, 0],
    },
    hud: { mainLabel: '台中', contextLabel: null },
    geoCountyNames: ['台中市', '台中縣'],
  },

  tnn: {
    key: 'tnn',
    nameZh: '台南市',
    years: [2010, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 44,
    camera: {
      position: [0, 105, 26],
      target:   [0, 0, 0],
    },
    hud: { mainLabel: '台南', contextLabel: null },
    geoCountyNames: ['台南市', '台南縣'],
  },

  khh: {
    key: 'khh',
    nameZh: '高雄市',
    years: [2010, 2014, 2018, 2022],
    defaultYear: 2022,
    worldSize: 48,
    camera: {
      position: [0, 110, 28],
      target:   [0, 0, 0],
    },
    hud: { mainLabel: '高雄', contextLabel: null },
    geoCountyNames: ['高雄市', '高雄縣'],
  },
};
