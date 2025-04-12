import { Router } from 'express';
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,
} from "../controllers/comment.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();

// Public: View comments
router.get("/:videoId", getVideoComments);
// Protected: Add, update, delete comment
router.post("/:videoId", verifyJWT, addComment);
router.patch("/c/:commentId", verifyJWT, updateComment);
router.delete("/c/:commentId", verifyJWT, deleteComment);

export default router