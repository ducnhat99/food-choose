// TheMealDB's list.php?a=list returns every UN country, but only these
// actually have recipes attached (verified live against the API) -- using
// the full country list would make most dropdown options return nothing.
export const CUISINES = [
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

// TheMealDB's real, fixed category list (list.php?c=list). Doubles as the
// closest available filter axis to a "meal type" or "diet" (Vegan/
// Vegetarian exist here as ordinary categories, not a separate diet field).
export const CATEGORIES = [
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
