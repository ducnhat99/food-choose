import { useMutation } from '@tanstack/react-query'
import { expandInstructions } from '../lib/api'

export function useExpandInstructions() {
  return useMutation({
    mutationFn: expandInstructions,
  })
}
