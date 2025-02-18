const xlsx = require("xlsx");

const processExcel = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    if (!jsonData.length) {
      throw new Error("No data found in the Excel file.");
    }

    console.log("Extracted Data:", jsonData); // Debugging output

    return jsonData.map((row) => row["websiteUrl"] || row["Website URL"]).filter((url) => url);
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return [];
  }
};

module.exports = processExcel;
