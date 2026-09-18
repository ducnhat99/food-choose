import { useMutation } from '@tanstack/react-query'
import { recommendDish } from '../lib/api'

export function useRecommendDish() {
  return useMutation({
    mutationFn: recommendDish,
  })
}
