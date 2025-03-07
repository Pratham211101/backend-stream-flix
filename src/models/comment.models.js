import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
const commentSchema=new Schema({
    content:{
        type:String,
        required:true
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    video:{
        type:Schema.Types.ObjectId,
        ref:"Videos"
    }
},{timestamps:true})
commentSchema.plugin(mongooseAggregatePaginate)
export const Comment=mongoose.models("Comment",commentSchema)