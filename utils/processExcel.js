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

    // Extract both Email and Name from each row
    return jsonData
      .map((row) => {
        const email = row["Email"] || row["email"] || row["E-mail"]; // Handling different capitalizations
        const name = row["Name"] || row["name"]; // Handling name variations
        const websiteUrl = row["Website-Url"] || row["website"] || row["URL"]; // Handling website variations

        if (email && name && websiteUrl) {
          return { Email: email, Name: name, WebsiteUrl: websiteUrl };
        }
        return null; // Skip invalid rows
      })
      .filter((entry) => entry !== null); // Remove null entries
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return [];
  }
};


module.exports = processExcel;
