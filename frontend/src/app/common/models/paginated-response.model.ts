export interface PaginatedResponse<T> {
  count: number;
  data: T[];
  nextPageCursor?: string;
}
