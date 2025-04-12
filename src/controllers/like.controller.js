import mongoose, {isValidObjectId} from "mongoose"
import {Likes} from "../models/like.models.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.models.js"
import {Comment} from "../models/comment.models.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if(!isValidObjectId(videoId)){
        throw new ErrorResponse(400,"Invalid video id")
    }
    const video = await Video.findById(videoId)
    if(!video){
        throw new ErrorResponse(404, "Video not found")
    }
    const like = await Likes.findOne({video: videoId, likedBy: req.user._id})
    
    if(like){
        await Likes.findByIdAndDelete(like._id)
        return res.status(200).json(new ApiResponse(200, {}, "Video unliked successfully"))
    }
    else{
        await Likes.create({video: videoId, likedBy: req.user._id})
        return res.status(200).json(new ApiResponse(200, {}, "Video liked successfully"))
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if(!isValidObjectId(commentId)){
        throw new ErrorResponse(400,"Invalid video id")
    }
    const comment = await Comment.findById(commentId)
    if(!comment){
        throw new ErrorResponse(404, "Comment not found")
    }
    const like = await Likes.findOne({comment: commentId, likedBy: req.user._id})
    
    if(like){
        await Likes.findByIdAndDelete(like._id)
        return res.status(200).json(new ApiResponse(200, {}, "comment unliked successfully"))
    }
    else{
        await Likes.create({comment: commentId, likedBy: req.user._id})
        return res.status(200).json(new ApiResponse(200, {}, "comment liked successfully"))
    }

})

// const toggleTweetLike = asyncHandler(async (req, res) => {
//     const {tweetId} = req.params
//     //TODO: toggle like on tweet
// }
// )

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const likedVideos = await Likes.find({likedBy: req.user._id, video: {$exists: true}}).populate("video")
    return res.status(200).json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"))

})

const getLikeCount = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ErrorResponse(400, "Invalid video id")
    }

    const count = await Likes.countDocuments({ video: videoId })
    return res.status(200).json(new ApiResponse(200, { count }, "Like count fetched"))
})
const checkIfLiked = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
      throw new ErrorResponse(400, "Invalid video ID");
    }
  
    const alreadyLiked = await Likes.findOne({
      video: videoId,
      likedBy: req.user._id,
    });
  
    return res.status(200).json(
      new ApiResponse(200, { liked: !!alreadyLiked }, "Like status fetched")
    );
  });

export {
    toggleCommentLike,
    // toggleTweetLike,
    toggleVideoLike,
    getLikedVideos,
    getLikeCount,
    checkIfLiked
}