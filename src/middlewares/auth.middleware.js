import jwt from "jsonwebtoken";
import {User} from "../models/user.models.js"
import {ErrorResponse} from "../utils/ErrorResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

export const verifyJWT=asyncHandler(async (req,_ , next)=>{
    
    try {
        const token=req.cookies?.accessToken || req.body.accessToken || req.header("Authorization")?.replace("Bearer ","")
        // console.log(token);
        if(!token){
            throw new ErrorResponse(401,"unauthorized 1");
        }
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user=await User.findById(decodedToken?._id).select("-refreshToken -password")
        if(!user){
            throw new ErrorResponse(401,"unauthorized 2")
        }
        req.user=user
        next()
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ErrorResponse(401, "Unauthorized: Token has expired");
        } else if (error.name === "JsonWebTokenError") {
            throw new ErrorResponse(401, "Unauthorized: Invalid token");
        } else {
            throw new ErrorResponse(401, "Unauthorized: Token verification failed");
        }
    }

})