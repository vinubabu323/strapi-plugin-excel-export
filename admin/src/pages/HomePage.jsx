import React, { useEffect, useState } from "react";
import axios from "axios";
import DataTable from "react-data-table-component";

import {
  Box,
  Flex,
  Typography,
  Button,
  Alert,
} from "@strapi/design-system";

export const HomePage = () => {
  const [dropDownData, setDropDownData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [selectedValue, setSelectedValue] = useState("");

  const [dropdownLoading, setDropdownLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(false);
  const [fileName, setFileName] = useState("");

  // DataTable pagination
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // ─────────────────────────────────────────────
  // LOAD DROPDOWN VALUES
  // ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(
          "/strapi-plugin-excel-export-2024/get/dropdown/values"
        );
        setDropDownData(res.data);
      } catch (e) {
        console.error("Dropdown fetch failed:", e);
      } finally {
        setDropdownLoading(false);
      }
    };
    load();
  }, []);

  // ─────────────────────────────────────────────
  const formatDate = (d) => {
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}-${pad(
      d.getHours()
    )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  };

  const mappedColumns = columns.map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " "),
    selector: (row) => row[p],
  }));

  const fetchRows = async (uid, page, size) => {
    if (!uid) return;

    setLoading(true);
    try {
      const offset = (page - 1) * size;
      const res = await axios.get(
        "/strapi-plugin-excel-export-2024/get/table/data",
        {
          params: { uid, limit: size, offset },
        }
      );

      if (res.data.columns) setColumns(res.data.columns);
      if (res.data.data) setTableData(res.data.data);
      if (typeof res.data.count === "number") setTotalRows(res.data.count);
    } catch (e) {
      console.error("Table fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Event handlers
  // ─────────────────────────────────────────────
  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    if (value) {
      fetchRows(value, 1, perPage);
    } else {
      setTableData([]);
      setTotalRows(0);
    }
  };

  const handleClear = () => {
    setSelectedValue("");
    setTableData([]);
    setTotalRows(0);
  };

  const handleDownload = async () => {
    if (!selectedValue) return;

    try {
      const res = await axios.get(
        "/strapi-plugin-excel-export-2024/download/excel",
        {
          responseType: "arraybuffer",
          params: { uid: selectedValue },
        }
      );

      const d = formatDate(new Date());
      const name = `file-${d}.xlsx`;
      setFileName(name);

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = name;
      link.click();

      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 8000);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  // ─────────────────────────────────────────────
  return (
    <Box padding={8} background="neutral100">
      {/* TITLE */}
      <Box marginBottom={6}>
        <Typography variant="alpha" as="h1">
          Excel Export
        </Typography>
        <Typography textColor="neutral600" variant="omega">
          Export any collection’s data with server-side pagination.
        </Typography>
      </Box>

      {/* FORM + ACTIONS PANEL */}
      <Box
        background="neutral0"
        padding={6}
        hasRadius
        shadow="tableShadow"
        marginBottom={6}
      >
        <Flex direction="column" gap={4} alignItems="flex-start">
          {/* NATIVE SELECT */}
          <Box width="100%" maxWidth="28rem">
            <label
              htmlFor="excel-export-collection"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <Typography variant="pi" fontWeight="bold">
                Collection Type
              </Typography>
            </label>

            <select
              id="excel-export-collection"
              value={selectedValue}
              disabled={dropdownLoading}
              onChange={handleSelectChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid #dcdce4",
                backgroundColor: dropdownLoading ? "#f6f6f9" : "white",
                cursor: dropdownLoading ? "not-allowed" : "pointer",
              }}
            >
              <option value="">
                {dropdownLoading ? "Loading..." : "Select collection type"}
              </option>
              {dropDownData?.data?.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Box>

          {/* ACTION BUTTONS */}
          <Flex gap={3} marginTop={2}>
            <Button
              size="M"
              variant="default"
              disabled={!selectedValue}
              onClick={handleDownload}
            >
              Download Excel
            </Button>

            <Button
              size="M"
              variant="secondary"
              disabled={!selectedValue}
              onClick={handleClear}
            >
              Clear
            </Button>
          </Flex>

          {/* ALERT */}
          {successMessage && (
            <Alert
              title="Download complete"
              variant="success"
              onClose={() => setSuccessMessage(false)}
            >
              <Typography>{fileName} downloaded successfully.</Typography>
            </Alert>
          )}
        </Flex>
      </Box>

      {/* TABLE */}
      {selectedValue && (
        <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
          <DataTable
            pagination
            columns={mappedColumns}
            data={tableData}
            progressPending={loading}
            paginationServer
            paginationTotalRows={totalRows}
            onChangePage={(page) => fetchRows(selectedValue, page, perPage)}
            onChangeRowsPerPage={(size, page) => {
              setPerPage(size);
              fetchRows(selectedValue, page, size);
            }}
          />
        </Box>
      )}
    </Box>
  );
};
