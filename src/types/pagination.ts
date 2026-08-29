// Forma exacta de LengthAwarePaginator::toArray() (Laravel) - la misma en
// cualquier endpoint paginado de nexolu-pos-api (products, discounts, etc).
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}
