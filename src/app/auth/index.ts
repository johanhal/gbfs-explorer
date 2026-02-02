/*
 * This file provides dummy implementation of app/auth when no auth extension is installed.
 */

const validateConfig = () => {
  console.log("No auth extension enabled");
};

export const auth = {
  validateConfig,
  // Placeholder to not break existing code
  getAuthHeaderValue: async () => "",
};
