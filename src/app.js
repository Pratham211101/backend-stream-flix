import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
const bodyParser = require("body-parser"); 
router.use(bodyParser.json());
const app=express()

app.use(
    cors({
        origin:process.env.CORS_ORIGIN,
        credentials:true

    })
)
//middlewares
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes

import healthCheckRouter from './routes/healthcheck.routes.js'
import userRouter from './routes/user.routes.js'
import commentRouter from "./routes/comment.routes.js"
import videoRouter from "./routes/video.routes.js"
import likeRouter from "./routes/like.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"

//routes declaration
app.use("/api/v1/healthcheck",healthCheckRouter)
app.use("/api/v1/users",userRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/playlists", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)



import { errorHandler } from './middlewares/error.middleware.js'
app.use(errorHandler)
export {app}