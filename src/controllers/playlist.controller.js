import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.models.js"
import { ErrorResponse } from "../utils/ErrorResponse.js"
import { ApiResponse } from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    //TODO: create playlist
    if(!name || !description){
        throw new ErrorResponse(400,"name and description are required")
    }
    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user._id
    })
    res.status(201).json(new ApiResponse(201,playlist,"playlist created successfully"))

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    const playlists = await Playlist.find({owner:userId})
    if(!playlists){
        throw new ErrorResponse(404, "no playlists found")
    }
    res.status(200).json(new ApiResponse(200,playlists,"playlists retrieved successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ErrorResponse(404, "playlist not found")
    }
    res.status(200).json(new ApiResponse(200, playlist, "playlist retrieved successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    //Todo: add video to playlist
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ErrorResponse(404, "playlist not found")
    }
    if(!isValidObjectId(videoId)){
        throw new ErrorResponse(400, "invalid video id")
    }
    if(playlist.videos.includes(videoId)){
        throw new ErrorResponse(400, "video already in playlist")
    }
    await playlist.videos.push(videoId)
    await playlist.save()
    res.status(200).json(new ApiResponse(200, playlist, "video added to playlist successfully"))

    

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ErrorResponse(404, "playlist not found")
    }
    if(!isValidObjectId(videoId)){
        throw new ErrorResponse(400, "invalid video id")
    }
    if(!playlist.videos.includes(videoId)){
        throw new ErrorResponse(400, "video not in playlist")
    }
    await playlist.videos.pull(videoId)
    await playlist.save()
    res.status(200).json(new ApiResponse(200, playlist, "video removed from playlist successfully"))

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ErrorResponse(404, "playlist not found")
    }
    await Playlist.findByIdAndDelete(playlistId)
    res.status(200).json(new ApiResponse(200, null, "playlist deleted successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
    if(!name && !description){
        throw new ErrorResponse(400, "name or description is required")
    }
    const playlist = await Playlist.findById(playlistId)
    if(!playlist){
        throw new ErrorResponse(404, "playlist not found")
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        { 
            $set: { 
                name : name || playlist.name,
                description : description || playlist.description
            } 
        },
        { new: true }
        
    );

    res.status(200).json(new ApiResponse(200, updatedPlaylist, "playlist updated successfully"))
    
    

    
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
