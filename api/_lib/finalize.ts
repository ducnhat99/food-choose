import type { RecipeDetail } from './mealdb.js'
import { translateIngredientName, translateMeasure } from './glossary.js'
import { searchDishImages } from './images.js'
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
      // The dish's actual Vietnamese name (e.g. "Bún chả") is a much
      // stronger search signal than a literal translation of the recipe's
      // English title, which for a compound traditional dish can translate
      // word-for-word into a phrase no Vietnamese video would actually be
      // titled with (confirmed live: "Vietnamese Grilled Pork with
      // Vermicelli Noodles" -> "Thịt Nướng Việt Nam với Bún" instead of
      // "Bún chả"/"Bún thịt nướng"). Falls back to a plain translation, and
      // then to the English title itself, if dish-name resolution fails.
      const dishName = await resolveVietnameseDishName(
        recipe.title,
        recipe.ingredients.map((ing) => ing.name),
      )
      if (dishName) {
        videoQuery = dishName
        videoQueryLanguage = 'vi'
      } else {
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

    // When the measure IS a recognized real unit (cup, gram, ...), the name
    // (if not a glossary hit either) is translated independently -- this
    // works fine because a countable unit reads naturally before the noun
    // in Vietnamese too, same as English ("3 chén" + "gạo nâu"). But when
    // the measure ISN'T a recognized unit, it's usually a bare size
    // descriptor instead ("1 small", "2 large") with no unit word at all.
    // Translating that in isolation ("small" -> "nhỏ") and gluing it in
    // front of an independently-translated name produces backwards
    // Vietnamese grammar -- confirmed live: "1 small" + "chili pepper"
    // came out as "1 nhỏ Ớt trái" (adjective placed before the noun
    // instead of after, which is meaningless word order to a reader).
    // For that case, translate the whole "measure name" phrase together via
    // translateIngredientPhrases instead -- a prompt specifically told to
    // produce natural noun-first Vietnamese ingredient phrasing, since even
    // combining measure+name into one generic translateToVietnamese call
    // preserved English word-order literally in practice (confirmed live:
    // "For serving lettuce" -> "Để phục vụ xà lách", annotation before the
    // noun -- valid Vietnamese words, backwards ingredient-list order).
    // Store the result as a single combined string rather than trying to
    // split it back into separate measure/name fields.
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
        translateToVietnamese(namesToTranslate),
        translateIngredientPhrases(combinedTexts),
      ])

    recipe.title = translatedFields[0] ?? recipe.title
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
