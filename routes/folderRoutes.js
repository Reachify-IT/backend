const express = require("express");
const { getAllFolders, createFolder, deleteFolder, getFoldersdata } = require("../controllers/folderController");
const { verifyToken } = require("../middleware/verifyToken"); // ✅ Ensure Authentication


const router = express.Router();

// Route to get all folders for the logged-in user
router.post("/create", verifyToken, createFolder);
router.get("/all-folders", verifyToken, getAllFolders);
router.get("/get-folder-data/:id", verifyToken, getFoldersdata);
router.delete("/delete/:id", verifyToken, deleteFolder);

module.exports = router;

