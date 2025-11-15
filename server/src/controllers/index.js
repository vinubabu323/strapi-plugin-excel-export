// src/plugins/excel-export/server/controllers/index.js
import excelExportController from './excel-export.js';

/**
 * Strapi v5 controller registry for the excel-export plugin.
 */
const controllers = {
  'excel-export': excelExportController,
};

export default controllers;