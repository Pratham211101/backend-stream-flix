import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.models.js"
import { Subscription } from "../models/subscription.models.js"
import { Video } from "../models/video.models.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if(!isValidObjectId(channelId)) {
        throw new ErrorResponse(400, "Invalid channel id")
    }
    const channel = await User.findById(channelId)
    if(!channel) {
        throw new ErrorResponse(404, "Channel not found")
    }
    const subscriber = req.user
    const subscription = await Subscription.findOne({
        channel: channelId,
        subscriber: subscriber._id
    })
    if(subscription) {
        await Subscription.findByIdAndDelete(subscription._id)
        return res.status(200).json(new ApiResponse(200, {}, "Unsubscribed successfully"))
    }
    else {
        await Subscription.create({
            channel: channelId,
            subscriber: subscriber._id
        })
        return res.status(200).json(new ApiResponse(200, {}, "Subscribed successfully"))
    }



})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params
  
    if (!isValidObjectId(channelId)) {
      throw new ErrorResponse(400, "Invalid channel id")
    }
  
    const channel = await User.findById(channelId)
    if (!channel) {
      throw new ErrorResponse(404, "Channel not found")
    }
  
    const subscribers = await Subscription.find({ channel: channelId })
  
    const isSubscribed = req.user
      ? subscribers.some(sub => sub.subscriber.toString() === req.user._id.toString())
      : false
  
    const subscribersCount = subscribers.length
  
    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribersCount, isSubscribed }, "Subscribers fetched successfully")
      )
  })
  

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if(!isValidObjectId(subscriberId)) {
        throw new ErrorResponse(400, "Invalid user id")
    }
    const subscriber = await User.findById(subscriberId)
    if(!subscriber) {
        throw new ErrorResponse(404, "User not found")
    }
    const channels = await Subscription.find({
        subscriber: subscriberId
    }).populate("channel")
    return res.status(200).json(new ApiResponse(200, channels, "Channels fetched successfully"))
})

const getSubscriptionVideos = asyncHandler(async (req, res) => {
    const subscriberId = req.user._id;
    const { page = 1, limit = 16 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
        throw new ErrorResponse(400, "Invalid pagination parameters");
    }

    // Find all channels user is subscribed to
    const subscriptions = await Subscription.find({ subscriber: subscriberId });
    const channelIds = subscriptions.map(sub => sub.channel);

    let query = { isPublished: true };
    let message = "Subscription feed fetched successfully";

    if (channelIds.length > 0) {
        query.owner = { $in: channelIds };
    } else {
        message = "No subscriptions found. Showing recommended videos instead.";
    }

    const videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("owner", "username avatar fullname");

    const totalVideos = await Video.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos,
                currentPage: pageNum,
                totalPages: Math.ceil(totalVideos / limitNum),
                hasNextPage: pageNum * limitNum < totalVideos
            },
            message
        )
    );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels,
    getSubscriptionVideos
}