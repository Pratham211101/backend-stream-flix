import {asyncHandler} from "../utils/asyncHandler.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {User} from "../models/user.models.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"

import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { options } from "../constants.js"

const genrateAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        if (!user) {
            throw new Error("User not found");
        }
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()
        // console.log(accessToken);
        // console.log(refreshToken);
        user.refreshToken=refreshToken

        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}

    } catch (error) {
        console.log(error);
        throw new ErrorResponse(500,"something went wrong while generating access and refresh token")
        
    }
}

const registerUser=asyncHandler(async (req,res)=>{
    const{fullname,username,email,password}=req.body
    //validation
    if(
        [fullname,username,email,password].some((field)=> field?.trim()==="")
    ){
        throw new ErrorResponse(400,"all fields are required")
    }
    const duplicateUser=await User.findOne(
        {$or:[{username},{email}]}
    )

    if(duplicateUser){
        throw new ErrorResponse(409,"user already exists with this username or email")
    }
    const avatarLocalPath=req.files?.avatar?.[0]?.buffer;
    const avatarName = req.files?.avatar?.[0]?.originalname;
    
    const coverImageLocalPath = req.files?.coverImage[0]?.buffer;
    const coverImageName = req.files?.coverImage?.[0]?.originalname;
    

    if(!avatarLocalPath){
        throw new ErrorResponse(401,"avatar file missing")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath,avatarName)
    let coverImage=""
    if(coverImageLocalPath){
        coverImage=await uploadOnCloudinary(coverImageLocalPath,coverImageName)
    }

    

    try {
        const user=await User.create({
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url||"",
            email,
            password,
            username:username.toLowerCase()
        })
        const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(user._id);

        const createdUser= await User.findById(user._id).select(
            "-password -refreshTokens"
        )
        if(!createdUser){
            throw new ErrorResponse(500,"something went wrong while regestering a user")
        }
        return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200,createdUser,"user registered successfully"))
    } catch (error) {
        console.log("user creation failed");
        if(avatar){
            await deleteFromCloudinary(avatar.public_id)
        }
        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id)
        }
        throw new ErrorResponse(501,"something went wrong while registering user and images were deleted")
    }
})

const loginUser=asyncHandler(async(req,res)=>{
    const {email, username, password} = req.body

    if (!username && !email) {
        throw new ApiResponse(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    
    if (!user) {
        throw new ErrorResponse(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if (!isPasswordValid) {
        throw new ErrorResponse(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await genrateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logOutUser=asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
                
            }
        },
        {new:true}
    )
    
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged out succesfully"))
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ErrorResponse(401,"refresh token is required")
    }
    
    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)       
        const user=await User.findById(decodedToken?._id).select("-password ")

        if(!user){
            throw new ErrorResponse(401,"invalid refresh token")
        }
        
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ErrorResponse(401,"invalid refresh token")
        }

        const { accessToken, refreshToken : newRefreshToken } = await genrateAccessAndRefreshToken(user._id)
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(
            200,
            {
                accessToken,refreshToken:newRefreshToken,
                user:user
            },
            "acess token refreshed succesfully"))
    } catch (error) {
        throw new ErrorResponse(501,"something went wrong trying to refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ErrorResponse(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullname, email} = req.body

    if (!fullname && !email) {
        throw new ErrorResponse(400, "atleast one field is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ErrorResponse(400, "Avatar file is missing");
    }

    // Fetch the user to get the old avatar
    
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ErrorResponse(404, "User not found");
    }

    // Extract the public_id from the old avatar URL
    const oldAvatarUrl = user.avatar;
    const oldAvatarPublicId = oldAvatarUrl?.split("/").pop().split(".")[0];

    // Upload new avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ErrorResponse(400, "Error while uploading avatar");
    }

    // Delete old avatar from Cloudinary (if exists)
    if (oldAvatarPublicId) {
        await deleteFromCloudinary(oldAvatarPublicId);
    }

    // Update user with new avatar
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ErrorResponse(400, "coverImage file is missing");
    }

    // Fetch the user to get the old coverImage
    
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ErrorResponse(404, "User not found");
    }

    // Extract the public_id from the old coverImage URL
    const oldCoverImageUrl = user.coverImage;
    const oldCoverImagePublicId = oldCoverImageUrl?.split("/").pop().split(".")[0];

    // Upload new coverImage
    const coverImage = await uploadOnCloudinary( coverImageLocalPath);
    if (!coverImage.url) {
        throw new ErrorResponse(400, "Error while uploading coverImage");
    }

    // Delete old coverImage from Cloudinary (if exists)
    if (oldCoverImagePublicId) {
        await deleteFromCloudinary(oldCoverImagePublicId);
    }

    // Update user with new coverImage
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "coverImage image updated successfully"));
});


const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ErrorResponse(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ErrorResponse(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

const addToWatchHistory = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
  
    if (!videoId) {
      return res.status(400).json(new ApiResponse(400, null, "Video ID is required"));
    }
  
    const userId = req.user._id;
  
    // Pull if exists (remove old), then push to front
    await User.findByIdAndUpdate(userId, {
      $pull: { watchHistory: videoId } // Remove if already there
    });
  
    await User.findByIdAndUpdate(userId, {
      $push: { watchHistory: { $each: [videoId], $position: 0 } } // Add to start
    });
  
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Video added to watch history"));
  });
  


export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    addToWatchHistory
}

