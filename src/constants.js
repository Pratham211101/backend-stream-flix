export const DB_NAME='vidtube'
export const options={
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:process.env.NODE_ENV==="production"?"none":"lax",
}