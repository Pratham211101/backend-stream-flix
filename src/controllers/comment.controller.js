import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.models.js"
import { ApiResponse } from "../utils/apiResponse.js"
import {ErrorResponse} from "../utils/ErrorResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.models.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query
    //validate videoid
    if(!videoId.trim() || !mongoose.Types.ObjectId.isValid(videoId)){
        throw new ErrorResponse(400,"valid videoId is required")
    }
    //convert page and limit to numbers and validate
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    if(isNaN(pageNumber) || isNaN(limitNumber) || pageNumber < 1 || limitNumber < 1){
        throw new ErrorResponse(400, "Invalid pagination parameters")
    }
    //aggregation pipeline to get comments with owner details
    const comments=await Comment.aggregate([
        {
            $match:{
                video:new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
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
        {
            $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] }
            }
        },
        {
            $sort: { createdAt: -1 } // Newest comments first
        },
        {
            $skip: (pageNumber - 1) * limitNumber
        },
        {
            $limit: limitNumber
        }
    ])
    // Get total count of comments for pagination metadata
    const totalComments = await Comment.countDocuments({ video: new mongoose.Types.ObjectId(videoId) });
    return res.status(200).json(new ApiResponse(
        200, 
        {
            comments,
            totalComments,
            totalPages: Math.ceil(totalComments / limitNumber),
            currentPage: pageNumber,
            commentsPerPage: limitNumber
        },
        "Comments fetched successfully"
    ));
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params
    const {content} = req.body
    const userId=req.user._id

    if(!isValidObjectId(videoId)){
        throw new ErrorResponse(400,"valid videoId is required")
    }
    if(!content || typeof content !== 'string' || content.trim().length === 0){
        throw new ErrorResponse(400, "content is required")
    
    }
    const videoExists = await Video.findById(videoId);
    if (!videoExists) {
        throw new ErrorResponse(404, "Video not found");
    }
    const comment = await Comment.create({
        content: content.trim(),
        owner: userId,
        video: videoId,
    });
    // Populate owner details for response
    const populatedComment = await Comment.findById(comment._id)
        .populate('owner', 'username avatar fullname');

    return res.status(201).json(
        new ApiResponse(201, populatedComment, "Comment added successfully")
    );



})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
