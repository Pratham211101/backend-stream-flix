import mongoose from "mongoose"
import {Video} from "../models/video.models.js"
import {Subscription} from "../models/subscription.models.js"
import {Likes} from "../models/like.models.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const channelId = req.user._id
    const totalVideos = await Video.find({owner: channelId}).countDocuments()
    const totalSubscribers = await Subscription.find({ channel: channelId}).countDocuments()
    const totalLikes = await Likes.find({channel: channelId}).countDocuments() //need to be fixed
    const totalViews = await Video.find({owner: channelId}).select("views") //needs to be fixed
    const totalViewsCount = totalViews.reduce((acc, curr) => acc + curr.views, 0) //needs to be fixed
    const channelStats = {
        totalVideos,
        totalSubscribers,
        totalLikes,
        totalViewsCount
    }
    res.status(200).json(new ApiResponse(200, channelStats, "channel stats fetched successfully"))

})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const channelId = req.user._id
    const videos = await Video.find({owner: channelId})
    if(!videos){
        throw new ErrorResponse(404, "no videos found")
    }
    res.status(200).json(new ApiResponse(200, videos, "videos retrieved successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }