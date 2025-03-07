export const asyncHandler=(requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }
}
// Function Accepts a Handler (requestHandler)

// The function asyncHandler takes an asynchronous request handler as an argument.
// Returns a New Function (req, res, next)

// This function wraps the original request handler.
// Executes the Handler Inside a Promise.resolve()

// This ensures that even if requestHandler is an async function (which returns a promise), any errors will be caught.
// Catches Errors and Passes Them to next()

// If requestHandler throws an error (or rejects), .catch(next) automatically forwards the error to Express’s built-in error handling middleware.