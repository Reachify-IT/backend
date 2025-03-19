const fileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", required: true },
    s3Url: { type: String, required: true }, // Assuming you're storing files in S3
    uploadedAt: { type: Date, default: Date.now },
  });
  
  module.exports = mongoose.model("File", fileSchema);
  