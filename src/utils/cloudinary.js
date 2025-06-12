import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"
import dotenv from "dotenv"
dotenv.config()

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary=async (fileBuffer,filename) =>{
    try {
        if(!filename) return null
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "auto",
                    public_id: filename.split(".")[0] // optional: strip extension
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            stream.end(fileBuffer);
        });

        console.log("Uploaded to Cloudinary:", result.secure_url);
        return result;
    } catch (error) {
        console.error("Upload failed:", error);
        return null
    }
}
const deleteFromCloudinary=async (publicId)=>{
    try {
        const result=await cloudinary.uploader.destroy(publicId)
        console.log(`${publicId} deleted`);
    } catch (error) {
        console.log("error deleting file from cloudinary")
    }
}

export {uploadOnCloudinary,deleteFromCloudinary,cloudinary}   //functions to del and upload files on cloudinary
