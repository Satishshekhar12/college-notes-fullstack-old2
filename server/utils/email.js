import nodemailer from "nodemailer";

const sendEmail = async (options) => {
	//1- Create a transporter
	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_HOST,
		port: process.env.EMAIL_PORT,
		auth: {
			user: process.env.EMAIL_USER, // Your email address
			pass: process.env.EMAIL_PASS, // Your email password or app password
		},
		//Using Mailtrap for development
	});

	//2- Define email options
	const mailOptions = {
		from: `${process.env.EMAIL_FROM_NAME || "College Notes"} <${
			process.env.EMAIL_USER
		}>`,
		to: options.email,
		subject: options.subject,
		text: options.message,
		html: options.html || options.message,
	};

	//3- Send email with nodemailer
	await transporter.sendMail(mailOptions);
};

export default sendEmail;
