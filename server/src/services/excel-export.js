// src/plugins/excel-export/server/services/my-service.js
'use strict';

/**
 * @module ExcelExportService
 * @description Business helpers for the Excel Export plugin.
 *
 * @param {{ strapi: import('@strapi/strapi').Strapi }} param0 - Strapi context.
 * @returns {{ getWelcomeMessage: () => string }}
 */
const excelExportService = ({ strapi }) => ({
  /**
   * Returns a simple diagnostic message.
   *
   * @returns {string} A small confirmation string.
   */
  getWelcomeMessage() {
    // You can extend this later with more advanced helpers.
    return 'Excel Export plugin is ready 🚀';
  },
});

export default excelExportService;