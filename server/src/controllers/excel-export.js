'use strict';

import ExcelJS from 'exceljs';

/**
 * @typedef {Object} ExcelCollectionConfig
 * @property {string[]} columns
 * @property {Record<string, { column: string[] }>} relation
 * @property {boolean | string} [locale] - If truthy, apply locale filter (default "en").
 */

/**
 * @typedef {Object.<string, ExcelCollectionConfig>} ExcelConfigMap
 */

/**
 * Resolve the Excel plugin configuration in a v5-friendly way.
 * - Preferred: config from `plugin::excel-export`
 * - Fallback: legacy `excel` root config (for backward compatibility)
 *
 * Expected shape:
 * {
 *   config: {
 *     'api::your-type.your-type': {
 *       columns: [...],
 *       relation: { ... },
 *       locale: true | "true"
 *     },
 *     ...
 *   }
 * }
 *
 * @param {import('@strapi/strapi').Strapi} strapi
 * @returns {ExcelConfigMap}
 */
const resolveExcelConfig = (strapi) => {
  /** @type {{ config?: ExcelConfigMap } | undefined} */
  const pluginConfig = strapi.config.get('plugin::strapi-plugin-excel-export-2024');

  if (pluginConfig) {
    return pluginConfig;
  }

  /** @type {{ config?: ExcelConfigMap } | undefined} */
  const legacyConfig = strapi.config.get('excel');
  console.log(legacyConfig)
  if (legacyConfig && legacyConfig.config) {
    return legacyConfig.config;
  }

  return {};
};

/**
 * Normalize the "locale" flag from config.
 *
 * @param {ExcelCollectionConfig | undefined} collectionConfig
 * @returns {boolean}
 */
const shouldApplyLocaleFilter = (collectionConfig) => {
  if (!collectionConfig) return false;
  const { locale } = collectionConfig;
  if (typeof locale === 'boolean') return locale;
  if (typeof locale === 'string') return locale.toLowerCase() === 'true';
  return false;
};

/**
 * Build the base "where" filter for the ORM query.
 *
 * @param {ExcelCollectionConfig | undefined} collectionConfig
 * @returns {Record<string, unknown>}
 */
const buildBaseWhere = (collectionConfig) => {
  if (!shouldApplyLocaleFilter(collectionConfig)) {
    return {};
  }

  // TODO: make locale configurable per collection; defaulting to 'en' for now.
  return { locale: 'en' };
};

/**
 * @module ExcelExportController
 * @description Handles dropdown data, table data, and Excel export for configured collection types.
 *
 * @param {{ strapi: import('@strapi/strapi').Strapi }} param0
 * @returns {Record<string, Function>}
 */
