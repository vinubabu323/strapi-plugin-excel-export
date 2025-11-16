'use strict';

import ExcelJS from 'exceljs';

/**
 * Safely read nested property using dot notation, e.g. "location.detailed_place".
 *
 * @param {unknown} source
 * @param {string} path
 * @returns {unknown}
 */
const getDeepValue = (source, path) => {
  if (!source || typeof source !== 'object' || !path) return undefined;

  const segments = path.split('.');
  let current = /** @type {any} */ (source);

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[segment];
  }

  return current;
};

/**
 * @typedef {Object} RelationFieldDescriptor
 * @property {string} flatKey     // e.g. "shipping_infos.location.detailed_place"
 * @property {string} relationKey // e.g. "shipping_infos"
 * @property {string} innerPath   // e.g. "location.detailed_place" or "first_name"
 */

/**
 * Normalize "column"/"columns" to an array of strings.
 *
 * @param {any} node
 * @returns {string[]}
 */
const extractColumnsArray = (node) => {
  if (!node || typeof node !== 'object') return [];
  const col = node.columns ?? node.column;
  if (!col) return [];
  if (Array.isArray(col)) return col;
  if (typeof col === 'string') return [col];
  return [];
};

/**
 * Recursively flatten a relation config node into field descriptors.
 *
 * Example for relationKey = "shipping_infos":
 *
 * {
 *   relation: {
 *     location: { column: ["detailed_place"] }
 *   }
 * }
 *
 * => flatKey:  "shipping_infos.location.detailed_place"
 *    innerPath: "location.detailed_place"
 *
 * @param {string} relationKey
 * @param {any} node
 * @param {string} [innerPrefix]
 * @param {RelationFieldDescriptor[]} [acc]
 * @returns {RelationFieldDescriptor[]}
 */
const flattenRelationNode = (relationKey, node, innerPrefix = '', acc = []) => {
  if (!node || typeof node !== 'object') return acc;

  const cols = extractColumnsArray(node);

  if (cols.length > 0) {
    const base = innerPrefix ? `${innerPrefix}.` : '';
    cols.forEach((field) => {
      const innerPath = base + field; // e.g. "location.detailed_place" or "first_name"
      const flatKey = `${relationKey}.${innerPath}`;
      acc.push({ flatKey, relationKey, innerPath });
    });
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key === 'column' || key === 'columns') return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    // Special case: `relation` is just a container for nested relations, not a path segment
    if (key === 'relation') {
      flattenRelationNode(relationKey, value, innerPrefix, acc);
      return;
    }

    const nextPrefix = innerPrefix ? `${innerPrefix}.${key}` : key;
    flattenRelationNode(relationKey, value, nextPrefix, acc);
  });

  return acc;
};

/**
 * Build all relation field descriptors for a collection config.
 *
 * @param {Record<string, any>} relations
 * @returns {RelationFieldDescriptor[]}
 */
const buildRelationDescriptors = (relations) => {
  /** @type {RelationFieldDescriptor[]} */
  const all = [];

  Object.entries(relations || {}).forEach(([relationKey, node]) => {
    flattenRelationNode(relationKey, node, '', all);
  });

  return all;
};

/**
 * @typedef {Object} ExcelCollectionConfig
 * @property {string[]} columns
 * @property {Record<string, any>} relation
 * @property {boolean | string} [locale] - If truthy, apply locale filter (default "en").
 */

/**
 * @typedef {Object.<string, ExcelCollectionConfig>} ExcelConfigMap
 */

/**
 * Resolve the Excel plugin configuration in a v5-friendly way.
 *
 * Priority:
 *  1. plugin::excel-export (new style)
 *  2. legacy `excel.config` (old style)
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

    /** @type {{ label: string; value: string }[]} */
    const dropDownValues = [];

    Object.entries(excelConfig).forEach(([uid]) => {
      const contentType = strapi.contentType(uid);

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

    const relationDescriptors = buildRelationDescriptors(collectionConfig.relation || {});

    const header = [
      ...(collectionConfig.columns || []),
      ...relationDescriptors.map((d) => d.flatKey),
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

      const relationDescriptors = buildRelationDescriptors(collectionConfig.relation || {});

      const headers = [
        ...(collectionConfig.columns || []),
        ...relationDescriptors.map((d) => d.flatKey),
      ];

      const headerRestructure = headers.map((header) =>
        header
          .replace(/\./g, '_')
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

    // Populate each top-level relation; nested stuff is handled when flattening
    Object.keys(collectionConfig.relation || {}).forEach((relationKey) => {
      populate[relationKey] = true;
    });

    /** @type {{ [key: string]: 'asc' | 'desc' }} */
    const orderBy = { id: 'desc' };

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
      select:
        collectionConfig.columns && collectionConfig.columns.length > 0
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

    const relationDescriptors = buildRelationDescriptors(relations);

    return data.map((item) => {
      /** @type {Record<string, unknown>} */
      const restructuredItem = {};

      // 1. Scalar fields
      columns.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          restructuredItem[key] = item[key];
        }
      });

      // 2. Relation fields (flattened)
      relationDescriptors.forEach(({ flatKey, relationKey, innerPath }) => {
        if (!Object.prototype.hasOwnProperty.call(item, relationKey)) {
          restructuredItem[flatKey] = null;
          return;
        }

        const relationValue = item[relationKey];

        if (Array.isArray(relationValue)) {
          const values = relationValue
            .map((entry) => getDeepValue(entry, innerPath))
            .filter((v) => v != null && v !== '');

          restructuredItem[flatKey] = values.length ? values.join(' ') : null;
        } else if (relationValue && typeof relationValue === 'object') {
          const value = getDeepValue(relationValue, innerPath);
          restructuredItem[flatKey] = value ?? null;
        } else {
          restructuredItem[flatKey] = null;
        }
      });

      return restructuredItem;
    });
  },
});

export default excelExportController;
