const xlsx = require("xlsx");

const processExcel = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Get the first sheet
    const jsonData = xlsx.utils.sheet_to_json(sheet);

    if (!jsonData.length) {
      throw new Error("No data found in the Excel file.");
    }

    console.log("📂 Extracted Data:", jsonData); // Debugging output

    // ✅ Extract Required Fields
    return jsonData
      .map((row) => {
        const email = row["Email"] || row["email"] || row["E-mail"]; // Handling different capitalizations
        const name = row["Name"] || row["name"]; // Handling name variations
        const websiteUrl = row["Website-Url"] || row["website"] || row["URL"]; 
        const ClientCompany = row["Client-Company"] || row["ClientCompany"];
        const ClientDesignation = row["Client-Designation"] || row["ClientDesignation"];

        if (email && name && websiteUrl) {
          return { Email: email, Name: name, WebsiteUrl: websiteUrl, ClientCompany, ClientDesignation };
        }
        return null; // Skip invalid rows
      })
      .filter((entry) => entry !== null); // Remove invalid rows

  } catch (error) {
    console.error("❌ Error processing Excel file:", error.message);
    return [];
  }
};

module.exports = processExcel;