const excelExportController = ({ strapi }) => ({
  /**
   * Returns dropdown options for all collection types configured in the Excel export config.
   *
   * @async
   * @function getDropDownData
   * @returns {Promise<{ data: { label: string; value: string }[] }>}
   */
  async getDropDownData() {
    const excelConfig = resolveExcelConfig(strapi);

    console.log('@@@ excelConfig')
    console.log(excelConfig)
    console.log('@@@ excelConfig')

    /** @type {{ label: string; value: string }[]} */
    const dropDownValues = [];

    Object.entries(excelConfig).forEach(([uid]) => {
      const contentType = strapi.contentType(uid);
      console.log('@@@ contentType')
      console.log(contentType)
      console.log('@@@ contentType')

      if (!contentType) {
        strapi.log.warn(
          `[excel-export] Content-type not found for uid "${uid}". Check your plugin config.`
        );
        return;
      }

      if (contentType.kind !== 'collectionType') {
        return;
      }

      const label =
        contentType.info?.displayName ||
        contentType.info?.name ||
        uid;

      dropDownValues.push({
        label,
        value: uid,
      });
    });

    // Sort alphabetically by label
    dropDownValues.sort((a, b) => a.label.localeCompare(b.label));

    return {
      data: dropDownValues,
    };
  },

  /**
   * Returns paginated table data + headers for a given content-type uid.
   *
   * Expects query params:
   * - uid: string (content-type uid)
   * - limit: number (page size)
   * - offset: number (offset)
   *
   * @async
   * @function getTableData
   * @param {import('koa').Context} ctx
   * @returns {Promise<void>}
   */
  async getTableData(ctx) {
    const excelConfig = resolveExcelConfig(strapi);
    /** @type {string | undefined} */
    const uid = ctx?.query?.uid;

    if (!uid) {
      ctx.throw(400, 'Missing "uid" query parameter');
    }

    /** @type {ExcelCollectionConfig | undefined} */
    const collectionConfig = excelConfig[uid];

    if (!collectionConfig) {
      ctx.throw(400, `No Excel configuration found for uid "${uid}"`);
    }

    const rawLimit = ctx?.query?.limit;
    const rawOffset = ctx?.query?.offset;

    const limit = Number(rawLimit) > 0 ? Number(rawLimit) : 10;
    const offset = Number(rawOffset) >= 0 ? Number(rawOffset) : 0;

    const query = await this.restructureObject(collectionConfig, uid, limit, offset);

    const [entities, totalCount] = await Promise.all([
      strapi.db.query(uid).findMany(query),
      strapi.db.query(uid).count({ where: query.where }),
    ]);

    const header = [
      ...(collectionConfig.columns || []),
      ...Object.keys(collectionConfig.relation || {}),
    ];

    const tableData = await this.restructureData(entities, collectionConfig);

    ctx.body = {
      data: tableData,
      count: totalCount,
      columns: header,
    };
  },

  /**
   * Generates and returns an Excel buffer for the selected uid.
   *
   * Expects query param:
   * - uid: string
   *
   * @async
   * @function downloadExcel
   * @param {import('koa').Context} ctx
   * @returns {Promise<void>}
   */
  async downloadExcel(ctx) {
    try {
      const excelConfig = resolveExcelConfig(strapi);
      /** @type {string | undefined} */
      const uid = ctx?.query?.uid;

      if (!uid) {
        ctx.throw(400, 'Missing "uid" query parameter');
      }

      /** @type {ExcelCollectionConfig | undefined} */
      const collectionConfig = excelConfig[uid];

      if (!collectionConfig) {
        ctx.throw(400, `No Excel configuration found for uid "${uid}"`);
      }

      const query = await this.restructureObject(collectionConfig, uid);
      const entities = await strapi.db.query(uid).findMany(query);
      const excelData = await this.restructureData(entities, collectionConfig);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');

      const headers = [
        ...(collectionConfig.columns || []),
        ...Object.keys(collectionConfig.relation || {}),
      ];

      const headerRestructure = headers.map((header) =>
        header
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      );

      worksheet.columns = headers.map((header, index) => ({
        header: headerRestructure[index],
        key: header,
        width: 20,
      }));

      excelData.forEach((row) => {
        worksheet.addRow(row);
      });

      worksheet.columns.forEach((column) => {
        // @ts-ignore alignment is a valid property for ExcelJS columns
        column.alignment = { wrapText: true };
      });

      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A1' },
      ];

      const buffer = await workbook.xlsx.writeBuffer();

      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.set('Content-Disposition', 'attachment; filename="export.xlsx"');
      ctx.body = buffer;
    } catch (error) {
      strapi.log.error('[excel-export] Error generating Excel buffer:', error);
      ctx.throw(500, 'Unable to generate Excel export');
    }
  },

  /**
   * Builds a query object for `strapi.db.query(uid).findMany`.
   *
   * @async
   * @function restructureObject
   * @param {ExcelCollectionConfig} collectionConfig
   * @param {string} uid
   * @param {number} [limit]
   * @param {number} [offset]
   * @returns {Promise<{
   *   select: string[] | '*';
   *   populate: Record<string, unknown>;
   *   where: Record<string, unknown>;
   *   orderBy: Record<string, 'asc' | 'desc'>;
   *   limit?: number;
   *   offset?: number;
   * }>}
   */
  async restructureObject(collectionConfig, uid, limit, offset) {
    const where = buildBaseWhere(collectionConfig);

    /** @type {{ [key: string]: unknown }} */
    const populate = {};

    Object.entries(collectionConfig.relation || {}).forEach(([key, relationConfig]) => {
      populate[key] = {
        select: relationConfig.column || [],
      };
    });

    /** @type {{ [key: string]: 'asc' | 'desc' }} */
    const orderBy = { id: 'asc' };

    /** @type {{
     *   select: string[] | '*';
     *   populate: Record<string, unknown>;
     *   where: Record<string, unknown>;
     *   orderBy: Record<string, 'asc' | 'desc'>;
     *   limit?: number;
     *   offset?: number;
     * }}
     */
    const query = {
      select: collectionConfig.columns && collectionConfig.columns.length > 0
        ? collectionConfig.columns
        : '*',
      populate,
      where,
      orderBy,
    };

    if (typeof limit === 'number') {
      query.limit = limit;
    }

    if (typeof offset === 'number') {
      query.offset = offset;
    }

    return query;
  },

  /**
   * Reshapes raw ORM data into a flat object structure based on the Excel config.
   *
   * @async
   * @function restructureData
   * @param {any[]} data
   * @param {ExcelCollectionConfig} collectionConfig
   * @returns {Promise<Record<string, unknown>[]>}
   */
  async restructureData(data, collectionConfig) {
    const columns = collectionConfig.columns || [];
    const relations = collectionConfig.relation || {};

    return data.map((item) => {
      /** @type {Record<string, unknown>} */
      const restructuredItem = {};

      // Main scalar fields
      columns.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          restructuredItem[key] = item[key];
        }
      });

      // Relation fields
      Object.entries(relations).forEach(([relationKey, relationConfig]) => {
        if (!Object.prototype.hasOwnProperty.call(item, relationKey)) {
          return;
        }

        const relationValue = item[relationKey];
        const [column] = relationConfig.column || [];

        if (!column) {
          restructuredItem[relationKey] = null;
          return;
        }

        if (Array.isArray(relationValue) && relationValue.length > 0) {
          restructuredItem[relationKey] = relationValue
            .map((child) => child?.[column])
            .filter((value) => value != null)
            .join(' ');
        } else if (relationValue && typeof relationValue === 'object') {
          restructuredItem[relationKey] = relationValue[column] ?? null;
        } else {
          restructuredItem[relationKey] = null;
        }
      });

      return restructuredItem;
    });
  },
});

export default excelExportController;