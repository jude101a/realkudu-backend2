/**
 * Standard application error carrying an HTTP status code alongside
 * the message, so controllers can throw semantically and a central
 * error-handling middleware can respond correctly without guessing.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {Object} [details] - optional structured info (e.g. field errors)
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;