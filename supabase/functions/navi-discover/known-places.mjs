// Approximate Fukuoka search centers, not store locations or GPS observations.
// Station centers: MapFan / NAVITIME station maps; Takatori: NII census polygon center.
// https://geoshape.ex.nii.ac.jp/ka/resource/40/40137009001.html
// Convention center: https://mapfan.com/spots/SCAQC%2CJ%2CF6Y4K0
const PLACES = Object.freeze({
  '西新': [33.5838, 130.3598],
  '藤崎': [33.5813, 130.3480],
  '高取': [33.5798, 130.3525],
  '天神': [33.5914, 130.3989],
  '博多': [33.5900, 130.4202],
  '中洲川端': [33.5948, 130.4064],
  '大濠公園': [33.5901, 130.3790],
  '六本松': [33.5778, 130.3773],
  '千代県庁口': [33.6024, 130.4141],
  '福岡国際会議場': [33.6044, 130.4035],
});
export function knownPlace(area, region = '') {
  // Do not force a same-named place in another city into Fukuoka.
  if (!['', '福岡', '福岡県', '福岡市', '福岡県福岡市'].includes(region.trim())) return null;
  const name = area.trim().replace(/駅$/, '');
  const point = Object.hasOwn(PLACES, name) ? PLACES[name] : null;
  return point ? {latitude:point[0], longitude:point[1], label:`福岡市・${name}周辺（エリア中心）`} : null;
}
