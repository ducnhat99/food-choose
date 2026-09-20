import type { RecipeDetail } from './mealdb.js'
import { translateIngredientName, translateMeasure } from './glossary.js'
import { searchDishImages } from './images.js'
import { simplifyDishNameForImageSearch } from './simplifyDishName.js'
import { translateIngredientPhrases, translateToVietnamese } from './translate.js'
import { resolveVietnameseDishName } from './vietnameseDishName.js'
import { extractYoutubeVideoId, searchYoutubeVideo } from './youtube.js'

/** Dedupes by video id (not raw URL string), since the same video can appear as a native link and a search result in different URL forms. */
function dedupeVideoUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls) {
    const id = extractYoutubeVideoId(url) ?? url
    if (seen.has(id)) continue
    seen.add(id)
    result.push(url)
  }
  return result
}

/**
 * Shared last step for any RecipeDetail, regardless of how it was fetched
 * (by id, or a random pick): attaches stock photos, finds a video guide, and
 * translates everything to Vietnamese when requested. Mutates and returns
 * the same object.
 */
export async function finalizeRecipe(
  recipe: RecipeDetail,
  language?: 'en' | 'vi',
): Promise<RecipeDetail> {
  // Search for stock photos using the original English title, before any
  // translation below -- searching with a Vietnamese title against Commons'
  // English-biased index would return poor or no results.
  recipe.images = await searchDishImages(recipe.title)

  // AI-generated recipes have a wholly invented title, which Commons' exact-
  // phrase search (see images.ts) essentially never matches verbatim --
  // confirmed live, 0 results for "Vietnamese Lemongrass Chicken Stir-Fry"
  // vs. 10 real, relevant photos for the simplified "lemongrass chicken".
  // Only spends the extra OpenAI call when the plain title search actually
  // came up empty, and only for AI recipes (provider recipes' titles are
  // real menu/recipe names already reasonably likely to match on their own).
  if (recipe.images.length === 0 && recipe.source === 'ai') {
    const simplified = await simplifyDishNameForImageSearch(recipe.title)
    if (simplified) recipe.images = await searchDishImages(simplified)
  }

  // For a Vietnamese-cuisine dish, always search YouTube for a genuinely
  // Vietnamese-language video -- per explicit request, shown ALONGSIDE any
  // native provider video rather than replacing it, since TheMealDB's own
  // strYoutube isn't guaranteed to actually be in Vietnamese (confirmed
  // live: recipe 53232, "Vietnamese chicken salad", links an
  // English-language RecipeTin Eats video despite the dish being Vietnamese
  // cuisine) and a native video plus a freshly-searched Vietnamese one are
  // often different, both-useful takes on the same dish. For every other
  // cuisine, keep the cheaper original single-video behavior of only
  // spending YouTube's limited search.list quota when there's no native
  // video at all (Spoonacular, which has none ever).
  const isVietnameseCuisine = recipe.area.toLowerCase() === 'vietnamese'
  const nativeVideoUrls = recipe.videoUrls

  // Resolved once (not separately for video search vs. the displayed
  // title below) -- the dish's actual Vietnamese name (e.g. "Bún chả") is
  // needed in both places, and computing it independently in each led to a
  // real bug: video search used this correctly, but the displayed title
  // still went through the generic translateToVietnamese call further
  // down, which translates word-for-word and produces exactly the
  // backwards-grammar problem this function exists to avoid (confirmed
  // live: "Vietnamese Lemongrass Chicken Stir-Fry" displayed as "Món Xào
  // Gà Sả Việt Nam" -- English word order preserved, not real Vietnamese
  // phrasing). Computed regardless of the page's display language, since
  // it's also needed for video search when browsing in English.
  let vietnameseDishName: string | null = null
  if (isVietnameseCuisine) {
    vietnameseDishName = await resolveVietnameseDishName(
      recipe.title,
      recipe.ingredients.map((ing) => ing.name),
    )
  }

  if (isVietnameseCuisine || nativeVideoUrls.length === 0) {
    // Search with a Vietnamese-language query regardless of the page's own
    // display language -- confirmed live that this reliably surfaces
    // videos from real Vietnamese channels (vs. English-language results
    // from Western channels, which is what a plain English title search
    // returns even for Vietnamese dishes). Checked against `recipe.area`
    // before it's overwritten by the display-language translation below,
    // so this works whether the page itself is being viewed in English or
    // Vietnamese.
    let videoQuery = recipe.title
    let videoQueryLanguage: 'en' | 'vi' | undefined
    if (isVietnameseCuisine) {
      if (vietnameseDishName) {
        videoQuery = vietnameseDishName
        videoQueryLanguage = 'vi'
      } else {
        // Falls back to a plain translation, and then to the English title
        // itself, if dish-name resolution fails.
        const [vietnameseTitle] = await translateToVietnamese([recipe.title])
        // translateToVietnamese falls back to returning the input unchanged
        // on failure -- only treat it as a real Vietnamese query if it
        // actually changed, otherwise fall through to the plain English
        // search rather than sending an English title with Vietnamese bias
        // params, which would just return worse results for no reason.
        if (vietnameseTitle && vietnameseTitle !== recipe.title) {
          videoQuery = vietnameseTitle
          videoQueryLanguage = 'vi'
        }
      }
    }
    const searchedVideoUrl = await searchYoutubeVideo(videoQuery, { language: videoQueryLanguage })

    if (isVietnameseCuisine) {
      // Show both, deduped in case the search happens to return the exact
      // same video TheMealDB already links -- see dedupeVideoUrls above.
      recipe.videoUrls = dedupeVideoUrls(
        searchedVideoUrl ? [...nativeVideoUrls, searchedVideoUrl] : nativeVideoUrls,
      )
    } else {
      // Non-Vietnamese: only reached here when there was no native video,
      // so a search result (if any) is simply the one and only video.
      recipe.videoUrls = searchedVideoUrl ? [searchedVideoUrl] : nativeVideoUrls
    }
  }

  if (language === 'vi') {
    // Ingredient names/measures are a closed vocabulary (units, common
    // staples) with one correct Vietnamese term each -- the glossary handles
    // those directly and consistently; only what it doesn't recognize goes
    // through the AI translator.
    const glossaryNames = recipe.ingredients.map((ing) => translateIngredientName(ing.name))
    const glossaryMeasures = recipe.ingredients.map((ing) => translateMeasure(ing.measure))

    // Both the independent-name path and the combined "measure name" path
    // (see below) go through translateIngredientPhrases rather than the
    // generic translateToVietnamese -- confirmed live that the generic
    // prompt, tuned for full sentences/titles, sometimes leaves uncommon
    // ingredient nouns as untranslated English loanwords ("seltzer water"
    // -> "nước seltzer", only "water" translated) or produces the wrong
    // word entirely ("strawberry puree" -> "syrup dâu tây"). It also
    // preserves English word order literally when a quantity/descriptor is
    // combined with a name ("For serving lettuce" -> "Để phục vụ xà lách",
    // annotation before the noun -- valid words, backwards ingredient-list
    // order). translateIngredientPhrases's dedicated prompt requires full
    // translation and noun-first Vietnamese phrasing for both cases.
    //
    // When the measure IS a recognized real unit (cup, gram, ...), the name
    // (if not a glossary hit either) is still translated independently from
    // the measure -- safe because a countable unit reads naturally before
    // the noun in Vietnamese too, same as English ("3 chén" + "gạo nâu").
    // But when the measure ISN'T a recognized unit, it's usually a bare
    // size descriptor instead ("1 small", "2 large") with no unit word at
    // all -- confirmed live that translating that in isolation and gluing
    // it in front of an independently-translated name produces backwards
    // Vietnamese grammar ("1 small" + "chili pepper" -> "1 nhỏ Ớt trái",
    // adjective before the noun). For that case, the whole "measure name"
    // phrase is translated together as one combined string instead, rather
    // than trying to split the result back into separate measure/name
    // fields.
    const nameIndices: number[] = []
    const namesToTranslate: string[] = []
    const combinedIndices: number[] = []
    const combinedTexts: string[] = []
    recipe.ingredients.forEach((ing, i) => {
      if (glossaryMeasures[i] !== null) {
        if (glossaryNames[i] === null) {
          nameIndices.push(i)
          namesToTranslate.push(ing.name)
        }
      } else {
        combinedIndices.push(i)
        combinedTexts.push(`${ing.measure} ${ing.name}`.trim())
      }
    })

    // `instructions` gets its own single-item call, separate from the other
    // three short fields. Observed live: bundled together, the model
    // sometimes splits the long, multi-paragraph instructions text into
    // several array entries instead of translating it as one string (e.g.
    // returning 12 items for a 4-item input) -- likely its internal line
    // breaks getting mistaken for separate array items to expand. A lone
    // 1-item array leaves it nothing to conflate that with.
    const [translatedFields, translatedInstructions, translatedNames, translatedCombined] =
      await Promise.all([
        translateToVietnamese([recipe.title, recipe.category, recipe.area]),
        translateToVietnamese([recipe.instructions]),
        translateIngredientPhrases(namesToTranslate),
        translateIngredientPhrases(combinedTexts),
      ])

    // Prefer the already-resolved real Vietnamese dish name over a fresh
    // word-for-word translation of the title, for a Vietnamese-cuisine dish
    // -- see vietnameseDishName above for why (this is the fix for the
    // "Món Xào Gà Sả Việt Nam" bug).
    recipe.title = vietnameseDishName ?? translatedFields[0] ?? recipe.title
    recipe.category = translatedFields[1] ?? recipe.category
    recipe.area = translatedFields[2] ?? recipe.area
    recipe.instructions = translatedInstructions[0] ?? recipe.instructions

    const aiNames = new Map<number, string>()
    nameIndices.forEach((i, idx) => aiNames.set(i, translatedNames[idx] ?? recipe.ingredients[i].name))
    const aiCombined = new Map<number, string>()
    combinedIndices.forEach((i, idx) => {
      aiCombined.set(i, translatedCombined[idx] ?? `${recipe.ingredients[i].measure} ${recipe.ingredients[i].name}`.trim())
    })

    recipe.ingredients = recipe.ingredients.map((ing, i) => {
      if (glossaryMeasures[i] !== null) {
        return { ...ing, measure: glossaryMeasures[i], name: glossaryNames[i] ?? aiNames.get(i) ?? ing.name }
      }
      return { ...ing, measure: '', name: aiCombined.get(i) ?? ing.name }
    })
  }

  return recipe
}
