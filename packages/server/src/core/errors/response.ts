export interface SuccessResponse<T> {
  code: 0;
  data: T;
}

export interface ErrorResponse {
  code: number;
  error: string;
  details?: string[];
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T): SuccessResponse<T> {
  return { code: 0, data };
}

export function errorResponse(
  code: number,
  message: string,
  details?: string[]
): ErrorResponse {
  return { code, error: message, details };
}