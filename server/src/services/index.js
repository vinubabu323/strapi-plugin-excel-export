// src/plugins/excel-export/server/services/index.js
import excelExportService from './excel-export.js';

/**
 * Service registry for excel-export plugin.
 */
const services = {
  'excel-export': excelExportService,
};

export default services;