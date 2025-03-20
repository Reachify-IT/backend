const axios = require('axios');
const mongoose = require('mongoose');
const MailInfoSchema = require('../models/MailInfoSchema');
const { sendNotification } = require('./notificationService');

const processEmailService = async ({
    userId,
    client_name,
    client_company,
    client_designation,
    client_mail,
    client_website,
    video_path
}) => {
    console.log(client_name, client_company, client_designation, client_mail, client_website, video_path);

    const objectId = new mongoose.Types.ObjectId(userId);
    const MailInfo = await MailInfoSchema.findOne({ userId: objectId });

    if (!MailInfo) {
        throw new Error('User not found');
    }

    console.log("MailInfo:", MailInfo);

    try {
        console.log('AI Processing email...');
        const response = await axios.post('https://api.loomifyinnovations.com/api/process-email', {
            "my_company": MailInfo.my_company,
            "my_designation": MailInfo.my_designation,
            "my_name": MailInfo.my_name,
            "my_mail": MailInfo.my_mail,
            "my_work": MailInfo.my_work,
            "my_cta_link": MailInfo.my_cta_link,
            client_name,
            client_company,
            client_designation,
            client_mail,
            client_website,
            video_path
        }, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
        });

        console.log('Email processed successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error processing email:', error.response?.data || error.message);

        let errorMessage = '❌ Email processing failed!';
        if (error.code === 'ETIMEDOUT') {
            errorMessage += ' Server timeout. Please check your connection or try again later.';
        } else if (error.response) {
            errorMessage += ` Server responded with: ${error.response.status} - ${error.response.statusText}`;
        } else {
            errorMessage += ' An unexpected error occurred.';
        }

        // Send notification with the failure reason
        sendNotification(userId, `${errorMessage} (Email: ${client_mail})`);
        throw error;
    }
};

module.exports = processEmailService;
