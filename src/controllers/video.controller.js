import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import { ApiResponse } from "../utils/apiResponse.js"
import {ErrorResponse} from "../utils/ErrorResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"


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
    // TODO: get video, upload to cloudinary, create video
    if (!title || !description) {
        throw new ErrorResponse(400, "Title and description are required");
    }
    if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
        throw new ErrorResponse(400, "Video file and thumbnail are required");
    }
    // Get file paths from multer upload
    try {
        const videoFileLocalPath = req.files.videoFile[0]?.path;
        const thumbnailLocalPath = req.files.thumbnail[0]?.path;
        if (!videoFileLocalPath || !thumbnailLocalPath) {
            throw new ErrorResponse(400, "Video file and thumbnail paths are missing");
        }
        const videoFile = await uploadOnCloudinary(videoFileLocalPath);
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (!videoFile?.url || !thumbnail?.url) {
            throw new ErrorResponse(500, "Failed to upload files to Cloudinary");
        }
        // Create video document in mongoDB
        const video = await Video.create({
            title,
            description,
            duration: videoFile.duration || 0,
            videoFile: videoFile.url,
            thumbnail: thumbnail.url,
            owner: req.user._id,
            isPublished: true
        });
    // Remove temporary files (optional)
        deleteFromCloudinary(videoFileLocalPath)
        deleteFromCloudinary(thumbnailLocalPath)

        return res.status(201).json(
            new ApiResponse(201, video, "Video published successfully")
        );

    } catch (error) {
        if (req.files.videoFile[0]?.path) deleteFromCloudinary(req.files.videoFile[0]?.path)
        if (req.files.thumbnail[0]?.path) deleteFromCloudinary(req.files.thumbnail[0]?.path)
        throw error;
    }
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
