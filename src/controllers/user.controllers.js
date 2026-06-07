import {asyncHandler} from "../utils/asyncHandler.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {User} from "../models/user.models.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"
import { sendOTPEmail } from "../utils/mail.utils.js"
import { OAuth2Client } from "google-auth-library"

import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { options } from "../constants.js"

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const getAccessTokenOptions = (rememberMe) => {
    return {
        ...options,
        ...(rememberMe ? { maxAge: 1 * 24 * 60 * 60 * 1000 } : {})
    }
}

const getRefreshTokenOptions = (rememberMe) => {
    return {
        ...options,
        ...(rememberMe ? { maxAge: 10 * 24 * 60 * 60 * 1000 } : {})
    }
}

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

    if (!user.isVerified) {
        throw new ErrorResponse(403, "Please verify your email before logging in. An OTP was sent to your email.")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if (!isPasswordValid) {
        throw new ErrorResponse(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await genrateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const rememberMe = Boolean(req.body.rememberMe)

    return res
    .status(200)
    .cookie("accessToken", accessToken, getAccessTokenOptions(rememberMe))
    .cookie("refreshToken", refreshToken, getRefreshTokenOptions(rememberMe))
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
  
const getWatchLater = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchLater",
                foreignField: "_id",
                as: "watchLater",
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
            user[0]?.watchLater || [],
            "Watch later videos fetched successfully"
        )
    )
})

const toggleWatchLater = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
  
    if (!videoId) {
      return res.status(400).json(new ApiResponse(400, null, "Video ID is required"));
    }
  
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
        throw new ErrorResponse(404, "User not found");
    }

    const isAlreadyAdded = user.watchLater.includes(videoId);

    if (isAlreadyAdded) {
        await User.findByIdAndUpdate(userId, {
            $pull: { watchLater: videoId }
        });
        return res
            .status(200)
            .json(new ApiResponse(200, { added: false }, "Removed from watch later"));
    } else {
        await User.findByIdAndUpdate(userId, {
            $push: { watchLater: videoId }
        });
        return res
            .status(200)
            .json(new ApiResponse(200, { added: true }, "Added to watch later"));
    }
});
  


const sendOTP = asyncHandler(async (req, res) => {
    const { username, email, fullname, password } = req.body;

    if (!username || !email || !fullname || !password) {
        throw new ErrorResponse(400, "All fields are required for sign up");
    }

    // Check if verified user already exists
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existingUser && existingUser.isVerified) {
        throw new ErrorResponse(409, "User already exists with this username or email");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = existingUser;
    if (user) {
        // Update details of existing unverified user
        user.username = username.toLowerCase();
        user.fullname = fullname;
        user.password = password; // pre-save hashes it
        user.otp = otp;
        user.otpExpiry = otpExpiry;
    } else {
        // Create unverified user
        user = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            fullname,
            password,
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop", // default avatar
            isVerified: false,
            otp,
            otpExpiry
        });
    }

    await user.save();

    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
        throw new ErrorResponse(500, "Failed to send OTP email");
    }

    return res.status(200).json(
        new ApiResponse(200, { email }, "OTP sent to your email. Please verify.")
    );
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        throw new ErrorResponse(400, "Email and OTP are required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ErrorResponse(404, "User not found");
    }

    if (!user.otp || user.otp !== otp || new Date() > user.otpExpiry) {
        throw new ErrorResponse(400, "Invalid or expired OTP");
    }

    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const rememberMe = Boolean(req.body.rememberMe);

    return res
        .status(200)
        .cookie("accessToken", accessToken, getAccessTokenOptions(rememberMe))
        .cookie("refreshToken", refreshToken, getRefreshTokenOptions(rememberMe))
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User verified and logged in successfully"
            )
        );
});

const forgotPasswordOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ErrorResponse(400, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ErrorResponse(404, "User with this email does not exist");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });

    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
        throw new ErrorResponse(500, "Failed to send OTP email");
    }

    return res.status(200).json(
        new ApiResponse(200, { email }, "OTP sent to your email for password reset")
    );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        throw new ErrorResponse(400, "Email, OTP and new password are required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ErrorResponse(404, "User not found");
    }

    if (!user.otp || user.otp !== otp || new Date() > user.otpExpiry) {
        throw new ErrorResponse(400, "Invalid or expired OTP");
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save(); // triggers pre-save hash

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully")
    );
});

const googleLogin = asyncHandler(async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        throw new ErrorResponse(400, "Credential (idToken) is required");
    }

    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch (error) {
        console.error("Google verify ID Token error:", error);
        throw new ErrorResponse(400, "Invalid Google Token");
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists with googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
        // Link googleId if not already present
        if (!user.googleId) {
            user.googleId = googleId;
            if (!user.avatar) {
                user.avatar = picture;
            }
            await user.save({ validateBeforeSave: false });
        }
    } else {
        // Create new user via Google Sign-In
        // Generate a random username from email
        const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
        const uniqueUsername = `${baseUsername}${Math.floor(100 + Math.random() * 900)}`;

        user = await User.create({
            username: uniqueUsername.toLowerCase(),
            email: email.toLowerCase(),
            fullname: name,
            avatar: picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop",
            googleId,
            isVerified: true,
        });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await genrateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const rememberMe = req.body.rememberMe !== undefined ? Boolean(req.body.rememberMe) : true;

    return res
        .status(200)
        .cookie("accessToken", accessToken, getAccessTokenOptions(rememberMe))
        .cookie("refreshToken", refreshToken, getRefreshTokenOptions(rememberMe))
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "Logged in with Google successfully"
            )
        );
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
    addToWatchHistory,
    getWatchLater,
    toggleWatchLater,
    sendOTP,
    verifyOTP,
    forgotPasswordOTP,
    resetPassword,
    googleLogin
}

