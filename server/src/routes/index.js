module.exports = [
  {
    method: "GET",
    path: "/get/dropdown/values",
    handler: "excel-export.getDropDownData",
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/get/table/data",
    handler: "excel-export.getTableData",
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/download/excel",
    handler: "excel-export.downloadExcel",
    config: {
      policies: [],
      auth: false,
    },
  },
];
