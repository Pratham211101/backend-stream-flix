import { Router } from "express";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT, verifyJWTOptional } from "../middlewares/auth.middleware.js";
import { 
    logOutUser,
    loginUser,  
    registerUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory, 
    updateAccountDetails,
    addToWatchHistory,
    sendOTP,
    verifyOTP,
    forgotPasswordOTP,
    resetPassword,
    googleLogin,
    getWatchLater,
    toggleWatchLater
} from "../controllers/user.controllers.js";

const router=Router()


router.route('/register').post(
    upload.fields([
        {
            name:'avatar',
            maxCount:1
        },{
            name:'coverImage',
            maxCount:1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)
router.route("/send-otp").post(sendOTP)
router.route("/verify-otp").post(verifyOTP)
router.route("/forgot-password-otp").post(forgotPasswordOTP)
router.route("/reset-password").post(resetPassword)
router.route("/google-login").post(googleLogin)

//secured routes
router.route('/logout').post(verifyJWT,logOutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWTOptional, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

router.route("/c/:username").get(verifyJWTOptional, getUserChannelProfile)
router.route("/history").get(verifyJWT, getWatchHistory)
router.route("/history/:videoId").patch(verifyJWT, addToWatchHistory)
router.route("/watch-later").get(verifyJWT, getWatchLater)
router.route("/watch-later/:videoId").post(verifyJWT, toggleWatchLater)


export default router