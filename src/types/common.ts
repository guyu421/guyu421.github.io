export type SportCategoryId = 'all' | 'renju';

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
  total?: number;
}

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}
