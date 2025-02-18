const mongoose = require("mongoose");
const dotenv = require("dotenv");
const DynamicModel = require("../models/DynamicModel.js");

dotenv.config();

let isConnected = false; // Track connection status

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
    process.exit(1);
  }
};

const saveDataToMongoDB = async (data) => {
  try {
    await connectDB(); // Ensures connection is established
    const newData = new DynamicModel(data);
    await newData.save();
    console.log("Data saved successfully");
  } catch (error) {
    console.error("Error saving data to MongoDB:", error.message);
    throw error;
  }
};

module.exports = { connectDB, saveDataToMongoDB };
