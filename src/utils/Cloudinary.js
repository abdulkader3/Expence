import dotenv from "dotenv";
dotenv.config();
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    //upload with timeout
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      timeout: 30000, // 30 second timeout
    });

    //success

    fs.unlinkSync(localFilePath);
    console.log(response.url);
    return response;
  } catch (error) {
    console.log("cloudinary : ", error);

    // Clean up local file even if upload fails
    try {
      fs.unlinkSync(localFilePath);
    } catch (cleanupError) {
      console.log("Failed to cleanup local file:", cleanupError);
    }

    return null;
  }
};
export { UploadOnCloudinary };
