import React, { useEffect, useState } from "react";
import DataTable from "react-data-table-component";

import axios from "axios";
import {
  Box,
  ContentLayout,
  Button,
  HeaderLayout,
  Layout,
  Combobox,
  ComboboxOption,
  Stack,
  Typography,
} from "@strapi/design-system";

const HomePage = () => {
  const baseUrl = process.env.STRAPI_ADMIN_BACKEND_URL;

  const [dropDownData, setDropDownData] = useState([]);

  const [columns, setColumns] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [selectedValue, setSelectedValue] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [fileName, setFileName] = useState("");

  //data table pagination
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          `${baseUrl}/excel-export/get/dropdown/values`
        );
        setDropDownData(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching dropdown values:", error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  //data table pagination
  const handleComboboxChange = async (value) => {
    setSelectedValue(value); // Use the callback form to ensure state is updated
    if (value) {
      fetchUsers(value, 1, 10);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await axios.get(
        `${baseUrl}/excel-export/download/excel`,
        {
          responseType: "arraybuffer",
          params: {
            uid: selectedValue,
          },
        }
      );

      // Create a Blob from the response data and trigger download
      if (response.data) {
        const currentDate = new Date();
        const formattedDate = formatDate(currentDate);
        setFileName(`file-${formattedDate}.xlsx`);

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `file-${formattedDate}.xlsx`;
        link.click();
        setIsSuccessMessage(true);
        // Hide the success message after 3000 milliseconds (3 seconds)
        setTimeout(() => {
          setIsSuccessMessage(false);
        }, 8000);
      }
    } catch (error) {
      console.error("Error downloading Excel file:", error);
    }
  };

  const handleComboBoxClear = async () => {
    setSelectedValue(null);
    setTableData([]);
  };

  const columnRestructure = columns.map((property) => ({
    name:
      property?.charAt(0).toUpperCase() + property?.slice(1).replace(/_/g, " "),
    selector: (row) => row[property],
  }));

  // Function to format date as "DD-MM-YYYY-HH-mm-ss"
  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return `${day}-${month}-${year}-${hours}-${minutes}-${seconds}`;
  };

  //data table functionality

  const fetchUsers = async (value, page, newPerPage) => {
    setLoading(true);
    const currentSelectedValue = value; // Store the selectedValue in a variable
    if (currentSelectedValue) {
      try {
        const offset = (page - 1) * newPerPage; // Calculate the offset based on the current page and items per page
        const limit = newPerPage;

        const response = await axios.get(
          `${baseUrl}/excel-export/get/table/data?uid=${value}&limit=${limit}&offset=${offset}`
        );
        if (response?.data?.columns) {
          setColumns(response.data.columns);
        }
        if (response?.data?.data) {
          setTableData(response.data.data);
          setTotalRows(response.data.count);
        }
      } catch (error) {
        console.error("Error fetching table data:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePageChange = (page) => {
    fetchUsers(selectedValue, page, perPage);
  };

  const handlePerRowsChange = async (newPerPage, currentPage) => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * newPerPage; // Calculate the offset based on the current page and items per page
      const limit = newPerPage;

      const response = await axios.get(
        `${baseUrl}/excel-export/get/table/data?uid=${selectedValue}&limit=${limit}&offset=${offset}`
      );

      if (response?.data?.data) {
        setTableData(response.data.data);
        setPerPage(newPerPage);
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box background="neutral100">
      <Layout>
        <>
          <HeaderLayout title="Excel Download" as="h2" />
          <ContentLayout>
            <Stack>
              <Box padding={4} width="600px">
                <Combobox
                  label="Collection Type"
                  size="M"
                  onChange={handleComboboxChange}
                  value={selectedValue}
                  placeholder="Select collection type"
                  onClear={handleComboBoxClear}
                >
                  {dropDownData?.data?.map((item) => (
                    <ComboboxOption key={item.value} value={item.value}>
                      {item.label}
                    </ComboboxOption>
                  ))}
                </Combobox>
              </Box>
              {selectedValue && (
                <>
                  <Box padding={4} marginTop={2} className="ml-auto">
                    <Button
                      size="L"
                      variant="default"
                      onClick={handleDownloadExcel}
                    >
                      Download
                    </Button>
                    <br />
                    {isSuccessMessage && (
                      <Typography
                        style={{
                          color: "green",
                          "font-size": "medium",
                          "font-weight": "500",
                        }}
                      >
                        Download completed: {fileName} successfully downloaded!
                      </Typography>
                    )}
                  </Box>
                  <Box className="ml-auto">
                    <DataTable
                      pagination
                      columns={columnRestructure}
                      data={tableData}
                      progressPending={loading}
                      paginationServer
                      paginationTotalRows={totalRows}
                      onChangeRowsPerPage={handlePerRowsChange}
                      onChangePage={handlePageChange}
                    />
                  </Box>
                </>
              )}
            </Stack>
          </ContentLayout>
        </>
      </Layout>
    </Box>
  );
};

export default HomePage;
