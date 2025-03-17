const xlsx = require("xlsx");

const processExcel = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Get the first sheet
    const jsonData = xlsx.utils.sheet_to_json(sheet);
    console.log(`✅ Extracted ${jsonData.length} rows from Excel.`); // Debugging


    if (!jsonData.length) {
      throw new Error("No data found in the Excel file.");
    }

    console.log("📂 Extracted Data:", jsonData); // Debugging output

    // ✅ Process every row, including duplicates
    return jsonData.map((row, index) => {
      const email = row["Email"] || row["email"] || row["E-mail"]; // Handling different capitalizations
      const name = row["Name"] || row["name"];
      const websiteUrl = row["Website-Url"] || row["website"] || row["URL"];
      const ClientCompany = row["Client-Company"] || row["ClientCompany"];
      const ClientDesignation = row["Client-Designation"] || row["ClientDesignation"];

      // ✅ If required fields are missing, mark row as invalid
      if (!email || !name || !websiteUrl) {
        return { Row: index + 1, Status: "Invalid", Email: email || "Missing", Name: name || "Missing", WebsiteUrl: websiteUrl || "Missing" };
      }

      return { Row: index + 1, Email: email, Name: name, WebsiteUrl: websiteUrl, ClientCompany, ClientDesignation };
    });

  } catch (error) {
    console.error("❌ Error processing Excel file:", error.message);
    return [];
  }
};

module.exports = processExcel;
