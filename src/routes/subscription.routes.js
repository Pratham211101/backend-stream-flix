import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
    getSubscriptionVideos,
} from "../controllers/subscription.controller.js"


import {verifyJWT, verifyJWTOptional} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/feed").get(verifyJWTOptional, getSubscriptionVideos);
router.route("/u/:subscriberId").get( getSubscribedChannels);

router
    .route("/c/:channelId")
    .get(verifyJWTOptional, getUserChannelSubscribers)
    .post(verifyJWT, toggleSubscription);

export default router;