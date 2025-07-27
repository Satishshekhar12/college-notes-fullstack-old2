import e from "express";
import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";

const signToken = (id) => {
	return jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

export const getAllUsers = catchAsync(async (req, res, next) => {
	const users = await User.find().select("-password -passwordConfirm");
	res.status(200).json({
		status: "success",
		results: users.length,
		data: {
			users,
		},
	});
});

export const getUser = catchAsync(async (req, res, next) => {
	const user = await User.findById(req.params.id);
	if (!user) {
		return next({
			statusCode: 404,
			message: "No user found with that ID",
		});
	}
	res.status(200).json({
		status: "success",
		data: {
			user,
		},
	});
});
