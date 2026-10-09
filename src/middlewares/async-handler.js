export const asyncHandler = (controller) => {
    return (req, res, next) => {
        controller(req, res, next).catch(next);
    };
};
//# sourceMappingURL=async-handler.js.map