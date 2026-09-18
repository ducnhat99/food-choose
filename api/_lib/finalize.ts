import type { RecipeDetail } from './mealdb.js'
import { translateIngredientName, translateMeasure } from './glossary.js'
import { searchDishImages } from './images.js'
import { translateToVietnamese } from './translate.js'

/**
 * Shared last step for any RecipeDetail, regardless of how it was fetched
 * (by id, or a random pick): attaches stock photos and translates everything
 * to Vietnamese when requested. Mutates and returns the same object.
 */
export async function finalizeRecipe(
  recipe: RecipeDetail,
  language?: 'en' | 'vi',
): Promise<RecipeDetail> {
  // Search for stock photos using the original English title, before any
  // translation below -- searching with a Vietnamese title against Commons'
  // English-biased index would return poor or no results.
  recipe.images = await searchDishImages(recipe.title)

  if (language === 'vi') {
    // Ingredient names/measures are a closed vocabulary (units, common
    // staples) with one correct Vietnamese term each -- the glossary handles
    // those directly and consistently; only what it doesn't recognize goes
    // through the AI translator.
    const glossaryNames = recipe.ingredients.map((ing) => translateIngredientName(ing.name))
    const glossaryMeasures = recipe.ingredients.map((ing) => translateMeasure(ing.measure))

    const aiTexts = [recipe.title, recipe.instructions, recipe.category, recipe.area]
    const nameIndices: number[] = []
    const measureIndices: number[] = []
    recipe.ingredients.forEach((ing, i) => {
      if (glossaryNames[i] === null) {
        nameIndices.push(i)
        aiTexts.push(ing.name)
      }
      if (glossaryMeasures[i] === null) {
        measureIndices.push(i)
        aiTexts.push(ing.measure)
      }
    })

    const translated = await translateToVietnamese(aiTexts)
    let cursor = 4

    recipe.title = translated[0] ?? recipe.title
    recipe.instructions = translated[1] ?? recipe.instructions
    recipe.category = translated[2] ?? recipe.category
    recipe.area = translated[3] ?? recipe.area

    const aiNames = new Map<number, string>()
    for (const i of nameIndices) aiNames.set(i, translated[cursor++] ?? recipe.ingredients[i].name)
    const aiMeasures = new Map<number, string>()
    for (const i of measureIndices) aiMeasures.set(i, translated[cursor++] ?? recipe.ingredients[i].measure)

    recipe.ingredients = recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: glossaryNames[i] ?? aiNames.get(i) ?? ing.name,
      measure: glossaryMeasures[i] ?? aiMeasures.get(i) ?? ing.measure,
    }))
  }

  return recipe
}
