import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {ErrorResponse} from "../utils/ErrorResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary,cloudinary} from "../utils/cloudinary.js"



const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pageNumber=parseInt(page)
    const limitNumber=parseInt(limit)
    if(isNaN(pageNumber) || isNaN(limitNumber) || pageNumber < 1 || limitNumber < 1){
        throw new ErrorResponse(400, "Invalid pagination parameters")
    }

    //build base query
    const baseQuery = {isPublished: true}
    //user filter
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ErrorResponse(400, "Invalid user ID");
        }
        baseQuery.owner = new mongoose.Types.ObjectId(userId);
    }
    //add text search 
    if (query) {
        baseQuery.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ];
    }
    //sort
    const sortOptions = {};
    if (sortBy) {
        sortOptions[sortBy] = sortType === "desc" ? -1 : 1;
    } else {
        sortOptions.createdAt = -1; // Default sort by newest first
    }
    // Aggregation pipeline
    const videos = await Video.aggregate([
        { $match: baseQuery },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullname: 1
                        }
                    }
                ]
            }
        },
        { $addFields: { owner: { $arrayElemAt: ["$owner", 0] } } },
        { $sort: sortOptions },
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
        {
            $project: {
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                thumbnail: 1,
                videoFile: 1,
                owner: 1,
                createdAt: 1,
                isPublished: 1
            }
        }
    ]);
    const totalVideos = await Video.countDocuments(baseQuery);
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos,
                totalVideos,
                totalPages: Math.ceil(totalVideos / limitNumber),
                currentPage: pageNumber,
                videosPerPage: limitNumber
            },
            "Videos fetched successfully"
        )
    );
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    if (!title || !description) {
        throw new ErrorResponse(400, "Title and description are required");
    }
    if (!req.files || !req.files.videoFile) {
        throw new ErrorResponse(400, "Video file is required");
    }
    // Get file paths from multer upload
    try {
        const videoFileLocalPath = req.files.videoFile[0]?.path;
        const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

        if (!videoFileLocalPath) {
            throw new ErrorResponse(400, "Video file path is missing");
        }

        // Upload video to Cloudinary
        const videoFile = await uploadOnCloudinary(videoFileLocalPath, {
            resource_type: "video"
        });

        if (!videoFile?.url) {
            throw new ErrorResponse(500, "Failed to upload video to Cloudinary");
        }

        let thumbnailUrl;

        if (thumbnailLocalPath) {
            const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
            thumbnailUrl = thumbnail.url;
        } else {
            // Generate thumbnail from video
            const videoPublicId = videoFile.public_id;
            thumbnailUrl = cloudinary.url(`${videoPublicId}.jpg`, {
                resource_type: "video",
                format: "jpg",
                transformation: [
                    { width: 500, height: 300, crop: "fill" },
                    { start_offset: "2" }
                ]
            });
        }

        // Save to DB
        const video = await Video.create({
            title,
            description,
            duration: videoFile.duration || 0,
            videoFile: videoFile.url,
            thumbnail: thumbnailUrl,
            owner: req.user._id,
            isPublished: true
        });

        deleteFromCloudinary(videoFileLocalPath);
        if (thumbnailLocalPath) deleteFromCloudinary(thumbnailLocalPath);

        return res.status(201).json(
            new ApiResponse(201, video, "Video published successfully")
        );

    } catch (error) {
        if (req.files?.videoFile?.[0]?.path) {
            deleteFromCloudinary(req.files.videoFile[0].path);
        }
    
        if (req.files?.thumbnail?.[0]?.path) {
            deleteFromCloudinary(req.files.thumbnail[0].path);
        }
    
        throw error;
    }
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!isValidObjectId(videoId)) {
        throw new ErrorResponse(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId).populate("owner", "username avatar fullname");
    if (!video) {
        throw new ErrorResponse(404, "Video not found");
    }
    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    );
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    // console.log("Request body:", req.body);
    // console.log("Uploaded files:", req.file);
    // console.log(req.file?.path);
    
    if (!isValidObjectId(videoId)) {
        throw new ErrorResponse(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ErrorResponse(404, "Video not found");
    }

    //extract publicid of oldthumbnail url
    const oldThumbnailUrl = video.thumbnail;
    const oldThumbnailPublicId = oldThumbnailUrl?.split("/").pop().split(".")[0];

    // Check if user is authorized to update video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ErrorResponse(403, "You are not authorized to update this video");
    }

    const thumbnailLocalPath = req.file?.path
    const { title, description } = req.body;
    if (!title && !description && !thumbnailLocalPath) {
        throw new ErrorResponse(400, "At least one field (title, description, thumbnail) is required");
    }
    
    if (thumbnailLocalPath) {
        const thumbnailFile = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumbnailFile?.url) {
            throw new ErrorResponse(500, "Failed to upload thumbnail to Cloudinary");
        }
        if (oldThumbnailPublicId) {
            await deleteFromCloudinary(oldThumbnailPublicId);
        }
        const updatedThumbnail = await Video.findByIdAndUpdate(
            videoId,
            { $set: { thumbnail: thumbnailFile.url } },
            { new: true }
        );
        
    }
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            title: title || video.title,
            description: description || video.description,
        },
        { new: true}
    );
    if (!updatedVideo) {
        throw new ErrorResponse(500, "Failed to update video");
    }
    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video updated successfully")
    );


})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!isValidObjectId(videoId)) {
        throw new ErrorResponse(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ErrorResponse(404, "Video not found");
    }
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ErrorResponse(403, "You are not authorized to delete this video");
    }
    //delete video from cloudinary
    const videoFilePublicId = video.videoFile?.split("/").pop().split(".")[0];      
    const thumbnailPublicId = video.thumbnail?.split("/").pop().split(".")[0];
    if (videoFilePublicId) {
        await deleteFromCloudinary(videoFilePublicId);
    }
    if (thumbnailPublicId) {
        await deleteFromCloudinary(thumbnailPublicId);
    }
    const deletedVideo = await Video.findByIdAndDelete(videoId);
    if (!deletedVideo) {
        throw new ErrorResponse(500, "Failed to delete video");
    }
    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    );
    
    
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ErrorResponse(400, "Invalid video ID");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ErrorResponse(404, "Video not found");
    }
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ErrorResponse(403, "You are not authorized to toggle publish status of this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: { isPublished: !video.isPublished } },
        { new: true }
    );
    if (!updatedVideo) {
        throw new ErrorResponse(500, "Failed to toggle publish status");
    }
    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Publish status toggled successfully")
    );
})

const increaseViews=asyncHandler(async(req,res)=>{
    const video=await Video.findByIdAndUpdate(
        req.params.id,
        {$inc:{views:1}},
        {new:true}
    )
    if (!video) {
        throw new ErrorResponse(404, "Video not found");
    }
    return res.status(200).json(
        new ApiResponse(200, {views:video.views},"view cnt increased" )
    );

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    increaseViews
}
