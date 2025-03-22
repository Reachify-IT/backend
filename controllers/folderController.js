const folderSchema = require("../models/folderSchema");
const User = require("../models/User");
const Video = require("../models/Video");
const mongoose = require("mongoose");


exports.createFolder = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user?.id; // Ensure user authentication middleware is used

        // Validate input
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required",
            });
        }

        // Check if a folder with the same name already exists for this user
        const existingFolder = await folderSchema.findOne({ name, userId });
        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: "A folder with this name already exists",
            });
        }

        // Create a new folder
        const newFolder = new folderSchema({ name, userId });
        await newFolder.save();

        return res.status(201).json({
            success: true,
            message: "Folder created successfully",
            folder: newFolder,
        });
    } catch (error) {
        console.error("Error creating folder:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};



exports.getAllFolders = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const folders = await folderSchema.find({ userId });
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: "Error fetching folders" });
    }
};


exports.getFoldersdata = async (req, res) => {
    try {
      const userId = req.user.id;
      const folderId  = req.params.id; // Extract folderId from params

      console.log("folder ID:",folderId )

      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: "Invalid folder ID format" });
      }
  
      const objectIdFolderId = new mongoose.Types.ObjectId(folderId);
  
      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Find folder
      const folder = await folderSchema.findById(folderId);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
  
      // Find the video data
      const data = await Video.findOne({ userId, folderId });
      if (!data) {
        return res.status(404).json({ error: "No video found for this folder." });
      }
  
      // Send response
      res.status(200).json({ success: true,
         data ,
         folder:folder.name
        });
  
    } catch (error) {
      console.error("Error fetching folder data:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };


exports.deleteFolder = async (req, res) => {
    try {
        const folderId = req.params.id;
        const folder = await folderSchema.findById(folderId);

        if (!folder) {
            return res.status(404).json({ error: "Folder not found" });
        }

        const videos = await Video.find({ folderId: folderId });

        if(!videos.length){
            return res.status(404).json({ error: "No videos found for this folder." });
        }


        const userId = req.user.id;

        if (folder.userId.toString() !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        await Video.deleteMany({ folderId: folderId });

        await folderSchema.findByIdAndDelete(folderId);
        res.json({
             success: true,
             message: "Folder deleted successfully"
             });
    } catch (error) {
        res.status(500).json({ error: "Error deleting folder" });
    }
};
