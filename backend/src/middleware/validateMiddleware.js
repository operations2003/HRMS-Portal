import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware higher-order function to run validation rules
 * @param {Function} validatorFn - Function receiving req.body and returning an array of error messages or strings
 */
export const validate = (validatorFn) => {
  return (req, res, next) => {
    const errors = validatorFn(req.body, req);
    if (errors && errors.length > 0) {
      return sendError(res, 'Validation failed. Please check your inputs.', 400, errors);
    }
    next();
  };
};
