module.exports = [
  {
    method: "GET",
    path: "/get/dropdown/values",
    handler: "myController.getDropDownData",
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/get/table/data",
    handler: "myController.getTableData",
    config: {
      policies: [],
      auth: false,
    },
  },
  {
    method: "GET",
    path: "/download/excel",
    handler: "myController.downloadExcel",
    config: {
      policies: [],
      auth: false,
    },
  },
];
