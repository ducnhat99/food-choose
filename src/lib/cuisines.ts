// TheMealDB's list.php?a=list returns every UN country, but only these
// actually have recipes attached (verified live against the API) -- using
// the full country list would make most dropdown options return nothing.
const MEALDB_CUISINES = [
  'British',
  'Spanish',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Polish',
  'Jamaican',
  'Chinese',
  'Canadian',
  'Italian',
  'Australian',
  'Saudi Arabian',
  'Algerian',
  'Uruguayan',
  'Japanese',
  'Tunisian',
  'Portuguese',
  'Malaysian',
  'Irish',
  'Greek',
  'Filipino',
  'Egyptian',
  'Croatian',
  'Ukrainian',
  'Russian',
  'Syrian',
  'Moroccan',
  'Mexican',
  'Kenyan',
] as const

// Spoonacular's own supported cuisine vocabulary (verified live against
// spoonacular.com/food-api/docs), minus the ones already covered above by
// name (British/Chinese/Greek/Irish/Italian/Japanese/Mexican/Spanish/Thai/
// Vietnamese exist in both). Spoonacular's list skews regional/style rather
// than per-country, which is complementary to TheMealDB's country list
// rather than redundant with it -- see api/_lib/spoonacular.ts's
// SPOONACULAR_CUISINES for why an unrecognized value here must never be sent
// to Spoonacular (it returns an empty result instead of an error, which
// would otherwise silently break the mealdb fallback for these).
const SPOONACULAR_ONLY_CUISINES = [
  'African',
  'American',
  'Asian',
  'Cajun',
  'Caribbean',
  'Eastern European',
  'European',
  'French',
  'German',
  'Indian',
  'Jewish',
  'Korean',
  'Latin American',
  'Mediterranean',
  'Middle Eastern',
  'Nordic',
  'Southern',
] as const

export const CUISINES = [...MEALDB_CUISINES, ...SPOONACULAR_ONLY_CUISINES] as const

// TheMealDB's real, fixed category list (list.php?c=list). Doubles as the
// closest available filter axis to a "meal type" or "diet" (Vegan/
// Vegetarian exist here as ordinary categories, not a separate diet field).
const MEALDB_CATEGORIES = [
  'Beef',
  'Breakfast',
  'Chicken',
  'Dessert',
  'Goat',
  'Lamb',
  'Miscellaneous',
  'Pasta',
  'Pork',
  'Seafood',
  'Side',
  'Starter',
  'Vegan',
  'Vegetarian',
] as const

// TheMealDB's Meal database has zero drink recipes of any kind (verified
// live: filter.php?c=Drink/Beverage/Cocktail all return 0 meals -- drinks
// are a completely separate database, TheCocktailDB, not used here).
// Spoonacular does support beverages natively via its `type` parameter
// (confirmed live against their docs and a real complexSearch call: both
// "beverage" and "drink" return the same 204 real results), so this
// category -- like the Spoonacular-only cuisines above -- routes
// exclusively through Spoonacular; api/recommend-dish.ts's
// mapCategoryToSpoonacular must map it to `{ type: 'beverage' }` explicitly
// rather than falling into the generic ingredient-hint fallback.
const SPOONACULAR_ONLY_CATEGORIES = ['Beverage'] as const

export const CATEGORIES = [...MEALDB_CATEGORIES, ...SPOONACULAR_ONLY_CATEGORIES] as const

// These values are TheMealDB API parameters and must stay in English when
// submitted -- these maps only translate the label shown in a <select>.
export const CUISINE_LABELS_VI: Record<(typeof CUISINES)[number], string> = {
  British: 'Anh',
  Spanish: 'Tây Ban Nha',
  Turkish: 'Thổ Nhĩ Kỳ',
  Vietnamese: 'Việt Nam',
  Thai: 'Thái Lan',
  Polish: 'Ba Lan',
  Jamaican: 'Jamaica',
  Chinese: 'Trung Quốc',
  Canadian: 'Canada',
  Italian: 'Ý',
  Australian: 'Úc',
  'Saudi Arabian': 'Ả Rập Xê Út',
  Algerian: 'Algeria',
  Uruguayan: 'Uruguay',
  Japanese: 'Nhật Bản',
  Tunisian: 'Tunisia',
  Portuguese: 'Bồ Đào Nha',
  Malaysian: 'Malaysia',
  Irish: 'Ireland',
  Greek: 'Hy Lạp',
  Filipino: 'Philippines',
  Egyptian: 'Ai Cập',
  Croatian: 'Croatia',
  Ukrainian: 'Ukraine',
  Russian: 'Nga',
  Syrian: 'Syria',
  Moroccan: 'Morocco',
  Mexican: 'Mexico',
  Kenyan: 'Kenya',
  African: 'Châu Phi',
  American: 'Mỹ',
  Asian: 'Châu Á',
  Cajun: 'Cajun',
  Caribbean: 'Caribe',
  'Eastern European': 'Đông Âu',
  European: 'Châu Âu',
  French: 'Pháp',
  German: 'Đức',
  Indian: 'Ấn Độ',
  Jewish: 'Do Thái',
  Korean: 'Hàn Quốc',
  'Latin American': 'Mỹ Latinh',
  Mediterranean: 'Địa Trung Hải',
  'Middle Eastern': 'Trung Đông',
  Nordic: 'Bắc Âu',
  Southern: 'Miền Nam (Mỹ)',
}

export const CATEGORY_LABELS_VI: Record<(typeof CATEGORIES)[number], string> = {
  Beef: 'Thịt bò',
  Breakfast: 'Bữa sáng',
  Chicken: 'Thịt gà',
  Dessert: 'Tráng miệng',
  Goat: 'Thịt dê',
  Lamb: 'Thịt cừu',
  Miscellaneous: 'Khác',
  Pasta: 'Mì Ý',
  Pork: 'Thịt heo',
  Seafood: 'Hải sản',
  Side: 'Món phụ',
  Starter: 'Khai vị',
  Vegan: 'Thuần chay',
  Vegetarian: 'Ăn chay',
  Beverage: 'Đồ uống',
}

/**
 * Finds the first value in `savedValues` (free text a user typed into
 * Preferences) that case-insensitively matches one of `options` (a fixed
 * dropdown list like CUISINES or CATEGORIES). Used to pre-fill a dropdown
 * from saved preferences without requiring an exact-case match -- returns
 * '' (the "Any" option) if nothing matches.
 */
export function findMatchingOption(
  savedValues: string[] | undefined,
  options: readonly string[],
): string {
  if (!savedValues?.length) return ''
  const byLowerCase = new Map(options.map((o) => [o.toLowerCase(), o]))
  for (const value of savedValues) {
    const match = byLowerCase.get(value.trim().toLowerCase())
    if (match) return match
  }
  return ''
}
