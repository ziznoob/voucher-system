export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new AppError(400, msg);
export const notFound = (msg) => new AppError(404, msg);
export const conflict = (msg) => new AppError(409, msg);
export const unprocessable = (msg) => new AppError(422, msg);
