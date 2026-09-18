/**
 * Units and common ingredient names have exactly one correct Vietnamese
 * term each -- this isn't ambiguous enough to need an AI translator, and
 * asking one anyway is what produced inconsistent/wrong results for these
 * words. A lookup table gives a fixed, correct answer every time; anything
 * not covered here still falls through to translateToVietnamese.
 */

const UNIT_TRANSLATIONS: Record<string, string> = {
  gram: 'gram',
  g: 'gram',
  kilogram: 'kilogam',
  kg: 'kilogam',
  liter: 'lít',
  litre: 'lít',
  l: 'lít',
  milliliter: 'mililít',
  millilitre: 'mililít',
  ml: 'mililít',
  cup: 'chén',
  tablespoon: 'muỗng canh',
  tbsp: 'muỗng canh',
  teaspoon: 'muỗng cà phê',
  tsp: 'muỗng cà phê',
  pinch: 'nhúm',
  clove: 'tép',
  slice: 'lát',
  piece: 'miếng',
  can: 'lon',
  package: 'gói',
  pkg: 'gói',
  stick: 'thanh',
  dash: 'chút',
}

const INGREDIENT_TRANSLATIONS: Record<string, string> = {
  chicken: 'gà',
  'chicken breast': 'ức gà',
  'chicken thigh': 'đùi gà',
  beef: 'thịt bò',
  pork: 'thịt heo',
  fish: 'cá',
  shrimp: 'tôm',
  egg: 'trứng',
  eggs: 'trứng',
  garlic: 'tỏi',
  onion: 'hành tây',
  ginger: 'gừng',
  salt: 'muối',
  sugar: 'đường',
  pepper: 'tiêu',
  'black pepper': 'tiêu đen',
  flour: 'bột mì',
  rice: 'gạo',
  'rice flour': 'bột gạo',
  water: 'nước',
  oil: 'dầu ăn',
  'olive oil': 'dầu ô liu',
  'vegetable oil': 'dầu thực vật',
  butter: 'bơ',
  milk: 'sữa',
  cream: 'kem tươi',
  cheese: 'phô mai',
  'soy sauce': 'nước tương',
  'fish sauce': 'nước mắm',
  vinegar: 'giấm',
  lemon: 'chanh vàng',
  lime: 'chanh',
  tomato: 'cà chua',
  carrot: 'cà rốt',
  potato: 'khoai tây',
  cabbage: 'bắp cải',
  lettuce: 'xà lách',
  cucumber: 'dưa chuột',
  chili: 'ớt',
  chilli: 'ớt',
  'chili pepper': 'ớt',
  coriander: 'rau mùi',
  cilantro: 'rau mùi',
  basil: 'húng quế',
  mint: 'bạc hà',
  lemongrass: 'sả',
  cornstarch: 'bột bắp',
  'baking powder': 'bột nở',
  'baking soda': 'muối nở',
  yeast: 'men nở',
  honey: 'mật ong',
  noodles: 'mì',
  bread: 'bánh mì',
  tofu: 'đậu hũ',
}

/** Exact-match lookup for an ingredient name; null means "not in the glossary, ask the AI translator". */
export function translateIngredientName(name: string): string | null {
  return INGREDIENT_TRANSLATIONS[name.trim().toLowerCase()] ?? null
}

/**
 * Splits a measure like "2 cups" or "250 g" into its numeric amount and unit
 * word, translates just the unit via the glossary, and reassembles it --
 * keeps the number untouched instead of requiring the whole string to match.
 * Returns null (fall through to AI) for anything that doesn't fit this shape
 * (e.g. "1 (10 oz) can", or a unit not in the table).
 */
export function translateMeasure(measure: string): string | null {
  const trimmed = measure.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^([\d.,/\s]+)\s*([a-zA-Z]+)\.?$/)
  if (!match) return null

  const [, amount, unitRaw] = match
  const unit = unitRaw.toLowerCase()
  const translatedUnit = UNIT_TRANSLATIONS[unit] ?? UNIT_TRANSLATIONS[unit.replace(/s$/, '')]
  if (!translatedUnit) return null

  return `${amount.trim()} ${translatedUnit}`
}
